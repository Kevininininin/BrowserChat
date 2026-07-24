(() => {
  const TEXT_EXTENSIONS = new Set([
    "txt", "md", "markdown", "rst", "log", "ini", "cfg", "conf", "toml",
    "yaml", "yml", "xml", "svg", "css", "scss", "less", "js", "mjs", "cjs",
    "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp",
    "hpp", "cs", "swift", "kt", "kts", "sh", "zsh", "bash", "sql"
  ]);

  function extensionOf(name = "") {
    const match = String(name).toLowerCase().match(/\.([^.]+)$/);
    return match ? match[1] : "";
  }

  function normalizeText(value = "") {
    return String(value)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function stripCaptionMarkup(value = "") {
    const document = new DOMParser().parseFromString(
      `<body>${String(value).replace(/<v\s+([^>]+)>/gi, "$1: ")}</body>`,
      "text/html"
    );
    return document.body.textContent.replace(/\s+/g, " ").trim();
  }

  function extractCaptions(source) {
    const blocks = normalizeText(source).split(/\n{2,}/);
    const lines = [];
    let cueCount = 0;
    for (const block of blocks) {
      const blockLines = block.split("\n").map((line) => line.trim());
      if (!blockLines.length || /^WEBVTT(?:\s|$)/i.test(blockLines[0])) continue;
      const timingIndex = blockLines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) continue;
      const timestamp = blockLines[timingIndex].split("-->")[0].trim();
      const text = stripCaptionMarkup(blockLines.slice(timingIndex + 1).join(" "));
      if (!text) continue;
      if (lines.at(-1)?.text === text) continue;
      lines.push({ timestamp, text });
      cueCount += 1;
    }
    return {
      text: lines.map(({ timestamp, text }) => `[${timestamp}] ${text}`).join("\n"),
      kind: "transcript",
      metadata: { cueCount },
      warnings: []
    };
  }

  function parseDelimited(source, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === delimiter) {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }
    row.push(field);
    if (row.some((value) => value) || rows.length === 0) rows.push(row);
    return rows;
  }

  function extractDelimited(source, delimiter) {
    const rows = parseDelimited(source, delimiter);
    return {
      text: rows.map((row, index) =>
        `${index === 0 ? "Headers" : `Row ${index}`}: ${row
          .map((value, column) => `${column + 1}=${String(value).trim()}`)
          .join(" | ")}`
      ).join("\n"),
      kind: "table",
      metadata: {
        rowCount: Math.max(0, rows.length - 1),
        columnCount: Math.max(0, ...rows.map((row) => row.length))
      },
      warnings: []
    };
  }

  function extractHtml(source) {
    const document = new DOMParser().parseFromString(source, "text/html");
    document.querySelectorAll(
      "script, style, noscript, template, iframe, canvas, svg, nav"
    ).forEach((element) => element.remove());

    const blocks = [];
    if (document.title.trim()) blocks.push(`# ${document.title.trim()}`);
    document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, li, blockquote, th, td"
    ).forEach((element) => {
      const text = element.textContent.replace(/\s+/g, " ").trim();
      if (!text) return;
      const heading = element.tagName.match(/^H([1-6])$/);
      blocks.push(heading ? `${"#".repeat(Number(heading[1]))} ${text}` : text);
    });

    return {
      text: normalizeText(blocks.join("\n\n")),
      kind: "document",
      metadata: { title: document.title.trim() },
      warnings: []
    };
  }

  function extractJson(source, jsonLines = false) {
    if (jsonLines) {
      const records = normalizeText(source).split("\n").filter(Boolean).map(
        (line, index) => {
          try {
            return JSON.parse(line);
          } catch {
            throw new Error(`Invalid JSON on line ${index + 1}.`);
          }
        }
      );
      return {
        text: records.map((record, index) =>
          `Record ${index + 1}\n${JSON.stringify(record, null, 2)}`
        ).join("\n\n"),
        kind: "records",
        metadata: { recordCount: records.length },
        warnings: []
      };
    }
    const value = JSON.parse(source);
    return {
      text: JSON.stringify(value, null, 2),
      kind: "structured-data",
      metadata: {
        topLevelType: Array.isArray(value) ? "array" : typeof value
      },
      warnings: []
    };
  }

  async function extractPdf(file) {
    if (!globalThis.pdfjsLib) {
      throw new Error("The bundled PDF extractor could not be loaded.");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "assets/vendor/pdf.worker.min.js"
    );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;
    const pages = [];
    const warnings = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!item?.str) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      text = normalizeText(text.replace(/[ \t]{2,}/g, " "));
      pages.push(`## Page ${pageNumber}\n${text || "[No extractable text]"}`);
      if (text.length < 30) {
        warnings.push(
          `Page ${pageNumber} contains little extractable text and may be scanned.`
        );
      }
    }
    return {
      text: pages.join("\n\n"),
      kind: "pdf",
      metadata: { pageCount: pdf.numPages },
      warnings
    };
  }

  async function extractFile(file) {
    const extension = extensionOf(file.name);
    const mimeType = String(file.type || "").toLowerCase();
    let result;

    if (extension === "pdf" || mimeType === "application/pdf") {
      result = await extractPdf(file);
    } else {
      const source = await file.text();
      if (extension === "vtt" || extension === "srt") {
        result = extractCaptions(source);
      } else if (extension === "html" || extension === "htm" || mimeType === "text/html") {
        result = extractHtml(source);
      } else if (extension === "jsonl" || extension === "ndjson") {
        result = extractJson(source, true);
      } else if (extension === "json" || mimeType === "application/json") {
        result = extractJson(source, false);
      } else if (extension === "csv" || mimeType === "text/csv") {
        result = extractDelimited(source, ",");
      } else if (extension === "tsv" || mimeType === "text/tab-separated-values") {
        result = extractDelimited(source, "\t");
      } else if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) {
        result = {
          text: normalizeText(source),
          kind: extension === "md" || extension === "markdown" ? "markdown" : "text",
          metadata: {},
          warnings: []
        };
      } else {
        throw new Error(
          `BrowserChat cannot extract ${file.name} yet. Supported files include PDF, text, Markdown, HTML, VTT, SRT, JSON, JSONL, CSV, TSV, and source-code files.`
        );
      }
    }

    if (!result.text.trim()) {
      throw new Error(`${file.name} did not contain extractable text.`);
    }
    return result;
  }

  function extractDom(page) {
    const blocks = [
      page?.page?.title ? `# ${page.page.title}` : "",
      page?.page?.url ? `URL: ${page.page.url}` : "",
      ...(page?.headings || []).map((heading) => {
        const level = Math.min(6, Math.max(1, Number(heading.level) || 2));
        return `${"#".repeat(level)} ${heading.text || ""}`;
      }),
      page?.visibleText?.inViewport
        ? `## Visible viewport\n${page.visibleText.inViewport}`
        : "",
      page?.visibleText?.elsewhereOnPage
        ? `## Elsewhere on page\n${page.visibleText.elsewhereOnPage}`
        : "",
      ...(page?.interactiveElements || []).map((element) => {
        const label = element.label || element.text || element.name || "";
        const target = element.href ? ` → ${element.href}` : "";
        const metadata = Object.fromEntries(
          Object.entries(element).filter(([key, value]) =>
            !["index", "kind", "label", "href"].includes(key) &&
            value !== "" &&
            value !== null &&
            value !== undefined
          )
        );
        const details = Object.keys(metadata).length
          ? ` ${JSON.stringify(metadata)}`
          : "";
        return label
          ? `[${element.kind || "control"}] ${label}${target}${details}`
          : "";
      })
    ].filter(Boolean);

    return {
      text: normalizeText(blocks.join("\n\n")),
      kind: "dom",
      metadata: {
        url: page?.page?.url || "",
        title: page?.page?.title || "",
        captureMode: page?.capture?.mode || "fullPage"
      },
      warnings: page?.limitations || []
    };
  }

  globalThis.BrowserChatRagExtractors = Object.freeze({
    extractFile,
    extractDom,
    normalizeText
  });
})();
