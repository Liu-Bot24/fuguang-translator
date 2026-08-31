import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";
import { FuguangPaidRequestClient } from "../../extension/src/background/paid-request-client.js";
import {
  createDurableFunAsrCancellationHandler,
  createOffscreenBrowserFunAsrExecutor
} from "../../extension/src/offscreen/browser-funasr-executor.js";
import { FuguangPaidRequestRuntime } from "../../extension/src/offscreen/paid-request-runtime.js";

function activeJob(now, overrides = {}) {
  return {
    id: "fun-job", runToken: "fun-run", status: "running", stage: "asr",
    executionRunToken: "fun-run", executionOwnerId: "owner-a", executionEpoch: 1,
    executionLeaseExpiresAt: now + 60_000, updatedAt: now, ...overrides
  };
}

function input(overrides = {}) {
  return {
    jobId: "fun-job", runToken: "fun-run", executionOwnerId: "owner-a", executionEpoch: 1,
    chunkIndex: 0, semanticRequestPath: "funasr/fun-job/fun-run/chunk/0",
    chunk: {
      index: 0, start: 0, end: 10, coreStart: 0, coreEnd: 10,
      file: {
        cacheUrl: "https://fuguang.local/__fuguang_audio_cache/fun-job/0000.mp3",
        name: "0000.mp3", mime: "audio/mpeg"
      }
    },
    funAsrConfig: {
      providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
      model: "fun-asr", apiKey: "secret-key", timeoutMs: 120_000
    },
    chunksTotal: 1, duration: 10, labelSpeakers: false,
    ...overrides
  };
}

function memoryResponseCache() {
  const values = new Map();
  return {
    async put(ref, body) { values.set(ref, String(body)); },
    async get(ref) { return values.has(ref) ? values.get(ref) : null; },
    async delete(ref) { return values.delete(ref); },
    async deleteJob() { return 0; },
    values
  };
}

function sha256Ref(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function explicitTaskCancellation(message = "user cancelled") {
  const error = new Error(message);
  error.name = "AbortError";
  error.code = "FUGUANG_TASK_CANCEL_REQUESTED";
  return error;
}

async function harness(fetchImpl, options = {}) {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const responseCache = memoryResponseCache();
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store, responseCache, fetchImpl,
    monitorIntervalMs: 5
  });
  const client = FuguangPaidRequestClient.create({
    dispatch: envelope => runtime.handleRequest(envelope),
    cancel: envelope => runtime.cancelRequest(envelope)
  });
  let uploads = 0;
  const executorRuntime = typeof options.wrapPaidRuntime === "function"
    ? options.wrapPaidRuntime(runtime)
    : runtime;
  const executorOptions = {
    paidRuntime: executorRuntime,
    paidClient: client,
    upload: async (file, _config, uploadOptions) => {
      uploads += 1;
      assert.notEqual(uploadOptions.signal?.aborted, true);
      options.onUpload?.(file);
      return "oss://bucket/fun-job-0.mp3";
    },
    nonPaidRequestTransport: (url, init) => fetchImpl(url, init),
    ...options
  };
  delete executorOptions.useDefaultLoadAudio;
  delete executorOptions.onUpload;
  delete executorOptions.wrapPaidRuntime;
  if (!options.useDefaultLoadAudio) {
    executorOptions.loadAudio = async file => {
      assert.equal(file.cacheUrl, input().chunk.file.cacheUrl);
      return { name: file.name, mime: file.mime, buffer: new Uint8Array([1, 2, 3]).buffer };
    };
  }
  const executor = createOffscreenBrowserFunAsrExecutor(executorOptions);
  return { now, store, runtime, responseCache, client, executor, uploads: () => uploads };
}

