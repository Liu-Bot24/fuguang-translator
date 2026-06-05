(function () {
  const DB_NAME = "liusheng-local-media-files";
  const DB_VERSION = 1;
  const STORE_HANDLES = "handles";

  function normalizeLocalMediaFileUrl(rawUrl = "") {
    try {
      const url = new URL(String(rawUrl || "").trim());
      return url.protocol === "file:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function localMediaFileNameFromUrl(rawUrl = "") {
    try {
      const url = new URL(String(rawUrl || ""));
      const parts = String(url.pathname || "").split("/").filter(Boolean);
      const encoded = parts[parts.length - 1] || "";
      return decodeURIComponent(encoded);
    } catch {
      return "";
    }
  }

  function normalizeName(name = "") {
    return String(name || "").trim().normalize("NFC");
  }

  function namesLookCompatible(expected = "", actual = "") {
    const expectedName = normalizeName(expected);
    const actualName = normalizeName(actual);
    return !expectedName || !actualName || expectedName === actualName;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function openDb() {
    if (!globalThis.indexedDB) {
      return Promise.reject(new Error("当前浏览器不支持本地文件授权存储。"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: "key" });
      }
    };
    return requestToPromise(request);
  }

  async function withStore(mode, action) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_HANDLES, mode);
      const store = tx.objectStore(STORE_HANDLES);
      const result = await action(store);
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
        tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
      });
      return result;
    } finally {
      db.close();
    }
  }

  function keyForSource(sourceUrl = "") {
    return normalizeLocalMediaFileUrl(sourceUrl) || String(sourceUrl || "").trim();
  }

  async function putStoredLocalMediaFileHandle(sourceUrl, handle, file = null) {
    const key = keyForSource(sourceUrl);
    if (!key) {
      throw new Error("本地媒体文件来源无效。");
    }
    const mediaFile = file || await handle.getFile();
    const entry = {
      key,
      sourceUrl: normalizeLocalMediaFileUrl(sourceUrl),
      handle,
      name: mediaFile?.name || "",
      size: Number(mediaFile?.size || 0) || 0,
      lastModified: Number(mediaFile?.lastModified || 0) || 0,
      updatedAt: Date.now()
    };
    await withStore("readwrite", store => requestToPromise(store.put(entry)));
    return entry;
  }

  async function getStoredLocalMediaFileEntry(keyOrSourceUrl = "") {
    const key = keyForSource(keyOrSourceUrl);
    if (!key) {
      return null;
    }
    return withStore("readonly", store => requestToPromise(store.get(key)));
  }

  async function ensureReadPermission(handle, options = {}) {
    if (!handle) {
      return "denied";
    }
    const permissionOptions = { mode: "read" };
    let permission = "granted";
    if (typeof handle.queryPermission === "function") {
      permission = await handle.queryPermission(permissionOptions).catch(() => "prompt");
    }
    if (permission !== "granted" && options.request && typeof handle.requestPermission === "function") {
      permission = await handle.requestPermission(permissionOptions).catch(() => permission);
    }
    return permission;
  }

  async function getStoredLocalMediaFile(keyOrSourceUrl = "") {
    const entry = await getStoredLocalMediaFileEntry(keyOrSourceUrl);
    if (!entry?.handle) {
      throw new Error("本地媒体文件尚未授权，请点击重新抽取并选择当前文件。");
    }
    const permission = await ensureReadPermission(entry.handle);
    if (permission !== "granted") {
      throw new Error("本地媒体文件授权已失效，请点击重新抽取并重新选择当前文件。");
    }
    const file = await entry.handle.getFile();
    return {
      key: entry.key,
      entry,
      file
    };
  }

  async function pickLocalMediaFileForSource(sourceUrl = "") {
    if (typeof showOpenFilePicker !== "function") {
      throw new Error("当前 Chrome 不支持本地文件授权，无法稳定读取本地 file:// 视频。");
    }
    const expectedName = localMediaFileNameFromUrl(sourceUrl);
    let handles;
    try {
      handles = await showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("已取消选择本地媒体文件。");
      }
      throw error;
    }
    const handle = handles?.[0];
    if (!handle) {
      throw new Error("没有选择本地媒体文件。");
    }
    const permission = await ensureReadPermission(handle, { request: true });
    if (permission !== "granted") {
      throw new Error("未获得本地媒体文件读取权限。");
    }
    const file = await handle.getFile();
    if (!namesLookCompatible(expectedName, file.name)) {
      throw new Error(`请选择当前正在播放的本地文件：${expectedName || file.name}`);
    }
    const entry = await putStoredLocalMediaFileHandle(sourceUrl, handle, file);
    return {
      key: entry.key,
      name: entry.name,
      size: entry.size,
      lastModified: entry.lastModified
    };
  }

  globalThis.FuguangLocalMediaFiles = {
    normalizeLocalMediaFileUrl,
    localMediaFileNameFromUrl,
    namesLookCompatible,
    pickLocalMediaFileForSource,
    getStoredLocalMediaFile,
    getStoredLocalMediaFileEntry,
    putStoredLocalMediaFileHandle
  };
})();
