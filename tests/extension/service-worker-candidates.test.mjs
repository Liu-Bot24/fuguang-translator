import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const webNavigationCommittedListeners = [];
const webNavigationHistoryListeners = [];
const addListener = () => {};
const chrome = {
  action: { onClicked: { addListener } },
  alarms: {
    onAlarm: { addListener },
    create: async () => {}
  },
  offscreen: { hasDocument: async () => false, createDocument: async () => {} },
  runtime: { getURL: value => `chrome-extension://test-extension/${value}`, getContexts: async () => [], onMessage: { addListener }, sendMessage: async () => ({}) },
  sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {},
      setAccessLevel: async () => {}
    },
    sync: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {}
    }
  },
  scripting: { executeScript: async () => [] },
  declarativeNetRequest: {
    updateSessionRules: async () => {}
  },
  tabs: {
    get: async () => ({ id: 1, title: "Test page", url: "https://example.test/watch/1" }),
    sendMessage: async () => null,
    onRemoved: { addListener }
  },
  webNavigation: {
    getAllFrames: async () => [],
    onCommitted: { addListener: listener => webNavigationCommittedListeners.push(listener) },
    onHistoryStateUpdated: { addListener: listener => webNavigationHistoryListeners.push(listener) },
    onTabReplaced: { addListener }
  },
  webRequest: {
    onBeforeRequest: { addListener },
    onBeforeSendHeaders: { addListener },
    onCompleted: { addListener },
    onHeadersReceived: { addListener },
    onErrorOccurred: { addListener },
    OnBeforeSendHeadersOptions: { EXTRA_HEADERS: "extraHeaders" }
  }
};

class FakeResponse {
  constructor(body = new ArrayBuffer(0), options = {}) {
    this.body = body instanceof Uint8Array
      ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
      : body;
    this.headers = options.headers || {};
  }

  async arrayBuffer() {
    return this.body;
  }
}

const fakeCaches = new Map();
const caches = {
  async open(name) {
    if (!fakeCaches.has(name)) {
      const entries = new Map();
      fakeCaches.set(name, {
        async put(key, response) {
          entries.set(String(key), response);
        },
        async match(key) {
          return entries.get(String(key));
        },
        async delete(key) {
          return entries.delete(String(key));
        },
        async keys() {
          return [...entries.keys()].map(url => ({ url }));
        }
      });
    }
    return fakeCaches.get(name);
  }
};

const context = vm.createContext({
  chrome,
  caches,
  console,
  URL,
  Date,
  Map,
  Set,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Promise,
  Response: FakeResponse,
  ArrayBuffer,
  Uint8Array,
  Blob,
  FormData,
  AbortController,
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "" }),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
});

const languageSource = fs.readFileSync(new URL("../../extension/src/background/browser-language.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserLanguage =", "var FuguangBrowserLanguage =");
const asrProviderSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-provider.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n\n', "")
  .replace("export const FuguangBrowserAsrProvider =", "var FuguangBrowserAsrProvider =");
const asrPostprocessSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-postprocess.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserAsrPostprocess =", "var FuguangBrowserAsrPostprocess =");
const mediaAssetModelSource = fs.readFileSync(new URL("../../extension/src/background/media-asset-model.js", import.meta.url), "utf8")
  .replace("export const FuguangMediaAssetModel =", "var FuguangMediaAssetModel =");
const hlsUrlHelpersSource = fs.readFileSync(new URL("../../extension/src/shared/hls-url-helpers.js", import.meta.url), "utf8")
  .replace("export const FuguangHlsUrlHelpers =", "var FuguangHlsUrlHelpers =");
const hlsManifestParserSource = fs.readFileSync(new URL("../../extension/src/background/hls-manifest-parser.js", import.meta.url), "utf8")
  .replace('import { FuguangHlsUrlHelpers } from "../shared/hls-url-helpers.js";\n\n', "")
  .replace("export const FuguangHlsManifestParser =", "var FuguangHlsManifestParser =");
const dashManifestParserSource = fs.readFileSync(new URL("../../extension/src/shared/dash-manifest-parser.js", import.meta.url), "utf8")
  .replace("export const FuguangDashManifestParser =", "var FuguangDashManifestParser =");
const bilibiliMediaAdapterSource = fs.readFileSync(new URL("../../extension/src/background/site-adapters/bilibili-media-adapter.js", import.meta.url), "utf8")
  .replace("export const FuguangBilibiliMediaAdapter =", "var FuguangBilibiliMediaAdapter =");
const xTwitterMediaAdapterSource = fs.readFileSync(new URL("../../extension/src/background/site-adapters/x-twitter-media-adapter.js", import.meta.url), "utf8")
  .replace("export const FuguangXTwitterMediaAdapter =", "var FuguangXTwitterMediaAdapter =");
const youtubeMediaAdapterSource = fs.readFileSync(new URL("../../extension/src/background/site-adapters/youtube-media-adapter.js", import.meta.url), "utf8")
  .replace("export const FuguangYoutubeMediaAdapter =", "var FuguangYoutubeMediaAdapter =");
const mediaSourceResolversSource = fs.readFileSync(new URL("../../extension/src/background/media-source-resolvers.js", import.meta.url), "utf8")
  .replace('import { FuguangMediaAssetModel } from "./media-asset-model.js";\n', "")
  .replace('import { FuguangHlsManifestParser } from "./hls-manifest-parser.js";\n', "")
  .replace('import { FuguangDashManifestParser } from "./dash-manifest-parser.js";\n', "")
  .replace('import { FuguangBilibiliMediaAdapter } from "./site-adapters/bilibili-media-adapter.js";\n', "")
  .replace('import { FuguangXTwitterMediaAdapter } from "./site-adapters/x-twitter-media-adapter.js";\n', "")
  .replace('import { FuguangYoutubeMediaAdapter } from "./site-adapters/youtube-media-adapter.js";\n\n', "")
  .replace("export const FuguangMediaSourceResolvers =", "var FuguangMediaSourceResolvers =");
const mediaCandidatesSource = fs.readFileSync(new URL("../../extension/src/background/browser-media-candidates.js", import.meta.url), "utf8")
  .replace('import { FuguangMediaAssetModel } from "./media-asset-model.js";\n\n', "")
  .replace('import { FuguangMediaAssetModel } from "./media-asset-model.js";\n', "")
  .replace('import { FuguangMediaSourceResolvers } from "./media-source-resolvers.js";\n\n', "")
  .replace('import { FuguangMediaSourceResolvers } from "./media-source-resolvers.js";\n', "")
  .replace("export const FuguangBrowserMediaCandidates =", "var FuguangBrowserMediaCandidates =");
const modelProfilesSource = fs.readFileSync(new URL("../../extension/src/background/browser-model-profiles.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n\n', "")
  .replace("export const FuguangBrowserModelProfiles =", "var FuguangBrowserModelProfiles =");
const funasrProviderSource = fs.readFileSync(new URL("../../extension/src/background/browser-funasr-provider.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserFunAsrProvider =", "var FuguangBrowserFunAsrProvider =");
const providerSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-provider.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n\n', "")
  .replace("export const FuguangBrowserTranslationProvider =", "var FuguangBrowserTranslationProvider =");
const pipelineSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-pipeline.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserTranslationProvider } from "./browser-translation-provider.js";\n\n', "")
  .replace("export const FuguangBrowserTranslationPipeline =", "var FuguangBrowserTranslationPipeline =");
const mediaHeaderRulesSource = fs.readFileSync(new URL("../../extension/src/background/media-header-rules.js", import.meta.url), "utf8")
  .replace("export const FuguangMediaHeaderRules =", "var FuguangMediaHeaderRules =");
const source = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n', "")
  .replace('import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";\n', "")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n', "")
  .replace('import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";\n', "")
  .replace('import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";\n', "")
  .replace('import { FuguangBrowserFunAsrProvider } from "./browser-funasr-provider.js";\n', "")
  .replace('import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";\n', "")
  .replace('import { FuguangMediaHeaderRules } from "./media-header-rules.js";\n\n', "");

vm.runInContext(languageSource, context, { filename: "browser-language.js" });
Object.assign(context, context.FuguangBrowserLanguage);
vm.runInContext(asrProviderSource, context, { filename: "browser-asr-provider.js" });
Object.assign(context, context.FuguangBrowserAsrProvider);
vm.runInContext(asrPostprocessSource, context, { filename: "browser-asr-postprocess.js" });
Object.assign(context, context.FuguangBrowserAsrPostprocess);
vm.runInContext(mediaAssetModelSource, context, { filename: "media-asset-model.js" });
Object.assign(context, context.FuguangMediaAssetModel);
vm.runInContext(hlsUrlHelpersSource, context, { filename: "hls-url-helpers.js" });
Object.assign(context, context.FuguangHlsUrlHelpers);
vm.runInContext(hlsManifestParserSource, context, { filename: "hls-manifest-parser.js" });
Object.assign(context, context.FuguangHlsManifestParser);
vm.runInContext(dashManifestParserSource, context, { filename: "dash-manifest-parser.js" });
Object.assign(context, context.FuguangDashManifestParser);
vm.runInContext(bilibiliMediaAdapterSource, context, { filename: "bilibili-media-adapter.js" });
Object.assign(context, context.FuguangBilibiliMediaAdapter);
vm.runInContext(xTwitterMediaAdapterSource, context, { filename: "x-twitter-media-adapter.js" });
Object.assign(context, context.FuguangXTwitterMediaAdapter);
vm.runInContext(youtubeMediaAdapterSource, context, { filename: "youtube-media-adapter.js" });
Object.assign(context, context.FuguangYoutubeMediaAdapter);
vm.runInContext(mediaSourceResolversSource, context, { filename: "media-source-resolvers.js" });
Object.assign(context, context.FuguangMediaSourceResolvers);
vm.runInContext(mediaCandidatesSource, context, { filename: "browser-media-candidates.js" });
Object.assign(context, context.FuguangBrowserMediaCandidates);
vm.runInContext(modelProfilesSource, context, { filename: "browser-model-profiles.js" });
Object.assign(context, context.FuguangBrowserModelProfiles);
vm.runInContext(funasrProviderSource, context, { filename: "browser-funasr-provider.js" });
Object.assign(context, context.FuguangBrowserFunAsrProvider);
vm.runInContext(providerSource, context, { filename: "browser-translation-provider.js" });
Object.assign(context, context.FuguangBrowserTranslationProvider);
vm.runInContext(pipelineSource, context, { filename: "browser-translation-pipeline.js" });
Object.assign(context, context.FuguangBrowserTranslationPipeline);
vm.runInContext(mediaHeaderRulesSource, context, { filename: "media-header-rules.js" });
vm.runInContext(source, context, { filename: "service-worker.js" });

{
  const originalRunBrowserPreloadJob = context.runBrowserPreloadJob;
  let queuedJobId = "";
  context.runBrowserPreloadJob = async jobId => {
    queuedJobId = jobId;
  };
  try {
    const response = await context.startBrowserPreload(
      1,
      {
        url: "https://media.example.test/video.mp4",
        kind: "video",
        ext: "mp4",
        duration: 3600
      },
      {
        title: "Fun-ASR workflow",
        pageUrl: "https://example.test/watch",
        sourceUrl: "https://media.example.test/video.mp4",
        duration: 3600
      },
      {
        asr: {
          providerType: "dashscope_funasr",
          baseUrl: "https://dashscope.aliyuncs.com/api/v1",
          model: "fun-asr",
          apiKey: "test"
        },
        translation: {
          providerType: "openai",
          baseUrl: "https://llm.example.test/v1",
          model: "llm",
          apiKey: "test"
        },
        targetLanguage: "zh-CN",
        asrWorkers: 8,
        workers: 3,
        chunkSeconds: 900
      }
    );
    assert.equal(response.job.pipeline, "funasr");
    assert.equal(response.job.extract.asrChunkSeconds, 7200);
    assert.equal(response.job.translation.asrWorkers, 1);
    assert.equal(response.job.translation.chunkStatuses.length, 0);
    assert.equal(queuedJobId, response.job.id);
  } finally {
    context.runBrowserPreloadJob = originalRunBrowserPreloadJob;
  }
}

{
  const originalRunBrowserPreloadJob = context.runBrowserPreloadJob;
  let queuedJobId = "";
  context.runBrowserPreloadJob = async jobId => {
    queuedJobId = jobId;
  };
  try {
    const sourcePlan = {
      kind: "hls-audio",
      primaryUrl: "https://cdn.example.test/audio-aac-128k.m3u8",
      primaryRole: "audio",
      ffmpegInput: {
        type: "hls",
        url: "https://cdn.example.test/audio-aac-128k.m3u8"
      }
    };
    const executionCandidate = context.resolveAudioSourceExecutionCandidate({
      url: "https://cdn.example.test/video-h264-720p.m3u8",
      kind: "hls",
      ext: "m3u8",
      role: "playlist",
      sourcePlanTrusted: true,
      sourcePlan
    });
    assert.equal(executionCandidate.url, "https://cdn.example.test/audio-aac-128k.m3u8");
    assert.equal(executionCandidate.originalSourceUrl, "https://cdn.example.test/video-h264-720p.m3u8");
    assert.equal(executionCandidate.sourcePlanUsed, true);

    const dashSourcePlan = {
      kind: "dash-audio",
      primaryUrl: "https://cdn.example.test/audio/",
      primaryRole: "audio",
      ffmpegInput: {
        type: "dash",
        url: "https://cdn.example.test/video.mpd",
        fragments: [
          { url: "https://cdn.example.test/audio/init.mp4", segmentType: "init", role: "audio" },
          { url: "https://cdn.example.test/audio/seg-1.m4s", segmentType: "media", role: "audio", duration: 5, start: 0, end: 5 }
        ]
      }
    };
    const dashCandidate = context.resolveAudioSourceExecutionCandidate({
      url: "https://cdn.example.test/video.mpd",
      kind: "dash",
      ext: "mpd",
      sourcePlanTrusted: true,
      sourcePlan: dashSourcePlan
    });
    assert.equal(dashCandidate.sourcePlanUsed, true);
    assert.equal(dashCandidate.url, "https://cdn.example.test/video.mpd");
    assert.equal(dashCandidate.kind, "dash");
    assert.equal(dashCandidate.dashFragments.length, 2);

    const dashResponse = await context.startBrowserPreload(
      1,
      {
        url: "https://cdn.example.test/video.mpd",
        kind: "dash",
        ext: "mpd",
        duration: 120,
        sourcePlanTrusted: true,
        sourcePlan: dashSourcePlan
      },
      {
        title: "DASH source plan start",
        pageUrl: "https://example.test/watch/dash-source-plan",
        sourceUrl: "https://cdn.example.test/video.mpd",
        duration: 120
      },
      {
        asr: {
          providerType: "openai",
          baseUrl: "https://asr.example.test/v1",
          model: "whisper",
          apiKey: "test"
        },
        translation: {
          providerType: "openai",
          baseUrl: "https://llm.example.test/v1",
          model: "llm",
          apiKey: "test"
        },
        targetLanguage: "zh-CN",
        asrWorkers: 1,
        workers: 1,
        chunkSeconds: 900
      }
    );
    assert.equal(dashResponse.job.sourceUrl, "https://cdn.example.test/video.mpd");
    assert.equal(dashResponse.job.metadata.executionSourceUrl, "https://cdn.example.test/video.mpd");
    assert.equal(queuedJobId, dashResponse.job.id);

    const response = await context.startBrowserPreload(
      1,
      {
        url: "https://cdn.example.test/video-h264-720p.m3u8",
        kind: "hls",
        ext: "m3u8",
        role: "playlist",
        duration: 120,
        sourcePlanTrusted: true,
        sourcePlan
      },
      {
        title: "Source plan start",
        pageUrl: "https://example.test/watch/source-plan",
        sourceUrl: "https://cdn.example.test/video-h264-720p.m3u8",
        duration: 120
      },
      {
        asr: {
          providerType: "openai",
          baseUrl: "https://asr.example.test/v1",
          model: "whisper",
          apiKey: "test"
        },
        translation: {
          providerType: "openai",
          baseUrl: "https://llm.example.test/v1",
          model: "llm",
          apiKey: "test"
        },
        targetLanguage: "zh-CN",
        asrWorkers: 1,
        workers: 1,
        chunkSeconds: 900
      }
    );
    assert.equal(response.job.sourceUrl, "https://cdn.example.test/audio-aac-128k.m3u8");
    assert.equal(response.job.originalSourceUrl, "https://cdn.example.test/video-h264-720p.m3u8");
    assert.equal(response.job.metadata.sourceUrl, "https://cdn.example.test/audio-aac-128k.m3u8");
    assert.equal(response.job.metadata.executionSourceUrl, "https://cdn.example.test/audio-aac-128k.m3u8");
    assert.equal(response.job.metadata.originalSourceUrl, "https://cdn.example.test/video-h264-720p.m3u8");
    assert.equal(queuedJobId, response.job.id);

    const directAudioExecutionCandidate = context.resolveAudioSourceExecutionCandidate({
      url: "https://video.twimg.com/amplify_video/2058970000000000053/pl/avc1/650x360/video-only.m3u8",
      kind: "hls",
      ext: "m3u8",
      role: "playlist",
      contentType: "application/vnd.apple.mpegurl",
      sourcePlanTrusted: true,
      sourcePlan: {
        kind: "direct-audio",
        primaryUrl: "https://video.twimg.com/amplify_video/2058970000000000053/audio/128000/audio-track.mp4",
        primaryRole: "audio",
        ffmpegInput: {
          type: "direct",
          url: "https://video.twimg.com/amplify_video/2058970000000000053/audio/128000/audio-track.mp4"
        }
      }
    });
    assert.equal(directAudioExecutionCandidate.url, "https://video.twimg.com/amplify_video/2058970000000000053/audio/128000/audio-track.mp4");
    assert.equal(directAudioExecutionCandidate.kind, "audio");
    assert.equal(directAudioExecutionCandidate.ext, "mp4");
    assert.equal(directAudioExecutionCandidate.contentType, "audio/mp4");

    const muxedExecutionCandidate = context.resolveAudioSourceExecutionCandidate({
      url: "https://cdn.example.test/source/video-playlist.m3u8",
      filename: "video-playlist.m3u8",
      fileName: "video-playlist.m3u8",
      kind: "hls",
      ext: "m3u8",
      role: "playlist",
      contentType: "application/vnd.apple.mpegurl",
      sourcePlanTrusted: true,
      sourcePlan: {
        kind: "muxed-media",
        primaryUrl: "https://cdn.example.test/media/clip.mp4",
        primaryRole: "muxed",
        ffmpegInput: {
          type: "direct",
          url: "https://cdn.example.test/media/clip.mp4"
        }
      }
    });
    assert.equal(muxedExecutionCandidate.url, "https://cdn.example.test/media/clip.mp4");
    assert.equal(muxedExecutionCandidate.filename, "clip.mp4");
    assert.equal(muxedExecutionCandidate.fileName, "clip.mp4");
    assert.equal(muxedExecutionCandidate.contentType, "video/mp4");
  } finally {
    context.runBrowserPreloadJob = originalRunBrowserPreloadJob;
  }
}

{
  assert.throws(
    () => context.resolveAudioSourceExecutionCandidate({
      url: "https://cdn.example.test/video-h264-720p.m3u8",
      kind: "hls",
      ext: "m3u8",
      role: "playlist",
      sourcePlan: {
        kind: "hls-audio",
        primaryUrl: "https://evil.example.test/audio.m3u8",
        primaryRole: "audio",
        ffmpegInput: { type: "hls", url: "https://evil.example.test/audio.m3u8" }
      }
    }),
    /后台校验/
  );

  const crossOrigin = context.resolveAudioSourceExecutionCandidate({
    url: "https://secure-cdn.example.test/video-h264-720p.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "playlist",
    sourcePlanTrusted: true,
    requestHeaders: { authorization: "Bearer source-token" },
    sourcePlan: {
      kind: "hls-audio",
      primaryUrl: "https://audio-cdn.example.test/audio-aac-128k.m3u8",
      primaryRole: "audio",
      ffmpegInput: { type: "hls", url: "https://audio-cdn.example.test/audio-aac-128k.m3u8" }
    }
  });
  assert.equal(crossOrigin.url, "https://audio-cdn.example.test/audio-aac-128k.m3u8");
  assert.equal(crossOrigin.requestHeaders, null);

  const mseCandidate = context.resolveAudioSourceExecutionCandidate({
    url: "https://cdn.example.test/dash/manifest.mpd",
    kind: "dash",
    ext: "mpd",
    sourcePlanTrusted: true,
    requestHeaders: { authorization: "Bearer source-token" },
    sourcePlan: {
      kind: "mse-fragments",
      executable: true,
      primaryRole: "audio",
      ffmpegInput: {
        type: "mse-fragments",
        url: "https://cdn.example.test/dash/seg-00001.m4s",
        fragments: [
          { url: "https://cdn.example.test/dash/init.mp4", segmentType: "init" },
          { url: "https://cdn.example.test/dash/seg-00001.m4s", segmentType: "media" },
          { url: "https://cdn.example.test/dash/seg-00002.m4s", segmentType: "media" }
        ]
      }
    }
  });
  assert.equal(mseCandidate.kind, "mse-fragments");
  assert.equal(mseCandidate.ext, "m4s");
  assert.equal(mseCandidate.sourcePlanUsed, true);
  assert.equal(mseCandidate.mseFragments.length, 3);
  assert.equal(mseCandidate.normalizeStrategy.type, "fmp4-fragments");
  assert.equal(mseCandidate.requestHeaders.authorization, "Bearer source-token");

  assert.throws(
    () => context.resolveAudioSourceExecutionCandidate({
      url: "https://cdn.example.test/dash/seg-00001.m4s",
      kind: "audio",
      ext: "m4s",
      sourcePlanTrusted: false,
      sourcePlan: {
        kind: "mse-fragments",
        executable: true,
        ffmpegInput: {
          type: "mse-fragments",
          url: "https://cdn.example.test/dash/seg-00001.m4s",
          fragments: [
            { url: "https://cdn.example.test/dash/init.mp4", segmentType: "init" },
            { url: "https://cdn.example.test/dash/seg-00001.m4s", segmentType: "media" }
          ]
        }
      }
    }),
    /后台校验/
  );
}

{
  const record = {
    tabId: 3060,
    pipeline: "funasr",
    metadata: { title: "Fun-ASR streaming", duration: 14400 },
    candidate: { url: "https://media.example.test/stream.m3u8", duration: 14400 },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      chunkSeconds: 1200,
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    browserAsrChunkSeconds: 7200,
    startedAt: Date.now(),
    cancelled: false,
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [],
    job: {
      id: "browser-funasr-streaming",
      pipeline: "funasr",
      status: "running",
      stage: "extracting",
      extract: {
        status: "running",
        progress: 50,
        duration: 14400,
        chunkSeconds: 1200,
        asrChunkSeconds: 7200,
        elapsedSeconds: 0
      },
      translation: {
        status: "queued",
        chunkStatuses: [],
        chunksTotal: 0,
        chunksDone: 0,
        chunksFailed: 0,
        sourceSegments: 0,
        translatedSegments: 0,
        segmentCount: 0,
        asrWorkers: 1,
        translationWorkers: 1,
        workers: 1
      }
    }
  };
  const originalExtract = context.extractCandidateAudioInBrowser;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  let extractRunning = false;
  let funAsrStartedDuringExtraction = false;
  let funAsrCalls = 0;
  let translationCalls = 0;
  context.extractCandidateAudioInBrowser = async current => {
    extractRunning = true;
    context.applyOffscreenWebFfmpegChunkReady({
      tabId: current.tabId,
      jobId: current.job.id,
      duration: 14400,
      internalChunksDone: 40,
      internalChunksTotal: 80,
      chunk: {
        logical: true,
        index: 0,
        start: 0,
        end: 7200,
        duration: 7200,
        file: { name: "funasr-stream-001.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) },
        bytes: 1
      }
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    extractRunning = false;
    context.applyOffscreenWebFfmpegChunkReady({
      tabId: current.tabId,
      jobId: current.job.id,
      duration: 14400,
      internalChunksDone: 80,
      internalChunksTotal: 80,
      chunk: {
        logical: true,
        index: 1,
        start: 7200,
        end: 14400,
        duration: 7200,
        file: { name: "funasr-stream-002.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) },
        bytes: 1
      }
    });
    return { chunks: current.audioChunks, duration: 14400, asrChunkSeconds: 7200 };
  };
  context.transcribeDashScopeFunAsrFile = async (_file, _config, options = {}) => {
    funAsrCalls += 1;
    if (extractRunning) {
      funAsrStartedDuringExtraction = true;
    }
    assert.equal(options.chunksTotal, 2);
    return { transcripts: [{ sentences: [{ begin_time: 1000, end_time: 2000, text: `source ${funAsrCalls}` }] }] };
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: `译文 ${translationCalls}` }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  context.recordForFunAsrStreamingTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-funasr-streaming', recordForFunAsrStreamingTest)", context);
  try {
    await context.runBrowserFunAsrPreloadJob("browser-funasr-streaming");

    assert.equal(funAsrStartedDuringExtraction, true);
    assert.equal(funAsrCalls, 2);
    assert.equal(translationCalls, 2);
    assert.equal(record.job.translation.chunksTotal, 2);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
    assert.equal(record.job.translation.chunkStatuses[1].stage, "completed");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-funasr-streaming')", context);
    delete context.recordForFunAsrStreamingTest;
    context.extractCandidateAudioInBrowser = originalExtract;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
    context.translateBrowserSegments = originalTranslate;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  const recovered = context.filterAsrStrictVadRecoverySegments([
    {
      start: 1721.06,
      end: 1723.06,
      text: "何の一つぐらい言う練習しとけよ",
      words: [
        { start: 1721.06, end: 1721.3, text: "何", probability: 0.32275390625 },
        { start: 1721.3, end: 1721.48, text: "の", probability: 0.96337890625 },
        { start: 1721.48, end: 1721.6, text: "一", probability: 0.794921875 },
        { start: 1721.6, end: 1721.8, text: "つ", probability: 0.99658203125 },
        { start: 1721.8, end: 1721.88, text: "ぐ", probability: 0.39990234375 },
        { start: 1721.88, end: 1722, text: "らい", probability: 0.95361328125 },
        { start: 1722, end: 1722.1, text: "言", probability: 0.95263671875 },
        { start: 1722.1, end: 1722.16, text: "う", probability: 0.98583984375 },
        { start: 1722.16, end: 1722.28, text: "練", probability: 0.9443359375 },
        { start: 1722.28, end: 1722.58, text: "習", probability: 1 },
        { start: 1722.58, end: 1722.64, text: "し", probability: 0.919921875 },
        { start: 1722.64, end: 1722.8, text: "と", probability: 0.9853515625 },
        { start: 1722.8, end: 1722.92, text: "け", probability: 0.99560546875 },
        { start: 1722.92, end: 1723.06, text: "よ", probability: 0.93701171875 }
      ],
      asrQuality: {
        compressionRatio: 0.8035714285714286,
        noSpeechProbability: 0.52490234375,
        avgLogProbability: -0.36534926470588236
      }
    },
    {
      start: 402.16,
      end: 403.12,
      text: "一つも言えないのが",
      words: [
        { start: 402.16, end: 402.26, text: "一", probability: 0.13916015625 },
        { start: 402.26, end: 402.48, text: "つ", probability: 0.98681640625 },
        { start: 402.48, end: 402.54, text: "も", probability: 0.88037109375 },
        { start: 402.54, end: 402.68, text: "言", probability: 0.96044921875 },
        { start: 402.68, end: 402.78, text: "え", probability: 0.99560546875 },
        { start: 402.78, end: 402.92, text: "ない", probability: 0.90625 },
        { start: 402.92, end: 403.04, text: "の", probability: 0.8837890625 },
        { start: 403.04, end: 403.12, text: "が", probability: 0.323486328125 }
      ],
      asrQuality: {
        compressionRatio: 0.8727272727272727,
        noSpeechProbability: 0.71240234375,
        avgLogProbability: -0.36075367647058826
      }
    },
    {
      start: 405.68,
      end: 406.84,
      text: "売り物なんだよ",
      words: [
        { start: 405.68, end: 406.2, text: "売", probability: 0.7354736328125 },
        { start: 406.2, end: 406.28, text: "り", probability: 0.8212890625 },
        { start: 406.28, end: 406.4, text: "物", probability: 0.94091796875 },
        { start: 406.4, end: 406.64, text: "なんだ", probability: 0.5703125 },
        { start: 406.64, end: 406.84, text: "よ", probability: 0.94873046875 }
      ],
      asrQuality: {
        compressionRatio: 0.8727272727272727,
        noSpeechProbability: 0.71240234375,
        avgLogProbability: -0.36075367647058826
      }
    },
    {
      start: 218.8,
      end: 219.66,
      text: "お聞きいただこう",
      words: [
        { start: 218.8, end: 218.94, text: "お", probability: 0.240234375 },
        { start: 218.94, end: 219.14, text: "聞き", probability: 0.65234375 },
        { start: 219.14, end: 219.32, text: "いただ", probability: 0.818359375 },
        { start: 219.32, end: 219.48, text: "こ", probability: 0.59765625 },
        { start: 219.48, end: 219.66, text: "う", probability: 0.9140625 }
      ],
      asrQuality: {
        compressionRatio: 0.7272727272727273,
        noSpeechProbability: 0.541015625,
        avgLogProbability: -0.5449218824505806
      }
    },
    {
      start: 1978.04,
      end: 1981.06,
      text: "や す み な さい",
      words: [
        { start: 1978.04, end: 1978.7, text: "や", probability: 0.2005615234375 },
        { start: 1978.7, end: 1978.76, text: "す", probability: 0.9345703125 },
        { start: 1978.76, end: 1980.58, text: "み", probability: 0.9990234375 },
        { start: 1980.58, end: 1980.86, text: "な", probability: 0.974609375 },
        { start: 1980.86, end: 1981.06, text: "さい", probability: 0.99658203125 }
      ],
      asrQuality: {
        compressionRatio: 0.7,
        noSpeechProbability: 0.6259765625,
        avgLogProbability: -0.5959201388888888
      }
    },
    {
      start: 1679.4,
      end: 1679.66,
      text: "さい",
      words: [{ start: 1679.4, end: 1679.66, text: "さい", probability: 0.998046875 }],
      asrQuality: {
        compressionRatio: 0.7,
        noSpeechProbability: 0.54150390625,
        avgLogProbability: -0.4791666666666667
      }
    }
  ]);
  assert.deepEqual(
    recovered.map(segment => segment.text),
    ["何の一つぐらい言う練習しとけよ", "一つも言えないのが", "売り物なんだよ"],
    "严格 VAD 补洞应保留有密集词级证据的边缘语音和短拆分片段，并过滤高 no-speech 的碎片化字串"
  );
}

{
  assert.equal(
    context.browserAsrUploadChunkSeconds({}),
    900,
    "默认 ASR 逻辑上传块应保持 15 分钟；成熟方案的 30 秒是 ASR 服务端 VAD/模型窗口，不是插件端强制碎片上传"
  );
  assert.equal(context.normalizeBrowserAsrUploadChunkSeconds(120), 120);
}

{
  assert.ok(webNavigationCommittedListeners.length > 0, "top-level committed listener should be registered");
  const tabId = 119;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "browser-committed-old";
  state.manualVttSignature = "manual:committed-old";
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 3 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationCommittedListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/committed-new" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  assert.ok(webNavigationHistoryListeners.length > 0, "history-state listener should be registered");
  const tabId = 113;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "browser-spa-old";
  state.manualVttSignature = "manual:old";
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 3 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/2" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 114;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "iframe-spa-old";
  state.manualVttSignature = "manual:iframe-old";
  const messages = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 3, url: "https://frame.example.test/watch/2" });

  assert.deepEqual(messages, [{ type: "FUGUANG_DETACH_PRELOAD_VTT", frameId: 3 }]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  assert.equal(context.getState(tabId).subtitleFrameId, null);
  assert.equal(context.getState(tabId).mediaFrameId, null);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 118;
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 2 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/fresh" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 115;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.attachedVttSignature = "iframe-spa-current";
  const messages = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 4, url: "https://other-frame.example.test/watch/2" });

  assert.deepEqual(messages, []);
  assert.equal(context.getState(tabId).attachedVttSignature, "iframe-spa-current");
  assert.equal(context.getState(tabId).subtitleFrameId, 3);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const segments = context.collectChunkSegments(new Map([
    [2, [{ start: 20, end: 21, text: "third" }]],
    [0, [{ start: 30, end: 31, text: "first" }]],
    [1, [{ start: 10, end: 11, text: "second" }]]
  ]));
  assert.equal(JSON.stringify(segments.map(segment => segment.text)), JSON.stringify(["first", "second", "third"]));
  assert.equal(JSON.stringify(segments.map(segment => segment.chunkIndex)), JSON.stringify([0, 1, 2]));
  assert.equal(JSON.stringify(segments.map(segment => segment.segmentIndex)), JSON.stringify([0, 0, 0]));
}

{
  const vtt = context.transcriptToBilingualVtt({
    source: [
      { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
      { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
    ],
    translated: [
      { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
    ]
  });
  assert.match(vtt, /00:00:00\.000 --> 00:00:02\.000\nsource first/);
  assert.match(vtt, /00:00:03\.000 --> 00:00:05\.000\nsource second\ntranslated second/);
  assert.doesNotMatch(vtt, /source first\ntranslated second/);
  const previewVtt = context.transcriptToBilingualVtt({
    source: [
      { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
      { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
    ],
    translated: [
      { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
    ]
  }, { allowSourcePreview: true });
  assert.match(previewVtt, /00:00:00\.000 --> 00:00:02\.000\nsource first/);
}

{
  const vtt = context.transcriptToBilingualVtt({
    source: [{ start: 0, end: 2, text: "source without identity" }],
    translated: [{ start: 0, end: 2, text: "translated without identity" }]
  });
  assert.match(vtt, /source without identity\ntranslated without identity/);
}

{
  assert.equal(context.targetLanguageName("zh-CN"), "Chinese");
  assert.equal(context.targetLanguageName("en"), "English");
  assert.equal(context.targetLanguageName("ja"), "Japanese");
  assert.equal(context.targetLanguageName("fr"), "French");
  assert.equal(context.targetLanguageName("ko"), "Korean");
  assert.equal(context.targetLanguageName("de"), "German");
  assert.equal(context.targetLanguageName("ru"), "Russian");
  assert.equal(context.normalizeTargetLanguage("japanese", "en"), "en");
  const messages = context.buildTranslationMessages(
    [{ start: 1, end: 2, text: "hello" }],
    "ja",
    { title: "T" }
  );
  assert.match(messages[0].content, /Japanese/);
  assert.match(messages[1].content, /"name":"Japanese"/);
}

{
  const asrProfiles = context.normalizeStoredProfiles("asr", [
    { id: "custom_vad", name: "自定义 VAD", providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", vadFilter: "on" },
    { id: "xai_grok", name: "xAI Grok", providerType: "openai", baseUrl: "https://api.x.ai/v1", model: "stale-xai-model", vadFilter: "on", apiKey: "xai-key" }
  ]);
  assert.equal(asrProfiles.find(profile => profile.id === "custom_vad")?.vadFilter, "on");
  assert.equal(asrProfiles.find(profile => profile.id === "xai_grok")?.providerType, "xai");
  assert.equal(asrProfiles.find(profile => profile.id === "xai_grok")?.model, "");
  assert.deepEqual(JSON.parse(JSON.stringify(context.profilesForStorage("asr", asrProfiles).find(profile => profile.id === "xai_grok"))), {
    id: "xai_grok",
    apiKey: "xai-key"
  });
  assert.equal(context.normalizeSelectedProfileId(asrProfiles, "missing_profile", "openai_whisper"), "openai_whisper");
  assert.equal(context.browserAsrEndpoint({ providerType: "xai", baseUrl: "https://api.x.ai/v1" }), "https://api.x.ai/v1/stt");
  assert.equal(context.browserAsrEndpoint({ providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1" }), "http://127.0.0.1:8000/v1/audio/transcriptions");
  assert.equal(context.normalizeAsrLanguage("auto"), "");
  assert.equal(context.normalizeAsrLanguage("zh"), "zh");
  assert.equal(context.normalizeAsrLanguage("zh-CN"), "zh");
  assert.equal(context.normalizeAsrLanguage("japanese"), "ja");
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "en")), JSON.stringify([["format", "true"], ["language", "en"]]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "zh")), JSON.stringify([]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "zh-CN")), JSON.stringify([]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "openai", model: "whisper-1" }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "zh-CN")), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1"
  }, "zh-CN")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1"
  }, "zh-CN", { supportedRequestFields: new Set(["vad_filter"]) })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1",
    vadFilter: "auto"
  }, "zh-CN", {
    supportedRequestFields: new Set(["vad_filter"]),
    clientSpeechIntervalsAvailable: true
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "zh-CN", {
    supportedRequestFields: new Set(["vad_filter"]),
    clientSpeechIntervalsAvailable: true
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "ja", {
    supportedRequestFields: new Set([
      "vad_filter",
      "threshold",
      "min_speech_duration_ms",
      "max_speech_duration_s",
      "min_silence_duration_ms",
      "speech_pad_ms",
      "condition_on_previous_text",
      "no_speech_threshold",
      "without_timestamps",
      "compression_ratio_threshold",
      "log_prob_threshold",
      "hallucination_silence_threshold",
      "word_timestamps"
    ])
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["threshold", "0.15"],
    ["min_speech_duration_ms", "0"],
    ["max_speech_duration_s", "30"],
    ["min_silence_duration_ms", "160"],
    ["speech_pad_ms", "800"],
    ["word_timestamps", "true"],
    ["condition_on_previous_text", "false"],
    ["without_timestamps", "false"],
    ["no_speech_threshold", "0.6"],
    ["compression_ratio_threshold", "2.4"],
    ["log_prob_threshold", "-1"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "ja", {
    supportedRequestFields: new Set([
      "vad_filter",
      "vad_parameters",
      "threshold",
      "min_speech_duration_ms",
      "max_speech_duration_s",
      "min_silence_duration_ms",
      "speech_pad_ms"
    ])
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["vad_parameters", "{\"threshold\":0.15,\"min_speech_duration_ms\":0,\"max_speech_duration_s\":30,\"min_silence_duration_ms\":160,\"speech_pad_ms\":800}"],
    ["language", "ja"]
  ]));
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 31, end: 33.2 },
      { start: 37, end: 39 }
    ], { start: 30, end: 60 }),
    "1,9"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 31, end: 32 },
      { start: 65, end: 66 }
    ], { start: 30, end: 90 }),
    "1,2,35,36"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 0, end: 29.8 },
      { start: 29.7, end: 40 }
    ], { start: 0, end: 60 }),
    "0,29,29.7,40"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 1, end: 35 }
    ], { start: 0, end: 60 }),
    "1,35"
  );
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_ms: 1000, end_ms: 1500 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1000, end: 1500 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1, end: 1.5 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1000, end: 1500 }
    ], { start: 900, end: 2700, duration: 1800 })
  ), JSON.stringify(
    [{ start: 901, end: 901.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 100, end: 170 }
    ], { start: 900, end: 2700, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1000, end: 1070 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_time: 10, end_time: 12 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 10, end: 12 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_time: 0, end_time: 1.25 },
      { end_time: 2.5 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 0, end: 1.25 }]
  ));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://clip-compatible.example/v1",
    model: "Systran/faster-whisper-large-v3",
    vadFilter: "auto"
  }, "ja", {
    supportedRequestFields: new Set(["clip_timestamps", "vad_filter", "vad_parameters"]),
    clipTimestamps: "1,9"
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["clip_timestamps", "1,9"],
    ["vad_filter", "false"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"]
  ]));
  assert.equal(
    context.browserAsrRequestFields({
      providerType: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "whisper-1"
    }, "").some(([name, value]) => name === "temperature" && value === "0"),
    true
  );
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "ja", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text", "no_speech_threshold"])
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://asr-compatible.example/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-large-v3-turbo"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    vadFilter: "on"
  }, "ja", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text", "no_speech_threshold"])
  })), JSON.stringify([
    ["model", "whisper-large-v3-turbo"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "xai",
    baseUrl: "https://api.x.ai/v1",
    vadFilter: "on"
  }, "en", { supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text"]) })), JSON.stringify([
    ["format", "true"],
    ["language", "en"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-3",
    vadFilter: "on"
  }, "en", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text"])
  })), JSON.stringify([
    ["model", "grok-3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "en"]
  ]));
  assert.doesNotThrow(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "xai", baseUrl: "https://api.x.ai/v1", apiKey: "test" }
  }));
  assert.throws(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "openai", baseUrl: "https://asr.test/v1", apiKey: "test" }
  }), /模型名称/);
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const originalLocalGet = chrome.storage.local.get;
  const originalLocalSet = chrome.storage.local.set;
  const originalSyncRemove = chrome.storage.sync.remove;
  const stored = {
    modelSettingsVersion,
    selectedAsrProfileId: "openai_whisper",
    selectedLlmProfileId: "test_llm",
    sourceLanguage: "japanese",
    targetLanguage: "zh-CN",
    webFfmpegPerformance: "fast",
    asrWorkers: 7,
    asrProfiles: [
      { id: "openai_whisper", name: "OpenAI Whisper", providerType: "openai", baseUrl: "https://api.openai.com/v1", model: "whisper-1", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.test/v1", model: "test-llm", apiKey: "llm-key" }
    ]
  };
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async () => {};
  chrome.storage.sync.remove = async () => {};
  try {
    const config = await context.getModelConfig();
    assert.equal(config.asr.language, "ja");
    assert.equal(config.asrWorkers, 1);
    assert.equal(config.webFfmpegPerformance, "fast");
    assert.ok(context.browserAsrRequestFields(config.asr, config.asr.language).some(([name, value]) => name === "language" && value === "ja"));

    stored.sourceLanguage = "auto";
    const autoConfig = await context.getModelConfig();
    assert.equal(Object.hasOwn(autoConfig.asr, "language"), false);
    assert.equal(context.browserAsrRequestFields(autoConfig.asr, autoConfig.asr.language).some(([name]) => name === "language"), false);

    stored.webFfmpegPerformance = "turbo";
    const invalidPerformanceConfig = await context.getModelConfig();
    assert.equal(invalidPerformanceConfig.webFfmpegPerformance, "auto");
  } finally {
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.local.set = originalLocalSet;
    chrome.storage.sync.remove = originalSyncRemove;
  }
}

