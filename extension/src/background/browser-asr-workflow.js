import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";
import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";
import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";

export const FuguangBrowserAsrWorkflow = (() => {
  const normalizeAsrTimeoutMs = FuguangBrowserAsrProvider.normalizeAsrTimeoutMs;
  const browserAsrRequestFields = FuguangBrowserAsrProvider.browserAsrRequestFields;
  const browserAsrClipTimestampsValue = FuguangBrowserAsrProvider.browserAsrClipTimestampsValue;
  const asrRequestFieldSupported = FuguangBrowserAsrProvider.asrRequestFieldSupported;
  const resolveBrowserAsrSupportedRequestFields = FuguangBrowserAsrProvider.resolveBrowserAsrSupportedRequestFields;
  const resolveBrowserAsrSpeechTimestampsEndpoint = FuguangBrowserAsrProvider.resolveBrowserAsrSpeechTimestampsEndpoint;
  const normalizeAsrVadFilterMode = FuguangBrowserAsrProvider.normalizeAsrVadFilterMode;
  const browserAsrEndpoint = FuguangBrowserAsrProvider.browserAsrEndpoint;
  const normalizeProviderType = FuguangBrowserModelProfiles.normalizeProviderType;
  const filterAsrSegmentsByChunkOwnership = FuguangBrowserAsrPostprocess.filterAsrSegmentsByChunkOwnership;
  const filterAsrSegmentsByHallucinationGuard = FuguangBrowserAsrPostprocess.filterAsrSegmentsByHallucinationGuard;
  const filterAsrSegmentsBySpeechActivity = FuguangBrowserAsrPostprocess.filterAsrSegmentsBySpeechActivity;
  const filterAsrStrictVadRecoverySegments = FuguangBrowserAsrPostprocess.filterAsrStrictVadRecoverySegments;
  const mergeAdjacentDuplicateAsrSegments = FuguangBrowserAsrPostprocess.mergeAdjacentDuplicateAsrSegments;
  const normalizeAsrSegments = FuguangBrowserAsrPostprocess.normalizeAsrSegments;
  const normalizeAsrSpeechIntervals = FuguangBrowserAsrPostprocess.normalizeAsrSpeechIntervals;
  const BROWSER_ABORT_ERROR_BRAND = Symbol("fuguang.browser.asr-workflow.abort-error");
  const BROWSER_ASR_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
  const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_LONG_CHUNK_SECONDS = 5 * 60;
  const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MAX_VALUE = 1000;
  const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MIN_SPAN = 45;
  const BROWSER_ASR_MATURE_MAX_SPEECH_DURATION_SECONDS = 30;
  const BROWSER_ASR_LONG_SPEECH_INTERVAL_TOLERANCE_SECONDS = 0.5;
  const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";

  function cleanVttText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  function browserAsrMaxUploadBytes(asrConfig = {}) {
    const directBytes = Number(asrConfig?.maxUploadBytes || asrConfig?.maxFileBytes || 0);
    if (Number.isFinite(directBytes) && directBytes > 0) return Math.floor(directBytes);
    const mb = Number(asrConfig?.maxUploadMb || asrConfig?.maxFileSizeMb || 0);
    if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
    return BROWSER_ASR_MAX_UPLOAD_BYTES;
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
    if (value >= 1024) return `${Math.round((value / 1024) * 10) / 10} KB`;
    return `${Math.round(value)} B`;
  }

  async function getBrowserAudioChunkBuffer(file) {
    if (file?.buffer instanceof ArrayBuffer) {
      return file.buffer;
    }
    if (Array.isArray(file?.parts) && file.parts.length) {
      throw new Error("识别音频分段仍由多个 MP3 片段组成，不能直接字节拼接上传；请重新抽取音频。");
    }
    if (file?.cacheUrl) {
      const url = new URL(String(file.cacheUrl));
      if (url.origin !== "https://fuguang.local" || !url.pathname.startsWith("/__fuguang_audio_cache/")) {
        throw new Error("识别音频分段引用了无效的内部缓存地址。");
      }
      const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
      const response = await cache.match(url.toString());
      if (!response) {
        throw new Error("浏览器内音频缓存已失效，请重新抽取音频。");
      }
      return response.arrayBuffer();
    }
    throw new Error("识别音频分段缺少可上传的数据。");
  }
function isUsableBrowserAudioFile(file) {
  if (file?.buffer instanceof ArrayBuffer || Boolean(file?.cacheUrl)) {
    return true;
  }
  if (Array.isArray(file?.parts) && file.parts.length) {
    return file.parts.every(part => isUsableBrowserAudioFile(part?.file || part));
  }
  return false;
}

function browserAudioFileByteLength(file) {
  if (file?.buffer instanceof ArrayBuffer) {
    return file.buffer.byteLength;
  }
  if (Array.isArray(file?.parts)) {
    return file.parts.reduce((sum, part) => sum + browserAudioFileByteLength(part?.file || part), 0);
  }
  return Number(file?.bytes || 0) || 0;
}

function assertBrowserAsrChunkCanUpload(chunk = {}, asrConfig = {}, byteLength = null, fileBuffer = null) {
  if (Array.isArray(chunk.file?.parts) && chunk.file.parts.length) {
    throw new Error("识别音频分段仍由多个 MP3 片段组成，不能直接字节拼接上传；请重新抽取音频。");
  }
  const bytes = Math.max(
    0,
    Number(byteLength) || browserAudioFileByteLength(chunk.file) || Number(chunk.bytes || 0) || 0
  );
  const maxBytes = browserAsrMaxUploadBytes(asrConfig);
  if (bytes > maxBytes) {
    throw new Error(`识别音频分段过大（${formatBytes(bytes)}），超过当前 ASR 上传限制（${formatBytes(maxBytes)}）。请降低 ASR 上传窗口或改用支持长文件的 ASR。`);
  }
  if (fileBuffer instanceof ArrayBuffer) {
    assertBrowserAsrUploadAudioBytes(chunk.file || {}, fileBuffer);
  }
}

function assertBrowserAsrUploadAudioBytes(file = {}, buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 8) {
    return;
  }
  const kind = browserAsrExpectedAudioContainer(file);
  if (!kind) {
    return;
  }
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 64 * 1024));
  const valid = kind === "wav"
    ? browserAsrBytesLookLikeWav(bytes)
    : browserAsrBytesLookLikeMp3(bytes);
  if (valid) {
    return;
  }
  throw new Error(`ASR 音频格式校验失败：${file.name || "音频分段"} 标记为 ${file.mime || kind}，但文件头不是有效的 ${kind.toUpperCase()} 音频；请重新抽取音频。`);
}

function browserAsrExpectedAudioContainer(file = {}) {
  const mime = String(file.mime || "").split(";")[0].trim().toLowerCase();
  const name = String(file.name || "").split(/[?#]/)[0].toLowerCase();
  if (mime === "audio/wav" || mime === "audio/x-wav" || /\.wav$/i.test(name)) {
    return "wav";
  }
  if (mime === "audio/mpeg" || mime === "audio/mp3" || /\.mp3$/i.test(name)) {
    return "mp3";
  }
  return "";
}

function browserAsrBytesLookLikeWav(bytes) {
  return bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x41
    && bytes[10] === 0x56
    && bytes[11] === 0x45;
}

function browserAsrBytesLookLikeMp3(bytes) {
  if (!bytes || bytes.length < 2) {
    return false;
  }
  const start = browserAsrMp3AudioFrameScanStart(bytes);
  for (let index = start; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) {
      return true;
    }
  }
  return false;
}

function browserAsrMp3AudioFrameScanStart(bytes) {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return 0;
  }
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);
  const footerSize = (bytes[5] & 0x10) ? 10 : 0;
  return Math.min(bytes.length, 10 + tagSize + footerSize);
}

