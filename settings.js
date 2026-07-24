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
const toolElements = {
  count: document.querySelector("#toolCount"),
  list: document.querySelector("#toolsList"),
  emptyState: document.querySelector("#toolsEmptyState")
};
const ragElements = {
  form: document.querySelector("#ragSettingsForm"),
  enabled: document.querySelector("#ragEnabledInput"),
  enabledLabel: document.querySelector("#ragEnabledLabel"),
  model: document.querySelector("#ragEmbeddingModelInput"),
  chunkSize: document.querySelector("#ragChunkSizeInput"),
  overlap: document.querySelector("#ragChunkOverlapInput"),
  minimumChunk: document.querySelector("#ragMinimumChunkInput"),
  batchSize: document.querySelector("#ragBatchSizeInput"),
  topK: document.querySelector("#ragTopKInput"),
  finalChunks: document.querySelector("#ragFinalChunksInput"),
  contextBudget: document.querySelector("#ragContextBudgetInput"),
  neighbor: document.querySelector("#ragNeighborInput"),
  similarity: document.querySelector("#ragSimilarityInput"),
  reset: document.querySelector("#resetRagSettingsButton"),
  status: document.querySelector("#ragSaveStatus")
};
const databaseElements = {
  refresh: document.querySelector("#refreshDatabaseButton"),
  recordCount: document.querySelector("#databaseRecordCount"),
  storageSize: document.querySelector("#databaseStorageSize"),
  version: document.querySelector("#databaseVersionBadge"),
  schemaCounts: document.querySelector("#databaseSchemaCounts"),
  schemaDiagram: document.querySelector("#databaseSchemaDiagram"),
  attachmentsTabCount: document.querySelector("#attachmentsTabCount"),
  chunksTabCount: document.querySelector("#chunksTabCount"),
  tabs: [...document.querySelectorAll("[data-database-store]")],
  search: document.querySelector("#databaseSearchInput"),
  title: document.querySelector("#databaseTableTitle"),
  description: document.querySelector("#databaseTableDescription"),
  status: document.querySelector("#databaseTableStatus"),
  head: document.querySelector("#databaseTableHead"),
  body: document.querySelector("#databaseTableBody"),
  empty: document.querySelector("#databaseEmptyState"),
  visibleRows: document.querySelector("#databaseVisibleRows")
};
let savedSystemPrompt = BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT;
let savedPromptSettings = BrowserChatPromptConfig.normalizePromptSettings();
let skillsEnabled = true;
let skills = [];
let editingSkillId = null;
let databaseSnapshot = null;
let activeDatabaseStore = "attachments";

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
  if (panelId === "database") void loadDatabaseExplorer();
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
    if (
      diagram.id === "runtimeArchitectureDiagram" ||
      diagram.id === "databaseSchemaDiagram"
    ) continue;
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
    U["Files attached or dropped"] --> V["Extract, chunk, and embed asynchronously"]
    V --> DB[("Store chat-scoped vectors in IndexedDB")]
    A["User submits a prompt"] --> W["Await attached-file indexing"]
    W --> C{"DOM context attached?"}
    C -- Yes --> D["Capture the active page"]
    C -- No --> R{"Is RAG enabled?"}
    D --> R
    R -- Yes --> X["Index captured DOM, then retrieve relevant chunks"]
    DB --> X
    R -- No --> Y["Keep full captured DOM, if any"]
    X --> S["Ollama selects relevant skills from the user prompt"]
    Y --> S
    S --> E{"Were any skills selected?"}
    E -- No --> H["Use base system prompt"]
    E -- Yes --> F["Load selected skill instructions"]
    F --> G["Compose effective system prompt"]
    G --> H
    H --> B["Build system, history, context, and user messages"]
    B --> I["Attach registered tool schemas"]
    I --> J["Send messages and tools to Ollama"]
    J --> K{"Did Ollama request tools?"}
    K -- No --> L["Display and save answer and source references"]
    K -- Yes --> M["Look up each tool by name"]
    M --> P{"Is the tool registered?"}
    P -- No --> Q["Record unsupported tool request"]
    Q --> O
    P -- Yes --> N["Execute tool function"]
    N --> O["Append role: tool result messages"]
    O --> J

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef skill fill:#eaf1fb,stroke:#89a9cf,color:#315b87
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class U,A,W,D input
    class S,F,G skill
    class C,R,E,H,B,I,J,K,P model
    class V,DB,X,Y,M,N,O,Q tool
    class L output
