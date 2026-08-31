import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";
import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";
import { FuguangBrowserAsrWorkflow } from "./browser-asr-workflow.js";
import { FuguangBrowserLanguage } from "./browser-language.js";
import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";
import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";
import { FuguangBrowserFunAsrProvider } from "./browser-funasr-provider.js";
import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";
import { FuguangJobStore } from "./job-store.js";
import { FuguangMediaHeaderRules } from "./media-header-rules.js";
import { FuguangJobContract } from "../shared/job-contract.js";
import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";

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
var browserAsrProviderNeedsModel = FuguangBrowserAsrProvider.browserAsrProviderNeedsModel;
var normalizeAsrLanguage = FuguangBrowserAsrProvider.normalizeAsrLanguage;
var isUsableBrowserAudioFile = FuguangBrowserAsrWorkflow.isUsableBrowserAudioFile;
var browserAudioFileByteLength = FuguangBrowserAsrWorkflow.browserAudioFileByteLength;
var assertBrowserAsrChunkCanUpload = FuguangBrowserAsrWorkflow.assertBrowserAsrChunkCanUpload;
var assertBrowserAsrUploadAudioBytes = FuguangBrowserAsrWorkflow.assertBrowserAsrUploadAudioBytes;
var browserAsrExpectedAudioContainer = FuguangBrowserAsrWorkflow.browserAsrExpectedAudioContainer;
var browserAsrBytesLookLikeWav = FuguangBrowserAsrWorkflow.browserAsrBytesLookLikeWav;
var browserAsrBytesLookLikeMp3 = FuguangBrowserAsrWorkflow.browserAsrBytesLookLikeMp3;
var browserAsrMp3AudioFrameScanStart = FuguangBrowserAsrWorkflow.browserAsrMp3AudioFrameScanStart;
var shouldRetryBrowserAsrClipRequestError = FuguangBrowserAsrWorkflow.shouldRetryBrowserAsrClipRequestError;
var shouldUseBrowserAsrExternalVadPrecheck = FuguangBrowserAsrWorkflow.shouldUseBrowserAsrExternalVadPrecheck;
var shouldUseBrowserAsrNativeVadTranscription = FuguangBrowserAsrWorkflow.shouldUseBrowserAsrNativeVadTranscription;
var shouldUseBrowserAsrCollectedSpeechAudio = FuguangBrowserAsrWorkflow.shouldUseBrowserAsrCollectedSpeechAudio;
var browserAsrCollectedSpeechAudioExplicitlyEnabled = FuguangBrowserAsrWorkflow.browserAsrCollectedSpeechAudioExplicitlyEnabled;
var shouldDisableBrowserAsrServerVadForRecall = FuguangBrowserAsrWorkflow.shouldDisableBrowserAsrServerVadForRecall;
var transcribeBrowserCollectedSpeechAudioChunk = FuguangBrowserAsrWorkflow.transcribeBrowserCollectedSpeechAudioChunk;
var browserAsrClipTimestampsSkippedReason = FuguangBrowserAsrWorkflow.browserAsrClipTimestampsSkippedReason;
var browserAsrSpeechIntervalRequiresServerVad = FuguangBrowserAsrWorkflow.browserAsrSpeechIntervalRequiresServerVad;
var browserAsrAttemptDiagnosticsFromError = FuguangBrowserAsrWorkflow.browserAsrAttemptDiagnosticsFromError;
var createBrowserAsrMaturePlan = FuguangBrowserAsrWorkflow.createBrowserAsrMaturePlan;
var browserAsrMaturePlanForRequest = FuguangBrowserAsrWorkflow.browserAsrMaturePlanForRequest;
var createBrowserAsrPostprocessPolicy = FuguangBrowserAsrWorkflow.createBrowserAsrPostprocessPolicy;
var browserAsrPostprocessPolicyWithOverrides = FuguangBrowserAsrWorkflow.browserAsrPostprocessPolicyWithOverrides;
var browserAsrMatureRequestMode = FuguangBrowserAsrWorkflow.browserAsrMatureRequestMode;
var normalizeBrowserAsrPlanClipTimestamps = FuguangBrowserAsrWorkflow.normalizeBrowserAsrPlanClipTimestamps;
var normalizeBrowserAsrRequestFieldsForDiagnostics = FuguangBrowserAsrWorkflow.normalizeBrowserAsrRequestFieldsForDiagnostics;
var postprocessBrowserAsrPayloadOrThrow = FuguangBrowserAsrWorkflow.postprocessBrowserAsrPayloadOrThrow;
var applyBrowserAsrErrorDiagnostics = FuguangBrowserAsrWorkflow.applyBrowserAsrErrorDiagnostics;
var createBrowserAsrRequestError = FuguangBrowserAsrWorkflow.createBrowserAsrRequestError;
var browserAsrResponseErrorMessage = FuguangBrowserAsrWorkflow.browserAsrResponseErrorMessage;
var browserAsrUploadFileSummary = FuguangBrowserAsrWorkflow.browserAsrUploadFileSummary;
var browserAsrAsciiHead = FuguangBrowserAsrWorkflow.browserAsrAsciiHead;
var requestBrowserAsrTranscription = FuguangBrowserAsrWorkflow.requestBrowserAsrTranscription;
var linkBrowserAbortSignal = FuguangBrowserAsrWorkflow.linkBrowserAbortSignal;
var browserAbortError = FuguangBrowserAsrWorkflow.browserAbortError;
var isBrowserAbortError = FuguangBrowserAsrWorkflow.isBrowserAbortError;
var postprocessBrowserAsrPayload = FuguangBrowserAsrWorkflow.postprocessBrowserAsrPayload;
var postprocessBrowserAsrCollectedSpeechPayload = FuguangBrowserAsrWorkflow.postprocessBrowserAsrCollectedSpeechPayload;
var restoreBrowserAsrCollectedSpeechSegments = FuguangBrowserAsrWorkflow.restoreBrowserAsrCollectedSpeechSegments;
var normalizeBrowserAsrCollectedSpeechTimeMap = FuguangBrowserAsrWorkflow.normalizeBrowserAsrCollectedSpeechTimeMap;
var browserAsrCollectedSpeechMapItemForTime = FuguangBrowserAsrWorkflow.browserAsrCollectedSpeechMapItemForTime;
var restoreBrowserAsrCollectedSpeechTime = FuguangBrowserAsrWorkflow.restoreBrowserAsrCollectedSpeechTime;
var mergeBrowserAsrCollectedSpeechPostprocess = FuguangBrowserAsrWorkflow.mergeBrowserAsrCollectedSpeechPostprocess;
var browserAsrDroppedSegments = FuguangBrowserAsrWorkflow.browserAsrDroppedSegments;
var browserAsrSegmentDiagnosticKey = FuguangBrowserAsrWorkflow.browserAsrSegmentDiagnosticKey;
var browserAsrRoundedDiagnosticSecond = FuguangBrowserAsrWorkflow.browserAsrRoundedDiagnosticSecond;
var mergeBrowserAsrClipRetryPostprocess = FuguangBrowserAsrWorkflow.mergeBrowserAsrClipRetryPostprocess;
var mergeBrowserAsrSegmentLists = FuguangBrowserAsrWorkflow.mergeBrowserAsrSegmentLists;
var browserAsrRequestIncludesClipTimestamps = FuguangBrowserAsrWorkflow.browserAsrRequestIncludesClipTimestamps;
var browserAsrRequestIncludesVadFilter = FuguangBrowserAsrWorkflow.browserAsrRequestIncludesVadFilter;
var browserAsrCoverageRetryPlan = FuguangBrowserAsrWorkflow.browserAsrCoverageRetryPlan;
var browserAsrEmptyVadRecoveryPlan = FuguangBrowserAsrWorkflow.browserAsrEmptyVadRecoveryPlan;
var filterBrowserAsrStrictVadRecoveryPostprocess = FuguangBrowserAsrWorkflow.filterBrowserAsrStrictVadRecoveryPostprocess;
var filterBrowserAsrCoverageRetryPostprocess = FuguangBrowserAsrWorkflow.filterBrowserAsrCoverageRetryPostprocess;
var normalizeBrowserAsrRetryPayloadSegments = FuguangBrowserAsrWorkflow.normalizeBrowserAsrRetryPayloadSegments;
var browserAsrCoverageRetryFilteredPostprocess = FuguangBrowserAsrWorkflow.browserAsrCoverageRetryFilteredPostprocess;
var browserAsrUncoveredSpeechIntervalsForSegments = FuguangBrowserAsrWorkflow.browserAsrUncoveredSpeechIntervalsForSegments;
var browserAsrUncoveredSpeechIntervals = FuguangBrowserAsrWorkflow.browserAsrUncoveredSpeechIntervals;
var browserAsrSegmentOverlapsCoverageGap = FuguangBrowserAsrWorkflow.browserAsrSegmentOverlapsCoverageGap;
var browserAsrRepeatedCoverageRetryKeys = FuguangBrowserAsrWorkflow.browserAsrRepeatedCoverageRetryKeys;
var browserAsrDropRepeatedCoverageRetrySegments = FuguangBrowserAsrWorkflow.browserAsrDropRepeatedCoverageRetrySegments;
var normalizeBrowserAsrRetryRepeatText = FuguangBrowserAsrWorkflow.normalizeBrowserAsrRetryRepeatText;
var browserAsrReliableSpeechCoverageStats = FuguangBrowserAsrWorkflow.browserAsrReliableSpeechCoverageStats;
var browserAsrReliableSpeechCoverageMissingFromStats = FuguangBrowserAsrWorkflow.browserAsrReliableSpeechCoverageMissingFromStats;
var browserAsrUncoveredSpeechSeconds = FuguangBrowserAsrWorkflow.browserAsrUncoveredSpeechSeconds;
var browserAsrSpeechCoverageSpans = FuguangBrowserAsrWorkflow.browserAsrSpeechCoverageSpans;
var detectBrowserAsrSpeechIntervals = FuguangBrowserAsrWorkflow.detectBrowserAsrSpeechIntervals;
var normalizeBrowserAsrSpeechTimestampsPayload = FuguangBrowserAsrWorkflow.normalizeBrowserAsrSpeechTimestampsPayload;
var browserAsrSpeechTimestampRangeSeconds = FuguangBrowserAsrWorkflow.browserAsrSpeechTimestampRangeSeconds;
var browserAsrSpeechTimestampNumber = FuguangBrowserAsrWorkflow.browserAsrSpeechTimestampNumber;
var inferBrowserAsrBareTimestampUnit = FuguangBrowserAsrWorkflow.inferBrowserAsrBareTimestampUnit;
var isLikelyBrowserAsrBareIntegerSeconds = FuguangBrowserAsrWorkflow.isLikelyBrowserAsrBareIntegerSeconds;
var emitBrowserAsrDiagnostics = FuguangBrowserAsrWorkflow.emitBrowserAsrDiagnostics;
var recordBrowserAsrChunkDiagnostics = FuguangBrowserAsrWorkflow.recordBrowserAsrChunkDiagnostics;
var browserAsrDiagnosticChunkInfo = FuguangBrowserAsrWorkflow.browserAsrDiagnosticChunkInfo;
var normalizeBrowserAsrCollectedSpeechChunk = FuguangBrowserAsrWorkflow.normalizeBrowserAsrCollectedSpeechChunk;
var browserAsrCollectedSpeechChunkInfo = FuguangBrowserAsrWorkflow.browserAsrCollectedSpeechChunkInfo;
var cloneJsonForDiagnostics = FuguangBrowserAsrWorkflow.cloneJsonForDiagnostics;
var finiteOrNull = FuguangBrowserAsrWorkflow.finiteOrNull;
var sanitizeDiagnosticUrl = FuguangBrowserAsrWorkflow.sanitizeDiagnosticUrl;
var formatAsrFetchError = FuguangBrowserAsrWorkflow.formatAsrFetchError;
var browserAsrMaxUploadBytes = FuguangBrowserAsrWorkflow.browserAsrMaxUploadBytes;
var formatBytes = FuguangBrowserAsrWorkflow.formatBytes;
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
var acquireMediaHeaderLease = FuguangMediaHeaderRules.acquireMediaHeaderLease;
var releaseMediaHeaderLease = FuguangMediaHeaderRules.releaseMediaHeaderLease;
var reconcileMediaHeaderLeases = FuguangMediaHeaderRules.reconcileMediaHeaderLeases;
var updateMediaHeaderLeaseDomains = FuguangMediaHeaderRules.updateMediaHeaderLeaseDomains;
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
  OFFSCREEN_WEB_FFMPEG_COMPLETED: "FUGUANG_OFFSCREEN_WEB_FFMPEG_COMPLETED",
  OFFSCREEN_WEB_FFMPEG_FAILED: "FUGUANG_OFFSCREEN_WEB_FFMPEG_FAILED",
  OFFSCREEN_GET_ACTIVE_MEDIA_HEADER_LEASES: "FUGUANG_OFFSCREEN_GET_ACTIVE_MEDIA_HEADER_LEASES",
  UPDATE_MEDIA_HEADER_RULE_DOMAINS: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS",
  SIDEPANEL_SUBSCRIBE: "FUGUANG_SIDEPANEL_SUBSCRIBE",
  SIDEPANEL_JOB_CHANGED: "FUGUANG_SIDEPANEL_JOB_CHANGED"
};
const SIDEPANEL_STATUS_PORT_NAME = "fuguang-sidepanel-status-v1";
const BROWSER_ABORT_ERROR_BRAND = Symbol("fuguang.browser.abort-error");
const BROWSER_ASR_RESULT_WARNING = Symbol("fuguang.browser.asr-result-warning");

const DEFAULT_WEB_FFMPEG_PATH = "web-ffmpeg/index.html";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_AUDIO_CACHE_CLEANUP_ALARM = "fuguang-audio-cache-cleanup";
const MEDIA_HEADER_RULE_RECOVERY_ALARM = "fuguang-media-header-rule-recovery";
const MEDIA_HEADER_RULE_RECOVERY_BASE_MINUTES = 0.5;
const MEDIA_HEADER_RULE_RECOVERY_MAX_MINUTES = 10;
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
const browserJobLifecycleLocks = new Map();
const offscreenBrowserChunkOperations = new Map();
const offscreenBrowserFinalizationOperations = new Map();
const offscreenTaskRuntimeCommands = new Map();
const sidepanelStatusPorts = new Map();
const sidepanelStatusPushTimers = new Map();
let browserAudioCacheCleanupPromise = null;
let browserAudioCacheLastCleanupAt = 0;
let browserMediaExtractionQueue = Promise.resolve();
let offscreenDocumentCreationPromise = null;
let offscreenDocumentClosePromise = null;
let offscreenTaskRuntimePort = null;
let offscreenTaskRuntimeConnectionPromise = null;
let mediaHeaderRuleRecoveryPromise = null;
let mediaHeaderRuleRecoveryLastResult = null;
let mediaHeaderRuleRecoveryRetryAttempt = 0;
let browserJobRecoveryPromise = null;
let browserJobLedgerMaintenancePromise = null;
let browserVttAttachmentGeneration = Date.now() * 1000;

