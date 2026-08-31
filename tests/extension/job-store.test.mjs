import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";
import { FuguangJobContract } from "../../extension/src/shared/job-contract.js";

function job(overrides = {}) {
  return {
    id: "job-a",
    runToken: "run-a",
    status: "running",
    stage: "translation",
    activeKey: "1:https://example.test/watch",
    updatedAt: 100,
    ...overrides
  };
}

function chunk(runToken, index, stage = "completed") {
  return {
    key: `job-a:${runToken}:${index}`,
    jobRunKey: `job-a:${runToken}`,
    jobId: "job-a",
    runToken,
    index,
    stage,
    updatedAt: 100
  };
}

async function prepareCancellableFunAsr(store, suffix = "lease") {
  await store.putSnapshot({ job: job({ pipeline: "funasr", stage: "asr" }), chunks: [] });
  const run = await store.claimRun("job-a", "run-a", {
    ownerId: `owner-${suffix}`,
    claimedAt: 100,
    leaseDurationMs: 1_000
  });
  const ownership = {
    executionOwnerId: `owner-${suffix}`,
    executionEpoch: run.job.executionEpoch,
    checkedAt: 110
  };
  const source = {
    jobId: "job-a",
    runToken: "run-a",
    operationId: `funasr-submit-${suffix}`,
    provider: "dashscope_funasr",
    operationType: "funasr-submit",
    inputHash: `sha256:${suffix}`
  };
  await store.prepareOperation(source, ownership);
  await store.updateOperation({
    ...source,
    state: "completed",
    remoteTaskId: `remote-${suffix}`,
    completedAt: 120
  }, ownership);
  await store.releaseRun("job-a", "run-a", `owner-${suffix}`, 130, run.job.executionEpoch);
  await store.markCancelRequested("job-a", "run-a", 140);
  return { source, ownership };
}

test("job store rejects stale snapshots and late writes from an old runToken", async () => {
  const store = FuguangJobStore.createMemory();
  assert.deepEqual(await store.putSnapshot({ job: job(), chunks: [chunk("run-a", 0)] }), {
    applied: true,
    chunks: 1
  });

  assert.equal((await store.putSnapshot({ job: job({ updatedAt: 99 }), chunks: [] })).reason, "stale-snapshot");
  assert.equal((await store.putSnapshot({ job: job({ runToken: "run-b", updatedAt: 200 }), chunks: [] })).reason, "stale-run");
  const nextSnapshot = {
    job: job({ runToken: "run-b", updatedAt: 200 }),
    chunks: [chunk("run-b", 0, "completed")]
  };
  assert.equal((await store.beginAttempt(nextSnapshot, "wrong-run")).reason, "run-token-conflict");
  assert.equal((await store.beginAttempt(nextSnapshot, "run-a")).applied, true);
  assert.deepEqual((await store.getChunks("job-a", "run-b")).map(item => item.index), [0]);

  const late = await store.putSnapshot({ job: job({ updatedAt: 300 }), chunks: [chunk("run-a", 1)] });
  assert.equal(late.reason, "stale-run");
  assert.equal((await store.getJob("job-a")).runToken, "run-b");
  assert.deepEqual((await store.getChunks("job-a", "run-a")).map(item => item.index), [0]);
  assert.deepEqual((await store.getChunks("job-a", "run-b")).map(item => item.index), [0]);
  assert.equal((await store.findActiveJob("1:https://example.test/watch")).runToken, "run-b");
  const firstClaim = await store.claimRun("job-a", "run-b", {
    ownerId: "offscreen-a",
    claimedAt: 210,
    leaseDurationMs: 50
  });
  assert.equal(firstClaim.applied, true);
  assert.equal(firstClaim.job.executionEpoch, 1);
  const duplicateClaim = await store.claimRun("job-a", "run-b", {
    ownerId: "offscreen-b",
    claimedAt: 220,
    leaseDurationMs: 50
  });
  assert.equal(duplicateClaim.reason, "duplicate-run");
  assert.equal(duplicateClaim.executionOwnerId, "offscreen-a");
  assert.equal(duplicateClaim.executionEpoch, 1);
  assert.equal(duplicateClaim.executionLeaseExpiresAt, 260);
  assert.equal((await store.claimRun("job-a", "run-b", {
    ownerId: "offscreen-a",
    claimedAt: 225,
    leaseDurationMs: 50
  })).reason, "duplicate-run", "concurrent starts from the same host must not both claim the run");
  assert.equal((await store.claimRun("job-a", "run-a", {
    ownerId: "offscreen-b",
    claimedAt: 220,
    leaseDurationMs: 50
  })).reason, "stale-run");
  const takeover = await store.claimRun("job-a", "run-b", {
    ownerId: "offscreen-b",
    claimedAt: 261,
    leaseDurationMs: 50
  });
  assert.equal(takeover.applied, true, "a rebuilt runtime must take over an expired execution lease");
  assert.equal(takeover.job.executionOwnerId, "offscreen-b");
  assert.equal(takeover.job.executionEpoch, 2, "every takeover must advance the fencing epoch");
  assert.equal(takeover.job.executionLeaseExpiresAt, 311);
  assert.equal((await store.renewRunLease("job-a", "run-b", "offscreen-a", 270, 50, 1)).reason, "stale-owner");
  assert.equal((await store.renewRunLease("job-a", "run-b", "offscreen-b", 270, 50, 1)).reason, "stale-epoch");
  assert.equal((await store.releaseRun("job-a", "run-b", "offscreen-b", 275, 1)).reason, "stale-epoch");
  const renewed = await store.renewRunLease("job-a", "run-b", "offscreen-b", 270, 50, 2);
  assert.equal(renewed.applied, true);
  assert.equal(renewed.job.updatedAt, 200, "lease heartbeats must not make later business snapshots look stale");
  assert.equal((await store.releaseRun("job-a", "run-b", "offscreen-b", 280, 2)).applied, true);
  await store.putSnapshot({ job: job({ runToken: "run-b", updatedAt: 230 }), chunks: [] });
  assert.equal((await store.getJob("job-a")).executionOwnerId, undefined);
});

