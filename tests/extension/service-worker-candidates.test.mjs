import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const webNavigationCommittedListeners = [];
const webNavigationHistoryListeners = [];
const webRequestBeforeSendHeadersListeners = [];
const webRequestHeadersReceivedListeners = [];
const runtimeConnectListeners = [];
const taskRuntimePortListeners = [];
const taskRuntimePortDisconnectListeners = [];
const taskRuntimeSent = [];
const runtimeMessages = [];
let localStorageState = {};
const webNavigationFrames = new Map();
const addListener = () => {};
const taskRuntimePort = {
  name: "fuguang-task-runtime-v1",
  onMessage: { addListener: listener => taskRuntimePortListeners.push(listener) },
  onDisconnect: { addListener: listener => taskRuntimePortDisconnectListeners.push(listener) },
  postMessage(message) {
    taskRuntimeSent.push(message);
    Promise.resolve().then(() => {
      for (const listener of taskRuntimePortListeners) {
        listener({
          type: "FUGUANG_TASK_RUNTIME_ACK",
          commandId: message.commandId,
          accepted: true,
          shadow: message.type === "FUGUANG_TASK_RUNTIME_OBSERVE_JOB"
        });
      }
    });
  },
  disconnect() {
    for (const listener of taskRuntimePortDisconnectListeners) {
      listener();
    }
  }
};
const chrome = {
  action: { onClicked: { addListener } },
  alarms: {
    onAlarm: { addListener },
    create: async () => {},
    clear: async () => true
  },
  offscreen: { hasDocument: async () => false, createDocument: async () => {} },
  runtime: {
    getURL: value => `chrome-extension://test-extension/${value}`,
    getContexts: async () => [],
    onMessage: { addListener },
    onConnect: { addListener: listener => runtimeConnectListeners.push(listener) },
    sendMessage: async message => {
      runtimeMessages.push(message);
      return {};
    },
    connect: () => {
      Promise.resolve().then(() => {
        for (const listener of taskRuntimePortListeners) {
          listener({ type: "FUGUANG_TASK_RUNTIME_READY", protocolVersion: 1 });
        }
      });
      return taskRuntimePort;
    }
  },
  sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
  storage: {
    local: {
      get: async keys => {
        if (keys == null) {
          return structuredClone(localStorageState);
        }
        const names = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(names
          .filter(name => Object.hasOwn(localStorageState, name))
          .map(name => [name, structuredClone(localStorageState[name])]));
      },
      set: async values => {
        Object.assign(localStorageState, structuredClone(values || {}));
      },
      remove: async keys => {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete localStorageState[key];
        }
      },
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
    getFrame: async ({ tabId, frameId }) => webNavigationFrames.get(`${tabId}:${frameId}`) || null,
    getAllFrames: async () => [],
    onCommitted: { addListener: listener => webNavigationCommittedListeners.push(listener) },
    onHistoryStateUpdated: { addListener: listener => webNavigationHistoryListeners.push(listener) },
    onTabReplaced: { addListener }
  },
  webRequest: {
    onBeforeRequest: { addListener },
    onBeforeSendHeaders: { addListener: listener => webRequestBeforeSendHeadersListeners.push(listener) },
    onCompleted: { addListener },
    onHeadersReceived: { addListener: listener => webRequestHeadersReceivedListeners.push(listener) },
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
  crypto: globalThis.crypto,
  structuredClone,
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
const asrWorkflowSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-workflow.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n', "")
  .replace('import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";\n', "")
  .replace('import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";\n\n', "")
  .replace("export const FuguangBrowserAsrWorkflow =", "var FuguangBrowserAsrWorkflow =");
const funasrProviderSource = fs.readFileSync(new URL("../../extension/src/background/browser-funasr-provider.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserFunAsrProvider =", "var FuguangBrowserFunAsrProvider =");
const providerSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-provider.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n', "")
  .replace("export const FuguangBrowserTranslationProvider =", "var FuguangBrowserTranslationProvider =");
const pipelineSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-pipeline.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserTranslationProvider } from "./browser-translation-provider.js";\n\n', "")
  .replace("export const FuguangBrowserTranslationPipeline =", "var FuguangBrowserTranslationPipeline =");
const mediaHeaderRulesSource = fs.readFileSync(new URL("../../extension/src/background/media-header-rules.js", import.meta.url), "utf8")
  .replace("export const FuguangMediaHeaderRules =", "var FuguangMediaHeaderRules =");
const jobContractSource = fs.readFileSync(new URL("../../extension/src/shared/job-contract.js", import.meta.url), "utf8")
  .replace("export const FuguangJobContract =", "var FuguangJobContract =");
const taskRuntimeProtocolSource = fs.readFileSync(new URL("../../extension/src/shared/task-runtime-protocol.js", import.meta.url), "utf8")
  .replace("export const FuguangTaskRuntimeProtocol =", "var FuguangTaskRuntimeProtocol =");
const jobStoreSource = fs.readFileSync(new URL("../../extension/src/background/job-store.js", import.meta.url), "utf8")
  .replace('import { FuguangJobContract } from "../shared/job-contract.js";\n\n', "")
  .replace("export const FuguangJobStore =", "var FuguangJobStore =");
const source = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrWorkflow } from "./browser-asr-workflow.js";\n', "")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n', "")
  .replace('import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";\n', "")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n', "")
  .replace('import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";\n', "")
  .replace('import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";\n', "")
  .replace('import { FuguangBrowserFunAsrProvider } from "./browser-funasr-provider.js";\n', "")
  .replace('import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";\n', "")
  .replace('import { FuguangJobStore } from "./job-store.js";\n', "")
  .replace('import { FuguangMediaHeaderRules } from "./media-header-rules.js";\n', "")
  .replace('import { FuguangJobContract } from "../shared/job-contract.js";\n', "")
  .replace('import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";\n', "");

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
vm.runInContext(asrWorkflowSource, context, { filename: "browser-asr-workflow.js" });
vm.runInContext(funasrProviderSource, context, { filename: "browser-funasr-provider.js" });
Object.assign(context, context.FuguangBrowserFunAsrProvider);
vm.runInContext(providerSource, context, { filename: "browser-translation-provider.js" });
Object.assign(context, context.FuguangBrowserTranslationProvider);
vm.runInContext(pipelineSource, context, { filename: "browser-translation-pipeline.js" });
Object.assign(context, context.FuguangBrowserTranslationPipeline);
vm.runInContext(mediaHeaderRulesSource, context, { filename: "media-header-rules.js" });
vm.runInContext(jobContractSource, context, { filename: "job-contract.js" });
vm.runInContext(taskRuntimeProtocolSource, context, { filename: "task-runtime-protocol.js" });
vm.runInContext(jobStoreSource, context, { filename: "job-store.js" });
context.FuguangJobStore.create = context.FuguangJobStore.createMemory;
vm.runInContext(source, context, { filename: "service-worker.js" });

assert.equal(context.browserTranslationProviderConcurrency({ modelConfig: { workers: 6 } }), 6);
assert.equal(context.browserTranslationProviderConcurrency({ modelConfig: { workers: 1 } }), 1);

{
  const stablePage = "https://example.test/watch/video-42?episode=7";
  assert.equal(
    context.browserPageIdentitiesMatch(
      `${stablePage}&sid=session-a&nonce=nonce-a&timestamp=100`,
      `${stablePage}&sid=session-b&nonce=nonce-b&timestamp=200`
    ),
    true,
    "rotating session, nonce, and timestamp parameters must not turn the same page into a different page"
  );
  assert.equal(
    context.browserPageIdentitiesMatch(
      "https://example.test/watch/video-42?episode=7&session=old",
      "https://example.test/watch/video-42?episode=8&session=new"
    ),
    false,
    "a stable content selector must still distinguish different content even when volatile session parameters also change"
  );
  assert.equal(
    context.browserPageIdentitiesMatch(
      "https://www.bilibili.com/video/BV17DLP6UEPw?p=1&sid=old",
      "https://www.bilibili.com/video/BV17DLP6UEPw?p=2&sid=new"
    ),
    false,
    "Bilibili part identity must remain stable content identity rather than session identity"
  );
}

{
  const now = Date.now();
  const cutoff = now - (7 * 24 * 60 * 60 * 1000);
  const expiredAt = now - (8 * 24 * 60 * 60 * 1000);
  const interruptionMessage = "Fun-ASR 远端任务仍在运行，可继续处理或明确停止。";
  const recoveredExpiredInterrupted = context.recoverBrowserJobRecord({
    id: "expired-interrupted-job",
    runToken: "expired-interrupted-run",
    pipeline: "browser",
    status: "interrupted",
    stage: "interrupted",
    activeKey: "",
    tabId: 1,
    pageIdentity: "https://example.test/watch/expired-interrupted",
    createdAt: expiredAt,
    updatedAt: expiredAt,
    error: interruptionMessage,
    extract: {},
    translation: {},
    source: {}
  }, [], { asr: {}, translation: {}, targetLanguage: "" });
  assert.equal(
    recoveredExpiredInterrupted.job.updatedAt,
    expiredAt,
    "recovering an unchanged interrupted job must not renew its seven-day cleanup age"
  );
  assert.equal(
    recoveredExpiredInterrupted.job.error,
    interruptionMessage,
    "recovering an already interrupted job must preserve its durable actionable error"
  );
  const newlyInterrupted = context.recoverBrowserJobRecord({
    id: "newly-interrupted-job",
    runToken: "newly-interrupted-run",
    pipeline: "browser",
    status: "running",
    stage: "asr",
    tabId: 1,
    pageIdentity: "https://example.test/watch/newly-interrupted",
    createdAt: expiredAt,
    updatedAt: expiredAt,
    error: "",
    extract: {},
    translation: {},
    source: {}
  }, [], { asr: {}, translation: {}, targetLanguage: "" });
  assert.equal(newlyInterrupted.job.status, "interrupted");
  assert.ok(newlyInterrupted.job.updatedAt > expiredAt, "a real running-to-interrupted transition must refresh updatedAt once");
  assert.match(newlyInterrupted.job.error, /浏览器后台重启中断了任务/);
  const recoveryFailure = context.recoverBrowserJobRecord({
    id: "recovery-error-job",
    runToken: "recovery-error-run",
    pipeline: "browser",
    status: "interrupted",
    stage: "interrupted",
    tabId: 1,
    pageIdentity: "https://example.test/watch/recovery-error",
    createdAt: expiredAt,
    updatedAt: expiredAt,
    error: interruptionMessage,
    extract: {},
    translation: {},
    source: {}
  }, [], null, { recoveryError: "模型配置已被删除，无法恢复。" });
  assert.equal(recoveryFailure.job.error, "模型配置已被删除，无法恢复。");
  assert.ok(recoveryFailure.job.updatedAt > expiredAt, "a newly generated recovery error must refresh updatedAt");
  const repeatedRecoveryFailure = context.recoverBrowserJobRecord({
    id: "repeated-recovery-error-job",
    runToken: "repeated-recovery-error-run",
    pipeline: "browser",
    status: "interrupted",
    stage: "interrupted",
    tabId: 1,
    pageIdentity: "https://example.test/watch/repeated-recovery-error",
    createdAt: expiredAt,
    updatedAt: expiredAt,
    error: "模型配置已被删除，无法恢复。",
    extract: {},
    translation: {},
    source: {}
  }, [], null, { recoveryError: "模型配置已被删除，无法恢复。" });
  assert.equal(
    repeatedRecoveryFailure.job.updatedAt,
    expiredAt,
    "repeating the same durable recovery error must not renew the cleanup age"
  );
  const recoveredExpiredInterruptedSnapshot = context.createBrowserJobLedgerSnapshot(recoveredExpiredInterrupted);
  const snapshots = [
    {
      job: {
        id: "expired-terminal-job",
        runToken: "expired-terminal-run",
        status: "completed",
        stage: "completed",
        activeKey: "",
        createdAt: expiredAt,
        updatedAt: expiredAt
      },
      chunks: [{
        key: "expired-terminal-job:expired-terminal-run:0",
        jobId: "expired-terminal-job",
        runToken: "expired-terminal-run",
        index: 0
      }]
    },
    recoveredExpiredInterruptedSnapshot,
    {
      job: {
        id: "recently-updated-interrupted-job",
        runToken: "recently-updated-interrupted-run",
        status: "interrupted",
        stage: "interrupted",
        activeKey: "",
        createdAt: expiredAt,
        updatedAt: now
      },
      chunks: []
    },
    {
      job: {
        id: "cutoff-terminal-job",
        runToken: "cutoff-terminal-run",
        status: "completed",
        stage: "completed",
        activeKey: "",
        createdAt: cutoff,
        updatedAt: cutoff
      },
      chunks: []
    },
    {
      job: {
        id: "old-running-job",
        runToken: "old-running-run",
        status: "running",
        stage: "translation",
        activeKey: "",
        createdAt: expiredAt,
        updatedAt: expiredAt
      },
      chunks: []
    }
  ];
  context.maintenanceSnapshots = snapshots;
  await vm.runInContext("Promise.all(maintenanceSnapshots.map(snapshot => browserJobStore.putSnapshot(snapshot)))", context);
  const originalSendMessage = chrome.runtime.sendMessage;
  const cleanupMessages = [];
  chrome.runtime.sendMessage = async message => {
    if (message?.type !== "fuguang:paid-request:cleanup-expired-job-results") {
      return originalSendMessage(message);
    }
    cleanupMessages.push(structuredClone(message.cleanup));
    context.maintenanceCleanup = message.cleanup;
    await vm.runInContext("browserJobStore.deleteJob(maintenanceCleanup.jobId)", context);
    return { ok: true, result: { applied: true } };
  };
  try {
    assert.deepEqual(
      JSON.parse(JSON.stringify(await context.requestBrowserJobLedgerMaintenance(now))),
      { deletedTerminalJobs: 1, deletedInterruptedJobs: 1, failedJobs: 0, skippedJobs: 0 }
    );
    assert.deepEqual(cleanupMessages.map(item => item.jobId).sort(), ["expired-interrupted-job", "expired-terminal-job"]);
    assert.equal(cleanupMessages.every(item => item.cutoff === cutoff), true);
    assert.equal(await vm.runInContext("browserJobStore.getJob('expired-terminal-job')", context), null);
    assert.equal(await vm.runInContext("browserJobStore.getJob('expired-interrupted-job')", context), null);
    assert.notEqual(await vm.runInContext("browserJobStore.getJob('recently-updated-interrupted-job')", context), null);
    assert.notEqual(await vm.runInContext("browserJobStore.getJob('cutoff-terminal-job')", context), null);
    assert.notEqual(await vm.runInContext("browserJobStore.getJob('old-running-job')", context), null);
    assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext("browserJobStore.getChunks('expired-terminal-job')", context))), []);
    assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext("browserJobStore.getChunks('expired-interrupted-job')", context))), []);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
    await vm.runInContext("Promise.all(['recently-updated-interrupted-job','cutoff-terminal-job','old-running-job'].map(id => browserJobStore.deleteJob(id)))", context);
    delete context.maintenanceCleanup;
    delete context.maintenanceSnapshots;
  }
}

{
  const now = Date.now();
  const updatedAt = now - (8 * 24 * 60 * 60 * 1000);
  context.pendingCleanupSnapshot = {
    job: {
      id: "pending-cleanup-without-job",
      runToken: "pending-cleanup-run",
      status: "completed",
      stage: "completed",
      activeKey: "",
      createdAt: updatedAt,
      updatedAt,
      executionLeaseExpiresAt: 0
    },
    chunks: []
  };
  await vm.runInContext("browserJobStore.putSnapshot(pendingCleanupSnapshot)", context);
  context.pendingCleanupInput = {
    jobId: "pending-cleanup-without-job",
    runToken: "pending-cleanup-run",
    expectedUpdatedAt: updatedAt,
    cutoff: updatedAt + 1,
    checkedAt: updatedAt + 1
  };
  await vm.runInContext("browserJobStore.deleteExpiredJob(pendingCleanupInput)", context);
  assert.equal(await vm.runInContext("browserJobStore.getJob('pending-cleanup-without-job')", context), null);
  assert.equal(await vm.runInContext("browserJobStore.listCleanupClaims({ state: 'pending' }).then(items => items.length)", context), 1);

  const originalSendMessage = chrome.runtime.sendMessage;
  let drainMessages = 0;
  chrome.runtime.sendMessage = async message => {
    if (message?.type !== "fuguang:paid-request:drain-pending-cleanup-results") {
      return originalSendMessage(message);
    }
    drainMessages += 1;
    await vm.runInContext(`browserJobStore.listCleanupClaims({ state: "pending" }).then(items =>
      Promise.all(items.map(item => browserJobStore.completeCleanupClaim({ key: item.key, completedAt: Date.now() }))))`, context);
    return { ok: true, result: { completed: 1 } };
  };
  try {
    assert.deepEqual(
      JSON.parse(JSON.stringify(await context.requestBrowserJobLedgerMaintenance(now))),
      { deletedTerminalJobs: 0, deletedInterruptedJobs: 0, failedJobs: 0, skippedJobs: 0 }
    );
    assert.equal(drainMessages, 1, "maintenance must drain claims even after the source job ledger is gone");
    assert.equal(await vm.runInContext("browserJobStore.listCleanupClaims({ state: 'pending' }).then(items => items.length)", context), 0);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
    delete context.pendingCleanupInput;
    delete context.pendingCleanupSnapshot;
  }
}

{
  const incoming = [];
  const sent = [];
  const port = {
    name: "fuguang-sidepanel-status-v1",
    onMessage: { addListener: listener => incoming.push(listener) },
    onDisconnect: { addListener: () => {} },
    postMessage: message => sent.push(message)
  };
  runtimeConnectListeners[0](port);
  incoming[0]({ type: "FUGUANG_SIDEPANEL_SUBSCRIBE", tabId: 91 });
  context.setTabStatus(91, {
    preload: "running",
    page: { url: "https://example.test/watch/91" },
    preloadJob: {
      id: "summary-job",
      runToken: "summary-run",
      status: "running",
      stage: "translation",
      createdAt: 1,
      updatedAt: 2,
      extract: { status: "completed", progress: 100 },
      translation: {
        status: "running",
        chunksTotal: 1,
        chunkStatuses: [{ index: 0, stage: "translation" }],
        transcript: { source: [{ text: "must not be pushed" }] },
        vttText: "WEBVTT"
      }
    }
  });
  context.publishSidepanelStatusChange(91);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "FUGUANG_SIDEPANEL_JOB_CHANGED");
  assert.equal(sent[0].job.id, "summary-job");
  assert.equal(sent[0].job.translation.translating, 1);
  assert.equal(JSON.stringify(sent[0]).includes("must not be pushed"), false);
  assert.equal(JSON.stringify(sent[0]).includes("chunkStatuses"), false);
  assert.equal(JSON.stringify(sent[0]).includes("WEBVTT"), false);
}

{
  const originalFetch = context.fetch;
  const controller = new AbortController();
  let requestSignal = null;
  context.fetch = async (_url, init = {}) => {
    requestSignal = init.signal;
    return new Promise((resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });
  };
  try {
    const request = context.requestBrowserAsrTranscription({
      endpoint: "https://asr.example.test/v1/audio/transcriptions",
      timeoutMs: 60_000,
      asrConfig: { providerType: "openai", model: "whisper-1", apiKey: "test", vadFilter: "off" },
      supportedRequestFields: new Set(),
      effectiveChunk: { index: 0, start: 0, end: 1, file: { name: "chunk.mp3", mime: "audio/mpeg" } },
      fileBuffer: new Uint8Array([0x49, 0x44, 0x33, 0]).buffer,
      fileName: "chunk.mp3",
      clipTimestamps: "",
      matureAsrPlan: {},
      signal: controller.signal
    });
    for (let index = 0; index < 40 && !requestSignal; index += 1) {
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(requestSignal?.aborted, false);
    controller.abort(new Error("任务已停止。"));
    await assert.rejects(request, error => error?.name === "AbortError" && /任务已停止/.test(error.message));
    assert.equal(requestSignal.aborted, true);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalGetContexts = chrome.runtime.getContexts;
  const originalCreateDocument = chrome.offscreen.createDocument;
  const originalCloseDocument = chrome.offscreen.closeDocument;
  const originalListRecoverableJobs = vm.runInContext("browserJobStore.listRecoverableJobs", context);
  let createCalls = 0;
  let closeCalls = 0;
  let releaseCreate;
  const createGate = new Promise(resolve => {
    releaseCreate = resolve;
  });
  chrome.runtime.getContexts = async () => [];
  vm.runInContext("browserJobStore.listRecoverableJobs = async () => []", context);
  chrome.offscreen.createDocument = async () => {
    createCalls += 1;
    await createGate;
  };
  try {
    const first = context.ensureOffscreenDocument();
    const second = context.ensureOffscreenDocument();
    await Promise.resolve();
    releaseCreate();
    await Promise.all([first, second]);
    assert.equal(createCalls, 1);

    chrome.runtime.getContexts = async () => [{ contextType: "OFFSCREEN_DOCUMENT" }];
    chrome.offscreen.closeDocument = async () => {
      closeCalls += 1;
    };
    assert.deepEqual(JSON.parse(JSON.stringify(await context.closeOffscreenDocumentIfIdle())), { closed: true });
    assert.equal(closeCalls, 1);

    let releaseRecovery;
    let contextsDuringRecovery = 0;
    context.delayedOffscreenRecovery = new Promise(resolve => { releaseRecovery = resolve; });
    vm.runInContext("browserJobRecoveryPromise = delayedOffscreenRecovery", context);
    chrome.runtime.getContexts = async () => {
      contextsDuringRecovery += 1;
      return [{ contextType: "OFFSCREEN_DOCUMENT" }];
    };
    const delayedClose = context.closeOffscreenDocumentIfIdle();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(contextsDuringRecovery, 0, "idle close must wait for durable recovery before inspecting offscreen state");
    releaseRecovery({ recovered: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(await delayedClose)), { closed: true });

    let releaseContexts;
    chrome.runtime.getContexts = async () => await new Promise(resolve => { releaseContexts = () => resolve([{ contextType: "OFFSCREEN_DOCUMENT" }]); });
    const racedClose = context.closeOffscreenDocumentIfIdle();
    await new Promise(resolve => setTimeout(resolve, 0));
    context.activeDuringOffscreenClose = { job: { id: "offscreen-close-race", status: "running" } };
    vm.runInContext("browserPreloadJobs.set('offscreen-close-race', activeDuringOffscreenClose)", context);
    releaseContexts();
    assert.deepEqual(JSON.parse(JSON.stringify(await racedClose)), { closed: false, reason: "active" });
    assert.equal(closeCalls, 2, "the task created during getContexts must prevent a third closeDocument call");
    vm.runInContext("browserPreloadJobs.delete('offscreen-close-race')", context);
    delete context.activeDuringOffscreenClose;

    vm.runInContext("browserJobStore.listRecoverableJobs = async () => { throw new Error('indexeddb unavailable'); }", context);
    assert.deepEqual(JSON.parse(JSON.stringify(await context.closeOffscreenDocumentIfIdle())),
      { closed: false, reason: "active" }, "a failed durable read must keep offscreen alive because activity is unknown");
    assert.equal(closeCalls, 2);
  } finally {
    vm.runInContext("browserJobRecoveryPromise = Promise.resolve({ recovered: 0 })", context);
    context.originalListRecoverableJobsForOffscreenTest = originalListRecoverableJobs;
    vm.runInContext("browserJobStore.listRecoverableJobs = originalListRecoverableJobsForOffscreenTest", context);
    delete context.originalListRecoverableJobsForOffscreenTest;
    delete context.delayedOffscreenRecovery;
    chrome.runtime.getContexts = originalGetContexts;
    chrome.offscreen.createDocument = originalCreateDocument;
    chrome.offscreen.closeDocument = originalCloseDocument;
  }
}

{
  const originalTranscribeBrowserAudioChunk = context.transcribeBrowserAudioChunk;
  const originalTranslateBrowserSegments = context.translateBrowserSegments;
  const record = {
    tabId: 780,
    runToken: "run-offscreen-overlap",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/offscreen-overlap.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/offscreen-overlap", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-overlap",
      runToken: "run-offscreen-overlap",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.enqueueBrowserLogicalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "offscreen-overlap.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
  });
  context.closeAllBrowserTranslationGroups(record);
  let transcribeCalls = 0;
  let markStarted;
  let releaseTranscription;
  const started = new Promise(resolve => {
    markStarted = resolve;
  });
  const transcriptionGate = new Promise(resolve => {
    releaseTranscription = resolve;
  });
  context.transcribeBrowserAudioChunk = async () => {
    transcribeCalls += 1;
    markStarted();
    await transcriptionGate;
    return [{ start: 1, end: 2, text: "source" }];
  };
  context.translateBrowserSegments = async segments => segments.map(segment => ({ ...segment, text: "译文" }));
  context.offscreenOverlapRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-offscreen-overlap', offscreenOverlapRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: offscreenOverlapRecord.job, chunks: [] })", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-offscreen-overlap', 'run-offscreen-overlap', { ownerId: 'offscreen-overlap-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const message = {
    jobId: record.job.id,
    runToken: record.runToken,
    executionOwnerId: "offscreen-overlap-owner",
    executionEpoch: claim.job?.executionEpoch,
    chunkIndex: 0
  };
  try {
    const first = context.processOffscreenBrowserJobChunk(message);
    await started;
    const second = context.processOffscreenBrowserJobChunk(message);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(transcribeCalls, 1, "overlapping owners must not submit the same paid chunk twice");
    releaseTranscription();
    const [, duplicate] = await Promise.all([first, second]);
    assert.equal(Boolean(duplicate.duplicate || duplicate.inProgress), true);
  } finally {
    releaseTranscription();
    await vm.runInContext("browserJobStore.deleteJob('job-offscreen-overlap')", context);
    vm.runInContext("browserPreloadJobs.delete('job-offscreen-overlap')", context);
    delete context.offscreenOverlapRecord;
    context.transcribeBrowserAudioChunk = originalTranscribeBrowserAudioChunk;
    context.translateBrowserSegments = originalTranslateBrowserSegments;
  }
}

{
  const originalTranscribeBrowserAudioChunk = context.transcribeBrowserAudioChunk;
  const originalTranslateBrowserSegments = context.translateBrowserSegments;
  const record = {
    tabId: 1003,
    runToken: "run-process-cas-race",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/process-cas-race.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/process-cas-race", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-process-cas-race",
      runToken: "run-process-cas-race",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.enqueueBrowserLogicalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "process-cas-race.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-process-cas-race/0.mp3" }
  });
  context.closeAllBrowserTranslationGroups(record);
  context.transcribeBrowserAudioChunk = async () => {
    const checkpoint = context.offscreenProcessSnapshots.at(-1)?.chunks?.find(entry => entry.entryType === "translation-group");
    assert.equal(checkpoint?.stage, "asr_inflight", "ASR must not be sent before its fenced inflight checkpoint");
    return [{ start: 1, end: 2, text: "source" }];
  };
  context.translateBrowserSegments = async segments => {
    const checkpoint = context.offscreenProcessSnapshots.at(-1)?.chunks?.find(entry => entry.entryType === "translation-group");
    assert.equal(checkpoint?.stage, "translation", "translation must not be sent before its fenced inflight checkpoint");
    return segments.map(segment => ({ ...segment, text: "译文" }));
  };
  context.processCasRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-process-cas-race', processCasRaceRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(processCasRaceRecord))", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-process-cas-race', 'run-process-cas-race', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.processCasRaceOriginalPutOwned = await vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
  context.processCasRaceFirstEpoch = firstClaim.job.executionEpoch;
  context.processCasRaceTakeover = null;
  vm.runInContext(`browserJobStore.putSnapshotIfOwned = async (snapshot, ownership) => {
    const completedAudio = (snapshot?.chunks || []).some(chunk => chunk.entryType === 'audio-chunk' && chunk.asrCompleted);
    if (!processCasRaceTakeover && completedAudio) {
      await browserJobStore.releaseRun('job-process-cas-race', 'run-process-cas-race', 'owner-a', Date.now(), processCasRaceFirstEpoch);
      processCasRaceTakeover = await browserJobStore.claimRun('job-process-cas-race', 'run-process-cas-race', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 });
    }
    return processCasRaceOriginalPutOwned(snapshot, ownership);
  }`, context);
  try {
    const staleProcess = await context.processOffscreenBrowserJobChunk({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-a",
      executionEpoch: firstClaim.job.executionEpoch,
      chunkIndex: 0
    });
    const takeover = context.processCasRaceTakeover;
    assert.equal(staleProcess.stale, true);
    assert.equal(Boolean(record.audioChunks[0].asrCompleted), true, "the rejected old draft demonstrates the dirty chunk race");
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    const currentAsrCompleted = vm.runInContext("Boolean(browserPreloadJobs.get('job-process-cas-race').audioChunks[0].asrCompleted)", context);
    assert.equal(takeoverWork.interrupted, true);
    assert.equal(currentAsrCompleted, false, "the new owner must not inherit an uncommitted ASR completion flag");
  } finally {
    vm.runInContext("browserJobStore.putSnapshotIfOwned = processCasRaceOriginalPutOwned", context);
    await vm.runInContext("browserJobStore.deleteJob('job-process-cas-race')", context);
    vm.runInContext("browserPreloadJobs.delete('job-process-cas-race')", context);
    delete context.processCasRaceRecord;
    delete context.processCasRaceOriginalPutOwned;
    delete context.processCasRaceFirstEpoch;
    delete context.processCasRaceTakeover;
    context.transcribeBrowserAudioChunk = originalTranscribeBrowserAudioChunk;
    context.translateBrowserSegments = originalTranslateBrowserSegments;
  }
}

{
  const record = {
    tabId: 1008,
    runToken: "run-finalize-owned-write-error",
    pipeline: "funasr",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/finalize-owned-write-error.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/finalize-owned-write-error", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "source" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "译文" }]]]),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      duration: 30,
      asrCompleted: true,
      file: { name: "finalize-owned-write-error.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-finalize-owned-write-error/0.mp3" }
    }],
    job: {
      id: "job-finalize-owned-write-error",
      runToken: "run-finalize-owned-write-error",
      pipeline: "funasr",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: {
        status: "running",
        chunksTotal: 1,
        chunksDone: 1,
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1 }]
      }
    }
  };
  context.finalizeOwnedWriteErrorRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-finalize-owned-write-error', finalizeOwnedWriteErrorRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(finalizeOwnedWriteErrorRecord))", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-finalize-owned-write-error', 'run-finalize-owned-write-error', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.finalizeOwnedWriteErrorOriginalPutOwned = vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
  vm.runInContext("browserJobStore.putSnapshotIfOwned = async () => { throw new Error('injected-finalize-owned-write-error'); }", context);
  let finalizeResult;
  try {
    finalizeResult = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-a",
      executionEpoch: firstClaim.job.executionEpoch
    });
  } finally {
    vm.runInContext("browserJobStore.putSnapshotIfOwned = finalizeOwnedWriteErrorOriginalPutOwned", context);
  }
  try {
    assert.equal(finalizeResult.stale, true);
    assert.equal(finalizeResult.retryable, true);
    assert.equal(record.staleOffscreenOperationDetected, true);
    assert.equal(record.job.status, "completed", "the rejected finalization leaves a dirty draft that takeover must discard");
    await vm.runInContext(`browserJobStore.releaseRun('job-finalize-owned-write-error', 'run-finalize-owned-write-error', 'owner-a', Date.now(), ${firstClaim.job.executionEpoch})`, context);
    const takeover = await vm.runInContext("browserJobStore.claimRun('job-finalize-owned-write-error', 'run-finalize-owned-write-error', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    const currentStatus = vm.runInContext("browserPreloadJobs.get('job-finalize-owned-write-error').job.status", context);
    const durable = await vm.runInContext("browserJobStore.getJob('job-finalize-owned-write-error')", context);
    assert.equal(takeoverWork.interrupted, true);
    assert.equal(currentStatus, "interrupted");
    assert.equal(durable.status, "interrupted");
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('job-finalize-owned-write-error')", context);
    vm.runInContext("browserPreloadJobs.delete('job-finalize-owned-write-error')", context);
    delete context.finalizeOwnedWriteErrorRecord;
    delete context.finalizeOwnedWriteErrorOriginalPutOwned;
  }
}

{
  const durableJob = {
    id: "job-retryable-runtime-start",
    runToken: "run-retryable-runtime-start",
    pipeline: "browser",
    status: "running",
    stage: "asr",
    createdAt: 100,
    updatedAt: 200,
    extract: { status: "completed", progress: 100 },
    translation: { status: "running", chunkStatuses: [] }
  };
  const record = {
    tabId: 1184,
    runToken: durableJob.runToken,
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    recoveryBlocked: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/retryable-runtime-start.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/retryable-runtime-start", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [],
    job: structuredClone(durableJob),
    lastCommittedJob: structuredClone(durableJob)
  };
  const originalPostMessage = taskRuntimePort.postMessage;
  const originalCreateAlarm = chrome.alarms.create;
  const scheduledAlarms = [];
  taskRuntimePort.postMessage = message => {
    Promise.resolve().then(() => {
      for (const listener of taskRuntimePortListeners) {
        listener({
          type: "FUGUANG_TASK_RUNTIME_ERROR",
          commandId: message.commandId,
          error: "injected snapshot read error",
          retryable: true,
          reason: "snapshot-read-error"
        });
      }
    });
  };
  chrome.alarms.create = async (name, options) => {
    scheduledAlarms.push({ name, options });
  };
  context.retryableRuntimeStartRecord = record;
  context.retryableRuntimeStartDurableJob = durableJob;
  vm.runInContext("browserPreloadJobs.set('job-retryable-runtime-start', retryableRuntimeStartRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: retryableRuntimeStartDurableJob, chunks: [] })", context);
  await vm.runInContext("browserJobStore.claimRun('job-retryable-runtime-start', 'run-retryable-runtime-start', { ownerId: 'expired-owner', claimedAt: Date.now() - 1000, leaseDurationMs: 10 })", context);
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(result.reason, "start-unknown", "retryable protocol errors must schedule another recovery instead of interrupting");
    assert.equal(record.job.status, "running");
    assert.ok(scheduledAlarms.some(item => item.name.endsWith(record.job.id)));
  } finally {
    taskRuntimePort.postMessage = originalPostMessage;
    chrome.alarms.create = originalCreateAlarm;
    await vm.runInContext("browserJobStore.deleteJob('job-retryable-runtime-start')", context);
    vm.runInContext("browserPreloadJobs.delete('job-retryable-runtime-start')", context);
    delete context.retryableRuntimeStartRecord;
    delete context.retryableRuntimeStartDurableJob;
  }
}