const tabState = new Map();
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
runMediaHeaderRuleRecovery({ force: true }).catch(() => {});
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
      documentId: normalizeDocumentId(details.documentId),
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
      documentId: normalizeDocumentId(details.documentId),
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
      frameId: normalizeFrameId(details.frameId),
      documentId: normalizeDocumentId(details.documentId),
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
  return clearFrameNavigationState(details.tabId, details.frameId);
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
    scheduleSidepanelStatusChange(tabId);
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
    state.mediaDocumentId = "";
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
      addPageMediaCandidate(sender.tab?.id, message.media, sender.frameId, sender.documentId);
      return {};
    case MESSAGE.PAGE_CONTEXT_FOUND:
      updateTabContext(sender.tab?.id, message.context, sender.frameId, sender.documentId);
      return {};
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_PROGRESS:
      return applyOffscreenWebFfmpegProgress(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_CHUNK_READY:
      return applyOffscreenWebFfmpegChunkReady(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_COMPLETED:
      return applyOffscreenWebFfmpegCompleted(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_FAILED:
      return applyOffscreenWebFfmpegFailed(message);
    case MESSAGE.UPDATE_MEDIA_HEADER_RULE_DOMAINS:
      if (message.mediaHeaderLease) {
        return updateMediaHeaderLeaseDomains(message.mediaHeaderLease, message.urls || []);
      }
      return updateMediaRequestHeaderRuleDomains(message.jobId, message.urls || []);
    case FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK:
      return processOffscreenBrowserJobChunk(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK:
      return getOffscreenBrowserJobWork(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT:
      return getOffscreenBrowserJobExecutionInput(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.REPORT_JOB_WORK_PROGRESS:
      return reportOffscreenBrowserJobWorkProgress(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT:
      return commitOffscreenBrowserJobWorkResult(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB:
      return finalizeOffscreenBrowserJob(message);
    case FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB:
      return failOffscreenBrowserJob(message);
    default:
      return {};
  }
}

async function getStatus(tabId) {
  await browserJobRecoveryPromise;
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
    const matchingRecord = findBrowserPreloadRecordForTabPage(tabId, currentPageUrl)
      || await recoverBrowserPresentationJobForTabPage(tabId, currentPageUrl);
    if (matchingRecord) {
      preloadJob = browserPreloadJobForRead(matchingRecord);
      state.preload = preloadJob.status || "running";
      state.preloadJob = cloneBrowserJobState(preloadJob);
    }
  }
  const visibleRecord = preloadJob?.id ? browserPreloadJobs.get(preloadJob.id) : null;
  if (visibleRecord) {
    await refreshBrowserFunAsrCancellationProjection(visibleRecord);
    preloadJob = browserPreloadJobForRead(visibleRecord);
    state.preloadJob = cloneBrowserJobState(preloadJob);
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
  await refreshTabInfo(tabId);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const pageUrl = preloadCandidate.pageUrl || state.page?.url || tab?.url || preloadCandidate.initiator || state.context?.href || "";
  const modelConfig = await getModelConfig();
  await preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
    tabId,
    pageUrl,
    state.preloadJob,
    modelConfig,
    preloadCandidate
  );
  clearPreloadSubtitleSuppression(tabId);
  await detachPreloadVtt(tabId);
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
  const presentationBinding = createBrowserPresentationBinding(tabId, candidate, executionMetadata.pageUrl || candidate.pageUrl || "");
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
    presentationBinding,
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
  const needsModel = browserAsrProviderNeedsModel(asr);
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
  // Paid ASR/translation execution is durable only in offscreen. If the runner
  // cannot start, still finish extraction and keep the audio for an explicit
  // retry; never switch back to Service Worker network requests.
  const offscreenStarted = offscreenStart.status !== "unavailable";
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
  if ((record.audioChunks || []).length) {
    record.offscreenExecution = false;
    record.job.status = "interrupted";
    record.job.stage = "interrupted";
    record.job.error = "offscreen 识别执行器不可用，已保留抽取音频，请重试。";
    record.job.updatedAt = Date.now();
    record.job.translation = {
      ...record.job.translation,
      status: "interrupted",
      message: "等待 offscreen 识别执行器"
    };
    publishBrowserPreloadJob(record);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
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
  // Fun-ASR submit is a paid, asynchronous remote operation. It must never fall
  // back to the Service Worker when the durable offscreen runner is unavailable.
  // Media extraction can still finish so the cached audio remains retryable.
  const offscreenStarted = offscreenStart.status !== "unavailable";
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
  record.offscreenExecution = false;
  record.job.status = "interrupted";
  record.job.stage = "interrupted";
  record.job.error = "Fun-ASR durable offscreen 执行器不可用，已保留抽取音频，请重试。";
  record.job.updatedAt = Date.now();
  record.job.translation = {
    ...record.job.translation,
    status: "interrupted",
    message: "等待 offscreen 识别执行器"
  };
  publishBrowserPreloadJob(record);
  await flushBrowserJobMirror(record.job.id).catch(() => null);
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
    updateChunkStatus(record, index, {
      stage: "asr_inflight",
      status: "识别",
      attempts: attempt,
      error: "",
      message: `Fun-ASR 请求已提交前检查点 · ${index + 1}/${chunksTotal}`
    });
    await checkpointBrowserPaidRequest(options, "onAsrStartCheckpoint", "识别请求状态持久化失败。");
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
        asrRequired: false,
        sourceCount: 0,
        translatedCount: 0,
        message: "Fun-ASR 未返回可显示语音"
      });
      publishBrowserSubtitle(record);
      await checkpointBrowserAsrResult(options);
      return;
    }
    updateChunkStatus(record, index, {
      stage: "asr_done",
      status: "待翻译",
      attempts: attempt,
      asrRequired: false,
      sourceCount: sourceSegments.length,
      error: "",
      message: `Fun-ASR 原文 ${sourceSegments.length}`
    });
    publishBrowserSubtitle(record);
    await checkpointBrowserAsrResult(options);
    if (options.deferTranslationToOffscreen) {
      return;
    }
    await processBrowserTranslationChunk(record, {
      index,
      start: chunk.start,
      end: chunk.end,
      duration: chunk.duration
    }, sourceSegments, options);
  } catch (error) {
    if (error?.offscreenCheckpointFailure) {
      throw error;
    }
    if (isBrowserAbortError(error, signal) ||
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

async function checkpointBrowserAsrResult(options = {}) {
  if (typeof options.onAsrCheckpoint !== "function") {
    return;
  }
  const committed = await options.onAsrCheckpoint();
  if (committed?.applied !== false) {
    return;
  }
  const error = new Error(committed.error || committed.reason || "识别结果持久化失败。");
  error.offscreenCheckpointFailure = true;
  error.commitResult = committed;
  throw error;
}

async function checkpointBrowserPaidRequest(options, callbackName, failureMessage) {
  const callback = options?.[callbackName];
  if (typeof callback !== "function") {
    return;
  }
  const committed = await callback();
  if (committed?.applied !== false) {
    return;
  }
  const error = new Error(committed.error || committed.reason || failureMessage);
  error.offscreenCheckpointFailure = true;
  error.commitResult = committed;
  throw error;
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
  await runMediaHeaderRuleRecovery();
  const acquiredHeaderRule = await acquireMediaHeaderLease({
    sourceUrls: headerRuleUrls,
    pageUrl,
    jobId: record.job.id,
    runToken: record.runToken
  });
  const mediaHeaderLease = acquiredHeaderRule?.lease || null;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
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
      jobId: record.job.id,
      runToken: record.runToken,
      mediaHeaderLease
    });
  } finally {
    if (mediaHeaderLease) {
      await releaseMediaHeaderLease(mediaHeaderLease).catch(() => null);
    }
  }
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

async function releaseMediaHeaderLeaseBeforeTerminal(message = {}) {
  const lease = message.mediaHeaderLease;
  if (!lease) {
    return { released: true, alreadyAbsent: true };
  }
  if (
    String(lease.jobId || "") !== String(message.jobId || "") ||
    String(lease.runToken || "") !== String(message.runToken || "")
  ) {
    return { released: false, retryable: false, reason: "lease-message-mismatch" };
  }
  try {
    const result = await releaseMediaHeaderLease(lease);
    if (result?.released) {
      return result;
    }
    if (result?.reason === "stale-lease") {
      return { released: true, alreadyAbsent: true, staleLease: true };
    }
    return result || { released: false, retryable: true, reason: "lease-release-empty" };
  } catch (error) {
    return {
      released: false,
      retryable: true,
      reason: "lease-release-error",
      error: error?.message || String(error)
    };
  }
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

async function applyOffscreenWebFfmpegChunkReady(message) {
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
    if (emitted.length) {
      await flushBrowserJobMirror(record.job.id);
      await wakeOffscreenBrowserJob(record, "audio-chunk-ready");
    }
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
  if (emitted.length) {
    await flushBrowserJobMirror(record.job.id);
    await wakeOffscreenBrowserJob(record, "audio-chunk-ready");
  }
  return { chunks: emitted.length };
}

async function applyOffscreenWebFfmpegCompleted(message) {
  const headerRelease = await releaseMediaHeaderLeaseBeforeTerminal(message);
  if (!headerRelease.released) {
    return {
      accepted: false,
      retryable: Boolean(headerRelease.retryable),
      error: headerRelease.error || headerRelease.reason || "媒体请求头临时规则释放失败。"
    };
  }
  await browserJobRecoveryPromise;
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!isCurrentBrowserPreloadRecord(record) ||
      (message?.runToken && String(message.runToken) !== String(record.runToken || ""))) {
    return { accepted: false, stale: true };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  if (record.job?.extract?.status === "completed") {
    return { accepted: true, duplicate: true, chunks: (record.audioChunks || []).length };
  }
  try {
    const audio = message?.result || {};
    if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
      for (const chunk of normalizeBrowserAudioChunks(
        audio,
        Number(audio.asrChunkSeconds || audio.chunkSeconds || record.browserAsrChunkSeconds) || dashScopeFunAsrChunkSeconds(record.metadata),
        record.metadata?.duration
      )) {
        appendBrowserFunAsrAudioChunk(record, chunk);
      }
      record.audioChunks = uniqueBrowserAudioChunks(record.audioChunks);
      if (!record.audioChunks.length) {
        throw createNoBrowserAudioChunksError(audio);
      }
      const chunksTotal = browserFunAsrExpectedChunkCount(record);
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
      closeBrowserFunAsrQueue(record);
    } else {
      if (record.browserStreamingInternalChunks) {
        for (const chunk of Array.isArray(audio.chunks) ? audio.chunks : []) {
          appendBrowserInternalAudioChunk(record, chunk);
        }
        flushBrowserInternalAudioChunks(record, true);
      } else {
        for (const chunk of normalizeBrowserAudioChunks(
          audio,
          Number(audio.asrChunkSeconds || audio.chunkSeconds || record.browserAsrChunkSeconds) || browserAsrUploadChunkSeconds(record.modelConfig),
          record.metadata?.duration
        )) {
          enqueueBrowserLogicalAudioChunk(record, chunk);
        }
      }
      const hasAudioChunks = Boolean((record.audioChunks || []).length);
      if (
        !hasAudioChunks &&
        !browserPreloadRecordHasOnlyKnownNonspeechAudio(record) &&
        !browserAudioResultHasOnlyKnownNonspeech(audio)
      ) {
        throw createNoBrowserAudioChunksError(audio);
      }
      record.job.translation = {
        ...record.job.translation,
        status: hasAudioChunks ? (record.job.translation?.status || "running") : "completed",
        chunksTotal: hasAudioChunks
          ? Math.max(Number(record.job.translation?.chunksTotal || 0) || 0, record.browserTranslationGroups?.size || 0)
          : 0,
        chunkStatuses: record.job.translation?.chunkStatuses || []
      };
      closeBrowserAsrQueue(record);
    }
    const hasAudioChunks = Boolean((record.audioChunks || []).length);
    record.job.extract = {
      ...record.job.extract,
      status: "completed",
      progress: 100,
      phase: "completed",
      message: "",
      chunkCount: (record.audioChunks || []).length,
      availableSeconds: Math.round(Number(audio.duration || 0) || (record.audioChunks || []).reduce((sum, chunk) => sum + (chunk.duration || 0), 0)),
      duration: pickFinite(audio.duration, record.job.extract?.duration, record.metadata?.duration),
      elapsedSeconds: elapsedSeconds(record.startedAt)
    };
    record.job.stage = hasAudioChunks ? "asr" : "completed";
    record.extractionTerminalAppliedAt = Date.now();
    publishBrowserPreloadJob(record);
    await flushBrowserJobMirror(record.job.id);
    await wakeOffscreenBrowserJob(record, "extraction-completed");
    return { accepted: true, chunks: (record.audioChunks || []).length };
  } catch (error) {
    failBrowserPreloadJob(record, error);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
    await wakeOffscreenBrowserJob(record, "extraction-failed");
    return { accepted: false, failed: true, error: error?.message || String(error) };
  }
}

async function applyOffscreenWebFfmpegFailed(message) {
  const headerRelease = await releaseMediaHeaderLeaseBeforeTerminal(message);
  if (!headerRelease.released) {
    return {
      accepted: false,
      retryable: Boolean(headerRelease.retryable),
      error: headerRelease.error || headerRelease.reason || "媒体请求头临时规则释放失败。"
    };
  }
  await browserJobRecoveryPromise;
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!isCurrentBrowserPreloadRecord(record) ||
      (message?.runToken && String(message.runToken) !== String(record.runToken || ""))) {
    return { accepted: false, stale: true };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  if (record.job?.extract?.status === "completed") {
    return { accepted: true, duplicate: true };
  }
  failBrowserPreloadJob(record, new Error(message?.error || "Web FFmpeg 音频提取失败。"));
  await flushBrowserJobMirror(record.job.id).catch(() => null);
  await wakeOffscreenBrowserJob(record, "extraction-failed");
  return { accepted: false, failed: true, error: record.job.error || "" };
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
  refreshBrowserPreloadJobSummary(record);
  publishBrowserPreloadJobUi(record, browserPreloadJobForRead(record));
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
  rememberBrowserExpectedAudioChunk(record, item.index, item.index);
  if (item.asrCompleted !== true) {
    record.job.translation.chunkStatuses[item.index].asrRequired = true;
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
  rememberBrowserExpectedAudioChunk(record, group.index, normalized.index);
  if (normalized.asrCompleted !== true) {
    record.job.translation.chunkStatuses[group.index].asrRequired = true;
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

function rememberBrowserExpectedAudioChunk(record, groupIndex, audioChunkIndex) {
  const index = Number(groupIndex);
  const audioIndex = Number(audioChunkIndex);
  if (!Number.isFinite(index) || !Number.isFinite(audioIndex)) {
    return;
  }
  const statuses = record?.job?.translation?.chunkStatuses;
  if (!Array.isArray(statuses)) {
    return;
  }
  const status = statuses[index] || createChunkStatus(index, "queued");
  const previous = (Array.isArray(status.expectedAudioChunkIndexes) ? status.expectedAudioChunkIndexes : [])
    .map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  const expected = [...new Set([
    ...(Array.isArray(status.expectedAudioChunkIndexes) ? status.expectedAudioChunkIndexes : []),
    audioIndex
  ].map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  if (previous.length === expected.length && previous.every((value, position) => value === expected[position])) {
    statuses[index] = status;
    return;
  }
  status.expectedAudioChunkIndexes = expected;
  statuses[index] = status;
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

function browserRecognitionGroupIndex(record, chunk) {
  const mapped = record?.browserAsrChunkToTranslationGroup?.get?.(chunk?.index);
  return Number.isFinite(Number(mapped))
    ? Number(mapped)
    : browserTranslationGroupIndex(record, chunk);
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
  }
  if (Array.isArray(sourceSegments) && sourceSegments.length) {
    group.sourceSegments.push(...sourceSegments);
  } else if (!error) {
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
  if (group.failed && !sourceSegments.length) {
    const existingSourceSegments = record.sourceSegmentsByChunk.get(group.index) || [];
    const existingTranslatedSegments = record.translatedSegmentsByChunk.get(group.index) || [];
    group.translationQueued = true;
    updateChunkStatus(record, group.index, {
      stage: "failed",
      status: "失败",
      asrRequired: false,
      sourceCount: existingSourceSegments.length,
      translatedCount: existingTranslatedSegments.length,
      asrFailures: group.failed,
      asrErrors: group.errors.slice(0, 5),
      error: group.errors[0] || "这个识别分段没有可用原文。"
    });
    publishBrowserSubtitle(record);
    return true;
  }
  record.sourceSegmentsByChunk.set(group.index, sourceSegments);
  if (!sourceSegments.length) {
    group.translationQueued = true;
    record.translatedSegmentsByChunk.set(group.index, []);
    updateChunkStatus(record, group.index, {
      stage: "completed",
      status: "完成",
      asrRequired: false,
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
    asrRequired: false,
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
  updateChunkStatus(record, group.index, {
    stage: "asr_inflight",
    status: "识别",
    attempts: Math.max(1, current.attempts || 1),
    error: "",
    message: `识别请求已提交前检查点 · ${browserAsrChunkTimeRangeText(chunk)}`
  });
  await checkpointBrowserPaidRequest(options, "onAsrStartCheckpoint", "识别请求状态持久化失败。");
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
    if (isBrowserAbortError(error, signal) ||
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
  const warning = browserAsrResultWarning(sourceSegments);
  markBrowserAudioChunkAsrResult(chunk, sourceSegments, warning);
  completeBrowserAsrChunkForGroup(record, chunk, sourceSegments, warning);
}

function markBrowserAudioChunkAsrResult(chunk, sourceSegments, error = null) {
  if (!chunk || typeof chunk !== "object") {
    return;
  }
  chunk.asrCompleted = true;
  chunk.asrFailed = Boolean(error);
  chunk.asrError = error ? String(error.message || error) : "";
  if (!error) {
    chunk.asrErrorStatus = 0;
    chunk.asrErrorCode = "";
    chunk.asrDeliveryAmbiguous = false;
    chunk.asrStage = "";
  }
  chunk.sourceSegments = Array.isArray(sourceSegments) ? sourceSegments : [];
  chunk.updatedAt = Date.now();
}

function attachBrowserAsrResultWarning(sourceSegments, warning) {
  const segments = Array.isArray(sourceSegments) ? sourceSegments : [];
  if (!warning) {
    return segments;
  }
  Object.defineProperty(segments, BROWSER_ASR_RESULT_WARNING, {
    value: warning,
    enumerable: false,
    configurable: true
  });
  return segments;
}

function browserAsrResultWarning(sourceSegments) {
  return Array.isArray(sourceSegments) ? sourceSegments[BROWSER_ASR_RESULT_WARNING] || null : null;
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
  await checkpointBrowserPaidRequest(options, "onTranslationStartCheckpoint", "翻译请求状态持久化失败。");
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
        maxConcurrency: browserTranslationProviderConcurrency(record),
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
    if (isBrowserAbortError(error, signal) ||
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

async function transcribeBrowserAudioChunk(chunk, asrConfig, options = {}) {
  return FuguangBrowserAsrWorkflow.transcribeBrowserAudioChunk(chunk, asrConfig, {
    ...options,
    getAudioBuffer: getBrowserAudioChunkBuffer,
    attachResultWarning: attachBrowserAsrResultWarning,
    collectSpeechAudio: async payload => {
      await ensureOffscreenDocument();
      const { url: webFfmpegUrl } = await getWebFfmpegConfig();
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE.OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO,
        webFfmpegUrl,
        ...payload
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Web FFmpeg 语音收集失败。");
      }
      return response;
    }
  });
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

function updateChunkStatus(record, index, patch, options = {}) {
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
  const asrRunning = statuses.filter(item => ["asr", "asr_inflight"].includes(item.stage)).length;
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
  if (options.publish !== false) {
    publishBrowserPreloadJob(record);
  }
}

function chunkStatusAsrFailureCount(status) {
  return Math.max(0, Number(status?.asrFailures || status?.asr_failures || 0) || 0);
}

function publishBrowserSubtitle(record) {
  refreshBrowserSubtitleProjection(record);
  publishBrowserPreloadJob(record);
  if (isCurrentBrowserPreloadRecord(record) && !record.offscreenMirrorSuppressionCount) {
    attachBrowserJobVttIfReady(record).catch(() => {});
  }
}

function refreshBrowserSubtitleProjection(record) {
  const source = collectChunkSegments(record.sourceSegmentsByChunk);
  if (record.job.subtitleCleared) {
    record.job.translation.sourceSegments = source.length;
    record.job.translation.translatedSegments = 0;
    record.job.translation.segmentCount = 0;
    record.job.translation.vttPath = "";
    record.job.translation.vttText = "";
    record.job.translation.transcript = { source, translated: [], metadata: record.metadata };
    return;
  }
  const translated = collectChunkSegments(record.translatedSegmentsByChunk);
  const display = mergeTranslatedDisplaySegments(source, translated);
  record.job.translation.sourceSegments = source.length;
  record.job.translation.translatedSegments = translated.length;
  record.job.translation.segmentCount = display.length;
  record.job.translation.vttPath = display.length ? "browser-memory" : "";
  record.job.translation.vttText = display.length ? segmentsToVtt(display) : "";
  record.job.translation.transcript = { source, translated, metadata: record.metadata };
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
  const finalTranslationStage = messages.length ? "completed_with_warnings" : "completed";
  record.job.status = "completed";
  record.job.stage = finalTranslationStage;
  record.job.translation.status = finalTranslationStage;
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
  if (!record?.tabId || snapshot?.subtitleCleared || !snapshot?.translation?.vttText ||
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
  const response = await sendBrowserJobVttToBoundMedia(record, {
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
  }
  publishBrowserPreloadJobUi(record, browserPreloadJobForRead(record));
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

function withBrowserJobLifecycleLock(jobId, task) {
  const key = String(jobId || "").trim();
  if (!key) return Promise.resolve().then(task);
  const previous = browserJobLifecycleLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  browserJobLifecycleLocks.set(key, current);
  return previous.catch(() => null).then(task).finally(() => {
    release();
    if (browserJobLifecycleLocks.get(key) === current) {
      browserJobLifecycleLocks.delete(key);
    }
  });
}

async function beginBrowserJobAttempt(record, stage, options = {}) {
  return withBrowserJobLifecycleLock(record?.job?.id, () => beginBrowserJobAttemptUnlocked(record, stage, options));
}

async function beginBrowserJobAttemptUnlocked(record, stage, options = {}) {
  if (!record?.job?.id) {
    throw new Error("任务缺少可重试的运行标识。请重新开始任务。");
  }
  if (record.attemptStartInFlight || ["queued", "running"].includes(String(record.job.status || ""))) {
    throw new Error("任务正在运行，已忽略重复的重试请求。");
  }
  record.attemptStartInFlight = true;
  let rollbackRecognitionPreparation = null;
  let attemptAccepted = false;
  try {
    const previousRunToken = String(record.runToken || record.job.runToken || createDurableRunToken());
    await preventFunAsrSubmitWhileRemoteCancellationUnresolved({
      ...record.job,
      id: record.job.id,
      runToken: previousRunToken,
      pipeline: record.pipeline || record.job.pipeline
    }, record.modelConfig || {});
    record.runToken = previousRunToken;
    record.job.runToken = previousRunToken;
    record.abortController ||= new AbortController();
    scheduleBrowserJobMirror(record);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
    const previousState = {
      cancelled: record.cancelled,
      hadCancelled: Object.hasOwn(record, "cancelled"),
      cancelRequested: record.cancelRequested,
      hadCancelRequested: Object.hasOwn(record, "cancelRequested"),
      abortController: record.abortController,
      hadAbortController: Object.hasOwn(record, "abortController"),
      preserveExistingOnCancel: record.preserveExistingOnCancel,
      hadPreserveExistingOnCancel: Object.hasOwn(record, "preserveExistingOnCancel"),
      jobStatus: record.job.status,
      jobStage: record.job.stage,
      jobUpdatedAt: record.job.updatedAt,
      jobPreserveExistingOnCancel: record.job.preserveExistingOnCancel,
      jobHadPreserveExistingOnCancel: Object.hasOwn(record.job, "preserveExistingOnCancel"),
      jobCancelRequested: record.job.cancelRequested,
      jobHadCancelRequested: Object.hasOwn(record.job, "cancelRequested"),
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
    record.preserveExistingOnCancel = ["retrying", "retry_translation"].includes(String(stage || ""));
    record.job.preserveExistingOnCancel = record.preserveExistingOnCancel;
    record.job.cancelRequested = false;
    record.job.updatedAt = Date.now();
    delete record.job.cancelRequestedAt;
    const asrIndexes = [...new Set((Array.isArray(options.asrIndexes) ? options.asrIndexes : [])
      .map(Number).filter(Number.isFinite))];
    if (asrIndexes.length) {
      rollbackRecognitionPreparation = prepareBrowserRecognitionAttemptSnapshot(record, asrIndexes);
    }
    const snapshot = createBrowserJobLedgerSnapshot(record);
    const result = await browserJobStore.beginAttempt(snapshot, previousRunToken).catch(() => ({
      applied: false,
      reason: "unavailable"
    }));
    if (result.applied === false && !["unavailable", "stale-snapshot"].includes(result.reason)) {
      record.runToken = previousRunToken;
      restoreBrowserAttemptProperty(record, "cancelled", previousState.hadCancelled, previousState.cancelled);
      restoreBrowserAttemptProperty(record, "cancelRequested", previousState.hadCancelRequested, previousState.cancelRequested);
      restoreBrowserAttemptProperty(record, "abortController", previousState.hadAbortController, previousState.abortController);
      restoreBrowserAttemptProperty(record, "preserveExistingOnCancel", previousState.hadPreserveExistingOnCancel, previousState.preserveExistingOnCancel);
      record.job.runToken = previousRunToken;
      record.job.status = previousState.jobStatus;
      record.job.stage = previousState.jobStage;
      record.job.updatedAt = previousState.jobUpdatedAt;
      restoreBrowserAttemptProperty(record.job, "preserveExistingOnCancel", previousState.jobHadPreserveExistingOnCancel, previousState.jobPreserveExistingOnCancel);
      restoreBrowserAttemptProperty(record.job, "cancelRequested", previousState.jobHadCancelRequested, previousState.jobCancelRequested);
      if (previousState.jobCancelRequestedAt == null) {
        delete record.job.cancelRequestedAt;
      } else {
        record.job.cancelRequestedAt = previousState.jobCancelRequestedAt;
      }
      rollbackRecognitionPreparation?.();
      rollbackRecognitionPreparation = null;
      throw new Error("任务已由另一个运行实例接管，请刷新状态后重试。");
    }
    attemptAccepted = true;
    previousState.abortController?.abort(new Error("任务已由新的执行尝试替换。"));
    return runToken;
  } catch (error) {
    if (!attemptAccepted) {
      rollbackRecognitionPreparation?.();
    }
    throw error;
  } finally {
    record.attemptStartInFlight = false;
  }
}

function restoreBrowserAttemptProperty(target, key, hadProperty, value) {
  if (hadProperty) {
    target[key] = value;
  } else {
    delete target[key];
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
    let chunks = await browserJobStore.getChunks(ledger.id, ledger.runToken);
    const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
    const missingAudioRefs = [];
    for (const chunk of chunks.filter(entry => String(entry?.entryType || "") === "audio-chunk")) {
      for (const ref of browserAudioCacheRefsFromLedgerChunk(chunk)) {
        try {
          if (!await cache.match(ref)) {
            missingAudioRefs.push(ref);
          }
        } catch {
          // A transient CacheStorage read error does not prove that the durable
          // audio is missing. Leave the ledger intact so a later verification
          // can retry without destroying reusable audio metadata.
        }
      }
    }
    if (missingAudioRefs.length) {
      await reconcileBrowserAudioCacheDeletion(missingAudioRefs, chunks);
      chunks = await browserJobStore.getChunks(ledger.id, ledger.runToken);
    }
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
  const browserAsrDiagnosticsByChunk = new Map();
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
        const asrDiagnostics = FuguangJobContract.sanitizeAsrDiagnostics(chunk.asrDiagnostics);
        if (asrDiagnostics) {
          browserAsrDiagnosticsByChunk.set(index, asrDiagnostics);
        }
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
  const presentationOnly = Boolean(options.presentationOnly);
  const offscreenExecutionActive = Boolean(
    !presentationOnly &&
    !recoveryError &&
    !ledger.cancelRequested &&
    ledger.executionRunToken === ledger.runToken &&
    ledger.executionStartedAt &&
    ["queued", "running"].includes(String(ledger.status || ""))
  );
  const preservedRetryCancel = Boolean(ledger.cancelRequested && ledger.preserveExistingOnCancel);
  const durableStatus = String(ledger.status || "");
  const durableError = String(ledger.error || "");
  const status = presentationOnly
    ? durableStatus
    : (ledger.cancelRequested && !preservedRetryCancel ? "cancelled" : (offscreenExecutionActive ? "running" : "interrupted"));
  const recoveredError = presentationOnly
    ? durableError
    : ledger.cancelRequested
    ? (preservedRetryCancel ? "已停止本次重试，保留现有字幕和音频缓存。" : "任务已停止。")
    : (recoveryError || (status === "interrupted"
        ? (durableStatus === "interrupted"
            ? durableError
            : "浏览器后台重启中断了任务。已保留完成分段，可继续处理或重新抽取。")
        : ""));
  const recoveredUpdatedAt = durableStatus !== status || durableError !== recoveredError
    ? Date.now()
    : Number(ledger.updatedAt || ledger.createdAt || Date.now());
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
    updatedAt: recoveredUpdatedAt,
    cancelRequested: Boolean(ledger.cancelRequested),
    preserveExistingOnCancel: Boolean(ledger.preserveExistingOnCancel),
    subtitleCleared: Boolean(ledger.subtitleCleared),
    reusableAudioChunks: Math.max(0, Number(ledger.reusableAudioChunks || 0) || 0),
    audioCacheRemoved: Boolean(ledger.audioCacheRemoved),
    audioCacheRemovedCount: Math.max(0, Number(ledger.audioCacheRemovedCount || 0) || 0),
    audioCacheVerified: Boolean(ledger.audioCacheVerified),
    audioCacheVerifiedAt: Number(ledger.audioCacheVerifiedAt || 0) || 0,
    audioCacheRemovedRefs: Array.isArray(ledger.audioCacheRemovedRefs) ? [...ledger.audioCacheRemovedRefs] : [],
    error: recoveredError,
    extract: { ...(ledger.extract || {}) },
    translation: {
      ...(ledger.translation || {}),
      status,
      chunkStatuses,
      chunksTotal: Math.max(Number(ledger.translation?.total || 0) || 0, chunkStatuses.filter(Boolean).length)
    }
  };
  const source = collectChunkSegments(sourceSegmentsByChunk);
  const translated = ledger.subtitleCleared ? [] : collectChunkSegments(translatedSegmentsByChunk);
  const display = ledger.subtitleCleared ? [] : mergeTranslatedDisplaySegments(source, translated);
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
  const recoveredFrameId = optionalBrowserFrameId(ledger.source?.frameId);
  const recoveredDocumentId = normalizeDocumentId(ledger.source?.documentId);
  const recoveredLineageKey = browserLedgerMediaLineageKey(ledger);
  const presentationBinding = recoveredFrameId !== null || recoveredDocumentId || recoveredLineageKey
    ? {
      frameId: recoveredFrameId,
      documentId: recoveredDocumentId,
      lineageKey: recoveredLineageKey
    }
    : null;
  const recoveredCandidate = {
    url: ledger.source?.identity || "",
    kind: ledger.source?.kind || "",
    ext: ledger.source?.ext || "",
    pageUrl: ledger.pageIdentity || "",
    ...(recoveredFrameId !== null ? { frameId: recoveredFrameId } : {}),
    ...(recoveredDocumentId ? { documentId: recoveredDocumentId } : {}),
    ...(recoveredLineageKey ? { lineageKey: recoveredLineageKey } : {})
  };
  const record = {
    tabId: Number(ledger.tabId),
    runToken: ledger.runToken,
    candidate: recoveredCandidate,
    selectedCandidate: recoveredCandidate,
    presentationBinding,
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
    preserveExistingOnCancel: Boolean(ledger.preserveExistingOnCancel),
    abortController,
    sourceSegmentsByChunk,
    translatedSegmentsByChunk,
    browserAsrDiagnosticsByChunk,
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
  record.presentationOnly = presentationOnly;
  rebuildRecoveredBrowserTranslationGroups(record);
  return record;
}

async function recoverBrowserPresentationJobForTabPage(tabId, pageUrl) {
  if (!tabId || !normalizeBrowserPageIdentity(pageUrl)) {
    return null;
  }
  const ledgers = await browserJobStore.listJobs().catch(() => []);
  const ledger = ledgers
    .filter(item =>
      Number(item?.tabId) === Number(tabId) &&
      ["completed", "done"].includes(String(item?.status || "")) &&
      browserPageIdentitiesMatch(item?.pageIdentity || "", pageUrl)
    )
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))[0];
  return ledger ? recoverBrowserPresentationJob(ledger.id, tabId, pageUrl, ledger) : null;
}

async function recoverBrowserPresentationJob(jobId, tabId = 0, pageUrl = "", knownLedger = null) {
  const id = String(jobId || "");
  if (!id) {
    return null;
  }
  const existing = browserPreloadJobs.get(id);
  if (existing) {
    return existing;
  }
  const snapshot = knownLedger
    ? { job: knownLedger, chunks: await browserJobStore.getChunks(id, knownLedger.runToken).catch(() => []) }
    : await browserJobStore.getSnapshot(id).catch(() => ({ job: null, chunks: [] }));
  const ledger = snapshot?.job;
  if (!ledger || !["completed", "done"].includes(String(ledger.status || ""))) {
    return null;
  }
  const expectedPage = pageUrl || getState(tabId || Number(ledger.tabId)).page?.url || "";
  if (tabId && Number(ledger.tabId) !== Number(tabId)) {
    return null;
  }
  if (expectedPage && !browserPageIdentitiesMatch(ledger.pageIdentity || "", expectedPage)) {
    return null;
  }
  const record = recoverBrowserJobRecord(ledger, snapshot.chunks || [], null, { presentationOnly: true });
  if (!record.job?.translation?.vttText && !record.job?.subtitleCleared) {
    return null;
  }
  browserPreloadJobs.set(id, record);
  await restoreRecoveredBrowserJobToTab(record);
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
    expectedAudioChunkIndexes: [...new Set((Array.isArray(chunk.expectedAudioChunkIndexes)
      ? chunk.expectedAudioChunkIndexes
      : []).map(Number).filter(Number.isFinite))].sort((left, right) => left - right),
    asrRequired: Boolean(chunk.asrRequired),
    asrFailures: Number(chunk.asrFailures || 0) || 0,
    translationFailures: Number(chunk.translationFailures || 0) || 0,
    translationErrorStatus: Number(chunk.translationErrorStatus || 0) || 0,
    translationErrorCode: String(chunk.translationErrorCode || ""),
    translationDeliveryAmbiguous: Boolean(chunk.translationDeliveryAmbiguous),
    translationExecutionMode: chunk.translationExecutionMode === "offscreen-durable-v1"
      ? "offscreen-durable-v1"
      : "",
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
  const speechIntervals = normalizeAsrSpeechIntervals(chunk.speechIntervals);
  return {
    index,
    start: Number(chunk.audioStart || 0) || 0,
    end: Number(chunk.audioEnd || 0) || 0,
    duration: Number(chunk.audioDuration || 0) || 0,
    coreStart: Number(chunk.audioCoreStart || chunk.audioStart || 0) || 0,
    coreEnd: Number(chunk.audioCoreEnd || chunk.audioEnd || 0) || 0,
    file,
    ...(speechIntervals ? { speechIntervals } : {}),
    ...(typeof chunk.speechIntervalsReliable === "boolean"
      ? { speechIntervalsReliable: chunk.speechIntervalsReliable }
      : {}),
    asrCompleted: Boolean(chunk.asrCompleted),
    asrFailed: Boolean(chunk.asrFailed),
    asrError: String(chunk.asrError || ""),
    asrErrorStatus: Math.max(0, Number(chunk.asrErrorStatus || 0) || 0),
    asrErrorCode: String(chunk.asrErrorCode || ""),
    asrDeliveryAmbiguous: Boolean(chunk.asrDeliveryAmbiguous),
    asrStage: String(chunk.asrStage || ""),
    asrExecutionMode: chunk.asrExecutionMode === "offscreen-durable-v1"
      ? "offscreen-durable-v1"
      : "",
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
    rememberBrowserExpectedAudioChunk(record, groupIndex, chunk.index);
    if (chunk.asrCompleted !== true && record.job.translation.chunkStatuses[groupIndex]) {
      record.job.translation.chunkStatuses[groupIndex].asrRequired = true;
    }
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
        closed: false,
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
      }
      if (chunk.sourceSegments?.length) {
        group.sourceSegments.push(...chunk.sourceSegments);
      } else if (!chunk.asrFailed) {
        group.empty += 1;
      }
    }
  }
  const extractionTerminal = ["completed", "failed"].includes(String(record.job.extract?.status || ""));
  const recoveredGroupIndexes = [...record.browserTranslationGroups.keys()];
  for (const [groupIndex, group] of record.browserTranslationGroups) {
    if (record.sourceSegmentsByChunk.has(groupIndex)) {
      group.sourceSegments = record.sourceSegmentsByChunk.get(groupIndex);
    }
    const stage = String(record.job.translation?.chunkStatuses?.[groupIndex]?.stage || "");
    const stageProvesGroupFinalized = [
      "asr_done",
      "translation",
      "completed",
      "completed_with_warnings",
      "failed"
    ].includes(stage);
    const hasLaterGroup = recoveredGroupIndexes.some(index => index > groupIndex);
    const reachedTargetEnd = group.chunks.some(chunk => (
      browserAudioChunkCoreEnd(chunk) + 0.001 >= Number(group.targetEnd || 0)
    ));
    group.closed = extractionTerminal || hasLaterGroup || reachedTargetEnd || stageProvesGroupFinalized;
    const translationPersisted = record.translatedSegmentsByChunk.has(groupIndex);
    const durableAsrResume = group.chunks.some(chunk => (
      !chunk.asrCompleted && chunk.asrExecutionMode === "offscreen-durable-v1"
    ));
    if (stage === "asr_inflight" && !translationPersisted && durableAsrResume) {
      group.translationQueued = false;
      continue;
    }
    if (stage === "asr_inflight" && !translationPersisted) {
      group.translationQueued = true;
      markRecoveredBrowserPaidOperationAsAmbiguous(record, stage);
      continue;
    }
    if (stage === "translation" && !translationPersisted &&
        record.job.translation?.chunkStatuses?.[groupIndex]?.translationExecutionMode === "offscreen-durable-v1") {
      // The paid operation ledger and response cache live in offscreen. A replacement
      // Service Worker must expose the same translation work so offscreen can replay
      // the completed response or keep an ambiguous submitted request blocked.
      group.translationQueued = true;
      continue;
    }
    if (stage === "translation" && !translationPersisted) {
      group.translationQueued = true;
      markRecoveredBrowserPaidOperationAsAmbiguous(record, stage);
      continue;
    }
    group.translationQueued = ["completed", "completed_with_warnings", "failed"].includes(stage);
    if (group.translationQueued && group.completed < group.total) {
      group.completed = group.total;
    }
    if (stage === "asr_done" && group.completed >= group.total) {
      maybeFinalizeBrowserTranslationGroup(record, group);
    }
  }
}

function markRecoveredBrowserPaidOperationAsAmbiguous(record, stage) {
  const action = stage === "asr_inflight" ? "识别" : "翻译";
  const message = `浏览器后台在${action}请求期间重启。为避免重复计费，任务已中断；请明确重试失败分段。`;
  record.recoveryBlocked = true;
  record.recoveryError = message;
  record.offscreenExecution = false;
  record.job.status = "interrupted";
  record.job.stage = "interrupted";
  record.job.error = message;
  if (record.job.translation) {
    record.job.translation.status = "interrupted";
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
        funAsrExecutionMode: record.pipeline === "funasr" ? "offscreen-durable-v1" : "",
        asrWorkers: record.pipeline === "funasr"
          ? browserFunAsrConcurrency(record)
          : Math.max(1, Number(record.modelConfig?.asrWorkers || 1) || 1),
        translationWorkers: Math.max(1, Number(record.modelConfig?.workers || 1) || 1)
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
      scheduleBrowserJobLeaseRecovery(record, Date.now() + 1000);
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
  const workType = String(message.workType || "asr") === "translation" ? "translation" : "asr";
  if (workType === "translation") {
    return {
      accepted: false,
      stale: true,
      reason: "translation-requires-offscreen-executor",
      chunkIndex: index,
      workType
    };
  }
  const chunk = (record.audioChunks || []).find(item => Number(item?.index) === index);
  if (!chunk) {
    throw new Error(`Offscreen task audio chunk ${index} is unavailable.`);
  }
  if (chunk.asrCompleted) {
    return { accepted: true, duplicate: true, chunkIndex: index };
  }
  if (record.pipeline === "funasr" || record.job?.pipeline === "funasr") {
    return {
      accepted: false,
      stale: true,
      reason: "funasr-requires-offscreen-executor",
      chunkIndex: index,
      workType
    };
  }
  if (hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index, "asr")) {
    return { accepted: true, duplicate: true, inProgress: true, chunkIndex: index };
  }
  const operationKey = offscreenBrowserChunkOperationKey(
    record.job.id,
    record.runToken,
    fence.executionEpoch,
    index,
    "asr"
  );
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "asr" });
  offscreenBrowserChunkOperations.set(operationKey, operation);
  try {
    record.offscreenExecution = true;
    record.job.status = "running";
    record.job.stage = "asr";
    const operationOptions = {
      operation,
      runToken: operation.runToken,
      signal: operation.controller.signal,
      onAsrStartCheckpoint: () => commitOffscreenBrowserRecord(record, operation)
    };
    await processBrowserAsrChunk(record, chunk, operationOptions);
    const asrCommitted = await commitOffscreenBrowserRecord(record, operation);
    if (!asrCommitted.applied) {
      return offscreenCommitFailureResponse(asrCommitted);
    }
    return { accepted: true, chunkIndex: index, workType: "asr" };
  } catch (error) {
    if (error?.offscreenCheckpointFailure) {
      return offscreenCommitFailureResponse(error.commitResult || {
        applied: false,
        reason: "checkpoint-failed",
        retryable: true,
        error: error.message || String(error)
      });
    }
    throw error;
  } finally {
    if (offscreenBrowserChunkOperations.get(operationKey) === operation) {
      offscreenBrowserChunkOperations.delete(operationKey);
    }
    disposeOffscreenBrowserOperation(record, operation);
  }
}

async function processOffscreenBrowserJobTranslation(record, message, fence, index) {
  const funAsr = record.pipeline === "funasr" || record.job?.pipeline === "funasr";
  if (funAsr && hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index, "asr")) {
    return { accepted: true, duplicate: true, inProgress: true, chunkIndex: index, workType: "translation" };
  }
  const status = record.job.translation?.chunkStatuses?.[index] || {};
  if (["completed", "completed_with_warnings", "failed"].includes(String(status.stage || "")) ||
      record.translatedSegmentsByChunk.has(index)) {
    return { accepted: true, duplicate: true, chunkIndex: index, workType: "translation" };
  }
  const sourceSegments = record.sourceSegmentsByChunk.get(index);
  if (!Array.isArray(sourceSegments) || !sourceSegments.length || String(status.stage || "") !== "asr_done") {
    return { accepted: false, stale: true, reason: "translation-work-unavailable", chunkIndex: index };
  }
  if (hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index, "translation")) {
    return { accepted: true, duplicate: true, inProgress: true, chunkIndex: index, workType: "translation" };
  }
  const operationKey = offscreenBrowserChunkOperationKey(
    record.job.id,
    record.runToken,
    fence.executionEpoch,
    index,
    "translation"
  );
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "translation" });
  offscreenBrowserChunkOperations.set(operationKey, operation);
  const queuedIndex = record.browserTranslationQueue?.items?.findIndex(payload => Number(payload?.chunk?.index) === index) ?? -1;
  if (queuedIndex >= 0) {
    record.browserTranslationQueue.items.splice(queuedIndex, 1);
  }
  try {
    record.offscreenExecution = true;
    record.job.status = "running";
    record.job.stage = "translation";
    const group = record.browserTranslationGroups?.get(index);
    await processBrowserTranslationChunk(record, {
      index,
      start: Number(group?.start || 0) || 0,
      end: Number(group?.end || 0) || 0,
      duration: Math.max(0, Number(group?.end || 0) - Number(group?.start || 0))
    }, sourceSegments, {
      operation,
      runToken: operation.runToken,
      signal: operation.controller.signal,
      onTranslationStartCheckpoint: () => commitOffscreenBrowserRecord(record, operation)
    });
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) {
      return offscreenCommitFailureResponse(committed);
    }
    return { accepted: true, chunkIndex: index, workType: "translation" };
  } catch (error) {
    if (error?.offscreenCheckpointFailure) {
      return offscreenCommitFailureResponse(error.commitResult || {
        applied: false,
        reason: "checkpoint-failed",
        retryable: true,
        error: error.message || String(error)
      });
    }
    throw error;
  } finally {
    if (offscreenBrowserChunkOperations.get(operationKey) === operation) {
      offscreenBrowserChunkOperations.delete(operationKey);
    }
    disposeOffscreenBrowserOperation(record, operation);
  }
}

function offscreenCommitFailureResponse(committed = {}) {
  return {
    accepted: false,
    stale: true,
    retryable: Boolean(committed.retryable),
    reason: committed.reason || "stale-execution",
    error: committed.error || ""
  };
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
  const funAsr = record.pipeline === "funasr" || record.job?.pipeline === "funasr";
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
        Number(chunk?.index || 0),
        "asr"
      )
    })),
    translations: (record.job.translation?.chunkStatuses || []).flatMap((status, index) => {
      const stage = String(status?.stage || "");
      const processing = hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index, "translation");
      if (!['asr_done', 'translation'].includes(stage) && !processing) {
        return [];
      }
      if (funAsr && hasOffscreenBrowserChunkOperation(record.job.id, record.runToken, index, "asr")) {
        return [];
      }
      return [{ index, processing }];
    })
  };
}

async function getOffscreenBrowserJobExecutionInput(message = {}) {
  await browserJobRecoveryPromise;
  const fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  if (String(message.workType || "") === "asr") {
    return getOffscreenBrowserAsrExecutionInput(message, fence);
  }
  if (String(message.workType || "") !== "translation") {
    return { accepted: false, stale: true, reason: "unsupported-work-type" };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  if (record.recoveryBlocked) {
    return { accepted: false, interrupted: true, terminal: true, error: record.recoveryError || record.job?.error || "任务配置无法恢复。" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const status = record.job.translation?.chunkStatuses?.[index] || {};
  const stage = String(status.stage || "");
  if (["completed", "completed_with_warnings", "failed"].includes(stage)) {
    return { accepted: true, duplicate: true, chunkIndex: index };
  }
  if (!["asr_done", "translation"].includes(stage)) {
    return { accepted: false, stale: true, reason: "translation-work-unavailable", chunkIndex: index };
  }
  if (stage === "translation" && status.translationExecutionMode !== "offscreen-durable-v1") {
    return {
      accepted: false,
      interrupted: true,
      terminal: true,
      reason: "legacy-translation-operation-ambiguous",
      error: "旧版翻译请求缺少 durable operation 标记，为避免重复计费，必须由用户明确重试。"
    };
  }
  const sourceSegments = reusableBrowserSourceSegments(record, index);
  if (!sourceSegments.length) {
    return { accepted: false, stale: true, reason: "translation-source-unavailable", chunkIndex: index };
  }
  const translationConfig = record.modelConfig?.translation;
  if (!translationConfig?.baseUrl || !translationConfig?.model || !translationConfig?.apiKey) {
    return { accepted: false, interrupted: true, terminal: true, error: "翻译配置无法恢复，请重新选择翻译配置后重试。" };
  }
  if (stage === "asr_done") {
    const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "translation-input" });
    try {
    const queuedIndex = record.browserTranslationQueue?.items?.findIndex(payload => Number(payload?.chunk?.index) === index) ?? -1;
    if (queuedIndex >= 0) {
      record.browserTranslationQueue.items.splice(queuedIndex, 1);
    }
    const attempt = Math.max(1, Number(status.attempts || 0) + 1);
    record.offscreenExecution = true;
    record.job.status = "running";
    record.job.stage = "translation";
    updateChunkStatus(record, index, {
      stage: "translation",
      status: "翻译",
      attempts: attempt,
      sourceCount: sourceSegments.length,
      targetLanguage: record.modelConfig.targetLanguage,
      translationExecutionMode: "offscreen-durable-v1",
      error: "",
      message: `第 ${attempt} 次尝试 · offscreen 翻译`
    });
      const checkpoint = await commitOffscreenBrowserRecord(record, operation);
      if (!checkpoint.applied) {
        return offscreenCommitFailureResponse(checkpoint);
      }
    } finally {
      disposeOffscreenBrowserOperation(record, operation);
    }
  }
  return {
    accepted: true,
    input: {
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: fence.executionOwnerId,
      executionEpoch: fence.executionEpoch,
      chunkIndex: index,
      semanticRequestPath: browserTranslationSemanticRequestBase(record.job.id, record.runToken, index),
      sourceSegments: cloneBrowserSegments(sourceSegments),
      targetLanguage: record.modelConfig.targetLanguage,
      metadata: browserTranslationExecutionMetadata(record.metadata),
      batchWorkers: browserTranslationBatchWorkers(record),
      splitWorkers: browserTranslationSplitWorkers(record),
      maxConcurrency: browserTranslationProviderConcurrency(record),
      translationConfig: browserTranslationExecutionConfig(translationConfig)
    }
  };
}

async function reportOffscreenBrowserJobWorkProgress(message = {}) {
  await browserJobRecoveryPromise;
  const fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  if (String(message.workType || "") !== "translation") {
    return { accepted: false, stale: true, reason: "unsupported-work-type" };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const status = record.job.translation?.chunkStatuses?.[index] || {};
  if (String(status.stage || "") !== "translation") {
    return { accepted: true, duplicate: true, chunkIndex: index };
  }
  const progress = message.progress && typeof message.progress === "object" ? message.progress : {};
  const batchIndex = Math.max(0, Number(progress.batchIndex || 0) || 0);
  const batchTotal = Math.max(0, Number(progress.batchTotal || 0) || 0);
  const phase = ["started", "batch", "completed"].includes(String(progress.phase || ""))
    ? String(progress.phase)
    : "batch";
  const progressMessage = batchIndex && batchTotal
    ? `offscreen 翻译第 ${Math.min(batchIndex, batchTotal)}/${batchTotal} 批`
    : (phase === "completed" ? "offscreen 翻译完成，正在保存" : "offscreen 翻译中");
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "translation-progress" });
  try {
    updateChunkStatus(record, index, {
      stage: "translation",
      status: "翻译",
      message: progressMessage
    });
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) {
      return offscreenCommitFailureResponse(committed);
    }
  } finally {
    disposeOffscreenBrowserOperation(record, operation);
  }
  return { accepted: true, chunkIndex: index };
}

async function commitOffscreenBrowserJobWorkResult(message = {}) {
  await browserJobRecoveryPromise;
  const fence = await validateOffscreenExecutionFence(message);
  if (!fence.valid) {
    return { accepted: false, stale: true, reason: fence.reason };
  }
  if (String(message.workType || "") === "asr") {
    return commitOffscreenBrowserAsrWorkResult(message, fence);
  }
  if (String(message.workType || "") !== "translation") {
    return { accepted: false, stale: true, reason: "unsupported-work-type" };
  }
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  if (isBrowserJobCancelled(record)) {
    return { accepted: false, cancelled: true };
  }
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const status = record.job.translation?.chunkStatuses?.[index] || {};
  if (["completed", "completed_with_warnings", "failed"].includes(String(status.stage || ""))) {
    return { accepted: true, duplicate: true, chunkIndex: index };
  }
  if (String(status.stage || "") !== "translation") {
    return { accepted: false, stale: true, reason: "translation-commit-unavailable", chunkIndex: index };
  }
  const sourceSegments = reusableBrowserSourceSegments(record, index);
  const result = message.result && typeof message.result === "object" ? message.result : {};
  const failures = Array.isArray(result.failures) ? result.failures.map(failure => ({
    source: failure?.source ? { ...failure.source } : null,
    error: String(failure?.error || "翻译失败")
  })).filter(failure => failure.source) : [];
  const resultError = result.error && typeof result.error === "object"
    ? String(result.error.message || result.error.code || "翻译失败。")
    : String(result.error || "");
  const resultErrorStatus = result.error && typeof result.error === "object"
    ? Math.max(0, Number(result.error.status || 0) || 0)
    : 0;
  const resultErrorCode = result.error && typeof result.error === "object"
    ? String(result.error.code || "")
    : "";
  const resultDeliveryAmbiguous = Boolean(result.error && typeof result.error === "object" && result.error.deliveryAmbiguous);
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "translation-commit" });
  try {
    const previous = cloneBrowserSegments(record.translatedSegmentsByChunk?.get(index));
    if (resultError) {
      updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      sourceCount: sourceSegments.length,
      translatedCount: previous.length,
      translationFailures: failures.length,
      translationErrorStatus: resultErrorStatus,
      translationErrorCode: resultErrorCode,
      translationDeliveryAmbiguous: resultDeliveryAmbiguous,
      error: previous.length
        ? `重翻译失败，已保留已有译文：${resultError}`
        : `重翻译失败，未生成译文，已保留原文供重试：${resultError}`,
      message: "offscreen 翻译失败"
      });
    } else {
      const translatedSegments = cloneBrowserSegments(result.segments);
      record.translatedSegmentsByChunk.set(index, translatedSegments);
      const asrFailures = chunkStatusAsrFailureCount(status);
      const warningMessage = browserCompletedChunkWarningMessage(failures, asrFailures);
      updateChunkStatus(record, index, {
      stage: warningMessage ? "completed_with_warnings" : "completed",
      status: warningMessage ? "部分完成" : "完成",
      sourceCount: sourceSegments.length,
      translatedCount: translatedSegments.length,
      targetLanguage: record.modelConfig.targetLanguage,
      translationFailures: failures.length,
      translationErrorStatus: 0,
      translationErrorCode: "",
      translationDeliveryAmbiguous: false,
      asrFailures,
      asrErrors: Array.isArray(status.asrErrors) ? status.asrErrors : [],
      error: warningMessage,
      message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
      });
    }
    refreshBrowserSubtitleProjection(record);
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) {
      return offscreenCommitFailureResponse(committed);
    }
  } finally {
    disposeOffscreenBrowserOperation(record, operation);
  }
  return { accepted: true, chunkIndex: index, workType: "translation" };
}