{
  const originalEnsureOffscreenDocument = context.ensureOffscreenDocument;
  const originalGetWebFfmpegConfig = context.getWebFfmpegConfig;
  const originalWithMediaRequestHeaderRules = context.withMediaRequestHeaderRules;
  const originalSendMessage = chrome.runtime.sendMessage;
  let offscreenMessage = null;
  context.ensureOffscreenDocument = async () => {};
  context.getWebFfmpegConfig = async () => ({ url: "chrome-extension://test-extension/web-ffmpeg/index.html" });
  context.withMediaRequestHeaderRules = async (_url, _pageUrl, fn) => fn();
  chrome.runtime.sendMessage = async message => {
    offscreenMessage = message;
    return { ok: true, result: { chunks: [] } };
  };
  try {
    const result = await context.extractCandidateAudioInBrowser({
      tabId: 9,
      candidate: {
        url: "https://cdn.example.test/video.m3u8",
        kind: "hls",
        ext: "m3u8",
        duration: 120,
        pageUrl: "https://example.test/watch"
      },
      metadata: { duration: 120, pageUrl: "https://example.test/watch" },
      modelConfig: {
        chunkSeconds: 1200,
        webFfmpegPerformance: "stable"
      },
      browserAsrChunkSeconds: 30,
      job: { id: "job-web-ffmpeg-performance" }
    });
    assert.deepEqual(result, { chunks: [] });
    assert.equal(offscreenMessage?.webFfmpegPerformance, "stable");
    assert.equal(offscreenMessage?.chunkSeconds, 1200);
    assert.equal(offscreenMessage?.extractChunkSeconds, 1200);
    assert.equal(
      offscreenMessage?.asrChunkSeconds,
      30,
      "兼容短窗 ASR 只能缩短上传窗口，不能污染媒体抽取分组"
    );

    offscreenMessage = null;
    await context.extractCandidateAudioInBrowser({
      tabId: 9,
      candidate: {
        url: "https://cdn.example.test/video.mp4",
        kind: "video",
        ext: "mp4",
        duration: 120,
        pageUrl: "https://example.test/watch"
      },
      metadata: { duration: 120, pageUrl: "https://example.test/watch" },
      modelConfig: {
        chunkSeconds: 1200,
        webFfmpegPerformance: "stable"
      },
      browserAsrChunkSeconds: 1200,
      job: { id: "job-web-ffmpeg-direct" }
    });
    assert.equal(
      offscreenMessage?.asrChunkSeconds,
      1200,
      "已经由能力检测确认可用的普通 HTTPS 直连视频应保留长上传窗口"
    );

    offscreenMessage = null;
    await context.extractCandidateAudioInBrowser({
      tabId: 9,
      candidate: {
        url: "file:///Users/test/video.mp4",
        kind: "video",
        ext: "mp4",
        duration: 120,
        pageUrl: "file:///Users/test/video.mp4",
        localMediaFileKey: "local-video-key"
      },
      metadata: { duration: 120, pageUrl: "file:///Users/test/video.mp4" },
      modelConfig: {
        chunkSeconds: 1200,
        webFfmpegPerformance: "stable"
      },
      browserAsrChunkSeconds: 1200,
      job: { id: "job-web-ffmpeg-local" }
    });
    assert.equal(
      offscreenMessage?.asrChunkSeconds,
      1200,
      "已经由能力检测确认可用的本地视频应保留长上传窗口"
    );

    offscreenMessage = null;
    await context.extractCandidateAudioInBrowser({
      tabId: 9,
      candidate: {
        url: "https://cdn.example.test/video.m3u8",
        kind: "hls",
        ext: "m3u8",
        duration: 120,
        pageUrl: "https://example.test/watch"
      },
      metadata: { duration: 120, pageUrl: "https://example.test/watch" },
      modelConfig: {
        chunkSeconds: 1200,
        webFfmpegPerformance: "stable"
      },
      browserAsrChunkSeconds: 1200,
      pipeline: "funasr",
      job: { id: "job-web-ffmpeg-funasr", pipeline: "funasr" }
    });
    assert.equal(
      offscreenMessage?.asrChunkSeconds,
      1200,
      "Fun-ASR 长文件模式应保留长上传窗口"
    );
  } finally {
    context.ensureOffscreenDocument = originalEnsureOffscreenDocument;
    context.getWebFfmpegConfig = originalGetWebFfmpegConfig;
    context.withMediaRequestHeaderRules = originalWithMediaRequestHeaderRules;
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const originalLocalGet = chrome.storage.local.get;
  const originalLocalSet = chrome.storage.local.set;
  const originalSyncRemove = chrome.storage.sync.remove;
  let savedPayload = null;
  chrome.storage.local.get = async () => ({
    modelSettingsVersion,
    selectedAsrProfileId: "xai_grok",
    selectedLlmProfileId: "test_llm",
    sourceLanguage: "ja",
    targetLanguage: "zh-CN",
    asrProfiles: [
      {
        id: "xai_grok",
        name: "xAI Grok",
        providerType: "openai",
        baseUrl: "https://api.x.ai/v1",
        model: "stale-xai-model",
        vadFilter: "on",
        apiKey: "asr-key"
      }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.test/v1", model: "test-llm", apiKey: "llm-key" }
    ]
  });
  chrome.storage.local.set = async payload => {
    savedPayload = payload;
  };
  chrome.storage.sync.remove = async () => {};
  try {
    const config = await context.getModelConfig();
    assert.equal(config.asr.providerType, "xai");
    assert.equal(config.asr.baseUrl, "https://api.x.ai/v1");
    assert.equal(Object.hasOwn(config.asr, "model"), false);
    assert.deepEqual(JSON.parse(JSON.stringify(savedPayload.asrProfiles.find(profile => profile.id === "xai_grok"))), {
      id: "xai_grok",
      apiKey: "asr-key"
    });
  } finally {
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.local.set = originalLocalSet;
    chrome.storage.sync.remove = originalSyncRemove;
  }
}

{
  const relativeSegments = context.normalizeAsrSegments({
    segments: [{ start: 1.5, end: 4, text: "relative" }]
  }, 1800, 2700);
  assert.equal(relativeSegments[0].start, 1801.5);
  assert.equal(relativeSegments[0].end, 1804);

  const absoluteSegments = context.normalizeAsrSegments({
    segments: [{ start: 1801.5, end: 1804, text: "absolute" }]
  }, 1800, 2700);
  assert.equal(absoluteSegments[0].start, 1801.5);
  assert.equal(absoluteSegments[0].end, 1804);

  const ambiguousRelativeSegments = context.normalizeAsrSegments({
    segments: [{ start: 899.2, end: 901, text: "ambiguous relative tail" }]
  }, 898, 1800);
  assert.equal(ambiguousRelativeSegments[0].start, 1797.2);
  assert.equal(ambiguousRelativeSegments[0].end, 1799);

  const sortedSegments = context.normalizeAsrSegments({
    segments: [
      { start: 8, end: 9, text: "second" },
      { start: 3, end: 4, text: "first" }
    ]
  }, 900, 1200);
  assert.equal(JSON.stringify(sortedSegments.map(segment => segment.text)), JSON.stringify(["first", "second"]));

  const xaiWordSegments = context.normalizeAsrSegments({
    text: "Hello world",
    words: [
      { word: "Hello", start: 1, end: 1.4 },
      { word: "world", start: 1.5, end: 2.0 }
    ]
  }, 30, 60);
  assert.equal(xaiWordSegments.length, 1);
  assert.equal(xaiWordSegments[0].start, 31);
  assert.equal(xaiWordSegments[0].end, 32);
  assert.equal(xaiWordSegments[0].text, "Hello world");

  const xaiNestedWordSegments = context.normalizeAsrSegments({
    result: {
      words: [
        { text: "你", start_time: 0.0, end_time: 0.2 },
        { text: "好", start_time: 0.2, end_time: 0.5 }
      ]
    }
  }, 120, 150);
  assert.equal(xaiNestedWordSegments.length, 1);
  assert.equal(xaiNestedWordSegments[0].start, 120);
  assert.equal(xaiNestedWordSegments[0].end, 120.5);
  assert.equal(xaiNestedWordSegments[0].text, "你好");

  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [{ start: 0, end: 1, text: "segment-only" }]
    })
  });
  try {
    await assert.rejects(
      () => context.transcribeBrowserAudioChunk(
        {
          index: 0,
          start: 30,
          end: 60,
          file: { name: "xai.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
        },
        { providerType: "xai", baseUrl: "https://api.x.ai/v1", apiKey: "test", timeoutMs: 1000 }
      ),
      /xAI.*word.*时间戳|word.*时间戳.*xAI/
    );
  } finally {
    context.fetch = originalFetch;
  }

  const nestedWordBoundaries = context.normalizeAsrSegments({
    segments: [{
      start: 43.159,
      end: 46.439,
      text: "何意味",
      words: [
        { word: "何", start: 45.0, end: 45.4 },
        { word: "意味", start: 45.4, end: 46.1 }
      ]
    }]
  }, 0, 60);
  assert.equal(nestedWordBoundaries.length, 1);
  assert.equal(nestedWordBoundaries[0].start, 45.0);
  assert.equal(nestedWordBoundaries[0].end, 46.1);
  assert.equal(nestedWordBoundaries[0].text, "何意味");

  const topLevelWordBoundaries = context.normalizeAsrSegments({
    segments: [{
      start: 43.159,
      end: 46.439,
      text: "何意味"
    }],
    words: [
      { word: "何", start: 45.0, end: 45.4 },
      { word: "意味", start: 45.4, end: 46.1 }
    ]
  }, 0, 60);
  assert.equal(topLevelWordBoundaries.length, 1);
  assert.equal(topLevelWordBoundaries[0].start, 45.0);
  assert.equal(topLevelWordBoundaries[0].end, 46.1);
  assert.equal(topLevelWordBoundaries[0].text, "何意味");

  const longWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 307.55,
      text: "気持ちいい",
      words: [
        { word: "気", start: 0.00, end: 0.38 },
        { word: "持", start: 307.13, end: 307.33 },
        { word: "ち", start: 307.33, end: 307.49 },
        { word: "いい", start: 307.49, end: 307.55 }
      ]
    }]
  }, 2700, 3600);
  assert.equal(longWordGapSegments.length, 1);
  assert.equal(longWordGapSegments[0].text, "気持ちいい");
  assert.equal(longWordGapSegments[0].start, 3007.13);
  assert.equal(longWordGapSegments[0].end, 3007.55);

  const splitWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 307.55,
      text: "気持ちいい",
      words: [
        { word: "気", start: 0.00, end: 0.42 },
        { word: "持", start: 0.42, end: 1.30 },
        { word: "ち", start: 307.13, end: 307.33 },
        { word: "いい", start: 307.33, end: 307.55 }
      ]
    }]
  }, 2700, 3600);
  assert.equal(splitWordGapSegments.length, 1);
  assert.equal(splitWordGapSegments[0].text, "気持ちいい");
  assert.equal(splitWordGapSegments[0].start, 3007.13);
  assert.equal(splitWordGapSegments[0].end, 3007.55);

  const meaningfulLongWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 75,
      text: "もう 待って",
      words: [
        { word: "もう", start: 0.00, end: 0.40 },
        { word: "待って", start: 72.20, end: 73.00 }
      ]
    }]
  }, 0, 60);
  assert.equal(JSON.stringify(meaningfulLongWordGapSegments.map(segment => segment.text)), JSON.stringify(["もう", "待って"]));
  assert.equal(meaningfulLongWordGapSegments[0].start, 0.00);
  assert.equal(meaningfulLongWordGapSegments[1].start, 72.20);

  const naturalWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 2.95,
      text: "少し待って",
      words: [
        { word: "少し", start: 0.00, end: 0.40 },
        { word: "待って", start: 2.20, end: 2.95 }
      ]
    }]
  }, 0, 60);
  assert.equal(naturalWordGapSegments.length, 1);
  assert.equal(naturalWordGapSegments[0].text, "少し待って");

  const mediumWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 7.3,
      text: "少し待って",
      words: [
        { word: "少し", start: 0.00, end: 0.40 },
        { word: "待って", start: 6.50, end: 7.30 }
      ]
    }]
  }, 0, 60);
  assert.equal(mediumWordGapSegments.length, 1);
  assert.equal(mediumWordGapSegments[0].text, "少し待って");

  const shortSegmentWithLargeWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 6.77,
      end: 26.15,
      text: "これしかないです。いません。",
      words: [
        { word: "これ", start: 6.77, end: 7.15 },
        { word: "しか", start: 7.15, end: 7.33 },
        { word: "ない", start: 7.33, end: 7.57 },
        { word: "です。", start: 7.57, end: 7.87 },
        { word: "い", start: 8.01, end: 8.35 },
        { word: "ません。", start: 25.84, end: 26.15 }
      ]
    }]
  }, 0, 30);
  assert.equal(JSON.stringify(shortSegmentWithLargeWordGapSegments.map(segment => segment.text)), JSON.stringify(["これ しか ない です。 い", "ません。"]));
  assert.equal(shortSegmentWithLargeWordGapSegments[0].start, 6.77);
  assert.equal(shortSegmentWithLargeWordGapSegments[0].end, 8.35);
  assert.equal(shortSegmentWithLargeWordGapSegments[1].start, 25.84);
  assert.equal(shortSegmentWithLargeWordGapSegments[1].end, 26.15);

  const matureShortWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 36,
      text: "嗯开始结束",
      words: [
        { word: "嗯", start: 0.00, end: 0.30 },
        { word: "开始", start: 12.00, end: 12.50 },
        { word: "结束", start: 34.00, end: 35.00 }
      ]
    }]
  }, 0, 60, { disableCustomRunFilters: true, disableCustomQualityFilters: true });
  assert.equal(JSON.stringify(matureShortWordGapSegments.map(segment => segment.text)), JSON.stringify(["嗯", "开始", "结束"]));
  assert.equal(matureShortWordGapSegments[0].start, 0.00);
  assert.equal(matureShortWordGapSegments[1].start, 12.00);
  assert.equal(matureShortWordGapSegments[2].start, 34.00);

  const noSpeechProbabilityAloneSegments = context.normalizeAsrSegments({
    segments: [{
      start: 11.76,
      end: 12.2,
      text: "measured boundary utterance",
      no_speech_prob: 0.66,
      avg_logprob: -0.98
    }]
  }, 334, 362, { disableCustomQualityFilters: true });
  assert.equal(noSpeechProbabilityAloneSegments.length, 1);
  assert.equal(noSpeechProbabilityAloneSegments[0].text, "measured boundary utterance");
  assert.equal(
    context.normalizeAsrSegments({
      segments: [{
        start: 0,
        end: 1.2,
        text: "short real phrase",
        no_speech_prob: 0.2,
        words: [
          { word: "short", start: 0, end: 0.7, probability: 0.9 },
          { word: "phrase", start: 0.7, end: 1.2, probability: 0.9 }
        ]
      }]
    }, 0, 30, { disableCustomQualityFilters: true })[0].text,
    "short real phrase"
  );

  assert.throws(() => context.normalizeAsrSegments({
    words: [{ word: "hello without timestamp" }]
  }, 0, 30), /时间戳/);
  assert.throws(() => context.normalizeAsrSegments({
    text: "text only without timestamp"
  }, 0, 30), /时间戳/);

  const ownedBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.2, end: 30.2, text: "跨界句" },
    { start: 30.5, end: 31.2, text: "核心句" },
    { start: 60.1, end: 61.2, text: "下一段" }
  ], { start: 28, end: 62, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(ownedBoundarySegments.map(segment => segment.text), ["跨界句", "核心句", "下一段"]);
  assert.equal(ownedBoundarySegments[0].start, 28.2);
  assert.equal(ownedBoundarySegments[0].end, 30.2);

  const previousBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.2, end: 30.2, text: "跨界句" },
    { start: 29.2, end: 29.8, text: "上一段" },
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 0, end: 32, coreStart: 0, coreEnd: 30 });
  assert.deepEqual(previousBoundarySegments.map(segment => segment.text), ["跨界句", "上一段", "正中边界句"]);
  assert.equal(previousBoundarySegments[0].end, 30.2);

  const nextBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 22, end: 68, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(nextBoundarySegments.map(segment => segment.text), ["正中边界句"]);
  assert.equal(nextBoundarySegments[0].start, 29.6);

  const longBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 58.4, end: 61.4, text: "长句跨右边界" }
  ], { start: 52, end: 68, coreStart: 30, coreEnd: 60 });
  assert.equal(JSON.stringify(longBoundarySegments), JSON.stringify([{ start: 58.4, end: 61.4, text: "长句跨右边界" }]));

  const driftedBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.7, end: 29.7, text: "左侧漂移真实句" },
    { start: 60.2, end: 61.1, text: "右侧漂移真实句" },
    { start: 62.4, end: 63.1, text: "远端越界幻觉" },
    { start: 0, end: 300, text: "异常长越界幻觉" }
  ], { start: 28, end: 62, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(driftedBoundarySegments.map(segment => segment.text), ["左侧漂移真实句", "右侧漂移真实句"]);

  const noOverlapBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 0.2, end: 1.6, text: "核心短句" },
    { start: 60, end: 61, text: "无重叠越界幻觉" }
  ], { start: 0, end: 2, coreStart: 0, coreEnd: 2 });
  assert.deepEqual(noOverlapBoundarySegments.map(segment => segment.text), ["核心短句"]);

  const mergedOverlapDuplicates = context.mergeAdjacentDuplicateAsrSegments([
    { start: 29.6, end: 30.4, text: "边界重复句" },
    { start: 29.7, end: 30.5, text: "边界重复句" }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(mergedOverlapDuplicates)), [
    { start: 29.6, end: 30.5, text: "边界重复句" }
  ]);

  assert.equal(context.filterAsrSegmentsBySpeechActivity([
    { start: 0, end: 29.98, text: "generic nonspeech caption" }
  ], { speechIntervals: [] }).length, 0);
  assert.deepEqual(
    context.filterAsrSegmentsBySpeechActivity([
      { start: 9.54, end: 11.3, text: "第一段测试语音" },
      { start: 11.3, end: 14.4, text: "西瓜摊位在早上9点开门" },
      { start: 14.4, end: 16.54, text: "请不要重复这句话" },
      { start: 43.58, end: 44.98, text: "西瓜摊位在早上9点开门" }
    ], { speechIntervals: [{ start: 10.004625, end: 16.676875 }] }).map(segment => segment.text),
    ["第一段测试语音", "西瓜摊位在早上9点开门", "请不要重复这句话"]
  );
  assert.equal(
    context.filterAsrSegmentsBySpeechActivity([{ start: 0, end: 2, text: "未知语音区间保留" }], {}).length,
    1
  );
  assert.deepEqual(
    context.filterAsrSegmentsBySpeechActivity(
      [{ start: 0, end: 2, text: "弱 VAD 判空但 ASR 识别到的语音" }],
      { speechIntervals: [], speechIntervalsReliable: false }
    ).map(segment => segment.text),
    ["弱 VAD 判空但 ASR 识别到的语音"]
  );
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard(
      [{
        start: 20,
        end: 27,
        text: "alpha beta alpha beta",
        words: [
          { text: "alpha", start: 20, end: 22.8, probability: 0.08 },
          { text: "beta", start: 22.8, end: 25.4, probability: 0.09 }
        ]
      }],
      { speechIntervals: [{ start: 0, end: 1 }, { start: 50, end: 51 }] }
    )
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard(
      [{ start: 0, end: 1.2, text: "short real phrase" }],
      { speechIntervals: [{ start: 0.05, end: 1.15 }] }
    ).map(segment => segment.text)
  ), JSON.stringify(["short real phrase"]));
  assert.equal(JSON.stringify(
    context.filterAsrSuspiciousRepeatedRuns([
      { start: 0, end: 1.3, text: "repeated ordinary phrase" },
      { start: 1.6, end: 2.9, text: "repeated ordinary phrase" }
    ]).map(segment => segment.text)
  ), JSON.stringify(["repeated ordinary phrase", "repeated ordinary phrase"]));
  assert.equal(JSON.stringify(
    context.filterAsrSuspiciousRepeatedRuns([
      { start: 0, end: 1.1, text: "normal utterance" },
      { start: 1.3, end: 2.4, text: "normal utterance" }
    ]).map(segment => segment.text)
  ), JSON.stringify(["normal utterance", "normal utterance"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 0.6, text: "hm" },
      { start: 1.1, end: 1.7, text: "hm" },
      { start: 2.2, end: 2.8, text: "hm" },
      { start: 4.0, end: 5.2, text: "hm hm" },
      { start: 7.0, end: 8.8, text: "hm" },
      { start: 12.0, end: 14.5, text: "hm" }
    ], { speechIntervals: [{ start: 0, end: 15 }] }).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 0.6, text: "no" },
      { start: 1.1, end: 1.7, text: "no" },
      { start: 2.2, end: 2.8, text: "no" },
      { start: 4.0, end: 5.2, text: "no" },
      { start: 7.0, end: 8.8, text: "no" },
      { start: 12.0, end: 14.5, text: "no" }
    ], { speechIntervals: [{ start: 0, end: 15 }] }).map(segment => segment.text)
  ), JSON.stringify(["no", "no", "no", "no", "no", "no"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 1, text: "、" },
      { start: 1, end: 2, text: "、" },
      { start: 2, end: 3, text: "、" },
      { start: 3, end: 4, text: "、" }
    ], { speechIntervals: [{ start: 0, end: 4 }] }).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 1, text: "待って" },
      { start: 1.1, end: 1.6, text: "うん" },
      { start: 1.8, end: 2.8, text: "行くよ" }
    ], { speechIntervals: [{ start: 0, end: 3 }] }).map(segment => segment.text)
  ), JSON.stringify(["待って", "うん", "行くよ"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 100, end: 101.6, text: "早送り" },
      { start: 102, end: 103.6, text: "早送り" },
      { start: 104, end: 105.6, text: "早送り" },
      { start: 106, end: 107.6, text: "早送り" }
    ], {}).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      {
        start: 400,
        end: 429.8,
        text: "stretched repeated phrase",
        words: [
          { text: "stretched", start: 400, end: 400.4, probability: 0.05 },
          { text: "repeated", start: 400.4, end: 423.2, probability: 0.14 },
          { text: "phrase", start: 423.2, end: 429.8, probability: 0.92 }
        ],
        rawSegment: { no_speech_prob: 0.72, avg_logprob: -0.45 }
      }
    ], { speechIntervals: [], speechIntervalsReliable: false }).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      {
        start: 400,
        end: 402.2,
        text: "quiet but real phrase",
        words: [
          { text: "quiet", start: 400, end: 400.6, probability: 0.82 },
          { text: "but", start: 400.7, end: 401.0, probability: 0.76 },
          { text: "real", start: 401.1, end: 401.6, probability: 0.85 },
          { text: "phrase", start: 401.65, end: 402.2, probability: 0.8 }
        ],
        rawSegment: { no_speech_prob: 0.64, avg_logprob: -0.45 }
      }
    ], { speechIntervals: [], speechIntervalsReliable: false }).map(segment => segment.text)
  ), JSON.stringify(["quiet but real phrase"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      {
        start: 700,
        end: 701.2,
        text: "generic closing sentence",
        words: [
          { text: "generic", start: 700, end: 700.7, probability: 0.02 },
          { text: "closing", start: 700.7, end: 701.2, probability: 0.74 }
        ]
      },
      {
        start: 710,
        end: 711.2,
        text: "plausible short reply",
        words: [
          { text: "plausible", start: 710, end: 710.45, probability: 0.72 },
          { text: "short", start: 710.5, end: 710.8, probability: 0.82 },
          { text: "reply", start: 710.82, end: 711.2, probability: 0.79 }
        ]
      }
    ], { speechIntervals: [] }).map(segment => segment.text)
  ), JSON.stringify(["plausible short reply"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      {
        start: 900,
        end: 904.2,
        text: "outside weak evidence",
        words: [
          { text: "outside", start: 900, end: 901.4, probability: 0.06 },
          { text: "weak", start: 901.4, end: 902.8, probability: 0.16 },
          { text: "evidence", start: 902.8, end: 904.2, probability: 0.88 }
        ]
      },
      {
        start: 920,
        end: 921.2,
        text: "inside strong evidence",
        words: [
          { text: "inside", start: 920, end: 920.4, probability: 0.72 },
          { text: "strong", start: 920.45, end: 920.82, probability: 0.84 },
          { text: "evidence", start: 920.84, end: 921.2, probability: 0.8 }
        ]
      }
    ], { speechIntervals: [{ start: 919.8, end: 921.4 }] }).map(segment => segment.text)
  ), JSON.stringify(["inside strong evidence"]));
  assert.equal(JSON.stringify(
    context.filterAsrDistributedRepeatedRuns([
      { start: 0, end: 1.4, text: "ordinary phrase" },
      { start: 10, end: 11.4, text: "ordinary phrase" },
      {
        start: 100,
        end: 129,
        text: "distributed hallucination",
        words: [
          { text: "distributed", start: 100, end: 100.4, probability: 0.05 },
          { text: "hallucination", start: 100.4, end: 129, probability: 0.9 }
        ],
        rawSegment: { no_speech_prob: 0.7 }
      },
      {
        start: 200,
        end: 229,
        text: "distributed hallucination",
        words: [
          { text: "distributed", start: 200, end: 200.4, probability: 0.05 },
          { text: "hallucination", start: 200.4, end: 229, probability: 0.9 }
        ],
        rawSegment: { no_speech_prob: 0.7 }
      },
      { start: 300, end: 301, text: "distributed hallucination", rawSegment: { no_speech_prob: 0.7 } },
      {
        start: 400,
        end: 429,
        text: "distributed hallucination",
        words: [
          { text: "distributed", start: 400, end: 400.4, probability: 0.05 },
          { text: "hallucination", start: 400.4, end: 429, probability: 0.9 }
        ],
        rawSegment: { no_speech_prob: 0.7 }
      }
    ]).map(segment => segment.text)
  ), JSON.stringify(["ordinary phrase", "ordinary phrase"]));
  assert.equal(JSON.stringify(
    context.filterAsrDistributedRepeatedRuns([
      {
        start: 0,
        end: 2,
        text: "weak repeated phrase",
        words: [
          { text: "weak", start: 0, end: 0.5, probability: 0.05 },
          { text: "repeated", start: 0.5, end: 1, probability: 0.92 }
        ]
      },
      {
        start: 180,
        end: 182,
        text: "weak repeated phrase",
        words: [
          { text: "weak", start: 180, end: 180.5, probability: 0.04 },
          { text: "repeated", start: 180.5, end: 181, probability: 0.91 }
        ]
      },
      {
        start: 0,
        end: 1.1,
        text: "strong repeated phrase",
        words: [
          { text: "strong", start: 0, end: 0.4, probability: 0.82 },
          { text: "repeated", start: 0.45, end: 0.8, probability: 0.8 },
          { text: "phrase", start: 0.82, end: 1.1, probability: 0.78 }
        ]
      },
      {
        start: 180,
        end: 181.1,
        text: "strong repeated phrase",
        words: [
          { text: "strong", start: 180, end: 180.4, probability: 0.84 },
          { text: "repeated", start: 180.45, end: 180.8, probability: 0.81 },
          { text: "phrase", start: 180.82, end: 181.1, probability: 0.79 }
        ]
      }
    ]).map(segment => segment.text)
  ), JSON.stringify(["strong repeated phrase", "strong repeated phrase"]));
  assert.equal(
    context.filterAsrDistributedRepeatedRuns([
      {
        start: 0,
        end: 2,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 0, end: 0.4, probability: 0.04 },
          { text: "repeated", start: 0.4, end: 1.2, probability: 0.82 },
          { text: "phrase", start: 1.2, end: 2, probability: 0.85 }
        ]
      },
      {
        start: 130,
        end: 131.2,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 130, end: 130.3, probability: 0.82 },
          { text: "repeated", start: 130.35, end: 130.8, probability: 0.76 },
          { text: "phrase", start: 130.82, end: 131.2, probability: 0.8 }
        ]
      },
      {
        start: 260,
        end: 261.2,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 260, end: 260.3, probability: 0.84 },
          { text: "repeated", start: 260.35, end: 260.8, probability: 0.78 },
          { text: "phrase", start: 260.82, end: 261.2, probability: 0.82 }
        ]
      },
      {
        start: 390,
        end: 391.2,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 390, end: 390.3, probability: 0.8 },
          { text: "repeated", start: 390.35, end: 390.8, probability: 0.78 },
          { text: "phrase", start: 390.82, end: 391.2, probability: 0.82 }
        ]
      },
      {
        start: 650,
        end: 652,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 650, end: 650.35, probability: 0.03 },
          { text: "repeated", start: 650.35, end: 651.1, probability: 0.84 },
          { text: "phrase", start: 651.1, end: 652, probability: 0.86 }
        ]
      },
      {
        start: 960,
        end: 961.2,
        text: "medium repeated phrase",
        words: [
          { text: "medium", start: 960, end: 960.3, probability: 0.82 },
          { text: "repeated", start: 960.35, end: 960.8, probability: 0.79 },
          { text: "phrase", start: 960.82, end: 961.2, probability: 0.8 }
        ]
      }
    ]).length,
    0
  );
  assert.equal(
    context.filterAsrDistributedRepeatedRuns(Array.from({ length: 8 }, (_, index) => ({
      start: index * 70,
      end: index * 70 + 1,
      text: "high count repeated phrase"
    }))).length,
    0
  );
  assert.equal(
    context.filterAsrDistributedRepeatedRuns(Array.from({ length: 8 }, (_, index) => ({
      start: index * 2,
      end: index * 2 + 1,
      text: "local repeated phrase"
    }))).length,
    8
  );
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 100, end: 101.2, text: "早送り" },
      { start: 102, end: 103.2, text: "早送り" },
      { start: 104, end: 105.2, text: "次へ" }
    ], {}).map(segment => segment.text)
  ), JSON.stringify(["早送り", "早送り", "次へ"]));
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [] }), true);
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [], speechIntervalsReliable: false }), false);
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [{ start: 10, end: 16.7 }] }), false);
  assert.equal(context.shouldSkipBrowserAsrChunk({}), false);

  const speechSuppressed = context.filterAsrSegmentsBySpeechActivity([
    {
      start: 10,
      end: 20,
      text: "noise real",
      words: [
        { text: "noise", start: 10, end: 13, probability: 0.2 },
        { text: "real", start: 15, end: 16, probability: 0.9 }
      ]
    }
  ], { speechIntervals: [{ start: 14.8, end: 16.2 }] });
  assert.equal(speechSuppressed.length, 1);
  assert.equal(speechSuppressed[0].start, 15);
  assert.equal(speechSuppressed[0].end, 16);
  assert.equal(speechSuppressed[0].text, "real");

  const shortJapaneseWordPreserved = context.filterAsrSegmentsBySpeechActivity([
    {
      start: 285.86,
      end: 286.58,
      text: "面白いよ",
      words: [
        { text: "面", start: 285.86, end: 286.08, probability: 0.53 },
        { text: "白", start: 286.08, end: 286.28, probability: 1 },
        { text: "い", start: 286.28, end: 286.34, probability: 0.66 },
        { text: "よ", start: 286.34, end: 286.58, probability: 0.33 }
      ]
    }
  ], { speechIntervals: [{ start: 285.856, end: 287.2 }] });
  assert.equal(shortJapaneseWordPreserved.length, 1);
  assert.equal(shortJapaneseWordPreserved[0].text, "面白いよ");

  const restoredVadIslandSegments = context.filterAsrSegmentsBySpeechActivity([
    {
      start: 6.77,
      end: 26.15,
      text: "これしかないです。いません。",
      words: [
        { text: "これ", start: 6.77, end: 7.15, probability: 0.55 },
        { text: "しか", start: 7.15, end: 7.33, probability: 0.97 },
        { text: "ない", start: 7.33, end: 7.57, probability: 0.94 },
        { text: "です。", start: 7.57, end: 7.87, probability: 0.76 },
        { text: "い", start: 8.01, end: 8.35, probability: 0.35 },
        { text: "ません。", start: 25.84, end: 26.15, probability: 0.89 }
      ]
    }
  ], {
    speechIntervals: [
      { start: 6.768, end: 8.4 },
      { start: 25.84, end: 26.704 }
    ]
  });
  assert.equal(JSON.stringify(restoredVadIslandSegments.map(segment => segment.text)), JSON.stringify(["これ しか ない です。 い", "ません。"]));
  assert.equal(restoredVadIslandSegments[0].start, 6.77);
  assert.equal(restoredVadIslandSegments[0].end, 8.35);
  assert.equal(restoredVadIslandSegments[1].start, 25.84);
  assert.equal(restoredVadIslandSegments[1].end, 26.15);
}

