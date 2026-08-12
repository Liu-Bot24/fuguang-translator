import { FFmpeg } from "../vendor/@ffmpeg/ffmpeg/index.js";

import {
  buildConcatAudioArgs,
  buildExtractAudioArgs,
  inferExtensionFromMime,
  normalizeOutputFormat,
  safeFileStem,
  safeVirtualFileName,
  uniqueVirtualFileName
} from "./ffmpeg-options.js";

const APP = "fuguang-web-ffmpeg";
const CORE_BASE_URL = new URL("../vendor/@ffmpeg/core", import.meta.url).href.replace(/\/$/, "");
const VAD_SPEECH_PAD_SECONDS = 0.4;
const VAD_SPEECH_MERGE_GAP_SECONDS = 0.15;

const state = {
  ffmpeg: null,
  loadPromise: null,
  currentClient: null,
  currentTask: null,
  currentRequestId: "",
  heartbeatTimer: null,
  lastHeartbeatAt: 0,
  allowedOrigin: new URL(location.href).searchParams.get("allowedOrigin") || "",
  status: document.querySelector("#status"),
  log: document.querySelector("#log"),
  ffmpegLogs: []
};
let ffmpegOperationQueue = Promise.resolve();

window.addEventListener("message", event => {
  const messageType = String(event.data?.type || "");
  const operation = ["extract-audio", "concat-audio", "collect-speech-audio"].includes(messageType)
    ? enqueueFfmpegOperation(() => handleMessage(event))
    : handleMessage(event);
  operation.catch(error => {
    post(event, {
      type: "error",
      id: event.data?.id || "",
      error: error.message || String(error)
    });
  });
});

function enqueueFfmpegOperation(task) {
  const run = ffmpegOperationQueue.then(task, task);
  ffmpegOperationQueue = run.catch(() => {});
  return run;
}

postReady();

async function handleMessage(event) {
  const message = event.data || {};
  if (message.app !== APP || !message.type) {
    return;
  }
  if (state.allowedOrigin && event.origin !== state.allowedOrigin) {
    return;
  }
  state.currentClient = { source: event.source, origin: event.origin || "*" };

  if (message.type === "ping") {
    post(event, { type: "ready", id: message.id || "", loaded: Boolean(state.ffmpeg?.loaded) });
    return;
  }
  if (message.type === "load") {
    await loadFfmpeg(event, message.id || "");
    post(event, { type: "loaded", id: message.id || "" });
    return;
  }
  if (message.type === "extract-audio") {
    const result = await extractAudio(event, message);
    post(event, { type: "result", id: message.id || "", result }, audioResultTransferList(result));
  }
  if (message.type === "concat-audio") {
    const result = await concatAudio(event, message);
    post(event, { type: "result", id: message.id || "", result }, audioResultTransferList(result));
  }
  if (message.type === "collect-speech-audio") {
    const result = await collectSpeechAudio(event, message);
    post(event, { type: "result", id: message.id || "", result }, audioResultTransferList(result));
  }
}

async function loadFfmpeg(event = null, id = "") {
  if (state.ffmpeg) {
    return state.ffmpeg;
  }
  if (state.loadPromise) {
    return state.loadPromise;
  }
  state.status.textContent = "加载 FFmpeg...";
  state.loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      appendLog(message);
      sendFfmpegHeartbeat(message);
    });
    ffmpeg.on("progress", progress => {
      const ratio = Number(progress.progress || 0);
      const task = state.currentTask;
      post(null, {
        type: "progress",
        id: task?.id || state.currentRequestId || id,
        stage: "ffmpeg",
        percent: Math.max(0, Math.min(100, Math.round(ratio * 1000) / 10)),
        message: task?.message || "FFmpeg 正在处理音频"
      });
    });
    await ffmpeg.load({
      coreURL: `${CORE_BASE_URL}/ffmpeg-core.js`,
      wasmURL: `${CORE_BASE_URL}/ffmpeg-core.wasm`
    });
    state.ffmpeg = ffmpeg;
    state.status.textContent = "就绪";
    appendLog("FFmpeg loaded.");
    return ffmpeg;
  })().finally(() => {
    state.loadPromise = null;
  });
  return state.loadPromise;
}

