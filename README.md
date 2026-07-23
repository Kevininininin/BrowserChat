# Pagewise

Pagewise is a small Manifest V3 Chrome extension that opens in the browser side panel. It captures the active tab's DOM, combines it with your prompt, and streams the response from a locally running Ollama model.

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

To allow only Pagewise instead of all Chrome extensions, load Pagewise once, copy its ID from `chrome://extensions`, and replace `*` with that ID:

```sh
OLLAMA_ORIGINS="chrome-extension://YOUR_EXTENSION_ID" ollama serve
```

## Install in Chrome

1. Start Ollama with the extension origin allowed as shown above.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Open any normal website and click the Pagewise toolbar icon.

The model menu is populated from `http://localhost:11434/api/tags`.

The header keeps separate local chats. Each chat remembers its most recent tab
and favicon, and selecting a chat reactivates that tab when it is still open.
After the first assistant response, Pagewise asks the selected Ollama model once
for a short title summarizing the user's first question, with thinking disabled.

## How it works

On each message, Pagewise:

1. Uses `chrome.scripting.executeScript` to inspect the live rendered page.
2. Packages visible viewport text, other rendered page text, headings, and interactive elements such as links, buttons, inputs, dropdowns, labels, constraints, and available options.
3. Excludes typed text-field and password values from control metadata.
4. Adds the structured page context, recent conversation, and user prompt to an Ollama `/api/chat` request.
5. Streams Ollama's separate thinking and answer fields into the side panel.

Use **Preview page context** below the composer to inspect the exact structured page information that will be attached to the next prompt.

Thinking is enabled by default. The composer selector can turn it off for supported models. When enabled, reasoning streams into an expanded panel, then automatically collapses when the final answer begins.

Chrome blocks DOM access on internal pages such as `chrome://extensions`, so use the extension on a regular `http` or `https` website.

## Privacy and permissions

- `tabs`: identify the active site's origin so Pagewise can request access only to that site.
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
