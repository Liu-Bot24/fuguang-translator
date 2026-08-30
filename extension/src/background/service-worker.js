import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";
import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";
import { FuguangBrowserLanguage } from "./browser-language.js";
import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";
import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";
import { FuguangBrowserFunAsrProvider } from "./browser-funasr-provider.js";
import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";
import { FuguangJobStore } from "./job-store.js";
import { FuguangMediaHeaderRules } from "./media-header-rules.js";
import { FuguangJobContract } from "../shared/job-contract.js";
import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";
import { FuguangRequestSemaphore } from "../shared/request-semaphore.js";

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
var sanitizeRequestHeadersByOrigin = FuguangBrowserMediaCandidates.sanitizeRequestHeadersByOrigin;
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
var createDurableJobId = FuguangJobContract.createJobId;
var createDurableRunToken = FuguangJobContract.createRunToken;
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
  OFFSCREEN_CANCEL_JOB: "FUGUANG_OFFSCREEN_CANCEL_JOB",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY",
  UPDATE_MEDIA_HEADER_RULE_DOMAINS: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS",
  SIDEPANEL_SUBSCRIBE: "FUGUANG_SIDEPANEL_SUBSCRIBE",
  SIDEPANEL_JOB_CHANGED: "FUGUANG_SIDEPANEL_JOB_CHANGED"
};
const SIDEPANEL_STATUS_PORT_NAME = "fuguang-sidepanel-status-v1";

const DEFAULT_WEB_FFMPEG_PATH = "web-ffmpeg/index.html";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_AUDIO_CACHE_CLEANUP_ALARM = "fuguang-audio-cache-cleanup";
const OFFSCREEN_IDLE_CLOSE_ALARM = "fuguang-offscreen-idle-close";
const BROWSER_JOB_LEASE_RECOVERY_ALARM_PREFIX = "fuguang-job-lease-recovery:";
const OFFSCREEN_IDLE_CLOSE_MINUTES = 2;
const WEB_FFMPEG_AUDIO_CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const WEB_FFMPEG_AUDIO_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const WEB_FFMPEG_AUDIO_CACHE_CLEANUP_INTERVAL_MINUTES = 60;
const WEB_FFMPEG_AUDIO_CACHE_MIN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const BROWSER_JOB_LEDGER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BROWSER_JOB_EXECUTION_LEASE_MS = 30_000;
const BROWSER_JOB_EXECUTION_HEARTBEAT_MS = 10_000;
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
const browserJobStore = FuguangJobStore.create();
const browserJobMirrorPending = new Map();
const browserJobMirrorActive = new Map();
const offscreenBrowserChunkOperations = new Map();
const offscreenBrowserFinalizationOperations = new Map();
const offscreenTaskRuntimeCommands = new Map();
const sidepanelStatusPorts = new Map();
const sidepanelStatusPushTimers = new Map();
let browserAudioCacheCleanupPromise = null;
let browserAudioCacheLastCleanupAt = 0;
let browserMediaExtractionQueue = Promise.resolve();
let offscreenDocumentCreationPromise = null;
let offscreenTaskRuntimePort = null;
let offscreenTaskRuntimeConnectionPromise = null;
let browserJobRecoveryPromise = null;
let browserVttAttachmentGeneration = Date.now() * 1000;

const tabState = new Map();
const activeDocumentIdsByTab = new Map();
const serviceWorkerExecutionOwnerId = `service-worker:${createDurableRunToken()}`;

try {
  const accessLevelPromise = chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
  accessLevelPromise?.catch?.(() => {});
} catch {
  // Older Chromium builds may not support storage access-level controls.
}
migrateLegacyCaptionPosition();
enableSidePanelAction();
scheduleBrowserAudioCacheMaintenance();
browserJobRecoveryPromise = recoverBrowserJobIndex().catch(() => ({ recovered: 0 }));

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
      frameId: normalizeFrameId(details.frameId),
      documentId: String(details.documentId || ""),
      parentFrameId: Number.isInteger(Number(details.parentFrameId)) ? Number(details.parentFrameId) : -1,
      parentDocumentId: String(details.parentDocumentId || ""),
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
      frameId: normalizeFrameId(details.frameId),
      documentId: String(details.documentId || ""),
      parentFrameId: Number.isInteger(Number(details.parentFrameId)) ? Number(details.parentFrameId) : -1,
      parentDocumentId: String(details.parentDocumentId || ""),
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
      responseStatus: Number(details.statusCode || 0) || 0,
      responseIp: String(details.ip || ""),
      frameId: normalizeFrameId(details.frameId),
      documentId: String(details.documentId || ""),
      parentFrameId: Number.isInteger(Number(details.parentFrameId)) ? Number(details.parentFrameId) : -1,
      parentDocumentId: String(details.parentDocumentId || ""),
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
  noteActiveDocument(details.tabId, details.frameId, details.documentId, { authoritative: true });
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return undefined;
});

chrome.webNavigation.onHistoryStateUpdated?.addListener(details => {
  noteActiveDocument(details.tabId, details.frameId, details.documentId, { authoritative: true });
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return clearFrameNavigationState(details.tabId, details.frameId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
  activeDocumentIdsByTab.delete(tabId);
});

async function clearTopLevelNavigationState(tabId, { detachSubtitles = false } = {}) {
  const state = tabState.get(tabId);
  if (state) {
    invalidateManualVttAttachment(state);
  }
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
  const hadAttachedVtt = Boolean(state.attachedVttSignature || state.manualVttSignature);
  invalidateManualVttAttachment(state);
  if (hadAttachedVtt) {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE.DETACH_PRELOAD_VTT,
      preloadGeneration: nextBrowserVttAttachmentGeneration()
    }, { frameId: numericFrameId }).catch(() => null);
  }
  state.attachedVttSignature = "";
  state.attachedVttGeneration = 0;
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