async function extractAudio(event, message) {
  const files = normalizeInputFiles(message);
  if (!files.length) {
    throw new Error("没有收到可处理的媒体文件。");
  }
  const requestedInputName = String(message.inputName || "");
  const requestedFile = requestedInputName
    ? files.find(file => file.name === requestedInputName || file.originalName === requestedInputName)
    : null;
  if (requestedInputName && !requestedFile) {
    throw new Error(`指定的 FFmpeg 输入文件没有随请求发送：${requestedInputName}`);
  }

  const requestId = beginFfmpegTask(event, message.id || "", "正在执行 FFmpeg 音频提取");
  let ffmpeg;
  try {
    ffmpeg = await loadFfmpeg(event, message.id || "");
  } catch (error) {
    endFfmpegTask(requestId);
    throw error;
  }
  const primaryFile = requestedFile || files[0];
  const inputExtension = extensionFromFile(primaryFile.name) || inferExtensionFromMime(primaryFile.mime);
  const inputName = primaryFile.name || `input-${message.id || Date.now()}.${inputExtension}`;
  const outputFormat = normalizeOutputFormat(message.options?.format);
  const segmentSeconds = normalizeSegmentSeconds(message.options?.chunkSeconds);
  const segmentOverlapSeconds = normalizeSegmentOverlapSeconds(message.options?.overlapSeconds, segmentSeconds);
  const totalDuration = positiveNumber(message.options?.duration);
  const outputName = uniqueVirtualFileName(
    message.outputName || `${safeFileStem(primaryFile.name, "audio")}.${outputFormat}`,
    new Set(files.map(file => file.name)),
    `output.${outputFormat}`
  );
  const useOverlappedSegments = Boolean(segmentSeconds && segmentOverlapSeconds && totalDuration);
  const outputPattern = segmentSeconds ? segmentOutputPattern(outputName, outputFormat) : outputName;
  const command = buildExtractAudioArgs({
    inputName,
    outputName: useOverlappedSegments ? outputName : outputPattern,
    segmentSeconds: useOverlappedSegments ? 0 : segmentSeconds,
    detectSpeech: true
  });
  const logStartIndex = state.ffmpegLogs.length;
  const cleanupTargets = new Set([outputName, outputPattern]);

  state.status.textContent = "提取音频...";
  postOperationProgress("write", 0, "正在写入 Web FFmpeg 虚拟文件");

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      postOperationProgress(
        "write",
        Math.min(8, Math.round((index / Math.max(1, files.length)) * 8)),
        `正在写入输入文件 ${index + 1}/${files.length}`
      );
      await ffmpeg.writeFile(file.name, new Uint8Array(file.buffer));
      cleanupTargets.add(file.name);
    }
    postOperationProgress("write", 8, "输入文件写入完成");

    let returnCode = 0;
    try {
      postOperationProgress("exec", 10, "正在执行 FFmpeg 音频提取");
      returnCode = await ffmpeg.exec(command);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 执行异常", {
        inputName,
        outputName: outputPattern,
        command,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 返回非零退出码", {
        inputName,
        outputName: outputPattern,
        command,
        returnCode,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    const detectedSpeechIntervals = speechIntervalsFromFfmpegLogs(state.ffmpegLogs.slice(logStartIndex), totalDuration);

    if (useOverlappedSegments) {
      postOperationProgress("read", 94, "正在生成带上下文的音频分段");
      const chunks = await extractOverlappedSegmentOutputs(
        ffmpeg,
        outputName,
        outputPattern,
        segmentSeconds,
        totalDuration,
        segmentOverlapSeconds,
        detectedSpeechIntervals,
        cleanupTargets,
        {
          speechIntervalsReliable: false,
          coreStart: message.options?.coreStart,
          coreEnd: message.options?.coreEnd
        }
      );
      if (!chunks.length) {
        throw buildFfmpegError("FFmpeg 没有生成音频切片", {
          inputName,
          outputName: outputPattern,
          command,
          returnCode,
          logs: recentFfmpegLogs(logStartIndex)
        });
      }
      const bytes = chunks.reduce((sum, chunk) => sum + (chunk.bytes || chunk.file?.buffer?.byteLength || 0), 0);
      state.status.textContent = "完成";
      return {
        chunks,
        bytes,
        duration: totalDuration,
        chunkSeconds: segmentSeconds,
        chunkOverlapSeconds: segmentOverlapSeconds,
        sourceType: "direct"
      };
    }

    if (segmentSeconds) {
      postOperationProgress("read", 96, "正在读取音频分段输出");
      const chunks = await readSegmentOutputs(ffmpeg, outputPattern, segmentSeconds, totalDuration, null, {
        inputName,
        outputName: outputPattern,
        command,
        returnCode,
        logs: recentFfmpegLogs(logStartIndex)
      });
      for (const chunk of chunks) {
        cleanupTargets.add(chunk.file.name);
      }
      if (!chunks.length) {
        throw buildFfmpegError("FFmpeg 没有生成音频切片", {
          inputName,
          outputName: outputPattern,
          command,
          returnCode,
          logs: recentFfmpegLogs(logStartIndex)
        });
      }
      const bytes = chunks.reduce((sum, chunk) => sum + (chunk.bytes || chunk.file?.buffer?.byteLength || 0), 0);
      state.status.textContent = "完成";
      return {
        chunks,
        bytes,
        duration: totalDuration || chunks[chunks.length - 1]?.end || 0,
        chunkSeconds: segmentSeconds,
        sourceType: "direct"
      };
    }

    let output;
    try {
      postOperationProgress("read", 96, "正在读取输出音频");
      output = await ffmpeg.readFile(outputName);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 没有生成输出文件", {
        inputName,
        outputName,
        command,
        returnCode,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    assertExtractedAudioOutputLooksDecodable(outputName, buffer, {
      inputName,
      outputName,
      command,
      returnCode,
      logs: recentFfmpegLogs(logStartIndex)
    });
    state.status.textContent = "完成";
      return {
        file: {
          name: outputName,
          mime: "audio/mpeg",
          buffer
        },
        bytes: buffer.byteLength,
        speechIntervals: detectedSpeechIntervals,
        speechIntervalsReliable: false
      };
  } finally {
    postOperationProgress("cleanup", 99, "正在清理 Web FFmpeg 临时文件");
    await cleanup(ffmpeg, ...cleanupTargets);
    endFfmpegTask(requestId);
  }
}

