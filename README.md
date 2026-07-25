# BrowserChat

BrowserChat is essentially ChatGPT in a Chrome extension, powered by local or Ollama Cloud models and able to understand the page open in your browser. In a nutshell, it brings an Open WebUI-style experience into Chrome's side panel, with extensible skills and tools that open the door to many more workflows.

The extension captures the active tab's DOM, combines that page context with
your prompt, and streams the response through Ollama. Local models keep model
requests on your computer. When you explicitly select an Ollama Cloud model,
the prompt and any attached page context or images are processed by Ollama
Cloud after a one-time privacy confirmation.

## Requirements

- Google Chrome 114 or newer
- [Ollama](https://ollama.com/) running locally
- At least one Ollama model

## Installation

### 1. Install Ollama and a model

Install [Ollama](https://ollama.com/download), then pull a model. For a smaller
Gemma model, for example:

```sh
ollama pull gemma4:e4b
```

For the best experience, we suggest Gemma 4 26B if your computer has enough
memory to run it comfortably.

### 2. Allow the extension to connect to Ollama

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

### 3. Load BrowserChat in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open a normal website and click the BrowserChat toolbar icon to open the
   side panel.

BrowserChat requires no package installation or build step. The model menu is
populated from chat models available at `http://localhost:11434/api/tags` and
also includes `gemma4:cloud` and `gemma4:31b-cloud`. Embedding-only models such
as `nomic-embed-text` remain available to Files & RAG but are excluded from the
chat model menu.

### Optional: connect an Ollama Cloud model

Select either Gemma 4 cloud model from the model menu. If it is not ready,
BrowserChat displays a setup banner above the composer. Copy its command, run
it in Terminal, approve Ollama's browser sign-in prompt, then click **Check
again**. Chat requests continue through the local Ollama API; Ollama handles
the authenticated cloud connection.

## Features

The header keeps separate local chats. Each chat remembers the site and favicon
where its most recent message was sent. Selecting a chat returns to that saved
page, reopening it when needed, while the header favicon follows the currently
active browser tab.
After the first assistant response, BrowserChat asks the selected Ollama model once
for a short title summarizing the user's first question, with thinking disabled.

BrowserChat also supports chat-scoped local RAG for uploaded files and captured
DOM context. Add files from the composer or drag them onto it. BrowserChat
deterministically extracts PDF, text, Markdown, HTML, VTT, SRT, JSON, JSONL,
CSV, TSV, and common source-code formats, splits the content into chunks, and
generates embeddings through Ollama's `nomic-embed-text` model. Indexed content
is stored in IndexedDB under the current chat and remains available to later
questions in that chat.

Install the default embedding model before indexing files:

```sh
ollama pull nomic-embed-text
```

Chunking and retrieval parameters are configurable in **Settings → Files &
RAG**. Answers display chips for files and DOM captures actually used by
retrieval; right-click a chip to preview its locally stored extracted source.

Image files use Ollama's multimodal chat input instead of text indexing. Upload
or drag images into the side panel, or choose **Screenshot browser** from the
plus menu to capture the visible area of the current active tab. A vision-capable
Ollama model is required to interpret attached images.

## How it works

On each message, BrowserChat:

1. Uses `chrome.scripting.executeScript` to inspect the live rendered page.
2. Packages visible viewport text, other rendered page text, headings, and interactive elements such as links, buttons, inputs, dropdowns, labels, constraints, and available options.
3. Excludes typed text-field and password values from control metadata.
4. When skills are enabled, asks Ollama to select relevant skills from their names and descriptions. An explicitly selected slash-command skill skips this selection round.
5. Retrieves the most relevant chunks from files and DOM captures indexed for
   the current chat. DOM context uses this retrieval path instead of sending the
   entire capture when RAG is enabled.
6. Adds only the selected skill instructions to the effective system prompt,
   then attaches retrieved context, recent conversation, the user prompt, and
   registered tool schemas.
7. Shows a separate, persisted skill-usage panel with each selected skill,
   whether it was selected automatically or explicitly, and the exact
   instructions injected into the prompt.
8. Runs a multi-turn tool calling loop. The live activity panel groups each
   tool, its result, follow-up thinking, and end-of-step evaluation beneath the
   planned item that owned the work. Intermediate model prose stays in that
   planned-item timeline instead of appearing as a premature final answer.
   Requests for names outside the registered tool catalog are labeled as
   unsupported tool requests. These timeline segments persist with the chat.
9. Streams Ollama's separate thinking and answer fields into the side panel.

Each assistant reply includes a small download action that exports a versioned
JSON response trace. The v2 trace contains the triggering prompt, model,
selected skills and injected instructions, initial and combined reasoning,
objective-scoped tool calls, and an ordered `executionTimeline` of planned-item
starts, tool calls, post-tool thinking, planned-item evaluations, and terminal
planned-item states. It also includes retrieved sources, attachment metadata,
and the separate final response.
If a run is stopped from the composer, BrowserChat preserves the partial
response and execution state, marks the trace with a `stopped` finish reason,
and keeps its JSON download action available after the chat is reloaded.

## Skills

Type `/` in the composer to open the skill picker. Choosing a skill attaches it
to the next message explicitly. With no explicit choice, Ollama first receives
the enabled skill catalog and may select any skill that materially applies.
Only selected instructions are added to the main system prompt.

Skills can be enabled or bypassed globally from **Settings → Skills**. That page
supports creating local skills, importing and exporting Markdown skills,
editing built-in skills as local overrides, and deleting local skills. The
**Agent Runtime** settings diagram mirrors the same toggle and redraws the
architecture with or without the skill-selection phase.

Built-in skills use canonical Markdown files and live separately from the base
prompt:

```text
skills/
├── manifest.json
├── registry.js
└── defaults/
    ├── computer-use.md
    └── mermaid.md
```

Packaged Markdown uses YAML-style frontmatter for `id`, `name`, and
`description`; the remaining body is the skill instructions. `registry.js`
owns Markdown parsing and export, discovery, normalization, local overrides,
selection messages, and effective-prompt composition. User-created and
imported overrides are stored in `chrome.storage.local` because an installed
extension cannot modify its packaged files at runtime. Skill instructions are
attached only when the skill is explicitly or automatically selected.

## Tools

BrowserChat provides a `calculate` tool plus a basic browser-agent toolset:
`get_current_website`, `observe_page`, `find_interactive_elements`, `search_captured_page_text`,
`fill_field`, `click_element`, `select_option`, `scroll_page`,
`take_screenshot`, and `wait_for_page`.
Browser actions use short-lived element references from the latest compact
observation and execute sequentially. `fill_field` can safely submit recognized
search fields and return the resulting observation. Clicks report navigation,
control-state, or DOM effects and include a post-click observation. Browser
tasks receive a structured objective plan with deterministic URL and control
predicates, bounded retries, and conditional replanning. The current plan is
shown above the conversation with completed, active, pending, blocked, and
red struck-through revised states. A replanned step remains visible immediately
before its replacement so the user can follow the revision history. Long page text is retrieved
lazily from the latest captured snapshot through the configured local RAG
settings; this snapshot search never performs a website search or navigation.
Superseded tool payloads and screenshot images are compacted between model
rounds. Password fields and consequential submit-like controls are blocked.

Tools are organized by responsibility:

```text
tools/
├── registry.js
├── calculator.js
├── browser.js
├── capabilities.js
└── index.js
```

`registry.js` owns discovery and dispatch, each tool module defines its schemas
and implementations, and `index.js` initializes all modules after they load.
Add a tool with `BrowserChatTools.define((register) => register({ schema,
execute }))`, then load its file before `tools/index.js` in both
`sidepanel.html` and `settings.html`. The read-only **Settings → Tools** page
separates registered agent tools from the chat-context actions available in the
composer (file upload, screenshot capture, and DOM context), so it reflects
what the extension can do without implying that every action is callable by
the model.
The chat loop automatically advertises every registered schema to Ollama and
dispatches calls by function name, so the loop itself does not need to change.
During a response, the activity panel uses a friendly progress label such as
**Calculating…** while also displaying the exact tool name, such as `calculate`.
Completed tool activity is kept with the saved assistant message and can be
expanded later to inspect its input and result.

The tool loop stops after 30 tool calls in one response. While it is active, **Answer now**
cancels the current tool-enabled model round and starts a final request with
tools disabled, using the conversation and completed tool results accumulated
so far. The composer’s Stop control aborts the active run, including cancellable
tool implementations that accept the second `{ signal }` argument.

When Ollama requests multiple tools in one response, BrowserChat runs the calls
sequentially and returns every result in one follow-up request. This avoids races
between browser mutations such as filling a field and clicking a navigation
button.

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
- Optional site access: DOM capture can be approved one origin at a time.
- Optional all-sites access: requested only when the screenshot tool first needs
  it, because Chrome's screenshot API does not accept a single-origin grant.
- Settings → Site Access shows approved origins and lets you revoke individual
  grants or turn the optional all-sites screenshot permission on and off.
  Individual approvals and their favicons are retained separately when broad
  access changes. Sending from a site while broad access is enabled remembers
  that site as an individual approval.
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