test("FunASR submit response survives lost local acknowledgement and owner takeover without a second submit", async () => {
  const calls = { submit: 0, poll: 0, result: 0 };
  const h = await harness(async (url, init) => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      calls.submit += 1;
      assert.equal(init.method, "POST");
      return new Response(JSON.stringify({ output: { task_id: "task-1" } }), {
        status: 200, headers: { "content-type": "application/json", "x-request-id": "submit-1" }
      });
    }
    if (url.endsWith("/tasks/task-1")) {
      calls.poll += 1;
      return new Response(JSON.stringify({
        output: { task_status: "SUCCEEDED", results: [{ transcription_url: "https://result.example/task-1.json" }] }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://result.example/task-1.json") {
      calls.result += 1;
      return new Response(JSON.stringify({ transcripts: [{ sentences: [{ begin_time: 0, end_time: 1000, text: "完成" }] }] }), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`unexpected URL ${url}`);
  });

  const first = await h.executor(input(), {
    afterTaskSubmitted() { throw new Error("local message acknowledgement lost"); }
  });
  assert.equal(first.error.message, "local message acknowledgement lost");
  assert.equal(calls.submit, 1);

  const takeover = await h.store.claimRun("fun-job", "fun-run", {
    ownerId: "owner-b", claimedAt: h.now + 60_001, leaseDurationMs: 60_000
  });
  assert.equal(takeover.applied, true);
  const restored = await h.executor(input({ executionOwnerId: "owner-b", executionEpoch: 2 }));
  assert.equal(restored.segments[0].text, "完成");
  assert.equal(restored.remoteTaskId, "task-1");
  assert.deepEqual(calls, { submit: 1, poll: 1, result: 1 });
  assert.equal(h.uploads(), 1);
  const submitOperation = (await h.store.listOperations("fun-job", "fun-run"))
    .find(operation => operation.operationType === "funasr-submit");
  assert.equal(submitOperation.remoteTaskId, "task-1");
});

test("FunASR unknown submit is delivery ambiguous and never automatically resubmitted", async () => {
  let submits = 0;
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      submits += 1;
      throw new Error("connection reset after upload");
    }
    throw new Error("poll must not run");
  });
  const first = await h.executor(input());
  assert.equal(first.error.deliveryAmbiguous, true);
  const second = await h.executor(input());
  assert.equal(second.error.deliveryAmbiguous, true);
  assert.equal(submits, 1);
  assert.equal(h.uploads(), 1);
  const operation = (await h.store.listOperations("fun-job", "fun-run"))
    .find(item => item.operationType === "funasr-submit");
  assert.equal(operation.state, "unknown");
});

