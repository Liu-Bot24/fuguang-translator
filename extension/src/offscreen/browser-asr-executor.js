import { FuguangPaidRequestClient } from "../background/paid-request-client.js";
import { FuguangBrowserAsrProvider } from "../background/browser-asr-provider.js";
import { FuguangBrowserAsrWorkflow } from "../background/browser-asr-workflow.js";
import { FuguangPaidRequestRuntime } from "./paid-request-runtime.js";

const AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache/";
const COLLECT_SPEECH_AUDIO = "FUGUANG_OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO";

export function createOffscreenBrowserAsrExecutor(options = {}) {
  const paidRuntime = options.paidRuntime || FuguangPaidRequestRuntime.getDefaultRuntime();
  const paidClient = options.paidClient || FuguangPaidRequestClient.create({
    dispatch: envelope => paidRuntime.handleRequest(envelope),
    cancel: envelope => paidRuntime.cancelRequest(envelope)
  });
  const transcribe = options.transcribe || FuguangBrowserAsrWorkflow.transcribeBrowserAudioChunk;
  const collectSpeechAudio = options.collectSpeechAudio || (payload => (
    globalThis.FuguangOffscreenAudio?.collectSpeechAudio(payload)
  ));
  const prepareLogicalAudio = options.prepareLogicalAudio || (payload => (
    globalThis.FuguangOffscreenAudio?.prepareDurableAsrLogicalAudio(payload)
  ));

  return async function executeOffscreenBrowserAsr(input = {}, context = {}) {
    const signal = context.signal || null;
    let latestDiagnostics = null;
    throwIfAborted(signal);
    const execution = normalizeExecutionInput(input);
    try {
      if (Array.isArray(execution.chunk.file?.parts) && execution.chunk.file.parts.length > 1) {
        const prepared = await prepareLogicalAudio({
          file: execution.chunk.file,
          webFfmpegUrl: execution.webFfmpegUrl,
          cacheNamespace: `${execution.jobId}-logical-${execution.runToken}-asr-${execution.chunkIndex}`,
          abortSignal: signal,
          jobId: execution.jobId,
          runToken: execution.runToken
        });
        throwIfAborted(signal);
        if (!prepared?.cacheUrl) throw Object.assign(new Error("Offscreen ASR failed to prepare a single logical audio file."), { asrStage: "audio-prepare" });
        execution.chunk.file = prepared;
      }
      const requestTransport = paidClient.createRequestTransport({
        jobId: execution.jobId,
        runToken: execution.runToken,
        executionOwnerId: execution.executionOwnerId,
        executionEpoch: execution.executionEpoch,
        provider: execution.asrConfig.providerType || "openai"
      });
      const artifactOperation = await createPrimaryArtifactOperation(execution);
      const result = await transcribe(execution.chunk, execution.asrConfig, {
      signal,
      jobId: execution.jobId,
      runToken: execution.runToken,
      semanticRequestPath: execution.semanticRequestPath,
      ...(execution.asrCapabilities ? {
        supportedRequestFields: execution.asrCapabilities.supportedRequestFields,
        speechTimestampsEndpoint: execution.asrCapabilities.speechTimestampsEndpoint
      } : {}),
      requestTransport,
      returnResultEnvelope: true,
      collectSpeechAudio: async payload => ({ ok: true, result: await collectSpeechAudio({
        ...payload,
        type: COLLECT_SPEECH_AUDIO,
        jobId: execution.jobId,
        runToken: execution.runToken,
        webFfmpegUrl: execution.webFfmpegUrl,
        cacheNamespace: `${execution.jobId}-logical-${execution.runToken}-asr-${execution.chunkIndex}-speech`,
        abortSignal: signal
      }).then(value => { throwIfAborted(signal); return value; }) }),
      async onPrimaryResult(primary) {
        throwIfAborted(signal);
        await paidRuntime.writeArtifact({
          operation: artifactOperation,
          ownership: {
            executionOwnerId: execution.executionOwnerId,
            executionEpoch: execution.executionEpoch
          },
          bodyText: JSON.stringify(primary)
        });
      },
      onDiagnostics(diagnostics) {
        latestDiagnostics = jsonSafeClone(diagnostics);
        context.onDiagnostics?.(latestDiagnostics);
      }
      });
      return jsonSafeClone(result);
    } catch (error) {
      if (FuguangBrowserAsrWorkflow.isBrowserAbortError(error, signal) || error?.code === "PAID_REQUEST_STALE_EXECUTION") throw error;
      return jsonSafeClone({
        segments: [],
        warning: null,
        diagnostics: error?.diagnostics || latestDiagnostics,
        error: {
          name: String(error?.name || "Error"),
          message: String(error?.message || error || "ASR failed."),
          code: String(error?.code || ""),
          status: Math.max(0, Number(error?.asrStatus ?? error?.status ?? 0) || 0),
          deliveryAmbiguous: isPaidRequestDeliveryAmbiguous(error),
          asrStage: String(
            error?.asrStage ||
            error?.diagnostics?.error?.stage ||
            error?.diagnostics?.stage ||
            latestDiagnostics?.error?.stage ||
            latestDiagnostics?.stage ||
            "transcription"
          )
        }
      });
    }
  };
}

