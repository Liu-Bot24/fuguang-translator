import { FuguangBrowserLanguage } from "./browser-language.js";

export const FuguangBrowserAsrProvider = (() => {
  const BROWSER_ASR_MIN_TIMEOUT_MS = 180_000;
  const BROWSER_ASR_MAX_TIMEOUT_MS = 20 * 60_000;
  const BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS = 1_250;
  const { normalizeAsrLanguage } = FuguangBrowserLanguage;
  const BROWSER_ASR_COMPAT_QUALITY_FIELDS = [
    ["word_timestamps", "true"],
    ["condition_on_previous_text", "false"],
    ["without_timestamps", "false"],
    ["no_speech_threshold", "0.6"],
    ["compression_ratio_threshold", "2.4"],
    ["log_prob_threshold", "-1"]
  ];
  const BROWSER_ASR_COMPAT_VAD_FIELDS = [
    ["threshold", "0.15"],
    ["min_speech_duration_ms", "0"],
    ["max_speech_duration_s", "30"],
    ["min_silence_duration_ms", "160"],
    ["speech_pad_ms", "800"]
  ];
  const BROWSER_ASR_COMPAT_VAD_PARAMETERS = {
    threshold: 0.15,
    min_speech_duration_ms: 0,
    max_speech_duration_s: 30,
    min_silence_duration_ms: 160,
    speech_pad_ms: 800
  };
  const BROWSER_ASR_CLIP_TIMESTAMP_MAX_SECONDS = BROWSER_ASR_COMPAT_VAD_PARAMETERS.max_speech_duration_s;
  const browserAsrVadCapabilityCache = new Map();
  const browserAsrRequestFieldCapabilityCache = new Map();
  const browserAsrOpenApiSchemaCache = new Map();
  const browserAsrSpeechTimestampsEndpointCache = new Map();

  function normalizeAsrTimeoutMs(timeoutMs, chunk = {}) {
    const normalized = Number(timeoutMs);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
    const duration = pickFinite(
      chunk.duration,
      Number(chunk.end) - Number(chunk.start)
    );
    if (!duration) {
      return BROWSER_ASR_MIN_TIMEOUT_MS;
    }
    return Math.min(
      BROWSER_ASR_MAX_TIMEOUT_MS,
      Math.max(BROWSER_ASR_MIN_TIMEOUT_MS, Math.ceil(duration * BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS))
    );
  }

  function browserAsrRequestFields(asrConfig, rawLanguage = "", options = {}) {
    const provider = normalizeProviderType(asrConfig?.providerType);
    const language = normalizeAsrLanguage(rawLanguage);
    if (provider === "dashscope_funasr") {
      return [];
    }
    if (provider === "xai") {
      const xaiLanguage = xaiAsrLanguage(language);
      return xaiLanguage ? [["format", "true"], ["language", xaiLanguage]] : [];
    }
    const fields = [
      ["model", asrConfig?.model || ""],
      ["response_format", "verbose_json"],
      ["timestamp_granularities[]", "segment"],
      ["timestamp_granularities[]", "word"]
    ];
    fields.push(...browserAsrStableDecodingFields(asrConfig, options));
    const clipTimestampFields = browserAsrCompatibleClipTimestampFields(asrConfig, options);
    fields.push(...clipTimestampFields);
    fields.push(...browserAsrCompatibleClipVadDisableFields(asrConfig, options, clipTimestampFields));
    if (shouldUseBrowserAsrVadFilter(asrConfig, options)) {
      fields.push(["vad_filter", "true"]);
      fields.push(...browserAsrCompatibleVadFields(asrConfig, options));
    }
    fields.push(...browserAsrCompatibleQualityFields(asrConfig, options));
    if (language) {
      fields.push(["language", language]);
    }
    return fields;
  }

  function browserAsrStableDecodingFields(asrConfig = {}, options = {}) {
    const provider = normalizeProviderType(asrConfig?.providerType);
    if (!["openai", "groq"].includes(provider)) {
      return [];
    }
    if (isKnownTemperatureAsrBaseUrl(asrConfig?.baseUrl) || asrRequestFieldSupported(options, "temperature")) {
      return [["temperature", "0"]];
    }
    return [];
  }

  function browserAsrCompatibleClipTimestampFields(asrConfig = {}, options = {}) {
    if (normalizeProviderType(asrConfig?.providerType) !== "openai" || isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return [];
    }
    const clipTimestamps = normalizeBrowserAsrClipTimestampsText(options.clipTimestamps);
    if (!clipTimestamps || !asrRequestFieldSupported(options, "clip_timestamps")) {
      return [];
    }
    return [["clip_timestamps", clipTimestamps]];
  }

  function browserAsrCompatibleClipVadDisableFields(asrConfig = {}, options = {}, clipTimestampFields = browserAsrCompatibleClipTimestampFields(asrConfig, options)) {
    if (!clipTimestampFields.length || !asrRequestFieldSupported(options, "vad_filter")) {
      return [];
    }
    return [["vad_filter", "false"]];
  }

  function browserAsrCompatibleQualityFields(asrConfig = {}, options = {}) {
    if (normalizeProviderType(asrConfig?.providerType) !== "openai" || isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return [];
    }
    return BROWSER_ASR_COMPAT_QUALITY_FIELDS.filter(([name]) => asrRequestFieldSupported(options, name));
  }

  function browserAsrCompatibleVadFields(asrConfig = {}, options = {}) {
    if (normalizeProviderType(asrConfig?.providerType) !== "openai" || isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return [];
    }
    if (asrRequestFieldSupported(options, "vad_parameters")) {
      return [["vad_parameters", JSON.stringify(BROWSER_ASR_COMPAT_VAD_PARAMETERS)]];
    }
    return BROWSER_ASR_COMPAT_VAD_FIELDS.filter(([name]) => asrRequestFieldSupported(options, name));
  }

  function shouldUseBrowserAsrVadFilter(asrConfig = {}, options = {}) {
    const mode = normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode);
    if (normalizeProviderType(asrConfig?.providerType) !== "openai") {
      return false;
    }
    if (isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return false;
    }
    if (browserAsrCompatibleClipTimestampFields(asrConfig, options).length) {
      return false;
    }
    if (mode === "off") {
      return false;
    }
    if (mode === "on") {
      return true;
    }
    if (options.vadFilterSupported || options.openApiVadFilterSupported || asrRequestFieldSupported(options, "vad_filter")) {
      return true;
    }
    return false;
  }

  function browserAsrClipTimestampsValue(intervals, chunk = {}) {
    if (!Array.isArray(intervals) || !intervals.length) {
      return "";
    }
    const chunkStart = finiteNumberOrDefault(chunk?.start, 0);
    const chunkEnd = finiteNumberOrDefault(
      chunk?.end,
      chunkStart + Math.max(0, finiteNumberOrDefault(chunk?.duration, 0))
    );
    const chunkDuration = Math.max(0, chunkEnd - chunkStart);
    const clippedIntervals = intervals
      .map(interval => {
        const start = finiteNumberOrDefault(interval?.start, NaN);
        const end = finiteNumberOrDefault(interval?.end, NaN);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          return null;
        }
        const relativeStart = clampNumber(start - chunkStart, 0, chunkDuration);
        const relativeEnd = clampNumber(end - chunkStart, 0, chunkDuration);
        if (relativeEnd <= relativeStart) {
          return null;
        }
        return { start: relativeStart, end: relativeEnd };
      })
      .filter(Boolean)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    const clipWindows = mergeBrowserAsrClipTimestampIntervals(clippedIntervals);
    const values = [];
    for (const interval of clipWindows) {
      values.push(formatBrowserAsrClipTimestampSecond(interval.start));
      values.push(formatBrowserAsrClipTimestampSecond(interval.end));
    }
    return values.join(",");
  }

  function mergeBrowserAsrClipTimestampIntervals(intervals) {
    const maxDuration = BROWSER_ASR_CLIP_TIMESTAMP_MAX_SECONDS;
    const adjustedIntervals = browserAsrSpeachesAdjustedClipIntervals(intervals);
    return browserAsrSpeachesMergeSpeechSegments(adjustedIntervals, maxDuration);
  }

  function browserAsrSpeachesMergeSpeechSegments(intervals, maxDuration) {
    const merged = [];
    let current = null;
    for (const interval of intervals || []) {
      if (!current) {
        current = { ...interval };
        continue;
      }
      if (interval.end - current.start > maxDuration && current.end > current.start) {
        merged.push(current);
        current = { ...interval };
      } else {
        current.end = Math.max(current.end, interval.end);
      }
    }
    if (current && current.end > current.start) {
      merged.push(current);
    }
    return merged;
  }

  function browserAsrSpeachesAdjustedClipIntervals(intervals) {
    const edgePadding = Math.max(0, Number(BROWSER_ASR_COMPAT_VAD_PARAMETERS.speech_pad_ms || 0) || 0) / 1000;
    const adjusted = (intervals || []).map(interval => ({ ...interval }));
    if (!edgePadding) {
      return adjusted;
    }
    for (let index = 0; index < adjusted.length; index += 1) {
      const interval = adjusted[index];
      if (index > 0 && interval.start < adjusted[index - 1].end) {
        interval.start += edgePadding;
      }
      if (index < adjusted.length - 1 && interval.end > adjusted[index + 1].start) {
        interval.end -= edgePadding;
      }
    }
    return adjusted.filter(interval => interval.end > interval.start);
  }

  function normalizeBrowserAsrClipTimestampsText(value) {
    return String(value || "").trim();
  }

  function formatBrowserAsrClipTimestampSecond(value) {
    const rounded = Math.round(Number(value || 0) * 1000) / 1000;
    if (!Number.isFinite(rounded) || Math.abs(rounded) < 0.0005) {
      return "0";
    }
    return String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function finiteNumberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function asrRequestFieldSupported(options = {}, name) {
    const fields = options.supportedRequestFields || options.openApiSupportedFields;
    if (fields && typeof fields.has === "function") {
      return fields.has(name);
    }
    if (Array.isArray(fields)) {
      return fields.includes(name);
    }
    return false;
  }

  async function resolveBrowserAsrSupportedRequestFields(asrConfig = {}, options = {}) {
    if (!shouldProbeBrowserAsrCapabilities(asrConfig)) {
      return new Set();
    }
    return browserAsrOpenApiSupportedRequestFields(asrConfig?.baseUrl, options);
  }

  function shouldProbeBrowserAsrCapabilities(asrConfig = {}) {
    const mode = normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode);
    if (mode === "off" || normalizeProviderType(asrConfig?.providerType) !== "openai") {
      return false;
    }
    const baseUrl = String(asrConfig?.baseUrl || "").trim();
    return Boolean(baseUrl && !isKnownStandardAsrBaseUrl(baseUrl));
  }

  async function browserAsrOpenApiSupportedRequestFields(baseUrl, options = {}) {
    const cacheKey = String(baseUrl || "").trim();
    if (!cacheKey) {
      return new Set();
    }
    if (browserAsrRequestFieldCapabilityCache.has(cacheKey)) {
      return browserAsrRequestFieldCapabilityCache.get(cacheKey);
    }
    if (browserAsrVadCapabilityCache.has(cacheKey)) {
      return new Set(browserAsrVadCapabilityCache.get(cacheKey) ? ["vad_filter"] : []);
    }
    const schema = await browserAsrOpenApiSchema(cacheKey, options);
    if (schema) {
      const fields = schemaAudioTranscriptionRequestProperties(schema);
      if (fields.size) {
        browserAsrRequestFieldCapabilityCache.set(cacheKey, fields);
        browserAsrVadCapabilityCache.set(cacheKey, fields.has("vad_filter"));
        return fields;
      }
    }
    browserAsrVadCapabilityCache.set(cacheKey, false);
    const fields = new Set();
    browserAsrRequestFieldCapabilityCache.set(cacheKey, fields);
    return fields;
  }

  async function resolveBrowserAsrSpeechTimestampsEndpoint(asrConfig = {}, options = {}) {
    if (!shouldProbeBrowserAsrCapabilities(asrConfig)) {
      return "";
    }
    const baseUrl = String(asrConfig?.baseUrl || "").trim();
    if (!baseUrl) {
      return "";
    }
    if (browserAsrSpeechTimestampsEndpointCache.has(baseUrl)) {
      return browserAsrSpeechTimestampsEndpointCache.get(baseUrl);
    }
    const schema = await browserAsrOpenApiSchema(baseUrl, options);
    const endpoint = schemaAudioSpeechTimestampsEndpoint(schema, baseUrl);
    browserAsrSpeechTimestampsEndpointCache.set(baseUrl, endpoint);
    return endpoint;
  }

  async function browserAsrOpenApiSchema(baseUrl, options = {}) {
    const cacheKey = String(baseUrl || "").trim();
    if (!cacheKey) {
      return null;
    }
    if (browserAsrOpenApiSchemaCache.has(cacheKey)) {
      return browserAsrOpenApiSchemaCache.get(cacheKey);
    }
    for (const openApiUrl of browserAsrOpenApiUrlCandidates(cacheKey)) {
      try {
        const controller = new AbortController();
        const unlink = linkBrowserAsrProbeAbortSignal(options.signal, controller);
        const timer = setTimeout(() => controller.abort(), 1500);
        let response;
        try {
          response = await fetch(openApiUrl, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
          unlink();
        }
        if (!response?.ok) {
          continue;
        }
        const schema = await response.json().catch(() => null);
        if (schema && typeof schema === "object" && schemaHasAsrRelevantPaths(schema)) {
          browserAsrOpenApiSchemaCache.set(cacheKey, schema);
          return schema;
        }
      } catch (error) {
        if (options.signal?.aborted) {
          throw browserAsrProbeAbortError(options.signal.reason);
        }
        // Capability probing is best-effort; unknown APIs should keep the standard request shape.
      }
    }
    browserAsrOpenApiSchemaCache.set(cacheKey, null);
    return null;
  }

  function linkBrowserAsrProbeAbortSignal(signal, controller) {
    if (!signal) {
      return () => {};
    }
    if (signal.aborted) {
      controller.abort(signal.reason);
      return () => {};
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener?.("abort", onAbort, { once: true });
    return () => signal.removeEventListener?.("abort", onAbort);
  }

  function browserAsrProbeAbortError(reason) {
    const error = new Error(reason?.message || "任务已停止。");
    error.name = "AbortError";
    return error;
  }

  function schemaHasAsrRelevantPaths(schema) {
    if (!schema?.paths || typeof schema.paths !== "object") {
      return false;
    }
    return Object.keys(schema.paths).some(pathName => (
      /\/audio\/(?:transcriptions|translations|speech\/timestamps)\b/i.test(String(pathName))
    ));
  }

  function browserAsrOpenApiUrlCandidates(baseUrl) {
    let parsed;
    try {
      parsed = new URL(String(baseUrl || ""));
    } catch {
      return [];
    }
    const origin = `${parsed.protocol}//${parsed.host}`;
    const rawPath = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/audio\/transcriptions$/i, "")
      .replace(/\/audio\/translations$/i, "");
    const paths = [];
    if (rawPath.endsWith("/v1")) {
      paths.push(rawPath.slice(0, -3) || "");
    }
    paths.push(rawPath || "");
    paths.push("");
    const seen = new Set();
    return paths
      .map(path => `${origin}${path}/openapi.json`)
      .filter(url => {
        if (seen.has(url)) {
          return false;
        }
        seen.add(url);
        return true;
      });
  }

  function schemaAudioTranscriptionRequestProperties(schema) {
    const properties = new Set();
    if (!schema || typeof schema !== "object" || !schema.paths || typeof schema.paths !== "object") {
      return properties;
    }
    for (const [pathName, pathItem] of Object.entries(schema.paths)) {
      if (!/\/audio\/(?:transcriptions|translations)\b/i.test(String(pathName))) {
        continue;
      }
      for (const operation of Object.values(pathItem || {})) {
        collectOperationRequestBodyProperties(operation, schema, properties);
      }
    }
    return properties;
  }

  function schemaAudioSpeechTimestampsEndpoint(schema, baseUrl) {
    if (!schema || typeof schema !== "object" || !schema.paths || typeof schema.paths !== "object") {
      return "";
    }
    const path = Object.keys(schema.paths).find(pathName => (
      /\/audio\/speech\/timestamps\/?$/i.test(String(pathName))
      && schema.paths[pathName]?.post
    ));
    if (!path) {
      return "";
    }
    if (/^https?:\/\//i.test(path)) {
      return path.replace(/\/+$/, "");
    }
    try {
      const parsed = new URL(String(baseUrl || ""));
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      return `${parsed.protocol}//${parsed.host}${normalizedPath}`.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function collectOperationRequestBodyProperties(operation, rootSchema, output) {
    const requestBody = resolveOpenApiRef(rootSchema, operation?.requestBody) || operation?.requestBody;
    const content = requestBody?.content;
    if (!content || typeof content !== "object") {
      return;
    }
    for (const media of Object.values(content)) {
      collectSchemaProperties(media?.schema, rootSchema, output);
    }
  }

  function collectSchemaProperties(schema, rootSchema, output, seen = new Set()) {
    if (!schema || typeof schema !== "object" || seen.has(schema)) {
      return;
    }
    seen.add(schema);
    const referenced = resolveOpenApiRef(rootSchema, schema);
    if (referenced && referenced !== schema) {
      collectSchemaProperties(referenced, rootSchema, output, seen);
      return;
    }
    if (schema.properties && typeof schema.properties === "object") {
      for (const propertyName of Object.keys(schema.properties)) {
        output.add(propertyName);
      }
    }
    for (const key of ["allOf", "anyOf", "oneOf"]) {
      if (Array.isArray(schema[key])) {
        schema[key].forEach(item => collectSchemaProperties(item, rootSchema, output, seen));
      }
    }
    if (schema.items) {
      collectSchemaProperties(schema.items, rootSchema, output, seen);
    }
  }

  function resolveOpenApiRef(rootSchema, value) {
    const ref = String(value?.$ref || "");
    if (!ref.startsWith("#/") || !rootSchema || typeof rootSchema !== "object") {
      return null;
    }
    return ref
      .slice(2)
      .split("/")
      .map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), rootSchema) || null;
  }

  function normalizeAsrVadFilterMode(value) {
    const normalized = String(value || "auto").trim().toLowerCase();
    if (["on", "true", "1", "yes", "force", "enabled"].includes(normalized)) {
      return "on";
    }
    if (["off", "false", "0", "no", "disabled"].includes(normalized)) {
      return "off";
    }
    return "auto";
  }

  function isKnownStandardAsrBaseUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return new Set(["api.openai.com", "api.groq.com", "api.x.ai"]).has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function isKnownTemperatureAsrBaseUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return new Set(["api.openai.com", "api.groq.com"]).has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function browserAsrEndpoint(asrConfig) {
    const provider = normalizeProviderType(asrConfig?.providerType);
    const baseUrl = normalizeApiBaseUrl(asrConfig?.baseUrl || "");
    if (provider === "xai") {
      return `${baseUrl}/stt`;
    }
    return baseUrl.endsWith("/audio/transcriptions") ? baseUrl : `${baseUrl}/audio/transcriptions`;
  }

  function xaiAsrLanguage(language) {
    const supported = new Set(["en", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "es", "ja", "ko", "hi", "th", "vi"]);
    return supported.has(language) ? language : "";
  }

  function normalizeProviderType(providerType) {
    const value = String(providerType || "").trim();
    return ["openai", "groq", "xai", "anthropic", "dashscope_funasr"].includes(value) ? value : "openai";
  }

  function normalizeApiBaseUrl(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function pickFinite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }
    return 0;
  }

  return {
    normalizeAsrTimeoutMs,
    browserAsrRequestFields,
    browserAsrClipTimestampsValue,
    browserAsrCompatibleQualityFields,
    shouldUseBrowserAsrVadFilter,
    asrRequestFieldSupported,
    resolveBrowserAsrSupportedRequestFields,
    shouldProbeBrowserAsrCapabilities,
    browserAsrOpenApiSupportedRequestFields,
    resolveBrowserAsrSpeechTimestampsEndpoint,
    browserAsrOpenApiSchema,
    schemaHasAsrRelevantPaths,
    browserAsrOpenApiUrlCandidates,
    schemaAudioTranscriptionRequestProperties,
    schemaAudioSpeechTimestampsEndpoint,
    collectOperationRequestBodyProperties,
    collectSchemaProperties,
    resolveOpenApiRef,
    normalizeAsrVadFilterMode,
    isKnownStandardAsrBaseUrl,
    browserAsrEndpoint,
    normalizeAsrLanguage,
    xaiAsrLanguage
  };
})();