test("ordinary mirrors cannot regress a terminal run back to an active status", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job({ status: "failed", stage: "failed", activeKey: "", updatedAt: 200 }),
    chunks: []
  });

  const terminalRefresh = await store.putSnapshot({
    job: job({ status: "failed", stage: "failed", activeKey: "", updatedAt: 250, error: "updated failure detail" }),
    chunks: []
  });
  assert.equal(terminalRefresh.applied, true, "same-terminal metadata updates remain allowed");

  const regressed = await store.putSnapshot({
    job: job({ status: "running", stage: "translation", updatedAt: 300 }),
    chunks: []
  });

  assert.equal(regressed.applied, false);
  assert.equal(regressed.reason, "terminal-regression");
  assert.equal((await store.getJob("job-a")).status, "failed");
});

test("cancel intent is compare-and-set and terminal compaction removes its chunks", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [chunk("run-a", 0)] });
  assert.equal((await store.markCancelRequested("job-a", "run-b", 120)).reason, "stale-run");
  assert.equal((await store.markCancelRequested("job-a", "run-a", 120)).applied, true);
  assert.equal((await store.getJob("job-a")).cancelRequested, true);
  assert.deepEqual((await store.listRecoverableJobs()).map(item => item.id), ["job-a"]);

  await store.putSnapshot({ job: job({ status: "cancelled", stage: "cancelled", activeKey: "", cancelRequested: true, updatedAt: 130 }), chunks: [] });
  assert.deepEqual(await store.listRecoverableJobs(), []);
  assert.deepEqual(await store.compactTerminalJobs(131), { deletedJobs: 1 });
  assert.equal(await store.getJob("job-a"), null);
  assert.deepEqual(await store.getChunks("job-a"), []);
});

test("owned snapshots compare owner, epoch and lease in the same store mutation", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [] });
  const first = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a",
    claimedAt: 100,
    leaseDurationMs: 50
  });
  assert.equal(first.applied, true);

  const accepted = await store.putSnapshotIfOwned({
    job: job({ status: "running", updatedAt: 110 }),
    chunks: []
  }, {
    executionOwnerId: "owner-a",
    executionEpoch: first.job.executionEpoch,
    checkedAt: 120
  });
  assert.equal(accepted.applied, true);

  const takeover = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-b",
    claimedAt: 151,
    leaseDurationMs: 50
  });
  assert.equal(takeover.applied, true);

  const stale = await store.putSnapshotIfOwned({
    job: job({ status: "failed", stage: "failed", updatedAt: 200 }),
    chunks: []
  }, {
    executionOwnerId: "owner-a",
    executionEpoch: first.job.executionEpoch,
    checkedAt: 152
  });
  assert.equal(stale.applied, false);
  assert.equal(stale.reason, "stale-owner");
  assert.equal((await store.getJob("job-a")).status, "running");
  assert.equal((await store.getJob("job-a")).executionOwnerId, "owner-b");
});

test("job store reads a job and its run chunks as one snapshot", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job(),
    chunks: [chunk("run-a", 1), chunk("run-a", 0), chunk("other-run", 2)]
  });

  const snapshot = await store.getSnapshot("job-a", "run-a");
  assert.equal(snapshot.job.id, "job-a");
  assert.equal(snapshot.job.runToken, "run-a");
  assert.deepEqual(snapshot.chunks.map(item => item.index), [0, 1]);
});

test("job store degrades to explicit no-op when IndexedDB is unavailable", async () => {
  const store = FuguangJobStore.create({ indexedDB: null });
  assert.equal(store.available, false);
  assert.deepEqual(await store.putSnapshot({}), { applied: false, reason: "unavailable" });
});

