import assert from "node:assert/strict";
import test from "node:test";

import { createOffscreenTaskExecutor } from "../../extension/src/offscreen/task-runtime-executor.js";
import { createOffscreenBrowserAsrExecutor } from "../../extension/src/offscreen/browser-asr-executor.js";
import { FuguangBrowserAsrWorkflow } from "../../extension/src/background/browser-asr-workflow.js";
import { FuguangTaskRuntimeProtocol } from "../../extension/src/shared/task-runtime-protocol.js";

async function waitForCondition(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function containsBinaryValue(value, seen = new Set()) {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
      (typeof Blob !== "undefined" && value instanceof Blob) ||
      (typeof FormData !== "undefined" && value instanceof FormData)) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  return Object.values(value).some(item => containsBinaryValue(item, seen));
}

test("offscreen executor owns the durable chunk loop and finalization", async () => {
  const sent = [];
  const completed = new Set([0]);
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: true,
          chunks: [0, 1, 2].map(index => ({ index, asrCompleted: completed.has(index) }))
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        completed.add(message.chunkIndex);
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({ pipeline: "funasr" }, {
    job: { id: "job-a", runToken: "run-a", pipeline: "funasr" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    chunks: [
      { entryType: "translation-group", index: 0 },
      { entryType: "audio-chunk", index: 0, asrCompleted: true },
      { entryType: "audio-chunk", index: 1, asrCompleted: false },
      { entryType: "audio-chunk", index: 2, asrCompleted: false }
    ],
    signal: new AbortController().signal
  });
  assert.equal(sent[0].type, FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK);
  assert.equal(sent.at(-1).type, FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB);
  assert.deepEqual(
    sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).map(message => message.chunkIndex),
    [1, 2]
  );
  assert.equal(sent.every(message => message.executionOwnerId === "offscreen-a" && message.executionEpoch === 1), true);
});

test("offscreen executor never resends a paid chunk after an ambiguous worker restart", async () => {
  const sent = [];
  let attempts = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    maxAttempts: 3,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK && attempts++ === 0) {
        throw new Error("worker restarted");
      }
      return { ok: true, accepted: true };
    }
  });
  await assert.rejects(() => execute({ pipeline: "funasr" }, {
    job: { id: "job-a", runToken: "run-a", pipeline: "funasr" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    chunks: [{ entryType: "audio-chunk", index: 0 }],
    signal: new AbortController().signal
  }), /worker restarted/);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 1);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB).length, 0);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB).length, 1);
});

test("offscreen executor preserves an interrupted FAIL_JOB acknowledgement", async () => {
  const sent = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        throw new Error("worker restarted");
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB) {
        return {
          ok: true,
          accepted: false,
          interrupted: true,
          terminal: true,
          error: "任务已中断，避免重复计费。"
        };
      }
      return { ok: true, accepted: true };
    }
  });
  const result = await execute({ pipeline: "funasr" }, {
    job: { id: "job-interrupted-worker", runToken: "run-interrupted-worker", pipeline: "funasr" },
    executionOwnerId: "offscreen-interrupted-worker",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  assert.equal(result.interrupted, true);
  assert.equal(result.terminal, true);
  assert.match(result.error, /避免重复计费/);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 1);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB).length, 1);
});

test("offscreen executor accepts a terminal job carried by FAIL_JOB", async () => {
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        throw new Error("worker unavailable");
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB) {
        return { ok: true, accepted: true, job: { status: "failed", error: "worker unavailable" } };
      }
      return { ok: true };
    }
  });
  const result = await execute({ pipeline: "funasr" }, {
    job: { id: "job-terminal-failure", runToken: "run-terminal-failure", pipeline: "funasr" },
    executionOwnerId: "offscreen-terminal-failure",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  assert.equal(result.job.status, "failed");
});

test("offscreen executor stops for explicit retry after a retryable chunk result", async () => {
  const sent = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        return { ok: true, stale: true, retryable: true, reason: "owned-write-error" };
      }
      return { ok: true, accepted: true };
    }
  });
  const result = await execute({ pipeline: "funasr" }, {
    job: { id: "job-retryable-chunk", runToken: "run-retryable-chunk", pipeline: "funasr" },
    executionOwnerId: "offscreen-retryable",
    executionEpoch: 1,
    chunks: [{ entryType: "audio-chunk", index: 0 }],
    signal: new AbortController().signal
  });
  assert.equal(result.interrupted, true);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 1);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB).length, 0);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB).length, 0);
});

test("offscreen executor starts a newly extracted Fun-ASR chunk while the first long chunk is still running", async () => {
  const sent = [];
  const completed = new Set();
  let releaseProcesses;
  let signalBothStarted;
  const bothStarted = new Promise(resolve => {
    signalBothStarted = resolve;
  });
  const processGate = new Promise(resolve => {
    releaseProcesses = resolve;
  });
  const started = new Set();
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 1,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: started.size >= 2,
          chunks: started.size === 0
            ? [{ index: 0, asrCompleted: false }]
            : [
                { index: 0, asrCompleted: completed.has(0), processing: started.has(0) && !completed.has(0) },
                { index: 1, asrCompleted: completed.has(1), processing: started.has(1) && !completed.has(1) }
              ]
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        started.add(message.chunkIndex);
        if (started.size === 2) {
          signalBothStarted();
        }
        await processGate;
        completed.add(message.chunkIndex);
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr", asrWorkers: 2 }, {
    job: { id: "job-dynamic-funasr", runToken: "run-dynamic-funasr", pipeline: "funasr" },
    executionOwnerId: "offscreen-dynamic-funasr",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  await Promise.race([
    bothStarted,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("the second Fun-ASR chunk did not start concurrently")), 250))
  ]);
  assert.deepEqual([...started].sort(), [0, 1]);
  assert.equal(completed.size, 0, "both paid requests must be in flight before either long chunk completes");
  releaseProcesses();
  await running;
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 2);
});

