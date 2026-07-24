(() => {
  const DATABASE_NAME = "BrowserChatRag";
  const DATABASE_VERSION = 1;
  const ATTACHMENTS = "attachments";
  const CHUNKS = "chunks";
  let databasePromise = null;

  function requestAsPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function open() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ATTACHMENTS)) {
          const store = database.createObjectStore(ATTACHMENTS, { keyPath: "id" });
          store.createIndex("chatId", "chatId", { unique: false });
          store.createIndex("chatAndCreated", ["chatId", "createdAt"], { unique: false });
        }
        if (!database.objectStoreNames.contains(CHUNKS)) {
          const store = database.createObjectStore(CHUNKS, { keyPath: "id" });
          store.createIndex("chatId", "chatId", { unique: false });
          store.createIndex("attachmentId", "attachmentId", { unique: false });
          store.createIndex(
            "attachmentAndIndex",
            ["attachmentId", "chunkIndex"],
            { unique: true }
          );
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error);
      };
    });
    return databasePromise;
  }

  async function putAttachment(attachment) {
    const database = await open();
    const transaction = database.transaction(ATTACHMENTS, "readwrite");
    transaction.objectStore(ATTACHMENTS).put(attachment);
    await transactionDone(transaction);
    return attachment;
  }

  async function getAttachment(id) {
    const database = await open();
    const transaction = database.transaction(ATTACHMENTS, "readonly");
    return requestAsPromise(transaction.objectStore(ATTACHMENTS).get(id));
  }

  async function getAttachmentsByChat(chatId) {
    const database = await open();
    const transaction = database.transaction(ATTACHMENTS, "readonly");
    return requestAsPromise(
      transaction.objectStore(ATTACHMENTS).index("chatId").getAll(chatId)
    );
  }

  async function replaceChunks(attachmentId, chunks) {
    const database = await open();
    const transaction = database.transaction(CHUNKS, "readwrite");
    const store = transaction.objectStore(CHUNKS);
    const index = store.index("attachmentId");
    const keys = await requestAsPromise(index.getAllKeys(attachmentId));
    for (const key of keys) store.delete(key);
    for (const chunk of chunks) store.put(chunk);
    await transactionDone(transaction);
  }

  async function getChunksByChat(chatId) {
    const database = await open();
    const transaction = database.transaction(CHUNKS, "readonly");
    return requestAsPromise(
      transaction.objectStore(CHUNKS).index("chatId").getAll(chatId)
    );
  }

  async function getAll(storeName) {
    if (![ATTACHMENTS, CHUNKS].includes(storeName)) {
      throw new Error(`Unknown BrowserChat RAG store: ${storeName}`);
    }
    const database = await open();
    const transaction = database.transaction(storeName, "readonly");
    return requestAsPromise(transaction.objectStore(storeName).getAll());
  }

  async function inspect() {
    const database = await open();
    const stores = {};
    for (const storeName of [ATTACHMENTS, CHUNKS]) {
      const transaction = database.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      stores[storeName] = {
        name: storeName,
        keyPath: store.keyPath,
        indexes: [...store.indexNames].map((indexName) => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath,
            unique: index.unique
          };
        }),
        records: await requestAsPromise(store.getAll())
      };
    }
    return {
      name: database.name,
      version: database.version,
      stores
    };
  }

  async function deleteAttachment(id) {
    const database = await open();
    const transaction = database.transaction(
      [ATTACHMENTS, CHUNKS],
      "readwrite"
    );
    transaction.objectStore(ATTACHMENTS).delete(id);
    const chunkStore = transaction.objectStore(CHUNKS);
    const keys = await requestAsPromise(
      chunkStore.index("attachmentId").getAllKeys(id)
    );
    for (const key of keys) chunkStore.delete(key);
    await transactionDone(transaction);
  }

  async function deleteChat(chatId) {
    const database = await open();
    const transaction = database.transaction(
      [ATTACHMENTS, CHUNKS],
      "readwrite"
    );
    for (const storeName of [ATTACHMENTS, CHUNKS]) {
      const store = transaction.objectStore(storeName);
      const keys = await requestAsPromise(store.index("chatId").getAllKeys(chatId));
      for (const key of keys) store.delete(key);
    }
    await transactionDone(transaction);
  }

  globalThis.BrowserChatRagDatabase = Object.freeze({
    open,
    putAttachment,
    getAttachment,
    getAttachmentsByChat,
    replaceChunks,
    getChunksByChat,
    getAll,
    inspect,
    deleteAttachment,
    deleteChat
  });
})();
