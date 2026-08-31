import assert from "node:assert/strict";
import test from "node:test";

import { FuguangBrowserFunAsrProvider } from "../../extension/src/background/browser-funasr-provider.js";
import { FuguangBrowserTranslationProvider } from "../../extension/src/background/browser-translation-provider.js";
import { FuguangBrowserTranslationPipeline } from "../../extension/src/background/browser-translation-pipeline.js";

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

test("translation does not automatically resubmit a rate-limited paid request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: name => name.toLowerCase() === "retry-after" ? "0.001" : "" },
      json: async () => ({ message: "rate limit" })
    };
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
        { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /rate limit/i
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation does not retry or split a delivery-ambiguous provider failure", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async () => {
    calls += 1;
    const error = new Error("upstream returned HTTP 500 after accepting the request");
    error.status = 500;
    throw error;
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        Array.from({ length: 60 }, (_, index) => ({
          start: index,
          end: index + 0.5,
          text: `delivery-${index}`,
          chunkIndex: 0,
          segmentIndex: index
        })),
        { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /HTTP 500/
    );
    assert.equal(calls, 1);
  } finally {
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("response_format text on HTTP 500 cannot trigger a compatibility resend", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  delete globalThis.requestOpenAiCompatibleChat;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "response_format is not supported after upstream execution" } })
    };
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
        { providerType: "openai", baseUrl: "https://llm-response-format-500.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /response_format/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    }
  }
});

test("HTTP 500 abort-like provider text is a paid failure, not user cancellation", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  delete globalThis.requestOpenAiCompatibleChat;
  try {
    for (const message of ["request aborted by upstream", "cancel token invalid"]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return { ok: false, status: 500, json: async () => ({ error: { message } }) };
      };
      await assert.rejects(
        FuguangBrowserTranslationPipeline.translateBrowserSegments(
          [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
          { providerType: "openai", baseUrl: `https://llm-abort-text-${calls}.example.test/v1`, model: "test", apiKey: "test" },
          "zh-CN",
          {},
          { signal: new AbortController().signal }
        ),
        error => error?.name === "Error" && error?.status === 500 && error?.message === message
      );
      assert.equal(calls, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) globalThis.requestOpenAiCompatibleChat = originalRequest;
  }
});

test("response_format text in HTTP 200 falls back once to the compatible plain request", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const requestBodies = [];
  delete globalThis.requestOpenAiCompatibleChat;
  globalThis.fetch = async (_url, init = {}) => {
    calls += 1;
    requestBodies.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: calls === 1
          ? "response_format is not supported by this proxy"
          : JSON.stringify({ items: [{ i: 0, text: "兼容译文" }] }) } }]
      })
    };
  };
  try {
    const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
      [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }],
      { providerType: "openai", baseUrl: "https://llm-response-format-200.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {}
    );
    assert.equal(translated[0].text, "兼容译文");
    assert.equal(calls, 2);
    assert.equal(Object.hasOwn(requestBodies[0], "response_format"), true);
    assert.equal(Object.hasOwn(requestBodies[1], "response_format"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    }
  }
});

test("valid HTTP 200 translation JSON may contain response_format unsupported text without a resend", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  delete globalThis.requestOpenAiCompatibleChat;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          items: [{ i: 0, text: "response_format is not supported by this proxy" }]
        }) } }]
      })
    };
  };
  try {
    const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
      [{ start: 0, end: 1, text: "technical subtitle", chunkIndex: 0, segmentIndex: 0 }],
      { providerType: "openai", baseUrl: "https://llm-response-format-valid-json.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {}
    );
    assert.equal(translated[0].text, "response_format is not supported by this proxy");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    }
  }
});

test("valid legacy translated_transcript JSON may contain response_format unsupported text without a resend", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  delete globalThis.requestOpenAiCompatibleChat;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          translated_transcript: [{ i: 0, text: "response_format is not supported by this proxy" }]
        }) } }]
      })
    };
  };
  try {
    const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
      [{ start: 0, end: 1, text: "legacy technical subtitle", chunkIndex: 0, segmentIndex: 0 }],
      { providerType: "openai", baseUrl: "https://llm-response-format-legacy-json.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {}
    );
    assert.equal(translated[0].text, "response_format is not supported by this proxy");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    }
  }
});

test("definitive payload-size rejections split to smaller translation batches", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  delete globalThis.requestOpenAiCompatibleChat;
  try {
    for (const rejection of [
      { status: 413, message: "request entity too large" },
      { status: 400, message: "maximum context length exceeded" }
    ]) {
      const requestedSizes = [];
      globalThis.fetch = async (_url, init = {}) => {
        const body = JSON.parse(init.body);
        const request = JSON.parse(body.messages.find(message => message.role === "user").content);
        const segments = request.segments || [];
        requestedSizes.push(segments.length);
        if (segments.length > 1) {
          return {
            ok: false,
            status: rejection.status,
            json: async () => ({ error: { message: rejection.message } })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({
            items: [{ i: 0, text: `译文-${segments[0].text}` }]
          }) } }] })
        };
      };
      const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
        [
          { start: 0, end: 1, text: `first-${rejection.status}`, chunkIndex: 0, segmentIndex: 0 },
          { start: 1, end: 2, text: `second-${rejection.status}`, chunkIndex: 0, segmentIndex: 1 }
        ],
        { providerType: "openai", baseUrl: `https://llm-payload-${rejection.status}.example.test/v1`, model: "test", apiKey: "test" },
        "zh-CN",
        {}
      );
      assert.deepEqual(translated.map(segment => segment.text), [
        `译文-first-${rejection.status}`, `译文-second-${rejection.status}`
      ]);
      assert.deepEqual(requestedSizes, [2, 2, 1, 1]);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) globalThis.requestOpenAiCompatibleChat = originalRequest;
  }
});

