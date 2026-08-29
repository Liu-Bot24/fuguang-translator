export const FuguangRequestSemaphore = (() => {
  const pools = new Map();

  async function withPermit(key, limit, task, signal = null) {
    const pool = getPool(key, limit);
    const release = await acquire(pool, signal);
    try {
      throwIfAborted(signal);
      return await task();
    } finally {
      release();
    }
  }

  function getPool(key, limit) {
    const normalizedKey = String(key || "default");
    const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 1));
    if (!pools.has(normalizedKey)) {
      pools.set(normalizedKey, { key: normalizedKey, limit: normalizedLimit, active: 0, queue: [] });
    }
    const pool = pools.get(normalizedKey);
    pool.limit = normalizedLimit;
    return pool;
  }

  function acquire(pool, signal) {
    throwIfAborted(signal);
    if (pool.active < pool.limit) {
      pool.active += 1;
      return Promise.resolve(createRelease(pool));
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, onAbort: null };
      waiter.onAbort = () => {
        const index = pool.queue.indexOf(waiter);
        if (index >= 0) {
          pool.queue.splice(index, 1);
        }
        reject(abortError(signal?.reason));
      };
      signal?.addEventListener?.("abort", waiter.onAbort, { once: true });
      pool.queue.push(waiter);
    });
  }

  function createRelease(pool) {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      pool.active = Math.max(0, pool.active - 1);
      drain(pool);
    };
  }

  function drain(pool) {
    while (pool.active < pool.limit && pool.queue.length) {
      const waiter = pool.queue.shift();
      waiter.signal?.removeEventListener?.("abort", waiter.onAbort);
      if (waiter.signal?.aborted) {
        waiter.reject(abortError(waiter.signal.reason));
        continue;
      }
      pool.active += 1;
      waiter.resolve(createRelease(pool));
    }
    if (!pool.active && !pool.queue.length) {
      pools.delete(pool.key);
    }
  }

  function providerKey(kind, config = {}) {
    const provider = String(config.providerType || kind || "unknown").trim().toLowerCase();
    const baseUrl = String(config.baseUrl || "").trim().replace(/\/+$/, "").toLowerCase();
    const model = String(config.model || "").trim().toLowerCase();
    return [String(kind || "request"), provider, baseUrl, model].join("|");
  }

  function retryAfterMs(headers, now = Date.now()) {
    const value = String(headers?.get?.("retry-after") || headers?.get?.("Retry-After") || "").trim();
    if (!value) {
      return 0;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(120_000, Math.round(seconds * 1000));
    }
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.max(0, Math.min(120_000, timestamp - Number(now || Date.now()))) : 0;
  }

  function delay(ms, signal = null) {
    const waitMs = Math.max(0, Number(ms) || 0);
    if (!waitMs) {
      throwIfAborted(signal);
      return Promise.resolve();
    }
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener?.("abort", onAbort);
        resolve();
      }, waitMs);
      const onAbort = () => {
        clearTimeout(timer);
        reject(abortError(signal?.reason));
      };
      signal?.addEventListener?.("abort", onAbort, { once: true });
    });
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) {
      throw abortError(signal.reason);
    }
  }

  function abortError(reason) {
    const error = new Error(reason?.message || "任务已停止。");
    error.name = "AbortError";
    return error;
  }

  function snapshot() {
    return [...pools.values()].map(pool => ({ key: pool.key, limit: pool.limit, active: pool.active, queued: pool.queue.length }));
  }

  return {
    delay,
    providerKey,
    retryAfterMs,
    snapshot,
    withPermit
  };
})();
