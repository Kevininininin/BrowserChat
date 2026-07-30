chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

const MAX_WEBPAGE_BYTES = 5 * 1024 * 1024;
const WEBPAGE_FETCH_TIMEOUT_MS = 15_000;
const SKILL_RECORDING_STORAGE_KEY = "browserChatSkillRecording";
const MAX_SKILL_RECORDING_EVENTS = 500;
let skillRecordingWriteQueue = Promise.resolve();

function queueSkillRecordingUpdate(update) {
  skillRecordingWriteQueue = skillRecordingWriteQueue
    .catch(() => {})
    .then(async () => {
      const stored = await chrome.storage.local.get(SKILL_RECORDING_STORAGE_KEY);
      const current = stored[SKILL_RECORDING_STORAGE_KEY];
      if (!current) return null;
      const next = await update(current);
      if (next) {
        await chrome.storage.local.set({ [SKILL_RECORDING_STORAGE_KEY]: next });
      }
      return next;
    });
  return skillRecordingWriteQueue;
}

function sanitizeRecordedUrl(value = "") {
  try {
    const url = new URL(String(value || ""));
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function sanitizeRecordedEvent(value = {}) {
  const target = value.target && typeof value.target === "object"
    ? {
        tag: String(value.target.tag || "").slice(0, 40),
        role: String(value.target.role || "").slice(0, 80),
        name: String(value.target.name || "").slice(0, 240),
        selector: String(value.target.selector || "").slice(0, 500),
        type: String(value.target.type || "").slice(0, 80),
        href: sanitizeRecordedUrl(value.target.href).slice(0, 1000),
        checked:
          typeof value.target.checked === "boolean"
            ? value.target.checked
            : undefined
      }
    : null;
  return {
    id: crypto.randomUUID(),
    kind: ["click", "change", "submit", "navigation", "keypress"].includes(value.kind)
      ? value.kind
      : "action",
    timestamp: Date.now(),
    pageUrl: sanitizeRecordedUrl(value.pageUrl).slice(0, 2000),
    pageTitle: String(value.pageTitle || "").slice(0, 300),
    hostname: String(value.hostname || "").slice(0, 300),
    target
  };
}

async function injectSkillRecorder(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["skill-recorder-content.js"]
    });
  } catch {
    // Restricted Chrome pages and sites without granted access are reflected
    // in the side panel by the absence of captured actions.
  }
}

async function stopInjectedSkillRecorder(tabId) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "browserchat.skillRecorder.stop" });
  } catch {
    // The page may have navigated or closed after the recording ended.
  }
}

