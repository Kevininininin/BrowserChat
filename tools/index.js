// This file is intentionally loaded after every tool module and before sidepanel.js.
// Initializing here makes tool discovery deterministic without requiring a bundler.
BrowserChatTools.initialize();
