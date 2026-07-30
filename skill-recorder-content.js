(() => {
  if (globalThis.__browserChatSkillRecorder?.active) return;

  const sensitiveTypes = new Set([
    "password",
    "email",
    "tel",
    "number",
    "date",
    "datetime-local",
    "month",
    "week",
    "time"
  ]);
  const listeners = [];
  let lastInputTarget = null;

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function cleanText(value, limit = 220) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function cssEscape(value) {
    return globalThis.CSS?.escape
      ? CSS.escape(value)
      : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function stableSelector(element) {
    if (!(element instanceof Element)) return "";
    if (element.id) return `#${cssEscape(element.id)}`;
    for (const attribute of ["data-testid", "data-test", "data-qa", "name"]) {
      const value = element.getAttribute(attribute);
      if (value) return `${element.localName}[${attribute}="${cssEscape(value)}"]`;
    }
    const parts = [];
    let current = element;
    while (current && current !== document.body && parts.length < 5) {
      let part = current.localName;
      const parent = current.parentElement;
      if (!part || !parent) break;
      const siblings = [...parent.children].filter((node) => node.localName === current.localName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      parts.unshift(part);
      current = parent;
    }
    return parts.join(" > ");
  }

  function accessibleName(element) {
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
      : "";
    const wrappingLabel = element.closest("label")?.textContent || "";
    const explicitLabel = element.id
      ? document.querySelector(`label[for="${cssEscape(element.id)}"]`)?.textContent || ""
      : "";
    return cleanText(
      element.getAttribute("aria-label") ||
      labelledText ||
      explicitLabel ||
      wrappingLabel ||
      element.getAttribute("alt") ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder") ||
      element.innerText ||
      element.textContent ||
      element.getAttribute("name") ||
      element.localName
    );
  }

  function describeTarget(rawTarget) {
    const element = rawTarget instanceof Element
      ? rawTarget.closest("a,button,input,select,textarea,[role],[contenteditable],label") || rawTarget
      : null;
    if (!element) return null;
    const type = cleanText(element.getAttribute("type")).toLowerCase();
    const editableText = element.isContentEditable;
    const sensitive =
      editableText ||
      sensitiveTypes.has(type) ||
      /pass(word)?|secret|token|otp|one.?time|card|cvv|cvc|ssn|social.?security/i.test(
        `${element.getAttribute("name") || ""} ${element.id || ""} ${element.getAttribute("autocomplete") || ""}`
      );
    return {
      tag: element.localName,
      role: cleanText(element.getAttribute("role")),
      name: sensitive
        ? cleanText(
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.getAttribute("role") ||
            `[private ${type || "field"}]`
          )
        : accessibleName(element),
      selector: stableSelector(element),
      type: type || cleanText(element.getAttribute("aria-role")),
      href: element.closest("a[href]") ? safeUrl(element.closest("a[href]").href) : "",
      ...(element.matches('input[type="checkbox"],input[type="radio"]')
        ? { checked: element.checked }
        : {})
    };
  }

  function emit(kind, target = null) {
    void chrome.runtime.sendMessage({
      type: "browserchat.skillRecorder.event",
      event: {
        kind,
        pageUrl: safeUrl(location.href),
        pageTitle: cleanText(document.title, 300),
        hostname: location.hostname,
        target: target ? describeTarget(target) : null
      }
    }).catch(() => {});
  }

  function onClick(event) {
    emit("click", event.target);
  }

  function onInput(event) {
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target?.isContentEditable) {
      lastInputTarget = event.target;
    }
  }

  function onChange(event) {
    emit("change", event.target);
    if (lastInputTarget === event.target) lastInputTarget = null;
  }

  function onFocusOut(event) {
    if (event.target === lastInputTarget) {
      emit("change", event.target);
      lastInputTarget = null;
    }
  }

  function onSubmit(event) {
    emit("submit", event.submitter || event.target);
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.isComposing) emit("keypress", event.target);
  }

  function onNavigation() {
    emit("navigation");
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    queueMicrotask(onNavigation);
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    queueMicrotask(onNavigation);
    return result;
  };

  listen(document, "click", onClick, true);
  listen(document, "input", onInput, true);
  listen(document, "change", onChange, true);
  listen(document, "focusout", onFocusOut, true);
  listen(document, "submit", onSubmit, true);
  listen(document, "keydown", onKeyDown, true);
  listen(globalThis, "popstate", onNavigation);
  listen(globalThis, "hashchange", onNavigation);

  function stop() {
    for (const remove of listeners.splice(0)) remove();
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    globalThis.__browserChatSkillRecorder.active = false;
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "browserchat.skillRecorder.stop") stop();
  });

  globalThis.__browserChatSkillRecorder = { active: true, stop };
})();
