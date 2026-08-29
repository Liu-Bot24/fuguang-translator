import assert from "node:assert/strict";
import test from "node:test";

import { createOffscreenTaskExecutor } from "../../extension/src/offscreen/task-runtime-executor.js";
import { FuguangTaskRuntimeProtocol } from "../../extension/src/shared/task-runtime-protocol.js";

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
  await execute({ pipeline: "browser" }, {
    job: { id: "job-a", runToken: "run-a", pipeline: "browser" },
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
  assert.deepEqual(sent.map(message => message.type), [
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
    FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK,
    FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK,
    FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK,
    FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB
  ]);
  assert.deepEqual(
    sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).map(message => message.chunkIndex),
    [1, 2]
  );
  assert.equal(sent.every(message => message.executionOwnerId === "offscreen-a" && message.executionEpoch === 1), true);
});

test("offscreen executor retries a transient worker restart without duplicating finalization", async () => {
  const sent = [];
  let attempts = 0;
  let completed = false;
  const execute = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    maxAttempts: 3,
    async sendMessage(message) {
      sent.push(message);
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        return { ok: true, extractionDone: true, chunks: [{ index: 0, asrCompleted: completed }] };
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK && attempts++ === 0) {
        throw new Error("worker restarted");
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK) {
        completed = true;
      }
      return { ok: true, accepted: true };
    }
  });
  await execute({}, {
    job: { id: "job-a", runToken: "run-a" },
    executionOwnerId: "offscreen-a",
    executionEpoch: 1,
    chunks: [{ entryType: "audio-chunk", index: 0 }],
    signal: new AbortController().signal
  });
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.PROCESS_JOB_CHUNK).length, 2);
  assert.equal(sent.filter(message => message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB).length, 1);
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
