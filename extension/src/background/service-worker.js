import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";
import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";
import { FuguangBrowserLanguage } from "./browser-language.js";
import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";
import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";
import { FuguangBrowserFunAsrProvider } from "./browser-funasr-provider.js";
import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";
import { FuguangMediaHeaderRules } from "./media-header-rules.js";

var normalizeAsrTimeoutMs = FuguangBrowserAsrProvider.normalizeAsrTimeoutMs;
var ASR_VAD_SPLIT_MIN_SILENCE_SECONDS = FuguangBrowserAsrPostprocess.ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
var filterAsrSegmentsByChunkOwnership = FuguangBrowserAsrPostprocess.filterAsrSegmentsByChunkOwnership;
var filterAsrDistributedRepeatedRuns = FuguangBrowserAsrPostprocess.filterAsrDistributedRepeatedRuns;
var filterAsrSegmentsByHallucinationGuard = FuguangBrowserAsrPostprocess.filterAsrSegmentsByHallucinationGuard;
var filterAsrSegmentsBySpeechActivity = FuguangBrowserAsrPostprocess.filterAsrSegmentsBySpeechActivity;
var filterAsrStrictVadRecoverySegments = FuguangBrowserAsrPostprocess.filterAsrStrictVadRecoverySegments;
var filterAsrSuspiciousRepeatedRuns = FuguangBrowserAsrPostprocess.filterAsrSuspiciousRepeatedRuns;
var mergeAdjacentDuplicateAsrSegments = FuguangBrowserAsrPostprocess.mergeAdjacentDuplicateAsrSegments;
var mergeAsrSpeechIntervals = FuguangBrowserAsrPostprocess.mergeAsrSpeechIntervals;
var normalizeAsrSegments = FuguangBrowserAsrPostprocess.normalizeAsrSegments;
var normalizeAsrSpeechIntervals = FuguangBrowserAsrPostprocess.normalizeAsrSpeechIntervals;
var shouldSkipBrowserAsrChunk = FuguangBrowserAsrPostprocess.shouldSkipBrowserAsrChunk;
var browserAsrRequestFields = FuguangBrowserAsrProvider.browserAsrRequestFields;
var browserAsrClipTimestampsValue = FuguangBrowserAsrProvider.browserAsrClipTimestampsValue;
var asrRequestFieldSupported = FuguangBrowserAsrProvider.asrRequestFieldSupported;
var resolveBrowserAsrSupportedRequestFields = FuguangBrowserAsrProvider.resolveBrowserAsrSupportedRequestFields;
var resolveBrowserAsrSpeechTimestampsEndpoint = FuguangBrowserAsrProvider.resolveBrowserAsrSpeechTimestampsEndpoint;
var normalizeAsrVadFilterMode = FuguangBrowserAsrProvider.normalizeAsrVadFilterMode;
var browserAsrEndpoint = FuguangBrowserAsrProvider.browserAsrEndpoint;
var normalizeAsrLanguage = FuguangBrowserAsrProvider.normalizeAsrLanguage;
var normalizeTargetLanguage = FuguangBrowserLanguage.normalizeTargetLanguage;
var DEFAULT_ASR_PROFILE_ID = FuguangBrowserModelProfiles.DEFAULT_ASR_PROFILE_ID;
var AUDIO_EXTENSIONS = FuguangBrowserMediaCandidates.AUDIO_EXTENSIONS;
var MANIFEST_EXTENSIONS = FuguangBrowserMediaCandidates.MANIFEST_EXTENSIONS;
var candidateFingerprint = FuguangBrowserMediaCandidates.candidateFingerprint;
var candidatesReferToSamePreloadTarget = FuguangBrowserMediaCandidates.candidatesReferToSamePreloadTarget;
var classifyUrl = FuguangBrowserMediaCandidates.classifyUrl;
var compactRequestHeaders = FuguangBrowserMediaCandidates.compactRequestHeaders;
var compactResponseHeaders = FuguangBrowserMediaCandidates.compactResponseHeaders;
var firstUsefulTitle = FuguangBrowserMediaCandidates.firstUsefulTitle;
var getGroupedCandidatesForState = FuguangBrowserMediaCandidates.getGroupedCandidatesForState;
var getHeader = FuguangBrowserMediaCandidates.getHeader;
var inferKindFromContentType = FuguangBrowserMediaCandidates.inferKindFromContentType;
var isGenericBinaryContentType = FuguangBrowserMediaCandidates.isGenericBinaryContentType;
var isIgnoredMediaUrl = FuguangBrowserMediaCandidates.isIgnoredMediaUrl;
var isMediaContentType = FuguangBrowserMediaCandidates.isMediaContentType;
var mergeCandidate = FuguangBrowserMediaCandidates.mergeCandidate;
var pickFinite = FuguangBrowserMediaCandidates.pickFinite;
var pruneCandidatesForRetention = FuguangBrowserMediaCandidates.pruneCandidatesForRetention;
var resolvePreloadCandidateForStart = FuguangBrowserMediaCandidates.resolvePreloadCandidateForStart;
var sanitizeInternalRequestHeaders = FuguangBrowserMediaCandidates.sanitizeInternalRequestHeaders;
var stripCandidateRequestHeaders = FuguangBrowserMediaCandidates.stripCandidateRequestHeaders;
var DEFAULT_LLM_PROFILE_ID = FuguangBrowserModelProfiles.DEFAULT_LLM_PROFILE_ID;
var compactProviderConfig = FuguangBrowserModelProfiles.compactProviderConfig;
var findProfile = FuguangBrowserModelProfiles.findProfile;
var normalizeProviderType = FuguangBrowserModelProfiles.normalizeProviderType;
var normalizeSelectedProfileId = FuguangBrowserModelProfiles.normalizeSelectedProfileId;
var normalizeStoredProfiles = FuguangBrowserModelProfiles.normalizeStoredProfiles;
var profilesForStorage = FuguangBrowserModelProfiles.profilesForStorage;
var isDashScopeFunAsrConfig = FuguangBrowserFunAsrProvider.isDashScopeFunAsrConfig;
var dashScopeFunAsrChunkSeconds = FuguangBrowserFunAsrProvider.dashScopeFunAsrChunkSeconds;
var dashScopeFunAsrShouldDiarize = FuguangBrowserFunAsrProvider.dashScopeFunAsrShouldDiarize;
var normalizeDashScopeFunAsrResult = FuguangBrowserFunAsrProvider.normalizeDashScopeFunAsrResult;
var transcribeDashScopeFunAsrFile = FuguangBrowserFunAsrProvider.transcribeDashScopeFunAsrFile;
var translateBrowserSegments = FuguangBrowserTranslationPipeline.translateBrowserSegments;
var translateBrowserSegmentsBatch = FuguangBrowserTranslationPipeline.translateBrowserSegmentsBatch;
var browserTranslationFailures = FuguangBrowserTranslationPipeline.browserTranslationFailures;
var withMediaRequestHeaderRules = FuguangMediaHeaderRules.withMediaRequestHeaderRules;
var updateMediaRequestHeaderRuleDomains = FuguangMediaHeaderRules.updateMediaRequestHeaderRuleDomains;
var buildMediaHeaderRules = FuguangMediaHeaderRules.buildMediaHeaderRules;

const MESSAGE = {
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  ACTIVATE_PAGE: "FUGUANG_ACTIVATE_PAGE",
  START_PRELOAD_AUTO: "FUGUANG_START_PRELOAD_AUTO",
  RETRY_PRELOAD: "FUGUANG_RETRY_PRELOAD",
  RETRY_PRELOAD_CHUNKS: "FUGUANG_RETRY_PRELOAD_CHUNKS",
  RERUN_ASR_PRELOAD: "FUGUANG_RERUN_ASR_PRELOAD",
  RETRANSLATE_PRELOAD: "FUGUANG_RETRANSLATE_PRELOAD",
  RETRANSLATE_TRANSCRIPT: "FUGUANG_RETRANSLATE_TRANSCRIPT",
  CANCEL_PRELOAD: "FUGUANG_CANCEL_PRELOAD",
  CLEAR_PRELOAD_AUDIO_CACHE: "FUGUANG_CLEAR_PRELOAD_AUDIO_CACHE",
  CHECK_PRELOAD_JOB: "FUGUANG_CHECK_PRELOAD_JOB",
  GET_PRELOAD_VTT: "FUGUANG_GET_PRELOAD_VTT",
  GET_PRELOAD_TRANSCRIPT: "FUGUANG_GET_PRELOAD_TRANSCRIPT",
  GET_PRELOAD_DIAGNOSTICS: "FUGUANG_GET_PRELOAD_DIAGNOSTICS",
  PAGE_MEDIA_FOUND: "FUGUANG_PAGE_MEDIA_FOUND",
  PAGE_CONTEXT_FOUND: "FUGUANG_PAGE_CONTEXT_FOUND",
  ATTACH_VTT: "FUGUANG_ATTACH_VTT",
  ATTACH_VTT_TEXT: "FUGUANG_ATTACH_VTT_TEXT",
  DETACH_PRELOAD_VTT: "FUGUANG_DETACH_PRELOAD_VTT",
  CLEAR_PRELOAD_SUBTITLE_STATE: "FUGUANG_CLEAR_PRELOAD_SUBTITLE_STATE",
  GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE",
  SEEK_MEDIA: "FUGUANG_SEEK_MEDIA",
  OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY",
  UPDATE_MEDIA_HEADER_RULE_DOMAINS: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS"
};

const DEFAULT_WEB_FFMPEG_PATH = "web-ffmpeg/index.html";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_AUDIO_CACHE_CLEANUP_ALARM = "fuguang-audio-cache-cleanup";
const WEB_FFMPEG_AUDIO_CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const WEB_FFMPEG_AUDIO_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const WEB_FFMPEG_AUDIO_CACHE_CLEANUP_INTERVAL_MINUTES = 60;
const WEB_FFMPEG_AUDIO_CACHE_MIN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CAPTION_POSITION_STORAGE_KEY = "captionPosition";
const LEGACY_CAPTION_TOP_RATIO_KEY = "captionTopRatio";
const DEFAULT_MODEL_SETTINGS = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  webFfmpegPerformance: "auto",
  asrWorkers: 1,
  translationWorkers: 3,
  chunkMinutes: 15
};
const BROWSER_ASR_UPLOAD_CHUNK_SECONDS = 15 * 60;
const BROWSER_ASR_COMPAT_VAD_ONLY_UPLOAD_CHUNK_SECONDS = 30;
const BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS = 30 * 60;
const BROWSER_ASR_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_LONG_CHUNK_SECONDS = 5 * 60;
const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MAX_VALUE = 1000;
const BROWSER_ASR_BARE_TIMESTAMP_SECONDS_MIN_SPAN = 45;
const BROWSER_ASR_MATURE_MAX_SPEECH_DURATION_SECONDS = 30;
const BROWSER_ASR_LONG_SPEECH_INTERVAL_TOLERANCE_SECONDS = 0.5;
const MODEL_SETTINGS_VERSION = 5;
const MAX_CANDIDATES_PER_TAB = 80;
const requestHeadersById = new Map();
const browserPreloadJobs = new Map();
let browserAudioCacheCleanupPromise = null;
let browserAudioCacheLastCleanupAt = 0;

const tabState = new Map();

try {
  const accessLevelPromise = chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
  accessLevelPromise?.catch?.(() => {});
} catch {
  // Older Chromium builds may not support storage access-level controls.
}
migrateLegacyCaptionPosition();
enableSidePanelAction();
scheduleBrowserAudioCacheMaintenance();