test("owned operation lifecycle is durable and restores a FunASR remote task id", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [] });
  const claim = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a",
    claimedAt: 100,
    leaseDurationMs: 1_000
  });
  const ownership = {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 110
  };

  const prepared = await store.prepareOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    provider: "funasr",
    operationType: "asr-submit",
    inputHash: "sha256:input",
    batchStart: 0,
    batchEnd: 1
  }, ownership);
  assert.equal(prepared.applied, true);
  assert.equal(prepared.operation.state, "prepared");
  assert.equal((await store.prepareOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    provider: "funasr",
    operationType: "asr-submit",
    inputHash: "sha256:different-input",
    batchStart: 0,
    batchEnd: 1
  }, ownership)).reason, "operation-conflict");

  assert.equal((await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "submitted",
    submittedAt: 120
  }, ownership)).applied, true);
  assert.equal((await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "prepared"
  }, ownership)).reason, "operation-state-regression");
  assert.equal((await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "accepted",
    remoteTaskId: "task-123",
    providerRequestId: "request-123"
  }, ownership)).applied, true);
  assert.equal((await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "submitted"
  }, ownership)).reason, "operation-state-regression");

  const restored = await store.getOperation("job-a", "run-a", "funasr-0");
  assert.equal(restored.remoteTaskId, "task-123");
  assert.equal(restored.state, "accepted");
  assert.deepEqual((await store.listOperations("job-a", "run-a")).map(item => item.operationId), ["funasr-0"]);

  const completed = await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "completed",
    completedAt: 150,
    resultSummary: "2 segments",
    result: { segmentCount: 2 }
  }, ownership);
  assert.equal(completed.applied, true);
  assert.equal(completed.operation.result.segmentCount, 2);

  const regression = await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-0",
    state: "submitted"
  }, ownership);
  assert.equal(regression.applied, false);
  assert.equal(regression.reason, "operation-state-regression");
  assert.equal((await store.getOperation("job-a", "run-a", "funasr-0")).state, "completed");
});

test("FunASR remote cancellation is claimed once after the execution lease is released", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job({ pipeline: "funasr", stage: "asr" }), chunks: [] });
  const run = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a", claimedAt: 100, leaseDurationMs: 1_000
  });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: run.job.executionEpoch, checkedAt: 110 };
  const submit = {
    jobId: "job-a", runToken: "run-a", operationId: "funasr-submit-0",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:submit-0"
  };
  await store.prepareOperation(submit, ownership);
  await store.updateOperation({ ...submit, state: "completed", remoteTaskId: "remote-task-0", completedAt: 120 }, ownership);
  await store.releaseRun("job-a", "run-a", "owner-a", 130, run.job.executionEpoch);
  assert.equal((await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 135, claimId: "claim-before-cancel",
    candidates: [{ ...submit, remoteTaskId: "remote-task-0" }]
  })).reason, "cancel-not-requested", "a supplied task identity cannot bypass durable user cancellation intent");
  await store.markCancelRequested("job-a", "run-a", 140);

  const first = await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 140, claimId: "claim-first"
  });
  const duplicate = await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 141, claimId: "claim-duplicate"
  });
  assert.equal(first.applied, true);
  assert.equal(first.claims.length, 1);
  assert.equal(first.claims[0].claimed, true);
  assert.equal(first.claims[0].remoteTaskId, "remote-task-0");
  assert.equal(duplicate.claims.length, 1);
  assert.equal(duplicate.claims[0].claimed, false, "a duplicate stop must not claim another remote request");

  const completed = await store.completeFunAsrRemoteCancellation({
    jobId: "job-a", runToken: "run-a",
    operationId: first.claims[0].operation.operationId,
    provider: first.claims[0].operation.provider,
    operationType: first.claims[0].operation.operationType,
    inputHash: first.claims[0].operation.inputHash,
    sourceOperationId: "funasr-submit-0",
    remoteTaskId: "remote-task-0",
    claimId: first.claims[0].claimId,
    outcome: { status: "not-applied", confirmed: false, httpStatus: 409, remoteTaskStatus: "SUCCEEDED" },
    completedAt: 150
  });
  assert.equal(completed.applied, true);
  assert.equal(completed.operation.state, "completed");
  assert.equal(completed.operation.result.status, "not-applied");
  assert.equal(completed.operation.result.remoteTaskStatus, "SUCCEEDED");
});

test("an old FunASR cancellation outcome completes its exact operation after a new run starts", async () => {
  for (const outcomeStatus of ["confirmed", "unknown"]) {
    const store = FuguangJobStore.createMemory();
    await store.putSnapshot({ job: job({ pipeline: "funasr", stage: "asr" }), chunks: [] });
    const run = await store.claimRun("job-a", "run-a", { ownerId: "owner-a", claimedAt: 100, leaseDurationMs: 1_000 });
    const ownership = { executionOwnerId: "owner-a", executionEpoch: run.job.executionEpoch, checkedAt: 110 };
    const source = {
      jobId: "job-a", runToken: "run-a", operationId: `submit-before-new-run-${outcomeStatus}`,
      provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: `sha256:${outcomeStatus}`
    };
    await store.prepareOperation(source, ownership);
    await store.updateOperation({ ...source, state: "completed", remoteTaskId: `remote-${outcomeStatus}`, completedAt: 120 }, ownership);
    await store.releaseRun("job-a", "run-a", "owner-a", 130, run.job.executionEpoch);
    await store.markCancelRequested("job-a", "run-a", 140);
    const claim = (await store.claimFunAsrRemoteCancellations({
      jobId: "job-a", runToken: "run-a", requestedAt: 141, claimId: `claim-${outcomeStatus}`
    })).claims[0];
    assert.equal(claim.claimed, true);

    const nextSnapshot = { job: job({ runToken: "run-b", pipeline: "funasr", status: "queued", stage: "queued", updatedAt: 200 }), chunks: [] };
    assert.equal((await store.beginAttempt(nextSnapshot, "run-a")).applied, true);
    const newJobBefore = await store.getJob("job-a");
    const completed = await store.completeFunAsrRemoteCancellation({
      jobId: "job-a", runToken: "run-a", operationId: claim.operation.operationId,
      provider: claim.operation.provider, operationType: claim.operation.operationType,
      inputHash: claim.operation.inputHash,
      sourceOperationId: source.operationId,
      remoteTaskId: `remote-${outcomeStatus}`,
      claimId: claim.claimId,
      outcome: { status: outcomeStatus, message: outcomeStatus === "unknown" ? "transport unknown" : "" },
      completedAt: 210
    });
    assert.equal(completed.applied, true);
    assert.equal(completed.operation.state, outcomeStatus === "unknown" ? "unknown" : "completed");
    assert.deepEqual(await store.getJob("job-a"), newJobBefore, "old cancellation completion must not mutate the new run");
    const duplicate = await store.completeFunAsrRemoteCancellation({
      jobId: "job-a", runToken: "run-a", operationId: claim.operation.operationId,
      provider: claim.operation.provider, operationType: claim.operation.operationType,
      inputHash: claim.operation.inputHash, sourceOperationId: source.operationId,
      remoteTaskId: `remote-${outcomeStatus}`,
      claimId: claim.claimId,
      outcome: { status: outcomeStatus }, completedAt: 220
    });
    assert.equal(duplicate.applied, true);
    assert.equal(duplicate.duplicate, true);
  }
});

