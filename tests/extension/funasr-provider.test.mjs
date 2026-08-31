import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/background/browser-funasr-provider.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserFunAsrProvider =", "var FuguangBrowserFunAsrProvider =");

const context = vm.createContext({
  console,
  URL,
  Date,
  Map,
  Set,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Promise,
  Blob,
  FormData,
  ArrayBuffer,
  Uint8Array,
  AbortController,
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "" }),
  setTimeout,
  clearTimeout
});

vm.runInContext(source, context, { filename: "browser-funasr-provider.js" });
Object.assign(context, context.FuguangBrowserFunAsrProvider);

{
  assert.equal(context.isDashScopeFunAsrConfig({ providerType: "dashscope_funasr" }), true);
  assert.equal(context.isDashScopeFunAsrConfig({ providerType: "openai" }), false);
  assert.equal(context.dashScopeFunAsrChunkSeconds({ duration: 90 * 60 }), 2 * 60 * 60);
  assert.equal(context.dashScopeFunAsrShouldDiarize({ chunksTotal: 3, duration: 7199 }), true);
  assert.equal(context.dashScopeFunAsrShouldDiarize({ chunksTotal: 3, duration: 3 * 60 * 60 }), true);
  assert.equal(context.dashScopeFunAsrShouldDiarize({ chunksTotal: 4, duration: 7199 }), false);
  assert.equal(context.dashScopeFunAsrShouldDiarize({ chunksTotal: 0, duration: 60 }), false);
}

{
  const parameters = context.buildDashScopeFunAsrParameters(
    {
      model: "fun-asr",
      language: "ja"
    },
    {
      chunksTotal: 2,
      duration: 3600
    }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(parameters)), {
    language_hints: ["ja"],
    diarization_enabled: true
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(parameters, "vocabulary_id"),
    false,
    "Fun-ASR should not expose or send a manual hotword vocabulary id by default"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(parameters, "special_word_filter"),
    false,
    "Fun-ASR should keep DashScope built-in sensitive-word filtering enabled by default"
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.buildDashScopeFunAsrParameters({ language: "zh" }))),
    { language_hints: ["zh"] }
  );
}

{
  const segments = context.normalizeDashScopeFunAsrResult({
    transcripts: [{
      sentences: [
        { begin_time: 1000, end_time: 2200, text: "こんにちは", speaker_id: 0 },
        { begin_time: 2500, end_time: 3600, text: "どうぞ", speaker_id: 1 },
        { begin_time: 7310000, end_time: 7313000, text: "overlap" }
      ]
    }]
  }, {
    index: 1,
    start: 7200,
    end: 10800,
    coreStart: 7200,
    coreEnd: 10800
  }, {
    labelSpeakers: true
  });

  assert.deepEqual(JSON.parse(JSON.stringify(segments)), [
    {
      start: 7201,
      end: 7202.2,
      text: "こんにちは",
      speakerId: 0,
      speakerLabel: "分段 2 · 说话人 1"
    },
    {
      start: 7202.5,
      end: 7203.6,
      text: "どうぞ",
      speakerId: 1,
      speakerLabel: "分段 2 · 说话人 2"
    }
  ]);
}

{
  const segments = context.normalizeDashScopeFunAsrResult({
    transcripts: [{
      sentences: [
        { begin_time: 0, end_time: 500, text: "subsecond" },
        { begin_time: 500, end_time: 1500, text: "crosses one second" },
        { start: 2.5, end: 3.25, text: "seconds fallback" },
        {
          begin_time: null,
          start_time: 4,
          end_time: null,
          end: 5,
          speaker_id: null,
          text: "null fields use fallback"
        }
      ]
    }]
  }, {
    start: 0,
    end: 10,
    coreStart: 0,
    coreEnd: 10
  }, {
    labelSpeakers: true
  });

  assert.deepEqual(JSON.parse(JSON.stringify(segments)), [
    { start: 0, end: 0.5, text: "subsecond" },
    { start: 0.5, end: 1.5, text: "crosses one second" },
    { start: 2.5, end: 3.25, text: "seconds fallback" },
    { start: 4, end: 5, text: "null fields use fallback" }
  ]);
}