async function transcribeBrowserAudioChunk(chunk, asrConfig, options = {}) {
  const endpoint = browserAsrEndpoint(asrConfig);
  const timeoutMs = normalizeAsrTimeoutMs(asrConfig?.timeoutMs, chunk);
  const supportedRequestFields = await resolveBrowserAsrSupportedRequestFields(asrConfig, { signal: options.signal });
  const speechTimestampsEndpoint = await resolveBrowserAsrSpeechTimestampsEndpoint(asrConfig, { signal: options.signal });
  const useExternalVadPrecheck = shouldUseBrowserAsrExternalVadPrecheck(supportedRequestFields, speechTimestampsEndpoint);
  const nativeVadAvailable = shouldUseBrowserAsrNativeVadTranscription(supportedRequestFields, speechTimestampsEndpoint);
  const fileName = chunk.file?.name || `chunk-${chunk.index + 1}.mp3`;
  assertBrowserAsrChunkCanUpload(chunk, asrConfig);
  const getAudioBuffer = options.getAudioBuffer || getBrowserAudioChunkBuffer;
  const fileBuffer = await getAudioBuffer(chunk.file);
  assertBrowserAsrChunkCanUpload(chunk, asrConfig, fileBuffer.byteLength, fileBuffer);
  const diagnostics = {
    chunk: browserAsrDiagnosticChunkInfo(chunk),
    request: {
      endpoint: sanitizeDiagnosticUrl(endpoint),
      timeoutMs,
      fields: [],
      authorizationIncluded: false
    },
    vad: null,
    rawPayload: null,
    normalizedSegments: [],
    speechFilteredSegments: [],
    hallucinationFilteredSegments: [],
    finalSegments: [],
    matureAsrPlan: null,
    collectedSpeech: null,
    postprocess: null
  };
  const reliableSpeechIntervals = useExternalVadPrecheck
    ? await detectBrowserAsrSpeechIntervals(chunk, asrConfig, fileBuffer, fileName, diagnostics, {
        endpoint: speechTimestampsEndpoint,
        signal: options.signal,
        requestTransport: options.requestTransport,
        semanticRequestPath: asrSemanticRequestPath(options, "vad/precheck")
      })
    : null;
  const effectiveChunk = Array.isArray(reliableSpeechIntervals)
    ? { ...chunk, speechIntervals: reliableSpeechIntervals, speechIntervalsReliable: undefined }
    : chunk;
  const clipTimestampsSkippedReason = browserAsrClipTimestampsSkippedReason(reliableSpeechIntervals, supportedRequestFields);
  if (clipTimestampsSkippedReason && diagnostics.vad) {
    diagnostics.vad.clipTimestampsSkippedReason = clipTimestampsSkippedReason;
  }
  const clipTimestamps = Array.isArray(reliableSpeechIntervals) && !clipTimestampsSkippedReason
    ? browserAsrClipTimestampsValue(reliableSpeechIntervals, effectiveChunk)
    : "";
  const matureAsrPlan = createBrowserAsrMaturePlan({
    reliableSpeechIntervals,
    clipTimestamps,
    clipTimestampsSkippedReason,
    diagnostics,
    nativeVadAvailable,
    speechTimestampsEndpointAvailable: Boolean(speechTimestampsEndpoint)
  });
  diagnostics.matureAsrPlan = cloneJsonForDiagnostics(matureAsrPlan);
  if (shouldUseBrowserAsrCollectedSpeechAudio(reliableSpeechIntervals, supportedRequestFields, speechTimestampsEndpoint, clipTimestamps, asrConfig)) {
    try {
      return await transcribeBrowserCollectedSpeechAudioChunk({
        endpoint,
        timeoutMs,
        asrConfig,
        supportedRequestFields,
        sourceChunk: effectiveChunk,
        fileBuffer,
        fileName,
        reliableSpeechIntervals,
        matureAsrPlan,
        diagnostics,
        options
      });
    } catch (error) {
      diagnostics.chunk = browserAsrDiagnosticChunkInfo(effectiveChunk);
      applyBrowserAsrErrorDiagnostics(diagnostics, error);
      emitBrowserAsrDiagnostics(options, diagnostics);
      throw error;
    }
  }
  let transcription = null;
  let postprocessed = null;
  let recoveryWarning = null;
  try {
    try {
      transcription = await requestBrowserAsrTranscription({
        endpoint,
        timeoutMs,
        asrConfig,
        supportedRequestFields,
        effectiveChunk,
        fileBuffer,
        fileName,
        clipTimestamps,
        matureAsrPlan,
        signal: options.signal,
        disableVadFilter: shouldDisableBrowserAsrServerVadForRecall(asrConfig, reliableSpeechIntervals, clipTimestamps),
        requestTransport: options.requestTransport,
        semanticRequestPath: asrSemanticRequestPath(options, "primary/clip")
      });
    } catch (error) {
      if (!shouldRetryBrowserAsrClipRequestError(error, clipTimestamps, options.signal)) {
        throw error;
      }
      diagnostics.clipTimestampsAttempt = browserAsrAttemptDiagnosticsFromError(error);
      const retry = await requestBrowserAsrTranscription({
        endpoint,
        timeoutMs,
        asrConfig,
        supportedRequestFields,
        effectiveChunk,
        fileBuffer,
        fileName,
        clipTimestamps: "",
        matureAsrPlan,
        signal: options.signal,
        disableVadFilter: shouldDisableBrowserAsrServerVadForRecall(asrConfig, reliableSpeechIntervals, ""),
        requestTransport: options.requestTransport,
        semanticRequestPath: asrSemanticRequestPath(options, "primary/no-clip")
      });
      const retryPostprocessed = postprocessBrowserAsrPayloadOrThrow(retry.payload, effectiveChunk, asrConfig, {
        requestFields: retry.requestFields,
        disableVadPostFilters: Array.isArray(reliableSpeechIntervals),
        externalVadServiceAvailable: Boolean(diagnostics.vad?.endpoint),
        matureAsrPlan: retry.matureAsrPlan
      });
      diagnostics.retry = {
        reason: "clip_timestamps 请求失败，已不带 clip_timestamps 重试。",
        request: {
          fields: retry.requestFields.map(([name, value]) => [name, String(value)])
        },
        rawPayload: cloneJsonForDiagnostics(retry.payload),
        matureAsrPlan: cloneJsonForDiagnostics(retry.matureAsrPlan),
        normalizedSegments: cloneJsonForDiagnostics(retryPostprocessed.normalized),
        speechFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.speechFiltered),
        hallucinationFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.hallucinationFiltered),
        finalSegments: cloneJsonForDiagnostics(retryPostprocessed.finalSegments),
        postprocess: cloneJsonForDiagnostics(retryPostprocessed.postprocess)
      };
      transcription = retry;
      postprocessed = retryPostprocessed;
      diagnostics.matureAsrPlan = cloneJsonForDiagnostics(retry.matureAsrPlan);
    }
    if (!postprocessed) {
      postprocessed = postprocessBrowserAsrPayloadOrThrow(transcription.payload, effectiveChunk, asrConfig, {
        requestFields: transcription.requestFields,
        disableVadPostFilters: Array.isArray(reliableSpeechIntervals),
        externalVadServiceAvailable: Boolean(diagnostics.vad?.endpoint),
        matureAsrPlan: transcription.matureAsrPlan
      });
      diagnostics.matureAsrPlan = cloneJsonForDiagnostics(transcription.matureAsrPlan);
    }
    const emptyVadRecovery = browserAsrEmptyVadRecoveryPlan(postprocessed.finalSegments, reliableSpeechIntervals, transcription.requestFields);
    if (emptyVadRecovery) {
      diagnostics.emptyVadAttempt = {
        request: {
          fields: transcription.requestFields.map(([name, value]) => [name, String(value)])
        },
        rawPayload: cloneJsonForDiagnostics(transcription.payload),
        matureAsrPlan: cloneJsonForDiagnostics(transcription.matureAsrPlan),
        normalizedSegments: cloneJsonForDiagnostics(postprocessed.normalized),
        speechFilteredSegments: cloneJsonForDiagnostics(postprocessed.speechFiltered),
        hallucinationFilteredSegments: cloneJsonForDiagnostics(postprocessed.hallucinationFiltered),
        finalSegments: cloneJsonForDiagnostics(postprocessed.finalSegments),
        postprocess: cloneJsonForDiagnostics(postprocessed.postprocess)
      };
      const retry = await requestBrowserAsrTranscription({
        endpoint,
        timeoutMs,
        asrConfig,
        supportedRequestFields,
        effectiveChunk,
        fileBuffer,
        fileName,
        clipTimestamps: "",
        matureAsrPlan,
        signal: options.signal,
        disableVadFilter: true,
        requestTransport: options.requestTransport,
        semanticRequestPath: asrSemanticRequestPath(options, "recovery/empty-vad")
      });
      const rawRetryPostprocessed = postprocessBrowserAsrPayloadOrThrow(retry.payload, {
        ...effectiveChunk,
        speechIntervalsReliable: false
      }, asrConfig, {
        requestFields: retry.requestFields,
        externalVadServiceAvailable: Boolean(diagnostics.vad?.endpoint),
        matureAsrPlan: retry.matureAsrPlan,
        forceQualityFilters: true,
        forceCustomRunFilters: true
      });
      const retryPostprocessed = filterBrowserAsrStrictVadRecoveryPostprocess(rawRetryPostprocessed);
      diagnostics.retry = {
        reason: emptyVadRecovery.reason,
        request: {
          fields: retry.requestFields.map(([name, value]) => [name, String(value)])
        },
        rawPayload: cloneJsonForDiagnostics(retry.payload),
        matureAsrPlan: cloneJsonForDiagnostics(retry.matureAsrPlan),
        normalizedSegments: cloneJsonForDiagnostics(retryPostprocessed.normalized),
        speechFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.speechFiltered),
        hallucinationFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.hallucinationFiltered),
        finalSegments: cloneJsonForDiagnostics(retryPostprocessed.finalSegments),
        postprocess: cloneJsonForDiagnostics(retryPostprocessed.postprocess)
      };
      transcription = retry;
      postprocessed = retryPostprocessed;
      diagnostics.matureAsrPlan = cloneJsonForDiagnostics(retry.matureAsrPlan);
    }
    if (postprocessed.finalSegments.length && typeof options.onPrimaryResult === "function") {
      await options.onPrimaryResult({
        segments: cloneJsonForDiagnostics(postprocessed.finalSegments),
        diagnostics: cloneJsonForDiagnostics(diagnostics),
        requestFields: cloneJsonForDiagnostics(transcription.requestFields),
        matureAsrPlan: cloneJsonForDiagnostics(transcription.matureAsrPlan)
      });
    }
    const coverageRetry = browserAsrCoverageRetryPlan(postprocessed.finalSegments, effectiveChunk, clipTimestamps, transcription.requestFields, supportedRequestFields, {
      externalVadPrecheck: Boolean(diagnostics.vad?.endpoint)
    });
    if (coverageRetry) {
      const clipTimestampsPostprocessed = postprocessed;
      diagnostics[coverageRetry.attemptKey] = {
        request: {
          fields: transcription.requestFields.map(([name, value]) => [name, String(value)])
        },
        rawPayload: cloneJsonForDiagnostics(transcription.payload),
        matureAsrPlan: cloneJsonForDiagnostics(transcription.matureAsrPlan),
        normalizedSegments: cloneJsonForDiagnostics(postprocessed.normalized),
        speechFilteredSegments: cloneJsonForDiagnostics(postprocessed.speechFiltered),
        hallucinationFilteredSegments: cloneJsonForDiagnostics(postprocessed.hallucinationFiltered),
        finalSegments: cloneJsonForDiagnostics(postprocessed.finalSegments),
        postprocess: cloneJsonForDiagnostics(postprocessed.postprocess)
      };
      try {
        const retry = await requestBrowserAsrTranscription({
          endpoint,
          timeoutMs,
          asrConfig,
          supportedRequestFields,
          effectiveChunk,
          fileBuffer,
          fileName,
          clipTimestamps: "",
          matureAsrPlan,
          signal: options.signal,
          disableVadFilter: coverageRetry.disableVadFilter,
          requestTransport: options.requestTransport,
          semanticRequestPath: asrSemanticRequestPath(options, `coverage/${coverageRetry.attemptKey}`)
        });
        const rawRetryPostprocessed = postprocessBrowserAsrPayloadOrThrow(retry.payload, effectiveChunk, asrConfig, {
          requestFields: retry.requestFields,
          disableVadPostFilters: Array.isArray(reliableSpeechIntervals),
          externalVadServiceAvailable: Boolean(diagnostics.vad?.endpoint),
          matureAsrPlan: retry.matureAsrPlan,
          forceSpeechActivityFilter: coverageRetry.forceSpeechActivityFilter,
          forceQualityFilters: coverageRetry.forceQualityFilters,
          forceCustomRunFilters: coverageRetry.forceCustomRunFilters,
          forceVadHallucinationGuard: coverageRetry.forceVadHallucinationGuard
        });
        const retryPostprocessed = coverageRetry.filterToCoverageGap
          ? filterBrowserAsrCoverageRetryPostprocess(clipTimestampsPostprocessed, rawRetryPostprocessed, effectiveChunk, retry.payload, asrConfig, {
            strictVadRecoveryFilter: coverageRetry.strictVadRecoveryFilter
          })
          : rawRetryPostprocessed;
        diagnostics.retry = {
          reason: coverageRetry.reason,
          request: {
            fields: retry.requestFields.map(([name, value]) => [name, String(value)])
          },
          rawPayload: cloneJsonForDiagnostics(retry.payload),
          matureAsrPlan: cloneJsonForDiagnostics(retry.matureAsrPlan),
          normalizedSegments: cloneJsonForDiagnostics(retryPostprocessed.normalized),
          speechFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.speechFiltered),
          hallucinationFilteredSegments: cloneJsonForDiagnostics(retryPostprocessed.hallucinationFiltered),
          finalSegments: cloneJsonForDiagnostics(retryPostprocessed.finalSegments),
          postprocess: cloneJsonForDiagnostics(retryPostprocessed.postprocess)
        };
        transcription = retry;
        postprocessed = mergeBrowserAsrClipRetryPostprocess(clipTimestampsPostprocessed, retryPostprocessed);
        diagnostics.matureAsrPlan = cloneJsonForDiagnostics(retry.matureAsrPlan);
      } catch (error) {
        if (isBrowserAbortError(error, options.signal) || !clipTimestampsPostprocessed.finalSegments.length) {
          throw error;
        }
        recoveryWarning = new Error(`ASR 补救请求失败，已保留首次结果：${error.message || String(error)}`);
        diagnostics.retry = {
          reason: coverageRetry.reason,
          error: {
            stage: error.asrStage || "asr_request",
            message: error.message || String(error || "ASR 补救请求失败"),
            ...(Number.isFinite(Number(error.asrStatus)) ? { status: Number(error.asrStatus) } : {})
          }
        };
      }
    }
  } catch (error) {
    diagnostics.chunk = browserAsrDiagnosticChunkInfo(effectiveChunk);
    if (transcription) {
      diagnostics.request.fields = transcription.requestFields.map(([name, value]) => [name, String(value)]);
      diagnostics.rawPayload = cloneJsonForDiagnostics(transcription.payload);
    }
    applyBrowserAsrErrorDiagnostics(diagnostics, error);
    emitBrowserAsrDiagnostics(options, diagnostics);
    throw error;
  }
  diagnostics.request.fields = transcription.requestFields.map(([name, value]) => [name, String(value)]);
  diagnostics.rawPayload = cloneJsonForDiagnostics(transcription.payload);
  diagnostics.matureAsrPlan = cloneJsonForDiagnostics(transcription.matureAsrPlan);
  diagnostics.chunk = browserAsrDiagnosticChunkInfo(effectiveChunk);
  diagnostics.normalizedSegments = cloneJsonForDiagnostics(postprocessed.normalized);
  diagnostics.speechFilteredSegments = cloneJsonForDiagnostics(postprocessed.speechFiltered);
  diagnostics.hallucinationFilteredSegments = cloneJsonForDiagnostics(postprocessed.hallucinationFiltered);
  diagnostics.finalSegments = cloneJsonForDiagnostics(postprocessed.finalSegments);
  diagnostics.postprocess = cloneJsonForDiagnostics(postprocessed.postprocess);
  emitBrowserAsrDiagnostics(options, diagnostics);
  if (options.returnResultEnvelope) {
    return {
      segments: cloneJsonForDiagnostics(postprocessed.finalSegments),
      warning: recoveryWarning ? {
        name: String(recoveryWarning.name || "Error"),
        message: String(recoveryWarning.message || recoveryWarning)
      } : null,
      diagnostics: cloneJsonForDiagnostics(diagnostics)
    };
  }
  return typeof options.attachResultWarning === "function"
    ? options.attachResultWarning(postprocessed.finalSegments, recoveryWarning)
    : postprocessed.finalSegments;
}