`;

const ARCHITECTURE_WITHOUT_SKILLS = `
flowchart TD
    U["Files attached or dropped"] --> V["Extract, chunk, and embed asynchronously"]
    V --> DB[("Store chat-scoped vectors in IndexedDB")]
    A["User submits a prompt"] --> W["Await attached-file indexing"]
    W --> C{"DOM context attached?"}
    C -- Yes --> P["Capture the active page"]
    C -- No --> R{"Is RAG enabled?"}
    P --> R
    R -- Yes --> X["Index captured DOM, then retrieve relevant chunks"]
    DB --> X
    R -- No --> Y["Keep full captured DOM, if any"]
    X --> B["Build system, history, context, and user messages"]
    Y --> B
    B --> T["Attach registered tool schemas"]
    T --> D["Send messages and tools to Ollama"]
    D --> E{"Did Ollama request tools?"}
    E -- No --> F["Display and save answer and source references"]
    E -- Yes --> G["Look up each tool by name"]
    G --> H["Execute registered tool or record unsupported request"]
    H --> I["Append role: tool result messages"]
    I --> D

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class U,A,W,P input
    class C,R,B,T,D,E model
    class V,DB,X,Y,G,H,I tool
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

function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function serializeDatabaseValue(value) {
  if (value == null) return "";
  if (value instanceof Blob) return `[Blob ${formatByteSize(value.size)} · ${value.type || "unknown type"}]`;
  if (ArrayBuffer.isView(value)) {
    const preview = [...value.slice(0, 6)].map((item) => Number(item).toFixed(4));
    return `[${preview.join(", ")}${value.length > 6 ? `, … · ${value.length} values` : ""}]`;
  }
  if (value instanceof ArrayBuffer) return `[ArrayBuffer ${formatByteSize(value.byteLength)}]`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function getDatabaseColumns(records) {
  const preferred = activeDatabaseStore === "attachments"
    ? ["id", "chatId", "name", "kind", "status", "mimeType", "chunkCount", "embeddingModel", "createdAt", "updatedAt"]
    : ["id", "attachmentId", "chatId", "attachmentName", "attachmentKind", "chunkIndex", "text", "tokenEstimate", "embeddingModel", "embeddingDimensions", "embedding", "createdAt"];
  const keys = new Set(records.flatMap((record) => Object.keys(record)));
  return [
    ...preferred.filter((key) => keys.delete(key)),
    ...[...keys].sort()
  ];
}

function databaseCellMarkup(key, value) {
  if (value == null || value === "") return '<span class="database-null">NULL</span>';
  if ((key === "createdAt" || key === "updatedAt") && Number.isFinite(Number(value))) {
    const date = new Date(Number(value));
    return `<time title="${escapeHtml(date.toISOString())}">${escapeHtml(date.toLocaleString())}</time>`;
  }
  const serialized = serializeDatabaseValue(value);
  const className = key === "text" || key === "extractedText"
    ? "database-long-text"
    : typeof value === "object"
      ? "database-json-value"
      : "";
  return `<span class="${className}" title="${escapeHtml(serialized)}">${escapeHtml(serialized)}</span>`;
}

async function renderDatabaseSchema() {
  if (!databaseSnapshot || !databaseElements.schemaDiagram) return;
  const source = `
classDiagram
    direction LR
    class attachments {
        string id [PK]
        string chatId [IDX]
        string name
        string kind
        string status
        string mimeType
        number chunkCount
        string extractedText
        string embeddingModel
        timestamp createdAt
        timestamp updatedAt
    }
    class chunks {
        string id [PK]
        string attachmentId [FK]
        string chatId [IDX]
        string attachmentName
        string attachmentKind
        number chunkIndex
        string text
        number tokenEstimate
        string embeddingModel
        number embeddingDimensions
        Float32Array embedding
        timestamp createdAt
    }
    attachments "1" --> "0..*" chunks : id to attachmentId
  `;
  try {
    const { svg, bindFunctions } = await mermaid.render(
      `mermaid-database-schema-${crypto.randomUUID()}`,
      source
    );
    databaseElements.schemaDiagram.innerHTML = svg;
    databaseElements.schemaDiagram.classList.remove("failed");
    databaseElements.schemaDiagram.classList.add("rendered");
    bindFunctions?.(databaseElements.schemaDiagram);
  } catch (error) {
    databaseElements.schemaDiagram.textContent = "Could not render the database relationship diagram.";
    databaseElements.schemaDiagram.classList.add("failed");
    console.error("Could not render the database schema.", error);
  }
}

function renderDatabaseTable() {
  if (!databaseSnapshot) return;
  const store = databaseSnapshot.stores[activeDatabaseStore];
  const query = databaseElements.search.value.trim().toLocaleLowerCase();
  const filtered = store.records.filter((record) =>
    !query || serializeDatabaseValue(record).toLocaleLowerCase().includes(query)
  );
  const columns = getDatabaseColumns(store.records);

  databaseElements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.databaseStore === activeDatabaseStore);
  });
  databaseElements.title.textContent = activeDatabaseStore;
  databaseElements.description.textContent = activeDatabaseStore === "attachments"
    ? "File and captured DOM source records"
    : "Text chunks and embedding vectors linked to attachments";
  databaseElements.status.textContent = query
    ? `${filtered.length} of ${store.records.length} records`
    : `${store.records.length} ${store.records.length === 1 ? "record" : "records"}`;
  databaseElements.visibleRows.textContent = `${filtered.length} ${filtered.length === 1 ? "row" : "rows"}`;
  databaseElements.head.innerHTML = columns.length
    ? `<tr><th class="database-row-number">#</th>${columns.map((key) => `<th><code>${escapeHtml(key)}</code></th>`).join("")}</tr>`
    : "";
  databaseElements.body.innerHTML = filtered.map((record, index) => `
    <tr>
      <td class="database-row-number">${index + 1}</td>
      ${columns.map((key) => `<td>${databaseCellMarkup(key, record[key])}</td>`).join("")}
    </tr>
  `).join("");
  databaseElements.empty.hidden = filtered.length > 0;
  databaseElements.head.closest("table").hidden = filtered.length === 0;
}

