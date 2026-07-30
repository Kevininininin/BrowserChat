const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

test("skills settings offers recorded creation and preserves manual authoring", () => {
  const html = read("settings.html");
  const source = read("settings.js");

  assert.match(html, /id="createSkillButton"[\s\S]*Create skill/);
  assert.match(html, /id="writeSkillButton"[\s\S]*Write manually/);
  assert.match(html, /Teach BrowserChat a workflow/);
  assert.match(source, /browserChatSkillRecording/);
  assert.match(source, /chrome\.sidePanel\.open/);
});

test("side panel includes ready, recording, compilation, and success stages", () => {
  const html = read("sidepanel.html");

  for (const id of [
    "recordSkillReady",
    "recordSkillRecording",
    "recordSkillReview",
    "recordSkillCompiling",
    "recordSkillDone"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="recordSkillModelSelect"/);
  assert.match(html, /id="recordSkillThinkingSelect"/);
  assert.match(html, /id="recordSkillDraftEditor"[\s\S]*readonly/);
  assert.match(html, /id="saveRecordedSkillButton"/);
  assert.match(html, /id="recordSkillEventList"[\s\S]*aria-live="polite"/);
});

test("recorder excludes typed values and strips sensitive URL parts", () => {
  const contentSource = read("skill-recorder-content.js");
  const backgroundSource = read("background.js");

  assert.doesNotMatch(contentSource, /\.value\b/);
  assert.match(contentSource, /sensitiveTypes/);
  assert.match(contentSource, /element\.isContentEditable/);
  assert.match(backgroundSource, /url\.username = ""/);
  assert.match(backgroundSource, /url\.search = ""/);
  assert.match(backgroundSource, /url\.hash = ""/);
  assert.match(backgroundSource, /finalizeAbandonedSkillRecording\("panel_closed"\)/);
  assert.match(backgroundSource, /chrome\.permissions\.remove/);
});

test("compilation asks for reusable inputs, stable targets, and verification", () => {
  const source = read("sidepanel.js");

  assert.match(source, /Generalize user-specific or changing values into named inputs/);
  assert.match(source, /Prefer stable semantic targets/);
  assert.match(source, /# Verification/);
  assert.match(source, /BrowserChatSkills\.parseMarkdown/);
  assert.match(source, /BrowserChatSkills\.saveSkills/);
  assert.match(source, /stream:\s*true/);
  assert.match(source, /status:\s*"editing"/);
  assert.match(source, /saveRecordedSkillDraft/);
});
