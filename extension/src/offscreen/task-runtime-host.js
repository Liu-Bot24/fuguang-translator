import { FuguangJobStore } from "../background/job-store.js";
import { FuguangJobContract } from "../shared/job-contract.js";
import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";
import { createDurableFunAsrCancellationHandler } from "./browser-funasr-executor.js";
import { executeOffscreenJob } from "./task-runtime-executor.js";

export function createTaskRuntimeHost(options = {}) {
  const jobStore = options.jobStore || FuguangJobStore.create();
  const executeJob = typeof options.executeJob === "function" ? options.executeJob : null;
  const cancelJob = typeof options.cancelJob === "function" ? options.cancelJob : async () => {};
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const leaseDurationMs = Math.max(1, Number(options.leaseDurationMs || 30_000) || 30_000);
  const heartbeatIntervalMs = options.heartbeatIntervalMs === 0
    ? 0
    : Math.max(1, Number(options.heartbeatIntervalMs || Math.floor(leaseDurationMs / 3)) || 10_000);
  const ownerId = String(options.ownerId || createRuntimeOwnerId());
  const activeRuns = new Map();
  const connectedPorts = new Set();

  async function handleCommand(command = {}) {
    const type = String(command.type || "");
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.OBSERVE_JOB) {
      const snapshot = command.snapshot || {};
      const result = await jobStore.putSnapshot(snapshot);
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
        accepted: result.applied !== false,
        reason: result.reason || "",
        jobId: snapshot.job?.id || "",
        runToken: snapshot.job?.runToken || "",
        shadow: true
      });
    }
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.START_JOB) {
      return startJob(command);
    }
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.WAKE_JOB) {
      return wakeJob(command);
    }
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.CANCEL_JOB) {
      return requestCancellation(command);
    }
    if (type === FuguangTaskRuntimeProtocol.MESSAGE.GET_JOB) {
      const job = await jobStore.getJob(command.jobId);
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.STATUS, command, { job });
    }
    return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
      error: "Unknown task runtime command."
    });
  }

  async function startJob(command) {
    const suppliedSnapshot = command.snapshot || {};
    const suppliedJob = suppliedSnapshot.job || {};
    const resumeExisting = Boolean(command.resumeExisting);
    let snapshotApplied = false;
    let snapshot = suppliedSnapshot;
    let job = suppliedJob;
    if (!job.id || !job.runToken) {
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
        error: "Task start requires job id and runToken."
      });
    }
    if (!executeJob) {
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
        error: "Offscreen task executor is unavailable.",
        jobId: job.id,
        runToken: job.runToken
      });
    }
    const runKey = `${job.id}:${job.runToken}`;
    const activeRun = activeRuns.get(runKey);
    if (activeRun) {
      const durable = await jobStore.getJob(job.id).catch(() => null);
      if (runOwnsDurableLease(activeRun, durable, job, ownerId, now())) {
        if (resumeExisting && String(durable?.status || "") === "interrupted") {
          return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
            error: "The previous offscreen run is releasing its lease.",
            reason: "active-run-settling",
            retryable: true,
            jobId: job.id,
            runToken: job.runToken
          });
        }
        return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
          accepted: true,
          duplicate: true,
          snapshotApplied: false,
          resumed: resumeExisting,
          jobId: job.id,
          runToken: job.runToken,
          executionOwnerId: ownerId,
          executionEpoch: activeRun.executionEpoch,
          executionLeaseExpiresAt: Number(activeRun.executionLeaseExpiresAt || 0) || 0
        });
      }
      fenceActiveRun(runKey, activeRun, "Task execution lease is no longer owned by this runtime.");
    }
    if (resumeExisting) {
      let durableSnapshot;
      try {
        durableSnapshot = await jobStore.getSnapshot(job.id, job.runToken);
      } catch (error) {
        return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
          error: String(error?.message || error || "Task resume snapshot read failed."),
          reason: "snapshot-read-error",
          retryable: true,
          jobId: job.id,
          runToken: job.runToken
        });
      }
      if (!durableSnapshot?.job || String(durableSnapshot.job.runToken || "") !== String(job.runToken || "")) {
        return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
          error: "Task resume could not load the durable snapshot.",
          jobId: job.id,
          runToken: job.runToken
        });
      }
      snapshot = durableSnapshot;
      job = durableSnapshot.job;
    } else {
      const result = await jobStore.putSnapshot(snapshot);
      if (result.applied === false && result.reason !== "stale-snapshot") {
        return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
          error: result.reason || "Task start was rejected.",
          reason: result.reason || "",
          jobId: job.id,
          runToken: job.runToken
        });
      }
      snapshotApplied = result.applied !== false;
    }
    const claim = await jobStore.claimRun(job.id, job.runToken, {
      ownerId,
      claimedAt: now(),
      leaseDurationMs
    });
    if (claim.applied === false && claim.reason === "duplicate-run") {
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
        accepted: true,
        duplicate: true,
        snapshotApplied,
        resumed: resumeExisting,
        jobId: job.id,
        runToken: job.runToken,
        executionOwnerId: claim.executionOwnerId || "",
        executionEpoch: Number(claim.executionEpoch || 0) || 0,
        executionLeaseExpiresAt: Number(claim.executionLeaseExpiresAt || 0) || 0
      });
    }
    if (claim.applied === false) {
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
        error: claim.reason || "Task run claim was rejected.",
        reason: claim.reason || "",
        jobId: job.id,
        runToken: job.runToken
      });
    }
    const controller = new AbortController();
    const run = {
      controller,
      wakeChannel: createWakeChannel(),
      command,
      started: false,
      fenced: false,
      heartbeatInFlight: false,
      heartbeatTimer: null,
      executionEpoch: Number(claim.job?.executionEpoch || 0) || 0,
      executionLeaseExpiresAt: Number(claim.job?.executionLeaseExpiresAt || 0) || 0
    };
    activeRuns.set(runKey, run);
    startLeaseHeartbeat(runKey, run, job);
    setTimeout(() => {
      if (activeRuns.get(runKey) !== run || controller.signal.aborted) {
        stopLeaseHeartbeat(run);
        jobStore.releaseRun(job.id, job.runToken, ownerId, now(), run.executionEpoch).catch(() => {});
        return;
      }
      run.started = true;
      Promise.resolve(executeJob(command.runtime || {}, {
        job,
        chunks: snapshot.chunks || [],
        signal: controller.signal,
        waitForWake: (timeoutMs, signal = controller.signal) => run.wakeChannel.wait(timeoutMs, signal),
        executionOwnerId: ownerId,
        executionEpoch: run.executionEpoch
      }))
        .catch(async error => {
          if (controller.signal.aborted) {
            return;
          }
          const current = await jobStore.getJob(job.id).catch(() => null);
          if (!current || current.runToken !== job.runToken || current.cancelRequested ||
              current.status === "interrupted" || FuguangJobContract.isTerminalStatus(current.status) ||
              String(current.executionOwnerId || "") !== ownerId ||
              Number(current.executionEpoch || 0) !== run.executionEpoch) {
            return;
          }
          await jobStore.putSnapshotIfOwned({
            job: {
              ...current,
              status: "failed",
              stage: "failed",
              error: String(error?.message || error || "Offscreen task execution failed."),
              updatedAt: Date.now()
            },
            chunks: []
          }, {
            executionOwnerId: ownerId,
            executionEpoch: run.executionEpoch,
            checkedAt: now()
          }).catch(() => {});
        })
        .finally(async () => {
          stopLeaseHeartbeat(run);
          await jobStore.releaseRun(job.id, job.runToken, ownerId, now(), run.executionEpoch).catch(() => {});
          if (activeRuns.get(runKey) === run) {
            activeRuns.delete(runKey);
          }
        });
    }, 0);
    return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
      accepted: true,
      duplicate: false,
      snapshotApplied,
      resumed: resumeExisting,
      jobId: job.id,
      runToken: job.runToken,
      executionOwnerId: ownerId,
      executionEpoch: run.executionEpoch,
      executionLeaseExpiresAt: Number(run.executionLeaseExpiresAt || 0) || 0
    });
  }

  function wakeJob(command) {
    const jobId = String(command.jobId || "");
    const runToken = String(command.runToken || "");
    const run = activeRuns.get(`${jobId}:${runToken}`);
    const accepted = Boolean(run && !run.fenced && !run.controller.signal.aborted);
    if (accepted) {
      run.wakeChannel.wake();
    }
    return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
      accepted,
      reason: accepted ? "" : "inactive-run",
      jobId,
      runToken
    });
  }

  function startLeaseHeartbeat(runKey, run, job) {
    if (!heartbeatIntervalMs || typeof setInterval !== "function") {
      return;
    }
    run.heartbeatTimer = setInterval(async () => {
      if (run.heartbeatInFlight || !activeRuns.has(runKey) || run.controller.signal.aborted) {
        return;
      }
      run.heartbeatInFlight = true;
      try {
        const result = await jobStore.renewRunLease(
          job.id,
          job.runToken,
          ownerId,
          now(),
          leaseDurationMs,
          run.executionEpoch
        );
        if (!result.applied) {
          if (result.reason === "inactive-job") {
            const durable = await jobStore.getJob(job.id).catch(() => null);
            if (durable?.runToken === job.runToken && durable.cancelRequested) {
              cancelActiveRun(run, "Task cancellation was observed in durable state.");
              return;
            }
          }
          fenceActiveRun(runKey, run, "Task execution lease was lost.");
          return;
        }
        run.executionLeaseExpiresAt = Number(result.job?.executionLeaseExpiresAt || 0) || 0;
      } catch {
        if (run.executionLeaseExpiresAt && now() >= run.executionLeaseExpiresAt) {
          fenceActiveRun(runKey, run, "Task execution lease expired before it could be renewed.");
        }
      } finally {
        run.heartbeatInFlight = false;
      }
    }, heartbeatIntervalMs);
  }

  function stopLeaseHeartbeat(run) {
    if (run?.heartbeatTimer != null) {
      clearInterval(run.heartbeatTimer);
      run.heartbeatTimer = null;
    }
  }

  function runOwnsDurableLease(run, durable, job, expectedOwnerId, checkedAt) {
    return Boolean(
      run && !run.fenced && !run.controller.signal.aborted &&
      durable && String(durable.runToken || "") === String(job.runToken || "") &&
      String(durable.executionOwnerId || "") === String(expectedOwnerId || "") &&
      Number(durable.executionEpoch || 0) === Number(run.executionEpoch || 0) &&
      Number(durable.executionLeaseExpiresAt || 0) > Number(checkedAt || 0)
    );
  }

  function fenceActiveRun(runKey, run, message) {
    if (!run || run.fenced) {
      return;
    }
    run.fenced = true;
    stopLeaseHeartbeat(run);
    const error = new Error(message || "Task execution lease was lost.");
    error.name = "AbortError";
    run.controller.abort(error);
    if (activeRuns.get(runKey) === run) {
      activeRuns.delete(runKey);
    }
  }

  function cancelActiveRun(run, message) {
    if (!run || run.controller.signal.aborted) return;
    const cancellation = new Error(message || "Task cancellation requested.");
    cancellation.name = "AbortError";
    cancellation.code = "FUGUANG_TASK_CANCEL_REQUESTED";
    run.controller.abort(cancellation);
  }

  async function requestCancellation(command) {
    const jobId = String(command.jobId || "");
    const runToken = String(command.runToken || "");
    const requestedAt = Number(command.requestedAt || Date.now());
    const result = await jobStore.markCancelRequested(jobId, runToken, requestedAt);
    const cancellationAccepted = Boolean(result.applied || result.reason === "already-cancelled");
    const run = activeRuns.get(`${jobId}:${runToken}`);
    cancelActiveRun(run);
    if (cancellationAccepted) {
      const funAsrConfig = command.funAsrCancelConfig && typeof command.funAsrCancelConfig === "object"
        ? JSON.parse(JSON.stringify(command.funAsrCancelConfig))
        : undefined;
      setTimeout(() => Promise.resolve(cancelJob({ jobId, runToken, requestedAt, funAsrConfig })).catch(() => {}), 0);
    }
    return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
      accepted: cancellationAccepted,
      reason: result.reason || "",
      jobId,
      runToken
    });
  }

  function attachPort(port) {
    if (!FuguangTaskRuntimeProtocol.isRuntimePort(port)) {
      return false;
    }
    connectedPorts.add(port);
    port.postMessage({
      type: FuguangTaskRuntimeProtocol.MESSAGE.READY,
      protocolVersion: FuguangTaskRuntimeProtocol.VERSION
    });
    const onMessage = command => {
      handleCommand(command)
        .then(result => port.postMessage(result))
        .catch(error => port.postMessage(FuguangTaskRuntimeProtocol.response(
          FuguangTaskRuntimeProtocol.MESSAGE.ERROR,
          command,
          { error: error.message || String(error) }
        )));
    };
    port.onMessage?.addListener?.(onMessage);
    port.onDisconnect?.addListener?.(() => {
      connectedPorts.delete(port);
      port.onMessage?.removeListener?.(onMessage);
    });
    return true;
  }

  function install(runtime = globalThis.chrome?.runtime) {
    runtime?.onConnect?.addListener?.(attachPort);
    return Boolean(runtime?.onConnect?.addListener);
  }

  return {
    activeRuns,
    attachPort,
    executionEnabled: Boolean(executeJob),
    handleCommand,
    install,
    jobStore,
    ownerId
  };
}

