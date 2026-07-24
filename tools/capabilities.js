(() => {
  const capabilities = Object.freeze([
    {
      name: "Upload files",
      description: "Add supported files to the active chat. Text is indexed locally for retrieval, while images are attached to the message.",
      availability: "User initiated",
      inputs: ["Images, PDFs, text, data, and source files"]
    },
    {
      name: "Screenshot browser",
      description: "Capture the visible area of the active browser tab and attach it to the active chat.",
      availability: "User initiated",
      inputs: ["Active browser tab"]
    },
    {
      name: "DOM context",
      description: "Include rendered content from the active page, either in full or from a selected element, with a configurable text limit.",
      availability: "User initiated",
      inputs: ["Active webpage", "Optional selected element"]
    }
  ]);

  globalThis.BrowserChatCapabilities = Object.freeze({
    getContextTools: () => capabilities
  });
})();
