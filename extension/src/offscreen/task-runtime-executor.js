import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";
import { executeOffscreenBrowserAsr } from "./browser-asr-executor.js";
import { executeOffscreenBrowserFunAsr } from "./browser-funasr-executor.js";
import { executeOffscreenBrowserTranslation } from "./browser-translation-executor.js";

export function createOffscreenTaskExecutor(options = {}) {
  const sendMessage = options.sendMessage || (message => globalThis.chrome.runtime.sendMessage(message));
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 6) || 6);
  const processMaxAttempts = Math.max(1, Number(options.processMaxAttempts ?? 1) || 1);
  const retryBaseMs = Math.max(0, Number(options.retryBaseMs ?? 500) || 0);
  const pollIntervalMs = Math.max(0, Number(options.pollIntervalMs ?? 500) || 0);
  const idlePollBaseMs = Math.max(0, Number(options.idlePollBaseMs ?? pollIntervalMs) || 0);
  const idlePollMaxMs = Math.max(
    idlePollBaseMs,
    Number(options.idlePollMaxMs ?? 30_000) || 30_000
  );
  const processMessageTimeoutMs = optionalTimeout(
    options.processMessageTimeoutMs ?? options.messageTimeoutMs
  );
  const controlMessageTimeoutMs = positiveTimeout(
    options.controlMessageTimeoutMs ?? options.messageTimeoutMs,
    15_000
  );
  const failMessageTimeoutMs = positiveTimeout(options.failMessageTimeoutMs, controlMessageTimeoutMs);
  const controlMaxAttempts = Math.max(1, Number(options.controlMaxAttempts ?? Math.min(maxAttempts, 3)) || 1);
  const failMaxAttempts = Math.max(1, Number(options.failMaxAttempts ?? 1) || 1);
  const executeAsr = options.executeAsr || executeOffscreenBrowserAsr;
  const executeFunAsr = options.executeFunAsr || executeOffscreenBrowserFunAsr;
  const executeTranslation = options.executeTranslation || executeOffscreenBrowserTranslation;

  return async function executeOffscreenJob(runtime = {}, context = {}) {
    const jobId = String(context.job?.id || "");
    const runToken = String(context.job?.runToken || "");
    const executionOwnerId = String(context.executionOwnerId || "");
    const executionEpoch = Math.max(0, Number(context.executionEpoch || 0) || 0);
    if (!jobId || !runToken || !executionOwnerId || !executionEpoch) {
      throw new Error("Offscreen execution requires job id, runToken, owner id and execution epoch.");
    }
    const executionFence = { executionOwnerId, executionEpoch };
    const lanes = [
      createWorkLane("asr", runtime.asrWorkers),
      createWorkLane("translation", runtime.translationWorkers)
    ];
    let stopResponse = null;
    let processError = null;
    let idlePollMs = idlePollBaseMs;
    let previousWorkState = "";

    const resetIdlePolling = () => {
      idlePollMs = idlePollBaseMs;
    };
    const waitForIdlePoll = async (signal = context.signal) => {
      const waitMs = idlePollMs;
      const result = typeof context.waitForWake === "function"
        ? await context.waitForWake(waitMs, signal)
        : await delay(waitMs, signal).then(() => ({ reason: "timeout" }));
      if (result?.reason === "wake") {
        resetIdlePolling();
      } else {
        idlePollMs = Math.min(idlePollMaxMs, Math.max(idlePollBaseMs, idlePollMs * 2));
      }
      return result || { reason: "timeout" };
    };

    const activePromises = () => lanes.flatMap(lane => [...lane.active.values()]);
    const waitForActive = () => Promise.allSettled(activePromises());
    const startPendingWork = lane => {
      while (lane.active.size < lane.concurrency && lane.pending.size) {
        const [chunkIndex] = lane.pending.keys();
        lane.pending.delete(chunkIndex);
        if (lane.dispatched.has(chunkIndex)) {
          continue;
        }
        lane.dispatched.add(chunkIndex);
        const processing = (lane.workType === "translation"
          ? executeLocalTranslationWork(chunkIndex)
          : (String(runtime.pipeline || context.job?.pipeline || "browser") !== "funasr" ||
              String(runtime.funAsrExecutionMode || "") === "offscreen-durable-v1"
              ? executeLocalAsrWork(chunkIndex)
              : sendWithRetry({
            type: FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK,
            jobId,
            runToken,
            ...executionFence,
            chunkIndex,
            workType: "asr",
            pipeline: String(runtime.pipeline || context.job?.pipeline || "browser")
          }, context.signal))
        ).then(response => {
          if (response?.retryable) {
            stopResponse = { ...response, interrupted: true, terminal: true };
          } else if (response?.interrupted || response?.terminal || response?.cancelled || response?.stale) {
            stopResponse = response;
          }
        }, error => {
          processError ||= error;
        }).finally(() => {
          lane.active.delete(chunkIndex);
          resetIdlePolling();
        });
        lane.active.set(chunkIndex, processing);
      }
    };

    const executeLocalTranslationWork = async chunkIndex => {
      const executionInput = await sendWithRetry({
        type: FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT,
        jobId,
        runToken,
        ...executionFence,
        chunkIndex,
        workType: "translation"
      }, context.signal);
      if (executionInput?.retryable || executionInput?.cancelled || executionInput?.stale || executionInput?.terminal || executionInput?.duplicate) {
        return executionInput;
      }
      if (!executionInput?.accepted || !executionInput?.input) {
        return { stale: true, reason: executionInput?.reason || "translation-input-unavailable" };
      }
      const reportProgress = createProgressReporter(chunkIndex);
      reportProgress({ phase: "started" });
      const result = await executeTranslation(executionInput.input, {
        signal: context.signal,
        onProgress: progress => reportProgress({ phase: "batch", ...progress })
      });
      reportProgress({ phase: "completed" }, true);
      return await sendWithRetry({
        type: FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT,
        jobId,
        runToken,
        ...executionFence,
        chunkIndex,
        workType: "translation",
        workResultId: `translation:${jobId}:${runToken}:${chunkIndex}`,
        result
      }, context.signal);
    };
    const executeLocalAsrWork = async chunkIndex => {
      const executionInput = await sendWithRetry({
        type: FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT,
        jobId,
        runToken,
        ...executionFence,
        chunkIndex,
        workType: "asr"
      }, context.signal);
      if (executionInput?.retryable || executionInput?.cancelled || executionInput?.stale || executionInput?.terminal || executionInput?.duplicate) {
        return executionInput;
      }
      if (!executionInput?.accepted || !executionInput?.input) {
        return { stale: true, reason: executionInput?.reason || "asr-input-unavailable" };
      }
      const isDurableFunAsr = String(runtime.pipeline || context.job?.pipeline || "browser") === "funasr" &&
        String(runtime.funAsrExecutionMode || "") === "offscreen-durable-v1";
      const result = await (isDurableFunAsr ? executeFunAsr : executeAsr)(executionInput.input, { signal: context.signal });
      return await sendWithRetry({
        type: FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT,
        jobId,
        runToken,
        ...executionFence,
        chunkIndex,
        workType: "asr",
        workResultId: `asr:${jobId}:${runToken}:${chunkIndex}`,
        result
      }, context.signal);
    };
    const createProgressReporter = chunkIndex => {
      let lastSentAt = 0;
      let pending = null;
      return (progress, force = false) => {
        const now = Date.now();
        if (!force && lastSentAt && now - lastSentAt < 250) {
          pending = progress;
          return;
        }
        const payload = force && pending ? { ...pending, ...progress } : progress;
        pending = null;
        lastSentAt = now;
        sendWithRetry({
          type: FuguangTaskRuntimeProtocol.MESSAGE.REPORT_JOB_WORK_PROGRESS,
          jobId,
          runToken,
          ...executionFence,
          chunkIndex,
          workType: "translation",
          progress: payload
        }, context.signal, { maxAttempts: 1, timeoutMs: 1_000 }).catch(() => null);
      };
    };
    const startAllPendingWork = () => lanes.forEach(startPendingWork);
    try {
      while (true) {
        throwIfAborted(context.signal);
        if (stopResponse) {
          await waitForActive();
          return stopResponse;
        }
        if (processError) {
          await waitForActive();
          throw processError;
        }
        startAllPendingWork();
        const work = await sendWithRetry({
          type: FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
          jobId,
          runToken,
          ...executionFence
        }, context.signal);
        if (work?.retryable) {
          resetIdlePolling();
          await delay(retryBaseMs, context.signal);
          continue;
        }
        if (work?.cancelled || work?.stale || work?.terminal) {
          await waitForActive();
          return work;
        }
        const workChunks = Array.isArray(work?.chunks) ? work.chunks : [];
        const asrWork = workChunks
          .filter(chunk => !chunk?.asrCompleted && !chunk?.processing)
          .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
        const translationItems = Array.isArray(work?.translations) ? work.translations : [];
        const translationWork = translationItems
          .filter(item => !item?.processing)
          .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
        const workState = durableWorkStateSignature(work, workChunks, translationItems);
        if (workState !== previousWorkState) {
          previousWorkState = workState;
          resetIdlePolling();
        }
        const availableByType = new Map([
          ["asr", asrWork],
          ["translation", translationWork]
        ]);
        for (const lane of lanes) {
          for (const item of availableByType.get(lane.workType) || []) {
            const chunkIndex = Number(item.index || 0);
            if (!lane.dispatched.has(chunkIndex)) {
              lane.pending.set(chunkIndex, item);
            }
          }
        }
        startAllPendingWork();
        if (stopResponse) {
          await waitForActive();
          return stopResponse;
        }
        if (processError) {
          await waitForActive();
          throw processError;
        }
        const hasServiceProcessing = workChunks.some(chunk => Boolean(chunk?.processing))
          || translationItems.some(item => Boolean(item?.processing));
        const hasLocalWork = lanes.some(lane => lane.active.size > 0 || lane.pending.size > 0);
        const hasAvailableWork = asrWork.length > 0 || translationWork.length > 0;
        if (hasAvailableWork) {
          resetIdlePolling();
        }
        if (work?.extractionDone && !hasAvailableWork && !hasServiceProcessing && !hasLocalWork) {
          throwIfAborted(context.signal);
          const finalized = await sendWithRetry({
            type: FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB,
            jobId,
            runToken,
            ...executionFence
          }, context.signal);
          if (finalized?.retryable) {
            resetIdlePolling();
            await delay(retryBaseMs, context.signal);
            continue;
          }
          if (!finalized?.inProgress) {
            return finalized;
          }
          if (finalized?.workPrepared) {
            resetIdlePolling();
            continue;
          }
        }
        const active = activePromises();
        if (active.length && work?.extractionDone && !lanes.some(lane => lane.pending.size)) {
          await Promise.race(active);
        } else if (active.length) {
          const idleController = new AbortController();
          const unlinkIdleAbort = linkAbortSignal(context.signal, idleController);
          const idle = waitForIdlePoll(idleController.signal).catch(error => {
            if (idleController.signal.aborted && !context.signal?.aborted) {
              return { reason: "superseded" };
            }
            throw error;
          });
          const outcome = await Promise.race([
            ...active.map(promise => promise.then(() => ({ reason: "active" }))),
            idle
          ]);
          if (outcome?.reason === "active") {
            idleController.abort(new Error("Active work completed."));
            await idle;
            resetIdlePolling();
          }
          unlinkIdleAbort();
        } else {
          await waitForIdlePoll();
        }
      }
    } catch (error) {
      let failResponse = null;
      if (!context.signal?.aborted) {
        failResponse = await sendWithRetry({
            type: FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB,
            jobId,
            runToken,
            ...executionFence,
            error: String(error?.message || error || "Offscreen task execution failed.")
          }, null, {
            maxAttempts: failMaxAttempts,
            timeoutMs: failMessageTimeoutMs
          })
          .catch(() => null);
      }
      const acknowledgedStatus = String(failResponse?.job?.status || "");
      if (failResponse?.interrupted || failResponse?.cancelled || failResponse?.stale || failResponse?.terminal ||
          acknowledgedStatus === "interrupted" ||
          ["cancelled", "completed", "completed_with_warnings", "failed"].includes(acknowledgedStatus)) {
        return failResponse;
      }
      throw error;
    }
  };

  async function sendWithRetry(message, signal, overrides = {}) {
    const policy = messagePolicy(message?.type);
    const attempts = Math.max(1, Number(overrides.maxAttempts ?? policy.maxAttempts) || 1);
    const timeoutMs = policy.timeoutMs > 0
      ? positiveTimeout(overrides.timeoutMs, policy.timeoutMs)
      : optionalTimeout(overrides.timeoutMs);
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
      // A lost response is ambiguous: the paid ASR request may already have completed.
      // Never resend it automatically; durable checkpoints or an explicit user retry decide what runs next.
      return { maxAttempts: processMaxAttempts, timeoutMs: processMessageTimeoutMs };
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
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          settle(reject, new Error("Service Worker task message timed out."));
        }, timeoutMs);
      }
      Promise.resolve()
        .then(() => {
          throwIfAborted(signal);
          return sendMessage(message);
        })
        .then(value => settle(resolve, value), error => settle(reject, error));
    });
  }
}

function durableWorkStateSignature(work, chunks, translations) {
  return JSON.stringify({
    extractionDone: Boolean(work?.extractionDone),
    chunks: chunks.map(chunk => [
      Number(chunk?.index || 0),
      Boolean(chunk?.asrCompleted),
      Boolean(chunk?.processing)
    ]),
    translations: translations.map(item => [Number(item?.index || 0), Boolean(item?.processing)])
  });
}

function linkAbortSignal(signal, controller) {
  if (!signal) {
    return () => {};
  }
  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => {};
  }
  const onAbort = () => controller.abort(signal.reason);
  signal.addEventListener?.("abort", onAbort, { once: true });
  return () => signal.removeEventListener?.("abort", onAbort);
}

function createWorkLane(workType, concurrency) {
  return {
    workType,
    concurrency: Math.max(1, Number(concurrency || 1) || 1),
    active: new Map(),
    pending: new Map(),
    dispatched: new Set()
  };
}

function positiveTimeout(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function optionalTimeout(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
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
