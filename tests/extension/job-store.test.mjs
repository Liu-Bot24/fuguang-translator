import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";

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