chrome.action.onClicked.addListener(tab => {
  if (!tab?.id) {
    return;
  }
  openSidePanel(tab.id).catch(error => {
    setTabStatus(tab.id, { error: error.message });
  });
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (details.requestId && details.requestHeaders) {
      requestHeadersById.set(details.requestId, compactRequestHeaders(details.requestHeaders));
    }
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const classification = classifyUrl(details.url);
    if (!classification) {
      return;
    }
    addCandidate(details.tabId, {
      url: details.url,
      source: "request-headers",
      kind: classification.kind,
      ext: classification.ext,
      requestId: details.requestId,
      requestHeaders: requestHeadersById.get(details.requestId),
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const classification = classifyUrl(details.url);
    if (!classification) {
      return;
    }
    addCandidate(details.tabId, {
      url: details.url,
      source: "request",
      kind: classification.kind,
      ext: classification.ext,
      requestId: details.requestId,
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] }
);

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const contentType = getHeader(details.responseHeaders, "content-type");
    const classification = classifyUrl(details.url);
    if (!contentType || (!classification && !isMediaContentType(contentType))) {
      return;
    }
    if (!classification && isGenericBinaryContentType(contentType)) {
      return;
    }
    const resolvedClassification = classification || { kind: inferKindFromContentType(contentType), ext: "" };
    const responseHeaders = compactResponseHeaders(details.responseHeaders);
    addCandidate(details.tabId, {
      url: details.url,
      source: "response",
      kind: resolvedClassification.kind,
      ext: resolvedClassification.ext,
      requestId: details.requestId,
      contentType,
      responseHeaders,
      requestHeaders: requestHeadersById.get(details.requestId),
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] },
  ["responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  details => {
    requestHeadersById.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  details => {
    requestHeadersById.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return undefined;
});

chrome.webNavigation.onHistoryStateUpdated?.addListener(details => {
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return clearFrameNavigationState(details.tabId, details.frameId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
});

async function clearTopLevelNavigationState(tabId, { detachSubtitles = false } = {}) {
  try {
    if (detachSubtitles) {
      await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT });
    }
  } finally {
    tabState.delete(tabId);
  }
}

async function clearFrameNavigationState(tabId, frameId) {
  const state = tabState.get(tabId);
  const numericFrameId = Number(frameId);
  if (!state || !Number.isFinite(numericFrameId)) {
    return;
  }
  const ownsCurrentMedia =
    state.subtitleFrameId === numericFrameId ||
    state.mediaFrameId === numericFrameId ||
    state.context?.frameId === numericFrameId ||
    state.lastPreloadCandidate?.frameId === numericFrameId;
  if (!ownsCurrentMedia) {
    return;
  }
  if (state.attachedVttSignature || state.manualVttSignature) {
    await chrome.tabs.sendMessage(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }, { frameId: numericFrameId }).catch(() => null);
  }
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  if (state.subtitleFrameId === numericFrameId) {
    state.subtitleFrameId = null;
  }
  if (state.mediaFrameId === numericFrameId) {
    state.mediaFrameId = null;
  }
  if (state.context?.frameId === numericFrameId) {
    state.context = {};
  }
  if (state.lastPreloadCandidate?.frameId === numericFrameId) {
    state.lastPreloadCandidate = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      if (message?.tabId) {
        setTabStatus(message.tabId, { error: error.message });
      }
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});

async function handleMessage(message, sender) {
  requestBrowserAudioCacheMaintenance().catch(() => {});
  switch (message?.type) {
    case MESSAGE.GET_STATUS:
      return getStatus(message.tabId);
    case MESSAGE.GET_CANDIDATES:
      await refreshTabInfo(message.tabId);
      return { candidates: getDisplayCandidates(message.tabId) };
    case MESSAGE.ACTIVATE_PAGE:
      await activatePage(message.tabId);
      return {};
    case MESSAGE.START_PRELOAD_AUTO:
      return startBestPreload(message.tabId, message.candidate);
    case MESSAGE.RETRY_PRELOAD:
      return retryPreload(message.tabId);
    case MESSAGE.RETRY_PRELOAD_CHUNKS:
      return retryPreload(message.tabId, message.chunkIndexes || []);
    case MESSAGE.RERUN_ASR_PRELOAD:
      return rerunAsrPreload(message.tabId, message.chunkIndexes || [], {
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage
      });
    case MESSAGE.RETRANSLATE_PRELOAD:
      return retranslatePreload(message.tabId, message.chunkIndexes || [], { targetLanguage: message.targetLanguage });
    case MESSAGE.RETRANSLATE_TRANSCRIPT:
      return retranslateCachedTranscript(message.tabId, message.transcript, message.metadata || {}, { targetLanguage: message.targetLanguage });
    case MESSAGE.CANCEL_PRELOAD:
      return cancelPreload(message.tabId, message.jobId);
    case MESSAGE.CLEAR_PRELOAD_AUDIO_CACHE:
      return clearPreloadAudioCache(message.tabId, message.jobId);
    case MESSAGE.CHECK_PRELOAD_JOB:
      return checkPreloadJob(message.jobId, message.tabId);
    case MESSAGE.GET_PRELOAD_VTT:
      return getPreloadVtt(message.jobId);
    case MESSAGE.GET_PRELOAD_TRANSCRIPT:
      return getPreloadTranscript(message.jobId);
    case MESSAGE.GET_PRELOAD_DIAGNOSTICS:
      return getPreloadDiagnostics(message.jobId);
    case MESSAGE.GET_VIDEO_STATE:
      return getVideoState(message.tabId);
    case MESSAGE.ATTACH_VTT_TEXT:
      return attachVttText(message.tabId, message.vtt);
    case MESSAGE.DETACH_PRELOAD_VTT:
      await detachPreloadVtt(message.tabId);
      return {};
    case MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE:
      return clearPreloadSubtitleState(message.tabId, message.jobId);
    case MESSAGE.SEEK_MEDIA:
      return seekMedia(message.tabId, message.time);
    case MESSAGE.PAGE_MEDIA_FOUND:
      addPageMediaCandidate(sender.tab?.id, message.media, sender.frameId);
      return {};
    case MESSAGE.PAGE_CONTEXT_FOUND:
      updateTabContext(sender.tab?.id, message.context, sender.frameId);
      return {};
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_PROGRESS:
      return applyOffscreenWebFfmpegProgress(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_CHUNK_READY:
      return applyOffscreenWebFfmpegChunkReady(message);
    case MESSAGE.UPDATE_MEDIA_HEADER_RULE_DOMAINS:
      return updateMediaRequestHeaderRuleDomains(message.jobId, message.urls || []);
    default:
      return {};
  }
}

async function getStatus(tabId) {
  await refreshTabInfo(tabId);
  const state = getState(tabId);
  const webFfmpeg = await getWebFfmpegConfig();
  const currentPageUrl = state.page?.url || state.context?.href || "";
  let preloadJob = refreshBrowserPreloadJobForStatus(state.preloadJob);
  if (preloadJob && !browserPreloadJobMatchesPageUrl(preloadJob, currentPageUrl)) {
    state.preload = "idle";
    state.preloadJob = null;
    state.attachedVttSignature = "";
    preloadJob = null;
  }
  if (!preloadJob) {
    const matchingRecord = findBrowserPreloadRecordForTabPage(tabId, currentPageUrl);
    if (matchingRecord) {
      preloadJob = matchingRecord.job;
      state.preload = matchingRecord.job.status || "running";
      state.preloadJob = matchingRecord.job;
    }
  }
  return {
    webFfmpeg,
    preload: state.preload || "idle",
    preloadJob: withSubtitleSuppression(preloadJob, tabId),
    error: state.error || "",
    page: state.page,
    context: state.context,
    candidates: getDisplayCandidates(tabId)
  };
}

function refreshBrowserPreloadJobForStatus(job) {
  if (!job?.id || !browserPreloadJobs.has(job.id)) {
    return job || null;
  }
  const record = browserPreloadJobs.get(job.id);
  if (!record || record.cancelled) {
    return job;
  }
  if (!["completed", "failed", "cancelled"].includes(record.job.status)) {
    publishBrowserPreloadJob(record);
  }
  return record.job;
}

async function activatePage(tabId) {
  if (!tabId) {
    throw new Error("没有可用的当前标签页。");
  }
  await injectPageScript(tabId, ["src/content/subtitle-overlay.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/media-bridge.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/page-sniffer.js"], { allFrames: true, world: "MAIN" });
  await refreshTabInfo(tabId);
}

async function injectPageScript(tabId, files, options = {}) {
  const injection = {
    target: { tabId, allFrames: Boolean(options.allFrames) },
    files,
    injectImmediately: true
  };
  if (options.world) {
    injection.world = options.world;
  }
  try {
    await chrome.scripting.executeScript(injection);
  } catch (error) {
    if (!options.allFrames) {
      throw error;
    }
    const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
    let injected = false;
    for (const frame of frames) {
      if (!/^https?:/i.test(frame.url || "")) {
        continue;
      }
      try {
        await chrome.scripting.executeScript({
          ...injection,
          target: { tabId, frameIds: [frame.frameId] }
        });
        injected = true;
      } catch {
        // Some cross-origin or special frames reject dynamic injection. Keep injecting reachable frames.
      }
    }
    if (injected) {
      return;
    }
    await chrome.scripting.executeScript({
      ...injection,
      target: { tabId, allFrames: false }
    });
  }
}

function canUseWebFfmpegExtraction(candidate) {
  if (!candidate?.url || isIgnoredMediaUrl(candidate.url)) {
    return false;
  }
  const ext = String(candidate.ext || classifyUrl(candidate.url)?.ext || "").toLowerCase();
  if (candidate.kind === "dash" || ext === "mpd") {
    return true;
  }
  if (candidate.kind === "hls" || ext === "m3u8") {
    return true;
  }
  if (MANIFEST_EXTENSIONS.has(ext)) {
    return false;
  }
  const contentType = String(candidate.contentType || candidate.mime || "").toLowerCase();
  return (
    candidate.role === "audio" ||
    candidate.role === "video" ||
    candidate.kind === "audio" ||
    candidate.kind === "video" ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    AUDIO_EXTENSIONS.has(ext) ||
    ["mp4", "webm", "m4v", "mov", "m4s", "ts"].includes(ext)
  );
}

async function startPreload(tabId, candidate) {
  if (!candidate?.url) {
    throw new Error("请先选择一个媒体源。");
  }
  const state = getState(tabId);
  const preloadCandidate = resolvePreloadCandidateForStart(state, candidate);
  if (isIgnoredMediaUrl(preloadCandidate.url)) {
    throw new Error("这个候选是播放器占位媒体，不是真实视频源。请刷新候选列表后选择真实媒体。");
  }
  const now = Date.now();
  if (Number(state.preloadStartLockUntil || 0) > now) {
    return {
      preload: state.preload || "submitting",
      job: state.preloadJob || null,
      duplicated: true,
      message: "正在提交任务，已忽略重复点击。"
    };
  }
  state.preloadStartLockUntil = now + 2500;
  clearPreloadSubtitleSuppression(tabId);
  state.manualVttSignature = "";
  await detachPreloadVtt(tabId);
  await refreshTabInfo(tabId);
  const modelConfig = await getModelConfig();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const pageUrl = preloadCandidate.pageUrl || state.page?.url || tab?.url || preloadCandidate.initiator || state.context?.href || "";
  const metadata = buildPreloadMetadata(preloadCandidate, state, pageUrl);
  const payload = await startBrowserPreload(tabId, {
    ...preloadCandidate,
    pageUrl,
    chunkSeconds: modelConfig.chunkSeconds
  }, metadata, modelConfig);
  setTabStatus(tabId, {
    preload: payload.status || "queued",
    preloadJob: payload.job || null,
    error: "",
    attachedVttSignature: ""
  });
  setTabStatus(tabId, { lastPreloadCandidate: preloadCandidate });
  return { preload: payload.status || "queued", job: payload.job, result: payload.result };
}

async function startBestPreload(tabId, selectedCandidate = null) {
  await refreshTabInfo(tabId);
  const candidate = selectedCandidate?.url ? selectedCandidate : getDisplayCandidates(tabId)[0];
  if (!candidate) {
    throw new Error("还没有发现可抽取的媒体源。请先播放或刷新页面后重试。");
  }
  return startPreload(tabId, candidate);
}

async function startBrowserPreload(tabId, candidate, metadata, modelConfig) {
  const extractionCandidate = resolveAudioSourceExecutionCandidate(candidate);
  if (!canUseWebFfmpegExtraction(extractionCandidate)) {
    throw new Error("当前媒体源暂不支持浏览器内预加载。请选择 HLS、DASH 或直连音视频源。");
  }
  const executionMetadata = buildExecutionMetadata(metadata, candidate, extractionCandidate);
  validateBrowserPreloadModelConfig(modelConfig);
  const usesFunAsr = isDashScopeFunAsrConfig(modelConfig.asr);
  const browserAsrChunkSeconds = usesFunAsr
    ? dashScopeFunAsrChunkSeconds(executionMetadata)
    : await browserAsrEffectiveUploadChunkSeconds(modelConfig);
  const jobId = `browser-${Date.now()}`;
  const job = {
    id: jobId,
    pipeline: usesFunAsr ? "funasr" : "browser",
    status: "running",
    stage: "extracting",
    source: extractionCandidate.url,
    sourceUrl: extractionCandidate.url,
    originalSourceUrl: candidate.url || "",
    metadata: executionMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    extract: {
      status: "running",
      progress: 0,
      chunkCount: 0,
      availableSeconds: 0,
      duration: executionMetadata.duration || null,
      chunkSeconds: modelConfig.chunkSeconds,
      asrChunkSeconds: browserAsrChunkSeconds,
      bitrate: "64k",
      elapsedSeconds: 0
    },
    translation: {
      status: "queued",
      chunkCount: 0,
      chunksTotal: 0,
      chunksDone: 0,
      chunksFailed: 0,
      chunksAsr: 0,
      chunksTranslating: 0,
      chunkStatuses: [],
      segmentCount: 0,
      sourceSegments: 0,
      translatedSegments: 0,
      asrWorkers: usesFunAsr ? 1 : modelConfig.asrWorkers,
      translationWorkers: modelConfig.workers,
      workers: modelConfig.workers
    }
  };
  const record = {
    tabId,
    candidate: extractionCandidate,
    selectedCandidate: candidate,
    metadata: executionMetadata,
    modelConfig,
    job,
    startedAt: Date.now(),
    cancelled: false,
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    browserAsrChunkSeconds: browserAsrChunkSeconds,
    pipeline: usesFunAsr ? "funasr" : "browser"
  };
  browserPreloadJobs.set(jobId, record);
  publishBrowserPreloadJob(record);
  runBrowserPreloadJob(jobId).catch(error => {
    const latest = browserPreloadJobs.get(jobId);
    if (!latest || latest.cancelled) {
      return;
    }
    latest.job.status = "failed";
    latest.job.stage = "failed";
    latest.job.error = error.message || String(error);
    latest.job.extract.elapsedSeconds = elapsedSeconds(latest.startedAt);
    publishBrowserPreloadJob(latest);
  });
  return { status: "running", job };
}

function resolveAudioSourceExecutionCandidate(candidate = {}) {
  const plan = candidate.sourcePlan || {};
  const input = plan.ffmpegInput || {};
  const url = String(input.url || plan.primaryUrl || "");
  const inputType = String(input.type || "");
  if (plan && plan.executable === false) {
    throw new Error(sourcePlanUnsupportedMessage(plan));
  }
  if (sourcePlanHasBlockingWarning(plan)) {
    throw new Error(sourcePlanUnsupportedMessage(plan));
  }
  if (inputType === "mse-fragments") {
    if (!candidate.sourcePlanTrusted) {
      throw new Error("媒体源执行计划已过期或未通过后台校验。请刷新媒体源后重试。");
    }
    const mseFragments = normalizeMseFfmpegFragments(input.fragments);
    if (!mseFragments.some(fragment => fragment.segmentType === "init") ||
        !mseFragments.some(fragment => fragment.segmentType !== "init")) {
      throw new Error("MSE/fMP4 媒体源缺少可执行的初始化片段或媒体片段。请刷新媒体源后重试。");
    }
    const canReuseHeaders = canReuseCapturedHeaders(candidate.url, url) &&
      mseFragments.every(fragment => canReuseCapturedHeaders(candidate.url, fragment.url));
    return {
      ...candidate,
      url,
      sourceUrl: url,
      originalSourceUrl: candidate.url || "",
      kind: "mse-fragments",
      ext: "m4s",
      role: plan.primaryRole || "audio",
      contentType: "video/iso.segment",
      requestHeaders: canReuseHeaders ? candidate.requestHeaders : null,
      sourcePlanUsed: true,
      mseFragments,
      normalizeStrategy: normalizeExecutionStrategy(plan, inputType)
    };
  }
  if (inputType === "dash") {
    if (!candidate.sourcePlanTrusted) {
      throw new Error("媒体源执行计划已过期或未通过后台校验。请刷新媒体源后重试。");
    }
    const dashFragments = normalizeMseFfmpegFragments(input.fragments);
    const canReuseHeaders = canReuseCapturedHeaders(candidate.url, url) &&
      dashFragments.every(fragment => canReuseCapturedHeaders(candidate.url, fragment.url));
    return {
      ...candidate,
      url: url || candidate.url || "",
      sourceUrl: url || candidate.url || "",
      originalSourceUrl: candidate.url || "",
      kind: "dash",
      ext: "mpd",
      role: plan.primaryRole || "audio",
      contentType: "application/dash+xml",
      requestHeaders: canReuseHeaders ? candidate.requestHeaders : null,
      sourcePlanUsed: true,
      dashFragments,
      normalizeStrategy: normalizeExecutionStrategy(plan, inputType)
    };
  }
  if (!url || url === candidate.url) {
    return candidate;
  }
  if (!candidate.sourcePlanTrusted) {
    throw new Error("媒体源执行计划已过期或未通过后台校验。请刷新媒体源后重试。");
  }
  if (!["hls", "direct"].includes(inputType)) {
    throw new Error("当前媒体源计划暂不支持浏览器内预加载执行。请选择 HLS 或直连音频源。");
  }
  const classified = classifyUrl(url) || {};
  const canReuseHeaders = canReuseCapturedHeaders(candidate.url, url);
  const hlsAudioCandidateUrls = normalizeHttpUrlList(input.audioCandidateUrls);
  const executionFilename = filenameFromUrl(url);
  const ext = classified.ext || executionFilename.split(".").pop() || candidate.ext || "";
  return {
    ...candidate,
    url,
    sourceUrl: url,
    originalSourceUrl: candidate.url || "",
    filename: executionFilename,
    fileName: executionFilename,
    kind: inputType === "hls" ? "hls" : (plan.primaryRole === "audio" ? "audio" : (classified.kind || candidate.kind || "")),
    ext,
    role: plan.primaryRole || candidate.role || "",
    contentType: executionCandidateContentType({ inputType, plan, classified, candidate, ext }),
    requestHeaders: canReuseHeaders ? candidate.requestHeaders : null,
    sourcePlanUsed: true,
    hlsAudioCandidateUrls,
    normalizeStrategy: normalizeExecutionStrategy(plan, inputType)
  };
}

function executionCandidateContentType({ inputType, plan = {}, classified = {}, candidate = {}, ext = "" } = {}) {
  if (inputType === "hls") {
    return "application/vnd.apple.mpegurl";
  }
  const normalizedExt = String(ext || "").toLowerCase();
  if (inputType === "direct" && (plan.primaryRole === "audio" || classified.kind === "audio")) {
    return audioContentTypeFromExtension(ext) || (String(candidate.contentType || "").startsWith("audio/") ? candidate.contentType : "audio/mp4");
  }
  if (inputType === "direct") {
    if (["mp4", "m4v", "mov"].includes(normalizedExt)) {
      return "video/mp4";
    }
    if (normalizedExt === "webm") {
      return "video/webm";
    }
    if (normalizedExt === "mkv") {
      return "video/x-matroska";
    }
    if (String(candidate.contentType || "").startsWith("video/")) {
      return candidate.contentType;
    }
  }
  return candidate.contentType || "";
}

function audioContentTypeFromExtension(ext = "") {
  const normalized = String(ext || "").toLowerCase();
  if (normalized === "mp3") {
    return "audio/mpeg";
  }
  if (normalized === "wav") {
    return "audio/wav";
  }
  if (normalized === "aac") {
    return "audio/aac";
  }
  if (["m4a", "mp4", "m4s"].includes(normalized)) {
    return "audio/mp4";
  }
  if (["oga", "ogg", "opus"].includes(normalized)) {
    return "audio/ogg";
  }
  if (normalized === "weba") {
    return "audio/webm";
  }
  if (normalized === "flac") {
    return "audio/flac";
  }
  return "";
}

function normalizeHttpUrlList(values = []) {
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const url = String(value || "");
    if (/^https?:\/\//i.test(url) && !output.includes(url)) {
      output.push(url);
    }
  }
  return output;
}

function normalizeExecutionStrategy(plan = {}, inputType = "") {
  if (plan.normalizeStrategy?.type) {
    return plan.normalizeStrategy;
  }
  if (inputType === "mse-fragments") {
    return {
      type: "fmp4-fragments",
      action: "assemble-fragments-extract-audio",
      inputType,
      requiresAssembly: true,
      output: normalizedMp3Output()
    };
  }
  if (inputType === "hls") {
    return {
      type: "hls-playlist",
      action: "parse-playlist-extract-audio",
      inputType,
      requiresAssembly: true,
      output: normalizedMp3Output()
    };
  }
  if (inputType === "dash") {
    return {
      type: "dash-manifest",
      action: "parse-manifest-extract-audio",
      inputType,
      requiresAssembly: true,
      output: normalizedMp3Output()
    };
  }
  return {
    type: plan.kind === "muxed-media" ? "muxed-media-file" : "direct-audio-file",
    action: plan.kind === "muxed-media" ? "extract-audio-track" : "transcode-or-remux-audio",
    inputType: inputType || "direct",
    requiresAssembly: false,
    output: normalizedMp3Output()
  };
}

function normalizedMp3Output() {
  return {
    codec: "mp3",
    container: "mp3",
    sampleRate: 16000,
    channels: 1,
    bitrate: 64000
  };
}

function normalizeMseFfmpegFragments(fragments) {
  return (Array.isArray(fragments) ? fragments : [])
    .map(fragment => ({
      url: String(fragment?.url || ""),
      name: String(fragment?.name || fragment?.filename || ""),
      segmentType: String(fragment?.segmentType || "").toLowerCase() === "init" ? "init" : "media",
      role: String(fragment?.role || ""),
      duration: pickFinite(fragment?.duration, 0),
      start: pickFinite(fragment?.start, 0),
      end: pickFinite(fragment?.end, 0),
      byteRange: normalizeFragmentByteRange(fragment?.byteRange)
    }))
    .filter(fragment => /^https?:\/\//i.test(fragment.url));
}

function normalizeFragmentByteRange(byteRange) {
  if (!byteRange || typeof byteRange !== "object") {
    return null;
  }
  const offset = Number(byteRange.offset);
  const length = Number(byteRange.length);
  if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length <= 0) {
    return null;
  }
  return {
    offset: Math.floor(offset),
    length: Math.floor(length)
  };
}

function buildExecutionMetadata(metadata = {}, selectedCandidate = {}, extractionCandidate = {}) {
  const executionSourceUrl = extractionCandidate.url || metadata.sourceUrl || selectedCandidate.url || "";
  const originalSourceUrl = selectedCandidate.url || metadata.sourceUrl || "";
  return {
    ...metadata,
    title: metadata.title || "",
    pageUrl: metadata.pageUrl || "",
    sourceUrl: executionSourceUrl,
    executionSourceUrl,
    originalSourceUrl,
    duration: metadata.duration || null
  };
}

function canReuseCapturedHeaders(fromUrl, toUrl) {
  if (!fromUrl || !toUrl || fromUrl === toUrl) {
    return true;
  }
  try {
    return new URL(fromUrl).origin === new URL(toUrl).origin;
  } catch {
    return false;
  }
}

function sourcePlanHasBlockingWarning(plan = {}) {
  return (Array.isArray(plan.warnings) ? plan.warnings : []).some(warning =>
    ["requires-signature-deciphering"].includes(String(warning?.code || ""))
  );
}

function sourcePlanUnsupportedMessage(plan = {}) {
  const warning = (Array.isArray(plan.warnings) ? plan.warnings : [])
    .find(item => item?.message);
  if (warning?.code === "requires-signature-deciphering") {
    return "当前媒体源需要播放器签名解密，浏览器内预加载暂不支持。";
  }
  if (warning?.message) {
    return warning.message;
  }
  if (plan.executable === false) {
    return "当前媒体源已识别，但还不能在浏览器内直接执行抽取。";
  }
  return "当前媒体源暂不支持浏览器内预加载执行。";
}

function validateBrowserPreloadModelConfig(modelConfig) {
  const asr = modelConfig.asr || {};
  const provider = normalizeProviderType(asr.providerType);
  const needsModel = provider !== "xai";
  if (!asr.baseUrl || !asr.apiKey || (needsModel && !asr.model)) {
    throw new Error(needsModel
      ? "浏览器内预加载需要完整的在线 ASR 配置：接口地址、模型名称和 API 密钥。"
      : "浏览器内预加载需要完整的 xAI ASR 配置：接口地址和 API 密钥。");
  }
}

async function runBrowserPreloadJob(jobId) {
  const record = browserPreloadJobs.get(jobId);
  if (!record) {
    return;
  }
  if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
    return runBrowserFunAsrPreloadJob(jobId);
  }
  startBrowserChunkPipeline(record);
  let audio = {};
  let extractionError = null;
  try {
    audio = await extractCandidateAudioInBrowser(record);
    if (isBrowserJobCancelled(record)) {
      return;
    }
    if (record.browserStreamingInternalChunks) {
      flushBrowserInternalAudioChunks(record, true);
    } else {
      const chunks = normalizeBrowserAudioChunks(
        audio,
        Number(audio.asrChunkSeconds || audio.chunkSeconds || record.browserAsrChunkSeconds) || browserAsrUploadChunkSeconds(record.modelConfig),
        record.metadata?.duration
      );
      for (const chunk of chunks) {
        enqueueBrowserLogicalAudioChunk(record, chunk);
      }
    }
    const hasAudioChunks = Boolean((record.audioChunks || []).length);
    if (
      !hasAudioChunks
      && !browserPreloadRecordHasOnlyKnownNonspeechAudio(record)
      && !browserAudioResultHasOnlyKnownNonspeech(audio)
    ) {
      throw createNoBrowserAudioChunksError(audio);
    }
    record.job.extract = {
      ...record.job.extract,
      status: "completed",
      progress: 100,
      phase: "completed",
      message: "",
      chunkCount: record.audioChunks.length,
      availableSeconds: Math.round(Number(audio.duration || 0) || record.audioChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0)),
      elapsedSeconds: elapsedSeconds(record.startedAt)
    };
    record.job.translation = {
      ...record.job.translation,
      status: hasAudioChunks ? (record.job.translation?.status || "running") : "completed",
      chunksTotal: hasAudioChunks
        ? Math.max(Number(record.job.translation?.chunksTotal || 0) || 0, record.browserTranslationGroups?.size || 0)
        : 0,
      chunkStatuses: record.job.translation?.chunkStatuses || []
    };
    record.job.stage = hasAudioChunks ? "asr" : "completed";
    publishBrowserPreloadJob(record);
  } catch (error) {
    extractionError = error;
  } finally {
    closeBrowserAsrQueue(record);
  }

  await waitBrowserChunkPipeline(record).catch(error => {
    extractionError = extractionError || error;
  });
  if (extractionError) {
    throw extractionError;
  }
  if (isBrowserJobCancelled(record)) {
    return;
  }
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  await attachBrowserJobVttIfReady(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
}

async function runBrowserFunAsrPreloadJob(jobId) {
  const record = browserPreloadJobs.get(jobId);
  if (!record) {
    return;
  }
  startBrowserFunAsrChunkPipeline(record);
  let audio = {};
  let extractionError = null;
  try {
    audio = await extractCandidateAudioInBrowser(record);
    if (isBrowserJobCancelled(record)) {
      return;
    }
    const chunks = normalizeBrowserAudioChunks(
      audio,
      Number(audio.asrChunkSeconds || audio.chunkSeconds || record.browserAsrChunkSeconds) || dashScopeFunAsrChunkSeconds(record.metadata),
      record.metadata?.duration
    );
    for (const chunk of chunks) {
      appendBrowserFunAsrAudioChunk(record, chunk);
    }
    record.audioChunks = uniqueBrowserAudioChunks(record.audioChunks);
    if (!record.audioChunks.length) {
      throw createNoBrowserAudioChunksError(audio);
    }
    const chunksTotal = browserFunAsrExpectedChunkCount(record);
    record.job.extract = {
      ...record.job.extract,
      status: "completed",
      progress: 100,
      phase: "completed",
      message: "",
      chunkCount: record.audioChunks.length,
      availableSeconds: Math.round(Number(audio.duration || 0) || record.audioChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0)),
      duration: pickFinite(audio.duration, record.job.extract.duration, record.metadata?.duration),
      elapsedSeconds: elapsedSeconds(record.startedAt)
    };
    record.job.stage = browserFunAsrHasOpenWork(record) ? "asr" : "completed";
    record.job.translation = {
      ...record.job.translation,
      status: "running",
      chunkCount: chunksTotal,
      chunksTotal,
      asrWorkers: 1,
      translationWorkers: record.modelConfig.workers,
      workers: record.modelConfig.workers,
      chunkStatuses: record.job.translation.chunkStatuses || []
    };
    publishBrowserPreloadJob(record);
  } catch (error) {
    extractionError = error;
  } finally {
    closeBrowserFunAsrQueue(record);
  }
  await waitBrowserFunAsrChunkPipeline(record).catch(error => {
    extractionError = extractionError || error;
  });
  if (extractionError) {
    throw extractionError;
  }
  if (isBrowserJobCancelled(record)) {
    return;
  }
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  await attachBrowserJobVttIfReady(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
}

function uniqueBrowserAudioChunks(chunks = []) {
  const seen = new Set();
  return (Array.isArray(chunks) ? chunks : [])
    .filter(chunk => isUsableBrowserAudioFile(chunk?.file))
    .map((chunk, index) => ({
      ...chunk,
      index: Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : index
    }))
    .filter(chunk => {
      if (seen.has(chunk.index)) {
        return false;
      }
      seen.add(chunk.index);
      return true;
    })
    .sort((left, right) => left.index - right.index || left.start - right.start);
}

function browserFunAsrConcurrency(record) {
  return Math.max(1, Math.min(2, browserFunAsrExpectedChunkCount(record)));
}

function browserFunAsrExpectedChunkCount(record) {
  const seconds = pickFinite(
    record?.job?.extract?.duration,
    record?.metadata?.duration,
    record?.candidate?.duration,
    0
  );
  const chunkSeconds = Math.max(10, Math.floor(Number(
    record?.job?.extract?.asrChunkSeconds
    || record?.browserAsrChunkSeconds
    || dashScopeFunAsrChunkSeconds(record?.metadata)
  ) || dashScopeFunAsrChunkSeconds(record?.metadata)));
  const knownChunks = Array.isArray(record?.audioChunks) ? record.audioChunks.length : 0;
  const extractionCompleted = record?.job?.extract?.status === "completed" ||
    Number(record?.job?.extract?.progress || 0) >= 100;
  if (extractionCompleted && knownChunks > 0) {
    return knownChunks;
  }
  if (seconds > 0 && chunkSeconds > 0) {
    return Math.max(knownChunks, Math.ceil(seconds / chunkSeconds));
  }
  return Math.max(knownChunks, 1);
}

function browserFunAsrShouldLabelSpeakers(record) {
  return dashScopeFunAsrShouldDiarize({
    chunksTotal: browserFunAsrExpectedChunkCount(record),
    duration: pickFinite(record?.job?.extract?.duration, record?.metadata?.duration)
  });
}

function browserFunAsrHasOpenWork(record) {
  const statuses = record?.job?.translation?.chunkStatuses || [];
  const chunksTotal = browserFunAsrExpectedChunkCount(record);
  return statuses.filter(Boolean).length < chunksTotal
    || statuses.some(status => !["completed", "failed"].includes(String(status?.stage || "")));
}