test("an unknown FunASR cancellation can be reclaimed for status verification without resubmitting ASR", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job({ pipeline: "funasr", stage: "asr" }), chunks: [] });
  const run = await store.claimRun("job-a", "run-a", { ownerId: "owner-a", claimedAt: 100, leaseDurationMs: 1_000 });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: run.job.executionEpoch, checkedAt: 110 };
  const source = {
    jobId: "job-a", runToken: "run-a", operationId: "submit-before-unknown-cancel",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:unknown-cancel"
  };
  await store.prepareOperation(source, ownership);
  await store.updateOperation({ ...source, state: "completed", remoteTaskId: "remote-unknown", completedAt: 120 }, ownership);
  await store.releaseRun("job-a", "run-a", "owner-a", 130, run.job.executionEpoch);
  await store.markCancelRequested("job-a", "run-a", 140);

  const first = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 141, claimId: "claim-unknown-first"
  })).claims[0];
  await store.completeFunAsrRemoteCancellation({
    jobId: "job-a", runToken: "run-a", operationId: first.operation.operationId,
    provider: first.operation.provider, operationType: first.operation.operationType,
    inputHash: first.operation.inputHash, sourceOperationId: source.operationId,
    remoteTaskId: "remote-unknown", claimId: first.claimId,
    outcome: { status: "unknown", message: "transport timeout" }, completedAt: 150
  });
  const unknown = await store.getOperation("job-a", "run-a", first.operation.operationId);
  assert.equal(unknown.state, "unknown");
  assert.equal(unknown.retryAllowed, true);

  const retried = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 160, claimId: "claim-unknown-retry"
  })).claims[0];
  assert.equal(retried.claimed, true);
  assert.equal(retried.retrying, true);
  assert.equal(retried.operation.state, "submitted");
  assert.equal(retried.operation.remoteTaskId, "remote-unknown");
  const duplicate = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 161, claimId: "claim-unknown-duplicate"
  })).claims[0];
  assert.equal(duplicate.claimed, false, "only one status verification may be in flight for the same remote task");
});

test("FunASR cancellation completion rejects mismatched immutable operation identity", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job({ pipeline: "funasr" }), chunks: [] });
  const run = await store.claimRun("job-a", "run-a", { ownerId: "owner-a", claimedAt: 100, leaseDurationMs: 1_000 });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: run.job.executionEpoch, checkedAt: 110 };
  const source = {
    jobId: "job-a", runToken: "run-a", operationId: "submit-strict-cancel",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:strict"
  };
  await store.prepareOperation(source, ownership);
  await store.updateOperation({ ...source, state: "completed", remoteTaskId: "remote-strict", completedAt: 120 }, ownership);
  await store.releaseRun("job-a", "run-a", "owner-a", 130, run.job.executionEpoch);
  await store.markCancelRequested("job-a", "run-a", 140);
  const claim = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", requestedAt: 141, claimId: "claim-strict"
  })).claims[0];
  const valid = {
    jobId: "job-a", runToken: "run-a", operationId: claim.operation.operationId,
    provider: "dashscope_funasr", operationType: "funasr-cancel", inputHash: "sha256:strict",
    sourceOperationId: "submit-strict-cancel", remoteTaskId: "remote-strict",
    claimId: claim.claimId,
    outcome: { status: "confirmed" }, completedAt: 150
  };
  for (const patch of [
    { remoteTaskId: "wrong-remote" },
    { provider: "wrong-provider" },
    { operationType: "funasr-submit" },
    { inputHash: "sha256:wrong" },
    { sourceOperationId: "wrong-source" }
  ]) {
    assert.equal((await store.completeFunAsrRemoteCancellation({ ...valid, ...patch })).reason, "operation-conflict");
  }
  assert.equal((await store.completeFunAsrRemoteCancellation({ ...valid, operationId: source.operationId })).reason,
    "operation-conflict", "a non-cancel operation must be rejected");
  assert.equal((await store.getOperation("job-a", "run-a", claim.operation.operationId)).state, "submitted");
});

