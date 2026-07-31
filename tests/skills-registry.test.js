const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const registrySource = fs.readFileSync(
  path.join(projectRoot, "skills/registry.js"),
  "utf8"
);

function createStorage() {
  const values = {};
  return {
    async get(keys) {
      return Object.fromEntries(
        keys.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]])
      );
    },
    async set(next) {
      Object.assign(values, next);
    }
  };
}

test("a missing packaged skill does not hide the remaining defaults", async () => {
  const markdown = fs.readFileSync(
    path.join(projectRoot, "skills/defaults/mermaid.md"),
    "utf8"
  );
  const warnings = [];
  const responses = new Map([
    ["skills/manifest.json", {
      ok: true,
      json: async () => ({
        skills: [
          "skills/defaults/mermaid.md",
          "skills/defaults/deleted.md"
        ]
      })
    }],
    ["skills/defaults/mermaid.md", {
      ok: true,
      text: async () => markdown
    }],
    ["skills/defaults/deleted.md", { ok: false }]
  ]);
  const context = {
    chrome: { runtime: { getURL: (sourcePath) => sourcePath } },
    console: { warn: (...args) => warnings.push(args) },
    crypto: webcrypto,
    fetch: async (sourcePath) => responses.get(sourcePath)
  };
  vm.createContext(context);
  vm.runInContext(registrySource, context);

  const state = await context.BrowserChatSkills.load(createStorage());

  assert.deepEqual(
    Array.from(state.skills, (skill) => skill.id),
    ["mermaid"]
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /deleted\.md/);
});