async function processBrowserFunAsrChunk(record, chunk, options = {}) {
  if (isBrowserJobCancelled(record)) {
    return;
  }
  const index = Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : 0;
  const chunksTotal = browserFunAsrExpectedChunkCount(record);
  const labelSpeakers = typeof options.labelSpeakers === "boolean"
    ? options.labelSpeakers
    : browserFunAsrShouldLabelSpeakers(record);
  const current = record.job.translation.chunkStatuses[index] || createChunkStatus(index, "queued");
  const attempt = Math.max(1, Number(current.attempts || 0) + 1);
  updateChunkStatus(record, index, {
    stage: "asr",
    status: "识别",
    attempts: attempt,
    error: "",
    message: `Fun-ASR 长文件识别 ${index + 1}/${chunksTotal}`
  });
  try {
    const fileBuffer = await getBrowserAudioChunkBuffer(chunk.file);
    const payload = await transcribeDashScopeFunAsrFile(
      {
        name: chunk.file?.name || `funasr-${index + 1}.mp3`,
        mime: chunk.file?.mime || "audio/mpeg",
        buffer: fileBuffer
      },
      record.modelConfig.asr,
      {
        chunksTotal,
        duration: pickFinite(record.job.extract.duration, record.metadata?.duration),
        labelSpeakers,
        onProgress(progress) {
          updateChunkStatus(record, index, {
            stage: "asr",
            status: "识别",
            attempts: attempt,
            message: `Fun-ASR ${progress.status || "处理中"} · ${index + 1}/${chunksTotal}`
          });
        }
      }
    );
    const sourceSegments = normalizeBrowserSourceSegmentsForTranslation(
      normalizeDashScopeFunAsrResult(payload, chunk, {
        labelSpeakers,
        chunkLabelIndex: index
      }),
      index
    );
    record.sourceSegmentsByChunk.set(index, sourceSegments);
    if (!sourceSegments.length) {
      record.translatedSegmentsByChunk.set(index, []);
      updateChunkStatus(record, index, {
        stage: "completed",
        status: "完成",
        attempts: attempt,
        sourceCount: 0,
        translatedCount: 0,
        message: "Fun-ASR 未返回可显示语音"
      });
      publishBrowserSubtitle(record);
      return;
    }
    updateChunkStatus(record, index, {
      stage: "asr_done",
      status: "待翻译",
      attempts: attempt,
      sourceCount: sourceSegments.length,
      error: "",
      message: `Fun-ASR 原文 ${sourceSegments.length}`
    });
    await processBrowserTranslationChunk(record, {
      index,
      start: chunk.start,
      end: chunk.end,
      duration: chunk.duration
    }, sourceSegments);
  } catch (error) {
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      attempts: attempt,
      sourceCount: 0,
      translatedCount: 0,
      error: `Fun-ASR 识别失败：${error.message || String(error)}`
    });
    publishBrowserSubtitle(record);
  }
}

async function extractCandidateAudioInBrowser(record) {
  await ensureOffscreenDocument();
  const webFfmpeg = await getWebFfmpegConfig();
  const candidate = record.candidate;
  const pageUrl = candidate.pageUrl || record.metadata?.pageUrl || record.metadata?.url || candidate.initiator || "";
  const headerRuleUrls = [
    candidate.url,
    candidate.originalSourceUrl,
    ...(candidate.hlsAudioCandidateUrls || []),
    ...(candidate.dashFragments || []).map(fragment => fragment.url)
  ];
  const response = await withMediaRequestHeaderRules(headerRuleUrls, pageUrl, async () => chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO,
    tabId: record.tabId,
    webFfmpegUrl: webFfmpeg.url,
    sourceUrl: candidate.url,
    originalSourceUrl: candidate.originalSourceUrl || record.selectedCandidate?.url || "",
    localMediaFileKey: candidate.localMediaFileKey || record.selectedCandidate?.localMediaFileKey || "",
    localMediaFileName: candidate.localMediaFileName || record.selectedCandidate?.localMediaFileName || "",
    localMediaFileSize: candidate.localMediaFileSize || record.selectedCandidate?.localMediaFileSize || 0,
    localMediaFileLastModified: candidate.localMediaFileLastModified || record.selectedCandidate?.localMediaFileLastModified || 0,
    hlsAudioCandidateUrls: candidate.hlsAudioCandidateUrls || [],
    kind: candidate.kind || "",
    ext: candidate.ext || "",
    requestHeaders: candidate.requestHeaders || null,
    fileName: candidate.fileName || candidate.filename || filenameFromUrl(candidate.url),
    mime: candidate.contentType || candidate.mime || "",
    pageUrl,
    initiator: candidate.initiator || "",
    duration: pickFinite(candidate.duration, record.metadata?.duration),
    mseFragments: candidate.mseFragments || candidate.sourcePlan?.ffmpegInput?.fragments || [],
    dashFragments: candidate.dashFragments || [],
    chunkSeconds: record.modelConfig.chunkSeconds,
    extractChunkSeconds: record.modelConfig.chunkSeconds,
    asrChunkSeconds: offscreenAsrChunkSecondsForCandidate(record, candidate),
    asrMode: (record.pipeline === "funasr" || record.job?.pipeline === "funasr") ? "long-file" : "",
    webFfmpegPerformance: record.modelConfig.webFfmpegPerformance || DEFAULT_MODEL_SETTINGS.webFfmpegPerformance,
    cacheNamespace: record.job.id,
    jobId: record.job.id
  }), record.job.id);
  if (!response?.ok) {
    throw new Error(response?.error || "Web FFmpeg 音频提取失败。");
  }
  return response.result || {};
}

function offscreenAsrChunkSecondsForCandidate(record = {}) {
  const configured = record.browserAsrChunkSeconds || record.modelConfig?.asrUploadChunkSeconds || record.modelConfig?.chunkSeconds;
  if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
    return Math.max(10, Math.floor(Number(configured || 0) || dashScopeFunAsrChunkSeconds(record.metadata)));
  }
  return normalizeBrowserAsrUploadChunkSeconds(configured);
}

function applyOffscreenWebFfmpegProgress(message) {
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!record || record.cancelled) {
    return {};
  }
  applyBrowserExtractionProgress(record, message.progress || {});
  return {};
}

function applyOffscreenWebFfmpegChunkReady(message) {
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!record || record.cancelled) {
    return {};
  }
  if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
    const emitted = appendBrowserFunAsrAudioChunk(record, message.chunk || {});
    if (message.duration) {
      record.job.extract.duration = pickFinite(message.duration, record.job.extract.duration);
    }
    if (message.internalChunksDone || message.internalChunksTotal) {
      record.job.extract.internalChunksDone = pickNonNegativeInteger(message.internalChunksDone, record.job.extract.internalChunksDone);
      record.job.extract.internalChunksTotal = pickNonNegativeInteger(message.internalChunksTotal, record.job.extract.internalChunksTotal);
    }
    publishBrowserPreloadJob(record);
    return { chunks: emitted.length };
  }
  const emitted = appendBrowserInternalAudioChunk(record, message.chunk || {});
  if (message.duration) {
    record.job.extract.duration = pickFinite(message.duration, record.job.extract.duration);
  }
  if (message.internalChunksDone || message.internalChunksTotal) {
    record.job.extract.internalChunksDone = pickNonNegativeInteger(message.internalChunksDone, record.job.extract.internalChunksDone);
    record.job.extract.internalChunksTotal = pickNonNegativeInteger(message.internalChunksTotal, record.job.extract.internalChunksTotal);
  }
  publishBrowserPreloadJob(record);
  return { chunks: emitted.length };
}

function findBrowserPreloadRecord(jobId, tabId) {
  if (jobId && browserPreloadJobs.has(jobId)) {
    return browserPreloadJobs.get(jobId);
  }
  for (const record of browserPreloadJobs.values()) {
    if (record.tabId === tabId && !["completed", "failed", "cancelled"].includes(record.job.status)) {
      return record;
    }
  }
  return null;
}

function applyBrowserExtractionProgress(record, progress = {}) {
  if (!record?.job?.extract) {
    return null;
  }
  const current = record.job.extract || {};
  const currentProgress = Number(current.progress || 0) || 0;
  const nextProgress = clampProgressPercent(progress.percent);
  const readySeconds = Math.max(
    Number(current.readySeconds || 0) || 0,
    Number(progress.readySeconds || 0) || 0
  );
  record.job.extract = {
    ...current,
    status: "running",
    progress: Math.max(currentProgress, nextProgress),
    phase: progress.phase || current.phase || "",
    message: progress.message || current.message || "",
    readySeconds,
    internalChunksDone: pickNonNegativeInteger(progress.internalChunksDone, current.internalChunksDone),
    internalChunksTotal: pickNonNegativeInteger(progress.internalChunksTotal, current.internalChunksTotal),
    downloadedSegments: pickNonNegativeInteger(progress.downloadedSegments, current.downloadedSegments),
    totalSegments: pickNonNegativeInteger(progress.totalSegments, current.totalSegments),
    elapsedSeconds: elapsedSeconds(record.startedAt),
    updatedAt: Date.now()
  };
  if (!browserJobStageIsPastExtraction(record.job.stage)) {
    record.job.stage = "extracting";
  }
  publishBrowserPreloadJob(record);
  return record.job.extract;
}

function browserJobStageIsPastExtraction(stage) {
  return [
    "asr",
    "asr_done",
    "translation",
    "retrying",
    "retry_translation",
    "completed",
    "completed_with_warnings",
    "failed",
    "cancelled"
  ].includes(String(stage || ""));
}

function appendBrowserInternalAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const normalized = normalizeBrowserInternalAudioChunk(chunk);
  if (!normalized || !isUsableBrowserAudioFile(normalized.file)) {
    return [];
  }
  if (chunk?.logical) {
    record.browserStreamingInternalChunks = true;
    return enqueueBrowserLogicalAudioChunk(record, normalized) ? [normalized] : [];
  }
  const signature = browserInternalAudioChunkSignature(normalized);
  if (record.browserInternalChunkSignatures.has(signature)) {
    return [];
  }
  record.browserInternalChunkSignatures.add(signature);
  record.browserStreamingInternalChunks = true;
  record.browserInternalAudioChunks.push(normalized);
  record.browserInternalAudioChunks.sort((a, b) => a.start - b.start || a.index - b.index);
  record.job.extract.availableSeconds = Math.max(
    Number(record.job.extract.availableSeconds || 0) || 0,
    Math.round(Number(normalized.end || 0) || 0)
  );
  return flushBrowserInternalAudioChunks(record, false);
}

function appendBrowserFunAsrAudioChunk(record, chunk) {
  ensureBrowserFunAsrPipelineState(record);
  const normalized = normalizeBrowserInternalAudioChunk(chunk);
  if (!normalized || !isUsableBrowserAudioFile(normalized.file)) {
    return [];
  }
  record.browserStreamingInternalChunks = true;
  const nextIndex = Number.isInteger(normalized.index) ? normalized.index : record.audioChunks.length;
  const item = { ...normalized, index: nextIndex };
  if (record.audioChunks.some(chunk => chunk?.index === item.index)) {
    return [];
  }
  record.audioChunks.push(item);
  record.audioChunks.sort((left, right) => left.index - right.index);
  const chunksTotal = browserFunAsrExpectedChunkCount(record);
  record.job.stage = "asr";
  record.job.translation = {
    ...record.job.translation,
    status: "running",
    chunkCount: chunksTotal,
    chunksTotal,
    asrWorkers: browserFunAsrConcurrency(record),
    translationWorkers: record.modelConfig.workers,
    workers: record.modelConfig.workers,
    chunkStatuses: record.job.translation.chunkStatuses || []
  };
  if (!record.job.translation.chunkStatuses[item.index]) {
    record.job.translation.chunkStatuses[item.index] = createChunkStatus(item.index, "queued");
  }
  record.job.extract.availableSeconds = Math.max(
    Number(record.job.extract.availableSeconds || 0) || 0,
    Math.round(Number(item.end || 0) || 0)
  );
  enqueueAsyncQueue(record.browserFunAsrQueue, item);
  return [item];
}

function flushBrowserInternalAudioChunks(record, final = false) {
  ensureBrowserChunkPipelineState(record);
  const emitted = [];
  const logicalChunkSeconds = (record.pipeline === "funasr" || record.job?.pipeline === "funasr")
    ? Math.max(10, Math.floor(Number(record.browserAsrChunkSeconds || 0) || dashScopeFunAsrChunkSeconds(record.metadata)))
    : normalizeBrowserAsrUploadChunkSeconds(record.browserAsrChunkSeconds || record.modelConfig?.asrUploadChunkSeconds);
  while (record.browserInternalChunkCursor < record.browserInternalAudioChunks.length) {
    const chunk = record.browserInternalAudioChunks[record.browserInternalChunkCursor];
    const pending = record.browserPendingLogicalChunk;
    if (browserInternalChunkIsKnownNonspeech(chunk)) {
      record.browserInternalChunkCursor += 1;
      record.browserSkippedNonspeechInternalChunks = (Number(record.browserSkippedNonspeechInternalChunks || 0) || 0) + 1;
      if (pending?.parts?.length) {
        emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
        record.browserPendingLogicalChunk = null;
      }
      continue;
    }
    if (pending?.parts?.length && browserShouldSplitLogicalChunkAtVadGap(pending.parts, chunk)) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
      record.browserPendingLogicalChunk = null;
      continue;
    }
    const pendingDuration = pending ? Math.max(0, Number(pending.end || pending.start || 0) - Number(pending.start || 0)) : 0;
    const chunkDuration = Math.max(0, Number(chunk.duration || (chunk.end - chunk.start) || 0) || 0);
    if (pending?.parts?.length && pendingDuration + chunkDuration > logicalChunkSeconds) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
      record.browserPendingLogicalChunk = null;
      continue;
    }
    record.browserInternalChunkCursor += 1;
    const current = record.browserPendingLogicalChunk || {
      start: chunk.start,
      end: chunk.start,
      parts: []
    };
    current.parts.push(chunk);
    current.end = chunk.end;
    record.browserPendingLogicalChunk = current;
    const currentDuration = Math.max(0, Number(current.end || 0) - Number(current.start || 0));
    if (currentDuration >= logicalChunkSeconds) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, current.parts));
      record.browserPendingLogicalChunk = null;
    }
  }
  if (final && record.browserPendingLogicalChunk?.parts?.length) {
    emitted.push(buildAndEnqueueBrowserLogicalChunk(record, record.browserPendingLogicalChunk.parts));
    record.browserPendingLogicalChunk = null;
  }
  return emitted.filter(Boolean);
}

function browserInternalChunkIsKnownNonspeech(chunk) {
  if (chunk?.speechIntervalsReliable === false) {
    return false;
  }
  const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals);
  return Array.isArray(speechIntervals) && speechIntervals.length === 0;
}

function browserShouldSplitLogicalChunkAtVadGap(parts, nextChunk) {
  if ((parts || []).some(part => part?.speechIntervalsReliable === false) || nextChunk?.speechIntervalsReliable === false) {
    return false;
  }
  const currentSpeech = mergeAsrSpeechIntervals((parts || []).flatMap(part => normalizeAsrSpeechIntervals(part?.speechIntervals) || []));
  const nextSpeech = normalizeAsrSpeechIntervals(nextChunk?.speechIntervals);
  if (!currentSpeech.length || !Array.isArray(nextSpeech) || !nextSpeech.length) {
    return false;
  }
  const lastCurrentSpeech = currentSpeech[currentSpeech.length - 1];
  const firstNextSpeech = nextSpeech[0];
  return firstNextSpeech.start - lastCurrentSpeech.end >= ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
}

function browserPreloadRecordHasOnlyKnownNonspeechAudio(record) {
  return Boolean(
    record?.browserStreamingInternalChunks
    && !(record.audioChunks || []).length
    && (Number(record.browserSkippedNonspeechInternalChunks || 0) || 0) > 0
  );
}

function browserAudioResultHasOnlyKnownNonspeech(audio = {}) {
  return Boolean(
    audio?.knownNonspeech
    && audio?.speechIntervalsReliable !== false
    && Array.isArray(audio?.speechIntervals)
    && audio.speechIntervals.length === 0
    && !(Array.isArray(audio?.chunks) && audio.chunks.length)
  );
}

function buildAndEnqueueBrowserLogicalChunk(record, parts) {
  const chunk = buildBrowserLogicalAudioChunk(record, parts);
  return enqueueBrowserLogicalAudioChunk(record, chunk) ? chunk : null;
}

function buildBrowserLogicalAudioChunk(record, parts) {
  const normalizedParts = (parts || []).filter(part => isUsableBrowserAudioFile(part?.file));
  const index = Number.isInteger(record.browserNextLogicalChunkIndex)
    ? record.browserNextLogicalChunkIndex
    : (record.audioChunks || []).length;
  record.browserNextLogicalChunkIndex = index + 1;
  const bytes = normalizedParts.reduce((sum, part) => sum + (Number(part.bytes || part.file?.bytes || 0) || 0), 0);
  const start = Number(normalizedParts[0]?.start || 0) || 0;
  const end = Number(normalizedParts[normalizedParts.length - 1]?.end || start) || start;
  const coreStart = browserAudioChunkCoreStart(normalizedParts[0] || { start });
  const coreEnd = browserAudioChunkCoreEnd(normalizedParts[normalizedParts.length - 1] || { end });
  const speechIntervalsReliable = normalizedParts.every(part => part.speechIntervalsReliable !== false);
  const speechIntervals = speechIntervalsReliable
    ? mergeAsrSpeechIntervals(normalizedParts.flatMap(part => normalizeAsrSpeechIntervals(part.speechIntervals) || []))
    : undefined;
  const fileParts = normalizedParts.map(part => ({
    index: part.index,
    start: part.start,
    end: part.end,
    duration: part.duration,
    coreStart: part.coreStart,
    coreEnd: part.coreEnd,
    coreDuration: part.coreDuration,
    speechIntervals: Array.isArray(part.speechIntervals) ? normalizeAsrSpeechIntervals(part.speechIntervals) || [] : undefined,
    speechIntervalsReliable: part.speechIntervalsReliable === false ? false : undefined,
    bytes: part.bytes || part.file?.bytes || 0,
    file: part.file
  }));
  const file = fileParts.length === 1
    ? fileParts[0].file
    : {
        name: `logical-${String(index + 1).padStart(3, "0")}.mp3`,
        mime: "audio/mpeg",
        bytes,
        parts: fileParts
      };
  return {
    index,
    start,
    end,
    duration: Math.max(0, end - start),
    coreStart,
    coreEnd,
    coreDuration: Math.max(0, coreEnd - coreStart),
    speechIntervals,
    speechIntervalsReliable: speechIntervalsReliable ? undefined : false,
    file,
    bytes,
    internalChunkCount: fileParts.length
  };
}

function enqueueBrowserLogicalAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  if (!chunk || !isUsableBrowserAudioFile(chunk.file)) {
    return false;
  }
  if (record.browserAsrQueue?.closed) {
    return false;
  }
  const nextIndex = Number.isInteger(chunk.index) ? chunk.index : record.audioChunks.length;
  const normalized = { ...chunk, index: nextIndex };
  if (record.audioChunks.some(item => item?.index === normalized.index)) {
    return false;
  }
  record.audioChunks.push(normalized);
  record.audioChunks.sort((a, b) => a.index - b.index);
  const group = ensureBrowserTranslationGroupForAudioChunk(record, normalized);
  record.job.stage = "asr";
  record.job.translation = {
    ...record.job.translation,
    status: "running",
    chunkCount: record.browserTranslationGroups.size,
    chunksTotal: Math.max(Number(record.job.translation.chunksTotal || 0) || 0, record.browserTranslationGroups.size),
    asrWorkers: record.modelConfig.asrWorkers,
    translationWorkers: record.modelConfig.workers,
    workers: record.modelConfig.workers,
    chunkStatuses: record.job.translation.chunkStatuses || []
  };
  if (!record.job.translation.chunkStatuses[group.index]) {
    record.job.translation.chunkStatuses[group.index] = createChunkStatus(group.index, "queued");
  }
  enqueueAsyncQueue(record.browserAsrQueue, normalized);
  publishBrowserPreloadJob(record);
  return true;
}

function ensureBrowserTranslationGroupForAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const groupIndex = browserTranslationGroupIndex(record, chunk);
  closeBrowserTranslationGroupsBefore(record, groupIndex);
  let group = record.browserTranslationGroups.get(groupIndex);
  if (!group) {
    const segmentSeconds = browserTranslationSegmentSeconds(record);
    const targetEnd = browserTranslationGroupTargetEnd(record, groupIndex);
    group = {
      index: groupIndex,
      start: groupIndex * segmentSeconds,
      end: targetEnd,
      targetEnd,
      chunks: [],
      chunkIndexes: new Set(),
      total: 0,
      completed: 0,
      failed: 0,
      empty: 0,
      sourceSegments: [],
      errors: [],
      closed: false,
      translationQueued: false
    };
    record.browserTranslationGroups.set(groupIndex, group);
  }
  if (!group.chunkIndexes.has(chunk.index)) {
    group.chunkIndexes.add(chunk.index);
    group.chunks.push(chunk);
    group.chunks.sort((left, right) => browserAudioChunkCoreStart(left) - browserAudioChunkCoreStart(right) || left.index - right.index);
    group.total += 1;
    group.start = Math.min(group.start, browserAudioChunkCoreStart(chunk));
    group.end = Math.max(group.end, browserAudioChunkCoreEnd(chunk));
    record.browserAsrChunkToTranslationGroup.set(chunk.index, groupIndex);
    closeBrowserTranslationGroupIfChunkCompletesWindow(record, group, chunk);
  }
  return group;
}

function browserTranslationGroupTargetEnd(record, groupIndex) {
  const segmentSeconds = browserTranslationSegmentSeconds(record);
  const boundaryEnd = (groupIndex + 1) * segmentSeconds;
  const duration = pickFinite(
    record?.metadata?.duration,
    record?.candidate?.duration,
    record?.job?.extract?.duration
  );
  return duration ? Math.min(boundaryEnd, duration) : boundaryEnd;
}

function closeBrowserTranslationGroupIfChunkCompletesWindow(record, group, chunk) {
  if (!group || group.closed) {
    return false;
  }
  const targetEnd = pickFinite(group.targetEnd, group.end);
  if (!targetEnd) {
    return false;
  }
  if (browserAudioChunkCoreEnd(chunk) + 0.001 < targetEnd) {
    return false;
  }
  group.closed = true;
  maybeFinalizeBrowserTranslationGroup(record, group);
  return true;
}

function browserTranslationGroupIndex(record, chunk) {
  const segmentSeconds = browserTranslationSegmentSeconds(record);
  const start = Math.max(0, browserAudioChunkCoreStart(chunk));
  return Math.max(0, Math.floor((start + 0.001) / segmentSeconds));
}

function getBrowserTranslationGroupForAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const known = record.browserAsrChunkToTranslationGroup.get(chunk.index);
  if (Number.isFinite(Number(known))) {
    return record.browserTranslationGroups.get(Number(known));
  }
  return ensureBrowserTranslationGroupForAudioChunk(record, chunk);
}

function closeBrowserTranslationGroupsBefore(record, groupIndex) {
  ensureBrowserChunkPipelineState(record);
  for (const group of record.browserTranslationGroups.values()) {
    if (group.index < groupIndex && !group.closed) {
      group.closed = true;
      maybeFinalizeBrowserTranslationGroup(record, group);
    }
  }
}

