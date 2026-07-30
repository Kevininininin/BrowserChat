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
  recordCalloutButton: document.querySelector("#recordSkillCalloutButton"),
  writeButton: document.querySelector("#writeSkillButton"),
  importButton: document.querySelector("#importSkillButton"),
  importInput: document.querySelector("#importSkillInput"),
  importStatus: document.querySelector("#skillImportStatus"),
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
  contextList: document.querySelector("#contextToolsList"),
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
  dbmlCode: document.querySelector("#databaseDbmlCode"),
  copyDbml: document.querySelector("#copyDatabaseDbmlButton"),
  openDiagram: document.querySelector("#openDatabaseDiagramButton"),
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
const fileElements = {
  refresh: document.querySelector("#refreshFilesButton"),
  search: document.querySelector("#filesSearchInput"),
  filters: [...document.querySelectorAll("[data-files-filter]")],
  count: document.querySelector("#filesSourceCount"),
  list: document.querySelector("#filesSourceList"),
  empty: document.querySelector("#filesEmptyState"),
  previewEmpty: document.querySelector("#filesPreviewEmpty"),
  preview: document.querySelector("#filesPreview"),
  title: document.querySelector("#filesPreviewTitle"),
  status: document.querySelector("#filesPreviewStatus"),
  metadata: document.querySelector("#filesPreviewMetadata"),
  model: document.querySelector("#filesPreviewModel"),
  chunkSummary: document.querySelector("#filesChunkSummary"),
  whitespace: document.querySelector("#filesWhitespaceToggle"),
  warnings: document.querySelector("#filesWarnings"),
  imagePreview: document.querySelector("#filesImagePreview"),
  imagePreviewImage: document.querySelector("#filesImagePreviewImage"),
  imagePreviewMeta: document.querySelector("#filesImagePreviewMeta"),
  chunks: document.querySelector("#filesChunksList"),
  chunksEmpty: document.querySelector("#filesChunksEmpty")
};
const accessElements = {
  allSitesToggle: document.querySelector("#allSitesAccessToggle"),
  allSitesLabel: document.querySelector("#allSitesAccessLabel"),
  refresh: document.querySelector("#refreshSiteAccessButton"),
  list: document.querySelector("#approvedSitesList"),
  empty: document.querySelector("#approvedSitesEmpty"),
  status: document.querySelector("#siteAccessStatus")
};
const REQUIRED_HOST_ORIGINS = new Set([
  "http://localhost:11434/*",
  "http://127.0.0.1:11434/*"
]);
let savedSystemPrompt = BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT;
let savedPromptSettings = BrowserChatPromptConfig.normalizePromptSettings();
let skillsEnabled = true;
let skills = [];
let editingSkillId = null;
let databaseSnapshot = null;
let activeDatabaseStore = "attachments";
let selectedFileId = null;
let activeFilesFilter = "all";
let filesImagePreviewUrl = null;

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
  if (panelId === "indexed-files") void loadFilesExplorer();
  if (panelId === "site-access") void loadSiteAccess();
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

function describeOriginPattern(pattern) {
  if (pattern === "<all_urls>") {
    return { name: "All sites", detail: pattern };
  }
  try {
    const normalized = pattern.replace("*://", "https://").replace(/\/\*$/, "/");
    const url = new URL(normalized);
    return {
      name: url.hostname || pattern,
      detail: pattern
    };
  } catch {
    return { name: pattern, detail: pattern };
  }
}