test("offscreen executor overlaps the next ASR chunk with translation from the previous group", async () => {
  const asrCompleted = new Set();
  const translationsReady = new Set();
  const translationsCompleted = new Set();
  let releaseSecondAsr;
  let releaseFirstTranslation;
  let signalSecondAsrStarted;
  let signalFirstTranslationStarted;
  const secondAsrStarted = new Promise(resolve => { signalSecondAsrStarted = resolve; });
  const firstTranslationStarted = new Promise(resolve => { signalFirstTranslationStarted = resolve; });
  const secondAsrGate = new Promise(resolve => { releaseSecondAsr = resolve; });
  const firstTranslationGate = new Promise(resolve => { releaseFirstTranslation = resolve; });
  const sent = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 1,
    async executeTranslation(input) {
      if (input.chunkIndex === 0) {
        signalFirstTranslationStarted();
        await firstTranslationGate;
      }
      return { segments: [{ start: 0, end: 1, text: `译文-${input.chunkIndex}` }], failures: [], error: null };
    },
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: true,
          chunks: [0, 1].map(index => ({ index, asrCompleted: asrCompleted.has(index) })),
          translations: [...translationsReady]
            .filter(index => !translationsCompleted.has(index))
            .map(index => ({ index, processing: false }))
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK && message.workType === "asr") {
        if (message.chunkIndex === 1) {
          signalSecondAsrStarted();
          await secondAsrGate;
        }
        asrCompleted.add(message.chunkIndex);
        translationsReady.add(message.chunkIndex);
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        return { ok: true, accepted: true, input: { chunkIndex: message.chunkIndex } };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT) {
        translationsCompleted.add(message.chunkIndex);
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr", asrWorkers: 1, translationWorkers: 1 }, {
    job: { id: "job-overlap-lanes", runToken: "run-overlap-lanes", pipeline: "funasr" },
    executionOwnerId: "offscreen-overlap-lanes",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  await Promise.race([
    Promise.all([secondAsrStarted, firstTranslationStarted]),
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("ASR and translation lanes did not overlap")), 250))
  ]);
  assert.equal(asrCompleted.has(1), false, "the second ASR must still be active while the first translation starts");
  assert.equal(translationsCompleted.has(0), false, "the first translation must remain active while the second ASR starts");
  releaseSecondAsr();
  releaseFirstTranslation();
  await running;
  const paidWork = sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK);
  assert.deepEqual(paidWork.map(message => `${message.workType}:${message.chunkIndex}`).sort(), ["asr:0", "asr:1"]);
  assert.deepEqual(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT).map(message => message.chunkIndex).sort(), [0, 1]);
});

test("offscreen executor honors configured translation worker concurrency", async () => {
  const completed = new Set();
  let active = 0;
  let maxActive = 0;
  let releaseTranslations;
  let signalTwoActive;
  const translationGate = new Promise(resolve => { releaseTranslations = resolve; });
  const twoActive = new Promise(resolve => { signalTwoActive = resolve; });
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 1,
    async executeTranslation(input) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (active === 2) {
        signalTwoActive();
      }
      await translationGate;
      active -= 1;
      return { segments: [{ start: 0, end: 1, text: `译文-${input.chunkIndex}` }], failures: [], error: null };
    },
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: true,
          chunks: [],
          translations: [0, 1, 2]
            .filter(index => !completed.has(index))
            .map(index => ({ index, processing: false }))
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        return { ok: true, accepted: true, input: { chunkIndex: message.chunkIndex } };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT) {
        completed.add(message.chunkIndex);
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "browser", asrWorkers: 1, translationWorkers: 2 }, {
    job: { id: "job-translation-workers", runToken: "run-translation-workers", pipeline: "browser" },
    executionOwnerId: "offscreen-translation-workers",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  await Promise.race([
    twoActive,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("two translation workers did not start")), 250))
  ]);
  assert.equal(maxActive, 2);
  releaseTranslations();
  await running;
  assert.equal(completed.size, 3);
  assert.equal(maxActive, 2);
});

test("production translation lane executes locally and never sends PROCESS_JOB_CHUNK", async () => {
  const sent = [];
  let committed = false;
  let executionInputCalls = 0;
  let localCalls = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async executeTranslation(input, executionContext) {
      localCalls += 1;
      assert.equal(input.semanticRequestPath, "translation/job-a/run-a/chunk/0");
      executionContext.onProgress({ batchIndex: 1, batchTotal: 1, segmentCount: 1 });
      return { segments: [{ start: 0, end: 1, text: "译文" }], failures: [], error: null };
    },
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: true,
          chunks: [],
          translations: committed ? [] : [{ index: 0, processing: false }]
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        executionInputCalls += 1;
        return {
          ok: true,
          accepted: true,
          input: {
            jobId: "job-a",
            runToken: "run-a",
            executionOwnerId: "offscreen-a",
            executionEpoch: 1,
            chunkIndex: 0,
            semanticRequestPath: "translation/job-a/run-a/chunk/0",
            sourceSegments: [{ start: 0, end: 1, text: "source" }],
            targetLanguage: "zh-CN",
            metadata: {},
            translationConfig: { providerType: "openai", baseUrl: "https://provider.test/v1", model: "test", apiKey: "secret" }
          }
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT) {
        assert.equal(message.result.segments[0].text, "译文");
        committed = true;
        return { ok: true, accepted: true };
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({ pipeline: "browser", translationWorkers: 1 }, {
    job: { id: "job-a", runToken: "run-a", pipeline: "browser" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    signal: new AbortController().signal
  });
  assert.equal(localCalls, 1);
  assert.equal(executionInputCalls, 1);
  assert.equal(sent.some(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK && message.workType === "translation"), false);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT).length, 1);
  assert.ok(sent.some(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.REPORT_JOB_WORK_PROGRESS));
});

