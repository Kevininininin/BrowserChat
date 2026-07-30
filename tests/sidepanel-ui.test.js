const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

test("the empty state leaves layout after the first message", () => {
  const css = fs.readFileSync(path.join(projectRoot, "sidepanel.css"), "utf8");

  assert.match(
    css,
    /\.empty-state\[hidden\]\s*\{[^}]*display:\s*none\s*;/s
  );
});

test("uncaught submission startup errors are shown to the user", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );

  assert.match(
    source,
    /submitPrompt\(getPromptText\(\)\.trim\(\)\)\.catch\(\(error\) =>/
  );
  assert.match(source, /Could not start the response:/);
});

test("activity timestamps normalize numeric dataset strings without throwing", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );

  assert.match(source, /typeof timestamp === "string"/);
  assert.match(source, /\^\\d\+\(\?:\\\.\\d\+\)\?\$\//);
  assert.match(source, /const date = parseActivityTimestamp\(timestamp\)/);
  assert.match(source, /if \(!date\) \{\s*time\?\.remove\(\);\s*return;/s);
});

test("approval requests appear in chat and do not compete with Answer now", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );
  const css = fs.readFileSync(path.join(projectRoot, "sidepanel.css"), "utf8");

  assert.match(source, /chatApprovalPanel\.classList\.add\("chat-approval-panel"\)/);
  assert.match(source, /contentWrap\.append\(chatApprovalPanel\)/);
  assert.match(source, /toolUI\.answerNowButton\.hidden = true/);
  assert.match(source, /toolUI\.answerNowButton\.hidden = false/);
  assert.match(css, /\.chat-approval-panel\s*\{/);
});

test("direct navigation hands control to the new tab and waits for it to load", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );

  assert.match(
    source,
    /allowBrowserControlTab\(openedTab\);\s*const settledTab = await waitForReadableBrowserTab/
  );
  assert.match(source, /chrome\.tabs\.onUpdated\.addListener\(onUpdated\)/);
  assert.match(source, /tab\.status !== "complete"/);
  assert.match(source, /\["http:", "https:"\]\.includes/);
});

test("clicks wait for a stable, unobscured target at the displayed cursor position", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );

  assert.match(source, /const waitForStableRect = async \(\) =>/);
  assert.match(source, /Math\.hypot\(/);
  assert.match(source, /document\.elementFromPoint\(targetPoint\.x, targetPoint\.y\)/);
  assert.match(source, /Another element covered the click target before dispatch/);
});

test("orchestrated browser runs bootstrap with screenshots before DOM fallback", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "sidepanel.js"),
    "utf8"
  );

  const screenshotAttempt = source.indexOf(
    "initialScreenshotResult = await takeScreenshotForAgent"
  );
  const domFallback = source.indexOf(
    'function: { name: "observe_page", arguments: {} }',
    screenshotAttempt
  );
  assert.ok(screenshotAttempt >= 0);
  assert.ok(domFallback > screenshotAttempt);
  assert.match(source, /initial_browser_observation_fallback/);
});
