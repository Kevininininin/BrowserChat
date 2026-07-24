const OLLAMA_BASE_URL = "http://localhost:11434";
const MAX_HISTORY_MESSAGES = 12;
const MAX_MEMORIZED_DOM_ATTACHMENTS = 3;
const CHAT_STORAGE_KEY = "pagewiseChats";
const ACTIVE_CHAT_STORAGE_KEY = "pagewiseActiveChatId";
const DOM_TEXT_LIMIT_STORAGE_KEY = "pagewiseDomTextLimit";
const DEFAULT_CHAT_TITLE = "New Chat";
const DEFAULT_DOM_TEXT_LIMIT = 40_000;
const MIN_DOM_TEXT_LIMIT = 100;
const MAX_DOM_TEXT_LIMIT = 500_000;
const AUTO_SCROLL_BOTTOM_THRESHOLD = 24;
const MERMAID_RENDER_DELAY = 160;
const CONTEXT_LIMITS = {
  headings: 60,
  interactiveElements: 120,
  optionsPerControl: 30,
  totalOptions: 200
};

if (globalThis.mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: "base",
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    flowchart: {
      curve: "linear",
      htmlLabels: false,
      nodeSpacing: 42,
      rankSpacing: 58,
      padding: 18,
      useMaxWidth: true
    },
    themeVariables: {
      background: "#ffffff",
      primaryColor: "#efedff",
      primaryTextColor: "#2f2d35",
      primaryBorderColor: "#8b72f6",
      secondaryColor: "#f6f4ff",
      tertiaryColor: "#faf9ff",
      lineColor: "#3e3d42",
      textColor: "#2f2d35",
      mainBkg: "#efedff",
      nodeBorder: "#8b72f6",
      clusterBkg: "#faf9ff",
      clusterBorder: "#d6ccff",
      fontSize: "14px",
      edgeLabelBackground: "#ffffff",
      arrowheadColor: "#3e3d42"
    }
  });
}

const elements = {
  conversation: document.querySelector("#conversation"),
  emptyState: document.querySelector("#emptyState"),
  form: document.querySelector("#chatForm"),
  input: document.querySelector("#promptInput"),
  skillPicker: document.querySelector("#skillPicker"),
  skillPickerList: document.querySelector("#skillPickerList"),
  skillPickerEmpty: document.querySelector("#skillPickerEmpty"),
  skillChip: document.querySelector("#skillChip"),
  skillChipLabel: document.querySelector("#skillChipLabel"),
  skillChipMenu: document.querySelector("#skillChipMenu"),
  skillChipPreviewButton: document.querySelector("#skillChipPreviewButton"),
  skillChipConfigureButton: document.querySelector("#skillChipConfigureButton"),
  removeSkillButton: document.querySelector("#removeSkillButton"),
  sendButton: document.querySelector("#sendButton"),
  modelSelect: document.querySelector("#modelSelect"),
  thinkingSelect: document.querySelector("#thinkingSelect"),
  toolMenuButton: document.querySelector("#toolMenuButton"),
  toolMenu: document.querySelector("#toolMenu"),
  addDomButton: document.querySelector("#addDomButton"),
  domToolMoreButton: document.querySelector("#domToolMoreButton"),
  domToolMoreMenu: document.querySelector("#domToolMoreMenu"),
  globalDomConfigureButton: document.querySelector("#globalDomConfigureButton"),
  contextChip: document.querySelector("#contextChip"),
  contextChipLabel: document.querySelector("#contextChipLabel"),
  contextChipMenu: document.querySelector("#contextChip .chip-menu"),
  chipPreviewButton: document.querySelector("#chipPreviewButton"),
  chipConfigureButton: document.querySelector("#chipConfigureButton"),
  removeContextButton: document.querySelector("#removeContextButton"),
  errorBanner: document.querySelector("#errorBanner"),
  connectionDot: document.querySelector("#connectionDot"),
  chatPickerButton: document.querySelector("#chatPickerButton"),
  chatMenu: document.querySelector("#chatMenu"),
  chatList: document.querySelector("#chatList"),
  currentChatFavicon: document.querySelector("#currentChatFavicon"),
  currentChatTitle: document.querySelector("#currentChatTitle"),
  newChatButton: document.querySelector("#newChatButton"),
  settingsButton: document.querySelector("#settingsButton"),
  siteAccessBanner: document.querySelector("#siteAccessBanner"),
  siteAccessTitle: document.querySelector("#siteAccessTitle"),
  siteAccessDescription: document.querySelector("#siteAccessDescription"),
  allowSiteButton: document.querySelector("#allowSiteButton"),
  contextPreviewDialog: document.querySelector("#contextPreviewDialog"),
  contextPreviewContent: document.querySelector("#contextPreviewContent"),
  previewTitle: document.querySelector("#previewTitle"),
  previewDescription: document.querySelector("#previewDescription"),
  previewStats: document.querySelector("#previewStats"),
  domModeControls: document.querySelector("#domModeControls"),
  fullPageModeInput: document.querySelector("#fullPageModeInput"),
  selectElementModeInput: document.querySelector("#selectElementModeInput"),
  selectedElementControls: document.querySelector("#selectedElementControls"),
  selectedElementName: document.querySelector("#selectedElementName"),
  selectedElementDescription: document.querySelector("#selectedElementDescription"),
  selectElementButton: document.querySelector("#selectElementButton"),
  domLimitControls: document.querySelector("#domLimitControls"),
  domLimitScope: document.querySelector("#domLimitScope"),
  domLimitInput: document.querySelector("#domLimitInput"),
  domLengthInfo: document.querySelector("#domLengthInfo"),
  resetDomLimitButton: document.querySelector("#resetDomLimitButton"),
  saveDomLimitButton: document.querySelector("#saveDomLimitButton"),
  closePreviewButton: document.querySelector("#closePreviewButton"),
  donePreviewButton: document.querySelector("#donePreviewButton"),
  refreshPreviewButton: document.querySelector("#refreshPreviewButton"),
  suggestions: document.querySelectorAll(".suggestion")
};

let chats = [];
let activeChatId = null;
let globalDomTextLimit = DEFAULT_DOM_TEXT_LIMIT;
let chatHistory = [];
let memorizedDomAttachments = [];
let activeRequest = null;
let conversationModel = null;
let domContextEnabled = false;
let lastCaretRange = null;
let contextChipMenuCloseTimer = null;
let skillChipMenuCloseTimer = null;
let previewMode = "preview";
let domConfigurationScope = null;
let domConfigurationDraft = null;
let domLimitRefreshTimer = null;
let previewCaptureSequence = 0;
let shouldAutoScrollConversation = true;
let userSystemPrompt = BrowserChatPromptConfig.DEFAULT_SYSTEM_PROMPT;
let userPromptSettings = BrowserChatPromptConfig.normalizePromptSettings();
let skillsEnabled = true;
let availableSkills = [];
let explicitSkillId = null;
let skillPickerMatches = [];
let skillPickerActiveIndex = 0;
const markdownRenderVersions = new WeakMap();
const mermaidRenderTimers = new WeakMap();
let currentSite = {
  tabId: null,
  windowId: null,
  pageUrl: "",
  faviconUrl: "",
  hostname: "",
  originPattern: "",
  hasAccess: false,
  restricted: false
};

function createChat() {
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_CHAT_TITLE,
    titleGenerationAttempted: false,
    messages: [],
    tabId: null,
    windowId: null,
    pageUrl: "",
    faviconUrl: "",
    hostname: "",
    conversationModel: null,
    domTextLimitOverride: null,
    domCaptureMode: "fullPage",
    domSelectedElement: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function getActiveChat() {
  return chats.find((chat) => chat.id === activeChatId) || null;
}

function clampDomTextLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DOM_TEXT_LIMIT;
  return Math.min(MAX_DOM_TEXT_LIMIT, Math.max(MIN_DOM_TEXT_LIMIT, Math.round(parsed)));
}

function getEffectiveDomTextLimit(chat = getActiveChat()) {
  return Number.isFinite(chat?.domTextLimitOverride)
    ? clampDomTextLimit(chat.domTextLimitOverride)
    : globalDomTextLimit;
}

function getDomCaptureConfiguration(chat = getActiveChat()) {
  const selectedElement = chat?.domSelectedElement?.selector
    ? chat.domSelectedElement
    : null;
  return {
    mode: chat?.domCaptureMode === "element" && selectedElement
      ? "element"
      : "fullPage",
    selectedElement
  };
}

function updateContextChipLabel() {
  const configuration = getDomCaptureConfiguration();
  elements.contextChipLabel.textContent =
    configuration.mode === "element" ? "DOM · Element" : "DOM";
}

function normalizeStoredChat(chat) {
  return {
    ...createChat(),
    ...chat,
    id: typeof chat?.id === "string" ? chat.id : crypto.randomUUID(),
    title: typeof chat?.title === "string" && chat.title.trim()
      ? chat.title.trim()
      : DEFAULT_CHAT_TITLE,
    titleGenerationAttempted: Boolean(chat?.titleGenerationAttempted),
    domTextLimitOverride: Number.isFinite(chat?.domTextLimitOverride)
      ? clampDomTextLimit(chat.domTextLimitOverride)
      : null,
    domCaptureMode:
      chat?.domCaptureMode === "element" && chat?.domSelectedElement?.selector
        ? "element"
        : "fullPage",
    domSelectedElement:
      typeof chat?.domSelectedElement?.selector === "string"
        ? {
            selector: chat.domSelectedElement.selector,
            tagName: typeof chat.domSelectedElement.tagName === "string"
              ? chat.domSelectedElement.tagName
              : "",
            label: typeof chat.domSelectedElement.label === "string"
              ? chat.domSelectedElement.label
              : "",
            textPreview: typeof chat.domSelectedElement.textPreview === "string"
              ? chat.domSelectedElement.textPreview
              : ""
          }
        : null,
    messages: Array.isArray(chat?.messages)
      ? chat.messages.filter((message) =>
          ["user", "assistant"].includes(message?.role) &&
          typeof message?.content === "string"
        )
      : []
  };
}

function getFallbackFaviconUrl() {
  return chrome.runtime.getURL("assets/icon-32.png");
}

function getFaviconUrl(tab = {}) {
  if (tab.url && /^https?:/i.test(tab.url)) {
    return chrome.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`
    );
  }
  return tab.favIconUrl || getFallbackFaviconUrl();
}

function setImageSource(image, source) {
  image.onerror = () => {
    image.onerror = null;
    image.src = getFallbackFaviconUrl();
  };
  image.src = source || getFallbackFaviconUrl();
}

async function persistChats() {
  await chrome.storage.local.set({
    [CHAT_STORAGE_KEY]: chats,
    [ACTIVE_CHAT_STORAGE_KEY]: activeChatId
  });
}

async function loadSystemPrompt() {
  const stored = await chrome.storage.local.get([
    BrowserChatPromptConfig.STORAGE_KEY,
    BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY
  ]);
  userSystemPrompt = BrowserChatPromptConfig.normalizeSystemPrompt(
    stored[BrowserChatPromptConfig.STORAGE_KEY]
  );
  userPromptSettings = BrowserChatPromptConfig.normalizePromptSettings(
    stored[BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY]
  );
}

async function loadSkills() {
  const state = await BrowserChatSkills.load();
  skillsEnabled = state.enabled;
  availableSkills = state.skills;
  if (
    explicitSkillId &&
    (!skillsEnabled || !availableSkills.some((skill) => skill.id === explicitSkillId))
  ) {
    setExplicitSkill(null);
  }
  if (!skillsEnabled) closeSkillPicker();
}

function setChatMenu(open) {
  elements.chatMenu.hidden = !open;
  elements.chatPickerButton.setAttribute("aria-expanded", String(open));
  if (!open) closeChatActionMenus();
}

function closeChatActionMenus(exceptChatId = null) {
  for (const menu of elements.chatList.querySelectorAll(".chat-row-menu")) {
    const keepOpen = exceptChatId && menu.dataset.chatMenuId === exceptChatId;
    menu.hidden = !keepOpen;
  }
  for (const button of elements.chatList.querySelectorAll("[data-chat-actions]")) {
    button.setAttribute(
      "aria-expanded",
      String(Boolean(exceptChatId && button.dataset.chatActions === exceptChatId))
    );
  }
}

function renderChatHeader() {
  const chat = getActiveChat();
  elements.currentChatTitle.textContent = chat?.title || DEFAULT_CHAT_TITLE;
  elements.chatPickerButton.title = chat?.title || DEFAULT_CHAT_TITLE;
  setImageSource(elements.currentChatFavicon, currentSite.faviconUrl);
}

function renderChatMenu() {
  elements.chatList.replaceChildren();
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const chat of sortedChats) {
    const row = document.createElement("div");
    row.className = "chat-menu-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `chat-menu-item${chat.id === activeChatId ? " active" : ""}`;
    button.setAttribute("role", "menuitem");
    button.dataset.chatId = chat.id;

    const faviconWrap = document.createElement("span");
    faviconWrap.className = "site-favicon-wrap";
    const favicon = document.createElement("img");
    favicon.className = "site-favicon";
    favicon.alt = "";
    setImageSource(favicon, chat.faviconUrl);
    faviconWrap.append(favicon);

    const copy = document.createElement("span");
    copy.className = "chat-menu-copy";
    const title = document.createElement("span");
    title.className = "chat-menu-title";
    title.textContent = chat.title || DEFAULT_CHAT_TITLE;
    const site = document.createElement("span");
    site.className = "chat-menu-site";
    site.textContent = chat.hostname || "No site remembered yet";
    copy.append(title, site);
    button.append(faviconWrap, copy);

    const actions = document.createElement("button");
    actions.type = "button";
    actions.className = "chat-actions-button";
    actions.dataset.chatActions = chat.id;
    actions.setAttribute("aria-label", `More options for ${chat.title || DEFAULT_CHAT_TITLE}`);
    actions.setAttribute("aria-haspopup", "menu");
    actions.setAttribute("aria-expanded", "false");
    actions.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.35"></circle>
        <circle cx="12" cy="12" r="1.35"></circle>
        <circle cx="19" cy="12" r="1.35"></circle>
      </svg>
    `;

    const actionMenu = document.createElement("div");
    actionMenu.className = "chat-row-menu";
    actionMenu.dataset.chatMenuId = chat.id;
    actionMenu.setAttribute("role", "menu");
    actionMenu.hidden = true;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-chat-button";
    deleteButton.dataset.deleteChatId = chat.id;
    deleteButton.setAttribute("role", "menuitem");
    deleteButton.textContent = "Delete chat";
    actionMenu.append(deleteButton);

    row.append(button, actions, actionMenu);
    elements.chatList.append(row);
  }
}