test("production ordinary ASR lane executes locally from JSON-safe cache references and never sends PROCESS_JOB_CHUNK", async () => {
  const sent = [];
  const completed = new Set();
  const executions = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async executeAsr(input) {
      executions.push(input);
      return {
        segments: [{ start: 1, end: 2, text: "ordinary ASR" }],
        warning: null
      };
    },
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return {
          ok: true,
          extractionDone: true,
          chunks: [{ index: 0, asrCompleted: completed.has(0) }]
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        assert.equal(message.workType, "asr");
        return {
          ok: true,
          accepted: true,
          input: {
            jobId: "job-asr-local",
            runToken: "run-asr-local",
            executionOwnerId: "offscreen-asr-local",
            executionEpoch: 3,
            chunkIndex: 0,
            semanticRequestPath: "asr/job-asr-local/run-asr-local/chunk/0",
            audio: {
              cacheRef: "https://fuguang.local/__fuguang_audio_cache/job-asr-local/chunk-0.mp3",
              name: "chunk-0.mp3",
              mime: "audio/mpeg",
              bytes: 3
            },
            asrConfig: {
              providerType: "openai",
              baseUrl: "https://asr.example/v1",
              model: "whisper-1",
              apiKey: "transient-only"
            }
          }
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT) {
        assert.equal(message.workType, "asr");
        completed.add(message.chunkIndex);
        return { ok: true, accepted: true };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        throw new Error("ordinary ASR must execute in offscreen instead of PROCESS_JOB_CHUNK");
      }
      return { ok: true, accepted: true };
    }
  });

  await execute({ pipeline: "browser", asrWorkers: 1 }, {
    job: { id: "job-asr-local", runToken: "run-asr-local", pipeline: "browser" },
    executionOwnerId: "offscreen-asr-local",
    executionEpoch: 3,
    signal: new AbortController().signal
  });

  assert.equal(executions.length, 1);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(executions[0])));
  assert.equal(containsBinaryValue(executions[0]), false);
  assert.equal(sent.some(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK), false);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT && message.workType === "asr").length, 1);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT && message.workType === "asr").length, 1);
});

test("production durable FunASR lane executes locally while non-FunASR keeps its ordinary executor", async () => {
  const completed = new Set();
  const sent = [];
  const calls = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async executeAsr() { calls.push("ordinary"); return { segments: [] }; },
    async executeFunAsr(executionInput) {
      calls.push("funasr");
      assert.equal(containsBinaryValue(executionInput), false);
      return { segments: [{ start: 0, end: 1, text: "FunASR" }], remoteTaskId: "task-1" };
    },
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: completed.has(0) }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        return { ok: true, accepted: true, input: {
          jobId: "job-fun-local", runToken: "run-fun-local", executionOwnerId: "owner-fun", executionEpoch: 4,
          chunkIndex: 0, semanticRequestPath: "funasr/job-fun-local/run-fun-local/chunk/0",
          chunk: { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-fun-local/0.mp3" } },
          funAsrConfig: { providerType: "dashscope_funasr", model: "fun-asr", apiKey: "transient" }
        }};
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT) {
        completed.add(message.chunkIndex);
        return { ok: true, accepted: true };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        throw new Error("durable FunASR must not execute in the Service Worker");
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({ pipeline: "funasr", funAsrExecutionMode: "offscreen-durable-v1", asrWorkers: 1 }, {
    job: { id: "job-fun-local", runToken: "run-fun-local", pipeline: "funasr" },
    executionOwnerId: "owner-fun", executionEpoch: 4, signal: new AbortController().signal
  });
  assert.deepEqual(calls, ["funasr"]);
  assert.equal(sent.some(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK), false);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.COMMIT_JOB_WORK_RESULT).length, 1);
});

