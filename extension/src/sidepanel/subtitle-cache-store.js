(function(global) {
  const SUBTITLE_CACHE_DB_NAME = "fuguang-subtitle-cache";
  const SUBTITLE_CACHE_DB_VERSION = 1;
  const SUBTITLE_CACHE_STORE = "subtitles";
  const SUBTITLE_CACHE_MAX_ENTRIES = 80;
  const SUBTITLE_CACHE_MAX_AGE_DAYS = 30;
  const SUBTITLE_CACHE_MAX_BYTES = 8 * 1024 * 1024;

  function openSubtitleCacheDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SUBTITLE_CACHE_DB_NAME, SUBTITLE_CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SUBTITLE_CACHE_STORE)) {
          db.createObjectStore(SUBTITLE_CACHE_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开字幕缓存。"));
    });
  }

  async function getSubtitleCacheEntry(id) {
    if (!id) {
      return null;
    }
    const db = await openSubtitleCacheDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readonly");
      const request = transaction.objectStore(SUBTITLE_CACHE_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("无法读取字幕缓存。"));
      transaction.oncomplete = () => db.close();
    });
  }

  async function getAllSubtitleCacheEntries() {
    const db = await openSubtitleCacheDb();
    return new Promise((resolve, reject) => {
      let entries = [];
      const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readonly");
      const request = transaction.objectStore(SUBTITLE_CACHE_STORE).getAll();
      request.onsuccess = () => {
        entries = Array.isArray(request.result) ? request.result : [];
      };
      request.onerror = () => reject(request.error || new Error("无法读取字幕缓存。"));
      transaction.oncomplete = () => {
        db.close();
        resolve(entries);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("无法读取字幕缓存。"));
      };
    });
  }

  async function deleteSubtitleCacheEntries(ids) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) {
      return 0;
    }
    const db = await openSubtitleCacheDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
      const store = transaction.objectStore(SUBTITLE_CACHE_STORE);
      let deleted = 0;
      for (const id of uniqueIds) {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            store.delete(id);
            deleted += 1;
          }
        };
        request.onerror = () => {
          reject(request.error || new Error("无法读取字幕缓存。"));
        };
      }
      transaction.oncomplete = () => {
        db.close();
        resolve(deleted);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("无法删除字幕缓存。"));
      };
    });
  }

  async function putSubtitleCacheEntry(entry, options = {}) {
    const db = await openSubtitleCacheDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
      transaction.objectStore(SUBTITLE_CACHE_STORE).put(entry);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("无法写入字幕缓存。"));
      };
    });
    await pruneSubtitleCache({ protectedId: options.protectedId || entry?.id || "" });
  }

  async function pruneSubtitleCache({ protectedId = "" } = {}) {
    const db = await openSubtitleCacheDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
      const store = transaction.objectStore(SUBTITLE_CACHE_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const entries = Array.isArray(request.result) ? request.result : [];
        const cutoff = Date.now() - SUBTITLE_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        const sorted = entries
          .map(entry => ({
            entry,
            updatedAt: subtitleCacheEntryTime(entry)
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        const idsToDelete = new Set();
        for (const item of sorted) {
          if (item.updatedAt && item.updatedAt < cutoff) {
            idsToDelete.add(item.entry.id);
          }
        }
        for (const item of sorted.slice(SUBTITLE_CACHE_MAX_ENTRIES)) {
          idsToDelete.add(item.entry.id);
        }
        const keptByAgeAndCount = sorted.filter(item => !idsToDelete.has(item.entry.id));
        let totalBytes = keptByAgeAndCount.reduce((sum, item) => sum + subtitleCacheEntryBytes(item.entry), 0);
        if (totalBytes > SUBTITLE_CACHE_MAX_BYTES) {
          for (const item of [...keptByAgeAndCount].reverse()) {
            if (totalBytes <= SUBTITLE_CACHE_MAX_BYTES) {
              break;
            }
            const id = item.entry?.id;
            if (!id || id === protectedId) {
              continue;
            }
            idsToDelete.add(id);
            totalBytes -= subtitleCacheEntryBytes(item.entry);
          }
        }
        for (const id of idsToDelete) {
          if (id && id !== protectedId) {
            store.delete(id);
          }
        }
      };
      request.onerror = () => reject(request.error || new Error("无法维护字幕缓存。"));
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error("无法维护字幕缓存。"));
      };
    });
  }

  function subtitleCacheEntryBytes(entry) {
    const approxBytes = Number(entry?.approxBytes);
    if (Number.isFinite(approxBytes) && approxBytes > 0) {
      return approxBytes;
    }
    try {
      return new TextEncoder().encode(JSON.stringify(entry || {})).byteLength;
    } catch {
      return 0;
    }
  }

  Object.assign(global, {
    SUBTITLE_CACHE_DB_NAME,
    SUBTITLE_CACHE_DB_VERSION,
    SUBTITLE_CACHE_STORE,
    SUBTITLE_CACHE_MAX_ENTRIES,
    SUBTITLE_CACHE_MAX_AGE_DAYS,
    SUBTITLE_CACHE_MAX_BYTES,
    openSubtitleCacheDb,
    getSubtitleCacheEntry,
    getAllSubtitleCacheEntries,
    deleteSubtitleCacheEntries,
    putSubtitleCacheEntry,
    pruneSubtitleCache
  });
})(globalThis);
