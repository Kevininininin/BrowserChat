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
        name: "find_and_click",
        description:
          "Search the live DOM for a visible interactive control by its known label and click it without capturing or serializing the page. Prefer exact labels. The tool refuses ambiguous matches and suggests related labels when possible.",
        parameters: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description: "The exact visible or accessible label of the control to click."
            },
            match: {
              type: "string",
              enum: ["exact", "contains"],
              description: "Match mode. Defaults to exact."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().findAndClick(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "get_current_website",
        description:
          "Return the URL and tab title of the website currently active in the browser. Use this to re-check where you are operating without capturing the page.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    execute(_arguments, context) {
      context.signal?.throwIfAborted();
      return getRuntime().getCurrentWebsite(_arguments, context);
    }
  });

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
        name: "find_interactive_elements",
        description:
          "Find actionable controls in the current captured snapshot by visible label, name, or destination. Use this when the desired control text is known but its element reference is unclear. This does not recapture the page.",
        parameters: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description: "Exact or approximate visible text of the desired control."
            },
            scope: {
              type: "string",
              enum: ["viewport", "page"],
              description: "Search visible controls only or all controls in the captured snapshot."
            },
            maxResults: {
              type: "number",
              minimum: 1,
              maximum: 12,
              description: "Maximum matches to return. Defaults to 8."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().findInteractiveElements(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "search_captured_page_text",
        description:
          "Search only the latest captured page snapshot for relevant text passages using local RAG. This does not submit a website search, navigate, refresh results, or access new web content.",
        parameters: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description:
                "A focused semantic query for information already present in the captured page snapshot."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().searchCapturedPageText(arguments_, context);
    }
  });

  register({
    schema: {
      type: "function",
      function: {
        name: "fill_field",
        description:
          "Replace and verify the contents of a text field. Set submit to true only for a search-like field when the query should be submitted immediately.",
        parameters: {
          type: "object",
          required: ["elementRef", "text"],
          properties: {
            elementRef: elementRefProperty,
            text: {
              type: "string",
              description: "The exact text to enter."
            },
            submit: {
              type: "boolean",
              description:
                "Submit the containing search form after filling. Allowed only for fields that can be identified as search-like."
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
        name: "press_key",
        description:
          "Focus an observed interactive element and press one non-text keyboard key. Use Enter to finish a search or accept a focused menu choice after filling a field.",
        parameters: {
          type: "object",
          required: ["elementRef", "key"],
          properties: {
            elementRef: elementRefProperty,
            key: {
              type: "string",
              enum: [
                "Enter", "Escape", "Tab", "Space", "ArrowUp", "ArrowDown",
                "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"
              ],
              description: "The keyboard key to press."
            }
          }
        }
      }
    },
    execute(arguments_, context) {
      context.signal?.throwIfAborted();
      return getRuntime().pressKey(arguments_, context);
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