{
  const durableJob = {
    id: "job-dirty-lease-recovery",
    runToken: "run-dirty-lease-recovery",
    pipeline: "browser",
    status: "running",
    stage: "asr",
    createdAt: 100,
    updatedAt: 200,
    extract: { status: "completed", progress: 100 },
    translation: { status: "running", chunkStatuses: [] }
  };
  const record = {
    tabId: 1180,
    runToken: durableJob.runToken,
    pipeline: "browser",
    cancelled: false,
    recoveryBlocked: false,
    staleOffscreenOperationDetected: true,
    abortController: new AbortController(),
    lastCommittedJob: structuredClone(durableJob),
    audioChunks: [{ index: 0, asrCompleted: true, sourceSegments: [{ text: "dirty" }] }],
    job: {
      ...structuredClone(durableJob),
      status: "completed",
      stage: "completed",
      updatedAt: 999
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const originalCreateAlarm = chrome.alarms.create;
  const scheduledAlarms = [];
  const starts = [];
  context.startBrowserJobInOffscreen = async (_record, options) => {
    starts.push(options);
    return { status: "started", duplicate: false, executionLeaseExpiresAt: Date.now() + 30_000 };
  };
  chrome.alarms.create = async (name, options) => {
    scheduledAlarms.push({ name, options });
  };
  context.dirtyLeaseRecoveryRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-dirty-lease-recovery', dirtyLeaseRecoveryRecord)", context);
  await vm.runInContext(`browserJobStore.putSnapshot({
    job: ${JSON.stringify(durableJob)},
    chunks: [{ entryType: 'audio-chunk', index: 0, asrCompleted: false }]
  })`, context);
  await vm.runInContext("browserJobStore.claimRun('job-dirty-lease-recovery', 'run-dirty-lease-recovery', { ownerId: 'expired-owner', claimedAt: Date.now() - 1000, leaseDurationMs: 10 })", context);
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(result.recovered, true, "dirty terminal memory must not suppress recovery of a durable running job");
    assert.equal(starts.length, 1);
    assert.equal(starts[0]?.resumeExisting, true, "automatic recovery must claim the durable snapshot without replaying memory");
    assert.ok(scheduledAlarms.some(item => item.name.endsWith(record.job.id)), "successful recovery must schedule the next lease check from durable status");
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    chrome.alarms.create = originalCreateAlarm;
    await vm.runInContext("browserJobStore.deleteJob('job-dirty-lease-recovery')", context);
    vm.runInContext("browserPreloadJobs.delete('job-dirty-lease-recovery')", context);
    delete context.dirtyLeaseRecoveryRecord;
  }
}

{
  const durableJob = {
    id: "job-durable-terminal-recovery",
    runToken: "run-durable-terminal-recovery",
    pipeline: "browser",
    status: "completed",
    stage: "completed",
    createdAt: 100,
    updatedAt: 300,
    extract: { status: "completed", progress: 100 },
    translation: { status: "completed", chunkStatuses: [] }
  };
  const record = {
    tabId: 1181,
    runToken: durableJob.runToken,
    pipeline: "browser",
    cancelled: false,
    recoveryBlocked: false,
    abortController: new AbortController(),
    startedAt: Date.now(),
    candidate: { url: "https://media.example.test/durable-terminal.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/durable-terminal", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [],
    job: { ...structuredClone(durableJob), status: "running", stage: "asr", updatedAt: 999 }
  };
  record.lastCommittedJob = structuredClone(record.job);
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  let starts = 0;
  context.startBrowserJobInOffscreen = async () => {
    starts += 1;
    return { status: "started", duplicate: false };
  };
  context.durableTerminalRecoveryRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-durable-terminal-recovery', durableTerminalRecoveryRecord)", context);
  await vm.runInContext(`browserJobStore.putSnapshot({ job: ${JSON.stringify(durableJob)}, chunks: [] })`, context);
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(result.reason, "inactive");
    assert.equal(starts, 0, "a durable terminal job must not be restarted from a dirty running draft");
    assert.equal(record.job.status, "completed", "durable terminal state must replace the stale in-memory running view");
    assert.equal(record.lastCommittedJob.status, "completed");
    const polled = context.refreshBrowserPreloadJobForStatus(record.job);
    await context.flushBrowserJobMirror(record.job.id);
    const stored = await vm.runInContext("browserJobStore.getJob('job-durable-terminal-recovery')", context);
    const mirrorPending = vm.runInContext("browserJobMirrorPending.has('job-durable-terminal-recovery')", context);
    assert.equal(polled.status, "completed");
    assert.equal(stored.status, "completed", "status polling must not regress a durable terminal job");
    assert.equal(mirrorPending, false);
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await vm.runInContext("browserJobStore.deleteJob('job-durable-terminal-recovery')", context);
    vm.runInContext("browserPreloadJobs.delete('job-durable-terminal-recovery')", context);
    delete context.durableTerminalRecoveryRecord;
  }
}

{
  const tabId = 1191;
  const pageUrl = "https://example.test/watch/completed-presentation";
  const record = {
    tabId,
    runToken: "run-completed-presentation",
    pipeline: "browser",
    cancelled: false,
    abortController: new AbortController(),
    startedAt: 100,
    candidate: { url: "https://media.example.test/completed-presentation.mp4", kind: "video", ext: "mp4", pageUrl },
    metadata: { pageUrl, duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 2, text: "source" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 2, text: "persisted subtitle" }]]]),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [],
    job: {
      id: "job-completed-presentation",
      runToken: "run-completed-presentation",
      pipeline: "browser",
      status: "completed",
      stage: "completed",
      createdAt: 100,
      updatedAt: 300,
      extract: { status: "completed", progress: 100 },
      translation: {
        status: "completed",
        targetLanguage: "zh-CN",
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1 }]
      }
    }
  };
  record.lastCommittedJob = structuredClone(record.job);
  const originalTabsGet = chrome.tabs.get;
  chrome.tabs.get = async id => ({ id, title: "Completed", url: pageUrl });
  context.completedPresentationRecord = record;
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(completedPresentationRecord))", context);
  vm.runInContext("browserPreloadJobs.delete('job-completed-presentation'); tabState.delete(1191)", context);
  try {
    const status = await context.getStatus(tabId);
    assert.equal(status.preloadJob?.id, record.job.id, "a completed durable job must recover for presentation after the worker restarts");
    assert.equal(status.preloadJob?.status, "completed", "presentation recovery must not turn a completed job into interrupted work");
    assert.match(status.preloadJob?.translation?.vttText || "", /persisted subtitle/);
    const recovered = vm.runInContext("browserPreloadJobs.get('job-completed-presentation')", context);
    assert.equal(recovered.presentationOnly, true);
    assert.equal(recovered.offscreenExecution, false, "presentation recovery must never restart paid or offscreen execution");
  } finally {
    chrome.tabs.get = originalTabsGet;
    await vm.runInContext("browserJobStore.deleteJob('job-completed-presentation')", context);
    vm.runInContext("browserPreloadJobs.delete('job-completed-presentation'); tabState.delete(1191)", context);
    delete context.completedPresentationRecord;
  }
}

{
  const tabId = 1192;
  const originalScheduleSidepanelStatusChange = context.scheduleSidepanelStatusChange;
  let scheduled = 0;
  context.scheduleSidepanelStatusChange = scheduledTabId => {
    assert.equal(scheduledTabId, tabId);
    scheduled += 1;
  };
  context.getState(tabId).preload = "completed";
  try {
    await context.clearTopLevelNavigationState(tabId, { detachSubtitles: false });
    assert.equal(scheduled, 1, "top-level navigation must wake the sidepanel so completed subtitles can reattach without the 15 second fallback");
    assert.equal(vm.runInContext("tabState.has(1192)", context), false);
  } finally {
    context.scheduleSidepanelStatusChange = originalScheduleSidepanelStatusChange;
    vm.runInContext("tabState.delete(1192)", context);
  }
}

{
  const record = {
    tabId: 1182,
    runToken: "run-mirror-commit-tracking",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    audioChunks: [],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-mirror-commit-tracking",
      runToken: "run-mirror-commit-tracking",
      pipeline: "browser",
      status: "queued",
      stage: "queued",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "queued", progress: 0 },
      translation: { status: "queued", chunkStatuses: [] }
    }
  };
  context.mirrorCommitTrackingRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-mirror-commit-tracking', mirrorCommitTrackingRecord)", context);
  await vm.runInContext("scheduleBrowserJobMirror(mirrorCommitTrackingRecord); flushBrowserJobMirror('job-mirror-commit-tracking')", context);
  assert.equal(record.lastCommittedJob?.status, "queued", "a successful mirror must advance the committed UI snapshot");
  const originalPutSnapshot = await vm.runInContext("browserJobStore.putSnapshot", context);
  context.mirrorCommitTrackingOriginalPutSnapshot = originalPutSnapshot;
  record.job.status = "running";
  record.job.stage = "asr";
  vm.runInContext("browserJobStore.putSnapshot = async () => { throw new Error('injected-mirror-error'); }", context);
  try {
    await vm.runInContext("scheduleBrowserJobMirror(mirrorCommitTrackingRecord); flushBrowserJobMirror('job-mirror-commit-tracking')", context);
    const operation = context.createOffscreenBrowserOperation(record, {
      executionOwnerId: "mirror-owner",
      executionEpoch: 1
    });
    try {
      assert.equal(record.lastCommittedJob?.status, "queued", "a failed mirror and operation start must not bless a live draft");
      assert.equal(
        context.browserPreloadJobForRead(record).status,
        "running",
        "the UI may expose live operational status while durable subtitle content remains at the last committed snapshot"
      );
    } finally {
      context.disposeOffscreenBrowserOperation(record, operation);
    }
  } finally {
    vm.runInContext("browserJobStore.putSnapshot = mirrorCommitTrackingOriginalPutSnapshot", context);
    await vm.runInContext("browserJobStore.deleteJob('job-mirror-commit-tracking')", context);
    vm.runInContext("browserPreloadJobs.delete('job-mirror-commit-tracking')", context);
    delete context.mirrorCommitTrackingRecord;
    delete context.mirrorCommitTrackingOriginalPutSnapshot;
  }
}

{
  const tabId = 1183;
  seedPage(tabId, { duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const oldRecord = {
    tabId,
    runToken: "run-vtt-race-old",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "job-vtt-race",
      runToken: "run-vtt-race-old",
      status: "completed",
      stage: "completed",
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold subtitle\n",
        transcript: null
      }
    }
  };
  const replacement = {
    ...oldRecord,
    runToken: "run-vtt-race-new",
    abortController: new AbortController(),
    job: { ...oldRecord.job, runToken: "run-vtt-race-new", status: "interrupted", stage: "interrupted" }
  };
  let releaseOverlay;
  let overlayStarted;
  const overlayGate = new Promise(resolve => { releaseOverlay = resolve; });
  const overlayStartedPromise = new Promise(resolve => { overlayStarted = resolve; });
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  let attachMessages = 0;
  context.ensureSubtitleOverlay = async () => {
    overlayStarted();
    await overlayGate;
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachMessages += 1;
    }
    return { ok: true };
  };
  context.vttRaceOldRecord = oldRecord;
  context.vttRaceReplacement = replacement;
  vm.runInContext("browserPreloadJobs.set('job-vtt-race', vttRaceOldRecord)", context);
  try {
    const pendingAttach = context.attachBrowserJobVttIfReady(oldRecord);
    await overlayStartedPromise;
    vm.runInContext("browserPreloadJobs.set('job-vtt-race', vttRaceReplacement)", context);
    releaseOverlay();
    await pendingAttach;
    assert.equal(attachMessages, 0, "a replaced record must be rechecked after overlay injection before sending VTT");
    assert.equal(context.getState(tabId).attachedVttSignature, "");
  } finally {
    releaseOverlay();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    vm.runInContext("browserPreloadJobs.delete('job-vtt-race')", context);
    delete context.vttRaceOldRecord;
    delete context.vttRaceReplacement;
  }
}

{
  const tabId = 1185;
  const pageUrl = "https://example.test/watch/vtt-refresh-race";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-vtt-refresh-race",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: "job-vtt-refresh-race",
      runToken: "run-vtt-refresh-race",
      status: "running",
      stage: "translation",
      updatedAt: 100,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold subtitle\n",
        transcript: null
      }
    }
  };
  const originalTabsGet = chrome.tabs.get;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalScheduleSidepanelStatusChange = context.scheduleSidepanelStatusChange;
  let statusPushesScheduled = 0;
  let releaseRefresh;
  let markRefreshStarted;
  const refreshGate = new Promise(resolve => {
    releaseRefresh = resolve;
  });
  const refreshStarted = new Promise(resolve => {
    markRefreshStarted = resolve;
  });
  const attachMessages = [];
  chrome.tabs.get = async () => {
    markRefreshStarted();
    await refreshGate;
    return { id: tabId, title: "Video", url: pageUrl };
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachMessages.push(structuredClone(message));
    }
    return { ok: true };
  };
  context.scheduleSidepanelStatusChange = () => {
    statusPushesScheduled += 1;
  };
  context.vttRefreshRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-vtt-refresh-race', vttRefreshRaceRecord)", context);
  try {
    const checkedPromise = context.checkPreloadJob(record.job.id, tabId);
    await refreshStarted;
    record.job.updatedAt = 200;
    record.job.translation.vttText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew subtitle\n";
    releaseRefresh();
    const checked = await checkedPromise;
    assert.match(checked.job.translation.vttText, /new subtitle/);
    assert.equal(attachMessages.length, 1);
    assert.equal(statusPushesScheduled, 0, "a read-only job check must not schedule another sidepanel status push");
    assert.match(attachMessages[0].vtt, /new subtitle/, "a pre-refresh snapshot must not attach after a newer subtitle commit");
    assert.doesNotMatch(attachMessages[0].vtt, /old subtitle/);

    let releaseRecovery;
    context.delayedStatusRecoveryPromise = new Promise(resolve => { releaseRecovery = resolve; });
    vm.runInContext("browserJobRecoveryPromise = delayedStatusRecoveryPromise", context);
    vm.runInContext("browserPreloadJobs.delete('job-vtt-refresh-race')", context);
    context.getState(tabId).preload = "completed";
    context.getState(tabId).preloadJob = structuredClone(record.job);
    let recoveryCheckSettled = false;
    const recoveryCheck = context.checkPreloadJob(record.job.id, tabId).then(result => {
      recoveryCheckSettled = true;
      return result;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(recoveryCheckSettled, false, "status lookup must wait for durable recovery before declaring a job missing");
    assert.equal(context.getState(tabId).preloadJob.id, record.job.id, "a pending recovery must not clear visible job state");
    vm.runInContext("browserPreloadJobs.set('job-vtt-refresh-race', vttRefreshRaceRecord)", context);
    releaseRecovery({ recovered: 1 });
    const recoveredCheck = await recoveryCheck;
    assert.equal(recoveredCheck.missing, undefined);
    assert.equal(recoveredCheck.job.id, record.job.id);
    vm.runInContext("browserJobRecoveryPromise = Promise.resolve({ recovered: 1 })", context);
    delete context.delayedStatusRecoveryPromise;
  } finally {
    releaseRefresh();
    chrome.tabs.get = originalTabsGet;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.scheduleSidepanelStatusChange = originalScheduleSidepanelStatusChange;
    vm.runInContext("browserPreloadJobs.delete('job-vtt-refresh-race')", context);
    delete context.vttRefreshRaceRecord;
  }
}

{
  const record = {
    tabId: 1002,
    runToken: "run-finalize-cas-race",
    pipeline: "funasr",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/finalize-cas-race.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/finalize-cas-race", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "source" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "译文" }]]]),
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      duration: 30,
      asrCompleted: true,
      file: { name: "finalize-cas-race.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-finalize-cas-race/0.mp3" }
    }],
    job: {
      id: "job-finalize-cas-race",
      runToken: "run-finalize-cas-race",
      pipeline: "funasr",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: {
        status: "running",
        chunksTotal: 1,
        chunksDone: 1,
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1 }]
      }
    }
  };
  context.finalizeCasRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-finalize-cas-race', finalizeCasRaceRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(finalizeCasRaceRecord))", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-finalize-cas-race', 'run-finalize-cas-race', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.finalizeCasRaceOriginalPutOwned = await vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
  context.finalizeCasRaceFirstEpoch = firstClaim.job.executionEpoch;
  context.finalizeCasRaceTakeover = null;
  vm.runInContext(`browserJobStore.putSnapshotIfOwned = async (snapshot, ownership) => {
    if (!finalizeCasRaceTakeover && snapshot?.job?.status === 'completed') {
      await browserJobStore.releaseRun('job-finalize-cas-race', 'run-finalize-cas-race', 'owner-a', Date.now(), finalizeCasRaceFirstEpoch);
      finalizeCasRaceTakeover = await browserJobStore.claimRun('job-finalize-cas-race', 'run-finalize-cas-race', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 });
    }
    return finalizeCasRaceOriginalPutOwned(snapshot, ownership);
  }`, context);
  try {
    const staleFinalize = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-a",
      executionEpoch: firstClaim.job.executionEpoch
    });
    const takeover = context.finalizeCasRaceTakeover;
    assert.equal(staleFinalize.stale, true);
    assert.equal(record.job.status, "completed", "the rejected old draft demonstrates the dirty in-memory race");
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    const currentStatus = vm.runInContext("browserPreloadJobs.get('job-finalize-cas-race').job.status", context);
    const currentAsrCompleted = vm.runInContext("Boolean(browserPreloadJobs.get('job-finalize-cas-race').audioChunks[0].asrCompleted)", context);
    const durable = await vm.runInContext("browserJobStore.getJob('job-finalize-cas-race')", context);
    assert.equal(takeoverWork.interrupted, true);
    assert.equal(currentStatus, "interrupted", "the new owner must replace dirty memory with the durable snapshot");
    assert.equal(currentAsrCompleted, true, "already committed ASR state remains reusable after clean rehydration");
    assert.equal(durable.status, "interrupted");
  } finally {
    vm.runInContext("browserJobStore.putSnapshotIfOwned = finalizeCasRaceOriginalPutOwned", context);
    await vm.runInContext("browserJobStore.deleteJob('job-finalize-cas-race')", context);
    vm.runInContext("browserPreloadJobs.delete('job-finalize-cas-race')", context);
    delete context.finalizeCasRaceRecord;
    delete context.finalizeCasRaceOriginalPutOwned;
    delete context.finalizeCasRaceFirstEpoch;
    delete context.finalizeCasRaceTakeover;
  }
}

{
  const originalTranscribeBrowserAudioChunk = context.transcribeBrowserAudioChunk;
  const originalTranslateBrowserSegments = context.translateBrowserSegments;
  const record = {
    tabId: 1004,
    runToken: "run-process-owned-write-error",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/process-owned-write-error.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/process-owned-write-error", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    job: {
      id: "job-process-owned-write-error",
      runToken: "run-process-owned-write-error",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.enqueueBrowserLogicalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "owned-write-error.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-process-owned-write-error/0.mp3" }
  });
  context.closeAllBrowserTranslationGroups(record);
  context.transcribeBrowserAudioChunk = async () => [{ start: 1, end: 2, text: "source" }];
  context.translateBrowserSegments = async segments => segments.map(segment => ({ ...segment, text: "译文" }));
  context.processOwnedWriteErrorRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-process-owned-write-error', processOwnedWriteErrorRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(processOwnedWriteErrorRecord))", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-process-owned-write-error', 'run-process-owned-write-error', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.processOwnedWriteErrorOriginalPutOwned = await vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
  vm.runInContext("browserJobStore.putSnapshotIfOwned = async () => { throw new Error('injected-owned-write-error'); }", context);
  let processResult = null;
  let processError = null;
  try {
    processResult = await context.processOffscreenBrowserJobChunk({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-a",
      executionEpoch: firstClaim.job.executionEpoch,
      chunkIndex: 0
    });
  } catch (error) {
    processError = error;
  } finally {
    vm.runInContext("browserJobStore.putSnapshotIfOwned = processOwnedWriteErrorOriginalPutOwned", context);
  }
  try {
    assert.equal(processError, null, "owned write failures must become structured stale results");
    assert.equal(processResult?.stale, true);
    assert.equal(record.staleOffscreenOperationDetected, true);
    await vm.runInContext(`browserJobStore.releaseRun('job-process-owned-write-error', 'run-process-owned-write-error', 'owner-a', Date.now(), ${firstClaim.job.executionEpoch})`, context);
    const takeover = await vm.runInContext("browserJobStore.claimRun('job-process-owned-write-error', 'run-process-owned-write-error', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    const currentAsrCompleted = vm.runInContext("Boolean(browserPreloadJobs.get('job-process-owned-write-error').audioChunks[0].asrCompleted)", context);
    assert.equal(takeoverWork.interrupted, true);
    assert.equal(currentAsrCompleted, false, "a rejected owned write must not leak its dirty ASR result into takeover");
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('job-process-owned-write-error')", context);
    vm.runInContext("browserPreloadJobs.delete('job-process-owned-write-error')", context);
    delete context.processOwnedWriteErrorRecord;
    delete context.processOwnedWriteErrorOriginalPutOwned;
    context.transcribeBrowserAudioChunk = originalTranscribeBrowserAudioChunk;
    context.translateBrowserSegments = originalTranslateBrowserSegments;
  }
}

{
  const record = {
    tabId: 1005,
    runToken: "run-snapshot-read-error",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/snapshot-read-error.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/snapshot-read-error", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      duration: 30,
      asrCompleted: true,
      file: { name: "snapshot-read-error.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-snapshot-read-error/0.mp3" }
    }],
    staleOffscreenOperationDetected: true,
    job: {
      id: "job-snapshot-read-error",
      runToken: "run-snapshot-read-error",
      pipeline: "browser",
      status: "completed",
      stage: "completed",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: { status: "completed", chunksTotal: 1, chunksDone: 1, chunkStatuses: [] }
    }
  };
  const durableDraft = {
    ...record,
    audioChunks: [{ ...record.audioChunks[0], asrCompleted: false }],
    job: { ...record.job, status: "running", stage: "asr", translation: { ...record.job.translation, status: "running" } }
  };
  context.snapshotReadErrorRecord = record;
  context.snapshotReadErrorDurableDraft = durableDraft;
  vm.runInContext("browserPreloadJobs.set('job-snapshot-read-error', snapshotReadErrorRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(snapshotReadErrorDurableDraft))", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-snapshot-read-error', 'run-snapshot-read-error', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.snapshotReadErrorOriginalGetJob = await vm.runInContext("browserJobStore.getJob", context);
  context.snapshotReadErrorOriginalGetSnapshot = vm.runInContext("typeof browserJobStore.getSnapshot === 'function' ? browserJobStore.getSnapshot : null", context);
  context.snapshotReadErrorOriginalGetChunks = await vm.runInContext("browserJobStore.getChunks", context);
  vm.runInContext(`
    snapshotReadErrorGetJobCalls = 0;
    browserJobStore.getJob = async (...args) => {
      snapshotReadErrorGetJobCalls += 1;
      if (snapshotReadErrorGetJobCalls === 1) {
        return snapshotReadErrorOriginalGetJob(...args);
      }
      throw new Error('injected-snapshot-read-error');
    };
    if (snapshotReadErrorOriginalGetSnapshot) {
      browserJobStore.getSnapshot = async () => { throw new Error('injected-snapshot-read-error'); };
    } else {
      browserJobStore.getChunks = async () => { throw new Error('injected-snapshot-read-error'); };
    }
  `, context);
  try {
    const result = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: claim.job.executionEpoch
    });
    const durable = await context.snapshotReadErrorOriginalGetJob("job-snapshot-read-error");
    const currentRecordIsDirtyOriginal = vm.runInContext("browserPreloadJobs.get('job-snapshot-read-error') === snapshotReadErrorRecord", context);
    assert.equal(result.retryable, true, "snapshot read errors must fail closed and remain retryable");
    assert.equal(currentRecordIsDirtyOriginal, true, "a failed rehydration must not replace the in-memory record");
    assert.equal(durable.status, "running", "a failed rehydration must not commit dirty memory as interrupted");
  } finally {
    vm.runInContext(`
      browserJobStore.getJob = snapshotReadErrorOriginalGetJob;
      browserJobStore.getChunks = snapshotReadErrorOriginalGetChunks;
      if (snapshotReadErrorOriginalGetSnapshot) browserJobStore.getSnapshot = snapshotReadErrorOriginalGetSnapshot;
    `, context);
    await vm.runInContext("browserJobStore.deleteJob('job-snapshot-read-error')", context);
    vm.runInContext("browserPreloadJobs.delete('job-snapshot-read-error')", context);
    delete context.snapshotReadErrorRecord;
    delete context.snapshotReadErrorDurableDraft;
    delete context.snapshotReadErrorOriginalGetJob;
    delete context.snapshotReadErrorOriginalGetSnapshot;
    delete context.snapshotReadErrorOriginalGetChunks;
  }
}

{
  const oldRecord = {
    tabId: 1006,
    runToken: "run-deferred-extraction-takeover",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/deferred-extraction.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/deferred-extraction", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [],
    job: {
      id: "job-deferred-extraction-takeover",
      runToken: "run-deferred-extraction-takeover",
      pipeline: "browser",
      status: "running",
      stage: "extracting",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "running", progress: 10, duration: 30 },
      translation: { status: "queued", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  const originalExtract = context.extractCandidateAudioInBrowser;
  const originalStart = context.startBrowserJobInOffscreen;
  const originalResolveOwner = context.resolveBrowserJobExecutionOwner;
  let resolveExtraction;
  let extractionStarted;
  const extractionStartedPromise = new Promise(resolve => { extractionStarted = resolve; });
  context.extractCandidateAudioInBrowser = () => new Promise(resolve => {
    resolveExtraction = resolve;
    extractionStarted();
  });
  context.startBrowserJobInOffscreen = async () => ({ status: "started" });
  context.resolveBrowserJobExecutionOwner = async () => "offscreen";
  context.deferredExtractionOldRecord = oldRecord;
  vm.runInContext("browserPreloadJobs.set('job-deferred-extraction-takeover', deferredExtractionOldRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(deferredExtractionOldRecord))", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-deferred-extraction-takeover', 'run-deferred-extraction-takeover', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const running = context.runBrowserPreloadJob("job-deferred-extraction-takeover");
  await extractionStartedPromise;
  oldRecord.staleOffscreenOperationDetected = true;
  await vm.runInContext(`browserJobStore.releaseRun('job-deferred-extraction-takeover', 'run-deferred-extraction-takeover', 'owner-a', Date.now(), ${firstClaim.job.executionEpoch})`, context);
  const takeover = await vm.runInContext("browserJobStore.claimRun('job-deferred-extraction-takeover', 'run-deferred-extraction-takeover', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  try {
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: oldRecord.job.id,
      runToken: oldRecord.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    assert.equal(takeoverWork.interrupted, true);
    await new Promise(resolve => setTimeout(resolve, 2));
    resolveExtraction({
      duration: 30,
      chunks: [{
        index: 0,
        start: 0,
        end: 30,
        duration: 30,
        file: { name: "late.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-deferred-extraction-takeover/late.mp3" }
      }]
    });
    await running;
    await vm.runInContext("flushBrowserJobMirror('job-deferred-extraction-takeover')", context);
    const durable = await vm.runInContext("browserJobStore.getJob('job-deferred-extraction-takeover')", context);
    const current = vm.runInContext("browserPreloadJobs.get('job-deferred-extraction-takeover')", context);
    assert.notEqual(current, oldRecord, "takeover must retain the clean recovered record");
    assert.equal(current.job.status, "interrupted");
    assert.equal(durable.status, "interrupted", "a late extraction result must not overwrite takeover state");
    assert.equal(oldRecord.abortController.signal.aborted, true, "takeover must abort the superseded extraction");
  } finally {
    resolveExtraction?.({ duration: 0, chunks: [] });
    await running.catch(() => {});
    context.extractCandidateAudioInBrowser = originalExtract;
    context.startBrowserJobInOffscreen = originalStart;
    context.resolveBrowserJobExecutionOwner = originalResolveOwner;
    await vm.runInContext("browserJobStore.deleteJob('job-deferred-extraction-takeover')", context);
    vm.runInContext("browserPreloadJobs.delete('job-deferred-extraction-takeover')", context);
    delete context.deferredExtractionOldRecord;
  }
}

{
  const oldRecord = {
    tabId: 1009,
    runToken: "run-stale-failure-handler",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    job: {
      id: "job-stale-failure-handler",
      runToken: "run-stale-failure-handler",
      status: "running",
      stage: "extracting",
      extract: { status: "running", elapsedSeconds: 0 },
      translation: { status: "queued", chunkStatuses: [] }
    }
  };
  const cleanRecord = {
    ...oldRecord,
    abortController: new AbortController(),
    job: {
      ...oldRecord.job,
      status: "interrupted",
      stage: "interrupted",
      error: "takeover"
    }
  };
  context.staleFailureOldRecord = oldRecord;
  context.staleFailureCleanRecord = cleanRecord;
  vm.runInContext("browserPreloadJobs.set('job-stale-failure-handler', staleFailureCleanRecord)", context);
  try {
    context.failBrowserPreloadJob(oldRecord, new Error("late extraction failure"));
    assert.equal(cleanRecord.job.status, "interrupted", "an old task catch handler must not fail the replacement record");
    assert.equal(cleanRecord.job.error, "takeover");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('job-stale-failure-handler')", context);
    delete context.staleFailureOldRecord;
    delete context.staleFailureCleanRecord;
  }
}

{
  const job = {
    id: "job-uncommitted-ui",
    runToken: "run-uncommitted-ui",
    status: "running",
    stage: "asr",
    createdAt: 100,
    updatedAt: 200,
    extract: { status: "completed", progress: 100 },
    translation: { status: "running", chunksTotal: 1, chunksDone: 0, chunkStatuses: [] }
  };
  const record = {
    tabId: 1007,
    runToken: job.runToken,
    job,
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [],
    lastCommittedJob: structuredClone(job),
    offscreenMirrorSuppressionCount: 1
  };
  context.uncommittedUiRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-uncommitted-ui', uncommittedUiRecord)", context);
  context.setTabStatus(1007, { preload: "running", preloadJob: job, page: { url: "" }, context: { href: "" } });
  job.status = "completed";
  job.stage = "completed";
  try {
    const stateReferenceStatus = vm.runInContext("getState(1007).preloadJob.status", context);
    const polled = context.refreshBrowserPreloadJobForStatus(job);
    assert.equal(stateReferenceStatus, "running", "tab state must not retain a mutable job reference");
    assert.equal(polled.status, "running", "status polling must expose the last committed snapshot while a write is pending");
    delete record.offscreenMirrorSuppressionCount;
    record.staleOffscreenOperationDetected = true;
    const polledAfterFailure = context.refreshBrowserPreloadJobForStatus(job);
    const dirtyMirrorQueued = vm.runInContext("browserJobMirrorPending.has('job-uncommitted-ui')", context);
    assert.equal(polledAfterFailure.status, "running", "a rejected draft must stay hidden until durable rehydration");
    assert.equal(dirtyMirrorQueued, false, "status polling must not mirror a rejected draft through the ordinary writer");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('job-uncommitted-ui')", context);
    delete context.uncommittedUiRecord;
  }
}

{
  const record = {
    tabId: 781,
    runToken: "run-offscreen-fence",
    pipeline: "browser",
    cancelled: false,
    audioChunks: [],
    job: {
      id: "job-offscreen-fence",
      runToken: "run-offscreen-fence",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    }
  };
  context.offscreenFenceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-offscreen-fence', offscreenFenceRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: offscreenFenceRecord.job, chunks: [] })", context);
  const first = await vm.runInContext("browserJobStore.claimRun('job-offscreen-fence', 'run-offscreen-fence', { ownerId: 'same-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  await vm.runInContext(`browserJobStore.releaseRun('job-offscreen-fence', 'run-offscreen-fence', 'same-owner', Date.now(), ${first.job.executionEpoch})`, context);
  const second = await vm.runInContext("browserJobStore.claimRun('job-offscreen-fence', 'run-offscreen-fence', { ownerId: 'same-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  try {
    const stale = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "same-owner",
      executionEpoch: first.job.executionEpoch
    });
    assert.equal(stale.stale, true);
    assert.equal(stale.reason, "stale-epoch", "an old fence must be rejected even when the runtime owner id is reused");
    const current = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "same-owner",
      executionEpoch: second.job.executionEpoch
    });
    assert.equal(current.accepted, true);
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('job-offscreen-fence')", context);
    vm.runInContext("browserPreloadJobs.delete('job-offscreen-fence')", context);
    delete context.offscreenFenceRecord;
  }
}