{
  assert.equal(context.browserAsrUploadChunkSeconds({}), 900);
  assert.equal(context.browserAsrUploadChunkSeconds({ asrUploadChunkSeconds: 20 }), 20);
  assert.equal(context.browserAsrUploadChunkSeconds({ asrUploadChunkSeconds: 9999 }), 1800);
  assert.equal(context.browserAsrMaxUploadBytes({}), 25 * 1024 * 1024);
  assert.equal(context.browserAsrMaxUploadBytes({ maxUploadMb: 100 }), 100 * 1024 * 1024);
}

{
  const originalFetch = context.fetch;
  let postCount = 0;
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    postCount += 1;
    return {
      ok: true,
      json: async () => ({ segments: [{ start: 0, end: 1, text: "should not upload" }] })
    };
  };
  const badMp3 = new Uint8Array(256).fill(0x41).buffer;
  await assert.rejects(
    context.transcribeBrowserAudioChunk(
      {
        index: 0,
        start: 0,
        end: 10,
        duration: 10,
        file: { name: "asr-bad.mp3", buffer: badMp3, mime: "audio/mpeg" }
      },
      {
        providerType: "openai",
        baseUrl: "https://speaches-invalid-upload.example/v1",
        model: "Systran/faster-whisper-large-v3",
        apiKey: "test",
        vadFilter: "off"
      }
    ),
    /ASR 音频格式校验失败/
  );
  assert.equal(postCount, 0);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFiles = [];
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    for (const [name, value] of init.body.entries()) {
      if (name === "file") {
        postedFiles.push({ type: value.type, size: value.size });
      }
    }
    return {
      ok: true,
      json: async () => ({ segments: [{ start: 0, end: 1, text: "canonical mp3" }] })
    };
  };
  const canonicalMp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, ...new Array(256).fill(0)]).buffer;
  const segments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 0,
      end: 10,
      duration: 10,
      file: { name: "asr-ok.mp3", buffer: canonicalMp3, mime: "audio/mpeg" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-valid-upload.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "off"
    }
  );
  assert.equal(segments[0].text, "canonical mp3");
  assert.deepEqual(postedFiles, [{ type: "audio/mpeg", size: canonicalMp3.byteLength }]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let postCount = 0;
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    postCount += 1;
    return {
      ok: true,
      json: async () => ({ segments: [{ start: 0, end: 1, text: "should not upload" }] })
    };
  };
  const id3OnlyMp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 2, 67, ...new Array(323).fill(0)]).buffer;
  await assert.rejects(
    context.transcribeBrowserAudioChunk(
      {
        index: 0,
        start: 0,
        end: 10,
        duration: 10,
        file: { name: "asr-id3-only.mp3", buffer: id3OnlyMp3, mime: "audio/mpeg" }
      },
      {
        providerType: "openai",
        baseUrl: "https://speaches-id3-only.example/v1",
        model: "Systran/faster-whisper-large-v3",
        apiKey: "test",
        vadFilter: "off"
      }
    ),
    /ASR 音频格式校验失败/
  );
  assert.equal(postCount, 0);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    return {
      ok: false,
      status: 415,
      json: async () => ({ detail: "Failed to decode audio. The provided file type is not supported." })
    };
  };
  const canonicalMp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, ...new Array(256).fill(0)]).buffer;
  await assert.rejects(
    context.transcribeBrowserAudioChunk(
      {
        index: 0,
        start: 0,
        end: 10,
        duration: 10,
        file: { name: "asr-decode-fails.mp3", buffer: canonicalMp3, mime: "audio/mpeg" }
      },
      {
        providerType: "openai",
        baseUrl: "https://speaches-decode-detail.example/v1",
        model: "Systran/faster-whisper-large-v3",
        apiKey: "test",
        vadFilter: "off"
      }
    ),
    /Failed to decode audio[\s\S]*asr-decode-fails\.mp3[\s\S]*audio\/mpeg[\s\S]*ID3/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async url => {
    const host = new URL(String(url)).hostname;
    const withClip = host === "speaches-clip.example";
    const withSpeechTimestamps = host === "speaches-vad-endpoint.example";
    const fullVadFields = host === "speaches-full-vad.example";
    return {
      ok: true,
      json: async () => ({
        paths: {
          "/v1/audio/transcriptions": {
            post: {
              requestBody: {
                content: {
                  "application/x-www-form-urlencoded": {
                    schema: {
                      properties: {
                        vad_filter: { type: "boolean" },
                        ...(withClip ? { clip_timestamps: { type: "string" } } : {}),
                        ...(fullVadFields ? {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" }
                        } : {})
                      }
                    }
                  }
                }
              }
            }
          },
          ...(withSpeechTimestamps ? {
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          } : {})
        }
      })
    };
  };
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-endpoint.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 30);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 30);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-full-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 900);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asrUploadChunkSeconds: 20,
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 20);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-clip.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 900);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "off"
    }
  }), 900);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const probedUrls = [];
  context.fetch = async url => {
    probedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        paths: {
          "/v1/audio/transcriptions": {
            post: {
              requestBody: {
                content: {
                  "multipart/form-data": {
                    schema: { $ref: "#/components/schemas/Body_transcribe_file_v1_audio_transcriptions_post" }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Body_transcribe_file_v1_audio_transcriptions_post: {
              properties: {
                vad_filter: { type: "boolean" },
                condition_on_previous_text: { type: "boolean" },
                no_speech_threshold: { type: "number" },
                max_speech_duration_s: { type: "number" },
                min_silence_duration_ms: { type: "integer" },
                speech_pad_ms: { type: "integer" },
                vad_parameters: { type: "string" },
                without_timestamps: { type: "boolean" }
              }
            }
          }
        }
      })
    };
  };
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted.example/v1",
    model: "whisper-1"
  })).has("vad_filter"), true);
  assert.equal(JSON.stringify(Array.from(await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted.example/v1",
    model: "whisper-1"
  })).sort()), JSON.stringify([
    "condition_on_previous_text",
    "max_speech_duration_s",
    "min_silence_duration_ms",
    "no_speech_threshold",
    "speech_pad_ms",
    "vad_filter",
    "vad_parameters",
    "without_timestamps"
  ]));
  assert.deepEqual(probedUrls, ["https://selfhosted.example/openapi.json"]);
  probedUrls.length = 0;
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted-transcription.example/v1/audio/transcriptions",
    model: "whisper-1"
  })).has("vad_filter"), true);
  assert.deepEqual(probedUrls, ["https://selfhosted-transcription.example/openapi.json"]);
  probedUrls.length = 0;
  context.fetch = async url => {
    probedUrls.push(String(url));
    return { ok: true, json: async () => ({ openapi: "3.1.0", paths: {} }) };
  };
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://faster-whisper-compatible.example/v1",
    model: "Systran/faster-whisper-large-v3"
  })).has("vad_filter"), false);
  assert.deepEqual(probedUrls, [
    "https://faster-whisper-compatible.example/openapi.json",
    "https://faster-whisper-compatible.example/v1/openapi.json"
  ]);
  context.fetch = originalFetch;
}