function renderCurrentConversation() {
  shouldAutoScrollConversation = true;
  elements.conversation.querySelectorAll(".message-row").forEach((node) => node.remove());
  elements.emptyState.hidden = chatHistory.length > 0;
  for (const message of chatHistory) {
    appendMessage(message.role, message.content, {
      toolActivities: message.toolActivities,
      skillActivities: message.skillActivities
    });
  }
}

async function switchToChat(chatId) {
  const chat = chats.find((item) => item.id === chatId);
  if (!chat || chat.id === activeChatId) {
    setChatMenu(false);
    return;
  }

  activeRequest?.abort();
  activeChatId = chat.id;
  chatHistory = chat.messages;
  conversationModel = chat.conversationModel || null;
  memorizedDomAttachments = [];
  setDomContextEnabled(false);
  setPromptText();
  setError("");
  renderChatHeader();
  renderChatMenu();
  renderCurrentConversation();
  setChatMenu(false);
  await persistChats();

  let targetTabId = chat.tabId;
  if (targetTabId) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      const updateProperties = { active: true };
      if (chat.pageUrl && tab.url !== chat.pageUrl) {
        updateProperties.url = chat.pageUrl;
      }
      await chrome.tabs.update(targetTabId, updateProperties);
      if (tab.windowId != null) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch {
      targetTabId = null;
    }
  }

  if (!targetTabId && chat.pageUrl) {
    try {
      let tab;
      try {
        tab = await chrome.tabs.create({
          url: chat.pageUrl,
          active: true,
          ...(Number.isInteger(chat.windowId) ? { windowId: chat.windowId } : {})
        });
      } catch {
        tab = await chrome.tabs.create({
          url: chat.pageUrl,
          active: true
        });
      }
      targetTabId = tab.id;
      if (tab.windowId != null) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch {
      setError("BrowserChat could not reopen this chat’s last site.");
    }
  } else if (!targetTabId) {
    setError("This chat does not have a sent-from site yet.");
  }

  await refreshSiteAccess(targetTabId);
  elements.input.focus();
}

async function startNewChat() {
  activeRequest?.abort();
  const chat = createChat();
  chats.push(chat);
  activeChatId = chat.id;
  chatHistory = chat.messages;
  conversationModel = null;
  memorizedDomAttachments = [];
  setDomContextEnabled(false);
  setPromptText();
  setError("");
  renderChatHeader();
  renderChatMenu();
  renderCurrentConversation();
  setChatMenu(false);
  await persistChats();
  await refreshSiteAccess();
  elements.input.focus();
}

async function deleteChat(chatId) {
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) return;

  closeChatActionMenus();
  const confirmed = window.confirm(`Delete “${chat.title || DEFAULT_CHAT_TITLE}”?`);
  if (!confirmed) return;

  const deletingActiveChat = chat.id === activeChatId;
  if (deletingActiveChat) activeRequest?.abort();
  chats = chats.filter((item) => item.id !== chat.id);

  if (!chats.length) {
    activeChatId = null;
    await startNewChat();
    return;
  }

  if (deletingActiveChat) {
    const nextChat = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    await switchToChat(nextChat.id);
    return;
  }

  renderChatMenu();
  await persistChats();
}

async function initializeChats() {
  const stored = await chrome.storage.local.get([
    CHAT_STORAGE_KEY,
    ACTIVE_CHAT_STORAGE_KEY,
    DOM_TEXT_LIMIT_STORAGE_KEY
  ]);
  globalDomTextLimit = Number.isFinite(stored[DOM_TEXT_LIMIT_STORAGE_KEY])
    ? clampDomTextLimit(stored[DOM_TEXT_LIMIT_STORAGE_KEY])
    : DEFAULT_DOM_TEXT_LIMIT;
  chats = Array.isArray(stored[CHAT_STORAGE_KEY])
    ? stored[CHAT_STORAGE_KEY].map(normalizeStoredChat)
    : [];

  if (!chats.length) chats.push(createChat());
  activeChatId = chats.some((chat) => chat.id === stored[ACTIVE_CHAT_STORAGE_KEY])
    ? stored[ACTIVE_CHAT_STORAGE_KEY]
    : chats[0].id;

  const activeChat = getActiveChat();
  chatHistory = activeChat.messages;
  conversationModel = activeChat.conversationModel || null;
  renderChatHeader();
  renderChatMenu();
  renderCurrentConversation();
  await persistChats();
}

function setError(message = "") {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = !message;
}

function setConnectionStatus(status, title) {
  elements.connectionDot.className = `connection-dot ${status}`;
  elements.connectionDot.title = title;
}

function updateSendButton() {
  if (activeRequest) {
    elements.sendButton.disabled = false;
    elements.sendButton.classList.add("generating");
    elements.sendButton.setAttribute("aria-label", "Stop generating");
    return;
  }

  elements.sendButton.classList.remove("generating");
  elements.sendButton.setAttribute("aria-label", "Send message");
  elements.sendButton.disabled =
    !getPromptText().trim() ||
    !elements.modelSelect.value ||
    (domContextEnabled && !currentSite.hasAccess);
}