test("FunASR poll transport failure resumes the same remote task without another submit", async () => {
  const calls = { submit: 0, poll: 0, result: 0 };
  const h = await harness(async (url) => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      calls.submit += 1;
      return new Response(JSON.stringify({ output: { task_id: "task-poll-resume" } }), { status: 200 });
    }
    if (url.endsWith("/tasks/task-poll-resume")) {
      calls.poll += 1;
      if (calls.poll === 1) throw new Error("temporary poll network failure");
      return new Response(JSON.stringify({ output: {
        task_status: "SUCCEEDED", results: [{ transcription_url: "https://result.example/poll-resume.json" }]
      } }), { status: 200 });
    }
    if (url === "https://result.example/poll-resume.json") {
      calls.result += 1;
      return new Response(JSON.stringify({ transcripts: [{ sentences: [{ begin_time: 0, end_time: 1000, text: "续跑完成" }] }] }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  });
  const first = await h.executor(input());
  assert.equal(first.resumeRemoteTask, true);
  assert.equal(first.remoteTaskId, "task-poll-resume");
  assert.equal(first.error.asrStage, "funasr_remote_pending");
  const second = await h.executor(input());
  assert.equal(second.segments[0].text, "续跑完成");
  assert.deepEqual(calls, { submit: 1, poll: 2, result: 1 });
});

test("FunASR multipart remote-pending recovery reuses its durable upload before missing source parts are prepared again", async () => {
  const calls = { prepare: 0, submit: 0, poll: 0, result: 0 };
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      calls.submit += 1;
      return new Response(JSON.stringify({ output: { task_id: "task-multipart-resume" } }), { status: 200 });
    }
    if (url.endsWith("/tasks/task-multipart-resume")) {
      calls.poll += 1;
      if (calls.poll === 1) throw new Error("temporary poll failure after multipart upload");
      return new Response(JSON.stringify({ output: {
        task_status: "SUCCEEDED", results: [{ transcription_url: "https://result.example/multipart-resume.json" }]
      } }), { status: 200 });
    }
    if (url === "https://result.example/multipart-resume.json") {
      calls.result += 1;
      return new Response(JSON.stringify({ transcripts: [{ sentences: [
        { begin_time: 0, end_time: 1000, text: "多段续跑完成" }
      ] }] }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  }, {
    async prepareLogicalAudio() {
      calls.prepare += 1;
      if (calls.prepare > 1) throw new Error("original multipart cache parts are unavailable");
      return input().chunk.file;
    }
  });
  const multipartInput = input({
    chunk: {
      index: 0, start: 0, end: 10, coreStart: 0, coreEnd: 10,
      file: {
        name: "logical.mp3", mime: "audio/mpeg",
        parts: [
          { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/fun-job/part-0.mp3", name: "part-0.mp3", mime: "audio/mpeg" } },
          { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/fun-job/part-1.mp3", name: "part-1.mp3", mime: "audio/mpeg" } }
        ]
      }
    }
  });

  const first = await h.executor(multipartInput);
  assert.equal(first.resumeRemoteTask, true);
  assert.equal(first.remoteTaskId, "task-multipart-resume");
  const second = await h.executor(multipartInput);

  assert.equal(second.segments[0].text, "多段续跑完成");
  assert.deepEqual(calls, { prepare: 1, submit: 1, poll: 2, result: 1 });
  assert.equal(h.uploads(), 1);
});

test("FunASR result transport failure resumes the same remote task without another submit", async () => {
  const calls = { submit: 0, poll: 0, result: 0 };
  const h = await harness(async (url) => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      calls.submit += 1;
      return new Response(JSON.stringify({ output: { task_id: "task-result-resume" } }), { status: 200 });
    }
    if (url.endsWith("/tasks/task-result-resume")) {
      calls.poll += 1;
      return new Response(JSON.stringify({ output: {
        task_status: "SUCCEEDED", results: [{ transcription_url: "https://result.example/result-resume.json" }]
      } }), { status: 200 });
    }
    if (url === "https://result.example/result-resume.json") {
      calls.result += 1;
      if (calls.result === 1) throw new Error("temporary result network failure");
      return new Response(JSON.stringify({ transcripts: [{ sentences: [{ begin_time: 0, end_time: 1000, text: "结果续跑完成" }] }] }), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  });
  const first = await h.executor(input());
  assert.equal(first.resumeRemoteTask, true);
  assert.equal(first.remoteTaskId, "task-result-resume");
  const second = await h.executor(input());
  assert.equal(second.segments[0].text, "结果续跑完成");
  assert.deepEqual(calls, { submit: 1, poll: 2, result: 2 });
});

test("released FunASR remote work is durably cancelled at most once after poll failure", async () => {
  const calls = { submit: 0, poll: 0, cancel: 0 };
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      calls.submit += 1;
      return new Response(JSON.stringify({ output: { task_id: "task-stop-after-release" } }), { status: 200 });
    }
    if (url.endsWith("/tasks/task-stop-after-release")) {
      calls.poll += 1;
      throw new Error("temporary poll failure");
    }
    throw new Error(`unexpected URL ${url}`);
  });
  const result = await h.executor(input());
  assert.equal(result.resumeRemoteTask, true);
  await h.store.releaseRun("fun-job", "fun-run", "owner-a", h.now + 1, 1);
  await h.store.markCancelRequested("fun-job", "fun-run", h.now + 2);

  const handler = createDurableFunAsrCancellationHandler({
    jobStore: h.store,
    async cancelRemoteTask(taskId, config, options) {
      calls.cancel += 1;
      assert.equal(taskId, "task-stop-after-release");
      assert.equal(config.apiKey, "secret-key");
      assert.equal(options.signal, undefined, "remote cancellation must not reuse an aborted task signal");
      return { status: "confirmed", confirmed: true, taskId, httpStatus: 200, remoteTaskStatus: "CANCELED" };
    }
  });
  const cancelInput = { jobId: "fun-job", runToken: "fun-run", funAsrConfig: input().funAsrConfig };
  const first = await handler(cancelInput);
  const duplicate = await handler(cancelInput);

  assert.equal(first.outcomes[0].status, "confirmed");
  assert.equal(duplicate.outcomes[0].status, "confirmed");
  assert.deepEqual(calls, { submit: 1, poll: 1, cancel: 1 });
  const operations = await h.store.listOperations("fun-job", "fun-run");
  const cancelOperation = operations.find(operation => operation.operationType === "funasr-cancel");
  assert.equal(cancelOperation.state, "completed");
  assert.equal(cancelOperation.result.status, "confirmed");
});

