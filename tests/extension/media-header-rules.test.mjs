import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const moduleSource = fs.readFileSync(
  new URL("../../extension/src/background/media-header-rules.js", import.meta.url),
  "utf8"
).replace("export const FuguangMediaHeaderRules =", "var FuguangMediaHeaderRules =");

const sessionStorageState = {};
const installedRules = new Map();
let ownerSequence = 0;
const failures = {
  storageGet: 0,
  storageSet: 0,
  dnrGet: 0,
  dnrAdd: 0,
  dnrRemove: 0
};

function clone(value) {
  return structuredClone(value);
}

function failNext(name) {
  failures[name] += 1;
}

function consumeFailure(name) {
  if (!failures[name]) return false;
  failures[name] -= 1;
  return true;
}

function resetHarness() {
  for (const key of Object.keys(sessionStorageState)) delete sessionStorageState[key];
  installedRules.clear();
  for (const key of Object.keys(failures)) failures[key] = 0;
}

function createChrome() {
  return {
    storage: {
      session: {
        async get(key) {
          if (consumeFailure("storageGet")) throw new Error("injected storage get failure");
          const keys = Array.isArray(key) ? key : [key];
          return Object.fromEntries(keys
            .filter(item => Object.hasOwn(sessionStorageState, item))
            .map(item => [item, clone(sessionStorageState[item])]));
        },
        async set(values) {
          if (consumeFailure("storageSet")) throw new Error("injected storage set failure");
          Object.assign(sessionStorageState, clone(values));
        }
      }
    },
    declarativeNetRequest: {
      async getSessionRules() {
        if (consumeFailure("dnrGet")) throw new Error("injected DNR get failure");
        return [...installedRules.values()].map(clone);
      },
      async updateSessionRules({ removeRuleIds = [], addRules = [] }) {
        if (addRules.length && consumeFailure("dnrAdd")) throw new Error("injected DNR add failure");
        if (removeRuleIds.length && !addRules.length && consumeFailure("dnrRemove")) {
          throw new Error("injected DNR remove failure");
        }
        for (const id of removeRuleIds) {
          installedRules.delete(id);
        }
        for (const rule of addRules) {
          installedRules.set(rule.id, clone(rule));
        }
      }
    }
  };
}