function escapeSkillPickerText(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function closeSkillPicker() {
  elements.skillPicker.hidden = true;
  skillPickerMatches = [];
  skillPickerActiveIndex = 0;
  elements.input.removeAttribute("aria-activedescendant");
}

function getSkillSlashQuery() {
  if (!skillsEnabled || explicitSkillId) return null;
  const text = getPromptText();
  const match = text.match(/(?:^|\s)\/([^\s]*)$/);
  return match ? match[1].toLowerCase() : null;
}

function renderSkillPicker(query = getSkillSlashQuery()) {
  if (query === null) {
    closeSkillPicker();
    return;
  }

  skillPickerMatches = availableSkills.filter((skill) => {
    if (!query) return true;
    return `${skill.name} ${skill.description}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .some((word) => word.startsWith(query));
  });
  skillPickerActiveIndex = Math.min(
    skillPickerActiveIndex,
    Math.max(0, skillPickerMatches.length - 1)
  );
  elements.skillPickerList.innerHTML = skillPickerMatches.map((skill, index) => `
    <button
      id="skill-picker-option-${index}"
      class="skill-picker-item${index === skillPickerActiveIndex ? " active" : ""}"
      type="button"
      role="option"
      aria-selected="${index === skillPickerActiveIndex}"
      data-skill-picker-id="${escapeSkillPickerText(skill.id)}"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/>
        <path d="m5 7 7 4 7-4M12 11v10"/>
      </svg>
      <span class="skill-picker-item-copy">
        <strong>${escapeSkillPickerText(skill.name)}</strong>
        <small>${escapeSkillPickerText(skill.description || "No description")}</small>
      </span>
    </button>
  `).join("");
  elements.skillPickerEmpty.hidden = skillPickerMatches.length > 0;
  elements.skillPicker.hidden = false;
  if (skillPickerMatches.length) {
    elements.input.setAttribute(
      "aria-activedescendant",
      `skill-picker-option-${skillPickerActiveIndex}`
    );
  }
}

function setExplicitSkill(skillId = null, { removeSlashQuery = false } = {}) {
  const skill = availableSkills.find((item) => item.id === skillId);

  if (removeSlashQuery && skill) {
    insertSkillAtSlashCommand(skill);
  } else {
    closeSkillChipMenu();
    elements.skillChip.remove();
  }
  explicitSkillId = skill?.id || null;

  if (skill) {
    elements.skillChipLabel.textContent = skill.name;
    if (!elements.input.contains(elements.skillChip)) {
      insertChipAtCaret(elements.skillChip);
    }
  } else {
    elements.skillChip.hidden = true;
  }
  closeSkillPicker();
  updateSendButton();
}

function chooseActiveSkill() {
  const skill = skillPickerMatches[skillPickerActiveIndex];
  if (skill) setExplicitSkill(skill.id, { removeSlashQuery: true });
}

function setToolMenu(open) {
  elements.toolMenu.hidden = !open;
  elements.toolMenuButton.setAttribute("aria-expanded", String(open));
  if (!open) setDomToolMoreMenu(false);
}

function setDomToolMoreMenu(open) {
  elements.domToolMoreMenu.hidden = !open;
  elements.domToolMoreButton.setAttribute("aria-expanded", String(open));
}

function setDomContextEnabled(enabled) {
  domContextEnabled = enabled;
  updateContextChipLabel();
  if (enabled) {
    insertChipAtCaret(elements.contextChip);
  } else {
    closeContextChipMenu();
    elements.contextChip.remove();
    elements.contextChip.hidden = true;
  }
  elements.addDomButton.disabled = Boolean(enabled);
  elements.addDomButton.setAttribute("aria-disabled", String(Boolean(enabled)));
  elements.input.dataset.placeholder = enabled ? "Ask anything about this page" : "Ask anything";
  setToolMenu(false);
  renderSiteAccess();
}

function positionContextChipMenu() {
  const menu = elements.contextChipMenu;
  if (!menu.classList.contains("is-open")) return;

  const chipBounds = elements.contextChip.getBoundingClientRect();
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const horizontalPadding = 8;
  menu.style.left = `${Math.min(
    Math.max(chipBounds.left + (chipBounds.width - menuWidth) / 2, horizontalPadding),
    window.innerWidth - menuWidth - horizontalPadding
  )}px`;
  menu.style.top = `${Math.max(chipBounds.top - menuHeight - 5, horizontalPadding)}px`;
}

function openContextChipMenu() {
  clearTimeout(contextChipMenuCloseTimer);
  const menu = elements.contextChipMenu;
  if (!menu.classList.contains("is-open")) {
    menu.classList.add("is-open");
    document.body.append(menu);
  }
  positionContextChipMenu();
}

function closeContextChipMenu() {
  clearTimeout(contextChipMenuCloseTimer);
  const menu = elements.contextChipMenu;
  if (!menu.classList.contains("is-open")) return;
  menu.classList.remove("is-open");
  menu.removeAttribute("style");
  elements.contextChip.append(menu);
}

function scheduleContextChipMenuClose() {
  clearTimeout(contextChipMenuCloseTimer);
  contextChipMenuCloseTimer = setTimeout(() => {
    if (!elements.contextChip.matches(":hover, :focus-within") &&
        !elements.contextChipMenu.matches(":hover, :focus-within")) {
      closeContextChipMenu();
    }
  }, 120);
}

function positionSkillChipMenu() {
  const menu = elements.skillChipMenu;
  if (!menu.classList.contains("is-open")) return;

  const chipBounds = elements.skillChip.getBoundingClientRect();
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const horizontalPadding = 8;
  menu.style.left = `${Math.min(
    Math.max(chipBounds.left + (chipBounds.width - menuWidth) / 2, horizontalPadding),
    window.innerWidth - menuWidth - horizontalPadding
  )}px`;
  menu.style.top = `${Math.max(chipBounds.top - menuHeight - 5, horizontalPadding)}px`;
}

function openSkillChipMenu() {
  clearTimeout(skillChipMenuCloseTimer);
  const menu = elements.skillChipMenu;
  if (!menu.classList.contains("is-open")) {
    menu.classList.add("is-open");
    document.body.append(menu);
  }
  positionSkillChipMenu();
}

function closeSkillChipMenu() {
  clearTimeout(skillChipMenuCloseTimer);
  const menu = elements.skillChipMenu;
  if (!menu.classList.contains("is-open")) return;
  menu.classList.remove("is-open");
  menu.removeAttribute("style");
  elements.skillChip.append(menu);
}

function scheduleSkillChipMenuClose() {
  clearTimeout(skillChipMenuCloseTimer);
  skillChipMenuCloseTimer = setTimeout(() => {
    if (!elements.skillChip.matches(":hover, :focus-within") &&
        !elements.skillChipMenu.matches(":hover, :focus-within")) {
      closeSkillChipMenu();
    }
  }, 120);
}

function enableReplyChipMenuOverlay(chip, menu) {
  let closeTimer = null;

  const positionMenu = () => {
    if (!menu.classList.contains("is-open")) return;
    const chipBounds = chip.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const horizontalPadding = 8;
    menu.style.left = `${Math.min(
      Math.max(chipBounds.left + (chipBounds.width - menuWidth) / 2, horizontalPadding),
      window.innerWidth - menuWidth - horizontalPadding
    )}px`;
    menu.style.top = `${Math.max(chipBounds.top - menuHeight - 5, horizontalPadding)}px`;
  };

  const openMenu = () => {
    clearTimeout(closeTimer);
    if (!menu.classList.contains("is-open")) {
      menu.classList.add("is-open");
      document.body.append(menu);
    }
    positionMenu();
  };

  const closeMenu = () => {
    clearTimeout(closeTimer);
    if (!menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    menu.removeAttribute("style");
    chip.append(menu);
  };

  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!chip.matches(":hover, :focus-within") && !menu.matches(":hover, :focus-within")) {
        closeMenu();
      }
    }, 120);
  };

  chip.addEventListener("pointerenter", openMenu);
  chip.addEventListener("pointerleave", scheduleClose);
  chip.addEventListener("focusin", openMenu);
  chip.addEventListener("focusout", scheduleClose);
  menu.addEventListener("pointerenter", openMenu);
  menu.addEventListener("pointerleave", scheduleClose);
  menu.addEventListener("focusin", openMenu);
  menu.addEventListener("focusout", scheduleClose);
  elements.conversation.addEventListener("scroll", positionMenu);
  window.addEventListener("resize", positionMenu);
}

function resizeInput() {
  // The editable composer grows naturally until its CSS max-height.
}

function getPromptText() {
  const clone = elements.input.cloneNode(true);
  clone.querySelectorAll(".context-chip, .skill-chip").forEach((chip) => chip.remove());
  return clone.innerText.replace(/\u00a0/g, " ");
}

function setPromptText(text = "") {
  elements.input.replaceChildren(document.createTextNode(text));
  if (explicitSkillId) {
    elements.skillChip.hidden = false;
    elements.input.append(elements.skillChip, document.createTextNode(" "));
  }
  if (domContextEnabled) {
    elements.contextChip.hidden = false;
    elements.input.append(elements.contextChip, document.createTextNode(" "));
  }
  lastCaretRange = null;
}

function pastePlainText(event) {
  const text = event.clipboardData?.getData("text/plain");
  if (text === undefined) return;

  event.preventDefault();

  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (!elements.input.contains(range.startContainer)) return;

  range.deleteContents();
  const textNode = document.createTextNode(text.replace(/\r\n?/g, "\n"));
  range.insertNode(textNode);
  moveCaretAfter(textNode);
  elements.input.dispatchEvent(new Event("input", { bubbles: true }));
}

function saveCaretRange() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (elements.input.contains(range.startContainer) && elements.input.contains(range.endContainer)) {
    lastCaretRange = range.cloneRange();
  }
}

function moveCaretAfter(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  lastCaretRange = range.cloneRange();
}

function insertChipAtCaret(chip) {
  chip.remove();
  chip.hidden = false;
  const range = lastCaretRange;
  const canInsertAtCaret = range && elements.input.contains(range.startContainer);
  if (canInsertAtCaret) {
    range.collapse(true);
    range.insertNode(chip);
  } else {
    elements.input.append(chip);
  }
  const spacer = document.createTextNode(" ");
  chip.after(spacer);
  moveCaretAfter(spacer);
}

function insertSkillAtSlashCommand(skill) {
  if (!skill) return;
  const query = getSkillSlashQuery();
  const range = lastCaretRange;
  const canReplaceInTextNode =
    query !== null &&
    range?.collapsed &&
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startOffset >= query.length + 1;

  if (canReplaceInTextNode) {
    const textNode = range.startContainer;
    const commandStart = range.startOffset - query.length - 1;
    if (
      textNode.textContent
        .slice(commandStart, range.startOffset)
        .toLowerCase() === `/${query}`
    ) {
      const commandRange = document.createRange();
      commandRange.setStart(textNode, commandStart);
      commandRange.setEnd(textNode, range.startOffset);
      commandRange.deleteContents();
      elements.skillChip.remove();
      elements.skillChip.hidden = false;
      commandRange.insertNode(elements.skillChip);
      const spacer = document.createTextNode(" ");
      elements.skillChip.after(spacer);
      moveCaretAfter(spacer);
      return;
    }
  }

  const prompt = getPromptText().replace(/(?:^|\s)\/[^\s]*$/, "");
  setPromptText(prompt);
  insertChipAtCaret(elements.skillChip);
}

function isCaretImmediatelyAfterChip(chip) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !chip.parentNode) return false;
  if (range.startContainer === chip.parentNode) {
    return range.startOffset === [...chip.parentNode.childNodes].indexOf(chip) + 1;
  }
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer;
    return (
      textNode.previousSibling === chip &&
      range.startOffset === textNode.textContent.length &&
      /^\s*$/.test(textNode.textContent)
    );
  }
  return false;
}

function getComposerAttachmentOrder() {
  return [...elements.input.children].flatMap((child) => {
    if (child === elements.skillChip && explicitSkillId) return ["skill"];
    if (child === elements.contextChip && domContextEnabled) return ["dom"];
    return [];
  });
}

function isConversationNearBottom() {
  const distanceFromBottom =
    elements.conversation.scrollHeight -
    elements.conversation.scrollTop -
    elements.conversation.clientHeight;
  return distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
}

function updateConversationAutoScroll() {
  shouldAutoScrollConversation = isConversationNearBottom();
}

function scrollToLatest({ force = false } = {}) {
  if (!force && !shouldAutoScrollConversation) return;
  shouldAutoScrollConversation = true;
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  let text = String(value).replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codeSpans.push(`<code>${escapeHtml(code)}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  text = escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");

  return text.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);

  const cells = [];
  let cell = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && value[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (value[index] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += value[index];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function getTableAlignments(line) {
  const cells = splitTableRow(line);
  if (!cells.length || cells.some((cell) => !/^:?-{3,}:?$/.test(cell))) return null;
  return cells.map((cell) => {
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    if (cell.endsWith(":")) return "right";
    return "left";
  });
}

function markdownToHtml(markdown = "") {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = "";
  let inCode = false;
  let codeLanguage = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join("\n")).replaceAll("\n", "<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };
  const flushCode = (closed = false) => {
    const source = codeLines.join("\n");
    if (codeLanguage.toLowerCase() === "mermaid" && closed) {
      html.push(
        '<div class="mermaid-chat-block" role="img" aria-label="Mermaid diagram">' +
        `<pre class="mermaid-chat-source">${escapeHtml(source)}</pre>` +
        '<div class="mermaid-chat-status" role="status">Rendering diagram…</div>' +
        "</div>"
      );
      codeLines = [];
      codeLanguage = "";
      return;
    }
    const languageClass = /^[a-z0-9_+-]+$/i.test(codeLanguage)
      ? ` class="language-${codeLanguage}"`
      : "";
    html.push(`<div class="code-block"><pre><code${languageClass}>${escapeHtml(source)}</code></pre></div>`);
    codeLines = [];
    codeLanguage = "";
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      if (inCode) flushCode(true);
      inCode = !inCode;
      if (inCode) codeLanguage = fence[1] || "";
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const tableAlignments = lineIndex + 1 < lines.length
      ? getTableAlignments(lines[lineIndex + 1])
      : null;
    if (line.includes("|") && tableAlignments) {
      flushParagraph();
      closeList();
      const headers = splitTableRow(line);
      const columnCount = Math.max(headers.length, tableAlignments.length);
      const renderCell = (tag, value, index) => {
        const alignment = tableAlignments[index] || "left";
        return `<${tag} style="text-align:${alignment}">${renderInlineMarkdown(value || "")}</${tag}>`;
      };

      html.push('<div class="table-scroll"><table><thead><tr>');
      for (let index = 0; index < columnCount; index += 1) {
        html.push(renderCell("th", headers[index], index));
      }
      html.push("</tr></thead><tbody>");
      lineIndex += 2;
      while (lineIndex < lines.length && lines[lineIndex].trim() && lines[lineIndex].includes("|")) {
        const cells = splitTableRow(lines[lineIndex]);
        html.push("<tr>");
        for (let index = 0; index < columnCount; index += 1) {
          html.push(renderCell("td", cells[index], index));
        }
        html.push("</tr>");
        lineIndex += 1;
      }
      html.push("</tbody></table></div>");
      lineIndex -= 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = ordered ? "ol" : "ul";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  if (inCode || codeLines.length) flushCode(false);
  return html.join("");
}

async function renderMermaidBlocks(element, version) {
  if (!globalThis.mermaid || markdownRenderVersions.get(element) !== version) return;
  const blocks = [...element.querySelectorAll(".mermaid-chat-block")];

  for (const block of blocks) {
    if (!block.isConnected || markdownRenderVersions.get(element) !== version) return;
    const sourceElement = block.querySelector(".mermaid-chat-source");
    const source = sourceElement?.textContent?.trim() || "";
    if (!source) continue;

    try {
      const diagramId = `mermaid-chat-${crypto.randomUUID()}`;
      // Small local models sometimes duplicate the opening angle bracket of a
      // left-pointing flowchart arrow. Mermaid reads it as an HTML tag start.
      const renderSource = source.replaceAll("<<--", "<--");
      const { svg, bindFunctions } = await mermaid.render(diagramId, renderSource);
      if (!block.isConnected || markdownRenderVersions.get(element) !== version) return;
      block.innerHTML = svg;
      block.classList.add("rendered");
      bindFunctions?.(block);
    } catch (error) {
      if (!block.isConnected || markdownRenderVersions.get(element) !== version) return;
      block.classList.add("failed");
      const status = block.querySelector(".mermaid-chat-status");
      if (status) {
        const lineNumber = String(error?.message || "").match(/(?:parse error on line|line)\s+(\d+)/i)?.[1];
        status.textContent = lineNumber
          ? `Mermaid syntax error near line ${lineNumber}. Showing the source so it can be corrected.`
          : "Mermaid could not parse this diagram. Showing the source so it can be corrected.";
      }
      // Invalid model-authored Mermaid is handled as user content above. Logging
      // the parse Error makes Chrome report it as an extension runtime error.
    }
  }
}

function renderMarkdown(element, markdown) {
  const version = (markdownRenderVersions.get(element) || 0) + 1;
  markdownRenderVersions.set(element, version);
  element.innerHTML = markdownToHtml(markdown);

  clearTimeout(mermaidRenderTimers.get(element));
  if (!element.querySelector(".mermaid-chat-block") || !globalThis.mermaid) return;
  const timer = setTimeout(() => {
    mermaidRenderTimers.delete(element);
    void renderMermaidBlocks(element, version);
  }, MERMAID_RENDER_DELAY);
  mermaidRenderTimers.set(element, timer);
}

function getToolActivityCopy(toolName, status) {
  const labels = {
    calculate: {
      running: "Calculating…",
      completed: "Calculated",
      failed: "Calculation failed"
    }
  };
  const fallback = {
    running: "Using tool…",
    completed: "Used tool",
    failed: "Tool failed"
  };
  return (labels[toolName] || fallback)[status] || fallback.running;
}

function formatToolActivityValue(value) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value ?? {}, null, 2);
}

function createSkillUsagePanel(skills = []) {
  const panel = document.createElement("details");
  panel.className = "skill-usage-panel";
  panel.hidden = !skills.length;

  const summary = document.createElement("summary");
  summary.textContent = `${skills.length} ${skills.length === 1 ? "skill" : "skills"} used`;

  const list = document.createElement("div");
  list.className = "skill-usage-list";

  for (const skill of skills) {
    const row = document.createElement("details");
    row.className = "skill-usage-row";
    const rowSummary = document.createElement("summary");
    const name = document.createElement("strong");
    name.textContent = skill.name || "Untitled skill";
    const source = document.createElement("span");
    source.className = "skill-selection-source";
    source.textContent = skill.selectionSource === "explicit"
      ? "Selected explicitly"
      : "Selected automatically";
    rowSummary.append(name, source);

    const body = document.createElement("div");
    body.className = "skill-usage-body";
    const description = document.createElement("p");
    description.textContent = skill.description || "No description";
    const instructionsLabel = document.createElement("strong");
    instructionsLabel.textContent = "Injected instructions";
    const instructions = document.createElement("pre");
    instructions.textContent = skill.instructions || "No instructions";
    body.append(description, instructionsLabel, instructions);
    row.append(rowSummary, body);
    list.append(row);
  }

  panel.append(summary, list);
  return panel;
}

function createToolActivityPanel() {
  const panel = document.createElement("details");
  panel.className = "tool-activity-panel";
  panel.hidden = true;
  panel.setAttribute("aria-live", "polite");

  const summary = document.createElement("summary");
  summary.textContent = "Using tools…";

  const list = document.createElement("div");
  list.className = "tool-activity-list";

  const actions = document.createElement("div");
  actions.className = "tool-activity-actions";
  actions.hidden = true;

  const answerNowButton = document.createElement("button");
  answerNowButton.className = "tool-answer-now-button";
  answerNowButton.type = "button";
  answerNowButton.textContent = "Answer now";
  actions.append(answerNowButton);

  panel.append(summary, list, actions);

  return {
    panel,
    summary,
    list,
    actions,
    answerNowButton,
    activities: new Map()
  };
}

function updateToolActivitySummary(toolUI) {
  const activities = [...toolUI.activities.values()];
  const running = activities.filter((activity) => activity.status === "running");
  if (running.length) {
    toolUI.summary.textContent = running.length === 1
      ? getToolActivityCopy(running[0].name, "running")
      : `Using ${running.length} tools…`;
    toolUI.panel.classList.add("streaming");
    return;
  }

  toolUI.panel.classList.remove("streaming");
  const unsupported = activities.filter((activity) => activity.unsupported).length;
  const failed = activities.filter((activity) => activity.status === "failed").length;
  toolUI.summary.textContent = unsupported
    ? `${unsupported} unsupported tool ${unsupported === 1 ? "request" : "requests"}`
    : failed
    ? `${failed} tool ${failed === 1 ? "call" : "calls"} failed`
    : `Used ${activities.length} ${activities.length === 1 ? "tool" : "tools"}`;
}

function renderToolActivity(toolUI, activity) {
  let activityUI = toolUI.activities.get(activity.id);
  if (!activityUI) {
    const row = document.createElement("div");
    row.className = "tool-activity-row";

    const header = document.createElement("div");
    header.className = "tool-activity-header";

    const indicator = document.createElement("span");
    indicator.className = "tool-activity-indicator";
    indicator.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "tool-activity-label";

    const toolName = document.createElement("code");
    toolName.className = "tool-activity-name";

    const details = document.createElement("details");
    details.className = "tool-activity-details";

    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "Details";

    const body = document.createElement("div");
    body.className = "tool-activity-body";
    details.append(detailsSummary, body);

    header.append(indicator, label, toolName);
    row.append(header, details);
    toolUI.list.append(row);
    activityUI = { ...activity, row, label, toolName, body };
    toolUI.activities.set(activity.id, activityUI);
  }

  Object.assign(activityUI, activity);
  activityUI.row.dataset.status = activity.status;
  activityUI.row.dataset.unsupported = String(Boolean(activity.unsupported));
  activityUI.label.textContent = activity.unsupported
    ? "Unsupported tool requested"
    : getToolActivityCopy(activity.name, activity.status);
  activityUI.toolName.textContent = activity.name;

  const sections = [`Input\n${formatToolActivityValue(activity.arguments)}`];
  if (activity.result !== undefined) {
    sections.push(`Result\n${formatToolActivityValue(activity.result)}`);
  }
  activityUI.body.textContent = sections.join("\n\n");

  toolUI.panel.hidden = false;
  updateToolActivitySummary(toolUI);
}

function appendStoredToolActivities(contentWrap, activities = []) {
  if (!activities.length) return;
  const toolUI = createToolActivityPanel();
  contentWrap.append(toolUI.panel);
  for (const [index, activity] of activities.entries()) {
    renderToolActivity(toolUI, {
      id: activity.id || `stored-tool-${index}`,
      name: activity.name || "unknown",
      status: activity.status === "failed" ? "failed" : "completed",
      unsupported: Boolean(activity.unsupported),
      arguments: activity.arguments,
      result: activity.result
    });
  }
}

function appendMessage(role, content = "", options = {}) {
  elements.emptyState.hidden = true;

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const contentWrap = document.createElement("div");
  contentWrap.style.width = role === "assistant" ? "100%" : "auto";

  if (options.contextLabel) {
    const badge = document.createElement("div");
    badge.className = "context-badge";
    badge.textContent = options.contextLabel;
    contentWrap.append(badge);
  }

  if (role === "assistant") {
    if (options.skillActivities?.length) {
      contentWrap.append(createSkillUsagePanel(options.skillActivities));
    }
    appendStoredToolActivities(contentWrap, options.toolActivities);
  }

  const message = document.createElement("div");
  message.className = `message${options.pending ? " pending" : ""}`;
  if (role === "assistant") {
    renderMarkdown(message, content);
  } else {
    message.textContent = content;
  }
  contentWrap.append(message);
  row.append(contentWrap);
  elements.conversation.append(row);
  scrollToLatest({ force: options.forceScroll });
  return message;
}

function setReplyContextAvailability(attachment, memorized) {
  attachment.memorized = memorized;
  if (!attachment.previewButton) return;
  attachment.previewButton.disabled = !memorized;
  attachment.previewButton.setAttribute("aria-disabled", String(!memorized));
  attachment.note.hidden = memorized;
  attachment.chip.classList.toggle("context-chip-unavailable", !memorized);
}

function rememberDomAttachment(attachment, context) {
  attachment.context = context;
  memorizedDomAttachments.push(attachment);
  while (memorizedDomAttachments.length > MAX_MEMORIZED_DOM_ATTACHMENTS) {
    const forgotten = memorizedDomAttachments.shift();
    forgotten.context = null;
    setReplyContextAvailability(forgotten, false);
  }
}

function createReplyContextChip(attachment) {
  const chip = document.createElement("div");
  chip.className = "context-chip reply-context-chip";
  chip.tabIndex = 0;
  chip.setAttribute("aria-label", "DOM page context");
  chip.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path>
    </svg>
    <span>DOM</span>
  `;

  const menu = document.createElement("div");
  menu.className = "chip-menu reply-chip-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "DOM context options");

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.textContent = "Preview";
  previewButton.setAttribute("role", "menuitem");
  previewButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (attachment.memorized && attachment.context) {
      openStoredContextPreview(attachment.context);
    }
  });

  const note = document.createElement("small");
  note.className = "chip-menu-note";
  note.textContent = "This DOM reference is not memorized.";
  note.hidden = true;
  menu.append(previewButton, note);
  chip.append(menu);
  enableReplyChipMenuOverlay(chip, menu);

  Object.assign(attachment, { chip, previewButton, note });
  return chip;
}

function openSkillsSettings() {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("settings.html#skills")
  });
}

function createReplySkillChip(skill) {
  const chip = document.createElement("div");
  chip.className = "skill-chip reply-context-chip reply-skill-chip";
  chip.tabIndex = 0;
  chip.setAttribute("aria-label", `${skill.name} skill`);
  chip.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"></path>
      <path d="m5 7 7 4 7-4M12 11v10"></path>
    </svg>
    <span>${escapeHtml(skill.name)}</span>
  `;

  const menu = document.createElement("div");
  menu.className = "chip-menu reply-chip-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", `${skill.name} skill options`);

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.textContent = "Preview";
  previewButton.setAttribute("role", "menuitem");
  previewButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSkillPreview(skill);
  });

  const configureButton = document.createElement("button");
  configureButton.type = "button";
  configureButton.textContent = "Configure";
  configureButton.setAttribute("role", "menuitem");
  configureButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSkillsSettings();
  });

  menu.append(previewButton, configureButton);
  chip.append(menu);
  enableReplyChipMenuOverlay(chip, menu);
  return chip;
}