test("cancel-only recovery parses a verified durable submit response when task-id annotation was lost", async () => {
  let submitCalls = 0;
  let cancelCalls = 0;
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      submitCalls += 1;
      return new Response(JSON.stringify({ output: { task_id: "task-from-durable-body" } }), { status: 200 });
    }
    throw new Error(`no polling or resubmit is allowed: ${url}`);
  }, {
    wrapPaidRuntime(runtime) {
      return {
        ...runtime,
        async annotateOperation() { throw new Error("offscreen exited before task-id annotation"); }
      };
    }
  });
  const interrupted = await h.executor(input());
  assert.equal(interrupted.remoteTaskId, "task-from-durable-body");
  const submitOperation = (await h.store.listOperations("fun-job", "fun-run"))
    .find(operation => operation.operationType === "funasr-submit");
  assert.equal(submitOperation.state, "completed");
  assert.equal(submitOperation.remoteTaskId, "");
  await h.store.releaseRun("fun-job", "fun-run", "owner-a", h.now + 1, 1);
  await h.store.markCancelRequested("fun-job", "fun-run", h.now + 2);

  const handler = createDurableFunAsrCancellationHandler({
    jobStore: h.store,
    paidRuntime: h.runtime,
    async cancelRemoteTask(taskId) {
      cancelCalls += 1;
      assert.equal(taskId, "task-from-durable-body");
      return { status: "confirmed", taskId, httpStatus: 200, remoteTaskStatus: "CANCELED" };
    }
  });
  const result = await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: input().funAsrConfig });
  assert.equal(result.outcomes[0].status, "confirmed");
  assert.equal(submitCalls, 1, "cancel-only recovery must never submit again");
  assert.equal(cancelCalls, 1);
  assert.equal((await h.store.getOperation("fun-job", "fun-run", submitOperation.operationId)).remoteTaskId,
    "task-from-durable-body");
});

test("cancel-only recovery cancels an accepted FunASR submit when its exact response proof is durable", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  const responseCache = memoryResponseCache();
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store,
    responseCache,
    fetchImpl: async () => { throw new Error("cancel recovery must not submit or poll"); }
  });
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 };
  const submit = {
    jobId: "fun-job", runToken: "fun-run", operationId: "accepted-submit-with-proof",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:accepted-proof"
  };
  const bodyText = JSON.stringify({ output: { task_id: "task-from-accepted-proof" } });
  const resultRef = "https://fuguang.local/__fuguang_operation_results/fun-job/fun-run/accepted-submit-with-proof";
  await store.prepareOperation(submit, ownership);
  await store.updateOperation({
    ...submit,
    state: "accepted",
    status: 200,
    resultRef,
    resultBytes: new TextEncoder().encode(bodyText).byteLength,
    resultHash: sha256Ref(bodyText)
  }, ownership);
  await responseCache.put(resultRef, bodyText);
  await store.releaseRun("fun-job", "fun-run", "owner-a", now + 2, 1);
  await store.markCancelRequested("fun-job", "fun-run", now + 3);

  let cancelCalls = 0;
  const handler = createDurableFunAsrCancellationHandler({
    jobStore: store,
    paidRuntime: runtime,
    async cancelRemoteTask(taskId) {
      cancelCalls += 1;
      assert.equal(taskId, "task-from-accepted-proof");
      return { status: "confirmed", taskId, httpStatus: 200, remoteTaskStatus: "CANCELED" };
    }
  });
  const result = await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: input().funAsrConfig });

  assert.equal(cancelCalls, 1);
  assert.equal(result.outcomes[0].status, "confirmed");
  const operations = await store.listOperations("fun-job", "fun-run");
  assert.equal(operations.filter(operation => operation.operationType === "funasr-submit").length, 1);
  assert.equal(operations.find(operation => operation.operationType === "funasr-cancel").result.submitOperationId,
    submit.operationId);
});