function shouldRetryBrowserAsrClipRequestError(error, clipTimestamps = "", signal = null) {
  if (!clipTimestamps) {
    return false;
  }
  const includedClipTimestamps = Array.isArray(error?.asrRequestFields)
    && error.asrRequestFields.some(([name]) => name === "clip_timestamps");
  if (!includedClipTimestamps || isBrowserAbortError(error, signal)) {
    return false;
  }
  const status = Number(error?.asrStatus || 0) || 0;
  if (status !== 400 && status !== 422) {
    return false;
  }
  const detail = [
    error?.message,
    error?.asrRawPayload?.error?.message,
    error?.asrRawPayload?.message,
    error?.asrRawPayload?.detail
  ].map(value => {
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value || "");
    } catch {
      return "";
    }
  }).join(" ").toLowerCase();
  return /clip[_\s-]?timestamps?/.test(detail)
    && /(unsupported|not supported|unknown|unrecognized|invalid|unexpected|extra|forbidden|not permitted|parse|format|malformed|syntax|不支持|未知|无效|不允许|解析|格式)/.test(detail);
}

function shouldUseBrowserAsrExternalVadPrecheck(supportedRequestFields, speechTimestampsEndpoint = "") {
  return Boolean(
    speechTimestampsEndpoint
    && (
      asrRequestFieldSupported({ supportedRequestFields }, "clip_timestamps")
      || asrRequestFieldSupported({ supportedRequestFields }, "vad_filter")
    )
  );
}

function shouldUseBrowserAsrNativeVadTranscription(supportedRequestFields, speechTimestampsEndpoint = "") {
  return Boolean(
    speechTimestampsEndpoint
    && asrRequestFieldSupported({ supportedRequestFields }, "without_timestamps")
    && !asrRequestFieldSupported({ supportedRequestFields }, "clip_timestamps")
    && !asrRequestFieldSupported({ supportedRequestFields }, "vad_filter")
  );
}

function shouldUseBrowserAsrCollectedSpeechAudio(reliableSpeechIntervals, supportedRequestFields, speechTimestampsEndpoint = "", clipTimestamps = "", asrConfig = {}) {
  const clipTimestampsRequestAvailable = Boolean(clipTimestamps)
    && asrRequestFieldSupported({ supportedRequestFields }, "clip_timestamps");
  return Boolean(
    speechTimestampsEndpoint
    && Array.isArray(reliableSpeechIntervals)
    && reliableSpeechIntervals.length
    && !clipTimestampsRequestAvailable
    && browserAsrCollectedSpeechAudioExplicitlyEnabled(asrConfig)
  );
}

function browserAsrCollectedSpeechAudioExplicitlyEnabled(asrConfig = {}) {
  const value = String(asrConfig?.collectedSpeechAudio || asrConfig?.collectSpeechAudio || "").trim().toLowerCase();
  return ["1", "true", "on", "force", "collect"].includes(value);
}

function shouldDisableBrowserAsrServerVadForRecall(asrConfig = {}, reliableSpeechIntervals = null, clipTimestamps = "") {
  if (normalizeProviderType(asrConfig?.providerType) !== "openai") {
    return false;
  }
  return normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode) === "auto";
}

async function transcribeBrowserCollectedSpeechAudioChunk({
  endpoint,
  timeoutMs,
  asrConfig,
  supportedRequestFields,
  sourceChunk,
  fileBuffer,
  fileName,
  reliableSpeechIntervals,
  matureAsrPlan,
  diagnostics,
  options = {}
}) {
  let collected;
  try {
    collected = await collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig, options);
  } catch (error) {
    if (error && typeof error === "object" && !error.asrStage) error.asrStage = "audio-collect";
    throw error;
  }
  const chunks = (collected?.chunks || [])
    .map((chunk, index) => normalizeBrowserAsrCollectedSpeechChunk(sourceChunk, chunk, index))
    .filter(Boolean);
  diagnostics.collectedSpeech = {
    strategy: "external_vad_collect_chunks",
    chunks: cloneJsonForDiagnostics(chunks.map(browserAsrCollectedSpeechChunkInfo)),
    sourceSpeechIntervals: cloneJsonForDiagnostics(reliableSpeechIntervals)
  };
  if (!chunks.length) {
    diagnostics.chunk = browserAsrDiagnosticChunkInfo(sourceChunk);
    diagnostics.finalSegments = [];
    diagnostics.postprocess = {
      policySource: "collected_external_vad",
      segmentCounts: { normalized: 0, speechFiltered: 0, hallucinationFiltered: 0, final: 0 },
      dropCounts: { speechActivity: 0, hallucinationGuard: 0, chunkOwnership: 0, total: 0 },
      droppedSegments: []
    };
    emitBrowserAsrDiagnostics(options, diagnostics);
    if (typeof options.onPrimaryResult === "function") {
      await options.onPrimaryResult({ segments: [], diagnostics: cloneJsonForDiagnostics(diagnostics) });
    }
    return options.returnResultEnvelope
      ? { segments: [], warning: null, diagnostics: cloneJsonForDiagnostics(diagnostics) }
      : [];
  }

  const collectedPlan = createBrowserAsrMaturePlan({
    reliableSpeechIntervals,
    diagnostics,
    speechTimestampsEndpointAvailable: true,
    collectedSpeechAudio: true
  });
  const attempts = [];
  let mergedPostprocessed = {
    normalized: [],
    speechFiltered: [],
    hallucinationFiltered: [],
    finalSegments: [],
    postprocess: null
  };
  for (const collectedChunk of chunks) {
    assertBrowserAsrChunkCanUpload(collectedChunk, asrConfig);
    const getAudioBuffer = options.getAudioBuffer || getBrowserAudioChunkBuffer;
    const collectedBuffer = await getAudioBuffer(collectedChunk.file);
    assertBrowserAsrChunkCanUpload(collectedChunk, asrConfig, collectedBuffer.byteLength, collectedBuffer);
    const transcription = await requestBrowserAsrTranscription({
      endpoint,
      timeoutMs,
      asrConfig,
      supportedRequestFields,
      effectiveChunk: collectedChunk,
      fileBuffer: collectedBuffer,
      fileName: collectedChunk.file?.name || fileName,
      clipTimestamps: "",
      matureAsrPlan: collectedPlan,
      signal: options.signal,
      disableVadFilter: true,
      requestTransport: options.requestTransport,
      semanticRequestPath: asrSemanticRequestPath(options, `collected/${collectedChunk.index}`)
    });
    diagnostics.request.fields = transcription.requestFields.map(([name, value]) => [name, String(value)]);
    diagnostics.rawPayload = cloneJsonForDiagnostics(transcription.payload);
    diagnostics.matureAsrPlan = cloneJsonForDiagnostics(transcription.matureAsrPlan);
    let postprocessed;
    try {
      postprocessed = postprocessBrowserAsrCollectedSpeechPayload(transcription.payload, sourceChunk, collectedChunk, asrConfig, {
        requestFields: transcription.requestFields,
        matureAsrPlan: transcription.matureAsrPlan
      });
    } catch (error) {
      if (error && typeof error === "object" && !error.asrStage) error.asrStage = "postprocess";
      throw error;
    }
    attempts.push({
      chunk: browserAsrCollectedSpeechChunkInfo(collectedChunk),
      request: {
        fields: transcription.requestFields.map(([name, value]) => [name, String(value)])
      },
      rawPayload: cloneJsonForDiagnostics(transcription.payload),
      matureAsrPlan: cloneJsonForDiagnostics(transcription.matureAsrPlan),
      normalizedSegments: cloneJsonForDiagnostics(postprocessed.normalized),
      speechFilteredSegments: cloneJsonForDiagnostics(postprocessed.speechFiltered),
      hallucinationFilteredSegments: cloneJsonForDiagnostics(postprocessed.hallucinationFiltered),
      finalSegments: cloneJsonForDiagnostics(postprocessed.finalSegments),
      postprocess: cloneJsonForDiagnostics(postprocessed.postprocess)
    });
    mergedPostprocessed = mergeBrowserAsrCollectedSpeechPostprocess(mergedPostprocessed, postprocessed);
  }
  diagnostics.collectedSpeech.attempts = attempts;
  diagnostics.chunk = browserAsrDiagnosticChunkInfo(sourceChunk);
  diagnostics.normalizedSegments = cloneJsonForDiagnostics(mergedPostprocessed.normalized);
  diagnostics.speechFilteredSegments = cloneJsonForDiagnostics(mergedPostprocessed.speechFiltered);
  diagnostics.hallucinationFilteredSegments = cloneJsonForDiagnostics(mergedPostprocessed.hallucinationFiltered);
  diagnostics.finalSegments = cloneJsonForDiagnostics(mergedPostprocessed.finalSegments);
  diagnostics.postprocess = cloneJsonForDiagnostics(mergedPostprocessed.postprocess);
  emitBrowserAsrDiagnostics(options, diagnostics);
  if (typeof options.onPrimaryResult === "function") {
    await options.onPrimaryResult({
      segments: cloneJsonForDiagnostics(mergedPostprocessed.finalSegments),
      diagnostics: cloneJsonForDiagnostics(diagnostics)
    });
  }
  return options.returnResultEnvelope
    ? {
        segments: mergedPostprocessed.finalSegments,
        warning: null,
        diagnostics: cloneJsonForDiagnostics(diagnostics)
      }
    : mergedPostprocessed.finalSegments;
}