{
  const record = {
    tabId: 778,
    runToken: "run-extraction-terminal-recovery",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/recovered-extraction.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/recovered-extraction", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrDiagnosticsByChunk: new Map(),
    audioChunks: [],
    job: {
      id: "job-extraction-terminal-recovery",
      runToken: "run-extraction-terminal-recovery",
      pipeline: "browser",
      status: "running",
      stage: "extracting",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "running", progress: 85, duration: 30 },
      translation: { status: "queued", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.extractionTerminalRecoveryRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-extraction-terminal-recovery', extractionTerminalRecoveryRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(extractionTerminalRecoveryRecord))", context);
  const terminalMessage = {
    jobId: record.job.id,
    runToken: record.runToken,
    tabId: record.tabId,
    result: {
      duration: 30,
      chunkSeconds: 30,
      chunks: [{
        index: 0,
        start: 0,
        end: 30,
        duration: 30,
        coreStart: 0,
        coreEnd: 30,
        file: {
          name: "recovered-extraction.mp3",
          mime: "audio/mpeg",
          cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-extraction-terminal-recovery/0.mp3",
          bytes: 1024
        }
      }]
    }
  };
  try {
    const completed = await context.applyOffscreenWebFfmpegCompleted(terminalMessage);
    assert.equal(completed.accepted, true);
    assert.equal(record.job.extract.status, "completed");
    assert.equal(record.job.extract.progress, 100);
    assert.equal(record.audioChunks.length, 1);
    const durable = await vm.runInContext("browserJobStore.getSnapshot('job-extraction-terminal-recovery', 'run-extraction-terminal-recovery')", context);
    assert.equal(durable.job.extract.status, "completed", "a replacement Worker must durably reconcile the extraction terminal event");
    assert.equal(durable.chunks.some(entry => entry.entryType === "audio-chunk" && entry.audioCacheRef), true);

    const replay = await context.applyOffscreenWebFfmpegCompleted(terminalMessage);
    assert.equal(replay.duplicate, true, "terminal delivery must be idempotent after an acknowledgement is lost");
    assert.equal(record.audioChunks.length, 1);
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('job-extraction-terminal-recovery')", context);
    vm.runInContext("browserPreloadJobs.delete('job-extraction-terminal-recovery')", context);
    delete context.extractionTerminalRecoveryRecord;
  }
}

{
  const originalReleaseMediaHeaderLease = context.releaseMediaHeaderLease;
  const lease = {
    leaseToken: "lease-terminal-before-stale",
    ruleId: 250123,
    jobId: "job-terminal-before-stale",
    runToken: "run-terminal-before-stale"
  };
  let releaseCalls = 0;
  context.releaseMediaHeaderLease = async received => {
    releaseCalls += 1;
    assert.deepEqual(JSON.parse(JSON.stringify(received)), lease);
    return { released: true, alreadyAbsent: false };
  };
  try {
    const stale = await context.applyOffscreenWebFfmpegCompleted({
      jobId: lease.jobId,
      runToken: lease.runToken,
      tabId: 7790,
      mediaHeaderLease: lease,
      result: {}
    });
    assert.equal(stale.stale, true);
    assert.equal(releaseCalls, 1, "a replacement Worker must release the exact DNR lease before rejecting a stale terminal event");

    context.releaseMediaHeaderLease = async () => ({
      released: false,
      retryable: true,
      reason: "dnr-remove-failed"
    });
    const retryable = await context.applyOffscreenWebFfmpegFailed({
      jobId: lease.jobId,
      runToken: lease.runToken,
      tabId: 7790,
      mediaHeaderLease: lease,
      error: "extraction failed"
    });
    assert.equal(retryable.retryable, true, "offscreen must keep retrying terminal delivery until the DNR rule is released");
    assert.equal(retryable.stale, undefined, "release failure must be handled before stale job routing");
  } finally {
    context.releaseMediaHeaderLease = originalReleaseMediaHeaderLease;
  }
}

{
  const recovered = context.recoverBrowserJobRecord({
    id: "job-recover-open-stream-group",
    runToken: "run-recover-open-stream-group",
    pipeline: "browser",
    status: "running",
    stage: "asr",
    tabId: 779,
    createdAt: 100,
    updatedAt: 200,
    executionRunToken: "run-recover-open-stream-group",
    executionStartedAt: 150,
    extract: { status: "running", progress: 25, asrChunkSeconds: 30, chunkSeconds: 900 },
    translation: { status: "running", total: 1, asrWorkers: 1, translationWorkers: 1 },
    source: { identity: "https://media.example.test/live-stream.m3u8", kind: "hls", ext: "m3u8" },
    pageIdentity: "https://example.test/watch/live-stream"
  }, [
    {
      entryType: "translation-group",
      index: 0,
      stage: "asr",
      status: "识别",
      sourceSegments: [],
      translatedSegments: []
    },
    {
      entryType: "audio-chunk",
      index: 0,
      translationGroupIndex: 0,
      audioCacheRef: "https://fuguang.local/__fuguang_audio_cache/job-recover-open-stream-group/000.mp3",
      audioStart: 0,
      audioEnd: 30,
      audioDuration: 30,
      audioCoreStart: 0,
      audioCoreEnd: 30,
      asrCompleted: false
    }
  ], {
    asr: {},
    translation: {},
    targetLanguage: "zh-CN",
    asrWorkers: 1,
    workers: 1,
    chunkSeconds: 900
  });
  const group = recovered.browserTranslationGroups.get(0);
  assert.equal(group.closed, false, "the last partial translation group must remain open while streaming extraction is still running");
  assert.equal(context.enqueueBrowserLogicalAudioChunk(recovered, {
    index: 1,
    start: 30,
    end: 60,
    coreStart: 30,
    coreEnd: 60,
    duration: 30,
    file: {
      name: "001.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-recover-open-stream-group/001.mp3"
    }
  }), true);
  context.completeBrowserAsrChunkForGroup(recovered, recovered.audioChunks[0], [
    { start: 1, end: 2, text: "first window" }
  ]);
  context.completeBrowserAsrChunkForGroup(recovered, recovered.audioChunks[1], [
    { start: 31, end: 32, text: "second window" }
  ]);
  assert.equal(recovered.browserTranslationQueue.items.length, 0, "an open streaming group must not translate before its later windows arrive");
  context.closeAllBrowserTranslationGroups(recovered);
  assert.equal(recovered.browserTranslationQueue.items.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(recovered.browserTranslationQueue.items[0].sourceSegments.map(segment => segment.text))),
    ["first window", "second window"]
  );
}

{
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.attachBrowserJobVttIfReady = async () => {};
  const runCase = async ({ suffix, error }) => {
    const jobId = `job-rerun-source-only-${suffix}`;
    const runToken = `run-rerun-source-only-${suffix}`;
    const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/audio.mp3`;
    const record = {
      tabId: suffix === "failed" ? 783 : 784,
      runToken,
      pipeline: "browser",
      startedAt: Date.now(),
      candidate: { url: `https://media.example.test/${suffix}.mp3`, kind: "audio", ext: "mp3", duration: 30 },
      metadata: { pageUrl: `https://example.test/watch/${suffix}`, duration: 30 },
      modelConfig: {
        asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
        translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
        targetLanguage: "en",
        asrWorkers: 1,
        workers: 1,
        chunkSeconds: 900
      },
      sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: `old source ${suffix}`, chunkIndex: 0, segmentIndex: 0 }]]]),
      translatedSegmentsByChunk: new Map(),
      job: {
        id: jobId,
        runToken,
        pipeline: "browser",
        status: "running",
        stage: "asr",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        extract: { status: "completed", progress: 100, duration: 30 },
        translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
      }
    };
    const chunk = {
      index: 0, start: 0, end: 30, coreStart: 0, coreEnd: 30, duration: 30,
      file: { name: `${suffix}.mp3`, mime: "audio/mpeg", cacheUrl }
    };
    await (await caches.open("fuguang-web-ffmpeg-audio")).put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer));
    context.enqueueBrowserLogicalAudioChunk(record, chunk);
    context.refreshBrowserSubtitleProjection(record);
    assert.match(record.job.translation.vttText, new RegExp(`old source ${suffix}`));
    context.rerunSourceOnlyRecord = record;
    vm.runInContext("browserPreloadJobs.set(rerunSourceOnlyRecord.job.id, rerunSourceOnlyRecord)", context);
    await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(rerunSourceOnlyRecord))", context);
    const claim = await vm.runInContext(`browserJobStore.claimRun('${jobId}', '${runToken}', { ownerId: 'rerun-source-only-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })`, context);
    const fence = { executionOwnerId: "rerun-source-only-owner", executionEpoch: claim.job.executionEpoch };
    try {
      const input = await context.getOffscreenBrowserJobExecutionInput({
        jobId, runToken, ...fence, chunkIndex: 0, workType: "asr"
      });
      assert.equal(input.accepted, true, JSON.stringify(input));
      const committed = await context.commitOffscreenBrowserJobWorkResult({
        jobId, runToken, ...fence, chunkIndex: 0, workType: "asr",
        result: { segments: [], warning: null, diagnostics: null, error }
      });
      assert.equal(committed.accepted, true, JSON.stringify(committed));
      return record;
    } finally {
      await vm.runInContext(`browserJobStore.deleteJob('${jobId}')`, context);
      vm.runInContext(`browserPreloadJobs.delete('${jobId}')`, context);
      delete context.rerunSourceOnlyRecord;
    }
  };
  try {
    const failed = await runCase({
      suffix: "failed",
      error: { message: "provider failure", status: 500, asrStage: "asr_request", deliveryAmbiguous: true }
    });
    assert.equal(failed.sourceSegmentsByChunk.get(0)[0].text, "old source failed", "a failed rerun must retain the prior source-only transcript");
    assert.match(failed.job.translation.vttText, /old source failed/, "a failed rerun must retain the prior source-only VTT");

    const empty = await runCase({ suffix: "empty", error: null });
    assert.deepEqual(JSON.parse(JSON.stringify(empty.sourceSegmentsByChunk.get(0))), [], "a successful no-speech result must still replace the old source");
    assert.doesNotMatch(empty.job.translation.vttText, /old source empty/, "a successful no-speech result must clear the old VTT");
  } finally {
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  const record = {
    tabId: 780, runToken: "run-offscreen-funasr", pipeline: "funasr", startedAt: Date.now(),
    cancelled: false, abortController: new AbortController(),
    candidate: { url: "https://media.example.test/funasr.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/funasr", duration: 20 },
    modelConfig: {
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1", model: "fun-asr", apiKey: "fun-secret" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "llm-secret" },
      targetLanguage: "zh-CN", asrWorkers: 1, workers: 1
    },
    sourceSegmentsByChunk: new Map(), translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-funasr", runToken: "run-offscreen-funasr", pipeline: "funasr",
      status: "running", stage: "asr", createdAt: 100, updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 20 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  const chunk = {
    index: 0, start: 0, end: 20, coreStart: 0, coreEnd: 20, duration: 20,
    file: { name: "funasr.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-offscreen-funasr/0.mp3" }
  };
  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  context.offscreenFunAsrRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-offscreen-funasr', offscreenFunAsrRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: offscreenFunAsrRecord.job, chunks: [] })", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-offscreen-funasr', 'run-offscreen-funasr', { ownerId: 'fun-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const fence = { executionOwnerId: "fun-owner", executionEpoch: claim.job.executionEpoch };
  try {
    const executionInput = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id, runToken: record.runToken, ...fence, chunkIndex: 0, workType: "asr"
    });
    assert.equal(executionInput.accepted, true, JSON.stringify(executionInput));
    assert.equal(executionInput.input.funAsrConfig.providerType, "dashscope_funasr");
    assert.equal(executionInput.input.funAsrConfig.apiKey, "fun-secret");
    assert.equal(executionInput.input.chunk.file.cacheUrl, chunk.file.cacheUrl);
    assert.equal(executionInput.input.semanticRequestPath, "funasr/job-offscreen-funasr/run-offscreen-funasr/chunk/0");
    assert.equal(record.audioChunks[0].asrExecutionMode, "offscreen-durable-v1");
    const durable = context.createBrowserJobLedgerSnapshot(record);
    assert.equal(JSON.stringify(durable).includes("fun-secret"), false);
    assert.equal(durable.chunks.find(item => item.entryType === "audio-chunk").asrExecutionMode, "offscreen-durable-v1");
    const committed = await context.commitOffscreenBrowserJobWorkResult({
      jobId: record.job.id, runToken: record.runToken, ...fence, chunkIndex: 0, workType: "asr",
      result: { segments: [{ start: 0, end: 1, text: "FunASR source" }], remoteTaskId: "task-1", error: null }
    });
    assert.equal(committed.accepted, true);
    assert.equal(record.audioChunks[0].asrCompleted, true);
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "FunASR source");
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('job-offscreen-funasr')", context);
    vm.runInContext("browserPreloadJobs.delete('job-offscreen-funasr')", context);
    delete context.offscreenFunAsrRecord;
  }
}

{
  const record = {
    tabId: 781, runToken: "run-funasr-remote-resume", pipeline: "funasr", startedAt: Date.now(),
    cancelled: false, abortController: new AbortController(),
    metadata: { pageUrl: "https://example.test/funasr-resume", duration: 20 },
    modelConfig: {
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1", model: "fun-asr", apiKey: "fun-secret" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "llm-secret" },
      targetLanguage: "zh-CN", asrWorkers: 1, workers: 1
    },
    sourceSegmentsByChunk: new Map(), translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-funasr-remote-resume", runToken: "run-funasr-remote-resume", pipeline: "funasr",
      status: "running", stage: "asr", createdAt: 100, updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 20 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.enqueueBrowserLogicalAudioChunk(record, {
    index: 0, start: 0, end: 20, coreStart: 0, coreEnd: 20, duration: 20,
    file: { name: "resume.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-funasr-remote-resume/0.mp3" }
  });
  context.offscreenFunAsrResumeRecord = record;
  vm.runInContext("browserPreloadJobs.set(offscreenFunAsrResumeRecord.job.id, offscreenFunAsrResumeRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(offscreenFunAsrResumeRecord))", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-funasr-remote-resume', 'run-funasr-remote-resume', { ownerId: 'fun-resume-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const fence = { executionOwnerId: "fun-resume-owner", executionEpoch: claim.job.executionEpoch };
  const originalStart = context.startBrowserJobInOffscreen;
  let resumeOptions = null;
  try {
    const executionInput = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id, runToken: record.runToken, ...fence, chunkIndex: 0, workType: "asr"
    });
    assert.equal(executionInput.accepted, true, JSON.stringify(executionInput));
    const committed = await context.commitOffscreenBrowserJobWorkResult({
      jobId: record.job.id, runToken: record.runToken, ...fence, chunkIndex: 0, workType: "asr",
      result: {
        segments: [], remoteTaskId: "task-existing", resumeRemoteTask: true,
        error: { message: "temporary poll failure", code: "FUNASR_HTTP_ERROR", status: 500, asrStage: "funasr_remote_pending" }
      }
    });
    assert.equal(committed.resumableRemoteTask, true, JSON.stringify(committed));
    assert.equal(record.audioChunks[0].asrCompleted, false);
    assert.equal(record.audioChunks[0].asrStage, "funasr_remote_pending");
    assert.equal(record.job.status, "interrupted");
    context.enqueueBrowserLogicalAudioChunk(record, {
      index: 1, start: 20, end: 40, coreStart: 20, coreEnd: 40, duration: 20,
      file: { name: "failed.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-funasr-remote-resume/1.mp3" },
      asrCompleted: true, asrError: "remote task definitively failed"
    });
    record.audioChunks.find(chunk => chunk.index === 1).asrCompleted = true;
    record.job.translation.chunkStatuses[1] = {
      index: 1, stage: "failed", status: "失败", asrFailures: 1, error: "remote task definitively failed"
    };
    const originalRunToken = record.runToken;
    context.startBrowserJobInOffscreen = async (_record, options) => {
      resumeOptions = options;
      return { status: "started", executionOwnerId: "fun-resume-owner-2", executionEpoch: 2 };
    };
    const retried = await context.retryBrowserFunAsrFailedPreload(record, [1]);
    assert.equal(retried.accepted, true);
    assert.equal(record.runToken, originalRunToken, "retry must preserve the paid operation identity");
    assert.equal(resumeOptions.resumeExisting, true);
  } finally {
    context.startBrowserJobInOffscreen = originalStart;
    await vm.runInContext("browserJobStore.deleteJob('job-funasr-remote-resume')", context);
    vm.runInContext("browserPreloadJobs.delete('job-funasr-remote-resume')", context);
    delete context.offscreenFunAsrResumeRecord;
  }
}

{
  const originalListJobs = vm.runInContext("browserJobStore.listJobs", context);
  const originalListOperations = vm.runInContext("browserJobStore.listOperations", context);
  const originalResolveRecoveredModelConfig = context.resolveRecoveredModelConfig;
  const pageUrl = "https://example.test/watch/funasr-multiple-media?sid=current";
  const mediaA = {
    url: "https://cdn.example.test/program-a/audio.m4a?token=fresh-a",
    kind: "audio",
    ext: "m4a",
    duration: 600,
    pageUrl
  };
  const mediaB = {
    url: "https://cdn.example.test/program-b/audio.m4a?token=fresh-b",
    kind: "audio",
    ext: "m4a",
    duration: 600,
    pageUrl
  };
  const modelConfig = {
    asr: {
      providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
      model: "fun-asr", apiKey: "transient-key"
    }
  };
  context.samePageCancelledFunAsrLedgers = [
    {
      id: "fun-cancel-media-a", runToken: "run-cancel-media-a", tabId: 783,
      pageIdentity: context.normalizeBrowserPageIdentity(pageUrl), pipeline: "funasr",
      cancelRequested: true, updatedAt: 300,
      source: {
        identity: mediaA.url,
        kind: mediaA.kind,
        ext: mediaA.ext,
        lineageKey: context.getMediaLineageKey({
          ...mediaA,
          pageUrl: context.normalizeBrowserPageIdentity(pageUrl)
        })
      }
    },
    {
      id: "fun-cancel-unknown-media", runToken: "run-cancel-unknown-media", tabId: 783,
      pageIdentity: context.normalizeBrowserPageIdentity(pageUrl), pipeline: "funasr",
      cancelRequested: true, updatedAt: 400,
      source: { identity: "", kind: "", ext: "", lineageKey: "" }
    }
  ];
  context.samePageCancelledFunAsrOperations = jobId => [{
    jobId,
    runToken: jobId === "fun-cancel-media-a" ? "run-cancel-media-a" : "run-cancel-unknown-media",
    operationId: `submit-${jobId}`,
    provider: "dashscope_funasr",
    operationType: "funasr-submit",
    inputHash: `sha256:${jobId}`,
    state: "accepted",
    status: 200
  }];
  vm.runInContext("browserJobStore.listJobs = async () => samePageCancelledFunAsrLedgers", context);
  vm.runInContext("browserJobStore.listOperations = async (jobId) => samePageCancelledFunAsrOperations(jobId)", context);
  context.resolveRecoveredModelConfig = async () => ({ modelConfig });
  try {
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        783, pageUrl, null, modelConfig, mediaA
      ),
      /远端 FunASR.*确认/,
      "an unresolved cancellation for the same media lineage must still prevent a duplicate submit"
    );
    await assert.doesNotReject(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        783, pageUrl, null, modelConfig, mediaB
      ),
      "an unresolved cancellation for media A must not block a different selected media B on the same page"
    );
    context.samePageCurrentFunAsrRecord = {
      modelConfig,
      presentationBinding: {
        lineageKey: context.getMediaLineageKey({
          ...mediaA,
          pageUrl: context.normalizeBrowserPageIdentity(pageUrl)
        })
      }
    };
    vm.runInContext("browserPreloadJobs.set('fun-cancel-media-a', samePageCurrentFunAsrRecord)", context);
    await assert.doesNotReject(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        783,
        pageUrl,
        { id: "fun-cancel-media-a", runToken: "run-cancel-media-a", pipeline: "funasr", cancelRequested: true },
        modelConfig,
        mediaB
      ),
      "the current in-memory cancellation for media A must not block a different selected media B"
    );
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        783,
        pageUrl,
        { id: "fun-cancel-media-a", runToken: "run-cancel-media-a", pipeline: "funasr", cancelRequested: true },
        modelConfig,
        mediaA
      ),
      /远端 FunASR.*确认/,
      "the current in-memory cancellation must still block the same selected media lineage"
    );
    vm.runInContext("browserPreloadJobs.delete('fun-cancel-media-a')", context);
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        783,
        pageUrl,
        { id: "fun-cancel-media-a", runToken: "run-cancel-media-a", pipeline: "funasr", cancelRequested: true },
        modelConfig,
        mediaB
      ),
      /远端 FunASR.*确认/,
      "the explicit current cancelled run remains authoritative even when historical ledgers lack lineage"
    );
  } finally {
    context.originalListJobsForCrossMediaCancelTest = originalListJobs;
    context.originalListOperationsForCrossMediaCancelTest = originalListOperations;
    vm.runInContext("browserJobStore.listJobs = originalListJobsForCrossMediaCancelTest; browserJobStore.listOperations = originalListOperationsForCrossMediaCancelTest", context);
    delete context.originalListJobsForCrossMediaCancelTest;
    delete context.originalListOperationsForCrossMediaCancelTest;
    delete context.samePageCancelledFunAsrLedgers;
    delete context.samePageCancelledFunAsrOperations;
    delete context.samePageCurrentFunAsrRecord;
    vm.runInContext("browserPreloadJobs.delete('fun-cancel-media-a')", context);
    context.resolveRecoveredModelConfig = originalResolveRecoveredModelConfig;
  }
}

{
  const originalListOperations = vm.runInContext("browserJobStore.listOperations", context);
  const pendingOperations = [
    {
      jobId: "fun-cancel-guard", runToken: "run-cancel-guard", operationId: "submit-guard",
      provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:guard",
      state: "completed", remoteTaskId: "remote-guard"
    },
    {
      jobId: "fun-cancel-guard", runToken: "run-cancel-guard", operationId: "funasr-cancel:submit-guard",
      provider: "dashscope_funasr", operationType: "funasr-cancel", inputHash: "sha256:guard",
      state: "unknown", remoteTaskId: "remote-guard",
      result: { submitOperationId: "submit-guard", status: "unknown" }
    }
  ];
  context.pendingFunAsrCancellationOperations = pendingOperations;
  vm.runInContext("browserJobStore.listOperations = async () => pendingFunAsrCancellationOperations", context);
  const cancelCommandsBefore = taskRuntimeSent.filter(message => message.type === "FUGUANG_TASK_RUNTIME_CANCEL_JOB").length;
  const pendingJob = {
    id: "fun-cancel-guard", runToken: "run-cancel-guard", pipeline: "funasr", cancelRequested: true
  };
  const modelConfig = {
    asr: {
      providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
      model: "fun-asr", apiKey: "transient-key"
    }
  };
  try {
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolved(pendingJob, modelConfig),
      /远端 FunASR.*确认/
    );
    assert.equal(taskRuntimeSent.filter(message => message.type === "FUGUANG_TASK_RUNTIME_CANCEL_JOB").length,
      cancelCommandsBefore + 1, "a blocked restart should recheck the existing remote task instead of submitting another ASR task");

    context.resolvedFunAsrCancellationOperations = [
      pendingOperations[0],
      {
        ...pendingOperations[1], state: "completed",
        result: { submitOperationId: "submit-guard", status: "confirmed" }
      }
    ];
    vm.runInContext("browserJobStore.listOperations = async () => resolvedFunAsrCancellationOperations", context);
    await context.preventFunAsrSubmitWhileRemoteCancellationUnresolved(pendingJob, modelConfig);
  } finally {
    context.originalListOperations = originalListOperations;
    vm.runInContext("browserJobStore.listOperations = originalListOperations", context);
    delete context.originalListOperations;
    delete context.pendingFunAsrCancellationOperations;
    delete context.resolvedFunAsrCancellationOperations;
  }
}

{
  const originalListJobs = vm.runInContext("browserJobStore.listJobs", context);
  const originalListOperations = vm.runInContext("browserJobStore.listOperations", context);
  const originalResolveRecoveredModelConfig = context.resolveRecoveredModelConfig;
  const pageUrl = "https://example.test/watch/funasr-cancelled";
  const modelConfig = {
    asr: {
      providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
      model: "fun-asr", apiKey: "transient-key"
    }
  };
  const cancelledMedia = {
    url: "https://cdn.example.test/funasr-cancelled/audio.m4a?token=current",
    kind: "audio",
    ext: "m4a",
    pageUrl
  };
  context.cancelledFunAsrLedgers = [
    {
      id: "fun-cancel-after-refresh", runToken: "run-cancel-after-refresh", tabId: 782,
      pageIdentity: pageUrl, pipeline: "funasr", cancelRequested: true, updatedAt: 200,
      source: { identity: cancelledMedia.url, kind: cancelledMedia.kind, ext: cancelledMedia.ext }
    },
    {
      id: "fun-cancel-other-page", runToken: "run-cancel-other-page", tabId: 782,
      pageIdentity: "https://example.test/watch/other", pipeline: "funasr", cancelRequested: true, updatedAt: 300
    }
  ];
  context.cancelledFunAsrOperations = [
    {
      jobId: "fun-cancel-after-refresh", runToken: "run-cancel-after-refresh", operationId: "submit-after-refresh",
      provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:after-refresh",
      state: "accepted", status: 200
    }
  ];
  vm.runInContext("browserJobStore.listJobs = async () => cancelledFunAsrLedgers", context);
  vm.runInContext("browserJobStore.listOperations = async (jobId) => jobId === 'fun-cancel-after-refresh' ? cancelledFunAsrOperations : []", context);
  context.resolveRecoveredModelConfig = async () => ({ modelConfig });
  try {
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
        782, pageUrl, null, modelConfig, cancelledMedia
      ),
      /远端 FunASR.*确认/,
      "a page refresh must not bypass an unresolved cancellation from its durable ledger"
    );
    await context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
      782, "https://example.test/watch/unrelated", null, modelConfig
    );
    await context.preventFunAsrSubmitWhileRemoteCancellationUnresolvedForTabPage(
      782,
      pageUrl,
      { id: "fun-cancel-after-refresh", runToken: "run-cancel-after-refresh", pipeline: "funasr", cancelRequested: true },
      { asr: { providerType: "openai", baseUrl: "https://asr.example.test/v1", model: "whisper-1", apiKey: "test" } }
    );
  } finally {
    context.originalListJobsForCancelRefreshTest = originalListJobs;
    context.originalListOperationsForCancelRefreshTest = originalListOperations;
    vm.runInContext("browserJobStore.listJobs = originalListJobsForCancelRefreshTest; browserJobStore.listOperations = originalListOperationsForCancelRefreshTest", context);
    delete context.originalListJobsForCancelRefreshTest;
    delete context.originalListOperationsForCancelRefreshTest;
    delete context.cancelledFunAsrLedgers;
    delete context.cancelledFunAsrOperations;
    context.resolveRecoveredModelConfig = originalResolveRecoveredModelConfig;
  }
}