function getStoredSiteFavicon(site) {
  if (site.faviconUrl) return site.faviconUrl;
  const pageUrl = site.pageUrl || site.originPattern.replace(/\/\*$/, "/");
  return chrome.runtime.getURL(
    `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
  );
}

function renderApprovedSites(sites, allSitesEnabled) {
  accessElements.list.replaceChildren();
  const approvedSites = [...sites].sort((left, right) =>
    (left.hostname || left.originPattern).localeCompare(
      right.hostname || right.originPattern
    )
  );

  accessElements.empty.hidden = approvedSites.length > 0;
  for (const site of approvedSites) {
    const details = describeOriginPattern(site.originPattern);
    const row = document.createElement("article");
    row.className = "access-site-row";

    const icon = document.createElement("img");
    icon.className = "access-site-icon";
    icon.src = getStoredSiteFavicon(site);
    icon.alt = "";
    icon.addEventListener("error", () => {
      icon.src = chrome.runtime.getURL("assets/icon-32.png");
    }, { once: true });

    const copy = document.createElement("div");
    copy.className = "access-site-copy";
    const name = document.createElement("strong");
    name.textContent = site.hostname || details.name;
    const pattern = document.createElement("span");
    pattern.textContent = site.originPattern;
    copy.append(name, pattern);
    if (allSitesEnabled) {
      const inherited = document.createElement("small");
      inherited.textContent = "Also covered by all-sites access";
      copy.append(inherited);
    }

    const remove = document.createElement("button");
    remove.className = "access-revoke-button";
    remove.type = "button";
    remove.dataset.origin = site.originPattern;
    remove.textContent = "Revoke";
    remove.setAttribute(
      "aria-label",
      `Revoke access to ${site.hostname || details.name}`
    );

    row.append(icon, copy, remove);
    accessElements.list.append(row);
  }
}

async function mergeChromeSitesIntoRegistry(permissionOrigins, storedSites) {
  const sitesByOrigin = new Map(
    storedSites.map((site) => [site.originPattern, site])
  );
  let changed = false;
  for (const originPattern of permissionOrigins) {
    if (
      originPattern === "<all_urls>" ||
      REQUIRED_HOST_ORIGINS.has(originPattern) ||
      sitesByOrigin.has(originPattern)
    ) {
      continue;
    }
    const details = describeOriginPattern(originPattern);
    sitesByOrigin.set(originPattern, {
      originPattern,
      hostname: details.name,
      pageUrl: originPattern.replace(/\/\*$/, "/"),
      faviconUrl: "",
      approvedAt: Date.now(),
      updatedAt: Date.now()
    });
    changed = true;
  }
  return changed
    ? BrowserChatSiteAccess.save([...sitesByOrigin.values()])
    : storedSites;
}

async function loadSiteAccess({ status = "" } = {}) {
  if (!globalThis.chrome?.permissions) {
    accessElements.status.textContent = "Chrome permission controls are unavailable.";
    return;
  }
  accessElements.refresh.disabled = true;
  try {
    const [allPermissions, allSitesEnabled, storedSites] = await Promise.all([
      chrome.permissions.getAll(),
      chrome.permissions.contains({ origins: ["<all_urls>"] }),
      BrowserChatSiteAccess.list()
    ]);
    const approvedSites = await mergeChromeSitesIntoRegistry(
      allPermissions.origins || [],
      storedSites
    );
    accessElements.allSitesToggle.checked = allSitesEnabled;
    accessElements.allSitesLabel.textContent = allSitesEnabled ? "On" : "Off";
    renderApprovedSites(approvedSites, allSitesEnabled);
    accessElements.status.textContent = status;
  } catch (error) {
    accessElements.status.textContent =
      error.message || "Could not load site permissions.";
  } finally {
    accessElements.refresh.disabled = false;
    accessElements.allSitesToggle.disabled = false;
  }
}

accessElements.allSitesToggle.addEventListener("change", async () => {
  const enable = accessElements.allSitesToggle.checked;
  accessElements.allSitesToggle.disabled = true;
  accessElements.status.textContent = enable
    ? "Waiting for Chrome approval…"
    : "Removing all-sites access…";
  try {
    let changed;
    let restored = true;
    if (enable) {
      changed = await chrome.permissions.request({ origins: ["<all_urls>"] });
    } else {
      const approvedSites = await BrowserChatSiteAccess.list();
      changed = await chrome.permissions.remove({ origins: ["<all_urls>"] });
      const origins = approvedSites.map((site) => site.originPattern);
      if (origins.length) {
        restored = await chrome.permissions.request({ origins });
      }
    }
    await loadSiteAccess({
      status: !restored
        ? "All-sites access was removed, but Chrome did not restore every individual site grant."
        : changed
        ? (enable ? "All-sites access granted." : "All-sites access revoked.")
        : (enable ? "All-sites access was not granted." : "All-sites access was already off.")
    });
  } catch (error) {
    await loadSiteAccess({
      status: error.message || "Could not change all-sites access."
    });
  }
});

accessElements.refresh.addEventListener("click", () => {
  void loadSiteAccess({ status: "Permissions refreshed." });
});

accessElements.list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-origin]");
  if (!button) return;
  const origin = button.dataset.origin;
  const details = describeOriginPattern(origin);
  button.disabled = true;
  accessElements.status.textContent = `Revoking access to ${details.name}…`;
  try {
    const allSitesEnabled = await chrome.permissions.contains({
      origins: ["<all_urls>"]
    });
    const removed = allSitesEnabled
      ? true
      : await chrome.permissions.remove({ origins: [origin] });
    await BrowserChatSiteAccess.revoke(origin);
    await loadSiteAccess({
      status: removed
        ? allSitesEnabled
          ? `${details.name} was removed from individual approvals. All-sites access still covers it.`
          : `Access to ${details.name} was revoked.`
        : `Access to ${details.name} was already removed.`
    });
  } catch (error) {
    button.disabled = false;
    accessElements.status.textContent =
      error.message || `Could not revoke access to ${details.name}.`;
  }
});

chrome.permissions?.onAdded?.addListener(() => {
  if (!document.querySelector("#site-access").hidden) void loadSiteAccess();
});
chrome.permissions?.onRemoved?.addListener(() => {
  if (!document.querySelector("#site-access").hidden) void loadSiteAccess();
});
chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    changes[BrowserChatSiteAccess.STORAGE_KEY] &&
    !document.querySelector("#site-access").hidden
  ) {
    void loadSiteAccess();
  }
});

const ARCHITECTURE_WITH_SKILLS = `
flowchart TD
    A["Receive user goal"] --> B["Normalize goal and runtime safety policy"]
    B --> SK["Select and compose relevant skill instructions"]
    SK --> C["Create lightweight task strategy"]
    C --> D["Observe current browser state"]
    D --> E["Model chooses one next action"]
    E --> V["Validate tool name and arguments"]
    V --> F{"Consequential action?"}
    F -- "Yes" --> G["Pause for one-time user approval"]
    G --> H{"Approved?"}
    H -- "Yes" --> X["Execute one action"]
    H -- "No" --> N["Report blocker with completed evidence"]
    F -- "No" --> X
    X --> I["Observe resulting browser state"]
    I --> J["Deterministic predicate verification"]
    J --> K["Model evaluates result and evidence"]
    K --> L{"Goal state?"}
    L -- "Complete" --> M["Produce final answer and evidence trace"]
    L -- "Progressing" --> E
    L -- "Strategy invalid" --> C
    L -- "Blocked" --> N

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef skill fill:#eaf1fb,stroke:#89a9cf,color:#315b87
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class A input
    class SK skill
    class E,K,L model
    class B,C,D,V,F,G,H,X,I,J tool
    class M,N output
`;

const ARCHITECTURE_WITHOUT_SKILLS = `
flowchart TD
    A["Receive user goal"] --> B["Normalize goal and runtime safety policy"]
    B --> C["Create lightweight task strategy"]
    C --> D["Observe current browser state"]
    D --> E["Model chooses one next action"]
    E --> V["Validate tool name and arguments"]
    V --> F{"Consequential action?"}
    F -- "Yes" --> G["Pause for one-time user approval"]
    G --> H{"Approved?"}
    H -- "Yes" --> X["Execute one action"]
    H -- "No" --> N["Report blocker with completed evidence"]
    F -- "No" --> X
    X --> I["Observe resulting browser state"]
    I --> J["Deterministic predicate verification"]
    J --> K["Model evaluates result and evidence"]
    K --> L{"Goal state?"}
    L -- "Complete" --> M["Produce final answer and evidence trace"]
    L -- "Progressing" --> E
    L -- "Strategy invalid" --> C
    L -- "Blocked" --> N

    classDef input fill:#f0f0ed,stroke:#aaa9a4,color:#292927
    classDef model fill:#f0ecf9,stroke:#a996d3,color:#4f3d7d
    classDef tool fill:#fff4e7,stroke:#d9ac76,color:#7d4e19
    classDef output fill:#eaf6ee,stroke:#87bd98,color:#286c40
    class A input
    class E,K,L model
    class B,C,D,V,F,G,H,X,I,J tool
    class M,N output
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

function getDatabaseDbml() {
  return `// BrowserChatRag · IndexedDB schema
// Relationship is maintained by BrowserChat; IndexedDB has no native foreign-key constraints.

Table attachments {
  id varchar [pk]
  chatId varchar
  name varchar
  mimeType varchar
  kind varchar
  status varchar
  chunkCount integer
  extractedText text
  extractionMetadata json
  sourceMetadata json
  warnings json
  blob blob
  embeddingModel varchar
  createdAt bigint
  updatedAt bigint

  Indexes {
    chatId
    (chatId, createdAt)
  }
}

Table chunks {
  id varchar [pk]
  chatId varchar
  attachmentId varchar [ref: > attachments.id]
  attachmentName varchar
  attachmentKind varchar
  chunkIndex integer
  text text
  tokenEstimate integer
  embeddingModel varchar
  embeddingDimensions integer
  embedding json
  sourceMetadata json
  createdAt bigint

  Indexes {
    chatId
    attachmentId
    (attachmentId, chunkIndex) [unique]
  }
}`;
}

function renderDatabaseSchema() {
  databaseElements.dbmlCode.textContent = getDatabaseDbml();
}

function getDbdiagramUrl() {
  const dbml = getDatabaseDbml();
  const base64 = btoa(unescape(encodeURIComponent(dbml)));
  return `https://dbdiagram.io/embed#c=${encodeURIComponent(base64)}`;
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
databaseElements.copyDbml.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(getDatabaseDbml());
    databaseElements.copyDbml.textContent = "Copied";
  } catch {
    databaseElements.copyDbml.textContent = "Copy unavailable";
  }
  window.setTimeout(() => {
    databaseElements.copyDbml.textContent = "Copy DBML";
  }, 1600);
});
databaseElements.openDiagram.addEventListener("click", () => {
  window.open(getDbdiagramUrl(), "_blank", "noopener,noreferrer");
});

