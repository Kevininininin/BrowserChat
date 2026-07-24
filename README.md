# BrowserChat

BrowserChat is a small Manifest V3 Chrome extension that opens in the browser side panel. It captures the active tab's DOM, combines it with your prompt, and streams the response from a locally running Ollama model.

No page content is sent to a cloud service by this extension.

## Requirements

- Google Chrome 114 or newer
- [Ollama](https://ollama.com/) running locally
- At least one Ollama model, for example:

```sh
ollama pull gemma3:4b
```

Ollama requires browser-extension origins to be explicitly allowed. Before opening Ollama, set:

```sh
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

If you normally launch the Ollama macOS app instead of `ollama serve`, quit it first, set the environment variable, and reopen it:

```sh
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
```

To allow only BrowserChat instead of all Chrome extensions, load BrowserChat once, copy its ID from `chrome://extensions`, and replace `*` with that ID:

```sh
OLLAMA_ORIGINS="chrome-extension://YOUR_EXTENSION_ID" ollama serve
```

## Install in Chrome

1. Start Ollama with the extension origin allowed as shown above.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Open any normal website and click the BrowserChat toolbar icon.

The model menu is populated from `http://localhost:11434/api/tags`.

The header keeps separate local chats. Each chat remembers the site and favicon
where its most recent message was sent. Selecting a chat returns to that saved
page, reopening it when needed, while the header favicon follows the currently
active browser tab.
After the first assistant response, BrowserChat asks the selected Ollama model once
for a short title summarizing the user's first question, with thinking disabled.

## How it works

On each message, BrowserChat:

1. Uses `chrome.scripting.executeScript` to inspect the live rendered page.
2. Packages visible viewport text, other rendered page text, headings, and interactive elements such as links, buttons, inputs, dropdowns, labels, constraints, and available options.
3. Excludes typed text-field and password values from control metadata.
4. When skills are enabled, asks Ollama to select relevant skills from their names and descriptions. An explicitly selected slash-command skill skips this selection round.
5. Adds only the selected skill instructions to the effective system prompt, then attaches the structured page context, recent conversation, user prompt, and registered tool schemas.
6. Shows a separate, persisted skill-usage panel with each selected skill, whether it was selected automatically or explicitly, and the exact instructions injected into the prompt.
7. Runs a multi-turn tool calling loop. A separate live activity panel shows when each tool starts, its exact requested name, inputs, completion state, and result. Requests for names outside the registered tool catalog are labeled as unsupported tool requests. Tool results are added to the conversation and sent back to Ollama until the model returns a final response.
8. Streams Ollama's separate thinking and answer fields into the side panel.

## Skills

Type `/` in the composer to open the skill picker. Choosing a skill attaches it
to the next message explicitly. With no explicit choice, Ollama first receives
the enabled skill catalog and may select any skill that materially applies.
Only selected instructions are added to the main system prompt.

Skills can be enabled or bypassed globally from **Settings → Skills**. That page
also supports creating, editing, and deleting locally stored skills. The
**Agent Runtime** settings diagram mirrors the same toggle and redraws the
architecture with or without the skill-selection phase.

The built-in Mermaid skill is enabled by default and lives separately from the
base prompt:

```text
skills/
├── registry.js
└── defaults/
    └── mermaid.js
```

`registry.js` owns normalization, local persistence, selection messages, and
effective-prompt composition. Default skill modules register themselves
independently, while user-created skills are stored in `chrome.storage.local`.
The default system prompt contains no Mermaid instructions; those instructions
are attached only when Mermaid is explicitly or implicitly selected.

## Tools

BrowserChat currently provides a `calculate` tool with addition, subtraction,
multiplication, and division. The tool validates numeric inputs and returns a
structured error for invalid operations or division by zero.

Tools are organized by responsibility:

```text
tools/
├── registry.js
├── calculator.js
└── index.js
```

`registry.js` owns discovery and dispatch, each tool module defines its schemas
and implementations, and `index.js` initializes all modules after they load.
Add a tool with `BrowserChatTools.define((register) => register({ schema,
execute }))`, then load its file before `tools/index.js` in both
`sidepanel.html` and `settings.html`. The read-only **Settings → Tools** page
renders those registered schemas so users can inspect the runtime's current
capabilities without editing them.
The chat loop automatically advertises every registered schema to Ollama and
dispatches calls by function name, so the loop itself does not need to change.
During a response, the activity panel uses a friendly progress label such as
**Calculating…** while also displaying the exact tool name, such as `calculate`.
Completed tool activity is kept with the saved assistant message and can be
expanded later to inspect its input and result.

The tool loop has no fixed round limit. While it is active, **Answer now**
cancels the current tool-enabled model round and starts a final request with
tools disabled, using the conversation and completed tool results accumulated
so far. Tool implementations may accept a second `{ signal }` argument if they
need to cancel long-running work when **Answer now** is selected.

When Ollama requests multiple tools in one response, BrowserChat runs those
calls concurrently with `Promise.all` and returns every result in one follow-up
request. Independent work can therefore share a round; work that consumes a
previous tool result still requires a later round.

Use **Preview page context** below the composer to inspect the exact structured page information that will be attached to the next prompt.

The DOM context configuration reports the full rendered text available on the
page and lets you cap how many text characters are packaged. Configure it from
the plus menu to change the system default, or from the DOM chip to store an
override for only the active chat. The DOM chip configuration also supports a
per-chat **Select element** mode: choose it, click **Select on page**, hover to
outline a section of the site, and click the highlighted element. Preview and
future DOM attachments in that chat will then package only rendered text,
headings, and controls inside the selected element. Press Escape while picking
to cancel. **Full page** remains the default mode.

Thinking is enabled by default. The composer selector can turn it off for supported models. When enabled, reasoning streams into an expanded panel, then automatically collapses when the final answer begins.

Chrome blocks DOM access on internal pages such as `chrome://extensions`, so use the extension on a regular `http` or `https` website.

## Privacy and permissions

- `tabs`: identify the active site's origin so BrowserChat can request access only to that site.
- `scripting`: capture the DOM after the user has approved the active site.
- Optional HTTP/HTTPS site access: Chrome remembers each origin the user approves.
- `sidePanel`: host the chatbot beside the active page.
- `storage`: remember chats, their last tabs, and the selected model.
- `favicon`: display the remembered page icon for each chat.
- localhost host permissions: connect only to Ollama on port `11434`.

## Troubleshooting

If the model menu says **Ollama unavailable**, confirm Ollama is running:

```sh
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

If Ollama is reachable but the menu is empty, install a model with `ollama pull`.