{
  const originalListOperations = vm.runInContext("browserJobStore.listOperations", context);
  vm.runInContext("browserJobStore.listOperations = async () => { throw new Error('operation read failed'); }", context);
  try {
    await assert.rejects(
      context.preventFunAsrSubmitWhileRemoteCancellationUnresolved(
        { id: "fun-cancel-read-failure", runToken: "run-cancel-read-failure", pipeline: "funasr", cancelRequested: true },
        { asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1", model: "fun-asr", apiKey: "test" } }
      ),
      /无法核对上一次 FunASR/
    );
    assert.equal(
      (await context.browserFunAsrRemoteCancellationSummary("fun-cancel-read-failure", "run-cancel-read-failure")).status,
      "none",
      "status projection may remain tolerant while the paid submit gate fails closed"
    );
  } finally {
    context.originalListOperationsForReadFailureTest = originalListOperations;
    vm.runInContext("browserJobStore.listOperations = originalListOperationsForReadFailureTest", context);
    delete context.originalListOperationsForReadFailureTest;
  }
}

{
  const originalListOperations = vm.runInContext("browserJobStore.listOperations", context);
  const cases = [
    {
      name: "definitive HTTP rejection",
      operations: [{
        provider: "dashscope_funasr", operationType: "funasr-submit", state: "completed", status: 400,
        operationId: "submit-http-400", inputHash: "sha256:http-400"
      }],
      expected: "none"
    },
    {
      name: "accepted 2xx without final annotation",
      operations: [{
        provider: "dashscope_funasr", operationType: "funasr-submit", state: "accepted", status: 200,
        operationId: "submit-accepted-200", inputHash: "sha256:accepted-200"
      }],
      expected: "pending"
    },
    {
      name: "delivery-unknown submit",
      operations: [{
        provider: "dashscope_funasr", operationType: "funasr-submit", state: "unknown", status: 0,
        operationId: "submit-unknown", inputHash: "sha256:unknown"
      }],
      expected: "pending"
    },
    {
      name: "legacy completed submit with explicit remote task",
      operations: [{
        provider: "dashscope_funasr", operationType: "funasr-submit", state: "completed", status: 0,
        operationId: "submit-legacy-task", inputHash: "sha256:legacy", remoteTaskId: "legacy-task"
      }],
      expected: "pending"
    }
  ];
  try {
    for (const scenario of cases) {
      context.funAsrSummaryOperations = scenario.operations;
      vm.runInContext("browserJobStore.listOperations = async () => funAsrSummaryOperations", context);
      const summary = await context.browserFunAsrRemoteCancellationSummary("summary-job", "summary-run");
      assert.equal(summary.status, scenario.expected, scenario.name);
    }
  } finally {
    context.originalListOperationsForFunAsrSummaryTest = originalListOperations;
    vm.runInContext("browserJobStore.listOperations = originalListOperationsForFunAsrSummaryTest", context);
    delete context.originalListOperationsForFunAsrSummaryTest;
    delete context.funAsrSummaryOperations;
  }
}

{
  const originalRunBrowserPreloadJob = context.runBrowserPreloadJob;
  context.runBrowserPreloadJob = async () => {};
  try {
    const started = await context.startBrowserPreload(
      77,
      { url: "https://media.example.test/recovery.mp3", kind: "audio", ext: "mp3", duration: 30 },
      { pageUrl: "https://example.test/watch/1", sourceUrl: "https://media.example.test/recovery.mp3", duration: 30 },
      {
        asr: { providerType: "openai", baseUrl: "https://asr.example.test/v1", model: "whisper-1", apiKey: "test", vadFilter: "off" },
        translation: { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
        targetLanguage: "zh-CN",
        asrWorkers: 1,
        workers: 1,
        chunkSeconds: 900
      }
    );
    const record = context.findBrowserPreloadRecord(started.job.id, 77);
    const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${started.job.id}/chunk-0.mp3`;
    await (await caches.open("fuguang-web-ffmpeg-audio")).put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer));
    record.audioChunks = [{ index: 0, start: 0, end: 30, duration: 30, coreStart: 0, coreEnd: 30, file: { name: "chunk-0.mp3", mime: "audio/mpeg", cacheUrl } }];
    record.sourceSegmentsByChunk.set(0, [{ start: 1, end: 2, text: "source", chunkIndex: 0, segmentIndex: 0 }]);
    record.translatedSegmentsByChunk.set(0, [{ start: 1, end: 2, text: "译文", chunkIndex: 0, segmentIndex: 0 }]);
    record.job.translation.chunkStatuses[0] = { index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1, updatedAt: Date.now() };
    record.job.translation.chunksTotal = 1;
    context.publishBrowserPreloadJob(record);
    await context.flushBrowserJobMirror(started.job.id);
    context.recoveryJobId = started.job.id;
    vm.runInContext("browserPreloadJobs.delete(recoveryJobId); tabState.delete(77)", context);

    assert.deepEqual(JSON.parse(JSON.stringify(await context.recoverBrowserJobIndex())), { recovered: 1 });
    const recovered = context.findBrowserPreloadRecord(started.job.id, 77);
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.job.status, "interrupted");
    assert.equal(recovered.job.stage, "interrupted");
    assert.equal(recovered.audioChunks[0].file.cacheUrl, cacheUrl);
    assert.equal(recovered.sourceSegmentsByChunk.get(0)[0].text, "source");
    assert.equal(recovered.translatedSegmentsByChunk.get(0)[0].text, "译文");
    assert.match(recovered.job.translation.vttText, /译文/);
    assert.deepEqual(JSON.parse(JSON.stringify(await context.recoverBrowserJobIndex())), { recovered: 0 });
    await context.cancelPreload(77, started.job.id);
  } finally {
    delete context.recoveryJobId;
    context.runBrowserPreloadJob = originalRunBrowserPreloadJob;
  }
}

{
  const record = {
    tabId: 778,
    runToken: "run-offscreen-owner",
    pipeline: "browser",
    candidate: { url: "https://media.example.test/offscreen.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/offscreen" },
    modelConfig: {
      asr: { apiKey: "must-not-leave-worker" },
      translation: { apiKey: "must-not-leave-worker" },
      chunkSeconds: 900
    },
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      coreStart: 0,
      coreEnd: 30,
      file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-offscreen-owner/0.mp3" }
    }],
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-owner",
      runToken: "run-offscreen-owner",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100 },
      translation: { status: "running", chunksTotal: 1, chunkStatuses: [{ index: 0, stage: "queued" }] }
    }
  };
  const started = await context.startBrowserJobInOffscreen(record);
  assert.equal(started.status, "started");
  assert.equal(record.offscreenExecution, true);
  const command = taskRuntimeSent.find(message =>
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === record.job.id
  );
  assert.ok(command);
  assert.equal(command.snapshot.chunks.some(chunk => chunk.entryType === "audio-chunk"), true);
  assert.equal(JSON.stringify(command).includes("must-not-leave-worker"), false);
}

{
  const record = {
    tabId: 779,
    runToken: "run-offscreen-funasr-concurrency",
    pipeline: "funasr",
    candidate: { url: "https://media.example.test/long.mp3", kind: "audio", ext: "mp3", duration: 14401 },
    metadata: { pageUrl: "https://example.test/watch/long", duration: 14401 },
    modelConfig: { asr: {}, translation: {}, chunkSeconds: 7200, workers: 1 },
    browserAsrChunkSeconds: 7200,
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-funasr-concurrency",
      runToken: "run-offscreen-funasr-concurrency",
      pipeline: "funasr",
      status: "running",
      stage: "extracting",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "running", progress: 0, duration: 14401, asrChunkSeconds: 7200 },
      translation: { status: "queued", chunksTotal: 0, chunkStatuses: [] }
    }
  };
  const started = await context.startBrowserJobInOffscreen(record);
  assert.equal(started.status, "started");
  const command = taskRuntimeSent.find(message =>
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === record.job.id
  );
  assert.equal(command.runtime.asrWorkers, 2, "offscreen Fun-ASR must preserve the baseline two-chunk concurrency");
}

{
  const originalSendOffscreenTaskRuntimeCommand = context.sendOffscreenTaskRuntimeCommand;
  context.sendOffscreenTaskRuntimeCommand = async () => {
    const error = new Error("Offscreen task runtime command timed out.");
    error.deliveryUnknown = true;
    throw error;
  };
  const record = {
    tabId: 778,
    runToken: "run-offscreen-timeout",
    pipeline: "browser",
    candidate: { url: "https://media.example.test/timeout.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/timeout" },
    modelConfig: { asrWorkers: 1, chunkSeconds: 900 },
    audioChunks: [],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-timeout",
      runToken: "run-offscreen-timeout",
      pipeline: "browser",
      status: "running",
      stage: "extracting",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "running" },
      translation: { status: "queued", chunksTotal: 0, chunkStatuses: [] }
    }
  };
  try {
    const result = await context.startBrowserJobInOffscreen(record);
    assert.equal(result.status, "unknown", "an ACK timeout must not be reported as a definite start failure");
    assert.equal(record.offscreenExecution, true, "unknown delivery must not enable an uncoordinated local fallback");
  } finally {
    context.sendOffscreenTaskRuntimeCommand = originalSendOffscreenTaskRuntimeCommand;
  }
}

{
  const previousStorage = localStorageState;
  localStorageState = {
    modelSettingsVersion: 5,
    selectedAsrProfileId: "asr-a",
    selectedLlmProfileId: "llm-a",
    sourceLanguage: "ja",
    targetLanguage: "zh-CN",
    translationWorkers: 2,
    chunkMinutes: 15,
    asrProfiles: [
      { id: "asr-a", name: "ASR A", providerType: "openai", baseUrl: "https://asr-a.example.test/v1", model: "asr-a", apiKey: "secret-a" },
      { id: "asr-b", name: "ASR B", providerType: "openai", baseUrl: "https://asr-b.example.test/v1", model: "asr-b", apiKey: "secret-b" }
    ],
    llmProfiles: [
      { id: "llm-a", name: "LLM A", providerType: "openai", baseUrl: "https://llm-a.example.test/v1", model: "llm-a", apiKey: "secret-a" },
      { id: "llm-b", name: "LLM B", providerType: "openai", baseUrl: "https://llm-b.example.test/v1", model: "llm-b", apiKey: "secret-b" }
    ]
  };
  try {
    const originalConfig = await context.getModelConfig();
    assert.ok(originalConfig.executionSpec?.fingerprint, "a new job must freeze a non-secret execution reference");
    const ledger = context.FuguangJobContract.createJobLedgerEntry({
      modelConfig: originalConfig,
      job: {
        id: "job-config-a",
        runToken: "run-config-a",
        status: "running",
        stage: "asr",
        createdAt: 100,
        updatedAt: 100,
        extract: {},
        translation: {}
      }
    });
    assert.equal(ledger.executionSpec.fingerprint, originalConfig.executionSpec.fingerprint);
    assert.equal(JSON.stringify(ledger).includes("secret-a"), false, "the frozen execution reference must not persist API keys");
    localStorageState.selectedAsrProfileId = "asr-b";
    localStorageState.selectedLlmProfileId = "llm-b";
    const recoveredConfig = await context.getModelConfig(originalConfig.executionSpec);
    assert.equal(recoveredConfig.asr.model, "asr-a", "recovery must resolve the original ASR profile, not the current selection");
    assert.equal(recoveredConfig.translation.model, "llm-a", "recovery must resolve the original translation profile");
    assert.equal(recoveredConfig.executionSpec.fingerprint, originalConfig.executionSpec.fingerprint);
    localStorageState.asrProfiles.find(profile => profile.id === "asr-a").model = "asr-a-modified";
    await assert.rejects(
      context.getModelConfig(originalConfig.executionSpec),
      /模型配置已被修改/,
      "recovery must interrupt instead of silently using a modified profile"
    );
  } finally {
    localStorageState = previousStorage;
  }
}

{
  const originalTranscribeBrowserAudioChunk = context.transcribeBrowserAudioChunk;
  const originalTranslateBrowserSegments = context.translateBrowserSegments;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  const record = {
    tabId: 779,
    runToken: "run-offscreen-process",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/offscreen-process.mp3", kind: "audio", ext: "mp3" },
    metadata: {
      title: "Japanese cooking lesson",
      description: "A quiet cooking tutorial with spoken Japanese instructions.",
      pageLanguage: "ja",
      channel: "Cooking Channel",
      pageUrl: "https://example.test/watch/offscreen-process",
      sourceUrl: "https://media.example.test/offscreen-process.mp3"
    },
    modelConfig: {
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
      targetLanguage: "zh-CN",
      asrWorkers: 1,
      workers: 1,
      chunkSeconds: 900
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-offscreen-process",
      runToken: "run-offscreen-process",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  const chunk = {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "offscreen-process.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-offscreen-process/audio.mp3" }
  };
  await (await caches.open("fuguang-web-ffmpeg-audio")).put(chunk.file.cacheUrl, new FakeResponse(new Uint8Array([1]).buffer));
  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  context.transcribeBrowserAudioChunk = async () => [{ start: 1, end: 2, text: "source" }];
  let translationCalls = 0;
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "译文" }));
  };
  context.attachBrowserJobVttIfReady = async () => {};
  context.offscreenProcessRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-offscreen-process', offscreenProcessRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: offscreenProcessRecord.job, chunks: [] })", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-offscreen-process', 'run-offscreen-process', { ownerId: 'offscreen-process-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  context.offscreenProcessSnapshots = [];
  context.offscreenProcessOriginalPutOwned = await vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
  vm.runInContext(`browserJobStore.putSnapshotIfOwned = async (snapshot, ownership) => {
    offscreenProcessSnapshots.push(structuredClone(snapshot));
    return offscreenProcessOriginalPutOwned(snapshot, ownership);
  }`, context);
  const fence = {
    executionOwnerId: "offscreen-process-owner",
    executionEpoch: claim.job.executionEpoch
  };
  try {
    const before = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence
    });
    assert.equal(before.chunks[0].asrCompleted, false);
    const missingOpenAiModel = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "asr"
    });
    assert.equal(missingOpenAiModel.accepted, false);
    assert.match(missingOpenAiModel.error, /配置无法恢复/);
    record.modelConfig.asr = {
      providerType: "xai",
      baseUrl: "https://api.x.ai/v1",
      model: "",
      apiKey: "test",
      language: "ja",
      sourceLanguage: "ja",
      timeoutMs: 120_000,
      vadFilter: "auto",
      collectedSpeechAudio: "off",
      maxUploadBytes: 23_456_789
    };
    record.job.translation.chunkStatuses[0].attempts = 4;
    const asrInput = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "asr"
    });
    assert.equal(asrInput.accepted, true, JSON.stringify(asrInput));
    assert.equal(asrInput.input.chunk.file.cacheUrl.includes("__fuguang_audio_cache"), true);
    assert.equal(asrInput.input.asrConfig.apiKey, "test");
    assert.equal(asrInput.input.asrConfig.providerType, "xai");
    assert.equal(asrInput.input.asrConfig.model, "", "xAI's built-in STT endpoint must not require a model name");
    assert.deepEqual(JSON.parse(JSON.stringify({
      language: asrInput.input.asrConfig.language,
      sourceLanguage: asrInput.input.asrConfig.sourceLanguage,
      timeoutMs: asrInput.input.asrConfig.timeoutMs,
      vadFilter: asrInput.input.asrConfig.vadFilter,
      collectedSpeechAudio: asrInput.input.asrConfig.collectedSpeechAudio,
      maxUploadBytes: asrInput.input.asrConfig.maxUploadBytes
    })), {
      language: "ja",
      sourceLanguage: "ja",
      timeoutMs: 120_000,
      vadFilter: "auto",
      collectedSpeechAudio: "off",
      maxUploadBytes: 23_456_789
    }, "the offscreen boundary must preserve ASR semantics rather than only provider credentials");
    assert.deepEqual(JSON.parse(JSON.stringify(asrInput.input.asrCapabilities)), {
      supportedRequestFields: [],
      speechTimestampsEndpoint: ""
    }, "providers without capability probing must still carry an explicit empty capability snapshot");
    const originalFetch = context.fetch;
    context.fetch = async url => {
      assert.equal(new URL(String(url)).pathname, "/openapi.json");
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
                          condition_on_previous_text: { type: "boolean" },
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
    };
    record.modelConfig.asr = {
      providerType: "openai",
      baseUrl: "https://snapshot-asr.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      language: "ja",
      vadFilter: "on"
    };
    const openAiCapabilities = await context.browserAsrExecutionCapabilities(record.modelConfig.asr);
    context.fetch = originalFetch;
    assert.deepEqual(JSON.parse(JSON.stringify(openAiCapabilities)), {
      supportedRequestFields: [
        "vad_filter",
        "vad_parameters",
        "condition_on_previous_text",
        "no_speech_threshold"
      ],
      speechTimestampsEndpoint: "https://snapshot-asr.example/v1/audio/speech/timestamps"
    }, "the service worker must serialize the exact capability decision that crosses into offscreen with the ASR chunk");
    record.modelConfig.asr = {
      providerType: "openai",
      baseUrl: "https://persisted-snapshot-asr.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      language: "ja",
      vadFilter: "on"
    };
    record.asrCapabilities = {
      supportedRequestFields: [
        "vad_filter",
        "vad_parameters",
        "condition_on_previous_text",
        "no_speech_threshold"
      ],
      speechTimestampsEndpoint: "https://persisted-snapshot-asr.example/v1/audio/speech/timestamps"
    };
    let recoveryProbeCalls = 0;
    context.fetch = async () => {
      recoveryProbeCalls += 1;
      throw new Error("offscreen input must reuse the persisted task capability snapshot");
    };
    const persistedSnapshotInput = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "asr"
    });
    context.fetch = originalFetch;
    assert.equal(persistedSnapshotInput.accepted, true, JSON.stringify(persistedSnapshotInput));
    assert.deepEqual(JSON.parse(JSON.stringify(persistedSnapshotInput.input.asrCapabilities)), record.asrCapabilities);
    assert.equal(recoveryProbeCalls, 0, "a durable task must not make a second capability decision after recovery");
    assert.equal(asrInput.input.webFfmpegUrl, "chrome-extension://test-extension/web-ffmpeg/index.html", "production execution input must carry the configured Web FFmpeg URL");
    assert.equal(record.job.translation.chunkStatuses[0].attempts, 4, "preparing an audio chunk must not count as another retry");
    assert.equal(/offscreen/i.test(record.job.translation.chunkStatuses[0].message), false, "user progress must not expose the executor implementation");
    assert.equal(JSON.stringify(context.offscreenProcessSnapshots).includes('"apiKey":"test"'), false);
    assert.equal(context.offscreenProcessSnapshots.at(-1).chunks.find(entry => entry.entryType === "audio-chunk").asrExecutionMode, "offscreen-durable-v1");
    await context.commitOffscreenBrowserJobWorkResult({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "asr",
      result: {
        segments: [{ start: 1, end: 2, text: "source" }],
        warning: null,
        diagnostics: {
          request: {
            endpoint: "https://asr.example.test/v1/audio/transcriptions?api_key=query-secret",
            fields: [["model", "whisper"], ["authorization", "Bearer secret"]]
          },
          rawPayload: { segments: [{ start: 1, end: 2, text: "source" }], apiKey: "payload-secret" },
          error: { stage: "asr_request", status: 500, message: "diagnostic fixture" }
        },
        error: null
      }
    });
    assert.equal(record.audioChunks[0].asrCompleted, true);
    const asrDurableSnapshot = context.createBrowserJobLedgerSnapshot(record);
    assert.equal(JSON.stringify(asrDurableSnapshot).includes("query-secret"), false);
    assert.equal(JSON.stringify(asrDurableSnapshot).includes("payload-secret"), false);
    const asrRecovered = context.recoverBrowserJobRecord(asrDurableSnapshot.job, asrDurableSnapshot.chunks, record.modelConfig);
    assert.deepEqual(JSON.parse(JSON.stringify(asrRecovered.asrCapabilities)), record.asrCapabilities, "the task capability snapshot must survive the durable ledger boundary");
    assert.equal(asrRecovered.browserAsrDiagnosticsByChunk.get(0).request.fields[0][0], "model");
    assert.equal(asrRecovered.browserAsrDiagnosticsByChunk.get(0).rawPayload.segments[0].text, "source");
    assert.equal(asrRecovered.browserAsrDiagnosticsByChunk.get(0).error.status, 500);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr", "the final partial group stays open until extraction finalization");
    const workBeforeFinalize = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence
    });
    assert.deepEqual(JSON.parse(JSON.stringify(workBeforeFinalize.translations)), []);
    const preparedFinalize = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence
    });
    assert.equal(preparedFinalize.inProgress, true);
    assert.equal(preparedFinalize.workPrepared, true);
    assert.equal(translationCalls, 0, "FINALIZE must not start a paid translation request");
    assert.equal(record.job.status, "running");
    const translationWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence
    });
    assert.deepEqual(JSON.parse(JSON.stringify(translationWork.translations)), [{ index: 0, processing: false }]);
    const legacyTranslation = await context.processOffscreenBrowserJobChunk({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "translation"
    });
    assert.equal(legacyTranslation.reason, "translation-requires-offscreen-executor");
    const executionInput = await context.getOffscreenBrowserJobExecutionInput({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "translation"
    });
    assert.equal(executionInput.accepted, true, JSON.stringify(executionInput));
    assert.equal(executionInput.input.sourceSegments[0].text, "source");
    assert.equal(executionInput.input.translationConfig.apiKey, "test");
    assert.deepEqual(JSON.parse(JSON.stringify(executionInput.input.metadata)), {
      title: "Japanese cooking lesson",
      description: "A quiet cooking tutorial with spoken Japanese instructions.",
      pageLanguage: "ja",
      channel: "Cooking Channel",
      pageUrl: "https://example.test/watch/offscreen-process",
      sourceUrl: "https://media.example.test/offscreen-process.mp3",
      duration: 0
    }, "the durable translation boundary must preserve every prompt context field used by v0.1.5");
    await context.commitOffscreenBrowserJobWorkResult({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence,
      chunkIndex: 0,
      workType: "translation",
      result: { segments: [{ start: 1, end: 2, text: "译文", chunkIndex: 0, segmentIndex: 0 }], failures: [], error: null }
    });
    assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
    assert.equal(translationCalls, 0, "translation HTTP execution must not run in the Service Worker");
    assert.equal(context.offscreenProcessSnapshots.length, 6, "the repeated persisted-snapshot input, final group preparation and each paid request/result must have fenced checkpoints");
    const asrInflightCheckpoint = context.offscreenProcessSnapshots[0].chunks.find(entry => entry.entryType === "translation-group");
    const preparedTranslationCheckpoint = context.offscreenProcessSnapshots[3].chunks.find(entry => entry.entryType === "translation-group");
    const translationInflightCheckpoint = context.offscreenProcessSnapshots[4].chunks.find(entry => entry.entryType === "translation-group");
    const translationCheckpoint = context.offscreenProcessSnapshots[5].chunks.find(entry => entry.entryType === "translation-group");
    assert.equal(asrInflightCheckpoint.stage, "asr_inflight");
    assert.equal(preparedTranslationCheckpoint.stage, "asr_done");
    assert.equal(preparedTranslationCheckpoint.sourceSegments[0].text, "source");
    assert.equal(preparedTranslationCheckpoint.translatedSegments.length, 0, "the prepared group must be durable before paid translation starts");
    assert.equal(translationInflightCheckpoint.stage, "translation");
    assert.equal(translationInflightCheckpoint.translatedSegments.length, 0);
    assert.equal(translationCheckpoint.translatedSegments[0].text, "译文");
    const finalized = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      ...fence
    });
    assert.equal(finalized.accepted, true);
    assert.equal(record.job.status, "completed");
    assert.equal(record.job.translation.status, "completed", "normal offscreen finalization must close the translation projection");
    const durableFinalized = await vm.runInContext("browserJobStore.getJob('job-offscreen-process')", context);
    assert.equal(durableFinalized.translation.status, "completed", "the owned final snapshot must not persist translation as running");
  } finally {
    vm.runInContext("browserJobStore.putSnapshotIfOwned = offscreenProcessOriginalPutOwned", context);
    await vm.runInContext("browserJobStore.deleteJob('job-offscreen-process')", context);
    vm.runInContext("browserPreloadJobs.delete('job-offscreen-process')", context);
    delete context.offscreenProcessRecord;
    delete context.offscreenProcessSnapshots;
    delete context.offscreenProcessOriginalPutOwned;
    context.transcribeBrowserAudioChunk = originalTranscribeBrowserAudioChunk;
    context.translateBrowserSegments = originalTranslateBrowserSegments;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

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
    assert.match(response.job.id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
    assert.match(response.job.runToken, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
    const mirrored = await context.flushBrowserJobMirror(response.job.id);
    assert.equal(mirrored.id, response.job.id);
    assert.equal(mirrored.runToken, response.job.runToken);
    assert.equal(JSON.stringify(mirrored).includes("apiKey"), false);
    assert.equal(JSON.stringify(mirrored).includes("authorization"), false);
    await new Promise(resolve => setTimeout(resolve, 0));
    const observed = taskRuntimeSent.find(message => message.snapshot?.job?.id === response.job.id);
    assert.equal(observed.type, "FUGUANG_TASK_RUNTIME_OBSERVE_JOB");
    assert.equal(observed.snapshot.job.runToken, response.job.runToken);
    assert.equal(JSON.stringify(observed.snapshot).includes("apiKey"), false);
    const record = context.findBrowserPreloadRecord(response.job.id, 1);
    record.browserAsrQueue = context.createAsyncQueue();
    record.browserTranslationQueue = context.createAsyncQueue();
    record.browserFunAsrQueue = context.createAsyncQueue();
    record.browserAsrQueue.items.push({ index: 1 });
    record.browserTranslationQueue.items.push({ index: 1 });
    record.browserFunAsrQueue.items.push({ index: 1 });
    let releaseDelayedRecovery;
    context.delayedCancelRecoveryPromise = new Promise(resolve => { releaseDelayedRecovery = resolve; });
    vm.runInContext("browserJobRecoveryPromise = delayedCancelRecoveryPromise", context);
    vm.runInContext(`browserPreloadJobs.delete(${JSON.stringify(response.job.id)})`, context);
    const cancelMessageCountBeforeRecovery = taskRuntimeSent.filter(message => message.type === "FUGUANG_TASK_RUNTIME_CANCEL_JOB").length;
    const pendingCancel = context.cancelPreload(1, response.job.id);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(record.abortController.signal.aborted, false, "cancel waits until durable recovery has rebuilt the record");
    assert.equal(taskRuntimeSent.filter(message => message.type === "FUGUANG_TASK_RUNTIME_CANCEL_JOB").length,
      cancelMessageCountBeforeRecovery);
    context.recoveryCancelRecord = record;
    vm.runInContext(`browserPreloadJobs.set(${JSON.stringify(response.job.id)}, recoveryCancelRecord)`, context);
    releaseDelayedRecovery({ recovered: 1 });
    const cancelled = await pendingCancel;
    vm.runInContext("browserJobRecoveryPromise = Promise.resolve({ recovered: 1 })", context);
    delete context.delayedCancelRecoveryPromise;
    delete context.recoveryCancelRecord;
    assert.equal(cancelled.job.status, "cancelled");
    assert.equal(record.abortController.signal.aborted, true);
    assert.equal(record.browserAsrQueue.closed, true);
    assert.equal(record.browserTranslationQueue.closed, true);
    assert.equal(record.browserFunAsrQueue.closed, true);
    assert.equal(record.browserAsrQueue.items.length, 0);
    assert.equal(record.browserTranslationQueue.items.length, 0);
    assert.equal(record.browserFunAsrQueue.items.length, 0);
    const storedCancelled = await context.flushBrowserJobMirror(response.job.id);
    assert.equal(storedCancelled.status, "cancelled");
    assert.equal(storedCancelled.cancelRequested, true);
    assert.ok(runtimeMessages.some(message => message.type === "FUGUANG_OFFSCREEN_CANCEL_JOB" && message.jobId === response.job.id));
    const taskRuntimeCancel = taskRuntimeSent.find(message => message.type === "FUGUANG_TASK_RUNTIME_CANCEL_JOB" && message.jobId === response.job.id);
    assert.ok(taskRuntimeCancel);
    assert.deepEqual(JSON.parse(JSON.stringify(taskRuntimeCancel.funAsrCancelConfig)), {
      providerType: "dashscope_funasr",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      model: "fun-asr",
      apiKey: "test"
    }, "the cancellation credential is sent transiently to offscreen and is not part of the durable snapshot");
    const previousRunToken = record.runToken;
    const nextRunToken = await context.beginBrowserJobAttempt(record, "retrying");
    assert.notEqual(nextRunToken, previousRunToken);
    const progressBeforeLateMessage = record.job.extract.progress;
    context.applyOffscreenWebFfmpegProgress({
      jobId: response.job.id,
      tabId: 1,
      runToken: previousRunToken,
      progress: { percent: 99 }
    });
    assert.equal(record.job.extract.progress, progressBeforeLateMessage);
    context.applyOffscreenWebFfmpegProgress({
      jobId: response.job.id,
      tabId: 1,
      runToken: nextRunToken,
      progress: { percent: 25 }
    });
    assert.equal(record.job.extract.progress, 25);
    record.sourceSegmentsByChunk.set(0, [{ start: 0, end: 1, text: "preserved source" }]);
    record.translatedSegmentsByChunk.set(0, [{ start: 0, end: 1, text: "保留译文" }]);
    record.audioChunks = [{ index: 0, file: { cacheUrl: `https://fuguang.local/__fuguang_audio_cache/${response.job.id}/retry.mp3` } }];
    const retryCancelled = await context.cancelPreload(1, response.job.id);
    assert.equal(retryCancelled.job.status, "interrupted");
    assert.equal(record.audioChunks.length, 1);
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "保留译文");
    const retryLedger = await context.flushBrowserJobMirror(response.job.id);
    assert.equal(retryLedger.preserveExistingOnCancel, true);
    const recoveredRetry = context.recoverBrowserJobRecord(retryLedger, context.FuguangJobContract.createChunkLedgerEntries(record), record.modelConfig);
    assert.equal(recoveredRetry.job.status, "interrupted");

    await context.beginBrowserJobAttempt(record, "retry_translation");
    const translationRetryCancelled = await context.cancelPreload(1, response.job.id);
    assert.equal(translationRetryCancelled.job.status, "interrupted");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "保留译文");

    record.preserveExistingOnCancel = false;
    record.job.preserveExistingOnCancel = false;
    const conflictOriginalBeginAttempt = vm.runInContext("browserJobStore.beginAttempt", context);
    vm.runInContext("browserJobStore.beginAttempt = async () => ({ applied: false, reason: 'run-token-conflict' })", context);
    try {
      await assert.rejects(context.beginBrowserJobAttempt(record, "retrying"), /另一个运行实例接管/);
      assert.equal(record.preserveExistingOnCancel, false, "a rejected attempt must restore the record retry-cancel marker");
      assert.equal(record.job.preserveExistingOnCancel, false, "a rejected attempt must restore the durable retry-cancel marker");
    } finally {
      context.conflictOriginalBeginAttempt = conflictOriginalBeginAttempt;
      vm.runInContext("browserJobStore.beginAttempt = conflictOriginalBeginAttempt", context);
      delete context.conflictOriginalBeginAttempt;
    }
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
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  let extractRunning = false;
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
    assert.equal(options.chunksTotal, 2);
    return { transcripts: [{ sentences: [{ begin_time: 1000, end_time: 2000, text: `source ${funAsrCalls}` }] }] };
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: `译文 ${translationCalls}` }));
  };
  context.startBrowserJobInOffscreen = async () => ({ status: "unavailable" });
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};
  context.recordForFunAsrStreamingTest = record;
  vm.runInContext("browserPreloadJobs.set('browser-funasr-streaming', recordForFunAsrStreamingTest)", context);
  try {
    await context.runBrowserFunAsrPreloadJob("browser-funasr-streaming");

    assert.equal(extractRunning, false);
    assert.equal(funAsrCalls, 0, "Fun-ASR must not fall back to paid Service Worker requests");
    assert.equal(translationCalls, 0);
    assert.equal(record.audioChunks.length, 2, "media extraction must still complete and retain retryable audio");
    assert.equal(record.job.extract.status, "completed");
    assert.equal(record.job.status, "interrupted");
    assert.match(record.job.error, /后台识别暂时不可用/);
    assert.equal(/offscreen|durable/i.test(record.job.error), false, "user-facing recovery errors must not expose executor internals");
    assert.equal(record.job.translation.chunksTotal, 2);
    assert.equal(record.job.translation.status, "interrupted");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-funasr-streaming')", context);
    delete context.recordForFunAsrStreamingTest;
    context.extractCandidateAudioInBrowser = originalExtract;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
    context.translateBrowserSegments = originalTranslate;
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
  }
}

{
  const record = {
    tabId: 679, runToken: "run-funasr-offscreen-started", pipeline: "funasr", startedAt: Date.now(),
    cancelled: false, abortController: new AbortController(),
    metadata: { duration: 30 },
    modelConfig: {
      asr: { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
      workers: 1
    },
    sourceSegmentsByChunk: new Map(), translatedSegmentsByChunk: new Map(), audioChunks: [],
    job: {
      id: "browser-funasr-offscreen-started", runToken: "run-funasr-offscreen-started", pipeline: "funasr",
      status: "running", stage: "extracting",
      extract: { status: "running", progress: 0, duration: 30 },
      translation: { status: "queued", chunkStatuses: [], chunksTotal: 0 }
    }
  };
  const originalExtract = context.extractCandidateAudioInBrowser;
  const originalFunAsr = context.transcribeDashScopeFunAsrFile;
  const originalStart = context.startBrowserJobInOffscreen;
  let extracted = 0;
  let legacyPaidCalls = 0;
  context.startBrowserJobInOffscreen = async () => ({ status: "started", executionOwnerId: "owner", executionEpoch: 1 });
  context.extractCandidateAudioInBrowser = async () => {
    extracted += 1;
    return {
      duration: 30,
      chunks: [{
        index: 0, start: 0, end: 30, duration: 30,
        file: { name: "chunk.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
      }]
    };
  };
  context.transcribeDashScopeFunAsrFile = async () => {
    legacyPaidCalls += 1;
    throw new Error("legacy Fun-ASR must not run");
  };
  context.funAsrOffscreenStartedRecord = record;
  vm.runInContext("browserPreloadJobs.set(funAsrOffscreenStartedRecord.job.id, funAsrOffscreenStartedRecord)", context);
  try {
    await context.runBrowserFunAsrPreloadJob(record.job.id);
    assert.equal(extracted, 1, "offscreen start must not suppress media extraction");
    assert.equal(legacyPaidCalls, 0);
    assert.equal(record.audioChunks.length, 1);
    assert.equal(record.job.extract.status, "completed");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-funasr-offscreen-started')", context);
    delete context.funAsrOffscreenStartedRecord;
    context.extractCandidateAudioInBrowser = originalExtract;
    context.transcribeDashScopeFunAsrFile = originalFunAsr;
    context.startBrowserJobInOffscreen = originalStart;
  }
}

{
  const record = {
    tabId: 680, runToken: "run-browser-offscreen-unavailable", pipeline: "browser", startedAt: Date.now(),
    cancelled: false, abortController: new AbortController(),
    metadata: { duration: 30 },
    modelConfig: {
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
      targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, asrUploadChunkSeconds: 900
    },
    sourceSegmentsByChunk: new Map(), translatedSegmentsByChunk: new Map(), audioChunks: [],
    job: {
      id: "browser-offscreen-unavailable", runToken: "run-browser-offscreen-unavailable", pipeline: "browser",
      status: "running", stage: "extracting",
      extract: { status: "running", progress: 0, duration: 30 },
      translation: { status: "queued", chunkStatuses: [], chunksTotal: 0 }
    }
  };
  const originalExtract = context.extractCandidateAudioInBrowser;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalStart = context.startBrowserJobInOffscreen;
  let extracted = 0;
  let legacyAsrCalls = 0;
  let legacyTranslationCalls = 0;
  context.startBrowserJobInOffscreen = async () => ({ status: "unavailable" });
  context.extractCandidateAudioInBrowser = async () => {
    extracted += 1;
    return {
      duration: 30,
      chunks: [{
        index: 0, start: 0, end: 30, duration: 30,
        file: { name: "chunk.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
      }]
    };
  };
  context.transcribeBrowserAudioChunk = async () => { legacyAsrCalls += 1; return []; };
  context.translateBrowserSegments = async () => { legacyTranslationCalls += 1; return []; };
  context.browserOffscreenUnavailableRecord = record;
  vm.runInContext("browserPreloadJobs.set(browserOffscreenUnavailableRecord.job.id, browserOffscreenUnavailableRecord)", context);
  try {
    await context.runBrowserPreloadJob(record.job.id);
    assert.equal(extracted, 1, "runner failure must not suppress media extraction");
    assert.equal(legacyAsrCalls, 0, "ordinary paid ASR must not fall back to Service Worker");
    assert.equal(legacyTranslationCalls, 0, "paid translation must not fall back to Service Worker");
    assert.equal(record.audioChunks.length, 1);
    assert.equal(record.job.extract.status, "completed");
    assert.equal(record.job.status, "interrupted");
  } finally {
    vm.runInContext("browserPreloadJobs.delete('browser-offscreen-unavailable')", context);
    delete context.browserOffscreenUnavailableRecord;
    context.extractCandidateAudioInBrowser = originalExtract;
    context.transcribeBrowserAudioChunk = originalTranscribe;
    context.translateBrowserSegments = originalTranslate;
    context.startBrowserJobInOffscreen = originalStart;
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
  const tabId = 120;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3, href: "https://frame.example.test/watch/old" };
  state.lastPreloadCandidate = { frameId: 3, url: "https://cdn.example.test/old.mp4" };
  state.attachedVttSignature = "browser-frame-committed-old";
  state.manualVttSignature = "manual:frame-committed-old";
  const messages = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationCommittedListeners[0]({ tabId, frameId: 4, url: "https://other-frame.example.test/new" });

  assert.deepEqual(messages, [], "an unrelated committed frame must not detach the active subtitles");
  assert.equal(state.subtitleFrameId, 3);
  assert.equal(state.mediaFrameId, 3);
  assert.equal(state.context.frameId, 3);
  assert.equal(state.lastPreloadCandidate.frameId, 3);
  assert.equal(state.attachedVttSignature, "browser-frame-committed-old");

  await webNavigationCommittedListeners[0]({ tabId, frameId: 3, url: "https://frame.example.test/watch/new" });

  assert.deepEqual(messages, [{ type: "FUGUANG_DETACH_PRELOAD_VTT", frameId: 3 }]);
  assert.equal(state.subtitleFrameId, null);
  assert.equal(state.mediaFrameId, null);
  assert.equal(Object.keys(state.context).length, 0);
  assert.equal(state.lastPreloadCandidate, null);
  assert.equal(state.attachedVttSignature, "");
  assert.equal(state.manualVttSignature, "");
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
  const tabId = 1113;
  seedPage(tabId, { url: "https://www.bilibili.com/video/BVOld", duration: 441 });
  context.addPageMediaCandidate(tabId, {
    url: "https://upos-sz-mirror.example.test/old-1-30232.m4s",
    source: "bilibili-playurl",
    kind: "audio",
    ext: "m4s",
    href: "https://www.bilibili.com/video/BVOld",
    duration: 441
  });
  let releaseFrames;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = () => new Promise(resolve => {
    releaseFrames = resolve;
  });
  chrome.tabs.sendMessage = async () => ({ ok: true });

  const pendingNavigation = webNavigationHistoryListeners[0]({
    tabId,
    frameId: 0,
    url: "https://www.bilibili.com/video/BVCurrent"
  });
  await Promise.resolve();
  assert.equal(
    context.getState(tabId).candidates.some(candidate => candidate.url.includes("/old-1-30232.m4s")),
    false,
    "SPA navigation must make the previous page's candidates unavailable before subtitle detachment finishes"
  );
  context.addPageMediaCandidate(tabId, {
    url: "https://upos-sz-mirror.example.test/current-1-30232.m4s",
    source: "bilibili-playurl",
    kind: "audio",
    ext: "m4s",
    href: "https://www.bilibili.com/video/BVCurrent",
    duration: 87
  });
  releaseFrames([{ frameId: 0 }]);
  await pendingNavigation;
  assert.equal(
    context.getState(tabId).candidates.some(candidate => candidate.url.includes("/current-1-30232.m4s")),
    true,
    "current-page candidates reported while old subtitles detach must survive navigation cleanup"
  );
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
  const order = [];
  let releaseFirst;
  const first = context.enqueueBrowserMediaExtraction(async () => {
    order.push("first:start");
    await new Promise(resolve => {
      releaseFirst = resolve;
    });
    order.push("first:end");
    return "first";
  });
  const second = context.enqueueBrowserMediaExtraction(async () => {
    order.push("second:start");
    return "second";
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ["first:start"], "媒体提取必须覆盖请求头规则的完整生命周期串行执行");
  releaseFirst();
  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  assert.deepEqual(order, ["first:start", "first:end", "second:start"]);

  await assert.rejects(
    context.enqueueBrowserMediaExtraction(async () => {
      throw new Error("queue failure");
    }),
    /queue failure/
  );
  assert.equal(
    await context.enqueueBrowserMediaExtraction(async () => "recovered"),
    "recovered",
    "单次媒体提取失败后不能阻塞后续任务"
  );
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
    const cancelledResult = await context.extractCandidateAudioInBrowser({
      cancelled: true,
      job: { id: "job-cancelled-before-extraction", status: "cancelled" }
    });
    assert.equal(Object.keys(cancelledResult).length, 0);
    assert.equal(offscreenMessage, null, "排队期间取消的任务不得再启动 offscreen 媒体提取");

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

async function assertRerunRequiresCompleteDurableAudioMembership(pipeline, complete) {
  const funAsr = pipeline === "funasr";
  const suffix = `${pipeline}-${complete ? "complete" : "partial"}`;
  const jobId = `rerun-durable-membership-${suffix}`;
  const runToken = `run-rerun-durable-membership-${suffix}`;
  const cacheUrls = [0, 1].map(index => (
    `https://fuguang.local/__fuguang_audio_cache/${jobId}/chunk-${index}.mp3`
  ));
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  await cache.put(cacheUrls[0], new FakeResponse(new Uint8Array([1]).buffer));
  if (complete) {
    await cache.put(cacheUrls[1], new FakeResponse(new Uint8Array([2]).buffer));
  }
  const audioChunks = [0, ...(complete ? [1] : [])].map(index => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    coreStart: index * 30,
    coreEnd: (index + 1) * 30,
    asrCompleted: true,
    file: { name: `chunk-${index}.mp3`, mime: "audio/mpeg", cacheUrl: cacheUrls[index], bytes: 1 }
  }));
  const chunkStatuses = funAsr
    ? [0, 1].map(index => ({
        index,
        stage: "completed",
        status: "完成",
        sourceCount: 1,
        translatedCount: 1,
        expectedAudioChunkIndexes: [index],
        asrRequired: false
      }))
    : [{
        index: 0,
        stage: "completed",
        status: "完成",
        sourceCount: 1,
        translatedCount: 1,
        expectedAudioChunkIndexes: [0, 1],
        asrRequired: false
      }];
  const sourceSegmentsByChunk = new Map((funAsr ? [0, 1] : [0]).map(index => [
    index,
    [{ start: index * 30 + 1, end: index * 30 + 2, text: `old source ${index}`, chunkIndex: index, segmentIndex: 0 }]
  ]));
  const translatedSegmentsByChunk = new Map((funAsr ? [0, 1] : [0]).map(index => [
    index,
    [{ start: index * 30 + 1, end: index * 30 + 2, text: `旧译文 ${index}`, chunkIndex: index, segmentIndex: 0 }]
  ]));
  const record = {
    tabId: funAsr ? 3993 : 3992,
    runToken,
    pipeline,
    startedAt: Date.now(),
    metadata: { pageUrl: `https://example.test/${jobId}`, duration: 60 },
    modelConfig: { asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    audioChunks,
    sourceSegmentsByChunk,
    translatedSegmentsByChunk,
    browserAsrChunkToTranslationGroup: new Map([[0, 0], [1, funAsr ? 1 : 0]]),
    job: {
      id: jobId,
      runToken,
      pipeline,
      status: "completed",
      stage: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      extract: { status: "completed", progress: 100, elapsedSeconds: 1 },
      translation: {
        status: "completed",
        vttText: funAsr
          ? "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文 0\n\n00:00:31.000 --> 00:00:32.000\n旧译文 1\n"
          : "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文 0\n",
        vttPath: "browser-memory",
        chunkStatuses,
        chunksTotal: funAsr ? 2 : 1,
        chunksDone: funAsr ? 2 : 1,
        chunksFailed: 0
      }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const stateBefore = {
    runToken: record.runToken,
    status: record.job.status,
    stage: record.job.stage,
    chunkStatuses: structuredClone(record.job.translation.chunkStatuses),
    vttText: record.job.translation.vttText,
    source: JSON.stringify([...record.sourceSegmentsByChunk]),
    translated: JSON.stringify([...record.translatedSegmentsByChunk])
  };
  const startMessagesBefore = runtimeMessages.filter(message => (
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
  )).length;
  let offscreenStartCalls = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStartCalls += 1;
    return { status: "started" };
  };
  try {
    if (complete) {
      const rerun = await context.rerunBrowserAsrFromAudio(record);
      assert.equal(rerun.accepted, true);
      assert.equal(offscreenStartCalls, 1);
      assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "old source 0");
      assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "旧译文 0");
      assert.equal(record.job.translation.vttText, stateBefore.vttText);
    } else {
      await assert.rejects(
        () => context.rerunBrowserAsrFromAudio(record),
        /没有完整保留要重新识别的音频/
      );
      assert.equal(record.runToken, stateBefore.runToken);
      assert.equal(record.job.runToken, stateBefore.runToken);
      assert.equal(record.job.status, stateBefore.status);
      assert.equal(record.job.stage, stateBefore.stage);
      assert.deepEqual(
        JSON.parse(JSON.stringify(record.job.translation.chunkStatuses)),
        JSON.parse(JSON.stringify(stateBefore.chunkStatuses))
      );
      assert.equal(record.job.translation.vttText, stateBefore.vttText);
      assert.equal(JSON.stringify([...record.sourceSegmentsByChunk]), stateBefore.source);
      assert.equal(JSON.stringify([...record.translatedSegmentsByChunk]), stateBefore.translated);
      assert.equal(offscreenStartCalls, 0);
      assert.equal(runtimeMessages.filter(message => (
        message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
      )).length, startMessagesBefore);
    }
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await cache.delete(cacheUrls[0]);
    await cache.delete(cacheUrls[1]);
  }
}

await assertRerunRequiresCompleteDurableAudioMembership("browser", false);
await assertRerunRequiresCompleteDurableAudioMembership("browser", true);
await assertRerunRequiresCompleteDurableAudioMembership("funasr", false);
await assertRerunRequiresCompleteDurableAudioMembership("funasr", true);

async function assertMixedRetryKeepsQueuedDurableGroup(pipeline, queuedAudioAvailable) {
  const funAsr = pipeline === "funasr";
  const suffix = `${pipeline}-${queuedAudioAvailable ? "available" : "missing"}`;
  const jobId = `mixed-failed-queued-retry-${suffix}`;
  const runToken = `run-mixed-failed-queued-retry-${suffix}`;
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/chunk-1.mp3`;
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  if (queuedAudioAvailable) {
    await cache.put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer));
  }
  const record = {
    tabId: funAsr ? 3995 : 3994,
    runToken,
    pipeline,
    startedAt: Date.now(),
    metadata: { duration: 1800 },
    modelConfig: { asrWorkers: 1, workers: 1, chunkSeconds: 900, targetLanguage: "zh-CN" },
    audioChunks: queuedAudioAvailable ? [{
      index: 1,
      start: 900,
      end: 1800,
      coreStart: 900,
      coreEnd: 1800,
      asrCompleted: false,
      file: { name: "chunk-1.mp3", mime: "audio/mpeg", cacheUrl, bytes: 1 }
    }] : [],
    sourceSegmentsByChunk: new Map([
      [0, [{ start: 1, end: 2, text: "current recognized source", chunkIndex: 0, segmentIndex: 0 }]],
      [1, [{ start: 901, end: 902, text: "display-only old source", chunkIndex: 1, segmentIndex: 0 }]]
    ]),
    translatedSegmentsByChunk: new Map(),
    browserAsrChunkToTranslationGroup: new Map([[1, 1]]),
    job: {
      id: jobId,
      runToken,
      pipeline,
      status: "interrupted",
      stage: "interrupted",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      extract: { status: "completed", progress: 100, duration: 1800 },
      translation: {
        status: "interrupted",
        vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\ncurrent recognized source\n",
        chunkStatuses: [
          {
            index: 0,
            stage: "failed",
            status: "失败",
            sourceCount: 1,
            translatedCount: 0,
            translationFailures: 1,
            asrFailures: 0,
            expectedAudioChunkIndexes: [0],
            asrRequired: false
          },
          {
            index: 1,
            stage: "queued",
            status: "排队",
            sourceCount: 0,
            translatedCount: 0,
            asrFailures: 0,
            expectedAudioChunkIndexes: [1],
            asrRequired: true
          }
        ],
        chunksTotal: 2,
        chunksDone: 1,
        chunksFailed: 1
      }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const originalRunToken = record.runToken;
  const startMessagesBefore = runtimeMessages.filter(message => (
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
  )).length;
  let offscreenStartCalls = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStartCalls += 1;
    return { status: "started" };
  };
  try {
    if (funAsr) {
      const plan = context.browserFunAsrRetryPlan(record);
      assert.deepEqual(JSON.parse(JSON.stringify(plan)), {
        translationIndexes: [0],
        asrIndexes: [1]
      });
    } else {
      assert.deepEqual(JSON.parse(JSON.stringify(context.collectBrowserRetryIndexes(record, new Set()))), [0, 1]);
    }
    if (!queuedAudioAvailable) {
      await assert.rejects(
        () => funAsr
          ? context.retryBrowserFunAsrFailedPreload(record)
          : context.retryBrowserFailedPreload(record),
        /没有保留可继续识别的音频/
      );
      assert.equal(record.runToken, originalRunToken);
      assert.equal(record.job.status, "interrupted");
      assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "current recognized source");
      assert.equal(record.sourceSegmentsByChunk.get(1)[0].text, "display-only old source");
      assert.equal(offscreenStartCalls, 0);
      assert.equal(runtimeMessages.filter(message => (
        message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
      )).length, startMessagesBefore);
      return;
    }
    const retried = funAsr
      ? await context.retryBrowserFunAsrFailedPreload(record)
      : await context.retryBrowserFailedPreload(record);
    assert.equal(retried.accepted, true);
    assert.equal(offscreenStartCalls, 1);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done",
      "the translation failure must reuse its current recognized source without audio");
    assert.equal(record.job.translation.chunkStatuses[1].stage, "queued",
      "the nonterminal durable group must remain queued for ASR");
    assert.equal(record.job.translation.chunkStatuses[1].asrRequired, true);
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await cache.delete(cacheUrl);
  }
}

await assertMixedRetryKeepsQueuedDurableGroup("browser", false);
await assertMixedRetryKeepsQueuedDurableGroup("browser", true);
await assertMixedRetryKeepsQueuedDurableGroup("funasr", false);
await assertMixedRetryKeepsQueuedDurableGroup("funasr", true);

{
  const jobId = "ordinary-retry-partial-group-audio";
  const runToken = "run-ordinary-retry-partial-group-audio";
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/chunk-0.mp3`;
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer));
  const record = {
    tabId: 3998,
    runToken,
    pipeline: "browser",
    startedAt: Date.now(),
    metadata: { duration: 60 },
    modelConfig: { asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      coreStart: 0,
      coreEnd: 30,
      asrCompleted: true,
      file: { name: "chunk-0.mp3", mime: "audio/mpeg", cacheUrl, bytes: 1 }
    }],
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: jobId,
      runToken,
      status: "interrupted",
      stage: "interrupted",
      extract: { status: "completed", progress: 100 },
      translation: {
        vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文\n",
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          sourceCount: 1,
          translatedCount: 1,
          asrFailures: 1,
          expectedAudioChunkIndexes: [0, 1],
          asrRequired: false
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1
      }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const startMessagesBefore = runtimeMessages.filter(message => (
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
  )).length;
  let offscreenStartCalls = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStartCalls += 1;
    return { status: "started" };
  };
  try {
    await assert.rejects(
      () => context.retryBrowserFailedPreload(record),
      /没有保留可继续识别的音频/
    );
    assert.equal(record.runToken, runToken);
    assert.equal(record.job.status, "interrupted");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "old source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "旧译文");
    assert.equal(record.job.translation.chunkStatuses[0].asrFailures, 1);
    assert.equal(offscreenStartCalls, 0);
    assert.equal(runtimeMessages.filter(message => (
      message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === jobId
    )).length, startMessagesBefore);
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await cache.delete(cacheUrl);
  }
}

