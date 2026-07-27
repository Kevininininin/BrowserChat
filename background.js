chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

const MAX_WEBPAGE_BYTES = 5 * 1024 * 1024;
const WEBPAGE_FETCH_TIMEOUT_MS = 15_000;

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "browserchat.fetchWebpage") return false;
  fetchWebpage(message.url)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error?.message || "BrowserChat could not fetch the webpage."
    }));
  return true;
});