async function finalizeAbandonedSkillRecording(reason, tabId = null) {
  const recording = await queueSkillRecordingUpdate(async (current) => {
    if (
      current.status !== "recording" ||
      (Number.isInteger(tabId) && current.tabId !== tabId)
    ) {
      return null;
    }
    return {
      ...current,
      status: "review",
      endedAt: Date.now(),
      endReason: reason
    };
  });
  if (!recording) return;
  await stopInjectedSkillRecorder(recording.tabId);
  if (recording.temporaryAllUrls) {
    await chrome.permissions.remove({ origins: ["<all_urls>"] }).catch(() => {});
    await chrome.storage.local.set({
      [SKILL_RECORDING_STORAGE_KEY]: {
        ...recording,
        temporaryAllUrls: false
      }
    });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "browserchat.skillRecorder.panel") return;
  port.onDisconnect.addListener(() => {
    void finalizeAbandonedSkillRecording("panel_closed");
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void queueSkillRecordingUpdate(async (recording) => {
    if (recording.status !== "recording" || recording.tabId !== tabId) return null;
    const events = [...(recording.events || [])];
    if (changeInfo.url) {
      events.push(sanitizeRecordedEvent({
        kind: "navigation",
        pageUrl: changeInfo.url,
        pageTitle: tab.title || "",
        hostname: (() => {
          try { return new URL(changeInfo.url).hostname; } catch { return ""; }
        })()
      }));
    }
    if (changeInfo.status === "complete") void injectSkillRecorder(tabId);
    return {
      ...recording,
      pageUrl: sanitizeRecordedUrl(tab.url) || recording.pageUrl || "",
      pageTitle: tab.title || recording.pageTitle || "",
      events: events.slice(-MAX_SKILL_RECORDING_EVENTS)
    };
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void finalizeAbandonedSkillRecording("tab_closed", tabId);
});

function validateWebpageUrl(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Webpage URLs must use HTTP or HTTPS.");
  }
  return url.href;
}

async function readLimitedText(response, maximumBytes, signal) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) {
    throw new Error("The webpage is larger than BrowserChat's 5 MB fetch limit.");
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    signal.throwIfAborted();
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error("The webpage is larger than BrowserChat's 5 MB fetch limit.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const charset = response.headers.get("content-type")
    ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || "utf-8";
  let decoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(bytes);
}

async function fetchWebpage(url) {
  const requestedUrl = validateWebpageUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBPAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(requestedUrl, {
      method: "GET",
      redirect: "follow",
      credentials: "omit",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.8"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`The webpage returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (
      contentType &&
      !/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/i.test(contentType)
    ) {
      throw new Error(
        `BrowserChat expected a webpage but received ${contentType.split(";", 1)[0]}.`
      );
    }
    return {
      requestedUrl,
      finalUrl: validateWebpageUrl(response.url || requestedUrl),
      contentType,
      html: await readLimitedText(response, MAX_WEBPAGE_BYTES, controller.signal)
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The webpage fetch timed out after 15 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "browserchat.fetchWebpage") {
    fetchWebpage(message.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({
        ok: false,
        error: error?.message || "BrowserChat could not fetch the webpage."
      }));
    return true;
  }

  if (message?.type === "browserchat.skillRecorder.start") {
    const tabId = Number(message.tabId);
    const recording = {
      status: "recording",
      tabId,
      windowId: Number(message.windowId),
      startedAt: Date.now(),
      pageUrl: sanitizeRecordedUrl(message.pageUrl),
      pageTitle: String(message.pageTitle || ""),
      suggestedTitle: String(message.suggestedTitle || "").trim().slice(0, 120),
      suggestedDescription: String(message.suggestedDescription || "").trim().slice(0, 600),
      temporaryAllUrls: message.temporaryAllUrls === true,
      events: [
        sanitizeRecordedEvent({
          kind: "navigation",
          pageUrl: message.pageUrl,
          pageTitle: message.pageTitle,
          hostname: (() => {
            try { return new URL(message.pageUrl).hostname; } catch { return ""; }
          })()
        })
      ]
    };
    chrome.storage.local.set({ [SKILL_RECORDING_STORAGE_KEY]: recording })
      .then(() => injectSkillRecorder(tabId))
      .then(() => sendResponse({ ok: true, recording }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Could not start recording." }));
    return true;
  }

  if (message?.type === "browserchat.skillRecorder.event") {
    const tabId = sender.tab?.id;
    queueSkillRecordingUpdate(async (recording) => {
      if (recording.status !== "recording" || recording.tabId !== tabId) return null;
      const event = sanitizeRecordedEvent(message.event);
      const previous = recording.events?.at(-1);
      const duplicate =
        previous &&
        event.kind === "navigation" &&
        previous.kind === "navigation" &&
        previous.pageUrl === event.pageUrl &&
        event.timestamp - previous.timestamp < 1500;
      const events = duplicate
        ? recording.events
        : [...(recording.events || []), event].slice(-MAX_SKILL_RECORDING_EVENTS);
      return {
        ...recording,
        pageUrl: event.pageUrl || recording.pageUrl,
        pageTitle: event.pageTitle || recording.pageTitle,
        events
      };
    })
      .then((recording) => sendResponse({ ok: true, recording }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Could not save action." }));
    return true;
  }

  if (message?.type === "browserchat.skillRecorder.stop") {
    let stoppedTabId = null;
    queueSkillRecordingUpdate(async (recording) => {
      stoppedTabId = recording.tabId;
      return {
        ...recording,
        status: "review",
        endedAt: Date.now(),
        endReason: "user_stopped"
      };
    })
      .then(async (recording) => {
        await stopInjectedSkillRecorder(stoppedTabId);
        sendResponse({ ok: true, recording });
      })
      .catch((error) => sendResponse({ ok: false, error: error?.message || "Could not stop recording." }));
    return true;
  }

  return false;
});