{
  const record = {
    tabId: 3996,
    runToken: "run-funasr-no-audio-translation-only",
    pipeline: "funasr",
    startedAt: Date.now(),
    metadata: { duration: 900 },
    modelConfig: { asrWorkers: 1, workers: 1, targetLanguage: "zh-CN" },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "recognized source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "funasr-no-audio-translation-only",
      runToken: "run-funasr-no-audio-translation-only",
      pipeline: "funasr",
      status: "completed",
      stage: "completed_with_warnings",
      audioCacheRemoved: true,
      extract: { status: "completed", progress: 100 },
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          sourceCount: 1,
          translatedCount: 0,
          translationFailures: 1,
          asrFailures: 0,
          expectedAudioChunkIndexes: [0],
          asrRequired: false
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1
      }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  let offscreenStartCalls = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStartCalls += 1;
    return { status: "started" };
  };
  try {
    assert.deepEqual(JSON.parse(JSON.stringify(context.browserFunAsrRetryPlan(record))), {
      translationIndexes: [0],
      asrIndexes: []
    });
    const retried = await context.retryBrowserFunAsrFailedPreload(record);
    assert.equal(retried.accepted, true);
    assert.equal(offscreenStartCalls, 1);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "recognized source");
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
  }
}

function createAtomicAsrAttemptRecord(id) {
  const runToken = `run-${id}`;
  const chunk = {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    asrCompleted: true,
    asrFailed: false,
    sourceSegments: [{ start: 1, end: 2, text: "old chunk source" }],
    file: {
      name: "chunk-0.mp3",
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/__fuguang_audio_cache/${id}/chunk-0.mp3`
    }
  };
  return {
    tabId: 3997,
    runToken,
    pipeline: "browser",
    startedAt: Date.now(),
    metadata: { duration: 30 },
    modelConfig: { asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    audioChunks: [chunk],
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    browserTranslationGroups: new Map([[0, {
      index: 0,
      chunkIndexes: new Set([0]),
      chunks: [chunk],
      total: 1,
      completed: 1,
      failed: 0,
      empty: 0,
      sourceSegments: [{ start: 1, end: 2, text: "old group source" }],
      errors: [],
      translationQueued: true,
      closed: true
    }]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id,
      runToken,
      status: "completed",
      stage: "completed",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100 },
      translation: {
        status: "completed",
        vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文\n",
        vttPath: "browser-memory",
        chunkStatuses: [{
          index: 0,
          stage: "completed",
          status: "完成",
          sourceCount: 1,
          translatedCount: 1,
          expectedAudioChunkIndexes: [0],
          asrRequired: false
        }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };
}

{
  const originalBeginAttempt = vm.runInContext("browserJobStore.beginAttempt", context);
  context.atomicAsrAttemptSnapshot = null;
  vm.runInContext("browserJobStore.beginAttempt = async snapshot => { atomicAsrAttemptSnapshot = snapshot; return { applied: true }; }", context);
  try {
    const asrRecord = createAtomicAsrAttemptRecord("atomic-asr-first-snapshot");
    await context.beginBrowserJobAttempt(asrRecord, "retrying", { asrIndexes: [0] });
    const asrGroup = context.atomicAsrAttemptSnapshot.chunks.find(entry => entry.entryType === "translation-group");
    const asrAudio = context.atomicAsrAttemptSnapshot.chunks.find(entry => entry.entryType === "audio-chunk");
    assert.equal(asrGroup.asrRequired, true,
      "the first snapshot of a replacement ASR run must invalidate the retained display source");
    assert.equal(asrGroup.stage, "queued");
    assert.equal(asrAudio.asrCompleted, false);
    assert.equal(asrGroup.sourceSegments[0].text, "old source",
      "old subtitles remain durable display fallback until the replacement commits");
    assert.equal(asrGroup.translatedSegments[0].text, "旧译文");

    const translationRecord = createAtomicAsrAttemptRecord("atomic-translation-first-snapshot");
    context.atomicAsrAttemptSnapshot = null;
    await context.beginBrowserJobAttempt(translationRecord, "retry_translation");
    const translationGroup = context.atomicAsrAttemptSnapshot.chunks.find(entry => entry.entryType === "translation-group");
    const translationAudio = context.atomicAsrAttemptSnapshot.chunks.find(entry => entry.entryType === "audio-chunk");
    assert.equal(translationGroup.asrRequired, false,
      "a translation-only attempt must not invalidate completed recognition");
    assert.equal(translationAudio.asrCompleted, true);
  } finally {
    context.atomicOriginalBeginAttempt = originalBeginAttempt;
    vm.runInContext("browserJobStore.beginAttempt = atomicOriginalBeginAttempt", context);
    delete context.atomicOriginalBeginAttempt;
    delete context.atomicAsrAttemptSnapshot;
  }
}

{
  const record = createAtomicAsrAttemptRecord("atomic-asr-conflict-rollback");
  const group = record.browserTranslationGroups.get(0);
  const before = {
    runToken: record.runToken,
    job: structuredClone(record.job),
    audio: structuredClone(record.audioChunks[0]),
    group: {
      completed: group.completed,
      failed: group.failed,
      empty: group.empty,
      sourceSegments: structuredClone(group.sourceSegments),
      errors: structuredClone(group.errors),
      translationQueued: group.translationQueued
    },
    source: JSON.stringify([...record.sourceSegmentsByChunk]),
    translated: JSON.stringify([...record.translatedSegmentsByChunk])
  };
  const originalBeginAttempt = vm.runInContext("browserJobStore.beginAttempt", context);
  vm.runInContext("browserJobStore.beginAttempt = async () => ({ applied: false, reason: 'run-token-conflict' })", context);
  try {
    await assert.rejects(
      () => context.beginBrowserJobAttempt(record, "retrying", { asrIndexes: [0] }),
      /另一个运行实例接管/
    );
    assert.equal(record.runToken, before.runToken);
    assert.deepEqual(record.job, before.job);
    assert.deepEqual(record.audioChunks[0], before.audio);
    assert.deepEqual({
      completed: group.completed,
      failed: group.failed,
      empty: group.empty,
      sourceSegments: group.sourceSegments,
      errors: group.errors,
      translationQueued: group.translationQueued
    }, before.group);
    assert.equal(JSON.stringify([...record.sourceSegmentsByChunk]), before.source);
    assert.equal(JSON.stringify([...record.translatedSegmentsByChunk]), before.translated);
  } finally {
    context.atomicConflictOriginalBeginAttempt = originalBeginAttempt;
    vm.runInContext("browserJobStore.beginAttempt = atomicConflictOriginalBeginAttempt", context);
    delete context.atomicConflictOriginalBeginAttempt;
  }
}

{
  const record = {
    tabId: 3999,
    runToken: "run-finalize-missing-required-audio",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl: "https://example.test/finalize-missing-required-audio", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "finalize-missing-required-audio",
      runToken: "run-finalize-missing-required-audio",
      pipeline: "browser",
      status: "running",
      stage: "retrying",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: {
        status: "running",
        vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文\n",
        vttPath: "browser-memory",
        chunkStatuses: [{
          index: 0,
          stage: "queued",
          status: "排队",
          sourceCount: 0,
          translatedCount: 0,
          expectedAudioChunkIndexes: [0],
          asrRequired: true
        }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  context.finalizeMissingRequiredAudioRecord = record;
  vm.runInContext("browserPreloadJobs.set(finalizeMissingRequiredAudioRecord.job.id, finalizeMissingRequiredAudioRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(finalizeMissingRequiredAudioRecord))", context);
  const claim = await vm.runInContext(
    "browserJobStore.claimRun(finalizeMissingRequiredAudioRecord.job.id, finalizeMissingRequiredAudioRecord.runToken, " +
    "{ ownerId: 'missing-required-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })",
    context
  );
  try {
    const finalized = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "missing-required-owner",
      executionEpoch: claim.job.executionEpoch
    });
    assert.equal(finalized.interrupted, true);
    assert.equal(finalized.terminal, true);
    assert.match(finalized.error, /音频分段不完整/);
    assert.equal(record.job.status, "interrupted");
    assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
    assert.equal(record.job.translation.chunkStatuses[0].asrRequired, true);
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "old source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "旧译文");
    assert.match(record.job.translation.vttText, /旧译文/);
    const durable = await vm.runInContext("browserJobStore.getJob('finalize-missing-required-audio')", context);
    assert.equal(durable.status, "interrupted",
      "FINALIZE must persist interruption instead of swallowing a required group into completed");
  } finally {
    await vm.runInContext("browserJobStore.deleteJob('finalize-missing-required-audio')", context);
    vm.runInContext("browserPreloadJobs.delete('finalize-missing-required-audio')", context);
    delete context.finalizeMissingRequiredAudioRecord;
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
  let snapshotProbeCalls = 0;
  context.fetch = async () => {
    snapshotProbeCalls += 1;
    throw new Error("a persisted capability snapshot must prevent a recovery-time probe");
  };
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://persisted-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }, {
    supportedRequestFields: ["vad_filter"],
    speechTimestampsEndpoint: ""
  }), 30, "job planning must use the persisted capability decision without probing again");
  assert.equal(snapshotProbeCalls, 0);
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
  assert.equal(context.browserTranslationErrorIsContentPolicy("Content Policy Violation"), true);
  assert.equal(context.browserTranslationErrorIsContentPolicy("CONTENT SAFETY FILTER"), true);
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
  assert.ok(requestedSizes.length <= 8, `four-item split fallback made ${requestedSizes.length} LLM calls`);
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
  assert.ok(calls <= 120, `60-line binary split fallback repeated requests unexpectedly: ${calls} LLM calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const request = JSON.parse(body.messages.find(message => message.role === "user").content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (segments.length > 8) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) };
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
      }) } }] })
    };
  };
  const source = Array.from({ length: 60 }, (_, index) => ({
    start: index, end: index + 0.5, text: `recover-${index}`, chunkIndex: 0, segmentIndex: index
  }));
  const translated = await context.translateBrowserSegments(source, {
    providerType: "openai", baseUrl: "https://llm.example/v1", model: "test-model", apiKey: "test-key"
  }, "zh-CN", {}, { batchWorkers: 1 });
  assert.equal(translated.length, 60, "a recoverable 60-item batch must reach its successful 8/7-item leaves");
  assert.deepEqual(requestedSizes, [60, 60, 30, 30, 15, 15, 15, 15, 8, 7, 8, 7, 8, 7, 8, 7]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const attemptsByText = new Map();
  context.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const request = JSON.parse(body.messages.find(message => message.role === "user").content);
    const segments = request.segments || [];
    const singleText = segments.length === 1 ? segments[0].text : "";
    const singleAttempt = singleText ? (attemptsByText.get(singleText) || 0) + 1 : 0;
    if (singleText) attemptsByText.set(singleText, singleAttempt);
    if (segments.length > 1 || (singleText === "second-batch" && singleAttempt === 1)) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) };
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
      }) } }] })
    };
  };
  const source = [
    ...Array.from({ length: 60 }, (_, index) => ({
      start: index, end: index + 0.5, text: `first-${index}`, chunkIndex: 0, segmentIndex: index
    })),
    { start: 60, end: 61, text: "second-batch", chunkIndex: 0, segmentIndex: 60 }
  ];
  const translated = await context.translateBrowserSegments(source, {
    providerType: "openai", baseUrl: "https://llm.example/v1", model: "test-model", apiKey: "test-key"
  }, "zh-CN", {}, { batchWorkers: 1 });
  assert.equal(translated.length, 61, "a difficult first batch must not prevent repair in the following batch");
  assert.equal(translated.at(-1).text, "译文-second-batch");
  assert.equal(attemptsByText.get("second-batch"), 2);
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
        baseUrl: "https://llm-response-format-fallback.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /没有得到可用译文/
  );
  assert.ok(calls <= 121, `response_format fallback repeated HTTP requests unexpectedly: ${calls} calls`);
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
  const tabId = 701;
  const state = seedPage(tabId, { duration: 600 });
  state.context.currentTime = 18;
  context.updateTabContext(tabId, {
    hasMedia: true,
    duration: 600,
    currentTime: 0,
    elementWidth: 640,
    elementHeight: 360
  }, 0);
  assert.equal(state.context.currentTime, 0);

  state.context.currentTime = 18;
  context.updateTabContext(tabId, {
    hasMedia: true,
    duration: 600,
    currentTime: null,
    elementWidth: 640,
    elementHeight: 360
  }, 0);
  assert.equal(state.context.currentTime, 18);
}

{
  const record = {
    runToken: "run-browser-progress-test",
    metadata: { pageUrl: "" },
    audioChunks: [],
    sourceSegmentsByChunk: new Map(),
    job: {
      id: "browser-progress-test",
      runToken: "run-browser-progress-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 0, elapsedSeconds: 0 },
      translation: { chunkStatuses: [] }
    },
    startedAt: Date.now() - 5000,
    tabId: 700
  };
  const originalScheduleBrowserJobMirror = context.scheduleBrowserJobMirror;
  let mirrorSchedules = 0;
  context.scheduleBrowserJobMirror = () => {
    mirrorSchedules += 1;
  };
  context.browserProgressTestRecord = record;
  vm.runInContext("browserPreloadJobs.set('browser-progress-test', browserProgressTestRecord)", context);
  try {
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
  assert.equal(mirrorSchedules, 0, "high-frequency extraction progress must not write a full durable snapshot");
  } finally {
    context.scheduleBrowserJobMirror = originalScheduleBrowserJobMirror;
    vm.runInContext("browserPreloadJobs.delete('browser-progress-test')", context);
    delete context.browserProgressTestRecord;
  }
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
  const tabId = 702;
  seedPage(tabId, { title: "Cross-origin authorization provenance", duration: 600 });
  add(tabId, {
    url: "https://audio-a.example.test/media/audio-128k.m4a",
    kind: "audio",
    role: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    requestHeaders: { authorization: "Bearer origin-a" }
  });
  add(tabId, {
    url: "https://video-b.example.test/media/video-720p.mp4",
    kind: "video",
    role: "video",
    ext: "mp4",
    contentType: "video/mp4",
    duration: 600,
    requestHeaders: { authorization: "Bearer origin-b" }
  });

  const [displayCandidate] = context.getDisplayCandidates(tabId);
  assert.equal(displayCandidate.url, "https://audio-a.example.test/media/audio-128k.m4a");
  assert.equal(JSON.stringify(displayCandidate).includes("origin-a"), false);
  assert.equal(JSON.stringify(displayCandidate).includes("requestHeadersByOrigin"), false);
  const internalCandidate = context.resolvePreloadCandidateForStart(context.getState(tabId), displayCandidate);
  assert.deepEqual(JSON.parse(JSON.stringify(internalCandidate.requestHeaders)), {
    authorization: "Bearer origin-a"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(internalCandidate.requestHeadersByOrigin)), {
    "https://audio-a.example.test": { authorization: "Bearer origin-a" },
    "https://video-b.example.test": { authorization: "Bearer origin-b" }
  });
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
  const record = {
    tabId: 3041,
    runToken: "run-clear-persist-failure",
    pipeline: "browser",
    metadata: { pageUrl: "https://example.test/watch/clear-persist-failure" },
    candidate: { pageUrl: "https://example.test/watch/clear-persist-failure" },
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "source", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }]]]),
    audioChunks: [],
    job: {
      id: "browser-clear-persist-failure", runToken: "run-clear-persist-failure", pipeline: "browser",
      status: "completed", stage: "completed", createdAt: 100, updatedAt: 200,
      extract: { status: "completed", progress: 100, elapsedSeconds: 1 },
      translation: {
        status: "completed", vttText: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n旧译文\n",
        transcript: { source: [], translated: [] }, chunkStatuses: [], chunksTotal: 1, chunksDone: 1
      }
    }
  };
  context.clearPersistFailureRecord = record;
  vm.runInContext("browserPreloadJobs.set('browser-clear-persist-failure', clearPersistFailureRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(clearPersistFailureRecord))", context);
  const originalPutSnapshot = vm.runInContext("browserJobStore.putSnapshot", context);
  vm.runInContext("browserJobStore.putSnapshot = async () => { throw new Error('injected clear mirror failure'); }", context);
  try {
    await assert.rejects(
      context.clearBrowserSubtitleStateForJob(record),
      /未能持久化清除状态/
    );
    const durable = await vm.runInContext("browserJobStore.getJob('browser-clear-persist-failure')", context);
    assert.notEqual(durable.subtitleCleared, true, "a failed mirror must not be reported as a durable clear");
  } finally {
    context.originalPutSnapshotForClearFailure = originalPutSnapshot;
    vm.runInContext("browserJobStore.putSnapshot = originalPutSnapshotForClearFailure", context);
    delete context.originalPutSnapshotForClearFailure;
    await vm.runInContext("browserJobStore.deleteJob('browser-clear-persist-failure')", context);
    vm.runInContext("browserPreloadJobs.delete('browser-clear-persist-failure')", context);
    delete context.clearPersistFailureRecord;
  }
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
    runToken: "run-browser-clear-subtitle-state",
    pipeline: "browser",
    candidate: { url: "https://media.example.test/clear-subtitle.mp4", kind: "video", ext: "mp4", pageUrl: "https://example.test/watch/clear-subtitle" },
    metadata: { title: "Clear subtitle state", pageUrl: "https://example.test/watch/clear-subtitle" },
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
      runToken: "run-browser-clear-subtitle-state",
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
  context.setTabStatus(3040, {
    preload: "completed", preloadJob: record.job,
    page: { url: "https://example.test/watch/clear-subtitle" },
    context: { href: "https://example.test/watch/clear-subtitle" }
  });
  const originalTabsGet = chrome.tabs.get;
  chrome.tabs.get = async id => ({ id, title: "Clear subtitle state", url: "https://example.test/watch/clear-subtitle" });
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

    const durableCleared = await vm.runInContext("browserJobStore.getJob('browser-clear-subtitle-state')", context);
    assert.equal(durableCleared.subtitleCleared, true, "clear must be committed before the command returns");
    vm.runInContext("browserPreloadJobs.delete('browser-clear-subtitle-state'); tabState.delete(3040)", context);
    const recovered = await context.recoverBrowserPresentationJob(
      "browser-clear-subtitle-state", 3040, "https://example.test/watch/clear-subtitle"
    );
    assert.equal(recovered.job.subtitleCleared, true);
    assert.equal(recovered.job.translation.vttText, "", "a cleared durable subtitle must not be rebuilt after SW recovery");
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.job.translation.transcript.translated)), []);

    recovered.job.subtitleCleared = false;
    recovered.translatedSegmentsByChunk.set(0, [{ start: 1, end: 2, text: "新译文", chunkIndex: 0, segmentIndex: 0 }]);
    context.refreshBrowserSubtitleProjection(recovered);
    assert.match(recovered.job.translation.vttText, /新译文/, "an explicit new attempt may show newly generated subtitles");

    await context.retryBrowserTranslationOnly(record, [0], { failedOnly: false });
    assert.equal(funAsrCalls, 0);
    assert.equal(translationCalls, 0);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
  } finally {
    chrome.tabs.get = originalTabsGet;
    await vm.runInContext("browserJobStore.deleteJob('browser-clear-subtitle-state')", context);
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
    assert.equal(result.removed, 4, "the global 30-byte cap must include protected bytes while never deleting the protected entry");
    assert.equal(await cache.match(oldUrl), undefined);
    assert.equal(await cache.match(oldestUrl), undefined);
    assert.equal(await cache.match(middleUrl), undefined);
    assert.equal(await cache.match(newestUrl), undefined);
    assert.notEqual(await cache.match(protectedUrl), undefined);
  } finally {
    vm.runInContext("browserPreloadJobs.delete('running-job')", context);
  }
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const jobId = "durable-running-cache-job";
  const runToken = "durable-running-cache-run";
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/1000000000000-running.mp3`;
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(Date.now() - 120_000), "X-Fuguang-Bytes": "1" }
  }));
  context.durableRunningCacheSnapshot = {
    job: { id: jobId, runToken, status: "running", stage: "asr", updatedAt: Date.now() },
    chunks: [{
      key: `${jobId}:${runToken}:audio-chunk:0`,
      jobRunKey: `${jobId}:${runToken}`,
      jobId,
      runToken,
      entryType: "audio-chunk",
      index: 0,
      audioCacheRef: cacheUrl,
      audioCacheRefs: [cacheUrl]
    }]
  };
  await vm.runInContext("browserJobStore.putSnapshot(durableRunningCacheSnapshot)", context);
  const result = await context.pruneBrowserAudioCache({ maxAgeMs: 1, maxBytes: 1 });
  assert.equal(result.removed, 0, "a durable non-terminal job must be protected even when it is not in browserPreloadJobs");
  assert.notEqual(await cache.match(cacheUrl), undefined);
  await vm.runInContext(`browserJobStore.deleteJob('${jobId}')`, context);
  delete context.durableRunningCacheSnapshot;
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const jobId = "completed-cache-ledger-job";
  const runToken = "completed-cache-ledger-run";
  const firstUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/1000000000000-part-a.mp3`;
  const secondUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/1000000001000-part-b.mp3`;
  for (const url of [firstUrl, secondUrl]) {
    await cache.put(url, new FakeResponse(new Uint8Array([1]).buffer, {
      headers: { "X-Fuguang-Cached-At": String(Date.now() - 120_000), "X-Fuguang-Bytes": "1" }
    }));
  }
  context.completedCacheLedgerSnapshot = {
    job: { id: jobId, runToken, status: "completed", stage: "completed", updatedAt: Date.now(), reusableAudioChunks: 1 },
    chunks: [{
      key: `${jobId}:${runToken}:audio-chunk:0`,
      jobRunKey: `${jobId}:${runToken}`,
      jobId,
      runToken,
      entryType: "audio-chunk",
      index: 0,
      audioCacheRef: firstUrl,
      audioCacheRefs: [firstUrl, secondUrl],
      audioParts: [{ index: 0, cacheRef: firstUrl }, { index: 1, cacheRef: secondUrl }]
    }]
  };
  await vm.runInContext("browserJobStore.putSnapshot(completedCacheLedgerSnapshot)", context);
  const result = await context.pruneBrowserAudioCache({ maxAgeMs: 1, maxBytes: 1024 });
  assert.equal(result.removed, 2);
  const durable = await vm.runInContext(`browserJobStore.getSnapshot('${jobId}', '${runToken}')`, context);
  assert.equal(durable.chunks.filter(chunk => chunk.entryType === "audio-chunk").length, 0, "prune must remove the corresponding durable logical audio row");
  assert.equal(durable.job.audioCacheRemoved, true);
  assert.equal(durable.job.audioCacheVerified, true);
  assert.equal(durable.job.reusableAudioChunks, 0);
  await vm.runInContext(`browserJobStore.deleteJob('${jobId}')`, context);
  delete context.completedCacheLedgerSnapshot;
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const jobId = "recent-completed-cache-job";
  const runToken = "recent-completed-cache-run";
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/${Date.now()}-recent.mp3`;
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(Date.now()), "X-Fuguang-Bytes": "1" }
  }));
  context.recentCompletedCacheSnapshot = {
    job: { id: jobId, runToken, status: "completed", stage: "completed", updatedAt: Date.now(), reusableAudioChunks: 1 },
    chunks: [{
      key: `${jobId}:${runToken}:audio-chunk:0`, jobRunKey: `${jobId}:${runToken}`, jobId, runToken,
      entryType: "audio-chunk", index: 0, audioCacheRef: cacheUrl, audioCacheRefs: [cacheUrl]
    }]
  };
  await vm.runInContext("browserJobStore.putSnapshot(recentCompletedCacheSnapshot)", context);
  const result = await context.pruneBrowserAudioCache({ maxAgeMs: 60_000, maxBytes: 1024 });
  assert.equal(result.removed, 0);
  assert.notEqual(await cache.match(cacheUrl), undefined, "recent completed audio must remain reusable while under the size cap");
  assert.equal((await vm.runInContext(`browserJobStore.getChunks('${jobId}', '${runToken}')`, context)).length, 1);
  await vm.runInContext(`browserJobStore.deleteJob('${jobId}')`, context);
  delete context.recentCompletedCacheSnapshot;
}

{
  const firstRef = "https://fuguang.local/__fuguang_audio_cache/delete-results/first.mp3";
  const failedRef = "https://fuguang.local/__fuguang_audio_cache/delete-results/failed.mp3";
  const present = new Set([firstRef, failedRef]);
  const deletion = await context.deleteBrowserAudioCacheUrls({
    async match(ref) {
      return present.has(ref) ? new FakeResponse(new Uint8Array([1]).buffer) : undefined;
    },
    async delete(ref) {
      if (ref === failedRef) {
        throw new Error("injected cache delete failure");
      }
      return present.delete(ref);
    }
  }, [firstRef, failedRef]);
  assert.deepEqual(JSON.parse(JSON.stringify(deletion)), {
    deleted: [firstRef],
    alreadyMissing: [],
    failed: [failedRef]
  });
  assert.equal(present.has(failedRef), true, "a failed cache ref must remain available and must not be reconciled away");
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  for (const key of await cache.keys()) {
    await cache.delete(key.url);
  }
  const jobId = "cache-reconcile-retry-job";
  const runToken = "cache-reconcile-retry-run";
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/1000000000000-old.mp3`;
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([1]).buffer, {
    headers: { "X-Fuguang-Cached-At": String(Date.now() - 120_000), "X-Fuguang-Bytes": "1" }
  }));
  context.cacheReconcileRetrySnapshot = {
    job: { id: jobId, runToken, status: "completed", stage: "completed", updatedAt: Date.now(), reusableAudioChunks: 1 },
    chunks: [{
      key: `${jobId}:${runToken}:audio-chunk:0`, jobRunKey: `${jobId}:${runToken}`, jobId, runToken,
      entryType: "audio-chunk", index: 0, audioCacheRef: cacheUrl, audioCacheRefs: [cacheUrl]
    }]
  };
  await vm.runInContext("browserJobStore.putSnapshot(cacheReconcileRetrySnapshot)", context);
  context.originalReconcileAudioCacheRefs = await vm.runInContext("browserJobStore.reconcileAudioCacheRefs", context);
  context.reconcileAudioCacheAttempts = 0;
  vm.runInContext(`browserJobStore.reconcileAudioCacheRefs = async (...args) => {
    reconcileAudioCacheAttempts += 1;
    if (reconcileAudioCacheAttempts === 1) throw new Error('injected first reconcile failure');
    return originalReconcileAudioCacheRefs(...args);
  }`, context);
  try {
    const result = await context.pruneBrowserAudioCache({ maxAgeMs: 1, maxBytes: 1024 });
    assert.equal(result.removed, 1);
    assert.equal(context.reconcileAudioCacheAttempts, 2, "cache deletion followed by a transient IDB failure must retry idempotently");
    assert.equal((await vm.runInContext(`browserJobStore.getChunks('${jobId}', '${runToken}')`, context)).length, 0);
  } finally {
    vm.runInContext("browserJobStore.reconcileAudioCacheRefs = originalReconcileAudioCacheRefs", context);
    await vm.runInContext(`browserJobStore.deleteJob('${jobId}')`, context);
    delete context.cacheReconcileRetrySnapshot;
    delete context.originalReconcileAudioCacheRefs;
    delete context.reconcileAudioCacheAttempts;
  }
}

{
  const jobId = "rerun-missing-cache-preflight";
  const runToken = "rerun-missing-cache-run";
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/missing.mp3`;
  const record = {
    tabId: 3991,
    runToken,
    pipeline: "browser",
    metadata: { pageUrl: "https://example.test/watch/rerun-missing" },
    modelConfig: { asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    audioChunks: [{ index: 0, start: 0, end: 30, file: { cacheUrl } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "keep old source" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "保留旧译文" }]]]),
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    job: {
      id: jobId, runToken, status: "completed", stage: "completed", createdAt: Date.now(), updatedAt: Date.now(),
      extract: { status: "completed", elapsedSeconds: 1 },
      translation: { status: "completed", chunksTotal: 1, chunkStatuses: [{ index: 0, stage: "completed", sourceCount: 1, translatedCount: 1 }] }
    }
  };
  context.rerunMissingCacheRecord = record;
  vm.runInContext("browserPreloadJobs.set(rerunMissingCacheRecord.job.id, rerunMissingCacheRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(rerunMissingCacheRecord))", context);
  try {
    await assert.rejects(() => context.rerunBrowserAsrFromAudio(record), /音频缓存已清除|没有可复用的音频缓存/);
    assert.equal(record.runToken, runToken, "cache verification must fail before beginBrowserJobAttempt changes the run token");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "keep old source", "preflight failure must not clear the old ASR result");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "保留旧译文", "preflight failure must not clear the old translation");
  } finally {
    vm.runInContext("browserPreloadJobs.delete(rerunMissingCacheRecord.job.id)", context);
    await vm.runInContext("browserJobStore.deleteJob(rerunMissingCacheRecord.job.id)", context);
    delete context.rerunMissingCacheRecord;
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

    assert.equal(asrCalls, 0);
    assert.equal(observedAsrLanguage, "");
    assert.equal(translationCalls, 0);
    assert.deepEqual(targets, []);
    assert.equal(record.modelConfig.asr.language, "ja");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "old source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "old translation");
    assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
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
    const rerun = await context.rerunAsrPreload(3051, [0], { sourceLanguage: "ja", targetLanguage: "zh-CN" });

    assert.equal(rerun.accepted, true);
    assert.equal(rerun.pending, true);
    assert.equal(funAsrCalls, 0, "manual FunASR rerun must not issue paid HTTP in the Service Worker");
    assert.equal(observedFunAsrLanguage, "");
    assert.equal(translationCalls, 0);
    assert.equal(record.modelConfig.asr.language, "ja");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, "old funasr source");
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "old funasr translation");
    assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
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