{
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/v1/audio/transcriptions": {
        post: {
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { vad_filter: { type: "boolean" } }
                }
              }
            }
          }
        }
      }
    }
  }).has("vad_filter"), true);
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/v1/audio/transcriptions": {
        post: {
          responses: {
            200: {
              description: "Mentions vad_filter only in response docs."
            }
          }
        }
      }
    },
    components: {
      schemas: {
        ResponseOnly: {
          type: "object",
          properties: { vad_filter: { type: "boolean" } }
        }
      }
    }
  }).has("vad_filter"), false);
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/health": {
        get: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { vad_filter: { type: "boolean" } }
                }
              }
            }
          }
        }
      }
    }
  }).has("vad_filter"), false);
}

{
  const originalFetch = context.fetch;
  const requests = [];
  const resolvers = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requests.push(segments.map(segment => segment.text));
    return await new Promise(resolve => {
      resolvers.push(() => resolve({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
              })
            }
          }]
        })
      }));
    });
  };
  const translationPromise = context.translateBrowserSegments(
    Array.from({ length: 61 }, (_, index) => ({
      start: index,
      end: index + 0.5,
      text: `parallel-${index}`,
      chunkIndex: 0,
      segmentIndex: index
    })),
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {},
    { batchWorkers: 2 }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 2, "second translation batch should start before the first one resolves");
  resolvers.forEach(resolve => resolve());
  const translated = await translationPromise;
  assert.equal(translated.length, 61);
  assert.equal(translated[0].text, "译文-parallel-0");
  assert.equal(translated[60].text, "译文-parallel-60");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let requests = 0;
  context.fetch = async (_url, init = {}) => {
    requests += 1;
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (requests === 2) {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Too many requests" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
            })
          }
        }]
      })
    };
  };
  const sourceSegments = Array.from({ length: 121 }, (_, index) => ({
    start: index,
    end: index + 0.5,
    text: `rate-${index}`,
    chunkIndex: 0,
    segmentIndex: index
  }));
  const translated = await context.translateBrowserSegments(
    sourceSegments,
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {},
    { batchWorkers: 1 }
  );
  assert.equal(translated.length, 61);
  assert.equal(translated[0].text, "译文-rate-0");
  assert.equal(translated.at(-1).text, "译文-rate-120");
  assert.equal(context.browserTranslationFailures(translated).length, 60);
  assert.equal(context.browserTranslationErrorIsPermanent(new Error("Too many requests")), false);
  assert.equal(context.browserTranslationErrorIsPermanent(new Error("invalid api key")), true);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [
        { start: 0, end: 1, text: "a" },
        { start: 1, end: 2, text: "b" },
        { start: 2, end: 3, text: "c" },
        { start: 3, end: 4, text: "d" }
      ],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /自动拆分/
  );
  assert.ok(calls <= 8, `automatic split retry used ${calls} LLM calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (requestedSizes.length === 1) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
            })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.deepEqual(requestedSizes, [3, 3]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-b", "译文-c"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    const items = requestedSizes.length === 1
      ? segments.map((segment, index) => ({ i: index + 10, text: `错位-${segment.text}` }))
      : segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }));
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.deepEqual(requestedSizes, [3, 3]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-b", "译文-c"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (segments.length > 1 || segments[0]?.text === "bad") {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "bad", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-c", "译文-d"]));
  assert.equal(translated.some(segment => segment.text === "bad"), false);
  assert.ok(requestedSizes.some(size => size === 1), `expected fallback to retry single subtitles, got ${requestedSizes.join(",")}`);
  const failures = context.browserTranslationFailures(translated);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].source.text, "bad");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text.startsWith("bad")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "bad-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "bad-b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "ok-c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "ok-d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-c", "译文-ok-d"]));
  const failures = context.browserTranslationFailures(translated);
  assert.equal(JSON.stringify(failures.map(failure => failure.source.text)), JSON.stringify(["bad-a", "bad-b"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (segments.length > 1 || segments.some(segment => segment.text === "blocked")) {
      return {
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: "Forbidden: content safety policy violation" }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "ok-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "blocked", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "ok-c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.ok(requestedSizes.some(size => size === 1), `expected content policy fallback to retry single subtitles, got ${requestedSizes.join(",")}`);
  const failures = context.browserTranslationFailures(translated);
  assert.equal(JSON.stringify(failures.map(failure => failure.source.text)), JSON.stringify(["blocked"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      error: { message: "Forbidden: content safety policy violation" }
    })
  });
  const translated = await context.translateBrowserSegments(
    [{ start: 1, end: 2, text: "blocked only", chunkIndex: 0, segmentIndex: 0 }],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(translated.length, 0);
  assert.equal(JSON.stringify(context.browserTranslationFailures(translated).map(failure => failure.source.text)), JSON.stringify(["blocked only"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const splitRequests = [];
  const splitResolvers = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length === 4) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    splitRequests.push(segments.map(segment => segment.text));
    return await new Promise(resolve => {
      splitResolvers.push(() => resolve({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
              })
            }
          }]
        })
      }));
    });
  };
  const translationPromise = context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "split-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "split-b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "split-c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "split-d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {},
    { splitWorkers: 2 }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(splitRequests.length, 2, "split fallback halves should start concurrently");
  splitResolvers.forEach(resolve => resolve());
  const translated = await translationPromise;
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify([
    "译文-split-a",
    "译文-split-b",
    "译文-split-c",
    "译文-split-d"
  ]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: "Forbidden: invalid API key" }
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [
        { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
        { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 }
      ],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /invalid api key/i
  );
  assert.equal(calls, 1);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text.startsWith("bad")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const sourceSegments = [
    ...Array.from({ length: 60 }, (_, index) => ({
      start: index,
      end: index + 0.5,
      text: `bad-${index}`,
      chunkIndex: 0,
      segmentIndex: index
    })),
    { start: 60, end: 61, text: "ok-final", chunkIndex: 0, segmentIndex: 60 }
  ];
  const translated = await context.translateBrowserSegments(
    sourceSegments,
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-final"]));
  assert.equal(context.browserTranslationFailures(translated).length, 60);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      Array.from({ length: 60 }, (_, index) => ({
        start: index,
        end: index + 0.5,
        text: `bad-${index}`,
        chunkIndex: 0,
        segmentIndex: index
      })),
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /没有得到可用译文/
  );
  assert.ok(calls <= 120, `60-line split fallback used ${calls} LLM calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async (_url, init = {}) => {
    calls += 1;
    const body = JSON.parse(init.body);
    if (Object.hasOwn(body, "response_format")) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "response_format is not supported by this compatible endpoint" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      Array.from({ length: 60 }, (_, index) => ({
        start: index,
        end: index + 0.5,
        text: `response-format-bad-${index}`,
        chunkIndex: 0,
        segmentIndex: index
      })),
      {
        providerType: "openai",
        baseUrl: "https://llm-response-format-budget.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /没有得到可用译文/
  );
  assert.ok(calls <= 121, `response_format fallback plus 60-line split used ${calls} HTTP calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, text: "" }] }) } }]
    })
  });
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [{ start: 0, end: 1, text: "hello" }],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /空译文/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ items: [{ i: 1, text: "错位译文" }] }) } }]
    })
  });
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [{ start: 0, end: 1, text: "hello" }],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /索引/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  const requestedTexts = [];
  context.fetch = async (_url, init = {}) => {
    calls += 1;
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedTexts.push(segments.map(segment => segment.text));
    const items = segments.length > 1
      ? [{ i: 0, text: "第一句译文" }]
      : segments.map(segment => ({ i: 0, text: `译文-${segment.text}` }));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ items }) } }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "b" }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(calls, 2);
  assert.deepEqual(requestedTexts, [["a", "b"], ["b"]]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["第一句译文", "译文-b"]));
  context.fetch = originalFetch;
}

{
  const merged = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 89.06, end: 89.879, text: "算一下多少钱" },
    { start: 89.879, end: 89.939, text: "算一下多少钱" },
    { start: 90.5, end: 91, text: "下一句" }
  ], 2);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].start, 89.06);
  assert.equal(merged[0].end, 89.939);
  assert.equal(merged[0].text, "算一下多少钱");
  assert.equal(merged[0].chunkIndex, 2);
  assert.equal(merged[0].segmentIndex, 0);
  assert.equal(merged[1].segmentIndex, 1);

  const separated = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 1, end: 2, text: "谢谢" },
    { start: 2.4, end: 3, text: "谢谢" }
  ], 0);
  assert.equal(separated.length, 2);

  const different = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 1, end: 2, text: "谢谢" },
    { start: 2, end: 3, text: "謝謝" }
  ], 0);
  assert.equal(different.length, 2);
}

{
  const compressionHallucination = context.normalizeAsrSegments({
      segments: [{
        start: 0,
        end: 10,
        text: "お母さんのお母さんのお母さんのお母さんのお母さんのお母さんのお母さん",
        compression_ratio: 25.36,
        no_speech_prob: 0.44
      }]
    }, 900, 1200);
  assert.equal(compressionHallucination.length, 0);

  const repeatedHallucination = context.normalizeAsrSegments({
      segments: Array.from({ length: 8 }, (_, index) => ({
        start: index * 2,
        end: index * 2 + 2,
        text: "何か漏れてきちゃってますよ"
      }))
    }, 900, 1200);
  assert.equal(repeatedHallucination.length, 0);

  const noSpeechHallucination = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 30,
      text: "Thank you for watching.",
      compression_ratio: 1.12,
      no_speech_prob: 0.88,
      avg_logprob: -1.2
    }]
  }, 900, 930);
  assert.equal(noSpeechHallucination.length, 0);

  const noSpeechButConfidentSpeech = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 3,
      text: "これは本当の発話です",
      compression_ratio: 1.12,
      no_speech_prob: 0.88,
      avg_logprob: -0.2
    }]
  }, 900, 930);
  assert.equal(noSpeechButConfidentSpeech.length, 1);
  assert.equal(noSpeechButConfidentSpeech[0].text, "これは本当の発話です");

  const filteredHallucination = context.normalizeAsrSegments({
    segments: [
      { start: 0, end: 2, text: "正常第一句" },
      ...Array.from({ length: 5 }, (_, index) => ({
        start: 2 + index * 2,
        end: 4 + index * 2,
        text: "repeated drift phrase"
      })),
      { start: 14, end: 16, text: "正常第二句" }
    ]
  }, 900, 1200);
  assert.equal(JSON.stringify(filteredHallucination.map(segment => segment.text)), JSON.stringify(["正常第一句", "正常第二句"]));

  const repeatedSoundLabel = context.normalizeAsrSegments({
    segments: Array.from({ length: 15 }, (_, index) => ({
      start: 874.83 + index * 0.8,
      end: 875.43 + index * 0.8,
      text: "compressed nonspeech label",
      compression_ratio: 9.85,
      no_speech_prob: 0.2
    }))
  }, 0, 900);
  assert.equal(repeatedSoundLabel.length, 0);

  const longSingleVocalization = context.normalizeAsrSegments({
    segments: [{
      start: 2108,
      end: 2124.25,
      text: "hmhmhmhmhmhmhmhmhmhmhmhmhmhm"
    }]
  }, 2108, 2138);
  assert.equal(longSingleVocalization.length, 0);

  const longSingleRepeatedPhrase = context.normalizeAsrSegments({
    segments: [{
      start: 1490,
      end: 1518.58,
      text: "drift phrase, drift phrase, drift phrase, drift phrase, drift phrase"
    }]
  }, 1490, 1520);
  assert.equal(longSingleRepeatedPhrase.length, 0);

  const shortSpokenJapanese = context.normalizeAsrSegments({
    segments: [{
      start: 285.86,
      end: 286.58,
      text: "面白いよ"
    }]
  }, 270, 300);
  assert.equal(shortSpokenJapanese.length, 1);
  assert.equal(shortSpokenJapanese[0].text, "面白いよ");
}

{
  const emptyVadCompressedDrift = context.filterAsrSegmentsByHallucinationGuard([
    {
      start: 893,
      end: 895.98,
      text: "generic compressed drift line",
      words: [
        { start: 893.0, end: 893.4, text: "generic", probability: 0.9 },
        { start: 893.4, end: 893.8, text: "compressed", probability: 0.9 },
        { start: 893.8, end: 894.4, text: "drift", probability: 0.9 },
        { start: 894.4, end: 895.98, text: "line", probability: 0.9 }
      ],
      rawSegment: {
        compression_ratio: 6.24,
        no_speech_prob: 0.42,
        avg_logprob: -0.29
      }
    }
  ], { speechIntervals: [], speechIntervalsReliable: true });
  assert.equal(emptyVadCompressedDrift.length, 0);

  const emptyVadOrdinarySpeech = context.filterAsrSegmentsByHallucinationGuard([
    {
      start: 120,
      end: 122.4,
      text: "ordinary sentence kept despite missed vad",
      words: [
        { start: 120.0, end: 120.5, text: "ordinary", probability: 0.9 },
        { start: 120.5, end: 121.0, text: "sentence", probability: 0.9 },
        { start: 121.0, end: 121.6, text: "kept", probability: 0.9 },
        { start: 121.6, end: 122.0, text: "despite", probability: 0.9 },
        { start: 122.0, end: 122.2, text: "missed", probability: 0.9 },
        { start: 122.2, end: 122.4, text: "vad", probability: 0.9 }
      ],
      rawSegment: {
        compression_ratio: 1.4,
        no_speech_prob: 0.08,
        avg_logprob: -0.2
      }
    }
  ], { speechIntervals: [], speechIntervalsReliable: true });
  assert.equal(emptyVadOrdinarySpeech.length, 1);

  const overlappedSpeechKeepsQualityOutlier = context.filterAsrSegmentsByHallucinationGuard([
    {
      start: 240,
      end: 242.5,
      text: "quality outlier with speech evidence",
      words: [
        { start: 240.0, end: 240.5, text: "quality", probability: 0.9 },
        { start: 240.5, end: 241.2, text: "outlier", probability: 0.9 },
        { start: 241.2, end: 241.8, text: "with", probability: 0.9 },
        { start: 241.8, end: 242.2, text: "speech", probability: 0.9 },
        { start: 242.2, end: 242.5, text: "evidence", probability: 0.9 }
      ],
      rawSegment: {
        compression_ratio: 6.24,
        no_speech_prob: 0.42,
        avg_logprob: -0.29
      }
    }
  ], { speechIntervals: [{ start: 239.9, end: 242.6 }], speechIntervalsReliable: true });
  assert.equal(overlappedSpeechKeepsQualityOutlier.length, 1);

  const normalizedEmptyVadCompressedDrift = context.normalizeAsrSegments({
    segments: [{
      start: 19,
      end: 21.98,
      text: "normalized compressed drift line",
      compression_ratio: 6.24,
      no_speech_prob: 0.42,
      avg_logprob: -0.29,
      words: [
        { start: 19.0, end: 19.4, word: "normalized", probability: 0.9 },
        { start: 19.4, end: 19.8, word: "compressed", probability: 0.9 },
        { start: 19.8, end: 20.4, word: "drift", probability: 0.9 },
        { start: 20.4, end: 21.98, word: "line", probability: 0.9 }
      ]
    }]
  }, 874, 902);
  assert.equal(normalizedEmptyVadCompressedDrift.length, 1);
  const normalizedEmptyVadFiltered = context.filterAsrSegmentsByHallucinationGuard(
    normalizedEmptyVadCompressedDrift,
    { speechIntervals: [], speechIntervalsReliable: true }
  );
  assert.equal(normalizedEmptyVadFiltered.length, 0);
}

function seedPage(tabId, { title = "Video", url = "https://example.test/watch/1", duration = 600, poster = "", currentSrc = "" } = {}) {
  const state = context.getState(tabId);
  state.page = { title, url };
  state.context = {
    hasMedia: true,
    duration,
    href: url,
    title,
    currentTime: 0,
    frameId: 0,
    poster,
    currentSrc
  };
  return state;
}

function add(tabId, candidate) {
  context.addCandidate(tabId, {
    source: "request",
    seenAt: Date.now(),
    ...candidate
  });
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const record = {
    job: {
      id: "browser-progress-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 0, elapsedSeconds: 0 },
      translation: { chunkStatuses: [] }
    },
    startedAt: Date.now() - 5000,
    tabId: 700
  };
  context.applyBrowserExtractionProgress(record, {
    phase: "download",
    percent: 25,
    readySeconds: 180,
    internalChunksDone: 1,
    internalChunksTotal: 4,
    message: "已生成 1/4 个内部媒体切片"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);
  assert.equal(record.job.extract.internalChunksDone, 1);
  assert.equal(record.job.extract.internalChunksTotal, 4);
  assert.equal(record.job.extract.message, "已生成 1/4 个内部媒体切片");
  assert.equal(record.job.progress.extraction.readySeconds, 180);

  context.applyBrowserExtractionProgress(record, {
    phase: "ffmpeg",
    percent: 20,
    readySeconds: 120,
    message: "较旧进度不应让进度条后退"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);

  record.job.stage = "translation";
  context.applyBrowserExtractionProgress(record, {
    phase: "download",
    percent: 40,
    readySeconds: 360,
    message: "后续抽取进度不应覆盖更晚的处理阶段"
  });
  assert.equal(record.job.stage, "translation");
}

{
  const startedAt = Date.now() - 123480;
  assert.equal(context.elapsedSeconds(startedAt), 123);
}

{
  const record = {
    metadata: { duration: 14415 },
    browserAsrChunkSeconds: 7200,
    audioChunks: [
      { index: 0, start: 0, end: 7200, file: { name: "funasr-1.mp3", buffer: new ArrayBuffer(1) } },
      { index: 1, start: 7200, end: 14373, file: { name: "funasr-2.mp3", buffer: new ArrayBuffer(1) } }
    ],
    job: {
      extract: { status: "completed", duration: 14415, asrChunkSeconds: 7200, progress: 100 },
      translation: { chunkStatuses: [], chunksTotal: 0 }
    }
  };
  assert.equal(context.browserFunAsrExpectedChunkCount(record), 2);
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const record = {
    job: {
      id: "browser-chunk-status-test",
      status: "running",
      stage: "asr",
      extract: { status: "completed", progress: 100, elapsedSeconds: 0 },
      translation: { chunkStatuses: [context.createChunkStatus(0, "queued")] }
    },
    startedAt: Date.now() - 1000,
    tabId: 701
  };
  context.updateChunkStatus(record, 0, { stage: "asr", status: "识别" });
  assert.equal(typeof record.job.translation.chunkStatuses[0].stageStartedAt, "number");
  record.job.translation.chunkStatuses[0].stageStartedAt = 1;
  context.updateChunkStatus(record, 0, { stage: "asr", status: "识别", message: "仍在识别" });
  assert.equal(record.job.translation.chunkStatuses[0].stageStartedAt, 1);
  context.updateChunkStatus(record, 0, { stage: "translation", status: "翻译" });
  assert.equal(record.job.translation.chunkStatuses[0].stageStartedAt > 1, true);
}

{
  const tabId = 101;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/master.m3u8",
    kind: "hls",
    ext: "m3u8",
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/video-1080.mp4",
    kind: "video",
    ext: "mp4",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    size: 9_600_000,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].role, "audio");
  assert.equal(candidates[0].hiddenCount, 2);
  assert.equal(Math.round(candidates[0].duration), 600);
}

{
  const tabId = 102;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/preview/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 120,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 2);
}

{
  const tabId = 103;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    source: "performance-entry"
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.equal(Math.round(candidate.duration), 600);
}

{
  const tabId = 104;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "media",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].hiddenCount, 0);
}

{
  const tabId = 106;
  seedPage(tabId, { duration: 600 });
  const url = "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s";
  add(tabId, {
    url,
    kind: "media",
    ext: "m4s",
    source: "performance-entry"
  });
  add(tabId, {
    url,
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 72_683
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "bilibili-playurl");
  assert.equal(candidate.role, "audio");
  assert.equal(Math.round(candidate.duration), 600);
  assert.equal(candidate.sourcePlan.kind, "direct-audio");
  assert.equal(candidate.sourcePlan.siteAdapter, "bilibili");
}

{
  const tabId = 107;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?official=1",
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 125_995
  });
  add(tabId, {
    url: "https://xy115.example.mcdn.bilivideo.cn/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?from=performance",
    kind: "media",
    ext: "m4s",
    source: "performance-entry",
    duration: 600
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "bilibili-playurl");
}

{
  const tabId = 120;
  seedPage(tabId, { title: "Bilibili ASR candidate", url: "https://www.bilibili.com/video/BV17DLP6UEPw", duration: 600 });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s",
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 125_995
  });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-100078.m4s",
    kind: "video",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    duration: 600,
    bandwidth: 8_000_000
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.match(candidate.url, /30232\.m4s/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(candidate.variantStats.audio, 1);
  assert.equal(candidate.variantStats.video, 1);
}

{
  const tabId = 121;
  seedPage(tabId, { title: "Generic DASH ASR candidate", url: "https://example.test/watch/generic-dash", duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/dash/movie-30232.m4s",
    kind: "audio",
    role: "audio",
    ext: "m4s",
    source: "request",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 132_000
  });
  add(tabId, {
    url: "https://cdn.example.test/dash/movie-100078.m4s",
    kind: "video",
    role: "video",
    ext: "m4s",
    source: "request",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    duration: 600,
    bandwidth: 8_000_000
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.match(candidate.url, /30232\.m4s/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(candidate.variantStats.audio, 1);
  assert.equal(candidate.variantStats.video, 1);
}

{
  const tabId = 105;
  seedPage(tabId, { title: "HLS quality variants", url: "https://example.test/watch/hls", duration: 14373 });
  add(tabId, {
    url: "https://cdn.example.test/path/360p/video.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    initiator: "https://example.test/watch/hls"
  });
  add(tabId, {
    url: "https://cdn.example.test/path/720p/video.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    initiator: "https://example.test/watch/hls"
  });
  add(tabId, {
    url: "https://cdn.example.test/path/1080p/video.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "performance-entry",
    initiator: "https://example.test/watch/hls"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://cdn.example.test/path/360p/video.m3u8");
  assert.equal(candidates[0].hiddenCount, 2);
  assert.match(candidates[0].selectionReason, /选择较轻的流/);
  assert.equal(candidates[0].variants.some(variant => variant.url.includes("/1080p/")), true);
}

{
  const tabId = 122;
  seedPage(tabId, { title: "HLS query quality variants", url: "https://example.test/watch/hls-query", duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/path/video.m3u8?quality=720p&token=low",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    initiator: "https://example.test/watch/hls-query"
  });
  add(tabId, {
    url: "https://cdn.example.test/path/video.m3u8?quality=1080p&token=high",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "performance-entry",
    initiator: "https://example.test/watch/hls-query"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://cdn.example.test/path/video.m3u8?quality=720p&token=low");
  assert.equal(candidates[0].hiddenCount, 1);
}

{
  const tabId = 137;
  seedPage(tabId, { title: "Long HLS page with short video preview", url: "https://missav.example.test/mimk-107", duration: 7209 });
  add(tabId, {
    url: "https://fourhoi.example.test/miaa-710/hls/640x360/main.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    initiator: "https://missav.example.test/mimk-107"
  });
  add(tabId, {
    url: "https://fourhoi.example.test/miaa-710/preview.mp4",
    kind: "media",
    ext: "mp4",
    contentType: "video/mp4",
    source: "xhr-body",
    initiator: "https://missav.example.test/mimk-107"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://fourhoi.example.test/miaa-710/hls/640x360/main.m3u8");
  assert.notEqual(candidates[0].sourcePlan?.ffmpegInput?.url, "https://fourhoi.example.test/miaa-710/preview.mp4");
}

{
  const tabId = 138;
  seedPage(tabId, { title: "Direct MP4 video", url: "https://example.test/watch/direct-mp4", duration: 90 });
  add(tabId, {
    url: "https://media.example.test/video/full.mp4",
    kind: "media",
    ext: "mp4",
    contentType: "video/mp4",
    source: "media-element",
    duration: 90,
    initiator: "https://example.test/watch/direct-mp4"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourcePlan.kind, "muxed-media");
  assert.equal(candidates[0].sourcePlan.ffmpegInput.url, "https://media.example.test/video/full.mp4");
}

{
  const tabId = 139;
  seedPage(tabId, { title: "Long DASH page with short video preview", url: "https://dash.example.test/watch/long", duration: 7209 });
  add(tabId, {
    url: "https://cdn.example.test/long/manifest.mpd",
    kind: "dash",
    ext: "mpd",
    contentType: "application/dash+xml",
    source: "xhr-body",
    initiator: "https://dash.example.test/watch/long"
  });
  add(tabId, {
    url: "https://cdn.example.test/long/preview.mp4",
    kind: "media",
    ext: "mp4",
    contentType: "video/mp4",
    source: "xhr-body",
    initiator: "https://dash.example.test/watch/long"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://cdn.example.test/long/manifest.mpd");
  assert.notEqual(candidates[0].sourcePlan?.ffmpegInput?.url, "https://cdn.example.test/long/preview.mp4");
}

{
  const tabId = 140;
  seedPage(tabId, { title: "Direct MP4 video with noisy playback fragments", url: "https://example.test/watch/direct-mp4-noisy", duration: 90 });
  add(tabId, {
    url: "https://media.example.test/video/full.mp4",
    kind: "media",
    ext: "mp4",
    contentType: "video/mp4",
    source: "media-element",
    duration: 90,
    initiator: "https://example.test/watch/direct-mp4-noisy"
  });
  for (let index = 0; index < 120; index += 1) {
    add(tabId, {
      url: `https://media.example.test/video/segments/noise-${String(index).padStart(3, "0")}.m4s`,
      kind: "segment",
      role: "video",
      ext: "m4s",
      contentType: "video/mp4",
      source: "request",
      duration: 2,
      initiator: "https://example.test/watch/direct-mp4-noisy"
    });
  }

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.some(candidate => candidate.url === "https://media.example.test/video/full.mp4"), true);
  const directMp4 = candidates.find(candidate => candidate.url === "https://media.example.test/video/full.mp4");
  assert.equal(directMp4.sourcePlan.kind, "muxed-media");
  assert.equal(directMp4.sourcePlan.ffmpegInput.url, "https://media.example.test/video/full.mp4");
}

