const tabs = document.querySelectorAll(".settings-tab");
const panels = document.querySelectorAll(".settings-panel");
const skillElements = {
  enabledToggle: document.querySelector("#skillsEnabledToggle"),
  enabledLabel: document.querySelector("#skillsEnabledLabel"),
  architectureToggle: document.querySelector("#architectureSkillsToggle"),
  architectureDiagram: document.querySelector("#runtimeArchitectureDiagram"),
  list: document.querySelector("#skillsList"),
  emptyState: document.querySelector("#skillsEmptyState"),
  createButton: document.querySelector("#createSkillButton"),
  dialog: document.querySelector("#skillEditorDialog"),
  form: document.querySelector("#skillEditorForm"),
  title: document.querySelector("#skillEditorTitle"),
  nameInput: document.querySelector("#skillNameInput"),
  descriptionInput: document.querySelector("#skillDescriptionInput"),
  instructionsInput: document.querySelector("#skillInstructionsInput"),
  closeButton: document.querySelector("#closeSkillEditorButton"),
  cancelButton: document.querySelector("#cancelSkillEditorButton")
};
const promptElements = {
  input: document.querySelector("#systemPromptInput"),
  saveButton: document.querySelector("#saveSystemPromptButton"),
  resetButton: document.querySelector("#resetSystemPromptButton"),
  status: document.querySelector("#promptSaveStatus"),
  count: document.querySelector("#promptCharacterCount"),
  modeBadge: document.querySelector("#promptModeBadge"),
  modeLabel: document.querySelector("#promptModeLabel"),
  advancedInputs: [...document.querySelectorAll("[data-prompt-key]")]
};
let savedSystemPrompt = BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT;
let savedPromptSettings = BrowserChatPromptConfig.normalizePromptSettings();
let skillsEnabled = true;
let skills = [];
let editingSkillId = null;

function activatePanel(panelId, { updateHash = false } = {}) {
  const tab = [...tabs].find((item) => item.dataset.panel === panelId);
  if (!tab) return;
  for (const item of tabs) {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  }
  for (const panel of panels) {
    panel.hidden = panel.id !== panelId;
  }
  if (updateHash) history.replaceState(null, "", `#${panelId}`);
  const activePanel = document.querySelector(`#${panelId}`);
  if (activePanel) void renderMermaidIn(activePanel);
}

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    activatePanel(tab.dataset.panel, { updateHash: true });
  });
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  flowchart: {
    curve: "basis",
    htmlLabels: false,
    useMaxWidth: true
  },
  themeVariables: {
    background: "#ffffff",
    lineColor: "#8d8d87",
    fontSize: "13px",
    edgeLabelBackground: "#ffffff"
  }
});

async function renderMermaidIn(container) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const selector = `#${container.id} .mermaid:not([data-processed='true'])`;
  if (document.querySelector(selector)) {
    try {
      await mermaid.run({ querySelector: selector });
    } catch (error) {
      console.error("Could not render a settings diagram.", error);
    }
  }

  for (const diagram of container.querySelectorAll(".settings-mermaid:not(.rendered)")) {
    if (diagram.id === "runtimeArchitectureDiagram") continue;
    const source = diagram.textContent.trim();
    try {
      const { svg, bindFunctions } = await mermaid.render(
        `mermaid-settings-${crypto.randomUUID()}`,
        source
      );
      diagram.innerHTML = svg;
      diagram.classList.add("rendered");
      bindFunctions?.(diagram);
    } catch (error) {
      diagram.classList.add("failed");
      console.error("Could not render a settings diagram.", error);
    }
  }
}

const initialPanel = document.querySelector(".settings-panel:not([hidden])");
if (initialPanel && initialPanel.id !== "runtime") void renderMermaidIn(initialPanel);
if (location.hash) activatePanel(location.hash.slice(1));

const ARCHITECTURE_WITH_SKILLS = `
flowchart TD
    A["User submits a prompt"] --> B["Build base conversation messages"]
    B --> C["Create skill-selection context"]
    C --> D["Ollama selects relevant skills"]
    D --> E{"Were any skills selected?"}
    E -- No --> H["Use base system prompt"]
    E -- Yes --> F["Load selected skill instructions"]
    F --> G["Compose effective system prompt"]
    G --> H
    H --> I["Attach available tool schemas"]
    I --> J["Send effective prompt, messages, and tools to Ollama"]
    J --> K{"Did Ollama request tools?"}
    K -- No --> L["Display and save final answer"]
    K -- Yes --> M["Look up each tool by name"]
    M --> P{"Is the tool registered?"}
    P -- No --> Q["Record unsupported tool request"]
    Q --> O
    P -- Yes --> N["Execute tool functions"]
    N --> O["Append results as role: tool messages"]
    O --> J

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef skill fill:#eaf1fb,stroke:#89a9cf,color:#315b87
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class A,B input
    class C,F,G skill
    class D,E,H,I,J,K,P model
    class M,N,O,Q tool
    class L output
`;

