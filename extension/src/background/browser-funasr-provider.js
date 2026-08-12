export const FuguangBrowserFunAsrProvider = (() => {
  const DASHSCOPE_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
  const FUNASR_DEFAULT_MODEL = "fun-asr";
  const FUNASR_DIARIZATION_MAX_SECONDS = 2 * 60 * 60;
  const FUNASR_DIARIZATION_MAX_CHUNKS = 3;
  const FUNASR_SEGMENT_TOLERANCE_SECONDS = 1.5;
  const FUNASR_POLL_INTERVAL_MS = 10_000;
  const FUNASR_MAX_POLL_INTERVAL_MS = 30_000;
  const FUNASR_TIMEOUT_MS = 2 * 60 * 60 * 1000;

  function isDashScopeFunAsrConfig(config = {}) {
    return normalizeProviderType(config.providerType) === "dashscope_funasr";
  }

  function normalizeProviderType(providerType) {
    const value = String(providerType || "").trim().toLowerCase();
    return ["dashscope_funasr", "dashscope-funasr", "funasr", "fun-asr"].includes(value)
      ? "dashscope_funasr"
      : value;
  }

  function dashScopeFunAsrChunkSeconds(_metadata = {}) {
    return FUNASR_DIARIZATION_MAX_SECONDS;
  }

  function dashScopeFunAsrShouldDiarize(options = {}) {
    const chunksTotal = Math.max(0, Number(options.chunksTotal || options.chunkCount || 0) || 0);
    return chunksTotal > 0
      && chunksTotal <= FUNASR_DIARIZATION_MAX_CHUNKS;
  }

  function buildDashScopeFunAsrParameters(config = {}, options = {}) {
    const parameters = {};
    const language = normalizeFunAsrLanguage(config.language || config.sourceLanguage || options.language || "");
    if (language) {
      parameters.language_hints = [language];
    }
    if (dashScopeFunAsrShouldDiarize(options)) {
      parameters.diarization_enabled = true;
      const speakerCount = Number(config.speakerCount || config.speaker_count || 0);
      if (Number.isInteger(speakerCount) && speakerCount >= 2 && speakerCount <= 100) {
        parameters.speaker_count = speakerCount;
      }
    }
    const specialWordFilter = normalizeSpecialWordFilter(config.specialWordFilter || config.special_word_filter);
    if (specialWordFilter) {
      parameters.special_word_filter = specialWordFilter;
    }
    return parameters;
  }

  function normalizeFunAsrLanguage(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || normalized === "auto") {
      return "";
    }
    if (["zh-cn", "zh-hans", "zh"].includes(normalized)) {
      return "zh";
    }
    if (["en", "ja", "ko", "vi", "th", "id", "ms", "tl", "hi", "ar", "fr", "de", "es", "pt", "ru", "it", "nl", "sv", "da", "fi", "no", "el", "pl", "cs", "hu", "ro", "bg", "hr", "sk"].includes(normalized)) {
      return normalized;
    }
    return "";
  }

  function normalizeSpecialWordFilter(value) {
    if (!value) {
      return null;
    }
    if (typeof value === "object") {
      return value;
    }
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function normalizeDashScopeFunAsrResult(result = {}, chunk = {}, options = {}) {
    const sentences = collectFunAsrSentences(result);
    const baseStart = finiteNumber(chunk.start, 0);
    const coreStart = finiteNumber(chunk.coreStart, chunk.start, baseStart);
    const coreEnd = finiteNumber(chunk.coreEnd, chunk.end, coreStart);
    const labelSpeakers = options.labelSpeakers === true;
    const chunkLabelIndex = Number.isFinite(Number(options.chunkLabelIndex))
      ? Number(options.chunkLabelIndex)
      : Number(chunk.index || 0);
    return sentences
      .map(sentence => normalizeFunAsrSentence(sentence, baseStart, chunkLabelIndex, labelSpeakers))
      .filter(segment => segment && segment.end > coreStart - FUNASR_SEGMENT_TOLERANCE_SECONDS && segment.start < coreEnd + FUNASR_SEGMENT_TOLERANCE_SECONDS)
      .filter(segment => segment.end > segment.start && segment.text)
      .sort((left, right) => left.start - right.start || left.end - right.end);
  }

  function collectFunAsrSentences(result = {}) {
    const transcripts = Array.isArray(result.transcripts) ? result.transcripts : [];
    const output = [];
    for (const transcript of transcripts) {
      if (Array.isArray(transcript?.sentences)) {
        output.push(...transcript.sentences);
      }
    }
    if (!output.length && Array.isArray(result.sentences)) {
      output.push(...result.sentences);
    }
    return output;
  }

  function normalizeFunAsrSentence(sentence = {}, baseStart = 0, chunkIndex = 0, labelSpeakers = false) {
    const startSeconds = funAsrSentenceTimestampSeconds(
      sentence,
      ["begin_time", "start_time_ms"],
      ["start_time", "start"]
    );
    const endSeconds = funAsrSentenceTimestampSeconds(
      sentence,
      ["end_time", "end_time_ms"],
      ["end"]
    );
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      return null;
    }
    const text = cleanFunAsrText(sentence.text || sentence.sentence || "");
    const segment = {
      start: roundSeconds(baseStart + startSeconds),
      end: roundSeconds(baseStart + endSeconds),
      text
    };
    const speakerId = optionalFiniteNumber(sentence.speaker_id);
    if (Number.isFinite(speakerId)) {
      segment.speakerId = speakerId;
      if (labelSpeakers) {
        segment.speakerLabel = `分段 ${Number(chunkIndex || 0) + 1} · 说话人 ${speakerId + 1}`;
      }
    }
    return segment;
  }

  function funAsrSentenceTimestampSeconds(sentence, millisecondFields, fallbackFields) {
    for (const field of millisecondFields) {
      const value = optionalFiniteNumber(sentence?.[field]);
      if (Number.isFinite(value)) {
        return value / 1000;
      }
    }
    for (const field of fallbackFields) {
      const value = optionalFiniteNumber(sentence?.[field]);
      if (Number.isFinite(value)) {
        return normalizeFunAsrTimestampSeconds(value);
      }
    }
    return Number.NaN;
  }

  function optionalFiniteNumber(value) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") {
      return Number.NaN;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.NaN;
  }

  function normalizeFunAsrTimestampSeconds(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.abs(number) >= 1000 ? number / 1000 : number;
  }

  function cleanFunAsrText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  async function transcribeDashScopeFunAsrFile(file, config = {}, options = {}) {
    const model = String(config.model || FUNASR_DEFAULT_MODEL).trim() || FUNASR_DEFAULT_MODEL;
    const apiKey = String(config.apiKey || "").trim();
    if (!apiKey) {
      throw new Error("Fun-ASR 缺少 DashScope API Key。");
    }
    const fileUrl = await uploadDashScopeTemporaryFile(file, { ...config, model });
    const task = await submitDashScopeFunAsrTask({
      config,
      model,
      apiKey,
      fileUrls: [fileUrl],
      parameters: buildDashScopeFunAsrParameters(config, options)
    });
    const completed = await waitDashScopeFunAsrTask(task.taskId, { ...config, apiKey }, options);
    const resultUrl = findDashScopeFunAsrTranscriptionUrl(completed);
    if (!resultUrl) {
      throw new Error("Fun-ASR 任务完成但没有返回转写结果地址。");
    }
    return await fetchJsonOrThrow(resultUrl, { headers: {} });
  }

  async function uploadDashScopeTemporaryFile(file = {}, config = {}) {
    const model = String(config.model || FUNASR_DEFAULT_MODEL).trim() || FUNASR_DEFAULT_MODEL;
    const apiKey = String(config.apiKey || "").trim();
    const policy = await getDashScopeUploadPolicy({ ...config, model, apiKey });
    const data = policy.data || policy.output || policy;
    const fileName = safeFileName(file.name || "audio.mp3");
    const objectKey = `${String(data.upload_dir || "").replace(/\/+$/, "")}/${fileName}`;
    const form = new FormData();
    form.append("OSSAccessKeyId", data.oss_access_key_id);
    form.append("Signature", data.signature);
    form.append("policy", data.policy);
    form.append("key", objectKey);
    form.append("x-oss-object-acl", data.x_oss_object_acl || "private");
    form.append("x-oss-forbid-overwrite", data.x_oss_forbid_overwrite || "true");
    form.append("success_action_status", "200");
    form.append("file", new Blob([await fileArrayBuffer(file)], { type: file.mime || "audio/mpeg" }), fileName);
    const response = await fetch(data.upload_host, {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      throw new Error(`Fun-ASR 临时文件上传失败：HTTP ${response.status} ${await safeResponseText(response)}`);
    }
    return `oss://${objectKey}`;
  }

  async function getDashScopeUploadPolicy(config = {}) {
    const url = `${dashScopeApiBaseUrl(config)}/uploads?action=getPolicy&model=${encodeURIComponent(config.model || FUNASR_DEFAULT_MODEL)}`;
    return await fetchJsonOrThrow(url, {
      headers: dashScopeHeaders(config.apiKey)
    });
  }

  async function submitDashScopeFunAsrTask({ config = {}, model, apiKey, fileUrls, parameters }) {
    const payload = {
      model,
      input: { file_urls: fileUrls },
      parameters
    };
    const response = await fetch(`${dashScopeApiBaseUrl(config)}/services/audio/asr/transcription`, {
      method: "POST",
      headers: {
        ...dashScopeHeaders(apiKey),
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
        "X-DashScope-OssResourceResolve": "enable"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Fun-ASR 任务提交失败：HTTP ${response.status} ${body.message || body.code || ""}`.trim());
    }
    const taskId = body.output?.task_id || body.task_id;
    if (!taskId) {
      throw new Error("Fun-ASR 任务提交成功但没有返回 task_id。");
    }
    return { taskId, response: body };
  }

  async function waitDashScopeFunAsrTask(taskId, config = {}, options = {}) {
    const startedAt = Date.now();
    const timeoutMs = Math.max(60_000, Number(config.timeoutMs || options.timeoutMs || FUNASR_TIMEOUT_MS) || FUNASR_TIMEOUT_MS);
    let attempt = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const body = await fetchJsonOrThrow(`${dashScopeApiBaseUrl(config)}/tasks/${encodeURIComponent(taskId)}`, {
        headers: dashScopeHeaders(config.apiKey)
      });
      const status = body.output?.task_status || body.task_status || "";
      options.onProgress?.({ taskId, status, attempt });
      if (status === "SUCCEEDED") {
        return body;
      }
      if (status === "FAILED" || status === "CANCELED") {
        throw new Error(`Fun-ASR 任务${status === "FAILED" ? "失败" : "已取消"}：${body.output?.message || body.message || body.code || ""}`);
      }
      const waitMs = Math.min(FUNASR_MAX_POLL_INTERVAL_MS, FUNASR_POLL_INTERVAL_MS + attempt * 1000);
      attempt += 1;
      await delay(waitMs);
    }
    throw new Error("Fun-ASR 任务轮询超时。");
  }

  function findDashScopeFunAsrTranscriptionUrl(task = {}) {
    const results = [
      ...(Array.isArray(task.output?.results) ? task.output.results : []),
      ...(Array.isArray(task.results) ? task.results : [])
    ];
    for (const item of results) {
      const url = item?.transcription_url || item?.output?.transcription_url || item?.results?.[0]?.transcription_url || item?.output?.results?.[0]?.transcription_url;
      if (url) {
        return url;
      }
    }
    return task.output?.transcription_url || task.transcription_url || "";
  }

  async function fetchJsonOrThrow(url, options = {}) {
    const response = await fetch(url, options);
    const body = await response.json().catch(async () => {
      const text = await safeResponseText(response);
      return text ? { message: text } : {};
    });
    if (!response.ok) {
      throw new Error(`Fun-ASR 请求失败：HTTP ${response.status} ${body.message || body.code || ""}`.trim());
    }
    return body;
  }

  function dashScopeApiBaseUrl(config = {}) {
    const baseUrl = String(config.baseUrl || DASHSCOPE_DEFAULT_BASE_URL).trim() || DASHSCOPE_DEFAULT_BASE_URL;
    return baseUrl.replace(/\/+$/, "");
  }

  function dashScopeHeaders(apiKey) {
    return {
      Authorization: `Bearer ${String(apiKey || "").trim()}`
    };
  }

  async function fileArrayBuffer(file = {}) {
    if (isArrayBufferLike(file.buffer)) {
      return file.buffer;
    }
    if (isArrayBufferView(file.buffer)) {
      return file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength);
    }
    if (isArrayBufferLike(file.bytes)) {
      return file.bytes;
    }
    if (isArrayBufferView(file.bytes)) {
      return file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength);
    }
    if (file.blob && typeof file.blob.arrayBuffer === "function") {
      return await file.blob.arrayBuffer();
    }
    if (typeof file.arrayBuffer === "function") {
      return await file.arrayBuffer();
    }
    throw new Error("Fun-ASR 缺少可上传的音频数据。");
  }

  function isArrayBufferLike(value) {
    return value
      && typeof value.byteLength === "number"
      && Object.prototype.toString.call(value) === "[object ArrayBuffer]";
  }

  function isArrayBufferView(value) {
    return value
      && typeof value.byteOffset === "number"
      && typeof value.byteLength === "number"
      && isArrayBufferLike(value.buffer);
  }

  function safeFileName(value) {
    const name = String(value || "audio.mp3").split(/[\\/]/).pop() || "audio.mp3";
    return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "audio.mp3";
  }

  async function safeResponseText(response) {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }

  function finiteNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return number;
      }
    }
    return Number.NaN;
  }

  function roundSeconds(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  return {
    isDashScopeFunAsrConfig,
    dashScopeFunAsrChunkSeconds,
    dashScopeFunAsrShouldDiarize,
    buildDashScopeFunAsrParameters,
    normalizeDashScopeFunAsrResult,
    transcribeDashScopeFunAsrFile,
    uploadDashScopeTemporaryFile,
    getDashScopeUploadPolicy,
    submitDashScopeFunAsrTask,
    waitDashScopeFunAsrTask,
    findDashScopeFunAsrTranscriptionUrl
  };
})();