function closeAllBrowserTranslationGroups(record) {
  ensureBrowserChunkPipelineState(record);
  for (const group of record.browserTranslationGroups.values()) {
    group.closed = true;
    maybeFinalizeBrowserTranslationGroup(record, group);
  }
}

function completeBrowserAsrChunkForGroup(record, chunk, sourceSegments, error = null) {
  const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
  if (!group) {
    return;
  }
  group.completed += 1;
  if (error) {
    group.failed += 1;
    group.errors.push(error.message || String(error));
  } else if (Array.isArray(sourceSegments) && sourceSegments.length) {
    group.sourceSegments.push(...sourceSegments);
  } else {
    group.empty += 1;
  }
  updateChunkStatus(record, group.index, {
    stage: "asr",
    status: "识别",
    attempts: Math.max(1, record.job.translation.chunkStatuses[group.index]?.attempts || 1),
    sourceCount: group.sourceSegments.length,
    asrFailures: group.failed,
    asrErrors: group.errors.slice(0, 5),
    error: "",
    message: browserAsrGroupProgressMessage(group, chunk)
  });
  maybeFinalizeBrowserTranslationGroup(record, group);
}

function browserAsrChunkTimeRangeText(chunk) {
  return `${formatVttTimestamp(browserAudioChunkCoreStart(chunk))} - ${formatVttTimestamp(browserAudioChunkCoreEnd(chunk))}`;
}

function browserAsrGroupProgressMessage(group, chunk) {
  const suffix = group.failed ? ` · ${group.failed} 失败` : "";
  if (group.completed >= group.total) {
    return `识别完成${suffix}`;
  }
  return `识别到 ${formatVttTimestamp(browserAudioChunkCoreEnd(chunk))}${suffix}`;
}

function maybeFinalizeBrowserTranslationGroup(record, group) {
  if (!group || group.translationQueued || !group.closed || group.completed < group.total) {
    return false;
  }
  const sourceSegments = normalizeBrowserSourceSegmentsForTranslation(group.sourceSegments, group.index);
  record.sourceSegmentsByChunk.set(group.index, sourceSegments);
  if (group.failed && !sourceSegments.length) {
    group.translationQueued = true;
    updateChunkStatus(record, group.index, {
      stage: "failed",
      status: "失败",
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: group.failed,
      asrErrors: group.errors.slice(0, 5),
      error: group.errors[0] || "这个识别分段没有可用原文。"
    });
    publishBrowserSubtitle(record);
    return true;
  }
  if (!sourceSegments.length) {
    group.translationQueued = true;
    record.translatedSegmentsByChunk.set(group.index, []);
    updateChunkStatus(record, group.index, {
      stage: "completed",
      status: "完成",
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      message: "无语音"
    });
    publishBrowserSubtitle(record);
    return true;
  }
  group.translationQueued = true;
  updateChunkStatus(record, group.index, {
    stage: "asr_done",
    status: "待翻译",
    sourceCount: sourceSegments.length,
    asrFailures: group.failed,
    asrErrors: group.errors.slice(0, 5),
    error: group.failed ? `有 ${group.failed} 个识别音频分段失败，先翻译可用原文。` : "",
    message: `原文 ${sourceSegments.length}${group.empty ? ` · 跳过 ${group.empty} 个无语音分段` : ""}`
  });
  publishBrowserSubtitle(record);
  enqueueAsyncQueue(record.browserTranslationQueue, {
    chunk: {
      index: group.index,
      start: group.start,
      end: group.end,
      duration: Math.max(0, group.end - group.start)
    },
    sourceSegments
  });
  return true;
}

function normalizeBrowserInternalAudioChunk(chunk) {
  const start = Number(chunk?.start || 0) || 0;
  const end = Number(chunk?.end || (start + Number(chunk?.duration || 0))) || start;
  const duration = Number(chunk?.duration || (end - start) || 0) || 0;
  const coreStart = pickFinite(chunk?.coreStart, start);
  const coreEnd = pickFinite(chunk?.coreEnd, end);
  return {
    index: Number.isInteger(Number(chunk?.index)) ? Number(chunk.index) : 0,
    start,
    end,
    duration,
    coreStart,
    coreEnd,
    coreDuration: Math.max(0, pickFinite(chunk?.coreDuration, coreEnd - coreStart)),
    speechIntervals: Array.isArray(chunk?.speechIntervals) ? normalizeAsrSpeechIntervals(chunk.speechIntervals) || [] : undefined,
    speechIntervalsReliable: chunk?.speechIntervalsReliable === false ? false : undefined,
    file: chunk?.file,
    bytes: Number(chunk?.bytes || chunk?.file?.bytes || 0) || 0
  };
}

function browserAudioChunkCoreStart(chunk) {
  return Math.max(0, pickFinite(chunk?.coreStart, chunk?.start, 0));
}

function browserAudioChunkCoreEnd(chunk) {
  const start = browserAudioChunkCoreStart(chunk);
  return Math.max(start, pickFinite(chunk?.coreEnd, chunk?.end, start + Number(chunk?.duration || 0), start));
}

function browserInternalAudioChunkSignature(chunk) {
  return [
    chunk.index,
    roundTime(chunk.start),
    roundTime(chunk.end),
    roundTime(chunk.coreStart),
    roundTime(chunk.coreEnd),
    chunk.file?.cacheUrl || chunk.file?.name || ""
  ].join(":");
}

function ensureBrowserChunkPipelineState(record) {
  if (!record.audioChunks) {
    record.audioChunks = [];
  }
  if (!record.browserInternalAudioChunks) {
    record.browserInternalAudioChunks = [];
  }
  if (!record.browserInternalChunkSignatures) {
    record.browserInternalChunkSignatures = new Set();
  }
  if (!Number.isInteger(record.browserInternalChunkCursor)) {
    record.browserInternalChunkCursor = 0;
  }
  if (!record.browserAsrQueue) {
    record.browserAsrQueue = createAsyncQueue();
  }
  if (!record.browserTranslationQueue) {
    record.browserTranslationQueue = createAsyncQueue();
  }
  if (!record.browserTranslationGroups) {
    record.browserTranslationGroups = new Map();
  }
  if (!record.browserAsrChunkToTranslationGroup) {
    record.browserAsrChunkToTranslationGroup = new Map();
  }
}

function ensureBrowserFunAsrPipelineState(record) {
  ensureBrowserChunkPipelineState(record);
  if (!record.browserFunAsrQueue) {
    record.browserFunAsrQueue = createAsyncQueue();
  }
}

function startBrowserFunAsrChunkPipeline(record) {
  ensureBrowserFunAsrPipelineState(record);
  if (record.browserFunAsrPipelinePromise) {
    return record.browserFunAsrPipelinePromise;
  }
  record.browserFunAsrPipelinePromise = runQueueWorkers(
    record.browserFunAsrQueue,
    browserFunAsrConcurrency(record),
    async chunk => {
      await processBrowserFunAsrChunk(record, chunk, {
        labelSpeakers: browserFunAsrShouldLabelSpeakers(record)
      });
    }
  );
  return record.browserFunAsrPipelinePromise;
}

async function waitBrowserFunAsrChunkPipeline(record) {
  if (!record.browserFunAsrPipelinePromise) {
    return;
  }
  await record.browserFunAsrPipelinePromise;
}

function closeBrowserFunAsrQueue(record) {
  ensureBrowserFunAsrPipelineState(record);
  closeAsyncQueue(record.browserFunAsrQueue);
}

function startBrowserChunkPipeline(record) {
  ensureBrowserChunkPipelineState(record);
  if (record.browserPipelinePromise) {
    return record.browserPipelinePromise;
  }
  const asrWorkers = Math.max(1, Number(record.modelConfig.asrWorkers || 1) || 1);
  const translationWorkers = Math.max(1, Number(record.modelConfig.workers || 1) || 1);
  const asrPromise = runQueueWorkers(record.browserAsrQueue, asrWorkers, async chunk => {
    await processBrowserAsrChunk(record, chunk);
  }).finally(() => {
    closeAsyncQueue(record.browserTranslationQueue);
  });
  const translationPromise = runQueueWorkers(record.browserTranslationQueue, translationWorkers, async payload => {
    await processBrowserTranslationChunk(record, payload.chunk, payload.sourceSegments);
  });
  record.browserPipelinePromise = Promise.all([asrPromise, translationPromise]);
  return record.browserPipelinePromise;
}

async function waitBrowserChunkPipeline(record) {
  if (!record.browserPipelinePromise) {
    return;
  }
  await record.browserPipelinePromise;
}

function closeBrowserAsrQueue(record) {
  ensureBrowserChunkPipelineState(record);
  closeAllBrowserTranslationGroups(record);
  closeAsyncQueue(record.browserAsrQueue);
}

async function processBrowserAsrChunk(record, chunk) {
  if (isBrowserJobCancelled(record)) {
    return;
  }
  const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
  const current = record.job.translation.chunkStatuses[group.index] || {};
  updateChunkStatus(record, group.index, {
    stage: "asr",
    status: "识别",
    attempts: Math.max(1, current.attempts || 1),
    error: "",
    message: `识别 ${browserAsrChunkTimeRangeText(chunk)}`
  });
  if (shouldSkipBrowserAsrChunk(chunk)) {
    updateChunkStatus(record, group.index, {
      stage: "asr",
      status: "跳过",
      attempts: Math.max(1, current.attempts || 1),
      error: "",
      message: `跳过无语音 ${browserAsrChunkTimeRangeText(chunk)}`
    });
    completeBrowserAsrChunkForGroup(record, chunk, []);
    return;
  }
  let sourceSegments;
  try {
    sourceSegments = await transcribeBrowserAudioChunk(chunk, record.modelConfig.asr, {
      onDiagnostics: diagnostics => recordBrowserAsrChunkDiagnostics(record, chunk, diagnostics)
    });
  } catch (error) {
    completeBrowserAsrChunkForGroup(record, chunk, [], error);
    return;
  }
  completeBrowserAsrChunkForGroup(record, chunk, sourceSegments);
}

async function processBrowserTranslationChunk(record, chunk, sourceSegments) {
  if (isBrowserJobCancelled(record)) {
    return;
  }
  const current = record.job.translation.chunkStatuses[chunk.index] || {};
  const asrFailures = chunkStatusAsrFailureCount(current);
  const asrErrors = Array.isArray(current.asrErrors) ? current.asrErrors : [];
  const attempt = current.attempts || 1;
  updateChunkStatus(record, chunk.index, {
    stage: "translation",
    status: "翻译",
    attempts: attempt,
    sourceCount: sourceSegments.length,
    targetLanguage: record.modelConfig.targetLanguage,
    error: "",
    message: `第 ${attempt} 次尝试`
  });
  let translatedSegments;
  try {
    translatedSegments = await translateBrowserSegments(
      sourceSegments,
      record.modelConfig.translation,
      record.modelConfig.targetLanguage,
      record.metadata,
      {
        batchWorkers: browserTranslationBatchWorkers(record),
        splitWorkers: browserTranslationSplitWorkers(record),
        onProgress(progress) {
          updateChunkStatus(record, chunk.index, {
            stage: "translation",
            status: "翻译",
            attempts: attempt,
            sourceCount: sourceSegments.length,
            message: `第 ${attempt} 次尝试 · 第 ${progress.batchIndex}/${progress.batchTotal} 批`
          });
        }
      }
    );
    const translationFailures = browserTranslationFailures(translatedSegments);
    const warningMessage = browserCompletedChunkWarningMessage(translationFailures, asrFailures);
    updateChunkStatus(record, chunk.index, {
      stage: warningMessage ? "completed_with_warnings" : "completed",
      status: warningMessage ? "部分完成" : "完成",
      translatedCount: translatedSegments.length,
      targetLanguage: record.modelConfig.targetLanguage,
      translationFailures: translationFailures.length,
      asrFailures,
      asrErrors,
      error: warningMessage,
      message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
    });
  } catch (error) {
    translatedSegments = [];
    updateChunkStatus(record, chunk.index, {
      stage: "failed",
      status: "失败",
      translatedCount: 0,
      error: `翻译失败，已保留原文供重试：${error.message || String(error)}`
    });
  }
  record.translatedSegmentsByChunk.set(chunk.index, translatedSegments);
  publishBrowserSubtitle(record);
}

function createAsyncQueue() {
  return {
    items: [],
    waiters: [],
    closed: false
  };
}

function enqueueAsyncQueue(queue, item) {
  if (!queue || queue.closed) {
    return false;
  }
  if (queue.waiters.length) {
    queue.waiters.shift()(item);
  } else {
    queue.items.push(item);
  }
  return true;
}

function closeAsyncQueue(queue) {
  if (!queue || queue.closed) {
    return;
  }
  queue.closed = true;
  while (queue.waiters.length) {
    queue.waiters.shift()(null);
  }
}

async function runQueueWorkers(queue, concurrency, worker) {
  const count = Math.max(1, Number(concurrency) || 1);
  await Promise.all(Array.from({ length: count }, async () => {
    while (true) {
      const item = await takeAsyncQueue(queue);
      if (!item) {
        return;
      }
      await worker(item);
    }
  }));
}

function takeAsyncQueue(queue) {
  if (!queue) {
    return Promise.resolve(null);
  }
  if (queue.items.length) {
    return Promise.resolve(queue.items.shift());
  }
  if (queue.closed) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    queue.waiters.push(resolve);
  });
}

function normalizeBrowserAudioChunks(audio, chunkSeconds, fallbackDuration = 0) {
  const duration = pickFinite(audio?.duration, fallbackDuration, chunkSeconds);
  let chunks = [];
  if (Array.isArray(audio?.chunks) && audio.chunks.length) {
    chunks = audio.chunks;
  } else if (isUsableBrowserAudioFile(audio?.file)) {
    chunks = [{ index: 0, start: 0, end: duration, duration, file: audio.file, bytes: audio.bytes || browserAudioFileByteLength(audio.file) || 0 }];
  }
  return chunks.map((chunk, index) => ({
    index: Number.isInteger(chunk.index) ? chunk.index : index,
    start: Number(chunk.start || index * chunkSeconds) || 0,
    end: Number(chunk.end || (index + 1) * chunkSeconds) || (index + 1) * chunkSeconds,
    duration: Number(chunk.duration || chunkSeconds) || chunkSeconds,
    coreStart: pickFinite(chunk.coreStart, chunk.start, index * chunkSeconds),
    coreEnd: pickFinite(chunk.coreEnd, chunk.end, (index + 1) * chunkSeconds),
    coreDuration: pickFinite(chunk.coreDuration, pickFinite(chunk.coreEnd, chunk.end, (index + 1) * chunkSeconds) - pickFinite(chunk.coreStart, chunk.start, index * chunkSeconds)),
    speechIntervals: Array.isArray(chunk.speechIntervals) ? normalizeAsrSpeechIntervals(chunk.speechIntervals) || [] : undefined,
    speechIntervalsReliable: chunk?.speechIntervalsReliable === false ? false : undefined,
    file: chunk.file,
    bytes: chunk.bytes || browserAudioFileByteLength(chunk.file) || 0
  })).filter(chunk => isUsableBrowserAudioFile(chunk.file));
}

function createNoBrowserAudioChunksError(audio) {
  const hasFile = isUsableBrowserAudioFile(audio?.file);
  const chunkCount = Array.isArray(audio?.chunks) ? audio.chunks.length : 0;
  const bytes = pickFinite(
    audio?.bytes,
    browserAudioFileByteLength(audio?.file),
    Array.isArray(audio?.chunks)
      ? audio.chunks.reduce((sum, chunk) => sum + (Number(chunk?.bytes || browserAudioFileByteLength(chunk?.file) || 0) || 0), 0)
      : 0
  );
  const parts = [
    `source=${audio?.sourceType || "unknown"}`,
    `duration=${pickFinite(audio?.duration, 0)}`,
    `chunks=${chunkCount}`,
    `file=${hasFile ? "yes" : "no"}`,
    `bytes=${bytes}`
  ];
  return new Error(`Web FFmpeg 没有返回可处理的音频切片：${parts.join("，")}。`);
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
  const supportedRequestFields = await resolveBrowserAsrSupportedRequestFields(asrConfig);
  const speechTimestampsEndpoint = await resolveBrowserAsrSpeechTimestampsEndpoint(asrConfig);
  const useExternalVadPrecheck = shouldUseBrowserAsrExternalVadPrecheck(supportedRequestFields, speechTimestampsEndpoint);
  const nativeVadAvailable = shouldUseBrowserAsrNativeVadTranscription(supportedRequestFields, speechTimestampsEndpoint);
  const fileName = chunk.file?.name || `chunk-${chunk.index + 1}.mp3`;
  assertBrowserAsrChunkCanUpload(chunk, asrConfig);
  const fileBuffer = await getBrowserAudioChunkBuffer(chunk.file);
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
        endpoint: speechTimestampsEndpoint
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
    return transcribeBrowserCollectedSpeechAudioChunk({
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
  }
  let transcription = null;
  let postprocessed = null;
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
        disableVadFilter: shouldDisableBrowserAsrServerVadForRecall(asrConfig, reliableSpeechIntervals, clipTimestamps)
      });
    } catch (error) {
      if (!shouldRetryBrowserAsrClipRequestError(error, clipTimestamps)) {
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
        disableVadFilter: shouldDisableBrowserAsrServerVadForRecall(asrConfig, reliableSpeechIntervals, "")
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
        disableVadFilter: true
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
        disableVadFilter: coverageRetry.disableVadFilter
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
  return postprocessed.finalSegments;
}

function shouldRetryBrowserAsrClipRequestError(error, clipTimestamps = "") {
  if (!clipTimestamps) {
    return false;
  }
  return Array.isArray(error?.asrRequestFields)
    && error.asrRequestFields.some(([name]) => name === "clip_timestamps");
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
  const collected = await collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig);
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
    return [];
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
    const collectedBuffer = await getBrowserAudioChunkBuffer(collectedChunk.file);
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
      disableVadFilter: true
    });
    const postprocessed = postprocessBrowserAsrCollectedSpeechPayload(transcription.payload, sourceChunk, collectedChunk, asrConfig, {
      requestFields: transcription.requestFields,
      matureAsrPlan: transcription.matureAsrPlan
    });
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
    diagnostics.request.fields = transcription.requestFields.map(([name, value]) => [name, String(value)]);
    diagnostics.rawPayload = cloneJsonForDiagnostics(transcription.payload);
    diagnostics.matureAsrPlan = cloneJsonForDiagnostics(transcription.matureAsrPlan);
  }
  diagnostics.collectedSpeech.attempts = attempts;
  diagnostics.chunk = browserAsrDiagnosticChunkInfo(sourceChunk);
  diagnostics.normalizedSegments = cloneJsonForDiagnostics(mergedPostprocessed.normalized);
  diagnostics.speechFilteredSegments = cloneJsonForDiagnostics(mergedPostprocessed.speechFiltered);
  diagnostics.hallucinationFilteredSegments = cloneJsonForDiagnostics(mergedPostprocessed.hallucinationFiltered);
  diagnostics.finalSegments = cloneJsonForDiagnostics(mergedPostprocessed.finalSegments);
  diagnostics.postprocess = cloneJsonForDiagnostics(mergedPostprocessed.postprocess);
  emitBrowserAsrDiagnostics(options, diagnostics);
  return mergedPostprocessed.finalSegments;
}