async function collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig = {}, options = {}) {
  if (typeof options.collectSpeechAudio !== "function") {
    throw new Error("ASR workflow requires a collected-speech audio adapter.");
  }
  const response = await options.collectSpeechAudio({
    file: {
      name: fileName || sourceChunk?.file?.name || `asr-${Number(sourceChunk?.index || 0)}.mp3`,
      mime: sourceChunk?.file?.mime || "audio/mpeg",
      cacheUrl: sourceChunk?.file?.cacheUrl || ""
    },
    outputName: `speech-${fileName || sourceChunk?.file?.name || "asr.mp3"}`,
    speechIntervals: cloneJsonForDiagnostics(reliableSpeechIntervals),
    duration: Math.max(0, Number(sourceChunk?.duration || (Number(sourceChunk?.end) - Number(sourceChunk?.start)) || 0) || 0),
    sourceStart: Number(sourceChunk?.start || 0) || 0,
    maxChunkSeconds: BROWSER_ASR_MATURE_MAX_SPEECH_DURATION_SECONDS,
    cacheNamespace: "",
    jobId: options.jobId || "",
    runToken: options.runToken || "",
    asr: {
      model: asrConfig?.model || "",
      providerType: asrConfig?.providerType || ""
    }
  });
  if (!response?.ok) {
    throw new Error(response?.error || "Web FFmpeg 生成 VAD 语音窗口失败。");
  }
  return response.result || {};
}

function asrSemanticRequestPath(options = {}, suffix = "request") {
  const base = String(options.semanticRequestPath || "asr").replace(/\/+$/, "");
  return `${base}/${String(suffix || "request").replace(/^\/+/, "")}`;
}

function browserAsrClipTimestampsSkippedReason(reliableSpeechIntervals, supportedRequestFields) {
  if (!Array.isArray(reliableSpeechIntervals) || !reliableSpeechIntervals.length) {
    return "";
  }
  if (!asrRequestFieldSupported({ supportedRequestFields }, "vad_filter")) {
    return "";
  }
  return reliableSpeechIntervals.some(browserAsrSpeechIntervalRequiresServerVad)
    ? "long_speech_interval_requires_server_vad"
    : "";
}

function browserAsrSpeechIntervalRequiresServerVad(interval = {}) {
  const start = Number(interval?.start);
  const end = Number(interval?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false;
  }
  return end - start > BROWSER_ASR_MATURE_MAX_SPEECH_DURATION_SECONDS + BROWSER_ASR_LONG_SPEECH_INTERVAL_TOLERANCE_SECONDS;
}

function browserAsrAttemptDiagnosticsFromError(error) {
  return {
    request: {
      fields: Array.isArray(error?.asrRequestFields)
        ? error.asrRequestFields.map(([name, value]) => [name, String(value)])
        : []
    },
    rawPayload: error?.asrRawPayload === undefined ? null : cloneJsonForDiagnostics(error.asrRawPayload),
    ...(error?.asrMaturePlan ? { matureAsrPlan: cloneJsonForDiagnostics(error.asrMaturePlan) } : {}),
    error: {
      stage: error?.asrStage || "asr_request",
      message: error?.message || String(error || "ASR 请求失败"),
      ...(Number.isFinite(Number(error?.asrStatus)) ? { status: Number(error.asrStatus) } : {})
    }
  };
}

function createBrowserAsrMaturePlan({ reliableSpeechIntervals, clipTimestamps = "", clipTimestampsSkippedReason = "", diagnostics = null, nativeVadAvailable = false, speechTimestampsEndpointAvailable = false, collectedSpeechAudio = false } = {}) {
  const externalPrecheckAttempted = Boolean(diagnostics?.vad?.endpoint);
  const vadEndpointAvailable = externalPrecheckAttempted || Boolean(speechTimestampsEndpointAvailable);
  const hasReliableIntervals = Array.isArray(reliableSpeechIntervals);
  const speechIntervalCount = hasReliableIntervals ? reliableSpeechIntervals.length : 0;
  const precheckState = nativeVadAvailable
    ? "native"
    : (hasReliableIntervals
    ? (speechIntervalCount ? "reliable" : "empty")
    : (externalPrecheckAttempted ? "unavailable" : "none"));
  return browserAsrMaturePlanForRequest({
    version: 1,
    strategy: "speaches_faster_whisper",
    vad: {
      endpointAvailable: vadEndpointAvailable,
      externalPrecheckAttempted,
      nativeTranscription: nativeVadAvailable === true,
      collectedSpeechAudio: collectedSpeechAudio === true,
      precheckState,
      speechIntervalCount,
      clipTimestampsSkippedReason: String(clipTimestampsSkippedReason || "")
    },
    clipTimestamps: normalizeBrowserAsrPlanClipTimestamps(clipTimestamps)
  }, []);
}

function browserAsrMaturePlanForRequest(basePlan = {}, requestFields = []) {
  const normalizedFields = normalizeBrowserAsrRequestFieldsForDiagnostics(requestFields);
  const policy = createBrowserAsrPostprocessPolicy({
    requestFields: normalizedFields,
    externalVadPrecheck: basePlan?.vad?.precheckState === "reliable",
    externalVadServiceAvailable: basePlan?.vad?.externalPrecheckAttempted === true,
    nativeVadRequest: basePlan?.vad?.nativeTranscription === true,
    collectedSpeechRequest: basePlan?.vad?.collectedSpeechAudio === true
  });
  return {
    version: Number(basePlan?.version) || 1,
    strategy: basePlan?.strategy || "speaches_faster_whisper",
    vad: {
      endpointAvailable: basePlan?.vad?.endpointAvailable === true,
      externalPrecheckAttempted: basePlan?.vad?.externalPrecheckAttempted === true,
      nativeTranscription: basePlan?.vad?.nativeTranscription === true,
      collectedSpeechAudio: basePlan?.vad?.collectedSpeechAudio === true,
      precheckState: basePlan?.vad?.precheckState || "none",
      speechIntervalCount: Math.max(0, Number(basePlan?.vad?.speechIntervalCount || 0) || 0),
      clipTimestampsSkippedReason: String(basePlan?.vad?.clipTimestampsSkippedReason || "")
    },
    clipTimestamps: normalizeBrowserAsrPlanClipTimestamps(basePlan?.clipTimestamps),
    request: {
      mode: browserAsrMatureRequestMode(policy, basePlan),
      clipTimestampRequest: policy.clipTimestampRequest,
      vadFilterRequest: policy.vadFilterRequest,
      fieldNames: normalizedFields.map(([name]) => name)
    },
    postprocessPolicy: policy
  };
}

function createBrowserAsrPostprocessPolicy(options = {}) {
  const clipTimestampRequest = browserAsrRequestIncludesClipTimestamps(options.requestFields);
  const vadFilterRequest = browserAsrRequestIncludesVadFilter(options.requestFields);
  const externalVadPrecheck = options.externalVadPrecheck === true || options.disableVadPostFilters === true;
  const externalVadServiceAvailable = options.externalVadServiceAvailable === true;
  const nativeVadRequest = options.nativeVadRequest === true;
  const collectedSpeechRequest = options.collectedSpeechRequest === true;
  const matureVadRequest = clipTimestampRequest
    || vadFilterRequest
    || nativeVadRequest
    || collectedSpeechRequest;
  return {
    clipTimestampRequest,
    vadFilterRequest,
    externalVadPrecheck,
    externalVadServiceAvailable,
    nativeVadRequest,
    collectedSpeechRequest,
    matureVadRequest,
    speechActivityFilterApplied: nativeVadRequest && !clipTimestampRequest && !collectedSpeechRequest,
    qualityFiltersDisabled: matureVadRequest,
    customRunFiltersDisabled: clipTimestampRequest,
    vadHallucinationGuardDisabled: false
  };
}

function browserAsrPostprocessPolicyWithOverrides(policy = {}, options = {}) {
  const adjusted = { ...policy };
  if (options.forceSpeechActivityFilter === true) {
    adjusted.speechActivityFilterApplied = true;
  }
  if (options.forceQualityFilters === true) {
    adjusted.qualityFiltersDisabled = false;
  }
  if (options.forceCustomRunFilters === true) {
    adjusted.customRunFiltersDisabled = false;
  }
  if (options.forceVadHallucinationGuard === true) {
    adjusted.vadHallucinationGuardDisabled = false;
  }
  return adjusted;
}

function browserAsrMatureRequestMode(policy = {}, basePlan = {}) {
  if (policy.clipTimestampRequest) {
    return "external_vad_clip";
  }
  if (policy.vadFilterRequest) {
    return "compatible_vad_filter";
  }
  if (policy.nativeVadRequest || basePlan?.vad?.nativeTranscription) {
    return "speaches_native";
  }
  if (policy.collectedSpeechRequest || basePlan?.vad?.collectedSpeechAudio) {
    return "collected_external_vad";
  }
  return "direct";
}

function normalizeBrowserAsrPlanClipTimestamps(value = "") {
  return String(value || "").trim();
}

function normalizeBrowserAsrRequestFieldsForDiagnostics(requestFields = []) {
  return (requestFields || []).map(([name, value]) => [name, String(value)]);
}

function postprocessBrowserAsrPayloadOrThrow(payload, effectiveChunk, asrConfig, options = {}) {
  try {
    return postprocessBrowserAsrPayload(payload, effectiveChunk, asrConfig, options);
  } catch (error) {
    if (error && typeof error === "object" && !error.asrStage) {
      error.asrStage = "postprocess";
    }
    throw error;
  }
}

function applyBrowserAsrErrorDiagnostics(diagnostics, error) {
  if (!diagnostics || !error) {
    return;
  }
  if (Array.isArray(error.asrRequestFields)) {
    diagnostics.request.fields = error.asrRequestFields.map(([name, value]) => [name, String(value)]);
  }
  if (error.asrRawPayload !== undefined) {
    diagnostics.rawPayload = cloneJsonForDiagnostics(error.asrRawPayload);
  }
  if (error.asrMaturePlan) {
    diagnostics.matureAsrPlan = cloneJsonForDiagnostics(error.asrMaturePlan);
  }
  diagnostics.error = {
    stage: error.asrStage || "asr_request",
    message: error.message || String(error || "ASR 请求失败"),
    ...(Number.isFinite(Number(error.asrStatus)) ? { status: Number(error.asrStatus) } : {})
  };
}

function createBrowserAsrRequestError(message, details = {}) {
  const error = new Error(message);
  error.asrStage = details.stage || "asr_request";
  error.asrRequestFields = Array.isArray(details.requestFields) ? details.requestFields : [];
  if (Object.prototype.hasOwnProperty.call(details, "cause")) {
    error.cause = details.cause;
  }
  const code = String(details.code || "").trim();
  if (code) {
    error.code = code;
  }
  if (typeof details.deliveryAmbiguous === "boolean") {
    error.deliveryAmbiguous = details.deliveryAmbiguous;
  }
  if (Number.isFinite(Number(details.status))) {
    error.asrStatus = Number(details.status);
  }
  if (details.rawPayload !== undefined) {
    error.asrRawPayload = details.rawPayload;
  }
  if (details.matureAsrPlan) {
    error.asrMaturePlan = details.matureAsrPlan;
  }
  return error;
}