async function assertInterruptedRerunContinuesWithAsr(pipeline) {
  const funAsr = pipeline === "funasr";
  const suffix = funAsr ? "funasr" : "browser";
  const jobId = `rerun-interrupted-continue-${suffix}`;
  const runToken = `rerun-interrupted-continue-run-${suffix}`;
  const cacheUrl = `https://fuguang.local/__fuguang_audio_cache/${jobId}/chunk-0.mp3`;
  await (await caches.open("fuguang-web-ffmpeg-audio")).put(
    cacheUrl,
    new FakeResponse(new Uint8Array([1]).buffer)
  );
  const record = {
    tabId: funAsr ? 3053 : 3052,
    runToken,
    pipeline,
    startedAt: Date.now(),
    metadata: { title: `${suffix} interrupted rerun`, duration: funAsr ? 7200 : 120 },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      chunkSeconds: 900,
      asr: funAsr
        ? { providerType: "dashscope_funasr", baseUrl: "https://dashscope.test/api/v1", model: "fun-asr", apiKey: "test" }
        : { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{
      index: 0,
      start: 0,
      end: funAsr ? 7200 : 120,
      duration: funAsr ? 7200 : 120,
      asrCompleted: true,
      file: { name: "chunk-0.mp3", mime: "audio/mpeg", cacheUrl, bytes: 1 }
    }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: `old ${suffix} source`, chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: `old ${suffix} translation`, chunkIndex: 0, segmentIndex: 0 }]]]),
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    job: {
      id: jobId,
      runToken,
      pipeline,
      status: "completed",
      stage: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      extract: { status: "completed", progress: 100, duration: funAsr ? 7200 : 120 },
      translation: {
        status: "completed",
        vttText: `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nold ${suffix} translation\n`,
        chunkStatuses: [{ index: 0, stage: "completed", status: "完成", sourceCount: 1, translatedCount: 1 }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };
  const originalSendOffscreenTaskRuntimeCommand = context.sendOffscreenTaskRuntimeCommand;
  let startAttempts = 0;
  context.sendOffscreenTaskRuntimeCommand = async (type, payload = {}) => {
    if (type !== "FUGUANG_TASK_RUNTIME_START_JOB") {
      return { accepted: true };
    }
    startAttempts += 1;
    if (startAttempts === 1) {
      return { accepted: false, reason: "injected-offscreen-unavailable" };
    }
    return {
      accepted: true,
      snapshotApplied: true,
      executionOwnerId: `rerun-continue-owner-${suffix}`,
      executionEpoch: 1,
      executionLeaseExpiresAt: Date.now() + 30_000,
      snapshot: payload.snapshot
    };
  };
  context.rerunInterruptedContinueRecord = record;
  vm.runInContext("browserPreloadJobs.set(rerunInterruptedContinueRecord.job.id, rerunInterruptedContinueRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot(createBrowserJobLedgerSnapshot(rerunInterruptedContinueRecord))", context);
  let claim = null;
  try {
    await assert.rejects(
      () => context.rerunBrowserAsrFromAudio(record, [0]),
      /后台翻译暂时不可用/
    );
    assert.equal(record.job.status, "interrupted");
    assert.equal(record.audioChunks[0].asrCompleted, false);
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, `old ${suffix} source`);
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, `old ${suffix} translation`);
    assert.match(record.job.translation.vttText, new RegExp(`old ${suffix} translation`),
      "the old subtitle must remain visible while the replacement ASR has not committed");

    const continued = funAsr
      ? await context.retryBrowserFunAsrFailedPreload(record, [0])
      : await context.retryBrowserFailedPreload(record, [0]);
    assert.equal(continued.accepted, true);
    assert.equal(continued.pending, true);
    assert.equal(startAttempts, 2);
    claim = await vm.runInContext(
      `browserJobStore.claimRun(${JSON.stringify(jobId)}, ${JSON.stringify(record.runToken)}, ` +
      `{ ownerId: ${JSON.stringify(`rerun-continue-owner-${suffix}`)}, claimedAt: Date.now(), leaseDurationMs: 30000 })`,
      context
    );
    assert.equal(claim.applied, true, JSON.stringify(claim));
    const work = await context.getOffscreenBrowserJobWork({
      jobId,
      runToken: record.runToken,
      executionOwnerId: `rerun-continue-owner-${suffix}`,
      executionEpoch: claim.job.executionEpoch
    });
    assert.equal(work.accepted, true, JSON.stringify(work));
    assert.deepEqual(JSON.parse(JSON.stringify(work.chunks)), [{ index: 0, asrCompleted: false, processing: false }]);
    assert.deepEqual(JSON.parse(JSON.stringify(work.translations)), [],
      "continuing an interrupted ASR rerun must not translate the display-only old source");
    assert.equal(record.sourceSegmentsByChunk.get(0)[0].text, `old ${suffix} source`);
    assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, `old ${suffix} translation`);
  } finally {
    context.sendOffscreenTaskRuntimeCommand = originalSendOffscreenTaskRuntimeCommand;
    await vm.runInContext(`browserJobStore.deleteJob(${JSON.stringify(jobId)})`, context);
    vm.runInContext(`browserPreloadJobs.delete(${JSON.stringify(jobId)})`, context);
    delete context.rerunInterruptedContinueRecord;
  }
}

await assertInterruptedRerunContinuesWithAsr("browser");
await assertInterruptedRerunContinuesWithAsr("funasr");

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
  const createMixedRetryRecord = pipeline => ({
    tabId: pipeline === "funasr" ? 304 : 305,
    pipeline,
    metadata: { title: `${pipeline} mixed retry` },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      chunkSeconds: 900,
      targetLanguage: "zh-CN",
      asr: { providerType: pipeline === "funasr" ? "dashscope_funasr" : "openai", baseUrl: "https://asr.test/v1", model: "asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "llm", apiKey: "test" }
    },
    audioChunks: [
      { index: 0, start: 0, end: 900, coreStart: 0, coreEnd: 900, asrCompleted: true, file: { name: "chunk-0.mp3", buffer: new ArrayBuffer(1) } },
      { index: 1, start: 900, end: 1800, coreStart: 900, coreEnd: 1800, file: { name: "chunk-1.mp3", buffer: new ArrayBuffer(1) } }
    ],
    browserAsrChunkToTranslationGroup: new Map([[0, 0], [1, 1]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "reusable", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: `mixed-retry-${pipeline}`,
      pipeline,
      status: "failed",
      stage: "completed_with_warnings",
      extract: { status: "completed", elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [
          { index: 0, stage: "failed", attempts: 1, sourceCount: 1, translatedCount: 1, asrFailures: 0 },
          { index: 1, stage: "failed", attempts: 1, sourceCount: 0, translatedCount: 0, asrFailures: 1 }
        ],
        chunksTotal: 2,
        chunksDone: 2,
        chunksFailed: 2
      }
    }
  });
  const originalTranslate = context.translateBrowserSegments;
  let swTranslationCalls = 0;
  context.translateBrowserSegments = async () => {
    swTranslationCalls += 1;
    return await new Promise(() => {});
  };
  try {
    for (const pipeline of ["browser", "funasr"]) {
      const record = createMixedRetryRecord(pipeline);
      const result = await Promise.race([
        (pipeline === "funasr"
          ? context.retryBrowserFunAsrFailedPreload(record)
          : context.retryBrowserFailedPreload(record)),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`${pipeline} mixed retry waited on the SW translation gate`)), 100))
      ]);
      assert.equal(result.accepted, true);
      assert.equal(result.pending, true);
      assert.equal(swTranslationCalls, 0);
      assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
      assert.equal(record.job.translation.chunkStatuses[1].stage, "queued");
      assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "old");
    }
  } finally {
    context.translateBrowserSegments = originalTranslate;
  }
}

{
  const record = {
    tabId: 306,
    runToken: "run-funasr-partial-audio-retry",
    pipeline: "funasr",
    metadata: { title: "Fun-ASR partial audio retry" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "dashscope_funasr", baseUrl: "https://asr.test/v1", model: "fun-asr", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "llm", apiKey: "test" }
    },
    audioChunks: [
      { index: 0, start: 0, end: 900, coreStart: 0, coreEnd: 900, file: { name: "chunk-0.mp3", buffer: new ArrayBuffer(1) } }
    ],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "funasr-partial-audio-retry",
      runToken: "run-funasr-partial-audio-retry",
      pipeline: "funasr",
      status: "interrupted",
      stage: "asr",
      extract: { status: "completed", progress: 100 },
      translation: {
        chunkStatuses: [
          { index: 0, stage: "failed", status: "失败", attempts: 1, asrFailures: 1, error: "识别失败", expectedAudioChunkIndexes: [0] },
          { index: 1, stage: "failed", status: "失败", attempts: 1, asrFailures: 1, error: "识别失败", expectedAudioChunkIndexes: [1] }
        ],
        chunksTotal: 2,
        chunksDone: 2,
        chunksFailed: 2
      }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const originalRunToken = record.runToken;
  const originalStatus = record.job.status;
  const originalChunkStatuses = structuredClone(record.job.translation.chunkStatuses);
  const startMessagesBefore = runtimeMessages.filter(message => (
    message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === record.job.id
  )).length;
  let offscreenStartCalls = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStartCalls += 1;
    return { status: "started" };
  };
  try {
    await assert.rejects(
      () => context.retryBrowserFunAsrFailedPreload(record, [0, 1]),
      /没有保留可继续识别的音频分段（2）/
    );
    assert.equal(record.runToken, originalRunToken);
    assert.equal(record.job.runToken, originalRunToken);
    assert.equal(record.job.status, originalStatus);
    assert.deepEqual(
      JSON.parse(JSON.stringify(record.job.translation.chunkStatuses)),
      JSON.parse(JSON.stringify(originalChunkStatuses))
    );
    assert.equal(offscreenStartCalls, 0);
    assert.equal(runtimeMessages.filter(message => (
      message.type === "FUGUANG_TASK_RUNTIME_START_JOB" && message.snapshot?.job?.id === record.job.id
    )).length, startMessagesBefore);
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
  }
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
  assert.equal(record.job.translation.status, "completed_with_warnings");
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
  assert.equal(record.job.translation.status, "completed");
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
  assert.equal(record.job.translation.status, "completed_with_warnings");
  assert.match(record.job.error, /没有生成可显示字幕/);
}

{
  const record = {
    tabId: 215,
    startedAt: Date.now() - 1000,
    metadata: {},
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [],
    job: {
      id: "browser-empty-completed",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1 },
      translation: {
        status: "running",
        chunkStatuses: [],
        chunksTotal: 0,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };

  context.finalizeBrowserCompletionState(record);

  assert.equal(record.job.status, "completed", "an empty job keeps the existing completed terminal meaning");
  assert.equal(record.job.stage, "completed");
  assert.equal(record.job.translation.status, "completed");
  assert.equal(record.job.error, "");
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
  const tabId = 220;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleFrameId = 5;
  state.mediaFrameId = 5;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const attemptedFrames = [];
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }, { frameId: 8 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return null;
    }
    attemptedFrames.push(options.frameId ?? null);
    if (options.frameId === 5) {
      return { ok: false, mediaBindingRejected: true };
    }
    if (options.frameId === 8) {
      return { ok: true };
    }
    return { ok: false, noTargetMedia: true };
  };

  const response = await context.sendMessageToMediaFrame(tabId, {
    type: "FUGUANG_ATTACH_VTT",
    vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nowner frame\n"
  });

  assert.equal(response.mediaBindingRejected, true);
  assert.deepEqual(attemptedFrames, [5], "an owner-frame media rejection must stop projection into unrelated iframes");
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 222;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleFrameId = 5;
  state.mediaFrameId = 8;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const attemptedFrames = [];
  chrome.webNavigation.getAllFrames = async () => [
    { frameId: 0 },
    { frameId: 5 },
    { frameId: 8 },
    { frameId: 9 }
  ];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return null;
    }
    attemptedFrames.push(options.frameId ?? null);
    if (options.frameId === 5) {
      return { ok: false, mediaBindingRejected: true };
    }
    if (options.frameId === 8) {
      return { ok: true };
    }
    return { ok: false, noTargetMedia: true };
  };

  const response = await context.sendMessageToMediaFrame(tabId, {
    type: "FUGUANG_ATTACH_VTT",
    vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\ntrusted successor frame\n"
  });

  assert.equal(response.ok, true, "the current trusted media frame must be allowed to take over from a stale subtitle frame");
  assert.deepEqual(attemptedFrames, [5, 8], "handoff must stop after the one trusted successor and never broadcast to unrelated frames");
  assert.equal(state.subtitleFrameId, 8);
  assert.equal(state.mediaFrameId, 8);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 221;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleFrameId = null;
  state.mediaFrameId = 5;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const attemptedFrames = [];
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }, { frameId: 8 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return null;
    }
    attemptedFrames.push(options.frameId ?? null);
    if (options.frameId === 5 || options.frameId === 0) {
      return { ok: false, noTargetMedia: true };
    }
    if (options.frameId === 8) {
      return { ok: true };
    }
    return null;
  };

  const response = await context.sendMessageToMediaFrame(tabId, {
    type: "FUGUANG_ATTACH_VTT",
    vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nfallback frame\n"
  });

  assert.equal(response.ok, true);
  assert.deepEqual(attemptedFrames, [0, 5, 8], "a frame with no target media must still allow normal fallback");
  assert.equal(state.subtitleFrameId, 8);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const sourceSegment = { start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 };
  const record = {
    tabId: 300,
    runToken: "run-provider-cancel-message",
    abortController: new AbortController(),
    startedAt: Date.now() - 1000,
    metadata: { title: "Provider cancellation text is still a failure" },
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
    throw new Error("provider request cannot be cancelled");
  };
  context.attachBrowserJobVttIfReady = async () => {};

  await context.processBrowserTranslationChunk(record, { index: 0 }, [sourceSegment]);

  assert.equal(record.job.translation.chunkStatuses[0].stage, "failed", "provider text must not impersonate a user cancellation");
  assert.deepEqual(JSON.parse(JSON.stringify(record.translatedSegmentsByChunk.get(0))), []);
  assert.deepEqual(JSON.parse(JSON.stringify(record.job.translation.transcript.translated)), []);
  assert.equal(record.job.translation.transcript.source[0].text, "hello");
  assert.match(record.job.translation.chunkStatuses[0].error, /翻译失败/);
  context.translateBrowserSegments = originalTranslate;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const liveController = new AbortController();
  const providerAbortError = new Error("provider aborted its own request");
  providerAbortError.name = "AbortError";
  assert.equal(
    context.isBrowserAbortError(providerAbortError, liveController.signal),
    false,
    "an unbranded provider AbortError with a live job signal is a failure"
  );
  assert.equal(
    context.isBrowserAbortError(context.browserAbortError(new Error("任务已停止。")), liveController.signal),
    true,
    "project-created abort errors remain authoritative"
  );
  liveController.abort(new Error("任务已停止。"));
  assert.equal(
    context.isBrowserAbortError(new Error("unrelated provider failure"), liveController.signal),
    true,
    "the job signal remains authoritative even when the thrown error is generic"
  );
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
    audioChunks: [{ index: 0, start: 0, end: 900, asrCompleted: true, file: { name: "chunk-001.mp3" } }],
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
  assert.equal(translationCalls, 0);
  assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "old");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
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
    audioChunks: [{ index: 0, start: 0, end: 900, asrCompleted: true, file: { name: "chunk-001.mp3" } }],
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
  assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "old English");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
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
    audioChunks: [{ index: 0, start: 0, end: 7200, duration: 7200, asrCompleted: true, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } }],
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
  assert.equal(translationCalls, 0);
  assert.equal(record.translatedSegmentsByChunk.has(0), false);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
  context.transcribeDashScopeFunAsrFile = originalFunAsr;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 3015,
    runToken: "run-browser-retranslate-preserve",
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
      runToken: "run-browser-retranslate-preserve",
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
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
    assert.equal(record.job.translation.chunkStatuses[0].error, "");
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
    const previousRunToken = record.runToken || record.job.runToken || "";
    const runtimeMessageCount = taskRuntimeSent.length;
    await context.retranslatePreload(3012, [0]);
    assert.equal(observedTarget, "");
    assert.equal(observedModel, "");
    assert.equal(record.modelConfig.targetLanguage, "zh-CN");
    assert.equal(record.modelConfig.translation.model, "current-llm");
    assert.equal(record.job.translation.targetLanguage, "zh-CN");
    assert.notEqual(record.runToken, previousRunToken);
    assert.equal(record.job.translation.chunkStatuses[0].attempts, 0);
    assert.equal(record.job.translation.chunkStatuses[0].stage, "asr_done");
    assert.ok(taskRuntimeSent.slice(runtimeMessageCount).some(message =>
      message.type === "FUGUANG_TASK_RUNTIME_START_JOB"
      && message.snapshot?.job?.id === record.job.id
    ));
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
    const runtimeMessageCount = taskRuntimeSent.length;
    const result = await context.retranslateCachedTranscript(3013, {
      metadata: { title: "Cached source", pageUrl: "https://example.test/watch", sourceUrl: "https://media.example.test/video.m3u8" },
      source: [
        { start: 1, end: 2, text: "こんにちは" },
        { start: 3, end: 4, text: "Oh." }
      ],
      translated: [
        { start: 1, end: 2, text: "旧译文一" },
        { start: 3, end: 4, text: "旧译文二" }
      ]
    }, { title: "Cached source" });
    assert.equal(funAsrCalls, 0);
    assert.equal(asrCalls, 0);
    assert.equal(observedTarget, "");
    assert.equal(observedModel, "");
    assert.equal(result.accepted, true);
    assert.equal(result.pending, true);
    assert.equal(result.job.pipeline, "cached-transcript");
    assert.equal(result.job.translation.chunkStatuses[0].stage, "asr_done");
    assert.equal(result.job.translation.chunkStatuses[0].translatedCount, 2);
    context.cachedRetranslateJobId = result.job.id;
    assert.deepEqual(
      JSON.parse(JSON.stringify(vm.runInContext("browserPreloadJobs.get(cachedRetranslateJobId).translatedSegmentsByChunk.get(0).map(segment => segment.text)", context))),
      ["旧译文一", "旧译文二"]
    );
    delete context.cachedRetranslateJobId;
    assert.ok(taskRuntimeSent.slice(runtimeMessageCount).some(message =>
      message.type === "FUGUANG_TASK_RUNTIME_START_JOB"
      && message.snapshot?.job?.id === result.job.id
    ));
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
    const segments = [{ start: chunk.start + 1, end: chunk.start + 2, text: `source-${chunk.index}` }];
    return chunk.index === 0
      ? context.attachBrowserAsrResultWarning(segments, new Error("optional coverage retry was rate limited"))
      : segments;
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: `译文-${segment.chunkIndex}` }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  const result = await context.retryBrowserFailedPreload(record);

  assert.equal(result.accepted, true);
  assert.equal(result.pending, true);
  assert.equal(asrCalls, 0);
  assert.equal(translationCalls, 0);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
  assert.equal(record.job.translation.chunkStatuses[1].stage, "queued");
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

  assert.equal(result.accepted, true);
  assert.equal(result.pending, true);
  assert.equal(record.job.status, "running");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
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
  assert.equal(postedFields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(postedFields.some(([name, value]) => name === "word_timestamps" && value === "true"), true);
  assert.equal(postedFields.some(([name, value]) => name === "condition_on_previous_text" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "without_timestamps" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "temperature" && value === "0"), true);
  assert.equal(postedFields.some(([name]) => name === "vad_parameters"), true);
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
  assert.equal(
    postedFields.some(([name, value]) => name === "vad_filter" && value === "true"),
    true,
    "外部 VAD 返回空区间时也不能关闭服务端原生 VAD"
  );
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
          {
            start: 7.2,
            end: 8.4,
            text: "recovered sentence",
            words: [
              { start: 7.2, end: 7.8, word: "recovered", probability: 0.9 },
              { start: 7.8, end: 8.4, word: "sentence", probability: 0.9 }
            ]
          }
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
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(
    transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"),
    true,
    "auto 模式在服务端明确支持 vad_filter 时必须保留原生 VAD，不能由外部预检替代"
  );
  assert.equal(JSON.stringify(directVadRecovery.map(segment => segment.text)), JSON.stringify(["recovered sentence"]));
  assert.equal(Math.round(directVadRecovery[0].start * 10) / 10, 37.2);
  assert.equal(Boolean(retryDiagnostics.directAttempt), false);
  assert.equal(Boolean(retryDiagnostics.retry), false);
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
      return { ok: true, json: async () => [{ start: 1000, end: 20000 }] };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "first paid result survives" }]
        })
      };
    }
    return {
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Too many requests during optional coverage recovery" } })
    };
  };
  const preserved = await context.transcribeBrowserAudioChunk(
    {
      index: 31,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "coverage-retry-rate-limited.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-coverage-retry-rate-limited.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(JSON.stringify(preserved.map(segment => segment.text)), JSON.stringify(["first paid result survives"]));
  assert.match(context.browserAsrResultWarning(preserved)?.message || "", /429|Too many requests/);
  assert.match(retryDiagnostics.retry.error.message, /Too many requests/);
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
  assert.equal(offscreenMessages[0].webFfmpegUrl, "chrome-extension://test-extension/web-ffmpeg/index.html");
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
  assert.equal(
    transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"),
    true,
    "auto 模式必须在外部预检之外保留服务端原生 VAD"
  );
  assert.equal(JSON.stringify(recallSegments.map(segment => segment.text)), JSON.stringify(["clear speech", "quiet low voice"]));
  assert.equal(recallDiagnostics.postprocess.speechActivityFilterApplied, false);
  assert.equal(recallDiagnostics.postprocess.qualityFiltersDisabled, true);
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
  assert.equal(offscreenMessages[0].webFfmpegUrl, "chrome-extension://test-extension/web-ffmpeg/index.html");
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
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(Boolean(failedDiagnostics), true);
  assert.equal(failedDiagnostics.vad.speechIntervals.length, 1);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.stage, "asr_request");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.status, 400);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.rawPayload.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.matureAsrPlan.request.mode, "external_vad_clip");
  assert.equal(failedDiagnostics.matureAsrPlan.request.mode, "compatible_vad_filter");
  assert.equal(failedDiagnostics.request.fields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(failedDiagnostics.retry.request.fields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(failedDiagnostics.retry.matureAsrPlan.request.mode, "compatible_vad_filter");
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
    assert.equal(response.audioFiles[0].cacheName, "fuguang-web-ffmpeg-audio");
    assert.equal(response.audioFiles[0].cacheUrl, cacheUrl);
    assert.equal(Object.hasOwn(response.audioFiles[0], "base64"), false);
    assert.equal(new Uint8Array(await (await cache.match(response.audioFiles[0].cacheUrl)).arrayBuffer()).join(","), "5,6,7");
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

{
  const tabId = 990;
  seedPage(tabId, {
    title: "Untrusted page candidate",
    url: "https://attacker.example.test/watch",
    duration: 30
  });
  context.addPageMediaCandidate(tabId, {
    url: "http://192.168.1.9/private.mp4",
    kind: "video",
    ext: "mp4",
    source: "response",
    href: "https://attacker.example.test/watch"
  }, 0);
  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "response", "页面桥接候选必须保留原版来源语义");
  const resolved = context.resolvePreloadCandidateForStart(context.getState(tabId), candidate);
  assert.equal(resolved.url, candidate.url, "page-discovered media must remain directly extractable");
  assert.equal(Object.hasOwn(resolved, "executionAllowed"), false);
}

{
  const tabId = 991;
  const url = "http://192.168.1.10/media.mp4";
  seedPage(tabId, {
    title: "Observed private media",
    url: "http://192.168.1.10/player",
    duration: 30
  });
  webRequestBeforeSendHeadersListeners[0]({
    tabId,
    url,
    requestId: "private-media-request",
    requestHeaders: [{ name: "Accept", value: "video/*" }],
    type: "media",
    statusCode: 206
  });
  let [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "request-headers");
  assert.equal(candidate.responseStatus, undefined, "request headers must not attest a future response status");
  assert.equal(context.resolvePreloadCandidateForStart(context.getState(tabId), candidate).url, url);

  webRequestHeadersReceivedListeners[0]({
    tabId,
    url,
    requestId: "private-media-request",
    frameId: 0,
    documentId: "document-private-media",
    parentFrameId: -1,
    ip: "192.168.1.10",
    responseHeaders: [
      { name: "Content-Type", value: "video/mp4" },
      { name: "Content-Range", value: "bytes 0-1023/4096" }
    ],
    type: "media",
    statusCode: 206
  });
  [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "response");
  const resolved = context.resolvePreloadCandidateForStart(context.getState(tabId), candidate);
  assert.equal(resolved.url, url);
  assert.equal(Object.hasOwn(resolved, "executionAllowed"), false);
}

{
  const tabId = 992;
  const url = "http://192.168.1.11/missing.mp4";
  seedPage(tabId, {
    title: "Failed private media",
    url: "http://192.168.1.11/player",
    duration: 30
  });
  webRequestHeadersReceivedListeners[0]({
    tabId,
    url,
    requestId: "failed-private-media-request",
    responseHeaders: [{ name: "Content-Type", value: "video/mp4" }],
    type: "media",
    statusCode: 404
  });
  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(context.resolvePreloadCandidateForStart(context.getState(tabId), candidate).url, url);
}

{
  const tabId = 993;
  const url = "http://192.168.1.12/late.mp4";
  seedPage(tabId, { url: "https://example.test/new-page", duration: 30 });
  webRequestHeadersReceivedListeners[0]({
    tabId,
    url,
    requestId: "late-old-document-response",
    frameId: 0,
    documentId: "document-old",
    responseHeaders: [{ name: "Content-Type", value: "video/mp4" }],
    type: "media",
    statusCode: 206,
    ip: "192.168.1.12"
  });
  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(context.resolvePreloadCandidateForStart(context.getState(tabId), candidate).url, url);
}

{
  const tabId = 994;
  seedPage(tabId, { url: "https://example.test/new-document", duration: 30 });
  await context.handleMessage({
    type: "FUGUANG_PAGE_MEDIA_FOUND",
    media: {
      url: "https://cdn.example.test/no-document.mp4",
      source: "media-element",
      kind: "video",
      ext: "mp4"
    }
  }, {
    tab: { id: tabId },
    frameId: 0
  });
  await context.handleMessage({
    type: "FUGUANG_PAGE_CONTEXT_FOUND",
    context: { href: "https://example.test/old-document", duration: 30 }
  }, {
    tab: { id: tabId },
    frameId: 0,
    documentId: "document-old"
  });
  assert.equal(context.getState(tabId).context.href, "https://example.test/old-document");
  assert.equal(
    context.getDisplayCandidates(tabId).some(candidate => candidate.url === "https://cdn.example.test/no-document.mp4"),
    true,
    "baseline page media messages must remain accepted when documentId is unavailable"
  );

}

{
  const tabId = 996;
  const url = "http://192.168.1.14/nested-frame.mp4";
  seedPage(tabId, { url: "https://example.test/frame-tree", duration: 30 });
  webRequestHeadersReceivedListeners[0]({
    tabId,
    url,
    requestId: "nested-frame-response",
    frameId: 2,
    documentId: "child-old",
    parentFrameId: 1,
    parentDocumentId: "parent-old",
    responseHeaders: [{ name: "Content-Type", value: "video/mp4" }],
    type: "media",
    statusCode: 206,
    ip: "192.168.1.14"
  });
  let [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(context.resolvePreloadCandidateForStart(context.getState(tabId), candidate).url, url);

  await webNavigationCommittedListeners[0]({
    tabId,
    frameId: 1,
    documentId: "parent-new",
    parentFrameId: 0,
    parentDocumentId: "top-current",
    url: "https://example.test/replaced-parent"
  });
  [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(context.resolvePreloadCandidateForStart(context.getState(tabId), candidate).url, url);
}

{
  const recovered = context.recoverBrowserAudioChunk({
    audioCacheRef: "https://fuguang.local/__fuguang_audio_cache/job-recovered-vad/0.mp3",
    audioStart: 0,
    audioEnd: 30,
    audioDuration: 30,
    audioCoreStart: 0,
    audioCoreEnd: 30,
    speechIntervals: [{ start: 12, end: 15 }, { start: 2, end: 5 }],
    speechIntervalsReliable: false
  }, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(recovered.speechIntervals)), [
    { start: 2, end: 5 },
    { start: 12, end: 15 }
  ]);
  assert.equal(recovered.speechIntervalsReliable, false);
  assert.equal(context.shouldSkipBrowserAsrChunk(recovered), false);
}

{
  const sourceRecord = {
    runToken: "run-ledger-v2",
    metadata: { duration: 900 },
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkToTranslationGroup: new Map([[0, 0], [1, 0]]),
    audioChunks: [
      {
        index: 0,
        start: 0,
        end: 30,
        coreStart: 0,
        coreEnd: 30,
        file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-ledger-v2/0.mp3" }
      },
      {
        index: 1,
        start: 30,
        end: 60,
        coreStart: 30,
        coreEnd: 60,
        file: {
          parts: [
            { index: 10, start: 30, end: 45, file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-ledger-v2/1a.mp3" } },
            { index: 11, start: 45, end: 60, file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-ledger-v2/1b.mp3" } }
          ]
        }
      }
    ],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "source" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "translated" }]]]),
    job: {
      id: "job-ledger-v2",
      runToken: "run-ledger-v2",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", duration: 900, asrChunkSeconds: 30 },
      translation: {
        status: "running",
        chunksTotal: 1,
        chunkStatuses: [{ index: 0, stage: "completed", updatedAt: 190 }]
      }
    }
  };
  const ledger = context.FuguangJobContract.createJobLedgerEntry(sourceRecord, {
    pageIdentity: "https://example.test/watch/ledger-v2"
  });
  const entries = context.FuguangJobContract.createChunkLedgerEntries(sourceRecord);
  const recovered = context.recoverBrowserJobRecord(ledger, entries, sourceRecord.modelConfig);

  assert.equal(recovered.job.translation.chunkStatuses.filter(Boolean).length, 1);
  assert.equal(recovered.job.translation.chunksTotal, 1);
  assert.equal(recovered.audioChunks.length, 2);
  assert.equal(recovered.browserAsrChunkToTranslationGroup.get(0), 0);
  assert.equal(recovered.browserAsrChunkToTranslationGroup.get(1), 0);
  assert.equal(recovered.browserTranslationGroups.size, 1);
  assert.equal(recovered.audioChunks[1].file.parts.length, 2);
  assert.deepEqual(
    Array.from(recovered.sourceSegmentsByChunk.get(0), segment => segment.text),
    ["source"]
  );

  const activeLedger = {
    ...ledger,
    status: "running",
    stage: "asr",
    executionRunToken: ledger.runToken,
    executionStartedAt: 150
  };
  const activeRecovered = context.recoverBrowserJobRecord(activeLedger, entries, sourceRecord.modelConfig);
  assert.equal(activeRecovered.job.status, "running");
  assert.equal(activeRecovered.offscreenExecution, true);
  assert.equal(activeRecovered.job.error, "");
}