function browserTranslationSemanticRequestBase(jobId, runToken, index) {
  return ["translation", jobId, runToken, "chunk", Math.max(0, Number(index) || 0)]
    .map(part => encodeURIComponent(String(part || "")))
    .join("/");
}

function browserTranslationExecutionMetadata(metadata = {}) {
  return {
    title: String(metadata.title || ""),
    pageUrl: String(metadata.pageUrl || ""),
    sourceUrl: String(metadata.sourceUrl || ""),
    duration: Number(metadata.duration || 0) || 0
  };
}

function browserTranslationExecutionConfig(config = {}) {
  return {
    providerType: String(config.providerType || ""),
    baseUrl: String(config.baseUrl || ""),
    model: String(config.model || ""),
    apiKey: String(config.apiKey || "")
  };
}

function browserAsrSemanticRequestBase(jobId, runToken, index) {
  return ["asr", jobId, runToken, "chunk", Math.max(0, Number(index) || 0)]
    .map(part => encodeURIComponent(String(part || "")))
    .join("/");
}

function browserAsrExecutionConfig(config = {}) {
  const result = {};
  for (const key of [
    "providerType", "baseUrl", "model", "apiKey", "language", "sourceLanguage",
    "timeoutMs", "vadFilter", "vad_filter", "vadFilterMode", "collectedSpeechAudio",
    "collectSpeechAudio", "maxUploadBytes", "maxFileBytes", "maxUploadMb", "maxFileSizeMb"
  ]) {
    if (config[key] !== undefined) result[key] = config[key];
  }
  return result;
}

