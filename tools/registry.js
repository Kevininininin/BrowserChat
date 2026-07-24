(() => {
  const registry = new Map();
  const initializers = [];
  let initialized = false;

  function registerTool({ schema, execute }) {
    const name = schema?.function?.name;
    if (!name || typeof execute !== "function") {
      throw new TypeError("A tool needs a function schema and an execute function.");
    }
    if (registry.has(name)) {
      throw new Error(`A tool named "${name}" is already registered.`);
    }

    registry.set(name, { schema, execute });
  }

  function define(initializer) {
    if (initialized) {
      throw new Error("Tool modules must be defined before tools/index.js loads.");
    }
    if (typeof initializer !== "function") {
      throw new TypeError("A tool module initializer must be a function.");
    }
    initializers.push(initializer);
  }

  function initialize() {
    if (initialized) return;
    for (const initializer of initializers) {
      initializer(registerTool);
    }
    initialized = true;
  }

  function getSchemas() {
    return [...registry.values()].map(({ schema }) => schema);
  }

  function hasTool(name) {
    return registry.has(name);
  }

  async function executeCall(call, context = {}) {
    const name = call?.function?.name;
    const tool = registry.get(name);
    if (!tool) {
      return JSON.stringify({
        ok: false,
        error: `Unknown tool: ${name || "missing name"}`
      });
    }

    try {
      const result = await tool.execute(call.function.arguments || {}, context);
      return JSON.stringify({ ok: true, result });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  globalThis.BrowserChatTools = Object.freeze({
    define,
    initialize,
    register: registerTool,
    getSchemas,
    hasTool,
    executeCall
  });
})();