test("accepted FunASR submit without exact response proof stays unresolved and is never guessed", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  const responseCache = memoryResponseCache();
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store,
    responseCache,
    fetchImpl: async () => { throw new Error("cancel recovery must not submit or poll"); }
  });
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 };
  const submit = {
    jobId: "fun-job", runToken: "fun-run", operationId: "accepted-submit-without-proof",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:missing-proof"
  };
  await store.prepareOperation(submit, ownership);
  await store.updateOperation({
    ...submit,
    state: "accepted",
    status: 200,
    resultRef: "https://fuguang.local/__fuguang_operation_results/fun-job/fun-run/accepted-submit-without-proof",
    resultBytes: 42,
    resultHash: "sha256:missing"
  }, ownership);
  await store.releaseRun("fun-job", "fun-run", "owner-a", now + 2, 1);
  await store.markCancelRequested("fun-job", "fun-run", now + 3);

  let cancelCalls = 0;
  const handler = createDurableFunAsrCancellationHandler({
    jobStore: store,
    paidRuntime: runtime,
    async cancelRemoteTask() {
      cancelCalls += 1;
      return { status: "confirmed" };
    }
  });
  const result = await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: input().funAsrConfig });

  assert.equal(cancelCalls, 0);
  assert.deepEqual(result.outcomes, []);
  assert.equal((await store.listOperations("fun-job", "fun-run"))
    .filter(operation => operation.operationType === "funasr-cancel").length, 0);
});

test("durable FunASR cancellation preserves not-applied and unknown outcomes without persisting credentials", async () => {
  for (const expectedStatus of ["not-applied", "unknown"]) {
    const now = Date.now();
    const store = FuguangJobStore.createMemory();
    await store.putSnapshot({ job: activeJob(now), chunks: [] });
    const submit = {
      jobId: "fun-job", runToken: "fun-run", operationId: `submit-${expectedStatus}`,
      provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: `sha256:${expectedStatus}`
    };
    await store.prepareOperation(submit, { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 });
    await store.updateOperation({
      ...submit, state: "completed", remoteTaskId: `task-${expectedStatus}`, completedAt: now + 2
    }, { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 2 });
    await store.releaseRun("fun-job", "fun-run", "owner-a", now + 3, 1);
    await store.markCancelRequested("fun-job", "fun-run", now + 4);
    const handler = createDurableFunAsrCancellationHandler({
      jobStore: store,
      async cancelRemoteTask(taskId) {
        if (expectedStatus === "unknown") throw new Error("api_key=opaque-cancel-key transport failed");
        return { status: "not-applied", taskId, httpStatus: 409, remoteTaskStatus: "SUCCEEDED" };
      }
    });
    const result = await handler({
      jobId: "fun-job", runToken: "fun-run",
      funAsrConfig: {
        providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
        model: "fun-asr", apiKey: "opaque-cancel-key"
      }
    });
    assert.equal(result.outcomes[0].status, expectedStatus);
    const cancellation = (await store.listOperations("fun-job", "fun-run"))
      .find(operation => operation.operationType === "funasr-cancel");
    assert.equal(cancellation.state, expectedStatus === "unknown" ? "unknown" : "completed");
    assert.equal(cancellation.result.status, expectedStatus);
    assert.equal(JSON.stringify(cancellation).includes("opaque-cancel-key"), false);
  }
});

test("unknown FunASR cancellation queries the same task before retrying cancel and never resubmits ASR", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const submit = {
    jobId: "fun-job", runToken: "fun-run", operationId: "submit-recheck",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:recheck"
  };
  await store.prepareOperation(submit, { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 });
  await store.updateOperation({ ...submit, state: "completed", remoteTaskId: "task-recheck", completedAt: now + 2 },
    { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 2 });
  await store.releaseRun("fun-job", "fun-run", "owner-a", now + 3, 1);
  await store.markCancelRequested("fun-job", "fun-run", now + 4);
  let cancelCalls = 0;
  let queryCalls = 0;
  const handler = createDurableFunAsrCancellationHandler({
    jobStore: store,
    async cancelRemoteTask(taskId) {
      cancelCalls += 1;
      assert.equal(taskId, "task-recheck");
      return cancelCalls === 1
        ? { status: "unknown", taskId, message: "timeout" }
        : { status: "confirmed", taskId, httpStatus: 200, remoteTaskStatus: "CANCELED" };
    },
    async queryRemoteTask(taskId) {
      queryCalls += 1;
      assert.equal(taskId, "task-recheck");
      return { known: true, taskId, taskStatus: "PENDING", httpStatus: 200 };
    }
  });
  const config = {
    providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
    model: "fun-asr", apiKey: "opaque-key"
  };
  assert.equal((await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config })).outcomes[0].status, "unknown");
  assert.equal((await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config })).outcomes[0].status, "confirmed");
  assert.equal(queryCalls, 1);
  assert.equal(cancelCalls, 2, "the retry only targets the existing task id; it never creates another submit operation");
  const operations = await store.listOperations("fun-job", "fun-run");
  assert.equal(operations.filter(operation => operation.operationType === "funasr-submit").length, 1);
  assert.equal(operations.find(operation => operation.operationType === "funasr-cancel").state, "completed");
});

