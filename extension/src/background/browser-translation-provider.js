import { FuguangBrowserLanguage } from "./browser-language.js";
import { FuguangRequestSemaphore } from "../shared/request-semaphore.js";

export const FuguangBrowserTranslationProvider = (() => {
  const BROWSER_TRANSLATION_RESPONSE_FORMAT_UNSUPPORTED_KEYS = new Set();
  const BROWSER_TRANSLATION_TIMEOUT_MS = 90_000;
  const {
    normalizeTargetLanguage,
    targetLanguageName
  } = FuguangBrowserLanguage;

  function createBrowserTranslationContext(llmConfig, targetLanguage, metadata, options = {}) {
    return {
      llmConfig,
      targetLanguage,
      metadata: metadata || {},
      options: options || {}
    };
  }

  function isBrowserTranslationContext(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "llmConfig") &&
      Object.prototype.hasOwnProperty.call(value, "targetLanguage")
    );
  }

  async function requestBrowserTranslationItems(sourceSegments, translationContextOrConfig, targetLanguage, metadata, options = {}) {
    const translationContext = isBrowserTranslationContext(translationContextOrConfig)
      ? translationContextOrConfig
      : createBrowserTranslationContext(translationContextOrConfig, targetLanguage, metadata, options);
    const { llmConfig } = translationContext;
    const provider = normalizeProviderType(llmConfig.providerType);
    const messages = buildTranslationMessages(sourceSegments, translationContext.targetLanguage, translationContext.metadata);
    const timeoutMs = normalizeTimeoutMs(translationContext.options.timeoutMs);
    const requestController = new AbortController();
    const unlink = linkTranslationAbortSignal(translationContext.options.signal, requestController);
    const requestOptions = { ...translationContext.options, signal: requestController.signal };
    let content;
    try {
      const request = requestTranslationWithConcurrency(llmConfig, requestOptions, () => (
        provider === "anthropic"
          ? activeProviderFunction("requestAnthropicMessage", requestAnthropicMessage)(llmConfig, messages, requestOptions)
          : activeProviderFunction("requestOpenAiCompatibleChat", requestOpenAiCompatibleChat)(llmConfig, messages, requestOptions)
      ));
      content = await withPromiseTimeout(
        request,
        timeoutMs,
        "翻译模型请求超时",
        translationContext.options.signal,
        error => requestController.abort(error)
      );
    } finally {
      unlink();
    }
    const json = parseModelJson(content);
    return Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.translated_transcript)
        ? json.translated_transcript
        : [];
  }

  async function requestTranslationWithConcurrency(config, options, request) {
    const key = FuguangRequestSemaphore.providerKey("translation", config);
    const limit = Math.max(1, Math.min(8, Number(config.maxConcurrency || 3) || 3));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await FuguangRequestSemaphore.withPermit(key, limit, request, options.signal);
      } catch (error) {
        const waitMs = Number(error?.retryAfterMs || 0) || 0;
        if (attempt > 0 || !browserTranslationErrorIsRateLimited(error) || waitMs <= 0) {
          throw error;
        }
        await FuguangRequestSemaphore.delay(waitMs, options.signal);
      }
    }
    throw new Error("翻译模型请求失败。");
  }

  function activeProviderFunction(name, fallback) {
    return typeof globalThis[name] === "function" ? globalThis[name] : fallback;
  }

  function buildTranslationMessages(sourceSegments, targetLanguage, metadata) {
    const targetCode = normalizeTargetLanguage(targetLanguage);
    const targetName = targetLanguageName(targetCode);
    const context = {
      title: metadata?.title || "",
      description: metadata?.description || "",
      pageLanguage: metadata?.pageLanguage || "",
      channel: metadata?.channel || "",
      duration: metadata?.duration || null,
      pageUrl: metadata?.pageUrl || ""
    };
    return [
      {
        role: "system",
        content: [
          `你是专业字幕翻译器。把每一条字幕翻译成自然、口语化、适合视频字幕的 ${targetName}。`,
          "只返回一个合法 JSON 对象，不要 Markdown，不要解释，不要额外字段。",
          "输出格式必须是 {\"items\":[{\"i\":0,\"text\":\"译文\"}]}。",
          "items 数量必须与输入 segments 完全一致，i 必须逐条对应，顺序必须保持不变。",
          "不要合并、拆分、省略、总结字幕；不要把原语言文本留在译文里，除非它是人名、品牌名、网址、代码或明确应保留的专有名词。",
          "如果原文已经是目标语言，也要润色为自然字幕，而不是混入其他语言。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLanguage: {
            code: targetCode,
            name: targetName
          },
          context,
          segments: sourceSegments.map((segment, index) => ({
            i: index,
            start: roundTime(segment.start),
            end: roundTime(segment.end),
            text: segment.text
          }))
        })
      }
    ];
  }

  async function requestOpenAiCompatibleChat(config, messages, options = {}) {
    const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    const cacheKey = browserTranslationResponseFormatCacheKey(config);
    if (cacheKey && BROWSER_TRANSLATION_RESPONSE_FORMAT_UNSUPPORTED_KEYS.has(cacheKey)) {
      return await requestOpenAiCompatibleChatOnce(config, messages, timeoutMs, false, options.signal);
    }
    try {
      return await requestOpenAiCompatibleChatOnce(config, messages, timeoutMs, true, options.signal);
    } catch (error) {
      if (!isResponseFormatUnsupportedError(error)) {
        throw error;
      }
      if (cacheKey) {
        BROWSER_TRANSLATION_RESPONSE_FORMAT_UNSUPPORTED_KEYS.add(cacheKey);
      }
      return await requestOpenAiCompatibleChatOnce(config, messages, timeoutMs, false, options.signal);
    }
  }

  function browserTranslationResponseFormatCacheKey(config = {}) {
    const baseUrl = normalizeApiBaseUrl(config.baseUrl || "");
    const model = String(config.model || "").trim();
    if (!baseUrl || !model) {
      return "";
    }
    return [
      normalizeProviderType(config.providerType),
      baseUrl,
      model
    ].join("\n");
  }

  async function requestOpenAiCompatibleChatOnce(config, messages, timeoutMs, useJsonResponseFormat, signal = null) {
    const body = {
      model: config.model,
      messages,
      temperature: 0.1
    };
    if (useJsonResponseFormat) {
      body.response_format = { type: "json_object" };
    }
    const { response, payload } = await fetchJsonWithTimeout(`${normalizeApiBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }, timeoutMs, "翻译模型", signal);
    if (!response.ok) {
      throw translationResponseError(payload.error?.message || payload.message || `翻译模型返回 HTTP ${response.status}`, response);
    }
    const content = payload.choices?.[0]?.message?.content || "";
    if (useJsonResponseFormat && isResponseFormatUnsupportedError(content)) {
      throw new Error(content);
    }
    return content;
  }

  function isResponseFormatUnsupportedError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return /response_format/.test(message) && /(unsupported|not supported|unknown|unrecognized|invalid|extra_forbidden|not permitted|不支持|未知|无效)/.test(message);
  }

  async function requestAnthropicMessage(config, messages, options = {}) {
    const system = messages.find(message => message.role === "system")?.content || "";
    const user = messages.filter(message => message.role !== "system");
    const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    const { response, payload } = await fetchJsonWithTimeout(`${normalizeApiBaseUrl(config.baseUrl)}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        temperature: 0.1,
        system,
        messages: user
      })
    }, timeoutMs, "翻译模型", options.signal);
    if (!response.ok) {
      throw translationResponseError(payload.error?.message || payload.message || `翻译模型返回 HTTP ${response.status}`, response);
    }
    return (payload.content || []).map(item => item.text || "").join("\n");
  }

  function translationResponseError(message, response) {
    const error = new Error(message);
    error.status = Number(response?.status || 0) || 0;
    error.retryAfterMs = FuguangRequestSemaphore.retryAfterMs(response?.headers);
    return error;
  }

  function normalizeTimeoutMs(timeoutMs) {
    const normalized = Number(timeoutMs);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : BROWSER_TRANSLATION_TIMEOUT_MS;
  }

  async function withPromiseTimeout(promise, timeoutMs, label, signal = null, onTimeout = null) {
    let timer = 0;
    let removeAbortListener = () => {};
    try {
      const races = [
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`${label}（${Math.round(timeoutMs / 1000)} 秒）`);
            onTimeout?.(error);
            reject(error);
          }, timeoutMs);
        })
      ];
      if (signal) {
        races.push(new Promise((_, reject) => {
          if (signal.aborted) {
            reject(translationAbortError(signal.reason));
            return;
          }
          const onAbort = () => reject(translationAbortError(signal.reason));
          signal.addEventListener?.("abort", onAbort, { once: true });
          removeAbortListener = () => signal.removeEventListener?.("abort", onAbort);
        }));
      }
      return await Promise.race(races);
    } finally {
      clearTimeout(timer);
      removeAbortListener();
    }
  }

  async function fetchJsonWithTimeout(url, init, timeoutMs, label, signal = null) {
    const controller = new AbortController();
    const unlink = linkTranslationAbortSignal(signal, controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    } catch (error) {
      if (signal?.aborted) {
        throw translationAbortError(signal.reason);
      }
      if (timedOut || controller.signal.aborted) {
        throw new Error(`${label}请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      unlink();
    }
  }

  function linkTranslationAbortSignal(signal, controller) {
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

  function translationAbortError(reason) {
    const error = new Error(reason?.message || "任务已停止。");
    error.name = "AbortError";
    if (reason instanceof Error) {
      error.cause = reason;
    }
    return error;
  }

  function browserTranslationErrorIsPermanent(error) {
    const message = String(error?.message || error || "").toLowerCase();
    if (browserTranslationErrorIsContentPolicy(message) || browserTranslationErrorIsRateLimited(message)) {
      return false;
    }
    return /(401|403|404|unauthorized|forbidden|invalid api key|api key|invalid key|authentication|quota|不存在的模型|模型不存在)/.test(message);
  }

  function browserTranslationErrorIsRateLimited(message) {
    if (Number(message?.status || 0) === 429) {
      return true;
    }
    return /(429|rate limit|too many requests|请求过多|限流|频率限制)/.test(String(message || "").toLowerCase());
  }

  function browserTranslationErrorIsContentPolicy(message) {
    return /(content (?:policy|safety|filter|moderation)|safety policy|policy violation|moderation|moderated|violat(?:e|ion)|sensitive content|blocked content|内容.{0,8}(?:安全|审核|审查|违规|过滤)|审核|审查|违规|敏感内容|内容安全|内容过滤)/.test(String(message || "").toLowerCase());
  }

  function parseModelJson(content) {
    const text = String(content || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("模型返回的 JSON 无法自动修复。");
      }
      return JSON.parse(match[0]);
    }
  }

  function normalizeProviderType(providerType) {
    const value = String(providerType || "").trim();
    return ["openai", "groq", "xai", "anthropic"].includes(value) ? value : "openai";
  }

  function normalizeApiBaseUrl(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function roundTime(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
  }

  const api = {
    requestBrowserTranslationItems,
    buildTranslationMessages,
    requestOpenAiCompatibleChat,
    requestAnthropicMessage,
    browserTranslationErrorIsPermanent,
    browserTranslationErrorIsRateLimited,
    browserTranslationErrorIsContentPolicy,
    parseModelJson,
    targetLanguageName
  };
  return api;
})();