{
  const tabId = 127;
  seedPage(tabId, {
    title: "X status with related videos",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059000000000000001/pl/avc1/488x270/related-146s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 146,
    videoWidth: 488,
    videoHeight: 270,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059000000000000002/pl/avc1/320x320/related-32s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 32,
    videoWidth: 320,
    videoHeight: 320,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/650x360/status-82s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    videoWidth: 650,
    videoHeight: 360,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const tabId = 128;
  seedPage(tabId, {
    title: "X status with scrolled related video",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 146
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059000000000000001/pl/avc1/488x270/related-146s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 146,
    videoWidth: 488,
    videoHeight: 270,
    statusId: "2059000000000000001",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/650x360/status-82s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    videoWidth: 650,
    videoHeight: 360,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const tabId = 129;
  seedPage(tabId, {
    title: "X status with unassigned related video",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 146
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059000000000000003/pl/avc1/320x180/related-146s-no-status.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 146,
    videoWidth: 320,
    videoHeight: 180,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/650x360/status-82s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    videoWidth: 650,
    videoHeight: 360,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const tabId = 130;
  seedPage(tabId, {
    title: "X status with HLS video and incomplete MSE fragments",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/650x360/_6Jux_HKzlwgTTC3.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    videoWidth: 650,
    videoHeight: 360,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/audio/seg-00001.m4s",
    kind: "segment",
    ext: "m4s",
    role: "audio",
    contentType: "video/iso.segment",
    source: "xhr-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/audio/seg-00002.m4s",
    kind: "segment",
    ext: "m4s",
    role: "audio",
    contentType: "video/iso.segment",
    source: "xhr-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const tabId = 131;
  seedPage(tabId, {
    title: "X status with sniffed fMP4 audio init",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  context.addPageMediaCandidate(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/track/init-001.m4s",
    kind: "media",
    ext: "m4s",
    role: "audio",
    segmentType: "init",
    contentType: "audio/mp4",
    source: "fetch-body",
    href: "https://x.com/jaynitx/status/2059183692569071878"
  }, 0);
  context.addPageMediaCandidate(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/track/00001.m4s",
    kind: "media",
    ext: "m4s",
    contentType: "video/iso.segment",
    source: "request",
    href: "https://x.com/jaynitx/status/2059183692569071878"
  }, 0);
  context.addPageMediaCandidate(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183692569071878/track/00002.m4s",
    kind: "media",
    ext: "m4s",
    contentType: "video/iso.segment",
    source: "request",
    href: "https://x.com/jaynitx/status/2059183692569071878"
  }, 0);

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.sourcePlan.kind, "mse-fragments");
  assert.equal(candidate.sourcePlan.executable, true);
  assert.equal(candidate.sourcePlan.primaryRole, "audio");
  assert.equal(candidate.sourcePlan.ffmpegInput.fragments[0].segmentType, "init");
}

{
  const tabId = 132;
  seedPage(tabId, {
    title: "X status with video playlist and direct audio tracks",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058970000000000053/pl/avc1/650x360/_thevh61CDhTYNfJ.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    videoWidth: 650,
    videoHeight: 360,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058970000000000053/audio/128000/audio-track.mp4",
    kind: "audio",
    ext: "mp4",
    contentType: "audio/mp4",
    source: "xhr-body",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058970000000000053/audio/64000/audio-track.mp4",
    kind: "audio",
    ext: "mp4",
    contentType: "audio/mp4",
    source: "xhr-body",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059000000000000001/pl/avc1/488x270/related-146s.m3u8?tag=16",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 146,
    videoWidth: 488,
    videoHeight: 270,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  const [candidate] = candidates;
  assert.match(candidate.url, /\/avc1\/650x360\/_thevh61CDhTYNfJ\.m3u8/);
  assert.equal(candidate.duration, 82);
  assert.equal(candidate.sourcePlan.kind, "direct-audio");
  assert.equal(candidate.sourcePlan.ffmpegInput.type, "direct");
  assert.match(candidate.sourcePlan.ffmpegInput.url, /\/audio\/(?:128000|64000)\/audio-track\.mp4/);
  assert.equal(candidate.variants.some(variant => variant.role === "audio" && variant.contentType === "audio/mp4"), true);
}

{
  const tabId = 133;
  seedPage(tabId, {
    title: "X status with video-only variants",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058958000000000001/pl/avc1/1280x720/vpwTXNBBAaBghL_g.m3u8?tag=27",
    kind: "hls",
    ext: "m3u8",
    role: "video",
    contentType: "application/vnd.apple.mpegurl",
    source: "json-parse",
    duration: 82,
    videoWidth: 1280,
    videoHeight: 720,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058958000000000001/vid/avc1/2160x2160/mYURGjflKU62W4IR.mp4?tag=27",
    kind: "media",
    ext: "mp4",
    role: "video",
    contentType: "video/mp4",
    source: "json-parse",
    duration: 82,
    videoWidth: 2160,
    videoHeight: 2160,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2058958000000000001/vid/avc1/1280x720/fallback.mp4?tag=27",
    kind: "media",
    ext: "mp4",
    role: "video",
    contentType: "video/mp4",
    source: "json-parse",
    duration: 82,
    videoWidth: 1280,
    videoHeight: 720,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const tabId = 134;
  seedPage(tabId, {
    title: "X status with player master audio renditions",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/ujqQBpTjKwgRUz5h.m3u8?tag=14&v=cfc",
    kind: "hls",
    ext: "m3u8",
    playlistType: "master",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/32000/GbDAND4wQKvzaKjK.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    playlistType: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/64000/nYblN7k8RN5JSUbL.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    playlistType: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    playlistType: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "video",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    videoWidth: 1280,
    videoHeight: 720,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/vid/avc1/1280x720/6B5Ja8knj279z4U-.mp4?tag=14",
    kind: "media",
    ext: "mp4",
    role: "video",
    contentType: "video/mp4",
    source: "json-parse",
    duration: 82,
    videoWidth: 1280,
    videoHeight: 720,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  const [candidate] = candidates;
  assert.equal(candidate.role, "audio");
  assert.match(candidate.url, /\/pl\/mp4a\/128000\/8gx0bryi1XnA-oNu\.m3u8$/);
  assert.equal(candidate.sourcePlan.kind, "hls-audio");
  assert.equal(candidate.sourcePlan.executable, true);
  assert.equal(candidate.sourcePlan.ffmpegInput.type, "hls");
  assert.match(candidate.sourcePlan.ffmpegInput.url, /\/pl\/mp4a\/128000\/8gx0bryi1XnA-oNu\.m3u8$/);
  assert.equal(candidate.variants.some(variant => /\/vid\/avc1\//.test(variant.url)), true);
}

{
  const tabId = 135;
  seedPage(tabId, {
    title: "X status with visible media poster",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82,
    poster: "https://pbs.twimg.com/amplify_video_thumb/2059183631126667264/img/9DBL3kfKP41LFG2H.jpg"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2049389439542304768/pl/mp4a/128000/related-audio.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "xhr-body",
    duration: 82,
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].url, /2059183631126667264/);
  assert.doesNotMatch(candidates[0].url, /2049389439542304768/);
}

{
  const tabId = 136;
  seedPage(tabId, {
    title: "X status keeps durable media source while segments stream",
    url: "https://x.com/jaynitx/status/2059183692569071878",
    duration: 82,
    poster: "https://pbs.twimg.com/amplify_video_thumb/2059183631126667264/img/9DBL3kfKP41LFG2H.jpg"
  });
  add(tabId, {
    url: "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8",
    kind: "hls",
    ext: "m3u8",
    role: "audio",
    contentType: "application/vnd.apple.mpegurl",
    source: "fetch-body",
    duration: 82,
    statusId: "2059183692569071878",
    initiator: "https://x.com/jaynitx/status/2059183692569071878"
  });
  for (let i = 0; i < 120; i += 1) {
    add(tabId, {
      url: `https://video.twimg.com/amplify_video/2059183631126667264/vid/avc1/1280x720/segment-${String(i).padStart(3, "0")}.m4s`,
      kind: "segment",
      ext: "m4s",
      role: "video",
      contentType: "video/iso.segment",
      source: "request",
      duration: 82,
      statusId: "2059183692569071878",
      initiator: "https://x.com/jaynitx/status/2059183692569071878"
    });
  }

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].url, /\/pl\/mp4a\/128000\/8gx0bryi1XnA-oNu\.m3u8$/);
}

{
  const tabId = 123;
  seedPage(tabId, {
    title: "DECO*27 - 愛言葉Ⅳ feat. 初音ミク - ニコニコ動画",
    url: "https://www.nicovideo.jp/watch/sm40510213",
    duration: 219
  });
  add(tabId, {
    url: "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/audio-aac-192kbps.m3u8?session=audio",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    initiator: "https://www.nicovideo.jp/watch/sm40510213"
  });
  add(tabId, {
    url: "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/video-h264-720p.m3u8?session=video",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    initiator: "https://www.nicovideo.jp/watch/sm40510213"
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.match(candidate.url, /audio-aac-192kbps\.m3u8/);
  assert.equal(candidate.role, "audio");
  assert.equal(candidate.assetKind, "hls-media");
  assert.equal(candidate.trackRole, "audio");
  assert.equal(candidate.mediaAsset.role, "audio");
  assert.equal(candidate.mediaAsset.durationEvidence.source, "manifest");
  assert.equal(candidate.sourcePlan.kind, "hls-audio");
  assert.match(candidate.sourcePlan.reason, /track identity/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(Math.round(candidate.duration), 219);
}

{
  const tabId = 125;
  seedPage(tabId, {
    title: "Sir Ken Robinson: Do schools kill creativity? | TED Talk",
    url: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity",
    duration: 1151
  });
  add(tabId, {
    url: "https://hls.ted.com/project_masters/1253/index-f9-v1.m3u8?intro_master_id=9294&preview=true",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    videoWidth: 854,
    videoHeight: 480,
    initiator: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity"
  });
  add(tabId, {
    url: "https://hls.ted.com/project_masters/1253/index-f8-a1.m3u8?intro_master_id=9294&preview=true",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    initiator: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity"
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.match(candidate.url, /index-f8-a1\.m3u8/);
  assert.equal(candidate.role, "audio");
  assert.equal(candidate.mediaAsset.kind, "hls-media");
  assert.equal(candidate.mediaAsset.role, "audio");
  assert.equal(candidate.sourcePlan.kind, "hls-audio");
  assert.match(candidate.sourcePlan.reason, /track identity/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(candidate.variantStats.audio, 1);
  assert.equal(
    candidate.variants.find(variant => /index-f9-v1\.m3u8/.test(variant.url))?.role,
    "playlist"
  );
}

{
  const tabId = 124;
  seedPage(tabId, {
    title: "DECO*27 - 愛言葉Ⅳ feat. 初音ミク - ニコニコ動画",
    url: "https://www.nicovideo.jp/watch/sm40510213",
    duration: 219
  });
  add(tabId, {
    url: "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/audio-aac-192kbps.m3u8?session=audio",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    initiator: "https://www.nicovideo.jp/watch/sm40510213"
  });
  add(tabId, {
    url: "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/video-h264-720p.m3u8?session=video",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    source: "response",
    initiator: "https://www.nicovideo.jp/watch/sm40510213"
  });
  add(tabId, {
    url: "https://ads.nicovideo.jp/support-announcement.mp3",
    kind: "audio",
    ext: "mp3",
    contentType: "audio/mp3",
    source: "response",
    initiator: "https://www.nicovideo.jp/watch/sm40510213"
  });

  const candidates = context.getDisplayCandidates(tabId);
  const supportAudio = candidates.find(candidate => candidate.url.includes("support-announcement.mp3"));
  assert.match(candidates[0].url, /audio-aac-192kbps\.m3u8/);
  assert.ok(supportAudio);
  assert.equal(supportAudio.duration, null);
  assert.equal(supportAudio.asrScore > candidates[0].asrScore, true);
}

{
  const tabId = 126;
  seedPage(tabId, { title: "YouTube placeholder", url: "https://www.youtube.com/watch?v=test", duration: 60 });
  add(tabId, {
    url: "https://www.youtube.com/s/search/audio/no_input.mp3",
    kind: "audio",
    ext: "mp3",
    contentType: "audio/mpeg",
    source: "request"
  });
  add(tabId, {
    url: "https://rr1---sn.example.googlevideo.com/videoplayback?mime=audio%2Fmp4&id=real",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    source: "request"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].url, /googlevideo\.com\/videoplayback/);
}

{
  const tabId = 127;
  seedPage(tabId, { title: "YouTube decipher warning", url: "https://www.youtube.com/watch?v=needs-signature", duration: 90 });
  add(tabId, {
    url: "https://rr1---sn.example.googlevideo.com/videoplayback?mime=audio%2Fmp4&id=needs-signature",
    kind: "audio",
    role: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    source: "json-parse",
    duration: 90,
    requiresSignatureDeciphering: true
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 0);
}

{
  const compactedHeaders = context.compactRequestHeaders([
    { name: "Authorization", value: "Bearer request-token" },
    { name: "Cookie", value: "sid=request-secret" },
    { name: "Referer", value: "https://example.test/watch" },
    { name: "Origin", value: "https://example.test" },
    { name: "User-Agent", value: "Chrome" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(compactedHeaders)), {
    authorization: "Bearer request-token"
  });
  assert.equal(JSON.stringify(compactedHeaders).includes("request-secret"), false);
}

{
  const tabId = 108;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://secure-cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/secure",
    requestHeaders: {
      authorization: "Bearer display-secret",
      cookie: "sid=display-secret",
      referer: "https://example.test/watch/secure",
      origin: "https://example.test",
      "user-agent": "Chrome"
    }
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.requestHeaders, undefined);
  assert.equal(JSON.stringify(candidate).includes("display-secret"), false);
  assert.equal(JSON.stringify(candidate).includes("authorization"), false);
  assert.equal(JSON.stringify(candidate).includes("headerNames"), false);
  const internalCandidate = context.resolvePreloadCandidateForStart(context.getState(tabId), {
    ...candidate,
    sourcePlan: {
      kind: "hls-audio",
      primaryUrl: "https://evil.example.test/steal.m3u8",
      ffmpegInput: { type: "hls", url: "https://evil.example.test/steal.m3u8" }
    }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(internalCandidate.requestHeaders)), {
    authorization: "Bearer display-secret"
  });
  assert.equal(JSON.stringify(internalCandidate.requestHeaders).includes("sid=display-secret"), false);
  assert.notEqual(internalCandidate.sourcePlan?.ffmpegInput?.url, "https://evil.example.test/steal.m3u8");
}

{
  const tabId = 109;
  const sourceUrl = "file:///Volumes/Acer%20SSD%20N5000/MILK-148.mp4";
  seedPage(tabId, { title: "MILK-148.mp4", url: sourceUrl, duration: 7162, currentSrc: sourceUrl });
  add(tabId, {
    url: sourceUrl,
    kind: "video",
    ext: "mp4",
    contentType: "video/mp4",
    duration: 7162,
    source: "media-element",
    sourcePlan: {
      kind: "muxed-media",
      primaryUrl: sourceUrl,
      ffmpegInput: { type: "direct", url: sourceUrl }
    }
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  const internalCandidate = context.resolvePreloadCandidateForStart(context.getState(tabId), {
    ...candidate,
    localMediaFileKey: sourceUrl,
    localMediaFileName: "MILK-148.mp4",
    localMediaFileSize: 5135208353,
    localMediaFileLastModified: 1780000000000,
    sourcePlan: {
      kind: "muxed-media",
      primaryUrl: "file:///tmp/wrong.mp4",
      ffmpegInput: { type: "direct", url: "file:///tmp/wrong.mp4" }
    }
  });
  assert.equal(internalCandidate.localMediaFileKey, sourceUrl);
  assert.equal(internalCandidate.localMediaFileName, "MILK-148.mp4");
  assert.equal(internalCandidate.localMediaFileSize, 5135208353);
  assert.equal(internalCandidate.localMediaFileLastModified, 1780000000000);
  assert.equal(internalCandidate.sourcePlan?.ffmpegInput?.url, sourceUrl);

  const mismatchedLocalFile = context.resolvePreloadCandidateForStart(context.getState(tabId), {
    ...candidate,
    localMediaFileKey: "file:///Volumes/Other/MILK-148.mp4",
    localMediaFileName: "MILK-148.mp4",
    localMediaFileSize: 5135208353
  });
  assert.equal(mismatchedLocalFile.localMediaFileKey, undefined);

  assert.notEqual(
    context.candidateFingerprint({ url: "file:///Volumes/A/720p/movie.mp4", kind: "video" }),
    context.candidateFingerprint({ url: "file:///Volumes/A/1080p/movie.mp4", kind: "video" }),
    "本地 file:// 候选不能沿用在线清晰度路径归一化，否则不同路径可能合并"
  );
}

{
  const rules = context.buildMediaHeaderRules(
    "https://cdn.example.test/media/audio.m4a",
    "https://example.test/watch/1"
  );
  assert.equal(rules.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].condition.requestDomains)), ["cdn.example.test"]);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].action.requestHeaders)), [
    { header: "referer", operation: "set", value: "https://example.test/watch/1" },
    { header: "origin", operation: "set", value: "https://example.test" }
  ]);
  assert.equal(context.buildMediaHeaderRules("https://cdn.example.test/a.m4a", "chrome://extensions").length, 0);
}

{
  const rules = context.buildMediaHeaderRules([
    "https://cdn.example.test/hls/master.m3u8",
    "https://audio-cdn.example.test/hls/variant.m3u8",
    "https://key-cdn.example.test/hls/key.bin"
  ], "https://example.test/watch/1");
  assert.equal(rules.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].condition.requestDomains)), [
    "audio-cdn.example.test",
    "cdn.example.test",
    "key-cdn.example.test"
  ]);
}

{
  const updates = [];
  const originalUpdateSessionRules = chrome.declarativeNetRequest.updateSessionRules;
  chrome.declarativeNetRequest.updateSessionRules = async payload => {
    updates.push(JSON.parse(JSON.stringify(payload)));
  };

  try {
    await context.withMediaRequestHeaderRules(
      "https://cdn.example.test/hls/master.m3u8",
      "https://example.test/watch/1",
      async () => {
        await context.updateMediaRequestHeaderRuleDomains("browser-cross-domain-hls", [
          "https://audio-cdn.example.test/hls/variant.m3u8",
          "https://segment-cdn.example.test/hls/seg-000.ts"
        ]);
      },
      "browser-cross-domain-hls"
    );
  } finally {
    chrome.declarativeNetRequest.updateSessionRules = originalUpdateSessionRules;
  }

  assert.equal(updates.length, 3);
  assert.deepEqual(updates[0].addRules[0].condition.requestDomains, ["cdn.example.test"]);
  assert.deepEqual(updates[1].removeRuleIds, updates[0].removeRuleIds);
  assert.deepEqual(updates[1].addRules[0].condition.requestDomains, [
    "audio-cdn.example.test",
    "cdn.example.test",
    "segment-cdn.example.test"
  ]);
  assert.deepEqual(updates[2], { removeRuleIds: updates[0].removeRuleIds });
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "direct",
    duration: 120,
    chunks: []
  }, 900, 120);
  assert.equal(chunks.length, 0);
  assert.match(
    context.createNoBrowserAudioChunksError({ sourceType: "direct", duration: 120, chunks: [] }).message,
    /没有返回可处理的音频切片/
  );
}

{
  assert.equal(context.browserAudioResultHasOnlyKnownNonspeech({
    sourceType: "direct",
    duration: 120,
    knownNonspeech: true,
    speechIntervals: [],
    chunks: []
  }), true);
  assert.equal(context.browserAudioResultHasOnlyKnownNonspeech({
    sourceType: "direct",
    duration: 120,
    chunks: []
  }), false);
}

{
  const buffer = vm.runInContext("new ArrayBuffer(8)", context);
  const chunks = context.normalizeBrowserAudioChunks({
    duration: 120,
    file: { name: "audio.mp3", mime: "audio/mpeg", buffer }
  }, 900, 120);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].bytes, 8);
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    duration: 120,
    chunks: [{
      index: 0,
      start: 0,
      end: 120,
      duration: 120,
      speechIntervals: [{ start: 10, end: 18 }],
      file: { name: "audio.mp3", mime: "audio/mpeg", cacheUrl: "chrome-extension://test/__fuguang_audio_cache/job/audio.mp3", bytes: 4096 },
      bytes: 4096
    }]
  }, 900, 120);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].bytes, 4096);
  assert.equal(chunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
  assert.equal(JSON.stringify(chunks[0].speechIntervals), JSON.stringify([{ start: 10, end: 18 }]));
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "hls",
    duration: 900,
    chunks: [{
      index: 0,
      start: 0,
      end: 600,
      duration: 600,
      file: {
        name: "logical-001.mp3",
        mime: "audio/mpeg",
        parts: [
          { file: { name: "extract-001.mp3", cacheUrl: "https://fuguang.local/audio/1", bytes: 1024 } },
          { file: { name: "extract-002.mp3", cacheUrl: "https://fuguang.local/audio/2", bytes: 2048 } }
        ]
      }
    }]
  }, 900, 900);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].duration, 600);
  assert.equal(chunks[0].bytes, 3072);
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "direct",
    duration: 120,
    chunks: [{ index: 0, start: 0, end: 120, duration: 120, bytes: 4096 }]
  }, 900, 120);
  assert.equal(chunks.length, 0);
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const jobId = "browser-cache-clear-test";
  const knownUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test/logical-001.mp3";
  const leftoverInternalUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-0/internal-001.mp3";
  const leftoverConcatUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-logical-0/concat.mp3";
  const unrelatedUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-older/keep.mp3";
  await cache.put(knownUrl, new FakeResponse(new Uint8Array([1]).buffer));
  await cache.put(leftoverInternalUrl, new FakeResponse(new Uint8Array([2]).buffer));
  await cache.put(leftoverConcatUrl, new FakeResponse(new Uint8Array([3]).buffer));
  await cache.put(unrelatedUrl, new FakeResponse(new Uint8Array([4]).buffer));

  const removed = await context.clearBrowserAudioCacheForJob(jobId, [{
    file: {
      name: "logical-001.mp3",
      mime: "audio/mpeg",
      cacheUrl: knownUrl,
      bytes: 1
    }
  }]);

  assert.equal(removed, 3);
  assert.equal(await cache.match(knownUrl), undefined);
  assert.equal(await cache.match(leftoverInternalUrl), undefined);
  assert.equal(await cache.match(leftoverConcatUrl), undefined);
  assert.notEqual(await cache.match(unrelatedUrl), undefined);
}