test("a still-running FunASR task keeps cancellation unresolved so a new submit remains blocked", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const submit = {
    jobId: "fun-job", runToken: "fun-run", operationId: "submit-running-cancel",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:running-cancel"
  };
  await store.prepareOperation(submit, { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 });
  await store.updateOperation({ ...submit, state: "completed", remoteTaskId: "task-running", completedAt: now + 2 },
    { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 2 });
  await store.releaseRun("fun-job", "fun-run", "owner-a", now + 3, 1);
  await store.markCancelRequested("fun-job", "fun-run", now + 4);
  let cancelCalls = 0;
  const handler = createDurableFunAsrCancellationHandler({
    jobStore: store,
    async cancelRemoteTask(taskId) {
      cancelCalls += 1;
      return { status: "unknown", taskId, message: "timeout" };
    },
    async queryRemoteTask(taskId) {
      return { known: true, taskId, taskStatus: "RUNNING", httpStatus: 200 };
    }
  });
  const config = {
    providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
    model: "fun-asr", apiKey: "opaque-key"
  };
  await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config });
  const second = await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config });
  assert.equal(second.outcomes[0].status, "unknown");
  assert.equal(second.outcomes[0].remoteTaskStatus, "RUNNING");
  assert.equal(cancelCalls, 1, "a RUNNING task cannot be cancelled and must not receive another cancel request");
  const cancellation = (await store.listOperations("fun-job", "fun-run"))
    .find(operation => operation.operationType === "funasr-cancel");
  assert.equal(cancellation.state, "unknown");
  assert.equal(cancellation.retryAllowed, true);
});

test("an UNKNOWN query task status keeps FunASR cancellation unresolved", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const submit = {
    jobId: "fun-job", runToken: "fun-run", operationId: "submit-empty-query",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:empty-query"
  };
  await store.prepareOperation(submit, { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 1 });
  await store.updateOperation({ ...submit, state: "completed", remoteTaskId: "task-empty-query", completedAt: now + 2 },
    { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: now + 3 });
  await store.markCancelRequested("fun-job", "fun-run", now + 4);
  let cancelCalls = 0;
  const handler = createDurableFunAsrCancellationHandler({
    jobStore: store,
    async cancelRemoteTask(taskId) {
      cancelCalls += 1;
      return { status: "unknown", taskId, message: "timeout" };
    },
    async queryRemoteTask(taskId) {
      return { known: true, taskId, taskStatus: "UNKNOWN", httpStatus: 200 };
    }
  });
  const config = {
    providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/api/v1",
    model: "fun-asr", apiKey: "opaque-key"
  };
  await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config });
  const second = await handler({ jobId: "fun-job", runToken: "fun-run", funAsrConfig: config });
  assert.equal(second.outcomes[0].status, "unknown");
  assert.equal(cancelCalls, 1, "an ambiguous query must not retry cancellation or unlock a new submit");
  const cancellation = (await store.listOperations("fun-job", "fun-run"))
    .find(operation => operation.operationType === "funasr-cancel");
  assert.equal(cancellation.state, "unknown");
});

test("FunASR cancellation aborts a live submit and leaves its durable state ambiguous", async () => {
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const h = await harness(async (_url, init) => {
    started();
    return await new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  });
  const controller = new AbortController();
  const pending = h.executor(input(), { signal: controller.signal });
  await startedPromise;
  controller.abort(new Error("user cancelled"));
  await assert.rejects(pending, error => error?.name === "AbortError" || controller.signal.aborted);
  const operation = (await h.store.listOperations("fun-job", "fun-run"))
    .find(item => item.operationType === "funasr-submit");
  assert.equal(operation.state, "unknown");
});

