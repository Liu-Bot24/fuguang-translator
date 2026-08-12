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
