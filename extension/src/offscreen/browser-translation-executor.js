import { FuguangPaidRequestClient } from "../background/paid-request-client.js";
import { FuguangBrowserTranslationPipeline } from "../background/browser-translation-pipeline.js";
import { FuguangBrowserTranslationProvider } from "../background/browser-translation-provider.js";
import { FuguangPaidRequestRuntime } from "./paid-request-runtime.js";

export function createOffscreenBrowserTranslationExecutor(options = {}) {
  const paidRuntime = options.paidRuntime || null;
  const paidClient = options.paidClient || createPaidClient(paidRuntime || FuguangPaidRequestRuntime.getDefaultRuntime());
  const translateBrowserSegments = options.translateBrowserSegments || FuguangBrowserTranslationPipeline.translateBrowserSegments;
  const browserTranslationFailures = options.browserTranslationFailures || FuguangBrowserTranslationPipeline.browserTranslationFailures;

  return async function executeOffscreenBrowserTranslation(input = {}, context = {}) {
    const signal = context.signal || input.signal || null;
    throwIfAborted(signal);
    const executionContext = normalizeExecutionInput(input);
    const requestTransport = paidClient.createRequestTransport({
      jobId: executionContext.jobId,
      runToken: executionContext.runToken,
      executionOwnerId: executionContext.executionOwnerId,
      executionEpoch: executionContext.executionEpoch
    });
    try {
      const translated = await translateBrowserSegments(
        executionContext.sourceSegments,
        executionContext.translationConfig,
        executionContext.targetLanguage,
        executionContext.metadata,
        {
          batchWorkers: executionContext.batchWorkers,
          splitWorkers: executionContext.splitWorkers,
          maxConcurrency: executionContext.maxConcurrency,
          semanticRequestPath: executionContext.semanticRequestPath,
          requestTransport,
          onProgress: context.onProgress,
          signal
        }
      );
      return jsonSafeResult({
        segments: translated,
        failures: browserTranslationFailures(translated),
        error: null
      });
    } catch (error) {
      if (FuguangBrowserTranslationProvider.isBrowserTranslationAbortError(error, signal)) {
        throw abortError(signal?.reason || error);
      }
      return jsonSafeResult({
        segments: [],
        failures: [],
        error: {
          name: String(error?.name || "Error"),
          message: String(error?.message || error || "翻译失败。"),
          code: String(error?.code || ""),
          status: Number.isFinite(Number(error?.status)) ? Number(error.status) : 0,
          deliveryAmbiguous: FuguangBrowserTranslationProvider.browserTranslationErrorIsDeliveryAmbiguous(error)
        }
      });
    }
  };
}

function createPaidClient(paidRuntime) {
  return FuguangPaidRequestClient.create({
    dispatch: envelope => paidRuntime.handleRequest(envelope),
    cancel: envelope => paidRuntime.cancelRequest(envelope)
  });
}

function normalizeExecutionInput(input) {
  const jobId = requiredText(input.jobId, "jobId");
  const runToken = requiredText(input.runToken, "runToken");
  const executionOwnerId = requiredText(input.executionOwnerId, "executionOwnerId");
  const executionEpoch = positiveInteger(input.executionEpoch, "executionEpoch");
  const semanticRequestPath = requiredText(input.semanticRequestPath, "semanticRequestPath");
  const sourceSegments = Array.isArray(input.sourceSegments) ? jsonSafeClone(input.sourceSegments) : [];
  if (!sourceSegments.length) {
    throw new Error("Offscreen translation input has no source segments.");
  }
  const translationConfig = input.translationConfig && typeof input.translationConfig === "object"
    ? { ...input.translationConfig }
    : null;
  if (!translationConfig?.baseUrl || !translationConfig?.model || !translationConfig?.apiKey) {
    throw new Error("Offscreen translation input has no usable provider configuration.");
  }
  return {
    jobId,
    runToken,
    executionOwnerId,
    executionEpoch,
    semanticRequestPath,
    chunkIndex: Math.max(0, Number(input.chunkIndex) || 0),
    sourceSegments,
    targetLanguage: requiredText(input.targetLanguage, "targetLanguage"),
    metadata: jsonSafeClone(input.metadata || {}),
    translationConfig,
    batchWorkers: positiveIntegerOr(input.batchWorkers, 1),
    splitWorkers: positiveIntegerOr(input.splitWorkers, 1),
    maxConcurrency: positiveIntegerOr(input.maxConcurrency, 1)
  };
}

function jsonSafeResult(value) {
  return jsonSafeClone(value);
}

function jsonSafeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Offscreen translation requires ${field}.`);
  return text;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Offscreen translation requires positive ${field}.`);
  return number;
}

function positiveIntegerOr(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal.reason);
}

function abortError(reason) {
  const error = reason instanceof Error ? reason : new Error(String(reason || "任务已停止。"));
  error.name = "AbortError";
  return error;
}

let defaultExecutor = null;

export function executeOffscreenBrowserTranslation(input, context) {
  defaultExecutor ||= createOffscreenBrowserTranslationExecutor();
  return defaultExecutor(input, context);
}
