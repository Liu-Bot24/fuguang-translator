import { FuguangJobContract } from "../shared/job-contract.js";
import { FuguangJobStore } from "../background/job-store.js";

export const FuguangPaidRequestRuntime = (() => {
  const RESULT_CACHE_NAME = "liusheng-paid-operation-results-v1";
  const RESULT_PREFIX = "https://fuguang.local/__fuguang_operation_results/";
  const MESSAGE_TYPES = Object.freeze({
    execute: "fuguang:paid-request:execute",
    cancel: "fuguang:paid-request:cancel",
    deleteJobResults: "fuguang:paid-request:delete-job-results",
    cleanupExpiredJobResults: "fuguang:paid-request:cleanup-expired-job-results",
    drainPendingCleanupResults: "fuguang:paid-request:drain-pending-cleanup-results"
  });

  function create(options = {}) {
    const jobStore = options.jobStore || FuguangJobStore.create();
    const responseCache = options.responseCache || createCacheStorageResponseCache(options.cacheStorage || globalThis.caches);
    const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    if (typeof fetchImpl !== "function") {
      throw new Error("Paid request runtime requires fetch.");
    }
    const now = typeof options.now === "function" ? options.now : Date.now;
    const monitorIntervalMs = positiveDuration(options.monitorIntervalMs, 250);
    const inFlight = new Map();
    const controllers = new Map();
  const pendingCancels = new Set();

    async function handleRequest(envelope = {}) {
      assertEnvelope(envelope);
      const key = operationKey(envelope.operation);
      if (inFlight.has(key)) {
        return await inFlight.get(key);
      }
      const promise = executeRequest(envelope).finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return await promise;
    }

    async function executeRequest(envelope) {
      const operation = envelope.operation;
      const ownership = currentOwnership(envelope.ownership, now());
      await assertCurrentExecution(jobStore, operation, ownership, now());
      const existing = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId);
      if (existing) {
        const resolved = await resolveExistingOperation(existing, operation, ownership);
        if (resolved) {
          return resolved;
        }
      } else {
        const prepared = await jobStore.prepareOperation(operation, ownership);
        if (!prepared.applied) {
          throw storeRejectionError(prepared);
        }
        if (prepared.alreadyPrepared) {
          const resolved = await resolveExistingOperation(prepared.operation, operation, ownership);
          if (resolved) {
            return resolved;
          }
        }
      }
      if (pendingCancels.delete(operationKey(operation))) {
        throw abortError("请求已取消。");
      }
      const submitted = await jobStore.updateOperation({
        ...operation,
        state: "submitted",
        submittedAt: now(),
        retryAllowed: false,
        definitelyNotAccepted: false
      }, currentOwnership(envelope.ownership, now()));
      if (!submitted.applied) {
        throw storeRejectionError(submitted);
      }

      const controller = new AbortController();
      const key = operationKey(operation);
      controllers.set(key, controller);
      const timeoutMs = positiveDuration(envelope.request.timeoutMs, 90_000);
      const timeout = setTimeout(() => controller.abort(ambiguousError("付费请求超时。")), timeoutMs);
      const stopMonitoring = monitorExecution(jobStore, operation, envelope.ownership, controller, {
        now,
        intervalMs: monitorIntervalMs
      });
      const resultRef = createResultRef(operation);
      let responseCached = false;
      try {
        if (pendingCancels.delete(key)) {
          controller.abort(abortError("请求已取消。"));
        }
        const response = await fetchImpl(envelope.request.url, {
          ...envelope.request.init,
          signal: controller.signal
        });
        const providerRequestId = providerRequestIdFromResponse(response);
        const acceptedMetadata = {
          resultRef,
          status: Number(response.status || 0),
          statusText: String(response.statusText || ""),
          contentType: String(response.headers?.get?.("content-type") || ""),
          providerRequestId
        };
        const accepted = await jobStore.updateOperation({
          ...operation,
          ...acceptedMetadata,
          state: "accepted",
          retryAllowed: false,
          definitelyNotAccepted: false
        }, currentOwnership(envelope.ownership, now()));
        if (!accepted.applied) {
          throw storeRejectionError(accepted, true);
        }
        const bodyText = await response.text();
        const resultHash = `sha256:${await sha256Hex(bodyText)}`;
        const resultBytes = new TextEncoder().encode(bodyText).byteLength;
        const acceptedWithBodyProof = await jobStore.updateOperation({
          ...operation,
          ...acceptedMetadata,
          state: "accepted",
          resultBytes,
          resultHash,
          retryAllowed: false,
          definitelyNotAccepted: false
        }, currentOwnership(envelope.ownership, now()));
        if (!acceptedWithBodyProof.applied) {
          throw storeRejectionError(acceptedWithBodyProof, true);
        }
        await responseCache.put(resultRef, bodyText);
        responseCached = true;
        const responseMetadata = {
          ...acceptedMetadata,
          resultBytes,
          resultHash,
        };
        const completed = await jobStore.updateOperation({
          ...operation,
          ...responseMetadata,
          state: "completed",
          completedAt: now(),
          resultSummary: `HTTP ${responseMetadata.status}`,
          retryAllowed: false,
          definitelyNotAccepted: false
        }, currentOwnership(envelope.ownership, now()));
        if (!completed.applied) {
          throw storeRejectionError(completed, true);
        }
        return {
          operationId: operation.operationId,
          inputHash: operation.inputHash,
          replayed: false,
          response: { ...responseMetadata, bodyText }
        };
      } catch (error) {
        const current = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId).catch(() => null);
        if (!responseCached && current && ["submitted", "accepted"].includes(current.state)) {
          await jobStore.updateOperation({
            ...operation,
            state: "unknown",
            error: error?.message || String(error),
            retryAllowed: false,
            definitelyNotAccepted: false
          }, currentOwnership(envelope.ownership, now())).catch(() => {});
        }
        if (controller.signal.aborted && controller.signal.reason) {
          throw controller.signal.reason;
        }
        if (error?.code === "PAID_REQUEST_STALE_EXECUTION" || error?.name === "AbortError") {
          throw error;
        }
        throw ambiguousError(error?.message || "付费请求结果不确定。", error);
      } finally {
        clearTimeout(timeout);
        stopMonitoring();
        controllers.delete(key);
      }
    }

    async function resolveExistingOperation(existing, requestedOperation, ownership) {
      await assertCurrentExecution(jobStore, requestedOperation, ownership, now());
      if (existing.state !== "prepared") {
        pendingCancels.delete(operationKey(existing));
      }
      if (String(existing.inputHash || "") !== String(requestedOperation.inputHash || "") ||
          String(existing.provider || "") !== String(requestedOperation.provider || "") ||
          String(existing.operationType || "") !== String(requestedOperation.operationType || "")) {
        const error = new Error("Durable paid request operation identity conflicts with the current transient request.");
        error.code = "PAID_REQUEST_OPERATION_CONFLICT";
        throw error;
      }
      if (existing.state === "completed") {
        const bodyText = await responseCache.get(existing.resultRef);
        if (bodyText == null) {
          const error = ambiguousError("付费请求已完成，但 durable 响应正文不可用；禁止自动重发。");
          error.code = "PAID_REQUEST_DURABLE_RESULT_MISSING";
          throw error;
        }
        if (!existing.resultHash || `sha256:${await sha256Hex(bodyText)}` !== existing.resultHash ||
            (Number.isFinite(Number(existing.resultBytes)) && Number(existing.resultBytes) >= 0 &&
              new TextEncoder().encode(bodyText).byteLength !== Number(existing.resultBytes))) {
          const error = ambiguousError("付费请求 durable 响应校验失败；禁止自动重发。");
          error.code = "PAID_REQUEST_DURABLE_RESULT_CORRUPT";
          throw error;
        }
        return {
          operationId: existing.operationId,
          inputHash: existing.inputHash,
          replayed: true,
          response: {
            resultRef: existing.resultRef,
            resultBytes: existing.resultBytes,
            resultHash: existing.resultHash,
            status: existing.status,
            statusText: existing.statusText,
            contentType: existing.contentType,
            providerRequestId: existing.providerRequestId,
            bodyText
          }
        };
      }
      if (existing.state === "accepted") {
        const bodyText = await responseCache.get(existing.resultRef);
        if (bodyText == null) {
          const error = ambiguousError("付费请求已被服务端接受，但 durable 响应正文不可用；禁止自动重发。");
          error.code = "PAID_REQUEST_DURABLE_RESULT_MISSING";
          throw error;
        }
        if (!existing.resultHash || !Number.isFinite(Number(existing.resultBytes)) || Number(existing.resultBytes) < 0) {
          throw ambiguousError("付费请求已被服务端接受，但 durable 响应缺少可信正文校验；禁止自动重发。");
        }
        const actualHash = `sha256:${await sha256Hex(bodyText)}`;
        const actualBytes = new TextEncoder().encode(bodyText).byteLength;
        if (actualHash !== existing.resultHash || actualBytes !== Number(existing.resultBytes)) {
          const error = ambiguousError("付费请求 durable 响应校验失败；禁止自动重发。");
          error.code = "PAID_REQUEST_DURABLE_RESULT_CORRUPT";
          throw error;
        }
        const responseMetadata = {
          resultRef: existing.resultRef,
          resultBytes: actualBytes,
          resultHash: actualHash,
          status: existing.status,
          statusText: existing.statusText,
          contentType: existing.contentType,
          providerRequestId: existing.providerRequestId
        };
        const completed = await jobStore.updateOperation({
          ...requestedOperation,
          ...responseMetadata,
          state: "completed",
          completedAt: now(),
          resultSummary: `HTTP ${responseMetadata.status}`,
          retryAllowed: false,
          definitelyNotAccepted: false
        }, currentOwnership(ownership, now()));
        if (!completed.applied) {
          throw storeRejectionError(completed, true);
        }
        return {
          operationId: existing.operationId,
          inputHash: existing.inputHash,
          replayed: true,
          response: { ...responseMetadata, bodyText }
        };
      }
      if (["submitted", "unknown"].includes(existing.state)) {
        throw ambiguousError(`付费请求处于 ${existing.state} 状态，禁止自动重发。`);
      }
      if (existing.state === "failed") {
        throw ambiguousError("付费请求已失败；必须由用户创建新的语义请求后重试。");
      }
      if (existing.state !== "prepared") {
        throw ambiguousError(`无法恢复付费请求状态：${existing.state}`);
      }
      return null;
    }

    async function cancelRequest(envelope = {}) {
      const operation = envelope.operation || envelope;
      const key = operationKey(operation);
      pendingCancels.add(key);
      const controller = controllers.get(key);
      if (controller && !controller.signal.aborted) {
        pendingCancels.delete(key);
        controller.abort(abortError("请求已取消。"));
        return { cancelled: true, inFlight: true };
      }
      return { cancelled: true, inFlight: false };
    }

    async function writeArtifact(input = {}) {
      const operation = input.operation || {};
      const ownership = currentOwnership(input.ownership, now());
      const bodyText = String(input.bodyText ?? "");
      if (!operation.jobId || !operation.runToken || !operation.operationId ||
          !operation.provider || !operation.operationType || !operation.inputHash) {
        throw new Error("Durable artifact operation is incomplete.");
      }
      await assertCurrentExecution(jobStore, operation, ownership, now());
      const resultRef = createResultRef(operation);
      const resultHash = `sha256:${await sha256Hex(bodyText)}`;
      const resultBytes = new TextEncoder().encode(bodyText).byteLength;
      let existing = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId);
      if (existing) {
        if (String(existing.inputHash || "") !== String(operation.inputHash || "") ||
            String(existing.provider || "") !== String(operation.provider || "") ||
            String(existing.operationType || "") !== String(operation.operationType || "")) {
          const error = new Error("Durable artifact identity conflicts with the existing operation.");
          error.code = "PAID_REQUEST_OPERATION_CONFLICT";
          throw error;
        }
        if (existing.state === "completed") {
          if (existing.resultHash !== resultHash || Number(existing.resultBytes) !== resultBytes) {
            const error = new Error("Durable artifact body conflicts with the completed checkpoint.");
            error.code = "PAID_REQUEST_OPERATION_CONFLICT";
            throw error;
          }
          const cached = await responseCache.get(existing.resultRef);
          if (cached == null || !existing.resultHash || `sha256:${await sha256Hex(cached)}` !== existing.resultHash ||
              (Number.isFinite(Number(existing.resultBytes)) && Number(existing.resultBytes) >= 0 &&
                new TextEncoder().encode(cached).byteLength !== Number(existing.resultBytes))) {
            throw ambiguousError("Durable artifact is completed but its exact body is unavailable.");
          }
          return {
            operationId: existing.operationId,
            inputHash: existing.inputHash,
            resultRef: existing.resultRef,
            replayed: true,
            bodyText: cached
          };
        }
        if (existing.state === "accepted") {
          if (!existing.resultRef || existing.resultRef !== resultRef || !existing.resultHash || existing.resultHash !== resultHash) {
            const error = new Error("Durable artifact accepted metadata conflicts with the supplied body.");
            error.code = "PAID_REQUEST_OPERATION_CONFLICT";
            throw error;
          }
          const cached = await responseCache.get(existing.resultRef);
          if (cached != null && `sha256:${await sha256Hex(cached)}` !== existing.resultHash) {
            const error = ambiguousError("Durable artifact accepted body is corrupt; refusing to overwrite it.");
            error.code = "PAID_REQUEST_DURABLE_RESULT_CORRUPT";
            throw error;
          }
        }
        if (["submitted", "unknown", "failed"].includes(existing.state)) {
          throw ambiguousError(`Durable artifact is in ${existing.state} state and cannot be replaced.`);
        }
      } else {
        const prepared = await jobStore.prepareOperation(operation, ownership);
        if (!prepared.applied) {
          throw storeRejectionError(prepared);
        }
        existing = prepared.operation;
      }
      const accepted = await jobStore.updateOperation({
        ...operation,
        state: "accepted",
        resultRef,
        resultBytes,
        resultHash,
        resultSummary: `artifact ${resultBytes} bytes`,
        retryAllowed: false,
        definitelyNotAccepted: false
      }, currentOwnership(input.ownership, now()));
      if (!accepted.applied) {
        throw storeRejectionError(accepted, true);
      }
      await responseCache.put(resultRef, bodyText);
      const completed = await jobStore.updateOperation({
        ...operation,
        state: "completed",
        completedAt: now(),
        resultRef,
        resultBytes,
        resultHash,
        resultSummary: `artifact ${resultBytes} bytes`,
        retryAllowed: false,
        definitelyNotAccepted: false
      }, currentOwnership(input.ownership, now()));
      if (!completed.applied) {
        throw storeRejectionError(completed, true);
      }
      return {
        operationId: operation.operationId,
        inputHash: operation.inputHash,
        resultRef,
        replayed: false,
        bodyText
      };
    }

    async function readArtifact(input = {}) {
      const operation = input.operation || {};
      const ownership = currentOwnership(input.ownership, now());
      if (!operation.jobId || !operation.runToken || !operation.operationId ||
          !operation.provider || !operation.operationType || !operation.inputHash) {
        throw new Error("Durable artifact operation is incomplete.");
      }
      await assertCurrentExecution(jobStore, operation, ownership, now());
      const existing = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId);
      if (!existing) return null;
      if (String(existing.inputHash || "") !== String(operation.inputHash || "") ||
          String(existing.provider || "") !== String(operation.provider || "") ||
          String(existing.operationType || "") !== String(operation.operationType || "")) {
        const error = new Error("Durable artifact identity conflicts with the existing operation.");
        error.code = "PAID_REQUEST_OPERATION_CONFLICT";
        throw error;
      }
      if (!["accepted", "completed"].includes(existing.state)) {
        if (["submitted", "unknown", "failed"].includes(existing.state)) {
          throw ambiguousError(`Durable artifact is in ${existing.state} state and cannot be replayed.`);
        }
        return null;
      }
      const bodyText = await responseCache.get(existing.resultRef);
      if (bodyText == null || !existing.resultHash || `sha256:${await sha256Hex(bodyText)}` !== existing.resultHash ||
          (Number.isFinite(Number(existing.resultBytes)) && Number(existing.resultBytes) >= 0 &&
            new TextEncoder().encode(bodyText).byteLength !== Number(existing.resultBytes))) {
        throw ambiguousError("Durable artifact body is unavailable or corrupt.");
      }
      if (existing.state === "accepted") {
        const completed = await jobStore.updateOperation({
          ...operation,
          state: "completed",
          completedAt: now(),
          resultRef: existing.resultRef,
          resultBytes: new TextEncoder().encode(bodyText).byteLength,
          resultHash: `sha256:${await sha256Hex(bodyText)}`,
          resultSummary: existing.resultSummary || "artifact recovered",
          retryAllowed: false,
          definitelyNotAccepted: false
        }, currentOwnership(input.ownership, now()));
        if (!completed.applied) throw storeRejectionError(completed, true);
      }
      return {
        operationId: existing.operationId,
        inputHash: existing.inputHash,
        resultRef: existing.resultRef,
        replayed: true,
        bodyText
      };
    }

    async function annotateOperation(input = {}) {
      const operation = input.operation || {};
      const ownership = currentOwnership(input.ownership, now());
      await assertCurrentExecution(jobStore, operation, ownership, now());
      const current = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId);
      if (!current) throw new Error("Durable operation is unavailable for annotation.");
      if (String(current.provider || "") !== String(operation.provider || "") ||
          String(current.operationType || "") !== String(operation.operationType || "") ||
          String(current.inputHash || "") !== String(operation.inputHash || "")) {
        const error = new Error("Durable operation annotation identity conflicts with the existing operation.");
        error.code = "PAID_REQUEST_OPERATION_CONFLICT";
        throw error;
      }
      const remoteTaskId = String(input.remoteTaskId || "").trim();
      if (!remoteTaskId) throw new Error("Durable operation annotation requires remoteTaskId.");
      if (current.remoteTaskId && current.remoteTaskId !== remoteTaskId) {
        const error = new Error("Durable operation already belongs to a different remote task.");
        error.code = "PAID_REQUEST_OPERATION_CONFLICT";
        throw error;
      }
      const updated = await jobStore.updateOperation({
        ...operation,
        state: current.state,
        remoteTaskId
      }, currentOwnership(input.ownership, now()));
      if (!updated.applied) throw storeRejectionError(updated, current.state !== "prepared");
      return updated.operation;
    }

    async function readCompletedFunAsrSubmitForCancellation(operation = {}) {
      const existing = await jobStore.getOperation(operation.jobId, operation.runToken, operation.operationId);
      if (!existing) return null;
      if (existing.provider !== "dashscope_funasr" || existing.operationType !== "funasr-submit" ||
          !["accepted", "completed"].includes(existing.state) ||
          Number(existing.status || 0) < 200 || Number(existing.status || 0) >= 300 ||
          (operation.inputHash && String(existing.inputHash || "") !== String(operation.inputHash || ""))) {
        return null;
      }
      const bodyText = await responseCache.get(existing.resultRef);
      if (bodyText == null || !existing.resultHash ||
          `sha256:${await sha256Hex(bodyText)}` !== existing.resultHash ||
          new TextEncoder().encode(bodyText).byteLength !== Number(existing.resultBytes)) {
        const error = ambiguousError("Fun-ASR submit response is unavailable or corrupt; remote cancellation cannot infer a task id.");
        error.code = "PAID_REQUEST_DURABLE_RESULT_CORRUPT";
        throw error;
      }
      return {
        operationId: existing.operationId,
        inputHash: existing.inputHash,
        bodyText
      };
    }

    async function deleteJobResults(jobId) {
      const operations = await jobStore.listOperations(jobId);
      let cachedResults = 0;
      for (const operation of operations) {
        if (operation.resultRef && await responseCache.delete(operation.resultRef)) {
          cachedResults += 1;
        }
      }
      if (typeof responseCache.deleteJob === "function") {
        cachedResults += Number(await responseCache.deleteJob(jobId)) || 0;
      }
      const deleted = await jobStore.deleteJob(jobId);
      return { ...deleted, cachedResults };
    }

    async function cleanupExpiredJobResults(input = {}) {
      const expected = {
        ...normalizeExpiredCleanupInput(input),
        checkedAt: Number(input.checkedAt || now())
      };
      // Delete the exact expired run ledger atomically before touching cache.
      // A new run with the same jobId can appear at any time; prefix deletion or
      // a check-delete-check sequence could destroy its durable response body.
      const deleted = await jobStore.deleteExpiredJob(expected);
      if (!deleted.applied) return deleted;
      const cleaned = await cleanupClaimResults(deleted.cleanupClaim);
      return { ...deleted, applied: true, cachedResults: cleaned.cachedResults };
    }

    async function cleanupClaimResults(claim = {}) {
      let cachedResults = 0;
      for (const resultRef of claim.resultRefs || []) {
        if (await responseCache.delete(resultRef)) {
          cachedResults += 1;
        }
      }
      const completed = await jobStore.completeCleanupClaim({
        key: claim.key,
        completedAt: now()
      });
      if (!completed.applied) {
        throw new Error(`Durable cleanup claim completion failed: ${completed.reason || "unknown"}`);
      }
      return { applied: true, cachedResults, cleanupClaim: completed.cleanupClaim };
    }

    async function drainPendingCleanupResults() {
      const claims = await jobStore.listCleanupClaims({ state: "pending" });
      let completed = 0;
      let failed = 0;
      let cachedResults = 0;
      for (const claim of claims) {
        try {
          const result = await cleanupClaimResults(claim);
          completed += 1;
          cachedResults += Number(result.cachedResults || 0) || 0;
        } catch {
          failed += 1;
        }
      }
      return { pending: claims.length, completed, failed, cachedResults };
    }

    return {
      cancelRequest,
      cleanupExpiredJobResults,
      drainPendingCleanupResults,
      deleteJobResults,
      handleRequest,
      annotateOperation,
      jobStore,
      readArtifact,
      readCompletedFunAsrSubmitForCancellation,
      writeArtifact
    };
  }

  let defaultRuntime = null;

  function getDefaultRuntime(options = {}) {
    if (!defaultRuntime) {
      defaultRuntime = create(options);
    }
    return defaultRuntime;
  }

  function monitorExecution(jobStore, operation, ownership, controller, options = {}) {
    let stopped = false;
    let checking = false;
    const now = options.now || Date.now;
    const timer = setInterval(async () => {
      if (stopped || checking || controller.signal.aborted) return;
      checking = true;
      try {
        await assertCurrentExecution(jobStore, operation, currentOwnership(ownership, now()), now());
      } catch (error) {
        controller.abort(error);
      } finally {
        checking = false;
      }
    }, options.intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  async function assertCurrentExecution(jobStore, operation, ownership, checkedAt) {
    const job = await jobStore.getJob(operation.jobId);
    if (!job ||
        String(job.runToken || "") !== String(operation.runToken || "") ||
        String(job.executionRunToken || "") !== String(operation.runToken || "") ||
        String(job.executionOwnerId || "") !== String(ownership.executionOwnerId || "") ||
        Number(job.executionEpoch || 0) !== Number(ownership.executionEpoch || 0) ||
        Number(job.executionLeaseExpiresAt || 0) <= Number(checkedAt || 0)) {
      throw staleExecutionError();
    }
    if (job.cancelRequested || FuguangJobContract.isTerminalStatus(job.status)) {
      throw abortError("任务已停止。");
    }
    return job;
  }

  function createCacheStorageResponseCache(cacheStorage) {
    if (!cacheStorage?.open) {
      throw new Error("CacheStorage is unavailable for durable paid responses.");
    }
    return {
      async put(ref, bodyText) {
        const cache = await cacheStorage.open(RESULT_CACHE_NAME);
        await cache.put(ref, new Response(String(bodyText)));
      },
      async get(ref) {
        const cache = await cacheStorage.open(RESULT_CACHE_NAME);
        const response = await cache.match(ref);
        return response ? await response.text() : null;
      },
      async delete(ref) {
        const cache = await cacheStorage.open(RESULT_CACHE_NAME);
        return await cache.delete(ref);
      },
      async deleteJob(jobId) {
        const cache = await cacheStorage.open(RESULT_CACHE_NAME);
        const keys = await cache.keys();
        let deleted = 0;
        for (const request of keys) {
          let matches = false;
          try {
            matches = decodeURIComponent(new URL(request.url).pathname).includes(`/${jobId}/`);
          } catch {
            matches = false;
          }
          if (matches && await cache.delete(request)) {
            deleted += 1;
          }
        }
        return deleted;
      }
    };
  }

  function installChromeRuntimeMessageListener(options = {}) {
    const chromeRuntime = options.chromeRuntime || globalThis.chrome?.runtime;
    if (!chromeRuntime?.onMessage?.addListener) {
      throw new Error("Chrome runtime messaging is unavailable for paid requests.");
    }
    const runtime = options.runtime || getDefaultRuntime(options);
    const listener = (message = {}, _sender, sendResponse) => {
      if (!Object.values(MESSAGE_TYPES).includes(message?.type)) {
        return false;
      }
      Promise.resolve().then(async () => {
        if (message.type === MESSAGE_TYPES.execute) {
          assertJsonSafeExecuteEnvelope(message.envelope);
          return await runtime.handleRequest(message.envelope);
        }
        if (message.type === MESSAGE_TYPES.cancel) {
          assertJsonSafeValue(message.envelope, "cancel envelope");
          return await runtime.cancelRequest(message.envelope);
        }
        if (message.type === MESSAGE_TYPES.cleanupExpiredJobResults) {
          assertJsonSafeValue(message.cleanup, "paid request expired cleanup");
          return await runtime.cleanupExpiredJobResults(message.cleanup);
        }
        if (message.type === MESSAGE_TYPES.drainPendingCleanupResults) {
          return await runtime.drainPendingCleanupResults();
        }
        const jobId = String(message.jobId || "").trim();
        if (!jobId) {
          throw jsonSafeMessageError("Paid request cleanup requires jobId.");
        }
        return await runtime.deleteJobResults(jobId);
      }).then(
        result => sendResponse({ ok: true, result }),
        error => sendResponse({ ok: false, error: serializeMessageError(error) })
      );
      return true;
    };
    chromeRuntime.onMessage.addListener(listener);
    return {
      listener,
      runtime,
      uninstall() {
        chromeRuntime.onMessage.removeListener?.(listener);
      }
    };
  }

  function normalizeExpiredCleanupInput(input = {}) {
    const jobId = String(input.jobId || "").trim();
    const runToken = String(input.runToken || "").trim();
    const expectedUpdatedAt = Number(input.expectedUpdatedAt || 0);
    const cutoff = Number(input.cutoff || 0);
    if (!jobId || !runToken || !Number.isFinite(expectedUpdatedAt) || expectedUpdatedAt <= 0 ||
        !Number.isFinite(cutoff) || cutoff <= 0) {
      throw jsonSafeMessageError("Paid request expired cleanup has an invalid identity or cutoff.");
    }
    return { jobId, runToken, expectedUpdatedAt, cutoff };
  }

  async function validateExpiredCleanupTarget(jobStore, expected) {
    const job = await jobStore.getJob(expected.jobId);
    if (!job) return { ok: false, reason: "missing-job" };
    if (String(job.runToken || "") !== expected.runToken) {
      return { ok: false, reason: "stale-run" };
    }
    const updatedAt = Number(job.updatedAt || job.createdAt || 0);
    if (updatedAt !== expected.expectedUpdatedAt) {
      return { ok: false, reason: "changed-job" };
    }
    const status = String(job.status || "");
    if (!FuguangJobContract.isTerminalStatus(status) && status !== "interrupted") {
      return { ok: false, reason: "active-job" };
    }
    if (updatedAt >= expected.cutoff) {
      return { ok: false, reason: "recent-job" };
    }
    return { ok: true, job };
  }

  function assertJsonSafeExecuteEnvelope(envelope) {
    assertJsonSafeValue(envelope, "execute envelope");
    if (!envelope?.request || typeof envelope.request.url !== "string" ||
        !envelope.request.init || typeof envelope.request.init !== "object") {
      throw jsonSafeMessageError("Paid request execute envelope is incomplete.");
    }
    const body = envelope.request.init.body;
    if (body != null && typeof body !== "string") {
      throw jsonSafeMessageError("Paid request runtime messaging only supports text request bodies.");
    }
  }

  function assertJsonSafeValue(value, label, seen = new Set()) {
    if (value == null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || seen.has(value)) {
      throw jsonSafeMessageError(`Paid request ${label} must be JSON-safe.`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      throw jsonSafeMessageError(`Paid request ${label} must not contain binary or platform objects.`);
    }
    seen.add(value);
    for (const item of Array.isArray(value) ? value : Object.values(value)) {
      assertJsonSafeValue(item, label, seen);
    }
    seen.delete(value);
  }

  function jsonSafeMessageError(message) {
    const error = new Error(message);
    error.code = "PAID_REQUEST_MESSAGE_NOT_JSON_SAFE";
    return error;
  }

  function serializeMessageError(error) {
    return {
      name: String(error?.name || "Error"),
      message: String(error?.message || error || "Paid request failed."),
      code: String(error?.code || ""),
      status: Number(error?.status || 0) || 0
    };
  }

  function createResultRef(operation) {
    const opaqueOperationId = String(operation.operationId || "").replace(/[^a-z0-9:_-]/gi, "");
    if (!opaqueOperationId) {
      throw new Error("Paid request operation id is unavailable for durable result references.");
    }
    return `${RESULT_PREFIX}${encodeURIComponent(operation.jobId)}/${encodeURIComponent(operation.runToken)}/${encodeURIComponent(opaqueOperationId)}`;
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function providerRequestIdFromResponse(response) {
    for (const name of ["x-request-id", "request-id", "x-amzn-requestid", "cf-ray"]) {
      const value = response.headers?.get?.(name);
      if (value) return String(value);
    }
    return "";
  }

  function currentOwnership(ownership = {}, checkedAt = Date.now()) {
    return {
      executionOwnerId: String(ownership.executionOwnerId || ownership.ownerId || ""),
      executionEpoch: Number(ownership.executionEpoch || 0),
      checkedAt: Number(checkedAt || 0)
    };
  }

  function operationKey(operation = {}) {
    return FuguangJobContract.operationKey(operation.jobId, operation.runToken, operation.operationId);
  }

  function assertEnvelope(envelope) {
    if (!envelope?.operation?.jobId || !envelope?.operation?.runToken || !envelope?.operation?.operationId ||
        !envelope?.request?.url || typeof envelope?.request?.init !== "object") {
      throw new Error("Paid request envelope is incomplete.");
    }
    if (typeof (globalThis.fetch) !== "function" && !envelope.fetchImpl) {
      // The injected runtime fetch is checked when invoked.
    }
  }

  function storeRejectionError(result = {}, deliveryAmbiguous = false) {
    if (result.reason === "expired-lease" || result.reason === "stale-run" || result.reason === "stale-owner" || result.reason === "stale-epoch" || result.reason === "inactive-job") {
      return staleExecutionError(result.reason);
    }
    const error = new Error(`Durable paid request write rejected: ${result.reason || "unknown"}`);
    error.code = "PAID_REQUEST_STORE_REJECTED";
    error.deliveryAmbiguous = Boolean(deliveryAmbiguous);
    return error;
  }

  function staleExecutionError(reason = "stale execution") {
    const error = new Error(`付费请求执行权已失效：${reason}`);
    error.code = "PAID_REQUEST_STALE_EXECUTION";
    return error;
  }

  function ambiguousError(message, cause = null) {
    const error = new Error(message);
    error.code = "PAID_REQUEST_DELIVERY_AMBIGUOUS";
    error.deliveryAmbiguous = true;
    if (cause instanceof Error) error.cause = cause;
    return error;
  }

  function abortError(message) {
    const error = message instanceof Error ? message : new Error(String(message || "任务已停止。"));
    error.name = "AbortError";
    return error;
  }

  function positiveDuration(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  return {
    MESSAGE_TYPES,
    create,
    createCacheStorageResponseCache,
    getDefaultRuntime,
    installChromeRuntimeMessageListener
  };
})();

if (globalThis.chrome?.runtime?.onMessage?.addListener && !globalThis.__fuguangPaidRequestRuntimeListener) {
  globalThis.__fuguangPaidRequestRuntimeListener = FuguangPaidRequestRuntime.installChromeRuntimeMessageListener();
}