function browserFunAsrExecutionConfig(config = {}) {
  const result = {};
  for (const key of [
    "providerType", "baseUrl", "model", "apiKey", "language", "sourceLanguage",
    "timeoutMs", "speakerCount", "speaker_count", "specialWordFilter", "special_word_filter"
  ]) {
    if (config[key] !== undefined) result[key] = config[key];
  }
  return result;
}

async function getOffscreenBrowserAsrExecutionInput(message, fence) {
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  const funAsr = record.pipeline === "funasr" || record.job?.pipeline === "funasr";
  if (record.recoveryBlocked || isBrowserJobCancelled(record)) {
    return record.recoveryBlocked
      ? { accepted: false, interrupted: true, terminal: true, error: record.recoveryError || "任务配置无法恢复。" }
      : { accepted: false, cancelled: true };
  }
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const chunk = (record.audioChunks || []).find(item => Number(item?.index) === index);
  if (!chunk) return { accepted: false, stale: true, reason: "asr-audio-unavailable", chunkIndex: index };
  if (chunk.asrCompleted) return { accepted: true, duplicate: true, chunkIndex: index };
  const config = record.modelConfig?.asr || {};
  if (!config.baseUrl || !config.apiKey || (funAsr ? !config.model : (browserAsrProviderNeedsModel(config) && !config.model))) {
    return { accepted: false, interrupted: true, terminal: true, error: "识别配置无法恢复，请重新选择识别配置后重试。" };
  }
  if (chunk.asrExecutionMode && chunk.asrExecutionMode !== "offscreen-durable-v1") {
    return { accepted: false, interrupted: true, terminal: true, reason: "legacy-asr-operation-ambiguous" };
  }
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "asr-input" });
  try {
    chunk.asrExecutionMode = "offscreen-durable-v1";
    record.offscreenExecution = true;
    record.job.status = "running";
    record.job.stage = "asr";
    const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
    updateChunkStatus(record, group.index, {
      stage: "asr_inflight", status: "识别", error: "",
      attempts: Math.max(1, Number(record.job.translation?.chunkStatuses?.[group.index]?.attempts || 0) + 1),
      message: `offscreen 识别 ${browserAsrChunkTimeRangeText(chunk)}`
    });
    const checkpoint = await commitOffscreenBrowserRecord(record, operation);
    if (!checkpoint.applied) return offscreenCommitFailureResponse(checkpoint);
  } finally {
    disposeOffscreenBrowserOperation(record, operation);
  }
  const { url: webFfmpegUrl } = await getWebFfmpegConfig();
  return { accepted: true, input: {
    jobId: record.job.id, runToken: record.runToken,
    executionOwnerId: fence.executionOwnerId, executionEpoch: fence.executionEpoch,
    chunkIndex: index,
    semanticRequestPath: funAsr
      ? `funasr/${[record.job.id, record.runToken, "chunk", index]
        .map(part => encodeURIComponent(String(part ?? ""))).join("/")}`
      : browserAsrSemanticRequestBase(record.job.id, record.runToken, index),
    chunk: JSON.parse(JSON.stringify(chunk)),
    ...(funAsr
      ? {
        funAsrConfig: browserFunAsrExecutionConfig(config),
        chunksTotal: browserFunAsrExpectedChunkCount(record),
        duration: pickFinite(record.job.extract?.duration, record.metadata?.duration),
        labelSpeakers: browserFunAsrShouldLabelSpeakers(record),
        deadlineAt: Date.now() + Math.max(60_000, Number(config.timeoutMs || 2 * 60 * 60 * 1000) || 2 * 60 * 60 * 1000)
      }
      : { asrConfig: browserAsrExecutionConfig(config) }),
    webFfmpegUrl
  }};
}

