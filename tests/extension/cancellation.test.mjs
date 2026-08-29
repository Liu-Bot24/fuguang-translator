import assert from "node:assert/strict";
import test from "node:test";

import { FuguangBrowserFunAsrProvider } from "../../extension/src/background/browser-funasr-provider.js";
import { FuguangBrowserTranslationProvider } from "../../extension/src/background/browser-translation-provider.js";
import { FuguangBrowserTranslationPipeline } from "../../extension/src/background/browser-translation-pipeline.js";
import { FuguangRequestSemaphore } from "../../extension/src/shared/request-semaphore.js";

test("translation cancellation stops retries after one in-flight request", async () => {
  const controller = new AbortController();
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async (_config, _messages, options = {}) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(options.signal.reason);
        return;
      }
      options.signal?.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
  };
  try {
    const promise = FuguangBrowserTranslationPipeline.translateBrowserSegments(
      [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
      { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {},
      { signal: controller.signal }
    );
    await Promise.resolve();
    controller.abort(new Error("任务已停止。"));
    await assert.rejects(promise, error => error?.name === "AbortError" && /任务已停止/.test(error.message));
    assert.equal(calls, 1);
  } finally {
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("Fun-ASR cancellation interrupts the polling wait without another request", async () => {
  const controller = new AbortController();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ output: { task_status: "RUNNING" } }),
      text: async () => ""
    };
  };
  try {
    const promise = FuguangBrowserFunAsrProvider.waitDashScopeFunAsrTask(
      "task-a",
      { baseUrl: "https://dashscope.example.test/api/v1", apiKey: "test", timeoutMs: 60_000 },
      {
        signal: controller.signal,
        onProgress() {
          controller.abort(new Error("任务已停止。"));
        }
      }
    );
    await assert.rejects(promise, error => error?.name === "AbortError" && /任务已停止/.test(error.message));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation timeout removes a queued provider request before it can send", async () => {
  const config = {
    providerType: "openai",
    baseUrl: "https://queued-timeout.example.test/v1",
    model: "test",
    apiKey: "test",
    maxConcurrency: 1
  };
  const key = FuguangRequestSemaphore.providerKey("translation", config);
  let releasePermit;
  let markPermitAcquired;
  const permitAcquired = new Promise(resolve => {
    markPermitAcquired = resolve;
  });
  const permitGate = new Promise(resolve => {
    releasePermit = resolve;
  });
  const occupyingRequest = FuguangRequestSemaphore.withPermit(key, 1, async () => {
    markPermitAcquired();
    await permitGate;
  });
  await permitAcquired;

  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async () => {
    calls += 1;
    return '{"items":[{"i":0,"text":"unexpected"}]}';
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationProvider.requestBrowserTranslationItems(
        [{ start: 0, end: 1, text: "hello" }],
        config,
        "zh-CN",
        {},
        { timeoutMs: 20 }
      ),
      /翻译模型请求超时/
    );
    releasePermit();
    await occupyingRequest;
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(calls, 0, "a request that timed out in the semaphore queue must never be sent");
    assert.equal(FuguangRequestSemaphore.snapshot().some(pool => pool.key === key), false);
  } finally {
    releasePermit();
    await occupyingRequest;
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("translation honors Retry-After once before succeeding", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        headers: { get: name => name.toLowerCase() === "retry-after" ? "0.001" : "" },
        json: async () => ({ message: "rate limit" })
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "" },
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, text: "你好" }] }) } }]
      })
    };
  };
  try {
    const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
      [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
      { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {}
    );
    assert.equal(translated[0].text, "你好");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
