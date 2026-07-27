(() => {
  const OLLAMA_BASE_URL = "http://localhost:11434";
  const TOKEN_CHARACTER_ESTIMATE = 4;
  let settings = BrowserChatRagConfig.normalize();

  function estimateTokens(text = "") {
    return Math.max(1, Math.ceil(String(text).length / TOKEN_CHARACTER_ESTIMATE));
  }

  async function loadSettings() {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return settings;
    const stored = await storage.get(BrowserChatRagConfig.STORAGE_KEY);
    settings = BrowserChatRagConfig.normalize(
      stored[BrowserChatRagConfig.STORAGE_KEY]
    );
    return settings;
  }

  function getSettings() {
    return { ...settings };
  }

  function splitOversizedBlock(block, maximumCharacters) {
    const parts = [];
    let remaining = block.trim();
    while (remaining.length > maximumCharacters) {
      let splitAt = remaining.lastIndexOf(". ", maximumCharacters);
      if (splitAt < maximumCharacters * 0.55) {
        splitAt = remaining.lastIndexOf(" ", maximumCharacters);
      }
      if (splitAt < maximumCharacters * 0.4) splitAt = maximumCharacters;
      parts.push(remaining.slice(0, splitAt + 1).trim());
      remaining = remaining.slice(splitAt + 1).trim();
    }
    if (remaining) parts.push(remaining);
    return parts;
  }

  function chunkText(text, configuration = settings) {
    const targetCharacters =
      configuration.chunkSizeTokens * TOKEN_CHARACTER_ESTIMATE;
    const overlapCharacters =
      configuration.chunkOverlapTokens * TOKEN_CHARACTER_ESTIMATE;
    const minimumCharacters =
      configuration.minimumChunkTokens * TOKEN_CHARACTER_ESTIMATE;
    const rawBlocks = String(text).split(/\n{2,}/).map((block) => block.trim())
      .filter(Boolean);
    const blocks = rawBlocks.flatMap((block) =>
      splitOversizedBlock(block, targetCharacters)
    );
    const chunks = [];
    let current = "";

    for (const block of blocks) {
      const candidate = current ? `${current}\n\n${block}` : block;
      if (!current || candidate.length <= targetCharacters) {
        current = candidate;
        continue;
      }
      chunks.push(current.trim());
      const overlap = overlapCharacters
        ? current.slice(-overlapCharacters).replace(/^\S*\s?/, "").trim()
        : "";
      current = overlap ? `${overlap}\n\n${block}` : block;
    }
    if (current.trim()) chunks.push(current.trim());

    if (
      chunks.length > 1 &&
      chunks.at(-1).length < minimumCharacters
    ) {
      chunks[chunks.length - 2] = `${chunks.at(-2)}\n\n${chunks.at(-1)}`;
      chunks.pop();
    }
    return chunks;
  }

  async function requestEmbeddings(inputs, signal) {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.embeddingModel,
        input: inputs,
        truncate: false
      }),
      signal
    });
    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body.error || "";
      } catch {
        // The status is enough when Ollama does not return JSON.
      }
      const installHint = /not found|pull/i.test(detail)
        ? ` Install it with: ollama pull ${settings.embeddingModel}`
        : "";
      throw new Error(
        `Ollama could not create embeddings${detail ? `: ${detail}` : ` (HTTP ${response.status})`}.${installHint}`
      );
    }
    const result = await response.json();
    if (!Array.isArray(result.embeddings) || result.embeddings.length !== inputs.length) {
      throw new Error("Ollama returned an unexpected embedding response.");
    }
    return result.embeddings;
  }

  async function embedInBatches(texts, { signal, onProgress } = {}) {
    const vectors = [];
    for (let offset = 0; offset < texts.length; offset += settings.embeddingBatchSize) {
      signal?.throwIfAborted();
      const batch = texts.slice(offset, offset + settings.embeddingBatchSize);
      vectors.push(...await requestEmbeddings(batch, signal));
      onProgress?.(Math.min(texts.length, offset + batch.length), texts.length);
    }
    return vectors;
  }

  async function indexExtracted({
    chatId,
    attachmentId = crypto.randomUUID(),
    name,
    mimeType,
    kind,
    extracted,
    blob = null,
    sourceMetadata = {},
    signal,
    onProgress
  }) {
    const createdAt = Date.now();
    const baseAttachment = {
      id: attachmentId,
      chatId,
      name,
      mimeType: mimeType || "",
      kind,
      status: "indexing",
      chunkCount: 0,
      extractedText: extracted.text,
      extractionMetadata: extracted.metadata || {},
      sourceMetadata,
      warnings: extracted.warnings || [],
      blob,
      embeddingModel: settings.embeddingModel,
      createdAt,
      updatedAt: createdAt
    };
    await BrowserChatRagDatabase.putAttachment(baseAttachment);

    try {
      const texts = chunkText(extracted.text);
      onProgress?.({ stage: "embedding", completed: 0, total: texts.length });
      const vectors = await embedInBatches(texts, {
        signal,
        onProgress: (completed, total) =>
          onProgress?.({ stage: "embedding", completed, total })
      });
      const chunks = texts.map((text, chunkIndex) => ({
        id: `${attachmentId}:${chunkIndex}`,
        chatId,
        attachmentId,
        attachmentName: name,
        attachmentKind: kind,
        chunkIndex,
        text,
        tokenEstimate: estimateTokens(text),
        embeddingModel: settings.embeddingModel,
        embeddingDimensions: vectors[chunkIndex].length,
        embedding: Float32Array.from(vectors[chunkIndex]),
        sourceMetadata,
        createdAt
      }));
      await BrowserChatRagDatabase.replaceChunks(attachmentId, chunks);
      const attachment = {
        ...baseAttachment,
        status: "indexed",
        chunkCount: chunks.length,
        updatedAt: Date.now()
      };
      await BrowserChatRagDatabase.putAttachment(attachment);
      onProgress?.({
        stage: "complete",
        completed: chunks.length,
        total: chunks.length
      });
      return attachment;
    } catch (error) {
      await BrowserChatRagDatabase.putAttachment({
        ...baseAttachment,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now()
      });
      throw error;
    }
  }

  async function indexFile({
    chatId,
    file,
    attachmentId = crypto.randomUUID(),
    signal,
    onProgress
  }) {
    if (!settings.enabled) throw new Error("File indexing is disabled in Settings.");
    onProgress?.({ stage: "extracting", completed: 0, total: 0 });
    const extracted = await BrowserChatRagExtractors.extractFile(file);
    return indexExtracted({
      chatId,
      attachmentId,
      name: file.name,
      mimeType: file.type,
      kind: extracted.kind,
      extracted,
      blob: file,
      sourceMetadata: { size: file.size, lastModified: file.lastModified },
      signal,
      onProgress
    });
  }

  async function indexDom({ chatId, page, signal, onProgress }) {
    if (!settings.enabled) throw new Error("RAG indexing is disabled in Settings.");
    const extracted = BrowserChatRagExtractors.extractDom(page);
    const title = page?.page?.title || page?.page?.hostname || "Page context";
    return indexExtracted({
      chatId,
      name: `${title} · DOM`,
      mimeType: "application/x-browserchat-dom",
      kind: "dom",
      extracted,
      sourceMetadata: {
        url: page?.page?.url || "",
        capturedAt: new Date().toISOString()
      },
      signal,
      onProgress
    });
  }

  async function indexWebpage({
    chatId,
    html,
    extracted: providedExtraction = null,
    url,
    finalUrl = url,
    contentType = "text/html",
    attachmentId = crypto.randomUUID(),
    signal,
    onProgress
  }) {
    if (!settings.enabled) throw new Error("RAG indexing is disabled in Settings.");
    onProgress?.({ stage: "extracting", completed: 0, total: 0 });
    const extracted =
      providedExtraction || BrowserChatRagExtractors.extractHtml(html);
    const hostname = new URL(finalUrl || url).hostname;
    const title = extracted.metadata?.title || hostname || "Webpage";
    return indexExtracted({
      chatId,
      attachmentId,
      name: title,
      mimeType: contentType || "text/html",
      kind: "webpage",
      extracted,
      sourceMetadata: {
        url: finalUrl || url,
        requestedUrl: url,
        fetchedAt: new Date().toISOString()
      },
      signal,
      onProgress
    });
  }

  function similarity(a, b) {
    if (!a || !b || a.length !== b.length) return Number.NEGATIVE_INFINITY;
    let score = 0;
    for (let index = 0; index < a.length; index += 1) {
      score += a[index] * b[index];
    }
    return score;
  }

  async function retrieve(chatId, query, { signal, selectedChunks = {} } = {}) {
    if (!settings.enabled || !chatId || !query.trim()) {
      return { chunks: [], sources: [], context: "" };
    }
    const [chatAttachments, chatChunks] = await Promise.all([
      BrowserChatRagDatabase.getAttachmentsByChat(chatId),
      BrowserChatRagDatabase.getChunksByChat(chatId)
    ]);
    const chatAttachmentIds = new Set(
      chatAttachments
        .filter((attachment) => attachment.chatId === chatId)
        .map((attachment) => attachment.id)
    );
    const selectedAttachmentIds = new Set(Object.keys(selectedChunks));
    const eligibleChunks = chatChunks.filter(
      (chunk) =>
        chunk.chatId === chatId &&
        chatAttachmentIds.has(chunk.attachmentId) &&
        chunk.embeddingModel === settings.embeddingModel
    );
    if (!eligibleChunks.length) return { chunks: [], sources: [], context: "" };

    const forcedChunks = eligibleChunks
      .filter((chunk) => {
        const indexes = selectedChunks[chunk.attachmentId];
        return Array.isArray(indexes) && indexes.includes(chunk.chunkIndex);
      })
      .sort((a, b) =>
        a.attachmentId.localeCompare(b.attachmentId) || a.chunkIndex - b.chunkIndex
      )
      .map((chunk) => ({ ...chunk, score: 1, manuallySelected: true }));
    const allChunks = eligibleChunks.filter(
      (chunk) => !selectedAttachmentIds.has(chunk.attachmentId)
    );

    let candidates = [];
    if (allChunks.length) {
      const [queryVector] = await requestEmbeddings([query], signal);
      candidates = allChunks
        .map((chunk) => ({
          ...chunk,
          score: similarity(queryVector, chunk.embedding)
        }))
        .filter((chunk) => chunk.score > settings.minimumSimilarity)
        .sort((a, b) => b.score - a.score)
        .slice(0, settings.candidateTopK);
    }

    const chunksByAttachment = new Map();
    for (const chunk of allChunks) {
      if (!chunksByAttachment.has(chunk.attachmentId)) {
        chunksByAttachment.set(chunk.attachmentId, new Map());
      }
      chunksByAttachment.get(chunk.attachmentId).set(chunk.chunkIndex, chunk);
    }

    const selected = new Map();
    for (const candidate of candidates) {
      selected.set(candidate.id, candidate);
      for (
        let offset = 1;
        offset <= settings.neighborExpansion;
        offset += 1
      ) {
        for (const neighborIndex of [
          candidate.chunkIndex - offset,
          candidate.chunkIndex + offset
        ]) {
          const neighbor = chunksByAttachment
            .get(candidate.attachmentId)
            ?.get(neighborIndex);
          if (neighbor) {
            selected.set(neighbor.id, {
              ...neighbor,
              score: candidate.score,
              neighborOf: candidate.id
            });
          }
        }
      }
    }

    const ordered = [...forcedChunks, ...selected.values()].sort((a, b) => {
      if (a.manuallySelected !== b.manuallySelected) return a.manuallySelected ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      if (a.attachmentId !== b.attachmentId) {
        return a.attachmentId.localeCompare(b.attachmentId);
      }
      return a.chunkIndex - b.chunkIndex;
    });

    const finalChunks = [];
    let tokenCount = 0;
    for (const chunk of ordered) {
      if (!chunk.manuallySelected && finalChunks.length >= settings.finalChunkCount) break;
      if (
        !chunk.manuallySelected &&
        finalChunks.length &&
        tokenCount + chunk.tokenEstimate > settings.maximumContextTokens
      ) continue;
      finalChunks.push(chunk);
      tokenCount += chunk.tokenEstimate;
    }

    const sourceMap = new Map();
    for (const chunk of finalChunks) {
      if (!sourceMap.has(chunk.attachmentId)) {
        sourceMap.set(chunk.attachmentId, {
          attachmentId: chunk.attachmentId,
          name: chunk.attachmentName,
          kind: chunk.attachmentKind,
          chunkIndexes: [],
          bestScore: chunk.score,
          sourceMetadata: chunk.sourceMetadata || {}
        });
      }
      const source = sourceMap.get(chunk.attachmentId);
      source.chunkIndexes.push(chunk.chunkIndex);
      source.bestScore = Math.max(source.bestScore, chunk.score);
    }

    const context = finalChunks.map((chunk, index) => [
      `[Retrieved source ${index + 1}]`,
      `Source: ${chunk.attachmentName}`,
      `Chunk: ${chunk.chunkIndex + 1}`,
      chunk.manuallySelected ? "Selection: chosen for this message" : `Similarity: ${chunk.score.toFixed(4)}`,
      chunk.sourceMetadata?.url ? `URL: ${chunk.sourceMetadata.url}` : "",
      "Content:",
      chunk.text
    ].filter(Boolean).join("\n")).join("\n\n");

    return {
      chunks: finalChunks,
      sources: [...sourceMap.values()],
      context,
      tokenEstimate: tokenCount
    };
  }

  globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[BrowserChatRagConfig.STORAGE_KEY]) {
      settings = BrowserChatRagConfig.normalize(
        changes[BrowserChatRagConfig.STORAGE_KEY].newValue
      );
    }
  });

  globalThis.BrowserChatRag = Object.freeze({
    loadSettings,
    getSettings,
    estimateTokens,
    chunkText,
    indexFile,
    indexDom,
    indexWebpage,
    retrieve,
    getAttachment: BrowserChatRagDatabase.getAttachment,
    getAttachmentsByChat: BrowserChatRagDatabase.getAttachmentsByChat,
    getChunksByAttachment: BrowserChatRagDatabase.getChunksByAttachment,
    deleteAttachment: BrowserChatRagDatabase.deleteAttachment,
    deleteChat: BrowserChatRagDatabase.deleteChat
  });
})();