async function collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig = {}) {
  await ensureOffscreenDocument();
  const webFfmpeg = await getWebFfmpegConfig();
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO,
    webFfmpegUrl: webFfmpeg.url,
    file: {
      name: fileName || sourceChunk?.file?.name || `asr-${Number(sourceChunk?.index || 0)}.mp3`,
      mime: sourceChunk?.file?.mime || "audio/mpeg",
      cacheUrl: sourceChunk?.file?.cacheUrl || "",
      buffer: fileBuffer
    },
    outputName: `speech-${fileName || sourceChunk?.file?.name || "asr.mp3"}`,
    speechIntervals: cloneJsonForDiagnostics(reliableSpeechIntervals),
    duration: Math.max(0, Number(sourceChunk?.duration || (Number(sourceChunk?.end) - Number(sourceChunk?.start)) || 0) || 0),
    sourceStart: Number(sourceChunk?.start || 0) || 0,
    maxChunkSeconds: BROWSER_ASR_MATURE_MAX_SPEECH_DURATION_SECONDS,
    cacheNamespace: "",
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

async function requestBrowserAsrTranscription({ endpoint, timeoutMs, asrConfig, supportedRequestFields, effectiveChunk, fileBuffer, fileName, clipTimestamps, matureAsrPlan, disableVadFilter = false }) {
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
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asrConfig.apiKey}`
      },
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw createBrowserAsrRequestError(`ASR 请求超时（${Math.round(timeoutMs / 1000)} 秒）：${endpoint}`, {
        requestFields,
        matureAsrPlan: requestMatureAsrPlan
      });
    }
    throw createBrowserAsrRequestError(`ASR 请求失败：${formatAsrFetchError(error, endpoint)}`, {
      requestFields,
      matureAsrPlan: requestMatureAsrPlan
    });
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
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
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: chunk.file?.mime || "audio/mpeg" }), fileName);
    formData.append("threshold", "0.15");
    formData.append("min_speech_duration_ms", "0");
    formData.append("max_speech_duration_s", "30");
    formData.append("min_silence_duration_ms", "160");
    formData.append("speech_pad_ms", "800");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asrConfig.apiKey}`
      },
      body: formData,
      signal: controller.signal
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
    if (diagnostics?.vad) {
      diagnostics.vad.error = error?.message || String(error || "VAD 请求失败");
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
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

async function getBrowserAudioChunkBuffer(file) {
  if (file?.buffer instanceof ArrayBuffer) {
    return file.buffer;
  }
  if (Array.isArray(file?.parts) && file.parts.length) {
    throw new Error("识别音频分段仍由多个 MP3 片段组成，不能直接字节拼接上传；请重新抽取音频。");
  }
  if (file?.cacheUrl) {
    const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
    const response = await cache.match(file.cacheUrl);
    if (!response) {
      throw new Error("浏览器内音频缓存已失效，请重新抽取音频。");
    }
    return response.arrayBuffer();
  }
  throw new Error("识别音频分段缺少可上传的数据。");
}

function normalizeBrowserSourceSegmentsForTranslation(segments, chunkIndex) {
  const usableSegments = filterAsrDistributedRepeatedRuns(segments || [])
    .filter(isUsableTimedTextSegment)
    .map(segment => {
      const { rawSegment, words, ...publicSegment } = segment;
      return {
        ...publicSegment,
        start: Number(segment.start),
        end: Number(segment.end),
        text: cleanVttText(segment.text || "")
      };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  return tagSegmentsWithChunkOrder(mergeAdjacentDuplicateAsrSegments(usableSegments), chunkIndex);
}

function isUsableTimedTextSegment(segment) {
  const start = Number(segment?.start);
  const end = Number(segment?.end);
  const text = cleanVttText(segment?.text || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start && Boolean(text);
}

function tagSegmentsWithChunkOrder(segments, chunkIndex) {
  const normalizedChunkIndex = Number(chunkIndex);
  return (segments || []).map((segment, segmentIndex) => ({
    ...segment,
    chunkIndex: Number.isFinite(normalizedChunkIndex) ? normalizedChunkIndex : chunkIndex,
    segmentIndex
  }));
}

function createChunkStatus(index, stage) {
  const now = Date.now();
  return {
    index,
    stage,
    status: stage === "queued" ? "排队" : stage,
    attempts: 0,
    sourceCount: 0,
    translatedCount: 0,
    message: "",
    stageStartedAt: now,
    updatedAt: now
  };
}

function updateChunkStatus(record, index, patch) {
  const statuses = record.job.translation.chunkStatuses;
  const current = statuses[index] || createChunkStatus(index, "queued");
  const now = Date.now();
  const nextStage = patch.stage || current.stage;
  statuses[index] = {
    ...current,
    ...patch,
    index,
    stageStartedAt: nextStage !== current.stage ? now : (current.stageStartedAt || now),
    updatedAt: now
  };
  const completed = statuses.filter(item => ["completed", "completed_with_warnings", "failed"].includes(item.stage)).length;
  const failed = statuses.filter(item => item.stage === "failed").length;
  const asrRunning = statuses.filter(item => item.stage === "asr").length;
  const translating = statuses.filter(item => item.stage === "translation").length;
  const asrPartialFailed = statuses.filter(item => item?.stage !== "failed" && chunkStatusAsrFailureCount(item) > 0).length;
  record.job.translation.chunksDone = completed;
  record.job.translation.chunksFailed = failed;
  record.job.translation.failed = failed;
  record.job.translation.chunksAsrPartialFailed = asrPartialFailed;
  record.job.translation.chunksAsr = asrRunning;
  record.job.translation.asrRunning = asrRunning;
  record.job.translation.chunksTranslating = translating;
  record.job.translation.translationRunning = translating;
  publishBrowserPreloadJob(record);
}

function chunkStatusAsrFailureCount(status) {
  return Math.max(0, Number(status?.asrFailures || status?.asr_failures || 0) || 0);
}

function publishBrowserSubtitle(record) {
  const source = collectChunkSegments(record.sourceSegmentsByChunk);
  const translated = collectChunkSegments(record.translatedSegmentsByChunk);
  const display = mergeTranslatedDisplaySegments(source, translated);
  record.job.translation.sourceSegments = source.length;
  record.job.translation.translatedSegments = translated.length;
  record.job.translation.segmentCount = display.length;
  record.job.translation.vttPath = display.length ? "browser-memory" : "";
  record.job.translation.vttText = display.length ? segmentsToVtt(display) : "";
  record.job.translation.transcript = { source, translated, metadata: record.metadata };
  publishBrowserPreloadJob(record);
  attachBrowserJobVttIfReady(record).catch(() => {});
}

function mergeTranslatedDisplaySegments(source, translated) {
  const sourceSegments = Array.isArray(source) ? source : [];
  const translatedSegments = Array.isArray(translated) ? translated : [];
  if (!sourceSegments.length) {
    return translatedSegments;
  }
  if (!translatedSegments.length) {
    return sourceSegments;
  }
  const translatedByKey = new Map();
  translatedSegments.forEach((segment, index) => {
    const key = segmentIdentityKey(segment, index);
    if (key) {
      translatedByKey.set(key, segment);
    }
  });
  const usedKeys = new Set();
  const display = sourceSegments.map((segment, index) => {
    const key = segmentIdentityKey(segment, index);
    const translatedSegment = key ? translatedByKey.get(key) : translatedSegments[index];
    if (key && translatedSegment) {
      usedKeys.add(key);
    }
    return translatedSegment || segment;
  });
  for (const [index, segment] of translatedSegments.entries()) {
    const key = segmentIdentityKey(segment, index);
    if (key && usedKeys.has(key)) {
      continue;
    }
    if (!key && index < sourceSegments.length) {
      continue;
    }
    display.push(segment);
  }
  return display.sort((left, right) => left.start - right.start || left.end - right.end);
}

function segmentIdentityKey(segment, fallbackIndex = null) {
  const chunkIndex = Number(segment?.chunkIndex);
  const segmentIndex = Number(segment?.segmentIndex);
  if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
    return `${chunkIndex}:${segmentIndex}`;
  }
  return Number.isInteger(fallbackIndex) ? `fallback:${fallbackIndex}` : "";
}

function browserFailureSummary(record) {
  const failed = (record?.job?.translation?.chunkStatuses || []).filter(item => item?.stage === "failed").length;
  if (!failed) {
    return "";
  }
  const sourceCount = collectChunkSegments(record.sourceSegmentsByChunk || new Map()).length;
  const translatedCount = collectChunkSegments(record.translatedSegmentsByChunk || new Map()).length;
  if (!sourceCount && !translatedCount) {
    return `有 ${failed} 个识别分段失败，没有可显示的原文；请检查 ASR 服务后重试。`;
  }
  if (translatedCount) {
    return `有 ${failed} 个识别分段失败，已先显示可用字幕。`;
  }
  return `有 ${failed} 个识别分段失败，已先显示可用原文。`;
}

function finalizeBrowserCompletionState(record) {
  const failed = record.job.translation.chunkStatuses.filter(item => item.stage === "failed").length;
  const coverageWarning = browserSubtitleCoverageWarning(record);
  const asrPartialWarning = browserAsrPartialFailureSummary(record);
  const partialWarning = browserPartialTranslationSummary(record);
  const messages = [failed ? browserFailureSummary(record) : "", asrPartialWarning, partialWarning, coverageWarning].filter(Boolean);
  record.job.status = "completed";
  record.job.stage = messages.length ? "completed_with_warnings" : "completed";
  record.job.error = messages.join(" ");
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  publishBrowserPreloadJob(record);
  return { failed, asrPartialFailure: Boolean(asrPartialWarning), partialWarning, coverageWarning };
}

function browserPartialTranslationChunkMessage(failures) {
  const count = Array.isArray(failures) ? failures.length : 0;
  return count ? `部分句子翻译失败，已显示可用译文并保留 ${count} 条原文供重试。` : "";
}

function browserAsrPartialChunkMessage(count) {
  const failed = Math.max(0, Number(count || 0) || 0);
  return failed ? `有 ${failed} 个识别音频分段失败，已翻译可用原文；可重试失败识别分段。` : "";
}

function browserCompletedChunkWarningMessage(translationFailures, asrFailures = 0) {
  return [
    browserPartialTranslationChunkMessage(translationFailures),
    browserAsrPartialChunkMessage(asrFailures)
  ].filter(Boolean).join(" ");
}

function browserAsrPartialFailureSummary(record) {
  const partialStatuses = (record?.job?.translation?.chunkStatuses || [])
    .filter(item => item?.stage !== "failed" && chunkStatusAsrFailureCount(item) > 0);
  if (!partialStatuses.length) {
    return "";
  }
  const failedAudioChunks = partialStatuses.reduce((sum, item) => sum + chunkStatusAsrFailureCount(item), 0);
  return `有 ${partialStatuses.length} 个字幕分段存在 ${failedAudioChunks} 个失败音频分段，已先显示可用字幕；可重试失败识别分段。`;
}

function browserPartialTranslationSummary(record) {
  const partialStatuses = (record?.job?.translation?.chunkStatuses || [])
    .filter(item => item?.stage === "completed_with_warnings" && Math.max(0, Number(item.translationFailures || 0) || 0) > 0);
  if (!partialStatuses.length) {
    return "";
  }
  const failedSentences = partialStatuses.reduce((sum, item) => sum + Math.max(0, Number(item.translationFailures || 0) || 0), 0);
  return failedSentences
    ? `有 ${partialStatuses.length} 个翻译分段只完成部分句子，${failedSentences} 条失败句子已保留原文供重试。`
    : `有 ${partialStatuses.length} 个翻译分段只完成部分句子，失败句子已保留原文供重试。`;
}

function browserCompletionAllowsAudioRelease(completion) {
  return Boolean(completion?.releaseAudioCache);
}

function browserSubtitleCoverageWarning(record) {
  const expectedDuration = browserExpectedMediaDuration(record);
  if (!Number.isFinite(expectedDuration) || expectedDuration < 300) {
    return "";
  }
  const displaySegments = mergeTranslatedDisplaySegments(
    collectChunkSegments(record.sourceSegmentsByChunk || new Map()),
    collectChunkSegments(record.translatedSegmentsByChunk || new Map())
  );
  const subtitleEnd = Math.max(
    0,
    ...displaySegments
      .map(segment => Number(segment.end))
      .filter(value => Number.isFinite(value) && value > 0)
  );
  if (!subtitleEnd) {
    return "没有生成可显示字幕；如果视频确实没有语音可忽略，否则请确认媒体源是否完整，必要时清缓存后重新抽取。";
  }
  const uncoveredSeconds = expectedDuration - subtitleEnd;
  if (uncoveredSeconds <= 120 || subtitleEnd >= expectedDuration * 0.75) {
    return "";
  }
  return `字幕只覆盖到 ${formatCoverageDuration(subtitleEnd)} / 预计 ${formatCoverageDuration(expectedDuration)}，覆盖明显不足；请确认媒体源是否完整，必要时清缓存后重新抽取。`;
}

function browserExpectedMediaDuration(record) {
  return [
    record?.metadata?.duration,
    record?.candidate?.duration,
    record?.job?.extract?.duration
  ]
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)[0] || 0;
}

function formatCoverageDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function collectChunkSegments(map) {
  return [...map.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .flatMap(([chunkIndex, segments]) => {
      const normalizedChunkIndex = Number(chunkIndex);
      return [...(segments || [])]
        .map((segment, fallbackSegmentIndex) => {
          const segmentIndex = Number(segment.segmentIndex);
          const segmentChunkIndex = Number(segment.chunkIndex);
          return {
            ...segment,
            chunkIndex: Number.isFinite(segmentChunkIndex)
              ? segmentChunkIndex
              : Number.isFinite(normalizedChunkIndex)
                ? normalizedChunkIndex
                : chunkIndex,
            segmentIndex: Number.isFinite(segmentIndex) ? segmentIndex : fallbackSegmentIndex
          };
        })
        .sort((left, right) =>
          left.segmentIndex - right.segmentIndex ||
          left.start - right.start ||
          left.end - right.end
        );
    });
}

function segmentsToVtt(segments) {
  const blocks = ["WEBVTT", ""];
  for (const segment of segments) {
    const text = cleanVttText(segment.text);
    if (!Number.isFinite(Number(segment.start)) || !Number.isFinite(Number(segment.end)) || !text) {
      continue;
    }
    blocks.push(`${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}`);
    blocks.push(text);
    blocks.push("");
  }
  return blocks.length > 2 ? blocks.join("\n") : "";
}

async function attachBrowserJobVttIfReady(record) {
  if (!record.tabId || !record.job.translation.vttText || !(await isSubtitleOverlayEnabled())) {
    return;
  }
  if (!browserPreloadRecordMatchesCurrentPage(record)) {
    return;
  }
  if (hasManualVttAttachment(record.tabId)) {
    return;
  }
  if (isPreloadSubtitleAttachmentSuppressed(record.tabId, record.job.id)) {
    return;
  }
  const attachment = await buildBrowserVttAttachment(record.job);
  if (!attachment.vtt) {
    return;
  }
  const signature = browserVttAttachmentSignature(record.job, attachment);
  const state = getState(record.tabId);
  if (state.attachedVttSignature === signature && await hasAttachedSubtitleSignature(record.tabId, signature)) {
    return;
  }
  await ensureSubtitleOverlay(record.tabId);
  const response = await sendMessageToMediaFrame(record.tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt: attachment.vtt,
    label: "流声字幕",
    signature
  });
  if (response?.ok) {
    state.attachedVttSignature = signature;
    state.manualVttSignature = "";
  }
}

async function buildBrowserVttAttachment(job) {
  const mode = await getSubtitleDisplayMode();
  const transcript = job.translation?.transcript;
  const allowSourceFallback = browserJobAllowsOverlaySourceFallback(job);
  if (mode === "source") {
    const source = transcriptToSourceVtt(transcript);
    if (source) {
      return { mode, vtt: source };
    }
    return { mode, vtt: "" };
  }
  if (mode === "bilingual") {
    const bilingual = transcriptToBilingualVtt(transcript, { allowSourcePreview: allowSourceFallback });
    if (bilingual) {
      return { mode, vtt: bilingual };
    }
  }
  const translated = transcriptToTranslatedVtt(transcript, { allowSourcePreview: allowSourceFallback });
  if (translated) {
    return { mode: "translated", vtt: translated };
  }
  return { mode: "translated", vtt: transcript ? "" : (job.translation?.vttText || "") };
}

function browserJobAllowsOverlaySourceFallback(job) {
  return ["done", "completed"].includes(String(job?.status || ""));
}

function browserVttAttachmentSignature(job, attachment) {
  return [
    job.id,
    attachment.mode,
    vttContentSignature(attachment.vtt)
  ].join(":");
}

function findBrowserPreloadRecordForTabPage(tabId, pageUrl) {
  if (!tabId || !normalizeBrowserPageIdentity(pageUrl)) {
    return null;
  }
  return [...browserPreloadJobs.values()]
    .filter(record => record?.tabId === tabId && !record.cancelled && browserPreloadRecordMatchesPageUrl(record, pageUrl))
    .sort((left, right) => Number(right.job?.updatedAt || 0) - Number(left.job?.updatedAt || 0))[0] || null;
}

function browserPreloadRecordMatchesCurrentPage(record) {
  if (!record?.tabId) {
    return false;
  }
  const state = tabState.get(record.tabId);
  const currentPageUrl = state?.page?.url || state?.context?.href || "";
  return browserPreloadRecordMatchesPageUrl(record, currentPageUrl);
}

function browserPreloadRecordMatchesPageUrl(record, pageUrl) {
  if (!record) {
    return false;
  }
  return browserPreloadJobMatchesPageUrl(record.job, pageUrl)
    || browserPageIdentitiesMatch(record.metadata?.pageUrl || record.candidate?.pageUrl || "", pageUrl);
}

function browserPreloadJobMatchesPageUrl(job, pageUrl) {
  if (!job) {
    return false;
  }
  return browserPageIdentitiesMatch(
    job.metadata?.pageUrl || job.translation?.transcript?.metadata?.pageUrl || "",
    pageUrl
  );
}

function browserPageIdentitiesMatch(left, right) {
  const expected = normalizeBrowserPageIdentity(left);
  if (!expected) {
    return false;
  }
  const actual = normalizeBrowserPageIdentity(right);
  return Boolean(actual && actual === expected);
}

function normalizeBrowserPageIdentity(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    url.hash = "";
    normalizeBilibiliBrowserPageIdentity(url);
    for (const key of [...url.searchParams.keys()]) {
      if (isBrowserPageTrackingParam(key) || isBrowserPageSensitiveParam(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return stripBrowserPageSensitiveQuery(rawUrl, { removeTracking: true });
  }
}

function normalizeBilibiliBrowserPageIdentity(url) {
  if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) {
    return;
  }
  const match = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) {
    return;
  }
  const part = url.searchParams.get("p");
  url.pathname = `/video/${match[1]}`;
  url.search = "";
  if (part && /^\d+$/.test(part)) {
    url.searchParams.set("p", part);
  }
}

function stripBrowserPageSensitiveQuery(rawUrl, { removeTracking = false } = {}) {
  const text = String(rawUrl || "").trim();
  const [withoutHash] = text.split("#");
  const queryStart = withoutHash.indexOf("?");
  if (queryStart < 0) {
    return withoutHash;
  }
  const base = withoutHash.slice(0, queryStart);
  const query = withoutHash.slice(queryStart + 1);
  const params = query.split("&").filter(Boolean).filter(part => {
    const key = decodeBrowserPageQueryKey(part.split("=")[0] || "");
    return !isBrowserPageSensitiveParam(key) && !(removeTracking && isBrowserPageTrackingParam(key));
  });
  params.sort();
  return params.length ? `${base}?${params.join("&")}` : base;
}

function decodeBrowserPageQueryKey(value) {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, " "));
  } catch {
    return String(value || "");
  }
}

function isBrowserPageTrackingParam(key) {
  return /^(utm_|spm_|vd_source$|from$|share_|fbclid$|gclid$|trackid$)/i.test(String(key || ""));
}

function isBrowserPageSensitiveParam(key) {
  return /^(token$|access_?token$|auth(?:_key)?$|authorization$|signature$|sign$|sig$|policy$|key-pair-id$|awsaccesskeyid$|expires?$|expiration$|deadline$|timestamp$|ts$|nonce$|session(?:id)?$|sid$|x-amz-|x-oss-|x-goog-)/i.test(String(key || ""));
}

function publishBrowserPreloadJob(record) {
  record.job.updatedAt = Date.now();
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  record.job.reusableAudioChunks = (record.audioChunks || []).length;
  record.job.reusableSourceChunks = record.sourceSegmentsByChunk?.size || 0;
  record.job.translation.reusableAudioChunks = record.job.reusableAudioChunks;
  record.job.translation.reusableSourceChunks = record.job.reusableSourceChunks;
  record.job.progress = browserJobProgress(record.job);
  if (!browserPreloadRecordMatchesCurrentPage(record)) {
    return;
  }
  setTabStatus(record.tabId, {
    preload: record.job.status,
    preloadJob: record.job,
    error: record.job.error || ""
  });
}

function browserJobProgress(job) {
  const extract = job.extract || {};
  const translation = job.translation || {};
  const total = Number(translation.chunksTotal || translation.chunkCount || 0);
  const done = Number(translation.chunksDone || 0);
  const failed = Number(translation.chunksFailed || translation.failed || 0);
  const extractPercent = Number(extract.progress || 0) || 0;
  return {
    status: job.status,
    stage: job.stage,
    elapsedSeconds: extract.elapsedSeconds || 0,
    extractPercent,
    translationPercent: total ? Math.round((done / total) * 1000) / 10 : 0,
    extraction: {
      ...extract,
      percent: extractPercent,
      status: extract.status || job.stage
    },
    translation: {
      ...translation,
      chunksTotal: total,
      chunksDone: done,
      chunksFailed: failed,
      chunksAsr: Number(translation.chunksAsr || translation.asrRunning || 0),
      chunksTranslating: Number(translation.chunksTranslating || translation.translationRunning || 0),
      asrWorkers: translation.asrWorkers,
      translationWorkers: translation.translationWorkers || translation.workers,
      chunkStatuses: translation.chunkStatuses || []
    },
    chunkStatuses: translation.chunkStatuses || [],
    chunksFailed: failed
  };
}

function isBrowserJobCancelled(record) {
  return record.cancelled || record.job.status === "cancelled";
}

function elapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function clampProgressPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
}

function pickNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) {
    return Math.floor(number);
  }
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 0 ? Math.floor(fallbackNumber) : 0;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(Number(concurrency) || 1, queue.length || 1)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function normalizeApiBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function browserAsrUploadChunkSeconds(modelConfig = {}) {
  return normalizeBrowserAsrUploadChunkSeconds(modelConfig.asrUploadChunkSeconds);
}

async function browserAsrEffectiveUploadChunkSeconds(modelConfig = {}) {
  const configured = browserAsrUploadChunkSeconds(modelConfig);
  let supportedRequestFields = null;
  let speechTimestampsEndpoint = "";
  try {
    supportedRequestFields = await resolveBrowserAsrSupportedRequestFields(modelConfig.asr || {});
  } catch {
    supportedRequestFields = null;
  }
  try {
    speechTimestampsEndpoint = await resolveBrowserAsrSpeechTimestampsEndpoint(modelConfig.asr || {});
  } catch {
    speechTimestampsEndpoint = "";
  }
  if (!browserAsrShouldUseCompatVadOnlyShortWindows(modelConfig.asr || {}, supportedRequestFields, speechTimestampsEndpoint)) {
    return configured;
  }
  return Math.min(configured, BROWSER_ASR_COMPAT_VAD_ONLY_UPLOAD_CHUNK_SECONDS);
}

function browserAsrShouldUseCompatVadOnlyShortWindows(asrConfig = {}, supportedRequestFields = null, speechTimestampsEndpoint = "") {
  if (normalizeProviderType(asrConfig?.providerType) !== "openai") {
    return false;
  }
  const vadMode = normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode);
  if (vadMode === "off") {
    return false;
  }
  const fields = supportedRequestFields instanceof Set ? supportedRequestFields : new Set();
  const supported = name => asrRequestFieldSupported({ supportedRequestFields: fields }, name);
  if (!supported("vad_filter") || supported("clip_timestamps")) {
    return false;
  }
  if (supported("vad_parameters")) {
    return false;
  }
  const granularVadFields = [
    "threshold",
    "min_speech_duration_ms",
    "max_speech_duration_s",
    "min_silence_duration_ms",
    "speech_pad_ms"
  ];
  return !granularVadFields.every(supported);
}

function normalizeBrowserAsrUploadChunkSeconds(value) {
  const configured = Number(value || BROWSER_ASR_UPLOAD_CHUNK_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0
    ? configured
    : BROWSER_ASR_UPLOAD_CHUNK_SECONDS;
  return Math.max(10, Math.min(BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS, Math.floor(seconds)));
}

function browserAsrMaxUploadBytes(asrConfig = {}) {
  const directBytes = Number(asrConfig?.maxUploadBytes || asrConfig?.maxFileBytes || 0);
  if (Number.isFinite(directBytes) && directBytes > 0) {
    return Math.floor(directBytes);
  }
  const mb = Number(asrConfig?.maxUploadMb || asrConfig?.maxFileSizeMb || 0);
  if (Number.isFinite(mb) && mb > 0) {
    return Math.floor(mb * 1024 * 1024);
  }
  return BROWSER_ASR_MAX_UPLOAD_BYTES;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) {
    return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
  }
  if (value >= 1024) {
    return `${Math.round((value / 1024) * 10) / 10} KB`;
  }
  return `${Math.round(value)} B`;
}

