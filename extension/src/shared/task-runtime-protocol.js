export const FuguangTaskRuntimeProtocol = (() => {
  const VERSION = 1;
  const PORT_NAME = "fuguang-task-runtime-v1";
  const MESSAGE = Object.freeze({
    READY: "FUGUANG_TASK_RUNTIME_READY",
    OBSERVE_JOB: "FUGUANG_TASK_RUNTIME_OBSERVE_JOB",
    START_JOB: "FUGUANG_TASK_RUNTIME_START_JOB",
    CANCEL_JOB: "FUGUANG_TASK_RUNTIME_CANCEL_JOB",
    GET_JOB_WORK: "FUGUANG_TASK_RUNTIME_GET_JOB_WORK",
    PROCESS_JOB_CHUNK: "FUGUANG_TASK_RUNTIME_PROCESS_JOB_CHUNK",
    FINALIZE_JOB: "FUGUANG_TASK_RUNTIME_FINALIZE_JOB",
    FAIL_JOB: "FUGUANG_TASK_RUNTIME_FAIL_JOB",
    GET_JOB: "FUGUANG_TASK_RUNTIME_GET_JOB",
    ACK: "FUGUANG_TASK_RUNTIME_ACK",
    STATUS: "FUGUANG_TASK_RUNTIME_STATUS",
    ERROR: "FUGUANG_TASK_RUNTIME_ERROR"
  });

  function createCommandId(randomUUID = defaultRandomUUID) {
    return String(randomUUID()).trim();
  }

  function defaultRandomUUID() {
    if (typeof globalThis.crypto?.randomUUID !== "function") {
      throw new Error("Web Crypto randomUUID is unavailable.");
    }
    return globalThis.crypto.randomUUID();
  }

  function isRuntimePort(port) {
    return Boolean(port && port.name === PORT_NAME && typeof port.postMessage === "function");
  }

  function response(type, command = {}, payload = {}) {
    return {
      type,
      protocolVersion: VERSION,
      commandId: String(command.commandId || ""),
      ...payload
    };
  }

  return {
    MESSAGE,
    PORT_NAME,
    VERSION,
    createCommandId,
    isRuntimePort,
    response
  };
})();