test("an accepted paid operation becomes unknown when its response body cannot be read", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [] });
  const claim = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a",
    claimedAt: 100,
    leaseDurationMs: 1_000
  });
  const ownership = {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 110
  };
  await store.prepareOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "paid-0",
    provider: "openai-compatible",
    operationType: "translation",
    inputHash: "sha256:paid-input"
  }, ownership);
  await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "paid-0",
    state: "accepted",
    providerRequestId: "request-accepted"
  }, ownership);

  const uncertain = await store.updateOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "paid-0",
    state: "unknown",
    error: "response-body-read-failed"
  }, ownership);

  assert.equal(uncertain.applied, true);
  assert.equal(uncertain.operation.state, "unknown");
  assert.equal(uncertain.operation.providerRequestId, "request-accepted");
  assert.equal((await store.getOperation("job-a", "run-a", "paid-0")).state, "unknown");
});

test("operation writes reject stale run, owner, epoch and expired lease", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [] });
  const claim = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a",
    claimedAt: 100,
    leaseDurationMs: 50
  });
  const operation = {
    jobId: "job-a",
    runToken: "run-a",
    operationId: "translation-0",
    provider: "openai-compatible",
    operationType: "translation"
  };

  assert.equal((await store.prepareOperation({ ...operation, runToken: "old-run" }, {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 110
  })).reason, "stale-run");
  assert.equal((await store.prepareOperation(operation, {
    executionOwnerId: "owner-b",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 110
  })).reason, "stale-owner");
  assert.equal((await store.prepareOperation(operation, {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch + 1,
    checkedAt: 110
  })).reason, "stale-epoch");
  assert.equal((await store.prepareOperation(operation, {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 151
  })).reason, "expired-lease");
  assert.deepEqual(await store.listOperations("job-a", "run-a"), []);
});

test("deleting or compacting a job removes its durable operations", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job(), chunks: [] });
  const claim = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-a",
    claimedAt: 100,
    leaseDurationMs: 100
  });
  await store.prepareOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "op-1",
    provider: "funasr",
    operationType: "asr-submit"
  }, {
    executionOwnerId: "owner-a",
    executionEpoch: claim.job.executionEpoch,
    checkedAt: 110
  });

  const deleted = await store.deleteJob("job-a");
  assert.equal(deleted.operations, 1);
  assert.deepEqual(await store.listOperations("job-a"), []);

  await store.putSnapshot({ job: job({ id: "job-b", runToken: "run-b", status: "running" }), chunks: [] });
  const secondClaim = await store.claimRun("job-b", "run-b", {
    ownerId: "owner-b",
    claimedAt: 200,
    leaseDurationMs: 100
  });
  await store.prepareOperation({
    jobId: "job-b",
    runToken: "run-b",
    operationId: "op-2",
    provider: "funasr",
    operationType: "asr-submit"
  }, {
    executionOwnerId: "owner-b",
    executionEpoch: secondClaim.job.executionEpoch,
    checkedAt: 210
  });
  await store.putSnapshot({
    job: job({ id: "job-b", runToken: "run-b", status: "completed", stage: "completed", activeKey: "", updatedAt: 250 }),
    chunks: []
  });
  assert.deepEqual(await store.compactTerminalJobs(251), { deletedJobs: 1 });
  assert.deepEqual(await store.listOperations("job-b"), []);
});

test("expired cleanup atomically retires a run, fences late mirrors and allows a new explicit attempt", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job({ status: "completed", stage: "completed", updatedAt: 100, executionLeaseExpiresAt: 0 }),
    chunks: [chunk("run-a", 0)]
  });
  const retired = await store.deleteExpiredJob({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: 100, cutoff: 101, checkedAt: 101
  });
  assert.equal(retired.applied, true);
  assert.equal((await store.listCleanupClaims({ state: "pending" })).length, 1);
  assert.equal((await store.putSnapshot({
    job: job({ status: "running", stage: "asr", updatedAt: 102 }), chunks: []
  })).reason, "retired-job", "a late ordinary mirror must not recreate a deleted ledger");
  assert.equal((await store.beginAttempt({
    job: job({ runToken: "run-a", status: "running", stage: "asr", updatedAt: 103 }), chunks: []
  }, "")).reason, "retired-run", "even an explicit attempt cannot reuse a retired token");

  const completed = await store.completeCleanupClaim({ key: retired.cleanupClaim.key, completedAt: 103 });
  assert.equal(completed.applied, true);
  assert.equal(completed.cleanupClaim.state, "completed");
  assert.deepEqual(completed.cleanupClaim.resultRefs, []);
  assert.equal((await store.putSnapshot({
    job: job({ status: "running", stage: "asr", updatedAt: 103 }), chunks: []
  })).reason, "retired-job", "the completed cleanup guard fences late mirrors until a new attempt takes over");

  const next = await store.beginAttempt({
    job: job({ runToken: "run-b", status: "running", stage: "asr", updatedAt: 104 }),
    chunks: [chunk("run-b", 0, "queued")]
  }, "");
  assert.equal(next.applied, true);
  assert.equal((await store.getJob("job-a")).runToken, "run-b");
  assert.deepEqual(await store.listCleanupClaims({ jobId: "job-a" }), [], "the new durable run replaces completed retirement guards");
});