{
  const calls = [];
  context.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/uploads?action=getPolicy")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            upload_host: "https://oss-upload.example.test",
            upload_dir: "dashscope/tmp",
            oss_access_key_id: "oss-key",
            signature: "oss-signature",
            policy: "oss-policy"
          }
        })
      };
    }
    if (String(url) === "https://oss-upload.example.test") {
      return { ok: true, text: async () => "" };
    }
    if (String(url).endsWith("/services/audio/asr/transcription")) {
      const payload = JSON.parse(options.body);
      assert.equal(options.headers["X-DashScope-Async"], "enable");
      assert.equal(options.headers["X-DashScope-OssResourceResolve"], "enable");
      assert.deepEqual(payload.input.file_urls, ["oss://dashscope/tmp/audio.mp3"]);
      assert.equal(payload.parameters.diarization_enabled, true);
      assert.equal(Object.prototype.hasOwnProperty.call(payload.parameters, "special_word_filter"), false);
      return {
        ok: true,
        json: async () => ({ output: { task_id: "task-1" } })
      };
    }
    if (String(url).endsWith("/tasks/task-1")) {
      return {
        ok: true,
        json: async () => ({
          output: {
            task_status: "SUCCEEDED",
            results: [{ transcription_url: "https://result.example.test/funasr.json" }]
          }
        })
      };
    }
    if (String(url) === "https://result.example.test/funasr.json") {
      return {
        ok: true,
        json: async () => ({ transcripts: [{ sentences: [{ begin_time: 0, end_time: 500, text: "ok" }] }] })
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const payload = await context.transcribeDashScopeFunAsrFile(
    { name: "audio.mp3", mime: "audio/mpeg", buffer: new Uint8Array([1, 2, 3]).buffer },
    { providerType: "dashscope_funasr", baseUrl: "https://dashscope.aliyuncs.com/api/v1", model: "fun-asr", apiKey: "test-key" },
    { chunksTotal: 1, duration: 60 }
  );
  assert.equal(payload.transcripts[0].sentences[0].text, "ok");
  assert.equal(calls.length, 5);
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, options = {}) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      options.signal?.addEventListener?.("abort", () => {
        const error = new Error("aborted response body");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })
  });
  try {
    const request = context.getDashScopeUploadPolicy(
      { baseUrl: "https://dashscope.aliyuncs.com/api/v1", model: "fun-asr", apiKey: "test-key" },
      { deadlineAt: Date.now() + 20 }
    );
    await assert.rejects(
      Promise.race([
        request,
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Fun-ASR body timeout was not enforced")), 100))
      ]),
      /Fun-ASR 请求超时/
    );
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const calls = [];
  let transportTimeoutMs = null;
  const outcome = await context.cancelDashScopeFunAsrTask(
    "task-pending",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 50,
      requestTransport: async (url, options = {}, requestOptions = {}) => {
        calls.push({ url: String(url), options });
        transportTimeoutMs = requestOptions.timeoutMs;
        return new Response(JSON.stringify({ output: { task_status: "CANCELED" } }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://dashscope.example/api/v1/tasks/task-pending/cancel");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer cancel-secret");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.ok(transportTimeoutMs > 0 && transportTimeoutMs <= 50,
    `FunASR durable transport must inherit the provider deadline, actual ${transportTimeoutMs}`);
  assert.deepEqual(JSON.parse(JSON.stringify(outcome)), {
    status: "confirmed", confirmed: true, taskId: "task-pending", httpStatus: 200,
    remoteTaskStatus: "CANCELED", message: ""
  });
}

{
  let calls = 0;
  const outcome = await context.cancelDashScopeFunAsrTask(
    "task-running",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 50,
      requestTransport: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          code: "InvalidTaskStatus",
          message: "Only PENDING tasks can be canceled",
          output: { task_status: "RUNNING" }
        }), { status: 409, headers: { "content-type": "application/json" } });
      }
    }
  );
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(outcome)), {
    status: "unknown", confirmed: false, taskId: "task-running", httpStatus: 409,
    remoteTaskStatus: "RUNNING", message: "Only PENDING tasks can be canceled"
  });
}

for (const [remoteTaskStatus, expectedStatus] of [
  ["RUNNING", "unknown"],
  ["UNKNOWN", "unknown"],
  ["SUCCEEDED", "not-applied"]
]) {
  const outcome = await context.cancelDashScopeFunAsrTask(
    `task-200-${remoteTaskStatus.toLowerCase()}`,
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 50,
      requestTransport: async () => new Response(JSON.stringify({ output: { task_status: remoteTaskStatus } }), {
        status: 200, headers: { "content-type": "application/json" }
      })
    }
  );
  assert.equal(outcome.status, expectedStatus, `HTTP 200 ${remoteTaskStatus}`);
  assert.equal(outcome.confirmed, false, `HTTP 200 ${remoteTaskStatus}`);
  assert.equal(outcome.remoteTaskStatus, remoteTaskStatus);
}

{
  let calls = 0;
  const outcome = await context.cancelDashScopeFunAsrTask(
    "task-unknown",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 50,
      requestTransport: async () => {
        calls += 1;
        throw new Error("connection reset before cancellation acknowledgement");
      }
    }
  );
  assert.equal(calls, 1, "remote cancellation must never retry automatically");
  assert.deepEqual(JSON.parse(JSON.stringify(outcome)), {
    status: "unknown", confirmed: false, taskId: "task-unknown", httpStatus: 0,
    remoteTaskStatus: "", message: "connection reset before cancellation acknowledgement"
  });
}