async function extractOverlappedSegmentOutputs(
  ffmpeg,
  inputName,
  outputPattern,
  segmentSeconds,
  totalDuration,
  overlapSeconds,
  speechIntervals,
  cleanupTargets,
  options = {}
) {
  const speechIntervalsReliable = options?.speechIntervalsReliable !== false;
  const specs = buildSpeechAwareOverlappedSegmentSpecs(
    outputPattern,
    segmentSeconds,
    totalDuration,
    overlapSeconds,
    speechIntervalsReliable ? speechIntervals : null,
    options
  );
  const chunks = [];
  for (const spec of specs) {
    postOperationProgress(
      "segment",
      94 + (chunks.length / Math.max(1, specs.length)) * 2,
      `正在生成带上下文的音频分段 ${chunks.length + 1}/${specs.length}`
    );
    const command = buildExtractAudioArgs({
      inputName,
      outputName: spec.name,
      trimStart: spec.start,
      trimDuration: spec.duration,
      detectSpeech: false
    });
    const returnCode = await ffmpeg.exec(command);
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 分段返回非零退出码", {
        inputName,
        outputName: spec.name,
        command,
        returnCode,
        logs: recentFfmpegLogs(0)
      });
    }
    cleanupTargets.add(spec.name);
    const output = await ffmpeg.readFile(spec.name);
    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    assertExtractedAudioOutputLooksDecodable(spec.name, buffer, {
      inputName,
      outputName: spec.name,
      command,
      returnCode,
      logs: recentFfmpegLogs(0)
    });
    chunks.push({
      index: spec.index,
      start: spec.start,
      end: spec.end,
      duration: spec.duration,
      coreStart: spec.coreStart,
      coreEnd: spec.coreEnd,
      coreDuration: spec.coreDuration,
      speechIntervals: speechIntervalsReliable && Array.isArray(speechIntervals)
        ? intersectSpeechIntervals(speechIntervals, spec.start, spec.end)
        : undefined,
      speechIntervalsReliable: speechIntervalsReliable ? undefined : false,
      file: {
        name: spec.name,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    });
  }
  return chunks;
}

async function concatAudio(event, message) {
  const files = normalizeInputFiles(message);
  if (!files.length) {
    throw new Error("没有收到可合并的音频文件。");
  }

  const requestId = beginFfmpegTask(event, message.id || "", "正在执行 FFmpeg 音频合并");
  let ffmpeg;
  try {
    ffmpeg = await loadFfmpeg(event, message.id || "");
  } catch (error) {
    endFfmpegTask(requestId);
    throw error;
  }
  const outputFormat = normalizeOutputFormat(message.options?.format);
  const outputName = uniqueVirtualFileName(
    message.outputName || `concat.${outputFormat}`,
    new Set(files.map(file => file.name)),
    `concat.${outputFormat}`
  );
  const command = buildConcatAudioArgs({ inputNames: files.map(file => file.name), outputName });
  const cleanupTargets = new Set([outputName]);
  const logStartIndex = state.ffmpegLogs.length;

  state.status.textContent = "合并音频...";
  postOperationProgress("write", 0, "正在写入待合并音频");

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      postOperationProgress(
        "write",
        Math.min(8, Math.round((index / Math.max(1, files.length)) * 8)),
        `正在写入待合并音频 ${index + 1}/${files.length}`
      );
      await ffmpeg.writeFile(file.name, new Uint8Array(file.buffer));
      cleanupTargets.add(file.name);
    }
    postOperationProgress("write", 8, "待合并音频写入完成");

    let returnCode = 0;
    try {
      postOperationProgress("exec", 10, "正在执行 FFmpeg 音频合并");
      returnCode = await ffmpeg.exec(command);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 合并执行异常", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 合并返回非零退出码", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        returnCode,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    let output;
    try {
      postOperationProgress("read", 96, "正在读取合并后的音频");
      output = await ffmpeg.readFile(outputName);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 合并没有生成输出文件", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        returnCode,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    assertExtractedAudioOutputLooksDecodable(outputName, buffer, {
      inputName: files.map(file => file.name).join(","),
      outputName,
      command,
      returnCode,
      logs: recentFfmpegLogs(logStartIndex)
    });
    state.status.textContent = "完成";
    return {
      file: {
        name: outputName,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    };
  } finally {
    postOperationProgress("cleanup", 99, "正在清理 Web FFmpeg 临时文件");
    await cleanup(ffmpeg, ...cleanupTargets);
    endFfmpegTask(requestId);
  }
}