function browserAsrResponseErrorMessage(payload, status) {
  const detail = payload?.error?.message ?? payload?.message ?? payload?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail) && detail.length) {
    return detail.map(item => {
      if (typeof item === "string") {
        return item;
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item || "");
      }
    }).filter(Boolean).join("；").slice(0, 500);
  }
  if (detail && typeof detail === "object") {
    try {
      const text = JSON.stringify(detail);
      if (text && text !== "{}") {
        return text.slice(0, 500);
      }
    } catch {
      // Fall back to the status message below.
    }
  }
  return `ASR 返回 HTTP ${status}`;
}

function browserAsrUploadFileSummary(file = {}, buffer = null, fileName = "") {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16)) : new Uint8Array();
  const headHex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  const headAscii = browserAsrAsciiHead(bytes);
  const size = buffer instanceof ArrayBuffer
    ? formatBytes(buffer.byteLength)
    : formatBytes(browserAudioFileByteLength(file));
  const mime = file.mime || "audio/mpeg";
  const name = fileName || file.name || "audio";
  const signature = headAscii || headHex || "-";
  return `${name}（${mime}，${size}，文件头 ${signature}）`;
}

function browserAsrAsciiHead(bytes) {
  if (!bytes?.length) {
    return "";
  }
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "RIFF";
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "ID3";
  }
  return "";
}

