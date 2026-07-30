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