{
  const record = {
    tabId: 3040,
    metadata: { title: "Clear subtitle state" },
    modelConfig: {
      targetLanguage: "zh-CN",
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    audioChunks: [],
    job: {
      id: "browser-clear-subtitle-state",
      status: "completed",
      stage: "completed",
      extract: { elapsedSeconds: 1 },
      translation: {
        vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文\n",
        vttPath: "browser-memory",
        transcript: {
          source: [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }],
          translated: [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }],
          metadata: { title: "Clear subtitle state" }
        },
        segmentCount: 1,
        sourceSegments: 1,
        translatedSegments: 1,
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1 }]
      }
    }
  };
  const originalBroadcast = context.broadcastMessageToFrames;
  const originalTranslate = context.translateBrowserSegments;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  context.broadcastMessageToFrames = async () => {};
  let translationCalls = 0;
  let funAsrCalls = 0;
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "中文译文" }));
  };
  context.transcribeDashScopeFunAsrFile = async () => {
    funAsrCalls += 1;
    return {};
  };
  context.recordForClearSubtitleStateTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-clear-subtitle-state', recordForClearSubtitleStateTest)", context);
  context.setTabStatus(3040, { preload: "completed", preloadJob: record.job, page: { url: "" }, context: { href: "" } });
  try {
    const result = await context.clearPreloadSubtitleState(3040, "browser-clear-subtitle-state");
    const transcript = await context.getPreloadTranscript("browser-clear-subtitle-state");
    assert.equal(result.cleared, true);
    assert.deepEqual(JSON.parse(JSON.stringify(transcript.transcript.source)), [
      { start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(transcript.transcript.translated)), []);
    assert.equal(record.job.translation.vttText, "");
    assert.equal(record.job.translation.segmentCount, 0);
    assert.equal(record.job.translation.sourceSegments, 1);
    assert.equal(record.job.translation.translatedSegments, 0);
    assert.equal(record.job.reusableSourceChunks, 1);
    assert.equal(record.sourceSegmentsByChunk.size, 1);
    assert.equal(record.translatedSegmentsByChunk.size, 0);
    assert.equal(record.job.subtitleCleared, true);

    await context.retryBrowserTranslationOnly(record, [0], { failedOnly: false });
    assert.equal(funAsrCalls, 0);
    assert.equal(translationCalls, 1);
    assert.equal(record.job.translation.transcript.translated[0].text, "中文译文");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-clear-subtitle-state')", context);
    delete context.recordForClearSubtitleStateTest;
    context.broadcastMessageToFrames = originalBroadcast;
    context.translateBrowserSegments = originalTranslate;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
  }
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const now = Date.now();
  const oldUrl = "https://fuguang.local/__fuguang_audio_cache/old-job/1000000000000-old.mp3";
  const oldestUrl = "https://fuguang.local/__fuguang_audio_cache/space-job/1000000001000-oldest.mp3";
  const middleUrl = "https://fuguang.local/__fuguang_audio_cache/space-job/1000000002000-middle.mp3";
  const newestUrl = "https://fuguang.local/__fuguang_audio_cache/space-job/1000000003000-newest.mp3";
  const protectedUrl = "https://fuguang.local/__fuguang_audio_cache/running-job/1000000004000-running.mp3";
  await cache.put(oldUrl, new FakeResponse(new Uint8Array([1]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(now - 120_000), "X-Fuguang-Bytes": "1" }
  }));
  await cache.put(oldestUrl, new FakeResponse(new Uint8Array([2]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(now - 3_000), "X-Fuguang-Bytes": "15" }
  }));
  await cache.put(middleUrl, new FakeResponse(new Uint8Array([3]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(now - 2_000), "X-Fuguang-Bytes": "15" }
  }));
  await cache.put(newestUrl, new FakeResponse(new Uint8Array([4]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(now - 1_000), "X-Fuguang-Bytes": "15" }
  }));
  await cache.put(protectedUrl, new FakeResponse(new Uint8Array([5]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(now - 120_000), "X-Fuguang-Bytes": "999" }
  }));
  vm.runInContext(`
    browserPreloadJobs.set("running-job", {
      job: { id: "running-job", status: "running", stage: "asr" },
      cancelled: false
    });
  `, context);
  try {
    const result = await context.pruneBrowserAudioCache({ maxAgeMs: 60_000, maxBytes: 30 });
    assert.equal(result.removed, 2);
    assert.equal(await cache.match(oldUrl), undefined);
    assert.equal(await cache.match(oldestUrl), undefined);
    assert.notEqual(await cache.match(middleUrl), undefined);
    assert.notEqual(await cache.match(newestUrl), undefined);
    assert.notEqual(await cache.match(protectedUrl), undefined);
  } finally {
    vm.runInContext("browserPreloadJobs.delete('running-job')", context);
  }
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const record = {
    tabId: 3050,
    metadata: { title: "Force ASR rerun" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      chunkSeconds: 900,
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 120, duration: 120, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old translation", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-rerun-asr",
      status: "completed",
      stage: "completed",
      extract: { status: "completed", elapsedSeconds: 1, duration: 120 },
      translation: {
        transcript: {
          source: [{ start: 1, end: 2, text: "old source", chunkIndex: 0, segmentIndex: 0 }],
          translated: [{ start: 1, end: 2, text: "old translation", chunkIndex: 0, segmentIndex: 0 }]
        },
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", attempts: 1, sourceCount: 1, translatedCount: 1 }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0,
        sourceSegments: 1,
        translatedSegments: 1,
        segmentCount: 1
      }
    }
  };
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  const originalLocalGet = chrome.storage.local.get;
  const originalSyncRemove = chrome.storage.sync.remove;
  let asrCalls = 0;
  let translationCalls = 0;
  let observedAsrLanguage = "";
  const targets = [];
  chrome.storage.local.get = async () => ({
    modelSettingsVersion,
    selectedAsrProfileId: "openai_whisper",
    selectedLlmProfileId: "test_llm",
    sourceLanguage: "en",
    targetLanguage: "en",
    asrWorkers: 1,
    translationWorkers: 1,
    chunkMinutes: 15,
    asrProfiles: [
      { id: "openai_whisper", name: "OpenAI Whisper", providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "llm-key" }
    ]
  });
  chrome.storage.sync.remove = async () => {};
  context.transcribeBrowserAudioChunk = async (_chunk, asrConfig) => {
    asrCalls += 1;
    observedAsrLanguage = asrConfig.language || "";
    return [{ start: 3, end: 4, text: "fresh source" }];
  };
  context.translateBrowserSegments = async (_segments, _config, targetLanguage) => {
    translationCalls += 1;
    targets.push(targetLanguage);
    return [{ start: 3, end: 4, text: "新译文", chunkIndex: 0, segmentIndex: 0 }];
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  context.recordForRerunAsrTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-rerun-asr', recordForRerunAsrTest)", context);
  context.setTabStatus(3050, { preload: "completed", preloadJob: record.job, page: { url: "" }, context: { href: "" } });
  try {
    await context.rerunAsrPreload(3050, [0], { sourceLanguage: "ja", targetLanguage: "zh-CN" });

    assert.equal(asrCalls, 1);
    assert.equal(observedAsrLanguage, "ja");
    assert.equal(translationCalls, 1);
    assert.deepEqual(targets, ["zh-CN"]);
    assert.equal(record.modelConfig.asr.language, "ja");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "fresh source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "新译文");
    assert.doesNotMatch(JSON.stringify(record.job.translation.transcript), /old source|old translation/);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-rerun-asr')", context);
    delete context.recordForRerunAsrTest;
    context.transcribeBrowserAudioChunk = originalTranscribe;
    context.translateBrowserSegments = originalTranslate;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.sync.remove = originalSyncRemove;
  }
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const record = {
    tabId: 3051,
    pipeline: "funasr",
    metadata: { title: "Force Fun-ASR rerun" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 7200, duration: 7200, file: { name: "funasr-001.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old funasr source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old funasr translation", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-rerun-funasr",
      pipeline: "funasr",
      status: "completed",
      stage: "completed",
      extract: { status: "completed", elapsedSeconds: 1, duration: 7200 },
      translation: {
        transcript: {
          source: [{ start: 1, end: 2, text: "old funasr source", chunkIndex: 0, segmentIndex: 0 }],
          translated: [{ start: 1, end: 2, text: "old funasr translation", chunkIndex: 0, segmentIndex: 0 }]
        },
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", attempts: 1, sourceCount: 1, translatedCount: 1 }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0,
        sourceSegments: 1,
        translatedSegments: 1,
        segmentCount: 1
      }
    }
  };
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  const originalLocalGet = chrome.storage.local.get;
  const originalSyncRemove = chrome.storage.sync.remove;
  let funAsrCalls = 0;
  let translationCalls = 0;
  let observedFunAsrLanguage = "";
  chrome.storage.local.get = async () => ({
    modelSettingsVersion,
    selectedAsrProfileId: "fun_asr",
    selectedLlmProfileId: "test_llm",
    sourceLanguage: "en",
    targetLanguage: "en",
    asrWorkers: 1,
    translationWorkers: 1,
    chunkMinutes: 15,
    asrProfiles: [
      { id: "fun_asr", name: "Fun-ASR", providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "llm-key" }
    ]
  });
  chrome.storage.sync.remove = async () => {};
  context.transcribeDashScopeFunAsrFile = async (_file, asrConfig) => {
    funAsrCalls += 1;
    observedFunAsrLanguage = asrConfig.language || "";
    return { transcripts: [{ sentences: [{ begin_time: 3000, end_time: 4000, text: "fresh funasr source" }] }] };
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "Fun-ASR 新译文" }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  context.recordForRerunFunAsrTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-rerun-funasr', recordForRerunFunAsrTest)", context);
  context.setTabStatus(3051, { preload: "completed", preloadJob: record.job, page: { url: "" }, context: { href: "" } });
  try {
    await context.rerunAsrPreload(3051, [0], { sourceLanguage: "ja", targetLanguage: "zh-CN" });

    assert.equal(funAsrCalls, 1);
    assert.equal(observedFunAsrLanguage, "ja");
    assert.equal(translationCalls, 1);
    assert.equal(record.modelConfig.asr.language, "ja");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "fresh funasr source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "Fun-ASR 新译文");
    assert.doesNotMatch(JSON.stringify(record.job.translation.transcript), /old funasr/);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-rerun-funasr')", context);
    delete context.recordForRerunFunAsrTest;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
    context.translateBrowserSegments = originalTranslate;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.sync.remove = originalSyncRemove;
  }
}

{
  const record = {
    tabId: 710,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 60,
    job: {
      id: "browser-streaming-logical-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeInternalChunk = index => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    file: {
      name: `internal-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  for (let index = 0; index < 1; index += 1) {
    const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(index));
    assert.equal(emitted.length, 0);
  }
  assert.equal((record.audioChunks || []).length, 0);
  assert.equal(record.job.translation.chunksTotal, 0);

  const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(1));
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].start, 0);
  assert.equal(record.audioChunks[0].end, 60);
  assert.equal(record.audioChunks[0].file.parts.length, 2);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
  assert.equal(record.browserAsrQueue.items.length, 1);
  assert.throws(
    () => context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]),
    /不能直接字节拼接/
  );
}

{
  const record = {
    tabId: 715,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-vad-speech-window-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeInternalChunk = (index, speechIntervals) => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    speechIntervals,
    file: {
      name: `vad-internal-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/vad-${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  assert.equal(context.appendBrowserInternalAudioChunk(record, makeInternalChunk(0, [{ start: 2, end: 8 }])).length, 0);
  const emittedBeforeSilence = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(1, []));
  assert.equal(emittedBeforeSilence.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].start, 0);
  assert.equal(record.audioChunks[0].end, 30);
  assert.equal(record.audioChunks[0].file.name, "vad-internal-0.mp3");
  assert.equal(JSON.stringify(record.audioChunks[0].speechIntervals), JSON.stringify([{ start: 2, end: 8 }]));

  assert.equal(context.appendBrowserInternalAudioChunk(record, makeInternalChunk(2, [{ start: 62, end: 68 }])).length, 0);
  const emittedTail = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emittedTail.length, 1);
  assert.equal(record.audioChunks.length, 2);
  assert.equal(record.audioChunks[1].start, 60);
  assert.equal(record.audioChunks[1].end, 90);
  assert.equal(record.browserAsrQueue.items.length, 2);
  assert.equal(JSON.stringify(record.audioChunks.map(chunk => chunk.file.name)), JSON.stringify(["vad-internal-0.mp3", "vad-internal-2.mp3"]));
}

{
  const record = {
    tabId: 716,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-vad-all-nonspeech-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  context.appendBrowserInternalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    speechIntervals: [],
    file: {
      name: "music-only.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/music-only",
      bytes: 1024
    },
    bytes: 1024
  });
  context.flushBrowserInternalAudioChunks(record, true);

  assert.equal((record.audioChunks || []).length, 0);
  assert.equal(record.browserAsrQueue.items.length, 0);
  assert.equal(context.browserPreloadRecordHasOnlyKnownNonspeechAudio(record), true);
}