function addReplyAttachments(attachmentArea, {
  order = [],
  contextAttachment = null,
  skills = [],
  requestedSkillId = null
} = {}) {
  const attachments = [];

  for (const kind of order) {
    if (kind === "dom" && contextAttachment) {
      attachments.push(createReplyContextChip(contextAttachment));
      contextAttachment = null;
    }
  }
  if (contextAttachment) attachments.push(createReplyContextChip(contextAttachment));
  attachmentArea.replaceChildren(...attachments);
}

function appendAssistantMessage({
  thinkingEnabled = false,
  modelSwitching = false
} = {}) {
  elements.emptyState.hidden = true;

  const row = document.createElement("div");
  row.className = "message-row assistant";

  const contentWrap = document.createElement("div");
  contentWrap.style.width = "100%";
  const attachmentArea = document.createElement("div");
  attachmentArea.className = "reply-attachments";
  contentWrap.append(attachmentArea);

  const skillUsageSlot = document.createElement("div");
  skillUsageSlot.className = "skill-usage-slot";
  contentWrap.append(skillUsageSlot);

  const processingStatus = document.createElement("div");
  processingStatus.className = "processing-status";
  processingStatus.setAttribute("role", "status");
  processingStatus.setAttribute("aria-live", "polite");

  const processingHeader = document.createElement("div");
  processingHeader.className = "processing-header";

  const processingLabel = document.createElement("div");
  processingLabel.className = "processing-label";
  processingLabel.textContent = modelSwitching
    ? "Ollama Loading (May take longer due to model switching)"
    : "Ollama loading…";

  const processingInfoButton = document.createElement("button");
  processingInfoButton.className = "processing-info-button";
  processingInfoButton.type = "button";
  processingInfoButton.textContent = "i";
  processingInfoButton.setAttribute("aria-label", "About Ollama loading");
  processingInfoButton.setAttribute("aria-expanded", "false");

  const processingInfo = document.createElement("div");
  processingInfo.className = "processing-info";
  processingInfo.id = `processing-info-${crypto.randomUUID()}`;
  processingInfo.hidden = true;
  processingInfo.setAttribute("role", "tooltip");
  processingInfo.textContent =
    "Ollama is loading the model, tokenizing this chat and page context, and preparing its context cache in memory before it can start producing a response.";
  processingInfoButton.setAttribute("aria-describedby", processingInfo.id);
  processingInfoButton.addEventListener("click", () => {
    const open = processingInfo.hidden;
    processingInfo.hidden = !open;
    processingInfoButton.setAttribute("aria-expanded", String(open));
  });

  processingHeader.append(processingLabel, processingInfoButton);
  processingStatus.append(processingHeader, processingInfo);
  contentWrap.append(processingStatus);

  const thinkingPanel = document.createElement("details");
  thinkingPanel.className = "thinking-panel streaming";
  thinkingPanel.open = thinkingEnabled;
  thinkingPanel.hidden = true;

  const thinkingSummary = document.createElement("summary");
  thinkingSummary.textContent = "Thinking…";

  const thinkingContent = document.createElement("div");
  thinkingContent.className = "thinking-content";
  thinkingContent.textContent = "Waiting for the model’s reasoning…";

  thinkingPanel.append(thinkingSummary, thinkingContent);
  contentWrap.append(thinkingPanel);

  const toolUI = createToolActivityPanel();
  contentWrap.append(toolUI.panel);

  const message = document.createElement("div");
  message.className = "message pending";
  message.textContent = "";
  contentWrap.append(message);

  row.append(contentWrap);
  elements.conversation.append(row);
  scrollToLatest();

  return {
    message,
    processingStatus,
    processingLabel,
    thinkingPanel,
    thinkingSummary,
    thinkingContent,
    toolUI,
    addAttachments: (attachments) => addReplyAttachments(attachmentArea, attachments),
    showSkills: (skills) => {
      skillUsageSlot.replaceChildren(
        ...(skills.length ? [createSkillUsagePanel(skills)] : [])
      );
    },
    hasThinking: false,
    answerStarted: false
  };
}

function getSiteDetails(tab) {
  if (!tab?.id || !tab.url) {
    return {
      tabId: tab?.id || null,
      windowId: tab?.windowId ?? null,
      pageUrl: tab?.url || "",
      faviconUrl: getFaviconUrl(tab),
      hostname: "",
      originPattern: "",
      restricted: true,
      reason: "BrowserChat cannot identify this page."
    };
  }

  try {
    const url = new URL(tab.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        tabId: tab.id,
        windowId: tab.windowId ?? null,
        pageUrl: tab.url,
        faviconUrl: getFaviconUrl(tab),
        hostname: url.protocol.replace(":", "") || "this page",
        originPattern: "",
        restricted: true,
        reason: "Chrome does not allow extensions to read this type of page."
      };
    }

    return {
      tabId: tab.id,
      windowId: tab.windowId ?? null,
      pageUrl: tab.url,
      faviconUrl: getFaviconUrl(tab),
      hostname: url.hostname,
      originPattern: `${url.protocol}//${url.host}/*`,
      restricted: false,
      reason: ""
    };
  } catch {
    return {
      tabId: tab.id,
      windowId: tab.windowId ?? null,
      pageUrl: tab.url || "",
      faviconUrl: getFaviconUrl(tab),
      hostname: "",
      originPattern: "",
      restricted: true,
      reason: "BrowserChat cannot identify this page."
    };
  }
}

function renderSiteAccess() {
  if (currentSite.hasAccess) {
    elements.siteAccessBanner.hidden = true;
    elements.siteAccessBanner.classList.remove("restricted");
    elements.allowSiteButton.disabled = true;
    updateSendButton();
    return;
  }

  elements.siteAccessBanner.hidden = false;
  elements.siteAccessBanner.classList.toggle("restricted", currentSite.restricted);
  elements.allowSiteButton.hidden = currentSite.restricted;
  elements.allowSiteButton.disabled =
    currentSite.restricted || !currentSite.originPattern;
  if (currentSite.restricted) {
    elements.siteAccessTitle.textContent = "This page is unavailable";
    elements.siteAccessDescription.textContent =
      currentSite.reason || "Open a regular website to use DOM context.";
  } else {
    elements.siteAccessTitle.textContent = `Allow access to ${currentSite.hostname}`;
    elements.siteAccessDescription.textContent =
      "Only this website will be approved and remembered.";
  }

  updateSendButton();
}

async function rememberSentSiteForChat(chatId) {
  const chat = chats.find((item) => item.id === chatId);
  let tab;
  try {
    [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
  } catch {
    return;
  }
  if (!chat || !tab?.id) return;

  const details = getSiteDetails(tab);

  chat.tabId = tab.id;
  chat.windowId = tab.windowId ?? chat.windowId;
  chat.pageUrl = tab.url || chat.pageUrl;
  chat.faviconUrl = getFaviconUrl(tab);
  chat.hostname = details.hostname || chat.hostname;
  chat.updatedAt = Date.now();
  renderChatMenu();
  await persistChats();
}

async function refreshSiteAccess(preferredTabId = null) {
  try {
    const tab = Number.isInteger(preferredTabId)
      ? await chrome.tabs.get(preferredTabId)
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    const details = getSiteDetails(tab);
    let hasAccess = false;

    if (details.originPattern) {
      hasAccess = await chrome.permissions.contains({
        origins: [details.originPattern]
      });
    }

    currentSite = { ...details, hasAccess };
  } catch {
    currentSite = {
      tabId: null,
      windowId: null,
      pageUrl: "",
      faviconUrl: "",
      hostname: "",
      originPattern: "",
      hasAccess: false,
      restricted: true,
      reason: "BrowserChat could not check access for this page."
    };
  }

  renderChatHeader();
  renderSiteAccess();
}

async function requestCurrentSiteAccess() {
  if (!currentSite.originPattern || currentSite.restricted) return false;

  const requestedPattern = currentSite.originPattern;
  elements.allowSiteButton.disabled = true;
  elements.allowSiteButton.textContent = "Waiting…";
  setError("");

  try {
    const granted = await chrome.permissions.request({
      origins: [requestedPattern]
    });

    await refreshSiteAccess();
    if (!granted) {
      setError(`Page access was not approved for ${currentSite.hostname || "this site"}.`);
    }
    return granted;
  } catch (error) {
    setError(error.message || "BrowserChat could not request access to this site.");
    return false;
  } finally {
    elements.allowSiteButton.textContent = "Allow";
    renderSiteAccess();
  }
}

async function loadModels() {
  setConnectionStatus("", "Checking Ollama");

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const models = (data.models || []).map((model) => model.name).filter(Boolean);
    const saved = await chrome.storage.local.get([
      "selectedModel",
      "thinkingEnabled"
    ]);

    elements.modelSelect.replaceChildren();
    if (!models.length) {
      const option = new Option("No models installed", "");
      elements.modelSelect.add(option);
      setConnectionStatus("offline", "Ollama is running, but no models are installed");
      setError("Ollama is connected, but no models are installed. Run “ollama pull gemma3:4b” in Terminal.");
      return;
    }

    for (const model of models) {
      elements.modelSelect.add(new Option(model, model));
    }

    const preferred = saved.selectedModel;
    elements.modelSelect.value = models.includes(preferred) ? preferred : models[0];
    elements.thinkingSelect.value =
      saved.thinkingEnabled === false ? "off" : "on";
    setConnectionStatus("online", "Connected to Ollama");
    setError("");
  } catch (error) {
    elements.modelSelect.replaceChildren(new Option("Ollama unavailable", ""));
    setConnectionStatus("offline", "Could not connect to Ollama");
    setError(
      "Couldn’t connect to Ollama. Start it with Chrome-extension origins enabled, then reopen this panel."
    );
  } finally {
    updateSendButton();
  }
}