{
  const sourceRecord = {
    tabId: 611,
    runToken: "run-recover-asr-checkpoint",
    metadata: { duration: 30, pageUrl: "https://example.test/watch/recover-asr" },
    modelConfig: { chunkSeconds: 900, workers: 2 },
    browserAsrChunkToTranslationGroup: new Map([[0, 0]]),
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      coreStart: 0,
      coreEnd: 30,
      asrCompleted: true,
      sourceSegments: [{ start: 1, end: 2, text: "durable source" }],
      file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/recover-asr/0.mp3" }
    }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "durable source" }]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-recover-asr-checkpoint",
      runToken: "run-recover-asr-checkpoint",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", duration: 30, asrChunkSeconds: 30 },
      translation: {
        status: "running",
        chunksTotal: 1,
        chunkStatuses: [{ index: 0, stage: "asr_done", sourceCount: 1, updatedAt: 190 }]
      }
    }
  };
  const ledger = {
    ...context.FuguangJobContract.createJobLedgerEntry(sourceRecord, {
      pageIdentity: sourceRecord.metadata.pageUrl
    }),
    status: "running",
    executionRunToken: sourceRecord.runToken,
    executionStartedAt: 150
  };
  const entries = context.FuguangJobContract.createChunkLedgerEntries(sourceRecord);
  const recovered = context.recoverBrowserJobRecord(ledger, entries, sourceRecord.modelConfig);
  assert.equal(recovered.recoveryBlocked, false);
  assert.equal(recovered.browserTranslationQueue.items.length, 1, "durable asr_done work must be requeued for translation");
  assert.equal(recovered.browserTranslationGroups.get(0).translationQueued, true);
  assert.equal(recovered.browserTranslationQueue.items[0].sourceSegments[0].text, "durable source");

  const ambiguousEntries = entries.map(entry => entry.entryType === "translation-group"
    ? { ...entry, stage: "translation" }
    : entry);
  const ambiguous = context.recoverBrowserJobRecord(ledger, ambiguousEntries, sourceRecord.modelConfig);
  assert.equal(ambiguous.recoveryBlocked, true, "an in-flight paid translation must not be replayed automatically");
  assert.equal(ambiguous.job.status, "interrupted");
  assert.equal(ambiguous.browserTranslationQueue.items.length, 0);
  assert.match(ambiguous.job.error, /避免重复计费/);

  const durableOffscreenEntries = entries.map(entry => entry.entryType === "translation-group"
    ? { ...entry, stage: "translation", translationExecutionMode: "offscreen-durable-v1" }
    : entry);
  const durableOffscreen = context.recoverBrowserJobRecord(ledger, durableOffscreenEntries, sourceRecord.modelConfig);
  assert.equal(durableOffscreen.recoveryBlocked, false, "durable offscreen translation must remain resumable after SW restart");
  assert.equal(durableOffscreen.job.status, "running");
  assert.equal(durableOffscreen.job.translation.chunkStatuses[0].stage, "translation");
  assert.equal(durableOffscreen.job.translation.chunkStatuses[0].translationExecutionMode, "offscreen-durable-v1");

  const asrInflightEntries = entries.map(entry => entry.entryType === "translation-group"
    ? { ...entry, stage: "asr_inflight" }
    : entry.entryType === "audio-chunk"
      ? { ...entry, asrCompleted: false, sourceSegments: [] }
      : entry);
  const asrInflight = context.recoverBrowserJobRecord(ledger, asrInflightEntries, sourceRecord.modelConfig);
  assert.equal(asrInflight.recoveryBlocked, true, "an in-flight paid ASR request must not be replayed automatically");
  assert.equal(asrInflight.job.status, "interrupted");
  assert.equal(asrInflight.browserTranslationQueue.items.length, 0);
  assert.match(asrInflight.job.error, /识别请求期间重启/);

  const durableAsrInflightEntries = asrInflightEntries.map(entry => entry.entryType === "audio-chunk"
    ? { ...entry, asrExecutionMode: "offscreen-durable-v1" }
    : entry);
  const durableAsrInflight = context.recoverBrowserJobRecord(ledger, durableAsrInflightEntries, sourceRecord.modelConfig);
  assert.equal(durableAsrInflight.recoveryBlocked, false, "durable offscreen ASR must remain resumable after SW restart");
  assert.equal(durableAsrInflight.job.status, "running");

  const funSourceRecord = {
    ...sourceRecord,
    runToken: "run-recover-funasr-checkpoint",
    pipeline: "funasr",
    modelConfig: {
      ...sourceRecord.modelConfig,
      targetLanguage: "zh-CN",
      translation: {
        providerType: "openai",
        baseUrl: "https://llm.test/v1",
        model: "test-llm",
        apiKey: "llm-secret",
        unexpectedSecret: "must-not-leave-sw"
      }
    },
    audioChunks: sourceRecord.audioChunks.map(chunk => ({ ...chunk })),
    sourceSegmentsByChunk: new Map(sourceRecord.sourceSegmentsByChunk),
    translatedSegmentsByChunk: new Map(),
    browserAsrChunkToTranslationGroup: new Map(sourceRecord.browserAsrChunkToTranslationGroup),
    job: {
      ...sourceRecord.job,
      id: "job-recover-funasr-checkpoint",
      runToken: "run-recover-funasr-checkpoint",
      pipeline: "funasr",
      translation: {
        ...sourceRecord.job.translation,
        chunkStatuses: sourceRecord.job.translation.chunkStatuses.map(status => ({ ...status }))
      }
    }
  };
  const funLedger = {
    ...context.FuguangJobContract.createJobLedgerEntry(funSourceRecord, {
      pageIdentity: funSourceRecord.metadata.pageUrl
    }),
    status: "running",
    executionRunToken: funSourceRecord.runToken,
    executionStartedAt: 150
  };
  const funEntries = context.FuguangJobContract.createChunkLedgerEntries(funSourceRecord);
  const legacyFunAsrInflightEntries = funEntries.map(entry => entry.entryType === "translation-group"
    ? { ...entry, stage: "asr_inflight", sourceSegments: [] }
    : entry.entryType === "audio-chunk"
      ? { ...entry, asrCompleted: false, sourceSegments: [], asrExecutionMode: "" }
      : entry);
  const legacyFunAsrInflight = context.recoverBrowserJobRecord(funLedger, legacyFunAsrInflightEntries, funSourceRecord.modelConfig);
  assert.equal(legacyFunAsrInflight.recoveryBlocked, true, "legacy FunASR inflight submit must not be retried automatically");
  const durableFunAsrInflightEntries = legacyFunAsrInflightEntries.map(entry => entry.entryType === "audio-chunk"
    ? { ...entry, asrExecutionMode: "offscreen-durable-v1" }
    : entry);
  const durableFunAsrInflight = context.recoverBrowserJobRecord(funLedger, durableFunAsrInflightEntries, funSourceRecord.modelConfig);
  assert.equal(durableFunAsrInflight.recoveryBlocked, false, "durable FunASR inflight submit must resume through the operation ledger");
  assert.equal(durableFunAsrInflight.job.status, "running");
  const funRecovered = context.recoverBrowserJobRecord(funLedger, funEntries, funSourceRecord.modelConfig);
  assert.equal(funRecovered.browserTranslationQueue.items.length, 1, "Fun-ASR recovery must retain pending translation work");
  const originalTranslate = context.translateBrowserSegments;
  const originalAttach = context.attachBrowserJobVttIfReady;
  let translationCalls = 0;
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "恢复译文" }));
  };
  context.attachBrowserJobVttIfReady = async () => {};
  context.funAsrRecoveredRecord = funRecovered;
  vm.runInContext("browserPreloadJobs.set('job-recover-funasr-checkpoint', funAsrRecoveredRecord)", context);
  context.funLedgerForTest = funLedger;
  context.funEntriesForTest = funEntries;
  await vm.runInContext("browserJobStore.putSnapshot({ job: funLedgerForTest, chunks: funEntriesForTest })", context);
  const funClaim = await vm.runInContext("browserJobStore.claimRun('job-recover-funasr-checkpoint', 'run-recover-funasr-checkpoint', { ownerId: 'fun-recovery-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const funFence = {
    executionOwnerId: "fun-recovery-owner",
    executionEpoch: funClaim.job.executionEpoch
  };
  try {
    const prepared = await context.finalizeOffscreenBrowserJob({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence
    });
    assert.equal(prepared.inProgress, true);
    assert.equal(prepared.workPrepared, true);
    assert.equal(translationCalls, 0, "Fun-ASR recovery FINALIZE must not start a paid translation request");
    const work = await context.getOffscreenBrowserJobWork({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence
    });
    assert.deepEqual(JSON.parse(JSON.stringify(work.translations)), [{ index: 0, processing: false }]);
    await vm.runInContext("flushBrowserJobMirror('job-recover-funasr-checkpoint')", context);
    context.funOriginalPutSnapshot = vm.runInContext("browserJobStore.putSnapshot", context);
    context.funOriginalPutSnapshotIfOwned = vm.runInContext("browserJobStore.putSnapshotIfOwned", context);
    context.funPlainPutCalls = 0;
    context.funOwnedSnapshots = [];
    vm.runInContext(`browserJobStore.putSnapshot = async (...args) => {
      funPlainPutCalls += 1;
      return funOriginalPutSnapshot(...args);
    }; browserJobStore.putSnapshotIfOwned = async (snapshot, ownership) => {
      funOwnedSnapshots.push(JSON.parse(JSON.stringify(snapshot)));
      return funOriginalPutSnapshotIfOwned(snapshot, ownership);
    }`, context);
    const input = await context.getOffscreenBrowserJobExecutionInput({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence,
      chunkIndex: 0,
      workType: "translation"
    });
    assert.equal(input.accepted, true);
    assert.equal(input.input.translationConfig.apiKey, "llm-secret");
    assert.equal(Object.hasOwn(input.input.translationConfig, "unexpectedSecret"), false);
    assert.equal(JSON.stringify(context.funOwnedSnapshots).includes("llm-secret"), false);
    assert.equal(context.funOwnedSnapshots.at(-1).chunks.find(chunk => chunk.entryType === "translation-group").translationExecutionMode, "offscreen-durable-v1");
    const progress = await context.reportOffscreenBrowserJobWorkProgress({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence,
      chunkIndex: 0,
      workType: "translation",
      progress: { phase: "batch", batchIndex: 1, batchTotal: 1 }
    });
    assert.equal(progress.accepted, true);
    const processed = await context.commitOffscreenBrowserJobWorkResult({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence,
      chunkIndex: 0,
      workType: "translation",
      result: {
        segments: funRecovered.sourceSegmentsByChunk.get(0).map(segment => ({ ...segment, text: "恢复译文" })),
        failures: [],
        error: null
      }
    });
    assert.equal(processed.accepted, true);
    assert.equal(translationCalls, 0);
    assert.equal(funRecovered.translatedSegmentsByChunk.get(0)[0].text, "恢复译文");
    assert.equal(context.funPlainPutCalls, 0, "fenced input/progress/result commits must not schedule an unfenced mirror");
    const committedSnapshot = context.funOwnedSnapshots.at(-1);
    assert.equal(committedSnapshot.job.translation.translatedSegments, 1);
    assert.equal(committedSnapshot.chunks.find(chunk => chunk.entryType === "translation-group").translatedSegments[0].text, "恢复译文");
    const finalized = await context.finalizeOffscreenBrowserJob({
      jobId: funRecovered.job.id,
      runToken: funRecovered.runToken,
      ...funFence
    });
    assert.equal(finalized.accepted, true);
    assert.equal(funRecovered.job.status, "completed");
  } finally {
    if (context.funOriginalPutSnapshot) {
      vm.runInContext("browserJobStore.putSnapshot = funOriginalPutSnapshot; browserJobStore.putSnapshotIfOwned = funOriginalPutSnapshotIfOwned", context);
    }
    context.translateBrowserSegments = originalTranslate;
    context.attachBrowserJobVttIfReady = originalAttach;
    await vm.runInContext("browserJobStore.deleteJob('job-recover-funasr-checkpoint')", context);
    vm.runInContext("browserPreloadJobs.delete('job-recover-funasr-checkpoint')", context);
    delete context.funAsrRecoveredRecord;
    delete context.funLedgerForTest;
    delete context.funEntriesForTest;
    delete context.funOriginalPutSnapshot;
    delete context.funOriginalPutSnapshotIfOwned;
    delete context.funPlainPutCalls;
    delete context.funOwnedSnapshots;
  }
}

await assert.rejects(
  context.beginBrowserJobAttempt({
    job: { id: "already-running-job", status: "running" }
  }, "retrying"),
  /任务正在运行/
);

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, options = {}) => ({
    ok: true,
    status: 200,
    headers: {},
    body: { cancel: async () => {} },
    json: () => new Promise((_resolve, reject) => {
      options.signal?.addEventListener?.("abort", () => {
        const error = new Error("aborted response body");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })
  });
  try {
    const request = context.requestBrowserAsrTranscription({
      endpoint: "https://asr.example.test/v1/audio/transcriptions",
      timeoutMs: 20,
      asrConfig: { providerType: "openai", apiKey: "test", model: "whisper-1", vadFilter: "off" },
      supportedRequestFields: new Set(),
      effectiveChunk: { file: { mime: "audio/mpeg" }, speechIntervalsReliable: false },
      fileBuffer: new ArrayBuffer(1),
      fileName: "timeout.mp3",
      clipTimestamps: "",
      matureAsrPlan: null
    });
    await assert.rejects(
      Promise.race([
        request,
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("response body timeout was not enforced")), 100))
      ]),
      /ASR 请求超时/
    );
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: name => String(name).toLowerCase() === "retry-after" ? "1" : "" },
      body: { cancel: async () => {} },
      json: async () => ({ error: { message: "rate limited" } })
    };
  };
  try {
    await assert.rejects(
      context.requestBrowserAsrTranscription({
        endpoint: "https://asr.example.test/v1/audio/transcriptions",
        timeoutMs: 200,
        asrConfig: { providerType: "openai", apiKey: "test", model: "whisper-1", vadFilter: "off" },
        supportedRequestFields: new Set(),
        effectiveChunk: { file: { mime: "audio/mpeg" }, speechIntervalsReliable: false },
        fileBuffer: new ArrayBuffer(1),
        fileName: "rate-limited.mp3",
        clipTimestamps: "",
        matureAsrPlan: null
      }),
      /rate limited|429/i
    );
    assert.equal(calls, 1, "an ASR 429 must not automatically resubmit the paid audio request");
  } finally {
    context.fetch = originalFetch;
  }
}

assert.equal(context.shouldRetryBrowserAsrClipRequestError({
  asrStatus: 400,
  message: "clip_timestamps is unsupported",
  asrRequestFields: [["clip_timestamps", "1,2"]]
}, "1,2"), true, "an explicit clip_timestamps compatibility error may use the existing field fallback");
assert.equal(context.shouldRetryBrowserAsrClipRequestError({
  asrStatus: 429,
  message: "rate limited",
  asrRequestFields: [["clip_timestamps", "1,2"]]
}, "1,2"), false, "a rate limit must never be mistaken for a clip_timestamps compatibility error");

{
  const originalFetch = context.fetch;
  let transcriptionCalls = 0;
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
                          vad_filter: { type: "boolean" }
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
    transcriptionCalls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: () => "1" },
      json: async () => ({ error: { message: "rate limited" } })
    };
  };
  try {
    await assert.rejects(
      context.transcribeBrowserAudioChunk(
        {
          index: 0,
          start: 0,
          end: 30,
          duration: 30,
          file: { name: "clip-rate-limit.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
        },
        {
          providerType: "openai",
          baseUrl: "https://clip-rate-limit.example.test/v1",
          model: "whisper-1",
          apiKey: "test",
          vadFilter: "auto"
        }
      ),
      /rate limited|429/i
    );
    assert.equal(transcriptionCalls, 1, "the clip_timestamps fallback must not resubmit a rate-limited paid audio request");
  } finally {
    context.fetch = originalFetch;
  }
}
{
  const originalTranscribeBrowserAudioChunk = context.transcribeBrowserAudioChunk;
  const record = {
    tabId: 1001,
    runToken: "run-stale-operation",
    pipeline: "browser",
    startedAt: Date.now(),
    cancelled: false,
    abortController: new AbortController(),
    candidate: { url: "https://media.example.test/stale-operation.mp3", kind: "audio", ext: "mp3" },
    metadata: { pageUrl: "https://example.test/watch/stale-operation", duration: 30 },
    modelConfig: { asr: {}, translation: {}, targetLanguage: "zh-CN", asrWorkers: 1, workers: 1, chunkSeconds: 900 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-stale-operation",
      runToken: "run-stale-operation",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, duration: 30 },
      translation: { status: "running", chunksTotal: 0, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.enqueueBrowserLogicalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "stale-operation.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
  });
  context.closeAllBrowserTranslationGroups(record);
  let markStarted;
  let releaseTranscription;
  const started = new Promise(resolve => { markStarted = resolve; });
  const transcriptionGate = new Promise(resolve => { releaseTranscription = resolve; });
  context.transcribeBrowserAudioChunk = async () => {
    markStarted();
    await transcriptionGate;
    return [{ start: 1, end: 2, text: "stale source" }];
  };
  context.staleOperationRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-stale-operation', staleOperationRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: staleOperationRecord.job, chunks: [] })", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-stale-operation', 'run-stale-operation', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const firstMessage = {
    jobId: record.job.id,
    runToken: record.runToken,
    executionOwnerId: "owner-a",
    executionEpoch: firstClaim.job.executionEpoch,
    chunkIndex: 0
  };
  try {
    const oldOperation = context.processOffscreenBrowserJobChunk(firstMessage);
    await started;
    await vm.runInContext(`browserJobStore.releaseRun('job-stale-operation', 'run-stale-operation', 'owner-a', Date.now(), ${firstClaim.job.executionEpoch})`, context);
    const takeover = await vm.runInContext("browserJobStore.claimRun('job-stale-operation', 'run-stale-operation', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
    const takeoverWork = await context.getOffscreenBrowserJobWork({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-b",
      executionEpoch: takeover.job.executionEpoch
    });
    releaseTranscription();
    const oldResult = await oldOperation;
    const durable = await vm.runInContext("browserJobStore.getJob('job-stale-operation')", context);
    assert.equal(oldResult.stale, true);
    assert.equal(takeoverWork.interrupted, true, "unsafe same-run takeover must stop for an explicit retry");
    assert.equal(Boolean(record.audioChunks[0].asrCompleted), false, "a fenced operation must discard a late ASR result");
    assert.equal(durable.executionOwnerId, "owner-b");
    assert.equal(durable.status, "interrupted");
  } finally {
    releaseTranscription();
    await vm.runInContext("browserJobStore.deleteJob('job-stale-operation')", context);
    vm.runInContext("browserPreloadJobs.delete('job-stale-operation')", context);
    delete context.staleOperationRecord;
    context.transcribeBrowserAudioChunk = originalTranscribeBrowserAudioChunk;
  }
}

{
  const record = {
    tabId: 998,
    runToken: "run-translation-finalize",
    pipeline: "funasr",
    cancelled: false,
    abortController: new AbortController(),
    audioChunks: [{ index: 0, asrCompleted: true, asrFailed: false, sourceSegments: [] }],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-translation-finalize",
      runToken: "run-translation-finalize",
      pipeline: "funasr",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100 },
      translation: { status: "running", chunksTotal: 1, chunksDone: 0, chunkStatuses: [] }
    }
  };
  context.translationFinalizeRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-translation-finalize', translationFinalizeRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: translationFinalizeRecord.job, chunks: [] })", context);
  const claim = await vm.runInContext("browserJobStore.claimRun('job-translation-finalize', 'run-translation-finalize', { ownerId: 'translation-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  vm.runInContext("offscreenBrowserChunkOperations.set('job-translation-finalize:run-translation-finalize:1:0', { jobId: 'job-translation-finalize', runToken: 'run-translation-finalize', chunkIndex: 0, executionOwnerId: 'translation-owner', executionEpoch: 1, controller: new AbortController(), stale: false })", context);
  try {
    const result = await context.finalizeOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "translation-owner",
      executionEpoch: claim.job.executionEpoch
    });
    assert.equal(result.inProgress, true, "the Service Worker must independently reject finalize while translation is active");
    assert.equal(record.job.status, "running");
  } finally {
    vm.runInContext("offscreenBrowserChunkOperations.delete('job-translation-finalize:run-translation-finalize:1:0')", context);
    await vm.runInContext("browserJobStore.deleteJob('job-translation-finalize')", context);
    vm.runInContext("browserPreloadJobs.delete('job-translation-finalize')", context);
    delete context.translationFinalizeRecord;
  }
}

{
  const record = {
    tabId: 999,
    runToken: "run-fenced-write-race",
    pipeline: "browser",
    cancelled: false,
    abortController: new AbortController(),
    audioChunks: [],
    job: {
      id: "job-fenced-write-race",
      runToken: "run-fenced-write-race",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    }
  };
  context.fencedWriteRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-fenced-write-race', fencedWriteRaceRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: fencedWriteRaceRecord.job, chunks: [] })", context);
  const firstClaim = await vm.runInContext("browserJobStore.claimRun('job-fenced-write-race', 'run-fenced-write-race', { ownerId: 'owner-a', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
  const originalGetJob = await vm.runInContext("browserJobStore.getJob", context);
  context.fencedWriteSwappedOwner = false;
  context.fencedWriteOriginalGetJob = originalGetJob;
  context.fencedWriteFirstEpoch = firstClaim.job.executionEpoch;
  vm.runInContext(`browserJobStore.getJob = async jobId => {
    const snapshot = await fencedWriteOriginalGetJob(jobId);
    if (!fencedWriteSwappedOwner && jobId === 'job-fenced-write-race') {
      fencedWriteSwappedOwner = true;
      await browserJobStore.releaseRun(jobId, 'run-fenced-write-race', 'owner-a', Date.now(), fencedWriteFirstEpoch);
      await browserJobStore.claimRun(jobId, 'run-fenced-write-race', { ownerId: 'owner-b', claimedAt: Date.now(), leaseDurationMs: 30000 });
    }
    return snapshot;
  }`, context);
  try {
    const result = await context.failOffscreenBrowserJob({
      jobId: record.job.id,
      runToken: record.runToken,
      executionOwnerId: "owner-a",
      executionEpoch: firstClaim.job.executionEpoch,
      error: "old owner failure"
    });
    const durable = await originalGetJob(record.job.id);
    assert.equal(result.stale, true, "a takeover between validation and write must fence the old mutation");
    assert.equal(record.job.status, "running");
    assert.equal(durable.status, "running");
    assert.equal(durable.executionOwnerId, "owner-b");
  } finally {
    vm.runInContext("browserJobStore.getJob = fencedWriteOriginalGetJob", context);
    await vm.runInContext("browserJobStore.deleteJob('job-fenced-write-race')", context);
    vm.runInContext("browserPreloadJobs.delete('job-fenced-write-race')", context);
    delete context.fencedWriteRaceRecord;
    delete context.fencedWriteOriginalGetJob;
    delete context.fencedWriteFirstEpoch;
    delete context.fencedWriteSwappedOwner;
  }
}

{
  const record = {
    tabId: 1000,
    runToken: "run-local-handoff",
    pipeline: "browser",
    cancelled: false,
    recoveryBlocked: false,
    abortController: new AbortController(),
    localExecutionLease: {
      ownerId: "local-owner",
      runToken: "run-local-handoff",
      executionEpoch: 1,
      expiresAt: Date.now() - 1,
      timer: null
    },
    audioChunks: [{ index: 0, asrCompleted: false }],
    job: {
      id: "job-local-handoff",
      runToken: "run-local-handoff",
      pipeline: "browser",
      status: "running",
      stage: "asr",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  let offscreenStarts = 0;
  context.startBrowserJobInOffscreen = async () => {
    offscreenStarts += 1;
    return { status: "started", duplicate: false };
  };
  context.localHandoffRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-local-handoff', localHandoffRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: localHandoffRecord.job, chunks: [] })", context);
  await vm.runInContext("browserJobStore.claimRun('job-local-handoff', 'run-local-handoff', { ownerId: 'local-owner', claimedAt: Date.now() - 1000, leaseDurationMs: 10 })", context);
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(offscreenStarts, 0, "automatic recovery must not overlap a still-settling local pipeline");
    assert.notEqual(result.recovered, true);
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await vm.runInContext("browserJobStore.deleteJob('job-local-handoff')", context);
    vm.runInContext("browserPreloadJobs.delete('job-local-handoff')", context);
    delete context.localHandoffRecord;
  }
}

{
  const tabId = 3190;
  const pageUrl = "https://example.test/watch/manual-attachment-race";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-manual-attachment-race",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: "job-manual-attachment-race",
      runToken: "run-manual-attachment-race",
      status: "completed",
      stage: "completed",
      updatedAt: 100,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nautomatic subtitle\n",
        transcript: null
      }
    }
  };
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  let releaseAutomaticEnsure;
  let markAutomaticEnsureStarted;
  const automaticEnsureGate = new Promise(resolve => { releaseAutomaticEnsure = resolve; });
  const automaticEnsureStarted = new Promise(resolve => { markAutomaticEnsureStarted = resolve; });
  let ensureCalls = 0;
  const attachedVtts = [];
  context.ensureSubtitleOverlay = async () => {
    ensureCalls += 1;
    if (ensureCalls === 1) {
      markAutomaticEnsureStarted();
      await automaticEnsureGate;
    }
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachedVtts.push(message.vtt);
    }
    return { ok: true };
  };
  context.manualAttachmentRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-manual-attachment-race', manualAttachmentRaceRecord)", context);
  try {
    const automaticAttach = context.attachBrowserJobVttIfReady(record);
    await automaticEnsureStarted;
    const manualVtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual subtitle\n";
    await context.attachVttText(tabId, manualVtt);
    releaseAutomaticEnsure();
    await automaticAttach;

    assert.deepEqual(attachedVtts, [manualVtt], "a manual subtitle attached while automatic rendering is in flight must win");
    assert.match(context.getState(tabId).manualVttSignature, /^manual:/);
  } finally {
    releaseAutomaticEnsure();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    vm.runInContext("browserPreloadJobs.delete('job-manual-attachment-race')", context);
    delete context.manualAttachmentRaceRecord;
  }
}

{
  const tabId = 3191;
  const pageUrl = "https://example.test/watch/render-snapshot-race";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sharedVtt = [
    "WEBVTT",
    "",
    "00:00:00.000 --> 00:00:02.000",
    "source first",
    "",
    "00:00:03.000 --> 00:00:05.000",
    "translated second",
    ""
  ].join("\n");
  const record = {
    tabId,
    runToken: "run-render-snapshot-race",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: "job-render-snapshot-race",
      runToken: "run-render-snapshot-race",
      status: "running",
      stage: "translation",
      updatedAt: 100,
      translation: {
        vttText: sharedVtt,
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
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  let releaseRunningEnsure;
  let markRunningEnsureStarted;
  const runningEnsureGate = new Promise(resolve => { releaseRunningEnsure = resolve; });
  const runningEnsureStarted = new Promise(resolve => { markRunningEnsureStarted = resolve; });
  let ensureCalls = 0;
  const attachedVtts = [];
  context.ensureSubtitleOverlay = async () => {
    ensureCalls += 1;
    if (ensureCalls === 1) {
      markRunningEnsureStarted();
      await runningEnsureGate;
    }
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachedVtts.push(message.vtt);
    }
    return { ok: true };
  };
  context.renderSnapshotRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-render-snapshot-race', renderSnapshotRaceRecord)", context);
  try {
    const runningAttach = context.attachBrowserJobVttIfReady(record);
    await runningEnsureStarted;
    record.job.status = "completed";
    record.job.stage = "completed_with_warnings";
    record.job.updatedAt = 200;
    await context.attachBrowserJobVttIfReady(record);
    releaseRunningEnsure();
    await runningAttach;

    assert.equal(attachedVtts.length, 1, "an older running render must not overwrite the completed render");
    assert.match(attachedVtts[0], /source first/);
    assert.match(attachedVtts[0], /translated second/);
  } finally {
    releaseRunningEnsure();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    vm.runInContext("browserPreloadJobs.delete('job-render-snapshot-race')", context);
    delete context.renderSnapshotRaceRecord;
  }
}

{
  const record = {
    tabId: 3192,
    runToken: "run-terminal-during-resume",
    pipeline: "browser",
    cancelled: false,
    abortController: new AbortController(),
    audioChunks: [],
    job: {
      id: "job-terminal-during-resume",
      runToken: "run-terminal-during-resume",
      pipeline: "browser",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  context.terminalDuringResumeRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-terminal-during-resume', terminalDuringResumeRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: terminalDuringResumeRecord.job, chunks: [] })", context);
  await vm.runInContext("browserJobStore.claimRun('job-terminal-during-resume', 'run-terminal-during-resume', { ownerId: 'expired-owner', claimedAt: Date.now() - 1000, leaseDurationMs: 10 })", context);
  context.startBrowserJobInOffscreen = async () => {
    const claimed = await vm.runInContext("browserJobStore.getJob('job-terminal-during-resume')", context);
    context.terminalDuringResumeSnapshot = {
      ...claimed,
      status: "completed",
      stage: "completed",
      updatedAt: Date.now(),
      error: "",
      executionOwnerId: "",
      executionLeaseExpiresAt: 0,
      translation: { ...claimed.translation, status: "completed" }
    };
    const stored = await vm.runInContext("browserJobStore.putSnapshot({ job: terminalDuringResumeSnapshot, chunks: [] })", context);
    assert.equal(stored.applied, true);
    return { status: "unavailable", reason: "terminal-job" };
  };
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    const currentStatus = vm.runInContext("browserPreloadJobs.get('job-terminal-during-resume')?.job?.status", context);
    const durable = await vm.runInContext("browserJobStore.getJob('job-terminal-during-resume')", context);
    assert.equal(result.reason, "inactive");
    assert.equal(currentStatus, "completed", "recovery must adopt a terminal state that wins while resume is in flight");
    assert.equal(durable.status, "completed");
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await vm.runInContext("browserJobStore.deleteJob('job-terminal-during-resume')", context);
    vm.runInContext("browserPreloadJobs.delete('job-terminal-during-resume')", context);
    delete context.terminalDuringResumeRecord;
    delete context.terminalDuringResumeSnapshot;
  }
}

{
  const record = {
    tabId: 3193,
    runToken: "run-terminal-reason",
    pipeline: "browser",
    cancelled: false,
    modelConfig: { asrWorkers: 1 },
    job: {
      id: "job-terminal-reason",
      runToken: "run-terminal-reason",
      pipeline: "browser",
      status: "running",
      stage: "translation"
    }
  };
  const originalPostMessage = taskRuntimePort.postMessage;
  taskRuntimePort.postMessage = message => {
    Promise.resolve().then(() => {
      for (const listener of taskRuntimePortListeners) {
        listener({
          type: "FUGUANG_TASK_RUNTIME_ERROR",
          commandId: message.commandId,
          error: "Task run claim was rejected.",
          reason: "terminal-job"
        });
      }
    });
  };
  try {
    const result = await context.startBrowserJobInOffscreen(record, { resumeExisting: true });
    assert.equal(result.status, "unavailable");
    assert.equal(
      result.reason,
      "terminal-job",
      "structured terminal-job reason must survive the Service Worker command boundary"
    );
  } finally {
    taskRuntimePort.postMessage = originalPostMessage;
  }
}

{
  const tabId = 3194;
  seedPage(tabId, { url: "https://example.test/watch/manual-detach-race", duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  let releaseEnsure;
  let markEnsureStarted;
  const ensureGate = new Promise(resolve => { releaseEnsure = resolve; });
  const ensureStarted = new Promise(resolve => { markEnsureStarted = resolve; });
  const attachedVtts = [];
  context.ensureSubtitleOverlay = async () => {
    markEnsureStarted();
    await ensureGate;
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachedVtts.push(message.vtt);
    }
    return { ok: true };
  };
  try {
    const pending = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nstale manual subtitle\n"
    );
    await ensureStarted;
    await context.detachPreloadVtt(tabId);
    releaseEnsure();
    const result = await pending;

    assert.equal(result.stale, true, "an explicit detach must fence an in-flight manual attachment");
    assert.deepEqual(attachedVtts, []);
    assert.equal(context.getState(tabId).manualVttSignature, "");
    assert.equal(context.getState(tabId).attachedVttSignature, "");
  } finally {
    releaseEnsure();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
  }
}

{
  const record = {
    tabId: 3195,
    runToken: "run-lease-takeover-during-resume",
    pipeline: "browser",
    cancelled: false,
    recoveryBlocked: false,
    abortController: new AbortController(),
    audioChunks: [],
    job: {
      id: "job-lease-takeover-during-resume",
      runToken: "run-lease-takeover-during-resume",
      pipeline: "browser",
      status: "running",
      stage: "translation",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    }
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  context.leaseTakeoverDuringResumeRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-lease-takeover-during-resume', leaseTakeoverDuringResumeRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: leaseTakeoverDuringResumeRecord.job, chunks: [] })", context);
  await vm.runInContext("browserJobStore.claimRun('job-lease-takeover-during-resume', 'run-lease-takeover-during-resume', { ownerId: 'expired-owner', claimedAt: Date.now() - 1000, leaseDurationMs: 10 })", context);
  context.startBrowserJobInOffscreen = async () => {
    const takeover = await vm.runInContext("browserJobStore.claimRun('job-lease-takeover-during-resume', 'run-lease-takeover-during-resume', { ownerId: 'new-owner', claimedAt: Date.now(), leaseDurationMs: 30000 })", context);
    assert.equal(takeover.applied, true);
    return { status: "unavailable", reason: "injected-late-error" };
  };
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    const durable = await vm.runInContext("browserJobStore.getJob('job-lease-takeover-during-resume')", context);
    assert.equal(result.reason, "lease-active");
    assert.equal(record.job.status, "running", "a newly leased run must not be interrupted by the stale recovery attempt");
    assert.equal(durable.status, "running");
    assert.equal(durable.executionOwnerId, "new-owner");
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    await vm.runInContext("browserJobStore.deleteJob('job-lease-takeover-during-resume')", context);
    vm.runInContext("browserPreloadJobs.delete('job-lease-takeover-during-resume')", context);
    delete context.leaseTakeoverDuringResumeRecord;
  }
}


{
  const tabId = 3196;
  seedPage(tabId, { url: "https://example.test/watch/manual-send-detach-race", duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let releaseManualSend;
  let markManualSendStarted;
  const manualSendGate = new Promise(resolve => { releaseManualSend = resolve; });
  const manualSendStarted = new Promise(resolve => { markManualSendStarted = resolve; });
  let latestPageGeneration = 0;
  const attachedVtts = [];
  context.ensureSubtitleOverlay = async () => {};
  context.broadcastMessageToFrames = async (_tabId, message) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      latestPageGeneration = Math.max(latestPageGeneration, Number(message.preloadGeneration || 0));
    }
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    markManualSendStarted();
    await manualSendGate;
    const generation = Number(message.preloadGeneration || 0);
    if (!generation || generation >= latestPageGeneration) {
      attachedVtts.push(message.vtt);
      return { ok: true };
    }
    return { ok: false, stale: true };
  };
  try {
    const pending = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nstale after detach\n",
      { origin: "user-override" }
    );
    await manualSendStarted;
    await context.detachPreloadVtt(tabId);
    releaseManualSend();
    const result = await pending;

    assert.equal(result.stale, true);
    assert.deepEqual(
      attachedVtts,
      [],
      "a detach barrier that wins while the final frame send is pending must prevent the old manual subtitle from reappearing"
    );
  } finally {
    releaseManualSend();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
  }
}

{
  const record = {
    tabId: 3197,
    runToken: "run-durable-read-error-recovery",
    pipeline: "browser",
    cancelled: false,
    cancelRequested: false,
    recoveryBlocked: false,
    staleOffscreenOperationDetected: true,
    abortController: new AbortController(),
    audioChunks: [],
    lastCommittedJob: {
      id: "job-durable-read-error-recovery",
      runToken: "run-durable-read-error-recovery",
      pipeline: "browser",
      status: "running",
      stage: "translation",
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    },
    job: {
      id: "job-durable-read-error-recovery",
      runToken: "run-durable-read-error-recovery",
      pipeline: "browser",
      status: "completed",
      stage: "completed",
      extract: { status: "completed" },
      translation: { status: "completed", chunkStatuses: [] }
    }
  };
  const durable = {
    ...record.lastCommittedJob,
    executionOwnerId: "expired-owner",
    executionEpoch: 1,
    executionLeaseExpiresAt: Date.now() - 1000
  };
  const originalStartBrowserJobInOffscreen = context.startBrowserJobInOffscreen;
  const originalGetJob = await vm.runInContext("browserJobStore.getJob", context);
  const originalAlarmCreate = chrome.alarms.create;
  const createdAlarms = [];
  context.durableReadErrorRecoveryRecord = record;
  context.durableReadErrorRecoverySnapshot = durable;
  context.durableReadErrorOriginalGetJob = originalGetJob;
  context.durableReads = 0;
  vm.runInContext("browserPreloadJobs.set('job-durable-read-error-recovery', durableReadErrorRecoveryRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: durableReadErrorRecoverySnapshot, chunks: [] })", context);
  vm.runInContext(`browserJobStore.getJob = async jobId => {
    durableReads += 1;
    if (durableReads === 2) {
      throw new Error("injected durable read error");
    }
    return durableReadErrorOriginalGetJob(jobId);
  }`, context);
  context.startBrowserJobInOffscreen = async () => ({ status: "unavailable", reason: "injected-runtime-error" });
  chrome.alarms.create = async (name, options) => {
    createdAlarms.push({ name, options });
  };
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(result.recovered, false);
    assert.equal(
      createdAlarms.some(alarm => alarm.name.includes(record.job.id)),
      true,
      "a transient second durable read failure must reschedule recovery from the known durable running state"
    );
  } finally {
    context.startBrowserJobInOffscreen = originalStartBrowserJobInOffscreen;
    chrome.alarms.create = originalAlarmCreate;
    vm.runInContext("browserJobStore.getJob = durableReadErrorOriginalGetJob", context);
    await vm.runInContext("browserJobStore.deleteJob('job-durable-read-error-recovery')", context);
    vm.runInContext("browserPreloadJobs.delete('job-durable-read-error-recovery')", context);
    delete context.durableReadErrorRecoveryRecord;
    delete context.durableReadErrorRecoverySnapshot;
    delete context.durableReadErrorOriginalGetJob;
    delete context.durableReads;
  }
}