{
  const record = {
    tabId: 718,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-weak-vad-empty-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const weakEmptyChunk = index => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    speechIntervals: [],
    speechIntervalsReliable: false,
    file: {
      name: `weak-vad-empty-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/weak-vad-empty-${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  assert.equal(context.appendBrowserInternalAudioChunk(record, weakEmptyChunk(0)).length, 0);
  assert.equal(context.appendBrowserInternalAudioChunk(record, weakEmptyChunk(1)).length, 0);
  const emitted = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].speechIntervalsReliable, false);
  assert.equal(context.shouldSkipBrowserAsrChunk(record.audioChunks[0]), false);
  assert.equal(record.browserAsrQueue.items.length, 1);
}

{
  const record = {
    tabId: 712,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900, asrWorkers: 3, workers: 3 },
    job: {
      id: "browser-logical-direct-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 90, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  const emitted = context.appendBrowserInternalAudioChunk(record, {
    logical: true,
    index: 0,
    start: 0,
    end: 900,
    duration: 900,
    internalChunkCount: 5,
    file: {
      name: "logical-001.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/logical-001.mp3",
      bytes: 5120
    },
    bytes: 5120
  });

  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].file.name, "logical-001.mp3");
  assert.equal(record.audioChunks[0].file.parts, undefined);
  assert.equal(record.browserInternalAudioChunks.length, 0);
  assert.equal(record.browserAsrQueue.items.length, 1);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.doesNotThrow(() => context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]));
  assert.doesNotThrow(
    () => context.assertBrowserAsrChunkCanUpload({
      duration: 900,
      file: {
        name: "duration-only.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/duration-only.mp3",
        bytes: 5120
      }
    })
  );
  assert.throws(
    () => context.assertBrowserAsrChunkCanUpload({
      duration: 60,
      file: {
        name: "too-large.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/too-large.mp3",
        bytes: (25 * 1024 * 1024) + 1
      }
    }),
    /识别音频分段过大/
  );
}

{
  const record = {
    tabId: 713,
    startedAt: Date.now() - 1000,
    metadata: { duration: 1800 },
    modelConfig: { chunkSeconds: 900, asrWorkers: 3, workers: 2 },
    job: {
      id: "browser-asr-upload-decouple-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeLogicalChunk = index => ({
    logical: true,
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    file: {
      name: `asr-upload-${index + 1}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/asr-upload-${index + 1}.mp3`,
      bytes: 4096
    },
    bytes: 4096
  });

  context.appendBrowserInternalAudioChunk(record, makeLogicalChunk(0));
  context.appendBrowserInternalAudioChunk(record, makeLogicalChunk(1));

  assert.equal(record.audioChunks.length, 2);
  assert.equal(record.browserAsrQueue.items.length, 2);
  assert.equal(record.browserTranslationGroups.size, 1);
  assert.equal(record.browserTranslationGroups.get(0).total, 2);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.equal(record.job.translation.chunkStatuses.length, 1);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(0), 0);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(1), 0);
}

{
  const record = {
    tabId: 719,
    startedAt: Date.now() - 1000,
    metadata: { duration: 1800 },
    modelConfig: { chunkSeconds: 900, asrWorkers: 1, workers: 1 },
    job: {
      id: "browser-first-window-translation-races-next-extract",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 35, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const chunk = {
    logical: true,
    index: 0,
    start: 0,
    end: 900,
    coreStart: 0,
    coreEnd: 900,
    duration: 900,
    file: {
      name: "logical-first-window.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/logical-first-window.mp3",
      bytes: 8192
    },
    bytes: 8192
  };

  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  const group = record.browserTranslationGroups.get(0);
  assert.equal(group.closed, true);
  assert.equal(record.browserTranslationQueue.items.length, 0);

  context.completeBrowserAsrChunkForGroup(record, chunk, [
    { start: 10, end: 12, text: "first window source" }
  ]);

  assert.equal(record.browserTranslationQueue.items.length, 1);
  assert.equal(record.browserTranslationQueue.items[0].chunk.index, 0);
  assert.equal(record.browserTranslationQueue.items[0].sourceSegments[0].text, "first window source");
}

{
  const record = {
    tabId: 714,
    startedAt: Date.now() - 1000,
    metadata: { duration: 90 },
    modelConfig: { chunkSeconds: 30, asrWorkers: 1, workers: 1 },
    job: {
      id: "browser-asr-core-ownership-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  context.appendBrowserInternalAudioChunk(record, {
    logical: true,
    index: 1,
    start: 28,
    end: 62,
    coreStart: 30,
    coreEnd: 60,
    duration: 34,
    coreDuration: 30,
    file: {
      name: "asr-upload-overlap-002.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/asr-upload-overlap-002.mp3",
      bytes: 4096
    },
    bytes: 4096
  });

  assert.equal(record.audioChunks[0].start, 28);
  assert.equal(record.audioChunks[0].coreStart, 30);
  assert.equal(context.browserTranslationGroupIndex(record, record.audioChunks[0]), 1);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(1), 1);
}

{
  const record = {
    tabId: 711,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-streaming-tail-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 99, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  context.appendBrowserInternalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    file: {
      name: "tail.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/tail",
      bytes: 2048
    },
    bytes: 2048
  });
  assert.equal((record.audioChunks || []).length, 0);
  const emitted = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks[0].duration, 30);
  assert.equal(record.audioChunks[0].file.name, "tail.mp3");
  assert.equal(record.browserAsrQueue.items.length, 1);
  context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]);
}

{
  const tabId = 201;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now() - 10_000;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 5) {
      return { ok: true, state: { currentTime: 12, duration: 600 } };
    }
    return null;
  };
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 0);
  assert.equal(context.getState(tabId).mediaFrameId, 5);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 202;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now() - 10_000;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async () => null;
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 1);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 2021;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now();
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }];
  chrome.tabs.sendMessage = async () => null;
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 1);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 203;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.attachedVttSignature = "job-1:10:10:translated";

  context.suppressPreloadSubtitleAttachment(tabId, "job-1");

  assert.equal(state.attachedVttSignature, "");
  assert.equal(context.isPreloadSubtitleAttachmentSuppressed(tabId, "job-1"), true);
  assert.equal(context.isPreloadSubtitleAttachmentSuppressed(tabId, "job-2"), false);
  assert.equal(context.withSubtitleSuppression({ id: "job-1", status: "completed" }, tabId).subtitleCleared, true);
  assert.equal(context.withSubtitleSuppression({ id: "job-2", status: "completed" }, tabId).subtitleCleared, undefined);
}

{
  const record = {
    tabId: 211,
    startedAt: Date.now() - 1000,
    metadata: { duration: 60 },
    modelConfig: { chunkSeconds: 30, asrWorkers: 1, workers: 1 },
    audioChunks: [],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-asr-source-preview",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const chunk = {
    logical: true,
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "preview-source.mp3", buffer: new ArrayBuffer(1), mime: "audio/mpeg" }
  };
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.attachBrowserJobVttIfReady = async () => {};
  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  record.browserTranslationGroups.get(0).closed = true;

  context.completeBrowserAsrChunkForGroup(record, chunk, [
    { start: 1, end: 2, text: "source preview" }
  ]);

  assert.equal(record.job.translation.vttPath, "browser-memory");
  assert.match(record.job.translation.vttText, /source preview/);
  assert.equal(record.job.translation.sourceSegments, 1);
  assert.equal(record.job.translation.translatedSegments, 0);
  assert.equal(record.job.translation.segmentCount, 1);
  assert.equal(record.job.translation.transcript.source[0].text, "source preview");
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 212,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map([
      [0, [{ start: 10, end: 120, text: "only the first part", chunkIndex: 0, segmentIndex: 0 }]]
    ]),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-short-coverage-warning",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.match(result.coverageWarning, /字幕只覆盖到/);
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed_with_warnings");
  assert.match(record.job.error, /预计/);
}

{
  const record = {
    tabId: 213,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map([
      [0, [{ start: 10, end: 570, text: "nearly full coverage", chunkIndex: 0, segmentIndex: 0 }]]
    ]),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-good-coverage-completed",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.equal(result.coverageWarning, "");
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed");
  assert.equal(record.job.error, "");
  assert.equal(
    context.browserCompletionAllowsAudioRelease(result),
    false,
    "成功完成后仍应保留音频缓存供诊断导出和失败复盘，直到用户显式清理"
  );
}

{
  const record = {
    tabId: 214,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-no-subtitle-coverage-warning",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.match(result.coverageWarning, /没有生成可显示字幕/);
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed_with_warnings");
  assert.match(record.job.error, /没有生成可显示字幕/);
}

{
  const tabId = 204;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const sentTypes = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      sentTypes.push("detach");
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentTypes.push("attach");
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachVttText(tabId, "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n");
  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-after-manual",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n"]);
  assert.deepEqual(sentTypes, ["detach", "attach"]);
  assert.match(state.manualVttSignature, /^manual:/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 205;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-without-manual",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 215;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-partial-source-fallback",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        segmentCount: 2,
        chunksDone: 1,
        vttText: [
          "WEBVTT",
          "",
          "00:00:00.000 --> 00:00:02.000",
          "source first",
          "",
          "00:00:03.000 --> 00:00:05.000",
          "translated second",
          ""
        ].join("\n"),
        transcript: {
          source: [
            { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
            { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
          ],
          translated: [
            { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
          ]
        }
      }
    }
  });

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /source first/);
  assert.match(sentVtts[0], /translated second/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 216;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-failed-source-only",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource only\n",
        transcript: {
          source: [{ start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }],
          translated: []
        }
      }
    }
  });

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /source only/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 218;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  let attachedSignature = "";
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: attachedSignature } };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      attachedSignature = message.signature;
      return { ok: true };
    }
    return null;
  };

  const record = {
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-running-partial-source-preview",
      status: "running",
      stage: "translation",
      translation: {
        segmentCount: 2,
        chunksDone: 0,
        vttText: [
          "WEBVTT",
          "",
          "00:00:00.000 --> 00:00:02.000",
          "source first",
          "",
          "00:00:03.000 --> 00:00:05.000",
          "translated second",
          ""
        ].join("\n"),
        transcript: {
          source: [
            { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
            { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
          ],
          translated: [
            { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
          ]
        }
      }
    }
  };

  await context.attachBrowserJobVttIfReady(record);
  record.job.translation.segmentCount = 3;
  record.job.translation.chunksDone = 1;
  record.job.translation.transcript.source.push(
    { start: 6, end: 8, text: "source third", chunkIndex: 0, segmentIndex: 2 }
  );
  await context.attachBrowserJobVttIfReady(record);

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /translated second/);
  assert.doesNotMatch(sentVtts[0], /source first/);
  assert.doesNotMatch(sentVtts[0], /source second/);
  assert.doesNotMatch(sentVtts[0], /source third/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 217;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-running-source-only",
      status: "running",
      stage: "translation",
      translation: {
        segmentCount: 1,
        chunksDone: 0,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource only while running\n",
        transcript: {
          source: [{ start: 0, end: 2, text: "source only while running", chunkIndex: 0, segmentIndex: 0 }],
          translated: []
        }
      }
    }
  });

  assert.deepEqual(sentVtts, []);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 207;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  state.attachedVttSignature = "browser-auto-reattach:1:1:translated";
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: "" } };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-reattach",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 210;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  let attachedSignature = "";
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: attachedSignature } };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      attachedSignature = message.signature;
      return { ok: true };
    }
    return null;
  };
  const record = {
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-vtt-change",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold text\n"
      }
    }
  };

  await context.attachBrowserJobVttIfReady(record);
  record.job.translation.vttText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew text\n";
  await context.attachBrowserJobVttIfReady(record);

  assert.deepEqual(sentVtts, [
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold text\n",
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew text\n"
  ]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 209;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n";
  const signature = `manual:${context.vttContentSignature(vtt)}`;
  state.attachedVttSignature = signature;
  state.manualVttSignature = signature;
  const sentTypes = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: "" } };
    }
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      sentTypes.push("detach");
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentTypes.push("attach");
      return { ok: true };
    }
    return null;
  };

  await context.attachVttText(tabId, vtt);

  assert.deepEqual(sentTypes, ["detach", "attach"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 206;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  state.mediaFrameId = 5;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT" && options.frameId === 5) {
      return { ok: true };
    }
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 5) {
      return { ok: true, state: { currentTime: 22, duration: 600 } };
    }
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 0) {
      return { ok: true, state: { currentTime: 3, duration: 600 } };
    }
    return null;
  };

  await context.attachVttText(tabId, "WEBVTT\n\n00:00:20.000 --> 00:00:24.000\nmanual cache\n");
  state.mediaFrameId = 0;
  const response = await context.getVideoState(tabId);

  assert.equal(state.subtitleFrameId, 5);
  assert.equal(response.state.currentTime, 22);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 208;
  const state = seedPage(tabId, { duration: 600 });
  state.context.currentTime = 18;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async () => null;

  const response = await context.getVideoState(tabId);

  assert.equal(response.state.currentTime, 18);
  assert.equal(response.state.synthetic, true);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const sourceSegment = { start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 };
  const record = {
    tabId: 300,
    startedAt: Date.now() - 1000,
    metadata: { title: "Translation failure keeps source only" },
    modelConfig: {
      targetLanguage: "zh-CN",
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, [sourceSegment]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-translation-failure-source-only",
      status: "running",
      stage: "translation",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "queued", status: "等待", attempts: 1 }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const originalTranslate = context.translateBrowserSegments;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.translateBrowserSegments = async () => {
    throw new Error("mock translation failed");
  };
  context.attachBrowserJobVttIfReady = async () => {};

  await context.processBrowserTranslationChunk(record, { index: 0 }, [sourceSegment]);

  assert.deepEqual(JSON.parse(JSON.stringify(record.translatedSegmentsByChunk.get(0))), []);
  assert.deepEqual(JSON.parse(JSON.stringify(record.job.translation.transcript.translated)), []);
  assert.equal(record.job.translation.transcript.source[0].text, "hello");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "failed");
  assert.match(record.job.translation.chunkStatuses[0].error, /翻译失败/);
  context.translateBrowserSegments = originalTranslate;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const originalFetch = context.fetch;
  const calls = [];
  context.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "response_format is not supported by this compatible endpoint" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: "兼容接口译文" }] })
          }
        }]
      })
    };
  };

  const items = await context.requestBrowserTranslationItems(
    [{ start: 1, end: 2, text: "hello" }],
    { providerType: "openai", baseUrl: "https://llm-compatible.test/v1", model: "test", apiKey: "test" },
    "zh-CN",
    { title: "response_format fallback" },
    { timeoutMs: 1000 }
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(body => Object.hasOwn(body, "response_format")), [true, false]);
  assert.equal(items[0].text, "兼容接口译文");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const calls = [];
  context.fetch = async (_url, init = {}) => {
    calls.push(JSON.parse(init.body));
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid api key" } })
    };
  };

  await assert.rejects(
    context.requestBrowserTranslationItems(
      [{ start: 1, end: 2, text: "hello" }],
      { providerType: "openai", baseUrl: "https://llm-invalid-key-compatible.test/v1", model: "test", apiKey: "bad" },
      "zh-CN",
      { title: "response_format fallback negative" },
      { timeoutMs: 1000 }
    ),
    /invalid api key/
  );
  assert.equal(calls.length, 1);
  assert.equal(Object.hasOwn(calls[0], "response_format"), true);
  context.fetch = originalFetch;
}

{
  const sourceSegments = [
    { start: 1, end: 2, text: "ok-a", chunkIndex: 0, segmentIndex: 0 },
    { start: 2, end: 3, text: "bad", chunkIndex: 0, segmentIndex: 1 },
    { start: 3, end: 4, text: "ok-c", chunkIndex: 0, segmentIndex: 2 }
  ];
  const record = {
    tabId: 303,
    startedAt: Date.now() - 1000,
    metadata: { title: "Translation partial failure keeps only real translations" },
    modelConfig: {
      targetLanguage: "zh-CN",
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, sourceSegments]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-translation-partial-failure",
      status: "running",
      stage: "translation",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "queued", status: "等待", attempts: 1 }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const originalFetch = context.fetch;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text === "bad") {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  context.attachBrowserJobVttIfReady = async () => {};

  await context.processBrowserTranslationChunk(record, { index: 0 }, sourceSegments);

  assert.equal(JSON.stringify(record.translatedSegmentsByChunk.get(0).map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.equal(JSON.stringify(record.job.translation.transcript.translated.map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.equal(record.job.translation.transcript.translated.some(segment => segment.text === "bad"), false);
  assert.match(record.job.translation.vttText, /bad/);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed_with_warnings");
  assert.match(record.job.translation.chunkStatuses[0].error, /部分句子翻译失败/);
  context.fetch = originalFetch;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 301,
    metadata: { title: "Retry translation only" },
    modelConfig: {
      asrWorkers: 3,
      workers: 2,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3" } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-retry-translation-only",
      status: "failed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          attempts: 1,
          sourceCount: 1,
          translatedCount: 1,
          error: "翻译失败"
        }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let asrCalls = 0;
  let translationCalls = 0;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async () => {
    asrCalls += 1;
    return [{ start: 1, end: 2, text: "fresh asr" }];
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "译文" }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFailedPreload(record, [0]);

  assert.equal(asrCalls, 0);
  assert.equal(translationCalls, 1);
  assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "译文");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 3014,
    metadata: { title: "Retranslate must not keep wrong-language stale translation" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3" } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old English", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-retry-clears-stale-translation",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          attempts: 1,
          sourceCount: 1,
          translatedCount: 1,
          error: "翻译失败"
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let funAsrCalls = 0;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeDashScopeFunAsrFile = async () => {
    funAsrCalls += 1;
    return { transcripts: [{ begin_time: 1000, end_time: 2000, text: "fresh asr" }] };
  };
  context.translateBrowserSegments = async () => {
    throw new Error("mock translation rate limited");
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFailedPreload(record, [0]);

  assert.equal(funAsrCalls, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(record.translatedSegmentsByChunk.get(0))), []);
  assert.equal(record.job.translation.transcript.source[0].text, "こんにちは");
  assert.deepEqual(JSON.parse(JSON.stringify(record.job.translation.transcript.translated)), []);
  assert.doesNotMatch(JSON.stringify(record.job.translation.transcript), /old English/);
  assert.match(record.job.translation.chunkStatuses[0].error, /未生成译文/);
  context.transcribeDashScopeFunAsrFile = originalFunAsr;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 3011,
    pipeline: "funasr",
    metadata: { title: "Fun-ASR retry translation only" },
    modelConfig: {
      asrWorkers: 1,
      workers: 2,
      targetLanguage: "zh-CN",
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 7200, duration: 7200, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "funasr-retry-translation-only",
      pipeline: "funasr",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1, duration: 7200 },
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          attempts: 1,
          sourceCount: 1,
          translatedCount: 0,
          error: "翻译失败"
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let funAsrCalls = 0;
  let translationCalls = 0;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeDashScopeFunAsrFile = async () => {
    funAsrCalls += 1;
    return { transcripts: [{ begin_time: 1000, end_time: 2000, text: "fresh asr" }] };
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "译文" }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFunAsrFailedPreload(record, [0]);

  assert.equal(funAsrCalls, 0);
  assert.equal(translationCalls, 1);
  assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "译文");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  context.transcribeDashScopeFunAsrFile = originalFunAsr;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 3015,
    metadata: { title: "Retranslate preserves previous translation on failure" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3" } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-retranslate-preserve-on-failure",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        transcript: {
          source: [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }],
          translated: [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]
        },
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          attempts: 1,
          sourceCount: 1,
          translatedCount: 1,
          error: "翻译失败"
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.translateBrowserSegments = async () => {
    throw new Error("Too many requests");
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  try {
    await context.retryBrowserTranslationOnly(record, [0], { failedOnly: false, resetAttempts: true });
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "旧译文");
    assert.equal(record.job.translation.transcript.translated[0].text, "旧译文");
    assert.equal(record.job.translation.chunkStatuses[0].stage, "failed");
    assert.match(record.job.translation.chunkStatuses[0].error, /已保留已有译文/);
  } finally {
    context.translateBrowserSegments = originalTranslate;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const originalLocalGet = chrome.storage.local.get;
  const originalLocalSet = chrome.storage.local.set;
  const originalSyncRemove = chrome.storage.sync.remove;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  const stored = {
    modelSettingsVersion,
    selectedAsrProfileId: "openai_whisper",
    selectedLlmProfileId: "test_llm",
    targetLanguage: "zh-CN",
    asrProfiles: [
      { id: "openai_whisper", name: "OpenAI Whisper", providerType: "openai", baseUrl: "https://api.openai.com/v1", model: "whisper-1", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.current/v1", model: "current-llm", apiKey: "llm-key" }
    ],
    translationWorkers: 1
  };
  const record = {
    tabId: 3012,
    metadata: { title: "Retranslate uses current target language" },
    modelConfig: {
      asrWorkers: 1,
      workers: 2,
      targetLanguage: "en",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.old/v1", model: "old-llm", apiKey: "old" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3" } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "こんにちは", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-current-target-language",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "failed", status: "失败", attempts: 1, sourceCount: 1, translatedCount: 0 }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let observedTarget = "";
  let observedModel = "";
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async () => {};
  chrome.storage.sync.remove = async () => {};
  context.translateBrowserSegments = async (segments, config, targetLanguage) => {
    observedTarget = targetLanguage;
    observedModel = config.model;
    return segments.map(segment => ({ ...segment, text: "中文译文" }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  context.recordForCurrentTargetLanguageTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-current-target-language', recordForCurrentTargetLanguageTest)", context);
  context.setTabStatus(3012, { preload: "completed", preloadJob: record.job, page: { url: "" }, context: { href: "" } });
  try {
    await context.retranslatePreload(3012, [0]);
    assert.equal(observedTarget, "zh-CN");
    assert.equal(observedModel, "current-llm");
    assert.equal(record.modelConfig.targetLanguage, "zh-CN");
    assert.equal(record.job.translation.targetLanguage, "zh-CN");
    assert.equal(record.job.translation.chunkStatuses[0].attempts, 1);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-current-target-language')", context);
    delete context.recordForCurrentTargetLanguageTest;
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.local.set = originalLocalSet;
    chrome.storage.sync.remove = originalSyncRemove;
    context.translateBrowserSegments = originalTranslate;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const originalLocalGet = chrome.storage.local.get;
  const originalLocalSet = chrome.storage.local.set;
  const originalSyncRemove = chrome.storage.sync.remove;
  const originalTranslate = context.translateBrowserSegments;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  const stored = {
    modelSettingsVersion,
    selectedAsrProfileId: "fun_asr",
    selectedLlmProfileId: "test_llm",
    targetLanguage: "zh-CN",
    asrProfiles: [
      { id: "fun_asr", name: "Fun-ASR", providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.current/v1", model: "current-llm", apiKey: "llm-key" }
    ],
    translationWorkers: 1
  };
  let observedTarget = "";
  let observedModel = "";
  let funAsrCalls = 0;
  let asrCalls = 0;
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async () => {};
  chrome.storage.sync.remove = async () => {};
  context.translateBrowserSegments = async (segments, config, targetLanguage) => {
    observedTarget = targetLanguage;
    observedModel = config.model;
    return segments.map(segment => ({ ...segment, text: `中文-${segment.text}` }));
  };
  context.transcribeDashScopeFunAsrFile = async () => {
    funAsrCalls += 1;
    return {};
  };
  context.transcribeBrowserAudioChunk = async () => {
    asrCalls += 1;
    return [];
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  try {
    const result = await context.retranslateCachedTranscript(3013, {
      metadata: { title: "Cached source", pageUrl: "https://example.test/watch", sourceUrl: "https://media.example.test/video.m3u8" },
      source: [
        { start: 1, end: 2, text: "こんにちは" },
        { start: 3, end: 4, text: "Oh." }
      ],
      translated: []
    }, { title: "Cached source" });
    assert.equal(funAsrCalls, 0);
    assert.equal(asrCalls, 0);
    assert.equal(observedTarget, "zh-CN");
    assert.equal(observedModel, "current-llm");
    assert.equal(result.job.pipeline, "cached-transcript");
    assert.equal(result.job.translation.transcript.translated[0].text, "中文-こんにちは");
    assert.equal(result.job.translation.transcript.translated[1].text, "中文-Oh.");
  } finally {
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.local.set = originalLocalSet;
    chrome.storage.sync.remove = originalSyncRemove;
    context.translateBrowserSegments = originalTranslate;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
    context.transcribeBrowserAudioChunk = originalTranscribe;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  await assert.rejects(
    () => context.retranslateCachedTranscript(3015, {
      metadata: { title: "Translated-only cache" },
      translated: [
        { start: 1, end: 2, text: "old English" }
      ]
    }, { title: "Translated-only cache" }),
    /没有可复用的 ASR 原文/
  );
}

{
  const record = {
    tabId: 302,
    metadata: { title: "Resume ASR from cached audio" },
    modelConfig: {
      asrWorkers: 2,
      workers: 2,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [
      { index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } },
      { index: 1, start: 900, end: 1800, file: { name: "chunk-002.mp3", buffer: new ArrayBuffer(1) } }
    ],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-resume-asr-from-audio",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [
          { index: 0, stage: "queued", status: "排队", attempts: 0 },
          { index: 1, stage: "queued", status: "排队", attempts: 0 }
        ],
        chunksTotal: 2,
        chunksDone: 0,
        chunksFailed: 0,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let asrCalls = 0;
  let translationCalls = 0;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async chunk => {
    asrCalls += 1;
    return [{ start: chunk.start + 1, end: chunk.start + 2, text: `source-${chunk.index}` }];
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: `译文-${segment.chunkIndex}` }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFailedPreload(record);

  assert.equal(asrCalls, 2);
  assert.equal(translationCalls, 2);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  assert.equal(record.job.translation.chunkStatuses[1].stage, "completed");
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 303,
    metadata: { title: "Retry ASR failure stays per chunk" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } }],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-retry-asr-failed",
      status: "failed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "failed", status: "失败", attempts: 1, error: "old" }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async () => {
    throw new Error("Failed to fetch");
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  const result = await context.retryBrowserFailedPreload(record, [0]);

  assert.equal(result.job.status, "completed");
  assert.equal(result.job.stage, "completed_with_warnings");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "failed");
  assert.match(record.job.translation.chunkStatuses[0].error, /Failed to fetch/);
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const timeoutMs = context.normalizeAsrTimeoutMs(undefined, { start: 0, end: 900 });
  assert.ok(timeoutMs >= 900_000, `15 分钟 ASR 音频切片不应仍使用 45 秒超时，实际 ${timeoutMs}`);
}

{
  const record = {
    job: {
      translation: {
        chunkStatuses: [
          { index: 0, stage: "failed", error: "ASR 请求超时" },
          { index: 1, stage: "failed", error: "ASR 请求超时" }
        ]
      }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  assert.equal(
    context.browserFailureSummary(record),
    "有 2 个识别分段失败，没有可显示的原文；请检查 ASR 服务后重试。"
  );
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" },
                          condition_on_previous_text: { type: "boolean" },
                          no_speech_threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          vad_parameters: { type: "string" },
                          temperature: { type: "number" },
                          without_timestamps: { type: "boolean" },
                          hallucination_silence_threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 0, end: 1, text: "ok" }]
      })
    };
  };
  const clientVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 0,
      end: 120,
      speechIntervals: [{ start: 0, end: 120 }],
      file: { name: "chunk.wav", buffer: new ArrayBuffer(1), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://client-vad-compatible.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(clientVadSegments.length, 1);
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.equal(postedFields.some(([name, value]) => name === "word_timestamps" && value === "true"), true);
  assert.equal(postedFields.some(([name, value]) => name === "condition_on_previous_text" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "without_timestamps" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "temperature" && value === "0"), true);
  assert.equal(postedFields.some(([name]) => name === "vad_parameters"), false);
  assert.equal(postedFields.some(([name]) => name === "threshold"), false);
  assert.equal(postedFields.some(([name]) => name === "min_speech_duration_ms"), false);
  assert.equal(postedFields.some(([name]) => name === "max_speech_duration_s"), false);
  assert.equal(postedFields.some(([name]) => name === "min_silence_duration_ms"), false);
  assert.equal(postedFields.some(([name]) => name === "speech_pad_ms"), false);
  assert.equal(postedFields.some(([name, value]) => name === "no_speech_threshold" && value === "0.6"), true);
  assert.equal(postedFields.some(([name]) => name === "hallucination_silence_threshold"), false);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requested = [];
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          file: { type: "string", format: "binary" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1, end: 2, text: "speech missed by precheck" }]
      })
    };
  };
  const emptyVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "silent.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-vad-empty.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(Array.isArray(emptyVadSegments), true);
  assert.equal(emptyVadSegments.length, 1);
  assert.equal(emptyVadSegments[0].text, "speech missed by precheck");
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/speech/timestamps", "POST"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let recoveryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" },
                          condition_on_previous_text: { type: "boolean" },
                          no_speech_threshold: { type: "number" },
                          temperature: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          file: { type: "string", format: "binary" },
                          threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return { ok: true, json: async () => ({ segments: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 9.94, end: 29.98, text: "this retry segment spans a long uncertain region and needs reliable evidence" },
          { start: 8.12, end: 8.96, text: "quick reply" },
          { start: 13.44, end: 15.06, text: "clear recovered phrase" }
        ]
      })
    };
  };
  const recoveredEmptyVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 25,
      start: 642,
      end: 672,
      duration: 30,
      coreStart: 644,
      coreEnd: 670,
      file: { name: "empty-vad-recovery.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-empty-vad-recovery.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "on"
    },
    { onDiagnostics: diagnostics => { recoveryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "vad_filter"), false);
  assert.equal(recoveredEmptyVadSegments.length, 2);
  assert.equal(JSON.stringify(recoveredEmptyVadSegments.map(segment => segment.text)), JSON.stringify([
    "quick reply",
    "clear recovered phrase"
  ]));
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryFilterApplied, true);
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryInputFinalCount, 3);
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryFinalCount, 2);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requested = [];
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          file: { type: "string", format: "binary" },
                          threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.1, end: 1.8, text: "native internal vad speech" }]
      })
    };
  };
  const nativeInternalVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 12,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-internal-vad.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-internal-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(JSON.stringify(nativeInternalVadSegments.map(segment => segment.text)), JSON.stringify(["native internal vad speech"]));
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async () => ({
    ok: true,
    result: {
      chunks: [
        {
          index: 0,
          start: 30,
          end: 32.4,
          duration: 2.4,
          sourceStart: 30,
          sourceEnd: 32.4,
          speechIntervals: [{ start: 30, end: 32.4 }],
          timeMap: [{ outputStart: 0, outputEnd: 2.4, sourceStart: 30, sourceEnd: 32.4 }],
          file: { name: "speech-only-vad-filter.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
          bytes: 4
        }
      ]
    }
  });
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          file: { type: "string", format: "binary" },
                          threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [{ start: 0, end: 2400 }] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 0.2, end: 1.4, text: "real speech" },
          { start: 10, end: 12, text: "static tail" }
        ]
      })
    };
  };
  const vadFilteredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "speech.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-vad-filter.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(vadFilteredSegments.length, 1);
  assert.equal(vadFilteredSegments[0].text, "real speech");
  assert.equal(vadFilteredSegments[0].start, 30.2);
  assert.equal(vadFilteredSegments[0].end, 31.4);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 10000, end: 12000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 9.7,
          end: 12.4,
          text: "native prefix middle suffix",
          words: [
            { text: "native", start: 9.7, end: 9.95, probability: 0.9 },
            { text: "prefix", start: 10, end: 10.3, probability: 0.91 },
            { text: "middle", start: 10.4, end: 11.6, probability: 0.94 },
            { text: "suffix", start: 12.05, end: 12.35, probability: 0.9 }
          ]
        }]
      })
    };
  };
  const nativeSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 6,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "speaches-native.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(postedFields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.equal(nativeSpeachesSegments.length, 1);
  assert.equal(nativeSpeachesSegments[0].text, "native prefix middle suffix");
  assert.equal(nativeSpeachesSegments[0].start, 39.7);
  assert.equal(nativeSpeachesSegments[0].end, 42.35);
  assert.equal(nativeDiagnostics.postprocess.matureVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.speechActivityFilterApplied, true);
  assert.equal(nativeDiagnostics.postprocess.customRunFiltersDisabled, false);
  assert.equal(nativeDiagnostics.postprocess.vadHallucinationGuardDisabled, false);
  assert.deepEqual(nativeDiagnostics.postprocess.segmentCounts, {
    normalized: 1,
    speechFiltered: 1,
    hallucinationFiltered: 1,
    final: 1
  });
  assert.deepEqual(nativeDiagnostics.postprocess.dropCounts, {
    speechActivity: 0,
    hallucinationGuard: 0,
    chunkOwnership: 0,
    total: 0
  });
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: false, status: 500, json: async () => ({ message: "temporary VAD failure" }) };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: Array.from({ length: 6 }, (_, index) => ({
          start: index,
          end: index + 0.25,
          text: "うん"
        }))
      })
    };
  };
  const nativeSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 7,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-vad-error.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-vad-error.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(postedFields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.equal(nativeSegments.length, 6);
  assert.equal(JSON.stringify(nativeSegments.map(segment => segment.text)), JSON.stringify(["うん", "うん", "うん", "うん", "うん", "うん"]));
  assert.equal(nativeDiagnostics.vad, null);
  assert.equal(nativeDiagnostics.matureAsrPlan.vad.precheckState, "native");
  assert.equal(nativeDiagnostics.postprocess.matureVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.externalVadServiceAvailable, false);
  assert.equal(nativeDiagnostics.postprocess.nativeVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.customRunFiltersDisabled, false);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [{ start: 1000, end: 4000 }] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 1.1,
          end: 3.7,
          text: "これは本当に話した内容です",
          no_speech_prob: 0.7,
          avg_logprob: -1.1
        }]
      })
    };
  };
  const retainedQualitySegments = await context.transcribeBrowserAudioChunk(
    {
      index: 8,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-quality.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-quality.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(retainedQualitySegments.length, 1);
  assert.equal(retainedQualitySegments[0].text, "これは本当に話した内容です");
  assert.equal(nativeDiagnostics.postprocess.qualityFiltersDisabled, true);
  assert.equal(nativeDiagnostics.postprocess.dropCounts.total, 0);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  const vadPostedFields = [];
  let capturedDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      vadPostedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
      return {
        ok: true,
        json: async () => [
          { start: 1000, end: 3200 },
          { start: 7000, end: 9000 }
        ]
      };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1.2, end: 2.4, text: "clip speech" },
          { start: 7.2, end: 8.4, text: "clip speech tail" }
        ]
      })
    };
  };
  const clippedSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 1,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-compatible.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { capturedDiagnostics = diagnostics; } }
  );
  assert.equal(clippedSegments.length, 2);
  assert.equal(clippedSegments[0].text, "clip speech");
  assert.equal(clippedSegments[1].text, "clip speech tail");
  assert.equal(vadPostedFields.some(([name, value]) => name === "threshold" && value === "0.15"), true);
  assert.equal(vadPostedFields.some(([name, value]) => name === "min_speech_duration_ms" && value === "0"), true);
  assert.equal(postedFields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(postedFields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(postedFields.some(([name]) => name === "vad_parameters"), false);
  assert.equal(capturedDiagnostics.matureAsrPlan.strategy, "speaches_faster_whisper");
  assert.equal(capturedDiagnostics.matureAsrPlan.request.mode, "external_vad_clip");
  assert.equal(capturedDiagnostics.matureAsrPlan.vad.precheckState, "reliable");
  assert.equal(capturedDiagnostics.matureAsrPlan.clipTimestamps, "1,9");
  assert.equal(capturedDiagnostics.matureAsrPlan.postprocessPolicy.matureVadRequest, true);
  assert.equal(capturedDiagnostics.vad.requestFields.some(([name, value]) => name === "threshold" && value === "0.15"), true);
  assert.equal(capturedDiagnostics.vad.requestFields.some(([name, value]) => name === "min_speech_duration_ms" && value === "0"), true);
  assert.equal(capturedDiagnostics.request.fields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(capturedDiagnostics.request.fields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(capturedDiagnostics.postprocess.policySource, "matureAsrPlan");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 10000, end: 12000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 9.7,
          end: 12.4,
          text: "prefix middle suffix",
          words: [
            { text: "prefix", start: 9.7, end: 10.05, probability: 0.91 },
            { text: "middle", start: 10.1, end: 11.7, probability: 0.94 },
            { text: "suffix", start: 12.05, end: 12.35, probability: 0.9 }
          ]
        }]
      })
    };
  };
  const driftedClipSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 3,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-edge-drift.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-edge-drift.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(postedFields.some(([name, value]) => name === "clip_timestamps" && value === "10,12"), true);
  assert.equal(driftedClipSegments.length, 1);
  assert.equal(driftedClipSegments[0].text, "prefix middle suffix");
  assert.equal(driftedClipSegments[0].start, 39.7);
  assert.equal(driftedClipSegments[0].end, 42.35);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 9700, end: 10400 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 9.7, end: 10.4, text: "おやすみなさい" }]
      })
    };
  };
  const suspiciousButSpokenSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 4,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-suspicious-spoken.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-suspicious-spoken.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(suspiciousButSpokenSegments.length, 1);
  assert.equal(suspiciousButSpokenSegments[0].text, "おやすみなさい");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 18000 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: Array.from({ length: 6 }, (_, index) => ({
          start: 1 + index * 2.6,
          end: 1.8 + index * 2.6,
          text: index % 2 ? "うん" : "嗯"
        }))
      })
    };
  };
  const conversationalBackchannels = await context.transcribeBrowserAudioChunk(
    {
      index: 5,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-backchannels.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-backchannels.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(conversationalBackchannels.length, 6);
  assert.equal(JSON.stringify(conversationalBackchannels.map(segment => segment.text)), JSON.stringify(["嗯", "うん", "嗯", "うん", "嗯", "うん"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [
          { start: 1000, end: 2000 },
          { start: 7000, end: 9000 }
        ]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.1, end: 1.8, text: "first clip only" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 7.2, end: 8.6, text: "second clip" }
        ]
      })
    };
  };
  const recoveredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 2,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-retry.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(retryDiagnostics.clipTimestampsAttempt.request.fields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(retryDiagnostics.clipTimestampsAttempt.request.fields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(retryDiagnostics.request.fields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(retryDiagnostics.retry.request.fields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(recoveredSegments.map(segment => segment.text)), JSON.stringify(["first clip only", "second clip"]));
  assert.equal(recoveredSegments[1].start, 37.2);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [
          { start: 1000, end: 2000 },
          { start: 7000, end: 9000 }
        ]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.1, end: 1.8, text: "initial covered interval" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1.2, end: 1.7, text: "retry extra in covered interval" },
          { start: 7.05, end: 7.35, text: "low quality retry drift", compression_ratio: 9.1, no_speech_prob: 0.1 },
          { start: 7.2, end: 8.4, text: "retry covers missing interval" }
        ]
      })
    };
  };
  const recoveredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 22,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-retry-gap-only.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-retry-gap-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(JSON.stringify(recoveredSegments.map(segment => [
    Math.round(segment.start * 10) / 10,
    Math.round(segment.end * 10) / 10
  ])), JSON.stringify([
    [31.1, 31.8],
    [37.2, 38.4]
  ]));
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryFilterApplied, true);
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryInputFinalCount, 2);
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryFinalCount, 1);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" },
                          no_speech_threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 7000, end: 9000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (!fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return { ok: true, json: async () => ({ segments: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1, end: 13, text: "long uncertain drift" },
          {
            start: 7.2,
            end: 8.4,
            text: "recovered sentence",
            words: [
              { start: 7.2, end: 7.8, word: "recovered", probability: 0.9 },
              { start: 7.8, end: 8.4, word: "sentence", probability: 0.9 }
            ]
          },
          { start: 15, end: 16, text: "outside retry gap" }
        ]
      })
    };
  };
  const directVadRecovery = await context.transcribeBrowserAudioChunk(
    {
      index: 23,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "direct-vad-retry-gap.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-direct-vad-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(directVadRecovery.map(segment => segment.text)), JSON.stringify(["recovered sentence"]));
  assert.equal(Math.round(directVadRecovery[0].start * 10) / 10, 37.2);
  assert.equal(retryDiagnostics.directAttempt.finalSegments.length, 0);
  assert.equal(retryDiagnostics.retry.reason, "可靠 VAD 语音区间未被直连识别结果覆盖，已开启服务端 VAD 重试。");
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryFilterApplied, true);
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryInputFinalCount, 2);
  assert.equal(retryDiagnostics.retry.postprocess.coverageRetryFinalCount, 1);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 1500 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return { ok: true, json: async () => ({ segments: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.05, end: 1.42, text: "嗯" }]
      })
    };
  };
  const shortBackchannelRecovery = await context.transcribeBrowserAudioChunk(
    {
      index: 9,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-short-backchannel.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-short-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,1.5"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(JSON.stringify(shortBackchannelRecovery.map(segment => segment.text)), JSON.stringify(["嗯"]));
  assert.equal(shortBackchannelRecovery[0].start, 31.05);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 20000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "first long speech sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 12.2, end: 13.5, text: "later long speech sentence" }]
      })
    };
  };
  const longSpeechRecovery = await context.transcribeBrowserAudioChunk(
    {
      index: 13,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "long-vad-window.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-long-vad-window.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,20"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(longSpeechRecovery.map(segment => segment.text)), JSON.stringify([
    "first long speech sentence",
    "later long speech sentence"
  ]));
  assert.equal(retryDiagnostics.retry.reason, "可靠 VAD 语音区间未被 clip_timestamps 识别结果覆盖，已不带 clip_timestamps 重试。");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const transcriptionRequests = [];
  const offscreenMessages = [];
  let matureDiagnostics = null;
  chrome.runtime.sendMessage = async message => {
    offscreenMessages.push(message);
    return {
      ok: true,
      result: {
        chunks: [
          {
            index: 0,
            start: 31,
            end: 61,
            duration: 30,
            sourceStart: 31,
            sourceEnd: 61,
            speechIntervals: [{ start: 31, end: 61 }],
            timeMap: [{ outputStart: 0, outputEnd: 30, sourceStart: 31, sourceEnd: 61 }],
            file: { name: "speech-only-long-000.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
            bytes: 4
          },
          {
            index: 1,
            start: 61,
            end: 89,
            duration: 28,
            sourceStart: 61,
            sourceEnd: 89,
            speechIntervals: [{ start: 61, end: 89 }],
            timeMap: [{ outputStart: 0, outputEnd: 28, sourceStart: 61, sourceEnd: 89 }],
            file: { name: "speech-only-long-001.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
            bytes: 4
          }
        ]
      }
    };
  };
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 59000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    const requestIndex = transcriptionRequests.length;
    return {
      ok: true,
      json: async () => ({
        segments: requestIndex === 1
          ? [{ start: 1.2, end: 2.4, text: "first continuous sentence" }]
          : [{ start: 5.2, end: 6.5, text: "collected later sentence" }]
      })
    };
  };
  const serverVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 14,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "unsafe-long-vad-window.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-long-window-server-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto",
      collectedSpeechAudio: "on"
    },
    { onDiagnostics: diagnostics => { matureDiagnostics = diagnostics; } }
  );
  assert.equal(offscreenMessages.length, 1);
  assert.equal(offscreenMessages[0].type, "FUGUANG_OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO");
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests.every(fields => fields.some(([name]) => name === "clip_timestamps") === false), true);
  assert.equal(transcriptionRequests.every(fields => fields.some(([name]) => name === "vad_filter") === false), true);
  assert.equal(JSON.stringify(serverVadSegments.map(segment => segment.text)), JSON.stringify([
    "first continuous sentence",
    "collected later sentence"
  ]));
  assert.equal(Boolean(matureDiagnostics.vadFilterAttempt), false);
  assert.equal(Boolean(matureDiagnostics.retry), false);
  assert.equal(matureDiagnostics.matureAsrPlan.request.mode, "collected_external_vad");
  assert.equal(matureDiagnostics.collectedSpeech.strategy, "external_vad_collect_chunks");
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const transcriptionRequests = [];
  const offscreenMessages = [];
  let recallDiagnostics = null;
  chrome.runtime.sendMessage = async message => {
    offscreenMessages.push(message);
    return { ok: true, result: { chunks: [] } };
  };
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [{ start: 1000, end: 2000 }] };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1.1, end: 1.8, text: "clear speech", words: [{ start: 1.1, end: 1.8, word: "clear", probability: 0.9 }] },
          { start: 9.1, end: 10.2, text: "quiet low voice", words: [{ start: 9.1, end: 10.2, word: "quiet", probability: 0.9 }] }
        ]
      })
    };
  };
  const recallSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 33,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "auto-vad-recall.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-auto-vad-recall.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { recallDiagnostics = diagnostics; } }
  );
  assert.equal(offscreenMessages.length, 0);
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), false);
  assert.equal(JSON.stringify(recallSegments.map(segment => segment.text)), JSON.stringify(["clear speech", "quiet low voice"]));
  assert.equal(recallDiagnostics.postprocess.speechActivityFilterApplied, false);
  assert.equal(recallDiagnostics.postprocess.qualityFiltersDisabled, false);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const requested = [];
  const transcriptionRequests = [];
  let speachesDiagnostics = null;
  const offscreenMessages = [];
  chrome.runtime.sendMessage = async message => {
    offscreenMessages.push(message);
    return {
      ok: true,
      result: {
        chunks: [
          {
            index: 0,
            start: 31,
            end: 59,
            duration: 2,
            sourceStart: 31,
            sourceEnd: 59,
            speechIntervals: [
              { start: 31, end: 32 },
              { start: 58, end: 59 }
            ],
            timeMap: [
              { outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 },
              { outputStart: 1, outputEnd: 2, sourceStart: 58, sourceEnd: 59 }
            ],
            file: { name: "speech-only-000.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
            bytes: 4
          }
        ]
      }
    };
  };
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          model: { type: "string" },
                          response_format: { type: "string" },
                          timestamp_granularities: { type: "array" },
                          vad_filter: { type: "boolean" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 2000 }, { start: 28000, end: 29000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "server vad first sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.1, end: 1.6, text: "speech-only second sentence" }]
      })
    };
  };
  const recoveredSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 15,
      start: 30,
      end: 90,
      duration: 60,
      file: {
        name: "speaches-form-urlencoded-vad.wav",
        buffer: new ArrayBuffer(4),
        cacheUrl: "https://fuguang.local/audio/speaches-form-urlencoded-vad.wav",
        mime: "audio/wav"
      }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-form-urlencoded-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto",
      collectedSpeechAudio: "on"
    },
    { onDiagnostics: diagnostics => { speachesDiagnostics = diagnostics; } }
  );
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/speech/timestamps", "POST"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  assert.equal(offscreenMessages.length, 1);
  assert.equal(offscreenMessages[0].type, "FUGUANG_OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO");
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "vad_filter"), false);
  assert.equal(JSON.stringify(recoveredSpeachesSegments.map(segment => segment.text)), JSON.stringify([
    "speech-only second sentence"
  ]));
  assert.equal(Math.round(recoveredSpeachesSegments[0].start * 10) / 10, 58.1);
  assert.equal(Math.round(recoveredSpeachesSegments[0].end * 10) / 10, 58.6);
  assert.equal(speachesDiagnostics.vad.speechIntervals.length, 2);
  assert.equal(speachesDiagnostics.vad.requestFields.some(([name, value]) => name === "threshold" && value === "0.15"), true);
  assert.equal(speachesDiagnostics.vad.requestFields.some(([name, value]) => name === "min_silence_duration_ms" && value === "160"), true);
  assert.equal(speachesDiagnostics.matureAsrPlan.request.mode, "collected_external_vad");
  assert.equal(speachesDiagnostics.collectedSpeech.strategy, "external_vad_collect_chunks");
  assert.equal(Boolean(speachesDiagnostics.vadFilterAttempt), false);
  assert.equal(Boolean(speachesDiagnostics.retry), false);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const restored = context.restoreBrowserAsrCollectedSpeechSegments([
    {
      start: 0.9,
      end: 1.2,
      text: "boundary word",
      words: [{ start: 0.9, end: 1.2, text: "boundary", probability: 0.9 }]
    },
    {
      start: 0.9,
      end: 1.2,
      text: "segment-only boundary"
    }
  ], [
    { outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 },
    { outputStart: 1, outputEnd: 2, sourceStart: 58, sourceEnd: 59 }
  ]);
  assert.equal(restored.length, 2);
  assert.equal(restored[0].start, 57.9);
  assert.equal(restored[0].end, 58.2);
  assert.equal(restored[0].words[0].start, 57.9);
  assert.equal(restored[0].words[0].end, 58.2);
  assert.equal(restored[1].start, 31.9);
  assert.equal(restored[1].end, 58.2);
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const transcriptionRequests = [];
  let speachesDiagnostics = null;
  chrome.runtime.sendMessage = async () => ({
    ok: true,
    result: {
      chunks: [
        {
          index: 0,
          start: 31,
          end: 89,
          duration: 58,
          sourceStart: 31,
          sourceEnd: 89,
          speechIntervals: [{ start: 31, end: 89 }],
          timeMap: [{ outputStart: 0, outputEnd: 58, sourceStart: 31, sourceEnd: 89 }],
          file: { name: "speech-only-hallucination.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
          bytes: 4
        }
      ]
    }
  });
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          model: { type: "string" },
                          response_format: { type: "string" },
                          timestamp_granularities: { type: "array" },
                          vad_filter: { type: "boolean" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 59000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "server vad first sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 2.5, end: 4, text: "looped phrase" },
          { start: 4.1, end: 8, text: "looped phrase" },
          { start: 8.1, end: 14, text: "looped phrase" },
          { start: 14.1, end: 20, text: "looped phrase" },
          { start: 50, end: 55, text: "looped phrase" }
        ]
      })
    };
  };
  const recoveredSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 16,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "speaches-no-vad-hallucination-retry.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-no-vad-hallucination-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto",
      collectedSpeechAudio: "on"
    },
    { onDiagnostics: diagnostics => { speachesDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "vad_filter"), false);
  assert.equal(JSON.stringify(recoveredSpeachesSegments.map(segment => segment.text)), JSON.stringify([]));
  assert.equal(speachesDiagnostics.matureAsrPlan.request.mode, "collected_external_vad");
  assert.equal(Boolean(speachesDiagnostics.retry), false);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  let speachesDiagnostics = null;
  chrome.runtime.sendMessage = async () => ({
    ok: true,
    result: {
      chunks: [
        {
          index: 0,
          start: 31,
          end: 32,
          duration: 1,
          sourceStart: 31,
          sourceEnd: 32,
          speechIntervals: [{ start: 31, end: 32 }],
          timeMap: [{ outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 }],
          file: { name: "speech-only-quality.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
          bytes: 4
        }
      ]
    }
  });
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          model: { type: "string" },
                          response_format: { type: "string" },
                          timestamp_granularities: { type: "array" },
                          vad_filter: { type: "boolean" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 2000 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 0.1,
          end: 0.9,
          text: "overcompressed model drift",
          compression_ratio: 9.2,
          no_speech_prob: 0.1
        }]
      })
    };
  };
  const qualityFilteredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 17,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "speaches-collected-quality.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-collected-quality.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto",
      collectedSpeechAudio: "on"
    },
    { onDiagnostics: diagnostics => { speachesDiagnostics = diagnostics; } }
  );
  assert.equal(JSON.stringify(qualityFilteredSegments.map(segment => segment.text)), JSON.stringify([]));
  assert.equal(speachesDiagnostics.matureAsrPlan.request.mode, "collected_external_vad");
  assert.equal(speachesDiagnostics.collectedSpeech.attempts[0].postprocess.qualityFiltersDisabled, false);
  assert.equal(speachesDiagnostics.collectedSpeech.attempts[0].normalizedSegments.length, 0);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let failedDiagnostics = null;
  const transcriptionRequests = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 1800 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (!fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.05, end: 1.75, text: "fallback speech" }]
        })
      };
    }
    return {
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "clip timestamp parse failed" } })
    };
  };
  const fallbackSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 10,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-failed.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-fail.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { failedDiagnostics = diagnostics; } }
  );
  assert.equal(JSON.stringify(fallbackSegments.map(segment => segment.text)), JSON.stringify(["fallback speech"]));
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,1.8"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "vad_filter"), false);
  assert.equal(Boolean(failedDiagnostics), true);
  assert.equal(failedDiagnostics.vad.speechIntervals.length, 1);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.stage, "asr_request");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.status, 400);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.rawPayload.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.matureAsrPlan.request.mode, "external_vad_clip");
  assert.equal(failedDiagnostics.matureAsrPlan.request.mode, "direct");
  assert.equal(failedDiagnostics.request.fields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(failedDiagnostics.retry.request.fields.some(([name]) => name === "vad_filter"), false);
  assert.equal(failedDiagnostics.retry.matureAsrPlan.request.mode, "direct");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let postprocessDiagnostics = null;
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { without_timestamps: { type: "boolean" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({ text: "no timestamps here" })
    };
  };
  await assert.rejects(
    context.transcribeBrowserAudioChunk(
      {
        index: 11,
        start: 0,
        end: 30,
        duration: 30,
        file: { name: "text-only.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
      },
      {
        providerType: "openai",
        baseUrl: "https://speaches-text-only.example/v1",
        model: "Systran/faster-whisper-large-v3",
        apiKey: "test",
        vadFilter: "auto"
      },
      { onDiagnostics: diagnostics => { postprocessDiagnostics = diagnostics; } }
    ),
    /时间戳/
  );
  assert.equal(Boolean(postprocessDiagnostics), true);
  assert.equal(postprocessDiagnostics.error.stage, "postprocess");
  assert.equal(postprocessDiagnostics.rawPayload.text, "no timestamps here");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      reject(error);
    });
  });
  await assert.rejects(
    Promise.race([
      context.transcribeBrowserAudioChunk(
        { index: 0, start: 0, end: 10, file: { name: "chunk.mp3", buffer: new ArrayBuffer(1), mime: "audio/mpeg" } },
        { providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1", model: "whisper-1", apiKey: "test", timeoutMs: 20, vadFilter: "off" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ASR timeout did not trigger")), 80))
    ]),
    /ASR 请求超时/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let capturedDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    return {
      ok: true,
      json: async () => ({
        duration: 30,
        segments: [
          { start: 0.2, end: 1.4, text: "kept" },
          { start: 42, end: 44, text: "outside" }
        ]
      })
    };
  };
  const finalSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 7,
      start: 30,
      end: 60,
      coreStart: 30,
      coreEnd: 60,
      duration: 30,
      bytes: 4,
      file: { name: "diag.wav", cacheUrl: "https://fuguang.local/audio/diag.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://diagnostics-asr.example/v1",
      model: "whisper-1",
      apiKey: "test",
      vadFilter: "off"
    },
    {
      onDiagnostics: diagnostics => {
        capturedDiagnostics = diagnostics;
      }
    }
  );
  assert.equal(finalSegments.length, 1);
  assert.equal(capturedDiagnostics.chunk.index, 7);
  assert.equal(capturedDiagnostics.chunk.file.cacheUrl, "https://fuguang.local/audio/diag.wav");
  assert.equal(capturedDiagnostics.request.fields.some(([name]) => name === "file"), false);
  assert.equal(capturedDiagnostics.request.authorizationIncluded, false);
  assert.equal(capturedDiagnostics.rawPayload.segments.length, 2);
  assert.equal(capturedDiagnostics.normalizedSegments.length, 2);
  assert.equal(capturedDiagnostics.finalSegments.length, 1);
  assert.deepEqual(capturedDiagnostics.postprocess.droppedSegments.map(item => ({
    stage: item.stage,
    reason: item.reason,
    text: item.segment.text
  })), [
    { stage: "chunkOwnership", reason: "outside_chunk_core", text: "outside" }
  ]);
  context.fetch = originalFetch;
}

{
  const diagnostics = context.buildPreloadDiagnostics({
    job: {
      id: "job-diag",
      status: "completed",
      stage: "completed",
      extract: { status: "completed", duration: 60 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "completed", sourceCount: 1 }],
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n你好\n"
      }
    },
    metadata: { title: "诊断视频", pageUrl: "https://example.test/watch?token=secret" },
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      coreStart: 0,
      coreEnd: 30,
      speechIntervalsReliable: false,
      file: { name: "chunk-001.mp3", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/chunk-001.mp3", mime: "audio/mpeg" },
      bytes: 123
    }],
    browserAsrDiagnosticsByChunk: new Map([[0, {
      chunk: { index: 0, start: 0, end: 30 },
      request: { endpoint: "https://asr.example/v1/audio/transcriptions?api_key=secret", fields: [["model", "whisper-1"]], authorizationIncluded: false },
      rawPayload: { segments: [{ text: "hello" }] },
      finalSegments: [{ start: 0, end: 1, text: "hello" }]
    }]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "你好", chunkIndex: 0, segmentIndex: 0 }]]]),
    modelConfig: {
      asr: { providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", apiKey: "do-not-export" }
    }
  });
  assert.equal(diagnostics.version, 1);
  assert.equal(diagnostics.job.id, "job-diag");
  assert.equal(diagnostics.audioChunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
  assert.equal(diagnostics.asrChunks[0].rawPayload.segments[0].text, "hello");
  assert.equal(JSON.stringify(diagnostics).includes("do-not-export"), false);
  assert.equal(JSON.stringify(diagnostics).includes("api_key=secret"), false);
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  const cacheUrl = "https://fuguang.local/__fuguang_audio_cache/job-audio/chunk-001.mp3";
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([5, 6, 7]).buffer));
  vm.runInContext(`
    browserPreloadJobs.set("job-audio", {
      job: {
        id: "job-audio",
        status: "completed",
        stage: "completed",
        extract: { status: "completed" },
        translation: { chunkStatuses: [] }
      },
      metadata: { title: "audio diag" },
      audioChunks: [{
        index: 0,
        start: 0,
        end: 30,
        file: {
          name: "chunk-001.mp3",
          mime: "audio/mpeg",
          cacheUrl: "${cacheUrl}",
          bytes: 3
        },
        bytes: 3
      }],
      browserAsrDiagnosticsByChunk: new Map(),
      sourceSegmentsByChunk: new Map(),
      translatedSegmentsByChunk: new Map(),
      modelConfig: {
        asr: { providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", apiKey: "do-not-export" }
      }
    });
  `, context);
  try {
    const response = await vm.runInContext("getPreloadDiagnostics('job-audio')", context);
    assert.equal(response.audioFiles.length, 1);
    assert.equal(response.audioFiles[0].path, "audio/chunk-0000-chunk-001.mp3");
    assert.equal(response.audioFiles[0].mime, "audio/mpeg");
    assert.equal(response.audioFiles[0].base64, "BQYH");
    assert.equal(JSON.parse(JSON.stringify(response)).audioFiles[0].base64, "BQYH");
    assert.equal(response.diagnostics.audioExport.files[0].included, true);
    assert.equal(response.diagnostics.audioExport.files[0].path, "audio/chunk-0000-chunk-001.mp3");
    assert.equal(JSON.stringify(response.diagnostics).includes("do-not-export"), false);
  } finally {
    vm.runInContext("browserPreloadJobs.delete('job-audio')", context);
  }
}

{
  const originalRequest = context.requestOpenAiCompatibleChat;
  context.requestOpenAiCompatibleChat = async () => new Promise(() => {});
  await assert.rejects(
    Promise.race([
      context.translateBrowserSegments(
        [{ start: 1, end: 2, text: "hello" }],
        { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        { title: "timeout test" },
        { timeoutMs: 20 }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("translation timeout did not trigger")), 80))
    ]),
    /翻译模型请求超时/
  );
  context.requestOpenAiCompatibleChat = originalRequest;
}
