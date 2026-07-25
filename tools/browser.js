BrowserChatTools.define((register) => {
  const getRuntime = () => {
    const runtime = globalThis.BrowserChatAgentRuntime;
    if (!runtime) throw new Error("The browser agent runtime is not ready.");
    return runtime;
  };

  const elementRefProperty = {
    type: "string",
    description:
      "An element reference such as e3 from the most recent observe_page result."
  };

  register({
    schema: {
      type: "function",
      function: {
        name: "observe_page",
        description:
          "Inspect the active webpage and return its visible text and interactive elements. Call this before acting and again after the page changes.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    execute(_arguments, context) {
      context.signal?.throwIfAborted();
      return getRuntime().observe(context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "search_page_content",
        description:
          "Retrieve the most relevant text passages from the latest full page snapshot using the configured local RAG settings. Use this for long page content, not for locating controls.",
        parameters: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description:
                "A focused semantic query describing the page information needed for the current objective."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().searchPageContent(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "fill_field",
        description:
          "Replace the contents of a text input, textarea, or contenteditable element and verify that the value was accepted.",
        parameters: {
          type: "object",
          required: ["elementRef", "text"],
          properties: {
            elementRef: elementRefProperty,
            text: {
              type: "string",
              description: "The exact text to enter."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().fillField(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "click_element",
        description:
          "Click a button, link, checkbox, radio button, or other clickable element from the latest observation.",
        parameters: {
          type: "object",
          required: ["elementRef"],
          properties: {
            elementRef: elementRefProperty
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().clickElement(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "select_option",
        description:
          "Select one option in a native HTML select element and verify the selection.",
        parameters: {
          type: "object",
          required: ["elementRef"],
          properties: {
            elementRef: elementRefProperty,
            value: {
              type: "string",
              description: "The option value to select."
            },
            label: {
              type: "string",
              description:
                "The visible option label to select. Use this when the option value is unknown."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().selectOption(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "scroll_page",
        description:
          "Scroll the active page up or down, then return a fresh page observation.",
        parameters: {
          type: "object",
          required: ["direction"],
          properties: {
            direction: {
              type: "string",
              enum: ["up", "down", "top", "bottom"]
            },
            amount: {
              type: "number",
              description:
                "Pixels to scroll for up or down. Defaults to about 80% of the viewport and is capped at 5000."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().scrollPage(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "take_screenshot",
        description:
          "Capture the visible area of the active browser tab and attach the PNG to the next model round for visual inspection. Requires screenshot permission and a vision-capable model.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    execute(_arguments, context) {
      context.signal?.throwIfAborted();
      return getRuntime().takeScreenshot(context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "wait_for_page",
        description:
          "Wait briefly for a page transition or dynamic update, then return a fresh observation. Use only when an action needs time to settle.",
        parameters: {
          type: "object",
          properties: {
            seconds: {
              type: "number",
              minimum: 0,
              maximum: 10,
              description: "Seconds to wait. Defaults to 1 and is capped at 10."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().waitForPage(arguments_, context);
    }
  });
});