{
  const tabId = 3198;
  seedPage(tabId, { url: "https://example.test/watch/stale-projection-detach", duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let activeSubtitle = {
    origin: "job-automatic",
    jobId: "job-revision-through-background",
    attachmentRevision: 20,
    vtt: "latest"
  };
  let latestPageGeneration = 0;
  context.ensureSubtitleOverlay = async () => {};
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return [{ ok: false, stale: true }];
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) > 0 &&
      (
        Number(message.attachmentRevision || 0) <= 0 ||
        Number(message.attachmentRevision || 0) < Number(activeSubtitle.attachmentRevision || 0)
      )
    ) {
      return [{ ok: false, stale: true, staleRevision: true }];
    }
    if (message.automaticOnly && activeSubtitle?.origin === "user-override") {
      return [{ ok: true, preservedManual: true }];
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = null;
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) > 0 &&
      (
        Number(message.attachmentRevision || 0) <= 0 ||
        Number(message.attachmentRevision || 0) < Number(activeSubtitle.attachmentRevision || 0)
      )
    ) {
      return { ok: false, stale: true, staleRevision: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  try {
    const result = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nstale projection\n",
      {
        origin: "job-projection",
        jobId: "job-revision-through-background",
        attachmentRevision: 10
      }
    );
    assert.equal(result.stale, true);
    assert.equal(
      activeSubtitle?.attachmentRevision,
      20,
      "a stale sidepanel projection must not remove the newer same-job subtitle before the page can apply its revision fence"
    );
  } finally {
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
  }
}

{
  const record = {
    tabId: 3199,
    runToken: "run-first-durable-read-error",
    pipeline: "browser",
    cancelled: false,
    cancelRequested: false,
    recoveryBlocked: false,
    staleOffscreenOperationDetected: true,
    abortController: new AbortController(),
    audioChunks: [],
    lastCommittedJob: {
      id: "job-first-durable-read-error",
      runToken: "run-first-durable-read-error",
      pipeline: "browser",
      status: "running",
      stage: "translation",
      extract: { status: "completed" },
      translation: { status: "running", chunkStatuses: [] }
    },
    job: {
      id: "job-first-durable-read-error",
      runToken: "run-first-durable-read-error",
      pipeline: "browser",
      status: "completed",
      stage: "completed",
      extract: { status: "completed" },
      translation: { status: "completed", chunkStatuses: [] }
    }
  };
  const durable = {
    ...record.lastCommittedJob,
    executionOwnerId: "expired-owner",
    executionEpoch: 1,
    executionLeaseExpiresAt: Date.now() - 1000
  };
  const originalGetJob = await vm.runInContext("browserJobStore.getJob", context);
  const originalAlarmCreate = chrome.alarms.create;
  const createdAlarms = [];
  context.firstDurableReadErrorRecord = record;
  context.firstDurableReadErrorSnapshot = durable;
  context.firstDurableReadErrorOriginalGetJob = originalGetJob;
  context.firstDurableReads = 0;
  vm.runInContext("browserPreloadJobs.set('job-first-durable-read-error', firstDurableReadErrorRecord)", context);
  await vm.runInContext("browserJobStore.putSnapshot({ job: firstDurableReadErrorSnapshot, chunks: [] })", context);
  vm.runInContext("browserJobStore.getJob = async jobId => { firstDurableReads += 1; if (firstDurableReads === 1) { throw new Error('injected first durable read error'); } return firstDurableReadErrorOriginalGetJob(jobId); }", context);
  chrome.alarms.create = async (name, options) => {
    createdAlarms.push({ name, options });
  };
  try {
    const result = await context.recoverExpiredBrowserJobLease(record.job.id);
    assert.equal(result.reason, "durable-read-error");
    assert.equal(
      createdAlarms.some(alarm => alarm.name.includes(record.job.id)),
      true,
      "a transient first durable read failure must reschedule the one-shot recovery alarm"
    );
  } finally {
    chrome.alarms.create = originalAlarmCreate;
    vm.runInContext("browserJobStore.getJob = firstDurableReadErrorOriginalGetJob", context);
    await vm.runInContext("browserJobStore.deleteJob('job-first-durable-read-error')", context);
    vm.runInContext("browserPreloadJobs.delete('job-first-durable-read-error')", context);
    delete context.firstDurableReadErrorRecord;
    delete context.firstDurableReadErrorSnapshot;
    delete context.firstDurableReadErrorOriginalGetJob;
    delete context.firstDurableReads;
  }
}

{
  const tabId = 3200;
  const pageUrl = "https://example.test/watch/rejected-projection-auto-race";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-rejected-projection-auto-race",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: "job-rejected-projection-auto-race",
      runToken: "run-rejected-projection-auto-race",
      status: "completed",
      stage: "completed",
      updatedAt: 30,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew automatic subtitle\n",
        transcript: null
      }
    }
  };
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let activeSubtitle = {
    origin: "job-automatic",
    jobId: record.job.id,
    attachmentRevision: 20,
    vtt: "previous automatic subtitle"
  };
  let latestPageGeneration = 0;
  let releaseAutomaticSend;
  let markAutomaticSendStarted;
  const automaticSendGate = new Promise(resolve => { releaseAutomaticSend = resolve; });
  const automaticSendStarted = new Promise(resolve => { markAutomaticSendStarted = resolve; });
  context.ensureSubtitleOverlay = async () => {};
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return [{ ok: false, stale: true }];
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) > 0 &&
      Number(message.attachmentRevision || 0) < Number(activeSubtitle.attachmentRevision || 0)
    ) {
      return [{ ok: false, stale: true, staleRevision: true }];
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = null;
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) > 0 &&
      Number(message.attachmentRevision || 0) < Number(activeSubtitle.attachmentRevision || 0)
    ) {
      return { ok: false, stale: true, staleRevision: true };
    }
    markAutomaticSendStarted();
    await automaticSendGate;
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  context.rejectedProjectionAutoRaceRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-rejected-projection-auto-race', rejectedProjectionAutoRaceRecord)", context);
  try {
    const automaticAttach = context.attachBrowserJobVttIfReady(record);
    await automaticSendStarted;
    const staleProjection = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold projection\n",
      {
        origin: "job-projection",
        jobId: record.job.id,
        attachmentRevision: 10
      }
    );
    assert.equal(staleProjection.stale, true);
    releaseAutomaticSend();
    await automaticAttach;
    assert.equal(
      activeSubtitle?.attachmentRevision,
      30,
      "a rejected stale projection must not cause the newly attached automatic subtitle to be detached"
    );
  } finally {
    releaseAutomaticSend();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
    vm.runInContext("browserPreloadJobs.delete('job-rejected-projection-auto-race')", context);
    delete context.rejectedProjectionAutoRaceRecord;
  }
}

{
  const tabId = 3201;
  seedPage(tabId, { url: "https://example.test/watch/user-presentation-origin", duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let attachedMessage = null;
  context.ensureSubtitleOverlay = async () => {};
  context.broadcastMessageToFrames = async () => [{ ok: true }];
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      attachedMessage = message;
    }
    return { ok: true };
  };
  try {
    const result = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nexplicit presentation\n",
      {
        origin: "user-presentation",
        jobId: "job-user-presentation-origin",
        attachmentRevision: 0
      }
    );
    assert.equal(result.attached, true);
    assert.equal(attachedMessage?.origin, "user-presentation");
    assert.equal(
      context.getState(tabId).manualVttSignature,
      "",
      "a one-shot presentation must not permanently suppress later automatic subtitles"
    );
  } finally {
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
  }
}

{
  const tabId = 3202;
  const pageUrl = "https://example.test/watch/presentation-cancels-old-mode";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-presentation-cancels-old-mode",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: "job-presentation-cancels-old-mode",
      runToken: "run-presentation-cancels-old-mode",
      status: "completed",
      stage: "completed",
      updatedAt: 40,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\ntranslated old mode\n",
        transcript: {
          source: [
            { start: 0, end: 2, text: "source selected mode", chunkIndex: 0, segmentIndex: 0 }
          ],
          translated: [
            { start: 0, end: 2, text: "translated old mode", chunkIndex: 0, segmentIndex: 0 }
          ]
        }
      }
    }
  };
  const originalSyncGet = chrome.storage.sync.get;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let displayMode = "translated";
  let activeSubtitle = null;
  let latestPageGeneration = 0;
  let releaseOldAutomaticEnsure;
  let markOldAutomaticEnsureStarted;
  const oldAutomaticEnsureGate = new Promise(resolve => { releaseOldAutomaticEnsure = resolve; });
  const oldAutomaticEnsureStarted = new Promise(resolve => { markOldAutomaticEnsureStarted = resolve; });
  let ensureCalls = 0;
  chrome.storage.sync.get = async defaults => ({ ...defaults, subtitleDisplayMode: displayMode });
  context.ensureSubtitleOverlay = async () => {
    ensureCalls += 1;
    if (ensureCalls === 1) {
      markOldAutomaticEnsureStarted();
      await oldAutomaticEnsureGate;
    }
  };
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return [{ ok: false, stale: true }];
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = null;
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      vtt: message.vtt,
      generation
    };
    return { ok: true };
  };
  context.presentationCancelsOldModeRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-presentation-cancels-old-mode', presentationCancelsOldModeRecord)", context);
  try {
    const oldAutomaticAttach = context.attachBrowserJobVttIfReady(record);
    await oldAutomaticEnsureStarted;
    displayMode = "source";
    const presentation = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource selected mode\n",
      {
        origin: "user-presentation",
        jobId: record.job.id,
        attachmentRevision: 0
      }
    );
    assert.equal(presentation.attached, true);
    releaseOldAutomaticEnsure();
    await oldAutomaticAttach;
    assert.match(
      activeSubtitle?.vtt || "",
      /source selected mode/,
      "a user presentation must cancel an older automatic attachment that already captured the previous display mode"
    );
    assert.doesNotMatch(activeSubtitle?.vtt || "", /translated old mode/);

    await context.attachBrowserJobVttIfReady(record);
    assert.equal(activeSubtitle?.origin, "job-automatic");
    assert.match(
      activeSubtitle?.vtt || "",
      /source selected mode/,
      "an automatic attachment started after the presentation must still run with the new display mode"
    );
  } finally {
    releaseOldAutomaticEnsure();
    chrome.storage.sync.get = originalSyncGet;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
    vm.runInContext("browserPreloadJobs.delete('job-presentation-cancels-old-mode')", context);
    delete context.presentationCancelsOldModeRecord;
  }
}

{
  const tabId = 3203;
  seedPage(tabId, { url: "https://example.test/watch/presentation-priority-race", duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let activeSubtitle = {
    origin: "job-automatic",
    jobId: "job-presentation-priority-race",
    attachmentRevision: 20,
    vtt: "known current subtitle"
  };
  let latestPageGeneration = 0;
  let projectionFrameTouches = 0;
  let releasePresentationAttach;
  let markPresentationAttachStarted;
  const presentationAttachGate = new Promise(resolve => { releasePresentationAttach = resolve; });
  const presentationAttachStarted = new Promise(resolve => { markPresentationAttachStarted = resolve; });
  context.ensureSubtitleOverlay = async () => {
    markPresentationAttachStarted();
    await presentationAttachGate;
  };
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (message.origin === "job-projection") {
      projectionFrameTouches += 1;
      if (
        activeSubtitle &&
        ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
        Number(activeSubtitle.attachmentRevision || 0) > 0 &&
        Number(message.attachmentRevision || 0) <= 0
      ) {
        return [{ ok: false, stale: true, staleRevision: true }];
      }
    }
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    if (message.origin === "job-projection") {
      projectionFrameTouches += 1;
    }
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  try {
    const presentationPromise = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nuser selected source\n",
      {
        origin: "user-presentation",
        jobId: "job-presentation-priority-race",
        attachmentRevision: 0
      }
    );
    await presentationAttachStarted;
    const projection = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nroutine cached projection\n",
      {
        origin: "job-projection",
        jobId: "job-presentation-priority-race",
        attachmentRevision: 0
      }
    );
    assert.equal(projection.stale, true);
    releasePresentationAttach();
    const presentation = await presentationPromise;
    assert.equal(
      presentation.attached,
      true,
      "a routine projection must not preempt an in-flight user presentation"
    );
    assert.equal(projectionFrameTouches, 0, "a lower-priority projection should be rejected before touching page frames");
    assert.equal(activeSubtitle?.origin, "user-presentation");
    assert.match(activeSubtitle?.vtt || "", /user selected source/);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingEpoch, 0);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingOrigin, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingJobId, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingRevision, 0);
  } finally {
    releasePresentationAttach();
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
  }
}

{
  const tabId = 3204;
  const jobId = "job-newer-projection-during-presentation";
  const pageUrl = "https://example.test/watch/newer-projection-during-presentation";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-newer-projection-during-presentation",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: jobId,
      runToken: "run-newer-projection-during-presentation",
      status: "completed",
      stage: "completed",
      updatedAt: 30,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\ntranslated revision 30\n",
        transcript: {
          source: [
            { start: 0, end: 2, text: "source revision 30", chunkIndex: 0, segmentIndex: 0 }
          ],
          translated: [
            { start: 0, end: 2, text: "translated revision 30", chunkIndex: 0, segmentIndex: 0 }
          ]
        }
      }
    }
  };
  const originalSyncGet = chrome.storage.sync.get;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let activeSubtitle = {
    origin: "job-automatic",
    jobId,
    attachmentRevision: 20,
    vtt: "revision 20 translated"
  };
  let latestPageGeneration = 0;
  let releasePresentationAttach;
  let markPresentationAttachStarted;
  const presentationAttachGate = new Promise(resolve => { releasePresentationAttach = resolve; });
  const presentationAttachStarted = new Promise(resolve => { markPresentationAttachStarted = resolve; });
  chrome.storage.sync.get = async defaults => ({ ...defaults, subtitleDisplayMode: "source" });
  context.ensureSubtitleOverlay = async () => {
    markPresentationAttachStarted();
    await presentationAttachGate;
  };
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return [{ ok: false, stale: true }];
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = null;
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  context.newerProjectionRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-newer-projection-during-presentation', newerProjectionRecord)", context);
  try {
    const presentationPromise = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource revision 20\n",
      {
        origin: "user-presentation",
        jobId,
        attachmentRevision: 30
      }
    );
    await presentationAttachStarted;
    const newerProjectionPromise = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource revision 30\n",
      {
        origin: "job-projection",
        jobId,
        attachmentRevision: 30
      }
    );
    await Promise.resolve();
    releasePresentationAttach();
    await Promise.all([presentationPromise, newerProjectionPromise]);
    await Promise.resolve();
    assert.equal(
      activeSubtitle?.attachmentRevision,
      30,
      "new task content with the same revision must not be lost during presentation"
    );
    assert.match(activeSubtitle?.vtt || "", /source revision 30/);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingEpoch, 0);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingOrigin, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingJobId, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingRevision, 0);
    assert.equal(context.getState(tabId).vttTextDeferredProjectionJobId, "");
    assert.equal(context.getState(tabId).vttTextDeferredProjectionRevision, 0);
  } finally {
    releasePresentationAttach();
    chrome.storage.sync.get = originalSyncGet;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
    vm.runInContext("browserPreloadJobs.delete('job-newer-projection-during-presentation')", context);
    delete context.newerProjectionRecord;
  }
}

{
  const tabId = 3205;
  const jobId = "job-intermediate-projection-during-presentation";
  const pageUrl = "https://example.test/watch/intermediate-projection-during-presentation";
  seedPage(tabId, { url: pageUrl, duration: 60 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const record = {
    tabId,
    runToken: "run-intermediate-projection-during-presentation",
    cancelled: false,
    abortController: new AbortController(),
    metadata: { pageUrl },
    job: {
      id: jobId,
      runToken: "run-intermediate-projection-during-presentation",
      status: "completed",
      stage: "completed",
      updatedAt: 40,
      translation: {
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\ntranslated revision 40\n",
        transcript: {
          source: [
            { start: 0, end: 2, text: "source revision 40", chunkIndex: 0, segmentIndex: 0 }
          ],
          translated: [
            { start: 0, end: 2, text: "translated revision 40", chunkIndex: 0, segmentIndex: 0 }
          ]
        }
      }
    }
  };
  const originalSyncGet = chrome.storage.sync.get;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  let activeSubtitle = {
    origin: "job-automatic",
    jobId,
    attachmentRevision: 40,
    vtt: "translated revision 40"
  };
  let latestPageGeneration = 0;
  let releasePresentationAttach;
  let markPresentationAttachStarted;
  const presentationAttachGate = new Promise(resolve => { releasePresentationAttach = resolve; });
  const presentationAttachStarted = new Promise(resolve => { markPresentationAttachStarted = resolve; });
  chrome.storage.sync.get = async defaults => ({ ...defaults, subtitleDisplayMode: "source" });
  context.ensureSubtitleOverlay = async () => {
    markPresentationAttachStarted();
    await presentationAttachGate;
  };
  context.broadcastMessageToFrames = async (_tabId, message) => {
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return [{ ok: false, stale: true }];
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) >
        Number(message.attachmentRevision || 0)
    ) {
      return [{ ok: false, stale: true, staleRevision: true }];
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = null;
    return [{ ok: true }];
  };
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    const generation = Number(message.preloadGeneration || 0);
    if (generation && generation < latestPageGeneration) {
      return { ok: false, stale: true };
    }
    if (
      activeSubtitle &&
      ["job-automatic", "job-projection"].includes(activeSubtitle.origin) &&
      ["job-automatic", "job-projection"].includes(message.origin) &&
      activeSubtitle.jobId === message.jobId &&
      Number(activeSubtitle.attachmentRevision || 0) >
        Number(message.attachmentRevision || 0)
    ) {
      return { ok: false, stale: true, staleRevision: true };
    }
    latestPageGeneration = Math.max(latestPageGeneration, generation);
    activeSubtitle = {
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  context.intermediateProjectionRecord = record;
  vm.runInContext("browserPreloadJobs.set('job-intermediate-projection-during-presentation', intermediateProjectionRecord)", context);
  try {
    const presentationPromise = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource revision 20\n",
      {
        origin: "user-presentation",
        jobId,
        attachmentRevision: 20
      }
    );
    await presentationAttachStarted;
    const intermediateProjection = context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource revision 30\n",
      {
        origin: "job-projection",
        jobId,
        attachmentRevision: 30
      }
    );
    await intermediateProjection;
    releasePresentationAttach();
    await presentationPromise;
    await Promise.resolve();
    assert.equal(
      activeSubtitle?.attachmentRevision,
      40,
      "a stale intermediate projection must not replace or erase the authoritative revision"
    );
    assert.match(activeSubtitle?.vtt || "", /source revision 40/);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingEpoch, 0);
    assert.equal(context.getState(tabId).vttTextAttachmentPendingOrigin, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingJobId, "");
    assert.equal(context.getState(tabId).vttTextAttachmentPendingRevision, 0);
    assert.equal(context.getState(tabId).vttTextDeferredProjectionJobId, "");
    assert.equal(context.getState(tabId).vttTextDeferredProjectionRevision, 0);
  } finally {
    releasePresentationAttach();
    chrome.storage.sync.get = originalSyncGet;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
    vm.runInContext("browserPreloadJobs.delete('job-intermediate-projection-during-presentation')", context);
    delete context.intermediateProjectionRecord;
  }
}

{
  const tabId = 3206;
  const jobId = "job-running-overlay-refresh-continuity";
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  const originalSyncGet = chrome.storage.sync.get;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const originalBroadcastMessageToFrames = context.broadcastMessageToFrames;
  const events = [];
  let rejectReplacement = false;
  let activeSubtitle = null;
  chrome.storage.sync.get = async defaults => ({ ...defaults, subtitleDisplayMode: "translated" });
  context.ensureSubtitleOverlay = async () => {};
  context.sendMessageToMediaFrame = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return {
        ok: true,
        state: {
          currentTime: 1,
          duration: 600,
          subtitleSignature: activeSubtitle?.signature || "",
          subtitleCueCount: activeSubtitle ? 1 : 0,
          subtitleOrigin: activeSubtitle?.origin || "",
          subtitleJobId: activeSubtitle?.jobId || "",
          subtitleRevision: activeSubtitle?.attachmentRevision || 0
        }
      };
    }
    if (message.type !== "FUGUANG_ATTACH_VTT") {
      return { ok: true };
    }
    events.push("attach");
    if (rejectReplacement) {
      return { ok: false, stale: true, staleRevision: true };
    }
    activeSubtitle = {
      signature: message.signature,
      origin: message.origin,
      jobId: message.jobId,
      attachmentRevision: message.attachmentRevision,
      vtt: message.vtt
    };
    return { ok: true };
  };
  context.broadcastMessageToFrames = async (_tabId, message) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      events.push("detach");
      activeSubtitle = null;
    }
    return [{ ok: true }];
  };
  const record = {
    tabId,
    metadata: { pageUrl: state.page.url },
    job: {
      id: jobId,
      status: "running",
      stage: "translation",
      updatedAt: 20,
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nautomatic revision 20\n",
        transcript: {
          source: [{ start: 0, end: 2, text: "source 20", chunkIndex: 0, segmentIndex: 0 }],
          translated: [{ start: 0, end: 2, text: "automatic revision 20", chunkIndex: 0, segmentIndex: 0 }]
        }
      }
    }
  };
  try {
    await context.attachBrowserJobVttIfReady(record);
    events.length = 0;
    await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nprojected revision 20\n",
      { origin: "job-projection", jobId, attachmentRevision: 20 }
    );
    const successfulRefreshEvents = [...events];

    record.job.updatedAt = 30;
    record.job.translation.vttText = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nautomatic revision 30\n";
    record.job.translation.transcript.translated[0].text = "automatic revision 30";
    await context.attachBrowserJobVttIfReady(record);
    const visibleBeforeRejectedRefresh = activeSubtitle?.vtt || "";

    events.length = 0;
    rejectReplacement = true;
    const rejectedRefresh = await context.attachVttText(
      tabId,
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nprojected revision 30\n",
      { origin: "job-projection", jobId, attachmentRevision: 30 }
    );

    assert.equal(rejectedRefresh.stale, true);
    assert.deepEqual(
      {
        successfulRefreshEvents,
        rejectedRefreshEvents: [...events],
        visibleBeforeRejectedRefresh,
        visibleAfterRejectedRefresh: activeSubtitle?.vtt || ""
      },
      {
        successfulRefreshEvents: ["attach"],
        rejectedRefreshEvents: ["attach"],
        visibleBeforeRejectedRefresh: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nautomatic revision 30\n",
        visibleAfterRejectedRefresh: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nautomatic revision 30\n"
      },
      "incremental job subtitle refreshes must replace in place and preserve the visible subtitle if a replacement is rejected"
    );
  } finally {
    chrome.storage.sync.get = originalSyncGet;
    context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    context.broadcastMessageToFrames = originalBroadcastMessageToFrames;
  }
}

{
  const originalGetModelConfig = context.getModelConfig;
  context.getModelConfig = async () => ({
    asr: {
      providerType: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "whisper-1",
      apiKey: "current-asr-key",
      language: "ja"
    },
    translation: {
      providerType: "openai",
      baseUrl: "https://llm.current.test/v1",
      model: "current-llm",
      apiKey: "current-llm-key"
    },
    targetLanguage: "zh-CN",
    asrWorkers: 1,
    workers: 2,
    chunkSeconds: 900,
    executionSpec: {
      asrProfileId: "openai_whisper",
      llmProfileId: "current_llm"
    }
  });
  const presentationRecord = {
    presentationOnly: true,
    recoveryBlocked: false,
    modelConfig: {
      asr: {},
      translation: {},
      targetLanguage: "zh-CN",
      asrWorkers: 1,
      workers: 1,
      chunkSeconds: 900,
      executionSpec: {
        asrProfileId: "openai_whisper",
        llmProfileId: "current_llm"
      }
    },
    job: { translation: {} }
  };
  try {
    await context.refreshBrowserTranslationModelConfig(presentationRecord, {
      refreshAsrLanguage: true
    });
    assert.equal(presentationRecord.modelConfig.asr.model, "whisper-1",
      "an explicit action after presentation-only recovery must restore the current ASR profile");
    assert.equal(presentationRecord.modelConfig.asr.apiKey, "current-asr-key");
    assert.equal(presentationRecord.modelConfig.translation.model, "current-llm");
  } finally {
    context.getModelConfig = originalGetModelConfig;
  }
}

{
  const tabId = 17001;
  const pageUrl = "https://example.test/watch/durable-frame";
  const mediaUrl = "https://media.example.test/durable/master.m3u8?token=short-lived";
  await context.handleMessage({
    type: "FUGUANG_PAGE_MEDIA_FOUND",
    media: { url: mediaUrl, source: "media-element", kind: "hls", href: pageUrl }
  }, {
    tab: { id: tabId },
    frameId: 7,
    documentId: "document-original"
  });
  const capturedState = context.getState(tabId);
  assert.equal(capturedState.mediaDocumentId, "document-original");
  assert.equal(capturedState.candidates[0].documentId, "document-original");

  const lineageKey = context.browserMediaLineageKey({ url: mediaUrl, kind: "hls" }, pageUrl);
  const recovered = context.recoverBrowserJobRecord({
    id: "job-durable-frame",
    runToken: "run-durable-frame",
    pipeline: "browser",
    status: "completed",
    stage: "completed",
    tabId,
    pageIdentity: pageUrl,
    createdAt: 1,
    updatedAt: 2,
    source: {
      identity: "https://media.example.test/durable/master.m3u8",
      kind: "hls",
      ext: "m3u8",
      frameId: 7,
      documentId: "document-original",
      lineageKey
    },
    extract: {},
    translation: {}
  }, [], null, { presentationOnly: true });
  assert.deepEqual(JSON.parse(JSON.stringify(recovered.presentationBinding)), {
    frameId: 7,
    documentId: "document-original",
    lineageKey
  });

  const originalTabsSendMessage = chrome.tabs.sendMessage;
  const originalSendMessageToMediaFrame = context.sendMessageToMediaFrame;
  const sentFrames = [];
  chrome.tabs.sendMessage = async (_id, _message, options = {}) => {
    sentFrames.push({ frameId: options.frameId, documentId: options.documentId || "" });
    return { ok: true };
  };
  try {
    webNavigationFrames.set(`${tabId}:7`, {
      frameId: 7,
      documentId: "document-original",
      url: pageUrl
    });
    const live = await context.sendBrowserJobVttToBoundMedia({
      tabId,
      recovered: false,
      metadata: { pageUrl },
      presentationBinding: {
        frameId: 7,
        documentId: "document-original",
        lineageKey
      }
    }, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(live.ok, true);
    assert.deepEqual(sentFrames, [{ frameId: 7, documentId: "document-original" }],
      "a live automatic job with a complete binding must use the exact frame and document route");

    sentFrames.length = 0;
    const exact = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(exact.ok, true);
    assert.deepEqual(sentFrames, [{ frameId: 7, documentId: "document-original" }],
      "durable recovery must target the exact original frame/document first");

    sentFrames.length = 0;
    const originalPresentationLineageKey = recovered.presentationBinding.lineageKey;
    recovered.presentationBinding.lineageKey = context.browserMediaLineageKey({
      url: "https://media.example.test/durable/master.m3u8?token=refreshed",
      kind: "hls"
    }, pageUrl);
    chrome.tabs.sendMessage = async (_id, message, options = {}) => {
      sentFrames.push({
        frameId: options.frameId,
        documentId: options.documentId || "",
        allowMediaRebind: message.allowMediaRebind === true
      });
      return message.allowMediaRebind
        ? { ok: true }
        : {
          ok: false,
          mediaBindingRejected: true,
          currentSrc: "https://media.example.test/durable/master.m3u8?token=refreshed"
        };
    };
    const exactLineageRefresh = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(exactLineageRefresh.ok, true,
      "a signed URL refresh in the exact bound document must be re-authorized by durable lineage");
    assert.deepEqual(sentFrames, [
      { frameId: 7, documentId: "document-original", allowMediaRebind: false },
      { frameId: 7, documentId: "document-original", allowMediaRebind: true }
    ]);

    sentFrames.length = 0;
    chrome.tabs.sendMessage = async (_id, message, options = {}) => {
      sentFrames.push({
        frameId: options.frameId,
        documentId: options.documentId || "",
        allowMediaRebind: message.allowMediaRebind === true
      });
      return {
        ok: false,
        mediaBindingRejected: true,
        currentSrc: "https://ads.example.test/pre-roll.m3u8"
      };
    };
    const exactUnrelatedMedia = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(exactUnrelatedMedia.ok, false,
      "an unrelated source in the exact same DOM/document must not inherit automatic subtitles");
    assert.equal(exactUnrelatedMedia.mediaBindingRejected, true);
    assert.deepEqual(sentFrames, [
      { frameId: 7, documentId: "document-original", allowMediaRebind: false }
    ]);
    recovered.presentationBinding.lineageKey = originalPresentationLineageKey;

    const blobRejectionTime = Date.now() + 10000;
    const blobState = context.getState(tabId);
    blobState.candidates = [{
      url: mediaUrl,
      kind: "hls",
      frameId: 7,
      documentId: "document-original",
      pageUrl,
      seenAt: blobRejectionTime + 1
    }];
    sentFrames.length = 0;
    chrome.tabs.sendMessage = async (_id, message, options = {}) => {
      sentFrames.push({
        frameId: options.frameId,
        documentId: options.documentId || "",
        allowMediaRebind: message.allowMediaRebind === true
      });
      return message.allowMediaRebind
        ? { ok: true }
        : {
          ok: false,
          mediaBindingRejected: true,
          currentSrc: "blob:https://example.test/player-rebuilt",
          mediaBindingRejectedAt: blobRejectionTime
        };
    };
    const exactBlobRefresh = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(exactBlobRefresh.ok, true,
      "a rebuilt blob player may rebind only when one recent exact-frame candidate proves the original lineage");
    assert.deepEqual(sentFrames, [
      { frameId: 7, documentId: "document-original", allowMediaRebind: false },
      { frameId: 7, documentId: "document-original", allowMediaRebind: true }
    ]);

    blobState.candidates.push({
      url: "https://ads.example.test/pre-roll.m3u8",
      kind: "hls",
      frameId: 7,
      documentId: "document-original",
      pageUrl,
      seenAt: blobRejectionTime + 2
    });
    sentFrames.length = 0;
    const ambiguousBlobRefresh = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(ambiguousBlobRefresh.ok, false,
      "competing recent lineages in the same frame must not authorize an automatic subtitle rebind");
    assert.deepEqual(sentFrames, [
      { frameId: 7, documentId: "document-original", allowMediaRebind: false }
    ]);

    chrome.tabs.sendMessage = async (_id, _message, options = {}) => {
      sentFrames.push({ frameId: options.frameId, documentId: options.documentId || "" });
      return { ok: true };
    };

    sentFrames.length = 0;
    webNavigationFrames.set(`${tabId}:7`, {
      frameId: 7,
      documentId: "document-replaced",
      url: pageUrl
    });
    const mismatchState = context.getState(tabId);
    mismatchState.mediaFrameId = 9;
    mismatchState.mediaDocumentId = "document-unrelated";
    mismatchState.candidates = [{
      url: "https://ads.example.test/pre-roll.m3u8",
      kind: "hls",
      frameId: 9,
      documentId: "document-unrelated",
      pageUrl
    }];
    webNavigationFrames.set(`${tabId}:9`, {
      frameId: 9,
      documentId: "document-unrelated",
      url: pageUrl
    });
    const rejected = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(rejected.durableBindingRejected, true);
    assert.deepEqual(sentFrames, [], "a replaced document and unrelated player must never receive recovered subtitles");

    mismatchState.mediaFrameId = 8;
    mismatchState.mediaDocumentId = "document-successor";
    mismatchState.candidates = [{
      url: mediaUrl,
      kind: "hls",
      frameId: 8,
      documentId: "document-successor",
      pageUrl
    }];
    webNavigationFrames.set(`${tabId}:8`, {
      frameId: 8,
      documentId: "document-successor",
      url: pageUrl
    });
    const successor = await context.sendBrowserJobVttToBoundMedia(recovered, {
      type: "FUGUANG_ATTACH_VTT",
      vtt: "WEBVTT\n"
    });
    assert.equal(successor.ok, true);
    assert.deepEqual(sentFrames, [{ frameId: 8, documentId: "document-successor" }],
      "only a current trusted frame with the same media lineage may take over");

    let legacyCalls = 0;
    context.sendMessageToMediaFrame = async () => {
      legacyCalls += 1;
      return { ok: true };
    };
    const legacy = await context.sendBrowserJobVttToBoundMedia({
      tabId,
      recovered: true,
      metadata: { pageUrl }
    }, { type: "FUGUANG_ATTACH_VTT", vtt: "WEBVTT\n" });
    assert.equal(legacy.ok, true);
    assert.equal(legacyCalls, 1, "legacy ledgers without a durable document binding must preserve the old route");
  } finally {
    chrome.tabs.sendMessage = originalTabsSendMessage;
    context.sendMessageToMediaFrame = originalSendMessageToMediaFrame;
    webNavigationFrames.delete(`${tabId}:7`);
    webNavigationFrames.delete(`${tabId}:8`);
    webNavigationFrames.delete(`${tabId}:9`);
    vm.runInContext(`tabState.delete(${tabId})`, context);
  }
}

{
  const originalReconcile = context.reconcileMediaHeaderRulesAtStartup;
  const originalAlarmCreate = chrome.alarms.create;
  const originalAlarmClear = chrome.alarms.clear;
  const alarms = [];
  const cleared = [];
  let attempts = 0;
  context.reconcileMediaHeaderRulesAtStartup = async () => {
    attempts += 1;
    return attempts === 1
      ? { deferred: true, failedRuleIds: [250001], metadataPending: false }
      : { deferred: false, failedRuleIds: [], metadataPending: false };
  };
  chrome.alarms.create = async (name, options) => {
    alarms.push({ name, options });
  };
  chrome.alarms.clear = async name => {
    cleared.push(name);
    return true;
  };
  try {
    vm.runInContext("mediaHeaderRuleRecoveryPromise = null; mediaHeaderRuleRecoveryLastResult = null; mediaHeaderRuleRecoveryRetryAttempt = 0", context);
    const first = await context.runMediaHeaderRuleRecovery({ force: true });
    assert.equal(first.deferred, true);
    assert.equal(alarms.length, 1, "a transient startup reconciliation failure must schedule one retry alarm");
    assert.equal(alarms[0].name, "fuguang-media-header-rule-recovery");

    const second = await context.runMediaHeaderRuleRecovery({ force: true });
    assert.equal(second.deferred, false);
    assert.equal(attempts, 2);
    assert.equal(cleared.includes("fuguang-media-header-rule-recovery"), true, "a successful retry must clear the recovery alarm");
  } finally {
    context.reconcileMediaHeaderRulesAtStartup = originalReconcile;
    chrome.alarms.create = originalAlarmCreate;
    chrome.alarms.clear = originalAlarmClear;
  }
}