function browserTranslationSegmentSeconds(record) {
  const seconds = Number(record?.modelConfig?.chunkSeconds || DEFAULT_MODEL_SETTINGS.chunkMinutes * 60);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_MODEL_SETTINGS.chunkMinutes * 60;
}

function browserTranslationBatchWorkers(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(2, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
}

function browserTranslationSplitWorkers(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(2, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

async function retryPreload(tabId, chunkIndexes = []) {
  const state = getState(tabId);
  const jobId = state.preloadJob?.id;
  if (!jobId) {
    throw new Error("没有正在跟踪的预加载任务，不能重试失败识别分段。请先重新抽取。");
  }
  clearPreloadSubtitleSuppression(tabId, jobId);
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    await refreshBrowserTranslationModelConfig(browserRecord);
    if (browserRecord.pipeline === "funasr" || browserRecord.job?.pipeline === "funasr") {
      return retryBrowserFunAsrFailedPreload(browserRecord, chunkIndexes);
    }
    return retryBrowserFailedPreload(browserRecord, chunkIndexes);
  }
  if (state.preloadJob?.status === "running" || state.preloadJob?.status === "queued") {
    return {
      preload: state.preloadJob.status,
      job: state.preloadJob,
      message: "当前任务仍在运行，已忽略重复重试请求。"
    };
  }
  const failedChunkCount = countFailedChunks(state.preloadJob);
  if (failedChunkCount <= 0) {
    throw new Error("当前任务没有失败识别分段可重试。需要重新抽取时请点击“重新抽取”。");
  }
  throw new Error("后台任务状态已过期或这个任务不是当前浏览器内预加载任务，不能重试失败识别分段。请重新抽取。");
}

async function rerunAsrPreload(tabId, chunkIndexes = [], options = {}) {
  const state = getState(tabId);
  const jobId = state.preloadJob?.id;
  if (!jobId) {
    throw new Error("没有正在跟踪的预加载任务，不能重新 ASR。请先抽取音频。");
  }
  clearPreloadSubtitleSuppression(tabId, jobId);
  const browserRecord = browserPreloadJobs.get(jobId);
  if (!browserRecord) {
    throw new Error("后台任务状态已过期，不能复用音频重新 ASR。请重新抽取。");
  }
  await refreshBrowserTranslationModelConfig(browserRecord, { ...options, refreshAsrLanguage: true });
  return rerunBrowserAsrFromAudio(browserRecord, chunkIndexes);
}

async function rerunBrowserAsrFromAudio(record, chunkIndexes = []) {
  if (record?.job?.audioCacheRemoved) {
    throw new Error("当前任务的音频缓存已清除，不能重新 ASR。请重新抽取。");
  }
  if (!Array.isArray(record?.audioChunks) || !record.audioChunks.length) {
    throw new Error("没有可复用的音频缓存，不能重新 ASR。请重新抽取。");
  }
  const indexes = collectBrowserAsrRerunIndexes(record, chunkIndexes);
  if (!indexes.length) {
    throw new Error("没有匹配到可重新 ASR 的音频分段。");
  }
  const isFunAsr = record.pipeline === "funasr" || record.job?.pipeline === "funasr";
  record.job.status = "running";
  record.job.stage = "retrying";
  record.job.subtitleCleared = false;
  resetBrowserRecognitionResults(record, indexes);
  publishBrowserSubtitle(record);
  publishBrowserPreloadJob(record);
  if (isFunAsr) {
    const chunksByIndex = new Map(record.audioChunks.map(chunk => [Number(chunk.index), chunk]));
    const chunks = indexes.map(index => chunksByIndex.get(index)).filter(Boolean);
    if (!chunks.length) {
      throw new Error("Fun-ASR 任务没有保留可重新识别的音频分段，请重新抽取。");
    }
    const labelSpeakers = dashScopeFunAsrShouldDiarize({
      chunksTotal: record.audioChunks.length,
      duration: pickFinite(record.job.extract?.duration, record.metadata?.duration)
    });
    await runPool(chunks, browserFunAsrConcurrency(record), async chunk => {
      await processBrowserFunAsrChunk(record, chunk, { labelSpeakers });
    });
  } else {
    await runPool(indexes, Math.max(record.modelConfig.asrWorkers || 1, 1), async index => {
      await retryBrowserAsrGroup(record, index);
    });
  }
  publishBrowserSubtitle(record);
  finalizeBrowserCompletionState(record);
  return { preload: record.job.status, job: record.job, message: "已提交重新 ASR。" };
}

function collectBrowserAsrRerunIndexes(record, chunkIndexes = []) {
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number).filter(Number.isFinite) : []);
  const isFunAsr = record?.pipeline === "funasr" || record?.job?.pipeline === "funasr";
  const indexes = (record?.audioChunks || [])
    .map(chunk => isFunAsr ? Number(chunk.index) : browserTranslationGroupIndex(record, chunk))
    .filter(Number.isFinite)
    .filter(index => !requested.size || requested.has(index));
  return [...new Set(indexes)].sort((left, right) => left - right);
}

function resetBrowserRecognitionResults(record, indexes) {
  for (const index of indexes) {
    record.sourceSegmentsByChunk?.delete(index);
    record.translatedSegmentsByChunk?.delete(index);
    updateChunkStatus(record, index, {
      stage: "queued",
      status: "排队",
      attempts: 0,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      translationFailures: 0,
      error: "",
      message: "等待重新 ASR"
    });
  }
}

async function retranslatePreload(tabId, chunkIndexes = [], options = {}) {
  const state = getState(tabId);
  const jobId = state.preloadJob?.id;
  if (!jobId) {
    throw new Error("没有正在跟踪的预加载任务，不能只重翻译字幕。请先完成一次抽取和识别。");
  }
  clearPreloadSubtitleSuppression(tabId, jobId);
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    await refreshBrowserTranslationModelConfig(browserRecord, options);
    return retryBrowserTranslationOnly(browserRecord, chunkIndexes, { failedOnly: false, resetAttempts: true });
  }
  if (state.preloadJob?.status === "running" || state.preloadJob?.status === "queued") {
    return {
      preload: state.preloadJob.status,
      job: state.preloadJob,
      message: "当前任务仍在运行，已忽略重复重翻译请求。"
    };
  }
  throw new Error("后台任务状态已过期或这个任务不是当前浏览器内预加载任务，不能只重翻译。请重新抽取。");
}

async function retranslateCachedTranscript(tabId, transcript, metadata = {}, options = {}) {
  const sourceSegments = transcriptSourceSegmentsForTranslation(transcript);
  if (!sourceSegments.length) {
    throw new Error("本地字幕缓存没有可复用的 ASR 原文，不能只重翻译。");
  }
  const modelConfig = await getModelConfig();
  if (options.targetLanguage) {
    modelConfig.targetLanguage = normalizeTargetLanguage(options.targetLanguage, modelConfig.targetLanguage);
  }
  const normalizedMetadata = {
    title: metadata.title || transcript?.metadata?.title || "",
    pageUrl: metadata.pageUrl || transcript?.metadata?.pageUrl || "",
    sourceUrl: metadata.sourceUrl || transcript?.metadata?.sourceUrl || "",
    duration: pickFinite(metadata.duration, transcript?.metadata?.duration, sourceSegments.at(-1)?.end)
  };
  const jobId = `cache-translate-${Date.now()}`;
  const job = {
    id: jobId,
    pipeline: "cached-transcript",
    status: "running",
    stage: "retry_translation",
    source: normalizedMetadata.sourceUrl || normalizedMetadata.pageUrl || "subtitle-cache",
    sourceUrl: normalizedMetadata.sourceUrl || "",
    metadata: normalizedMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    extract: {
      status: "completed",
      progress: 100,
      phase: "completed",
      message: "使用本地字幕缓存原文",
      chunkCount: 0,
      availableSeconds: Math.round(Number(normalizedMetadata.duration || 0) || 0),
      duration: normalizedMetadata.duration || null,
      chunkSeconds: modelConfig.chunkSeconds,
      asrChunkSeconds: 0,
      bitrate: "",
      elapsedSeconds: 0
    },
    translation: {
      status: "running",
      targetLanguage: modelConfig.targetLanguage,
      chunkCount: 1,
      chunksTotal: 1,
      chunksDone: 0,
      chunksFailed: 0,
      chunksAsr: 0,
      chunksTranslating: 0,
      chunkStatuses: [createChunkStatus(0, "queued")],
      segmentCount: 0,
      sourceSegments: sourceSegments.length,
      translatedSegments: 0,
      asrWorkers: 0,
      translationWorkers: modelConfig.workers,
      workers: modelConfig.workers
    }
  };
  const record = {
    tabId,
    candidate: { url: normalizedMetadata.sourceUrl || normalizedMetadata.pageUrl || "", title: normalizedMetadata.title || "" },
    metadata: normalizedMetadata,
    modelConfig,
    job,
    startedAt: Date.now(),
    cancelled: false,
    sourceSegmentsByChunk: new Map([[0, sourceSegments]]),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [],
    pipeline: "cached-transcript"
  };
  browserPreloadJobs.set(jobId, record);
  publishBrowserPreloadJob(record);
  return retryBrowserTranslationOnly(record, [0], { failedOnly: false });
}

function transcriptSourceSegmentsForTranslation(transcript) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  return normalizeBrowserSourceSegmentsForTranslation(source, 0);
}

async function refreshBrowserTranslationModelConfig(record, options = {}) {
  const current = await getModelConfig();
  const targetLanguage = options.targetLanguage
    ? normalizeTargetLanguage(options.targetLanguage, current.targetLanguage)
    : current.targetLanguage;
  const shouldRefreshAsrLanguage = options.refreshAsrLanguage || Object.hasOwn(options, "sourceLanguage");
  record.modelConfig = {
    ...record.modelConfig,
    translation: current.translation,
    targetLanguage,
    workers: current.workers
  };
  if (shouldRefreshAsrLanguage) {
    record.modelConfig.asr = withCurrentAsrSourceLanguage(
      record.modelConfig.asr,
      Object.hasOwn(options, "sourceLanguage") ? options.sourceLanguage : current.asr?.language
    );
  }
  if (record.job?.translation) {
    record.job.translation.translationWorkers = current.workers;
    record.job.translation.workers = current.workers;
    record.job.translation.targetLanguage = targetLanguage;
  }
  return record.modelConfig;
}

function withCurrentAsrSourceLanguage(asrConfig, sourceLanguage) {
  const next = { ...(asrConfig || {}) };
  const normalized = normalizeAsrLanguage(sourceLanguage || "");
  delete next.sourceLanguage;
  if (normalized) {
    next.language = normalized;
  } else {
    delete next.language;
  }
  return next;
}

async function retryBrowserFailedPreload(record, chunkIndexes = []) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number) : []);
  const retryIndexes = collectBrowserRetryIndexes(record, requested);
  if (!retryIndexes.length) {
    throw new Error("当前任务没有可继续处理的识别分段。");
  }
  const sourceRetryIndexes = retryIndexes.filter(index => {
    const status = statuses[index] || {};
    return reusableBrowserSourceSegments(record, index).length && chunkStatusAsrFailureCount(status) <= 0;
  });
  const asrRetryIndexes = retryIndexes.filter(index => !sourceRetryIndexes.includes(index));
  const asrRetryHasAudio = asrRetryIndexes.every(index => browserAudioChunksForTranslationGroup(record, index).length);
  if (asrRetryIndexes.length && !asrRetryHasAudio) {
    throw new Error("浏览器内任务没有保留可继续识别的音频分段，请重新开始任务。");
  }
  record.job.status = "running";
  record.job.stage = "retrying";
  publishBrowserPreloadJob(record);
  if (sourceRetryIndexes.length) {
    await runPool(sourceRetryIndexes, Math.max(record.modelConfig.workers || 1, 1), async index => {
      await translateBrowserChunkFromSource(record, index, reusableBrowserSourceSegments(record, index), "重翻译，不重新识别", {
        replaceExisting: true
      });
    });
  }
  await runPool(asrRetryIndexes, Math.max(record.modelConfig.asrWorkers, 1), async index => {
    await retryBrowserAsrGroup(record, index);
  });
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
  return { preload: record.job.status, job: record.job };
}

async function retryBrowserFunAsrFailedPreload(record, chunkIndexes = []) {
  const { translationIndexes, asrIndexes } = browserFunAsrRetryPlan(record, chunkIndexes);
  if (!translationIndexes.length && !asrIndexes.length) {
    throw new Error("当前 Fun-ASR 任务没有可继续处理的识别分段。");
  }
  const chunksByIndex = new Map((record.audioChunks || []).map(chunk => [Number(chunk.index), chunk]));
  const chunks = asrIndexes.map(index => chunksByIndex.get(index)).filter(Boolean);
  if (asrIndexes.length && !chunks.length) {
    throw new Error("Fun-ASR 任务没有保留可继续识别的音频分段，请重新开始任务。");
  }
  record.job.status = "running";
  record.job.stage = asrIndexes.length ? "retrying" : "retry_translation";
  publishBrowserPreloadJob(record);
  if (translationIndexes.length) {
    await runPool(translationIndexes, Math.max(record.modelConfig.workers || 1, 1), async index => {
      await translateBrowserChunkFromSource(record, index, reusableBrowserSourceSegments(record, index), "只重翻译，不重新识别", {
        replaceExisting: true
      });
    });
  }
  const labelSpeakers = dashScopeFunAsrShouldDiarize({
    chunksTotal: record.audioChunks.length,
    duration: pickFinite(record.job.extract?.duration, record.metadata?.duration)
  });
  if (chunks.length) {
    await runPool(chunks, browserFunAsrConcurrency(record), async chunk => {
      await processBrowserFunAsrChunk(record, chunk, { labelSpeakers });
    });
  }
  publishBrowserSubtitle(record);
  finalizeBrowserCompletionState(record);
  return { preload: record.job.status, job: record.job };
}

function browserFunAsrRetryPlan(record, chunkIndexes = []) {
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number).filter(Number.isFinite) : []);
  const statuses = record.job.translation?.chunkStatuses || [];
  const requestedMatches = index => !requested.size || requested.has(Number(index));
  const failedStatuses = statuses
    .filter(status => status?.stage === "failed" && requestedMatches(status.index));
  let indexes = failedStatuses
    .map(status => Number(status.index))
    .filter(Number.isFinite);
  if (!indexes.length) {
    const sourceIndexes = [...(record.sourceSegmentsByChunk?.keys?.() || [])]
      .map(Number)
      .filter(index => Number.isFinite(index) && requestedMatches(index))
      .filter(index => {
        const status = statuses[index] || {};
        const translated = record.translatedSegmentsByChunk?.get?.(index);
        return status.stage !== "completed" || browserTranslationFailures(translated).length > 0 || !Array.isArray(translated);
      });
    indexes = sourceIndexes.length
      ? sourceIndexes
      : (record.audioChunks || [])
          .map(chunk => Number(chunk.index))
          .filter(index => Number.isFinite(index) && requestedMatches(index));
  }
  const uniqueIndexes = [...new Set(indexes)].sort((left, right) => left - right);
  const translationIndexes = [];
  const asrIndexes = [];
  for (const index of uniqueIndexes) {
    const status = statuses[index] || {};
    if (reusableBrowserSourceSegments(record, index).length && chunkStatusAsrFailureCount(status) <= 0) {
      translationIndexes.push(index);
    } else {
      asrIndexes.push(index);
    }
  }
  return { translationIndexes, asrIndexes };
}

function collectBrowserRetryIndexes(record, requested) {
  const requestedIndexes = requested instanceof Set ? requested : new Set();
  const statuses = record.job.translation?.chunkStatuses || [];
  const failedIndexes = statuses
    .filter(status => status?.stage === "failed" && (!requestedIndexes.size || requestedIndexes.has(Number(status.index))))
    .map(status => Number(status.index))
    .filter(Number.isFinite);
  if (failedIndexes.length) {
    return [...new Set(failedIndexes)].sort((left, right) => left - right);
  }
  const sourceIndexes = [...(record.sourceSegmentsByChunk?.keys?.() || [])]
    .map(Number)
    .filter(Number.isFinite);
  const audioIndexes = (record.audioChunks || [])
    .map(chunk => browserTranslationGroupIndex(record, chunk))
    .filter(Number.isFinite);
  const indexes = [...new Set([...sourceIndexes, ...audioIndexes])]
    .filter(index => !requestedIndexes.size || requestedIndexes.has(index))
    .filter(index => {
      const status = statuses[index];
      if (!status) {
        return true;
      }
      if (status.stage === "completed" && reusableBrowserSourceSegments(record, index).length && chunkStatusAsrFailureCount(status) <= 0) {
        return false;
      }
      return status.stage !== "completed";
    })
    .sort((left, right) => left - right);
  return indexes;
}

function browserAudioChunksForTranslationGroup(record, groupIndex) {
  const target = Number(groupIndex);
  if (!Number.isFinite(target)) {
    return [];
  }
  ensureBrowserChunkPipelineState(record);
  return (record.audioChunks || [])
    .filter(chunk => {
      const mapped = record.browserAsrChunkToTranslationGroup?.get?.(chunk.index);
      if (Number.isFinite(Number(mapped))) {
        return Number(mapped) === target;
      }
      return browserTranslationGroupIndex(record, chunk) === target;
    })
    .sort((left, right) => left.start - right.start || left.index - right.index);
}

async function retryBrowserAsrGroup(record, groupIndex) {
  const index = Number(groupIndex);
  const chunks = browserAudioChunksForTranslationGroup(record, index);
  if (!chunks.length) {
    throw new Error(`第 ${index + 1} 个识别分段没有可复用的音频分段。`);
  }
  const current = record.job.translation?.chunkStatuses?.[index] || {};
  const attempt = (current.attempts || 0) + 1;
  const sourceSegments = [];
  const errors = [];
  let empty = 0;
  updateChunkStatus(record, index, {
    stage: "asr",
    status: "识别",
    attempts: attempt,
    sourceCount: 0,
    translatedCount: 0,
    error: "",
    message: `第 ${attempt} 次尝试 · 重新识别字幕分组`
  });
  await runPool(chunks, Math.max(record.modelConfig.asrWorkers || 1, 1), async chunk => {
    updateChunkStatus(record, index, {
      stage: "asr",
      status: "识别",
      attempts: attempt,
      sourceCount: sourceSegments.length,
      error: "",
      message: `第 ${attempt} 次尝试 · 识别 ${browserAsrChunkTimeRangeText(chunk)}`
    });
    try {
      const chunkSegments = await transcribeBrowserAudioChunk(chunk, record.modelConfig.asr, {
        onDiagnostics: diagnostics => recordBrowserAsrChunkDiagnostics(record, chunk, diagnostics)
      });
      if (chunkSegments.length) {
        sourceSegments.push(...chunkSegments);
      } else {
        empty += 1;
      }
    } catch (error) {
      errors.push(error.message || String(error));
    }
  });
  const normalizedSource = normalizeBrowserSourceSegmentsForTranslation(sourceSegments, index);
  record.sourceSegmentsByChunk.set(index, normalizedSource);
  if (errors.length && !normalizedSource.length) {
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      attempts: attempt,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: errors.length,
      asrErrors: errors.slice(0, 5),
      error: `第 ${index + 1} 个识别分段连续 ${attempt} 次失败：${errors[0]}`
    });
    publishBrowserSubtitle(record);
    return;
  }
  if (!normalizedSource.length) {
    record.translatedSegmentsByChunk.set(index, []);
    updateChunkStatus(record, index, {
      stage: "completed",
      status: "完成",
      attempts: attempt,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      message: empty ? `无语音 · 跳过 ${empty} 个音频分段` : "无语音"
    });
    publishBrowserSubtitle(record);
    return;
  }
  const suffix = errors.length
    ? `重试识别后翻译，${errors.length} 个音频分段失败，先用可用原文`
    : "重试识别后翻译";
  updateChunkStatus(record, index, {
    asrFailures: errors.length,
    asrErrors: errors.slice(0, 5),
    error: errors.length ? `有 ${errors.length} 个识别音频分段失败，先翻译可用原文。` : ""
  });
  await translateBrowserChunkFromSource(record, index, normalizedSource, suffix, { replaceExisting: true });
}

async function retryBrowserTranslationOnly(record, chunkIndexes = [], options = {}) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number) : []);
  let indexes = [...record.sourceSegmentsByChunk.keys()]
    .map(Number)
    .filter(index => Number.isFinite(index) && reusableBrowserSourceSegments(record, index).length);
  if (options.failedOnly) {
    const failed = new Set(
      statuses
        .filter(status => status?.stage === "failed")
        .map(status => Number(status.index))
        .filter(Number.isFinite)
    );
    indexes = indexes.filter(index => failed.has(index));
  }
  if (requested.size) {
    indexes = indexes.filter(index => requested.has(index));
  }
  indexes = [...new Set(indexes)].sort((left, right) => left - right);
  if (!indexes.length) {
    throw new Error("没有可复用的 ASR 原文，不能只重翻译字幕。");
  }
  record.job.status = "running";
  record.job.stage = "retry_translation";
  record.job.subtitleCleared = false;
  const fallbackTranslationsByIndex = new Map(
    indexes.map(index => [index, cloneBrowserSegments(record.translatedSegmentsByChunk?.get(index))])
  );
  if (options.resetAttempts) {
    resetBrowserTranslationResults(record, indexes);
    publishBrowserSubtitle(record);
  }
  publishBrowserPreloadJob(record);
  await runPool(indexes, Math.max(record.modelConfig.workers || 1, 1), async index => {
    await translateBrowserChunkFromSource(record, index, reusableBrowserSourceSegments(record, index), "只重翻译，不重新识别", {
      replaceExisting: true,
      fallbackSegments: fallbackTranslationsByIndex.get(index) || []
    });
  });
  publishBrowserSubtitle(record);
  finalizeBrowserCompletionState(record);
  return { preload: record.job.status, job: record.job };
}

function resetBrowserTranslationResults(record, indexes = []) {
  for (const index of indexes) {
    const sourceSegments = reusableBrowserSourceSegments(record, index);
    record.translatedSegmentsByChunk?.set(index, []);
    updateChunkStatus(record, index, {
      stage: "queued",
      status: "排队",
      attempts: 0,
      sourceCount: sourceSegments.length,
      translatedCount: 0,
      translationFailures: 0,
      error: "",
      message: "等待重新翻译"
    });
  }
}

function reusableBrowserSourceSegments(record, index) {
  const segments = record?.sourceSegmentsByChunk?.get(Number(index));
  return Array.isArray(segments) ? segments : [];
}