function getFileChunks(attachmentId) {
  if (!databaseSnapshot) return [];
  return databaseSnapshot.stores.chunks.records
    .filter((chunk) => chunk.attachmentId === attachmentId)
    .sort((a, b) => Number(a.chunkIndex) - Number(b.chunkIndex));
}

function visibleWhitespace(text) {
  return String(text)
    .replace(/ /g, "·")
    .replace(/\t/g, "→\t")
    .replace(/\r/g, "␍")
    .replace(/\n/g, "↵\n");
}

function clearFilesImagePreview() {
  if (filesImagePreviewUrl) URL.revokeObjectURL(filesImagePreviewUrl);
  filesImagePreviewUrl = null;
  fileElements.imagePreviewImage.removeAttribute("src");
  fileElements.imagePreview.hidden = true;
}

function renderFilePreview(selectedAttachment = null) {
  const attachments = databaseSnapshot?.stores.attachments.records || [];
  const attachment = selectedAttachment || attachments.find(
    (item) => String(item.id) === String(selectedFileId)
  );
  fileElements.preview.hidden = !attachment;
  fileElements.previewEmpty.hidden = Boolean(attachment);
  clearFilesImagePreview();
  if (!attachment) return;

  const chunks = getFileChunks(attachment.id);
  const createdAt = Number.isFinite(Number(attachment.createdAt))
    ? new Date(Number(attachment.createdAt)).toLocaleString()
    : "Unknown date";
  fileElements.title.textContent = attachment.name || "Untitled source";
  fileElements.status.textContent = attachment.status || "unknown";
  fileElements.status.dataset.status = attachment.status || "unknown";
  fileElements.metadata.textContent = [
    attachment.kind || "file",
    attachment.mimeType || "unknown type",
    createdAt
  ].join(" · ");
  fileElements.model.textContent = attachment.embeddingModel || "No embedding model";
  const tokens = chunks.reduce((sum, chunk) => sum + (Number(chunk.tokenEstimate) || 0), 0);
  fileElements.chunkSummary.textContent =
    `${chunks.length} ${chunks.length === 1 ? "chunk" : "chunks"} · ~${tokens.toLocaleString()} tokens`;

  const warnings = [
    ...(Array.isArray(attachment.warnings) ? attachment.warnings : []),
    ...(attachment.error ? [attachment.error] : [])
  ].map((warning) => String(warning || "").trim()).filter(Boolean);
  fileElements.warnings.hidden = warnings.length === 0;
  fileElements.warnings.innerHTML = warnings.map((warning) =>
    `<span>${escapeHtml(warning)}</span>`
  ).join("");

  const showWhitespace = fileElements.whitespace.checked;
  fileElements.chunks.innerHTML = chunks.map((chunk) => {
    const text = showWhitespace ? visibleWhitespace(chunk.text) : String(chunk.text || "");
    return `
      <article class="file-chunk-card">
        <header>
          <div>
            <strong>Chunk ${Number(chunk.chunkIndex) + 1}</strong>
            <span>index ${escapeHtml(chunk.chunkIndex)} · ~${Number(chunk.tokenEstimate || 0).toLocaleString()} tokens · ${String(chunk.text || "").length.toLocaleString()} characters</span>
          </div>
          <code>${escapeHtml(chunk.id)}</code>
        </header>
        <pre${showWhitespace ? ' class="show-whitespace"' : ""}>${escapeHtml(text)}</pre>
      </article>
    `;
  }).join("");
  fileElements.chunksEmpty.hidden = chunks.length > 0;
  const chunksEmptyTitle = fileElements.chunksEmpty.querySelector("strong");
  const chunksEmptyDescription = fileElements.chunksEmpty.querySelector("span");
  if (attachment.kind === "image") {
    chunksEmptyTitle.textContent = "Images are not text-chunked";
    chunksEmptyDescription.textContent = "The original image is shown above; it is attached directly to the chat model.";
  } else {
    chunksEmptyTitle.textContent = "No chunks stored";
    chunksEmptyDescription.textContent = "This source may still be indexing or extraction may have failed.";
  }

  if (attachment.kind === "image" && attachment.blob instanceof Blob) {
    filesImagePreviewUrl = URL.createObjectURL(attachment.blob);
    fileElements.imagePreviewImage.src = filesImagePreviewUrl;
    fileElements.imagePreviewImage.alt = attachment.name || "Attached image";
    fileElements.imagePreviewMeta.textContent = `${attachment.mimeType || "image"} · ${formatByteSize(attachment.blob.size)}`;
    fileElements.imagePreview.hidden = false;
  }
}