async function collectSpeechAudio(event, message) {
  const files = normalizeInputFiles(message);
  if (!files.length) {
    throw new Error("没有收到可收集语音窗口的音频文件。");
  }

  const requestId = beginFfmpegTask(event, message.id || "", "正在执行 FFmpeg 语音窗口收集");
  let ffmpeg;
  try {
    ffmpeg = await loadFfmpeg(event, message.id || "");
  } catch (error) {
    endFfmpegTask(requestId);
    throw error;
  }

  const primaryFile = files[0];
  const inputName = primaryFile.name || `speech-input-${Date.now()}.mp3`;
  const outputFormat = normalizeOutputFormat(message.options?.format);
  const outputPattern = segmentOutputPattern(
    uniqueVirtualFileName(
      message.outputName || `speech-only.${outputFormat}`,
      new Set(files.map(file => file.name)),
      `speech-only.${outputFormat}`
    ),
    outputFormat
  );
  const duration = positiveNumber(message.options?.duration);
  const sourceStart = Number(message.options?.sourceStart) || 0;
  const specs = buildCollectedSpeechSegmentSpecs(
    outputPattern,
    message.options?.speechIntervals,
    message.options?.maxChunkSeconds || 30,
    duration,
    { sourceStart }
  );
  const cleanupTargets = new Set([outputPattern]);

  state.status.textContent = "收集语音窗口...";
  postOperationProgress("write", 0, "正在写入语音窗口输入文件");

  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(primaryFile.buffer));
    cleanupTargets.add(inputName);
    postOperationProgress("write", 8, "语音窗口输入文件写入完成");
    if (!specs.length) {
      return {
        chunks: [],
        bytes: 0,
        duration: 0,
        sourceType: "collected-speech"
      };
    }
    const chunks = [];
    for (const spec of specs) {
      const chunk = await collectSpeechSegmentOutput(ffmpeg, inputName, spec, cleanupTargets);
      chunks.push(chunk);
      postOperationProgress(
        "collect",
        10 + (chunks.length / Math.max(1, specs.length)) * 86,
        `正在生成语音窗口 ${chunks.length}/${specs.length}`
      );
    }
    const bytes = chunks.reduce((sum, chunk) => sum + (chunk.bytes || chunk.file?.buffer?.byteLength || 0), 0);
    state.status.textContent = "完成";
    return {
      chunks,
      bytes,
      duration: chunks.reduce((sum, chunk) => sum + (Number(chunk.duration) || 0), 0),
      sourceType: "collected-speech"
    };
  } finally {
    postOperationProgress("cleanup", 99, "正在清理 Web FFmpeg 语音窗口临时文件");
    await cleanup(ffmpeg, ...cleanupTargets);
    endFfmpegTask(requestId);
  }
}

async function collectSpeechSegmentOutput(ffmpeg, inputName, spec, cleanupTargets) {
  const partNames = [];
  for (let index = 0; index < spec.parts.length; index += 1) {
    const part = spec.parts[index];
    const partName = `${spec.name.replace(/\.[^.]+$/, "")}-part-${String(index).padStart(3, "0")}.mp3`;
    const command = buildExtractAudioArgs({
      inputName,
      outputName: partName,
      trimStart: part.relativeStart,
      trimDuration: part.duration,
      detectSpeech: false
    });
    const returnCode = await ffmpeg.exec(command);
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 语音片段抽取返回非零退出码", {
        inputName,
        outputName: partName,
        command,
        returnCode,
        logs: recentFfmpegLogs(0)
      });
    }
    cleanupTargets.add(partName);
    partNames.push(partName);
  }

  const command = buildConcatAudioArgs({ inputNames: partNames, outputName: spec.name });
  const returnCode = await ffmpeg.exec(command);
  if (returnCode !== 0) {
    throw buildFfmpegError("FFmpeg 语音窗口合并返回非零退出码", {
      inputName: partNames.join(","),
      outputName: spec.name,
      command,
      returnCode,
      logs: recentFfmpegLogs(0)
    });
  }
  cleanupTargets.add(spec.name);
  const output = await ffmpeg.readFile(spec.name);
  const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
  assertExtractedAudioOutputLooksDecodable(spec.name, buffer, {
    inputName: partNames.join(","),
    outputName: spec.name,
    command,
    returnCode,
    logs: recentFfmpegLogs(0)
  });
  return {
    index: spec.index,
    start: spec.sourceStart,
    end: spec.sourceEnd,
    duration: spec.duration,
    sourceStart: spec.sourceStart,
    sourceEnd: spec.sourceEnd,
    speechIntervals: spec.parts.map(part => ({ start: part.sourceStart, end: part.sourceEnd })),
    timeMap: spec.parts.map(part => ({
      outputStart: part.outputStart,
      outputEnd: part.outputEnd,
      sourceStart: part.sourceStart,
      sourceEnd: part.sourceEnd
    })),
    file: {
      name: spec.name,
      mime: "audio/mpeg",
      buffer
    },
    bytes: buffer.byteLength
  };
}

function beginFfmpegTask(event, id, message) {
  const requestId = String(id || "");
  activateRequest(requestId);
  state.currentClient = {
    source: event?.source || state.currentClient?.source,
    origin: event?.origin || state.currentClient?.origin || "*"
  };
  state.currentTask = {
    id: requestId,
    message,
    startedAt: Date.now()
  };
  state.lastHeartbeatAt = 0;
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
  }
  sendFfmpegHeartbeat(message, true);
  state.heartbeatTimer = setInterval(() => {
    sendFfmpegHeartbeat(state.currentTask?.message || message, true);
  }, 5000);
  return requestId;
}

function endFfmpegTask(id) {
  if (!id || state.currentTask?.id === id) {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    state.currentTask = null;
    state.lastHeartbeatAt = 0;
  }
  deactivateRequest(id);
}

function activateRequest(id) {
  state.currentRequestId = String(id || "");
}

function deactivateRequest(id) {
  if (!id || state.currentRequestId === id) {
    state.currentRequestId = "";
  }
}