function isPaidRequestDeliveryAmbiguous(error) {
  if (error?.deliveryAmbiguous === true) return true;
  return new Set([
    "PAID_REQUEST_DELIVERY_AMBIGUOUS",
    "PAID_REQUEST_DURABLE_RESULT_MISSING",
    "PAID_REQUEST_DURABLE_RESULT_CORRUPT"
  ]).has(String(error?.code || ""));
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
  const asrConfig = jsonSafeClone(input.asrConfig || {});
  if (!asrConfig.baseUrl || !asrConfig.apiKey || (FuguangBrowserAsrProvider.browserAsrProviderNeedsModel(asrConfig) && !asrConfig.model)) {
    throw new Error("Offscreen ASR input has no usable provider configuration.");
  }
  const asrCapabilities = normalizeAsrCapabilities(input.asrCapabilities);
  return {
    jobId,
    runToken,
    executionOwnerId,
    executionEpoch,
    semanticRequestPath,
    chunkIndex,
    chunk,
    asrConfig,
    asrCapabilities,
    webFfmpegUrl: requiredText(input.webFfmpegUrl, "webFfmpegUrl")
  };
}

function normalizeAsrCapabilities(value = {}) {
  if (!value || typeof value !== "object" ||
      (!Array.isArray(value.supportedRequestFields) && !Object.hasOwn(value, "speechTimestampsEndpoint"))) {
    return null;
  }
  const fields = Array.isArray(value?.supportedRequestFields)
    ? value.supportedRequestFields.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  return {
    supportedRequestFields: [...new Set(fields)],
    speechTimestampsEndpoint: String(value?.speechTimestampsEndpoint || "").trim()
  };
}

function validateAudioFile(file = {}) {
  const parts = Array.isArray(file.parts) && file.parts.length ? file.parts : [{ file }];
  for (const part of parts) {
    const target = part?.file || part;
    const ref = requiredText(target?.cacheUrl, "audio cacheRef");
    const url = new URL(ref);
    if (url.origin !== AUDIO_CACHE_ORIGIN || !url.pathname.startsWith(AUDIO_CACHE_PREFIX) || url.search || url.hash) {
      throw new Error("Offscreen ASR input contains a non-internal audio cache reference.");
    }
  }
}

async function createPrimaryArtifactOperation(execution) {
  const semantic = `${execution.semanticRequestPath}/primary-result`;
  const digest = await FuguangPaidRequestClient.sha256Hex(semantic, globalThis.crypto);
  return {
    jobId: execution.jobId,
    runToken: execution.runToken,
    operationId: `artifact:${digest}`,
    provider: execution.asrConfig.providerType || "openai",
    operationType: "asr-primary-result",
    inputHash: `sha256:${digest}`,
    batchStart: execution.chunkIndex,
    batchEnd: execution.chunkIndex + 1,
    retryAllowed: false,
    definitelyNotAccepted: false
  };
}

function assertJsonSafe(value, seen = new Set()) {
  if (value == null || typeof value !== "object") return;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
      (typeof Blob !== "undefined" && value instanceof Blob) ||
      (typeof FormData !== "undefined" && value instanceof FormData)) {
    throw new Error("Offscreen ASR execution input must be JSON-safe and cache-reference-only.");
  }
  if (seen.has(value)) return;
  seen.add(value);
  for (const item of Object.values(value)) assertJsonSafe(item, seen);
}

function jsonSafeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Offscreen ASR requires ${field}.`);
  return text;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Offscreen ASR requires positive ${field}.`);
  return number;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason || "任务已停止。"));
  error.name = "AbortError";
  throw error;
}

let defaultExecutor = null;

export function executeOffscreenBrowserAsr(input, context) {
  defaultExecutor ||= createOffscreenBrowserAsrExecutor();
  return defaultExecutor(input, context);
}
