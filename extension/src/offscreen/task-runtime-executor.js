import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";

export function createOffscreenTaskExecutor(options = {}) {
  const sendMessage = options.sendMessage || (message => globalThis.chrome.runtime.sendMessage(message));
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 6) || 6);
  const retryBaseMs = Math.max(0, Number(options.retryBaseMs ?? 500) || 0);
  const pollIntervalMs = Math.max(0, Number(options.pollIntervalMs ?? 500) || 0);
  const processMessageTimeoutMs = positiveTimeout(
    options.processMessageTimeoutMs ?? options.messageTimeoutMs,
    2 * 60 * 60_000 + 60_000
  );
  const controlMessageTimeoutMs = positiveTimeout(
    options.controlMessageTimeoutMs ?? options.messageTimeoutMs,
    15_000
  );
  const failMessageTimeoutMs = positiveTimeout(options.failMessageTimeoutMs, controlMessageTimeoutMs);
  const controlMaxAttempts = Math.max(1, Number(options.controlMaxAttempts ?? Math.min(maxAttempts, 3)) || 1);
  const failMaxAttempts = Math.max(1, Number(options.failMaxAttempts ?? 1) || 1);

  return async function executeOffscreenJob(runtime = {}, context = {}) {
    const jobId = String(context.job?.id || "");
    const runToken = String(context.job?.runToken || "");
    const executionOwnerId = String(context.executionOwnerId || "");
    const executionEpoch = Math.max(0, Number(context.executionEpoch || 0) || 0);
    if (!jobId || !runToken || !executionOwnerId || !executionEpoch) {
      throw new Error("Offscreen execution requires job id, runToken, owner id and execution epoch.");
    }
    const executionFence = { executionOwnerId, executionEpoch };
    try {
      while (true) {
        throwIfAborted(context.signal);
        const work = await sendWithRetry({
          type: FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
          jobId,
          runToken,
          ...executionFence
        }, context.signal);
        if (work?.cancelled || work?.stale || work?.terminal) {
          return work;
        }
        const workChunks = Array.isArray(work?.chunks) ? work.chunks : [];
        const hasProcessingChunks = workChunks.some(chunk => Boolean(chunk?.processing));
        const chunks = workChunks
          .filter(chunk => !chunk?.asrCompleted && !chunk?.processing)
          .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
        let stopResponse = null;
        const queue = [...chunks];
        const concurrency = Math.max(1, Math.min(
          Number(runtime.asrWorkers || 1) || 1,
          queue.length || 1
        ));
        const workers = Array.from({ length: concurrency }, async () => {
          while (queue.length && !stopResponse) {
            const chunk = queue.shift();
            if (!chunk) {
              return;
            }
            const response = await sendWithRetry({
              type: FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK,
              jobId,
              runToken,
              ...executionFence,
              chunkIndex: Number(chunk.index || 0),
              pipeline: String(runtime.pipeline || context.job?.pipeline || "browser")
            }, context.signal);
            if (response?.cancelled || response?.stale) {
              stopResponse = response;
            }
          }
        });
        await Promise.all(workers);
        if (stopResponse) {
          return stopResponse;
        }
        if (work?.extractionDone && !chunks.length && !hasProcessingChunks) {
          throwIfAborted(context.signal);
          const finalized = await sendWithRetry({
            type: FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB,
            jobId,
            runToken,
            ...executionFence
          }, context.signal);
          if (!finalized?.inProgress) {
            return finalized;
          }
        }
        await delay(pollIntervalMs, context.signal);
      }
    } catch (error) {
      if (!context.signal?.aborted) {
        await sendWithRetry({
          type: FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB,
          jobId,
          runToken,
          ...executionFence,
          error: String(error?.message || error || "Offscreen task execution failed.")
        }, null, {
          maxAttempts: failMaxAttempts,
          timeoutMs: failMessageTimeoutMs
        }).catch(() => {});
      }
      throw error;
    }
  };

  async function sendWithRetry(message, signal, overrides = {}) {
    const policy = messagePolicy(message?.type);
    const attempts = Math.max(1, Number(overrides.maxAttempts ?? policy.maxAttempts) || 1);
    const timeoutMs = positiveTimeout(overrides.timeoutMs, policy.timeoutMs);
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      throwIfAborted(signal);
      try {
        const response = await sendMessageWithControls(message, signal, timeoutMs);
        if (response?.ok === false) {
          throw new Error(response.error || "Service Worker rejected the offscreen task operation.");
        }
        return response || {};
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= attempts) {
          break;
        }
        await delay(Math.min(5000, retryBaseMs * (2 ** attempt)), signal);
      }
    }
    throw lastError || new Error("Offscreen task operation failed.");
  }

  function messagePolicy(type) {
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
      return { maxAttempts, timeoutMs: processMessageTimeoutMs };
    }
    return { maxAttempts: controlMaxAttempts, timeoutMs: controlMessageTimeoutMs };
  }

  function sendMessageWithControls(message, signal, timeoutMs) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const cleanup = () => {
        if (timer != null) {
          clearTimeout(timer);
          timer = null;
        }
        signal?.removeEventListener?.("abort", onAbort);
      };
      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        callback(value);
      };
      const onAbort = () => {
        const error = new Error(signal?.reason?.message || "Task cancellation requested.");
        error.name = "AbortError";
        settle(reject, error);
      };
      signal?.addEventListener?.("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        settle(reject, new Error("Service Worker task message timed out."));
      }, timeoutMs);
      Promise.resolve()
        .then(() => {
          throwIfAborted(signal);
          return sendMessage(message);
        })
        .then(value => settle(resolve, value), error => settle(reject, error));
    });
  }
}

function positiveTimeout(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error(signal.reason?.message || "Task cancellation requested.");
  error.name = "AbortError";
  throw error;
}

function delay(ms, signal) {
  if (!ms) {
    throwIfAborted(signal);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const error = new Error(signal.reason?.message || "Task cancellation requested.");
      error.name = "AbortError";
      reject(error);
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

export const executeOffscreenJob = createOffscreenTaskExecutor();