async function requestBrowserAsrTranscription({ endpoint, timeoutMs, asrConfig, supportedRequestFields, effectiveChunk, fileBuffer, fileName, clipTimestamps, matureAsrPlan, disableVadFilter = false, signal = null, requestTransport = null, semanticRequestPath = "asr/request" }) {
  const formData = new FormData();
  const requestAsrConfig = disableVadFilter ? { ...asrConfig, vadFilter: "off" } : asrConfig;
  const requestFields = browserAsrRequestFields(requestAsrConfig, requestAsrConfig.language || requestAsrConfig.sourceLanguage || "", {
    supportedRequestFields,
    clientSpeechIntervalsAvailable: Array.isArray(effectiveChunk?.speechIntervals) && effectiveChunk?.speechIntervalsReliable !== false,
    clipTimestamps
  });
  const requestMatureAsrPlan = browserAsrMaturePlanForRequest(matureAsrPlan, requestFields);
  for (const [name, value] of requestFields) {
    formData.append(name, value);
  }
  formData.append("file", new Blob([fileBuffer], { type: effectiveChunk.file.mime || "audio/mpeg" }), fileName);
  const controller = new AbortController();
  const unlink = linkBrowserAbortSignal(signal, controller);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let response;
  let payload = {};
  try {
    const transport = typeof requestTransport === "function" ? requestTransport : fetch;
    response = await transport(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asrConfig.apiKey}`
      },
      body: formData,
      signal: controller.signal
    }, {
      semanticRequestPath,
      operationType: "asr",
      bodyIdentity: {
        requestFields,
        audioHash: `sha256:${await sha256Hex(fileBuffer)}`,
        fileName,
        mime: effectiveChunk.file.mime || "audio/mpeg"
      }
    });
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        throw error;
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      throw browserAbortError(signal.reason);
    }
    if (timedOut || controller.signal.aborted) {
      throw createBrowserAsrRequestError(`ASR 请求超时（${Math.round(timeoutMs / 1000)} 秒）：${endpoint}`, {
        requestFields,
        matureAsrPlan: requestMatureAsrPlan
      });
    }
    throw createBrowserAsrRequestError(`ASR 请求失败：${formatAsrFetchError(error, endpoint)}`, {
      requestFields,
      matureAsrPlan: requestMatureAsrPlan,
      cause: error,
      code: error?.code,
      deliveryAmbiguous: error?.deliveryAmbiguous,
      status: error?.asrStatus ?? error?.status
    });
  } finally {
    clearTimeout(timer);
    unlink();
  }
  if (!response.ok) {
    const responseMessage = browserAsrResponseErrorMessage(payload, response.status);
    const uploadSummary = response.status === 415
      ? `。上传文件：${browserAsrUploadFileSummary(effectiveChunk.file || {}, fileBuffer, fileName)}`
      : "";
    throw createBrowserAsrRequestError(`${responseMessage}${uploadSummary}`, {
      requestFields,
      status: response.status,
      rawPayload: payload,
      matureAsrPlan: requestMatureAsrPlan
    });
  }
  return { payload, requestFields, matureAsrPlan: requestMatureAsrPlan };
}

function linkBrowserAbortSignal(signal, controller) {
  if (!signal || !controller) {
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

function browserAbortError(reason) {
  const error = new Error(reason?.message || "任务已停止。");
  error.name = "AbortError";
  error[BROWSER_ABORT_ERROR_BRAND] = true;
  if (reason instanceof Error) {
    error.cause = reason;
  }
  return error;
}

function isBrowserAbortError(error, signal = null) {
  return Boolean(signal?.aborted || error?.[BROWSER_ABORT_ERROR_BRAND]);
}

function postprocessBrowserAsrPayload(payload, effectiveChunk, asrConfig, options = {}) {
  const planPolicy = options.matureAsrPlan?.postprocessPolicy || null;
  const policy = browserAsrPostprocessPolicyWithOverrides(
    planPolicy || createBrowserAsrPostprocessPolicy(options),
    options
  );
  const normalized = normalizeAsrSegments(payload, effectiveChunk.start, effectiveChunk.end, {
    providerType: asrConfig?.providerType,
    disableCustomRunFilters: policy.customRunFiltersDisabled,
    disableCustomQualityFilters: policy.qualityFiltersDisabled
  });
  const speechFiltered = policy.speechActivityFilterApplied
    ? filterAsrSegmentsBySpeechActivity(normalized, effectiveChunk)
    : normalized;
  const hallucinationChunk = policy.vadHallucinationGuardDisabled
    ? { ...effectiveChunk, speechIntervalsReliable: false }
    : effectiveChunk;
  const hallucinationFiltered = filterAsrSegmentsByHallucinationGuard(speechFiltered, hallucinationChunk, {
    disableCustomRunFilters: policy.customRunFiltersDisabled
  });
  const finalSegments = filterAsrSegmentsByChunkOwnership(hallucinationFiltered, effectiveChunk);
  const segmentCounts = {
    normalized: normalized.length,
    speechFiltered: speechFiltered.length,
    hallucinationFiltered: hallucinationFiltered.length,
    final: finalSegments.length
  };
  const dropCounts = {
    speechActivity: Math.max(0, normalized.length - speechFiltered.length),
    hallucinationGuard: Math.max(0, speechFiltered.length - hallucinationFiltered.length),
    chunkOwnership: Math.max(0, hallucinationFiltered.length - finalSegments.length)
  };
  dropCounts.total = dropCounts.speechActivity + dropCounts.hallucinationGuard + dropCounts.chunkOwnership;
  const droppedSegments = [
    ...browserAsrDroppedSegments("speechActivity", "outside_speech_activity", normalized, speechFiltered),
    ...browserAsrDroppedSegments("hallucinationGuard", "hallucination_guard", speechFiltered, hallucinationFiltered),
    ...browserAsrDroppedSegments("chunkOwnership", "outside_chunk_core", hallucinationFiltered, finalSegments)
  ];
  return {
    normalized,
    speechFiltered,
    hallucinationFiltered,
    finalSegments,
    postprocess: {
      policySource: planPolicy ? "matureAsrPlan" : "requestFields",
      clipTimestampRequest: policy.clipTimestampRequest,
      vadFilterRequest: policy.vadFilterRequest,
      externalVadPrecheck: policy.externalVadPrecheck,
      externalVadServiceAvailable: policy.externalVadServiceAvailable,
      nativeVadRequest: policy.nativeVadRequest,
      matureVadRequest: policy.matureVadRequest,
      speechActivityFilterApplied: policy.speechActivityFilterApplied,
      qualityFiltersDisabled: policy.qualityFiltersDisabled,
      customRunFiltersDisabled: policy.customRunFiltersDisabled,
      vadHallucinationGuardDisabled: policy.vadHallucinationGuardDisabled,
      segmentCounts,
      dropCounts,
      droppedSegments
    }
  };
}

function postprocessBrowserAsrCollectedSpeechPayload(payload, sourceChunk, collectedChunk, asrConfig, options = {}) {
  const planPolicy = options.matureAsrPlan?.postprocessPolicy || null;
  const policy = browserAsrPostprocessPolicyWithOverrides(
    planPolicy || createBrowserAsrPostprocessPolicy(options),
    options
  );
  const collectedDuration = Math.max(0, Number(collectedChunk?.duration || collectedChunk?.end || 0) || 0);
  const normalizedCompressed = normalizeAsrSegments(payload, 0, collectedDuration, {
    providerType: asrConfig?.providerType,
    disableCustomRunFilters: policy.customRunFiltersDisabled,
    disableCustomQualityFilters: false
  });
  const normalized = restoreBrowserAsrCollectedSpeechSegments(normalizedCompressed, collectedChunk?.timeMap || []);
  const speechFiltered = filterAsrSegmentsBySpeechActivity(normalized, sourceChunk);
  const hallucinationFiltered = filterAsrSegmentsByHallucinationGuard(speechFiltered, sourceChunk, {
    disableCustomRunFilters: policy.customRunFiltersDisabled
  });
  const finalSegments = filterAsrSegmentsByChunkOwnership(hallucinationFiltered, sourceChunk);
  const segmentCounts = {
    normalized: normalized.length,
    speechFiltered: speechFiltered.length,
    hallucinationFiltered: hallucinationFiltered.length,
    final: finalSegments.length
  };
  const dropCounts = {
    speechActivity: Math.max(0, normalized.length - speechFiltered.length),
    hallucinationGuard: Math.max(0, speechFiltered.length - hallucinationFiltered.length),
    chunkOwnership: Math.max(0, hallucinationFiltered.length - finalSegments.length)
  };
  dropCounts.total = dropCounts.speechActivity + dropCounts.hallucinationGuard + dropCounts.chunkOwnership;
  const droppedSegments = [
    ...browserAsrDroppedSegments("speechActivity", "outside_speech_activity", normalized, speechFiltered),
    ...browserAsrDroppedSegments("hallucinationGuard", "hallucination_guard", speechFiltered, hallucinationFiltered),
    ...browserAsrDroppedSegments("chunkOwnership", "outside_chunk_core", hallucinationFiltered, finalSegments)
  ];
  return {
    normalized,
    speechFiltered,
    hallucinationFiltered,
    finalSegments,
    postprocess: {
      policySource: "collected_external_vad",
      clipTimestampRequest: false,
      vadFilterRequest: false,
      externalVadPrecheck: true,
      externalVadServiceAvailable: true,
      nativeVadRequest: false,
      collectedSpeechRequest: true,
      matureVadRequest: true,
      speechActivityFilterApplied: true,
      qualityFiltersDisabled: false,
      customRunFiltersDisabled: policy.customRunFiltersDisabled,
      vadHallucinationGuardDisabled: policy.vadHallucinationGuardDisabled,
      segmentCounts,
      dropCounts,
      droppedSegments
    }
  };
}

function restoreBrowserAsrCollectedSpeechSegments(segments = [], timeMap = []) {
  const map = normalizeBrowserAsrCollectedSpeechTimeMap(timeMap);
  if (!map.length) {
    return segments || [];
  }
  return (segments || []).map(segment => {
    const words = Array.isArray(segment?.words)
      ? segment.words.map(word => {
          const middle = (Number(word?.start) + Number(word?.end)) / 2;
          const mapItem = browserAsrCollectedSpeechMapItemForTime(middle, map);
          return {
            ...word,
            start: restoreBrowserAsrCollectedSpeechTime(word.start, map, { mapItem }),
            end: restoreBrowserAsrCollectedSpeechTime(word.end, map, { mapItem })
          };
        }).filter(word => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start)
      : undefined;
    const start = words?.length
      ? words[0].start
      : restoreBrowserAsrCollectedSpeechTime(segment?.start, map);
    const end = words?.length
      ? words.at(-1).end
      : restoreBrowserAsrCollectedSpeechTime(segment?.end, map, { isEnd: true });
    return {
      ...segment,
      start,
      end,
      ...(words?.length ? { words } : {})
    };
  }).filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);
}

function normalizeBrowserAsrCollectedSpeechTimeMap(timeMap = []) {
  return (Array.isArray(timeMap) ? timeMap : [])
    .map(item => ({
      outputStart: Number(item?.outputStart),
      outputEnd: Number(item?.outputEnd),
      sourceStart: Number(item?.sourceStart),
      sourceEnd: Number(item?.sourceEnd)
    }))
    .filter(item =>
      Number.isFinite(item.outputStart)
      && Number.isFinite(item.outputEnd)
      && Number.isFinite(item.sourceStart)
      && Number.isFinite(item.sourceEnd)
      && item.outputEnd > item.outputStart
      && item.sourceEnd > item.sourceStart
    )
    .sort((left, right) => left.outputStart - right.outputStart || left.outputEnd - right.outputEnd);
}

function browserAsrCollectedSpeechMapItemForTime(value, timeMap = [], options = {}) {
  const time = Number(value);
  if (!Number.isFinite(time)) {
    return null;
  }
  if (!Array.isArray(timeMap) || !timeMap.length) {
    return null;
  }
  const boundarySlack = 0.001;
  for (const item of timeMap) {
    if (time < item.outputEnd || (options?.isEnd && Math.abs(time - item.outputEnd) <= boundarySlack)) {
      return item;
    }
  }
  return timeMap.at(-1);
}

function restoreBrowserAsrCollectedSpeechTime(value, timeMap = [], options = {}) {
  const time = Number(value);
  if (!Number.isFinite(time)) {
    return NaN;
  }
  const mapItem = options?.mapItem || browserAsrCollectedSpeechMapItemForTime(time, timeMap, { isEnd: options?.isEnd });
  if (!mapItem) {
    return time;
  }
  const outputDuration = mapItem.outputEnd - mapItem.outputStart;
  const sourceDuration = mapItem.sourceEnd - mapItem.sourceStart;
  if (!outputDuration || !sourceDuration) {
    return mapItem.sourceStart;
  }
  const sourceOffset = (time - mapItem.outputStart) * (sourceDuration / outputDuration);
  return mapItem.sourceStart + sourceOffset;
}

function mergeBrowserAsrCollectedSpeechPostprocess(current, next) {
  const normalized = mergeBrowserAsrSegmentLists(current?.normalized || [], next?.normalized || []);
  const speechFiltered = mergeBrowserAsrSegmentLists(current?.speechFiltered || [], next?.speechFiltered || []);
  const hallucinationFiltered = mergeBrowserAsrSegmentLists(current?.hallucinationFiltered || [], next?.hallucinationFiltered || []);
  const finalSegments = mergeBrowserAsrSegmentLists(current?.finalSegments || [], next?.finalSegments || []);
  const dropCounts = {
    speechActivity: Math.max(0, normalized.length - speechFiltered.length),
    hallucinationGuard: Math.max(0, speechFiltered.length - hallucinationFiltered.length),
    chunkOwnership: Math.max(0, hallucinationFiltered.length - finalSegments.length)
  };
  dropCounts.total = dropCounts.speechActivity + dropCounts.hallucinationGuard + dropCounts.chunkOwnership;
  return {
    normalized,
    speechFiltered,
    hallucinationFiltered,
    finalSegments,
    postprocess: {
      policySource: "collected_external_vad",
      collectedChunkCount: (Number(current?.postprocess?.collectedChunkCount || 0) || 0) + 1,
      segmentCounts: {
        normalized: normalized.length,
        speechFiltered: speechFiltered.length,
        hallucinationFiltered: hallucinationFiltered.length,
        final: finalSegments.length
      },
      dropCounts,
      droppedSegments: [
        ...((current?.postprocess || {}).droppedSegments || []),
        ...((next?.postprocess || {}).droppedSegments || [])
      ]
    }
  };
}

function browserAsrDroppedSegments(stage, reason, before = [], after = []) {
  const remaining = new Map();
  for (const segment of after || []) {
    const key = browserAsrSegmentDiagnosticKey(segment);
    remaining.set(key, (remaining.get(key) || 0) + 1);
  }
  const dropped = [];
  for (const segment of before || []) {
    const key = browserAsrSegmentDiagnosticKey(segment);
    const count = remaining.get(key) || 0;
    if (count > 0) {
      remaining.set(key, count - 1);
      continue;
    }
    dropped.push({
      stage,
      reason,
      segment: cloneJsonForDiagnostics(segment)
    });
  }
  return dropped;
}

function browserAsrSegmentDiagnosticKey(segment = {}) {
  return JSON.stringify([
    browserAsrRoundedDiagnosticSecond(segment.start),
    browserAsrRoundedDiagnosticSecond(segment.end),
    cleanVttText(segment.text || "")
  ]);
}

function browserAsrRoundedDiagnosticSecond(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
}

function mergeBrowserAsrClipRetryPostprocess(clipTimestampsPostprocessed, retryPostprocessed) {
  const finalSegments = mergeBrowserAsrSegmentLists(
    clipTimestampsPostprocessed?.finalSegments || [],
    retryPostprocessed?.finalSegments || []
  );
  return {
    ...retryPostprocessed,
    finalSegments,
    postprocess: {
      ...(retryPostprocessed?.postprocess || {}),
      mergedClipTimestampsRetry: true,
      clipTimestampsAttemptFinalCount: (clipTimestampsPostprocessed?.finalSegments || []).length,
      retryFinalCount: (retryPostprocessed?.finalSegments || []).length,
      mergedFinalCount: finalSegments.length,
      segmentCounts: {
        ...((retryPostprocessed?.postprocess || {}).segmentCounts || {}),
        final: finalSegments.length
      }
    }
  };
}

function mergeBrowserAsrSegmentLists(...segmentLists) {
  const segments = segmentLists
    .flat()
    .filter(segment => segment && typeof segment === "object")
    .sort((left, right) => Number(left.start || 0) - Number(right.start || 0) || Number(left.end || 0) - Number(right.end || 0));
  return mergeAdjacentDuplicateAsrSegments(segments);
}

function browserAsrRequestIncludesClipTimestamps(requestFields = []) {
  return (requestFields || []).some(([name]) => name === "clip_timestamps");
}

function browserAsrRequestIncludesVadFilter(requestFields = []) {
  return (requestFields || []).some(([name, value]) => (
    name === "vad_filter" && String(value).trim().toLowerCase() !== "false"
  ));
}

function browserAsrCoverageRetryPlan(segments, chunk = {}, clipTimestamps = "", requestFields = [], supportedRequestFields = new Set(), options = {}) {
  const coverageStats = browserAsrReliableSpeechCoverageStats(segments, chunk);
  if (!browserAsrReliableSpeechCoverageMissingFromStats(coverageStats)) {
    return null;
  }
  if (clipTimestamps && browserAsrRequestIncludesClipTimestamps(requestFields)) {
    return {
      attemptKey: "clipTimestampsAttempt",
      reason: "可靠 VAD 语音区间未被 clip_timestamps 识别结果覆盖，已不带 clip_timestamps 重试。",
      disableVadFilter: false,
      forceSpeechActivityFilter: true,
      forceQualityFilters: true,
      forceCustomRunFilters: true,
      forceVadHallucinationGuard: true,
      filterToCoverageGap: true
    };
  }
  if (!browserAsrRequestIncludesClipTimestamps(requestFields)
    && !browserAsrRequestIncludesVadFilter(requestFields)
    && options.externalVadPrecheck === true
    && asrRequestFieldSupported({ supportedRequestFields }, "vad_filter")) {
    return {
      attemptKey: "directAttempt",
      reason: "可靠 VAD 语音区间未被直连识别结果覆盖，已开启服务端 VAD 重试。",
      disableVadFilter: false,
      forceSpeechActivityFilter: true,
      forceQualityFilters: true,
      forceCustomRunFilters: true,
      forceVadHallucinationGuard: true,
      filterToCoverageGap: true,
      strictVadRecoveryFilter: true
    };
  }
  return null;
}

function browserAsrEmptyVadRecoveryPlan(segments, reliableSpeechIntervals, requestFields = []) {
  if (!Array.isArray(reliableSpeechIntervals) || reliableSpeechIntervals.length) {
    return null;
  }
  if (Array.isArray(segments) && segments.length) {
    return null;
  }
  if (!browserAsrRequestIncludesVadFilter(requestFields)) {
    return null;
  }
  return {
    reason: "外部 VAD 预检为空且服务端 VAD 首轮无字幕，已追加一次严格过滤的非 VAD 补救识别。"
  };
}

function filterBrowserAsrStrictVadRecoveryPostprocess(postprocessed = {}) {
  const inputSegments = postprocessed?.finalSegments || [];
  const finalSegments = filterAsrStrictVadRecoverySegments(inputSegments);
  const inputCount = inputSegments.length;
  const finalCount = finalSegments.length;
  return {
    ...(postprocessed || {}),
    finalSegments,
    postprocess: {
      ...((postprocessed || {}).postprocess || {}),
      strictVadRecoveryFilterApplied: true,
      strictVadRecoveryInputFinalCount: inputCount,
      strictVadRecoveryFinalCount: finalCount,
      segmentCounts: {
        ...(((postprocessed || {}).postprocess || {}).segmentCounts || {}),
        final: finalCount
      },
      dropCounts: {
        ...(((postprocessed || {}).postprocess || {}).dropCounts || {}),
        strictVadRecovery: Math.max(0, inputCount - finalCount)
      }
    }
  };
}

function filterBrowserAsrCoverageRetryPostprocess(attemptPostprocessed, retryPostprocessed, chunk = {}, rawPayload = null, asrConfig = {}, options = {}) {
  const retrySegments = retryPostprocessed?.finalSegments || [];
  const uncoveredIntervals = browserAsrUncoveredSpeechIntervalsForSegments(attemptPostprocessed?.finalSegments || [], chunk);
  if (!uncoveredIntervals.length || !retrySegments.length) {
    return {
      ...retryPostprocessed,
      finalSegments: [],
      postprocess: browserAsrCoverageRetryFilteredPostprocess(retryPostprocessed?.postprocess, retrySegments.length, 0)
    };
  }
  const rawRetrySegments = normalizeBrowserAsrRetryPayloadSegments(rawPayload, chunk, asrConfig);
  const repeatedKeys = browserAsrRepeatedCoverageRetryKeys(rawRetrySegments.length ? rawRetrySegments : retrySegments);
  const coverageSegments = retrySegments.filter(segment => browserAsrSegmentOverlapsCoverageGap(segment, uncoveredIntervals));
  const gapSegments = browserAsrDropRepeatedCoverageRetrySegments(coverageSegments, repeatedKeys);
  const finalSegments = options.strictVadRecoveryFilter
    ? filterAsrStrictVadRecoverySegments(gapSegments)
    : gapSegments;
  return {
    ...retryPostprocessed,
    finalSegments,
    postprocess: browserAsrCoverageRetryFilteredPostprocess(
      retryPostprocessed?.postprocess,
      retrySegments.length,
      finalSegments.length
    )
  };
}

function normalizeBrowserAsrRetryPayloadSegments(rawPayload, chunk = {}, asrConfig = {}) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return [];
  }
  try {
    return normalizeAsrSegments(rawPayload, chunk.start, chunk.end, {
      providerType: asrConfig?.providerType,
      disableCustomRunFilters: true,
      disableCustomQualityFilters: true
    });
  } catch (_error) {
    return [];
  }
}

function browserAsrCoverageRetryFilteredPostprocess(postprocess = {}, inputCount = 0, finalCount = 0) {
  return {
    ...(postprocess || {}),
    coverageRetryFilterApplied: true,
    coverageRetryInputFinalCount: Math.max(0, Number(inputCount) || 0),
    coverageRetryFinalCount: Math.max(0, Number(finalCount) || 0),
    segmentCounts: {
      ...((postprocess || {}).segmentCounts || {}),
      final: Math.max(0, Number(finalCount) || 0)
    }
  };
}

function browserAsrUncoveredSpeechIntervalsForSegments(segments, chunk = {}) {
  const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals) || [];
  return speechIntervals.flatMap(interval => browserAsrUncoveredSpeechIntervals(segments, interval));
}

function browserAsrUncoveredSpeechIntervals(segments, interval) {
  const intervalStart = Number(interval?.start);
  const intervalEnd = Number(interval?.end);
  if (!Number.isFinite(intervalStart) || !Number.isFinite(intervalEnd) || intervalEnd <= intervalStart) {
    return [];
  }
  const coverageSpans = browserAsrSpeechCoverageSpans(segments, intervalStart, intervalEnd);
  const gaps = [];
  let cursor = intervalStart;
  for (const span of coverageSpans) {
    const start = Math.max(intervalStart, Number(span.start));
    const end = Math.min(intervalEnd, Number(span.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    if (start > cursor) {
      gaps.push({ start: cursor, end: start });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < intervalEnd) {
    gaps.push({ start: cursor, end: intervalEnd });
  }
  return gaps.filter(gap => gap.end - gap.start >= 0.08);
}

function browserAsrSegmentOverlapsCoverageGap(segment, intervals = []) {
  const start = Number(segment?.start);
  const end = Number(segment?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false;
  }
  const duration = Math.max(0, end - start);
  return intervals.some(interval => {
    const overlap = Math.max(0, Math.min(end, interval.end + 0.2) - Math.max(start, interval.start - 0.2));
    if (overlap <= 0) {
      return false;
    }
    return overlap >= Math.min(0.35, Math.max(0.08, duration * 0.25));
  });
}

function browserAsrRepeatedCoverageRetryKeys(segments = []) {
  const groups = new Map();
  for (const segment of segments) {
    const key = normalizeBrowserAsrRetryRepeatText(segment?.text);
    if (!key || key.length < 6) {
      continue;
    }
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(segment);
  }
  const repeatedKeys = new Set();
  for (const [key, group] of groups.entries()) {
    if (group.length < 2) {
      continue;
    }
    const firstStart = Math.min(...group.map(segment => Number(segment.start)).filter(Number.isFinite));
    const lastEnd = Math.max(...group.map(segment => Number(segment.end)).filter(Number.isFinite));
    if (Number.isFinite(firstStart) && Number.isFinite(lastEnd) && lastEnd - firstStart >= 6) {
      repeatedKeys.add(key);
    }
  }
  return repeatedKeys;
}

function browserAsrDropRepeatedCoverageRetrySegments(segments = [], repeatedKeys = browserAsrRepeatedCoverageRetryKeys(segments)) {
  if (!repeatedKeys.size) {
    return segments;
  }
  return segments.filter(segment => !repeatedKeys.has(normalizeBrowserAsrRetryRepeatText(segment?.text)));
}

function normalizeBrowserAsrRetryRepeatText(text = "") {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .toLowerCase()
    .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—\-~〜ー]+/g, "")
    .trim();
}

function browserAsrReliableSpeechCoverageStats(segments, chunk = {}) {
  const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals) || [];
  if (!speechIntervals.length) {
    return null;
  }
  const significantIntervals = speechIntervals.filter(interval => interval.end - interval.start >= 0.15);
  if (!significantIntervals.length) {
    return null;
  }
  const speechSeconds = significantIntervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
  const uncoveredSeconds = significantIntervals.reduce((sum, interval) => (
    sum + browserAsrUncoveredSpeechSeconds(segments, interval)
  ), 0);
  return {
    speechSeconds,
    uncoveredSeconds,
    uncoveredRatio: speechSeconds > 0 ? uncoveredSeconds / speechSeconds : 0,
    intervalCount: significantIntervals.length
  };
}

function browserAsrReliableSpeechCoverageMissingFromStats(stats) {
  if (!stats) {
    return false;
  }
  const recoveryThreshold = Math.min(1, Math.max(0.15, stats.speechSeconds * 0.25));
  return stats.uncoveredSeconds >= recoveryThreshold;
}

function browserAsrUncoveredSpeechSeconds(segments, interval) {
  const intervalStart = Number(interval?.start);
  const intervalEnd = Number(interval?.end);
  if (!Number.isFinite(intervalStart) || !Number.isFinite(intervalEnd) || intervalEnd <= intervalStart) {
    return 0;
  }
  const coverageSpans = browserAsrSpeechCoverageSpans(segments, intervalStart, intervalEnd);
  if (!coverageSpans.length) {
    return intervalEnd - intervalStart;
  }
  let coveredSeconds = 0;
  let coveredUntil = intervalStart;
  for (const span of coverageSpans) {
    const start = Math.max(intervalStart, Number(span.start));
    const end = Math.min(intervalEnd, Number(span.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= coveredUntil) {
      continue;
    }
    const effectiveStart = Math.max(start, coveredUntil);
    coveredSeconds += Math.max(0, end - effectiveStart);
    coveredUntil = Math.max(coveredUntil, end);
  }
  return Math.max(0, (intervalEnd - intervalStart) - coveredSeconds);
}

function browserAsrSpeechCoverageSpans(segments, intervalStart, intervalEnd) {
  return (segments || []).map(segment => {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    const paddedStart = start - 0.35;
    const paddedEnd = end + 0.35;
    const coverageStart = Math.max(intervalStart, paddedStart);
    const coverageEnd = Math.min(intervalEnd, paddedEnd);
    if (coverageEnd <= coverageStart) {
      return null;
    }
    return { start: coverageStart, end: coverageEnd };
  }).filter(Boolean).sort((left, right) => left.start - right.start || left.end - right.end);
}

async function detectBrowserAsrSpeechIntervals(chunk, asrConfig, fileBuffer, fileName, diagnostics = null, options = {}) {
  const endpoint = options.endpoint || await resolveBrowserAsrSpeechTimestampsEndpoint(asrConfig);
  if (!endpoint) {
    return null;
  }
  if (diagnostics) {
    diagnostics.vad = {
      endpoint: sanitizeDiagnosticUrl(endpoint),
      requestFields: [
        ["threshold", "0.15"],
        ["min_speech_duration_ms", "0"],
        ["max_speech_duration_s", "30"],
        ["min_silence_duration_ms", "160"],
        ["speech_pad_ms", "800"]
      ],
      speechIntervals: null,
      reliable: false
    };
  }
  const controller = new AbortController();
  const unlink = linkBrowserAbortSignal(options.signal, controller);
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: chunk.file?.mime || "audio/mpeg" }), fileName);
    formData.append("threshold", "0.15");
    formData.append("min_speech_duration_ms", "0");
    formData.append("max_speech_duration_s", "30");
    formData.append("min_silence_duration_ms", "160");
    formData.append("speech_pad_ms", "800");
    const transport = typeof options.requestTransport === "function" ? options.requestTransport : fetch;
    const response = await transport(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asrConfig.apiKey}`
      },
      body: formData,
      signal: controller.signal
    }, {
      semanticRequestPath: String(options.semanticRequestPath || "asr/vad/precheck"),
      operationType: "asr-vad",
      bodyIdentity: {
        requestFields: [
          ["threshold", "0.15"],
          ["min_speech_duration_ms", "0"],
          ["max_speech_duration_s", "30"],
          ["min_silence_duration_ms", "160"],
          ["speech_pad_ms", "800"]
        ],
        audioHash: `sha256:${await sha256Hex(fileBuffer)}`,
        fileName,
        mime: chunk.file?.mime || "audio/mpeg"
      }
    });
    if (!response.ok) {
      if (diagnostics?.vad) {
        diagnostics.vad.error = `HTTP ${response.status}`;
      }
      return null;
    }
    const payload = await response.json().catch(() => null);
    const intervals = normalizeBrowserAsrSpeechTimestampsPayload(payload, chunk);
    if (diagnostics?.vad) {
      diagnostics.vad.rawPayload = cloneJsonForDiagnostics(payload);
      diagnostics.vad.speechIntervals = Array.isArray(intervals) ? cloneJsonForDiagnostics(intervals) : null;
      diagnostics.vad.reliable = Array.isArray(intervals);
    }
    return Array.isArray(intervals) ? intervals : null;
  } catch (error) {
    if (options.signal?.aborted) {
      throw browserAbortError(options.signal.reason);
    }
    if (diagnostics?.vad) {
      diagnostics.vad.error = error?.message || String(error || "VAD 请求失败");
    }
    return null;
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

async function sha256Hex(value) {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : (ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : new TextEncoder().encode(String(value)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeBrowserAsrSpeechTimestampsPayload(payload, chunk = {}) {
  const items = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.speech_segments)
        ? payload.speech_segments
        : (Array.isArray(payload?.segments)
            ? payload.segments
            : (Array.isArray(payload?.timestamps) ? payload.timestamps : null)));
  if (!Array.isArray(items)) {
    return null;
  }
  const start = Number(chunk?.start || 0) || 0;
  const end = Number(chunk?.end || (start + Number(chunk?.duration || 0))) || start;
  const duration = Math.max(0, end - start);
  const raw = items
    .map(item => browserAsrSpeechTimestampRangeSeconds(item, duration))
    .filter(item => item.end > item.start);
  return raw
    .map(item => ({
      start: Math.max(start, start + item.start),
      end: Math.min(end, start + item.end)
    }))
    .filter(item => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function browserAsrSpeechTimestampRangeSeconds(item, chunkDuration = 0) {
  const startMs = browserAsrSpeechTimestampNumber(item, "start_ms");
  const endMs = browserAsrSpeechTimestampNumber(item, "end_ms");
  if (Number.isFinite(startMs) || Number.isFinite(endMs)) {
    return { start: startMs / 1000, end: endMs / 1000 };
  }
  const startTime = browserAsrSpeechTimestampNumber(item, "start_time");
  const endTime = browserAsrSpeechTimestampNumber(item, "end_time");
  if (Number.isFinite(startTime) || Number.isFinite(endTime)) {
    return { start: startTime, end: endTime };
  }
  const start = browserAsrSpeechTimestampNumber(item, "start");
  const end = browserAsrSpeechTimestampNumber(item, "end");
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { start: NaN, end: NaN };
  }
  const unit = inferBrowserAsrBareTimestampUnit(start, end, chunkDuration);
  return unit === "milliseconds"
    ? { start: start / 1000, end: end / 1000 }
    : { start, end };
}

function browserAsrSpeechTimestampNumber(item, key) {
  if (!Object.prototype.hasOwnProperty.call(item || {}, key)) {
    return NaN;
  }
  const value = Number(item[key]);
  return Number.isFinite(value) ? value : NaN;
}

function inferBrowserAsrBareTimestampUnit(start, end, chunkDuration = 0) {
  const duration = Math.max(0, Number(chunkDuration) || 0);
  const span = Math.max(0, Number(end) - Number(start));
  const maxValue = Math.max(Math.abs(Number(start)), Math.abs(Number(end)));
  if (!Number.isInteger(Number(start)) || !Number.isInteger(Number(end))) {
    return "seconds";
  }
  if (isLikelyBrowserAsrBareIntegerSeconds(start, end, duration, span, maxValue)) {
    return "seconds";
  }
  if (span > 45) {
    return "milliseconds";
  }
  if (duration && maxValue > duration + 1) {
    return "milliseconds";
  }
  return "seconds";
}

function isLikelyBrowserAsrBareIntegerSeconds(start, end, duration, span, maxValue) {
  return duration >= BROWSER_ASR_BARE_TIMESTAMP_SECONDS_LONG_CHUNK_SECONDS
    && maxValue < BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MAX_VALUE
    && maxValue <= duration + 1
    && span > BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MIN_SPAN
    && Number(end) > Number(start);
}

function emitBrowserAsrDiagnostics(options = {}, diagnostics = {}) {
  if (typeof options.onDiagnostics !== "function") {
    return;
  }
  try {
    options.onDiagnostics(cloneJsonForDiagnostics(diagnostics));
  } catch {
    // Diagnostics must not affect the ASR pipeline.
  }
}

function recordBrowserAsrChunkDiagnostics(record, chunk, diagnostics = {}) {
  if (!record) {
    return;
  }
  if (!record.browserAsrDiagnosticsByChunk) {
    record.browserAsrDiagnosticsByChunk = new Map();
  }
  const index = Number.isInteger(Number(chunk?.index)) ? Number(chunk.index) : Number(diagnostics?.chunk?.index);
  const key = Number.isFinite(index) ? index : record.browserAsrDiagnosticsByChunk.size;
  record.browserAsrDiagnosticsByChunk.set(key, {
    ...cloneJsonForDiagnostics(diagnostics),
    recordedAt: new Date().toISOString()
  });
}

function browserAsrDiagnosticChunkInfo(chunk = {}) {
  const file = chunk.file || {};
  const parts = Array.isArray(file.parts)
    ? file.parts.map(part => browserAsrDiagnosticChunkInfo(part))
    : undefined;
  return {
    index: Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : undefined,
    start: finiteOrNull(chunk.start),
    end: finiteOrNull(chunk.end),
    duration: finiteOrNull(chunk.duration),
    coreStart: finiteOrNull(chunk.coreStart),
    coreEnd: finiteOrNull(chunk.coreEnd),
    coreDuration: finiteOrNull(chunk.coreDuration),
    bytes: Number(chunk.bytes || file.bytes || 0) || 0,
    internalChunkCount: Number(chunk.internalChunkCount || 0) || (parts?.length || undefined),
    speechIntervalsReliable: chunk.speechIntervalsReliable === false ? false : undefined,
    speechIntervals: Array.isArray(chunk.speechIntervals) ? cloneJsonForDiagnostics(chunk.speechIntervals) : undefined,
    file: {
      name: file.name || "",
      mime: file.mime || "",
      bytes: Number(file.bytes || chunk.bytes || 0) || 0,
      cacheUrl: file.cacheUrl || "",
      parts
    }
  };
}

function normalizeBrowserAsrCollectedSpeechChunk(sourceChunk = {}, chunk = {}, fallbackIndex = 0) {
  if (!chunk || typeof chunk !== "object" || !isUsableBrowserAudioFile(chunk.file)) {
    return null;
  }
  const duration = Math.max(0, Number(chunk.duration || (Number(chunk.end) - Number(chunk.start)) || 0) || 0);
  const sourceStart = Number.isFinite(Number(chunk.sourceStart)) ? Number(chunk.sourceStart) : Number(chunk.start || sourceChunk.start || 0);
  const sourceEnd = Number.isFinite(Number(chunk.sourceEnd)) ? Number(chunk.sourceEnd) : Number(chunk.end || sourceStart);
  const timeMap = normalizeBrowserAsrCollectedSpeechTimeMap(chunk.timeMap);
  return {
    index: Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : fallbackIndex,
    start: 0,
    end: duration,
    duration,
    coreStart: 0,
    coreEnd: duration,
    coreDuration: duration,
    sourceStart,
    sourceEnd,
    sourceChunkIndex: Number.isInteger(Number(sourceChunk.index)) ? Number(sourceChunk.index) : undefined,
    speechIntervals: Array.isArray(chunk.speechIntervals) ? normalizeAsrSpeechIntervals(chunk.speechIntervals) || [] : [],
    speechIntervalsReliable: false,
    timeMap,
    file: chunk.file,
    bytes: chunk.bytes || browserAudioFileByteLength(chunk.file) || 0
  };
}

function browserAsrCollectedSpeechChunkInfo(chunk = {}) {
  return {
    index: Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : undefined,
    sourceChunkIndex: Number.isInteger(Number(chunk.sourceChunkIndex)) ? Number(chunk.sourceChunkIndex) : undefined,
    sourceStart: finiteOrNull(chunk.sourceStart),
    sourceEnd: finiteOrNull(chunk.sourceEnd),
    duration: finiteOrNull(chunk.duration),
    bytes: Number(chunk.bytes || chunk.file?.bytes || 0) || 0,
    speechIntervals: Array.isArray(chunk.speechIntervals) ? cloneJsonForDiagnostics(chunk.speechIntervals) : undefined,
    timeMap: Array.isArray(chunk.timeMap) ? cloneJsonForDiagnostics(chunk.timeMap) : undefined,
    file: {
      name: chunk.file?.name || "",
      mime: chunk.file?.mime || "",
      bytes: Number(chunk.file?.bytes || chunk.bytes || 0) || 0,
      cacheUrl: chunk.file?.cacheUrl || ""
    }
  };
}

function cloneJsonForDiagnostics(value) {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeDiagnosticUrl(value = "") {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return text.replace(/[?#].*$/, "");
  }
}

function formatAsrFetchError(error, endpoint) {
  const message = error?.message || String(error || "网络不可达");
  return `${endpoint} 无法连接（${message}）。请确认浏览器能访问该 API 地址，并且目标服务允许扩展发起跨域请求。`;
}

  return {
    isUsableBrowserAudioFile,
    browserAudioFileByteLength,
    assertBrowserAsrChunkCanUpload,
    assertBrowserAsrUploadAudioBytes,
    browserAsrExpectedAudioContainer,
    browserAsrBytesLookLikeWav,
    browserAsrBytesLookLikeMp3,
    browserAsrMp3AudioFrameScanStart,
    transcribeBrowserAudioChunk,
    shouldRetryBrowserAsrClipRequestError,
    shouldUseBrowserAsrExternalVadPrecheck,
    shouldUseBrowserAsrNativeVadTranscription,
    shouldUseBrowserAsrCollectedSpeechAudio,
    browserAsrCollectedSpeechAudioExplicitlyEnabled,
    shouldDisableBrowserAsrServerVadForRecall,
    transcribeBrowserCollectedSpeechAudioChunk,
    collectBrowserAsrSpeechAudioChunks,
    browserAsrClipTimestampsSkippedReason,
    browserAsrSpeechIntervalRequiresServerVad,
    browserAsrAttemptDiagnosticsFromError,
    createBrowserAsrMaturePlan,
    browserAsrMaturePlanForRequest,
    createBrowserAsrPostprocessPolicy,
    browserAsrPostprocessPolicyWithOverrides,
    browserAsrMatureRequestMode,
    normalizeBrowserAsrPlanClipTimestamps,
    normalizeBrowserAsrRequestFieldsForDiagnostics,
    requestBrowserAsrTranscription,
    detectBrowserAsrSpeechIntervals,
    postprocessBrowserAsrPayloadOrThrow,
    applyBrowserAsrErrorDiagnostics,
    createBrowserAsrRequestError,
    browserAsrResponseErrorMessage,
    browserAsrUploadFileSummary,
    browserAsrAsciiHead,
    postprocessBrowserAsrPayload,
    postprocessBrowserAsrCollectedSpeechPayload,
    restoreBrowserAsrCollectedSpeechSegments,
    normalizeBrowserAsrCollectedSpeechTimeMap,
    browserAsrCollectedSpeechMapItemForTime,
    restoreBrowserAsrCollectedSpeechTime,
    mergeBrowserAsrCollectedSpeechPostprocess,
    browserAsrDroppedSegments,
    browserAsrSegmentDiagnosticKey,
    browserAsrRoundedDiagnosticSecond,
    browserAsrCoverageRetryPlan,
    browserAsrRequestIncludesClipTimestamps,
    browserAsrRequestIncludesVadFilter,
    browserAsrEmptyVadRecoveryPlan,
    filterBrowserAsrStrictVadRecoveryPostprocess,
    filterBrowserAsrCoverageRetryPostprocess,
    normalizeBrowserAsrRetryPayloadSegments,
    browserAsrCoverageRetryFilteredPostprocess,
    browserAsrUncoveredSpeechIntervalsForSegments,
    browserAsrUncoveredSpeechIntervals,
    browserAsrSegmentOverlapsCoverageGap,
    browserAsrRepeatedCoverageRetryKeys,
    browserAsrDropRepeatedCoverageRetrySegments,
    normalizeBrowserAsrRetryRepeatText,
    browserAsrReliableSpeechCoverageStats,
    browserAsrReliableSpeechCoverageMissingFromStats,
    browserAsrUncoveredSpeechSeconds,
    browserAsrSpeechCoverageSpans,
    mergeBrowserAsrClipRetryPostprocess,
    mergeBrowserAsrSegmentLists,
    normalizeBrowserAsrSpeechTimestampsPayload,
    browserAsrSpeechTimestampRangeSeconds,
    browserAsrSpeechTimestampNumber,
    inferBrowserAsrBareTimestampUnit,
    isLikelyBrowserAsrBareIntegerSeconds,
    emitBrowserAsrDiagnostics,
    recordBrowserAsrChunkDiagnostics,
    browserAsrDiagnosticChunkInfo,
    normalizeBrowserAsrCollectedSpeechChunk,
    browserAsrCollectedSpeechChunkInfo,
    cloneJsonForDiagnostics,
    finiteOrNull,
    sanitizeDiagnosticUrl,
    browserAbortError,
    isBrowserAbortError,
    linkBrowserAbortSignal,
    formatAsrFetchError,
    browserAsrMaxUploadBytes,
    formatBytes
  };
})();
