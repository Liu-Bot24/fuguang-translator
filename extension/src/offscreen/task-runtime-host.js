import { FuguangJobStore } from "../background/job-store.js";
import { FuguangTaskRuntimeProtocol } from "../shared/task-runtime-protocol.js";
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
    const snapshot = command.snapshot || {};
    const job = snapshot.job || {};
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
        return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
          accepted: true,
          duplicate: true,
          jobId: job.id,
          runToken: job.runToken,
          executionOwnerId: ownerId,
          executionEpoch: activeRun.executionEpoch,
          executionLeaseExpiresAt: Number(activeRun.executionLeaseExpiresAt || 0) || 0
        });
      }
      fenceActiveRun(runKey, activeRun, "Task execution lease is no longer owned by this runtime.");
    }
    const result = await jobStore.putSnapshot(snapshot);
    if (result.applied === false && result.reason !== "stale-snapshot") {
      return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ERROR, command, {
        error: result.reason || "Task start was rejected.",
        jobId: job.id,
        runToken: job.runToken
      });
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
        jobId: job.id,
        runToken: job.runToken
      });
    }
    const controller = new AbortController();
    const run = {
      controller,
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
        executionOwnerId: ownerId,
        executionEpoch: run.executionEpoch
      }))
        .catch(async error => {
          if (controller.signal.aborted) {
            return;
          }
          const current = await jobStore.getJob(job.id).catch(() => null);
          if (!current || current.runToken !== job.runToken || current.cancelRequested ||
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
      jobId: job.id,
      runToken: job.runToken,
      executionOwnerId: ownerId,
      executionEpoch: run.executionEpoch,
      executionLeaseExpiresAt: Number(run.executionLeaseExpiresAt || 0) || 0
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

  async function requestCancellation(command) {
    const jobId = String(command.jobId || "");
    const runToken = String(command.runToken || "");
    const requestedAt = Number(command.requestedAt || Date.now());
    const result = await jobStore.markCancelRequested(jobId, runToken, requestedAt);
    const run = activeRuns.get(`${jobId}:${runToken}`);
    run?.controller.abort(new Error("Task cancellation requested."));
    if (result.applied) {
      setTimeout(() => Promise.resolve(cancelJob({ jobId, runToken, requestedAt })).catch(() => {}), 0);
    }
    return FuguangTaskRuntimeProtocol.response(FuguangTaskRuntimeProtocol.MESSAGE.ACK, command, {
      accepted: Boolean(result.applied),
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

function createRuntimeOwnerId() {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `offscreen:${suffix}`;
}

export const FuguangOffscreenTaskRuntime = createTaskRuntimeHost({ executeJob: executeOffscreenJob });
FuguangOffscreenTaskRuntime.install();
;