function postOperationProgress(stage, percent, message = "") {
  if (state.currentTask && message) {
    state.currentTask.message = message;
  }
  post(null, {
    type: "progress",
    id: state.currentRequestId,
    stage,
    percent: Math.max(0, Math.min(100, Number(percent) || 0)),
    message
  });
}

function sendFfmpegHeartbeat(message = "", force = false) {
  const task = state.currentTask;
  if (!task?.id) {
    return;
  }
  const now = Date.now();
  if (!force && now - state.lastHeartbeatAt < 3000) {
    return;
  }
  state.lastHeartbeatAt = now;
  post(null, {
    type: "progress",
    id: task.id,
    stage: "ffmpeg",
    message: compactFfmpegProgressMessage(message || task.message || "FFmpeg 正在处理音频")
  });
}

function compactFfmpegProgressMessage(message = "") {
  const text = String(message || "").trim().replace(/\s+/g, " ");
  if (!text) {
    return "FFmpeg 正在处理音频";
  }
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function normalizeInputFiles(message) {
  const rawFiles = Array.isArray(message.files) ? message.files : [message.file];
  const usedNames = new Set();
  return rawFiles
    .filter(file => file?.buffer instanceof ArrayBuffer && file.buffer.byteLength > 0)
    .map((file, index) => ({
      originalName: String(file.name || ""),
      name: uniqueVirtualFileName(
        safeVirtualFileName(file.name, index === 0 ? "input.bin" : `input-${index}.bin`),
        usedNames,
        index === 0 ? "input.bin" : `input-${index}.bin`
      ),
      mime: String(file.mime || ""),
      buffer: file.buffer
    }));
}

function audioResultTransferList(result) {
  if (result?.file?.buffer instanceof ArrayBuffer) {
    return [result.file.buffer];
  }
  if (!Array.isArray(result?.chunks)) {
    return [];
  }
  return result.chunks
    .map(chunk => chunk?.file?.buffer)
    .filter(buffer => buffer instanceof ArrayBuffer);
}

function assertExtractedAudioOutputLooksDecodable(fileName, buffer, details = {}) {
  const extension = String(fileName || details.outputName || "").split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : null;
  if (!bytes || !bytes.byteLength) {
    throw buildFfmpegError("FFmpeg 输出没有可解码音频帧", {
      inputName: details.inputName || "",
      outputName: details.outputName || fileName || "",
      command: details.command,
      returnCode: details.returnCode,
      logs: details.logs || []
    });
  }
  if (extension === "mp3" && !mp3BufferHasAudioFrame(bytes)) {
    throw buildFfmpegError("FFmpeg 输出没有可解码音频帧", {
      inputName: details.inputName || "",
      outputName: details.outputName || fileName || "",
      command: details.command,
      returnCode: details.returnCode,
      logs: details.logs || []
    });
  }
}

function mp3BufferHasAudioFrame(input) {
  const bytes = input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : null;
  if (!bytes || bytes.length < 2) {
    return false;
  }
  const start = mp3AudioFrameScanStart(bytes);
  for (let index = start; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) {
      return true;
    }
  }
  return false;
}

function mp3AudioFrameScanStart(bytes) {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return 0;
  }
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);
  const footerSize = (bytes[5] & 0x10) ? 10 : 0;
  return Math.min(bytes.length, 10 + tagSize + footerSize);
}

