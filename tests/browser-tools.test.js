const test = require("node:test");
const assert = require("node:assert/strict");

test("registers generic direct-navigation and completion tools", async () => {
  const registrations = [];
  global.BrowserChatTools = {
    define(initializer) {
      initializer((registration) => registrations.push(registration));
    }
  };
  global.BrowserChatAgentRuntime = {
    navigateToUrl(arguments_) {
      return { navigated: true, url: arguments_.url };
    },
    completeTask(arguments_) {
      return { completed: true, answer: arguments_.answer };
    }
  };

  const modulePath = require.resolve("../tools/browser.js");
  delete require.cache[modulePath];
  require(modulePath);

  const byName = new Map(
    registrations.map((registration) => [
      registration.schema.function.name,
      registration
    ])
  );
  assert.equal(byName.has("navigate_to_url"), true);
  assert.equal(byName.has("complete_task"), true);
  assert.deepEqual(
    byName.get("click_element").schema.function.parameters.required,
    ["elementRef", "expectedState"]
  );
  assert.deepEqual(
    byName.get("find_and_click").schema.function.parameters.required,
    ["query", "expectedState"]
  );
  assert.deepEqual(
    await byName.get("navigate_to_url").execute(
      { url: "https://example.com" },
      { approvedConsequentialAction: true }
    ),
    { navigated: true, url: "https://example.com" }
  );
  assert.deepEqual(
    await byName.get("complete_task").execute(
      { answer: "Done", evidence: [{ kind: "current_url", value: "https://example.com" }] },
      {}
    ),
    { completed: true, answer: "Done" }
  );

  delete global.BrowserChatTools;
  delete global.BrowserChatAgentRuntime;
});