async function loadDatabaseExplorer({ force = false } = {}) {
  if (databaseSnapshot && !force) {
    renderDatabaseTable();
    return;
  }
  databaseElements.refresh.disabled = true;
  databaseElements.status.textContent = "Loading local data…";
  try {
    databaseSnapshot = await BrowserChatRagDatabase.inspect();
    const attachments = databaseSnapshot.stores.attachments.records;
    const chunks = databaseSnapshot.stores.chunks.records;
    const recordCount = attachments.length + chunks.length;
    let approximateBytes = 0;
    for (const record of [...attachments, ...chunks]) {
      approximateBytes += new Blob([serializeDatabaseValue(record)]).size;
    }
    databaseElements.recordCount.textContent = recordCount.toLocaleString();
    databaseElements.storageSize.textContent = formatByteSize(approximateBytes);
    databaseElements.version.textContent = `${databaseSnapshot.name} · v${databaseSnapshot.version}`;
    databaseElements.schemaCounts.textContent =
      `attachments: ${attachments.length.toLocaleString()} · chunks: ${chunks.length.toLocaleString()}`;
    databaseElements.attachmentsTabCount.textContent = attachments.length.toLocaleString();
    databaseElements.chunksTabCount.textContent = chunks.length.toLocaleString();
    await renderDatabaseSchema();
    renderDatabaseTable();
  } catch (error) {
    databaseElements.status.textContent = "Could not read IndexedDB";
    databaseElements.empty.hidden = false;
    databaseElements.empty.querySelector("strong").textContent = "Database unavailable";
    databaseElements.empty.querySelector("span").textContent = error instanceof Error ? error.message : String(error);
  } finally {
    databaseElements.refresh.disabled = false;
  }
}

databaseElements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeDatabaseStore = tab.dataset.databaseStore;
    databaseElements.search.value = "";
    renderDatabaseTable();
  });
});
databaseElements.search.addEventListener("input", renderDatabaseTable);
databaseElements.refresh.addEventListener("click", () => loadDatabaseExplorer({ force: true }));

function formatParameterType(property = {}) {
  if (Array.isArray(property.enum)) return property.enum.join(" · ");
  if (property.type === "array") {
    return `${property.items?.type || "value"}[]`;
  }
  return property.type || "value";
}