function createWakeChannel() {
  let pending = false;
  const waiters = new Set();
  return {
    wake() {
      pending = true;
      for (const resolve of [...waiters]) {
        resolve({ reason: "wake" });
      }
      waiters.clear();
    },
    wait(timeoutMs, signal = null) {
      if (pending) {
        pending = false;
        return Promise.resolve({ reason: "wake" });
      }
      if (signal?.aborted) {
        return Promise.reject(abortError(signal.reason));
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (callback, value) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          waiters.delete(onWake);
          signal?.removeEventListener?.("abort", onAbort);
          callback(value);
        };
        const onWake = value => {
          pending = false;
          settle(resolve, value || { reason: "wake" });
        };
        const onAbort = () => settle(reject, abortError(signal?.reason));
        const timer = setTimeout(() => settle(resolve, { reason: "timeout" }), Math.max(0, Number(timeoutMs) || 0));
        waiters.add(onWake);
        signal?.addEventListener?.("abort", onAbort, { once: true });
      });
    }
  };
}

function abortError(reason) {
  const error = new Error(reason?.message || "Task cancellation requested.");
  error.name = "AbortError";
  return error;
}

function createRuntimeOwnerId() {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `offscreen:${suffix}`;
}

const productionJobStore = FuguangJobStore.create();
const productionFunAsrCancellation = createDurableFunAsrCancellationHandler({ jobStore: productionJobStore });
export const FuguangOffscreenTaskRuntime = createTaskRuntimeHost({
  jobStore: productionJobStore,
  executeJob: executeOffscreenJob,
  cancelJob: productionFunAsrCancellation
});
FuguangOffscreenTaskRuntime.install();
;
