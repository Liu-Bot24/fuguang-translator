import { FuguangJobContract } from "../shared/job-contract.js";

export const FuguangJobStore = (() => {
  const DB_NAME = "liusheng-job-runtime";
  const DB_VERSION = 1;
  const JOBS_STORE = "jobs";
  const CHUNKS_STORE = "chunks";

  function create(options = {}) {
    const indexedDb = options.indexedDB ?? globalThis.indexedDB;
    if (!indexedDb?.open) {
      return createDisabledStore();
    }
    let dbPromise = null;

    function openDb() {
      if (!dbPromise) {
        dbPromise = requestToPromise(openDatabase(indexedDb, options.dbName || DB_NAME)).catch(error => {
          dbPromise = null;
          throw error;
        });
      }
      return dbPromise;
    }

    async function transact(storeNames, mode, action) {
      const db = await openDb();
      const transaction = db.transaction(storeNames, mode);
      const stores = Object.fromEntries(storeNames.map(name => [name, transaction.objectStore(name)]));
      try {
        const result = await action(stores, transaction);
        await transactionToPromise(transaction);
        return result;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // The transaction may already have reached a terminal state.
        }
        throw error;
      }
    }

    async function putSnapshot(snapshot = {}) {
      const job = snapshot.job;
      if (!job?.id || !job?.runToken) {
        throw new Error("Job snapshot requires id and runToken.");
      }
      const chunks = Array.isArray(snapshot.chunks) ? snapshot.chunks : [];
      return transact([JOBS_STORE, CHUNKS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(job.id));
        if (current?.runToken && current.runToken !== job.runToken) {
          return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
        }
        const terminalRegression = rejectTerminalRegression(current, job);
        if (terminalRegression) {
          return terminalRegression;
        }
        if (Number(current?.updatedAt || 0) > Number(job.updatedAt || 0)) {
          return { applied: false, reason: "stale-snapshot", currentRunToken: current.runToken };
        }
        const nextJob = mergeRuntimeOwnedJobFields(current, job);
        await requestToPromise(stores[JOBS_STORE].put(nextJob));
        for (const chunk of chunks) {
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
            await requestToPromise(stores[CHUNKS_STORE].put(chunk));
          }
        }
        return { applied: true, chunks: chunks.length };
      });
    }

    async function putSnapshotIfOwned(snapshot = {}, ownership = {}) {
      const job = snapshot.job;
      if (!job?.id || !job?.runToken) {
        throw new Error("Owned job snapshot requires id and runToken.");
      }
      const chunks = Array.isArray(snapshot.chunks) ? snapshot.chunks : [];
      return transact([JOBS_STORE, CHUNKS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(job.id));
        const rejection = rejectOwnedSnapshot(current, job, ownership);
        if (rejection) {
          return rejection;
        }
        if (Number(current.updatedAt || 0) > Number(job.updatedAt || 0)) {
          return { applied: false, reason: "stale-snapshot", currentRunToken: current.runToken };
        }
        const nextJob = mergeRuntimeOwnedJobFields(current, job);
        await requestToPromise(stores[JOBS_STORE].put(nextJob));
        for (const chunk of chunks) {
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
            await requestToPromise(stores[CHUNKS_STORE].put(chunk));
          }
        }
        return { applied: true, chunks: chunks.length, job: nextJob };
      });
    }

    async function beginAttempt(input, previousRunToken = "") {
      const snapshot = normalizeAttemptSnapshot(input);
      const job = snapshot.job;
      if (!job?.id || !job?.runToken) {
        throw new Error("Job attempt requires id and runToken.");
      }
      return transact([JOBS_STORE, CHUNKS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(job.id));
        if (current && String(current.runToken || "") !== String(previousRunToken || "")) {
          return { applied: false, reason: "run-token-conflict", currentRunToken: current.runToken };
        }
        await requestToPromise(stores[JOBS_STORE].put(job));
        for (const chunk of snapshot.chunks) {
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
            await requestToPromise(stores[CHUNKS_STORE].put(chunk));
          }
        }
        return {
          applied: true,
          previousRunToken: current?.runToken || "",
          chunks: snapshot.chunks.length
        };
      });
    }

    async function markCancelRequested(jobId, runToken, requestedAt = Date.now()) {
      return transact([JOBS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(jobId));
        if (!current) {
          return { applied: false, reason: "missing-job" };
        }
        if (String(current.runToken || "") !== String(runToken || "")) {
          return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
        }
        const next = {
          ...current,
          cancelRequested: true,
          cancelRequestedAt: Number(requestedAt) || Date.now(),
          updatedAt: Math.max(Number(current.updatedAt || 0), Number(requestedAt || 0) || Date.now())
        };
        await requestToPromise(stores[JOBS_STORE].put(next));
        return { applied: true, job: next };
      });
    }

    async function claimRun(jobId, runToken, options = {}) {
      return transact([JOBS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(jobId));
        const result = claimRunJob(current, runToken, options);
        if (!result.applied) {
          return result;
        }
        const next = result.job;
        await requestToPromise(stores[JOBS_STORE].put(next));
        return result;
      });
    }

    async function renewRunLease(jobId, runToken, ownerId, renewedAt = Date.now(), leaseDurationMs, executionEpoch) {
      return transact([JOBS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(jobId));
        const result = renewRunLeaseJob(current, runToken, ownerId, renewedAt, leaseDurationMs, executionEpoch);
        if (!result.applied) {
          return result;
        }
        await requestToPromise(stores[JOBS_STORE].put(result.job));
        return result;
      });
    }

    async function releaseRun(jobId, runToken, ownerId, releasedAt = Date.now(), executionEpoch) {
      return transact([JOBS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(jobId));
        const result = releaseRunJob(current, runToken, ownerId, releasedAt, executionEpoch);
        if (!result.applied) {
          return result;
        }
        await requestToPromise(stores[JOBS_STORE].put(result.job));
        return result;
      });
    }

    async function getJob(jobId) {
      return transact([JOBS_STORE], "readonly", stores => requestToPromise(stores[JOBS_STORE].get(jobId)));
    }

    async function getSnapshot(jobId, runToken = "") {
      return transact([JOBS_STORE, CHUNKS_STORE], "readonly", async stores => {
        const [job, chunks] = await Promise.all([
          requestToPromise(stores[JOBS_STORE].get(jobId)),
          requestToPromise(stores[CHUNKS_STORE].index("jobId").getAll(jobId))
        ]);
        return {
          job: job || null,
          chunks: chunks
            .filter(chunk => !runToken || chunk.runToken === runToken)
            .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
        };
      });
    }

    async function findActiveJob(activeKey) {
      if (!activeKey) {
        return null;
      }
      return transact([JOBS_STORE], "readonly", stores => requestToPromise(stores[JOBS_STORE].index("activeKey").get(activeKey)));
    }

    async function getChunks(jobId, runToken = "") {
      return transact([CHUNKS_STORE], "readonly", async stores => {
        const chunks = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAll(jobId));
        return chunks
          .filter(chunk => !runToken || chunk.runToken === runToken)
          .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
      });
    }

    async function listRecoverableJobs() {
      return transact([JOBS_STORE], "readonly", async stores => {
        const jobs = await requestToPromise(stores[JOBS_STORE].getAll());
        return jobs
          .filter(job => !FuguangJobContract.isTerminalStatus(job?.status))
          .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0));
      });
    }

    async function deleteJob(jobId) {
      return transact([JOBS_STORE, CHUNKS_STORE], "readwrite", async stores => {
        const chunks = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAllKeys(jobId));
        for (const key of chunks) {
          await requestToPromise(stores[CHUNKS_STORE].delete(key));
        }
        await requestToPromise(stores[JOBS_STORE].delete(jobId));
        return { deleted: true, chunks: chunks.length };
      });
    }

    async function compactTerminalJobs(olderThan) {
      const cutoff = Number(olderThan || 0);
      const jobs = await transact([JOBS_STORE], "readonly", stores => requestToPromise(stores[JOBS_STORE].getAll()));
      const expired = jobs.filter(job => FuguangJobContract.isTerminalStatus(job?.status) && Number(job.updatedAt || 0) < cutoff);
      for (const job of expired) {
        await deleteJob(job.id);
      }
      return { deletedJobs: expired.length };
    }

    async function close() {
      const current = dbPromise;
      dbPromise = null;
      if (current) {
        const db = await current.catch(() => null);
        db?.close?.();
      }
    }

    return {
      available: true,
      beginAttempt,
      claimRun,
      close,
      compactTerminalJobs,
      deleteJob,
      findActiveJob,
      getChunks,
      getJob,
      getSnapshot,
      listRecoverableJobs,
      markCancelRequested,
      putSnapshot,
      putSnapshotIfOwned,
      releaseRun,
      renewRunLease
    };
  }

  function createMemory() {
    const jobs = new Map();
    const chunks = new Map();

    async function putSnapshot(snapshot = {}) {
      const job = clone(snapshot.job);
      if (!job?.id || !job?.runToken) {
        throw new Error("Job snapshot requires id and runToken.");
      }
      const current = jobs.get(job.id);
      if (current?.runToken && current.runToken !== job.runToken) {
        return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
      }
      const terminalRegression = rejectTerminalRegression(current, job);
      if (terminalRegression) {
        return terminalRegression;
      }
      if (Number(current?.updatedAt || 0) > Number(job.updatedAt || 0)) {
        return { applied: false, reason: "stale-snapshot", currentRunToken: current.runToken };
      }
      jobs.set(job.id, mergeRuntimeOwnedJobFields(current, job));
      for (const chunk of snapshot.chunks || []) {
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
          chunks.set(chunk.key, clone(chunk));
        }
      }
      return { applied: true, chunks: (snapshot.chunks || []).length };
    }

    async function putSnapshotIfOwned(snapshot = {}, ownership = {}) {
      const job = clone(snapshot.job);
      if (!job?.id || !job?.runToken) {
        throw new Error("Owned job snapshot requires id and runToken.");
      }
      const current = jobs.get(job.id);
      const rejection = rejectOwnedSnapshot(current, job, ownership);
      if (rejection) {
        return clone(rejection);
      }
      if (Number(current.updatedAt || 0) > Number(job.updatedAt || 0)) {
        return { applied: false, reason: "stale-snapshot", currentRunToken: current.runToken };
      }
      const nextJob = mergeRuntimeOwnedJobFields(current, job);
      jobs.set(job.id, nextJob);
      for (const chunk of snapshot.chunks || []) {
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
          chunks.set(chunk.key, clone(chunk));
        }
      }
      return clone({ applied: true, chunks: (snapshot.chunks || []).length, job: nextJob });
    }

    async function beginAttempt(input, previousRunToken = "") {
      const snapshot = normalizeAttemptSnapshot(input);
      const job = snapshot.job;
      const current = jobs.get(job?.id);
      if (current && String(current.runToken || "") !== String(previousRunToken || "")) {
        return { applied: false, reason: "run-token-conflict", currentRunToken: current.runToken };
      }
      jobs.set(job.id, clone(job));
      for (const chunk of snapshot.chunks) {
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key) {
          chunks.set(chunk.key, clone(chunk));
        }
      }
      return {
        applied: true,
        previousRunToken: current?.runToken || "",
        chunks: snapshot.chunks.length
      };
    }

    async function markCancelRequested(jobId, runToken, requestedAt = Date.now()) {
      const current = jobs.get(jobId);
      if (!current) {
        return { applied: false, reason: "missing-job" };
      }
      if (String(current.runToken || "") !== String(runToken || "")) {
        return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
      }
      const next = {
        ...current,
        cancelRequested: true,
        cancelRequestedAt: Number(requestedAt) || Date.now(),
        updatedAt: Math.max(Number(current.updatedAt || 0), Number(requestedAt || 0) || Date.now())
      };
      jobs.set(jobId, next);
      return { applied: true, job: clone(next) };
    }

    async function claimRun(jobId, runToken, options = {}) {
      const current = jobs.get(jobId);
      const result = claimRunJob(current, runToken, options);
      if (result.applied) {
        jobs.set(jobId, result.job);
      }
      return clone(result);
    }

    async function renewRunLease(jobId, runToken, ownerId, renewedAt = Date.now(), leaseDurationMs, executionEpoch) {
      const result = renewRunLeaseJob(jobs.get(jobId), runToken, ownerId, renewedAt, leaseDurationMs, executionEpoch);
      if (result.applied) {
        jobs.set(jobId, result.job);
      }
      return clone(result);
    }

    async function releaseRun(jobId, runToken, ownerId, releasedAt = Date.now(), executionEpoch) {
      const result = releaseRunJob(jobs.get(jobId), runToken, ownerId, releasedAt, executionEpoch);
      if (result.applied) {
        jobs.set(jobId, result.job);
      }
      return clone(result);
    }

    async function getJob(jobId) {
      return clone(jobs.get(jobId) || null);
    }

    async function getSnapshot(jobId, runToken = "") {
      const job = clone(jobs.get(jobId) || null);
      const matchingChunks = [...chunks.values()]
        .filter(chunk => chunk.jobId === jobId && (!runToken || chunk.runToken === runToken))
        .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
        .map(clone);
      return { job, chunks: matchingChunks };
    }

    async function findActiveJob(activeKey) {
      const found = [...jobs.values()].find(job => job.activeKey === activeKey) || null;
      return clone(found);
    }

    async function getChunks(jobId, runToken = "") {
      return [...chunks.values()]
        .filter(chunk => chunk.jobId === jobId && (!runToken || chunk.runToken === runToken))
        .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
        .map(clone);
    }

    async function listRecoverableJobs() {
      return [...jobs.values()]
        .filter(job => !FuguangJobContract.isTerminalStatus(job?.status))
        .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0))
        .map(clone);
    }

    async function deleteJob(jobId) {
      let deletedChunks = 0;
      for (const [key, chunk] of chunks) {
        if (chunk.jobId === jobId) {
          chunks.delete(key);
          deletedChunks += 1;
        }
      }
      jobs.delete(jobId);
      return { deleted: true, chunks: deletedChunks };
    }

    async function compactTerminalJobs(olderThan) {
      const cutoff = Number(olderThan || 0);
      const expired = [...jobs.values()].filter(job => FuguangJobContract.isTerminalStatus(job?.status) && Number(job.updatedAt || 0) < cutoff);
      for (const job of expired) {
        await deleteJob(job.id);
      }
      return { deletedJobs: expired.length };
    }

    return {
      available: true,
      beginAttempt,
      claimRun,
      close: async () => {},
      compactTerminalJobs,
      deleteJob,
      findActiveJob,
      getChunks,
      getJob,
      getSnapshot,
      listRecoverableJobs,
      markCancelRequested,
      putSnapshot,
      putSnapshotIfOwned,
      releaseRun,
      renewRunLease
    };
  }

  function createDisabledStore() {
    return {
      available: false,
      beginAttempt: async () => ({ applied: false, reason: "unavailable" }),
      claimRun: async () => ({ applied: false, reason: "unavailable" }),
      close: async () => {},
      compactTerminalJobs: async () => ({ deletedJobs: 0 }),
      deleteJob: async () => ({ deleted: false, chunks: 0 }),
      findActiveJob: async () => null,
      getChunks: async () => [],
      getJob: async () => null,
      getSnapshot: async () => ({ job: null, chunks: [] }),
      listRecoverableJobs: async () => [],
      markCancelRequested: async () => ({ applied: false, reason: "unavailable" }),
      putSnapshot: async () => ({ applied: false, reason: "unavailable" }),
      putSnapshotIfOwned: async () => ({ applied: false, reason: "unavailable" }),
      releaseRun: async () => ({ applied: false, reason: "unavailable" }),
      renewRunLease: async () => ({ applied: false, reason: "unavailable" })
    };
  }

  function claimRunJob(current, runToken, options = {}) {
    if (!current) {
      return { applied: false, reason: "missing-job" };
    }
    if (String(current.runToken || "") !== String(runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
    }
    if (FuguangJobContract.isTerminalStatus(current.status)) {
      return { applied: false, reason: "terminal-job" };
    }
    const lease = normalizeLeaseOptions(options);
    const activeLease = current.executionRunToken === runToken &&
      current.executionOwnerId &&
      Number(current.executionLeaseExpiresAt || 0) > lease.claimedAt;
    if (activeLease) {
      return {
        applied: false,
        reason: "duplicate-run",
        executionOwnerId: current.executionOwnerId,
        executionEpoch: positiveEpoch(current.executionEpoch),
        executionStartedAt: current.executionStartedAt,
        executionLeaseExpiresAt: current.executionLeaseExpiresAt
      };
    }
    const next = {
      ...current,
      executionRunToken: runToken,
      executionOwnerId: lease.ownerId,
      executionEpoch: positiveEpoch(current.executionEpoch) + 1,
      executionStartedAt: current.executionRunToken === runToken && current.executionStartedAt
        ? current.executionStartedAt
        : lease.claimedAt,
      executionHeartbeatAt: lease.claimedAt,
      executionLeaseExpiresAt: lease.claimedAt + lease.leaseDurationMs
    };
    delete next.executionReleasedAt;
    return {
      applied: true,
      tookOver: Boolean(current.executionRunToken === runToken && current.executionStartedAt && !activeLease),
      job: next
    };
  }

  function rejectTerminalRegression(current, job) {
    if (!current ||
        String(current.runToken || "") !== String(job?.runToken || "") ||
        !FuguangJobContract.isTerminalStatus(current.status) ||
        FuguangJobContract.isTerminalStatus(job?.status)) {
      return null;
    }
    return {
      applied: false,
      reason: "terminal-regression",
      currentRunToken: current.runToken,
      currentStatus: current.status
    };
  }

  function rejectOwnedSnapshot(current, job, ownership = {}) {
    if (!current) {
      return { applied: false, reason: "missing-job" };
    }
    if (String(current.runToken || "") !== String(job.runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
    }
    const ownerId = String(ownership.executionOwnerId || ownership.ownerId || "");
    if (!ownerId || String(current.executionOwnerId || "") !== ownerId) {
      return { applied: false, reason: "stale-owner", executionOwnerId: current.executionOwnerId || "" };
    }
    const executionEpoch = positiveEpoch(ownership.executionEpoch);
    if (!executionEpoch || positiveEpoch(current.executionEpoch) !== executionEpoch) {
      return { applied: false, reason: "stale-epoch", executionEpoch: positiveEpoch(current.executionEpoch) };
    }
    if (String(current.executionRunToken || "") !== String(job.runToken || "")) {
      return { applied: false, reason: "stale-owner", executionOwnerId: current.executionOwnerId || "" };
    }
    const checkedAt = finiteTimestamp(ownership.checkedAt);
    if (Number(current.executionLeaseExpiresAt || 0) <= checkedAt) {
      return { applied: false, reason: "expired-lease", executionLeaseExpiresAt: Number(current.executionLeaseExpiresAt || 0) || 0 };
    }
    if (FuguangJobContract.isTerminalStatus(current.status) || current.cancelRequested) {
      return { applied: false, reason: "inactive-job" };
    }
    return null;
  }

  function renewRunLeaseJob(current, runToken, ownerId, renewedAt = Date.now(), leaseDurationMs, executionEpoch) {
    if (!current) {
      return { applied: false, reason: "missing-job" };
    }
    if (String(current.runToken || "") !== String(runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
    }
    if (String(current.executionOwnerId || "") !== String(ownerId || "")) {
      return { applied: false, reason: "stale-owner", executionOwnerId: current.executionOwnerId || "" };
    }
    if (positiveEpoch(current.executionEpoch) !== positiveEpoch(executionEpoch)) {
      return { applied: false, reason: "stale-epoch", executionEpoch: positiveEpoch(current.executionEpoch) };
    }
    if (FuguangJobContract.isTerminalStatus(current.status) || current.cancelRequested) {
      return { applied: false, reason: "inactive-job" };
    }
    const heartbeatAt = finiteTimestamp(renewedAt);
    const duration = positiveDuration(leaseDurationMs);
    const next = {
      ...current,
      executionHeartbeatAt: heartbeatAt,
      executionLeaseExpiresAt: heartbeatAt + duration
    };
    return { applied: true, job: next };
  }

  function releaseRunJob(current, runToken, ownerId, releasedAt = Date.now(), executionEpoch) {
    if (!current) {
      return { applied: false, reason: "missing-job" };
    }
    if (String(current.runToken || "") !== String(runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken };
    }
    if (String(current.executionOwnerId || "") !== String(ownerId || "")) {
      return { applied: false, reason: "stale-owner", executionOwnerId: current.executionOwnerId || "" };
    }
    if (positiveEpoch(current.executionEpoch) !== positiveEpoch(executionEpoch)) {
      return { applied: false, reason: "stale-epoch", executionEpoch: positiveEpoch(current.executionEpoch) };
    }
    const timestamp = finiteTimestamp(releasedAt);
    const next = { ...current, executionReleasedAt: timestamp };
    delete next.executionRunToken;
    delete next.executionOwnerId;
    delete next.executionStartedAt;
    delete next.executionHeartbeatAt;
    delete next.executionLeaseExpiresAt;
    return { applied: true, job: next };
  }

  function normalizeLeaseOptions(options = {}) {
    const normalized = typeof options === "number" ? { claimedAt: options } : (options || {});
    return {
      ownerId: String(normalized.ownerId || "legacy-runtime"),
      claimedAt: finiteTimestamp(normalized.claimedAt),
      leaseDurationMs: positiveDuration(normalized.leaseDurationMs)
    };
  }

  function finiteTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : Date.now();
  }

  function positiveDuration(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 30_000;
  }

  function positiveEpoch(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
  }

  function mergeRuntimeOwnedJobFields(current, job) {
    if (!current || current.runToken !== job.runToken) {
      return job;
    }
    const next = { ...job };
    if (current.executionEpoch != null) {
      next.executionEpoch = positiveEpoch(current.executionEpoch);
    }
    if (current.executionRunToken === job.runToken && current.executionStartedAt) {
      for (const field of [
        "executionRunToken",
        "executionOwnerId",
        "executionStartedAt",
        "executionHeartbeatAt",
        "executionLeaseExpiresAt"
      ]) {
        if (current[field] != null) {
          next[field] = current[field];
        }
      }
    }
    if (current.cancelRequested) {
      next.cancelRequested = true;
      next.cancelRequestedAt = current.cancelRequestedAt;
    }
    return next;
  }

  function normalizeAttemptSnapshot(input = {}) {
    if (input?.job) {
      return {
        job: input.job,
        chunks: Array.isArray(input.chunks) ? input.chunks : []
      };
    }
    return { job: input, chunks: [] };
  }

  function openDatabase(indexedDb, dbName) {
    const request = indexedDb.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const jobs = db.objectStoreNames.contains(JOBS_STORE)
        ? request.transaction.objectStore(JOBS_STORE)
        : db.createObjectStore(JOBS_STORE, { keyPath: "id" });
      ensureIndex(jobs, "status", "status");
      ensureIndex(jobs, "updatedAt", "updatedAt");
      ensureIndex(jobs, "activeKey", "activeKey");
      const chunks = db.objectStoreNames.contains(CHUNKS_STORE)
        ? request.transaction.objectStore(CHUNKS_STORE)
        : db.createObjectStore(CHUNKS_STORE, { keyPath: "key" });
      ensureIndex(chunks, "jobId", "jobId");
      ensureIndex(chunks, "jobRunKey", "jobRunKey");
      ensureIndex(chunks, "updatedAt", "updatedAt");
    };
    return request;
  }

  function ensureIndex(store, name, keyPath) {
    if (!store.indexNames.contains(name)) {
      store.createIndex(name, keyPath, { unique: false });
    }
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    });
  }

  function clone(value) {
    if (value == null) {
      return value;
    }
    if (typeof globalThis.structuredClone === "function") {
      return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  return {
    DB_NAME,
    DB_VERSION,
    create,
    createMemory
  };
})();
