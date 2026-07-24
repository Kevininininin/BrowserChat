globalThis.BrowserChatSiteAccess = (() => {
  const STORAGE_KEY = "browserChatApprovedSites";

  function normalizeSite(site) {
    if (!site || typeof site.originPattern !== "string" || !site.originPattern) {
      return null;
    }
    return {
      originPattern: site.originPattern,
      hostname: typeof site.hostname === "string" ? site.hostname : "",
      pageUrl: typeof site.pageUrl === "string" ? site.pageUrl : "",
      faviconUrl: typeof site.faviconUrl === "string" ? site.faviconUrl : "",
      approvedAt: Number.isFinite(site.approvedAt) ? site.approvedAt : Date.now(),
      updatedAt: Number.isFinite(site.updatedAt) ? site.updatedAt : Date.now()
    };
  }

  async function list() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return (Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [])
      .map(normalizeSite)
      .filter(Boolean);
  }

  async function save(sites) {
    const unique = new Map();
    for (const value of sites) {
      const site = normalizeSite(value);
      if (site) unique.set(site.originPattern, site);
    }
    const normalized = [...unique.values()].sort((left, right) =>
      left.originPattern.localeCompare(right.originPattern)
    );
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  async function approve(site) {
    const normalized = normalizeSite(site);
    if (!normalized || normalized.originPattern === "<all_urls>") return list();
    const sites = await list();
    const existing = sites.find(
      (item) => item.originPattern === normalized.originPattern
    );
    return save([
      ...sites.filter((item) => item.originPattern !== normalized.originPattern),
      {
        ...existing,
        ...normalized,
        approvedAt: existing?.approvedAt || normalized.approvedAt,
        faviconUrl: normalized.faviconUrl || existing?.faviconUrl || ""
      }
    ]);
  }

  async function revoke(originPattern) {
    return save(
      (await list()).filter((site) => site.originPattern !== originPattern)
    );
  }

  return { STORAGE_KEY, list, save, approve, revoke };
})();