test("completed cleanup guards compact only after their secondary TTL while pending claims remain", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job({ status: "completed", stage: "completed", updatedAt: 100, executionLeaseExpiresAt: 0 }), chunks: []
  });
  const retired = await store.deleteExpiredJob({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: 100, cutoff: 101, checkedAt: 101
  });
  await store.completeCleanupClaim({ key: retired.cleanupClaim.key, completedAt: 110 });
  assert.deepEqual(await store.compactCompletedCleanupClaims(110), { deletedClaims: 0 });
  assert.equal((await store.listCleanupClaims({ jobId: "job-a" })).length, 1);
  assert.deepEqual(await store.compactCompletedCleanupClaims(111), { deletedClaims: 1 });
  assert.deepEqual(await store.listCleanupClaims({ jobId: "job-a" }), []);

  await store.putSnapshot({
    job: job({ id: "job-b", runToken: "run-b", status: "completed", stage: "completed", updatedAt: 120, executionLeaseExpiresAt: 0 }), chunks: []
  });
  await store.deleteExpiredJob({
    jobId: "job-b", runToken: "run-b", expectedUpdatedAt: 120, cutoff: 121, checkedAt: 121
  });
  assert.deepEqual(await store.compactCompletedCleanupClaims(1_000_000), { deletedClaims: 0 });
  assert.equal((await store.listCleanupClaims({ state: "pending" })).length, 1, "pending cleanup work is never TTL-compacted");
});

test("expired cleanup rejects a terminal-looking job while its execution lease is active", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job({ status: "completed", stage: "completed", updatedAt: 100, executionLeaseExpiresAt: 200 }),
    chunks: []
  });
  const rejected = await store.deleteExpiredJob({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: 100, cutoff: 150, checkedAt: 150
  });
  assert.equal(rejected.applied, false);
  assert.equal(rejected.reason, "active-lease");
  assert.notEqual(await store.getJob("job-a"), null);
  assert.deepEqual(await store.listCleanupClaims({ state: "pending" }), []);
});

test("audio cache reconciliation deletes empty audio rows and persists verified availability", async () => {
  const store = FuguangJobStore.createMemory();
  const audioRef = "https://fuguang.local/__fuguang_audio_cache/job-a/audio-0.mp3";
  await store.putSnapshot({
    job: job({ status: "completed", stage: "completed", activeKey: "", reusableAudioChunks: 1 }),
    chunks: [{
      key: "job-a:run-a:audio-chunk:0",
      jobRunKey: "job-a:run-a",
      jobId: "job-a",
      runToken: "run-a",
      entryType: "audio-chunk",
      index: 0,
      audioCacheRef: audioRef,
      audioCacheRefs: [audioRef],
      audioParts: [{ index: 0, cacheRef: audioRef }]
    }]
  });

  const result = await store.reconcileAudioCacheRefs("job-a", [audioRef], { verifiedAt: 500 });
  assert.equal(result.applied, true);
  assert.equal(result.deletedChunks, 1);
  assert.equal(result.reusableAudioChunks, 0);
  assert.deepEqual(await store.getChunks("job-a", "run-a"), []);
  assert.deepEqual(
    await store.getJob("job-a").then(current => ({
      audioCacheRemoved: current.audioCacheRemoved,
      audioCacheRemovedCount: current.audioCacheRemovedCount,
      audioCacheVerified: current.audioCacheVerified,
      reusableAudioChunks: current.reusableAudioChunks
    })),
    {
      audioCacheRemoved: true,
      audioCacheRemovedCount: 1,
      audioCacheVerified: true,
      reusableAudioChunks: 0
    }
  );

  const retry = await store.reconcileAudioCacheRefs("job-a", [audioRef], { verifiedAt: 600 });
  assert.equal(retry.applied, true);
  assert.equal(retry.deletedChunks, 0);
  assert.equal((await store.getJob("job-a")).audioCacheRemovedCount, 1, "idempotent retry must not double-count a deleted ref");

  const reconciledJob = await store.getJob("job-a");
  await store.putSnapshot({ job: { ...reconciledJob, updatedAt: 700 }, chunks: [{
    key: "job-a:run-a:audio-chunk:0",
    jobRunKey: "job-a:run-a",
    jobId: "job-a",
    runToken: "run-a",
    entryType: "audio-chunk",
    index: 0,
    audioCacheRef: audioRef,
    audioCacheRefs: [audioRef]
  }] });
  assert.deepEqual(await store.getChunks("job-a", "run-a"), [], "a later mirror must not resurrect a removed cache ref");
});

test("audio cache inventory exposes durable jobs and logical audio rows", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({
    job: job({ status: "running" }),
    chunks: [{
      key: "job-a:run-a:audio-chunk:0",
      jobRunKey: "job-a:run-a",
      jobId: "job-a",
      runToken: "run-a",
      entryType: "audio-chunk",
      index: 0,
      audioCacheRef: "https://fuguang.local/audio.mp3",
      audioCacheRefs: ["https://fuguang.local/audio.mp3"]
    }]
  });

  assert.deepEqual((await store.listJobs()).map(item => item.id), ["job-a"]);
  assert.deepEqual((await store.listAudioChunks()).map(item => item.key), ["job-a:run-a:audio-chunk:0"]);
});

