(() => {
  const STORAGE_KEY = "browserChatSkills";
  const ENABLED_STORAGE_KEY = "browserChatSkillsEnabled";
  const defaults = [];
  const previewStorageValues = {};
  const previewStorage = {
    async get(keys) {
      return Object.fromEntries(
        keys
          .filter((key) => Object.prototype.hasOwnProperty.call(previewStorageValues, key))
          .map((key) => [key, previewStorageValues[key]])
      );
    },
    async set(values) {
      Object.assign(previewStorageValues, values);
    }
  };

  function resolveStorage(storage) {
    return storage || globalThis.chrome?.storage?.local || previewStorage;
  }

  function createId(name = "skill") {
    const slug = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "skill";
    return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
  }

  function normalizeSkill(value = {}) {
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const description =
      typeof value.description === "string" ? value.description.trim() : "";
    const instructions =
      typeof value.instructions === "string" ? value.instructions.trim() : "";
    return {
      id:
        typeof value.id === "string" && value.id.trim()
          ? value.id.trim()
          : createId(name),
      name: name || "Untitled skill",
      description,
      instructions,
      createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
      updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now()
    };
  }

  function registerDefault(skill) {
    const normalized = normalizeSkill(skill);
    if (defaults.some((item) => item.id === normalized.id)) {
      throw new Error(`A default skill named "${normalized.id}" is already registered.`);
    }
    defaults.push(normalized);
  }

  async function load(storage = null) {
    storage = resolveStorage(storage);
    const stored = await storage.get([STORAGE_KEY, ENABLED_STORAGE_KEY]);
    const hasStoredSkills = Object.prototype.hasOwnProperty.call(stored, STORAGE_KEY);
    const skills = hasStoredSkills && Array.isArray(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY].map(normalizeSkill)
      : defaults.map((skill) => ({ ...skill }));
    const enabled = stored[ENABLED_STORAGE_KEY] !== false;

    if (!hasStoredSkills) {
      await storage.set({ [STORAGE_KEY]: skills });
    }
    if (!Object.prototype.hasOwnProperty.call(stored, ENABLED_STORAGE_KEY)) {
      await storage.set({ [ENABLED_STORAGE_KEY]: true });
    }

    return { enabled, skills };
  }

  async function saveSkills(skills, storage = null) {
    storage = resolveStorage(storage);
    const normalized = Array.isArray(skills) ? skills.map(normalizeSkill) : [];
    await storage.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  async function setEnabled(enabled, storage = null) {
    storage = resolveStorage(storage);
    const normalized = Boolean(enabled);
    await storage.set({ [ENABLED_STORAGE_KEY]: normalized });
    return normalized;
  }

  function buildSelectionMessages(prompt, skills) {
    const catalog = skills.map(({ id, name, description }) => ({
      id,
      name,
      description
    }));
    return [
      {
        role: "system",
        content:
          "Choose which skills, if any, would materially improve the response to the user's request. Select only from the supplied catalog. Return JSON only in the form {\"skillIds\":[\"id\"]}. Return an empty array when no skill applies."
      },
      {
        role: "user",
        content: JSON.stringify({ prompt, skills: catalog })
      }
    ];
  }

  function parseSelection(value, skills) {
    const allowed = new Set(skills.map((skill) => skill.id));
    let parsed;
    try {
      const cleaned = String(value || "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      return [];
    }
    const ids = Array.isArray(parsed?.skillIds) ? parsed.skillIds : [];
    return [...new Set(ids)].filter((id) => allowed.has(id));
  }

  function composeSystemPrompt(basePrompt, selectedSkills) {
    const blocks = selectedSkills
      .filter((skill) => skill?.instructions)
      .map(
        (skill) =>
          `<skill name="${skill.name}">\n${skill.instructions.trim()}\n</skill>`
      );
    return [basePrompt, ...blocks].filter(Boolean).join("\n\n");
  }

  globalThis.BrowserChatSkills = Object.freeze({
    STORAGE_KEY,
    ENABLED_STORAGE_KEY,
    registerDefault,
    normalizeSkill,
    createId,
    load,
    saveSkills,
    setEnabled,
    buildSelectionMessages,
    parseSelection,
    composeSystemPrompt
  });
})();