test("ordinary ASR executor prepares multipart audio locally, checkpoints primary before coverage, and uses stable collection namespace", async () => {
  const order = [];
  const collected = [];
  const executeAsr = createOffscreenBrowserAsrExecutor({
    paidRuntime: {
      async writeArtifact() { order.push("primary-durable"); }
    },
    paidClient: { createRequestTransport: () => async () => { throw new Error("unused"); } },
    async prepareLogicalAudio(payload) {
      order.push("concat");
      assert.equal(payload.cacheNamespace, "job-asr-logical-run-asr-asr-2");
      return { name: "logical.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-asr/logical.mp3" };
    },
    async collectSpeechAudio(payload) {
      collected.push(payload.cacheNamespace);
      return { chunks: [] };
    },
    async transcribe(chunk, _config, options) {
      assert.equal(Array.isArray(chunk.file.parts), false);
      await options.onPrimaryResult([{ start: 0, end: 1, text: "primary" }]);
      order.push("coverage");
      await options.collectSpeechAudio({ cacheNamespace: "", file: chunk.file });
      return { segments: [{ start: 0, end: 1, text: "primary" }], warning: { message: "coverage failed" }, diagnostics: {} };
    }
  });
  const result = await executeAsr({
    jobId: "job-asr", runToken: "run-asr", executionOwnerId: "owner-asr", executionEpoch: 1,
    chunkIndex: 2, semanticRequestPath: "asr/job-asr/run-asr/chunk/2", webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
    asrConfig: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "secret" },
    chunk: { index: 2, file: { parts: [
      { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-asr/a.mp3" } },
      { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-asr/b.mp3" } }
    ] } }
  });
  assert.deepEqual(order, ["concat", "primary-durable", "coverage"]);
  assert.deepEqual(collected, ["job-asr-logical-run-asr-asr-2-speech"]);
  assert.equal(result.segments[0].text, "primary");
  assert.equal(result.warning.message, "coverage failed");
});

test("ordinary ASR executor serializes per-chunk failures but propagates real cancellation and stale ownership", async () => {
  const base = {
    jobId: "job-error", runToken: "run-error", executionOwnerId: "owner-error", executionEpoch: 1,
    chunkIndex: 0, semanticRequestPath: "asr/job-error/run-error/chunk/0", webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
    asrConfig: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "secret" },
    chunk: { index: 0, file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-error/a.mp3" } }
  };
  const namedAbort = new Error("provider used AbortError as a name");
  namedAbort.name = "AbortError";
  namedAbort.code = "HTTP_500";
  namedAbort.asrStatus = 500;
  const executeFailure = createOffscreenBrowserAsrExecutor({
    paidRuntime: {}, paidClient: { createRequestTransport: () => () => {} },
    transcribe: async (_chunk, _config, options) => {
      options.onDiagnostics({ stage: "request", request: { fields: [["model", "whisper"]] } });
      throw namedAbort;
    }
  });
  const failed = await executeFailure(base, { signal: new AbortController().signal });
  assert.equal(failed.error.name, "AbortError");
  assert.equal(failed.error.status, 500);
  assert.equal(failed.error.asrStage, "request");
  assert.equal(failed.diagnostics.stage, "request", "workflow diagnostics emitted before failure must cross the offscreen commit boundary");

  for (const code of [
    "PAID_REQUEST_DELIVERY_AMBIGUOUS",
    "PAID_REQUEST_DURABLE_RESULT_MISSING",
    "PAID_REQUEST_DURABLE_RESULT_CORRUPT"
  ]) {
    const durableError = Object.assign(new Error(`durable failure: ${code}`), { code });
    const executeAmbiguous = createOffscreenBrowserAsrExecutor({
      paidRuntime: {}, paidClient: { createRequestTransport: () => () => {} },
      transcribe: async () => { throw durableError; }
    });
    const ambiguous = await executeAmbiguous(base, { signal: new AbortController().signal });
    assert.equal(ambiguous.error.deliveryAmbiguous, true, `${code} must remain delivery-ambiguous across the offscreen boundary`);
  }

  const storeRejectedBeforeDelivery = Object.assign(new Error("prepared write rejected"), {
    code: "PAID_REQUEST_STORE_REJECTED",
    deliveryAmbiguous: false
  });
  const executeDefiniteStoreFailure = createOffscreenBrowserAsrExecutor({
    paidRuntime: {}, paidClient: { createRequestTransport: () => () => {} },
    transcribe: async () => { throw storeRejectedBeforeDelivery; }
  });
  const definiteStoreFailure = await executeDefiniteStoreFailure(base, { signal: new AbortController().signal });
  assert.equal(definiteStoreFailure.error.deliveryAmbiguous, false, "a pre-delivery store rejection must not be mislabeled ambiguous");

  const stale = Object.assign(new Error("lease lost"), { code: "PAID_REQUEST_STALE_EXECUTION" });
  const executeStale = createOffscreenBrowserAsrExecutor({
    paidRuntime: {}, paidClient: { createRequestTransport: () => () => {} },
    transcribe: async () => { throw stale; }
  });
  await assert.rejects(() => executeStale(base, { signal: new AbortController().signal }), /lease lost/);
});

test("ordinary ASR executor preserves real workflow HTTP diagnostics in its durable result envelope", async () => {
  const originalCaches = globalThis.caches;
  const audioBytes = new Uint8Array(4096);
  audioBytes[0] = 0xff;
  audioBytes[1] = 0xfb;
  globalThis.caches = {
    async open() {
      return { async match() { return new Response(audioBytes); } };
    }
  };
  try {
    const executeAsr = createOffscreenBrowserAsrExecutor({
      paidRuntime: { async writeArtifact() { throw new Error("primary artifact must not run after HTTP failure"); } },
      paidClient: {
        createRequestTransport: () => async () => new Response(JSON.stringify({
          error: { message: "provider exploded", apiKey: "must-not-persist" }
        }), {
          status: 500,
          headers: { "content-type": "application/json" }
        })
      }
    });
    const result = await executeAsr({
      jobId: "job-real-http", runToken: "run-real-http", executionOwnerId: "owner-real-http", executionEpoch: 1,
      chunkIndex: 0, semanticRequestPath: "asr/job-real-http/run-real-http/chunk/0", webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
      asrConfig: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper-1", apiKey: "transient-secret", vadFilter: "off" },
      chunk: {
        index: 0, start: 0, end: 30, duration: 30, bytes: audioBytes.byteLength,
        file: { name: "real.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength, cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-real-http/0.mp3" }
      }
    }, { signal: new AbortController().signal });
    assert.equal(result.error.status, 500);
    assert.equal(result.error.asrStage, "asr_request");
    assert.equal(result.diagnostics.error.status, 500);
    assert.equal(result.diagnostics.error.stage, "asr_request");
    assert.equal(result.diagnostics.rawPayload.error.message, "provider exploded");
    assert.equal(result.diagnostics.request.fields.some(([name, value]) => name === "model" && value === "whisper-1"), true);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("ordinary local ASR forwards its duration-based timeout to the durable request runtime", async () => {
  const originalCaches = globalThis.caches;
  const audioBytes = new Uint8Array(4096);
  audioBytes[0] = 0xff;
  audioBytes[1] = 0xfb;
  globalThis.caches = {
    async open() {
      return { async match() { return new Response(audioBytes); } };
    }
  };
  let transportTimeoutMs = null;
  try {
    const executeAsr = createOffscreenBrowserAsrExecutor({
      paidRuntime: { async writeArtifact() {} },
      paidClient: {
        createRequestTransport: () => async (_url, _init, options = {}) => {
          transportTimeoutMs = options.timeoutMs;
          return new Response(JSON.stringify({
            segments: [{ start: 0, end: 1, text: "local result" }]
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      }
    });
    const result = await executeAsr({
      jobId: "job-local-timeout", runToken: "run-local-timeout",
      executionOwnerId: "owner-local-timeout", executionEpoch: 1,
      chunkIndex: 0, semanticRequestPath: "asr/job-local-timeout/run-local-timeout/chunk/0",
      webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
      asrConfig: {
        providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1",
        model: "whisper-1", apiKey: "local", vadFilter: "off"
      },
      chunk: {
        index: 0, start: 0, end: 900, duration: 900, bytes: audioBytes.byteLength,
        file: {
          name: "local.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength,
          cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-local-timeout/0.mp3"
        }
      }
    }, { signal: new AbortController().signal });
    assert.equal(result.segments[0].text, "local result");
    assert.equal(transportTimeoutMs, 1_125_000,
      "15-minute local ASR must keep the workflow's 18.75-minute deadline instead of the transport's 90-second fallback");
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("ordinary ASR VAD precheck forwards its own 30-second timeout to the durable request runtime", async () => {
  let transportOptions = null;
  const intervals = await FuguangBrowserAsrWorkflow.detectBrowserAsrSpeechIntervals(
    { start: 0, end: 30, duration: 30, file: { mime: "audio/mpeg" } },
    { providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1", apiKey: "local" },
    new Uint8Array([0xff, 0xfb, 1, 2]).buffer,
    "vad.mp3",
    null,
    {
      endpoint: "http://127.0.0.1:8000/v1/audio/speech/timestamps",
      semanticRequestPath: "asr/job-local-vad/run-local-vad/chunk/0/vad",
      requestTransport: async (_url, _init, options = {}) => {
        transportOptions = options;
        return new Response(JSON.stringify({ speech_segments: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.deepEqual(intervals, []);
  assert.equal(transportOptions.timeoutMs, 30_000);
  assert.ok(transportOptions.signal instanceof AbortSignal);
});

test("ordinary ASR preserves paid delivery certainty through the real workflow and executor boundary", async () => {
  const originalCaches = globalThis.caches;
  const audioBytes = new Uint8Array(4096);
  audioBytes[0] = 0xff;
  audioBytes[1] = 0xfb;
  globalThis.caches = {
    async open() {
      return { async match() { return new Response(audioBytes); } };
    }
  };
  const input = {
    jobId: "job-paid-semantics", runToken: "run-paid-semantics",
    executionOwnerId: "owner-paid-semantics", executionEpoch: 1,
    chunkIndex: 0, semanticRequestPath: "asr/job-paid-semantics/run-paid-semantics/chunk/0",
    webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
    asrConfig: {
      providerType: "openai", baseUrl: "https://asr-paid-semantics.test/v1",
      model: "whisper-1", apiKey: "transient-secret", vadFilter: "off"
    },
    chunk: {
      index: 0, start: 0, end: 30, duration: 30, bytes: audioBytes.byteLength,
      file: {
        name: "paid-semantics.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength,
        cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-paid-semantics/0.mp3"
      }
    }
  };
  const cases = [
    {
      name: "delivery ambiguous",
      sourceError: Object.assign(new Error("dispatch response lost"), {
        code: "PAID_REQUEST_DELIVERY_AMBIGUOUS",
        deliveryAmbiguous: true,
        status: 503
      }),
      expected: { code: "PAID_REQUEST_DELIVERY_AMBIGUOUS", status: 503, deliveryAmbiguous: true }
    },
    {
      name: "store rejected before delivery",
      sourceError: Object.assign(new Error("durable store rejected"), {
        code: "PAID_REQUEST_STORE_REJECTED",
        deliveryAmbiguous: false,
        status: 409
      }),
      expected: { code: "PAID_REQUEST_STORE_REJECTED", status: 409, deliveryAmbiguous: false }
    },
    {
      name: "ordinary transport failure",
      sourceError: new TypeError("network unavailable"),
      expected: { code: "", status: 0, deliveryAmbiguous: false }
    }
  ];
  try {
    for (const scenario of cases) {
      let workflowError = null;
      await assert.rejects(
        FuguangBrowserAsrWorkflow.requestBrowserAsrTranscription({
          endpoint: "https://asr-paid-semantics.test/v1/audio/transcriptions",
          timeoutMs: 30_000,
          asrConfig: input.asrConfig,
          supportedRequestFields: new Set(),
          effectiveChunk: input.chunk,
          fileBuffer: audioBytes.buffer,
          fileName: input.chunk.file.name,
          clipTimestamps: "",
          matureAsrPlan: null,
          disableVadFilter: true,
          semanticRequestPath: `${input.semanticRequestPath}/direct`,
          requestTransport: async () => { throw scenario.sourceError; }
        }),
        error => {
          workflowError = error;
          return true;
        },
        scenario.name
      );
      assert.equal(workflowError.cause, scenario.sourceError, `${scenario.name}: workflow must retain the local cause`);
      assert.equal(String(workflowError.code || ""), scenario.expected.code, `${scenario.name}: workflow code`);
      assert.equal(Number(workflowError.asrStatus || 0), scenario.expected.status, `${scenario.name}: workflow status`);
      assert.equal(Boolean(workflowError.deliveryAmbiguous), scenario.expected.deliveryAmbiguous, `${scenario.name}: workflow ambiguity`);
      assert.equal(workflowError.asrStage, "asr_request", `${scenario.name}: workflow stage`);

      const executeAsr = createOffscreenBrowserAsrExecutor({
        paidRuntime: { async writeArtifact() { throw new Error("failed request must not write an artifact"); } },
        paidClient: {
          createRequestTransport: () => async () => { throw scenario.sourceError; }
        }
      });
      const result = await executeAsr(input, { signal: new AbortController().signal });
      assert.equal(result.error.code, scenario.expected.code, `${scenario.name}: executor code`);
      assert.equal(result.error.status, scenario.expected.status, `${scenario.name}: executor status`);
      assert.equal(result.error.deliveryAmbiguous, scenario.expected.deliveryAmbiguous, `${scenario.name}: executor ambiguity`);
      assert.equal(result.error.asrStage, "asr_request", `${scenario.name}: executor stage`);
      assert.equal(result.error.cause, undefined, `${scenario.name}: raw Error cause must not cross the JSON boundary`);
      assert.doesNotThrow(() => JSON.stringify(result), `${scenario.name}: durable result must stay JSON-safe`);
    }

    const executeHttp400 = createOffscreenBrowserAsrExecutor({
      paidRuntime: { async writeArtifact() { throw new Error("HTTP failure must not write an artifact"); } },
      paidClient: {
        createRequestTransport: () => async () => new Response(JSON.stringify({ error: { message: "bad request" } }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      }
    });
    const http400 = await executeHttp400(input, { signal: new AbortController().signal });
    assert.equal(http400.error.code, "");
    assert.equal(http400.error.status, 400);
    assert.equal(http400.error.deliveryAmbiguous, false);
    assert.equal(http400.error.asrStage, "asr_request");
    assert.equal(http400.error.cause, undefined);
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("ordinary offscreen ASR accepts xAI without a model but still rejects model-less OpenAI", async () => {
  const executeAsr = createOffscreenBrowserAsrExecutor({
    paidRuntime: { async writeArtifact() {} },
    paidClient: { createRequestTransport: () => async () => new Response("{}") },
    transcribe: async () => ({ segments: [{ start: 0, end: 1, text: "xAI source" }], warning: null, diagnostics: null })
  });
  const base = {
    jobId: "job-xai-no-model",
    runToken: "run-xai-no-model",
    executionOwnerId: "owner-xai-no-model",
    executionEpoch: 1,
    chunkIndex: 0,
    semanticRequestPath: "asr/job-xai-no-model/chunk/0",
    webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
    chunk: {
      index: 0, start: 0, end: 1, duration: 1,
      file: { name: "xai.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-xai-no-model/0.mp3" }
    }
  };
  const xai = await executeAsr({
    ...base,
    asrConfig: { providerType: "xai", baseUrl: "https://api.x.ai/v1", model: "", apiKey: "transient-secret" }
  }, { signal: new AbortController().signal });
  assert.equal(xai.segments[0].text, "xAI source");

  await assert.rejects(() => executeAsr({
    ...base,
    jobId: "job-openai-no-model",
    runToken: "run-openai-no-model",
    semanticRequestPath: "asr/job-openai-no-model/chunk/0",
    asrConfig: { providerType: "openai", baseUrl: "https://api.openai.com/v1", model: "", apiKey: "transient-secret" }
  }, { signal: new AbortController().signal }), /no usable provider configuration/);
});

test("ordinary ASR HTTP 500 text containing cancellation words is a durable chunk failure, not cancellation", async () => {
  const originalCaches = globalThis.caches;
  const audioBytes = new Uint8Array(4096);
  audioBytes[0] = 0xff;
  audioBytes[1] = 0xfb;
  globalThis.caches = {
    async open() {
      return { async match() { return new Response(audioBytes); } };
    }
  };
  try {
    for (const [index, message] of ["request aborted by upstream", "cancel token invalid"].entries()) {
      const executeAsr = createOffscreenBrowserAsrExecutor({
        paidRuntime: { async writeArtifact() { throw new Error("primary artifact must not run after HTTP failure"); } },
        paidClient: {
          createRequestTransport: () => async () => new Response(JSON.stringify({ error: { message } }), {
            status: 500,
            headers: { "content-type": "application/json" }
          })
        }
      });
      const result = await executeAsr({
        jobId: `job-http-cancel-words-${index}`,
        runToken: `run-http-cancel-words-${index}`,
        executionOwnerId: "owner-http-cancel-words",
        executionEpoch: 1,
        chunkIndex: 0,
        semanticRequestPath: `asr/job-http-cancel-words-${index}/chunk/0`,
        webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
        asrConfig: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper-1", apiKey: "transient-secret", vadFilter: "off" },
        chunk: {
          index: 0, start: 0, end: 30, duration: 30, bytes: audioBytes.byteLength,
          file: { name: "real.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength, cacheUrl: `https://fuguang.local/__fuguang_audio_cache/job-http-cancel-words-${index}/0.mp3` }
        }
      }, { signal: new AbortController().signal });
      assert.equal(result.error.status, 500, message);
      assert.equal(result.error.asrStage, "asr_request", message);
      assert.equal(result.diagnostics.rawPayload.error.message, message);
    }
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("collected-speech collector, HTTP and postprocess failures all emit durable diagnostics", async () => {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
  const audioBytes = new Uint8Array(4096);
  audioBytes[0] = 0xff;
  audioBytes[1] = 0xfb;
  globalThis.caches = {
    async open() {
      return { async match() { return new Response(audioBytes); } };
    }
  };
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        paths: {
          "/v1/audio/transcriptions": { post: { requestBody: { content: { "multipart/form-data": { schema: { properties: { vad_filter: { type: "boolean" }, without_timestamps: { type: "boolean" } } } } } } } },
          "/v1/audio/speech/timestamps": { post: { requestBody: { content: { "multipart/form-data": { schema: { properties: { file: { type: "string", format: "binary" } } } } } } } }
        }
      };
    }
  });
  try {
    for (const mode of ["collector", "http", "postprocess"]) {
      const paidClient = {
        createRequestTransport: () => async url => {
          if (String(url).endsWith("/audio/speech/timestamps")) {
            return { ok: true, status: 200, async json() { return [{ start: 1000, end: 1500 }]; } };
          }
          if (mode === "http") {
            return { ok: false, status: 503, async json() { return { error: { message: "collected provider failed" } }; } };
          }
          const payload = {};
          Object.defineProperty(payload, "segments", {
            enumerable: true,
            get() { throw new Error("collected postprocess failed"); }
          });
          Object.defineProperty(payload, "toJSON", {
            value() { return { segments: [{ start: 0, end: 0.5, text: "raw collected payload" }] }; }
          });
          return { ok: true, status: 200, async json() { return payload; } };
        }
      };
      const executeAsr = createOffscreenBrowserAsrExecutor({
        paidRuntime: { async writeArtifact() {} },
        paidClient,
        async collectSpeechAudio() {
          if (mode === "collector") throw new Error("collector failed");
          return {
            chunks: [{
              index: 0, start: 0, end: 0.5, duration: 0.5, sourceStart: 1, sourceEnd: 1.5,
              timeMap: [{ outputStart: 0, outputEnd: 0.5, sourceStart: 1, sourceEnd: 1.5 }],
              file: { name: "speech.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength, cacheUrl: `https://fuguang.local/__fuguang_audio_cache/job-collected-${mode}/speech.mp3` }
            }]
          };
        }
      });
      const result = await executeAsr({
        jobId: `job-collected-${mode}`, runToken: `run-collected-${mode}`, executionOwnerId: "owner-collected", executionEpoch: 1,
        chunkIndex: 0, semanticRequestPath: `asr/job-collected-${mode}/chunk/0`, webFfmpegUrl: "chrome-extension://test/ffmpeg.html",
        asrConfig: {
          providerType: "openai", baseUrl: `https://collected-${mode}.example/v1`, model: "whisper-1",
          apiKey: "transient-secret", vadFilter: "auto", collectedSpeechAudio: "on"
        },
        chunk: {
          index: 0, start: 0, end: 30, duration: 30, bytes: audioBytes.byteLength,
          file: { name: "source.mp3", mime: "audio/mpeg", bytes: audioBytes.byteLength, cacheUrl: `https://fuguang.local/__fuguang_audio_cache/job-collected-${mode}/source.mp3` }
        }
      }, { signal: new AbortController().signal });
      const expectedStage = mode === "collector" ? "audio-collect" : (mode === "http" ? "asr_request" : "postprocess");
      assert.equal(result.error.asrStage, expectedStage, `${mode} failure stage`);
      assert.equal(result.diagnostics.error.stage, expectedStage, `${mode} diagnostics stage`);
      assert.equal(Array.isArray(result.diagnostics.vad.speechIntervals), true);
      if (mode === "http") {
        assert.equal(result.error.status, 503);
        assert.equal(result.diagnostics.rawPayload.error.message, "collected provider failed");
      }
      if (mode === "postprocess") {
        assert.equal(result.diagnostics.request.fields.some(([name]) => name === "model"), true);
        assert.equal(result.diagnostics.rawPayload.segments[0].text, "raw collected payload");
      }
    }
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
    globalThis.fetch = originalFetch;
  }
});

test("offscreen executor re-polls after a retryable work response", async () => {
  const sent = [];
  let polls = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        return polls === 1
          ? { ok: true, stale: true, retryable: true, reason: "snapshot-read-error" }
          : { ok: true, terminal: true, interrupted: true };
      }
      return { ok: true, accepted: true };
    }
  });
  const result = await execute({}, {
    job: { id: "job-retryable-work", runToken: "run-retryable-work" },
    executionOwnerId: "offscreen-retryable",
    executionEpoch: 2,
    chunks: [],
    signal: new AbortController().signal
  });
  assert.equal(result.interrupted, true);
  assert.deepEqual(sent.map(message => message.type), [
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK
  ]);
});

test("offscreen executor exponentially backs off an idle extraction without losing bounded polling", async () => {
  const hourMs = 60 * 60 * 1000;
  let virtualIdleMs = 0;
  let polls = 0;
  const waits = [];
  const execute = createOffscreenTaskExecutor({
    pollIntervalMs: 0,
    idlePollBaseMs: 500,
    idlePollMaxMs: 30_000,
    async sendMessage(message) {
      if (message.type !== FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, accepted: true };
      }
      polls += 1;
      if (virtualIdleMs >= hourMs || polls > 7_500) {
        return { ok: true, terminal: true, interrupted: true };
      }
      return { ok: true, extractionDone: false, chunks: [], translations: [] };
    }
  });
  const result = await execute({}, {
    job: { id: "job-idle", runToken: "run-idle" },
    executionOwnerId: "offscreen-idle",
    executionEpoch: 1,
    signal: new AbortController().signal,
    async waitForWake(timeoutMs) {
      waits.push(timeoutMs);
      virtualIdleMs += timeoutMs;
      return { reason: "timeout" };
    }
  });
  assert.equal(result.interrupted, true);
  assert.deepEqual(waits.slice(0, 7), [500, 1000, 2000, 4000, 8000, 16000, 30000]);
  assert.equal(polls, 126, "the first idle hour remains bounded but drops well below a few hundred polls");
  assert.equal(Math.floor(hourMs / 500), 7200, "the former fixed cadence trends to 7200 GETs/hour");
});

test("offscreen executor lets wake interrupt a long idle backoff immediately", async () => {
  const controller = new AbortController();
  let polls = 0;
  let releaseWake;
  let signalWaiting;
  const waiting = new Promise(resolve => { signalWaiting = resolve; });
  const wake = new Promise(resolve => { releaseWake = resolve; });
  const completed = new Set();
  const execute = createOffscreenTaskExecutor({
    pollIntervalMs: 1000,
    idlePollBaseMs: 30_000,
    idlePollMaxMs: 30_000,
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        if (polls === 1) {
          return { ok: true, extractionDone: false, chunks: [], translations: [] };
        }
        return {
          ok: true,
          extractionDone: true,
          chunks: [{ index: 0, asrCompleted: completed.has(0) }],
          translations: []
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        completed.add(message.chunkIndex);
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr" }, {
    job: { id: "job-wake", runToken: "run-wake", pipeline: "funasr" },
    executionOwnerId: "offscreen-wake",
    executionEpoch: 1,
    signal: controller.signal,
    waitForWake() {
      signalWaiting();
      return wake;
    }
  });
  try {
    await waiting;
    const wokeAt = Date.now();
    releaseWake({ reason: "wake" });
    await Promise.race([
      running,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("wake did not interrupt idle backoff")), 150))
    ]);
    assert.ok(Date.now() - wokeAt < 150);
    assert.equal(polls >= 2, true);
    assert.deepEqual([...completed], [0]);
  } finally {
    controller.abort(new Error("test cleanup"));
    await running.catch(() => {});
  }
});

test("an active completion cancels its losing idle waiter so a later wake reaches the current wait", async () => {
  const controller = new AbortController();
  let polls = 0;
  let releaseProcess;
  const processGate = new Promise(resolve => { releaseProcess = resolve; });
  const waits = [];
  const execute = createOffscreenTaskExecutor({
    idlePollBaseMs: 30_000,
    idlePollMaxMs: 30_000,
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        if (polls === 1) {
          return { ok: true, extractionDone: false, chunks: [{ index: 0, asrCompleted: false }] };
        }
        if (polls === 2) {
          return { ok: true, extractionDone: false, chunks: [{ index: 0, asrCompleted: true }] };
        }
        return { ok: true, terminal: true, interrupted: true };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        await processGate;
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr" }, {
    job: { id: "job-wait-generation", runToken: "run-wait-generation", pipeline: "funasr" },
    executionOwnerId: "offscreen-wait-generation",
    executionEpoch: 1,
    signal: controller.signal,
    waitForWake(_timeoutMs, signal) {
      return new Promise((resolve, reject) => {
        const wait = { resolve, signal };
        waits.push(wait);
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
  });
  try {
    await waitForCondition(() => waits.length === 1, "the first idle waiter");
    releaseProcess();
    await waitForCondition(() => waits.length === 2, "the replacement idle waiter");
    assert.equal(waits[0].signal.aborted, true);
    waits[1].resolve({ reason: "wake" });
    await running;
    assert.equal(polls, 3);
  } finally {
    controller.abort(new Error("test cleanup"));
    await running.catch(() => {});
  }
});

test("offscreen executor re-polls durable work after a retryable finalization", async () => {
  const sent = [];
  let polls = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        return polls === 1
          ? { ok: true, extractionDone: true, chunks: [] }
          : { ok: true, terminal: true, interrupted: true };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB) {
        return { ok: true, stale: true, retryable: true, reason: "owned-write-error" };
      }
      return { ok: true, accepted: true };
    }
  });
  const result = await execute({}, {
    job: { id: "job-retryable-finalize", runToken: "run-retryable-finalize" },
    executionOwnerId: "offscreen-retryable",
    executionEpoch: 2,
    chunks: [],
    signal: new AbortController().signal
  });
  assert.equal(result.interrupted, true);
  assert.deepEqual(sent.map(message => message.type), [
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
    FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB,
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK
  ]);
});

test("offscreen executor aborts a pending runtime message when its lease is lost", async () => {
  let markStarted;
  const started = new Promise(resolve => {
    markStarted = resolve;
  });
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    messageTimeoutMs: 1000,
    sendMessage() {
      markStarted();
      return new Promise(() => {});
    }
  });
  const controller = new AbortController();
  const running = execute({}, {
    job: { id: "job-a", runToken: "run-a" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    chunks: [],
    signal: controller.signal
  });
  await started;
  controller.abort(new Error("lease lost"));
  await assert.rejects(Promise.race([
    running,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("pending runtime message ignored abort")), 80))
  ]), /lease lost/);
});

test("offscreen executor waits for an already processing chunk instead of finalizing or resubmitting it", async () => {
  const sent = [];
  let polls = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        return polls === 1
          ? { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false, processing: true }] }
          : { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: true, processing: false }] };
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({}, {
    job: { id: "job-a", runToken: "run-a" },
    executionOwnerId: "offscreen-b",
    executionEpoch: 2,
    chunks: [{ entryType: "audio-chunk", index: 0 }],
    signal: new AbortController().signal
  });
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK).length, 2);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 0);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB).length, 1);
});

test("offscreen executor does not finalize while a completed-ASR chunk is still translating", async () => {
  const sent = [];
  let polls = 0;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        return polls === 1
          ? { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: true, processing: true }] }
          : { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: true, processing: false }] };
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({}, {
    job: { id: "job-a", runToken: "run-a" },
    executionOwnerId: "offscreen-b",
    executionEpoch: 2,
    chunks: [{ entryType: "audio-chunk", index: 0 }],
    signal: new AbortController().signal
  });
  assert.equal(polls, 2, "the executor must observe translation completion before finalizing");
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB).length, 1);
});