function cloneBrowserSegments(segments) {
  return Array.isArray(segments) ? segments.map(segment => ({ ...segment })) : [];
}

async function translateBrowserChunkFromSource(record, index, sourceSegments, message, options = {}) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const current = statuses[index] || {};
  const asrFailures = chunkStatusAsrFailureCount(current);
  const asrErrors = Array.isArray(current.asrErrors) ? current.asrErrors : [];
  const attempt = (current.attempts || 0) + 1;
  const replaceExisting = Boolean(options.replaceExisting);
  const fallbackSegments = cloneBrowserSegments(options.fallbackSegments);
  if (replaceExisting) {
    record.translatedSegmentsByChunk.set(index, []);
  }
  updateChunkStatus(record, index, {
    stage: "translation",
    status: "翻译",
    attempts: attempt,
    sourceCount: sourceSegments.length,
    targetLanguage: record.modelConfig.targetLanguage,
    error: "",
    message: `第 ${attempt} 次尝试 · ${message}`
  });
  let translatedSegments;
  try {
    translatedSegments = await translateBrowserSegments(
      sourceSegments,
      record.modelConfig.translation,
      record.modelConfig.targetLanguage,
      record.metadata,
      {
        batchWorkers: browserTranslationBatchWorkers(record),
        splitWorkers: browserTranslationSplitWorkers(record),
        onProgress(progress) {
          updateChunkStatus(record, index, {
            stage: "translation",
            status: "翻译",
            attempts: attempt,
            sourceCount: sourceSegments.length,
            message: `第 ${attempt} 次尝试 · ${message} · 第 ${progress.batchIndex}/${progress.batchTotal} 批`
          });
        }
      }
    );
  } catch (error) {
    const previous = fallbackSegments.length
      ? fallbackSegments
      : replaceExisting
        ? []
        : cloneBrowserSegments(record.translatedSegmentsByChunk.get(index));
    if (Array.isArray(previous) && previous.length) {
      translatedSegments = previous;
      record.translatedSegmentsByChunk.set(index, translatedSegments);
    } else {
      translatedSegments = [];
      record.translatedSegmentsByChunk.set(index, translatedSegments);
    }
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      sourceCount: sourceSegments.length,
      translatedCount: translatedSegments.length,
      error: translatedSegments.length
        ? `重翻译失败，已保留已有译文：${error.message || String(error)}`
        : `重翻译失败，未生成译文，已保留原文供重试：${error.message || String(error)}`
    });
    publishBrowserSubtitle(record);
    return;
  }
  record.translatedSegmentsByChunk.set(index, translatedSegments);
  const translationFailures = browserTranslationFailures(translatedSegments);
  const warningMessage = browserCompletedChunkWarningMessage(translationFailures, asrFailures);
  updateChunkStatus(record, index, {
    stage: warningMessage ? "completed_with_warnings" : "completed",
    status: warningMessage ? "部分完成" : "完成",
    sourceCount: sourceSegments.length,
    translatedCount: translatedSegments.length,
    targetLanguage: record.modelConfig.targetLanguage,
    translationFailures: translationFailures.length,
    asrFailures,
    asrErrors,
    error: warningMessage,
    message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
  });
  publishBrowserSubtitle(record);
}

function countFailedChunks(job) {
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || [];
  if (!Array.isArray(statuses)) {
    return 0;
  }
  return statuses.filter(status => status?.stage === "failed" || chunkStatusAsrFailureCount(status) > 0).length;
}

async function cancelPreload(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id;
  if (!targetJobId) {
    throw new Error("没有正在运行的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(targetJobId);
  if (browserRecord) {
    browserRecord.cancelled = true;
    browserRecord.job.status = "cancelled";
    browserRecord.job.stage = "cancelled";
    browserRecord.job.error = "任务已停止。";
    await releaseBrowserAudioChunks(browserRecord);
    await detachPreloadVtt(tabId);
    publishBrowserPreloadJob(browserRecord);
    return { job: browserRecord.job };
  }
  await detachPreloadVtt(tabId);
  const job = {
    ...(state.preloadJob || {}),
    id: targetJobId,
    status: "cancelled",
    stage: "cancelled",
    error: "任务已停止。"
  };
  setTabStatus(tabId, { preload: "cancelled", preloadJob: job, error: "", attachedVttSignature: "" });
  return { job };
}

function scheduleBrowserAudioCacheMaintenance() {
  try {
    chrome.alarms?.onAlarm?.addListener?.(alarm => {
      if (alarm?.name === WEB_FFMPEG_AUDIO_CACHE_CLEANUP_ALARM) {
        requestBrowserAudioCacheMaintenance({ force: true }).catch(() => {});
      }
    });
    const created = chrome.alarms?.create?.(WEB_FFMPEG_AUDIO_CACHE_CLEANUP_ALARM, {
      delayInMinutes: WEB_FFMPEG_AUDIO_CACHE_CLEANUP_INTERVAL_MINUTES,
      periodInMinutes: WEB_FFMPEG_AUDIO_CACHE_CLEANUP_INTERVAL_MINUTES
    });
    created?.catch?.(() => {});
  } catch {
    // Cache cleanup is opportunistic; manual clearing must keep working even if alarms are unavailable.
  }
}

function requestBrowserAudioCacheMaintenance(options = {}) {
  const now = Date.now();
  if (!options.force && now - browserAudioCacheLastCleanupAt < WEB_FFMPEG_AUDIO_CACHE_MIN_CLEANUP_INTERVAL_MS) {
    return browserAudioCacheCleanupPromise || Promise.resolve(null);
  }
  browserAudioCacheLastCleanupAt = now;
  if (!browserAudioCacheCleanupPromise) {
    browserAudioCacheCleanupPromise = pruneBrowserAudioCache().finally(() => {
      browserAudioCacheCleanupPromise = null;
    });
  }
  return browserAudioCacheCleanupPromise;
}

async function pruneBrowserAudioCache(options = {}) {
  const maxAgeMs = Number(options.maxAgeMs ?? WEB_FFMPEG_AUDIO_CACHE_MAX_AGE_MS);
  const maxBytes = Number(options.maxBytes ?? WEB_FFMPEG_AUDIO_CACHE_MAX_BYTES);
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const protectedJobIds = [...browserPreloadJobs.values()]
    .filter(record => record && !record.cancelled && browserJobIsRunning(record.job))
    .map(record => record.job?.id)
    .filter(Boolean);
  const keys = await cache.keys().catch(() => []);
  const entries = [];
  const now = Date.now();
  for (const key of keys) {
    const url = typeof key === "string" ? key : key?.url;
    if (!isBrowserAudioCacheUrl(url)) {
      continue;
    }
    if (protectedJobIds.some(jobId => isBrowserAudioCacheUrlForJob(url, jobId))) {
      continue;
    }
    const response = await cache.match(url).catch(() => null);
    const info = await browserAudioCacheEntryInfo(url, response);
    entries.push({ key, url, ...info });
  }
  const toDelete = new Set();
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    for (const entry of entries) {
      if (entry.cachedAt && now - entry.cachedAt > maxAgeMs) {
        toDelete.add(entry);
      }
    }
  }
  const keptByAge = entries.filter(entry => !toDelete.has(entry));
  let totalBytes = keptByAge.reduce((sum, entry) => sum + Math.max(0, Number(entry.bytes || 0) || 0), 0);
  if (Number.isFinite(maxBytes) && maxBytes > 0 && totalBytes > maxBytes) {
    const oldestFirst = [...keptByAge].sort((left, right) => (
      (left.cachedAt || 0) - (right.cachedAt || 0) || String(left.url).localeCompare(String(right.url))
    ));
    for (const entry of oldestFirst) {
      if (totalBytes <= maxBytes) {
        break;
      }
      toDelete.add(entry);
      totalBytes -= Math.max(0, Number(entry.bytes || 0) || 0);
    }
  }
  let removed = 0;
  let removedBytes = 0;
  for (const entry of toDelete) {
    if (await cache.delete(entry.url)) {
      removed += 1;
      removedBytes += Math.max(0, Number(entry.bytes || 0) || 0);
    }
  }
  return { removed, removedBytes, scanned: entries.length };
}

function browserJobIsRunning(job) {
  return Boolean(job && !["done", "completed", "error", "failed", "cancelled"].includes(String(job.status || "")));
}

async function browserAudioCacheEntryInfo(url, response) {
  const cachedAt = browserAudioCacheEntryTime(url, response);
  let bytes = Number(browserAudioCacheResponseHeader(response, "x-fuguang-bytes"));
  if (!Number.isFinite(bytes) || bytes < 0) {
    bytes = await browserAudioCacheResponseBytes(response);
  }
  return { cachedAt, bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : 0 };
}

function browserAudioCacheEntryTime(url, response) {
  const fromHeader = Number(browserAudioCacheResponseHeader(response, "x-fuguang-cached-at"));
  if (Number.isFinite(fromHeader) && fromHeader > 0) {
    return fromHeader;
  }
  try {
    const parsed = new URL(String(url || ""));
    const filename = parsed.pathname.split("/").filter(Boolean).at(-1) || "";
    const match = filename.match(/^(\d{12,})-/);
    const timestamp = Number(match?.[1]);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  } catch {
    return 0;
  }
}

function browserAudioCacheResponseHeader(response, name) {
  const headers = response?.headers;
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || "";
  }
  const target = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return String(value || "");
    }
  }
  return "";
}

async function browserAudioCacheResponseBytes(response) {
  if (!response || typeof response.arrayBuffer !== "function") {
    return 0;
  }
  try {
    const copy = typeof response.clone === "function" ? response.clone() : response;
    return (await copy.arrayBuffer()).byteLength;
  } catch {
    return 0;
  }
}

async function clearPreloadAudioCache(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id;
  if (!targetJobId) {
    throw new Error("没有可清理音频缓存的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(targetJobId);
  if (browserRecord) {
    const removed = await clearBrowserAudioCacheForJob(targetJobId, [
      ...(browserRecord.audioChunks || []),
      ...(browserRecord.browserInternalAudioChunks || []),
      ...(browserRecord.browserPendingLogicalChunk?.parts || [])
    ]);
    browserRecord.audioChunks = [];
    browserRecord.browserInternalAudioChunks = [];
    browserRecord.browserPendingLogicalChunk = null;
    browserRecord.job.audioCacheRemoved = true;
    browserRecord.job.audioCacheRemovedCount = removed;
    publishBrowserPreloadJob(browserRecord);
    return {
      job: browserRecord.job,
      removed: removed > 0,
      message: removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  if (String(targetJobId).startsWith("browser-")) {
    const removed = await clearBrowserAudioCacheForJob(targetJobId, []);
    const job = {
      ...(state.preloadJob || {}),
      id: targetJobId,
      audioCacheRemoved: true,
      audioCacheRemovedCount: removed
    };
    setTabStatus(tabId, { preloadJob: job, error: "" });
    return {
      job,
      removed: removed > 0,
      message: removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  throw new Error("这个任务不是当前浏览器内预加载任务，不能清理浏览器音频缓存。请重新抽取。");
}

async function clearBrowserAudioCacheForJob(jobId, chunks = []) {
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const cacheUrls = collectBrowserAudioCacheUrls(chunks);
  const keys = await cache.keys().catch(() => []);
  for (const key of keys) {
    const url = typeof key === "string" ? key : key?.url;
    if (isBrowserAudioCacheUrlForJob(url, jobId)) {
      cacheUrls.add(url);
    }
  }
  let removed = 0;
  for (const cacheUrl of cacheUrls) {
    if (await cache.delete(cacheUrl)) {
      removed += 1;
    }
  }
  return removed;
}

async function releaseBrowserAudioChunks(record) {
  const removed = await clearBrowserAudioCacheForJob(record?.job?.id || "", [
    ...(record.audioChunks || []),
    ...(record.browserInternalAudioChunks || []),
    ...(record.browserPendingLogicalChunk?.parts || [])
  ]);
  if (removed) {
    record.audioChunks = [];
    record.browserInternalAudioChunks = [];
    record.browserPendingLogicalChunk = null;
    record.job.audioCacheRemoved = true;
    record.job.audioCacheRemovedCount = removed;
    publishBrowserPreloadJob(record);
  }
  return removed;
}

function collectBrowserAudioCacheUrls(chunks = []) {
  const cacheUrls = new Set();
  const collectCacheUrls = file => {
    if (file?.cacheUrl) {
      cacheUrls.add(file.cacheUrl);
    }
    if (Array.isArray(file?.parts)) {
      for (const part of file.parts) {
        collectCacheUrls(part?.file || part);
      }
    }
  };
  for (const chunk of chunks || []) {
    collectCacheUrls(chunk?.file || chunk);
  }
  return cacheUrls;
}

function isBrowserAudioCacheUrlForJob(rawUrl, jobId) {
  if (!rawUrl || !jobId) {
    return false;
  }
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return false;
  }
  if (url.origin !== WEB_FFMPEG_AUDIO_CACHE_ORIGIN) {
    return false;
  }
  const safeJobId = safeAudioCachePathPart(jobId);
  const basePath = `${WEB_FFMPEG_AUDIO_CACHE_PREFIX}/${safeJobId}`;
  if (!url.pathname.startsWith(basePath)) {
    return false;
  }
  const suffix = url.pathname.slice(basePath.length);
  return (
    suffix === "" ||
    suffix.startsWith("/") ||
    /^-(?:\d+|logical(?:-|\/|$))/.test(suffix)
  );
}

function isBrowserAudioCacheUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }
  try {
    const url = new URL(String(rawUrl));
    return url.origin === WEB_FFMPEG_AUDIO_CACHE_ORIGIN
      && url.pathname.startsWith(`${WEB_FFMPEG_AUDIO_CACHE_PREFIX}/`);
  } catch {
    return false;
  }
}

function safeAudioCachePathPart(value) {
  return String(value || "item")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

async function detachPreloadVtt(tabId) {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  state.subtitleFrameId = null;
  await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }).catch(() => {});
}

async function clearPreloadSubtitleState(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id || "";
  suppressPreloadSubtitleAttachment(tabId, targetJobId);
  const browserRecord = targetJobId ? browserPreloadJobs.get(targetJobId) : null;
  if (browserRecord) {
    clearBrowserSubtitleStateForJob(browserRecord);
  } else if (targetJobId && state.preloadJob?.id === targetJobId) {
    state.preloadJob = clearPreloadJobSubtitlePayload(state.preloadJob);
  }
  await detachPreloadVtt(tabId);
  return { cleared: Boolean(targetJobId) };
}

function clearBrowserSubtitleStateForJob(record) {
  if (!record?.job?.translation) {
    return;
  }
  record.translatedSegmentsByChunk = new Map();
  record.job = clearPreloadJobSubtitlePayload(record.job, collectChunkSegments(record.sourceSegmentsByChunk || new Map()));
  publishBrowserPreloadJob(record);
}

function clearPreloadJobSubtitlePayload(job, sourceSegments = null) {
  const translation = job?.translation || {};
  const source = Array.isArray(sourceSegments)
    ? sourceSegments
    : Array.isArray(translation.transcript?.source)
      ? translation.transcript.source
      : [];
  return {
    ...job,
    subtitleCleared: true,
    reusableSourceChunks: job?.reusableSourceChunks || translation.reusableSourceChunks || (source.length ? 1 : 0),
    translation: {
      ...translation,
      vttPath: "",
      vttText: "",
      transcript: { source, translated: [], metadata: translation.transcript?.metadata || job?.metadata || {} },
      segmentCount: 0,
      sourceSegments: source.length,
      translatedSegments: 0,
      reusableSourceChunks: translation.reusableSourceChunks || job?.reusableSourceChunks || (source.length ? 1 : 0)
    }
  };
}

function suppressPreloadSubtitleAttachment(tabId, jobId) {
  if (!tabId || !jobId) {
    return;
  }
  const state = getState(tabId);
  if (!state.suppressedSubtitleJobIds) {
    state.suppressedSubtitleJobIds = new Set();
  }
  state.suppressedSubtitleJobIds.add(String(jobId));
  state.attachedVttSignature = "";
}

function clearPreloadSubtitleSuppression(tabId, jobId = "") {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  if (!state.suppressedSubtitleJobIds) {
    return;
  }
  if (jobId) {
    state.suppressedSubtitleJobIds.delete(String(jobId));
  } else {
    state.suppressedSubtitleJobIds.clear();
  }
}

function isPreloadSubtitleAttachmentSuppressed(tabId, jobId) {
  if (!tabId || !jobId) {
    return false;
  }
  return Boolean(getState(tabId).suppressedSubtitleJobIds?.has(String(jobId)));
}

function withSubtitleSuppression(job, tabId) {
  if (!job?.id || !isPreloadSubtitleAttachmentSuppressed(tabId, job.id)) {
    return job;
  }
  return {
    ...job,
    subtitleCleared: true
  };
}

async function checkPreloadJob(jobId, tabId) {
  if (!jobId) {
    throw new Error("没有可查询的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    if (tabId) {
      await refreshTabInfo(tabId);
      if (!browserPreloadRecordMatchesPageUrl(browserRecord, getState(tabId).page?.url || getState(tabId).context?.href || "")) {
        return { job: null, missing: true, pageMismatch: true };
      }
      setTabStatus(tabId, { preload: browserRecord.job.status || "running", preloadJob: browserRecord.job || null });
      if (browserRecord.job.translation?.vttText) {
        await attachBrowserJobVttIfReady(browserRecord);
      }
    }
    return { job: withSubtitleSuppression(browserRecord.job, tabId) };
  }
  if (tabId) {
    setTabStatus(tabId, {
      preload: "idle",
      preloadJob: null,
      attachedVttSignature: "",
      error: "这个浏览器内任务状态已失效。请重新提交任务。"
    });
  }
  return { job: null, missing: true };
}

async function getPreloadVtt(jobId) {
  if (!jobId) {
    throw new Error("没有可读取的字幕任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return { vtt: browserRecord.job.translation?.vttText || "" };
  }
  throw new Error("这个任务的字幕不在当前浏览器内任务中。请使用本地字幕缓存或重新生成。");
}

async function attachVttText(tabId, vtt) {
  if (!tabId || !vtt) {
    throw new Error("没有可挂载的字幕。");
  }
  const state = getState(tabId);
  const signature = `manual:${vttContentSignature(vtt)}`;
  if (
    state.attachedVttSignature === signature
    && state.manualVttSignature === signature
    && await hasAttachedSubtitleSignature(tabId, signature)
  ) {
    return { attached: true };
  }
  await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }).catch(() => {});
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  state.subtitleFrameId = null;
  await ensureSubtitleOverlay(tabId);
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt,
    label: "流声字幕",
    signature
  });
  if (!response?.ok) {
    throw new Error("当前页面没有可挂载字幕的播放器。");
  }
  state.attachedVttSignature = signature;
  state.manualVttSignature = signature;
  return { attached: true };
}

function hasManualVttAttachment(tabId) {
  const state = getState(tabId);
  return Boolean(state.manualVttSignature);
}

function vttContentSignature(vtt) {
  const text = String(vtt || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

async function getSubtitleDisplayMode() {
  const stored = await chrome.storage.sync.get({ subtitleDisplayMode: "translated" }).catch(() => ({}));
  return ["translated", "source", "bilingual"].includes(stored.subtitleDisplayMode)
    ? stored.subtitleDisplayMode
    : "translated";
}

async function isSubtitleOverlayEnabled() {
  const stored = await chrome.storage.sync.get({ subtitleOverlayEnabled: true }).catch(() => ({}));
  return stored.subtitleOverlayEnabled !== false;
}

function transcriptToTranslatedVtt(transcript, options = {}) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  if (source.length && options.allowSourcePreview !== false) {
    return segmentsToVtt(mergeTranslatedDisplaySegments(source, translated));
  }
  if (translated.length) {
    return segmentsToVtt(translated);
  }
  return "";
}

function transcriptToSourceVtt(transcript) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  return source.length ? segmentsToVtt(source) : "";
}

function transcriptToBilingualVtt(transcript, options = {}) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  const blocks = ["WEBVTT", ""];
  for (const { sourceSegment, translatedSegment } of mergeTranscriptSegmentsForBilingualVtt(source, translated)) {
    const start = firstFiniteNumber(translatedSegment.start, sourceSegment.start);
    const end = firstFiniteNumber(translatedSegment.end, sourceSegment.end);
    const translatedText = cleanVttText(translatedSegment.text);
    const sourceText = cleanVttText(sourceSegment.text);
    const displayText = translatedText || sourceText;
    if (!translatedText && options.allowSourcePreview === false) {
      continue;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || !displayText) {
      continue;
    }
    const lines = [];
    if (translatedText && sourceText && sourceText !== translatedText) {
      lines.push(sourceText);
    }
    lines.push(displayText);
    blocks.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    blocks.push(lines.join("\n"));
    blocks.push("");
  }
  return blocks.length > 2 ? blocks.join("\n") : "";
}

function mergeTranscriptSegmentsForBilingualVtt(source, translated) {
  const sourceSegments = Array.isArray(source) ? source : [];
  const translatedSegments = Array.isArray(translated) ? translated : [];
  const useIdentity = sourceSegments.some(segment => segmentIdentityKey(segment))
    || translatedSegments.some(segment => segmentIdentityKey(segment));
  if (!useIdentity) {
    const total = Math.max(sourceSegments.length, translatedSegments.length);
    return Array.from({ length: total }, (_, index) => ({
      sourceSegment: sourceSegments[index] || {},
      translatedSegment: translatedSegments[index] || {}
    }));
  }
  const translatedByKey = new Map();
  translatedSegments.forEach(segment => {
    const key = segmentIdentityKey(segment);
    if (key) {
      translatedByKey.set(key, segment);
    }
  });
  const usedKeys = new Set();
  const merged = sourceSegments.map(sourceSegment => {
    const key = segmentIdentityKey(sourceSegment);
    const translatedSegment = key ? translatedByKey.get(key) : null;
    if (key && translatedSegment) {
      usedKeys.add(key);
    }
    return { sourceSegment, translatedSegment: translatedSegment || {} };
  });
  translatedSegments.forEach(translatedSegment => {
    const key = segmentIdentityKey(translatedSegment);
    if (key && usedKeys.has(key)) {
      return;
    }
    merged.push({ sourceSegment: {}, translatedSegment });
  });
  return merged.sort((left, right) => {
    const leftStart = firstFiniteNumber(left.translatedSegment.start, left.sourceSegment.start);
    const rightStart = firstFiniteNumber(right.translatedSegment.start, right.sourceSegment.start);
    return leftStart - rightStart;
  });
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return Number.NaN;
}