async function readSegmentOutputs(ffmpeg, outputPattern, segmentSeconds, totalDuration, speechIntervals = null, validationContext = null) {
  const pattern = segmentPatternParts(outputPattern);
  const entries = await ffmpeg.listDir(".");
  const names = entries
    .filter(entry => !entry.isDir && pattern.matches(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => pattern.indexOf(a) - pattern.indexOf(b));
  const chunks = [];
  for (const name of names) {
    const output = await ffmpeg.readFile(name);
    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    if (validationContext) {
      assertExtractedAudioOutputLooksDecodable(name, buffer, {
        ...validationContext,
        outputName: name
      });
    }
    const index = pattern.indexOf(name);
    const start = Math.max(0, index * segmentSeconds);
    const end = totalDuration ? Math.min(totalDuration, start + segmentSeconds) : start + segmentSeconds;
    const duration = Math.max(0, end - start);
    if (totalDuration && duration <= 0) {
      continue;
    }
    chunks.push({
      index,
      start,
      end,
      duration,
      file: {
        name,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    });
    if (Array.isArray(speechIntervals)) {
      chunks[chunks.length - 1].speechIntervals = intersectSpeechIntervals(speechIntervals, start, end);
    }
  }
  return chunks;
}

function buildOverlappedSegmentSpecs(outputPattern, segmentSeconds, totalDuration, overlapSeconds = 0, options = {}) {
  const maxUploadSeconds = normalizeSegmentSeconds(segmentSeconds);
  const duration = positiveNumber(totalDuration);
  const overlap = normalizeAsrUploadOverlapSeconds(overlapSeconds, maxUploadSeconds);
  const coreSeconds = asrUploadCoreSeconds(maxUploadSeconds, overlap);
  if (!maxUploadSeconds || !coreSeconds || !duration) {
    return [];
  }
  const coreRange = normalizeCoreRange(options, duration);
  const pattern = segmentPatternParts(outputPattern);
  const specs = [];
  for (let coreStart = coreRange.start, index = 0; coreStart < coreRange.end - 0.001; coreStart += coreSeconds, index += 1) {
    const coreEnd = Math.min(coreRange.end, coreStart + coreSeconds);
    const start = roundSeconds(Math.max(0, coreStart - overlap));
    const end = roundSeconds(Math.min(duration, coreEnd + overlap));
    specs.push({
      index,
      name: segmentNameFromPattern(pattern, index),
      start,
      end,
      duration: roundSeconds(Math.max(0, end - start)),
      coreStart: roundSeconds(coreStart),
      coreEnd: roundSeconds(coreEnd),
      coreDuration: roundSeconds(Math.max(0, coreEnd - coreStart))
    });
  }
  return specs;
}

function buildSpeechAwareOverlappedSegmentSpecs(
  outputPattern,
  segmentSeconds,
  totalDuration,
  overlapSeconds = 0,
  speechIntervals = null,
  options = {}
) {
  const maxUploadSeconds = normalizeSegmentSeconds(segmentSeconds);
  const duration = positiveNumber(totalDuration);
  const coreRange = normalizeCoreRange(options, duration);
  const normalizedSpeech = normalizeSpeechIntervalsForSpecs(speechIntervals, duration)
    .map(interval => ({
      start: Math.max(coreRange.start, interval.start),
      end: Math.min(coreRange.end, interval.end)
    }))
    .filter(interval => interval.end > interval.start);
  if (Array.isArray(speechIntervals) && !normalizedSpeech.length) {
    return [];
  }
  if (!normalizedSpeech.length) {
    return buildOverlappedSegmentSpecs(outputPattern, segmentSeconds, totalDuration, overlapSeconds, options);
  }
  const pattern = segmentPatternParts(outputPattern);
  const overlap = normalizeAsrUploadOverlapSeconds(overlapSeconds, maxUploadSeconds);
  const coreSeconds = asrUploadCoreSeconds(maxUploadSeconds, overlap);
  const specs = [];
  const pushCore = (coreStart, coreEnd) => {
    const start = roundSeconds(Math.max(0, coreStart - overlap));
    const end = roundSeconds(Math.min(duration, coreEnd + overlap));
    specs.push({
      index: specs.length,
      name: segmentNameFromPattern(pattern, specs.length),
      start,
      end,
      duration: roundSeconds(Math.max(0, end - start)),
      coreStart: roundSeconds(coreStart),
      coreEnd: roundSeconds(coreEnd),
      coreDuration: roundSeconds(Math.max(0, coreEnd - coreStart))
    });
  };
  let current = null;
  for (const interval of normalizedSpeech) {
    if (!current) {
      current = { start: interval.start, end: interval.end };
    } else if (interval.end - current.start > coreSeconds && current.end > current.start) {
      pushSplitCoreWindows(current.start, current.end, coreSeconds, pushCore);
      current = { start: interval.start, end: interval.end };
    } else {
      current.end = Math.max(current.end, interval.end);
    }
  }
  if (current && current.end > current.start) {
    pushSplitCoreWindows(current.start, current.end, coreSeconds, pushCore);
  }
  return specs.filter(spec => spec.duration > 0 && spec.coreDuration > 0);
}

function buildCollectedSpeechSegmentSpecs(outputPattern, speechIntervals = [], maxChunkSeconds = 30, totalDuration = 0, options = {}) {
  const maxDuration = normalizeSegmentSeconds(maxChunkSeconds) || 30;
  const intervals = normalizeCollectedSpeechIntervals(speechIntervals, totalDuration, options)
    .flatMap(interval => splitCollectedSpeechInterval(interval, maxDuration));
  if (!intervals.length) {
    return [];
  }
  const pattern = segmentPatternParts(outputPattern);
  const specs = [];
  let current = null;
  const flush = () => {
    if (!current || !current.parts.length || current.duration <= 0) {
      current = null;
      return;
    }
    const duration = roundSeconds(current.duration);
    specs.push({
      index: specs.length,
      name: segmentNameFromPattern(pattern, specs.length),
      sourceStart: current.parts[0].sourceStart,
      sourceEnd: current.parts.at(-1).sourceEnd,
      duration,
      parts: current.parts
    });
    current = null;
  };
  const addIntervalToCurrent = interval => {
    const duration = roundSeconds(interval.relativeEnd - interval.relativeStart);
    if (duration <= 0) {
      return;
    }
    if (!current) {
      current = { duration: 0, parts: [] };
    }
    const outputStart = roundSeconds(current.duration);
    const outputEnd = roundSeconds(outputStart + duration);
    current.parts.push({
      relativeStart: interval.relativeStart,
      relativeEnd: interval.relativeEnd,
      sourceStart: interval.sourceStart,
      sourceEnd: interval.sourceEnd,
      outputStart,
      outputEnd,
      duration
    });
    current.duration = outputEnd;
  };
  for (const interval of intervals) {
    const intervalDuration = roundSeconds(interval.relativeEnd - interval.relativeStart);
    if (current && current.duration + intervalDuration > maxDuration + 0.001) {
      flush();
    }
    addIntervalToCurrent(interval);
  }
  flush();
  return specs.filter(spec => spec.duration > 0 && spec.parts.length);
}

function normalizeCollectedSpeechIntervals(speechIntervals = [], totalDuration = 0, options = {}) {
  const durationLimit = positiveNumber(totalDuration);
  const sourceStart = Number(options?.sourceStart) || 0;
  return (Array.isArray(speechIntervals) ? speechIntervals : [])
    .map(interval => {
      const sourceIntervalStart = Number(interval?.start);
      const sourceIntervalEnd = Number(interval?.end);
      if (!Number.isFinite(sourceIntervalStart) || !Number.isFinite(sourceIntervalEnd) || sourceIntervalEnd <= sourceIntervalStart) {
        return null;
      }
      const relativeStart = roundSeconds(Math.max(0, sourceIntervalStart - sourceStart));
      const relativeEnd = roundSeconds(Math.min(
        durationLimit || Math.max(relativeStart, sourceIntervalEnd - sourceStart),
        Math.max(relativeStart, sourceIntervalEnd - sourceStart)
      ));
      if (relativeEnd <= relativeStart) {
        return null;
      }
      return {
        relativeStart,
        relativeEnd,
        sourceStart: roundSeconds(sourceStart + relativeStart),
        sourceEnd: roundSeconds(sourceStart + relativeEnd)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.relativeStart - right.relativeStart || left.relativeEnd - right.relativeEnd);
}

function splitCollectedSpeechInterval(interval, maxDurationSeconds = 30) {
  const maxDuration = normalizeSegmentSeconds(maxDurationSeconds) || 30;
  const duration = interval.relativeEnd - interval.relativeStart;
  if (duration <= maxDuration + 0.001) {
    return [interval];
  }
  const parts = [];
  for (let start = interval.relativeStart; start < interval.relativeEnd - 0.001; start += maxDuration) {
    const end = Math.min(interval.relativeEnd, start + maxDuration);
    parts.push({
      relativeStart: roundSeconds(start),
      relativeEnd: roundSeconds(end),
      sourceStart: roundSeconds(interval.sourceStart + (start - interval.relativeStart)),
      sourceEnd: roundSeconds(interval.sourceStart + (end - interval.relativeStart))
    });
  }
  return parts;
}

function normalizeAsrUploadOverlapSeconds(value, segmentSeconds = 0) {
  const maxUploadSeconds = normalizeSegmentSeconds(segmentSeconds);
  const requested = normalizeSegmentOverlapSeconds(value, maxUploadSeconds);
  if (!maxUploadSeconds || !requested) {
    return 0;
  }
  return roundSeconds(Math.min(requested, Math.max(0, (maxUploadSeconds - 1) / 2)));
}

function normalizeCoreRange(options = {}, duration = 0) {
  const endLimit = positiveNumber(duration);
  const start = roundSeconds(Math.max(0, Math.min(endLimit || 0, Number(options?.coreStart) || 0)));
  const requestedEnd = Number(options?.coreEnd);
  const end = roundSeconds(Math.max(start, Math.min(
    endLimit || Math.max(start, Number.isFinite(requestedEnd) ? requestedEnd : start),
    Number.isFinite(requestedEnd) && requestedEnd > start ? requestedEnd : endLimit
  )));
  return {
    start,
    end: end > start ? end : endLimit
  };
}

function asrUploadCoreSeconds(maxUploadSeconds, overlapSeconds = 0) {
  const uploadSeconds = normalizeSegmentSeconds(maxUploadSeconds);
  if (!uploadSeconds) {
    return 0;
  }
  return Math.max(1, roundSeconds(uploadSeconds - 2 * (Number(overlapSeconds) || 0)));
}

function pushSplitCoreWindows(start, end, coreSeconds, pushCore) {
  const coreDuration = normalizeSegmentSeconds(coreSeconds);
  if (!coreDuration || end <= start) {
    return;
  }
  for (let cursor = start; cursor < end - 0.001; cursor += coreDuration) {
    pushCore(cursor, Math.min(end, cursor + coreDuration));
  }
}

function normalizeSpeechIntervalsForSpecs(intervals, duration = 0) {
  const endLimit = positiveNumber(duration);
  return (Array.isArray(intervals) ? intervals : [])
    .map(interval => ({
      start: roundSeconds(Math.max(0, Number(interval?.start))),
      end: roundSeconds(Math.min(endLimit || Number(interval?.end), Number(interval?.end)))
    }))
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

function speechIntervalsFromFfmpegLogs(logs, duration = 0) {
  const text = (logs || []).join("\n");
  const silenceIntervals = [];
  let pendingStart = null;
  for (const match of text.matchAll(/silence_(start|end):\s*([0-9.]+)/g)) {
    const value = Number(match[2]);
    if (!Number.isFinite(value)) {
      continue;
    }
    if (match[1] === "start") {
      pendingStart = value;
      continue;
    }
    const start = pendingStart === null ? 0 : pendingStart;
    if (value > start) {
      silenceIntervals.push({ start, end: value });
    }
    pendingStart = null;
  }
  const endTime = positiveNumber(duration) || Math.max(0, ...silenceIntervals.map(item => item.end), pendingStart || 0);
  if (!silenceIntervals.length) {
    return endTime > 0 ? [{ start: 0, end: endTime }] : null;
  }
  if (pendingStart !== null && endTime > pendingStart) {
    silenceIntervals.push({ start: pendingStart, end: endTime });
  }
  const intervals = [];
  let cursor = 0;
  for (const silence of silenceIntervals.sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (silence.start > cursor + 0.05) {
      intervals.push({ start: cursor, end: silence.start });
    }
    cursor = Math.max(cursor, silence.end);
  }
  if (endTime > cursor + 0.05) {
    intervals.push({ start: cursor, end: endTime });
  }
  return padSpeechIntervals(intervals, endTime, VAD_SPEECH_PAD_SECONDS);
}

function padSpeechIntervals(intervals, duration = 0, padSeconds = 0) {
  const normalized = (intervals || [])
    .map(interval => ({
      start: roundSeconds(Math.max(0, Number(interval.start))),
      end: roundSeconds(Math.min(positiveNumber(duration) || Number(interval.end), Number(interval.end)))
    }))
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const pad = Math.max(0, Number(padSeconds) || 0);
  if (!normalized.length || !pad) {
    return mergePaddedSpeechIntervals(normalized);
  }
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (index === 0) {
      current.start = roundSeconds(Math.max(0, current.start - pad));
    }
    const next = normalized[index + 1];
    if (next) {
      const silenceDuration = next.start - current.end;
      if (silenceDuration < 2 * pad) {
        const halfSilence = Math.max(0, silenceDuration / 2);
        current.end = roundSeconds(current.end + halfSilence);
        next.start = roundSeconds(Math.max(0, next.start - halfSilence));
      } else {
        current.end = roundSeconds(Math.min(positiveNumber(duration) || current.end + pad, current.end + pad));
        next.start = roundSeconds(Math.max(0, next.start - pad));
      }
    } else {
      current.end = roundSeconds(Math.min(positiveNumber(duration) || current.end + pad, current.end + pad));
    }
  }
  return mergePaddedSpeechIntervals(normalized);
}

function mergePaddedSpeechIntervals(intervals) {
  const merged = [];
  for (const interval of intervals || []) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end + VAD_SPEECH_MERGE_GAP_SECONDS) {
      previous.end = roundSeconds(Math.max(previous.end, interval.end));
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function intersectSpeechIntervals(intervals, start, end) {
  return (intervals || [])
    .map(interval => ({
      start: Math.max(start, Number(interval.start)),
      end: Math.min(end, Number(interval.end))
    }))
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .map(interval => ({ start: interval.start, end: interval.end }));
}

function segmentOutputPattern(outputName, outputFormat) {
  const stem = safeFileStem(outputName, "chunk");
  return `${stem}-%03d.${outputFormat}`;
}

function segmentPatternParts(pattern) {
  const [prefix, suffix] = String(pattern).split("%03d");
  return {
    prefix,
    suffix,
    matches(name) {
      return String(name).startsWith(prefix) && String(name).endsWith(suffix);
    },
    indexOf(name) {
      const value = String(name).slice(prefix.length, String(name).length - suffix.length);
      return Number.parseInt(value, 10) || 0;
    }
  };
}

function segmentNameFromPattern(pattern, index) {
  return `${pattern.prefix}${String(index).padStart(3, "0")}${pattern.suffix}`;
}

function normalizeSegmentSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(seconds));
}

function normalizeSegmentOverlapSeconds(value, segmentSeconds = 0) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  const maxOverlap = Number(segmentSeconds) > 0 ? Number(segmentSeconds) / 2 : seconds;
  return roundSeconds(Math.max(0, Math.min(seconds, maxOverlap)));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundSeconds(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

async function cleanup(ffmpeg, ...files) {
  for (const file of files) {
    await ffmpeg.deleteFile(file).catch(() => {});
  }
}

function extensionFromFile(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] || "";
}

function postReady() {
  const message = { app: APP, type: "ready", loaded: false };
  window.parent?.postMessage(message, "*");
  window.opener?.postMessage(message, "*");
}

function post(event, payload, transfer = []) {
  const target = event?.source || state.currentClient?.source || window.parent;
  const origin = state.allowedOrigin || event?.origin || state.currentClient?.origin || "*";
  target?.postMessage({ app: APP, ...payload }, origin, transfer);
}

function appendLog(message) {
  state.ffmpegLogs.push(String(message || ""));
  if (state.ffmpegLogs.length > 2000) {
    state.ffmpegLogs.splice(0, state.ffmpegLogs.length - 2000);
  }
  const line = document.createElement("div");
  line.textContent = String(message || "");
  state.log.appendChild(line);
  state.log.scrollTop = state.log.scrollHeight;
}

function recentFfmpegLogs(startIndex) {
  return state.ffmpegLogs
    .slice(Math.max(0, startIndex))
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-12);
}

function buildFfmpegError(reason, { inputName, outputName, command, returnCode = null, error = null, logs = [] }) {
  const codeText = returnCode == null ? "未知" : String(returnCode);
  const commandText = command?.join(" ") || "";
  const causeText = error?.message ? `；异常：${error.message}` : "";
  const logText = logs.length ? `；最近日志：${logs.join(" | ").slice(0, 900)}` : "";
  return new Error(
    `FFmpeg 提取失败：${reason}。输入 ${inputName}，输出 ${outputName}，返回码 ${codeText}。命令：${commandText}${causeText}${logText}`
  );
}