async function commitOffscreenBrowserAsrWorkResult(message, fence) {
  const record = browserPreloadJobs.get(String(message.jobId || ""));
  if (!record || String(record.runToken || "") !== String(message.runToken || "")) {
    return { accepted: false, stale: true, reason: "stale-run" };
  }
  if (isBrowserJobCancelled(record)) return { accepted: false, cancelled: true };
  const index = Math.max(0, Number(message.chunkIndex) || 0);
  const chunk = (record.audioChunks || []).find(item => Number(item?.index) === index);
  if (!chunk) return { accepted: false, stale: true, reason: "asr-commit-unavailable" };
  if (chunk.asrCompleted) return { accepted: true, duplicate: true, chunkIndex: index };
  if (chunk.asrExecutionMode !== "offscreen-durable-v1") {
    return { accepted: false, stale: true, reason: "asr-commit-unavailable" };
  }
  const result = message.result && typeof message.result === "object" ? message.result : {};
  const sourceSegments = Array.isArray(result.segments) ? result.segments : [];
  const errorText = result.error && typeof result.error === "object"
    ? String(result.error.message || result.error.code || "识别失败。")
    : String(result.error || "");
  const warningText = result.warning && typeof result.warning === "object"
    ? String(result.warning.message || result.warning.code || "")
    : String(result.warning || "");
  const error = errorText ? new Error(errorText) : (warningText ? new Error(warningText) : null);
  const resumeRemoteTask = Boolean(
    (record.pipeline === "funasr" || record.job?.pipeline === "funasr") &&
    result.resumeRemoteTask &&
    String(result.remoteTaskId || "")
  );
  const operation = createOffscreenBrowserOperation(record, fence, { chunkIndex: index, workType: "asr-commit" });
  try {
    if (result.diagnostics) recordBrowserAsrChunkDiagnostics(record, chunk, result.diagnostics);
    chunk.asrErrorStatus = Math.max(0, Number(result.error?.status || 0) || 0);
    chunk.asrErrorCode = String(result.error?.code || "");
    chunk.asrDeliveryAmbiguous = Boolean(result.error?.deliveryAmbiguous);
    chunk.asrStage = String(result.error?.asrStage || "");
    if (resumeRemoteTask) {
      chunk.asrCompleted = false;
      chunk.asrError = errorText;
      const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
      updateChunkStatus(record, group.index, {
        stage: "asr_inflight",
        status: "识别中断",
        error: `Fun-ASR 远端任务已提交，重试将继续当前任务：${errorText}`,
        message: "等待继续轮询远端任务"
      });
      record.job.status = "interrupted";
      record.job.stage = "interrupted";
      record.job.error = `Fun-ASR 远端任务已提交，重试将继续当前任务：${errorText}`;
      record.job.updatedAt = Date.now();
      refreshBrowserSubtitleProjection(record);
      const committed = await commitOffscreenBrowserRecord(record, operation);
      if (!committed.applied) return offscreenCommitFailureResponse(committed);
      return {
        accepted: false,
        interrupted: true,
        terminal: true,
        resumableRemoteTask: true,
        chunkIndex: index,
        workType: "asr"
      };
    }
    markBrowserAudioChunkAsrResult(chunk, sourceSegments, error);
    completeBrowserAsrChunkForGroup(record, chunk, sourceSegments, error);
    refreshBrowserSubtitleProjection(record);
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) return offscreenCommitFailureResponse(committed);
  } finally {
    disposeOffscreenBrowserOperation(record, operation);
  }
  return { accepted: true, chunkIndex: index, workType: "asr" };
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