test("unrelated HTTP 400 validation errors do not trigger translation splitting", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  delete globalThis.requestOpenAiCompatibleChat;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 400, json: async () => ({ error: { message: "invalid temperature value" } }) };
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        [
          { start: 0, end: 1, text: "first", chunkIndex: 0, segmentIndex: 0 },
          { start: 1, end: 2, text: "second", chunkIndex: 0, segmentIndex: 1 }
        ],
        { providerType: "openai", baseUrl: "https://llm-invalid-400.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /invalid temperature/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRequest) globalThis.requestOpenAiCompatibleChat = originalRequest;
  }
});

test("translation structural repair reaches every singleton when a full batch is malformed", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async () => {
    calls += 1;
    return "not json";
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        Array.from({ length: 60 }, (_, index) => ({
          start: index,
          end: index + 0.5,
          text: `malformed-${index}`,
          chunkIndex: 0,
          segmentIndex: index
        })),
        { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /没有得到可用译文/
    );
    assert.equal(calls, 120, "the 60-item binary split must inspect every singleton instead of stopping at an added quota");
  } finally {
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("translation invalid indexes are isolated through the complete split tree", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async () => {
    calls += 1;
    return JSON.stringify({ items: [{ i: 999, text: "invalid index" }] });
  };
  try {
    await assert.rejects(
      FuguangBrowserTranslationPipeline.translateBrowserSegments(
        Array.from({ length: 60 }, (_, index) => ({
          start: index,
          end: index + 0.5,
          text: `invalid-index-${index}`,
          chunkIndex: 0,
          segmentIndex: index
        })),
        { providerType: "openai", baseUrl: "https://llm.example.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        {}
      ),
      /没有得到可用译文/
    );
    assert.equal(calls, 120, "invalid indexes must not trigger an added quota that skips later source segments");
  } finally {
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("a delivery-ambiguous split failure preserves already translated sibling batches", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let calls = 0;
  globalThis.requestOpenAiCompatibleChat = async (_config, messages) => {
    calls += 1;
    if (calls <= 2) {
      return "not json";
    }
    const userMessage = messages.find(message => message.role === "user");
    const segments = JSON.parse(userMessage.content).segments;
    if (calls === 3) {
      return JSON.stringify({
        items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
      });
    }
    const error = new Error("HTTP 500 after accepting the right split");
    error.status = 500;
    throw error;
  };
  try {
    const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
      Array.from({ length: 4 }, (_, index) => ({
        start: index,
        end: index + 0.5,
        text: `split-${index}`,
        chunkIndex: 0,
        segmentIndex: index
      })),
      { providerType: "openai", baseUrl: "https://llm-partial-ambiguous.example.test/v1", model: "test", apiKey: "test" },
      "zh-CN",
      {}
    );
    assert.equal(calls, 4);
    assert.deepEqual(translated.map(segment => segment.text), ["译文-split-0", "译文-split-1"]);
    assert.deepEqual(
      FuguangBrowserTranslationPipeline.browserTranslationFailures(translated).map(failure => failure.source.text),
      ["split-2", "split-3"]
    );
  } finally {
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});

test("translation provider honors the user's six-worker concurrency", async () => {
  const originalRequest = globalThis.requestOpenAiCompatibleChat;
  let active = 0;
  let maxActive = 0;
  let releaseRequests;
  let signalSixActive;
  const sixActive = new Promise(resolve => {
    signalSixActive = resolve;
  });
  const requestGate = new Promise(resolve => {
    releaseRequests = resolve;
  });
  globalThis.requestOpenAiCompatibleChat = async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (active === 6) {
      signalSixActive();
    }
    await requestGate;
    active -= 1;
    return '{"items":[{"i":0,"text":"你好"}]}';
  };
  try {
    const config = {
      providerType: "openai",
      baseUrl: "https://six-workers.example.test/v1",
      model: "test",
      apiKey: "test"
    };
    const requests = Array.from({ length: 6 }, () => (
      FuguangBrowserTranslationProvider.requestBrowserTranslationItems(
        [{ start: 0, end: 1, text: "hello" }],
        config,
        "zh-CN",
        {},
        { timeoutMs: 1000, maxConcurrency: 6 }
      )
    ));
    await Promise.race([
      sixActive,
      new Promise((_, reject) => setTimeout(() => reject(new Error("six translation requests did not run concurrently")), 250))
    ]);
    assert.equal(maxActive, 6);
    releaseRequests();
    await Promise.all(requests);
  } finally {
    releaseRequests();
    if (originalRequest) {
      globalThis.requestOpenAiCompatibleChat = originalRequest;
    } else {
      delete globalThis.requestOpenAiCompatibleChat;
    }
  }
});