function cleanVttText(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatVttTimestamp(value) {
  const time = Math.max(0, Number(value) || 0);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

async function getPreloadTranscript(jobId) {
  if (!jobId) {
    throw new Error("没有可读取的字幕任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return { transcript: browserRecord.job.translation?.transcript || null };
  }
  throw new Error("这个任务的字幕明细不在当前浏览器内任务中。请使用本地字幕缓存或重新生成。");
}

async function getPreloadDiagnostics(jobId) {
  if (!jobId) {
    throw new Error("没有可读取的诊断任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    const diagnostics = buildPreloadDiagnostics(browserRecord);
    const audioExport = await buildPreloadDiagnosticAudioExport(browserRecord);
    diagnostics.audioExport = audioExport.manifest;
    return { diagnostics, audioFiles: audioExport.files };
  }
  throw new Error("这个任务的诊断信息不在当前浏览器内任务中。请重新生成。");
}

function buildPreloadDiagnostics(record = {}) {
  const sourceSegments = collectChunkSegments(record.sourceSegmentsByChunk || new Map());
  const translatedSegments = collectChunkSegments(record.translatedSegmentsByChunk || new Map());
  const diagnosticsByChunk = record.browserAsrDiagnosticsByChunk instanceof Map
    ? [...record.browserAsrDiagnosticsByChunk.entries()]
    : [];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    job: {
      id: record.job?.id || "",
      status: record.job?.status || "",
      stage: record.job?.stage || "",
      error: record.job?.error || "",
      extract: cloneJsonForDiagnostics(record.job?.extract || {}),
      translation: {
        status: record.job?.translation?.status || "",
        chunksTotal: Number(record.job?.translation?.chunksTotal || record.job?.translation?.chunkCount || 0) || 0,
        chunksDone: Number(record.job?.translation?.chunksDone || 0) || 0,
        chunksFailed: Number(record.job?.translation?.chunksFailed || record.job?.translation?.failed || 0) || 0,
        sourceSegments: sourceSegments.length,
        translatedSegments: translatedSegments.length,
        chunkStatuses: cloneJsonForDiagnostics(record.job?.translation?.chunkStatuses || [])
      }
    },
    metadata: {
      title: record.metadata?.title || record.candidate?.title || "",
      pageUrl: sanitizeDiagnosticUrl(record.metadata?.pageUrl || record.metadata?.url || ""),
      duration: finiteOrNull(record.metadata?.duration || record.candidate?.duration)
    },
    asrConfig: sanitizeDiagnosticAsrConfig(record.modelConfig?.asr || {}),
    audioChunks: (record.audioChunks || []).map(chunk => browserAsrDiagnosticChunkInfo(chunk)),
    asrChunks: diagnosticsByChunk
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, diagnostics]) => sanitizeAsrChunkDiagnostics(diagnostics)),
    transcript: {
      source: cloneJsonForDiagnostics(sourceSegments),
      translated: cloneJsonForDiagnostics(translatedSegments),
      vttText: record.job?.translation?.vttText || ""
    }
  };
}

async function buildPreloadDiagnosticAudioExport(record = {}) {
  const files = [];
  const audioFiles = [];
  const chunks = Array.isArray(record.audioChunks) ? record.audioChunks : [];
  for (const chunk of chunks) {
    const path = diagnosticAudioFilePath(chunk);
    const file = chunk?.file || {};
    const manifestEntry = {
      chunkIndex: Number.isInteger(Number(chunk?.index)) ? Number(chunk.index) : files.length,
      path,
      name: file.name || "",
      mime: file.mime || "",
      bytes: Number(chunk?.bytes || file.bytes || 0) || 0,
      included: false
    };
    try {
      const buffer = await getBrowserAudioChunkBuffer(file);
      manifestEntry.bytes = buffer.byteLength;
      manifestEntry.included = true;
      audioFiles.push({
        path,
        name: manifestEntry.name,
        mime: manifestEntry.mime || "audio/mpeg",
        bytes: buffer.byteLength,
        base64: arrayBufferToBase64(buffer)
      });
    } catch (error) {
      manifestEntry.error = error?.message || String(error || "音频缓存读取失败");
    }
    files.push(manifestEntry);
  }
  return {
    manifest: {
      format: "tar",
      files
    },
    files: audioFiles
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

function diagnosticAudioFilePath(chunk = {}) {
  const index = Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : 0;
  const fallback = `chunk-${String(index).padStart(4, "0")}.mp3`;
  const fileName = safeDiagnosticAudioFilename(chunk.file?.name || fallback);
  return `audio/chunk-${String(index).padStart(4, "0")}-${fileName}`;
}

function safeDiagnosticAudioFilename(value = "") {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || "audio.mp3";
}

function sanitizeDiagnosticAsrConfig(asrConfig = {}) {
  return {
    providerType: asrConfig.providerType || "",
    baseUrl: sanitizeDiagnosticUrl(asrConfig.baseUrl || ""),
    model: asrConfig.model || "",
    vadFilter: asrConfig.vadFilter || asrConfig.vad_filter || asrConfig.vadFilterMode || ""
  };
}

function sanitizeAsrChunkDiagnostics(diagnostics = {}) {
  const cloned = cloneJsonForDiagnostics(diagnostics) || {};
  if (cloned.request?.endpoint) {
    cloned.request.endpoint = sanitizeDiagnosticUrl(cloned.request.endpoint);
  }
  if (cloned.vad?.endpoint) {
    cloned.vad.endpoint = sanitizeDiagnosticUrl(cloned.vad.endpoint);
  }
  if (Array.isArray(cloned.request?.fields)) {
    cloned.request.fields = cloned.request.fields.filter(([name]) => String(name) !== "file");
  }
  delete cloned.apiKey;
  return cloned;
}

async function getVideoState(tabId) {
  if (!tabId) {
    return { state: null };
  }
  let response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.GET_VIDEO_STATE
  });
  if (!response?.state) {
    await ensureSubtitleOverlay(tabId);
    response = await sendMessageToMediaFrame(tabId, {
      type: MESSAGE.GET_VIDEO_STATE
    });
  }
  if (response?.state) {
    return { state: response.state };
  }
  const context = getState(tabId).context || {};
  if (Number.isFinite(Number(context.currentTime))) {
    return {
      state: {
        currentTime: Number(context.currentTime),
        duration: Number.isFinite(Number(context.duration)) ? Number(context.duration) : null,
        paused: null,
        playbackRate: null,
        currentSrc: "",
        synthetic: true
      }
    };
  }
  return { state: null };
}

async function hasAttachedSubtitleSignature(tabId, signature) {
  if (!tabId || !signature) {
    return false;
  }
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.GET_VIDEO_STATE
  });
  return response?.state?.subtitleSignature === signature;
}

async function seekMedia(tabId, time) {
  if (!tabId) {
    throw new Error("没有可跳转的当前标签页。");
  }
  await ensureSubtitleOverlay(tabId);
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.SEEK_MEDIA,
    time
  });
  if (!response?.ok) {
    throw new Error("当前页面没有可跳转的播放器。");
  }
  return { time };
}

async function sendMessageToMediaFrame(tabId, message) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  let lastResponse = null;
  for (const frameId of frameIds) {
    const response = await chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null);
    if (response?.ok || response?.state) {
      getState(tabId).mediaFrameId = frameId;
      if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
        getState(tabId).subtitleFrameId = frameId;
      }
      return response;
    }
    if (response) {
      lastResponse = response;
    }
  }
  const response = await chrome.tabs.sendMessage(tabId, message).catch(() => null);
  if (response?.ok || response?.state) {
    if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
      getState(tabId).subtitleFrameId = null;
    }
    return response;
  }
  return lastResponse || response;
}

async function getCandidateMediaFrameIds(tabId) {
  const state = getState(tabId);
  const frameIds = [];
  pushFrameId(frameIds, state.subtitleFrameId);
  pushFrameId(frameIds, state.mediaFrameId);
  pushFrameId(frameIds, state.context?.frameId);
  pushFrameId(frameIds, state.lastPreloadCandidate?.frameId);
  pushFrameId(frameIds, 0);
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
  for (const frame of frames) {
    pushFrameId(frameIds, frame.frameId);
  }
  return frameIds;
}

async function broadcastMessageToFrames(tabId, message) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  await Promise.all(frameIds.map(frameId => chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null)));
}

async function ensureSubtitleOverlay(tabId) {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  const now = Date.now();
  if (state.subtitleOverlayInjectedAt && now - state.subtitleOverlayInjectedAt < 3000 && await hasSubtitleOverlayInMediaFrame(tabId)) {
    return;
  }
  if (await hasSubtitleOverlayInMediaFrame(tabId)) {
    state.subtitleOverlayInjectedAt = now;
    return;
  }
  await injectPageScript(tabId, ["src/content/subtitle-overlay.js"], { allFrames: true }).catch(() => {});
  state.subtitleOverlayInjectedAt = now;
}

async function hasSubtitleOverlayInMediaFrame(tabId) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  let lastResponse = null;
  for (const frameId of frameIds) {
    const response = await chrome.tabs
      .sendMessage(tabId, { type: MESSAGE.GET_VIDEO_STATE }, { frameId })
      .catch(() => null);
    if (response?.ok && response.state) {
      getState(tabId).mediaFrameId = frameId;
      return true;
    }
    if (response) {
      lastResponse = response;
    }
  }
  const response = await chrome.tabs.sendMessage(tabId, { type: MESSAGE.GET_VIDEO_STATE }).catch(() => null);
  if (response?.ok && response.state) {
    return true;
  }
  return Boolean(lastResponse?.ok && lastResponse.state);
}

function pushFrameId(frameIds, value) {
  const frameId = Number(value);
  if (Number.isInteger(frameId) && frameId >= 0 && !frameIds.includes(frameId)) {
    frameIds.push(frameId);
  }
}

async function openSidePanel(tabId) {
  if (!tabId || !chrome.sidePanel?.open) {
    throw new Error("当前 Chrome 不支持侧边栏。请升级 Chrome 后重试。");
  }
  await chrome.sidePanel.open({ tabId });
  return {};
}

function enableSidePanelAction() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL("src/offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length > 0) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: "src/offscreen/offscreen.html",
    reasons: ["IFRAME_SCRIPTING"],
    justification: "托管隐藏的 Web FFmpeg 音频处理页面。"
  });
}

async function getWebFfmpegConfig() {
  return {
    url: getDefaultWebFfmpegUrl()
  };
}

function getDefaultWebFfmpegUrl() {
  return chrome.runtime.getURL(DEFAULT_WEB_FFMPEG_PATH);
}

function filenameFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return name || "media.bin";
  } catch {
    return "media.bin";
  }
}

async function getModelConfig() {
  const localStored = await chrome.storage.local.get(null);
  const useStoredProfiles = localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION;
  const asrProfiles = normalizeStoredProfiles("asr", useStoredProfiles ? localStored.asrProfiles : []);
  const llmProfiles = normalizeStoredProfiles("llm", useStoredProfiles ? localStored.llmProfiles : []);
  const selectedAsrId = normalizeSelectedProfileId(
    asrProfiles,
    localStored.selectedAsrProfileId || DEFAULT_ASR_PROFILE_ID,
    DEFAULT_ASR_PROFILE_ID
  );
  const selectedLlmId = normalizeSelectedProfileId(
    llmProfiles,
    localStored.selectedLlmProfileId || DEFAULT_LLM_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID
  );
  const selectedAsr = findProfile(asrProfiles, selectedAsrId, DEFAULT_ASR_PROFILE_ID);
  const selectedLlm = findProfile(llmProfiles, selectedLlmId, DEFAULT_LLM_PROFILE_ID);
  clearLegacyModelSyncFields();
  persistMigratedModelSettings(localStored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId);
  validateSelectedModelProfiles(selectedAsr, selectedLlm);
  const sourceLanguage = normalizeAsrLanguage(localStored.sourceLanguage || DEFAULT_MODEL_SETTINGS.sourceLanguage);
  const asrConfig = compactProviderConfig(selectedAsr);
  if (sourceLanguage) {
    asrConfig.language = sourceLanguage;
  }
  return {
    asr: asrConfig,
    translation: compactProviderConfig(selectedLlm),
    targetLanguage: normalizeTargetLanguage(localStored.targetLanguage || DEFAULT_MODEL_SETTINGS.targetLanguage),
    webFfmpegPerformance: normalizeWebFfmpegPerformanceMode(localStored.webFfmpegPerformance || DEFAULT_MODEL_SETTINGS.webFfmpegPerformance),
    asrWorkers: DEFAULT_MODEL_SETTINGS.asrWorkers,
    workers: Number(localStored.translationWorkers) || DEFAULT_MODEL_SETTINGS.translationWorkers,
    chunkMinutes: clampInteger(localStored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes),
    chunkSeconds: clampInteger(localStored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes) * 60
  };
}

function normalizeWebFfmpegPerformanceMode(value) {
  return ["auto", "stable", "fast"].includes(value) ? value : DEFAULT_MODEL_SETTINGS.webFfmpegPerformance;
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function validateSelectedModelProfiles(asrProfile, llmProfile) {
  if (!String(asrProfile.apiKey || "").trim()) {
    throw new Error(`语音识别配置“${asrProfile.name || asrProfile.model || "未命名"}”缺少 API 密钥。请在侧边栏设置里填写。`);
  }
  if (
    !String(llmProfile.apiKey || "").trim() &&
    !String(llmProfile.model || "").trim() &&
    !String(llmProfile.baseUrl || "").trim()
  ) {
    throw new Error("还没有保存可用的翻译模型档案。请在侧边栏设置里新增档案，填写接口格式、接口地址、模型名称和 API 密钥。");
  }
  if (!String(llmProfile.apiKey || "").trim()) {
    throw new Error(`翻译配置“${llmProfile.name || llmProfile.model || "未命名"}”缺少 API 密钥。请在侧边栏设置里填写。`);
  }
  if (!String(llmProfile.model || "").trim()) {
    throw new Error(`翻译配置“${llmProfile.name || "未命名"}”缺少模型名称。`);
  }
}

function persistMigratedModelSettings(stored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId) {
  const nextAsrProfiles = profilesForStorage("asr", asrProfiles);
  const nextLlmProfiles = profilesForStorage("llm", llmProfiles);
  const needsVersionMigration = stored.modelSettingsVersion !== MODEL_SETTINGS_VERSION;
  const needsSelectionMigration =
    stored.selectedAsrProfileId !== selectedAsrId || stored.selectedLlmProfileId !== selectedLlmId;
  const needsProfileMigration =
    JSON.stringify(stored.asrProfiles || []) !== JSON.stringify(nextAsrProfiles) ||
    JSON.stringify(stored.llmProfiles || []) !== JSON.stringify(nextLlmProfiles);
  if (!needsVersionMigration && !needsSelectionMigration && !needsProfileMigration) {
    return;
  }
  chrome.storage.local.set({
    selectedAsrProfileId: selectedAsrId,
    selectedLlmProfileId: selectedLlmId,
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    asrProfiles: nextAsrProfiles,
    llmProfiles: nextLlmProfiles
  }).catch(() => {});
}

function clearLegacyModelSyncFields() {
  chrome.storage.sync.remove([
    "asrApiKey",
    "llmApiKey",
    "asrBaseUrl",
    "asrModel",
    "llmBaseUrl",
    "llmModel",
    "llmProviderType"
  ]).catch(() => {});
}

async function migrateLegacyCaptionPosition() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get([CAPTION_POSITION_STORAGE_KEY, LEGACY_CAPTION_TOP_RATIO_KEY]),
      chrome.storage.sync.get([CAPTION_POSITION_STORAGE_KEY])
    ]);
    if (syncData[CAPTION_POSITION_STORAGE_KEY]) {
      return;
    }
    const stored = localData[CAPTION_POSITION_STORAGE_KEY];
    if (stored && typeof stored === "object") {
      await chrome.storage.sync.set({ [CAPTION_POSITION_STORAGE_KEY]: stored });
      return;
    }
    const legacyTop = Number(localData[LEGACY_CAPTION_TOP_RATIO_KEY]);
    if (Number.isFinite(legacyTop)) {
      await chrome.storage.sync.set({ [CAPTION_POSITION_STORAGE_KEY]: { x: 0.5, y: legacyTop } });
    }
  } catch {
    // Position migration is best-effort and should never block the extension.
  }
}

function buildPreloadMetadata(candidate, state, pageUrl) {
  return {
    title: firstUsefulTitle(state.page?.title, state.context?.title, candidate.title) || "",
    description: candidate.description || state.context?.description || "",
    pageLanguage: state.context?.language || "",
    channel: candidate.channel || candidate.uploader || candidate.creator || "",
    duration: candidate.duration || state.context?.duration || null,
    pageUrl,
    sourceUrl: candidate.url || ""
  };
}

async function refreshTabInfo(tabId) {
  if (!tabId) {
    return;
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) {
    return;
  }
  const state = getState(tabId);
  state.page = {
    title: tab.title || state.page?.title || "",
    url: tab.url || state.page?.url || "",
    favIconUrl: tab.favIconUrl || state.page?.favIconUrl || ""
  };
}

function updateTabContext(tabId, context, frameId = 0) {
  if (!tabId || !context) {
    return;
  }
  const state = getState(tabId);
  const current = state.context || {};
  const incomingFrameId = normalizeFrameId(frameId);
  const isMainFrame = incomingFrameId === 0;
  const incomingArea = (context.elementWidth || context.videoWidth || 0) * (context.elementHeight || context.videoHeight || 0);
  const currentArea = (current.elementWidth || current.videoWidth || 0) * (current.elementHeight || current.videoHeight || 0);
  const shouldReplaceMedia = context.hasMedia && (!current.hasMedia || incomingArea >= currentArea);
  const shouldUpdateTime = context.hasMedia && (shouldReplaceMedia || state.mediaFrameId === incomingFrameId || current.frameId === incomingFrameId);
  if (shouldReplaceMedia) {
    state.mediaFrameId = incomingFrameId;
  }
  state.context = {
    ...current,
    href: isMainFrame ? context.href || current.href || "" : current.href || "",
    title: isMainFrame ? context.title || current.title || "" : current.title || "",
    description: isMainFrame ? context.description || current.description || "" : current.description || "",
    language: isMainFrame ? context.language || current.language || "" : current.language || "",
    hasMedia: current.hasMedia || Boolean(context.hasMedia),
    duration: pickFinite(context.duration, current.duration),
    currentTime: shouldUpdateTime ? pickFinite(context.currentTime, current.currentTime) : current.currentTime,
    videoWidth: shouldReplaceMedia ? context.videoWidth || current.videoWidth || null : current.videoWidth || context.videoWidth || null,
    videoHeight: shouldReplaceMedia ? context.videoHeight || current.videoHeight || null : current.videoHeight || context.videoHeight || null,
    elementWidth: shouldReplaceMedia ? context.elementWidth || current.elementWidth || null : current.elementWidth || context.elementWidth || null,
    elementHeight: shouldReplaceMedia ? context.elementHeight || current.elementHeight || null : current.elementHeight || context.elementHeight || null,
    mediaTag: context.mediaTag || current.mediaTag || "",
    poster: shouldReplaceMedia ? context.poster || current.poster || "" : current.poster || context.poster || "",
    currentSrc: shouldReplaceMedia ? context.currentSrc || current.currentSrc || "" : current.currentSrc || context.currentSrc || "",
    readyState: context.readyState || current.readyState || 0,
    frameId: shouldReplaceMedia ? incomingFrameId : current.frameId ?? incomingFrameId,
    seenAt: Date.now()
  };
}

function addPageMediaCandidate(tabId, media, frameId = 0) {
  if (!tabId || !media?.url) {
    return;
  }
  if (isIgnoredMediaUrl(media.url)) {
    return;
  }
  if (media.url.startsWith("blob:") || media.url.startsWith("data:")) {
    return;
  }
  const mediaFrameId = normalizeFrameId(frameId);
  if (media.source === "media-element") {
    getState(tabId).mediaFrameId = mediaFrameId;
  }
  const classification = classifyUrl(media.url) || { kind: media.kind || "media", ext: "" };
  addCandidate(tabId, {
    url: media.url,
    source: media.source || "page",
    kind: media.kind || classification.kind,
    ext: media.ext || classification.ext,
    title: media.title || "",
    initiator: media.href || "",
    duration: media.duration,
    contentType: media.contentType,
    size: media.size,
    videoWidth: media.videoWidth,
    videoHeight: media.videoHeight,
    bandwidth: media.bandwidth,
    qualityLabel: media.qualityLabel,
    playlistType: media.playlistType,
    statusId: media.statusId,
    role: media.role,
    segmentType: media.segmentType,
    trackHandler: media.trackHandler,
    frameId: mediaFrameId,
    seenAt: Date.now()
  });
}

function normalizeFrameId(value) {
  const frameId = Number(value);
  return Number.isInteger(frameId) && frameId >= 0 ? frameId : 0;
}

function addCandidate(tabId, candidate) {
  const state = getState(tabId);
  const safeCandidate = sanitizeCandidateRequestHeaders(candidate);
  const fingerprint = candidateFingerprint(safeCandidate);
  if (state.candidateFingerprints.has(fingerprint)) {
    state.candidates = state.candidates.map(item => {
      if (candidateFingerprint(item) !== fingerprint) {
        return item;
      }
      return mergeCandidate(item, safeCandidate);
    });
    return;
  }
  state.candidateFingerprints.add(fingerprint);
  state.candidates.unshift(safeCandidate);
  state.candidates = pruneCandidatesForRetention(state.candidates, MAX_CANDIDATES_PER_TAB);
}

function sanitizeCandidateRequestHeaders(candidate = {}) {
  return {
    ...candidate,
    requestHeaders: sanitizeInternalRequestHeaders(candidate.requestHeaders)
  };
}

function getDisplayCandidates(tabId) {
  const state = getState(tabId);
  return getGroupedCandidatesForState(state).map(stripCandidateRequestHeaders);
}

function setTabStatus(tabId, patch) {
  Object.assign(getState(tabId), patch);
}

function getState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      candidates: [],
      candidateFingerprints: new Set(),
      preload: "idle",
      error: "",
      page: {},
      context: {},
      attachedVttSignature: "",
      manualVttSignature: "",
      subtitleFrameId: null,
      lastPreloadCandidate: null
    });
  }
  return tabState.get(tabId);
}
