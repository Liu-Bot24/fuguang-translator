import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";
import { createOffscreenTaskExecutor } from "../../extension/src/offscreen/task-runtime-executor.js";
import { createTaskRuntimeHost, FuguangOffscreenTaskRuntime } from "../../extension/src/offscreen/task-runtime-host.js";
import { FuguangTaskRuntimeProtocol } from "../../extension/src/shared/task-runtime-protocol.js";

function snapshot(overrides = {}) {
  return {
    job: {
      id: "job-a",
      runToken: "run-a",
      status: "queued",
      stage: "queued",
      updatedAt: 100,
      ...overrides
    },
    chunks: []
  };
}

function listenerChannel() {
  const listeners = new Set();
  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    emit(value) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(predicate, label, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      assert.fail(`Timed out waiting for ${label}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

test("runtime port sends READY and ACK before starting work", async () => {
  const sent = [];
  const events = [];
  const timeline = [];
  let releaseExecution;
  const executionGate = new Promise(resolve => {
    releaseExecution = resolve;
  });
  const executionStarted = deferred();
  const host = createTaskRuntimeHost({
    jobStore: FuguangJobStore.createMemory(),
    async executeJob(runtime, context) {
      events.push(`execute:${runtime.mode}:${context.job.id}`);
      timeline.push("execute");
      executionStarted.resolve();
      await executionGate;
    }
  });
  const port = {
    name: FuguangTaskRuntimeProtocol.PORT_NAME,
    onMessage: listenerChannel(),
    onDisconnect: listenerChannel(),
    postMessage(message) {
      sent.push(message);
      timeline.push(message.type);
    }
  };
  assert.equal(host.attachPort(port), true);
  assert.equal(sent[0].type, FuguangTaskRuntimeProtocol.MESSAGE.READY);

  port.onMessage.emit({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "command-a",
    snapshot: snapshot(),
    runtime: { mode: "test" }
  });
  await executionStarted.promise;
  assert.equal(sent[1].type, FuguangTaskRuntimeProtocol.MESSAGE.ACK);
  assert.equal(sent[1].accepted, true);
  assert.deepEqual(events, ["execute:test:job-a"]);
  assert.deepEqual(timeline.slice(0, 3), [
    FuguangTaskRuntimeProtocol.MESSAGE.READY,
    FuguangTaskRuntimeProtocol.MESSAGE.ACK,
    "execute"
  ]);
  releaseExecution();
});

test("duplicate active start is acknowledged once and cancellation is runToken guarded", async () => {
  let executions = 0;
  let releaseExecution;
  const executionGate = new Promise(resolve => {
    releaseExecution = resolve;
  });
  const executionStarted = deferred();
  const store = FuguangJobStore.createMemory();
  const host = createTaskRuntimeHost({
    jobStore: store,
    async executeJob() {
      executions += 1;
      executionStarted.resolve();
      await executionGate;
    }
  });
  const start = {
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "start-a",
    snapshot: snapshot()
  };
  assert.equal((await host.handleCommand(start)).duplicate, false);
  assert.equal((await host.handleCommand({ ...start, commandId: "start-b" })).duplicate, true);
  await executionStarted.promise;
  assert.equal(executions, 1);

  const staleCancel = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB,
    commandId: "cancel-stale",
    jobId: "job-a",
    runToken: "run-b"
  });
  assert.equal(staleCancel.accepted, false);
  const cancel = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB,
    commandId: "cancel-current",
    jobId: "job-a",
    runToken: "run-a"
  });
  assert.equal(cancel.accepted, true);
  assert.equal((await store.getJob("job-a")).cancelRequested, true);
  releaseExecution();
  await waitFor(() => host.activeRuns.size === 0, "the active runtime to be released");
  const afterCompletion = await host.handleCommand({ ...start, commandId: "start-after-completion" });
  assert.equal(afterCompletion.duplicate, false, "a non-terminal job may resume after its previous owner releases the lease");
  await waitFor(() => executions === 2, "the released run to resume");
});

test("a rebuilt runtime takes over only after the previous execution lease expires", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot(snapshot());
  await store.claimRun("job-a", "run-a", {
    ownerId: "dead-offscreen",
    claimedAt: 100,
    leaseDurationMs: 50
  });
  let now = 120;
  let executions = 0;
  const host = createTaskRuntimeHost({
    jobStore: store,
    ownerId: "rebuilt-offscreen",
    now: () => now,
    leaseDurationMs: 50,
    heartbeatIntervalMs: 0,
    async executeJob() {
      executions += 1;
    }
  });
  const command = {
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "resume-before-expiry",
    snapshot: snapshot()
  };
  const beforeExpiry = await host.handleCommand(command);
  assert.equal(beforeExpiry.duplicate, true);
  assert.equal(beforeExpiry.executionLeaseExpiresAt, 150);
  assert.equal(executions, 0);

  now = 151;
  const afterExpiry = await host.handleCommand({ ...command, commandId: "resume-after-expiry" });
  assert.equal(afterExpiry.duplicate, false);
  await waitFor(() => executions === 1, "the rebuilt runtime to take over the expired lease");
});

test("resumeExisting starts from the durable snapshot without replaying the supplied draft", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: {
      id: "job-a",
      runToken: "run-a",
      status: "running",
      stage: "asr",
      updatedAt: 100
    },
    chunks: [{
      key: "job-a:run-a:audio:0",
      jobRunKey: "job-a:run-a",
      jobId: "job-a",
      runToken: "run-a",
      entryType: "audio-chunk",
      index: 0,
      asrCompleted: false,
      updatedAt: 100
    }]
  });
  let execution = null;
  const started = deferred();
  const host = createTaskRuntimeHost({
    jobStore: store,
    heartbeatIntervalMs: 0,
    async executeJob(_runtime, context) {
      execution = context;
      started.resolve();
    }
  });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "resume-existing",
    resumeExisting: true,
    snapshot: {
      job: {
        id: "job-a",
        runToken: "run-a",
        status: "completed",
        stage: "completed",
        updatedAt: 999
      },
      chunks: [{
        key: "job-a:run-a:audio:0",
        jobRunKey: "job-a:run-a",
        jobId: "job-a",
        runToken: "run-a",
        entryType: "audio-chunk",
        index: 0,
        asrCompleted: true,
        sourceSegments: [{ text: "dirty" }],
        updatedAt: 999
      }]
    }
  });
  assert.equal(response.accepted, true);
  await started.promise;
  assert.equal(execution.job.status, "running");
  assert.equal(execution.chunks[0].asrCompleted, false);
  const durable = await store.getSnapshot("job-a", "run-a");
  assert.equal(durable.job.status, "running");
  assert.equal(durable.chunks[0].asrCompleted, false);
  assert.equal(JSON.stringify(durable).includes("dirty"), false);
});

test("resumeExisting fails retryably when the durable snapshot cannot be read", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot(snapshot({ status: "running", stage: "asr" }));
  store.getSnapshot = async () => {
    throw new Error("injected resume read failure");
  };
  let executions = 0;
  const host = createTaskRuntimeHost({
    jobStore: store,
    async executeJob() {
      executions += 1;
    }
  });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "resume-read-failure",
    resumeExisting: true,
    snapshot: { job: { id: "job-a", runToken: "run-a" }, chunks: [] }
  });
  assert.equal(response.retryable, true);
  assert.equal(response.reason, "snapshot-read-error");
  assert.equal(host.activeRuns.size, 0);
  assert.equal(executions, 0);
});

test("runtime keeps its lease until a retryable finalization is resolved through a new work poll", async () => {
  const store = FuguangJobStore.createMemory();
  const secondPoll = deferred();
  let polls = 0;
  const executeJob = createOffscreenTaskExecutor({
    retryBaseMs: 0,
    pollIntervalMs: 0,
    async sendMessage(message) {
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB_WORK) {
        polls += 1;
        if (polls === 1) {
          return { ok: true, extractionDone: true, chunks: [] };
        }
        return secondPoll.promise;
      }
      if (message.type === FuguangTaskRuntimeProtocol.MESSAGE.FINALIZE_JOB) {
        return { ok: true, stale: true, retryable: true, reason: "owned-write-error" };
      }
      return { ok: true };
    }
  });
  const host = createTaskRuntimeHost({
    jobStore: store,
    heartbeatIntervalMs: 0,
    executeJob
  });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "retryable-finalize",
    snapshot: snapshot({ status: "running", stage: "translation" })
  });
  assert.equal(response.accepted, true);
  await waitFor(() => polls === 2, "the executor to re-poll work after retryable finalization");
  assert.equal(host.activeRuns.size, 1, "the runtime must retain the lease while retry recovery is pending");
  assert.equal((await store.getJob("job-a")).executionOwnerId, host.ownerId);
  secondPoll.resolve({ ok: true, terminal: true, interrupted: true });
  await waitFor(() => host.activeRuns.size === 0, "the resolved retry flow to release the runtime");
});

test("losing a lease evicts the stale active run before its executor promise settles", async () => {
  const store = FuguangJobStore.createMemory();
  let now = 100;
  let executionSignal = null;
  const executionStarted = deferred();
  const executionGate = deferred();
  const host = createTaskRuntimeHost({
    jobStore: store,
    ownerId: "offscreen-a",
    now: () => now,
    leaseDurationMs: 10,
    heartbeatIntervalMs: 1,
    async executeJob(_runtime, context) {
      executionSignal = context.signal;
      executionStarted.resolve();
      await executionGate.promise;
    }
  });
  await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "start-stale-owner",
    snapshot: snapshot()
  });
  await executionStarted.promise;
  now = 111;
  const takeover = await store.claimRun("job-a", "run-a", {
    ownerId: "offscreen-b",
    claimedAt: now,
    leaseDurationMs: 10
  });
  assert.equal(takeover.applied, true);
  await waitFor(() => executionSignal?.aborted, "the stale owner to observe lease loss");
  try {
    assert.equal(host.activeRuns.size, 0, "a fenced run must not block a replacement START while its promise is unresolved");
  } finally {
    executionGate.resolve();
    await waitFor(() => host.activeRuns.size === 0, "the stale executor to settle");
  }
});

test("a stale same-owner finally cannot release or delete its replacement run", async () => {
  const store = FuguangJobStore.createMemory();
  let now = 100;
  const executions = [];
  const host = createTaskRuntimeHost({
    jobStore: store,
    ownerId: "offscreen-a",
    now: () => now,
    leaseDurationMs: 10,
    heartbeatIntervalMs: 1,
    async executeJob(_runtime, context) {
      const gate = deferred();
      executions.push({ gate, signal: context.signal, epoch: context.executionEpoch });
      await gate.promise;
    }
  });
  const command = {
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "start-first-generation",
    snapshot: snapshot()
  };
  await host.handleCommand(command);
  await waitFor(() => executions.length === 1, "the first generation to start");
  assert.equal(executions[0].epoch, 1);

  now = 111;
  assert.equal((await store.claimRun("job-a", "run-a", {
    ownerId: "offscreen-b",
    claimedAt: now,
    leaseDurationMs: 10
  })).job.executionEpoch, 2);
  await waitFor(() => executions[0].signal.aborted && host.activeRuns.size === 0, "the first generation to be fenced");

  now = 122;
  const replacement = await host.handleCommand({ ...command, commandId: "start-replacement-generation" });
  assert.equal(replacement.duplicate, false);
  assert.equal(replacement.executionEpoch, 3);
  await waitFor(() => executions.length === 2, "the replacement generation to start");
  executions[0].gate.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  const durableWhileReplacementRuns = await store.getJob("job-a");
  assert.equal(durableWhileReplacementRuns.executionOwnerId, "offscreen-a");
  assert.equal(durableWhileReplacementRuns.executionEpoch, 3);
  assert.equal(host.activeRuns.size, 1, "the stale finally must not delete the replacement map entry");

  executions[1].gate.resolve();
  await waitFor(() => host.activeRuns.size === 0, "the replacement generation to finish");
  assert.equal((await store.getJob("job-a")).executionEpoch, 3, "the fencing epoch remains monotonic after release");
});

test("shadow observation persists only the supplied sanitized snapshot", async () => {
  const store = FuguangJobStore.createMemory();
  const host = createTaskRuntimeHost({ jobStore: store });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.OBSERVE_JOB,
    commandId: "observe-a",
    snapshot: snapshot({ source: { identity: "https://media.example.test" } }),
    runtime: { apiKey: "must-not-be-persisted" }
  });
  assert.equal(response.accepted, true);
  assert.equal(response.shadow, true);
  assert.equal(JSON.stringify(await store.getJob("job-a")).includes("must-not-be-persisted"), false);
});

test("production runtime has a real executor and empty hosts reject START_JOB", async () => {
  assert.equal(FuguangOffscreenTaskRuntime.executionEnabled, true);
  const host = createTaskRuntimeHost({ jobStore: FuguangJobStore.createMemory() });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "missing-executor",
    snapshot: snapshot()
  });
  assert.equal(response.type, FuguangTaskRuntimeProtocol.MESSAGE.ERROR);
  assert.match(response.error, /executor is unavailable/i);
});

test("runtime persists executor failure even when the worker callback is unavailable", async () => {
  const store = FuguangJobStore.createMemory();
  const host = createTaskRuntimeHost({
    jobStore: store,
    async executeJob() {
      throw new Error("worker unavailable after retries");
    }
  });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "executor-failure",
    snapshot: snapshot()
  });
  assert.equal(response.accepted, true);
  await waitFor(() => host.activeRuns.size === 0, "the failed runtime to be released");
  const stored = await store.getJob("job-a");
  assert.equal(stored.status, "failed");
  assert.match(stored.error, /worker unavailable/);
});

test("terminal resume rejection preserves its structured reason", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot(snapshot({ status: "completed", stage: "completed", updatedAt: 200 }));
  const host = createTaskRuntimeHost({
    jobStore: store,
    async executeJob() {}
  });
  const response = await host.handleCommand({
    type: FuguangTaskRuntimeProtocol.MESSAGE.START_JOB,
    commandId: "resume-terminal",
    resumeExisting: true,
    snapshot: { job: { id: "job-a", runToken: "run-a" }, chunks: [] }
  });
  assert.equal(response.type, FuguangTaskRuntimeProtocol.MESSAGE.ERROR);
  assert.equal(response.reason, "terminal-job");
});
