import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";
import { FuguangPaidRequestClient } from "../../extension/src/background/paid-request-client.js";
import { createOffscreenBrowserTranslationExecutor } from "../../extension/src/offscreen/browser-translation-executor.js";
import { FuguangPaidRequestRuntime } from "../../extension/src/offscreen/paid-request-runtime.js";

function translationInput(overrides = {}) {
  return {
    jobId: "job-a",
    runToken: "run-a",
    executionOwnerId: "owner-a",
    executionEpoch: 1,
    chunkIndex: 0,
    semanticRequestPath: "translation/job-a/run-a/chunk/0",
    sourceSegments: [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
    targetLanguage: "zh-CN",
    metadata: { title: "test" },
    translationConfig: {
      providerType: "openai",
      baseUrl: "https://provider.example/v1",
      model: "test",
      apiKey: "sk-transient"
    },
    batchWorkers: 2,
    splitWorkers: 2,
    maxConcurrency: 2,
    ...overrides
  };
}

function createMemoryResponseCache() {
  const values = new Map();
  return {
    async put(ref, bodyText) { values.set(ref, String(bodyText)); },
    async get(ref) { return values.has(ref) ? values.get(ref) : null; },
    async delete(ref) { return values.delete(ref); },
    async deleteJob() { values.clear(); return 0; }
  };
}

test("offscreen translation executor returns JSON-safe segments, failures and error", async () => {
  const failureSymbol = Symbol("failure");
  const translated = [{ start: 0, end: 1, text: "你好", chunkIndex: 0, segmentIndex: 0 }];
  Object.defineProperty(translated, failureSymbol, {
    value: [{ source: { start: 2, end: 3, text: "missing", chunkIndex: 0, segmentIndex: 1 }, error: "partial" }]
  });
  let observedOptions = null;
  const execute = createOffscreenBrowserTranslationExecutor({
    paidClient: { createRequestTransport: () => async () => new Response("{}") },
    async translateBrowserSegments(_segments, _config, _language, _metadata, options) {
      observedOptions = options;
      return translated;
    },
    browserTranslationFailures: value => value[failureSymbol] || []
  });
  const result = await execute(translationInput(), { signal: new AbortController().signal });
  assert.deepEqual(result, {
    segments: translated,
    failures: [{ source: { start: 2, end: 3, text: "missing", chunkIndex: 0, segmentIndex: 1 }, error: "partial" }],
    error: null
  });
  assert.equal(observedOptions.semanticRequestPath, "translation/job-a/run-a/chunk/0");
  assert.equal(observedOptions.batchWorkers, 2);
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(Object.getOwnPropertySymbols(result.segments).length, 0);
  assert.equal(JSON.stringify(result).includes("sk-transient"), false);
});

test("offscreen translation cancellation reaches the same paid runtime instance", async () => {
  let cancelCalls = 0;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  const paidRuntime = {
    handleRequest() {
      requestStarted();
      return new Promise(() => {});
    },
    async cancelRequest() {
      cancelCalls += 1;
      return { cancelled: true };
    }
  };
  const paidClient = FuguangPaidRequestClient.create({
    dispatch: envelope => paidRuntime.handleRequest(envelope),
    cancel: envelope => paidRuntime.cancelRequest(envelope)
  });
  const execute = createOffscreenBrowserTranslationExecutor({
    paidClient,
    async translateBrowserSegments(_segments, config, _language, _metadata, options) {
      await options.requestTransport(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: "{}"
      }, {
        provider: "openai",
        operationType: "translation",
        semanticRequestPath: `${options.semanticRequestPath}/batch/0/attempt/0/openai/json`,
        signal: options.signal
      });
      return [];
    },
    browserTranslationFailures: () => []
  });
  const controller = new AbortController();
  const pending = execute(translationInput(), { signal: controller.signal });
  await started;
  controller.abort(new Error("stop"));
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(cancelCalls, 1);
});

test("offscreen translation serializes provider delivery ambiguity and HTTP status", async () => {
  const execute = createOffscreenBrowserTranslationExecutor({
    paidClient: { createRequestTransport: () => async () => new Response("{}") },
    async translateBrowserSegments() {
      const error = new Error("Provider response may have been accepted before delivery failed.");
      error.code = "BROWSER_TRANSLATION_DELIVERY_AMBIGUOUS";
      error.status = 503;
      throw error;
    },
    browserTranslationFailures: () => []
  });
  const result = await execute(translationInput());
  assert.equal(result.error.code, "BROWSER_TRANSLATION_DELIVERY_AMBIGUOUS");
  assert.equal(result.error.status, 503);
  assert.equal(result.error.deliveryAmbiguous, true);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("offscreen translation does not misclassify an unbranded AbortError as user cancellation", async () => {
  const execute = createOffscreenBrowserTranslationExecutor({
    paidClient: { createRequestTransport: () => async () => new Response("{}") },
    async translateBrowserSegments() {
      const error = new Error("provider adapter used an AbortError name");
      error.name = "AbortError";
      error.status = 500;
      throw error;
    },
    browserTranslationFailures: () => []
  });
  const result = await execute(translationInput(), { signal: new AbortController().signal });
  assert.equal(result.error.name, "AbortError");
  assert.equal(result.error.status, 500);
  assert.equal(result.error.deliveryAmbiguous, true);
});

test("offscreen translation replays the same completed paid operation after owner takeover", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: {
      id: "job-a",
      runToken: "run-a",
      status: "running",
      stage: "translation",
      updatedAt: now,
      executionRunToken: "run-a",
      executionOwnerId: "owner-a",
      executionEpoch: 1,
      executionLeaseExpiresAt: now + 60_000
    },
    chunks: []
  });
  let fetchCalls = 0;
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store,
    responseCache: createMemoryResponseCache(),
    async fetchImpl() {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, text: "你好" }] }) } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const execute = createOffscreenBrowserTranslationExecutor({ paidRuntime: runtime });
  const first = await execute(translationInput());
  assert.equal(first.segments[0].text, "你好");

  const takeover = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-b",
    claimedAt: now + 60_001,
    leaseDurationMs: 60_000
  });
  assert.equal(takeover.applied, true);
  const replayed = await execute(translationInput({
    executionOwnerId: "owner-b",
    executionEpoch: takeover.job.executionEpoch
  }));
  assert.equal(replayed.segments[0].text, "你好");
  assert.equal(fetchCalls, 1, "the same durable semantic operation must replay after SW/owner takeover");
});