const ARCHITECTURE_WITHOUT_SKILLS = `
flowchart TD
    A["User submits a prompt"] --> B["Build conversation messages"]
    B --> C["Attach available tool schemas"]
    C --> D["Send messages and tools to Ollama"]
    D --> E{"Did Ollama request tools?"}
    E -- No --> F["Display and save final answer"]
    E -- Yes --> G["Look up each tool by name"]
    G --> H["Execute tool functions"]
    H --> I["Append results as role: tool messages"]
    I --> D

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class A,B input
    class C,D,E model
    class G,H,I tool
    class F output
`;

async function renderRuntimeArchitecture() {
  const source = skillsEnabled
    ? ARCHITECTURE_WITH_SKILLS
    : ARCHITECTURE_WITHOUT_SKILLS;
  try {
    const { svg, bindFunctions } = await mermaid.render(
      `mermaid-runtime-${crypto.randomUUID()}`,
      source
    );
    skillElements.architectureDiagram.innerHTML = svg;
    skillElements.architectureDiagram.classList.add("rendered");
    bindFunctions?.(skillElements.architectureDiagram);
  } catch (error) {
    skillElements.architectureDiagram.textContent = source;
    console.error("Could not render the runtime architecture diagram.", error);
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSkills() {
  skillElements.enabledToggle.checked = skillsEnabled;
  skillElements.architectureToggle.checked = skillsEnabled;
  skillElements.enabledLabel.textContent = skillsEnabled ? "On" : "Off";
  skillElements.list.innerHTML = skills.map((skill) => `
    <article class="skill-card" data-skill-id="${escapeHtml(skill.id)}">
      <div class="skill-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path d="m5 7 7 4 7-4M12 11v10"/></svg>
      </div>
      <div class="skill-card-copy">
        <strong>${escapeHtml(skill.name)}</strong>
        <p>${escapeHtml(skill.description || "No description")}</p>
      </div>
      <div class="skill-card-actions">
        <button type="button" data-edit-skill="${escapeHtml(skill.id)}">Edit</button>
        <button class="destructive" type="button" data-delete-skill="${escapeHtml(skill.id)}">Delete</button>
      </div>
    </article>
  `).join("");
  skillElements.emptyState.hidden = skills.length > 0;
}

async function updateSkillsEnabled(enabled) {
  skillsEnabled = await BrowserChatSkills.setEnabled(enabled);
  renderSkills();
  await renderRuntimeArchitecture();
}

function openSkillEditor(skill = null) {
  editingSkillId = skill?.id || null;
  skillElements.title.textContent = skill ? "Edit skill" : "Create skill";
  skillElements.nameInput.value = skill?.name || "";
  skillElements.descriptionInput.value = skill?.description || "";
  skillElements.instructionsInput.value = skill?.instructions || "";
  skillElements.dialog.showModal();
  skillElements.nameInput.focus();
}

function closeSkillEditor() {
  skillElements.dialog.close();
  editingSkillId = null;
  skillElements.form.reset();
}

async function loadSkillsSettings() {
  const state = await BrowserChatSkills.load();
  skillsEnabled = state.enabled;
  skills = state.skills;
  renderSkills();
  await renderRuntimeArchitecture();
}

skillElements.enabledToggle.addEventListener("change", () => {
  void updateSkillsEnabled(skillElements.enabledToggle.checked);
});
skillElements.architectureToggle.addEventListener("change", () => {
  void updateSkillsEnabled(skillElements.architectureToggle.checked);
});
skillElements.createButton.addEventListener("click", () => openSkillEditor());
skillElements.closeButton.addEventListener("click", closeSkillEditor);
skillElements.cancelButton.addEventListener("click", closeSkillEditor);
skillElements.dialog.addEventListener("click", (event) => {
  if (event.target === skillElements.dialog) closeSkillEditor();
});
skillElements.list.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-skill]");
  if (editButton) {
    openSkillEditor(skills.find((skill) => skill.id === editButton.dataset.editSkill));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-skill]");
  if (!deleteButton) return;
  const skill = skills.find((item) => item.id === deleteButton.dataset.deleteSkill);
  if (!skill || !window.confirm(`Delete the “${skill.name}” skill?`)) return;
  skills = await BrowserChatSkills.saveSkills(
    skills.filter((item) => item.id !== skill.id)
  );
  renderSkills();
});
skillElements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const existing = skills.find((skill) => skill.id === editingSkillId);
  const now = Date.now();
  const next = BrowserChatSkills.normalizeSkill({
    ...existing,
    id: existing?.id || BrowserChatSkills.createId(skillElements.nameInput.value),
    name: skillElements.nameInput.value,
    description: skillElements.descriptionInput.value,
    instructions: skillElements.instructionsInput.value,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  });
  skills = existing
    ? skills.map((skill) => (skill.id === existing.id ? next : skill))
    : [...skills, next];
  skills = await BrowserChatSkills.saveSkills(skills);
  renderSkills();
  closeSkillEditor();
});