test("control messages use their short deadline instead of the long processing timeout", async () => {
  const controller = new AbortController();
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    controlMessageTimeoutMs: 20,
    controlMaxAttempts: 1,
    sendMessage() {
      return new Promise(() => {});
    }
  });
  const running = execute({}, {
    job: { id: "job-a", runToken: "run-a" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    chunks: [],
    signal: controller.signal
  });
  try {
    await assert.rejects(Promise.race([
      running,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("short control deadline was not enforced")), 100))
    ]), /Service Worker task message timed out/);
  } finally {
    controller.abort(new Error("test cleanup"));
    await running.catch(() => {});
  }
});

test("offscreen executor does not impose a two-hour deadline over the complete Fun-ASR pipeline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  let signalProcessStarted;
  const processStarted = new Promise(resolve => {
    signalProcessStarted = resolve;
  });
  const sent = [];
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 24 * 60 * 60_000,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: false, chunks: [{ index: 0, asrCompleted: false }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        signalProcessStarted();
        return new Promise(() => {});
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr", asrWorkers: 1 }, {
    job: { id: "job-long-funasr", runToken: "run-long-funasr", pipeline: "funasr" },
    executionOwnerId: "offscreen-long-funasr",
    executionEpoch: 1,
    signal: controller.signal
  });
  await processStarted;
  t.mock.timers.tick(2 * 60 * 60_000 + 60_001);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FAIL_JOB).length, 0);
  controller.abort(new Error("test cleanup"));
  await assert.rejects(running, /test cleanup/);
});

