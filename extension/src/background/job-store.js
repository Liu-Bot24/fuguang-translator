import { FuguangJobContract } from "../shared/job-contract.js";

export const FuguangJobStore = (() => {
  const DB_NAME = "liusheng-job-runtime";
  const DB_VERSION = 3;
  const JOBS_STORE = "jobs";
  const CHUNKS_STORE = "chunks";
  const OPERATIONS_STORE = "operations";
  const CLEANUP_CLAIMS_STORE = "cleanupClaims";
  const DEFAULT_FUNASR_CANCELLATION_CLAIM_LEASE_MS = 30_000;
  const DEFAULT_FUNASR_CANCELLATION_LEGACY_GRACE_MS = 30_000;

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
      return transact([JOBS_STORE, CHUNKS_STORE, CLEANUP_CLAIMS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(job.id));
        if (!current && await hasRetirementGuard(stores[CLEANUP_CLAIMS_STORE], job.id)) {
          return { applied: false, reason: "retired-job" };
        }
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
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, nextJob)) {
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
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, nextJob)) {
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
      return transact([JOBS_STORE, CHUNKS_STORE, CLEANUP_CLAIMS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(job.id));
        if (current && String(current.runToken || "") !== String(previousRunToken || "")) {
          return { applied: false, reason: "run-token-conflict", currentRunToken: current.runToken };
        }
        if (!current && await hasRetiredRunGuard(stores[CLEANUP_CLAIMS_STORE], job.id, job.runToken)) {
          return { applied: false, reason: "retired-run" };
        }
        await requestToPromise(stores[JOBS_STORE].put(job));
        for (const chunk of snapshot.chunks) {
          if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, job)) {
            await requestToPromise(stores[CHUNKS_STORE].put(chunk));
          }
        }
        const priorClaims = await requestToPromise(stores[CLEANUP_CLAIMS_STORE].index("jobId").getAll(job.id));
        for (const claim of priorClaims) {
          if (claim.state === "completed") {
            await requestToPromise(stores[CLEANUP_CLAIMS_STORE].delete(claim.key));
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
        if (current.cancelRequested) {
          return { applied: false, reason: "already-cancelled", job: current };
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

    async function prepareOperation(input = {}, ownership = {}) {
      const operation = normalizePreparedOperation(input, ownership);
      assertOperationIdentity(operation);
      return transact([JOBS_STORE, OPERATIONS_STORE], "readwrite", async stores => {
        const currentJob = await requestToPromise(stores[JOBS_STORE].get(operation.jobId));
        const rejection = rejectOwnedOperation(currentJob, operation, ownership);
        if (rejection) {
          return rejection;
        }
        const existing = await requestToPromise(stores[OPERATIONS_STORE].get(operation.key));
        if (existing) {
          if (!sameOperationInput(existing, operation)) {
            return { applied: false, reason: "operation-conflict", operation: existing };
          }
          return { applied: true, alreadyPrepared: true, operation: existing };
        }
        await requestToPromise(stores[OPERATIONS_STORE].put(operation));
        return { applied: true, operation };
      });
    }

    async function updateOperation(input = {}, ownership = {}) {
      const identity = operationIdentity(input);
      assertOperationIdentity(identity);
      return transact([JOBS_STORE, OPERATIONS_STORE], "readwrite", async stores => {
        const currentJob = await requestToPromise(stores[JOBS_STORE].get(identity.jobId));
        const rejection = rejectOwnedOperation(currentJob, identity, ownership);
        if (rejection) {
          return rejection;
        }
        const current = await requestToPromise(stores[OPERATIONS_STORE].get(identity.key));
        if (!current) {
          return { applied: false, reason: "missing-operation" };
        }
        const next = mergeOperationUpdate(current, input, ownership);
        const stateRejection = rejectOperationStateRegression(current.state, next.state);
        if (stateRejection) {
          return stateRejection;
        }
        await requestToPromise(stores[OPERATIONS_STORE].put(next));
        return { applied: true, operation: next };
      });
    }

    async function claimFunAsrRemoteCancellations(input = {}) {
      const jobId = String(input.jobId || "");
      const runToken = String(input.runToken || "");
      const claimOptions = normalizeFunAsrCancellationClaimOptions(input);
      const requestedAt = finiteTimestamp(input.requestedAt || claimOptions.claimedAt);
      const supplied = normalizeFunAsrCancellationCandidates(input.candidates);
      if (!jobId || !runToken) return { applied: false, reason: "missing-job-identity", claims: [] };
      if (!claimOptions.claimId) return { applied: false, reason: "missing-claim-id", claims: [] };
      return transact([JOBS_STORE, OPERATIONS_STORE], "readwrite", async stores => {
        const currentJob = await requestToPromise(stores[JOBS_STORE].get(jobId));
        const rejection = rejectFunAsrCancellationJob(currentJob, runToken);
        if (rejection) return { ...rejection, claims: [] };
        const operations = await requestToPromise(
          stores[OPERATIONS_STORE].index("jobRunKey").getAll(FuguangJobContract.jobRunKey(jobId, runToken))
        );
        const sources = selectFunAsrCancellationSources(operations, supplied);
        const claims = [];
        for (const source of sources) {
          const remoteTaskId = source.remoteTaskId;
          if (!source.operation.remoteTaskId && remoteTaskId) {
            source.operation = FuguangJobContract.sanitizeOperation({
              ...source.operation,
              remoteTaskId,
              updatedAt: Math.max(Number(source.operation.updatedAt || 0), requestedAt)
            });
            await requestToPromise(stores[OPERATIONS_STORE].put(source.operation));
          }
          const cancellation = createFunAsrCancellationOperation(
            source.operation,
            remoteTaskId,
            requestedAt,
            claimOptions
          );
          const existing = await requestToPromise(stores[OPERATIONS_STORE].get(cancellation.key));
          if (existing) {
            const claimed = claimExistingFunAsrCancellationOperation(existing, claimOptions);
            if (claimed.applied) {
              await requestToPromise(stores[OPERATIONS_STORE].put(claimed.operation));
              claims.push(funAsrCancellationClaim(claimed.operation, true, {
                retrying: claimed.retrying,
                tookOver: claimed.tookOver
              }));
            } else {
              claims.push(funAsrCancellationClaim(existing, false, claimed));
            }
            continue;
          }
          await requestToPromise(stores[OPERATIONS_STORE].put(cancellation));
          claims.push(funAsrCancellationClaim(cancellation, true));
        }
        return { applied: true, claims };
      });
    }

    async function renewFunAsrRemoteCancellationClaim(input = {}) {
      const identity = operationIdentity(input);
      if (!identity.jobId || !identity.runToken || !identity.operationId) {
        return { applied: false, reason: "missing-operation" };
      }
      return transact([OPERATIONS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[OPERATIONS_STORE].get(identity.key));
        const renewed = renewFunAsrCancellationOperation(current, input);
        if (!renewed.applied) return renewed;
        await requestToPromise(stores[OPERATIONS_STORE].put(renewed.operation));
        return renewed;
      });
    }

    async function completeFunAsrRemoteCancellation(input = {}) {
      const identity = operationIdentity(input);
      if (!identity.jobId || !identity.runToken || !identity.operationId) {
        return { applied: false, reason: "missing-operation" };
      }
      return transact([OPERATIONS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[OPERATIONS_STORE].get(identity.key));
        const completed = completeFunAsrCancellationOperation(current, input);
        if (!completed.applied || completed.duplicate) return completed;
        await requestToPromise(stores[OPERATIONS_STORE].put(completed.operation));
        return completed;
      });
    }

    async function getJob(jobId) {
      return transact([JOBS_STORE], "readonly", stores => requestToPromise(stores[JOBS_STORE].get(jobId)));
    }

    async function getOperation(jobId, runToken, operationId) {
      const identity = operationIdentity({ jobId, runToken, operationId });
      return transact([OPERATIONS_STORE], "readonly", stores => requestToPromise(stores[OPERATIONS_STORE].get(identity.key)))
        .then(operation => operation || null);
    }

    async function listOperations(jobId, runToken = "") {
      return transact([OPERATIONS_STORE], "readonly", async stores => {
        const query = operationQuery(jobId, runToken);
        const indexName = runToken ? "jobRunKey" : "jobId";
        const indexValue = runToken ? query.jobRunKey : query.jobId;
        const operations = await requestToPromise(stores[OPERATIONS_STORE].index(indexName).getAll(indexValue));
        return operations.sort(compareOperations);
      });
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

    async function listJobs() {
      return transact([JOBS_STORE], "readonly", stores => requestToPromise(stores[JOBS_STORE].getAll()));
    }

    async function listAudioChunks() {
      return transact([CHUNKS_STORE], "readonly", async stores => {
        const chunks = await requestToPromise(stores[CHUNKS_STORE].getAll());
        return chunks
          .filter(chunk => String(chunk?.entryType || "") === "audio-chunk")
          .sort(compareChunkEntries);
      });
    }

    async function reconcileAudioCacheRefs(jobId, refs = [], options = {}) {
      const removedRefs = normalizeAudioCacheRefs(refs);
      return transact([JOBS_STORE, CHUNKS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(jobId));
        if (!current) {
          return { applied: false, reason: "missing-job" };
        }
        const chunks = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAll(jobId));
        const matchedRefs = new Set();
        let deletedChunks = 0;
        for (const chunk of chunks) {
          if (String(chunk?.entryType || "") !== "audio-chunk") {
            continue;
          }
          const chunkRefs = audioCacheRefsFromChunk(chunk);
          if (!chunkRefs.some(ref => removedRefs.has(ref))) {
            continue;
          }
          for (const ref of chunkRefs) {
            if (removedRefs.has(ref)) {
              matchedRefs.add(ref);
            }
          }
          await requestToPromise(stores[CHUNKS_STORE].delete(chunk.key));
          deletedChunks += 1;
        }
        const remainingChunks = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAll(jobId));
        const reusableAudioChunks = remainingChunks.filter(chunk => (
          chunk?.runToken === current.runToken &&
          String(chunk?.entryType || "") === "audio-chunk" &&
          audioCacheRefsFromChunk(chunk).length > 0
        )).length;
        const verifiedAt = Number(options.verifiedAt || Date.now()) || Date.now();
        const next = {
          ...current,
          reusableAudioChunks,
          audioCacheRemoved: reusableAudioChunks === 0,
          audioCacheRemovedCount: Math.max(0, Number(current.audioCacheRemovedCount || 0) || 0) + matchedRefs.size,
          audioCacheVerified: true,
          audioCacheVerifiedAt: verifiedAt,
          audioCacheRemovedRefs: [...new Set([
            ...(Array.isArray(current.audioCacheRemovedRefs) ? current.audioCacheRemovedRefs : []),
            ...matchedRefs
          ])].slice(-4096),
          updatedAt: Math.max(Number(current.updatedAt || 0), verifiedAt)
        };
        await requestToPromise(stores[JOBS_STORE].put(next));
        return {
          applied: true,
          deletedChunks,
          removedRefs: [...matchedRefs],
          reusableAudioChunks,
          job: next
        };
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
      return transact([JOBS_STORE, CHUNKS_STORE, OPERATIONS_STORE], "readwrite", async stores => {
        const chunks = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAllKeys(jobId));
        const operations = await requestToPromise(stores[OPERATIONS_STORE].index("jobId").getAllKeys(jobId));
        for (const key of chunks) {
          await requestToPromise(stores[CHUNKS_STORE].delete(key));
        }
        for (const key of operations) {
          await requestToPromise(stores[OPERATIONS_STORE].delete(key));
        }
        await requestToPromise(stores[JOBS_STORE].delete(jobId));
        return { deleted: true, chunks: chunks.length, operations: operations.length };
      });
    }

    async function deleteExpiredJob(input = {}) {
      return transact([JOBS_STORE, CHUNKS_STORE, OPERATIONS_STORE, CLEANUP_CLAIMS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[JOBS_STORE].get(input.jobId));
        const rejection = rejectExpiredJobDeletion(current, input);
        if (rejection) return rejection;
        const chunkKeys = await requestToPromise(stores[CHUNKS_STORE].index("jobId").getAllKeys(input.jobId));
        const operationEntries = await requestToPromise(stores[OPERATIONS_STORE].index("jobId").getAll(input.jobId));
        const claim = FuguangJobContract.sanitizeCleanupClaim({
          jobId: current.id,
          runToken: current.runToken,
          expectedUpdatedAt: Number(current.updatedAt || current.createdAt || 0),
          state: "pending",
          resultRefs: operationEntries.map(operation => operation.resultRef),
          createdAt: Number(input.checkedAt || Date.now())
        });
        await requestToPromise(stores[CLEANUP_CLAIMS_STORE].put(claim));
        for (const key of chunkKeys) await requestToPromise(stores[CHUNKS_STORE].delete(key));
        for (const operation of operationEntries) await requestToPromise(stores[OPERATIONS_STORE].delete(operation.key));
        await requestToPromise(stores[JOBS_STORE].delete(input.jobId));
        return {
          applied: true,
          deleted: true,
          chunks: chunkKeys.length,
          operations: operationEntries.length,
          resultRefs: claim.resultRefs,
          cleanupClaim: claim
        };
      });
    }

    async function listCleanupClaims(filter = {}) {
      return transact([CLEANUP_CLAIMS_STORE], "readonly", async stores => {
        const claims = await requestToPromise(stores[CLEANUP_CLAIMS_STORE].getAll());
        return filterCleanupClaims(claims, filter);
      });
    }

    async function completeCleanupClaim(input = {}) {
      const key = String(input.key || input.cleanupId || "");
      if (!key) return { applied: false, reason: "missing-cleanup-claim" };
      return transact([CLEANUP_CLAIMS_STORE], "readwrite", async stores => {
        const current = await requestToPromise(stores[CLEANUP_CLAIMS_STORE].get(key));
        if (!current) return { applied: false, reason: "missing-cleanup-claim" };
        if (current.state === "completed") return { applied: true, duplicate: true, cleanupClaim: current };
        const completed = FuguangJobContract.sanitizeCleanupClaim({
          ...current,
          state: "completed",
          resultRefs: [],
          completedAt: Number(input.completedAt || Date.now())
        });
        await requestToPromise(stores[CLEANUP_CLAIMS_STORE].put(completed));
        return { applied: true, cleanupClaim: completed };
      });
    }

    async function compactCompletedCleanupClaims(olderThan) {
      const cutoff = Number(olderThan || 0);
      return transact([CLEANUP_CLAIMS_STORE], "readwrite", async stores => {
        const completed = await requestToPromise(stores[CLEANUP_CLAIMS_STORE].index("state").getAll("completed"));
        const expired = completed.filter(claim => Number(claim.completedAt || 0) > 0 && Number(claim.completedAt || 0) < cutoff);
        for (const claim of expired) {
          await requestToPromise(stores[CLEANUP_CLAIMS_STORE].delete(claim.key));
        }
        return { deletedClaims: expired.length };
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
      claimFunAsrRemoteCancellations,
      close,
      compactCompletedCleanupClaims,
      completeCleanupClaim,
      completeFunAsrRemoteCancellation,
      compactTerminalJobs,
      deleteJob,
      deleteExpiredJob,
      findActiveJob,
      getChunks,
      getJob,
      getOperation,
      getSnapshot,
      listAudioChunks,
      listCleanupClaims,
      listJobs,
      listOperations,
      listRecoverableJobs,
      markCancelRequested,
      putSnapshot,
      putSnapshotIfOwned,
      prepareOperation,
      reconcileAudioCacheRefs,
      releaseRun,
      renewFunAsrRemoteCancellationClaim,
      renewRunLease,
      updateOperation
    };
  }

  function createMemory() {
    const jobs = new Map();
    const chunks = new Map();
    const operations = new Map();
    const cleanupClaims = new Map();

    async function putSnapshot(snapshot = {}) {
      const job = clone(snapshot.job);
      if (!job?.id || !job?.runToken) {
        throw new Error("Job snapshot requires id and runToken.");
      }
      const current = jobs.get(job.id);
      if (!current && [...cleanupClaims.values()].some(claim => claim.jobId === job.id)) {
        return { applied: false, reason: "retired-job" };
      }
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
      const storedJob = jobs.get(job.id);
      for (const chunk of snapshot.chunks || []) {
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, storedJob)) {
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
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, nextJob)) {
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
      if (!current && [...cleanupClaims.values()].some(claim => claim.jobId === job.id && claim.runToken === job.runToken)) {
        return { applied: false, reason: "retired-run" };
      }
      jobs.set(job.id, clone(job));
      for (const chunk of snapshot.chunks) {
        if (chunk?.jobId === job.id && chunk?.runToken === job.runToken && chunk?.key && !chunkHasRemovedAudioRef(chunk, job)) {
          chunks.set(chunk.key, clone(chunk));
        }
      }
      for (const [key, claim] of cleanupClaims) {
        if (claim.jobId === job.id && claim.state === "completed") {
          cleanupClaims.delete(key);
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
      if (current.cancelRequested) {
        return clone({ applied: false, reason: "already-cancelled", job: current });
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

    async function prepareOperation(input = {}, ownership = {}) {
      const operation = normalizePreparedOperation(input, ownership);
      assertOperationIdentity(operation);
      const rejection = rejectOwnedOperation(jobs.get(operation.jobId), operation, ownership);
      if (rejection) {
        return clone(rejection);
      }
      const existing = operations.get(operation.key);
      if (existing) {
        if (!sameOperationInput(existing, operation)) {
          return clone({ applied: false, reason: "operation-conflict", operation: existing });
        }
        return clone({ applied: true, alreadyPrepared: true, operation: existing });
      }
      operations.set(operation.key, operation);
      return clone({ applied: true, operation });
    }

    async function updateOperation(input = {}, ownership = {}) {
      const identity = operationIdentity(input);
      assertOperationIdentity(identity);
      const rejection = rejectOwnedOperation(jobs.get(identity.jobId), identity, ownership);
      if (rejection) {
        return clone(rejection);
      }
      const current = operations.get(identity.key);
      if (!current) {
        return { applied: false, reason: "missing-operation" };
      }
      const next = mergeOperationUpdate(current, input, ownership);
      const stateRejection = rejectOperationStateRegression(current.state, next.state);
      if (stateRejection) {
        return clone(stateRejection);
      }
      operations.set(next.key, next);
      return clone({ applied: true, operation: next });
    }

    async function claimFunAsrRemoteCancellations(input = {}) {
      const jobId = String(input.jobId || "");
      const runToken = String(input.runToken || "");
      const claimOptions = normalizeFunAsrCancellationClaimOptions(input);
      const requestedAt = finiteTimestamp(input.requestedAt || claimOptions.claimedAt);
      const supplied = normalizeFunAsrCancellationCandidates(input.candidates);
      if (!jobId || !runToken) return { applied: false, reason: "missing-job-identity", claims: [] };
      if (!claimOptions.claimId) return { applied: false, reason: "missing-claim-id", claims: [] };
      const rejection = rejectFunAsrCancellationJob(jobs.get(jobId), runToken);
      if (rejection) return clone({ ...rejection, claims: [] });
      const sources = selectFunAsrCancellationSources(
        [...operations.values()].filter(operation => operation.jobId === jobId && operation.runToken === runToken),
        supplied
      );
      const claims = [];
      for (const source of sources) {
        const remoteTaskId = source.remoteTaskId;
        if (!source.operation.remoteTaskId && remoteTaskId) {
          source.operation = FuguangJobContract.sanitizeOperation({
            ...source.operation,
            remoteTaskId,
            updatedAt: Math.max(Number(source.operation.updatedAt || 0), requestedAt)
          });
          operations.set(source.operation.key, source.operation);
        }
        const cancellation = createFunAsrCancellationOperation(
          source.operation,
          remoteTaskId,
          requestedAt,
          claimOptions
        );
        const existing = operations.get(cancellation.key);
        if (existing) {
          const claimed = claimExistingFunAsrCancellationOperation(existing, claimOptions);
          if (claimed.applied) {
            operations.set(claimed.operation.key, claimed.operation);
            claims.push(funAsrCancellationClaim(claimed.operation, true, {
              retrying: claimed.retrying,
              tookOver: claimed.tookOver
            }));
          } else {
            claims.push(funAsrCancellationClaim(existing, false, claimed));
          }
          continue;
        }
        operations.set(cancellation.key, cancellation);
        claims.push(funAsrCancellationClaim(cancellation, true));
      }
      return clone({ applied: true, claims });
    }

    async function renewFunAsrRemoteCancellationClaim(input = {}) {
      const identity = operationIdentity(input);
      const renewed = renewFunAsrCancellationOperation(operations.get(identity.key), input);
      if (renewed.applied) operations.set(identity.key, renewed.operation);
      return clone(renewed);
    }

    async function completeFunAsrRemoteCancellation(input = {}) {
      const identity = operationIdentity(input);
      const completed = completeFunAsrCancellationOperation(operations.get(identity.key), input);
      if (completed.applied && !completed.duplicate) operations.set(identity.key, completed.operation);
      return clone(completed);
    }

    async function getJob(jobId) {
      return clone(jobs.get(jobId) || null);
    }

    async function getOperation(jobId, runToken, operationId) {
      const identity = operationIdentity({ jobId, runToken, operationId });
      return clone(operations.get(identity.key) || null);
    }

    async function listOperations(jobId, runToken = "") {
      const query = operationQuery(jobId, runToken);
      return [...operations.values()]
        .filter(operation => operation.jobId === query.jobId && (!runToken || operation.runToken === query.runToken))
        .sort(compareOperations)
        .map(clone);
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

    async function listJobs() {
      return [...jobs.values()].map(clone).sort((left, right) => String(left?.id || "").localeCompare(String(right?.id || "")));
    }

    async function listAudioChunks() {
      return [...chunks.values()]
        .filter(chunk => String(chunk?.entryType || "") === "audio-chunk")
        .sort(compareChunkEntries)
        .map(clone);
    }

    async function reconcileAudioCacheRefs(jobId, refs = [], options = {}) {
      const current = jobs.get(jobId);
      if (!current) {
        return { applied: false, reason: "missing-job" };
      }
      const removedRefs = normalizeAudioCacheRefs(refs);
      const matchedRefs = new Set();
      let deletedChunks = 0;
      for (const [key, chunk] of chunks) {
        if (chunk?.jobId !== jobId || String(chunk?.entryType || "") !== "audio-chunk") {
          continue;
        }
        const chunkRefs = audioCacheRefsFromChunk(chunk);
        if (!chunkRefs.some(ref => removedRefs.has(ref))) {
          continue;
        }
        for (const ref of chunkRefs) {
          if (removedRefs.has(ref)) {
            matchedRefs.add(ref);
          }
        }
        chunks.delete(key);
        deletedChunks += 1;
      }
      const reusableAudioChunks = [...chunks.values()].filter(chunk => (
        chunk?.jobId === jobId &&
        chunk?.runToken === current.runToken &&
        String(chunk?.entryType || "") === "audio-chunk" &&
        audioCacheRefsFromChunk(chunk).length > 0
      )).length;
      const verifiedAt = Number(options.verifiedAt || Date.now()) || Date.now();
      const next = {
        ...current,
        reusableAudioChunks,
        audioCacheRemoved: reusableAudioChunks === 0,
        audioCacheRemovedCount: Math.max(0, Number(current.audioCacheRemovedCount || 0) || 0) + matchedRefs.size,
        audioCacheVerified: true,
        audioCacheVerifiedAt: verifiedAt,
        audioCacheRemovedRefs: [...new Set([
          ...(Array.isArray(current.audioCacheRemovedRefs) ? current.audioCacheRemovedRefs : []),
          ...matchedRefs
        ])].slice(-4096),
        updatedAt: Math.max(Number(current.updatedAt || 0), verifiedAt)
      };
      jobs.set(jobId, next);
      return clone({
        applied: true,
        deletedChunks,
        removedRefs: [...matchedRefs],
        reusableAudioChunks,
        job: next
      });
    }

    async function listRecoverableJobs() {
      return [...jobs.values()]
        .filter(job => !FuguangJobContract.isTerminalStatus(job?.status))
        .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0))
        .map(clone);
    }

    async function deleteJob(jobId) {
      let deletedChunks = 0;
      let deletedOperations = 0;
      for (const [key, chunk] of chunks) {
        if (chunk.jobId === jobId) {
          chunks.delete(key);
          deletedChunks += 1;
        }
      }
      for (const [key, operation] of operations) {
        if (operation.jobId === jobId) {
          operations.delete(key);
          deletedOperations += 1;
        }
      }
      jobs.delete(jobId);
      return { deleted: true, chunks: deletedChunks, operations: deletedOperations };
    }

    async function deleteExpiredJob(input = {}) {
      const current = jobs.get(input.jobId);
      const rejection = rejectExpiredJobDeletion(current, input);
      if (rejection) return clone(rejection);
      let deletedChunks = 0;
      let deletedOperations = 0;
      const resultRefs = [];
      for (const [key, chunk] of chunks) {
        if (chunk.jobId === input.jobId) {
          chunks.delete(key);
          deletedChunks += 1;
        }
      }
      for (const [key, operation] of operations) {
        if (operation.jobId === input.jobId) {
          if (operation.resultRef) resultRefs.push(String(operation.resultRef));
          operations.delete(key);
          deletedOperations += 1;
        }
      }
      const claim = FuguangJobContract.sanitizeCleanupClaim({
        jobId: current.id,
        runToken: current.runToken,
        expectedUpdatedAt: Number(current.updatedAt || current.createdAt || 0),
        state: "pending",
        resultRefs,
        createdAt: Number(input.checkedAt || Date.now())
      });
      cleanupClaims.set(claim.key, claim);
      jobs.delete(input.jobId);
      return clone({
        applied: true, deleted: true, chunks: deletedChunks,
        operations: deletedOperations, resultRefs: claim.resultRefs, cleanupClaim: claim
      });
    }

    async function listCleanupClaims(filter = {}) {
      return clone(filterCleanupClaims([...cleanupClaims.values()], filter));
    }

    async function completeCleanupClaim(input = {}) {
      const key = String(input.key || input.cleanupId || "");
      const current = cleanupClaims.get(key);
      if (!current) return { applied: false, reason: "missing-cleanup-claim" };
      if (current.state === "completed") return clone({ applied: true, duplicate: true, cleanupClaim: current });
      const completed = FuguangJobContract.sanitizeCleanupClaim({
        ...current,
        state: "completed",
        resultRefs: [],
        completedAt: Number(input.completedAt || Date.now())
      });
      cleanupClaims.set(key, completed);
      return clone({ applied: true, cleanupClaim: completed });
    }

    async function compactCompletedCleanupClaims(olderThan) {
      const cutoff = Number(olderThan || 0);
      let deletedClaims = 0;
      for (const [key, claim] of cleanupClaims) {
        if (claim.state === "completed" && Number(claim.completedAt || 0) > 0 && Number(claim.completedAt || 0) < cutoff) {
          cleanupClaims.delete(key);
          deletedClaims += 1;
        }
      }
      return { deletedClaims };
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
      claimFunAsrRemoteCancellations,
      close: async () => {},
      compactCompletedCleanupClaims,
      completeCleanupClaim,
      completeFunAsrRemoteCancellation,
      compactTerminalJobs,
      deleteJob,
      deleteExpiredJob,
      findActiveJob,
      getChunks,
      getJob,
      getOperation,
      getSnapshot,
      listAudioChunks,
      listCleanupClaims,
      listJobs,
      listOperations,
      listRecoverableJobs,
      markCancelRequested,
      putSnapshot,
      putSnapshotIfOwned,
      prepareOperation,
      reconcileAudioCacheRefs,
      releaseRun,
      renewFunAsrRemoteCancellationClaim,
      renewRunLease,
      updateOperation
    };
  }

  function createDisabledStore() {
    return {
      available: false,
      beginAttempt: async () => ({ applied: false, reason: "unavailable" }),
      claimRun: async () => ({ applied: false, reason: "unavailable" }),
      claimFunAsrRemoteCancellations: async () => ({ applied: false, reason: "unavailable", claims: [] }),
      close: async () => {},
      compactCompletedCleanupClaims: async () => ({ deletedClaims: 0 }),
      completeCleanupClaim: async () => ({ applied: false, reason: "unavailable" }),
      completeFunAsrRemoteCancellation: async () => ({ applied: false, reason: "unavailable" }),
      compactTerminalJobs: async () => ({ deletedJobs: 0 }),
      deleteJob: async () => ({ deleted: false, chunks: 0, operations: 0 }),
      deleteExpiredJob: async () => ({ applied: false, reason: "unavailable" }),
      findActiveJob: async () => null,
      getChunks: async () => [],
      getJob: async () => null,
      getOperation: async () => null,
      getSnapshot: async () => ({ job: null, chunks: [] }),
      listAudioChunks: async () => [],
      listCleanupClaims: async () => [],
      listJobs: async () => [],
      listOperations: async () => [],
      listRecoverableJobs: async () => [],
      markCancelRequested: async () => ({ applied: false, reason: "unavailable" }),
      putSnapshot: async () => ({ applied: false, reason: "unavailable" }),
      putSnapshotIfOwned: async () => ({ applied: false, reason: "unavailable" }),
      prepareOperation: async () => ({ applied: false, reason: "unavailable" }),
      reconcileAudioCacheRefs: async () => ({ applied: false, reason: "unavailable" }),
      releaseRun: async () => ({ applied: false, reason: "unavailable" }),
      renewFunAsrRemoteCancellationClaim: async () => ({ applied: false, reason: "unavailable" }),
      renewRunLease: async () => ({ applied: false, reason: "unavailable" }),
      updateOperation: async () => ({ applied: false, reason: "unavailable" })
    };
  }

  function normalizeFunAsrCancellationCandidates(candidates) {
    if (!Array.isArray(candidates)) return [];
    return candidates.map(candidate => ({
      operationId: String(candidate?.operationId || ""),
      provider: String(candidate?.provider || ""),
      operationType: String(candidate?.operationType || ""),
      inputHash: String(candidate?.inputHash || ""),
      remoteTaskId: String(candidate?.remoteTaskId || "")
    })).filter(candidate => candidate.operationId && candidate.remoteTaskId);
  }

  function selectFunAsrCancellationSources(operations, candidates) {
    const sourceById = new Map((operations || [])
      .filter(operation => operation?.operationType === "funasr-submit" &&
        operation?.provider === "dashscope_funasr" && ["accepted", "completed"].includes(operation?.state))
      .map(operation => [String(operation.operationId || ""), operation]));
    if (!candidates.length) {
      return [...sourceById.values()]
        .filter(operation => String(operation.remoteTaskId || ""))
        .map(operation => ({ operation, remoteTaskId: String(operation.remoteTaskId) }));
    }
    const selected = [];
    for (const candidate of candidates) {
      const operation = sourceById.get(candidate.operationId);
      if (!operation ||
          candidate.provider !== String(operation.provider || "") ||
          candidate.operationType !== String(operation.operationType || "") ||
          candidate.inputHash !== String(operation.inputHash || "") ||
          (operation.remoteTaskId && String(operation.remoteTaskId) !== candidate.remoteTaskId)) {
        continue;
      }
      selected.push({ operation, remoteTaskId: candidate.remoteTaskId });
    }
    return selected;
  }

  function createFunAsrCancellationOperation(source, remoteTaskId, requestedAt, claimOptions) {
    return FuguangJobContract.sanitizeOperation({
      jobId: source.jobId,
      runToken: source.runToken,
      operationId: `funasr-cancel:${source.operationId}`,
      provider: "dashscope_funasr",
      operationType: "funasr-cancel",
      inputHash: source.inputHash,
      state: "submitted",
      claimId: claimOptions.claimId,
      claimedAt: claimOptions.claimedAt,
      claimLeaseExpiresAt: claimOptions.claimedAt + claimOptions.claimLeaseDurationMs,
      remoteTaskId,
      submittedAt: requestedAt,
      retryAllowed: false,
      definitelyNotAccepted: false,
      resultSummary: `Cancel ${source.operationId}`,
      result: { submitOperationId: source.operationId },
      preparedAt: requestedAt,
      updatedAt: requestedAt
    });
  }

  function claimExistingFunAsrCancellationOperation(operation, claimOptions) {
    if (operation?.provider !== "dashscope_funasr" || operation?.operationType !== "funasr-cancel") {
      return { applied: false, reason: "operation-conflict" };
    }
    if (["completed", "failed"].includes(String(operation.state || ""))) {
      return { applied: false, reason: "terminal-operation" };
    }
    if (operation.state === "unknown") {
      return {
        applied: true,
        retrying: true,
        tookOver: Boolean(operation.claimId),
        operation: applyFunAsrCancellationClaim(operation, claimOptions)
      };
    }
    if (operation.state !== "submitted") {
      return { applied: false, reason: "operation-state-regression" };
    }
    const currentClaimId = String(operation.claimId || "");
    const currentLeaseExpiresAt = Number(operation.claimLeaseExpiresAt || 0) || 0;
    if (currentClaimId && currentLeaseExpiresAt > claimOptions.claimedAt) {
      return {
        applied: false,
        reason: "active-claim",
        claimId: currentClaimId,
        claimedAt: Number(operation.claimedAt || 0) || 0,
        claimLeaseExpiresAt: currentLeaseExpiresAt
      };
    }
    if (!currentClaimId) {
      const legacyAnchor = Math.max(
        Number(operation.claimedAt || 0) || 0,
        Number(operation.updatedAt || 0) || 0,
        Number(operation.submittedAt || 0) || 0,
        Number(operation.preparedAt || 0) || 0
      );
      const graceExpiresAt = legacyAnchor + claimOptions.legacyClaimGraceMs;
      if (legacyAnchor && graceExpiresAt > claimOptions.claimedAt) {
        return {
          applied: false,
          reason: "legacy-claim-grace",
          claimId: "",
          claimedAt: legacyAnchor,
          claimLeaseExpiresAt: graceExpiresAt
        };
      }
    }
    return {
      applied: true,
      retrying: true,
      tookOver: true,
      operation: applyFunAsrCancellationClaim(operation, claimOptions)
    };
  }

  function applyFunAsrCancellationClaim(operation, claimOptions) {
    return FuguangJobContract.sanitizeOperation({
      ...operation,
      state: "submitted",
      claimId: claimOptions.claimId,
      claimedAt: claimOptions.claimedAt,
      claimLeaseExpiresAt: claimOptions.claimedAt + claimOptions.claimLeaseDurationMs,
      submittedAt: claimOptions.claimedAt,
      completedAt: 0,
      error: "",
      retryAllowed: false,
      updatedAt: claimOptions.claimedAt
    });
  }

  function funAsrCancellationClaim(operation, claimed, options = {}) {
    return {
      claimed,
      retrying: Boolean(options.retrying),
      tookOver: Boolean(options.tookOver),
      reason: String(options.reason || ""),
      claimId: String(options.claimId ?? operation?.claimId ?? ""),
      claimedAt: Number(options.claimedAt ?? operation?.claimedAt ?? 0) || 0,
      claimLeaseExpiresAt: Number(options.claimLeaseExpiresAt ?? operation?.claimLeaseExpiresAt ?? 0) || 0,
      remoteTaskId: String(operation?.remoteTaskId || ""),
      operation,
      outcome: operation?.result?.status ? operation.result : null
    };
  }

  function normalizeFunAsrCancellationClaimOptions(input = {}) {
    const claimedAt = finiteTimestamp(input.claimedAt || input.requestedAt);
    return {
      claimId: String(input.claimId || "").trim().slice(0, 300),
      claimedAt,
      claimLeaseDurationMs: positiveDuration(
        input.claimLeaseDurationMs ?? input.leaseDurationMs ?? DEFAULT_FUNASR_CANCELLATION_CLAIM_LEASE_MS
      ),
      legacyClaimGraceMs: positiveDuration(
        input.legacyClaimGraceMs ?? DEFAULT_FUNASR_CANCELLATION_LEGACY_GRACE_MS
      )
    };
  }

  function renewFunAsrCancellationOperation(current, input = {}) {
    if (!current) return { applied: false, reason: "missing-operation" };
    if (current.provider !== "dashscope_funasr" || current.operationType !== "funasr-cancel") {
      return { applied: false, reason: "operation-conflict" };
    }
    const claimId = String(input.claimId || "");
    if (!claimId) return { applied: false, reason: "missing-claim-id" };
    if (String(current.claimId || "") !== claimId) {
      return {
        applied: false,
        reason: "stale-claim",
        claimId: String(current.claimId || ""),
        claimLeaseExpiresAt: Number(current.claimLeaseExpiresAt || 0) || 0
      };
    }
    if (current.state !== "submitted") {
      return { applied: false, reason: "inactive-claim", currentState: String(current.state || "") };
    }
    const renewedAt = finiteTimestamp(input.renewedAt);
    if (Number(current.claimLeaseExpiresAt || 0) <= renewedAt) {
      return {
        applied: false,
        reason: "expired-claim",
        claimLeaseExpiresAt: Number(current.claimLeaseExpiresAt || 0) || 0
      };
    }
    const operation = FuguangJobContract.sanitizeOperation({
      ...current,
      claimLeaseExpiresAt: Math.max(
        Number(current.claimLeaseExpiresAt || 0) || 0,
        renewedAt + positiveDuration(
          input.claimLeaseDurationMs ?? input.leaseDurationMs ?? DEFAULT_FUNASR_CANCELLATION_CLAIM_LEASE_MS
        )
      ),
      updatedAt: Math.max(Number(current.updatedAt || 0), renewedAt)
    });
    return { applied: true, operation };
  }

  function rejectFunAsrCancellationJob(current, runToken) {
    if (!current) return { applied: false, reason: "missing-job" };
    if (String(current.runToken || "") !== String(runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken || "" };
    }
    if (!current.cancelRequested) return { applied: false, reason: "cancel-not-requested" };
    return null;
  }

  function completeFunAsrCancellationOperation(current, input = {}) {
    if (!current) return { applied: false, reason: "missing-operation" };
    if (current.provider !== "dashscope_funasr" || current.operationType !== "funasr-cancel" ||
        String(input.provider || "") !== current.provider ||
        String(input.operationType || "") !== current.operationType ||
        String(input.inputHash || "") !== String(current.inputHash || "") ||
        String(input.sourceOperationId || "") !== String(current.result?.submitOperationId || "")) {
      return { applied: false, reason: "operation-conflict" };
    }
    if (String(current.remoteTaskId || "") !== String(input.remoteTaskId || "")) {
      return { applied: false, reason: "operation-conflict" };
    }
    const claimId = String(input.claimId || "");
    if (!claimId) return { applied: false, reason: "missing-claim-id" };
    if (String(current.claimId || "") !== claimId) {
      return {
        applied: false,
        reason: "stale-claim",
        claimId: String(current.claimId || ""),
        claimLeaseExpiresAt: Number(current.claimLeaseExpiresAt || 0) || 0
      };
    }
    if (["completed", "unknown"].includes(current.state)) {
      return { applied: true, duplicate: true, operation: current };
    }
    if (current.state !== "submitted") return { applied: false, reason: "operation-state-regression" };
    const raw = input.outcome && typeof input.outcome === "object" ? input.outcome : {};
    const status = ["confirmed", "not-applied", "unknown"].includes(String(raw.status || ""))
      ? String(raw.status)
      : "unknown";
    const outcome = {
      status,
      confirmed: status === "confirmed",
      taskId: String(current.remoteTaskId || ""),
      httpStatus: Math.max(0, Number(raw.httpStatus || 0) || 0),
      remoteTaskStatus: String(raw.remoteTaskStatus || ""),
      message: String(raw.message || "")
    };
    const timestamp = finiteTimestamp(input.completedAt);
    const operation = FuguangJobContract.sanitizeOperation({
      ...current,
      state: status === "unknown" ? "unknown" : "completed",
      claimLeaseExpiresAt: 0,
      completedAt: status === "unknown" ? 0 : timestamp,
      resultSummary: `Remote cancellation ${status}`,
      result: { ...current.result, ...outcome },
      error: status === "unknown" ? outcome.message || "Remote cancellation acknowledgement is unknown." : "",
      retryAllowed: status === "unknown",
      definitelyNotAccepted: false,
      updatedAt: timestamp
    });
    return { applied: true, operation };
  }

  function operationIdentity(input = {}) {
    const sanitized = FuguangJobContract.sanitizeOperation(input);
    const jobId = sanitized.jobId;
    const runToken = sanitized.runToken;
    const operationId = sanitized.operationId;
    return {
      jobId,
      runToken,
      operationId,
      key: FuguangJobContract.operationKey(jobId, runToken, operationId)
    };
  }

  async function hasRetirementGuard(store, jobId) {
    if (!store || !jobId) return false;
    const keys = await requestToPromise(store.index("jobId").getAllKeys(String(jobId)));
    return keys.length > 0;
  }

  async function hasRetiredRunGuard(store, jobId, runToken) {
    if (!store || !jobId || !runToken) return false;
    const keys = await requestToPromise(
      store.index("jobRunKey").getAllKeys(FuguangJobContract.jobRunKey(jobId, runToken))
    );
    return keys.length > 0;
  }

  function filterCleanupClaims(claims = [], filter = {}) {
    const jobId = String(filter.jobId || "");
    const runToken = String(filter.runToken || "");
    const state = String(filter.state || "");
    return claims
      .filter(claim => !jobId || String(claim?.jobId || "") === jobId)
      .filter(claim => !runToken || String(claim?.runToken || "") === runToken)
      .filter(claim => !state || String(claim?.state || "") === state)
      .sort((left, right) => Number(left?.createdAt || 0) - Number(right?.createdAt || 0) ||
        String(left?.key || "").localeCompare(String(right?.key || "")));
  }

  function operationQuery(jobId, runToken = "") {
    const sanitized = FuguangJobContract.sanitizeOperation({ jobId, runToken, operationId: "query" });
    return {
      jobId: sanitized.jobId,
      runToken: sanitized.runToken,
      jobRunKey: sanitized.jobRunKey
    };
  }

  function rejectExpiredJobDeletion(current, input = {}) {
    if (!current) return { applied: false, reason: "missing-job" };
    if (String(current.runToken || "") !== String(input.runToken || "")) {
      return { applied: false, reason: "stale-run", currentRunToken: current.runToken || "" };
    }
    const updatedAt = Number(current.updatedAt || current.createdAt || 0);
    if (updatedAt !== Number(input.expectedUpdatedAt || 0)) {
      return { applied: false, reason: "changed-job" };
    }
    const status = String(current.status || "");
    if (!FuguangJobContract.isTerminalStatus(status) && status !== "interrupted") {
      return { applied: false, reason: "active-job" };
    }
    const checkedAt = Number(input.checkedAt || Date.now());
    if (Number(current.executionLeaseExpiresAt || 0) > checkedAt) {
      return { applied: false, reason: "active-lease", executionLeaseExpiresAt: Number(current.executionLeaseExpiresAt || 0) };
    }
    if (updatedAt >= Number(input.cutoff || 0)) {
      return { applied: false, reason: "recent-job" };
    }
    return null;
  }

  function assertOperationIdentity(operation) {
    if (!operation?.jobId || !operation?.runToken || !operation?.operationId) {
      throw new Error("Durable operation requires jobId, runToken and operationId.");
    }
  }

  function normalizePreparedOperation(input = {}, ownership = {}) {
    const timestamp = finiteTimestamp(input.preparedAt || input.updatedAt || ownership.checkedAt);
    return FuguangJobContract.sanitizeOperation({
      ...input,
      state: "prepared",
      preparedAt: timestamp,
      updatedAt: timestamp
    });
  }

  function mergeOperationUpdate(current, patch = {}, ownership = {}) {
    const timestamp = finiteTimestamp(patch.updatedAt || ownership.checkedAt);
    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    return FuguangJobContract.sanitizeOperation({
      ...current,
      ...definedPatch,
      jobId: current.jobId,
      runToken: current.runToken,
      operationId: current.operationId,
      provider: current.provider,
      operationType: current.operationType,
      inputHash: current.inputHash,
      batchStart: current.batchStart,
      batchEnd: current.batchEnd,
      preparedAt: current.preparedAt,
      updatedAt: Math.max(Number(current.updatedAt || 0), timestamp)
    });
  }

  function sameOperationInput(left, right) {
    return String(left?.provider || "") === String(right?.provider || "") &&
      String(left?.operationType || "") === String(right?.operationType || "") &&
      String(left?.inputHash || "") === String(right?.inputHash || "") &&
      Number(left?.batchStart || 0) === Number(right?.batchStart || 0) &&
      Number(left?.batchEnd || 0) === Number(right?.batchEnd || 0);
  }

  function rejectOwnedOperation(currentJob, operation, ownership = {}) {
    return rejectOwnedSnapshot(currentJob, {
      id: operation.jobId,
      runToken: operation.runToken
    }, ownership);
  }

  function rejectOperationStateRegression(currentState, nextState) {
    const allowed = {
      prepared: new Set(["prepared", "submitted", "accepted", "completed", "unknown", "failed"]),
      submitted: new Set(["submitted", "accepted", "completed", "unknown", "failed"]),
      accepted: new Set(["accepted", "completed", "unknown", "failed"]),
      unknown: new Set(["unknown", "accepted", "completed", "failed"]),
      failed: new Set(["failed"]),
      completed: new Set(["completed"])
    };
    if (allowed[String(currentState || "prepared")]?.has(String(nextState || ""))) {
      return null;
    }
    return {
      applied: false,
      reason: "operation-state-regression",
      currentState: String(currentState || ""),
      attemptedState: String(nextState || "")
    };
  }

  function compareOperations(left, right) {
    return Number(left?.preparedAt || 0) - Number(right?.preparedAt || 0) ||
      String(left?.operationId || "").localeCompare(String(right?.operationId || ""));
  }

  function compareChunkEntries(left, right) {
    return String(left?.jobId || "").localeCompare(String(right?.jobId || "")) ||
      String(left?.runToken || "").localeCompare(String(right?.runToken || "")) ||
      Number(left?.index || 0) - Number(right?.index || 0) ||
      String(left?.key || "").localeCompare(String(right?.key || ""));
  }

  function normalizeAudioCacheRefs(refs = []) {
    return new Set((Array.isArray(refs) ? refs : [refs]).map(ref => String(ref || "")).filter(Boolean));
  }

  function audioCacheRefsFromChunk(chunk = {}) {
    const refs = new Set();
    if (chunk.audioCacheRef) {
      refs.add(String(chunk.audioCacheRef));
    }
    for (const ref of Array.isArray(chunk.audioCacheRefs) ? chunk.audioCacheRefs : []) {
      if (ref) {
        refs.add(String(ref));
      }
    }
    for (const part of Array.isArray(chunk.audioParts) ? chunk.audioParts : []) {
      if (part?.cacheRef) {
        refs.add(String(part.cacheRef));
      }
    }
    return [...refs];
  }

  function chunkHasRemovedAudioRef(chunk = {}, job = {}) {
    if (String(chunk?.entryType || "") !== "audio-chunk") {
      return false;
    }
    const removedRefs = new Set(Array.isArray(job?.audioCacheRemovedRefs) ? job.audioCacheRemovedRefs : []);
    return audioCacheRefsFromChunk(chunk).some(ref => removedRefs.has(ref));
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
    next.audioCacheRemovedRefs = [...new Set([
      ...(Array.isArray(current.audioCacheRemovedRefs) ? current.audioCacheRemovedRefs : []),
      ...(Array.isArray(job.audioCacheRemovedRefs) ? job.audioCacheRemovedRefs : [])
    ])].slice(-4096);
    if (Number(current.audioCacheVerifiedAt || 0) > Number(job.audioCacheVerifiedAt || 0)) {
      for (const field of [
        "reusableAudioChunks",
        "audioCacheRemoved",
        "audioCacheRemovedCount",
        "audioCacheVerified",
        "audioCacheVerifiedAt"
      ]) {
        if (current[field] != null) {
          next[field] = current[field];
        }
      }
    }
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
      const operations = db.objectStoreNames.contains(OPERATIONS_STORE)
        ? request.transaction.objectStore(OPERATIONS_STORE)
        : db.createObjectStore(OPERATIONS_STORE, { keyPath: "key" });
      ensureIndex(operations, "jobId", "jobId");
      ensureIndex(operations, "jobRunKey", "jobRunKey");
      ensureIndex(operations, "state", "state");
      ensureIndex(operations, "updatedAt", "updatedAt");
      const cleanupClaims = db.objectStoreNames.contains(CLEANUP_CLAIMS_STORE)
        ? request.transaction.objectStore(CLEANUP_CLAIMS_STORE)
        : db.createObjectStore(CLEANUP_CLAIMS_STORE, { keyPath: "key" });
      ensureIndex(cleanupClaims, "jobId", "jobId");
      ensureIndex(cleanupClaims, "jobRunKey", "jobRunKey");
      ensureIndex(cleanupClaims, "state", "state");
      ensureIndex(cleanupClaims, "createdAt", "createdAt");
    };
    request.addEventListener?.("success", () => {
      request.result.onversionchange = () => request.result.close();
    });
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