function renderFilesList() {
  if (!databaseSnapshot) return;
  const attachments = [...databaseSnapshot.stores.attachments.records]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const query = fileElements.search.value.trim().toLocaleLowerCase();
  const filtered = attachments.filter((attachment) => {
    const chunks = getFileChunks(attachment.id);
    const matchesSearch = !query || [attachment.name, attachment.kind, attachment.mimeType, attachment.status]
      .some((value) => String(value || "").toLocaleLowerCase().includes(query));
    const matchesFilter = activeFilesFilter === "all"
      || (activeFilesFilter === "indexed" && chunks.length > 0)
      || (activeFilesFilter === "no-chunks" && chunks.length === 0);
    return matchesSearch && matchesFilter;
  });
  if (selectedFileId && !filtered.some((item) => String(item.id) === String(selectedFileId))) {
    selectedFileId = null;
  }
  if (!selectedFileId && filtered.length) selectedFileId = filtered[0].id;

  const selectedAttachment = filtered.find(
    (item) => String(item.id) === String(selectedFileId)
  ) || null;
  // Render the selected record directly. This avoids depending on a DOM dataset
  // round-trip for IndexedDB keys, which can be non-string values.
  if (selectedAttachment) selectedFileId = selectedAttachment.id;

  fileElements.count.textContent =
    `${filtered.length}${query ? ` of ${attachments.length}` : ""} ${filtered.length === 1 ? "source" : "sources"}`;
  fileElements.filters.forEach((tab) => {
    const active = tab.dataset.filesFilter === activeFilesFilter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  fileElements.list.innerHTML = filtered.map((attachment) => {
    const chunks = getFileChunks(attachment.id);
    const active = String(attachment.id) === String(selectedFileId);
    return `
      <button class="files-source-item${active ? " active" : ""}" type="button" role="option"
        aria-selected="${active}" data-file-id="${escapeHtml(encodeURIComponent(String(attachment.id)))}">
        <span class="files-source-icon">${escapeHtml((attachment.kind || "file").slice(0, 3).toUpperCase())}</span>
        <span class="files-source-copy">
          <strong title="${escapeHtml(attachment.name || "Untitled source")}">${escapeHtml(attachment.name || "Untitled source")}</strong>
          <small>${chunks.length} ${chunks.length === 1 ? "chunk" : "chunks"} · ${escapeHtml(attachment.status || "unknown")}</small>
        </span>
      </button>
    `;
  }).join("");
  fileElements.empty.hidden = filtered.length > 0;
  fileElements.list.hidden = filtered.length === 0;
  renderFilePreview(selectedAttachment);
}

async function loadFilesExplorer({ force = false } = {}) {
  if (databaseSnapshot && !force) {
    renderFilesList();
    return;
  }
  fileElements.refresh.disabled = true;
  try {
    databaseSnapshot = await BrowserChatRagDatabase.inspect();
    renderFilesList();
  } catch (error) {
    fileElements.list.hidden = true;
    fileElements.empty.hidden = false;
    fileElements.empty.querySelector("strong").textContent = "Files unavailable";
    fileElements.empty.querySelector("span").textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    fileElements.refresh.disabled = false;
  }
}

fileElements.list.addEventListener("click", (event) => {
  const item = event.target.closest("[data-file-id]");
  if (!item) return;
  selectedFileId = decodeURIComponent(item.dataset.fileId);
  renderFilesList();
});
fileElements.search.addEventListener("input", renderFilesList);
fileElements.filters.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeFilesFilter = tab.dataset.filesFilter;
    renderFilesList();
  });
});
fileElements.whitespace.addEventListener("change", renderFilePreview);
fileElements.refresh.addEventListener("click", () => loadFilesExplorer({ force: true }));