async function selectElementFromActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("No active browser tab was found.");

  const details = getSiteDetails(tab);
  if (details.restricted) throw new Error(details.reason);
  const hasAccess = await chrome.permissions.contains({
    origins: [details.originPattern]
  });
  if (!hasAccess) {
    throw new Error(`Allow access to ${details.hostname} before selecting an element.`);
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => new Promise((resolve) => {
      const overlayId = "__pagewise_element_picker_overlay";
      const tooltipId = "__pagewise_element_picker_tooltip";
      document.getElementById(overlayId)?.remove();
      document.getElementById(tooltipId)?.remove();

      const overlay = document.createElement("div");
      overlay.id = overlayId;
      Object.assign(overlay.style, {
        position: "fixed",
        zIndex: "2147483646",
        pointerEvents: "none",
        border: "2px solid #4f7cff",
        borderRadius: "2px",
        background: "rgba(79, 124, 255, 0.10)",
        boxShadow: "0 0 0 1px rgba(255,255,255,.8), 0 2px 8px rgba(0,0,0,.18)",
        display: "none"
      });

      const tooltip = document.createElement("div");
      tooltip.id = tooltipId;
      tooltip.textContent = "Click to select · Esc to cancel";
      Object.assign(tooltip.style, {
        position: "fixed",
        zIndex: "2147483647",
        pointerEvents: "none",
        padding: "6px 9px",
        color: "#fff",
        background: "#171716",
        borderRadius: "5px",
        font: "600 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        boxShadow: "0 3px 12px rgba(0,0,0,.25)",
        display: "none"
      });
      (document.documentElement || document.body).append(overlay, tooltip);

      let hoveredElement = null;
      const pickerNode = (node) =>
        node?.closest?.(`#${overlayId}, #${tooltipId}`) ? null : node;

      const describe = (element) => {
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : "";
        const className = typeof element.className === "string"
          ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2)
              .map((name) => `.${name}`).join("")
          : "";
        return `${tag}${id}${className}`;
      };

      const uniqueSelector = (element) => {
        const tag = element.tagName.toLowerCase();
        if (element.id) {
          const selector = `${tag}#${CSS.escape(element.id)}`;
          if (document.querySelectorAll(selector).length === 1) return selector;
        }

        for (const attribute of ["data-testid", "data-test", "data-cy"]) {
          const value = element.getAttribute(attribute);
          if (!value) continue;
          const selector = `${tag}[${attribute}="${CSS.escape(value)}"]`;
          if (document.querySelectorAll(selector).length === 1) return selector;
        }

        const parts = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          if (current === document.body) {
            parts.unshift("body");
            break;
          }
          if (current.id) {
            parts.unshift(
              `${current.tagName.toLowerCase()}#${CSS.escape(current.id)}`
            );
            break;
          }
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement
            ? Array.from(current.parentElement.children).filter(
                (sibling) => sibling.tagName === current.tagName
              )
            : [];
          const segment = siblings.length > 1
            ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})`
            : tag;
          parts.unshift(segment);
          current = current.parentElement;
        }
        return parts.join(" > ");
      };

      const positionOverlay = () => {
        if (!hoveredElement?.isConnected) return;
        const rect = hoveredElement.getBoundingClientRect();
        Object.assign(overlay.style, {
          display: "block",
          left: `${Math.max(0, rect.left)}px`,
          top: `${Math.max(0, rect.top)}px`,
          width: `${Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))}px`,
          height: `${Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))}px`
        });
        tooltip.textContent = `${describe(hoveredElement)} · Click to select · Esc to cancel`;
        tooltip.style.display = "block";
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        tooltip.style.left = `${Math.max(
          6,
          Math.min(innerWidth - tooltipWidth - 6, rect.left)
        )}px`;
        tooltip.style.top = `${rect.top > tooltipHeight + 8
          ? rect.top - tooltipHeight - 6
          : Math.min(innerHeight - tooltipHeight - 6, Math.max(6, rect.top + 6))}px`;
      };

      const onPointerMove = (event) => {
        const candidate = pickerNode(document.elementFromPoint(event.clientX, event.clientY));
        if (!(candidate instanceof Element) || candidate === hoveredElement) return;
        hoveredElement = candidate;
        positionOverlay();
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("scroll", positionOverlay, true);
        window.removeEventListener("resize", positionOverlay, true);
        overlay.remove();
        tooltip.remove();
      };

      const onPointerDown = (event) => {
        if (!hoveredElement) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      const onClick = (event) => {
        const selected = pickerNode(document.elementFromPoint(event.clientX, event.clientY));
        if (!(selected instanceof Element)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup();
        resolve({
          selector: uniqueSelector(selected),
          tagName: selected.tagName.toLowerCase(),
          label: describe(selected),
          textPreview: ""
        });
      };

      const onKeyDown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup();
        resolve(null);
      };

      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("scroll", positionOverlay, true);
      window.addEventListener("resize", positionOverlay, true);
    })
  });

  return result || null;
}

async function captureActivePageContext(
  maxTextCharacters = getEffectiveDomTextLimit(),
  captureConfiguration = getDomCaptureConfiguration()
) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error("No active browser tab was found.");
  }

  const details = getSiteDetails(tab);
  if (details.restricted) {
    throw new Error(details.reason);
  }

  const hasAccess = await chrome.permissions.contains({
    origins: [details.originPattern]
  });
  if (!hasAccess) {
    await refreshSiteAccess();
    throw new Error(`Allow access to ${details.hostname} before sending a message.`);
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [{
      ...CONTEXT_LIMITS,
      maxTextCharacters: captureConfiguration?.mode === "element"
        ? MAX_DOM_TEXT_LIMIT
        : clampDomTextLimit(maxTextCharacters),
      captureMode: captureConfiguration?.mode === "element" ? "element" : "fullPage",
      rootSelector: captureConfiguration?.selectedElement?.selector || "",
      rootTagName: captureConfiguration?.selectedElement?.tagName || ""
    }],
    func: (limits) => {
      const normalize = (value = "") =>
        String(value).replace(/\s+/g, " ").trim();

      const clip = (value, length = 240) => {
        const text = normalize(value);
        return text.length > length ? `${text.slice(0, length - 1)}…` : text;
      };

      const isVisible = (element) => {
        if (!(element instanceof Element)) return false;
        if (element.closest("[hidden], [aria-hidden='true']")) return false;
        const style = getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity || "1") > 0 &&
          element.getClientRects().length > 0
        );
      };

      const isInViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth
        );
      };

      const root = limits.captureMode === "element"
        ? document.querySelector(limits.rootSelector)
        : (document.body || document.documentElement);
      if (!root) {
        throw new Error(
          "The selected element is no longer on this page. Open DOM Configure and select it again."
        );
      }
      if (
        limits.captureMode === "element" &&
        limits.rootTagName &&
        root.tagName.toLowerCase() !== limits.rootTagName.toLowerCase()
      ) {
        throw new Error(
          "The page replaced the selected element with a different section. Open DOM Configure and select it again."
        );
      }

      const queryWithinRoot = (selector) => {
        const matches = root instanceof Element && root.matches(selector) ? [root] : [];
        return [...matches, ...root.querySelectorAll(selector)];
      };

      const getAccessibleLabel = (element, allowInnerText = true) => {
        const ariaLabel = normalize(element.getAttribute("aria-label"));
        if (ariaLabel) return clip(ariaLabel);

        const labelledBy = normalize(element.getAttribute("aria-labelledby"));
        if (labelledBy) {
          const label = labelledBy
            .split(" ")
            .map((id) => document.getElementById(id))
            .filter((labelElement) =>
              labelElement &&
              (limits.captureMode === "fullPage" || root.contains(labelElement))
            )
            .map((labelElement) => labelElement.textContent || "")
            .map(normalize)
            .filter(Boolean)
            .join(" ");
          if (label) return clip(label);
        }

        const associatedLabels = Array.from(element.labels || [])
          .filter((label) =>
            limits.captureMode === "fullPage" || root.contains(label)
          )
          .map((label) => normalize(label.innerText || label.textContent))
          .filter(Boolean)
          .join(" ");
        if (associatedLabels) return clip(associatedLabels);

        const wrappingLabel = element.closest("label");
        if (
          wrappingLabel &&
          (limits.captureMode === "fullPage" || root.contains(wrappingLabel))
        ) {
          const label = normalize(wrappingLabel.innerText || wrappingLabel.textContent);
          if (label) return clip(label);
        }

        const title = normalize(element.getAttribute("title"));
        if (title) return clip(title);

        const placeholder = normalize(element.getAttribute("placeholder"));
        if (placeholder) return clip(placeholder);

        if (allowInnerText) {
          const innerText = normalize(element.innerText || element.textContent);
          if (innerText) return clip(innerText);
        }

        return "";
      };

      const collectVisibleText = () => {
        const viewportCandidates = [];
        const elsewhereCandidates = [];
        const seenViewport = new Set();
        const seenElsewhere = new Set();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {
          const node = walker.currentNode;
          const parent = node.parentElement;
          if (
            !parent ||
            parent.closest(
              "script, style, noscript, template, svg, canvas, input, textarea, [contenteditable='true']"
            ) ||
            !isVisible(parent)
          ) {
            continue;
          }

          const text = normalize(node.nodeValue);
          if (!text) continue;

          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = Array.from(range.getClientRects());
          if (!rects.length) continue;

          const inViewport = rects.some(
            (rect) =>
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.top < innerHeight &&
              rect.left < innerWidth
          );

          if (inViewport) {
            if (!seenViewport.has(text)) {
              viewportCandidates.push(text);
              seenViewport.add(text);
            }
          } else if (!seenElsewhere.has(text)) {
            elsewhereCandidates.push(text);
            seenElsewhere.add(text);
          }
        }

        const characterLength = (lines) => lines.join("\n").length;
        const takeWithinLimit = (lines, characterLimit) => {
          const included = [];
          let characters = 0;
          for (const line of lines) {
            const separatorLength = included.length ? 1 : 0;
            const remaining = characterLimit - characters - separatorLength;
            if (remaining <= 0) break;
            if (line.length > remaining) {
              included.push(remaining > 1 ? `${line.slice(0, remaining - 1)}…` : line.slice(0, remaining));
              break;
            }
            included.push(line);
            characters += separatorLength + line.length;
          }
          return included;
        };

        const maxTextCharacters = Math.max(0, limits.maxTextCharacters);
        const viewportBudget = maxTextCharacters;
        const viewportLines = takeWithinLimit(viewportCandidates, viewportBudget);
        const viewportCharacters = characterLength(viewportLines);
        const remainingBudget = Math.max(0, maxTextCharacters - viewportCharacters);
        const pageBudget = remainingBudget;
        const elsewhereLines = takeWithinLimit(elsewhereCandidates, pageBudget);
        const pageCharacters = characterLength(elsewhereLines);
        const totalViewportCharacters = characterLength(viewportCandidates);
        const totalPageCharacters = characterLength(elsewhereCandidates);

        return {
          inViewport: viewportLines.join("\n"),
          elsewhereOnPage: elsewhereLines.join("\n"),
          viewportTruncated: viewportCharacters < totalViewportCharacters,
          pageTruncated: pageCharacters < totalPageCharacters,
          totalViewportCharacters,
          totalPageCharacters
        };
      };

      const headings = queryWithinRoot("h1, h2, h3, h4, h5, h6")
        .filter(isVisible)
        .slice(0, limits.headings)
        .map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          text: clip(heading.innerText || heading.textContent, 320),
          inViewport: isInViewport(heading)
        }))
        .filter((heading) => heading.text);

      const interactionSelector = [
        "a[href]",
        "button",
        "input:not([type='hidden'])",
        "select",
        "textarea",
        "details > summary",
        "[contenteditable='true']",
        "[role='button']",
        "[role='link']",
        "[role='checkbox']",
        "[role='radio']",
        "[role='combobox']",
        "[role='menuitem']",
        "[role='slider']",
        "[role='switch']",
        "[role='tab']"
      ].join(",");

      let remainingOptionBudget = limits.totalOptions;
      const interactiveElements = Array.from(
        new Set(queryWithinRoot(interactionSelector))
      )
        .filter(isVisible)
        .slice(0, limits.interactiveElements)
        .map((element, index) => {
          const tag = element.tagName.toLowerCase();
          const role = normalize(element.getAttribute("role"));
          const type = normalize(element.getAttribute("type")).toLowerCase();
          const isEditable = element.matches(
            "input, textarea, select, [contenteditable='true']"
          );
          const item = {
            index: index + 1,
            kind:
              role ||
              (tag === "a"
                ? "link"
                : tag === "select"
                  ? "select"
                  : tag === "textarea"
                    ? "textarea"
                    : tag === "input"
                      ? type || "text"
                      : tag),
            label: getAccessibleLabel(element, !isEditable),
            inViewport: isInViewport(element)
          };

          const name = normalize(element.getAttribute("name"));
          if (name) item.name = clip(name, 120);

          if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") {
            item.disabled = true;
          }

          if (element.matches("a[href]")) {
            item.href = clip(element.href, 500);
          }

          if (element.matches("input, textarea, select, [contenteditable='true']")) {
            const placeholder = normalize(element.getAttribute("placeholder"));
            const autocomplete = normalize(element.getAttribute("autocomplete"));
            if (placeholder) item.placeholder = clip(placeholder);
            if (autocomplete) item.autocomplete = clip(autocomplete, 80);
            if (element.required || element.getAttribute("aria-required") === "true") {
              item.required = true;
            }
            if (element.readOnly) item.readOnly = true;
          }

          if (element.matches("input")) {
            item.inputType = type || "text";
            for (const attribute of ["min", "max", "step", "minlength", "maxlength", "pattern"]) {
              const value = normalize(element.getAttribute(attribute));
              if (value) item[attribute] = clip(value, 160);
            }

            if (["checkbox", "radio"].includes(type)) {
              item.checked = element.checked;
            }

            if (["button", "submit", "reset"].includes(type)) {
              item.label = item.label || clip(element.value);
            }

            const listId = normalize(element.getAttribute("list"));
            const datalist = listId ? document.getElementById(listId) : null;
            if (datalist?.matches("datalist")) {
              const optionLimit = Math.min(
                limits.optionsPerControl,
                remainingOptionBudget
              );
              item.options = Array.from(datalist.options)
                .slice(0, optionLimit)
                .map((option) => ({
                  label: clip(option.label || option.value),
                  value: clip(option.value)
                }));
              remainingOptionBudget -= item.options.length;
            }
          }

          if (element.matches("select")) {
            item.multiple = element.multiple;
            const optionLimit = Math.min(
              limits.optionsPerControl,
              remainingOptionBudget
            );
            item.options = Array.from(element.options)
              .slice(0, optionLimit)
              .map((option) => ({
                label: clip(option.label || option.textContent),
                value: clip(option.value),
                selected: option.selected,
                disabled: option.disabled
              }));
            remainingOptionBudget -= item.options.length;
          }

          if (element.matches("[role='checkbox'], [role='radio'], [role='switch']")) {
            const checked = element.getAttribute("aria-checked");
            if (checked !== null) item.checked = checked;
          }

          if (element.matches("[role='slider']")) {
            for (const attribute of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext"]) {
              const value = normalize(element.getAttribute(attribute));
              if (value) item[attribute.replace("aria-", "")] = clip(value, 120);
            }
          }

          return item;
        });

      const visibleText = collectVisibleText();
      const metadataDescription = normalize(
        limits.captureMode === "fullPage"
          ? document.querySelector("meta[name='description']")?.content ||
              document.querySelector("meta[property='og:description']")?.content
          : ""
      );
      const rootRect = root.getBoundingClientRect();

      return {
        schema: "pagewise.page-context.v1",
        capturedAt: new Date().toISOString(),
        page: {
          url: location.href,
          title: limits.captureMode === "fullPage" ? document.title : "",
          language:
            limits.captureMode === "fullPage"
              ? document.documentElement.lang || ""
              : "",
          description: clip(metadataDescription, 600)
        },
        capture: limits.captureMode === "element"
          ? {
              mode: "selectedElement",
              selector: limits.rootSelector,
              element: root.tagName.toLowerCase(),
              label: clip(
                root.getAttribute("aria-label") ||
                  root.getAttribute("title") ||
                  root.id ||
                  root.className ||
                  root.tagName,
                180
              ),
              bounds: {
                x: Math.round(rootRect.x),
                y: Math.round(rootRect.y),
                width: Math.round(rootRect.width),
                height: Math.round(rootRect.height)
              }
            }
          : { mode: "fullPage" },
        viewport: {
          width: innerWidth,
          height: innerHeight,
          scrollX,
          scrollY
        },
        visibleText,
        headings,
        interactiveElements,
        stats: {
          headingCount: headings.length,
          interactiveElementCount: interactiveElements.length,
          viewportTextCharacters: visibleText.inViewport.length,
          otherVisibleTextCharacters: visibleText.elsewhereOnPage.length,
          totalViewportTextCharacters: visibleText.totalViewportCharacters,
          totalOtherVisibleTextCharacters: visibleText.totalPageCharacters,
          packagedTextCharacters:
            visibleText.inViewport.length + visibleText.elsewhereOnPage.length,
          totalAvailableTextCharacters:
            visibleText.totalViewportCharacters + visibleText.totalPageCharacters,
          limitsApplied: limits
        },
        privacy: {
          typedInputValuesIncluded: false,
          passwordValuesIncluded: false
        },
        limitations: [
          "Cross-origin iframe contents are not included.",
          "Text drawn into canvas elements or images is not included.",
          "Content not currently present in the live DOM is not included."
        ]
      };
    }
  });

  if (!result?.page?.url) {
    throw new Error("The page context could not be captured.");
  }

  return result;
}

function buildOllamaMessages(prompt, page = null, selectedSkills = []) {
  const baseSystemPrompt = BrowserChatPromptConfig.buildSystemPrompt({
    corePrompt: userSystemPrompt,
    page,
    settings: userPromptSettings
  });
  const systemPrompt = BrowserChatSkills.composeSystemPrompt(
    baseSystemPrompt,
    selectedSkills
  );

  const userContent = page
    ? [
        userPromptSettings.pageContextOpen,
        JSON.stringify(page, null, 2),
        userPromptSettings.pageContextClose,
        "",
        `${userPromptSettings.userQuestionOpen}${prompt}${userPromptSettings.userQuestionClose}`
      ].join("\n")
    : prompt;

  return [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: userContent }
  ];
}

async function selectSkillsForPrompt(prompt, signal, selectedSkillId = null) {
  if (!skillsEnabled || !availableSkills.length) return [];

  const explicitlySelected = availableSkills.find(
    (skill) => skill.id === selectedSkillId
  );
  if (explicitlySelected) return [explicitlySelected];

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: elements.modelSelect.value,
        messages: BrowserChatSkills.buildSelectionMessages(
          prompt,
          availableSkills
        ),
        stream: false,
        think: false,
        format: "json"
      }),
      signal
    });
    if (!response.ok) return [];
    const data = await response.json();
    const selectedIds = BrowserChatSkills.parseSelection(
      data.message?.content,
      availableSkills
    );
    return selectedIds
      .map((id) => availableSkills.find((skill) => skill.id === id))
      .filter(Boolean);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    console.warn("Skill selection failed; continuing without skills.", error);
    return [];
  }
}

async function refreshContextPreview() {
  const captureSequence = ++previewCaptureSequence;
  const configuredLimit = previewMode === "configure"
    ? clampDomTextLimit(elements.domLimitInput.value)
    : getEffectiveDomTextLimit();
  const captureConfiguration = previewMode === "configure" && domConfigurationScope === "chat"
    ? domConfigurationDraft
    : getDomCaptureConfiguration();
  if (captureConfiguration?.mode === "element" && !captureConfiguration.selectedElement) {
    elements.previewDescription.textContent =
      "Choose a section on the site. Only rendered text and controls inside that element will be packaged.";
    elements.contextPreviewContent.textContent =
      "Select an element on the page to preview the section that will be packaged.";
    elements.previewStats.textContent = "Waiting for an element";
    elements.refreshPreviewButton.hidden = false;
    elements.refreshPreviewButton.disabled = true;
    elements.refreshPreviewButton.textContent = "Refresh";
    return;
  }
  if (previewMode !== "stored") {
    elements.previewDescription.textContent = previewMode === "configure"
      ? captureConfiguration?.mode === "element"
        ? "Preview the rendered text and controls BrowserChat will package from only the selected section."
        : "Preview how much rendered DOM text BrowserChat will package locally with the selected limit."
      : "This is the exact structured page information attached to your next prompt. Typed text-field values and passwords are excluded.";
  }
  elements.refreshPreviewButton.hidden = false;
  elements.refreshPreviewButton.disabled = true;
  elements.refreshPreviewButton.textContent = "Capturing…";
  elements.contextPreviewContent.textContent =
    "Reading rendered text and interactive controls…";
  elements.previewStats.textContent = "";

  try {
    const context = await captureActivePageContext(configuredLimit, captureConfiguration);
    if (captureSequence !== previewCaptureSequence) return;
    elements.contextPreviewContent.textContent = JSON.stringify(context, null, 2);
    elements.previewStats.textContent = [
      `${context.stats.packagedTextCharacters.toLocaleString()} packaged text characters`,
      `${context.stats.totalAvailableTextCharacters.toLocaleString()} available`,
      `${context.stats.headingCount.toLocaleString()} headings`,
      `${context.stats.interactiveElementCount.toLocaleString()} interactive elements`
    ].join(" · ");
    if (previewMode === "configure" && captureConfiguration?.mode !== "element") {
      const packaged = context.stats.packagedTextCharacters;
      const available = context.stats.totalAvailableTextCharacters;
      const omitted = Math.max(0, available - packaged);
      elements.domLengthInfo.textContent = omitted
        ? `${available.toLocaleString()} text characters are available in the full rendered DOM. This limit packages ${packaged.toLocaleString()} and omits approximately ${omitted.toLocaleString()}.`
        : `${available.toLocaleString()} text characters are available in the full rendered DOM. The current limit packages all of them.`;
    }
  } catch (error) {
    if (captureSequence !== previewCaptureSequence) return;
    elements.contextPreviewContent.textContent =
      error.message || "BrowserChat could not capture this page.";
    elements.previewStats.textContent = "Capture failed";
  } finally {
    if (captureSequence !== previewCaptureSequence) return;
    elements.refreshPreviewButton.disabled = false;
    elements.refreshPreviewButton.textContent = "Refresh";
  }
}

function openStoredContextPreview(context) {
  previewMode = "stored";
  domConfigurationScope = null;
  elements.previewTitle.textContent = "Page context preview";
  elements.previewDescription.textContent =
    "This is the exact structured page information that was sent with this reply.";
  elements.contextPreviewContent.textContent = JSON.stringify(context, null, 2);
  elements.previewStats.textContent = [
    `${context.stats.viewportTextCharacters.toLocaleString()} viewport text characters`,
    `${context.stats.otherVisibleTextCharacters.toLocaleString()} other visible text characters`,
    `${context.stats.headingCount.toLocaleString()} headings`,
    `${context.stats.interactiveElementCount.toLocaleString()} interactive elements`
  ].join(" · ");
  elements.domModeControls.hidden = true;
  elements.domLimitControls.hidden = true;
  elements.saveDomLimitButton.hidden = true;
  elements.resetDomLimitButton.hidden = true;
  elements.donePreviewButton.hidden = false;
  elements.refreshPreviewButton.hidden = true;
  if (!elements.contextPreviewDialog.open) {
    elements.contextPreviewDialog.showModal();
  }
}

function openSkillPreview(skill) {
  if (!skill) return;
  previewMode = "skill";
  domConfigurationScope = null;
  elements.previewTitle.textContent = `${skill.name} skill`;
  elements.previewDescription.textContent =
    "These are the instructions included in the effective system prompt when this skill is used.";
  elements.contextPreviewContent.textContent = skill.instructions || "This skill has no instructions.";
  elements.previewStats.textContent = skill.description || "No description";
  elements.domModeControls.hidden = true;
  elements.domLimitControls.hidden = true;
  elements.saveDomLimitButton.hidden = true;
  elements.resetDomLimitButton.hidden = true;
  elements.donePreviewButton.hidden = false;
  elements.refreshPreviewButton.hidden = true;
  if (!elements.contextPreviewDialog.open) {
    elements.contextPreviewDialog.showModal();
  }
}

function openContextPreview() {
  if (!currentSite.hasAccess) {
    setError("Allow access to this site before previewing its page context.");
    return;
  }

  previewMode = "preview";
  domConfigurationScope = null;
  elements.previewTitle.textContent = "Page context preview";
  elements.domModeControls.hidden = true;
  elements.domLimitControls.hidden = true;
  elements.saveDomLimitButton.hidden = true;
  elements.resetDomLimitButton.hidden = true;
  elements.donePreviewButton.hidden = false;
  if (!elements.contextPreviewDialog.open) {
    elements.contextPreviewDialog.showModal();
  }
  refreshContextPreview();
}

function openDomConfiguration(scope) {
  if (!currentSite.hasAccess) {
    setError("Allow access to this site before configuring its DOM context.");
    return;
  }

  const chat = getActiveChat();
  previewMode = "configure";
  domConfigurationScope = scope;
  elements.previewTitle.textContent = "Configure DOM context";
  const isChatScope = scope === "chat";
  const configuredLimit = isChatScope
    ? getEffectiveDomTextLimit(chat)
    : globalDomTextLimit;
  const captureConfiguration = getDomCaptureConfiguration(chat);
  domConfigurationDraft = isChatScope
    ? {
        chatId: chat?.id || null,
        mode: captureConfiguration.mode,
        selectedElement: captureConfiguration.selectedElement
          ? { ...captureConfiguration.selectedElement }
          : null
      }
    : null;

  elements.domLimitInput.value = String(configuredLimit);
  elements.domLimitScope.textContent = isChatScope
    ? "Applies only to this chat."
    : "System default for DOM context added in chats.";
  elements.domLengthInfo.textContent =
    "Capturing the page to measure its full rendered DOM text…";
  elements.domModeControls.hidden = !isChatScope;
  elements.fullPageModeInput.checked =
    !isChatScope || domConfigurationDraft.mode === "fullPage";
  elements.selectElementModeInput.checked =
    isChatScope && domConfigurationDraft.mode === "element";
  renderDomConfigurationControls();
  elements.saveDomLimitButton.hidden = false;
  elements.resetDomLimitButton.hidden =
    !isChatScope ||
    (!Number.isFinite(chat?.domTextLimitOverride) &&
      chat?.domCaptureMode !== "element" &&
      !chat?.domSelectedElement);
  elements.donePreviewButton.hidden = true;
  elements.previewDescription.textContent =
    domConfigurationDraft?.mode === "element"
      ? "Preview the rendered text and controls from only the selected section."
      : "Preview how much rendered DOM text BrowserChat will package locally with the selected limit.";
  if (!elements.contextPreviewDialog.open) {
    elements.contextPreviewDialog.showModal();
  }
  refreshContextPreview();
}

function renderDomConfigurationControls() {
  const isElementMode =
    domConfigurationScope === "chat" && domConfigurationDraft?.mode === "element";
  elements.domLimitControls.hidden = isElementMode;
  elements.selectedElementControls.hidden = !isElementMode;

  const selected = domConfigurationDraft?.selectedElement;
  elements.selectedElementName.textContent =
    selected?.label || selected?.tagName || "No element selected";
  elements.selectedElementDescription.textContent = selected
    ? selected.selector
    : "Hover over the site and click the section to include.";
  elements.selectElementButton.textContent = selected
    ? "Choose another"
    : "Select on page";
  elements.saveDomLimitButton.textContent = isElementMode ? "Save" : "Save limit";
  elements.saveDomLimitButton.disabled = Boolean(isElementMode && !selected);
}

async function saveDomConfiguration() {
  const limit = clampDomTextLimit(elements.domLimitInput.value);
  elements.domLimitInput.value = String(limit);

  if (domConfigurationScope === "global") {
    globalDomTextLimit = limit;
    await chrome.storage.local.set({ [DOM_TEXT_LIMIT_STORAGE_KEY]: limit });
  } else if (domConfigurationScope === "chat") {
    const chat = getActiveChat();
    if (!chat || domConfigurationDraft?.chatId !== chat.id) return;
    chat.domTextLimitOverride = limit;
    chat.domCaptureMode = domConfigurationDraft?.mode === "element"
      ? "element"
      : "fullPage";
    chat.domSelectedElement = domConfigurationDraft?.selectedElement
      ? { ...domConfigurationDraft.selectedElement }
      : null;
    chat.updatedAt = Date.now();
    await persistChats();
    elements.resetDomLimitButton.hidden = false;
    updateContextChipLabel();
  }

  elements.saveDomLimitButton.textContent = "Saved";
  setTimeout(() => {
    elements.saveDomLimitButton.textContent =
      domConfigurationScope === "chat" && domConfigurationDraft?.mode === "element"
        ? "Save"
        : "Save limit";
  }, 900);
  await refreshContextPreview();
}

async function resetChatDomConfiguration() {
  const chat = getActiveChat();
  if (!chat || domConfigurationScope !== "chat") return;
  chat.domTextLimitOverride = null;
  chat.domCaptureMode = "fullPage";
  chat.domSelectedElement = null;
  domConfigurationDraft = {
    chatId: chat.id,
    mode: "fullPage",
    selectedElement: null
  };
  chat.updatedAt = Date.now();
  elements.domLimitInput.value = String(globalDomTextLimit);
  elements.resetDomLimitButton.hidden = true;
  await persistChats();
  elements.fullPageModeInput.checked = true;
  elements.selectElementModeInput.checked = false;
  renderDomConfigurationControls();
  updateContextChipLabel();
  await refreshContextPreview();
}

async function streamChatRound(
  messages,
  signal,
  { onThinking, onContent, toolsEnabled = true }
) {
  const thinkingEnabled = elements.thinkingSelect.value === "on";
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: elements.modelSelect.value,
      messages,
      ...(toolsEnabled ? { tools: BrowserChatTools.getSchemas() } : {}),
      stream: true,
      think: thinkingEnabled
    }),
    signal
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.error ? `: ${body.error}` : "";
    } catch {
      // The HTTP status below is enough when Ollama did not return JSON.
    }
    throw new Error(`Ollama returned HTTP ${response.status}${detail}`);
  }

  if (!response.body) {
    throw new Error("Ollama returned an empty response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let fullThinking = "";
  const toolCalls = [];

  const processEvent = (event) => {
    if (event.error) throw new Error(event.error);

    const thinkingChunk = event.message?.thinking || "";
    if (thinkingChunk) {
      fullThinking += thinkingChunk;
      if (thinkingEnabled) {
        onThinking(fullThinking);
      }
    }

    const contentChunk = event.message?.content || "";
    if (contentChunk) {
      fullText += contentChunk;
      onContent(fullText, fullThinking);
    }

    if (event.message?.tool_calls?.length) {
      toolCalls.push(...event.message.tool_calls);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      processEvent(JSON.parse(line));
    }

    if (done) {
      if (buffer.trim()) {
        processEvent(JSON.parse(buffer));
      }
      break;
    }
  }

  return {
    message: {
      role: "assistant",
      content: fullText,
      ...(fullThinking ? { thinking: fullThinking } : {}),
      ...(toolCalls.length ? { tool_calls: toolCalls } : {})
    },
    toolCalls
  };
}

async function runToolCallingLoop(
  messages,
  signal,
  {
    answerNowSignal,
    onThinking,
    onContent,
    onToolCallStart,
    onToolCallFinish
  }
) {
  let combinedThinking = "";
  let displayedContent = "";
  const toolActivities = [];

  const streamFinalAnswer = async () => {
    messages.push({
      role: "system",
      content:
        "The user selected Answer now. Do not call or wait for more tools. Give the best final answer possible using only the conversation and completed tool results available so far."
    });

    const response = await streamChatRound(messages, signal, {
      toolsEnabled: false,
      onThinking: (thinking) => {
        onThinking([combinedThinking, thinking].filter(Boolean).join("\n\n"));
      },
      onContent: (content, thinking) => {
        onContent(
          [displayedContent, content].filter(Boolean).join("\n\n"),
          [combinedThinking, thinking].filter(Boolean).join("\n\n")
        );
      }
    });

    messages.push(response.message);
    combinedThinking = [combinedThinking, response.message.thinking]
      .filter(Boolean)
      .join("\n\n");
    displayedContent = [displayedContent, response.message.content]
      .filter(Boolean)
      .join("\n\n");

    return {
      content: displayedContent,
      thinking: combinedThinking,
      toolActivities
    };
  };

  while (true) {
    if (answerNowSignal?.aborted) {
      return streamFinalAnswer();
    }

    const roundController = new AbortController();
    const cancelRound = () => roundController.abort();
    signal.addEventListener("abort", cancelRound, { once: true });
    answerNowSignal?.addEventListener("abort", cancelRound, { once: true });

    let response;
    try {
      response = await streamChatRound(messages, roundController.signal, {
        onThinking: (thinking) => {
          onThinking([combinedThinking, thinking].filter(Boolean).join("\n\n"));
        },
        onContent: (content, thinking) => {
          onContent(
            [displayedContent, content].filter(Boolean).join("\n\n"),
            [combinedThinking, thinking].filter(Boolean).join("\n\n")
          );
        }
      });
    } catch (error) {
      if (
        error.name === "AbortError" &&
        answerNowSignal?.aborted &&
        !signal.aborted
      ) {
        return streamFinalAnswer();
      }
      throw error;
    } finally {
      signal.removeEventListener("abort", cancelRound);
      answerNowSignal?.removeEventListener("abort", cancelRound);
    }

    messages.push(response.message);
    combinedThinking = [combinedThinking, response.message.thinking]
      .filter(Boolean)
      .join("\n\n");

    if (!response.toolCalls.length) {
      displayedContent = [displayedContent, response.message.content]
        .filter(Boolean)
        .join("\n\n");
      return {
        content: displayedContent,
        thinking: combinedThinking,
        toolActivities
      };
    }

    if (response.message.content) {
      displayedContent = [displayedContent, response.message.content]
        .filter(Boolean)
        .join("\n\n");
    }

    const results = await Promise.all(response.toolCalls.map(async (call) => {
      const activity = {
        id: crypto.randomUUID(),
        name: call?.function?.name || "unknown",
        status: "running",
        arguments: call?.function?.arguments || {}
      };
      activity.unsupported = !BrowserChatTools.hasTool(activity.name);
      toolActivities.push(activity);
      onToolCallStart?.({ ...activity });

      // Let the browser paint the live tool status before a fast local tool resolves.
      await new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          resolve();
        };
        requestAnimationFrame(finish);
        setTimeout(finish, 100);
      });
      signal.throwIfAborted();
      const content = answerNowSignal?.aborted
        ? JSON.stringify({
            ok: false,
            error: "Tool call cancelled because the user selected Answer now."
          })
        : await BrowserChatTools.executeCall(call, {
            signal: answerNowSignal
          });
      let parsedResult = content;
      let status = "completed";
      try {
        parsedResult = JSON.parse(content);
        if (parsedResult?.ok === false) status = "failed";
      } catch {
        // Keep non-JSON tool output readable in the activity details.
      }
      Object.assign(activity, { status, result: parsedResult });
      onToolCallFinish?.({ ...activity });

      return {
        role: "tool",
        tool_name: activity.name,
        content
      };
    }));
    messages.push(...results);
  }
}

function cleanGeneratedTitle(value = "", fallbackText = "") {
  const words = String(value)
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(title|chat title)\s*:\s*/i, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const fallbackWords = String(fallbackText)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  for (const word of [...fallbackWords, "Chat", "Discussion"]) {
    if (words.length >= 4) break;
    if (!words.some((existing) => existing.toLowerCase() === word.toLowerCase())) {
      words.push(word);
    }
  }
  return words.slice(0, 5).join(" ");
}

async function generateTitleForChat(chatId, model) {
  const chat = chats.find((item) => item.id === chatId);
  if (!chat || chat.titleGenerationAttempted || chat.messages.length < 2 || !model) {
    return;
  }

  chat.titleGenerationAttempted = true;
  await persistChats();

  const firstUserMessage = chat.messages.find((message) => message.role === "user");
  if (!firstUserMessage) return;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          {
            role: "system",
            content:
              "Summarize the user's question as a specific 4-5 word chat title. Base the title only on the user's question. Return only the title, with no quotation marks, label, punctuation, or explanation."
          },
          {
            role: "user",
            content: firstUserMessage.content
          }
        ]
      })
    });
    if (!response.ok) return;

    const data = await response.json();
    const title = cleanGeneratedTitle(
      data.message?.content,
      firstUserMessage.content
    );
    if (!title) return;

    chat.title = title;
    chat.updatedAt = Date.now();
    if (chat.id === activeChatId) renderChatHeader();
    renderChatMenu();
    await persistChats();
  } catch {
    // Title generation is a one-time enhancement and should never interrupt chat.
  }
}

async function submitPrompt(prompt) {
  if (!prompt || activeRequest || !elements.modelSelect.value) return;

  const chatId = activeChatId;
  await rememberSentSiteForChat(chatId);
  const selectedModel = elements.modelSelect.value;
  const modelSwitching = Boolean(conversationModel && conversationModel !== selectedModel);
  conversationModel = selectedModel;
  const thinkingEnabled = elements.thinkingSelect.value === "on";
  const includeDomContext = domContextEnabled;
  const requestedSkillId = explicitSkillId;
  const composerAttachmentOrder = getComposerAttachmentOrder();
  const contextAttachment = includeDomContext
    ? { context: null, memorized: true }
    : null;
  setError("");
  setDomContextEnabled(false);
  setExplicitSkill(null);
  setPromptText();
  resizeInput();
  appendMessage("user", prompt, { forceScroll: true });
  const assistantUI = appendAssistantMessage({
    thinkingEnabled,
    modelSwitching
  });

  const controller = new AbortController();
  const answerNowController = new AbortController();
  assistantUI.toolUI.answerNowButton.addEventListener("click", () => {
    if (answerNowController.signal.aborted) return;
    answerNowController.abort();
    assistantUI.toolUI.answerNowButton.disabled = true;
    assistantUI.toolUI.answerNowButton.textContent = "Answering…";
    assistantUI.toolUI.summary.textContent = "Preparing answer…";
    assistantUI.toolUI.panel.classList.add("streaming");
  });
  activeRequest = controller;
  updateSendButton();

  try {
    const page = includeDomContext ? await captureActivePageContext() : null;
    if (contextAttachment && page) {
      rememberDomAttachment(contextAttachment, page);
    }
    const selectedSkills = await selectSkillsForPrompt(
      prompt,
      controller.signal,
      requestedSkillId
    );
    const skillActivities = selectedSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      selectionSource: skill.id === requestedSkillId ? "explicit" : "automatic"
    }));
    assistantUI.showSkills(skillActivities);
    assistantUI.addAttachments({
      order: composerAttachmentOrder,
      contextAttachment,
      skills: selectedSkills,
      requestedSkillId
    });
    const messages = buildOllamaMessages(prompt, page, selectedSkills);
    const answer = await runToolCallingLoop(messages, controller.signal, {
      answerNowSignal: answerNowController.signal,
      onThinking: (thinking) => {
        assistantUI.processingStatus.hidden = true;
        assistantUI.hasThinking = true;
        assistantUI.thinkingPanel.hidden = false;
        if (!assistantUI.answerStarted) {
          assistantUI.thinkingPanel.open = true;
          assistantUI.thinkingPanel.classList.add("streaming");
          assistantUI.thinkingSummary.textContent = "Thinking…";
        } else {
          assistantUI.thinkingPanel.classList.remove("streaming");
          assistantUI.thinkingSummary.textContent = "Thought process";
        }
        assistantUI.thinkingContent.textContent = thinking;
        assistantUI.thinkingContent.scrollTop =
          assistantUI.thinkingContent.scrollHeight;
        scrollToLatest();
      },
      onContent: (text) => {
        assistantUI.processingStatus.hidden = true;
        assistantUI.toolUI.panel.open = false;
        if (!assistantUI.answerStarted) {
          assistantUI.answerStarted = true;
          assistantUI.thinkingPanel.classList.remove("streaming");
          if (assistantUI.hasThinking) {
            assistantUI.thinkingSummary.textContent = "Thought process";
            assistantUI.thinkingPanel.open = false;
          } else {
            assistantUI.thinkingPanel.hidden = true;
          }
        }

        renderMarkdown(assistantUI.message, text);
        assistantUI.message.classList.remove("pending");
        scrollToLatest();
      },
      onToolCallStart: (activity) => {
        assistantUI.processingStatus.hidden = true;
        assistantUI.toolUI.actions.hidden = false;
        assistantUI.toolUI.panel.open = true;
        renderToolActivity(assistantUI.toolUI, activity);
        scrollToLatest();
      },
      onToolCallFinish: (activity) => {
        renderToolActivity(assistantUI.toolUI, activity);
        scrollToLatest();
      }
    });

    assistantUI.toolUI.actions.hidden = true;
    if (assistantUI.toolUI.activities.size) {
      updateToolActivitySummary(assistantUI.toolUI);
    }
    assistantUI.processingStatus.hidden = true;
    assistantUI.thinkingPanel.classList.remove("streaming");
    if (answer.thinking) {
      assistantUI.thinkingSummary.textContent = "Thought process";
    } else {
      assistantUI.thinkingPanel.hidden = true;
    }

    if (!answer.content.trim()) {
      assistantUI.message.textContent = "Ollama returned an empty response.";
    }

    assistantUI.message.classList.remove("pending");
    chatHistory.push(
      { role: "user", content: prompt },
      {
        role: "assistant",
        content: answer.content,
        ...(answer.thinking ? { thinking: answer.thinking } : {}),
        ...(answer.toolActivities?.length
          ? { toolActivities: answer.toolActivities }
          : {}),
        ...(skillActivities.length ? { skillActivities } : {})
      }
    );
    const chat = chats.find((item) => item.id === chatId);
    if (chat) {
      chat.conversationModel = selectedModel;
      chat.updatedAt = Date.now();
      await persistChats();
      renderChatMenu();
      void generateTitleForChat(chatId, selectedModel);
    }
  } catch (error) {
    assistantUI.toolUI.actions.hidden = true;
    if (contextAttachment && !contextAttachment.context) {
      setReplyContextAvailability(contextAttachment, false);
    }
    assistantUI.processingStatus.hidden = true;
    assistantUI.message.classList.remove("pending");
    assistantUI.thinkingPanel.classList.remove("streaming");
    if (error.name === "AbortError") {
      assistantUI.thinkingSummary.textContent = "Thinking stopped";
      assistantUI.thinkingPanel.open = false;
      assistantUI.message.textContent =
        assistantUI.message.textContent.replace(/Thinking…|Reading this page…/, "").trim() ||
        "Response stopped.";
    } else {
      if (!assistantUI.hasThinking) {
        assistantUI.thinkingPanel.hidden = true;
      }
      assistantUI.message.textContent = "I couldn’t complete that request.";
      setError(error.message || "Something went wrong.");
    }
  } finally {
    activeRequest = null;
    updateSendButton();
    elements.input.focus();
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeRequest) {
    activeRequest.abort();
    return;
  }
  submitPrompt(getPromptText().trim());
});

elements.input.addEventListener("input", () => {
  if (domContextEnabled && !elements.input.contains(elements.contextChip)) {
    setDomContextEnabled(false);
  }
  if (explicitSkillId && !elements.input.contains(elements.skillChip)) {
    explicitSkillId = null;
    elements.skillChip.hidden = true;
  }
  saveCaretRange();
  resizeInput();
  renderSkillPicker();
  updateSendButton();
});

elements.input.addEventListener("focus", saveCaretRange);
elements.input.addEventListener("click", saveCaretRange);
elements.input.addEventListener("paste", pastePlainText);
elements.contextChip.addEventListener("pointerenter", openContextChipMenu);
elements.contextChip.addEventListener("pointerleave", scheduleContextChipMenuClose);
elements.contextChip.addEventListener("focusin", openContextChipMenu);
elements.contextChip.addEventListener("focusout", scheduleContextChipMenuClose);
elements.contextChipMenu.addEventListener("pointerenter", openContextChipMenu);
elements.contextChipMenu.addEventListener("pointerleave", scheduleContextChipMenuClose);
elements.contextChipMenu.addEventListener("focusin", openContextChipMenu);
elements.contextChipMenu.addEventListener("focusout", scheduleContextChipMenuClose);
elements.skillChip.addEventListener("pointerenter", openSkillChipMenu);
elements.skillChip.addEventListener("pointerleave", scheduleSkillChipMenuClose);
elements.skillChip.addEventListener("focusin", openSkillChipMenu);
elements.skillChip.addEventListener("focusout", scheduleSkillChipMenuClose);
elements.skillChipMenu.addEventListener("pointerenter", openSkillChipMenu);
elements.skillChipMenu.addEventListener("pointerleave", scheduleSkillChipMenuClose);
elements.skillChipMenu.addEventListener("focusin", openSkillChipMenu);
elements.skillChipMenu.addEventListener("focusout", scheduleSkillChipMenuClose);
elements.input.addEventListener("scroll", () => {
  positionContextChipMenu();
  positionSkillChipMenu();
});
elements.conversation.addEventListener("scroll", updateConversationAutoScroll, {
  passive: true
});
window.addEventListener("resize", () => {
  positionContextChipMenu();
  positionSkillChipMenu();
});
document.addEventListener("selectionchange", () => {
  if (document.activeElement === elements.input) saveCaretRange();
});

elements.input.addEventListener("keydown", (event) => {
  if (!elements.skillPicker.hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      skillPickerActiveIndex =
        (skillPickerActiveIndex + direction + skillPickerMatches.length) %
        Math.max(1, skillPickerMatches.length);
      renderSkillPicker();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && skillPickerMatches.length) {
      event.preventDefault();
      chooseActiveSkill();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSkillPicker();
      return;
    }
  }
  if (
    event.key === "Backspace" &&
    explicitSkillId &&
    isCaretImmediatelyAfterChip(elements.skillChip)
  ) {
    event.preventDefault();
    setExplicitSkill(null);
    return;
  }
  if (
    event.key === "Backspace" &&
    !getPromptText().trim() &&
    domContextEnabled
  ) {
    event.preventDefault();
    setDomContextEnabled(false);
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});

elements.skillPickerList.addEventListener("mousedown", (event) => {
  event.preventDefault();
});
elements.skillPickerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-skill-picker-id]");
  if (button) {
    setExplicitSkill(button.dataset.skillPickerId, { removeSlashQuery: true });
    elements.input.focus();
  }
});
elements.removeSkillButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setExplicitSkill(null);
  elements.input.focus();
});
elements.skillChipPreviewButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const skill = availableSkills.find((item) => item.id === explicitSkillId);
  openSkillPreview(skill);
});
elements.skillChipConfigureButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openSkillsSettings();
});

elements.modelSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({ selectedModel: elements.modelSelect.value });
  updateSendButton();
});

elements.thinkingSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({
    thinkingEnabled: elements.thinkingSelect.value === "on"
  });
});

elements.allowSiteButton.addEventListener("click", requestCurrentSiteAccess);
elements.chatPickerButton.addEventListener("click", (event) => {
  event.stopPropagation();
  renderChatMenu();
  setChatMenu(elements.chatMenu.hidden);
});
elements.chatList.addEventListener("click", (event) => {
  const actionsButton = event.target.closest("[data-chat-actions]");
  if (actionsButton) {
    event.stopPropagation();
    const chatId = actionsButton.dataset.chatActions;
    const shouldOpen = actionsButton.getAttribute("aria-expanded") !== "true";
    closeChatActionMenus(shouldOpen ? chatId : null);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-chat-id]");
  if (deleteButton) {
    event.stopPropagation();
    void deleteChat(deleteButton.dataset.deleteChatId);
    return;
  }

  const button = event.target.closest("[data-chat-id]");
  if (button) void switchToChat(button.dataset.chatId);
});
elements.toolMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setToolMenu(elements.toolMenu.hidden);
});
elements.domToolMoreButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setDomToolMoreMenu(elements.domToolMoreMenu.hidden);
});
elements.globalDomConfigureButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setToolMenu(false);
  openDomConfiguration("global");
});
elements.addDomButton.addEventListener("click", () => {
  setDomContextEnabled(true);
  elements.input.focus();
});
elements.removeContextButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setDomContextEnabled(false);
  elements.input.focus();
});
elements.chipPreviewButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openContextPreview();
});
elements.chipConfigureButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeContextChipMenu();
  openDomConfiguration("chat");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".tool-picker")) setToolMenu(false);
  if (!event.target.closest(".chat-picker")) setChatMenu(false);
  if (!event.target.closest(".chat-menu-row")) closeChatActionMenus();
  if (
    !event.target.closest(".skill-picker-popover") &&
    !event.target.closest("#promptInput")
  ) {
    closeSkillPicker();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.toolMenu.hidden) {
    setToolMenu(false);
    elements.toolMenuButton.focus();
  }
  if (event.key === "Escape" && !elements.chatMenu.hidden) {
    setChatMenu(false);
    elements.chatPickerButton.focus();
  }
  if (event.key === "Escape" && !elements.skillPicker.hidden) {
    closeSkillPicker();
    elements.input.focus();
  }
});
elements.refreshPreviewButton.addEventListener("click", refreshContextPreview);
elements.saveDomLimitButton.addEventListener("click", () => void saveDomConfiguration());
elements.resetDomLimitButton.addEventListener("click", () => {
  void resetChatDomConfiguration();
});
elements.fullPageModeInput.addEventListener("change", () => {
  if (!elements.fullPageModeInput.checked || domConfigurationScope !== "chat") return;
  domConfigurationDraft.mode = "fullPage";
  renderDomConfigurationControls();
  void refreshContextPreview();
});
elements.selectElementModeInput.addEventListener("change", () => {
  if (!elements.selectElementModeInput.checked || domConfigurationScope !== "chat") return;
  domConfigurationDraft.mode = "element";
  renderDomConfigurationControls();
  void refreshContextPreview();
});
elements.selectElementButton.addEventListener("click", async () => {
  if (domConfigurationScope !== "chat" || !domConfigurationDraft) return;
  const configurationChatId = domConfigurationDraft.chatId;
  setError("");
  elements.selectElementButton.disabled = true;
  elements.selectElementButton.textContent = "Select on the page…";
  elements.contextPreviewDialog.close();
  try {
    const selectedElement = await selectElementFromActivePage();
    if (selectedElement && activeChatId === configurationChatId) {
      domConfigurationDraft.mode = "element";
      domConfigurationDraft.selectedElement = selectedElement;
    }
  } catch (error) {
    setError(error.message || "BrowserChat could not start element selection.");
  } finally {
    elements.selectElementButton.disabled = false;
    if (
      !elements.contextPreviewDialog.open &&
      domConfigurationScope === "chat" &&
      activeChatId === configurationChatId
    ) {
      elements.contextPreviewDialog.showModal();
    }
    if (activeChatId !== configurationChatId) return;
    renderDomConfigurationControls();
    void refreshContextPreview();
  }
});
elements.domLimitInput.addEventListener("input", () => {
  if (previewMode !== "configure") return;
  clearTimeout(domLimitRefreshTimer);
  domLimitRefreshTimer = setTimeout(refreshContextPreview, 350);
});
elements.closePreviewButton.addEventListener("click", () => {
  elements.contextPreviewDialog.close();
});
elements.donePreviewButton.addEventListener("click", () => {
  elements.contextPreviewDialog.close();
});
elements.contextPreviewDialog.addEventListener("click", (event) => {
  if (event.target === elements.contextPreviewDialog) {
    elements.contextPreviewDialog.close();
  }
});

elements.newChatButton.addEventListener("click", () => void startNewChat());
elements.settingsButton.addEventListener("click", () => {
  setChatMenu(false);
  void chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
});

for (const suggestion of elements.suggestions) {
  suggestion.addEventListener("click", () => {
    setPromptText(suggestion.textContent);
    resizeInput();
    updateSendButton();
    elements.input.focus();
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => refreshSiteAccess(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    tabId === currentSite.tabId &&
    (changeInfo.url ||
      changeInfo.favIconUrl ||
      changeInfo.title ||
      changeInfo.status === "complete")
  ) {
    refreshSiteAccess(tabId);
  }
});
chrome.permissions.onAdded.addListener(() => refreshSiteAccess());
chrome.permissions.onRemoved.addListener(() => refreshSiteAccess());
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const promptChange = changes[BrowserChatPromptConfig.STORAGE_KEY];
  const settingsChange = changes[BrowserChatPromptConfig.PROMPT_SETTINGS_STORAGE_KEY];
  if (promptChange) {
    userSystemPrompt = BrowserChatPromptConfig.normalizeSystemPrompt(promptChange.newValue);
  }
  if (settingsChange) {
    userPromptSettings = BrowserChatPromptConfig.normalizePromptSettings(settingsChange.newValue);
  }
  if (
    changes[BrowserChatSkills.STORAGE_KEY] ||
    changes[BrowserChatSkills.ENABLED_STORAGE_KEY]
  ) {
    void loadSkills();
  }
});

async function initializeApp() {
  await Promise.all([initializeChats(), loadSystemPrompt(), loadSkills()]);
  await Promise.all([loadModels(), refreshSiteAccess()]);
  elements.input.focus();
}

void initializeApp();