{
  let calls = 0;
  const outcome = await context.cancelDashScopeFunAsrTask(
    "task-timeout",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 15,
      requestTransport: async (_url, options = {}) => {
        calls += 1;
        return await new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
        });
      }
    }
  );
  assert.equal(calls, 1, "timed-out remote cancellation must never retry automatically");
  assert.equal(outcome.status, "unknown");
  assert.equal(outcome.confirmed, false);
  assert.equal(outcome.taskId, "task-timeout");
  assert.equal(outcome.httpStatus, 0);
  assert.match(outcome.message, /超时/);
}

{
  let calls = 0;
  const outcome = await context.cancelDashScopeFunAsrTask(
    "task-server-ambiguous",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "cancel-secret" },
    {
      timeoutMs: 50,
      requestTransport: async () => {
        calls += 1;
        return new Response(JSON.stringify({ message: "internal error after dispatch" }), {
          status: 500, headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.equal(calls, 1);
  assert.equal(outcome.status, "unknown", "a 5xx response cannot prove whether cancellation was applied");
  assert.equal(outcome.confirmed, false);
}

{
  const queried = await context.queryDashScopeFunAsrTask(
    "task-running",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "query-secret" },
    {
      timeoutMs: 50,
      requestTransport: async (url, options = {}) => {
        assert.equal(String(url), "https://dashscope.example/api/v1/tasks/task-running");
        assert.equal(options.method, "GET");
        assert.equal(options.headers.Authorization, "Bearer query-secret");
        return new Response(JSON.stringify({ output: { task_id: "task-running", task_status: "RUNNING" } }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(queried)), {
    known: true, taskId: "task-running", taskStatus: "RUNNING", httpStatus: 200, message: ""
  });
}

for (const [label, responseFactory] of [
  ["empty body", () => new Response("", { status: 200, headers: { "content-type": "application/json" } })],
  ["malformed body", () => new Response("{not-json", { status: 200, headers: { "content-type": "application/json" } })],
  ["missing task_status", () => new Response(JSON.stringify({ output: { task_id: "task-ambiguous" } }), {
    status: 200, headers: { "content-type": "application/json" }
  })]
]) {
  const queried = await context.queryDashScopeFunAsrTask(
    "task-ambiguous",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "query-secret" },
    { timeoutMs: 50, requestTransport: async () => responseFactory() }
  );
  assert.equal(queried.known, false, `HTTP 200 with ${label} must remain ambiguous`);
  assert.equal(queried.taskStatus, "");
  assert.match(queried.message, /no supported task_status/);
}

{
  const queried = await context.queryDashScopeFunAsrTask(
    "task-query-timeout",
    { baseUrl: "https://dashscope.example/api/v1", apiKey: "query-secret" },
    {
      timeoutMs: 10,
      requestTransport: async (_url, options = {}) => await new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      })
    }
  );
  assert.equal(queried.known, false);
  assert.equal(queried.taskStatus, "");
  assert.match(queried.message, /超时/);
}

{
  const originalFetch = context.fetch;
  const calls = [];
  context.fetch = async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).includes("/uploads?action=getPolicy")) {
      await new Promise(resolve => setTimeout(resolve, 25));
      return {
        ok: true,
        json: async () => ({
          data: {
            upload_host: "https://oss-upload.example.test",
            upload_dir: "dashscope/tmp",
            oss_access_key_id: "oss-key",
            signature: "oss-signature",
            policy: "oss-policy"
          }
        })
      };
    }
    if (String(url) === "https://oss-upload.example.test") {
      return { ok: true, text: async () => "" };
    }
    if (String(url).endsWith("/services/audio/asr/transcription")) {
      return { ok: true, json: async () => ({ output: { task_id: "task-delayed-upload" } }) };
    }
    if (String(url).endsWith("/tasks/task-delayed-upload")) {
      return {
        ok: true,
        json: async () => ({
          output: {
            task_status: "SUCCEEDED",
            results: [{ transcription_url: "https://result.example.test/delayed.json" }]
          }
        })
      };
    }
    if (String(url) === "https://result.example.test/delayed.json") {
      return { ok: true, json: async () => ({ transcripts: [{ sentences: [] }] }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const payload = await context.transcribeDashScopeFunAsrFile(
      { name: "audio.mp3", mime: "audio/mpeg", buffer: new Uint8Array([1]).buffer },
      {
        providerType: "dashscope_funasr",
        baseUrl: "https://dashscope.aliyuncs.com/api/v1",
        model: "fun-asr",
        apiKey: "test-key",
        timeoutMs: 1
      },
      { chunksTotal: 1, duration: 60 }
    );
    assert.equal(Array.isArray(payload.transcripts), true);
    assert.equal(calls.length, 5, "upload time must not consume the post-submit polling timeout");
  } finally {
    context.fetch = originalFetch;
  }
}