test("operation schema persists FunASR cancellation claim fencing metadata", () => {
  const operation = FuguangJobContract.sanitizeOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-cancel:submit-a",
    provider: "dashscope_funasr",
    operationType: "funasr-cancel",
    inputHash: "sha256:claim-schema",
    state: "submitted",
    claimId: "claim-a",
    claimedAt: 200,
    claimLeaseExpiresAt: 260
  });

  assert.equal(operation.schemaVersion, 2);
  assert.equal(operation.claimId, "claim-a");
  assert.equal(operation.claimedAt, 200);
  assert.equal(operation.claimLeaseExpiresAt, 260);
  const legacy = FuguangJobContract.sanitizeOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "funasr-cancel:legacy",
    provider: "dashscope_funasr",
    operationType: "funasr-cancel",
    state: "submitted"
  });
  assert.equal(legacy.claimId, "");
  assert.equal(legacy.claimedAt, 0);
  assert.equal(legacy.claimLeaseExpiresAt, 0);
});

test("FunASR cancellation claim has one winner and an expired lease can be taken over", async () => {
  const store = FuguangJobStore.createMemory();
  await prepareCancellableFunAsr(store, "claim-race");
  const identity = { jobId: "job-a", runToken: "run-a" };
  const attempts = await Promise.all([
    store.claimFunAsrRemoteCancellations({
      ...identity, claimId: "claim-a", claimedAt: 150, claimLeaseDurationMs: 50
    }),
    store.claimFunAsrRemoteCancellations({
      ...identity, claimId: "claim-b", claimedAt: 150, claimLeaseDurationMs: 50
    })
  ]);
  const claims = attempts.flatMap(result => result.claims);
  const winner = claims.find(claim => claim.claimed);
  const loser = claims.find(claim => !claim.claimed);
  assert.equal(claims.filter(claim => claim.claimed).length, 1);
  assert.ok(winner);
  assert.ok(loser);
  assert.equal(winner.claimId, winner.operation.claimId);
  assert.equal(winner.claimedAt, 150);
  assert.equal(winner.claimLeaseExpiresAt, 200);
  assert.equal(loser.reason, "active-claim");
  assert.equal(loser.claimId, winner.claimId);

  const beforeExpiry = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-c", claimedAt: 199, claimLeaseDurationMs: 50
  })).claims[0];
  assert.equal(beforeExpiry.claimed, false);
  assert.equal(beforeExpiry.reason, "active-claim");

  const takeover = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-d", claimedAt: 200, claimLeaseDurationMs: 50
  })).claims[0];
  assert.equal(takeover.claimed, true);
  assert.equal(takeover.retrying, true);
  assert.equal(takeover.tookOver, true);
  assert.equal(takeover.claimId, "claim-d");
  assert.equal(takeover.claimedAt, 200);
  assert.equal(takeover.claimLeaseExpiresAt, 250);
});

test("FunASR cancellation claim renewal is fenced by claim id and expiry", async () => {
  const store = FuguangJobStore.createMemory();
  await prepareCancellableFunAsr(store, "claim-renew");
  const identity = { jobId: "job-a", runToken: "run-a" };
  const claim = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-a", claimedAt: 150, claimLeaseDurationMs: 50
  })).claims[0];

  const renewed = await store.renewFunAsrRemoteCancellationClaim({
    ...identity,
    operationId: claim.operation.operationId,
    claimId: "claim-a",
    renewedAt: 180,
    claimLeaseDurationMs: 80
  });
  assert.equal(renewed.applied, true);
  assert.equal(renewed.operation.claimedAt, 150);
  assert.equal(renewed.operation.claimLeaseExpiresAt, 260);
  const shorterRenewal = await store.renewFunAsrRemoteCancellationClaim({
    ...identity,
    operationId: claim.operation.operationId,
    claimId: "claim-a",
    renewedAt: 181,
    claimLeaseDurationMs: 10
  });
  assert.equal(shorterRenewal.applied, true);
  assert.equal(shorterRenewal.operation.claimLeaseExpiresAt, 260, "renewal must never shorten an active lease");
  assert.equal((await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-b", claimedAt: 201, claimLeaseDurationMs: 50
  })).claims[0].claimed, false, "renewal must extend the exclusive claim window");
  assert.equal((await store.renewFunAsrRemoteCancellationClaim({
    ...identity, operationId: claim.operation.operationId, claimId: "wrong-claim",
    renewedAt: 220, claimLeaseDurationMs: 50
  })).reason, "stale-claim");
  assert.equal((await store.renewFunAsrRemoteCancellationClaim({
    ...identity, operationId: claim.operation.operationId, claimId: "claim-a",
    renewedAt: 261, claimLeaseDurationMs: 50
  })).reason, "expired-claim");
});

