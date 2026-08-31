import { FuguangBrowserFunAsrProvider } from "../background/browser-funasr-provider.js";
import { FuguangPaidRequestClient } from "../background/paid-request-client.js";
import { FuguangPaidRequestRuntime } from "./paid-request-runtime.js";

const AUDIO_CACHE_NAME = "fuguang-web-ffmpeg-audio";
const AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache/";

export function createDurableFunAsrCancellationHandler(options = {}) {
  const jobStore = options.jobStore;
  const paidRuntime = options.paidRuntime || null;
  const cancelRemoteTask = options.cancelRemoteTask || FuguangBrowserFunAsrProvider.cancelDashScopeFunAsrTask;
  const queryRemoteTask = options.queryRemoteTask || FuguangBrowserFunAsrProvider.queryDashScopeFunAsrTask;
  const requestTransport = options.requestTransport || globalThis.fetch?.bind(globalThis);
  const timeoutMs = Math.max(1, Number(options.timeoutMs || options.remoteCancelTimeoutMs || 5_000) || 5_000);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const createClaimId = typeof options.createClaimId === "function" ? options.createClaimId : createFunAsrCancellationClaimId;
  const claimLeaseDurationMs = Math.max(1_000, Number(options.claimLeaseDurationMs || 30_000) || 30_000);
  const renewIntervalMs = Math.max(250, Math.min(
    claimLeaseDurationMs - 1,
    Number(options.renewIntervalMs || Math.floor(claimLeaseDurationMs / 3)) || Math.floor(claimLeaseDurationMs / 3)
  ));
  const setIntervalFn = options.setIntervalFn || globalThis.setInterval?.bind(globalThis);
  const clearIntervalFn = options.clearIntervalFn || globalThis.clearInterval?.bind(globalThis);
  if (!jobStore?.claimFunAsrRemoteCancellations ||
      !jobStore?.renewFunAsrRemoteCancellationClaim ||
      !jobStore?.completeFunAsrRemoteCancellation) {
    throw new Error("Durable Fun-ASR cancellation requires a job store.");
  }

  return async function cancelDurableFunAsrRemoteWork(input = {}) {
    const jobId = String(input.jobId || "");
    const runToken = String(input.runToken || "");
    const config = jsonSafeClone(input.funAsrConfig || {});
    if (!jobId || !runToken || !config.apiKey || !config.baseUrl || config.providerType !== "dashscope_funasr") {
      return { applied: false, reason: "not-funasr", outcomes: [] };
    }
    let candidates = Array.isArray(input.candidates) ? input.candidates : null;
    if (!candidates) {
      candidates = [];
      const submitOperations = (await jobStore.listOperations(jobId, runToken))
        .filter(operation => operation.provider === "dashscope_funasr" &&
          operation.operationType === "funasr-submit" && ["accepted", "completed"].includes(operation.state));
      for (const operation of submitOperations) {
        let remoteTaskId = String(operation.remoteTaskId || "");
        if (!remoteTaskId) {
          try {
            const replayRuntime = paidRuntime || FuguangPaidRequestRuntime.getDefaultRuntime();
            const replay = await replayRuntime.readCompletedFunAsrSubmitForCancellation(operation);
            remoteTaskId = parseFunAsrSubmitTaskId(replay?.bodyText);
          } catch {
            remoteTaskId = "";
          }
        }
        if (remoteTaskId) {
          candidates.push({
            operationId: operation.operationId,
            provider: operation.provider,
            operationType: operation.operationType,
            inputHash: operation.inputHash,
            remoteTaskId
          });
        }
      }
    }
    const claimedAt = now();
    const claimId = String(createClaimId() || createFunAsrCancellationClaimId());
    const claimed = await jobStore.claimFunAsrRemoteCancellations({
      jobId,
      runToken,
      claimId,
      claimedAt,
      claimLeaseDurationMs,
      requestedAt: Number(input.requestedAt || claimedAt),
      candidates
    });
    if (!claimed.applied) return { ...claimed, outcomes: [] };
    const outcomes = [];
    for (const claim of claimed.claims || []) {
      if (!claim.claimed) {
        outcomes.push(normalizeRemoteCancelOutcome(
          claim.outcome || { status: "unknown", message: "Remote cancellation was already requested." },
          claim.remoteTaskId
        ));
        continue;
      }
      const claimLease = createFunAsrCancellationClaimLease({
        jobStore,
        jobId,
        runToken,
        operationId: claim.operation?.operationId,
        claimId,
        claimLeaseDurationMs,
        renewIntervalMs,
        now,
        setIntervalFn,
        clearIntervalFn
      });
      try {
        let outcome;
        try {
          if (!await claimLease.renew()) continue;
          outcome = (claim.retrying || claim.tookOver)
            ? await resolveRetriedRemoteCancellation({
              taskId: claim.remoteTaskId,
              config,
              timeoutMs,
              requestTransport,
              queryRemoteTask,
              cancelRemoteTask
            })
            : normalizeRemoteCancelOutcome(await cancelRemoteTask(claim.remoteTaskId, config, {
              timeoutMs,
              requestTransport
            }), claim.remoteTaskId);
          outcome.message = redactKnownSecret(outcome.message, config.apiKey);
        } catch (error) {
          outcome = normalizeRemoteCancelOutcome({
            status: "unknown",
            message: redactKnownSecret(
              String(error?.message || error || "Fun-ASR cancellation acknowledgement is unknown."),
              config.apiKey
            )
          }, claim.remoteTaskId);
        }
        if (!await claimLease.renew()) continue;
        const completed = await jobStore.completeFunAsrRemoteCancellation({
          jobId,
          runToken,
          operationId: claim.operation.operationId,
          provider: claim.operation.provider,
          operationType: claim.operation.operationType,
          inputHash: claim.operation.inputHash,
          sourceOperationId: claim.operation.result?.submitOperationId,
          remoteTaskId: claim.remoteTaskId,
          claimId,
          outcome,
          completedAt: now()
        });
        if (!completed.applied) continue;
        outcomes.push(normalizeRemoteCancelOutcome(completed.operation?.result || outcome, claim.remoteTaskId));
      } finally {
        claimLease.stop();
      }
    }
    return { applied: true, outcomes };
  };
}