function createWorker() {
  const context = vm.createContext({
    URL,
    Map,
    Set,
    Date,
    Math,
    Promise,
    JSON,
    chrome: createChrome(),
    structuredClone,
    crypto: { randomUUID: () => `owner-${++ownerSequence}` }
  });
  vm.runInContext(moduleSource, context, { filename: "media-header-rules.js" });
  return context.FuguangMediaHeaderRules;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const workerA = createWorker();
assert.equal(workerA.buildMediaHeaderRules("https://cdn.example/a.m3u8", "chrome://extensions").length, 0);

const holdA = deferred();
const taskA = workerA.withMediaRequestHeaderRules(
  "https://cdn.example/a.m3u8",
  "https://page.example/watch/1",
  () => holdA.promise,
  "job-a"
);
await new Promise(resolve => setImmediate(resolve));

assert.equal(installedRules.size, 1);
const firstRule = [...installedRules.values()][0];
assert.deepEqual(firstRule.condition.tabIds, [-1], "temporary media headers must only affect requests not originating from a normal tab");
assert.equal(firstRule.condition.tabIds.includes(42), false, "an ordinary page tab must not receive the extraction Referer/Origin override");

const restartedWorker = createWorker();
const recoveredUpdate = await restartedWorker.updateMediaRequestHeaderRuleDomains("job-a", [
  "https://audio-cdn.example/variant.m3u8",
  "https://segment-cdn.example/seg-1.ts"
]);
assert.equal(recoveredUpdate.updated, true, "a restarted worker must recover the active rule session from storage.session");
assert.deepEqual(clone(recoveredUpdate.domains), ["audio-cdn.example", "cdn.example", "segment-cdn.example"]);
assert.equal(installedRules.size, 1);
assert.equal([...installedRules.values()][0].id, firstRule.id, "recovery must update the owned rule instead of allocating a replacement");

const holdB = deferred();
const taskB = restartedWorker.withMediaRequestHeaderRules(
  "https://new-cdn.example/b.m3u8",
  "https://page.example/watch/1",
  () => holdB.promise,
  "job-a"
);
await new Promise(resolve => setImmediate(resolve));

assert.equal(installedRules.size, 1, "a replacement invocation must retire the previous rule instead of leaving conflicting headers active");
const secondRule = [...installedRules.values()].find(rule => rule.id !== firstRule.id);
assert.ok(secondRule);
assert.notEqual(secondRule.id, firstRule.id, "a replacement invocation must not reuse the previous owner's id");

holdA.resolve("old-finished");
assert.equal(await taskA, "old-finished");
assert.equal(installedRules.has(firstRule.id), false);
assert.equal(installedRules.has(secondRule.id), true, "an old finally block must not delete the replacement invocation's rule");

const replacementUpdate = await restartedWorker.updateMediaRequestHeaderRuleDomains("job-a", [
  "https://new-segment.example/seg-2.ts"
]);
assert.equal(replacementUpdate.updated, true);
assert.deepEqual(clone(replacementUpdate.domains), ["new-cdn.example", "new-segment.example"]);
assert.equal(installedRules.has(secondRule.id), true);

holdB.resolve("new-finished");
assert.equal(await taskB, "new-finished");
assert.equal(installedRules.size, 0);

resetHarness();

const leaseInput = (jobId, runToken, source = "https://cdn.example/media.m3u8", pageUrl = "https://page.example/watch/1") => ({
  sourceUrls: [source],
  pageUrl,
  jobId,
  runToken
});

// A Service Worker may disappear permanently after installing a rule. A replacement
// Worker must be able to release the exact persisted lease from a terminal message.
{
  const abandonedWorker = createWorker();
  const acquired = await abandonedWorker.acquireMediaHeaderLease(leaseInput("job-orphan", "run-orphan"));
  assert.equal(acquired.applied, true);
  assert.equal(installedRules.has(acquired.lease.ruleId), true);

  const replacementWorker = createWorker();
  const released = await replacementWorker.releaseMediaHeaderLease(acquired.lease);
  assert.deepEqual(clone({
    released: released.released,
    alreadyAbsent: released.alreadyAbsent,
    metadataPending: released.metadataPending
  }), { released: true, alreadyAbsent: false, metadataPending: false });
  assert.equal(installedRules.size, 0);
  const duplicate = await replacementWorker.releaseMediaHeaderLease(acquired.lease);
  assert.equal(duplicate.released, true);
  assert.equal(duplicate.alreadyAbsent, true);
}

resetHarness();

// Startup reconciliation must retain leases that the offscreen runtime reports as active.
{
  const worker = createWorker();
  const acquired = await worker.acquireMediaHeaderLease(leaseInput("job-active", "run-active"));
  const restarted = createWorker();
  const reconciled = await restarted.reconcileMediaHeaderLeases({
    offscreenPresent: true,
    queryAuthoritative: true,
    activeLeases: [acquired.lease]
  });
  assert.deepEqual(clone(reconciled.removedRuleIds), []);
  assert.deepEqual(clone(reconciled.retainedLeaseTokens), [acquired.lease.leaseToken]);
  assert.equal(installedRules.has(acquired.lease.ruleId), true);
  await restarted.releaseMediaHeaderLease(acquired.lease);
}

resetHarness();

// With no offscreen document, a persisted lease is proven orphaned and startup
// reconciliation must remove both its rule and ownership record.
{
  const worker = createWorker();
  const acquired = await worker.acquireMediaHeaderLease(leaseInput("job-startup-orphan", "run-startup-orphan"));
  const restarted = createWorker();
  const reconciled = await restarted.reconcileMediaHeaderLeases({
    offscreenPresent: false,
    queryAuthoritative: true,
    activeLeases: []
  });
  assert.deepEqual(clone(reconciled.removedRuleIds), [acquired.lease.ruleId]);
  assert.equal(installedRules.size, 0);
  assert.equal((await restarted.releaseMediaHeaderLease(acquired.lease)).alreadyAbsent, true);
}

resetHarness();

// An authoritative offscreen snapshot that omits a persisted lease proves that
// no running extraction owns it, even when the offscreen document itself exists.
{
  const worker = createWorker();
  const acquired = await worker.acquireMediaHeaderLease(leaseInput("job-idle-offscreen", "run-idle-offscreen"));
  const restarted = createWorker();
  const reconciled = await restarted.reconcileMediaHeaderLeases({
    offscreenPresent: true,
    queryAuthoritative: true,
    activeLeases: []
  });
  assert.deepEqual(clone(reconciled.removedRuleIds), [acquired.lease.ruleId]);
  assert.equal(installedRules.has(acquired.lease.ruleId), false);
}

resetHarness();

// An unavailable active-lease query is not proof that work is idle.
{
  const worker = createWorker();
  const acquired = await worker.acquireMediaHeaderLease(leaseInput("job-query-unknown", "run-query-unknown"));
  const restarted = createWorker();
  const reconciled = await restarted.reconcileMediaHeaderLeases({
    offscreenPresent: true,
    queryAuthoritative: false,
    activeLeases: []
  });
  assert.equal(reconciled.deferred, true);
  assert.deepEqual(clone(reconciled.removedRuleIds), []);
  assert.equal(installedRules.has(acquired.lease.ruleId), true);
  await restarted.releaseMediaHeaderLease(acquired.lease);
}

resetHarness();

// The public lease is fenced by token, rule id, job id and run token. A forged
// or stale run identity must not be allowed to remove the stored owner.
{
  const worker = createWorker();
  const lease = (await worker.acquireMediaHeaderLease(leaseInput("job-exact", "run-exact"))).lease;
  const wrongRun = { ...lease, runToken: "run-stale" };
  const rejectedRelease = await worker.releaseMediaHeaderLease(wrongRun);
  const rejectedUpdate = await worker.updateMediaHeaderLeaseDomains(wrongRun, ["https://wrong.example/segment.ts"]);
  assert.equal(rejectedRelease.released, false);
  assert.equal(rejectedRelease.reason, "stale-lease");
  assert.equal(rejectedUpdate.updated, false);
  assert.equal(rejectedUpdate.reason, "stale-lease");
  assert.equal(installedRules.has(lease.ruleId), true);
  await worker.releaseMediaHeaderLease(lease);
}

resetHarness();

// A late terminal from an old run must not release or update the replacement run.
{
  const worker = createWorker();
  const oldLease = (await worker.acquireMediaHeaderLease(leaseInput("job-fenced", "run-old"))).lease;
  await worker.releaseMediaHeaderLease(oldLease);
  const nextLease = (await worker.acquireMediaHeaderLease(leaseInput(
    "job-fenced",
    "run-new",
    "https://new-cdn.example/media.m3u8",
    "https://page.example/watch/2"
  ))).lease;
  const nextRuleBefore = clone(installedRules.get(nextLease.ruleId));

  const lateRelease = await worker.releaseMediaHeaderLease(oldLease);
  const lateUpdate = await worker.updateMediaHeaderLeaseDomains(oldLease, ["https://late.example/segment.ts"]);
  assert.equal(lateRelease.alreadyAbsent, true);
  assert.equal(lateUpdate.updated, false);
  assert.equal(lateUpdate.reason, "stale-lease");
  assert.deepEqual(installedRules.get(nextLease.ruleId), nextRuleBefore);
  await worker.releaseMediaHeaderLease(nextLease);
}

resetHarness();

// Persist failure after DNR installation must roll the new rule back.
{
  const worker = createWorker();
  failNext("storageSet");
  await assert.rejects(
    worker.acquireMediaHeaderLease(leaseInput("job-acquire-store-fail", "run-acquire-store-fail")),
    /storage set failure/
  );
  assert.equal(installedRules.size, 0);
}

resetHarness();

// A trusted full lease remains sufficient to remove its exact rule when the
// ownership metadata cannot be read. Metadata is reconciled later.
{
  const worker = createWorker();
  const lease = (await worker.acquireMediaHeaderLease(leaseInput("job-release-get-fail", "run-release-get-fail"))).lease;
  failNext("storageGet");
  const released = await worker.releaseMediaHeaderLease(lease);
  assert.equal(released.released, true);
  assert.equal(released.metadataPending, true);
  assert.equal(installedRules.has(lease.ruleId), false);
}

resetHarness();

// DNR removal failure must remain retryable and must keep durable ownership.
{
  const worker = createWorker();
  const lease = (await worker.acquireMediaHeaderLease(leaseInput("job-release-dnr-fail", "run-release-dnr-fail"))).lease;
  failNext("dnrRemove");
  const failed = await worker.releaseMediaHeaderLease(lease);
  assert.equal(failed.released, false);
  assert.equal(failed.retryable, true);
  assert.equal(failed.reason, "dnr-remove-failed");
  assert.equal(installedRules.has(lease.ruleId), true);
  const retry = await worker.releaseMediaHeaderLease(lease);
  assert.equal(retry.released, true);
  assert.equal(installedRules.has(lease.ruleId), false);
}

resetHarness();

// Once DNR is gone, a metadata write failure must not force terminal delivery
// to retry a destructive action that has already succeeded.
{
  const worker = createWorker();
  const lease = (await worker.acquireMediaHeaderLease(leaseInput("job-release-set-fail", "run-release-set-fail"))).lease;
  failNext("storageSet");
  const released = await worker.releaseMediaHeaderLease(lease);
  assert.equal(released.released, true);
  assert.equal(released.metadataPending, true);
  assert.equal(installedRules.has(lease.ruleId), false);
}

resetHarness();

// Different tasks may target the same CDN. Ownership and cleanup must remain
// exact even though the DNR request domain is shared.
{
  const workerA2 = createWorker();
  const leaseA = (await workerA2.acquireMediaHeaderLease(leaseInput(
    "job-same-cdn-a", "run-same-cdn-a", "https://shared-cdn.example/a.m3u8", "https://page-a.example/watch"
  ))).lease;
  const workerB2 = createWorker();
  const leaseB = (await workerB2.acquireMediaHeaderLease(leaseInput(
    "job-same-cdn-b", "run-same-cdn-b", "https://shared-cdn.example/b.m3u8", "https://page-b.example/watch"
  ))).lease;
  assert.notEqual(leaseA.leaseToken, leaseB.leaseToken);
  assert.notEqual(leaseA.ruleId, leaseB.ruleId);
  await workerB2.releaseMediaHeaderLease(leaseA);
  assert.equal(installedRules.has(leaseA.ruleId), false);
  assert.equal(installedRules.has(leaseB.ruleId), true);
  await workerB2.releaseMediaHeaderLease(leaseB);
  assert.equal(installedRules.size, 0);
}

console.log("media header rules tests passed");