test("offscreen executor stops polling durable work while extraction is done and a paid chunk is active", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  let signalProcessStarted;
  const processStarted = new Promise(resolve => { signalProcessStarted = resolve; });
  let workPolls = 0;
  const execute = createOffscreenTaskExecutor({
    pollIntervalMs: 500,
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        workPolls += 1;
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: false }], translations: [] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        signalProcessStarted();
        return new Promise(() => {});
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr", asrWorkers: 1, translationWorkers: 1 }, {
    job: { id: "job-no-active-poll", runToken: "run-no-active-poll", pipeline: "funasr" },
    executionOwnerId: "offscreen-no-active-poll",
    executionEpoch: 1,
    signal: controller.signal
  });
  await processStarted;
  t.mock.timers.tick(10_000);
  await Promise.resolve();
  assert.equal(workPolls, 1, "a completed extraction must not read the same durable fence every 500 ms during long paid work");
  controller.abort(new Error("test cleanup"));
  await assert.rejects(running, /test cleanup/);
});

test("final partial translation is prepared once and then runs outside FINALIZE without polling", async () => {
  const controller = new AbortController();
  let prepared = false;
  let signalTranslationStarted;
  const translationStarted = new Promise(resolve => { signalTranslationStarted = resolve; });
  let workPolls = 0;
  let finalizations = 0;
  let translationRequests = 0;
  const execute = createOffscreenTaskExecutor({
    pollIntervalMs: 1,
    async executeTranslation(input) {
      translationRequests += 1;
      signalTranslationStarted();
      await new Promise((_resolve, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true }));
      return { segments: [], failures: [], error: null };
    },
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        workPolls += 1;
        return {
          ok: true,
          extractionDone: true,
          chunks: [],
          translations: prepared ? [{ index: 0, processing: false }] : []
        };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB) {
        finalizations += 1;
        prepared = true;
        return { ok: true, accepted: true, inProgress: true, workPrepared: true };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_EXECUTION_INPUT) {
        return { ok: true, accepted: true, input: { chunkIndex: message.chunkIndex } };
      }
      return { ok: true, accepted: true };
    }
  });
  const running = execute({ pipeline: "funasr", asrWorkers: 1, translationWorkers: 1 }, {
    job: { id: "job-final-partial-group", runToken: "run-final-partial-group", pipeline: "browser" },
    executionOwnerId: "offscreen-final-partial-group",
    executionEpoch: 1,
    signal: controller.signal
  });
  await translationStarted;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(finalizations, 1, "FINALIZE should only prepare the final partial group once");
  assert.equal(workPolls, 2, "the active paid translation must not trigger a 500 ms GET/FINALIZE loop");
  assert.equal(translationRequests, 1);
  controller.abort(new Error("test cleanup"));
  await assert.rejects(running, /test cleanup/);
});
