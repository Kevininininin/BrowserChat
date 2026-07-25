(() => {
  const STORAGE_KEY = "browserChatSkills";
  const ENABLED_STORAGE_KEY = "browserChatSkillsEnabled";
  const DISABLED_SKILL_IDS_STORAGE_KEY = "browserChatDisabledSkillIds";
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
      source: value.source === "packaged" ? "packaged" : "local",
      sourcePath:
        typeof value.sourcePath === "string" ? value.sourcePath : "",
      overridesPackaged: Boolean(value.overridesPackaged),
      createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
      updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
      enabled: value.enabled !== false
    };
  }

  function parseMetadataValue(value = "") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      try {
        return trimmed.startsWith('"')
          ? JSON.parse(trimmed)
          : trimmed.slice(1, -1).replaceAll("\\'", "'");
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  function parseMarkdown(markdown, { source = "local", sourcePath = "" } = {}) {
    const text = String(markdown || "").replace(/\r\n?/g, "\n").trim();
    if (!text) throw new Error("The skill Markdown file is empty.");

    const frontmatter = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
    if (frontmatter) {
      const metadata = {};
      for (const line of frontmatter[1].split("\n")) {
        const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
        if (match) metadata[match[1]] = parseMetadataValue(match[2]);
      }
      if (!metadata.name || !metadata.description || !frontmatter[2].trim()) {
        throw new Error(
          "Skill Markdown frontmatter requires name and description, followed by instructions."
        );
      }
      return normalizeSkill({
        id: metadata.id || createId(metadata.name),
        name: metadata.name,
        description: metadata.description,
        instructions: frontmatter[2].trim(),
        source,
        sourcePath
      });
    }

    const name = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const description = text.match(
      /^##\s+Description\s*\n+([\s\S]*?)(?=\n+##\s+Instructions\b)/mi
    )?.[1]?.trim();
    const instructions = text.match(
      /^##\s+Instructions\s*\n+([\s\S]*)$/mi
    )?.[1]?.trim();
    if (!name || !description || !instructions) {
      throw new Error(
        "Use YAML frontmatter or the headings # Name, ## Description, and ## Instructions."
      );
    }
    return normalizeSkill({
      id: createId(name),
      name,
      description,
      instructions,
      source,
      sourcePath
    });
  }

  function toMarkdown(skill) {
    const normalized = normalizeSkill(skill);
    return [
      "---",
      `id: ${normalized.id}`,
      `name: ${JSON.stringify(normalized.name)}`,
      `description: ${JSON.stringify(normalized.description)}`,
      "---",
      "",
      normalized.instructions,
      ""
    ].join("\n");
  }

  async function loadPackagedSkills() {
    if (!globalThis.chrome?.runtime?.getURL || typeof fetch !== "function") {
      return defaults.map((skill) => ({ ...skill, source: "packaged" }));
    }
    try {
      const manifestResponse = await fetch(
        chrome.runtime.getURL("skills/manifest.json")
      );
      if (!manifestResponse.ok) throw new Error("Skill manifest is unavailable.");
      const manifest = await manifestResponse.json();
      const paths = Array.isArray(manifest.skills) ? manifest.skills : [];
      const packaged = await Promise.all(paths.map(async (sourcePath) => {
        const response = await fetch(chrome.runtime.getURL(sourcePath));
        if (!response.ok) throw new Error(`Could not load ${sourcePath}.`);
        return parseMarkdown(await response.text(), {
          source: "packaged",
          sourcePath
        });
      }));
      return [
        ...defaults.map((skill) => ({ ...skill, source: "packaged" })),
        ...packaged
      ];
    } catch (error) {
      console.warn("Packaged skills could not be loaded.", error);
      return defaults.map((skill) => ({ ...skill, source: "packaged" }));
    }
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
    const [stored, packagedSkills] = await Promise.all([
      storage.get([
        STORAGE_KEY,
        ENABLED_STORAGE_KEY,
        DISABLED_SKILL_IDS_STORAGE_KEY
      ]),
      loadPackagedSkills()
    ]);
    const hasStoredSkills = Object.prototype.hasOwnProperty.call(stored, STORAGE_KEY);
    const localSkills = hasStoredSkills && Array.isArray(stored[STORAGE_KEY])
      ? stored[STORAGE_KEY].map((skill) =>
          normalizeSkill({ ...skill, source: "local" })
        )
      : [];
    const localById = new Map(localSkills.map((skill) => [skill.id, skill]));
    const packagedNames = new Set(
      packagedSkills.map((skill) => skill.name.toLocaleLowerCase())
    );
    const disabledSkillIds = new Set(
      Array.isArray(stored[DISABLED_SKILL_IDS_STORAGE_KEY])
        ? stored[DISABLED_SKILL_IDS_STORAGE_KEY].filter((id) => typeof id === "string")
        : []
    );
    const skills = [
      ...packagedSkills.map((skill) => {
        const override = localById.get(skill.id);
        return override
          ? {
              ...override,
              sourcePath: skill.sourcePath,
              overridesPackaged: true
            }
          : skill;
      }),
      ...localSkills.filter(
        (skill) =>
          !packagedSkills.some((packaged) => packaged.id === skill.id) &&
          !packagedNames.has(skill.name.toLocaleLowerCase())
      )
    ].map((skill) => ({
      ...skill,
      enabled: !disabledSkillIds.has(skill.id)
    }));
    const enabled = stored[ENABLED_STORAGE_KEY] !== false;

    if (!hasStoredSkills) {
      await storage.set({ [STORAGE_KEY]: [] });
    }
    if (!Object.prototype.hasOwnProperty.call(stored, ENABLED_STORAGE_KEY)) {
      await storage.set({ [ENABLED_STORAGE_KEY]: true });
    }

    return { enabled, skills };
  }

  async function saveSkills(skills, storage = null) {
    storage = resolveStorage(storage);
    const normalized = Array.isArray(skills)
      ? skills.map(normalizeSkill)
      : [];
    await storage.set({
      [STORAGE_KEY]: normalized.filter((skill) => skill.source !== "packaged")
    });
    return normalized;
  }

  async function setEnabled(enabled, storage = null) {
    storage = resolveStorage(storage);
    const normalized = Boolean(enabled);
    await storage.set({ [ENABLED_STORAGE_KEY]: normalized });
    return normalized;
  }

  async function setSkillEnabled(skillId, enabled, storage = null) {
    storage = resolveStorage(storage);
    const id = String(skillId || "").trim();
    if (!id) throw new Error("A skill id is required.");
    const stored = await storage.get([DISABLED_SKILL_IDS_STORAGE_KEY]);
    const disabled = new Set(
      Array.isArray(stored[DISABLED_SKILL_IDS_STORAGE_KEY])
        ? stored[DISABLED_SKILL_IDS_STORAGE_KEY]
        : []
    );
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    await storage.set({
      [DISABLED_SKILL_IDS_STORAGE_KEY]: [...disabled]
    });
    return Boolean(enabled);
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
    DISABLED_SKILL_IDS_STORAGE_KEY,
    registerDefault,
    normalizeSkill,
    parseMarkdown,
    toMarkdown,
    createId,
    load,
    saveSkills,
    setEnabled,
    setSkillEnabled,
    buildSelectionMessages,
    parseSelection,
    composeSystemPrompt
  });
})();