test("FunASR cancellation interrupts upload before any submit operation exists", async () => {
  let uploadStarted;
  const uploadStartedPromise = new Promise(resolve => { uploadStarted = resolve; });
  const h = await harness(async () => { throw new Error("submit must not start"); }, {
    async upload(_file, _config, options) {
      uploadStarted();
      return await new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    }
  });
  const controller = new AbortController();
  const pending = h.executor(input(), { signal: controller.signal });
  await uploadStartedPromise;
  controller.abort(new Error("cancel upload"));
  await assert.rejects(pending, error => error?.name === "AbortError" || controller.signal.aborted);
  assert.equal((await h.store.listOperations("fun-job", "fun-run")).some(item => item.operationType === "funasr-submit"), false);
});

test("FunASR cancellation interrupts polling after the durable submit task id exists", async () => {
  let pollStarted;
  const pollStartedPromise = new Promise(resolve => { pollStarted = resolve; });
  const remoteCancelObserved = deferred();
  let remoteCancelCalls = 0;
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      return new Response(JSON.stringify({ output: { task_id: "task-poll-cancel" } }), { status: 200 });
    }
    pollStarted();
    return await new Promise(() => {});
  }, {
    nonPaidRequestTransport: async (url, init) => {
      if (url.endsWith("/tasks/task-poll-cancel/cancel")) {
        remoteCancelCalls += 1;
        assert.notEqual(init.signal, controller.signal, "remote cancellation must own an independent signal");
        remoteCancelObserved.resolve();
        return new Response(JSON.stringify({ output: { task_status: "CANCELED" } }), { status: 200 });
      }
      if (url.endsWith("/tasks/task-poll-cancel")) {
        pollStarted();
        return await new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        });
      }
      throw new Error("result fetch must not start");
    }
  });
  const controller = new AbortController();
  const pending = h.executor(input(), { signal: controller.signal });
  await pollStartedPromise;
  await h.store.markCancelRequested("fun-job", "fun-run", h.now + 1);
  controller.abort(explicitTaskCancellation("cancel poll"));
  await assert.rejects(pending, error => error?.name === "AbortError" || controller.signal.aborted);
  await remoteCancelObserved.promise;
  assert.equal(remoteCancelCalls, 1);
  const submit = (await h.store.listOperations("fun-job", "fun-run")).find(item => item.operationType === "funasr-submit");
  assert.equal(submit.state, "completed");
  assert.equal(submit.remoteTaskId, "task-poll-cancel");
});

test("an unbranded executor abort does not cancel a durable FunASR remote task", async () => {
  const pollStarted = deferred();
  let remoteCancelCalls = 0;
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      return new Response(JSON.stringify({ output: { task_id: "task-fenced-not-user-cancel" } }), { status: 200 });
    }
    throw new Error(`unexpected transport: ${url}`);
  }, {
    nonPaidRequestTransport: async (url, init) => {
      if (url.endsWith("/tasks/task-fenced-not-user-cancel/cancel")) {
        remoteCancelCalls += 1;
        return new Response(JSON.stringify({ output: { task_status: "CANCELED" } }), { status: 200 });
      }
      if (url.endsWith("/tasks/task-fenced-not-user-cancel")) {
        pollStarted.resolve();
        return await new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        });
      }
      throw new Error(`unexpected URL ${url}`);
    }
  });
  const controller = new AbortController();
  const pending = h.executor(input(), { signal: controller.signal });
  await pollStarted.promise;
  const leaseLoss = new Error("execution lease was replaced");
  leaseLoss.name = "AbortError";
  controller.abort(leaseLoss);
  await assert.rejects(pending, error => error?.name === "AbortError");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(remoteCancelCalls, 0);
  assert.equal((await h.store.listOperations("fun-job", "fun-run")).some(operation => operation.operationType === "funasr-cancel"), false);
});