function formatParameterType(property = {}) {
  if (Array.isArray(property.enum)) return property.enum.join(" · ");
  if (property.type === "array") {
    return `${property.items?.type || "value"}[]`;
  }
  return property.type || "value";
}

function renderTools() {
  const schemas = BrowserChatTools.getSchemas();
  const contextTools = BrowserChatCapabilities.getContextTools();
  toolElements.count.textContent = String(schemas.length + contextTools.length);
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

  toolElements.contextList.innerHTML = contextTools.map((tool) => `
    <article class="tool-card">
      <div class="tool-card-header">
        <div class="tool-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 7h8M8 12h8M8 17h5"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
        </div>
        <div>
          <div class="tool-name-row">
            <code>${escapeHtml(tool.name)}</code>
            <span>${escapeHtml(tool.availability)}</span>
          </div>
          <p>${escapeHtml(tool.description)}</p>
        </div>
      </div>
      <div class="tool-parameters">
        <strong>Uses</strong>
        <ul>${tool.inputs.map((input) => `<li><div><code>${escapeHtml(input)}</code></div></li>`).join("")}</ul>
      </div>
    </article>
  `).join("");
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
        <strong>${escapeHtml(skill.name)}<span class="skill-source-badge">${
          skill.overridesPackaged
            ? "Override"
            : skill.source === "packaged"
              ? "Built-in MD"
              : "Local"
        }</span></strong>
        <p>${escapeHtml(skill.description || "No description")}</p>
      </div>
      <div class="skill-card-actions">
        <label class="skill-row-toggle">
          <input type="checkbox" data-toggle-skill="${escapeHtml(skill.id)}" ${
            skill.enabled !== false ? "checked" : ""
          } />
          <span aria-hidden="true"></span>
          <b>${skill.enabled !== false ? "Enabled" : "Disabled"}</b>
        </label>
        <button type="button" data-export-skill="${escapeHtml(skill.id)}">Export .md</button>
        <button type="button" data-edit-skill="${escapeHtml(skill.id)}">Edit</button>
        ${
          skill.source === "packaged"
            ? ""
            : `<button class="destructive" type="button" data-delete-skill="${escapeHtml(skill.id)}">${skill.overridesPackaged ? "Reset" : "Delete"}</button>`
        }
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

async function openRecordSkillFlow() {
  skillElements.createButton.disabled = true;
  skillElements.recordCalloutButton.disabled = true;
  skillElements.importStatus.textContent = "Opening the side panel…";
  try {
    const stored = await chrome.storage.local.get("browserChatSkillRecording");
    const existing = stored.browserChatSkillRecording;
    if (!existing?.status) {
      await chrome.storage.local.set({
        browserChatSkillRecording: {
          status: "ready",
          events: [],
          requestedAt: Date.now()
        }
      });
    }
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    skillElements.importStatus.textContent =
      existing?.status === "recording"
        ? "Your active skill recording is open in the side panel."
        : "Skill recorder opened in the side panel. Navigate to the workflow’s starting page when you’re ready.";
  } catch (error) {
    skillElements.importStatus.textContent =
      error?.message || "BrowserChat could not open the skill recorder.";
  } finally {
    skillElements.createButton.disabled = false;
    skillElements.recordCalloutButton.disabled = false;
  }
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
skillElements.createButton.addEventListener("click", () => void openRecordSkillFlow());
skillElements.recordCalloutButton.addEventListener("click", () => void openRecordSkillFlow());
skillElements.writeButton.addEventListener("click", () => openSkillEditor());
skillElements.importButton.addEventListener("click", () => {
  skillElements.importInput.click();
});
skillElements.importInput.addEventListener("change", async () => {
  const files = [...(skillElements.importInput.files || [])];
  skillElements.importInput.value = "";
  if (!files.length) return;
  skillElements.importButton.disabled = true;
  skillElements.importStatus.textContent = "Reading skill Markdown…";
  try {
    const imported = await Promise.all(files.map(async (file) =>
      BrowserChatSkills.parseMarkdown(await file.text(), { source: "local" })
    ));
    const conflicts = imported.filter((candidate) =>
      skills.some((skill) =>
        skill.id === candidate.id ||
        skill.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase()
      )
    );
    if (
      conflicts.length &&
      !window.confirm(
        `Replace ${conflicts.map((skill) => `“${skill.name}”`).join(", ")} with the imported Markdown?`
      )
    ) {
      skillElements.importStatus.textContent = "Import cancelled.";
      return;
    }
    for (const candidate of imported) {
      const existingIndex = skills.findIndex((skill) =>
        skill.id === candidate.id ||
        skill.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase()
      );
      const next = BrowserChatSkills.normalizeSkill({
        ...candidate,
        id: existingIndex >= 0 ? skills[existingIndex].id : candidate.id,
        source: "local",
        sourcePath: existingIndex >= 0 ? skills[existingIndex].sourcePath : "",
        overridesPackaged:
          existingIndex >= 0 &&
          (skills[existingIndex].source === "packaged" ||
            skills[existingIndex].overridesPackaged),
        createdAt:
          existingIndex >= 0 ? skills[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now()
      });
      if (existingIndex >= 0) skills.splice(existingIndex, 1, next);
      else skills.push(next);
    }
    skills = await BrowserChatSkills.saveSkills(skills);
    renderSkills();
    skillElements.importStatus.textContent =
      `Imported ${imported.length} Markdown ${imported.length === 1 ? "skill" : "skills"}.`;
  } catch (error) {
    skillElements.importStatus.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    skillElements.importButton.disabled = false;
  }
});
skillElements.closeButton.addEventListener("click", closeSkillEditor);
skillElements.cancelButton.addEventListener("click", closeSkillEditor);
skillElements.dialog.addEventListener("click", (event) => {
  if (event.target === skillElements.dialog) closeSkillEditor();
});
skillElements.list.addEventListener("click", async (event) => {
  const exportButton = event.target.closest("[data-export-skill]");
  if (exportButton) {
    const skill = skills.find(
      (item) => item.id === exportButton.dataset.exportSkill
    );
    if (!skill) return;
    const blob = new Blob([BrowserChatSkills.toMarkdown(skill)], {
      type: "text/markdown"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${skill.id.replace(/[^a-z0-9-]+/gi, "-") || "skill"}.md`;
    link.click();
    URL.revokeObjectURL(url);
    skillElements.importStatus.textContent = `Exported “${skill.name}”.`;
    return;
  }

  const editButton = event.target.closest("[data-edit-skill]");
  if (editButton) {
    openSkillEditor(skills.find((skill) => skill.id === editButton.dataset.editSkill));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-skill]");
  if (!deleteButton) return;
  const skill = skills.find((item) => item.id === deleteButton.dataset.deleteSkill);
  const action = skill?.overridesPackaged ? "Reset" : "Delete";
  if (!skill || !window.confirm(`${action} the “${skill.name}” skill?`)) return;
  skills = await BrowserChatSkills.saveSkills(
    skills.filter((item) => item.id !== skill.id)
  );
  await loadSkillsSettings();
  skillElements.importStatus.textContent = skill.overridesPackaged
    ? `Reset “${skill.name}” to its packaged Markdown.`
    : `Deleted “${skill.name}”.`;
});
skillElements.list.addEventListener("change", async (event) => {
  const toggle = event.target.closest("[data-toggle-skill]");
  if (!toggle) return;
  toggle.disabled = true;
  try {
    await BrowserChatSkills.setSkillEnabled(
      toggle.dataset.toggleSkill,
      toggle.checked
    );
    const skill = skills.find((item) => item.id === toggle.dataset.toggleSkill);
    if (skill) skill.enabled = toggle.checked;
    renderSkills();
  } catch (error) {
    toggle.checked = !toggle.checked;
    skillElements.importStatus.textContent =
      error instanceof Error ? error.message : String(error);
  }
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
    source: "local",
    overridesPackaged:
      existing?.source === "packaged" || existing?.overridesPackaged,
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