function renderTools() {
  const schemas = BrowserChatTools.getSchemas();
  toolElements.count.textContent = String(schemas.length);
  toolElements.emptyState.hidden = schemas.length > 0;
  toolElements.list.innerHTML = schemas.map((schema) => {
    const definition = schema.function || {};
    const parameters = definition.parameters?.properties || {};
    const required = new Set(definition.parameters?.required || []);
    const parameterRows = Object.entries(parameters).map(([name, property]) => `
      <li>
        <div>
          <code>${escapeHtml(name)}</code>
          <span class="tool-parameter-type">${escapeHtml(formatParameterType(property))}</span>
          ${required.has(name) ? '<span class="tool-required-badge">Required</span>' : '<span class="tool-optional-badge">Optional</span>'}
        </div>
        ${property.description ? `<p>${escapeHtml(property.description)}</p>` : ""}
      </li>
    `).join("");

    return `
      <article class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 7h8M8 12h8M8 17h5"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
          </div>
          <div>
            <div class="tool-name-row">
              <code>${escapeHtml(definition.name || "Unnamed tool")}</code>
              <span>Available</span>
            </div>
            <p>${escapeHtml(definition.description || "No description provided.")}</p>
          </div>
        </div>
        <div class="tool-parameters">
          <strong>Inputs</strong>
          ${parameterRows ? `<ul>${parameterRows}</ul>` : '<p class="tool-no-parameters">No inputs</p>'}
        </div>
      </article>
    `;
  }).join("");
}

renderTools();

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

function populateRagSettings(value) {
  const configuration = BrowserChatRagConfig.normalize(value);
  ragElements.enabled.checked = configuration.enabled;
  ragElements.enabledLabel.textContent = configuration.enabled ? "On" : "Off";
  ragElements.model.value = configuration.embeddingModel;
  ragElements.chunkSize.value = configuration.chunkSizeTokens;
  ragElements.overlap.value = configuration.chunkOverlapTokens;
  ragElements.minimumChunk.value = configuration.minimumChunkTokens;
  ragElements.batchSize.value = configuration.embeddingBatchSize;
  ragElements.topK.value = configuration.candidateTopK;
  ragElements.finalChunks.value = configuration.finalChunkCount;
  ragElements.contextBudget.value = configuration.maximumContextTokens;
  ragElements.neighbor.value = configuration.neighborExpansion;
  ragElements.similarity.value = configuration.minimumSimilarity;
}

function readRagSettings() {
  return BrowserChatRagConfig.normalize({
    enabled: ragElements.enabled.checked,
    embeddingModel: ragElements.model.value,
    chunkSizeTokens: ragElements.chunkSize.value,
    chunkOverlapTokens: ragElements.overlap.value,
    minimumChunkTokens: ragElements.minimumChunk.value,
    embeddingBatchSize: ragElements.batchSize.value,
    candidateTopK: ragElements.topK.value,
    finalChunkCount: ragElements.finalChunks.value,
    maximumContextTokens: ragElements.contextBudget.value,
    neighborExpansion: ragElements.neighbor.value,
    minimumSimilarity: ragElements.similarity.value
  });
}

async function loadRagSettings() {
  const storage = getPromptStorage();
  const stored = storage
    ? await storage.get(BrowserChatRagConfig.STORAGE_KEY)
    : {};
  populateRagSettings(stored[BrowserChatRagConfig.STORAGE_KEY]);
  ragElements.status.textContent = "Loaded";
}

ragElements.enabled.addEventListener("change", () => {
  ragElements.enabledLabel.textContent = ragElements.enabled.checked ? "On" : "Off";
  ragElements.status.textContent = "Unsaved changes";
});

for (const input of ragElements.form.querySelectorAll("input")) {
  if (input === ragElements.enabled) continue;
  input.addEventListener("input", () => {
    ragElements.status.textContent = "Unsaved changes";
  });
}

ragElements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const configuration = readRagSettings();
  ragElements.status.textContent = "Saving…";
  try {
    const storage = getPromptStorage();
    if (storage) {
      await storage.set({
        [BrowserChatRagConfig.STORAGE_KEY]: configuration
      });
    }
    populateRagSettings(configuration);
    ragElements.status.textContent = "Saved";
  } catch {
    ragElements.status.textContent = "Could not save settings";
  }
});

ragElements.reset.addEventListener("click", async () => {
  populateRagSettings(BrowserChatRagConfig.DEFAULTS);
  const storage = getPromptStorage();
  if (storage) {
    await storage.set({
      [BrowserChatRagConfig.STORAGE_KEY]: BrowserChatRagConfig.normalize()
    });
  }
  ragElements.status.textContent = "Reset to defaults";
});

void loadPromptEditor();
void loadSkillsSettings();
void loadRagSettings();