test("FunASR registers remote cancellation before durable annotation and never blocks local abort on its acknowledgement", async () => {
  const annotationEntered = deferred();
  const releaseAnnotation = deferred();
  const remoteCancelEntered = deferred();
  const releaseRemoteCancel = deferred();
  const outcomes = [];
  const cancelCalls = [];
  const h = await harness(async url => {
    if (url.endsWith("/services/audio/asr/transcription")) {
      return new Response(JSON.stringify({ output: { task_id: "task-annotation-race" } }), { status: 200 });
    }
    throw new Error(`poll must not start: ${url}`);
  }, {
    wrapPaidRuntime(runtime) {
      return {
        ...runtime,
        async annotateOperation(args) {
          annotationEntered.resolve();
          await releaseAnnotation.promise;
          return await runtime.annotateOperation(args);
        }
      };
    },
    cancelRemoteTask(taskId, config, options) {
      cancelCalls.push({ taskId, config, options });
      remoteCancelEntered.resolve();
      return releaseRemoteCancel.promise;
    },
    remoteCancelTimeoutMs: 75
  });
  const controller = new AbortController();
  const pending = h.executor(input(), {
    signal: controller.signal,
    onRemoteCancelOutcome(outcome) { outcomes.push(outcome); }
  });
  await annotationEntered.promise;
  await h.store.markCancelRequested("fun-job", "fun-run", h.now + 1);
  controller.abort(explicitTaskCancellation("cancel during annotation"));
  await remoteCancelEntered.promise;

  const localError = await Promise.race([
    pending.then(
      () => { throw new Error("local cancellation unexpectedly resolved"); },
      error => error
    ),
    new Promise((_, reject) => setTimeout(() => reject(new Error("local cancellation waited for remote acknowledgement")), 100))
  ]);
  assert.equal(localError.name, "AbortError");
  assert.equal(cancelCalls.length, 1);
  assert.equal(cancelCalls[0].taskId, "task-annotation-race");
  assert.equal(cancelCalls[0].config.apiKey, "secret-key");
  assert.equal(cancelCalls[0].options.timeoutMs, 75);
  assert.equal(cancelCalls[0].options.signal, undefined, "remote cancellation must not inherit the aborted user signal");
  assert.deepEqual(outcomes, [], "an unresolved remote acknowledgement must not be reported as confirmed");

  releaseRemoteCancel.resolve({
    status: "not-applied", confirmed: false, taskId: "task-annotation-race", httpStatus: 409,
    remoteTaskStatus: "RUNNING"
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "not-applied");
  assert.equal(outcomes[0].confirmed, false);
  releaseAnnotation.resolve();
});

test("FunASR execution input rejects binary payloads and external cache URLs before upload", async () => {
  const h = await harness(async () => { throw new Error("must not fetch"); });
  const binary = input();
  binary.chunk.file.buffer = new Uint8Array([1, 2, 3]);
  await assert.rejects(h.executor(binary), /JSON-safe/);
  const external = input();
  external.chunk.file.cacheUrl = "https://example.com/audio.mp3";
  await assert.rejects(h.executor(external), /non-internal/);
  assert.equal(h.uploads(), 0);
});

test("FunASR default loader reads the internal audio cache reference inside offscreen", async () => {
  const originalCaches = globalThis.caches;
  const cacheRef = input().chunk.file.cacheUrl;
  globalThis.caches = {
    async open(name) {
      assert.equal(name, "fuguang-web-ffmpeg-audio");
      return { async match(ref) { return ref === cacheRef ? new Response(new Uint8Array([7, 8, 9])) : null; } };
    }
  };
  try {
    let uploadedBytes = [];
    const h = await harness(async url => {
      if (url.endsWith("/services/audio/asr/transcription")) {
        return new Response(JSON.stringify({ output: { task_id: "task-cache" } }), { status: 200 });
      }
      if (url.endsWith("/tasks/task-cache")) {
        return new Response(JSON.stringify({ output: {
          task_status: "SUCCEEDED", results: [{ transcription_url: "https://result.example/cache.json" }]
        } }), { status: 200 });
      }
      return new Response(JSON.stringify({ transcripts: [] }), { status: 200 });
    }, {
      useDefaultLoadAudio: true,
      onUpload(file) { uploadedBytes = [...new Uint8Array(file.buffer)]; }
    });
    const result = await h.executor(input());
    assert.deepEqual(uploadedBytes, [7, 8, 9]);
    assert.deepEqual(result.segments, []);
  } finally {
    globalThis.caches = originalCaches;
  }
});