function offscreenBrowserChunkOperationKey(jobId, runToken, executionEpoch, chunkIndex, workType = "asr") {
  return `${String(jobId || "")}:${String(runToken || "")}:${Math.max(0, Number(executionEpoch) || 0)}:${String(workType || "asr")}:${Math.max(0, Number(chunkIndex) || 0)}`;
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
    workType: String(details.workType || "asr"),
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

function hasOffscreenBrowserChunkOperation(jobId, runToken, chunkIndex = null, workType = null) {
  for (const operation of offscreenBrowserChunkOperations.values()) {
    if (String(operation?.jobId || "") !== String(jobId || "") ||
        String(operation?.runToken || "") !== String(runToken || "")) {
      continue;
    }
    if (chunkIndex == null || Number(operation.chunkIndex) === Number(chunkIndex)) {
      if (workType == null || String(operation.workType || "asr") === String(workType)) {
        return true;
      }
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
  if (snapshot.chunks.some(chunk => chunk?.entryType === "translation-group" && chunk?.stage === "asr_done")) {
    await wakeOffscreenBrowserJob(record, "work-queued");
  }
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
  const missingRequiredAudio = browserMissingRequiredRecognitionAudioTargets(record);
  if (missingRequiredAudio.length) {
    const label = missingRequiredAudio.map(index => index + 1).join("、");
    const error = `要继续识别的音频分段不完整（${label}），任务已中断；请重新抽取。`;
    record.offscreenExecution = false;
    record.job.status = "interrupted";
    record.job.stage = "interrupted";
    record.job.error = error;
    record.job.translation.status = "interrupted";
    const committed = await commitOffscreenBrowserRecord(record, operation);
    if (!committed.applied) {
      return offscreenCommitFailureResponse(committed);
    }
    return { accepted: false, interrupted: true, terminal: true, error, job: record.job };
  }
  if ((record.audioChunks || []).some(chunk => !chunk.asrCompleted)) {
    return { accepted: true, inProgress: true };
  }
  const funAsr = record.pipeline === "funasr" || record.job?.pipeline === "funasr";
  if (!funAsr) {
    closeAllBrowserTranslationGroups(record);
  }
  const hasPendingTranslation = Boolean(record.browserTranslationQueue?.items?.length) ||
    (record.job.translation?.chunkStatuses || []).some(status => String(status?.stage || "") === "asr_done");
  if (hasPendingTranslation) {
    const prepared = await commitOffscreenBrowserRecord(record, operation);
    if (!prepared.applied) {
      return offscreenCommitFailureResponse(prepared);
    }
    return { accepted: true, inProgress: true, workPrepared: true };
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

function browserMissingRequiredRecognitionAudioTargets(record) {
  const funAsr = record?.pipeline === "funasr" || record?.job?.pipeline === "funasr";
  const missing = [];
  for (const [fallbackIndex, status] of (record?.job?.translation?.chunkStatuses || []).entries()) {
    if (status?.asrRequired !== true) continue;
    const index = Number(status?.index ?? fallbackIndex);
    if (!Number.isFinite(index)) continue;
    const expected = browserExpectedAudioChunkIndexes(record, index, funAsr);
    const current = new Set(browserAsrRerunAudioChunksForTarget(record, index, funAsr)
      .map(chunk => Number(chunk?.index)));
    if (!expected.length || expected.some(audioIndex => !current.has(audioIndex))) {
      missing.push(index);
    }
  }
  return [...new Set(missing)].sort((left, right) => left - right);
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

async function wakeOffscreenBrowserJob(record, reason = "work-available") {
  if (!record?.offscreenExecution || !record?.job?.id || !record.runToken ||
      typeof chrome.runtime?.connect !== "function") {
    return { accepted: false, reason: "inactive-run" };
  }
  return sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.WAKE_JOB, {
    jobId: record.job.id,
    runToken: record.runToken,
    reason: String(reason || "work-available")
  }, 2000).catch(() => ({ accepted: false, reason: "wake-delivery-failed" }));
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
    return createLiveBrowserJobReadView(record);
  }
  return cloneBrowserJobState(record.job);
}

function createLiveBrowserJobReadView(record) {
  const committed = cloneBrowserJobState(record.lastCommittedJob || record.job);
  const live = record.job || {};
  const liveTranslation = live.translation || {};
  const durableTranslation = committed.translation || {};
  const liveTranslationFields = [
    "status",
    "stage",
    "chunksDone",
    "done",
    "chunksFailed",
    "failed",
    "chunksAsrPartialFailed",
    "chunksAsr",
    "asrRunning",
    "chunksTranslating",
    "translationRunning",
    "chunkStatuses"
  ];
  committed.status = live.status;
  committed.stage = live.stage;
  committed.error = live.error;
  committed.updatedAt = live.updatedAt;
  committed.progress = cloneBrowserJobState(live.progress);
  committed.extract = {
    ...(committed.extract || {}),
    status: live.extract?.status,
    stage: live.extract?.stage,
    progress: live.extract?.progress,
    elapsedSeconds: live.extract?.elapsedSeconds
  };
  committed.translation = { ...durableTranslation };
  for (const field of liveTranslationFields) {
    if (Object.prototype.hasOwnProperty.call(liveTranslation, field)) {
      committed.translation[field] = cloneBrowserJobState(liveTranslation[field]);
    }
  }
  return committed;
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

function browserTranslationSegmentSeconds(record) {
  const seconds = Number(record?.modelConfig?.chunkSeconds || DEFAULT_MODEL_SETTINGS.chunkMinutes * 60);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_MODEL_SETTINGS.chunkMinutes * 60;
}

function browserTranslationBatchWorkers(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(2, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
}

function browserTranslationProviderConcurrency(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(8, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
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
  const rerunTarget = captureBrowserAsrRerunAudioTarget(record, chunkIndexes);
  await verifyBrowserRecordAudioCache(record, { persist: true });
  if (record?.job?.audioCacheRemoved) {
    throw new Error("当前任务的音频缓存已清除，不能重新 ASR。请重新抽取。");
  }
  if (!Array.isArray(record?.audioChunks) || !record.audioChunks.length) {
    throw new Error("没有可复用的音频缓存，不能重新 ASR。请重新抽取。");
  }
  const missingIndexes = missingBrowserAsrRerunAudioTargets(record, rerunTarget);
  if (missingIndexes.length) {
    const label = missingIndexes.map(index => index + 1).join("、");
    throw new Error(rerunTarget.funAsr
      ? `Fun-ASR 任务没有完整保留要重新识别的音频分段（${label}），请重新抽取。`
      : `浏览器内任务没有完整保留要重新识别的音频分组（${label}），请重新抽取。`);
  }
  const indexes = rerunTarget.indexes;
  if (!indexes.length) {
    throw new Error("没有匹配到可重新 ASR 的音频分段。");
  }
  await beginBrowserJobAttempt(record, "retrying", { asrIndexes: indexes });
  record.job.subtitleCleared = false;
  publishBrowserSubtitle(record);
  publishBrowserPreloadJob(record);
  return startQueuedBrowserWorkInOffscreen(record);
}

function captureBrowserAsrRerunAudioTarget(record, chunkIndexes = []) {
  synchronizeBrowserExpectedAudioChunks(record);
  const funAsr = record?.pipeline === "funasr" || record?.job?.pipeline === "funasr";
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number).filter(Number.isFinite) : []);
  const indexes = (requested.size ? [...requested] : collectBrowserAsrRerunIndexes(record))
    .sort((left, right) => left - right);
  const expectedAudioChunkIndexesByIndex = new Map(indexes.map(index => [
    index,
    browserExpectedAudioChunkIndexes(record, index, funAsr)
  ]));
  return { funAsr, indexes, expectedAudioChunkIndexesByIndex };
}

function synchronizeBrowserExpectedAudioChunks(record) {
  const funAsr = record?.pipeline === "funasr" || record?.job?.pipeline === "funasr";
  for (const chunk of record?.audioChunks || []) {
    const groupIndex = funAsr
      ? Number(chunk?.index)
      : browserRecognitionGroupIndex(record, chunk);
    rememberBrowserExpectedAudioChunk(record, groupIndex, Number(chunk?.index));
  }
}

function missingBrowserAsrRerunAudioTargets(record, target) {
  const missing = [];
  for (const index of target?.indexes || []) {
    const expected = target.expectedAudioChunkIndexesByIndex?.get(index) || [];
    const current = new Set(browserAsrRerunAudioChunksForTarget(record, index, target.funAsr)
      .map(chunk => Number(chunk?.index)));
    if (!expected.length || expected.some(audioIndex => !current.has(audioIndex))) {
      missing.push(index);
    }
  }
  return missing;
}

function browserAsrRerunAudioChunksForTarget(record, index, funAsr) {
  const target = Number(index);
  return (record?.audioChunks || []).filter(chunk => (
    funAsr
      ? Number(chunk?.index) === target
      : browserRecognitionGroupIndex(record, chunk) === target
  ));
}

function browserExpectedAudioChunkIndexes(record, groupIndex, funAsr) {
  const expected = new Set();
  const status = record?.job?.translation?.chunkStatuses?.[Number(groupIndex)] || {};
  for (const index of Array.isArray(status.expectedAudioChunkIndexes) ? status.expectedAudioChunkIndexes : []) {
    const normalized = Number(index);
    if (Number.isFinite(normalized)) expected.add(normalized);
  }
  if (!funAsr) {
    const group = record?.browserTranslationGroups?.get?.(Number(groupIndex));
    for (const index of group?.chunkIndexes || []) {
      const normalized = Number(index);
      if (Number.isFinite(normalized)) expected.add(normalized);
    }
  }
  for (const chunk of browserAsrRerunAudioChunksForTarget(record, groupIndex, funAsr)) {
    const normalized = Number(chunk?.index);
    if (Number.isFinite(normalized)) expected.add(normalized);
  }
  return [...expected].sort((left, right) => left - right);
}

function collectBrowserAsrRerunIndexes(record, chunkIndexes = []) {
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number).filter(Number.isFinite) : []);
  const isFunAsr = record?.pipeline === "funasr" || record?.job?.pipeline === "funasr";
  const audioIndexes = (record?.audioChunks || [])
    .map(chunk => isFunAsr ? Number(chunk.index) : browserRecognitionGroupIndex(record, chunk))
    .filter(Number.isFinite);
  const durableIndexes = (record?.job?.translation?.chunkStatuses || [])
    .flatMap((status, index) => (
      Array.isArray(status?.expectedAudioChunkIndexes) && status.expectedAudioChunkIndexes.length
        ? [Number(status?.index ?? index)]
        : []
    ))
    .filter(Number.isFinite);
  const sourceIndexes = [...(record?.sourceSegmentsByChunk?.keys?.() || [])].map(Number).filter(Number.isFinite);
  const indexes = [...audioIndexes, ...durableIndexes, ...sourceIndexes]
    .filter(index => !requested.size || requested.has(index));
  return [...new Set(indexes)].sort((left, right) => left - right);
}

function prepareBrowserRecognitionAttemptSnapshot(record, indexes) {
  const targetIndexes = new Set(indexes.map(Number));
  const previousTranslation = cloneBrowserJobState(record.job.translation);
  const chunkSnapshots = (record.audioChunks || [])
    .filter(chunk => targetIndexes.has(
      record.pipeline === "funasr" || record.job?.pipeline === "funasr"
        ? Number(chunk.index)
        : browserRecognitionGroupIndex(record, chunk)
    ))
    .map(chunk => ({ chunk, snapshot: { ...chunk } }));
  const groupSnapshots = [...(record.browserTranslationGroups?.entries?.() || [])]
    .filter(([index]) => targetIndexes.has(Number(index)))
    .map(([, group]) => ({
      group,
      completed: group.completed,
      failed: group.failed,
      empty: group.empty,
      sourceSegments: group.sourceSegments,
      errors: group.errors,
      translationQueued: group.translationQueued
    }));
  resetBrowserRecognitionResults(record, indexes, { publish: false });
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    record.job.translation = previousTranslation;
    for (const { chunk, snapshot } of chunkSnapshots) {
      for (const key of Object.keys(chunk)) delete chunk[key];
      Object.assign(chunk, snapshot);
    }
    for (const snapshot of groupSnapshots) {
      Object.assign(snapshot.group, {
        completed: snapshot.completed,
        failed: snapshot.failed,
        empty: snapshot.empty,
        sourceSegments: snapshot.sourceSegments,
        errors: snapshot.errors,
        translationQueued: snapshot.translationQueued
      });
    }
  };
}

function resetBrowserRecognitionResults(record, indexes, options = {}) {
  const targetIndexes = new Set(indexes.map(Number));
  for (const chunk of record.audioChunks || []) {
    const groupIndex = record.pipeline === "funasr" || record.job?.pipeline === "funasr"
      ? Number(chunk.index)
      : browserRecognitionGroupIndex(record, chunk);
    if (!targetIndexes.has(groupIndex)) continue;
    chunk.asrCompleted = false;
    chunk.asrFailed = false;
    chunk.asrError = "";
    chunk.asrErrorStatus = 0;
    chunk.asrErrorCode = "";
    chunk.asrDeliveryAmbiguous = false;
    chunk.asrStage = "";
    chunk.asrExecutionMode = "";
    chunk.sourceSegments = [];
  }
  for (const index of indexes) {
    const group = record.browserTranslationGroups?.get?.(Number(index));
    if (group) {
      group.completed = 0; group.failed = 0; group.empty = 0;
      group.sourceSegments = []; group.errors = []; group.translationQueued = false;
    }
    updateChunkStatus(record, index, {
      stage: "queued",
      status: "排队",
      attempts: 0,
      asrRequired: true,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      translationFailures: 0,
      error: "",
      message: "等待重新 ASR"
    }, options);
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
  const previousTranslatedSegments = normalizeBrowserSourceSegmentsForTranslation(
    Array.isArray(transcript?.translated) ? transcript.translated : [],
    0
  );
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
    translatedSegmentsByChunk: previousTranslatedSegments.length
      ? new Map([[0, previousTranslatedSegments]])
      : new Map(),
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
  const replacingUnavailableConfig = Boolean(record.recoveryBlocked || record.presentationOnly);
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
  const retryTarget = captureBrowserAsrRerunAudioTarget(record, retryIndexes);
  await verifyBrowserRecordAudioCache(record, { persist: true });
  const sourceRetryIndexes = retryIndexes.filter(index => {
    const status = statuses[index] || {};
    return browserRetrySourceHasCompletedRecognition(record, index, status);
  });
  const asrRetryIndexes = retryIndexes.filter(index => !sourceRetryIndexes.includes(index));
  const missingIndexes = missingBrowserAsrRerunAudioTargets(record, {
    ...retryTarget,
    indexes: asrRetryIndexes
  });
  if (missingIndexes.length) {
    throw new Error("浏览器内任务没有保留可继续识别的音频分段，请重新开始任务。");
  }
  await beginBrowserJobAttempt(record, "retrying", { asrIndexes: asrRetryIndexes });
  if (sourceRetryIndexes.length) {
    queueBrowserTranslationIndexesForOffscreen(record, sourceRetryIndexes);
  }
  publishBrowserPreloadJob(record);
  return startQueuedBrowserWorkInOffscreen(record);
}

async function retryBrowserFunAsrFailedPreload(record, chunkIndexes = []) {
  const initialPlan = browserFunAsrRetryPlan(record, chunkIndexes);
  if (!initialPlan.translationIndexes.length && !initialPlan.asrIndexes.length) {
    throw new Error("当前 Fun-ASR 任务没有可继续处理的识别分段。");
  }
  // A default retry plan may list only explicitly failed chunks and omit a
  // different chunk whose already-submitted remote task is still pending. Scan
  // the whole run before ever rotating runToken, otherwise that remote task
  // would become unreachable and the next attempt could submit it again.
  const hasResumableRemoteTask = (record.audioChunks || []).some(chunk => (
    !chunk.asrCompleted &&
    chunk.asrExecutionMode === "offscreen-durable-v1" &&
    chunk.asrStage === "funasr_remote_pending"
  ));
  if (hasResumableRemoteTask) {
    record.job.status = "queued";
    record.job.stage = "asr";
    record.job.error = "";
    publishBrowserPreloadJob(record);
    return startQueuedBrowserWorkInOffscreen(record, { resumeExisting: true });
  }
  const retryTarget = captureBrowserAsrRerunAudioTarget(record, [
    ...initialPlan.translationIndexes,
    ...initialPlan.asrIndexes
  ]);
  await verifyBrowserRecordAudioCache(record, { persist: true });
  const { translationIndexes, asrIndexes } = browserFunAsrRetryPlan(record, chunkIndexes);
  const missingIndexes = missingBrowserAsrRerunAudioTargets(record, {
    ...retryTarget,
    indexes: asrIndexes
  });
  if (missingIndexes.length) {
    throw new Error(`Fun-ASR 任务没有保留可继续识别的音频分段（${missingIndexes.map(index => index + 1).join("、")}），请重新开始任务。`);
  }
  await beginBrowserJobAttempt(record, asrIndexes.length ? "retrying" : "retry_translation", { asrIndexes });
  if (translationIndexes.length) {
    queueBrowserTranslationIndexesForOffscreen(record, translationIndexes);
  }
  publishBrowserPreloadJob(record);
  return startQueuedBrowserWorkInOffscreen(record);
}

function browserFunAsrRetryPlan(record, chunkIndexes = []) {
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number).filter(Number.isFinite) : []);
  const statuses = record.job.translation?.chunkStatuses || [];
  const requestedMatches = index => !requested.size || requested.has(Number(index));
  const indexes = browserRetryCandidateIndexes(record, requested);
  const uniqueIndexes = [...new Set(indexes)].sort((left, right) => left - right);
  const translationIndexes = [];
  const asrIndexes = [];
  for (const index of uniqueIndexes) {
    const status = statuses[index] || {};
    const chunk = (record.audioChunks || []).find(item => Number(item?.index) === Number(index));
    if (browserRetrySourceHasCompletedRecognition(record, index, status, chunk)) {
      translationIndexes.push(index);
    } else {
      asrIndexes.push(index);
    }
  }
  return { translationIndexes, asrIndexes };
}

function collectBrowserRetryIndexes(record, requested) {
  return browserRetryCandidateIndexes(record, requested instanceof Set ? requested : new Set());
}

function browserRetryCandidateIndexes(record, requestedIndexes = new Set()) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requestedMatches = index => !requestedIndexes.size || requestedIndexes.has(Number(index));
  const statusIndexes = statuses.flatMap((status, fallbackIndex) => {
    if (!status) return [];
    const index = Number(status.index ?? fallbackIndex);
    if (!Number.isFinite(index) || !requestedMatches(index)) return [];
    const translated = record.translatedSegmentsByChunk?.get?.(index);
    const translationComplete = status.stage === "completed" &&
      Array.isArray(translated) && browserTranslationFailures(translated).length === 0;
    return translationComplete ? [] : [index];
  });
  const sourceIndexes = [...(record.sourceSegmentsByChunk?.keys?.() || [])]
    .map(Number)
    .filter(index => Number.isFinite(index) && requestedMatches(index));
  const audioIndexes = (record.audioChunks || [])
    .map(chunk => (record.pipeline === "funasr" || record.job?.pipeline === "funasr")
      ? Number(chunk?.index)
      : browserRecognitionGroupIndex(record, chunk))
    .filter(index => Number.isFinite(index) && requestedMatches(index));
  return [...new Set([...statusIndexes, ...sourceIndexes, ...audioIndexes])]
    .filter(index => {
      const status = statuses[index];
      if (!status) {
        return true;
      }
      const translated = record.translatedSegmentsByChunk?.get?.(index);
      return status.stage !== "completed" || !Array.isArray(translated) || browserTranslationFailures(translated).length > 0;
    })
    .sort((left, right) => left - right);
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

function browserTranslationGroupAsrCompleted(record, groupIndex) {
  const chunks = browserAudioChunksForTranslationGroup(record, groupIndex);
  return chunks.length > 0 && chunks.every(chunk => chunk?.asrCompleted === true);
}

function browserRetrySourceHasCompletedRecognition(record, index, status = {}, funAsrChunk = null) {
  if (!reusableBrowserSourceSegments(record, index).length ||
      chunkStatusAsrFailureCount(status) > 0 || status?.asrRequired === true) {
    return false;
  }
  if (Number(status?.sourceCount || 0) > 0) {
    return true;
  }
  if (funAsrChunk) {
    return funAsrChunk.asrCompleted === true;
  }
  return browserTranslationGroupAsrCompleted(record, index);
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
      const recoveryWarning = browserAsrResultWarning(chunkSegments);
      if (recoveryWarning) {
        errors.push(recoveryWarning.message || String(recoveryWarning));
      }
      if (chunkSegments.length) {
        sourceSegments.push(...chunkSegments);
      } else {
        empty += 1;
      }
    } catch (error) {
      if (isBrowserRunInactive(record, runToken) || isBrowserAbortError(error, record.abortController?.signal)) {
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
  queueBrowserTranslationIndexesForOffscreen(record, indexes, options);
  publishBrowserPreloadJob(record);
  return startQueuedBrowserWorkInOffscreen(record);
}

function queueBrowserTranslationIndexesForOffscreen(record, indexes, options = {}) {
  const statuses = record.job.translation?.chunkStatuses || [];
  for (const index of indexes) {
    const sourceSegments = reusableBrowserSourceSegments(record, index);
    const current = statuses[index] || {};
    updateChunkStatus(record, index, {
      stage: "asr_done",
      status: "排队",
      attempts: options.resetAttempts ? 0 : Math.max(0, Number(current.attempts || 0)),
      sourceCount: sourceSegments.length,
      translatedCount: cloneBrowserSegments(record.translatedSegmentsByChunk?.get(index)).length,
      translationFailures: 0,
      error: "",
      message: "等待 offscreen 重新翻译"
    });
  }
}

async function startQueuedBrowserWorkInOffscreen(record, options = {}) {
  const started = await startBrowserJobInOffscreen(record, {
    resumeExisting: Boolean(options.resumeExisting)
  });
  if (started.status === "unavailable") {
    record.offscreenExecution = false;
    record.job.status = "interrupted";
    record.job.stage = "interrupted";
    record.job.error = "offscreen 翻译执行器不可用，已保留原文和已有译文，请重试。";
    record.job.updatedAt = Date.now();
    publishBrowserPreloadJob(record);
    await flushBrowserJobMirror(record.job.id).catch(() => null);
    throw new Error(record.job.error);
  }
  return {
    preload: record.job.status,
    job: record.job,
    accepted: true,
    offscreen: true,
    duplicate: Boolean(started.duplicate),
    pending: true
  };
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
        maxConcurrency: browserTranslationProviderConcurrency(record),
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
    if (isBrowserRunInactive(record, runToken) || isBrowserAbortError(error, record.abortController?.signal)) {
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
  await browserJobRecoveryPromise;
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
      const funAsrCancelConfig = browserRecord.pipeline === "funasr" || browserRecord.job?.pipeline === "funasr"
        ? browserFunAsrExecutionConfig(browserRecord.modelConfig?.asr || {})
        : null;
      sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB, {
        jobId: targetJobId,
        runToken: cancelRunToken,
        requestedAt: cancelRequestedAt,
        ...(funAsrCancelConfig ? { funAsrCancelConfig } : {})
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
    const preserveExisting = Boolean(browserRecord.preserveExistingOnCancel || browserRecord.job.preserveExistingOnCancel) && Boolean(
      browserRecord.sourceSegmentsByChunk?.size || browserRecord.translatedSegmentsByChunk?.size || browserRecord.job?.translation?.vttText
    );
    browserRecord.job.status = preserveExisting ? "interrupted" : "cancelled";
    browserRecord.job.stage = preserveExisting ? "interrupted" : "cancelled";
    const remoteCancellation = browserRecord.pipeline === "funasr" || browserRecord.job?.pipeline === "funasr"
      ? await browserFunAsrRemoteCancellationSummary(targetJobId, cancelRunToken)
      : { status: "none", message: "" };
    browserRecord.job.remoteCancellationStatus = remoteCancellation.status;
    browserRecord.job.error = remoteCancellation.message || (preserveExisting
      ? "已停止本次重试，保留现有字幕和音频缓存。"
      : "任务已停止。");
    if (!preserveExisting) {
      await releaseBrowserAudioChunks(browserRecord);
      await detachPreloadVtt(tabId);
    }
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

async function preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
  tabId,
  pageUrl,
  currentJob,
  modelConfig = {},
  selectedCandidate = null
) {
  if (!FuguangBrowserFunAsrProvider.isDashScopeFunAsrConfig(modelConfig?.asr || {})) {
    return;
  }
  const checkedRuns = new Set();
  const check = async (job, config) => {
    const key = `${String(job?.id || "")}:${String(job?.runToken || "")}`;
    if (!job?.id || !job?.runToken || checkedRuns.has(key)) {
      return;
    }
    checkedRuns.add(key);
    await preventFunAsrSubmitWhileRemoteCancellationUnresolved(job, config);
  };
  const selectedLineageKey = browserMediaLineageKey(selectedCandidate, pageUrl);
  const currentRecord = browserPreloadJobs.get(String(currentJob?.id || ""));
  const currentLineageKey = String(
    currentRecord?.presentationBinding?.lineageKey ||
    browserMediaLineageKey(
      currentRecord?.selectedCandidate || currentRecord?.candidate || {
        url: currentJob?.sourceUrl || currentJob?.source || "",
        kind: currentJob?.kind || "",
        ext: currentJob?.ext || ""
      },
      currentRecord?.metadata?.pageUrl || currentJob?.metadata?.pageUrl || pageUrl
    )
  );
  if (!selectedLineageKey || !currentLineageKey || selectedLineageKey === currentLineageKey) {
    await check(currentJob, currentRecord?.modelConfig || modelConfig);
  }

  let ledgers;
  try {
    ledgers = await browserJobStore.listJobs();
  } catch {
    throw new Error("无法核对上一次 FunASR 远端任务状态；为避免重复提交，本次识别未启动。请稍后重试。");
  }
  const matching = (Array.isArray(ledgers) ? ledgers : [])
    .filter(ledger =>
      Number(ledger?.tabId) === Number(tabId) &&
      String(ledger?.pipeline || "") === "funasr" &&
      Boolean(ledger?.cancelRequested) &&
      browserPageIdentitiesMatch(ledger?.pageIdentity || "", pageUrl) &&
      selectedLineageKey &&
      browserLedgerMediaLineageKey(ledger) === selectedLineageKey
    )
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
  for (const ledger of matching) {
    const modelResolution = await resolveRecoveredModelConfig(ledger);
    await check({
      id: ledger.id,
      runToken: ledger.runToken,
      pipeline: ledger.pipeline,
      cancelRequested: ledger.cancelRequested
    }, modelResolution.modelConfig || {});
  }
}

function createBrowserPresentationBinding(tabId, candidate = {}, pageUrl = "") {
  const state = getState(tabId);
  const candidateFrameId = optionalBrowserFrameId(candidate.frameId);
  const stateFrameId = optionalBrowserFrameId(state.mediaFrameId);
  const frameId = candidateFrameId ?? stateFrameId;
  const documentId = normalizeDocumentId(
    candidate.documentId ||
    (frameId !== null && stateFrameId === frameId ? state.mediaDocumentId : "") ||
    (frameId !== null && optionalBrowserFrameId(state.context?.frameId) === frameId ? state.context?.documentId : "")
  );
  const lineageKey = browserMediaLineageKey(candidate, pageUrl);
  if (frameId === null && !documentId && !lineageKey) {
    return null;
  }
  return { frameId, documentId, lineageKey };
}

function optionalBrowserFrameId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const frameId = Number(value);
  return Number.isInteger(frameId) && frameId >= 0 ? frameId : null;
}

function browserMediaLineageKey(candidate = {}, pageUrl = "") {
  const url = String(candidate?.url || candidate?.identity || candidate?.sourceUrl || "");
  if (!url || typeof FuguangBrowserMediaCandidates.getMediaLineageKey !== "function") {
    return "";
  }
  return String(FuguangBrowserMediaCandidates.getMediaLineageKey({
    ...candidate,
    url,
    pageUrl: normalizeBrowserPageIdentity(pageUrl || candidate?.pageUrl || candidate?.origin || "")
  }) || "");
}

function browserLedgerMediaLineageKey(ledger = {}) {
  const persisted = String(ledger?.source?.lineageKey || "");
  if (persisted.startsWith("media:v2:")) {
    return persisted;
  }
  const migrated = browserMediaLineageKey({
    url: ledger?.source?.identity || "",
    kind: ledger?.source?.kind || "",
    ext: ledger?.source?.ext || ""
  }, ledger?.pageIdentity || "");
  return migrated || persisted;
}

async function preventFunAsrSubmitWhileRemoteCancellationUnresolved(job, modelConfig = {}) {
  if (!job?.id || !job?.runToken || String(job.pipeline || "") !== "funasr" || !job.cancelRequested) {
    return;
  }
  const summary = await browserFunAsrRemoteCancellationSummary(job.id, job.runToken, { failClosed: true });
  if (summary.status !== "pending") {
    return;
  }
  const funAsrConfig = browserFunAsrExecutionConfig(modelConfig?.asr || {});
  if (funAsrConfig && typeof chrome.runtime?.connect === "function") {
    sendOffscreenTaskRuntimeCommand(FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB, {
      jobId: String(job.id),
      runToken: String(job.runToken),
      requestedAt: Date.now(),
      funAsrCancelConfig: funAsrConfig
    }).catch(() => {});
  }
  throw new Error(summary.message || "上一次 FunASR 远端任务的取消状态尚未确认；确认前不会提交新的识别任务。");
}

async function browserFunAsrRemoteCancellationSummary(jobId, runToken, { failClosed = false } = {}) {
  let operations;
  try {
    operations = await browserJobStore.listOperations(String(jobId || ""), String(runToken || ""));
  } catch {
    return failClosed
      ? { status: "pending", message: "无法核对上一次 FunASR 远端任务状态；为避免重复提交，本次识别未启动。请稍后重试。" }
      : { status: "none", message: "" };
  }
  operations = Array.isArray(operations) ? operations : [];
  const submissions = operations.filter(operation => operation?.provider === "dashscope_funasr" &&
    operation?.operationType === "funasr-submit" && browserFunAsrSubmissionMayHaveRemoteWork(operation));
  const cancellations = operations.filter(operation => operation?.provider === "dashscope_funasr" &&
    operation?.operationType === "funasr-cancel");
  if (!submissions.length && !cancellations.length) {
    return { status: "none", message: "" };
  }
  if (cancellations.some(operation => operation.state === "submitted" || operation.state === "unknown" ||
      operation.result?.status === "unknown")) {
    return { status: "pending", message: "本地处理已停止；远端 FunASR 任务状态正在确认。确认前不会提交新的识别任务。" };
  }
  if (submissions.some(submission => !cancellations.some(cancellation =>
    String(cancellation.result?.submitOperationId || "") === String(submission.operationId || "") &&
    cancellation.state === "completed"))) {
    return { status: "pending", message: "本地处理已停止；远端 FunASR 任务状态正在确认。确认前不会提交新的识别任务。" };
  }
  if (cancellations.some(operation => operation.result?.status === "not-applied")) {
    return { status: "not-applied", message: "本地处理已停止；远端 FunASR 任务已经开始或结束，服务端未接受取消。" };
  }
  if (cancellations.length && cancellations.every(operation => operation.result?.status === "confirmed")) {
    return { status: "confirmed", message: "本地处理已停止，远端 FunASR 排队任务也已取消。" };
  }
  return { status: "none", message: "" };
}

function browserFunAsrSubmissionMayHaveRemoteWork(operation = {}) {
  const state = String(operation.state || "");
  if (["submitted", "unknown"].includes(state)) {
    return true;
  }
  if (!["accepted", "completed"].includes(state)) {
    return false;
  }
  const status = Number(operation.status || 0);
  return (status >= 200 && status < 300) || Boolean(String(operation.remoteTaskId || ""));
}

async function refreshBrowserFunAsrCancellationProjection(record) {
  if (!record?.job?.id || String(record.pipeline || record.job.pipeline || "") !== "funasr" ||
      !record.job.cancelRequested) {
    return;
  }
  const summary = await browserFunAsrRemoteCancellationSummary(record.job.id, record.runToken || record.job.runToken);
  if (summary.status === "none") {
    delete record.job.remoteCancellationStatus;
    return;
  }
  record.job.remoteCancellationStatus = summary.status;
  record.job.error = summary.message;
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
      if (alarm?.name === MEDIA_HEADER_RULE_RECOVERY_ALARM) {
        runMediaHeaderRuleRecovery({ force: true }).catch(() => {});
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
  if (browserJobLedgerMaintenancePromise) {
    return browserJobLedgerMaintenancePromise;
  }
  const maintenance = performBrowserJobLedgerMaintenance(now);
  browserJobLedgerMaintenancePromise = maintenance;
  try {
    return await maintenance;
  } finally {
    if (browserJobLedgerMaintenancePromise === maintenance) {
      browserJobLedgerMaintenancePromise = null;
    }
    scheduleOffscreenIdleCloseIfNeeded();
  }
}

async function performBrowserJobLedgerMaintenance(now = Date.now()) {
  await browserJobRecoveryPromise;
  const cutoff = Number(now || Date.now()) - BROWSER_JOB_LEDGER_TTL_MS;
  await browserJobStore.compactCompletedCleanupClaims(cutoff).catch(() => ({ deletedClaims: 0 }));
  const jobs = await browserJobStore.listJobs();
  const pendingCleanupClaims = await browserJobStore.listCleanupClaims({ state: "pending" }).catch(() => []);
  const candidates = jobs.filter(job => {
    const status = String(job?.status || "");
    const updatedAt = Number(job?.updatedAt || job?.createdAt || 0);
    return Boolean(job?.id && job?.runToken && updatedAt > 0 && updatedAt < cutoff &&
      (FuguangJobContract.isTerminalStatus(status) || status === "interrupted"));
  });
  if (!candidates.length && !pendingCleanupClaims.length) {
    return { deletedTerminalJobs: 0, deletedInterruptedJobs: 0, failedJobs: 0, skippedJobs: 0 };
  }
  await ensureOffscreenDocument();
  let deletedTerminalJobs = 0;
  let deletedInterruptedJobs = 0;
  let failedJobs = 0;
  let skippedJobs = 0;
  if (pendingCleanupClaims.length) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "fuguang:paid-request:drain-pending-cleanup-results"
      });
      if (!response?.ok) {
        throw new Error(response?.error?.message || "Offscreen pending paid-result cleanup failed.");
      }
      failedJobs += Math.max(0, Number(response.result?.failed || 0) || 0);
    } catch (error) {
      console.warn("Failed to retry pending paid-result cleanup.", error);
      failedJobs += pendingCleanupClaims.length;
    }
  }
  for (const candidate of candidates) {
    try {
      const result = await withBrowserJobLifecycleLock(candidate.id, async () => {
        await flushBrowserJobMirror(candidate.id);
        const current = await browserJobStore.getJob(candidate.id);
        const expectedUpdatedAt = Number(candidate.updatedAt || candidate.createdAt || 0);
        const currentUpdatedAt = Number(current?.updatedAt || current?.createdAt || 0);
        if (!current || String(current.runToken || "") !== String(candidate.runToken || "") ||
            currentUpdatedAt !== expectedUpdatedAt || currentUpdatedAt >= cutoff ||
            (!FuguangJobContract.isTerminalStatus(current.status) && current.status !== "interrupted")) {
          return { applied: false, reason: "changed-job" };
        }
        const response = await chrome.runtime.sendMessage({
          type: "fuguang:paid-request:cleanup-expired-job-results",
          cleanup: {
            jobId: current.id,
            runToken: current.runToken,
            expectedUpdatedAt: currentUpdatedAt,
            cutoff,
            checkedAt: Number(now || Date.now())
          }
        });
        if (!response?.ok) {
          throw new Error(response?.error?.message || "Offscreen paid-result cleanup failed.");
        }
        if (response.result?.applied === false) {
          return { applied: false, reason: response.result.reason || "rejected" };
        }
        const record = browserPreloadJobs.get(current.id);
        if (record && String(record.runToken || record.job?.runToken || "") === String(current.runToken || "")) {
          browserPreloadJobs.delete(current.id);
        }
        const pending = browserJobMirrorPending.get(current.id);
        if (String(pending?.snapshot?.job?.runToken || "") === String(current.runToken || "")) {
          browserJobMirrorPending.delete(current.id);
        }
        return { applied: true, status: String(current.status || "") };
      });
      if (!result.applied) {
        skippedJobs += 1;
      } else if (result.status === "interrupted") {
        deletedInterruptedJobs += 1;
      } else {
        deletedTerminalJobs += 1;
      }
    } catch (error) {
      console.warn("Failed to clean expired browser job ledger.", error);
      failedJobs += 1;
    }
  }
  return {
    deletedTerminalJobs,
    deletedInterruptedJobs,
    failedJobs,
    skippedJobs
  };
}

