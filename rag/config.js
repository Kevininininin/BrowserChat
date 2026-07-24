(() => {
  const STORAGE_KEY = "browserChatRagSettings";
  const DEFAULTS = Object.freeze({
    enabled: true,
    embeddingModel: "nomic-embed-text",
    chunkSizeTokens: 500,
    chunkOverlapTokens: 60,
    minimumChunkTokens: 50,
    embeddingBatchSize: 16,
    candidateTopK: 8,
    finalChunkCount: 6,
    maximumContextTokens: 4000,
    neighborExpansion: 1,
    minimumSimilarity: 0
  });

  const LIMITS = Object.freeze({
    chunkSizeTokens: [100, 2000],
    chunkOverlapTokens: [0, 500],
    minimumChunkTokens: [0, 500],
    embeddingBatchSize: [1, 64],
    candidateTopK: [1, 50],
    finalChunkCount: [1, 30],
    maximumContextTokens: [250, 20000],
    neighborExpansion: [0, 3],
    minimumSimilarity: [-1, 1]
  });

  function clampNumber(value, key) {
    const fallback = DEFAULTS[key];
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const [minimum, maximum] = LIMITS[key];
    return Math.min(maximum, Math.max(minimum, number));
  }

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {
      enabled: source.enabled !== false,
      embeddingModel:
        typeof source.embeddingModel === "string" && source.embeddingModel.trim()
          ? source.embeddingModel.trim()
          : DEFAULTS.embeddingModel
    };

    for (const key of Object.keys(LIMITS)) {
      normalized[key] = clampNumber(source[key], key);
    }

    normalized.chunkSizeTokens = Math.round(normalized.chunkSizeTokens);
    normalized.chunkOverlapTokens = Math.min(
      Math.round(normalized.chunkOverlapTokens),
      Math.max(0, normalized.chunkSizeTokens - 1)
    );
    normalized.minimumChunkTokens = Math.min(
      Math.round(normalized.minimumChunkTokens),
      normalized.chunkSizeTokens
    );
    normalized.embeddingBatchSize = Math.round(normalized.embeddingBatchSize);
    normalized.candidateTopK = Math.round(normalized.candidateTopK);
    normalized.finalChunkCount = Math.min(
      Math.round(normalized.finalChunkCount),
      normalized.candidateTopK
    );
    normalized.maximumContextTokens = Math.round(normalized.maximumContextTokens);
    normalized.neighborExpansion = Math.round(normalized.neighborExpansion);
    return normalized;
  }

  globalThis.BrowserChatRagConfig = Object.freeze({
    STORAGE_KEY,
    DEFAULTS,
    LIMITS,
    normalize
  });
})();