test("late FunASR cancellation completion cannot cross a claim takeover fence", async () => {
  const store = FuguangJobStore.createMemory();
  const { source } = await prepareCancellableFunAsr(store, "claim-complete");
  const identity = { jobId: "job-a", runToken: "run-a" };
  const first = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-a", claimedAt: 150, claimLeaseDurationMs: 50
  })).claims[0];
  const second = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-b", claimedAt: 201, claimLeaseDurationMs: 50
  })).claims[0];
  const completion = (claim, claimId, status, completedAt) => ({
    ...identity,
    operationId: claim.operation.operationId,
    provider: claim.operation.provider,
    operationType: claim.operation.operationType,
    inputHash: claim.operation.inputHash,
    sourceOperationId: source.operationId,
    remoteTaskId: `remote-claim-complete`,
    claimId,
    outcome: { status },
    completedAt
  });

  const late = await store.completeFunAsrRemoteCancellation(completion(first, "claim-a", "confirmed", 202));
  assert.equal(late.applied, false);
  assert.equal(late.reason, "stale-claim");
  assert.equal((await store.getOperation("job-a", "run-a", first.operation.operationId)).claimId, "claim-b");
  assert.equal((await store.getOperation("job-a", "run-a", first.operation.operationId)).state, "submitted");

  const accepted = await store.completeFunAsrRemoteCancellation(completion(second, "claim-b", "confirmed", 203));
  assert.equal(accepted.applied, true);
  assert.equal(accepted.operation.state, "completed");
  const duplicate = await store.completeFunAsrRemoteCancellation(completion(second, "claim-b", "confirmed", 204));
  assert.equal(duplicate.applied, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await store.completeFunAsrRemoteCancellation(
    completion(first, "claim-a", "confirmed", 205)
  )).reason, "stale-claim");
});

test("unknown FunASR cancellation releases its lease for one fenced verification retry", async () => {
  const store = FuguangJobStore.createMemory();
  const { source } = await prepareCancellableFunAsr(store, "claim-unknown");
  const identity = { jobId: "job-a", runToken: "run-a" };
  const first = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-a", claimedAt: 150, claimLeaseDurationMs: 100
  })).claims[0];
  const unknown = await store.completeFunAsrRemoteCancellation({
    ...identity,
    operationId: first.operation.operationId,
    provider: first.operation.provider,
    operationType: first.operation.operationType,
    inputHash: first.operation.inputHash,
    sourceOperationId: source.operationId,
    remoteTaskId: "remote-claim-unknown",
    claimId: "claim-a",
    outcome: { status: "unknown", message: "transport timeout" },
    completedAt: 160
  });
  assert.equal(unknown.operation.state, "unknown");
  assert.equal(unknown.operation.claimLeaseExpiresAt, 0);

  const retry = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-b", claimedAt: 161, claimLeaseDurationMs: 100
  })).claims[0];
  assert.equal(retry.claimed, true);
  assert.equal(retry.retrying, true);
  assert.equal(retry.claimId, "claim-b");
  const duplicate = (await store.claimFunAsrRemoteCancellations({
    ...identity, claimId: "claim-c", claimedAt: 162, claimLeaseDurationMs: 100
  })).claims[0];
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.reason, "active-claim");
});

test("legacy submitted FunASR cancellation gets a grace window before fenced takeover", async () => {
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: job({ pipeline: "funasr", stage: "asr" }), chunks: [] });
  const run = await store.claimRun("job-a", "run-a", {
    ownerId: "owner-legacy", claimedAt: 100, leaseDurationMs: 1_000
  });
  const ownership = { executionOwnerId: "owner-legacy", executionEpoch: run.job.executionEpoch, checkedAt: 110 };
  const source = {
    jobId: "job-a", runToken: "run-a", operationId: "funasr-submit-legacy",
    provider: "dashscope_funasr", operationType: "funasr-submit", inputHash: "sha256:legacy"
  };
  await store.prepareOperation(source, ownership);
  await store.updateOperation({ ...source, state: "completed", remoteTaskId: "remote-legacy", completedAt: 120 }, ownership);
  const legacyCancellation = {
    ...source,
    operationId: `funasr-cancel:${source.operationId}`,
    operationType: "funasr-cancel",
    remoteTaskId: "remote-legacy",
    result: { submitOperationId: source.operationId }
  };
  await store.prepareOperation(legacyCancellation, ownership);
  await store.updateOperation({ ...legacyCancellation, state: "submitted", submittedAt: 140, updatedAt: 140 }, ownership);
  await store.releaseRun("job-a", "run-a", "owner-legacy", 145, run.job.executionEpoch);
  await store.markCancelRequested("job-a", "run-a", 150);

  const withinGrace = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", claimId: "claim-new",
    claimedAt: 189, claimLeaseDurationMs: 50, legacyClaimGraceMs: 50
  })).claims[0];
  assert.equal(withinGrace.claimed, false);
  assert.equal(withinGrace.reason, "legacy-claim-grace");
  assert.equal(withinGrace.claimLeaseExpiresAt, 190);

  const takeover = (await store.claimFunAsrRemoteCancellations({
    jobId: "job-a", runToken: "run-a", claimId: "claim-new",
    claimedAt: 190, claimLeaseDurationMs: 50, legacyClaimGraceMs: 50
  })).claims[0];
  assert.equal(takeover.claimed, true);
  assert.equal(takeover.retrying, true);
  assert.equal(takeover.tookOver, true);
  assert.equal(takeover.claimId, "claim-new");
  assert.equal(takeover.operation.claimLeaseExpiresAt, 240);
});