function scheduleOffscreenIdleCloseIfNeeded() {
  if ([...browserPreloadJobs.values()].some(record => browserJobNeedsOffscreen(record?.job))) {
    clearOffscreenIdleCloseAlarm();
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

function clearOffscreenIdleCloseAlarm() {
  try {
    const cleared = chrome.alarms?.clear?.(OFFSCREEN_IDLE_CLOSE_ALARM);
    cleared?.catch?.(() => {});
  } catch {
    // Alarm cleanup is best-effort; close-time activity checks remain authoritative.
  }
}

function browserJobNeedsOffscreen(job) {
  return ["queued", "running"].includes(String(job?.status || ""));
}

async function closeOffscreenDocumentIfIdle() {
  if (offscreenDocumentClosePromise) {
    return offscreenDocumentClosePromise;
  }
  const closeAttempt = (async () => {
    await browserJobRecoveryPromise;
    if (await offscreenRuntimeHasActiveWork()) {
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
    // Activity can begin while getContexts() is in flight. Recheck immediately
    // before the destructive close so a stale alarm cannot kill new work.
    if (await offscreenRuntimeHasActiveWork()) {
      return { closed: false, reason: "active" };
    }
    await chrome.offscreen.closeDocument();
    offscreenTaskRuntimePort = null;
    return { closed: true };
  })();
  offscreenDocumentClosePromise = closeAttempt.finally(() => {
    offscreenDocumentClosePromise = null;
  });
  return offscreenDocumentClosePromise;
}

async function offscreenRuntimeHasActiveWork() {
  if ([...browserPreloadJobs.values()].some(record => browserJobNeedsOffscreen(record?.job)) ||
      offscreenTaskRuntimeCommands.size || browserJobLedgerMaintenancePromise || offscreenDocumentCreationPromise) {
    return true;
  }
  let durableJobs;
  try {
    durableJobs = await browserJobStore.listRecoverableJobs();
  } catch {
    // A failed durable read means activity is unknown, not absent. Keeping the
    // document alive is the only non-destructive choice until the next alarm.
    return true;
  }
  return durableJobs.some(job =>
    browserJobNeedsOffscreen(job) &&
    String(job.executionRunToken || "") === String(job.runToken || "") &&
    Boolean(job.executionStartedAt)
  );
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
  await browserJobRecoveryPromise;
  const maxAgeMs = Number(options.maxAgeMs ?? WEB_FFMPEG_AUDIO_CACHE_MAX_AGE_MS);
  const maxBytes = Number(options.maxBytes ?? WEB_FFMPEG_AUDIO_CACHE_MAX_BYTES);
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  let durableJobs;
  let ledgerAudioChunks;
  try {
    durableJobs = await browserJobStore.listJobs();
    ledgerAudioChunks = await browserJobStore.listAudioChunks();
  } catch {
    return { removed: 0, removedBytes: 0, failed: 0, scanned: 0, reason: "ledger-unavailable" };
  }
  const protectedJobIds = new Set(durableJobs
    .filter(job => job?.id && !FuguangJobContract.isTerminalStatus(job.status))
    .map(job => String(job.id)));
  for (const jobId of [...browserPreloadJobs.values()]
    .filter(record => record && !record.cancelled && browserJobIsRunning(record.job))
    .map(record => record.job?.id)
    .filter(Boolean)) {
    protectedJobIds.add(String(jobId));
  }
  const keys = await cache.keys().catch(() => []);
  const entries = [];
  const now = Date.now();
  for (const key of keys) {
    const url = typeof key === "string" ? key : key?.url;
    if (!isBrowserAudioCacheUrl(url)) {
      continue;
    }
    const response = await cache.match(url).catch(() => null);
    const info = await browserAudioCacheEntryInfo(url, response);
    entries.push({
      key,
      url,
      protected: [...protectedJobIds].some(jobId => isBrowserAudioCacheUrlForJob(url, jobId)),
      ...info
    });
  }
  const logicalGroups = browserAudioCacheLogicalGroups(entries, ledgerAudioChunks, protectedJobIds);
  const toDelete = new Set();
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    for (const group of logicalGroups) {
      if (!group.protected && group.entries.length && group.entries.every(entry => entry.cachedAt && now - entry.cachedAt > maxAgeMs)) {
        toDelete.add(group);
      }
    }
  }
  let totalBytes = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.bytes || 0) || 0), 0);
  for (const group of toDelete) {
    totalBytes -= browserAudioCacheGroupBytes(group);
  }
  if (Number.isFinite(maxBytes) && maxBytes > 0 && totalBytes > maxBytes) {
    const oldestFirst = logicalGroups.filter(group => !group.protected && !toDelete.has(group)).sort((left, right) => (
      browserAudioCacheGroupTime(left) - browserAudioCacheGroupTime(right) ||
      String(left.entries[0]?.url || "").localeCompare(String(right.entries[0]?.url || ""))
    ));
    for (const group of oldestFirst) {
      if (totalBytes <= maxBytes) {
        break;
      }
      toDelete.add(group);
      totalBytes -= browserAudioCacheGroupBytes(group);
    }
  }
  const selectedEntries = [...toDelete].flatMap(group => group.entries);
  const deletion = await deleteBrowserAudioCacheUrls(cache, selectedEntries.map(entry => entry.url));
  const unavailableRefs = [...deletion.deleted, ...deletion.alreadyMissing];
  if (unavailableRefs.length) {
    await reconcileBrowserAudioCacheDeletion(unavailableRefs, ledgerAudioChunks);
  }
  const bytesByUrl = new Map(entries.map(entry => [entry.url, Math.max(0, Number(entry.bytes || 0) || 0)]));
  return {
    removed: deletion.deleted.length,
    removedBytes: deletion.deleted.reduce((sum, url) => sum + (bytesByUrl.get(url) || 0), 0),
    failed: deletion.failed.length,
    scanned: entries.length
  };
}

function browserAudioCacheLogicalGroups(entries = [], ledgerAudioChunks = [], protectedJobIds = new Set()) {
  const entryByUrl = new Map(entries.map(entry => [String(entry.url || ""), entry]));
  const groupByUrl = new Map();
  const groups = new Set();
  const attach = refs => {
    const urls = [...new Set(refs.map(ref => String(ref || "")).filter(ref => entryByUrl.has(ref)))];
    if (!urls.length) {
      return;
    }
    const existing = [...new Set(urls.map(url => groupByUrl.get(url)).filter(Boolean))];
    const group = existing.shift() || { entries: [], jobIds: new Set(), protected: false };
    groups.add(group);
    for (const merged of existing) {
      for (const entry of merged.entries) {
        if (!group.entries.includes(entry)) {
          group.entries.push(entry);
        }
        groupByUrl.set(entry.url, group);
      }
      for (const jobId of merged.jobIds) {
        group.jobIds.add(jobId);
      }
      groups.delete(merged);
    }
    for (const url of urls) {
      const entry = entryByUrl.get(url);
      if (!group.entries.includes(entry)) {
        group.entries.push(entry);
      }
      groupByUrl.set(url, group);
    }
  };
  for (const chunk of ledgerAudioChunks) {
    attach(browserAudioCacheRefsFromLedgerChunk(chunk));
  }
  for (const entry of entries) {
    attach([entry.url]);
  }
  for (const chunk of ledgerAudioChunks) {
    const refs = browserAudioCacheRefsFromLedgerChunk(chunk);
    const group = refs.map(ref => groupByUrl.get(ref)).find(Boolean);
    if (group && chunk?.jobId) {
      group.jobIds.add(String(chunk.jobId));
    }
  }
  for (const group of groups) {
    group.protected = group.entries.some(entry => entry.protected) || [...group.jobIds].some(jobId => protectedJobIds.has(jobId));
    group.entries.sort((left, right) => String(left.url).localeCompare(String(right.url)));
  }
  return [...groups];
}

function browserAudioCacheRefsFromLedgerChunk(chunk = {}) {
  const refs = new Set();
  if (chunk.audioCacheRef) {
    refs.add(String(chunk.audioCacheRef));
  }
  for (const ref of Array.isArray(chunk.audioCacheRefs) ? chunk.audioCacheRefs : []) {
    if (ref) {
      refs.add(String(ref));
    }
  }
  for (const part of Array.isArray(chunk.audioParts) ? chunk.audioParts : []) {
    if (part?.cacheRef) {
      refs.add(String(part.cacheRef));
    }
  }
  return [...refs];
}

function browserAudioCacheGroupBytes(group) {
  return (group?.entries || []).reduce((sum, entry) => sum + Math.max(0, Number(entry.bytes || 0) || 0), 0);
}

function browserAudioCacheGroupTime(group) {
  return Math.max(0, ...(group?.entries || []).map(entry => Number(entry.cachedAt || 0) || 0));
}

async function deleteBrowserAudioCacheUrls(cache, refs = []) {
  const result = { deleted: [], alreadyMissing: [], failed: [] };
  for (const ref of [...new Set(refs.map(value => String(value || "")).filter(Boolean))]) {
    try {
      const before = await cache.match(ref);
      if (!before) {
        result.alreadyMissing.push(ref);
        continue;
      }
      if (await cache.delete(ref)) {
        result.deleted.push(ref);
        continue;
      }
      if (!await cache.match(ref)) {
        result.alreadyMissing.push(ref);
      } else {
        result.failed.push(ref);
      }
    } catch {
      result.failed.push(ref);
    }
  }
  return result;
}