function createFunAsrCancellationClaimLease(options = {}) {
  let stopped = false;
  let lost = false;
  let renewing = null;
  const renew = async () => {
    if (stopped || lost) return false;
    if (renewing) return renewing;
    renewing = Promise.resolve(options.jobStore.renewFunAsrRemoteCancellationClaim({
      jobId: options.jobId,
      runToken: options.runToken,
      operationId: options.operationId,
      claimId: options.claimId,
      renewedAt: options.now(),
      claimLeaseDurationMs: options.claimLeaseDurationMs
    })).then(result => {
      if (!result?.applied) lost = true;
      return !lost;
    }, () => {
      lost = true;
      return false;
    }).finally(() => {
      renewing = null;
    });
    return renewing;
  };
  const timer = options.setIntervalFn?.(() => {
    void renew();
  }, options.renewIntervalMs);
  return {
    renew,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined && timer !== null) options.clearIntervalFn?.(timer);
    }
  };
}

function createFunAsrCancellationClaimId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `funasr-cancel:${uuid}`;
  return `funasr-cancel:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

async function resolveRetriedRemoteCancellation({
  taskId, config, timeoutMs, requestTransport, queryRemoteTask, cancelRemoteTask
}) {
  const query = await queryRemoteTask(taskId, config, { timeoutMs, requestTransport });
  const taskStatus = String(query?.taskStatus || "").toUpperCase();
  const recognizedTaskStatus = [
    "PENDING", "RUNNING", "PRE-PROCESSING", "POST-PROCESSING",
    "SUCCEEDED", "FAILED", "CANCELED"
  ].includes(taskStatus);
  if (!query?.known || !recognizedTaskStatus) {
    return normalizeRemoteCancelOutcome({
      status: "unknown",
      remoteTaskStatus: taskStatus,
      httpStatus: query?.httpStatus,
      message: query?.message || "Fun-ASR remote task status is still unknown."
    }, taskId);
  }
  if (taskStatus === "CANCELED") {
    return normalizeRemoteCancelOutcome({ status: "confirmed", remoteTaskStatus: taskStatus }, taskId);
  }
  if (taskStatus === "PENDING") {
    return normalizeRemoteCancelOutcome(await cancelRemoteTask(taskId, config, {
      timeoutMs,
      requestTransport
    }), taskId);
  }
  if (["RUNNING", "PRE-PROCESSING", "POST-PROCESSING"].includes(taskStatus)) {
    return normalizeRemoteCancelOutcome({
      status: "unknown",
      remoteTaskStatus: taskStatus,
      message: `Fun-ASR remote task is ${taskStatus}; cancellation cannot be confirmed until it reaches a terminal state.`
    }, taskId);
  }
  return normalizeRemoteCancelOutcome({
    status: "not-applied",
    remoteTaskStatus: taskStatus || "UNKNOWN",
    httpStatus: query?.httpStatus,
    message: query?.message || `Fun-ASR remote task is ${taskStatus || "UNKNOWN"}.`
  }, taskId);
}

export function createOffscreenBrowserFunAsrExecutor(options = {}) {
  const paidRuntime = options.paidRuntime || FuguangPaidRequestRuntime.getDefaultRuntime();
  const paidClient = options.paidClient || FuguangPaidRequestClient.create({
    dispatch: envelope => paidRuntime.handleRequest(envelope),
    cancel: envelope => paidRuntime.cancelRequest(envelope)
  });
  const upload = options.upload || FuguangBrowserFunAsrProvider.uploadDashScopeTemporaryFile;
  const submit = options.submit || FuguangBrowserFunAsrProvider.submitDashScopeFunAsrTask;
  const poll = options.poll || FuguangBrowserFunAsrProvider.waitDashScopeFunAsrTask;
  const cancelRemoteTask = options.cancelRemoteTask || FuguangBrowserFunAsrProvider.cancelDashScopeFunAsrTask;
  const fetchResult = options.fetchResult || FuguangBrowserFunAsrProvider.fetchDashScopeFunAsrResult;
  const nonPaidRequestTransport = options.nonPaidRequestTransport || globalThis.fetch?.bind(globalThis);
  const remoteCancelTimeoutMs = Math.max(1, Number(options.remoteCancelTimeoutMs || 5_000) || 5_000);
  const durableCancelRemoteTask = options.durableCancelRemoteTask || createDurableFunAsrCancellationHandler({
    jobStore: options.jobStore || paidRuntime.jobStore,
    paidRuntime,
    cancelRemoteTask,
    requestTransport: nonPaidRequestTransport,
    timeoutMs: remoteCancelTimeoutMs
  });
  const loadAudio = options.loadAudio || loadAudioCacheFile;
  const prepareLogicalAudio = options.prepareLogicalAudio || (payload => (
    globalThis.FuguangOffscreenAudio?.prepareDurableAsrLogicalAudio(payload)
  ));

  return async function executeOffscreenBrowserFunAsr(input = {}, context = {}) {
    const signal = context.signal || null;
    throwIfAborted(signal);
    const execution = normalizeExecutionInput(input);
    let remoteTaskId = "";
    let executionStage = "prepare";
    let disposeRemoteCancellation = () => {};
    try {
      const ownership = {
        executionOwnerId: execution.executionOwnerId,
        executionEpoch: execution.executionEpoch
      };
      // Bind the durable upload identity to the original logical input.  A
      // restored remote task must be able to replay its verified fileUrl even
      // after temporary source parts have been cleaned up; rebuilding those
      // parts is only necessary before the first upload.
      const uploadArtifact = await createUploadArtifactOperation(execution);
      let fileUrl = "";
      const restoredUpload = await paidRuntime.readArtifact({ operation: uploadArtifact, ownership });
      throwIfAborted(signal);
      if (restoredUpload) {
        fileUrl = parseUploadedFileUrl(restoredUpload.bodyText);
      } else {
        if (execution.chunk.file.parts?.length > 1) {
          const prepared = await prepareLogicalAudio({
            file: execution.chunk.file,
            webFfmpegUrl: execution.webFfmpegUrl,
            cacheNamespace: `${execution.jobId}-logical-${execution.runToken}-funasr-${execution.chunkIndex}`,
            abortSignal: signal,
            jobId: execution.jobId,
            runToken: execution.runToken
          });
          throwIfAborted(signal);
          if (!prepared?.cacheUrl) throw new Error("Offscreen Fun-ASR failed to prepare a logical audio file.");
          execution.chunk.file = prepared;
        }
        executionStage = "upload";
        const audioFile = await loadAudio(execution.chunk.file, signal);
        throwIfAborted(signal);
        fileUrl = await upload(audioFile, execution.funAsrConfig, {
          signal,
          deadlineAt: execution.deadlineAt
        });
        throwIfAborted(signal);
        await paidRuntime.writeArtifact({
          operation: uploadArtifact,
          ownership,
          bodyText: JSON.stringify({ fileUrl })
        });
      }
      if (!fileUrl) throw new Error("Fun-ASR upload did not produce a file URL.");

      const requestTransport = paidClient.createRequestTransport({
        jobId: execution.jobId,
        runToken: execution.runToken,
        executionOwnerId: execution.executionOwnerId,
        executionEpoch: execution.executionEpoch,
        provider: "dashscope_funasr"
      });
      const parameters = FuguangBrowserFunAsrProvider.buildDashScopeFunAsrParameters(
        execution.funAsrConfig,
        { chunksTotal: execution.chunksTotal, duration: execution.duration }
      );
      executionStage = "submit";
      const task = await submit({
        config: execution.funAsrConfig,
        model: execution.funAsrConfig.model,
        apiKey: execution.funAsrConfig.apiKey,
        fileUrls: [fileUrl],
        parameters,
        signal,
        deadlineAt: execution.deadlineAt,
        requestTransport,
        semanticRequestPath: `${execution.semanticRequestPath}/submit`,
        bodyIdentity: { model: execution.funAsrConfig.model, fileUrls: [fileUrl], parameters }
      });
      if (!task?.taskId || !task?.durableOperationId) {
        throw new Error("Fun-ASR durable submit did not return task identity.");
      }
      remoteTaskId = String(task.taskId);
      disposeRemoteCancellation = registerRemoteTaskCancellation({
        signal,
        jobId: execution.jobId,
        runToken: execution.runToken,
        taskId: remoteTaskId,
        config: execution.funAsrConfig,
        durableOperation: {
          operationId: task.durableOperationId,
          provider: "dashscope_funasr",
          operationType: "funasr-submit",
          inputHash: task.durableInputHash,
          remoteTaskId
        },
        durableCancelRemoteTask,
        onOutcome: context.onRemoteCancelOutcome
      });
      throwIfAborted(signal);
      await abortableFunAsrStep(paidRuntime.annotateOperation({
        operation: {
          jobId: execution.jobId,
          runToken: execution.runToken,
          operationId: task.durableOperationId,
          provider: "dashscope_funasr",
          operationType: "funasr-submit",
          inputHash: task.durableInputHash
        },
        ownership,
        remoteTaskId
      }), signal);
      await context.afterTaskSubmitted?.({ taskId: remoteTaskId, operationId: task.durableOperationId });
      throwIfAborted(signal);
      executionStage = "poll";
      const completed = await poll(remoteTaskId, execution.funAsrConfig, {
        signal,
        deadlineAt: execution.deadlineAt,
        requestTransport: nonPaidRequestTransport,
        semanticRequestPath: `${execution.semanticRequestPath}/task/${remoteTaskId}`,
        onProgress: context.onProgress
      });
      const resultUrl = FuguangBrowserFunAsrProvider.findDashScopeFunAsrTranscriptionUrl(completed);
      if (!resultUrl) throw new Error("Fun-ASR task completed without a transcription result URL.");
      executionStage = "result";
      const payload = await fetchResult(resultUrl, {
        signal,
        deadlineAt: execution.deadlineAt,
        requestTransport: nonPaidRequestTransport,
        semanticRequestPath: `${execution.semanticRequestPath}/task/${remoteTaskId}/result`,
        bodyIdentity: { taskId: remoteTaskId, resultUrl }
      });
      throwIfAborted(signal);
      executionStage = "normalize";
      const segments = FuguangBrowserFunAsrProvider.normalizeDashScopeFunAsrResult(
        payload,
        execution.chunk,
        { labelSpeakers: execution.labelSpeakers, chunkLabelIndex: execution.chunkIndex }
      );
      return jsonSafeClone({
        segments,
        warning: null,
        diagnostics: { stage: "completed", taskId: remoteTaskId },
        remoteTaskId
      });
    } catch (error) {
      if (signal?.aborted || error?.code === "PAID_REQUEST_STALE_EXECUTION") throw error;
      const remoteResumeRequired = Boolean(remoteTaskId) &&
        ["poll", "result"].includes(executionStage) &&
        String(error?.code || "") !== "FUNASR_REMOTE_TERMINAL";
      return jsonSafeClone({
        segments: [], warning: null, diagnostics: { stage: "funasr" },
        remoteTaskId,
        resumeRemoteTask: remoteResumeRequired,
        error: {
          name: String(error?.name || "Error"),
          message: String(error?.message || error || "Fun-ASR failed."),
          code: String(error?.code || ""),
          status: Math.max(0, Number(error?.status || 0) || 0),
          deliveryAmbiguous: isDeliveryAmbiguous(error),
          asrStage: remoteResumeRequired ? "funasr_remote_pending" : executionStage
        }
      });
    } finally {
      disposeRemoteCancellation();
    }
  };
}

function registerRemoteTaskCancellation({
  signal, jobId, runToken, taskId, config, durableOperation, durableCancelRemoteTask, onOutcome
}) {
  if (!signal) return () => {};
  let started = false;
  const start = () => {
    if (started) return;
    if (String(signal.reason?.code || "") !== "FUGUANG_TASK_CANCEL_REQUESTED") return;
    started = true;
    let request;
    try {
      request = durableCancelRemoteTask({
        jobId,
        runToken,
        funAsrConfig: config,
        candidates: [durableOperation]
      }).then(result => result?.outcomes?.[0] || {
        status: "unknown",
        message: result?.reason || "Fun-ASR cancellation was not applied."
      });
    } catch (error) {
      request = Promise.reject(error);
    }
    Promise.resolve(request).then(
      outcome => normalizeRemoteCancelOutcome(outcome, taskId),
      error => normalizeRemoteCancelOutcome({
        status: "unknown",
        message: String(error?.message || error || "Fun-ASR cancellation acknowledgement is unknown.")
      }, taskId)
    ).then(outcome => {
      try {
        onOutcome?.(outcome);
      } catch {
        // Cancellation reporting must never delay or replace the local abort.
      }
    });
  };
  signal.addEventListener?.("abort", start, { once: true });
  if (signal.aborted) start();
  return () => signal.removeEventListener?.("abort", start);
}

function normalizeRemoteCancelOutcome(outcome, taskId) {
  const status = ["confirmed", "not-applied", "unknown"].includes(String(outcome?.status || ""))
    ? String(outcome.status)
    : "unknown";
  return {
    status,
    confirmed: status === "confirmed",
    taskId: String(taskId || ""),
    httpStatus: Math.max(0, Number(outcome?.httpStatus || 0) || 0),
    remoteTaskStatus: String(outcome?.remoteTaskStatus || ""),
    message: String(outcome?.message || "")
  };
}

function redactKnownSecret(value, secret) {
  const text = String(value || "");
  const known = String(secret || "");
  return known ? text.split(known).join("[REDACTED]") : text;
}

async function abortableFunAsrStep(step, signal) {
  if (!signal) return await step;
  throwIfAborted(signal);
  return await new Promise((resolve, reject) => {
    let settled = false;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      signal.removeEventListener?.("abort", onAbort);
      callback(value);
    };
    const onAbort = () => {
      try {
        throwIfAborted(signal);
      } catch (error) {
        finish(reject)(error);
      }
    };
    signal.addEventListener?.("abort", onAbort, { once: true });
    Promise.resolve(step).then(finish(resolve), finish(reject));
    if (signal.aborted) onAbort();
  });
}

async function createUploadArtifactOperation(execution) {
  const semantic = JSON.stringify({
    path: `${execution.semanticRequestPath}/uploaded-file`,
    file: durableAudioFileIdentity(execution.chunk.file)
  });
  const digest = await FuguangPaidRequestClient.sha256Hex(semantic, globalThis.crypto);
  return {
    jobId: execution.jobId,
    runToken: execution.runToken,
    operationId: `artifact:${digest}`,
    provider: "dashscope_funasr",
    operationType: "funasr-uploaded-file",
    inputHash: `sha256:${digest}`,
    batchStart: execution.chunkIndex,
    batchEnd: execution.chunkIndex + 1,
    retryAllowed: false,
    definitelyNotAccepted: false
  };
}

function durableAudioFileIdentity(file = {}) {
  if (Array.isArray(file.parts) && file.parts.length) {
    return {
      parts: file.parts.map(part => durableAudioFileIdentity(part?.file || part))
    };
  }
  return {
    cacheUrl: String(file.cacheUrl || ""),
    name: String(file.name || ""),
    mime: String(file.mime || ""),
    bytes: Math.max(0, Number(file.bytes || 0) || 0)
  };
}

async function loadAudioCacheFile(file = {}, signal = null) {
  throwIfAborted(signal);
  const cacheUrl = validateCacheRef(file.cacheUrl);
  const cache = await globalThis.caches.open(AUDIO_CACHE_NAME);
  const response = await cache.match(cacheUrl);
  if (!response) throw new Error("Fun-ASR audio cache entry is unavailable.");
  const buffer = await response.arrayBuffer();
  throwIfAborted(signal);
  return {
    name: String(file.name || "audio.mp3"),
    mime: String(file.mime || response.headers?.get?.("content-type") || "audio/mpeg"),
    buffer
  };
}

function normalizeExecutionInput(input = {}) {
  assertJsonSafe(input);
  const jobId = requiredText(input.jobId, "jobId");
  const runToken = requiredText(input.runToken, "runToken");
  const executionOwnerId = requiredText(input.executionOwnerId, "executionOwnerId");
  const executionEpoch = positiveInteger(input.executionEpoch, "executionEpoch");
  const semanticRequestPath = requiredText(input.semanticRequestPath, "semanticRequestPath");
  const chunkIndex = Math.max(0, Number(input.chunkIndex) || 0);
  const chunk = jsonSafeClone(input.chunk || {});
  validateAudioFile(chunk.file);
  const funAsrConfig = jsonSafeClone(input.funAsrConfig || input.asrConfig || {});
  if (!funAsrConfig.apiKey || !funAsrConfig.model) throw new Error("Offscreen Fun-ASR has no usable provider configuration.");
  return {
    jobId, runToken, executionOwnerId, executionEpoch, semanticRequestPath, chunkIndex, chunk, funAsrConfig,
    webFfmpegUrl: String(input.webFfmpegUrl || ""),
    chunksTotal: Math.max(1, Number(input.chunksTotal || 1) || 1),
    duration: Math.max(0, Number(input.duration || 0) || 0),
    labelSpeakers: Boolean(input.labelSpeakers),
    deadlineAt: Math.max(0, Number(input.deadlineAt || 0) || 0)
  };
}

function validateAudioFile(file = {}) {
  const parts = Array.isArray(file.parts) && file.parts.length ? file.parts : [{ file }];
  for (const part of parts) validateCacheRef((part?.file || part)?.cacheUrl);
}

function validateCacheRef(ref) {
  const url = new URL(requiredText(ref, "audio cacheRef"));
  if (url.origin !== AUDIO_CACHE_ORIGIN || !url.pathname.startsWith(AUDIO_CACHE_PREFIX) || url.search || url.hash) {
    throw new Error("Offscreen Fun-ASR input contains a non-internal audio cache reference.");
  }
  return url.href;
}

function parseUploadedFileUrl(bodyText) {
  try {
    return String(JSON.parse(String(bodyText || "")).fileUrl || "");
  } catch {
    throw new Error("Durable Fun-ASR upload artifact is invalid.");
  }
}

function parseFunAsrSubmitTaskId(bodyText) {
  if (!bodyText) return "";
  try {
    const body = JSON.parse(String(bodyText));
    return String(body?.output?.task_id || body?.task_id || "").trim();
  } catch {
    return "";
  }
}

function isDeliveryAmbiguous(error) {
  return error?.deliveryAmbiguous === true || new Set([
    "PAID_REQUEST_DELIVERY_AMBIGUOUS",
    "PAID_REQUEST_DURABLE_RESULT_MISSING",
    "PAID_REQUEST_DURABLE_RESULT_CORRUPT",
    "PAID_REQUEST_STORE_REJECTED"
  ]).has(String(error?.code || ""));
}

function assertJsonSafe(value, seen = new Set()) {
  if (value == null || typeof value !== "object") return;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
      (typeof Blob !== "undefined" && value instanceof Blob) ||
      (typeof FormData !== "undefined" && value instanceof FormData)) {
    throw new Error("Offscreen Fun-ASR execution input must be JSON-safe and cache-reference-only.");
  }
  if (seen.has(value)) return;
  seen.add(value);
  for (const item of Object.values(value)) assertJsonSafe(item, seen);
}

function jsonSafeClone(value) { return JSON.parse(JSON.stringify(value)); }

function requiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Offscreen Fun-ASR requires ${field}.`);
  return text;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Offscreen Fun-ASR requires positive ${field}.`);
  return number;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason || "任务已停止。"));
  error.name = "AbortError";
  throw error;
}

let defaultExecutor = null;
export function executeOffscreenBrowserFunAsr(input, context) {
  defaultExecutor ||= createOffscreenBrowserFunAsrExecutor();
  return defaultExecutor(input, context);
}