function getPromptStorage() {
  return globalThis.chrome?.storage?.local || null;
}

function renderPromptEditor({ status = "" } = {}) {
  const value = promptElements.input.value;
  const normalized = BrowserChatPromptConfig.normalizeSystemPrompt(value);
  const dirty = normalized !== savedSystemPrompt;
  const settings = readPromptSettings();
  const settingsDirty = Object.keys(settings).some(
    (key) => settings[key] !== savedPromptSettings[key]
  );
  const isDefault =
    normalized === BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT &&
    Object.keys(settings).every(
      (key) => settings[key] === BrowserChatPromptConfig.DEFAULT_PROMPT_SETTINGS[key]
    );

  promptElements.count.textContent =
    `${value.length.toLocaleString()} ${value.length === 1 ? "character" : "characters"}`;
  promptElements.saveButton.disabled = !dirty && !settingsDirty;
  promptElements.modeBadge.classList.toggle("default", isDefault);
  promptElements.modeBadge.classList.toggle("custom", !isDefault);
  promptElements.modeLabel.textContent = isDefault ? "Default" : "Custom";
  promptElements.status.textContent =
    status || (dirty || settingsDirty ? "Unsaved changes" : "Saved");
}

function readPromptSettings() {
  return Object.fromEntries(
    promptElements.advancedInputs.map((input) => [input.dataset.promptKey, input.value.trim()])
  );
}

async function loadPromptEditor() {
  const storage = getPromptStorage();
  let storedValue;
  if (storage) {
    const stored = await storage.get([
      BrowserChatPromptConfig.STORAGE_KEY,
      BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY
    ]);
    storedValue = stored[BrowserChatPromptConfig.STORAGE_KEY];
    savedPromptSettings = BrowserChatPromptConfig.normalizePromptSettings(
      stored[BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY]
    );
  }
  savedSystemPrompt = BrowserChatPromptConfig.normalizeSystemPrompt(storedValue);
  promptElements.input.value = savedSystemPrompt;
  for (const input of promptElements.advancedInputs) {
    input.value = savedPromptSettings[input.dataset.promptKey];
  }
  renderPromptEditor({ status: "Loaded" });
}

promptElements.input.addEventListener("input", () => renderPromptEditor());
for (const input of promptElements.advancedInputs) {
  input.addEventListener("input", () => renderPromptEditor());
}

promptElements.saveButton.addEventListener("click", async () => {
  const value = BrowserChatPromptConfig.normalizeSystemPrompt(
    promptElements.input.value
  );
  const storage = getPromptStorage();
  const settings = readPromptSettings();
  promptElements.saveButton.disabled = true;
  promptElements.status.textContent = "Saving…";
  try {
    if (storage) {
      await storage.set({
        [BrowserChatPromptConfig.STORAGE_KEY]: value,
        [BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY]: settings
      });
    }
    savedSystemPrompt = value;
    savedPromptSettings = settings;
    promptElements.input.value = value;
    renderPromptEditor({ status: "Saved" });
  } catch {
    promptElements.saveButton.disabled = false;
    promptElements.status.textContent = "Could not save changes";
  }
});

promptElements.resetButton.addEventListener("click", async () => {
  const storage = getPromptStorage();
  promptElements.resetButton.disabled = true;
  promptElements.status.textContent = "Resetting…";
  try {
    if (storage) {
      await storage.remove([
        BrowserChatPromptConfig.STORAGE_KEY,
        BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY
      ]);
    }
    savedSystemPrompt = BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT;
    savedPromptSettings = BrowserChatPromptConfig.normalizePromptSettings();
    promptElements.input.value = savedSystemPrompt;
    for (const input of promptElements.advancedInputs) {
      input.value = savedPromptSettings[input.dataset.promptKey];
    }
    renderPromptEditor({ status: "Reset to default" });
  } catch {
    promptElements.status.textContent = "Could not reset the prompt";
  } finally {
    promptElements.resetButton.disabled = false;
  }
});

void loadPromptEditor();
void loadSkillsSettings();