async function reconcileBrowserAudioCacheDeletion(refs = [], ledgerAudioChunks = null) {
  const targetRefs = new Set(refs.map(ref => String(ref || "")).filter(Boolean));
  if (!targetRefs.size) {
    return [];
  }
  const chunks = ledgerAudioChunks || await browserJobStore.listAudioChunks().catch(() => []);
  const affectedJobIds = new Set();
  for (const chunk of chunks) {
    if (browserAudioCacheRefsFromLedgerChunk(chunk).some(ref => targetRefs.has(ref)) && chunk?.jobId) {
      affectedJobIds.add(String(chunk.jobId));
    }
  }
  const results = [];
  for (const jobId of affectedJobIds) {
    const jobRefs = [...targetRefs].filter(ref => chunks.some(chunk => (
      String(chunk?.jobId || "") === jobId && browserAudioCacheRefsFromLedgerChunk(chunk).includes(ref)
    )));
    let result = null;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await browserJobStore.reconcileAudioCacheRefs(jobId, jobRefs, { verifiedAt: Date.now() });
        if (result?.applied !== false) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!result || result.applied === false) {
      if (lastError) {
        console.warn("Failed to reconcile browser audio cache ledger.", lastError);
      }
      continue;
    }
    const record = browserPreloadJobs.get(jobId);
    if (record) {
      removeBrowserRecordAudioChunksByRefs(record, new Set(jobRefs));
      applyBrowserAudioCacheAvailability(record, result);
      publishBrowserPreloadJob(record);
    }
    results.push(result);
  }
  return results;
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
    await flushBrowserJobMirror(targetJobId).catch(() => null);
    const deletion = await clearBrowserAudioCacheForJobDetailed(targetJobId, [
      ...(browserRecord.audioChunks || []),
      ...(browserRecord.browserInternalAudioChunks || []),
      ...(browserRecord.browserPendingLogicalChunk?.parts || [])
    ]);
    const unavailableRefs = [...deletion.deleted, ...deletion.alreadyMissing];
    const reconciled = await reconcileBrowserAudioCacheDeletion(unavailableRefs);
    removeBrowserRecordAudioChunksByRefs(browserRecord, new Set(unavailableRefs));
    if (reconciled.length) {
      applyBrowserAudioCacheAvailability(browserRecord, reconciled.find(result => result?.job?.id === targetJobId) || reconciled[0]);
    } else {
      await verifyBrowserRecordAudioCache(browserRecord, { persist: true });
    }
    publishBrowserPreloadJob(browserRecord);
    await flushBrowserJobMirror(targetJobId).catch(() => null);
    const removed = deletion.deleted.length;
    return {
      job: browserRecord.job,
      removed: removed > 0,
      message: deletion.failed.length
        ? `浏览器内任务的音频切片缓存已清除 ${removed} 项，另有 ${deletion.failed.length} 项暂时无法清除。`
        : removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  if (String(targetJobId).startsWith("browser-")) {
    const deletion = await clearBrowserAudioCacheForJobDetailed(targetJobId, []);
    const unavailableRefs = [...deletion.deleted, ...deletion.alreadyMissing];
    const reconciled = await reconcileBrowserAudioCacheDeletion(unavailableRefs);
    const durableJob = reconciled.find(result => result?.job?.id === targetJobId)?.job || await browserJobStore.getJob(targetJobId).catch(() => null);
    const removed = deletion.deleted.length;
    const job = {
      ...(state.preloadJob || {}),
      ...(durableJob || {}),
      id: targetJobId,
      audioCacheRemoved: durableJob ? Boolean(durableJob.audioCacheRemoved) : unavailableRefs.length > 0,
      audioCacheRemovedCount: Number(durableJob?.audioCacheRemovedCount || removed) || 0,
      audioCacheVerified: Boolean(durableJob?.audioCacheVerified || unavailableRefs.length)
    };
    setTabStatus(tabId, { preloadJob: job, error: "" });
    return {
      job,
      removed: removed > 0,
      message: deletion.failed.length
        ? `浏览器内任务的音频切片缓存已清除 ${removed} 项，另有 ${deletion.failed.length} 项暂时无法清除。`
        : removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  throw new Error("这个任务不是当前浏览器内预加载任务，不能清理浏览器音频缓存。请重新抽取。");
}

async function clearBrowserAudioCacheForJob(jobId, chunks = []) {
  const deletion = await clearBrowserAudioCacheForJobDetailed(jobId, chunks);
  return deletion.deleted.length;
}

async function clearBrowserAudioCacheForJobDetailed(jobId, chunks = []) {
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const cacheUrls = collectBrowserAudioCacheUrls(chunks);
  const keys = await cache.keys().catch(() => []);
  for (const key of keys) {
    const url = typeof key === "string" ? key : key?.url;
    if (isBrowserAudioCacheUrlForJob(url, jobId)) {
      cacheUrls.add(url);
    }
  }
  return deleteBrowserAudioCacheUrls(cache, [...cacheUrls]);
}

async function releaseBrowserAudioChunks(record) {
  const jobId = record?.job?.id || "";
  if (!jobId) {
    return 0;
  }
  await flushBrowserJobMirror(jobId).catch(() => null);
  const deletion = await clearBrowserAudioCacheForJobDetailed(jobId, [
    ...(record.audioChunks || []),
    ...(record.browserInternalAudioChunks || []),
    ...(record.browserPendingLogicalChunk?.parts || [])
  ]);
  const unavailableRefs = [...deletion.deleted, ...deletion.alreadyMissing];
  const reconciled = await reconcileBrowserAudioCacheDeletion(unavailableRefs);
  removeBrowserRecordAudioChunksByRefs(record, new Set(unavailableRefs));
  if (reconciled.length) {
    applyBrowserAudioCacheAvailability(record, reconciled.find(result => result?.job?.id === jobId) || reconciled[0]);
  } else {
    await verifyBrowserRecordAudioCache(record, { persist: true });
  }
  publishBrowserPreloadJob(record);
  await flushBrowserJobMirror(jobId).catch(() => null);
  return deletion.deleted.length;
}

function removeBrowserRecordAudioChunksByRefs(record, refs = new Set()) {
  const chunkUsesRef = chunk => {
    const urls = collectBrowserAudioCacheUrls([chunk]);
    return [...urls].some(url => refs.has(url));
  };
  record.audioChunks = (record.audioChunks || []).filter(chunk => !chunkUsesRef(chunk));
  record.browserInternalAudioChunks = (record.browserInternalAudioChunks || []).filter(chunk => !chunkUsesRef(chunk));
  if ((record.browserPendingLogicalChunk?.parts || []).some(part => chunkUsesRef(part))) {
    record.browserPendingLogicalChunk = null;
  }
}

function applyBrowserAudioCacheAvailability(record, result = {}) {
  const reusableAudioChunks = Math.max(0, Number(result.reusableAudioChunks ?? record.audioChunks?.length ?? 0) || 0);
  record.job.translation ||= {};
  record.job.reusableAudioChunks = reusableAudioChunks;
  record.job.translation.reusableAudioChunks = reusableAudioChunks;
  record.job.audioCacheRemoved = reusableAudioChunks === 0;
  record.job.audioCacheRemovedCount = Math.max(0, Number(result.job?.audioCacheRemovedCount ?? record.job.audioCacheRemovedCount ?? 0) || 0);
  record.job.audioCacheVerified = true;
  record.job.audioCacheVerifiedAt = Number(result.job?.audioCacheVerifiedAt || Date.now()) || Date.now();
  record.job.audioCacheRemovedRefs = Array.isArray(result.job?.audioCacheRemovedRefs)
    ? [...result.job.audioCacheRemovedRefs]
    : (Array.isArray(record.job.audioCacheRemovedRefs) ? record.job.audioCacheRemovedRefs : []);
}

async function verifyBrowserRecordAudioCache(record, options = {}) {
  if (!record?.job?.id) {
    return { verified: false, reusableAudioChunks: 0, missingRefs: [] };
  }
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const missingRefs = new Set();
  let verificationFailed = false;
  for (const chunk of record.audioChunks || []) {
    const refs = [...collectBrowserAudioCacheUrls([chunk])];
    for (const ref of refs) {
      try {
        if (!await cache.match(ref)) {
          missingRefs.add(ref);
        }
      } catch {
        verificationFailed = true;
      }
    }
  }
  if (verificationFailed) {
    record.job.audioCacheVerified = false;
    return { verified: false, reusableAudioChunks: record.audioChunks?.length || 0, missingRefs: [] };
  }
  let reconciled = [];
  if (missingRefs.size && options.persist !== false) {
    reconciled = await reconcileBrowserAudioCacheDeletion([...missingRefs]);
  }
  removeBrowserRecordAudioChunksByRefs(record, missingRefs);
  const result = reconciled.find(item => item?.job?.id === record.job.id) || {
    reusableAudioChunks: record.audioChunks?.length || 0,
    job: record.job
  };
  applyBrowserAudioCacheAvailability(record, result);
  return {
    verified: true,
    reusableAudioChunks: record.audioChunks?.length || 0,
    missingRefs: [...missingRefs]
  };
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
    await clearBrowserSubtitleStateForJob(browserRecord);
  } else if (targetJobId && state.preloadJob?.id === targetJobId) {
    state.preloadJob = clearPreloadJobSubtitlePayload(state.preloadJob);
  }
  await detachPreloadVtt(tabId);
  return { cleared: Boolean(targetJobId) };
}

async function clearBrowserSubtitleStateForJob(record) {
  if (!record?.job?.translation) {
    return;
  }
  record.translatedSegmentsByChunk = new Map();
  record.job = clearPreloadJobSubtitlePayload(record.job, collectChunkSegments(record.sourceSegmentsByChunk || new Map()));
  publishBrowserPreloadJob(record);
  const durable = await flushBrowserJobMirror(record.job.id);
  if (!durable || String(durable.runToken || "") !== String(record.runToken || record.job.runToken || "") ||
      durable.subtitleCleared !== true) {
    throw new Error("字幕已在当前页面清除，但未能持久化清除状态；请重试。");
  }
  return durable;
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
  await browserJobRecoveryPromise;
  if (!jobId) {
    throw new Error("没有可查询的预加载任务。");
  }
  let browserRecord = browserPreloadJobs.get(jobId);
  if (!browserRecord) {
    if (tabId) {
      await refreshTabInfo(tabId);
    }
    browserRecord = await recoverBrowserPresentationJob(
      jobId,
      tabId,
      tabId ? (getState(tabId).page?.url || getState(tabId).context?.href || "") : ""
    );
  }
  if (browserRecord) {
    if (!browserRecord.presentationOnly) {
      await verifyBrowserRecordAudioCache(browserRecord, { persist: true });
    }
    await refreshBrowserFunAsrCancellationProjection(browserRecord);
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

async function sendBrowserJobVttToBoundMedia(record, message) {
  const tabId = Number(record?.tabId);
  const binding = record?.presentationBinding;
  const frameId = optionalBrowserFrameId(binding?.frameId);
  const documentId = normalizeDocumentId(binding?.documentId);
  const lineageKey = String(binding?.lineageKey || "");
  if (!Number.isInteger(tabId) || tabId < 0 || frameId === null ||
      !documentId || !lineageKey) {
    return sendMessageToMediaFrame(tabId, message);
  }

  let exactResponse = null;
  if (await browserFrameMatchesDocument(tabId, frameId, documentId)) {
    exactResponse = await sendMessageToSpecificMediaFrame(tabId, message, frameId, documentId);
    if (exactResponse?.ok || exactResponse?.state || exactResponse?.preservedManual) {
      return exactResponse;
    }
  }

  const successor = await findTrustedBrowserMediaSuccessor(record, frameId, documentId);
  if (successor) {
    return sendMessageToSpecificMediaFrame(
      tabId,
      message,
      successor.frameId,
      successor.documentId
    );
  }
  return exactResponse || {
    ok: false,
    mediaBindingRejected: true,
    durableBindingRejected: true
  };
}

async function findTrustedBrowserMediaSuccessor(record, originalFrameId, originalDocumentId) {
  const tabId = Number(record?.tabId);
  const expectedLineageKey = String(record?.presentationBinding?.lineageKey || "");
  if (!Number.isInteger(tabId) || tabId < 0 || !expectedLineageKey) {
    return null;
  }
  const state = getState(tabId);
  const trustedFrameId = optionalBrowserFrameId(state.mediaFrameId);
  if (trustedFrameId === null) {
    return null;
  }
  const pageUrl = record.metadata?.pageUrl || record.job?.metadata?.pageUrl || "";
  const candidates = [
    state.lastPreloadCandidate,
    ...(Array.isArray(state.candidates) ? state.candidates : []),
    state.context?.currentSrc ? {
      url: state.context.currentSrc,
      kind: state.context.mediaTag === "audio" ? "audio" : "video",
      frameId: state.context.frameId,
      documentId: state.context.documentId,
      pageUrl
    } : null
  ].filter(Boolean);
  const verifiedSuccessors = new Map();
  for (const candidate of candidates) {
    if (optionalBrowserFrameId(candidate.frameId) !== trustedFrameId ||
        browserMediaLineageKey(candidate, pageUrl) !== expectedLineageKey) {
      continue;
    }
    const candidateDocumentId = normalizeDocumentId(
      candidate.documentId ||
      (trustedFrameId === optionalBrowserFrameId(state.context?.frameId) ? state.context?.documentId : "") ||
      state.mediaDocumentId
    );
    if (!candidateDocumentId ||
        (trustedFrameId === originalFrameId && candidateDocumentId === originalDocumentId) ||
        !await browserFrameMatchesDocument(tabId, trustedFrameId, candidateDocumentId)) {
      continue;
    }
    verifiedSuccessors.set(`${trustedFrameId}:${candidateDocumentId}`, {
      frameId: trustedFrameId,
      documentId: candidateDocumentId
    });
  }
  return verifiedSuccessors.size === 1
    ? [...verifiedSuccessors.values()][0]
    : null;
}

async function browserFrameMatchesDocument(tabId, frameId, documentId) {
  if (typeof chrome.webNavigation?.getFrame !== "function") {
    return false;
  }
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId }).catch(() => null);
  return Boolean(frame && normalizeDocumentId(frame.documentId) === normalizeDocumentId(documentId));
}

async function sendMessageToSpecificMediaFrame(tabId, message, frameId, documentId = "") {
  const target = { frameId };
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (normalizedDocumentId) {
    target.documentId = normalizedDocumentId;
  }
  const response = await chrome.tabs.sendMessage(tabId, message, target).catch(() => null);
  if (response?.ok || response?.state) {
    const state = getState(tabId);
    state.mediaFrameId = frameId;
    state.mediaDocumentId = normalizedDocumentId || state.mediaDocumentId || "";
    if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
      state.subtitleFrameId = frameId;
    }
  }
  return response;
}

async function sendMessageToMediaFrame(tabId, message) {
  const state = getState(tabId);
  const frameIds = await getCandidateMediaFrameIds(tabId);
  let lastResponse = null;
  for (const frameId of frameIds) {
    const response = await chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null);
    if (response?.ok || response?.state) {
      state.mediaFrameId = frameId;
      if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
        state.subtitleFrameId = frameId;
      }
      return response;
    }
    if (message?.type === MESSAGE.ATTACH_VTT && response?.mediaBindingRejected) {
      const subtitleFrameId = Number(state.subtitleFrameId);
      const trustedMediaFrameId = Number(state.mediaFrameId);
      const hasTrustedSuccessor = Number.isInteger(subtitleFrameId)
        && subtitleFrameId === frameId
        && Number.isInteger(trustedMediaFrameId)
        && trustedMediaFrameId >= 0
        && trustedMediaFrameId !== frameId;
      if (hasTrustedSuccessor) {
        const successorResponse = await chrome.tabs.sendMessage(tabId, message, {
          frameId: trustedMediaFrameId
        }).catch(() => null);
        if (successorResponse?.ok || successorResponse?.state) {
          state.mediaFrameId = trustedMediaFrameId;
          if (successorResponse?.ok) {
            state.subtitleFrameId = trustedMediaFrameId;
          }
        }
        return successorResponse || response;
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
      state.subtitleFrameId = null;
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

async function reconcileMediaHeaderRulesAtStartup() {
  const offscreenUrl = chrome.runtime.getURL("src/offscreen/offscreen.html");
  let contexts;
  try {
    contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
  } catch {
    return reconcileMediaHeaderLeases({
      offscreenPresent: true,
      queryAuthoritative: false,
      activeLeases: []
    });
  }
  const offscreenPresent = Array.isArray(contexts) && contexts.length > 0;
  if (!offscreenPresent) {
    return reconcileMediaHeaderLeases({
      offscreenPresent: false,
      queryAuthoritative: true,
      activeLeases: []
    });
  }
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE.OFFSCREEN_GET_ACTIVE_MEDIA_HEADER_LEASES
    });
    const queryAuthoritative = Boolean(response?.ok && Array.isArray(response.leases));
    return reconcileMediaHeaderLeases({
      offscreenPresent: true,
      queryAuthoritative,
      activeLeases: queryAuthoritative ? response.leases : []
    });
  } catch {
    return reconcileMediaHeaderLeases({
      offscreenPresent: true,
      queryAuthoritative: false,
      activeLeases: []
    });
  }
}

function mediaHeaderRuleRecoveryNeedsRetry(result = {}) {
  return Boolean(
    result?.deferred ||
    result?.metadataPending ||
    (Array.isArray(result?.failedRuleIds) && result.failedRuleIds.length > 0)
  );
}

function scheduleMediaHeaderRuleRecoveryRetry() {
  const exponent = Math.max(0, mediaHeaderRuleRecoveryRetryAttempt - 1);
  const delayInMinutes = Math.min(
    MEDIA_HEADER_RULE_RECOVERY_MAX_MINUTES,
    MEDIA_HEADER_RULE_RECOVERY_BASE_MINUTES * (2 ** exponent)
  );
  try {
    const created = chrome.alarms?.create?.(MEDIA_HEADER_RULE_RECOVERY_ALARM, { delayInMinutes });
    return created?.catch?.(() => {}) || Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function clearMediaHeaderRuleRecoveryRetry() {
  try {
    const cleared = chrome.alarms?.clear?.(MEDIA_HEADER_RULE_RECOVERY_ALARM);
    return cleared?.catch?.(() => false) || Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }
}

function runMediaHeaderRuleRecovery(options = {}) {
  const force = options?.force === true;
  if (mediaHeaderRuleRecoveryPromise) {
    return mediaHeaderRuleRecoveryPromise;
  }
  if (!force && mediaHeaderRuleRecoveryLastResult &&
      !mediaHeaderRuleRecoveryNeedsRetry(mediaHeaderRuleRecoveryLastResult)) {
    return Promise.resolve(mediaHeaderRuleRecoveryLastResult);
  }

  let recovery;
  recovery = Promise.resolve()
    .then(() => reconcileMediaHeaderRulesAtStartup())
    .catch(() => ({
      deferred: true,
      failedRuleIds: [],
      metadataPending: false,
      reason: "reconcile-error"
    }))
    .then(async result => {
      mediaHeaderRuleRecoveryLastResult = result || {};
      if (mediaHeaderRuleRecoveryNeedsRetry(mediaHeaderRuleRecoveryLastResult)) {
        mediaHeaderRuleRecoveryRetryAttempt += 1;
        await scheduleMediaHeaderRuleRecoveryRetry();
      } else {
        mediaHeaderRuleRecoveryRetryAttempt = 0;
        await clearMediaHeaderRuleRecoveryRetry();
      }
      return mediaHeaderRuleRecoveryLastResult;
    })
    .finally(() => {
      if (mediaHeaderRuleRecoveryPromise === recovery) {
        mediaHeaderRuleRecoveryPromise = null;
      }
    });
  mediaHeaderRuleRecoveryPromise = recovery;
  return recovery;
}

async function ensureOffscreenDocument() {
  clearOffscreenIdleCloseAlarm();
  if (offscreenDocumentClosePromise) {
    await offscreenDocumentClosePromise.catch(() => null);
  }
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
  const incomingDocumentId = normalizeDocumentId(documentId);
  const isMainFrame = incomingFrameId === 0;
  const incomingArea = (context.elementWidth || context.videoWidth || 0) * (context.elementHeight || context.videoHeight || 0);
  const currentArea = (current.elementWidth || current.videoWidth || 0) * (current.elementHeight || current.videoHeight || 0);
  const shouldReplaceMedia = context.hasMedia && (!current.hasMedia || incomingArea >= currentArea);
  const shouldUpdateTime = context.hasMedia && (shouldReplaceMedia || state.mediaFrameId === incomingFrameId || current.frameId === incomingFrameId);
  if (shouldReplaceMedia) {
    state.mediaFrameId = incomingFrameId;
    state.mediaDocumentId = incomingDocumentId;
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
    documentId: shouldReplaceMedia ? incomingDocumentId : current.documentId || incomingDocumentId,
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
  const mediaDocumentId = normalizeDocumentId(documentId);
  if (media.source === "media-element") {
    const state = getState(tabId);
    state.mediaFrameId = mediaFrameId;
    state.mediaDocumentId = mediaDocumentId;
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
    documentId: mediaDocumentId,
    seenAt: Date.now()
  });
}

function normalizeFrameId(value) {
  const frameId = Number(value);
  return Number.isInteger(frameId) && frameId >= 0 ? frameId : 0;
}

function normalizeDocumentId(value) {
  return String(value || "").trim().slice(0, 500);
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
      mediaFrameId: null,
      mediaDocumentId: "",
      lastPreloadCandidate: null
    });
  }
  return tabState.get(tabId);
}