chrome.runtime.onConnect?.addListener?.(port => {
  if (port?.name !== SIDEPANEL_STATUS_PORT_NAME) {
    return;
  }
  sidepanelStatusPorts.set(port, null);
  port.onMessage?.addListener?.(message => {
    if (message?.type !== MESSAGE.SIDEPANEL_SUBSCRIBE) {
      return;
    }
    const tabId = Number(message.tabId);
    sidepanelStatusPorts.set(port, Number.isInteger(tabId) && tabId >= 0 ? tabId : null);
  });
  port.onDisconnect?.addListener?.(() => {
    sidepanelStatusPorts.delete(port);
  });
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
      return attachVttText(message.tabId, message.vtt, {
        origin: message.origin,
        jobId: message.jobId,
        attachmentRevision: message.attachmentRevision
      });
    case MESSAGE.DETACH_PRELOAD_VTT:
      await detachPreloadVtt(message.tabId);
      return {};
    case MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE:
      return clearPreloadSubtitleState(message.tabId, message.jobId);
    case MESSAGE.SEEK_MEDIA:
      return seekMedia(message.tabId, message.time);
    case MESSAGE.PAGE_MEDIA_FOUND:
      if (!await isCurrentDocumentMessage(sender)) {
        return { ignored: true, reason: "stale-document" };
      }
      addPageMediaCandidate(sender.tab?.id, message.media, sender.frameId, sender.documentId);
      return {};
    case MESSAGE.PAGE_CONTEXT_FOUND:
      if (!await isCurrentDocumentMessage(sender)) {
        return { ignored: true, reason: "stale-document" };
      }
      updateTabContext(sender.tab?.id, message.context, sender.frameId, sender.documentId);
      return {};
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_PROGRESS:
      return applyOffscreenWebFfmpegProgress(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_CHUNK_READY:
      return applyOffscreenWebFfmpegChunkReady(message);
    case MESSAGE.UPDATE_MEDIA_HEADER_RULE_DOMAINS:
      return updateMediaRequestHeaderRuleDomains(message.jobId, message.urls || []);
    case FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK:
      return processOffscreenBrowserJobChunk(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK:
      return getOffscreenBrowserJobWork(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB:
      return finalizeOffscreenBrowserJob(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB:
      return failOffscreenBrowserJob(message);
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
    state.attachedVttGeneration = 0;
    preloadJob = null;
  }
  if (!preloadJob) {
    const matchingRecord = findBrowserPreloadRecordForTabPage(tabId, currentPageUrl);
    if (matchingRecord) {
      preloadJob = browserPreloadJobForRead(matchingRecord);
      state.preload = preloadJob.status || "running";
      state.preloadJob = cloneBrowserJobState(preloadJob);
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
  if (record.offscreenMirrorSuppressionCount || record.staleOffscreenOperationDetected) {
    return cloneBrowserJobState(record.lastCommittedJob || job);
  }
  if (!["completed", "failed", "cancelled"].includes(record.job.status)) {
    publishBrowserPreloadJob(record);
  }
  return cloneBrowserJobState(record.job);
}

async function activatePage(tabId) {
  if (!tabId) {
    throw new Error("没有可用的当前标签页。");
  }
  await injectPageScript(tabId, ["src/content/subtitle-overlay.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/media-bridge.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/page-sniffer.js"], { allFrames: true, world: "MAIN" });
  await applyPageSniffingMode(tabId);
  await refreshTabInfo(tabId);
}

async function applyPageSniffingMode(tabId) {
  const stored = await chrome.storage.local.get({ mediaSniffingMode: "light" }).catch(() => ({}));
  const mode = stored.mediaSniffingMode === "deep" ? "deep" : "light";
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: "MAIN",
    injectImmediately: true,
    func(selectedMode) {
      globalThis.__fuguangPageSnifferSetMode?.(selectedMode);
    },
    args: [mode]
  }).catch(() => {});
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
  if (preloadCandidate.executionAllowed !== false &&
      preloadCandidate.trustReason === "browser-observed-response" &&
      !await isCandidateDocumentStillCurrent(tabId, preloadCandidate)) {
    throw new Error("这个私有网络媒体地址尚未由当前页面实际请求验证。请先播放媒体并刷新候选列表。");
  }
  if (preloadCandidate.executionAllowed === false) {
    throw new Error(preloadCandidate.trustReason === "local-file-requires-authorization"
      ? "本地媒体文件需要先授权读取，请重新选择当前文件。"
      : "这个私有网络媒体地址尚未由浏览器实际请求验证。请先播放媒体并刷新候选列表。");
  }
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
    attachedVttSignature: "",
    attachedVttGeneration: 0
  });
  setTabStatus(tabId, { lastPreloadCandidate: preloadCandidate });
  return { preload: payload.status || "queued", job: payload.job, result: payload.result };
}

async function isCandidateDocumentStillCurrent(tabId, candidate = {}) {
  const numericTabId = Number(tabId);
  const documentId = String(candidate.documentId || "");
  const frameId = normalizeFrameId(candidate.frameId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0 || !documentId ||
      typeof chrome.webNavigation?.getFrame !== "function") {
    return false;
  }
  const frame = await chrome.webNavigation.getFrame({ tabId: numericTabId, frameId }).catch(() => null);
  if (!frame?.documentId || String(frame.documentId) !== documentId) {
    return false;
  }
  const parentFrameId = Number(candidate.parentFrameId);
  const parentDocumentId = String(candidate.parentDocumentId || "");
  if (Number.isInteger(parentFrameId) && parentFrameId >= 0) {
    if (!parentDocumentId) {
      return false;
    }
    const parentFrame = await chrome.webNavigation.getFrame({
      tabId: numericTabId,
      frameId: parentFrameId
    }).catch(() => null);
    if (!parentFrame?.documentId || String(parentFrame.documentId) !== parentDocumentId) {
      return false;
    }
  }
  return true;
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
  await browserJobRecoveryPromise;
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
  const jobId = createDurableJobId();
  const runToken = createDurableRunToken();
  const job = {
    id: jobId,
    runToken,
    pipeline: usesFunAsr ? "funasr" : "browser",
    status: "queued",
    stage: "queued",
    source: extractionCandidate.url,
    sourceUrl: extractionCandidate.url,
    originalSourceUrl: candidate.url || "",
    metadata: executionMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    extract: {
      status: "queued",
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
    runToken,
    candidate: extractionCandidate,
    selectedCandidate: candidate,
    metadata: executionMetadata,
    modelConfig,
    job,
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    browserAsrChunkSeconds: browserAsrChunkSeconds,
    pipeline: usesFunAsr ? "funasr" : "browser"
  };
  browserPreloadJobs.set(jobId, record);
  publishBrowserPreloadJob(record);
  await flushBrowserJobMirror(jobId).catch(() => null);
  job.status = "running";
  job.stage = "extracting";
  job.extract.status = "running";
  publishBrowserPreloadJob(record);
  observeBrowserJobInOffscreen(record).catch(() => {});
  runBrowserPreloadJob(jobId, record).catch(error => failBrowserPreloadJob(record, error));
  return { status: "running", job };
}

function failBrowserPreloadJob(record, error) {
  if (!isCurrentBrowserPreloadRecord(record) || isBrowserJobCancelled(record)) {
    return;
  }
  record.job.status = "failed";
  record.job.stage = "failed";
  record.job.error = error.message || String(error);
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  releaseLocalBrowserExecutionLease(record).catch(() => {});
  publishBrowserPreloadJob(record);
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
    return {
      ...candidate,
      url,
      sourceUrl: url,
      originalSourceUrl: candidate.url || "",
      kind: "mse-fragments",
      ext: "m4s",
      role: plan.primaryRole || "audio",
      contentType: "video/iso.segment",
      requestHeaders: capturedRequestHeadersForUrl(candidate, url),
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
    return {
      ...candidate,
      url: url || candidate.url || "",
      sourceUrl: url || candidate.url || "",
      originalSourceUrl: candidate.url || "",
      kind: "dash",
      ext: "mpd",
      role: plan.primaryRole || "audio",
      contentType: "application/dash+xml",
      requestHeaders: capturedRequestHeadersForUrl(candidate, url),
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
    requestHeaders: capturedRequestHeadersForUrl(candidate, url),
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

function capturedRequestHeadersForUrl(candidate = {}, targetUrl = "") {
  let origin = "";
  try {
    const url = new URL(String(targetUrl || ""));
    origin = ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    origin = "";
  }
  const mappedHeaders = origin
    ? sanitizeInternalRequestHeaders(candidate.requestHeadersByOrigin?.[origin])
    : {};
  if (Object.keys(mappedHeaders).length) {
    return mappedHeaders;
  }
  return canReuseCapturedHeaders(candidate.url, targetUrl)
    ? sanitizeInternalRequestHeaders(candidate.requestHeaders)
    : null;
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

async function runBrowserPreloadJob(jobId, expectedRecord = null) {
  const record = expectedRecord || browserPreloadJobs.get(jobId);
  if (!isCurrentBrowserPreloadRecord(record)) {
    return;
  }
  if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
    return runBrowserFunAsrPreloadJob(jobId, record);
  }
  const offscreenStart = await startBrowserJobInOffscreen(record);
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  const executionOwner = await resolveBrowserJobExecutionOwner(record, offscreenStart);
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  const offscreenStarted = executionOwner === "offscreen";
  if (executionOwner === "local") {
    startBrowserChunkPipeline(record);
  }
  let audio = {};
  let extractionError = null;
  try {
    audio = await extractCandidateAudioInBrowser(record);
    if (!isActiveCurrentBrowserPreloadRecord(record)) {
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
  if (!isCurrentBrowserPreloadRecord(record)) {
    return;
  }
  if (extractionError) {
    throw extractionError;
  }
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  if (offscreenStarted) {
    return;
  }
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  await attachBrowserJobVttIfReady(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
}

async function runBrowserFunAsrPreloadJob(jobId, expectedRecord = null) {
  const record = expectedRecord || browserPreloadJobs.get(jobId);
  if (!isCurrentBrowserPreloadRecord(record)) {
    return;
  }
  const offscreenStart = await startBrowserJobInOffscreen(record);
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  const executionOwner = await resolveBrowserJobExecutionOwner(record, offscreenStart);
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  const offscreenStarted = executionOwner === "offscreen";
  if (executionOwner === "local") {
    startBrowserFunAsrChunkPipeline(record);
  }
  let audio = {};
  let extractionError = null;
  try {
    audio = await extractCandidateAudioInBrowser(record);
    if (!isActiveCurrentBrowserPreloadRecord(record)) {
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
  if (!isCurrentBrowserPreloadRecord(record)) {
    return;
  }
  if (extractionError) {
    throw extractionError;
  }
  if (!isActiveCurrentBrowserPreloadRecord(record)) {
    return;
  }
  if (offscreenStarted) {
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
  const runToken = record?.runToken;
  const operation = options.operation || null;
  const signal = options.signal || record.abortController?.signal;
  if (isBrowserRunInactive(record, runToken, operation)) {
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
    if (!await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
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
        signal,
        onProgress(progress) {
          if (isBrowserRunInactive(record, runToken, operation)) {
            return;
          }
          updateChunkStatus(record, index, {
            stage: "asr",
            status: "识别",
            attempts: attempt,
            message: `Fun-ASR ${progress.status || "处理中"} · ${index + 1}/${chunksTotal}`
          });
        }
      }
    );
    if (!await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
    const sourceSegments = normalizeBrowserSourceSegmentsForTranslation(
      normalizeDashScopeFunAsrResult(payload, chunk, {
        labelSpeakers,
        chunkLabelIndex: index
      }),
      index
    );
    markBrowserAudioChunkAsrResult(chunk, sourceSegments, null);
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
    }, sourceSegments, options);
  } catch (error) {
    if (isBrowserAbortError(error) ||
        !await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
    markBrowserAudioChunkAsrResult(chunk, [], error);
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

function enqueueBrowserMediaExtraction(task) {
  const result = browserMediaExtractionQueue.then(() => task());
  browserMediaExtractionQueue = result.catch(() => {});
  return result;
}

function extractCandidateAudioInBrowser(record) {
  return enqueueBrowserMediaExtraction(() => {
    if (isBrowserJobCancelled(record)) {
      return {};
    }
    return extractCandidateAudioInBrowserNow(record);
  });
}

async function extractCandidateAudioInBrowserNow(record) {
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
    requestHeadersByOrigin: sanitizeRequestHeadersByOrigin(candidate.requestHeadersByOrigin),
    allowPrivateNetworkMediaOrigin: candidate.trustTier === "observed-private-network" &&
      candidate.trustReason === "browser-observed-response",
    fileName: candidate.fileName || candidate.filename || filenameFromUrl(candidate.url),
    mime: candidate.contentType || candidate.mime || "",
    sourceBytes: Number(candidate.size || candidate.responseHeaders?.size || 0) || 0,
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
    jobId: record.job.id,
    runToken: record.runToken
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
  if (!isActiveCurrentBrowserPreloadRecord(record) ||
      record.staleOffscreenOperationDetected ||
      !["queued", "running"].includes(String(record.job?.status || "")) ||
      (message?.runToken && message.runToken !== record.runToken)) {
    return {};
  }
  applyBrowserExtractionProgress(record, message.progress || {});
  return {};
}

function applyOffscreenWebFfmpegChunkReady(message) {
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!isActiveCurrentBrowserPreloadRecord(record) ||
      record.staleOffscreenOperationDetected ||
      !["queued", "running"].includes(String(record.job?.status || "")) ||
      (message?.runToken && message.runToken !== record.runToken)) {
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

async function processBrowserAsrChunk(record, chunk, options = {}) {
  const runToken = record?.runToken;
  const operation = options.operation || null;
  const signal = options.signal || record.abortController?.signal;
  if (isBrowserRunInactive(record, runToken, operation)) {
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
    markBrowserAudioChunkAsrResult(chunk, [], null);
    completeBrowserAsrChunkForGroup(record, chunk, []);
    return;
  }
  let sourceSegments;
  try {
    sourceSegments = await transcribeBrowserAudioChunk(chunk, record.modelConfig.asr, {
      signal,
      jobId: record.job.id,
      runToken: record.runToken,
      onDiagnostics: diagnostics => {
        if (!isBrowserRunInactive(record, runToken, operation)) {
          recordBrowserAsrChunkDiagnostics(record, chunk, diagnostics);
        }
      }
    });
  } catch (error) {
    if (isBrowserAbortError(error) ||
        !await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
    markBrowserAudioChunkAsrResult(chunk, [], error);
    completeBrowserAsrChunkForGroup(record, chunk, [], error);
    return;
  }
  if (!await isBrowserExecutionOperationActive(record, runToken, operation)) {
    return;
  }
  markBrowserAudioChunkAsrResult(chunk, sourceSegments, null);
  completeBrowserAsrChunkForGroup(record, chunk, sourceSegments);
}

function markBrowserAudioChunkAsrResult(chunk, sourceSegments, error = null) {
  if (!chunk || typeof chunk !== "object") {
    return;
  }
  chunk.asrCompleted = true;
  chunk.asrFailed = Boolean(error);
  chunk.asrError = error ? String(error.message || error) : "";
  chunk.sourceSegments = Array.isArray(sourceSegments) ? sourceSegments : [];
  chunk.updatedAt = Date.now();
}

async function processBrowserTranslationChunk(record, chunk, sourceSegments, options = {}) {
  const runToken = record?.runToken;
  const operation = options.operation || null;
  const signal = options.signal || record.abortController?.signal;
  if (isBrowserRunInactive(record, runToken, operation)) {
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
        signal,
        onProgress(progress) {
          if (isBrowserRunInactive(record, runToken, operation)) {
            return;
          }
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
    if (!await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
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
    if (isBrowserAbortError(error) ||
        !await isBrowserExecutionOperationActive(record, runToken, operation)) {
      return;
    }
    translatedSegments = [];
    updateChunkStatus(record, chunk.index, {
      stage: "failed",
      status: "失败",
      translatedCount: 0,
      error: `翻译失败，已保留原文供重试：${error.message || String(error)}`
    });
  }
  if (!await isBrowserExecutionOperationActive(record, runToken, operation)) {
    return;
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

function cancelAsyncQueue(queue) {
  if (!queue) {
    return;
  }
  queue.items.length = 0;
  closeAsyncQueue(queue);
}

function cancelBrowserRecordQueues(record) {
  cancelAsyncQueue(record?.browserAsrQueue);
  cancelAsyncQueue(record?.browserTranslationQueue);
  cancelAsyncQueue(record?.browserFunAsrQueue);
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
  const supportedRequestFields = await resolveBrowserAsrSupportedRequestFields(asrConfig, { signal: options.signal });
  const speechTimestampsEndpoint = await resolveBrowserAsrSpeechTimestampsEndpoint(asrConfig, { signal: options.signal });
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
        endpoint: speechTimestampsEndpoint,
        signal: options.signal
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
        signal: options.signal,
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
        signal: options.signal,
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
        signal: options.signal,
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
        signal: options.signal,
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
  const collected = await collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig, options);
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
      signal: options.signal,
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

async function collectBrowserAsrSpeechAudioChunks(sourceChunk, fileBuffer, fileName, reliableSpeechIntervals, asrConfig = {}, options = {}) {
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

async function requestBrowserAsrTranscription({ endpoint, timeoutMs, asrConfig, supportedRequestFields, effectiveChunk, fileBuffer, fileName, clipTimestamps, matureAsrPlan, disableVadFilter = false, signal = null }) {
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
    const key = FuguangRequestSemaphore.providerKey("asr", asrConfig);
    const limit = Math.max(1, Math.min(4, Number(asrConfig.maxConcurrency || 2) || 2));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await FuguangRequestSemaphore.withPermit(key, limit, async () => {
        const currentResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${asrConfig.apiKey}`
          },
          body: formData,
          signal: controller.signal
        });
        const retryAfterMs = currentResponse?.status === 429
          ? FuguangRequestSemaphore.retryAfterMs(currentResponse.headers)
          : 0;
        if (attempt === 0 && retryAfterMs > 0) {
          return { response: currentResponse, retryAfterMs, payload: {} };
        }
        let currentPayload = {};
        try {
          currentPayload = await currentResponse.json();
        } catch (error) {
          if (controller.signal.aborted) {
            throw error;
          }
        }
        return { response: currentResponse, retryAfterMs, payload: currentPayload };
      }, controller.signal);
      response = result.response;
      payload = result.payload;
      const retryAfterMs = result.retryAfterMs;
      if (attempt === 0 && retryAfterMs > 0) {
        response.body?.cancel?.().catch?.(() => {});
        await FuguangRequestSemaphore.delay(retryAfterMs, controller.signal);
        continue;
      }
      break;
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
      matureAsrPlan: requestMatureAsrPlan
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
  if (reason instanceof Error) {
    error.cause = reason;
  }
  return error;
}

function isBrowserAbortError(error) {
  return error?.name === "AbortError" || /任务已停止|cancel(?:led)?|aborted/i.test(String(error?.message || error || ""));
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
  if (isBrowserJobCancelled(record)) {
    return current;
  }
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
  if (isCurrentBrowserPreloadRecord(record) && !record.offscreenMirrorSuppressionCount) {
    attachBrowserJobVttIfReady(record).catch(() => {});
  }
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
  releaseLocalBrowserExecutionLease(record).catch(() => {});
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

async function attachBrowserJobVttIfReady(record, job = record?.job) {
  const snapshot = cloneBrowserJobState(job);
  const jobId = String(snapshot?.id || record?.job?.id || "");
  if (!record?.tabId || !snapshot?.translation?.vttText ||
      !browserVttAttachmentSnapshotIsCurrent(record, snapshot)) {
    return;
  }
  const state = getState(record.tabId);
  const interventionEpoch = currentAutomaticVttInterventionEpoch(state);
  const attachmentIsCurrent = attachment => {
    if (
      currentAutomaticVttInterventionEpoch(state) !== interventionEpoch ||
      state.manualVttSignature ||
      !browserVttAttachmentSnapshotIsCurrent(record, snapshot)
    ) {
      return false;
    }
    return !attachment || browserVttAttachmentRenderIsCurrent(record, snapshot, attachment);
  };
  if (!attachmentIsCurrent() || !(await isSubtitleOverlayEnabled()) || !attachmentIsCurrent()) {
    return;
  }
  if (isPreloadSubtitleAttachmentSuppressed(record.tabId, jobId)) {
    return;
  }
  const attachment = await buildBrowserVttAttachment(snapshot);
  if (!attachment.vtt || !attachmentIsCurrent(attachment)) {
    return;
  }
  const signature = browserVttAttachmentSignature(snapshot, attachment);
  if (state.attachedVttSignature === signature) {
    const attached = await hasAttachedSubtitleSignature(record.tabId, signature);
    if (!attachmentIsCurrent(attachment) || attached) {
      return;
    }
  }
  if (!attachmentIsCurrent(attachment)) {
    return;
  }
  await ensureSubtitleOverlay(record.tabId);
  if (!attachmentIsCurrent(attachment)) {
    return;
  }
  const attachmentGeneration = nextBrowserVttAttachmentGeneration();
  const response = await sendMessageToMediaFrame(record.tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt: attachment.vtt,
    label: "流声字幕",
    signature,
    origin: "job-automatic",
    jobId,
    attachmentRevision: normalizeSubtitleAttachmentRevision(snapshot.updatedAt),
    preloadGeneration: attachmentGeneration
  });
  if (!attachmentIsCurrent(attachment)) {
    await invalidateBrowserPreloadVttAttachment(record.tabId, attachmentGeneration);
    return;
  }
  if (response?.preservedManual) {
    return;
  }
  if (response?.ok) {
    state.attachedVttSignature = signature;
    state.attachedVttGeneration = attachmentGeneration;
  }
}

function browserVttAttachmentRecordIsCurrent(record, jobId) {
  if (!record || isBrowserJobCancelled(record) || !browserPreloadRecordMatchesCurrentPage(record)) {
    return false;
  }
  const mappedRecord = browserPreloadJobs.get(String(jobId || ""));
  if (mappedRecord) {
    return mappedRecord === record;
  }
  return !String(record.runToken || record.job?.runToken || "");
}

function browserVttAttachmentSnapshotIsCurrent(record, job) {
  const jobId = String(job?.id || record?.job?.id || "");
  if (!browserVttAttachmentRecordIsCurrent(record, jobId)) {
    return false;
  }
  const currentJob = browserPreloadJobForRead(record);
  return Boolean(
    currentJob &&
    String(currentJob.id || "") === jobId &&
    String(currentJob.runToken || "") === String(job?.runToken || "") &&
    String(currentJob.translation?.vttText || "") === String(job?.translation?.vttText || "")
  );
}

function browserVttAttachmentRenderIsCurrent(record, job, attachment) {
  if (!browserVttAttachmentSnapshotIsCurrent(record, job)) {
    return false;
  }
  const currentJob = browserPreloadJobForRead(record);
  const currentAttachment = buildBrowserVttAttachmentForMode(
    currentJob,
    attachment?.requestedMode || attachment?.mode
  );
  return Boolean(
    currentAttachment.vtt &&
    browserVttAttachmentSignature(currentJob, currentAttachment) ===
      browserVttAttachmentSignature(job, attachment)
  );
}

function nextBrowserVttAttachmentGeneration() {
  browserVttAttachmentGeneration = Math.max(
    browserVttAttachmentGeneration + 1,
    Date.now() * 1000
  );
  return browserVttAttachmentGeneration;
}

async function invalidateBrowserPreloadVttAttachment(tabId, invalidatedGeneration = 0) {
  if (!tabId) {
    return;
  }
  const barrierGeneration = Number(invalidatedGeneration || 0) || nextBrowserVttAttachmentGeneration();
  const state = getState(tabId);
  if (!state.manualVttSignature && Number(state.attachedVttGeneration || 0) <= barrierGeneration) {
    state.attachedVttSignature = "";
    state.attachedVttGeneration = 0;
    state.subtitleFrameId = null;
  }
  await broadcastMessageToFrames(tabId, {
    type: MESSAGE.DETACH_PRELOAD_VTT,
    preloadGeneration: barrierGeneration,
    automaticOnly: true
  }).catch(() => {});
}

async function buildBrowserVttAttachment(job) {
  return buildBrowserVttAttachmentForMode(job, await getSubtitleDisplayMode());
}

function buildBrowserVttAttachmentForMode(job, mode) {
  const requestedMode = ["translated", "source", "bilingual"].includes(mode)
    ? mode
    : "translated";
  const transcript = job.translation?.transcript;
  const allowSourceFallback = browserJobAllowsOverlaySourceFallback(job);
  if (requestedMode === "source") {
    const source = transcriptToSourceVtt(transcript);
    if (source) {
      return { requestedMode, mode: requestedMode, vtt: source };
    }
    return { requestedMode, mode: requestedMode, vtt: "" };
  }
  if (requestedMode === "bilingual") {
    const bilingual = transcriptToBilingualVtt(transcript, { allowSourcePreview: allowSourceFallback });
    if (bilingual) {
      return { requestedMode, mode: requestedMode, vtt: bilingual };
    }
  }
  const translated = transcriptToTranslatedVtt(transcript, { allowSourcePreview: allowSourceFallback });
  if (translated) {
    return { requestedMode, mode: "translated", vtt: translated };
  }
  return {
    requestedMode,
    mode: "translated",
    vtt: transcript ? "" : (job.translation?.vttText || "")
  };
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
  refreshBrowserPreloadJobSummary(record);
  if (!isCurrentBrowserPreloadRecord(record) || record.staleOffscreenOperationDetected) {
    return;
  }
  if (!record.offscreenMirrorSuppressionCount) {
    scheduleBrowserJobMirror(record);
    publishBrowserPreloadJobUi(record);
  }
}

function refreshBrowserPreloadJobSummary(record) {
  record.job.updatedAt = Date.now();
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  record.job.reusableAudioChunks = (record.audioChunks || []).length;
  record.job.reusableSourceChunks = record.sourceSegmentsByChunk?.size || 0;
  record.job.translation.reusableAudioChunks = record.job.reusableAudioChunks;
  record.job.translation.reusableSourceChunks = record.job.reusableSourceChunks;
  record.job.progress = browserJobProgress(record.job);
}

function publishBrowserPreloadJobUi(record, job = record?.job) {
  if (!isCurrentBrowserPreloadRecord(record) || !job) {
    return;
  }
  scheduleOffscreenIdleCloseIfNeeded();
  if (!browserPreloadRecordMatchesCurrentPage(record)) {
    return;
  }
  setTabStatus(record.tabId, {
    preload: job.status,
    preloadJob: job,
    error: job.error || ""
  });
}

function scheduleBrowserJobMirror(record) {
  if (!isCurrentBrowserPreloadRecord(record) || record.staleOffscreenOperationDetected ||
      !record?.job?.id || !record.runToken) {
    return null;
  }
  const snapshot = createBrowserJobLedgerSnapshot(record);
  browserJobMirrorPending.set(record.job.id, {
    snapshot,
    record,
    committedJob: cloneBrowserJobState(record.job)
  });
  return startBrowserJobMirrorFlush(record.job.id);
}

function createBrowserJobLedgerSnapshot(record) {
  const pageIdentity = normalizeBrowserPageIdentity(
    record.metadata?.pageUrl || record.job.metadata?.pageUrl || record.candidate?.pageUrl || ""
  );
  return {
    job: FuguangJobContract.createJobLedgerEntry(record, { pageIdentity }),
    chunks: FuguangJobContract.createChunkLedgerEntries(record)
  };
}

function startBrowserJobMirrorFlush(jobId) {
  if (browserJobMirrorActive.has(jobId)) {
    return browserJobMirrorActive.get(jobId);
  }
  const promise = Promise.resolve()
    .then(async () => {
      let result = null;
      while (browserJobMirrorPending.has(jobId)) {
        const pending = browserJobMirrorPending.get(jobId);
        browserJobMirrorPending.delete(jobId);
        result = await browserJobStore.putSnapshot(pending.snapshot);
        if (result?.applied !== false && isCurrentBrowserPreloadRecord(pending.record)) {
          pending.record.lastCommittedJob = cloneBrowserJobState(pending.committedJob);
        }
      }
      return result;
    })
    .catch(error => {
      console.warn("Failed to mirror browser job state.", error);
      return { applied: false, reason: "mirror-error" };
    })
    .finally(() => {
      browserJobMirrorActive.delete(jobId);
      if (browserJobMirrorPending.has(jobId)) {
        startBrowserJobMirrorFlush(jobId);
      }
    });
  browserJobMirrorActive.set(jobId, promise);
  return promise;
}

async function flushBrowserJobMirror(jobId) {
  while (browserJobMirrorPending.has(jobId) || browserJobMirrorActive.has(jobId)) {
    if (!browserJobMirrorActive.has(jobId)) {
      startBrowserJobMirrorFlush(jobId);
    }
    await browserJobMirrorActive.get(jobId);
  }
  return browserJobStore.getJob(jobId);
}

async function beginBrowserJobAttempt(record, stage) {
  if (!record?.job?.id) {
    throw new Error("任务缺少可重试的运行标识。请重新开始任务。");
  }
  if (record.attemptStartInFlight || ["queued", "running"].includes(String(record.job.status || ""))) {
    throw new Error("任务正在运行，已忽略重复的重试请求。");
  }
  record.attemptStartInFlight = true;
  try {
    const previousRunToken = String(record.runToken || record.job.runToken || createDurableRunToken());
    record.runToken = previousRunToken;
    record.job.runToken = previousRunToken;
    record.abortController ||= new AbortController();
    scheduleBrowserJobMirror(record);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
    const previousState = {
      cancelled: record.cancelled,
      cancelRequested: record.cancelRequested,
      abortController: record.abortController,
      jobStatus: record.job.status,
      jobStage: record.job.stage,
      jobCancelRequested: record.job.cancelRequested,
      jobCancelRequestedAt: record.job.cancelRequestedAt
    };
    const runToken = createDurableRunToken();
    record.runToken = runToken;
    record.cancelled = false;
    record.cancelRequested = false;
    record.abortController = new AbortController();
    record.job.runToken = runToken;
    record.job.status = "running";
    record.job.stage = stage;
    record.job.cancelRequested = false;
    record.job.updatedAt = Date.now();
    delete record.job.cancelRequestedAt;
    const snapshot = createBrowserJobLedgerSnapshot(record);
    const result = await browserJobStore.beginAttempt(snapshot, previousRunToken).catch(() => ({
      applied: false,
      reason: "unavailable"
    }));
    if (result.applied === false && !["unavailable", "stale-snapshot"].includes(result.reason)) {
      record.runToken = previousRunToken;
      record.cancelled = previousState.cancelled;
      record.cancelRequested = previousState.cancelRequested;
      record.abortController = previousState.abortController;
      record.job.runToken = previousRunToken;
      record.job.status = previousState.jobStatus;
      record.job.stage = previousState.jobStage;
      record.job.cancelRequested = previousState.jobCancelRequested;
      if (previousState.jobCancelRequestedAt == null) {
        delete record.job.cancelRequestedAt;
      } else {
        record.job.cancelRequestedAt = previousState.jobCancelRequestedAt;
      }
      throw new Error("任务已由另一个运行实例接管，请刷新状态后重试。");
    }
    previousState.abortController?.abort(new Error("任务已由新的执行尝试替换。"));
    return runToken;
  } finally {
    record.attemptStartInFlight = false;
  }
}

async function recoverBrowserJobIndex() {
  const ledgers = await browserJobStore.listRecoverableJobs();
  if (!ledgers.length) {
    return { recovered: 0 };
  }
  let recovered = 0;
  for (const ledger of ledgers) {
    if (!ledger?.id || !ledger.runToken || browserPreloadJobs.has(ledger.id)) {
      continue;
    }
    const chunks = await browserJobStore.getChunks(ledger.id, ledger.runToken);
    const modelResolution = await resolveRecoveredModelConfig(ledger);
    const record = recoverBrowserJobRecord(ledger, chunks, modelResolution.modelConfig, {
      recoveryError: modelResolution.error
    });
    browserPreloadJobs.set(ledger.id, record);
    scheduleBrowserJobMirror(record);
    await restoreRecoveredBrowserJobToTab(record);
    if (record.offscreenExecution) {
      scheduleBrowserJobLeaseRecovery(record, ledger.executionLeaseExpiresAt);
    }
    recovered += 1;
  }
  return { recovered };
}

async function resolveRecoveredModelConfig(ledger = {}) {
  if (!ledger.executionSpec?.fingerprint) {
    return {
      modelConfig: null,
      error: "任务来自旧版持久化格式，无法确认原始模型配置。请明确重试。"
    };
  }
  try {
    return { modelConfig: await getModelConfig(ledger.executionSpec), error: "" };
  } catch (error) {
    return {
      modelConfig: null,
      error: String(error?.message || error || "任务启动时的模型配置无法恢复。")
    };
  }
}

function recoverBrowserJobRecord(ledger, chunks = [], modelConfig = null, options = {}) {
  const chunkStatuses = [];
  const sourceSegmentsByChunk = new Map();
  const translatedSegmentsByChunk = new Map();
  const audioChunks = [];
  const browserAsrChunkToTranslationGroup = new Map();
  for (const chunk of chunks) {
    const index = Math.max(0, Number(chunk?.index) || 0);
    const entryType = String(chunk?.entryType || "legacy");
    if (entryType === "translation-group" || entryType === "legacy") {
      chunkStatuses[index] = recoverBrowserTranslationChunkStatus(chunk, index, ledger);
      if (Array.isArray(chunk.sourceSegments) && chunk.sourceSegments.length) {
        sourceSegmentsByChunk.set(index, chunk.sourceSegments);
      }
      if (Array.isArray(chunk.translatedSegments) && chunk.translatedSegments.length) {
        translatedSegmentsByChunk.set(index, chunk.translatedSegments);
      }
    }
    if (entryType === "audio-chunk" || (entryType === "legacy" && chunk.audioCacheRef)) {
      const audio = recoverBrowserAudioChunk(chunk, index);
      if (audio) {
        audioChunks.push(audio);
        browserAsrChunkToTranslationGroup.set(
          index,
          entryType === "audio-chunk"
            ? Math.max(0, Number(chunk.translationGroupIndex) || 0)
            : index
        );
      }
    }
  }
  const recoveryError = String(options.recoveryError || "");
  const offscreenExecutionActive = Boolean(
    !recoveryError &&
    !ledger.cancelRequested &&
    ledger.executionRunToken === ledger.runToken &&
    ledger.executionStartedAt &&
    ["queued", "running"].includes(String(ledger.status || ""))
  );
  const status = ledger.cancelRequested ? "cancelled" : (offscreenExecutionActive ? "running" : "interrupted");
  const metadata = { pageUrl: ledger.pageIdentity || "" };
  const job = {
    id: ledger.id,
    runToken: ledger.runToken,
    pipeline: ledger.pipeline || "browser",
    status,
    stage: status,
    source: ledger.source?.identity || "",
    sourceUrl: ledger.source?.identity || "",
    metadata,
    createdAt: Number(ledger.createdAt || Date.now()),
    updatedAt: Date.now(),
    cancelRequested: Boolean(ledger.cancelRequested),
    error: ledger.cancelRequested
      ? "任务已停止。"
      : (recoveryError || (offscreenExecutionActive
          ? ""
          : "浏览器后台重启中断了任务。已保留完成分段，可继续处理或重新抽取。")),
    extract: { ...(ledger.extract || {}) },
    translation: {
      ...(ledger.translation || {}),
      status,
      chunkStatuses,
      chunksTotal: Math.max(Number(ledger.translation?.total || 0) || 0, chunkStatuses.filter(Boolean).length)
    }
  };
  const source = collectChunkSegments(sourceSegmentsByChunk);
  const translated = collectChunkSegments(translatedSegmentsByChunk);
  const display = mergeTranslatedDisplaySegments(source, translated);
  job.translation.sourceSegments = source.length;
  job.translation.translatedSegments = translated.length;
  job.translation.segmentCount = display.length;
  job.translation.vttPath = display.length ? "browser-memory" : "";
  job.translation.vttText = display.length ? segmentsToVtt(display) : "";
  job.translation.transcript = { source, translated, metadata };
  const abortController = new AbortController();
  if (ledger.cancelRequested) {
    abortController.abort(new Error("任务已停止。"));
  }
  const record = {
    tabId: Number(ledger.tabId),
    runToken: ledger.runToken,
    candidate: {
      url: ledger.source?.identity || "",
      kind: ledger.source?.kind || "",
      ext: ledger.source?.ext || "",
      pageUrl: ledger.pageIdentity || ""
    },
    metadata,
    modelConfig: modelConfig || {
      asr: {},
      translation: {},
      targetLanguage: ledger.translation?.targetLanguage || "",
      asrWorkers: ledger.translation?.asrWorkers || 1,
      workers: ledger.translation?.translationWorkers || 1,
      chunkSeconds: ledger.extract?.chunkSeconds || 900,
      executionSpec: ledger.executionSpec || null
    },
    job,
    startedAt: Number(ledger.createdAt || Date.now()),
    cancelled: Boolean(ledger.cancelRequested),
    cancelRequested: Boolean(ledger.cancelRequested),
    abortController,
    sourceSegmentsByChunk,
    translatedSegmentsByChunk,
    browserAsrDiagnosticsByChunk: new Map(),
    browserAsrChunkSeconds: Number(ledger.extract?.asrChunkSeconds || 0) || 0,
    audioChunks,
    browserAsrChunkToTranslationGroup,
    pipeline: ledger.pipeline || "browser",
    offscreenExecution: offscreenExecutionActive,
    lastCommittedJob: cloneBrowserJobState(job),
    recoveryBlocked: Boolean(recoveryError),
    recoveryError,
    recovered: true
  };
  rebuildRecoveredBrowserTranslationGroups(record);
  return record;
}

function recoverBrowserTranslationChunkStatus(chunk, index, ledger) {
  return {
    index,
    stage: String(chunk.stage || "queued"),
    status: String(chunk.status || ""),
    attempts: Number(chunk.attempts || 0) || 0,
    sourceCount: Number(chunk.sourceCount || 0) || 0,
    translatedCount: Number(chunk.translatedCount || 0) || 0,
    asrFailures: Number(chunk.asrFailures || 0) || 0,
    translationFailures: Number(chunk.translationFailures || 0) || 0,
    message: String(chunk.message || ""),
    error: String(chunk.error || ""),
    updatedAt: Number(chunk.updatedAt || ledger.updatedAt || Date.now())
  };
}

function recoverBrowserAudioChunk(chunk, index) {
  const audioParts = (Array.isArray(chunk.audioParts) ? chunk.audioParts : [])
    .filter(part => part?.cacheRef)
    .map((part, fallbackIndex) => ({
      index: Number.isInteger(Number(part.index)) ? Number(part.index) : fallbackIndex,
      start: Number(part.start || 0) || 0,
      end: Number(part.end || 0) || 0,
      duration: Number(part.duration || 0) || 0,
      coreStart: Number(part.coreStart || part.start || 0) || 0,
      coreEnd: Number(part.coreEnd || part.end || 0) || 0,
      bytes: Number(part.bytes || 0) || 0,
      file: {
        name: String(part.name || filenameFromUrl(part.cacheRef)),
        mime: String(part.mime || "audio/mpeg"),
        cacheUrl: part.cacheRef,
        bytes: Number(part.bytes || 0) || 0
      }
    }));
  const cacheRefs = Array.isArray(chunk.audioCacheRefs)
    ? chunk.audioCacheRefs.filter(Boolean)
    : [];
  if (!audioParts.length && cacheRefs.length > 1) {
    for (const [partIndex, cacheRef] of cacheRefs.entries()) {
      audioParts.push({
        index: partIndex,
        start: 0,
        end: 0,
        duration: 0,
        coreStart: 0,
        coreEnd: 0,
        bytes: 0,
        file: {
          name: filenameFromUrl(cacheRef),
          mime: "audio/mpeg",
          cacheUrl: cacheRef
        }
      });
    }
  }
  const directCacheRef = String(chunk.audioCacheRef || cacheRefs[0] || audioParts[0]?.file?.cacheUrl || "");
  if (!directCacheRef) {
    return null;
  }
  const file = audioParts.length > 1
    ? {
        name: `logical-${String(index + 1).padStart(3, "0")}.mp3`,
        mime: "audio/mpeg",
        bytes: audioParts.reduce((sum, part) => sum + (Number(part.bytes || 0) || 0), 0),
        parts: audioParts
      }
    : (audioParts[0]?.file || {
        name: filenameFromUrl(directCacheRef),
        mime: "audio/mpeg",
        cacheUrl: directCacheRef
      });
  return {
    index,
    start: Number(chunk.audioStart || 0) || 0,
    end: Number(chunk.audioEnd || 0) || 0,
    duration: Number(chunk.audioDuration || 0) || 0,
    coreStart: Number(chunk.audioCoreStart || chunk.audioStart || 0) || 0,
    coreEnd: Number(chunk.audioCoreEnd || chunk.audioEnd || 0) || 0,
    file,
    asrCompleted: Boolean(chunk.asrCompleted),
    asrFailed: Boolean(chunk.asrFailed),
    asrError: String(chunk.asrError || ""),
    sourceSegments: Array.isArray(chunk.sourceSegments) ? chunk.sourceSegments : []
  };
}

function rebuildRecoveredBrowserTranslationGroups(record) {
  ensureBrowserChunkPipelineState(record);
  for (const chunk of record.audioChunks || []) {
    const groupIndex = record.browserAsrChunkToTranslationGroup.has(chunk.index)
      ? record.browserAsrChunkToTranslationGroup.get(chunk.index)
      : browserTranslationGroupIndex(record, chunk);
    record.browserAsrChunkToTranslationGroup.set(chunk.index, groupIndex);
    let group = record.browserTranslationGroups.get(groupIndex);
    if (!group) {
      const segmentSeconds = browserTranslationSegmentSeconds(record);
      group = {
        index: groupIndex,
        start: groupIndex * segmentSeconds,
        end: browserTranslationGroupTargetEnd(record, groupIndex),
        targetEnd: browserTranslationGroupTargetEnd(record, groupIndex),
        chunks: [],
        chunkIndexes: new Set(),
        total: 0,
        completed: 0,
        failed: 0,
        empty: 0,
        sourceSegments: [],
        errors: [],
        closed: true,
        translationQueued: false
      };
      record.browserTranslationGroups.set(groupIndex, group);
    }
    group.chunks.push(chunk);
    group.chunkIndexes.add(chunk.index);
    group.total += 1;
    group.start = Math.min(group.start, browserAudioChunkCoreStart(chunk));
    group.end = Math.max(group.end, browserAudioChunkCoreEnd(chunk));
    if (chunk.asrCompleted) {
      group.completed += 1;
      if (chunk.asrFailed) {
        group.failed += 1;
        if (chunk.asrError) {
          group.errors.push(chunk.asrError);
        }
      } else if (chunk.sourceSegments?.length) {
        group.sourceSegments.push(...chunk.sourceSegments);
      } else {
        group.empty += 1;
      }
    }
  }
  for (const [groupIndex, group] of record.browserTranslationGroups) {
    if (record.sourceSegmentsByChunk.has(groupIndex)) {
      group.sourceSegments = record.sourceSegmentsByChunk.get(groupIndex);
    }
    const stage = String(record.job.translation?.chunkStatuses?.[groupIndex]?.stage || "");
    group.translationQueued = ["asr_done", "translation", "completed", "completed_with_warnings", "failed"].includes(stage);
    if (group.translationQueued && group.completed < group.total) {
      group.completed = group.total;
    }
  }
}

async function restoreRecoveredBrowserJobToTab(record) {
  if (!Number.isInteger(record.tabId) || record.tabId < 0) {
    return;
  }
  const tab = await chrome.tabs.get(record.tabId).catch(() => null);
  if (!tab || !browserPageIdentitiesMatch(record.metadata?.pageUrl || "", tab.url || "")) {
    return;
  }
  setTabStatus(record.tabId, {
    preload: record.job.status,
    preloadJob: record.job,
    error: record.job.error || "",
    page: { url: tab.url || "", title: tab.title || "" }
  });
}

async function startBrowserJobInOffscreen(record, options = {}) {
  if (!record?.job?.id || !record.runToken || typeof chrome.runtime?.connect !== "function") {
    return { status: "unavailable", reason: "runtime-unavailable" };
  }
  const resumeExisting = Boolean(options.resumeExisting);
  record.offscreenExecution = true;
  if (!resumeExisting) {
    scheduleBrowserJobMirror(record);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
  }
  const startSnapshot = resumeExisting
    ? { job: { id: record.job.id, runToken: record.runToken }, chunks: [] }
    : createBrowserJobLedgerSnapshot(record);
  const startJob = resumeExisting ? null : cloneBrowserJobState(record.job);
  try {
    const response = await sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.START_JOB, {
      snapshot: startSnapshot,
      resumeExisting,
      runtime: {
        pipeline: record.pipeline || record.job.pipeline || "browser",
        asrWorkers: record.pipeline === "funasr"
          ? 1
          : Math.max(1, Number(record.modelConfig?.asrWorkers || 1) || 1)
      }
    });
    if (response?.accepted) {
      if (!resumeExisting && response.snapshotApplied) {
        record.lastCommittedJob = startJob;
      }
      const result = {
        status: "started",
        duplicate: Boolean(response.duplicate),
        executionOwnerId: String(response.executionOwnerId || ""),
        executionEpoch: Number(response.executionEpoch || 0) || 0,
        executionLeaseExpiresAt: Number(response.executionLeaseExpiresAt || 0) || 0
      };
      scheduleBrowserJobLeaseRecovery(record, result.executionLeaseExpiresAt);
      return result;
    }
    record.offscreenExecution = false;
    if (response?.retryable) {
      return { status: "unknown", reason: String(response?.reason || "start-retryable") };
    }
    return { status: "unavailable", reason: String(response?.reason || "start-rejected") };
  } catch (error) {
    if (error?.deliveryUnknown) {
      scheduleBrowserJobLeaseRecovery(record, Date.now() + BROWSER_JOB_EXECUTION_LEASE_MS);
      return { status: "unknown", reason: "ack-timeout" };
    }
    record.offscreenExecution = false;
    if (error?.retryable) {
      return { status: "unknown", reason: String(error.reason || "start-retryable") };
    }
    return {
      status: "unavailable",
      reason: String(error?.reason || error?.message || error || "runtime-unavailable")
    };
  }
}

async function resolveBrowserJobExecutionOwner(record, offscreenStart = {}) {
  if (offscreenStart.status === "started") {
    return "offscreen";
  }
  const claim = await claimBrowserJobForLocalExecution(record);
  if (claim.applied) {
    record.offscreenExecution = false;
    return "local";
  }
  if (claim.reason === "duplicate-run") {
    record.offscreenExecution = true;
    return "offscreen";
  }
  if (["unavailable", "missing-job"].includes(claim.reason) && offscreenStart.status === "unavailable") {
    record.offscreenExecution = false;
    record.localExecutionUnleased = true;
    return "local";
  }
  if (offscreenStart.status === "unknown") {
    record.offscreenExecution = true;
    return "offscreen";
  }
  throw new Error("无法确认后台任务的唯一执行所有权，请重试。");
}

async function claimBrowserJobForLocalExecution(record) {
  const claim = await browserJobStore.claimRun(record.job.id, record.runToken, {
    ownerId: serviceWorkerExecutionOwnerId,
    claimedAt: Date.now(),
    leaseDurationMs: BROWSER_JOB_EXECUTION_LEASE_MS
  }).catch(() => ({ applied: false, reason: "unavailable" }));
  if (!claim.applied) {
    return claim;
  }
  stopLocalBrowserExecutionHeartbeat(record);
  const lease = {
    ownerId: serviceWorkerExecutionOwnerId,
    runToken: String(record.runToken || ""),
    executionEpoch: Number(claim.job?.executionEpoch || 0) || 0,
    heartbeatInFlight: false,
    expiresAt: Number(claim.job?.executionLeaseExpiresAt || 0) || 0,
    timer: null
  };
  lease.timer = setInterval(async () => {
    if (lease.heartbeatInFlight || String(record.runToken || "") !== lease.runToken) {
      return;
    }
    lease.heartbeatInFlight = true;
    try {
      const result = await browserJobStore.renewRunLease(
        record.job.id,
        lease.runToken,
        lease.ownerId,
        Date.now(),
        BROWSER_JOB_EXECUTION_LEASE_MS,
        lease.executionEpoch
      );
      if (!result.applied) {
        stopLocalBrowserExecutionHeartbeat(record);
        record.abortController?.abort?.(new Error("任务执行租约已被其他运行实例接管。"));
      } else {
        lease.expiresAt = Number(result.job?.executionLeaseExpiresAt || 0) || lease.expiresAt;
      }
    } catch {
      if (lease.expiresAt && Date.now() >= lease.expiresAt) {
        stopLocalBrowserExecutionHeartbeat(record);
        record.abortController?.abort?.(new Error("任务执行租约续期失败，已停止旧运行实例。"));
      }
    } finally {
      lease.heartbeatInFlight = false;
    }
  }, BROWSER_JOB_EXECUTION_HEARTBEAT_MS);
  record.localExecutionLease = lease;
  scheduleBrowserJobLeaseRecovery(record, Number(claim.job?.executionLeaseExpiresAt || 0));
  delete record.localExecutionUnleased;
  return claim;
}

function adoptDurableTerminalBrowserJob(record, durable) {
  const jobId = String(durable?.id || record?.job?.id || "");
  if (!jobId || browserPreloadJobs.get(jobId) !== record) {
    return browserPreloadJobs.get(jobId) || null;
  }
  browserJobMirrorPending.delete(jobId);
  stopLocalBrowserExecutionHeartbeat(record);
  delete record.localExecutionUnleased;
  record.abortController?.abort?.(new Error("任务已收敛到持久化终态。"));
  cancelBrowserRecordQueues(record);

  const durableStatus = String(durable.status || record.job?.status || "failed");
  const nextJob = {
    ...(record.job || {}),
    id: jobId,
    runToken: String(durable.runToken || record.runToken || record.job?.runToken || ""),
    pipeline: String(durable.pipeline || record.pipeline || record.job?.pipeline || "browser"),
    status: durableStatus,
    stage: String(durable.stage || durableStatus),
    cancelRequested: Boolean(durable.cancelRequested),
    createdAt: Number(durable.createdAt || record.job?.createdAt || Date.now()),
    updatedAt: Number(durable.updatedAt || record.job?.updatedAt || Date.now()),
    error: String(durable.error || ""),
    extract: {
      ...(record.job?.extract || {}),
      ...(durable.extract || {})
    },
    translation: {
      ...(record.job?.translation || {}),
      ...(durable.translation || {})
    }
  };
  record.job = cloneBrowserJobState(nextJob);
  record.lastCommittedJob = cloneBrowserJobState(nextJob);
  record.staleOffscreenOperationDetected = true;
  record.offscreenExecution = false;

  const replacement = {
    ...record,
    job: cloneBrowserJobState(nextJob),
    lastCommittedJob: cloneBrowserJobState(nextJob),
    abortController: new AbortController(),
    cancelRequested: Boolean(durable.cancelRequested),
    cancelled: durableStatus === "cancelled" || Boolean(durable.cancelRequested),
    offscreenExecution: false,
    recovered: true
  };
  delete replacement.staleOffscreenOperationDetected;
  delete replacement.localExecutionLease;
  delete replacement.localExecutionUnleased;
  delete replacement.browserPipelinePromise;
  delete replacement.browserFunAsrPipelinePromise;
  if (replacement.cancelled) {
    replacement.abortController.abort(new Error("任务已停止。"));
  }
  browserPreloadJobs.set(jobId, replacement);
  publishBrowserPreloadJobUi(replacement, replacement.job);
  return replacement;
}

function scheduleBrowserJobLeaseRecovery(record, leaseExpiresAt = 0, effectiveStatus = record?.job?.status) {
  const jobId = String(record?.job?.id || "");
  if (!jobId || FuguangJobContract.isTerminalStatus(effectiveStatus) || record?.cancelRequested) {
    return;
  }
  const requestedExpiry = Number(leaseExpiresAt || 0) || 0;
  const when = Math.max(Date.now() + 1000, requestedExpiry ? requestedExpiry + 250 : Date.now() + 1000);
  try {
    const created = chrome.alarms?.create?.(`${BROWSER_JOB_LEASE_RECOVERY_ALARM_PREFIX}${jobId}`, { when });
    created?.catch?.(() => {});
  } catch {
    // A later status request or Service Worker restart will retry recovery.
  }
}

async function recoverExpiredBrowserJobLease(jobId) {
  await browserJobRecoveryPromise;
  const record = browserPreloadJobs.get(String(jobId || ""));
  if (!record || record.cancelRequested) {
    return { recovered: false, reason: "inactive" };
  }
  if (!record.staleOffscreenOperationDetected && FuguangJobContract.isTerminalStatus(record.job?.status)) {
    return { recovered: false, reason: "inactive" };
  }
  if (record.recoveryBlocked) {
    return { recovered: false, reason: "configuration-unavailable" };
  }
  let durable;
  try {
    durable = await browserJobStore.getJob(record.job.id);
  } catch {
    const effectiveStatus = record.lastCommittedJob?.status ||
      (record.staleOffscreenOperationDetected ? "running" : record.job?.status);
    scheduleBrowserJobLeaseRecovery(
      record,
      Date.now() + BROWSER_JOB_EXECUTION_LEASE_MS,
      effectiveStatus
    );
    return { recovered: false, reason: "durable-read-error" };
  }
  if (!durable) {
    return { recovered: false, reason: "missing-job" };
  }
  if (String(durable.runToken || "") !== String(record.runToken || "")) {
    return { recovered: false, reason: "stale-run" };
  }
  if (FuguangJobContract.isTerminalStatus(durable.status)) {
    adoptDurableTerminalBrowserJob(record, durable);
    return { recovered: false, reason: "inactive" };
  }
  const now = Date.now();
  const leaseExpiresAt = Number(durable.executionLeaseExpiresAt || 0) || 0;
  if (leaseExpiresAt > now) {
    scheduleBrowserJobLeaseRecovery(record, leaseExpiresAt, durable.status);
    return { recovered: false, reason: "lease-active" };
  }
  if (String(durable.extract?.status || "") !== "completed") {
    const interruption = await interruptRecoveredBrowserJob(
      record,
      durable,
      "offscreen 执行器在音频抽取完成前中断。请重新抽取。"
    );
    return {
      recovered: false,
      reason: interruption.interrupted ? "extraction-interrupted" : interruption.reason
    };
  }
  const localExecutionMayStillBeSettling = Boolean(
    record.localExecutionLease ||
    record.localExecutionUnleased ||
    (record.abortController?.signal?.aborted &&
      (record.browserPipelinePromise || record.browserFunAsrPipelinePromise))
  );
  if (localExecutionMayStillBeSettling) {
    record.abortController?.abort?.(new Error("本地执行租约已失效，已停止自动接管。"));
    cancelBrowserRecordQueues(record);
    const interruption = await interruptRecoveredBrowserJob(
      record,
      durable,
      "本地执行租约已失效。为避免与 offscreen 重叠处理，已中断任务；请明确重试。"
    );
    return {
      recovered: false,
      reason: interruption.interrupted ? "local-execution-interrupted" : interruption.reason
    };
  }
  const start = await startBrowserJobInOffscreen(record, { resumeExisting: true });
  if (start.status === "started") {
    scheduleBrowserJobLeaseRecovery(
      record,
      Number(start.executionLeaseExpiresAt || 0) || (now + BROWSER_JOB_EXECUTION_LEASE_MS),
      durable.status
    );
    return { recovered: true, duplicate: Boolean(start.duplicate) };
  }
  if (start.status === "unknown") {
    scheduleBrowserJobLeaseRecovery(record, now + BROWSER_JOB_EXECUTION_LEASE_MS, durable.status);
    return { recovered: false, reason: "start-unknown" };
  }
  const interruption = await interruptRecoveredBrowserJob(
    record,
    durable,
    "offscreen 执行器无法恢复。已保留完成分段，请明确重试。"
  );
  return {
    recovered: false,
    reason: interruption.interrupted ? "runtime-unavailable" : interruption.reason
  };
}

async function interruptRecoveredBrowserJob(record, durable, message) {
  let latest;
  try {
    latest = await browserJobStore.getJob(record.job.id);
  } catch {
    scheduleBrowserJobLeaseRecovery(
      record,
      Date.now() + BROWSER_JOB_EXECUTION_LEASE_MS,
      durable?.status
    );
    return { interrupted: false, reason: "durable-read-error" };
  }
  if (!latest) {
    return { interrupted: false, reason: "missing-job" };
  }
  if (String(latest.runToken || "") !== String(record.runToken || "")) {
    return { interrupted: false, reason: "stale-run" };
  }
  if (FuguangJobContract.isTerminalStatus(latest.status)) {
    adoptDurableTerminalBrowserJob(record, latest);
    return { interrupted: false, reason: "inactive" };
  }
  const leaseExpiresAt = Number(latest.executionLeaseExpiresAt || 0) || 0;
  const leaseChanged =
    String(latest.executionOwnerId || "") !== String(durable?.executionOwnerId || "") ||
    Number(latest.executionEpoch || 0) !== Number(durable?.executionEpoch || 0);
  if (leaseExpiresAt > Date.now() || leaseChanged) {
    scheduleBrowserJobLeaseRecovery(record, leaseExpiresAt, latest.status);
    return {
      interrupted: false,
      reason: leaseExpiresAt > Date.now() ? "lease-active" : "lease-changed"
    };
  }

  record.offscreenExecution = false;
  record.job.status = "interrupted";
  record.job.stage = "interrupted";
  record.job.error = message;
  record.job.updatedAt = Date.now();
  publishBrowserPreloadJob(record);
  const mirrored = await flushBrowserJobMirror(record.job.id).catch(() => null);
  if (
    mirrored &&
    String(mirrored.runToken || "") === String(record.runToken || "") &&
    FuguangJobContract.isTerminalStatus(mirrored.status)
  ) {
    adoptDurableTerminalBrowserJob(record, mirrored);
    return { interrupted: false, reason: "inactive" };
  }
  if (latest.executionOwnerId) {
    await browserJobStore.releaseRun(
      record.job.id,
      record.runToken,
      latest.executionOwnerId,
      Date.now(),
      Number(latest.executionEpoch || 0) || 0
    ).catch(() => null);
  }
  return { interrupted: true, reason: "interrupted" };
}

function stopLocalBrowserExecutionHeartbeat(record) {
  if (record?.localExecutionLease?.timer != null) {
    clearInterval(record.localExecutionLease.timer);
  }
  if (record) {
    delete record.localExecutionLease;
  }
}

async function releaseLocalBrowserExecutionLease(record) {
  const lease = record?.localExecutionLease;
  stopLocalBrowserExecutionHeartbeat(record);
  if (record) {
    delete record.localExecutionUnleased;
  }
  if (!lease) {
    return { applied: false, reason: "not-owned" };
  }
  return browserJobStore.releaseRun(
    record.job.id,
    lease.runToken,
    lease.ownerId,
    Date.now(),
    lease.executionEpoch
  ).catch(() => ({ applied: false, reason: "unavailable" }));
}

async function processOffscreenBrowserJobChunk(message = {}) {
  await browserJobRecoveryPromise;
  let fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true };
  }
  if (record.recoveryBlocked) {
    return { accepted: false, interrupted: true, error: record.recoveryError || record.job?.error || "任务配置无法恢复。" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const takeoverInterruption = await interruptBrowserJobForStaleOffscreenOperation(record, fence);
  if (takeoverInterruption) {
    return takeoverInterruption;
  }
  await flushBrowserJobMirror(record.job.id).catch(() => null);
  fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  if (record.staleOffscreenOperationDetected) {
    return interruptBrowserJobForStaleOffscreenOperation(record, fence);
  }
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const chunk = (record.audioChunks || []).find(item => Number(item?.index) === index);
  if (!chunk) {
    throw new Error(`Offscreen task audio chunk ${index} is unavailable.`);
  }
  if (chunk.asrCompleted) {
    return { accepted: true, duplicate: true, chunkIndex: index };
  }
  if (hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index)) {
    return { accepted: true, duplicate: true, inProgress: true, chunkIndex: index };
  }
  const operationKey = offscreenBrowserChunkOperationKey(
    record.job.id,
    record.runToken,
    fence.executionEpoch,
    index
  );
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index });
  offscreenBrowserChunkOperations.set(operationKey, operation);
  try {
    record.offscreenExecution = true;
    record.job.status = "running";
    record.job.stage = "asr";
    if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
      await processBrowserFunAsrChunk(record, chunk, {
        labelSpeakers: browserFunAsrShouldLabelSpeakers(record),
        operation,
        runToken: operation.runToken,
        signal: operation.controller.signal
      });
    } else {
      const operationOptions = {
        operation,
        runToken: operation.runToken,
        signal: operation.controller.signal
      };
      await processBrowserAsrChunk(record, chunk, operationOptions);
      await drainBrowserTranslationQueue(record, operationOptions);
    }
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) {
      return {
        accepted: false,
        stale: true,
        retryable: Boolean(committed.retryable),
        reason: committed.reason || "stale-execution",
        error: committed.error || ""
      };
    }
    return { accepted: true, chunkIndex: index };
  } finally {
    if (offscreenBrowserChunkOperations.get(operationKey) === operation) {
      offscreenBrowserChunkOperations.delete(operationKey);
    }
    disposeOffscreenBrowserOperation(record, operation);
  }
}

async function getOffscreenBrowserJobWork(message = {}) {
  await browserJobRecoveryPromise;
  const fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true };
  }
  if (record.recoveryBlocked) {
    return {
      accepted: false,
      interrupted: true,
      terminal: true,
      error: record.recoveryError || record.job?.error || "任务配置无法恢复。"
    };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const takeoverInterruption = await interruptBrowserJobForStaleOffscreenOperation(record, fence);
  if (takeoverInterruption) {
    return takeoverInterruption;
  }
  const terminal = FuguangJobContract.isTerminalStatus(record.job?.status);
  return {
    accepted: true,
    terminal,
    extractionDone: ["completed", "failed"].includes(String(record.job?.extract?.status || "")),
    chunks: (record.audioChunks || []).map(chunk => ({
      index: Number(chunk?.index || 0),
      asrCompleted: Boolean(chunk?.asrCompleted),
      processing: hasOffscreenBrowserChunkOperation(
        record.job.id,
        record.runToken,
        Number(chunk?.index || 0)
      )
    }))
  };
}

async function validateOffscreenExecutionFence(message = {}, options = {}) {
  const jobId = String(message.jobId || "");
  const runToken = String(message.runToken || "");
  const executionOwnerId = String(message.executionOwnerId || "");
  const executionEpoch = Math.max(0, Number(message.executionEpoch || 0) || 0);
  if (!jobId || !runToken || !executionOwnerId || !executionEpoch) {
    return { valid: false, reason: "missing-execution-fence" };
  }
  const durable = await browserJobStore.getJob(jobId).catch(() => null);
  if (!durable || String(durable.runToken || "") !== runToken) {
    return { valid: false, reason: "stale-run" };
  }
  if (String(durable.executionOwnerId || "") !== executionOwnerId) {
    return { valid: false, reason: "stale-owner" };
  }
  if (Number(durable.executionEpoch || 0) !== executionEpoch) {
    return { valid: false, reason: "stale-epoch" };
  }
  if (Number(durable.executionLeaseExpiresAt || 0) <= Date.now()) {
    return { valid: false, reason: "expired-lease" };
  }
  if (options.fenceStaleOperations !== false) {
    fenceStaleOffscreenBrowserOperations(jobId, runToken, executionOwnerId, executionEpoch);
  }
  return { valid: true, durable, executionOwnerId, executionEpoch };
}

function offscreenBrowserChunkOperationKey(jobId, runToken, executionEpoch, chunkIndex) {
  return `${String(jobId || "")}:${String(runToken || "")}:${Math.max(0, Number(executionEpoch) || 0)}:${Math.max(0, Number(chunkIndex) || 0)}`;
}

function offscreenBrowserFinalizationOperationKey(jobId, runToken, executionEpoch) {
  return `${String(jobId || "")}:${String(runToken || "")}:${Math.max(0, Number(executionEpoch) || 0)}:finalize`;
}

function fenceStaleOffscreenBrowserOperations(jobId, runToken, executionOwnerId, executionEpoch) {
  let fencedActiveOperation = false;
  for (const operations of [offscreenBrowserChunkOperations, offscreenBrowserFinalizationOperations]) {
    for (const [key, operation] of operations) {
      if (String(operation?.jobId || "") !== String(jobId || "") ||
          String(operation?.runToken || "") !== String(runToken || "")) {
        continue;
      }
      if (String(operation.executionOwnerId || "") === String(executionOwnerId || "") &&
          Number(operation.executionEpoch || 0) === Number(executionEpoch || 0)) {
        continue;
      }
      fencedActiveOperation = true;
      markOffscreenBrowserOperationStale(operation, "任务执行权已由新的 epoch 接管。");
      if (operations.get(key) === operation) {
        operations.delete(key);
      }
    }
  }
  if (fencedActiveOperation) {
    const record = browserPreloadJobs.get(String(jobId || ""));
    if (record && String(record.runToken || "") === String(runToken || "")) {
      record.staleOffscreenOperationDetected = true;
    }
  }
}

function abortOffscreenBrowserChunkOperations(jobId, runToken, executionOwnerId, executionEpoch, message) {
  for (const [key, operation] of offscreenBrowserChunkOperations) {
    if (String(operation?.jobId || "") !== String(jobId || "") ||
        String(operation?.runToken || "") !== String(runToken || "") ||
        String(operation?.executionOwnerId || "") !== String(executionOwnerId || "") ||
        Number(operation?.executionEpoch || 0) !== Number(executionEpoch || 0)) {
      continue;
    }
    markOffscreenBrowserOperationStale(operation, message);
    if (offscreenBrowserChunkOperations.get(key) === operation) {
      offscreenBrowserChunkOperations.delete(key);
    }
  }
}

function createOffscreenBrowserOperation(record, fence, details = {}) {
  const controller = new AbortController();
  const operation = {
    jobId: String(record?.job?.id || ""),
    runToken: String(record?.runToken || ""),
    executionOwnerId: String(fence?.executionOwnerId || ""),
    executionEpoch: Number(fence?.executionEpoch || 0) || 0,
    chunkIndex: Number.isInteger(Number(details.chunkIndex)) ? Number(details.chunkIndex) : null,
    controller,
    stale: false,
    recordAbortListener: null
  };
  const recordSignal = record?.abortController?.signal;
  if (recordSignal?.aborted) {
    controller.abort(recordSignal.reason);
  } else if (recordSignal?.addEventListener) {
    operation.recordAbortListener = () => controller.abort(recordSignal.reason || new Error("任务已停止。"));
    recordSignal.addEventListener("abort", operation.recordAbortListener, { once: true });
  }
  record.offscreenMirrorSuppressionCount = Math.max(0, Number(record.offscreenMirrorSuppressionCount || 0)) + 1;
  return operation;
}

function disposeOffscreenBrowserOperation(record, operation) {
  const recordSignal = record?.abortController?.signal;
  if (operation?.recordAbortListener) {
    recordSignal?.removeEventListener?.("abort", operation.recordAbortListener);
  }
  if (record) {
    record.offscreenMirrorSuppressionCount = Math.max(0, Number(record.offscreenMirrorSuppressionCount || 0) - 1);
    if (!record.offscreenMirrorSuppressionCount) {
      delete record.offscreenMirrorSuppressionCount;
    }
  }
}

function markOffscreenBrowserOperationStale(operation, message = "任务执行权已失效。") {
  if (!operation || operation.stale) {
    return;
  }
  operation.stale = true;
  const error = new Error(message);
  error.name = "AbortError";
  operation.controller?.abort?.(error);
}

function hasOffscreenBrowserChunkOperation(jobId, runToken, chunkIndex = null) {
  for (const operation of offscreenBrowserChunkOperations.values()) {
    if (String(operation?.jobId || "") !== String(jobId || "") ||
        String(operation?.runToken || "") !== String(runToken || "")) {
      continue;
    }
    if (chunkIndex == null || Number(operation.chunkIndex) === Number(chunkIndex)) {
      return true;
    }
  }
  return false;
}

async function commitOffscreenBrowserRecord(record, operation) {
  if (record?.staleOffscreenOperationDetected) {
    markOffscreenBrowserOperationStale(operation, "共享任务状态已被在途失败标记为不可提交。");
    return { applied: false, reason: "dirty-runtime-state" };
  }
  if (!await isBrowserExecutionOperationActive(record, operation?.runToken, operation)) {
    return { applied: false, reason: "stale-execution" };
  }
  refreshBrowserPreloadJobSummary(record);
  const snapshot = createBrowserJobLedgerSnapshot(record);
  const committedJob = cloneBrowserJobState(record.job);
  let result;
  try {
    result = await browserJobStore.putSnapshotIfOwned(
      snapshot,
      {
        executionOwnerId: operation.executionOwnerId,
        executionEpoch: operation.executionEpoch,
        checkedAt: Date.now()
      }
    );
  } catch (error) {
    record.staleOffscreenOperationDetected = true;
    markOffscreenBrowserOperationStale(operation, "任务状态提交失败，当前内存草稿已失效。");
    return {
      applied: false,
      reason: "owned-write-error",
      retryable: true,
      error: String(error?.message || error || "Owned snapshot write failed.")
    };
  }
  if (!result.applied) {
    record.staleOffscreenOperationDetected = true;
    markOffscreenBrowserOperationStale(operation, "任务执行状态已在提交前失效。");
    return result;
  }
  record.lastCommittedJob = committedJob;
  publishBrowserPreloadJobUi(record, committedJob);
  await attachBrowserJobVttIfReady(record, committedJob).catch(() => {});
  return result;
}

async function interruptBrowserJobForStaleOffscreenOperation(record, fence) {
  if (!record?.staleOffscreenOperationDetected) {
    return null;
  }
  const message = "旧执行实例在租约接管时仍有在途操作。为避免迟到结果污染新执行，任务已中断；请明确重试。";
  let durableSnapshot;
  try {
    durableSnapshot = await browserJobStore.getSnapshot(record.job.id, record.runToken);
  } catch (error) {
    return {
      accepted: false,
      stale: true,
      retryable: true,
      reason: "snapshot-read-error",
      error: String(error?.message || error || "Durable snapshot read failed.")
    };
  }
  const durable = durableSnapshot?.job;
  const durableChunks = Array.isArray(durableSnapshot?.chunks) ? durableSnapshot.chunks : [];
  if (!durable || String(durable.runToken || "") !== String(record.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  const cleanRecord = recoverBrowserJobRecord(durable, durableChunks, record.modelConfig);
  cleanRecord.tabId = Number.isInteger(Number(record.tabId)) ? Number(record.tabId) : cleanRecord.tabId;
  const nextJob = {
    ...cleanRecord.job,
    status: "interrupted",
    stage: "interrupted",
    error: message,
    updatedAt: Date.now()
  };
  const draft = { ...cleanRecord, offscreenExecution: false, job: nextJob };
  refreshBrowserPreloadJobSummary(draft);
  let committed;
  try {
    committed = await browserJobStore.putSnapshotIfOwned(
      createBrowserJobLedgerSnapshot(draft),
      {
        executionOwnerId: fence.executionOwnerId,
        executionEpoch: fence.executionEpoch,
        checkedAt: Date.now()
      }
    );
  } catch (error) {
    return {
      accepted: false,
      stale: true,
      retryable: true,
      reason: "owned-write-error",
      error: String(error?.message || error || "Interrupted snapshot write failed.")
    };
  }
  if (!committed.applied) {
    return { accepted: false, stale: true, reason: committed.reason || "stale-execution" };
  }
  supersedeBrowserPreloadRecord(record, message);
  browserJobMirrorPending.delete(cleanRecord.job.id);
  cleanRecord.offscreenExecution = false;
  cleanRecord.job = nextJob;
  cleanRecord.lastCommittedJob = cloneBrowserJobState(nextJob);
  delete cleanRecord.staleOffscreenOperationDetected;
  browserPreloadJobs.set(cleanRecord.job.id, cleanRecord);
  publishBrowserPreloadJobUi(cleanRecord, cleanRecord.lastCommittedJob);
  return { accepted: false, interrupted: true, terminal: true, error: message, job: cleanRecord.job };
}

async function drainBrowserTranslationQueue(record, options = {}) {
  ensureBrowserChunkPipelineState(record);
  while (record.browserTranslationQueue.items.length) {
    const payload = record.browserTranslationQueue.items.shift();
    if (!payload || isBrowserRunInactive(record, record?.runToken, options.operation || null)) {
      break;
    }
    await processBrowserTranslationChunk(record, payload.chunk, payload.sourceSegments, options);
  }
}

async function finalizeOffscreenBrowserJob(message = {}) {
  await browserJobRecoveryPromise;
  let fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true };
  }
  if (record.recoveryBlocked) {
    return { accepted: false, interrupted: true, error: record.recoveryError || record.job?.error || "任务配置无法恢复。" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const takeoverInterruption = await interruptBrowserJobForStaleOffscreenOperation(record, fence);
  if (takeoverInterruption) {
    return takeoverInterruption;
  }
  await flushBrowserJobMirror(record.job.id).catch(() => null);
  fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  if (record.staleOffscreenOperationDetected) {
    return interruptBrowserJobForStaleOffscreenOperation(record, fence);
  }
  if (FuguangJobContract.isTerminalStatus(record.job?.status)) {
    return { accepted: true, duplicate: true, job: record.job };
  }
  if (hasOffscreenBrowserChunkOperation(record.job.id, record.runToken)) {
    return { accepted: true, inProgress: true };
  }
  const operationKey = offscreenBrowserFinalizationOperationKey(
    record.job.id,
    record.runToken,
    fence.executionEpoch
  );
  if (offscreenBrowserFinalizationOperations.has(operationKey)) {
    return { accepted: true, duplicate: true, inProgress: true };
  }
  const operation = createOffscreenBrowserOperation(record, fence);
  offscreenBrowserFinalizationOperations.set(operationKey, operation);
  try {
  if ((record.audioChunks || []).some(chunk => !chunk.asrCompleted)) {
    return { accepted: true, inProgress: true };
  }
  if (record.pipeline !== "funasr" && record.job?.pipeline !== "funasr") {
    closeAllBrowserTranslationGroups(record);
    await drainBrowserTranslationQueue(record, {
      operation,
      runToken: operation.runToken,
      signal: operation.controller.signal
    });
  }
  if (!await isBrowserExecutionOperationActive(record, operation.runToken, operation)) {
    return { accepted: false, stale: true, reason: "stale-execution" };
  }
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  record.offscreenExecution = false;
  const committed = await commitOffscreenBrowserRecord(record, operation);
  if (!committed.applied) {
    return {
      accepted: false,
      stale: true,
      retryable: Boolean(committed.retryable),
      reason: committed.reason || "stale-execution",
      error: committed.error || ""
    };
  }
  let releasedAudioChunks = 0;
  if (browserCompletionAllowsAudioRelease(completion)) {
    releasedAudioChunks = await releaseBrowserAudioChunks(record);
  }
  if (releasedAudioChunks) {
    const cleanupCommitted = await commitOffscreenBrowserRecord(record, operation);
    if (!cleanupCommitted.applied) {
      return {
        accepted: false,
        stale: true,
        retryable: Boolean(cleanupCommitted.retryable),
        reason: cleanupCommitted.reason || "stale-execution",
        error: cleanupCommitted.error || ""
      };
    }
  }
  return { accepted: true, job: record.job };
  } finally {
    if (offscreenBrowserFinalizationOperations.get(operationKey) === operation) {
      offscreenBrowserFinalizationOperations.delete(operationKey);
    }
    disposeOffscreenBrowserOperation(record, operation);
  }
}

async function failOffscreenBrowserJob(message = {}) {
  await browserJobRecoveryPromise;
  const fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true };
  }
  if (record.recoveryBlocked) {
    return { accepted: false, interrupted: true, error: record.recoveryError || record.job?.error || "任务配置无法恢复。" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const takeoverInterruption = await interruptBrowserJobForStaleOffscreenOperation(record, fence);
  if (takeoverInterruption) {
    return takeoverInterruption;
  }
  if (FuguangJobContract.isTerminalStatus(record.job?.status)) {
    return { accepted: true, duplicate: true, job: record.job };
  }
  abortOffscreenBrowserChunkOperations(
    record.job.id,
    record.runToken,
    fence.executionOwnerId,
    fence.executionEpoch,
    "当前 offscreen 执行已进入失败终态。"
  );
  const nextJob = {
    ...record.job,
    status: "failed",
    stage: "failed",
    error: String(message.error || "Offscreen task execution failed."),
    updatedAt: Date.now()
  };
  const draft = { ...record, offscreenExecution: false, job: nextJob };
  refreshBrowserPreloadJobSummary(draft);
  const committedJob = cloneBrowserJobState(nextJob);
  let committed;
  try {
    committed = await browserJobStore.putSnapshotIfOwned(
      createBrowserJobLedgerSnapshot(draft),
      {
        executionOwnerId: fence.executionOwnerId,
        executionEpoch: fence.executionEpoch,
        checkedAt: Date.now()
      }
    );
  } catch (error) {
    return {
      accepted: false,
      stale: true,
      retryable: true,
      reason: "owned-write-error",
      error: String(error?.message || error || "Failed snapshot write failed.")
    };
  }
  if (!committed.applied) {
    return { accepted: false, stale: true, reason: committed.reason || "stale-execution" };
  }
  record.offscreenExecution = false;
  record.job = nextJob;
  record.lastCommittedJob = committedJob;
  publishBrowserPreloadJobUi(record, committedJob);
  return { accepted: true, job: record.job };
}

async function observeBrowserJobInOffscreen(record) {
  if (!record?.job?.id || !record.runToken || typeof chrome.runtime?.connect !== "function") {
    return { accepted: false, reason: "unavailable" };
  }
  return sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.OBSERVE_JOB, {
    snapshot: createBrowserJobLedgerSnapshot(record)
  });
}

async function sendOffscreenTaskRuntimeCommand(type, payload = {}, timeoutMs = 5000) {
  const port = await ensureOffscreenTaskRuntimePort();
  if (!port) {
    return { accepted: false, reason: "unavailable" };
  }
  const commandId = FuguangTaskRuntimeProtocol.createCommandId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      offscreenTaskRuntimeCommands.delete(commandId);
      const error = new Error("Offscreen task runtime command timed out.");
      error.deliveryUnknown = true;
      reject(error);
    }, Math.max(1000, Number(timeoutMs) || 5000));
    offscreenTaskRuntimeCommands.set(commandId, { resolve, reject, timer });
    try {
      port.postMessage({
        type,
        protocolVersion: FuguangTaskRuntimeProtocol.VERSION,
        commandId,
        ...payload
      });
    } catch (error) {
      clearTimeout(timer);
      offscreenTaskRuntimeCommands.delete(commandId);
      reject(error);
    }
  });
}

async function ensureOffscreenTaskRuntimePort() {
  if (offscreenTaskRuntimePort) {
    return offscreenTaskRuntimePort;
  }
  if (offscreenTaskRuntimeConnectionPromise) {
    return offscreenTaskRuntimeConnectionPromise;
  }
  offscreenTaskRuntimeConnectionPromise = (async () => {
    await ensureOffscreenDocument();
    if (typeof chrome.runtime?.connect !== "function") {
      return null;
    }
    const port = chrome.runtime.connect({ name: FuguangTaskRuntimeProtocol.PORT_NAME });
    return new Promise((resolve, reject) => {
      let ready = false;
      const timer = setTimeout(() => {
        if (!ready) {
          port.disconnect?.();
          reject(new Error("Offscreen task runtime did not become ready."));
        }
      }, 5000);
      port.onMessage.addListener(message => {
        if (message?.type === FuguangTaskRuntimeProtocol.MESSAGE.READY) {
          ready = true;
          clearTimeout(timer);
          offscreenTaskRuntimePort = port;
          resolve(port);
          return;
        }
        settleOffscreenTaskRuntimeCommand(message);
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        if (offscreenTaskRuntimePort === port) {
          offscreenTaskRuntimePort = null;
        }
        const error = new Error(chrome.runtime.lastError?.message || "Offscreen task runtime disconnected.");
        rejectPendingOffscreenTaskRuntimeCommands(error);
        if (!ready) {
          reject(error);
        }
      });
    });
  })().finally(() => {
    offscreenTaskRuntimeConnectionPromise = null;
  });
  return offscreenTaskRuntimeConnectionPromise;
}

function settleOffscreenTaskRuntimeCommand(message = {}) {
  const commandId = String(message.commandId || "");
  const pending = offscreenTaskRuntimeCommands.get(commandId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  offscreenTaskRuntimeCommands.delete(commandId);
  if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.ERROR) {
    const error = new Error(message.error || "Offscreen task runtime command failed.");
    error.retryable = Boolean(message.retryable);
    error.reason = String(message.reason || "");
    error.jobId = String(message.jobId || "");
    error.runToken = String(message.runToken || "");
    pending.reject(error);
  } else {
    pending.resolve(message);
  }
}

function rejectPendingOffscreenTaskRuntimeCommands(error) {
  error.deliveryUnknown = true;
  for (const pending of offscreenTaskRuntimeCommands.values()) {
    clearTimeout(pending.timer);
    pending.reject(error);
  }
  offscreenTaskRuntimeCommands.clear();
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
  return Boolean(record?.superseded || record?.cancelled || record?.abortController?.signal?.aborted || record?.job?.status === "cancelled");
}

function isCurrentBrowserPreloadRecord(record) {
  const jobId = String(record?.job?.id || "");
  return Boolean(jobId && !record?.superseded && browserPreloadJobs.get(jobId) === record);
}

function isActiveCurrentBrowserPreloadRecord(record) {
  return isCurrentBrowserPreloadRecord(record) && !isBrowserJobCancelled(record);
}

function supersedeBrowserPreloadRecord(record, message = "任务运行实例已被替换。") {
  if (!record || record.superseded) {
    return;
  }
  record.superseded = true;
  record.supersededAt = Date.now();
  cancelBrowserRecordQueues(record);
  stopLocalBrowserExecutionHeartbeat(record);
  if (!record.abortController?.signal?.aborted) {
    record.abortController?.abort?.(new Error(message));
  }
  chrome.runtime?.sendMessage?.({
    type: MESSAGE.OFFSCREEN_CANCEL_JOB,
    jobId: record.job?.id || "",
    runToken: record.runToken || ""
  })?.catch?.(() => {});
  invalidateBrowserPreloadVttAttachment(record.tabId).catch(() => {});
}

function cloneBrowserJobState(job) {
  if (job == null) {
    return job;
  }
  try {
    return structuredClone(job);
  } catch {
    return JSON.parse(JSON.stringify(job));
  }
}

function browserPreloadJobForRead(record) {
  if (!record) {
    return null;
  }
  if ((record.offscreenMirrorSuppressionCount || record.staleOffscreenOperationDetected) && record.lastCommittedJob) {
    return cloneBrowserJobState(record.lastCommittedJob);
  }
  return cloneBrowserJobState(record.job);
}

function isBrowserRunInactive(record, runToken, operation = null) {
  return !record || record.runToken !== runToken || isBrowserJobCancelled(record) ||
    Boolean(operation && (operation.stale || operation.controller?.signal?.aborted));
}

async function isBrowserExecutionOperationActive(record, runToken, operation = null) {
  if (isBrowserRunInactive(record, runToken, operation)) {
    return false;
  }
  if (!operation) {
    return true;
  }
  const fence = await validateOffscreenExecutionFence({
    jobId: operation.jobId,
    runToken: operation.runToken,
    executionOwnerId: operation.executionOwnerId,
    executionEpoch: operation.executionEpoch
  }, { fenceStaleOperations: false });
  if (!fence.valid) {
    record.staleOffscreenOperationDetected = true;
    markOffscreenBrowserOperationStale(operation, "任务执行租约在异步操作期间失效。");
    return false;
  }
  return true;
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
  const runToken = await beginBrowserJobAttempt(record, "retrying");
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
  if (isBrowserRunInactive(record, runToken)) {
    return { preload: record.job.status, job: record.job };
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
    await beginBrowserJobAttempt(browserRecord, "retry_translation");
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
  const jobId = createDurableJobId();
  const runToken = createDurableRunToken();
  const job = {
    id: jobId,
    runToken,
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
    runToken,
    candidate: { url: normalizedMetadata.sourceUrl || normalizedMetadata.pageUrl || "", title: normalizedMetadata.title || "" },
    metadata: normalizedMetadata,
    modelConfig,
    job,
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
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
  const previousExecutionSpec = record.modelConfig?.executionSpec || {};
  const replacingUnavailableConfig = Boolean(record.recoveryBlocked);
  const targetLanguage = options.targetLanguage
    ? normalizeTargetLanguage(options.targetLanguage, current.targetLanguage)
    : current.targetLanguage;
  const shouldRefreshAsrLanguage = options.refreshAsrLanguage || Object.hasOwn(options, "sourceLanguage");
  record.modelConfig = {
    ...record.modelConfig,
    asr: replacingUnavailableConfig ? current.asr : record.modelConfig?.asr,
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
  record.modelConfig.executionSpec = await createModelExecutionSpec(record.modelConfig, {
    asrProfileId: replacingUnavailableConfig
      ? (current.executionSpec?.asrProfileId || "")
      : (previousExecutionSpec.asrProfileId || current.executionSpec?.asrProfileId || ""),
    llmProfileId: current.executionSpec?.llmProfileId || previousExecutionSpec.llmProfileId || ""
  });
  record.recoveryBlocked = false;
  record.recoveryError = "";
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
  const runToken = await beginBrowserJobAttempt(record, "retrying");
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
  if (isBrowserRunInactive(record, runToken)) {
    return { preload: record.job.status, job: record.job };
  }
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
  const runToken = await beginBrowserJobAttempt(record, asrIndexes.length ? "retrying" : "retry_translation");
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
  if (isBrowserRunInactive(record, runToken)) {
    return { preload: record.job.status, job: record.job };
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
  const runToken = record?.runToken;
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
        signal: record.abortController?.signal,
        jobId: record.job.id,
        runToken: record.runToken,
        onDiagnostics: diagnostics => recordBrowserAsrChunkDiagnostics(record, chunk, diagnostics)
      });
      if (chunkSegments.length) {
        sourceSegments.push(...chunkSegments);
      } else {
        empty += 1;
      }
    } catch (error) {
      if (isBrowserRunInactive(record, runToken) || isBrowserAbortError(error)) {
        return;
      }
      errors.push(error.message || String(error));
    }
  });
  if (isBrowserRunInactive(record, runToken)) {
    return;
  }
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
  const runToken = record?.runToken;
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
  if (isBrowserRunInactive(record, runToken)) {
    return { preload: record.job.status, job: record.job };
  }
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
  const runToken = record?.runToken;
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
        signal: record.abortController?.signal,
        onProgress(progress) {
          if (isBrowserRunInactive(record, runToken)) {
            return;
          }
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
    if (isBrowserRunInactive(record, runToken) || isBrowserAbortError(error)) {
      return;
    }
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
  if (isBrowserRunInactive(record, runToken)) {
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
    const cancelRequestedAt = Date.now();
    const cancelRunToken = String(browserRecord.runToken || "");
    browserRecord.cancelRequested = true;
    browserRecord.job.cancelRequested = true;
    browserRecord.job.cancelRequestedAt = cancelRequestedAt;
    scheduleBrowserJobMirror(browserRecord);
    browserJobStore.markCancelRequested(targetJobId, cancelRunToken, cancelRequestedAt).catch(() => {});
    if (typeof chrome.runtime?.connect === "function") {
      sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB, {
        jobId: targetJobId,
        runToken: cancelRunToken,
        requestedAt: cancelRequestedAt
      }).catch(() => {});
    }
    browserRecord.cancelled = true;
    browserRecord.abortController?.abort?.(new Error("任务已停止。"));
    cancelBrowserRecordQueues(browserRecord);
    await releaseLocalBrowserExecutionLease(browserRecord);
    chrome.runtime.sendMessage({
      type: MESSAGE.OFFSCREEN_CANCEL_JOB,
      jobId: targetJobId,
      runToken: cancelRunToken
    }).catch(() => {});
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
        requestBrowserJobLedgerMaintenance().catch(() => {});
      }
      if (alarm?.name === OFFSCREEN_IDLE_CLOSE_ALARM) {
        closeOffscreenDocumentIfIdle().catch(() => {});
      }
      if (String(alarm?.name || "").startsWith(BROWSER_JOB_LEASE_RECOVERY_ALARM_PREFIX)) {
        const jobId = String(alarm.name).slice(BROWSER_JOB_LEASE_RECOVERY_ALARM_PREFIX.length);
        recoverExpiredBrowserJobLease(jobId).catch(() => {});
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

async function requestBrowserJobLedgerMaintenance(now = Date.now()) {
  const cutoff = Number(now || Date.now()) - BROWSER_JOB_LEDGER_TTL_MS;
  const terminalResult = await browserJobStore.compactTerminalJobs(cutoff);
  const recoverableJobs = await browserJobStore.listRecoverableJobs();
  let deletedInterruptedJobs = 0;
  for (const job of recoverableJobs) {
    if (job?.status !== "interrupted" || Number(job.createdAt || 0) >= cutoff) {
      continue;
    }
    await browserJobStore.deleteJob(job.id);
    deletedInterruptedJobs += 1;
  }
  return {
    deletedTerminalJobs: Number(terminalResult?.deletedJobs || 0),
    deletedInterruptedJobs
  };
}

function scheduleOffscreenIdleCloseIfNeeded() {
  if ([...browserPreloadJobs.values()].some(record => browserJobNeedsOffscreen(record?.job))) {
    return;
  }
  try {
    const created = chrome.alarms?.create?.(OFFSCREEN_IDLE_CLOSE_ALARM, {
      delayInMinutes: OFFSCREEN_IDLE_CLOSE_MINUTES
    });
    created?.catch?.(() => {});
  } catch {
    // Idle closure is opportunistic; active task correctness does not depend on it.
  }
}

function browserJobNeedsOffscreen(job) {
  return ["queued", "running"].includes(String(job?.status || ""));
}

async function closeOffscreenDocumentIfIdle() {
  if ([...browserPreloadJobs.values()].some(record => browserJobNeedsOffscreen(record?.job)) || offscreenTaskRuntimeCommands.size) {
    return { closed: false, reason: "active" };
  }
  if (typeof chrome.offscreen?.closeDocument !== "function") {
    return { closed: false, reason: "unsupported" };
  }
  const url = chrome.runtime.getURL("src/offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  }).catch(() => []);
  if (!contexts.length) {
    return { closed: false, reason: "missing" };
  }
  await chrome.offscreen.closeDocument();
  offscreenTaskRuntimePort = null;
  return { closed: true };
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
  invalidateManualVttAttachment(state);
  state.attachedVttSignature = "";
  state.attachedVttGeneration = 0;
  state.subtitleFrameId = null;
  await broadcastMessageToFrames(tabId, {
    type: MESSAGE.DETACH_PRELOAD_VTT,
    preloadGeneration: nextBrowserVttAttachmentGeneration()
  }).catch(() => {});
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
  state.attachedVttGeneration = 0;
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
  let browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    let visibleJob = browserPreloadJobForRead(browserRecord);
    if (tabId) {
      await refreshTabInfo(tabId);
      browserRecord = browserPreloadJobs.get(jobId);
      if (!browserRecord) {
        return { job: null, missing: true };
      }
      visibleJob = browserPreloadJobForRead(browserRecord);
      if (!browserPreloadRecordMatchesPageUrl(browserRecord, getState(tabId).page?.url || getState(tabId).context?.href || "")) {
        return { job: null, missing: true, pageMismatch: true };
      }
      setTabStatus(tabId, { preload: visibleJob.status || "running", preloadJob: visibleJob || null });
      if (visibleJob.translation?.vttText) {
        await attachBrowserJobVttIfReady(browserRecord, visibleJob);
      }
    }
    return { job: withSubtitleSuppression(visibleJob, tabId) };
  }
  if (tabId) {
    setTabStatus(tabId, {
      preload: "idle",
      preloadJob: null,
      attachedVttSignature: "",
      attachedVttGeneration: 0,
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
    return { vtt: browserPreloadJobForRead(browserRecord).translation?.vttText || "" };
  }
  throw new Error("这个任务的字幕不在当前浏览器内任务中。请使用本地字幕缓存或重新生成。");
}

function normalizeVttTextAttachmentOrigin(value) {
  if (["job-projection", "user-presentation", "user-override"].includes(value)) {
    return value;
  }
  return "user-override";
}

function normalizeSubtitleAttachmentRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : 0;
}

async function attachVttText(tabId, vtt, options = {}) {
  if (!tabId || !vtt) {
    throw new Error("没有可挂载的字幕。");
  }
  const state = getState(tabId);
  const signature = "manual:" + vttContentSignature(vtt);
  const origin = normalizeVttTextAttachmentOrigin(options.origin);
  const isUserOverride = origin === "user-override";
  const isUserIntervention = isUserOverride || origin === "user-presentation";
  const jobId = String(options.jobId || "");
  const attachmentRevision = normalizeSubtitleAttachmentRevision(options.attachmentRevision);
  const pendingAttachment = currentVttTextAttachmentPending(state);
  if (
    pendingAttachment &&
    !vttTextAttachmentCanPreemptPending(
      { origin, jobId, attachmentRevision },
      pendingAttachment
    )
  ) {
    const deferred = deferVttTextProjection(
      state,
      { origin, jobId, attachmentRevision },
      pendingAttachment
    );
    return deferred
      ? { attached: false, stale: true, deferred: true }
      : { attached: false, stale: true };
  }
  const attachmentGeneration = nextBrowserVttAttachmentGeneration();
  const attachmentEpoch = nextManualVttAttachmentEpoch(state);
  setVttTextAttachmentPending(state, attachmentEpoch, origin, jobId, attachmentRevision);
  if (isUserOverride) {
    clearDeferredVttProjection(state);
  }
  if (isUserIntervention) {
    nextAutomaticVttInterventionEpoch(state);
  }
  state.vttTextAttachmentSignature = signature;
  if (isUserOverride) {
    state.manualVttSignature = signature;
  }
  try {
    if (state.attachedVttSignature === signature) {
      const attached = await hasAttachedSubtitleSignature(tabId, signature, {
        origin,
        jobId,
        attachmentRevision
      });
      if (!manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
        return { attached: false, stale: true };
      }
      if (attached) {
        return { attached: true };
      }
    }
    if (!manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
      return { attached: false, stale: true };
    }
    if (isUserOverride) {
      const detachResponses = await broadcastMessageToFrames(tabId, {
        type: MESSAGE.DETACH_PRELOAD_VTT,
        preloadGeneration: attachmentGeneration,
        automaticOnly: false,
        origin,
        jobId,
        attachmentRevision
      }).catch(() => []);
      if (!manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
        return { attached: false, stale: true };
      }
      if (Array.isArray(detachResponses) && detachResponses.some(response => response?.preservedManual)) {
        state.vttTextAttachmentSignature = state.manualVttSignature || "";
        return { attached: false, preservedManual: true };
      }
      if (Array.isArray(detachResponses) && detachResponses.some(response => response?.staleRevision)) {
        invalidateCurrentVttTextAttachment(state, attachmentEpoch, signature, {
          clearManual: true
        });
        return { attached: false, stale: true };
      }
      state.attachedVttSignature = "";
      state.attachedVttGeneration = 0;
      state.subtitleFrameId = null;
    }
    await ensureSubtitleOverlay(tabId);
    if (!manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
      return { attached: false, stale: true };
    }
    const response = await sendMessageToMediaFrame(tabId, {
      type: MESSAGE.ATTACH_VTT,
      vtt,
      label: "流声字幕",
      signature,
      origin,
      jobId,
      attachmentRevision,
      preloadGeneration: attachmentGeneration
    });
    if (!manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
      return { attached: false, stale: true };
    }
    if (response?.preservedManual) {
      state.vttTextAttachmentSignature = state.manualVttSignature || "";
      return { attached: false, preservedManual: true };
    }
    if (response?.stale) {
      invalidateCurrentVttTextAttachment(state, attachmentEpoch, signature, {
        clearManual: isUserOverride
      });
      return { attached: false, stale: true };
    }
    if (!response?.ok) {
      invalidateCurrentVttTextAttachment(state, attachmentEpoch, signature, {
        clearManual: isUserOverride
      });
      throw new Error("当前页面没有可挂载字幕的播放器。");
    }
    state.attachedVttSignature = signature;
    state.attachedVttGeneration = attachmentGeneration;
    state.manualVttSignature = isUserOverride ? signature : "";
    state.vttTextAttachmentSignature = signature;
    return { attached: true };
  } catch (error) {
    if (manualVttAttachmentIsCurrent(state, attachmentEpoch, signature)) {
      invalidateCurrentVttTextAttachment(state, attachmentEpoch, signature, {
        clearManual: isUserOverride
      });
    }
    throw error;
  } finally {
    clearVttTextAttachmentPending(state, attachmentEpoch);
    if (
      origin === "user-presentation" &&
      !currentVttTextAttachmentPending(state)
    ) {
      await replayDeferredVttProjection(tabId, state, jobId);
    }
  }
}

function currentManualVttAttachmentEpoch(state) {
  const epoch = Number(state?.manualVttAttachmentEpoch || 0);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0;
}

function nextManualVttAttachmentEpoch(state) {
  const epoch = Math.max(
    currentManualVttAttachmentEpoch(state) + 1,
    Date.now() * 1000
  );
  state.manualVttAttachmentEpoch = epoch;
  return epoch;
}

function vttTextAttachmentOriginPriority(origin) {
  if (origin === "user-override") {
    return 3;
  }
  if (origin === "user-presentation") {
    return 2;
  }
  return origin === "job-projection" ? 1 : 0;
}

function currentVttTextAttachmentPending(state) {
  const epoch = Number(state?.vttTextAttachmentPendingEpoch || 0);
  if (
    !Number.isSafeInteger(epoch) ||
    epoch <= 0 ||
    epoch !== currentManualVttAttachmentEpoch(state)
  ) {
    return null;
  }
  const origin = String(state?.vttTextAttachmentPendingOrigin || "");
  if (!vttTextAttachmentOriginPriority(origin)) {
    return null;
  }
  return {
    origin,
    jobId: String(state?.vttTextAttachmentPendingJobId || ""),
    attachmentRevision: normalizeSubtitleAttachmentRevision(
      state?.vttTextAttachmentPendingRevision
    )
  };
}

function vttTextAttachmentCanPreemptPending(request, pending) {
  return (
    vttTextAttachmentOriginPriority(request?.origin) >=
    vttTextAttachmentOriginPriority(pending?.origin)
  );
}

function deferVttTextProjection(state, request, pending) {
  const jobId = String(request?.jobId || "");
  const attachmentRevision = normalizeSubtitleAttachmentRevision(
    request?.attachmentRevision
  );
  if (
    request?.origin !== "job-projection" ||
    pending?.origin !== "user-presentation" ||
    !jobId ||
    jobId !== pending.jobId ||
    !attachmentRevision ||
    attachmentRevision <
      normalizeSubtitleAttachmentRevision(pending.attachmentRevision)
  ) {
    return false;
  }
  const currentJobId = String(state?.vttTextDeferredProjectionJobId || "");
  const currentRevision = normalizeSubtitleAttachmentRevision(
    state?.vttTextDeferredProjectionRevision
  );
  if (currentJobId === jobId && currentRevision >= attachmentRevision) {
    return true;
  }
  state.vttTextDeferredProjectionJobId = jobId;
  state.vttTextDeferredProjectionRevision = attachmentRevision;
  return true;
}

function clearDeferredVttProjection(state) {
  if (!state) {
    return;
  }
  state.vttTextDeferredProjectionJobId = "";
  state.vttTextDeferredProjectionRevision = 0;
}

function takeDeferredVttProjection(state) {
  const jobId = String(state?.vttTextDeferredProjectionJobId || "");
  const attachmentRevision = normalizeSubtitleAttachmentRevision(
    state?.vttTextDeferredProjectionRevision
  );
  clearDeferredVttProjection(state);
  return jobId && attachmentRevision
    ? { jobId, attachmentRevision }
    : null;
}

async function replayDeferredVttProjection(tabId, state, presentationJobId = "") {
  const deferred = takeDeferredVttProjection(state);
  if (
    !deferred ||
    deferred.jobId !== String(presentationJobId || "")
  ) {
    return false;
  }
  const record = browserPreloadJobs.get(deferred.jobId);
  const currentJob = browserPreloadJobForRead(record);
  if (
    !record ||
    Number(record.tabId || 0) !== Number(tabId || 0) ||
    String(currentJob?.id || "") !== deferred.jobId ||
    normalizeSubtitleAttachmentRevision(currentJob?.updatedAt) <
      deferred.attachmentRevision
  ) {
    return false;
  }
  await attachBrowserJobVttIfReady(record, currentJob);
  return true;
}

function setVttTextAttachmentPending(
  state,
  epoch,
  origin,
  jobId = "",
  attachmentRevision = 0
) {
  state.vttTextAttachmentPendingEpoch = Number(epoch || 0);
  state.vttTextAttachmentPendingOrigin = origin;
  state.vttTextAttachmentPendingJobId = String(jobId || "");
  state.vttTextAttachmentPendingRevision = normalizeSubtitleAttachmentRevision(
    attachmentRevision
  );
}

function clearVttTextAttachmentPending(state, epoch = 0) {
  if (
    !state ||
    (epoch && Number(state.vttTextAttachmentPendingEpoch || 0) !== Number(epoch))
  ) {
    return false;
  }
  state.vttTextAttachmentPendingEpoch = 0;
  state.vttTextAttachmentPendingOrigin = "";
  state.vttTextAttachmentPendingJobId = "";
  state.vttTextAttachmentPendingRevision = 0;
  return true;
}

function currentAutomaticVttInterventionEpoch(state) {
  const epoch = Number(state?.automaticVttInterventionEpoch || 0);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0;
}

function nextAutomaticVttInterventionEpoch(state) {
  const epoch = Math.max(
    currentAutomaticVttInterventionEpoch(state) + 1,
    Date.now() * 1000
  );
  state.automaticVttInterventionEpoch = epoch;
  return epoch;
}

function invalidateManualVttAttachment(state) {
  if (!state) {
    return 0;
  }
  const epoch = nextManualVttAttachmentEpoch(state);
  nextAutomaticVttInterventionEpoch(state);
  clearVttTextAttachmentPending(state);
  clearDeferredVttProjection(state);
  state.manualVttSignature = "";
  state.vttTextAttachmentSignature = "";
  return epoch;
}

function invalidateCurrentVttTextAttachment(state, epoch, signature, options = {}) {
  if (!manualVttAttachmentIsCurrent(state, epoch, signature)) {
    return false;
  }
  clearVttTextAttachmentPending(state, epoch);
  nextManualVttAttachmentEpoch(state);
  state.vttTextAttachmentSignature = "";
  if (options.clearManual && state.manualVttSignature === signature) {
    state.manualVttSignature = "";
  }
  return true;
}

function manualVttAttachmentIsCurrent(state, epoch, signature) {
  return Boolean(
    state &&
    currentManualVttAttachmentEpoch(state) === Number(epoch || 0) &&
    state.vttTextAttachmentSignature === signature
  );
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
    return { transcript: browserPreloadJobForRead(browserRecord).translation?.transcript || null };
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
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
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
      let cacheUrl = String(file.cacheUrl || "");
      if (!cacheUrl) {
        cacheUrl = diagnosticAudioCacheUrl(record.job?.id, chunk, path);
        await cache.put(cacheUrl, new Response(buffer, {
          headers: {
            "content-type": manifestEntry.mime || "audio/mpeg",
            "x-fuguang-bytes": String(buffer.byteLength),
            "x-fuguang-cached-at": String(Date.now())
          }
        }));
        file.cacheUrl = cacheUrl;
        file.bytes = buffer.byteLength;
      }
      manifestEntry.bytes = buffer.byteLength;
      manifestEntry.included = true;
      audioFiles.push({
        path,
        name: manifestEntry.name,
        mime: manifestEntry.mime || "audio/mpeg",
        bytes: buffer.byteLength,
        cacheName: WEB_FFMPEG_AUDIO_CACHE,
        cacheUrl
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

function diagnosticAudioCacheUrl(jobId, chunk = {}, path = "") {
  const safeJobId = encodeURIComponent(String(jobId || "diagnostics"));
  const index = Math.max(0, Number(chunk.index) || 0);
  const fileName = encodeURIComponent(safeDiagnosticAudioFilename(path.split("/").at(-1) || `chunk-${index}.mp3`));
  return `${WEB_FFMPEG_AUDIO_CACHE_ORIGIN}${WEB_FFMPEG_AUDIO_CACHE_PREFIX}/${safeJobId}/diagnostics/${String(index).padStart(4, "0")}-${fileName}`;
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

async function hasAttachedSubtitleSignature(tabId, signature, metadata = {}) {
  if (!tabId || !signature) {
    return false;
  }
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.GET_VIDEO_STATE
  });
  const subtitleState = response?.state;
  if (subtitleState?.subtitleSignature !== signature) {
    return false;
  }
  if (metadata.origin && subtitleState.subtitleOrigin !== metadata.origin) {
    return false;
  }
  if (metadata.jobId && subtitleState.subtitleJobId !== metadata.jobId) {
    return false;
  }
  const attachmentRevision = normalizeSubtitleAttachmentRevision(metadata.attachmentRevision);
  if (attachmentRevision && Number(subtitleState.subtitleRevision || 0) !== attachmentRevision) {
    return false;
  }
  return true;
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
  return Promise.all(
    frameIds.map(frameId => chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null))
  );
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
  if (offscreenDocumentCreationPromise) {
    return offscreenDocumentCreationPromise;
  }
  const url = chrome.runtime.getURL("src/offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length > 0) {
    return;
  }
  if (!offscreenDocumentCreationPromise) {
    offscreenDocumentCreationPromise = chrome.offscreen.createDocument({
      url: "src/offscreen/offscreen.html",
      reasons: ["IFRAME_SCRIPTING"],
      justification: "托管隐藏的 Web FFmpeg 音频处理页面。"
    }).finally(() => {
      offscreenDocumentCreationPromise = null;
    });
  }
  return offscreenDocumentCreationPromise;
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

async function getModelConfig(executionSpec = null) {
  const localStored = await chrome.storage.local.get(null);
  const useStoredProfiles = localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION;
  const asrProfiles = normalizeStoredProfiles("asr", useStoredProfiles ? localStored.asrProfiles : []);
  const llmProfiles = normalizeStoredProfiles("llm", useStoredProfiles ? localStored.llmProfiles : []);
  const storedSelectedAsrId = normalizeSelectedProfileId(
    asrProfiles,
    localStored.selectedAsrProfileId || DEFAULT_ASR_PROFILE_ID,
    DEFAULT_ASR_PROFILE_ID
  );
  const storedSelectedLlmId = normalizeSelectedProfileId(
    llmProfiles,
    localStored.selectedLlmProfileId || DEFAULT_LLM_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID
  );
  const requestedAsrId = String(executionSpec?.asrProfileId || "");
  const requestedLlmId = String(executionSpec?.llmProfileId || "");
  const selectedAsr = requestedAsrId
    ? asrProfiles.find(profile => profile.id === requestedAsrId)
    : findProfile(asrProfiles, storedSelectedAsrId, DEFAULT_ASR_PROFILE_ID);
  const selectedLlm = requestedLlmId
    ? llmProfiles.find(profile => profile.id === requestedLlmId)
    : findProfile(llmProfiles, storedSelectedLlmId, DEFAULT_LLM_PROFILE_ID);
  if (!selectedAsr || !selectedLlm) {
    throw new Error("任务启动时使用的模型配置已不存在，不能自动改用当前配置。");
  }
  clearLegacyModelSyncFields();
  persistMigratedModelSettings(localStored, asrProfiles, llmProfiles, storedSelectedAsrId, storedSelectedLlmId);
  validateSelectedModelProfiles(selectedAsr, selectedLlm);
  const sourceLanguage = normalizeAsrLanguage(executionSpec
    ? executionSpec.sourceLanguage
    : (localStored.sourceLanguage || DEFAULT_MODEL_SETTINGS.sourceLanguage));
  const asrConfig = compactProviderConfig(selectedAsr);
  if (sourceLanguage) {
    asrConfig.language = sourceLanguage;
  }
  const chunkMinutes = executionSpec
    ? clampInteger(executionSpec.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes)
    : clampInteger(localStored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes);
  const modelConfig = {
    asr: asrConfig,
    translation: compactProviderConfig(selectedLlm),
    targetLanguage: normalizeTargetLanguage(
      executionSpec ? executionSpec.targetLanguage : (localStored.targetLanguage || DEFAULT_MODEL_SETTINGS.targetLanguage)
    ),
    webFfmpegPerformance: normalizeWebFfmpegPerformanceMode(
      executionSpec ? executionSpec.webFfmpegPerformance : (localStored.webFfmpegPerformance || DEFAULT_MODEL_SETTINGS.webFfmpegPerformance)
    ),
    asrWorkers: executionSpec
      ? clampInteger(executionSpec.asrWorkers, 1, 4, DEFAULT_MODEL_SETTINGS.asrWorkers)
      : DEFAULT_MODEL_SETTINGS.asrWorkers,
    workers: executionSpec
      ? clampInteger(executionSpec.translationWorkers, 1, 8, DEFAULT_MODEL_SETTINGS.translationWorkers)
      : (Number(localStored.translationWorkers) || DEFAULT_MODEL_SETTINGS.translationWorkers),
    chunkMinutes,
    chunkSeconds: chunkMinutes * 60
  };
  modelConfig.executionSpec = await createModelExecutionSpec(modelConfig, {
    asrProfileId: selectedAsr.id,
    llmProfileId: selectedLlm.id
  });
  if (executionSpec?.fingerprint && modelConfig.executionSpec.fingerprint !== String(executionSpec.fingerprint)) {
    throw new Error("任务启动时使用的模型配置已被修改，不能自动改用变更后的配置。");
  }
  return modelConfig;
}

async function createModelExecutionSpec(modelConfig = {}, profileRefs = {}) {
  const sourceLanguage = normalizeAsrLanguage(modelConfig.asr?.language || "");
  const chunkMinutes = clampInteger(
    modelConfig.chunkMinutes || (Number(modelConfig.chunkSeconds || 0) / 60),
    1,
    60,
    DEFAULT_MODEL_SETTINGS.chunkMinutes
  );
  const identity = {
    version: 1,
    asrProfileId: String(profileRefs.asrProfileId || ""),
    llmProfileId: String(profileRefs.llmProfileId || ""),
    sourceLanguage,
    targetLanguage: normalizeTargetLanguage(modelConfig.targetLanguage || DEFAULT_MODEL_SETTINGS.targetLanguage),
    webFfmpegPerformance: normalizeWebFfmpegPerformanceMode(modelConfig.webFfmpegPerformance),
    asrWorkers: clampInteger(modelConfig.asrWorkers, 1, 4, DEFAULT_MODEL_SETTINGS.asrWorkers),
    translationWorkers: clampInteger(modelConfig.workers, 1, 8, DEFAULT_MODEL_SETTINGS.translationWorkers),
    chunkMinutes,
    asr: modelConfig.asr || {},
    translation: modelConfig.translation || {}
  };
  const fingerprint = await sha256Hex(stableJsonStringify(identity));
  const { asr, translation, ...persisted } = identity;
  return { ...persisted, fingerprint };
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error("Web Crypto SHA-256 is unavailable.");
  }
  const input = await new Blob([String(value || "")]).arrayBuffer();
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", input));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
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

function updateTabContext(tabId, context, frameId = 0, documentId = "") {
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
    currentTime: shouldUpdateTime ? pickNonNegativeFinite(context.currentTime, current.currentTime) : current.currentTime,
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

function pickNonNegativeFinite(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") {
      continue;
    }
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) {
      return number;
    }
  }
  return null;
}

function addPageMediaCandidate(tabId, media, frameId = 0, documentId = "") {
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
  const reportedSource = String(media.source || "page");
  const source = ["request", "request-headers", "response"].includes(reportedSource)
    ? "page"
    : reportedSource;
  addCandidate(tabId, {
    url: media.url,
    source,
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
    documentId: String(documentId || ""),
    seenAt: Date.now()
  });
}

function normalizeFrameId(value) {
  const frameId = Number(value);
  return Number.isInteger(frameId) && frameId >= 0 ? frameId : 0;
}

async function isCurrentDocumentMessage(sender = {}) {
  const tabId = Number(sender.tab?.id);
  const frameId = normalizeFrameId(sender.frameId);
  const documentId = String(sender.documentId || "");
  if (!Number.isInteger(tabId) || tabId < 0 || !documentId) {
    return false;
  }
  const knownDocumentId = activeDocumentIdsByTab.get(tabId)?.get(frameId);
  if (knownDocumentId) {
    return knownDocumentId === documentId;
  }
  if (typeof chrome.webNavigation?.getFrame !== "function") {
    return false;
  }
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId }).catch(() => null);
  if (!frame?.documentId || String(frame.documentId) !== documentId) {
    return false;
  }
  noteActiveDocument(tabId, frameId, documentId, { authoritative: true });
  return true;
}

function noteActiveDocument(tabId, frameId = 0, documentId = "", options = {}) {
  const numericTabId = Number(tabId);
  if (!options.authoritative || !Number.isInteger(numericTabId) || numericTabId < 0) {
    return;
  }
  const normalizedFrameId = normalizeFrameId(frameId);
  let documents = activeDocumentIdsByTab.get(numericTabId) || new Map();
  if (normalizedFrameId === 0 && documentId && documents.get(0) && documents.get(0) !== String(documentId)) {
    documents = new Map();
  }
  if (documentId) {
    documents.set(normalizedFrameId, String(documentId));
  }
  activeDocumentIdsByTab.set(numericTabId, documents);
  if (tabState.has(numericTabId)) {
    getState(numericTabId).documentIdsByFrame = documents;
  }
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
    scheduleSidepanelStatusChange(tabId);
    return;
  }
  state.candidateFingerprints.add(fingerprint);
  state.candidates.unshift(safeCandidate);
  state.candidates = pruneCandidatesForRetention(state.candidates, MAX_CANDIDATES_PER_TAB);
  scheduleSidepanelStatusChange(tabId);
}

function sanitizeCandidateRequestHeaders(candidate = {}) {
  return {
    ...candidate,
    requestHeaders: sanitizeInternalRequestHeaders(candidate.requestHeaders),
    requestHeadersByOrigin: sanitizeRequestHeadersByOrigin(candidate.requestHeadersByOrigin)
  };
}

function getDisplayCandidates(tabId) {
  const state = getState(tabId);
  return getGroupedCandidatesForState(state).map(stripCandidateRequestHeaders);
}

function setTabStatus(tabId, patch) {
  const nextPatch = { ...(patch || {}) };
  if (Object.prototype.hasOwnProperty.call(nextPatch, "preloadJob")) {
    nextPatch.preloadJob = cloneBrowserJobState(nextPatch.preloadJob);
  }
  Object.assign(getState(tabId), nextPatch);
  scheduleSidepanelStatusChange(tabId);
}

function scheduleSidepanelStatusChange(tabId) {
  const normalizedTabId = Number(tabId);
  if (!Number.isInteger(normalizedTabId) || sidepanelStatusPushTimers.has(normalizedTabId)) {
    return;
  }
  const timer = setTimeout(() => {
    sidepanelStatusPushTimers.delete(normalizedTabId);
    publishSidepanelStatusChange(normalizedTabId);
  }, 100);
  sidepanelStatusPushTimers.set(normalizedTabId, timer);
}

function publishSidepanelStatusChange(tabId) {
  const state = getState(tabId);
  const job = state.preloadJob || null;
  const pageIdentity = normalizeBrowserPageIdentity(state.page?.url || state.context?.href || "");
  const summary = job
    ? FuguangJobContract.createJobSummary({ job, tabId, runToken: job.runToken || "" }, { pageIdentity })
    : null;
  for (const [port, subscribedTabId] of sidepanelStatusPorts) {
    if (subscribedTabId !== tabId) {
      continue;
    }
    try {
      port.postMessage({
        type: MESSAGE.SIDEPANEL_JOB_CHANGED,
        tabId,
        preload: state.preload || "idle",
        job: summary
      });
    } catch {
      sidepanelStatusPorts.delete(port);
    }
  }
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
      attachedVttGeneration: 0,
      manualVttSignature: "",
      manualVttAttachmentEpoch: 0,
      automaticVttInterventionEpoch: 0,
      vttTextAttachmentPendingEpoch: 0,
      vttTextAttachmentPendingOrigin: "",
      vttTextAttachmentPendingJobId: "",
      vttTextAttachmentPendingRevision: 0,
      vttTextDeferredProjectionJobId: "",
      vttTextDeferredProjectionRevision: 0,
      vttTextAttachmentSignature: "",
      subtitleFrameId: null,
      lastPreloadCandidate: null,
      documentIdsByFrame: activeDocumentIdsByTab.get(tabId) || new Map()
    });
  }
  return tabState.get(tabId);
}
