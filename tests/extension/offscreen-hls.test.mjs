import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function testDomainsFromUrls(urls) {
  const domains = new Set();
  for (const url of Array.isArray(urls) ? urls : [urls]) {
    try {
      const parsed = new URL(String(url || ""));
      if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) {
        domains.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed test inputs.
    }
  }
  return [...domains].sort();
}

const chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    getURL: path => `chrome-extension://fuguang-test/${path}`,
    sendMessage: async message => ({ domains: testDomainsFromUrls(message?.urls) })
  }
};

const node = {
  appendChild: () => {},
  remove: () => {},
  setAttribute: () => {},
  addEventListener: () => {},
  scrollTop: 0,
  scrollHeight: 0,
  textContent: ""
};

const context = vm.createContext({
  chrome,
  console,
  URL,
  Map,
  Set,
  String,
  Number,
  Boolean,
  Math,
  TextEncoder,
  document: {
    body: node,
    createElement: () => ({ ...node }),
    querySelector: () => ({ ...node })
  },
  window: {
    addEventListener: () => {},
    parent: { postMessage: () => {} },
    opener: null
  }
});

function loadSharedModule(path, exportName) {
  const sharedSource = fs.readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(`export const ${exportName} =`, `var ${exportName} =`);
  vm.runInContext(sharedSource, context, { filename: path });
  return context[exportName];
}

loadSharedModule("../../extension/src/shared/dash-manifest-parser.js", "FuguangDashManifestParser");
loadSharedModule("../../extension/src/shared/hls-url-helpers.js", "FuguangHlsUrlHelpers");

const source = fs.readFileSync(new URL("../../extension/src/offscreen/offscreen.js", import.meta.url), "utf8");

{
  assert.equal(source.includes("OFFSCREEN_START_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_STOP_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_REALTIME"), false);
  assert.equal(source.includes("getUserMedia"), false);
  assert.equal(source.includes("WebSocket"), false);
}

vm.runInContext(source, context, { filename: "offscreen.js" });

{
  assert.equal(context.normalizeHlsLogicalChunkSeconds(7200), 1800);
  assert.equal(context.normalizeHlsLogicalChunkSeconds(7200, { longFile: true }), 7200);
}

{
  assert.equal(context.normalizeWebFfmpegPerformanceMode("auto"), "auto");
  assert.equal(context.normalizeWebFfmpegPerformanceMode("stable"), "stable");
  assert.equal(context.normalizeWebFfmpegPerformanceMode("fast"), "fast");
  assert.equal(context.normalizeWebFfmpegPerformanceMode("turbo"), "auto");
  assert.equal(context.hlsWebFfmpegRecycleBaseLimit("auto"), 40);
  assert.equal(context.hlsWebFfmpegRecycleBaseLimit("stable"), 24);
  assert.ok(context.hlsWebFfmpegRecycleBaseLimit("fast") > 48);
  const autoPolicy = context.createHlsWebFfmpegRecyclePolicy("auto");
  assert.equal(autoPolicy.shouldRecycleBefore(39), false);
  assert.equal(autoPolicy.shouldRecycleBefore(40), true);
  autoPolicy.noteFfmpegFailure();
  assert.equal(autoPolicy.limit, 24);
  assert.equal(autoPolicy.shouldRecycleBefore(24), true);
}

{
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const cachedBuffer = Uint8Array.from([7, 8, 9]).buffer;
  const cache = new Map([
    ["https://fuguang.local/audio/logical.mp3", { arrayBuffer: async () => cachedBuffer }]
  ]);
  let captured = null;
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      match: async key => cache.get(String(key)),
      put: async (key, response) => { cache.set(String(key), response); },
      delete: async key => cache.delete(String(key))
    })
  };
  context.requestWebFfmpeg = async (payload, transfer) => {
    captured = { payload, transfer };
    return { chunks: [], bytes: 0 };
  };
  await context.collectSpeechAudioWithWebFfmpeg({
    webFfmpegUrl: "chrome-extension://fuguang-test/web-ffmpeg/index.html",
    file: {
      name: "logical.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/logical.mp3"
    },
    speechIntervals: [{ start: 1, end: 2 }],
    duration: 3,
    maxChunkSeconds: 30
  });
  assert.equal(captured.payload.file.buffer instanceof ArrayBuffer, true);
  assert.equal(captured.payload.file.buffer.byteLength, 3);
  assert.equal(captured.transfer.length, 1);
  assert.equal(captured.transfer[0].byteLength, 3);
  context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
  context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
  context.requestWebFfmpeg = originalRequestWebFfmpeg;
  context.caches = originalCaches;
  context.Response = originalResponse;
}

{
  const url = context.normalizeWebFfmpegUrl("chrome-extension://fuguang-test/web-ffmpeg/index.html");
  assert.equal(url, "chrome-extension://fuguang-test/web-ffmpeg/index.html?fgv=20260528-hls-cmaf-allowed-extensions");
  assert.throws(
    () => context.normalizeWebFfmpegUrl("https://ffmpeg.example.test/index.html"),
    /Web FFmpeg 必须使用扩展内置页面/
  );
}

{
  const master = context.parseHlsMasterPlaylist(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=64000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080
video-low-bandwidth.m3u8
#EXT-X-STREAM-INF:CODECS="mp4a.40.2"
audio-stream-inf.m3u8
`, "https://cdn.example.test/master.m3u8");
  const audio = master.variants.find(variant => variant.url.endsWith("/audio-stream-inf.m3u8"));
  const chosen = context.chooseHlsVariantForAsr(master.variants);
  assert.equal(audio.audioOnly, true);
  assert.equal(chosen.url, "https://cdn.example.test/audio-stream-inf.m3u8");
}

{
  const originalFetch = context.fetch;
  const started = [];
  const resolvers = new Map();
  context.fetch = async url => {
    const href = String(url);
    const label = href.includes("init.mp4")
      ? "map"
      : href.includes("key.bin")
        ? "key"
        : href.includes("seg-000.m4s")
          ? "segment"
          : "other";
    started.push(label);
    return await new Promise(resolve => {
      resolvers.set(label, () => resolve({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        text: async () => "",
        headers: { get: () => "application/octet-stream" }
      }));
    });
  };
  const groupResourcePromise = context.downloadHlsGroupResources({
    segments: [{
      url: "https://cdn.example.test/seg-000.m4s",
      byteRange: null,
      map: { id: "map-0", url: "https://cdn.example.test/init.mp4", byteRange: null },
      key: { id: "key-0", uri: "https://cdn.example.test/key.bin" }
    }]
  }, {}, 0, () => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual([...new Set(started)].sort(), ["key", "map", "segment"]);
  for (const resolve of resolvers.values()) {
    resolve();
  }
  const resources = await groupResourcePromise;
  assert.equal(resources.mapFiles.length, 1);
  assert.equal(resources.keyFiles.length, 1);
  assert.equal(resources.segmentDownloads.length, 1);
  context.fetch = originalFetch;
}

{
  const headers = context.normalizeRequestHeaders([
    { name: "Referer", value: "https://example.test/" },
    { name: "Origin", value: "https://example.test" },
    { name: "Sec-Fetch-Site", value: "same-site" },
    { name: "User-Agent", value: "Chrome" },
    { name: "Cookie", value: "sid=secret" },
    { name: "Authorization", value: "Bearer media-token" },
    { name: "Accept", value: "*/*" },
    { name: "Range", value: "bytes=0-1023" },
    { name: "If-Range", value: "\"etag\"" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(headers)), {
    Authorization: "Bearer media-token",
    Accept: "*/*"
  });

  const fetchOptions = context.buildMediaFetchOptions({
    requestHeaders: {
      authorization: "Bearer media-token",
      cookie: "sid=secret",
      referer: "https://example.test/",
      origin: "https://example.test",
      "user-agent": "Chrome",
      range: "bytes=0-1023",
      "if-range": "\"etag\""
    }
  });
  assert.equal(fetchOptions.credentials, "include");
  assert.deepEqual(JSON.parse(JSON.stringify(fetchOptions.headers)), {
    authorization: "Bearer media-token"
  });

  const rangedFetchOptions = context.buildFetchOptionsWithByteRange(fetchOptions, { offset: 1024, length: 512 });
  assert.equal(rangedFetchOptions.credentials, "include");
  assert.deepEqual(JSON.parse(JSON.stringify(rangedFetchOptions.headers)), {
    authorization: "Bearer media-token",
    Range: "bytes=1024-1535"
  });

  const unchangedFetchOptions = context.buildFetchOptionsWithByteRange(fetchOptions, null);
  assert.equal(unchangedFetchOptions, fetchOptions);
}

{
  assert.equal(context.isFetchableMediaSourceUrl("https://cdn.example.test/video.mp4"), true);
  assert.equal(context.isFetchableMediaSourceUrl("http://127.0.0.1/video.mp4"), true);
  assert.equal(context.isFetchableMediaSourceUrl("file:///Volumes/share/video-without-extension-whitelist.rm"), true);
  assert.equal(context.isFetchableMediaSourceUrl("file://SERVER/Share/Video/local.flv"), true);
  assert.equal(context.isFetchableMediaSourceUrl("ftp://media.example.test/video.mp4"), false);
}

{
  const originalFetch = context.fetch;
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const cache = new Map();
  const requests = [];
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.fetch = async () => ({
    ok: true,
    headers: { get: () => "video/mp4" },
    arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context)
  });
  context.requestWebFfmpeg = async payload => {
    requests.push(JSON.parse(JSON.stringify({
      type: payload.type,
      options: payload.options
    })));
    return {
      chunks: [
        {
          index: 0,
          start: 0,
          end: 32,
          duration: 32,
          coreStart: 0,
          coreEnd: 30,
          coreDuration: 30,
          file: {
            name: "direct-000.mp3",
            mime: "audio/mpeg",
            buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
          },
          bytes: 2
        },
        {
          index: 1,
          start: 28,
          end: 62,
          duration: 34,
          coreStart: 30,
          coreEnd: 60,
          coreDuration: 30,
          file: {
            name: "direct-001.mp3",
            mime: "audio/mpeg",
            buffer: vm.runInContext("new Uint8Array([9, 10, 11]).buffer", context)
          },
          bytes: 3
        }
      ],
      bytes: 5,
      duration: 65,
      chunkSeconds: 30,
      chunkOverlapSeconds: 2,
      sourceType: "direct"
    };
  };

  try {
    const result = await context.extractAudioWithWebFfmpeg({
      sourceUrl: "https://cdn.example.test/video.mp4",
      cacheNamespace: "direct-overlap-test",
      asrChunkSeconds: 30,
      duration: 65
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].type, "extract-audio");
    assert.equal(requests[0].options.chunkSeconds, 30);
    assert.equal(requests[0].options.overlapSeconds, 2);
    assert.equal(result.sourceType, "direct");
    assert.equal(result.chunks.length, 2);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.chunks.map(chunk => ({
        start: chunk.start,
        end: chunk.end,
        coreStart: chunk.coreStart,
        coreEnd: chunk.coreEnd
      })))),
      [
        { start: 0, end: 32, coreStart: 0, coreEnd: 30 },
        { start: 28, end: 62, coreStart: 30, coreEnd: 60 }
      ]
    );
    assert.equal(result.chunks.every(chunk => chunk.file.cacheUrl.includes("__fuguang_audio_cache")), true);
  } finally {
    context.fetch = originalFetch;
    context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
    context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const originalFetch = context.fetch;
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const cache = new Map();
  let fetchedUrl = "";
  let captured = null;
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.fetch = async url => {
    fetchedUrl = String(url);
    return {
      ok: false,
      status: 0,
      headers: { get: name => String(name || "").toLowerCase() === "content-type" ? "video/x-flv" : "" },
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3, 4]).buffer", context)
    };
  };
  context.requestWebFfmpeg = async (payload, transfer) => {
    captured = { payload, transfer };
    return {
      chunks: [{
        index: 0,
        start: 0,
        end: 10,
        duration: 10,
        coreStart: 0,
        coreEnd: 10,
        coreDuration: 10,
        file: {
          name: "local-000.mp3",
          mime: "audio/mpeg",
          buffer: vm.runInContext("new Uint8Array([9, 9]).buffer", context)
        },
        bytes: 2
      }],
      bytes: 2,
      duration: 10,
      sourceType: "direct"
    };
  };

  try {
    const localUrl = "file:///Volumes/share/video-without-extension-whitelist.flv";
    const result = await context.extractAudioWithWebFfmpeg({
      sourceUrl: localUrl,
      fileName: "video-without-extension-whitelist.flv",
      cacheNamespace: "local-file-direct-test",
      asrChunkSeconds: 30,
      duration: 10
    });
    assert.equal(fetchedUrl, localUrl);
    assert.equal(captured.payload.file.name, "video-without-extension-whitelist.flv");
    assert.equal(captured.payload.file.mime, "video/x-flv");
    assert.equal(captured.payload.file.buffer.byteLength, 4);
    assert.equal(captured.transfer.length, 1);
    assert.equal(result.sourceType, "direct");
    assert.equal(result.chunks.length, 1);
    assert.equal(result.chunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
  } finally {
    context.fetch = originalFetch;
    context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
    context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const originalFetch = context.fetch;
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const cache = new Map();
  const fetchedUrls = [];
  let captured = null;
  const buffers = new Map([
    ["https://cdn.example.test/audio/init.mp4", [1, 2]],
    ["https://cdn.example.test/audio/seg-00001.m4s", [3, 4, 5]],
    ["https://cdn.example.test/audio/seg-00002.m4s", [6, 7]]
  ]);
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.fetch = async url => {
    const href = String(url);
    fetchedUrls.push(href);
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/iso.segment" },
      arrayBuffer: async () => Uint8Array.from(buffers.get(href) || []).buffer
    };
  };
  context.requestWebFfmpeg = async (payload, transfer) => {
    captured = { payload, transfer };
    return {
      file: {
        name: "mse-audio.mp3",
        mime: "audio/mpeg",
        buffer: vm.runInContext("new Uint8Array([255, 251, 1, 2]).buffer", context)
      },
      bytes: 4,
      speechIntervals: [{ start: 0.5, end: 2 }],
      speechIntervalsReliable: false
    };
  };

  try {
    const result = await context.extractAudioWithWebFfmpeg({
      sourceUrl: "https://cdn.example.test/audio/seg-00001.m4s",
      kind: "mse-fragments",
      ext: "m4s",
      cacheNamespace: "mse-fragment-test",
      asrChunkSeconds: 30,
      duration: 8,
      mseFragments: [
        { url: "https://cdn.example.test/audio/init.mp4", segmentType: "init" },
        { url: "https://cdn.example.test/audio/seg-00001.m4s", segmentType: "media" },
        { url: "https://cdn.example.test/audio/seg-00002.m4s", segmentType: "media" }
      ]
    });
    assert.deepEqual(fetchedUrls, [
      "https://cdn.example.test/audio/init.mp4",
      "https://cdn.example.test/audio/seg-00001.m4s",
      "https://cdn.example.test/audio/seg-00002.m4s"
    ]);
    assert.equal(captured.payload.type, "extract-audio");
    assert.equal(captured.payload.file.name, "mse-fragments.m4a");
    assert.deepEqual(Array.from(new Uint8Array(captured.payload.file.buffer)), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(captured.transfer.length, 1);
    assert.equal(captured.payload.options.chunkSeconds, 30);
    assert.equal(captured.payload.options.duration, 8);
    assert.equal(result.sourceType, "mse-fragments");
    assert.equal(result.file.cacheUrl.includes("__fuguang_audio_cache"), true);
  } finally {
    context.fetch = originalFetch;
    context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
    context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const originalFetch = context.fetch;
  const requests = [];
  const fullBody = Uint8Array.from([10, 11, 12, 13, 14, 15, 16, 17]).buffer;
  context.fetch = async (_url, options) => {
    requests.push(JSON.parse(JSON.stringify(options.headers)));
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/mp4" },
      arrayBuffer: async () => fullBody
    };
  };

  try {
    const buffer = await context.fetchBinary(
      "https://cdn.example.test/media.mp4",
      { headers: { Authorization: "Bearer media-token" }, credentials: "include" },
      { offset: 2, length: 3 }
    );
    assert.deepEqual(Array.from(new Uint8Array(buffer)), [12, 13, 14]);
    assert.deepEqual(requests, [{ Authorization: "Bearer media-token", Range: "bytes=2-4" }]);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalFetch = context.fetch;
  let attempts = 0;
  context.fetch = async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error("Failed to fetch");
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/mp4" },
      arrayBuffer: async () => Uint8Array.from([21, 22]).buffer
    };
  };

  try {
    const buffer = await context.fetchBinary("https://cdn.example.test/retry.mp4", {});
    assert.equal(attempts, 3);
    assert.deepEqual(Array.from(new Uint8Array(buffer)), [21, 22]);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalFetch = context.fetch;
  let attempts = 0;
  context.fetch = async () => {
    attempts += 1;
    return {
      ok: false,
      status: 404,
      headers: { get: () => "text/plain" },
      arrayBuffer: async () => Uint8Array.from([]).buffer
    };
  };

  try {
    await assert.rejects(
      () => context.fetchBinary("https://cdn.example.test/missing.mp4", {}),
      /HTTP 404/
    );
    assert.equal(attempts, 1);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "video/mp4" },
    arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
  });

  try {
    await assert.rejects(
      () => context.fetchBinary("https://cdn.example.test/media.mp4", {}, { offset: 8, length: 4 }),
      /Range|字节范围/
    );
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-KEY:METHOD=AES-128,URI="keys/audio.key",IV=0x00000000000000000000000000000001
#EXTINF:5.000,
seg-000.ts
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.unsupportedEncryption, "");
  assert.equal(media.segments.length, 1);
  assert.equal(media.segments[0].key.uri, "https://cdn.example.test/path/keys/audio.key");

  const local = context.buildLocalHlsPlaylist(
    [{ ...media.segments[0], name: "seg-000.ts" }],
    "",
    new Map([[media.segments[0].key.id, "key-0.key"]])
  );
  assert.match(local, /#EXT-X-KEY:METHOD=AES-128,URI="key-0\.key",IV=0x00000000000000000000000000000001/);
  assert.match(local, /seg-000\.ts/);
}

{
  const playlist = `#EXTM3U
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"
#EXTINF:5.000,
seg-000.ts`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.unsupportedEncryption, "SAMPLE-AES");
}

{
  const first = vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context);
  const second = vm.runInContext("new Uint8Array([4, 5]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 7,
    media: { mapUrl: "" },
    keyFiles: [],
    playlistSegments: [
      { duration: 4, name: "seg-000.ts" },
      { duration: 4, name: "seg-001.ts" }
    ],
    segmentBuffers: [first, second],
    initName: "",
    keyNames: new Map()
  });
  assert.equal(input.inputName, "input-7.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.equal(input.files.length, 1);
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.match(playlist, /seg-000\.ts/);
  assert.match(playlist, /seg-001\.ts/);
}

{
  const first = vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context);
  const second = vm.runInContext("new Uint8Array([4, 5]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 7,
    media: { mapUrl: "", allowUnsafeTransportConcat: true },
    keyFiles: [],
    playlistSegments: [],
    segmentBuffers: [first, second],
    initName: "",
    keyNames: new Map()
  });
  assert.equal(input.inputName, "input-7.ts");
  assert.equal(input.inputKind, "transport-stream");
  assert.deepEqual([...new Uint8Array(input.files[0].buffer)], [1, 2, 3, 4, 5]);
}

{
  const segmentBuffer = vm.runInContext("new Uint8Array([9]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 8,
    media: { mapUrl: "" },
    keyFiles: [],
    playlistSegments: [{ duration: 4, name: "seg-000.ts" }],
    segmentBuffers: [segmentBuffer],
    initName: "",
    keyNames: new Map(),
    forcePlaylist: true
  });
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.equal(input.inputName, "input-8.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.match(playlist, /seg-000\.ts/);
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const requests = [];
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cache.set(url, response);
      },
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const text = `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXTINF:4.000,
seg-000.ts
#EXTINF:4.000,
seg-001.ts
#EXT-X-ENDLIST`;
    if (String(url).endsWith(".m3u8")) {
      return {
        ok: true,
        text: async () => text,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => {
    requests.push(payload);
    if (payload.inputName === "input-0.ts") {
      throw new Error("simulated transport stream failure");
    }
    assert.equal(payload.inputName, "input-0.m3u8");
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
      },
      bytes: 2
    };
  };

  try {
    const result = await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-fallback-test",
      sourceUrl: "https://cdn.example.test/video.m3u8",
      cacheNamespace: "hls-fallback-test",
      asrChunkSeconds: 900
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].inputName, "input-0.ts");
    assert.equal(requests[1].inputName, "input-0.m3u8");
    assert.equal(result.chunks.length, 1);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalReloadWebFfmpegFrame = context.reloadWebFfmpegFrame;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const requests = [];
  const segmentBuffers = [];
  const fetchCounts = { key: 0, segment: 0 };
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cache.set(url, response);
      },
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const text = `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-KEY:METHOD=AES-128,URI="audio.key",IV=0x00000000000000000000000000000001
#EXTINF:4.000,
seg-000.cmfa
#EXT-X-ENDLIST`;
    if (String(url).endsWith(".m3u8")) {
      return {
        ok: true,
        text: async () => text,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (String(url).endsWith(".key")) {
      fetchCounts.key += 1;
      return {
        ok: true,
        text: async () => "",
        arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).buffer", context),
        headers: { get: () => "application/octet-stream" }
      };
    }
    fetchCounts.segment += 1;
    return {
      ok: true,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext(`new Uint8Array([${fetchCounts.segment}, 2, 3]).buffer`, context),
      headers: { get: () => "audio/mp4" }
    };
  };
  context.reloadWebFfmpegFrame = async () => {};
  context.requestWebFfmpeg = async payload => {
    requests.push(payload);
    assert.equal(payload.inputName, "input-0.m3u8");
    const segmentFile = payload.files.find(file => String(file.name).endsWith(".cmfa"));
    assert.ok(segmentFile);
    segmentBuffers.push(segmentFile.buffer);
    if (requests.length === 1) {
      throw new Error("simulated playlist failure");
    }
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
      },
      bytes: 2
    };
  };

  try {
    const result = await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-playlist-retry-test",
      sourceUrl: "https://cdn.example.test/audio.m3u8",
      cacheNamespace: "hls-playlist-retry-test",
      asrChunkSeconds: 900,
      webFfmpegUrl: "chrome-extension://fuguang-test/web-ffmpeg/index.html"
    });
    assert.equal(requests.length, 2);
    assert.notEqual(segmentBuffers[0], segmentBuffers[1]);
    assert.equal(fetchCounts.segment, 2);
    assert.equal(fetchCounts.key, 2);
    assert.equal(result.chunks.length, 1);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.reloadWebFfmpegFrame = originalReloadWebFfmpegFrame;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalReloadWebFfmpegFrame = context.reloadWebFfmpegFrame;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const requests = [];
  const reloads = [];
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cache.set(url, response);
      },
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    if (String(url).endsWith(".m3u8")) {
      const lines = ["#EXTM3U", "#EXT-X-TARGETDURATION:180"];
      for (let index = 0; index < 50; index += 1) {
        lines.push("#EXTINF:180.000,", `seg-${String(index).padStart(3, "0")}.ts`);
      }
      lines.push("#EXT-X-ENDLIST");
      return {
        ok: true,
        text: async () => lines.join("\n"),
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp2t" }
    };
  };
  context.reloadWebFfmpegFrame = async url => {
    reloads.push({ url, requestsSeen: requests.length });
  };
  context.requestWebFfmpeg = async payload => {
    if (payload.type === "extract-audio" && /^chunk-\d+\.mp3$/.test(String(payload.outputName || ""))) {
      requests.push(payload.outputName);
    }
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
      },
      bytes: 2
    };
  };

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-recycle-before-aging-test",
      sourceUrl: "https://cdn.example.test/long-video.m3u8",
      cacheNamespace: "hls-recycle-before-aging-test",
      asrChunkSeconds: 7200,
      webFfmpegUrl: "chrome-extension://fuguang-test/web-ffmpeg/index.html",
      longFileAsr: true
    });
    const chunk48RequestIndex = requests.indexOf("chunk-048.mp3");
    assert.equal(chunk48RequestIndex, 47);
    assert.ok(
      reloads.some(reload => reload.requestsSeen <= chunk48RequestIndex),
      "Web FFmpeg should be recycled before starting the 48th internal HLS chunk"
    );
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.reloadWebFfmpegFrame = originalReloadWebFfmpegFrame;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const segmentBuffer = vm.runInContext("new Uint8Array([1]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 2,
    media: { mapUrl: "https://cdn.example.test/init.mp4" },
    keyFiles: [],
    playlistSegments: [{ duration: 4, name: "seg-000.m4s" }],
    segmentBuffers: [segmentBuffer],
    initName: "init-2.mp4",
    keyNames: new Map()
  });
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.equal(input.inputName, "input-2.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.match(playlist, /#EXT-X-MAP:URI="init-2\.mp4"/);
  assert.match(playlist, /seg-000\.m4s/);
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const fetched = [];
  const cache = new Map();
  const mpdUrl = "https://cdn.example.test/manifest/generic.mpd";
  const audioInit = "https://cdn.example.test/manifest/audio/init.mp4";
  const audioSeg1 = "https://cdn.example.test/manifest/audio/seg-1.m4s";
  const audioSeg2 = "https://cdn.example.test/manifest/audio/seg-2.m4s";
  const videoSeg1 = "https://cdn.example.test/manifest/video/seg-1.m4s";
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.fetch = async url => {
    const href = String(url);
    fetched.push(href);
    if (href === mpdUrl) {
      return {
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="PT10S" type="static">
  <Period>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" codecs="mp4a.40.2">
      <Representation id="audio-128k" bandwidth="128000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init.mp4" media="seg-$Number$.m4s" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="video/mp4" contentType="video" codecs="avc1.64001f">
      <Representation id="video-720p" bandwidth="1200000">
        <BaseURL>video/</BaseURL>
        <SegmentTemplate initialization="init.mp4" media="seg-$Number$.m4s" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/dash+xml" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
    },
    bytes: 2
  });

  try {
    const result = await context.extractAudioWithWebFfmpeg({
      tabId: 9,
      jobId: "dash-audio-extraction-test",
      sourceUrl: mpdUrl,
      kind: "dash",
      ext: "mpd",
      cacheNamespace: "dash-audio-extraction-test",
      asrChunkSeconds: 900,
      duration: 10
    });

    assert.equal(result.sourceType, "dash");
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
    context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }

  assert.ok(fetched.includes(audioInit), "DASH audio init segment should be downloaded");
  assert.ok(fetched.includes(audioSeg1), "first DASH audio media segment should be downloaded");
  assert.ok(fetched.includes(audioSeg2), "second DASH audio media segment should be downloaded");
  assert.equal(fetched.includes(videoSeg1), false, "DASH video segments must not be downloaded for ASR");
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalEnsureWebFfmpegFrame = context.ensureWebFfmpegFrame;
  const originalWarmWebFfmpegFrame = context.warmWebFfmpegFrame;
  const mpdUrl = "https://cdn.example.test/manifest/webm-opus.mpd";
  let ffmpegRequested = false;
  context.ensureWebFfmpegFrame = async () => {};
  context.warmWebFfmpegFrame = () => {};
  context.fetch = async url => {
    const href = String(url);
    if (href === mpdUrl) {
      return {
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="PT10S" type="static">
  <Period>
    <AdaptationSet mimeType="audio/webm" contentType="audio" codecs="opus">
      <Representation id="audio-opus" bandwidth="96000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init.webm" media="seg-$Number$.webm" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/dash+xml" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "audio/webm" }
    };
  };
  context.requestWebFfmpeg = async () => {
    ffmpegRequested = true;
    throw new Error("Web FFmpeg should not receive DASH WebM/Opus fragments");
  };

  try {
    await assert.rejects(
      context.extractAudioWithWebFfmpeg({
        tabId: 9,
        jobId: "dash-webm-opus-rejected-test",
        sourceUrl: mpdUrl,
        kind: "dash",
        ext: "mpd",
        cacheNamespace: "dash-webm-opus-rejected-test",
        asrChunkSeconds: 900,
        duration: 10
      }),
      /DASH WebM\/Opus/
    );
    assert.equal(ffmpegRequested, false);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.ensureWebFfmpegFrame = originalEnsureWebFfmpegFrame;
    context.warmWebFfmpegFrame = originalWarmWebFfmpegFrame;
  }
}

{
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "" }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true }, []), true);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", segments: [{ url: "https://cdn.example.test/0.ts" }] }, []), true);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "https://cdn.example.test/init.mp4" }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true }, [{ name: "key.key" }]), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true, segments: [{ discontinuityBefore: true }] }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true, segments: [{ byteRange: { offset: 0, length: 100 } }] }, []), false);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [] }), 60);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [{ url: "https://cdn.example.test/0.ts" }] }), 360);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "https://cdn.example.test/init.mp4", segments: [] }), 60);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [{ key: { id: "key" } }] }), 60);
}

{
  const tinySegments = Array.from({ length: 720 }, (_, index) => ({
    start: index * 0.5,
    end: (index + 1) * 0.5,
    duration: 0.5,
    url: `https://cdn.example.test/tiny-${index}.ts`
  }));
  const groups = context.groupHlsSegments(tinySegments, {
    maxDurationSeconds: 180,
    maxSegments: context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: tinySegments })
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].segments.length, 360);
  assert.equal(groups[0].end, 180);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/seg-${index}.ts`
  }));
  const extractGroups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 180,
    maxSegments: 60
  });
  assert.equal(extractGroups.length, 4);
  assert.equal(extractGroups[0].segments.length, 45);
  assert.equal(extractGroups[0].end, 180);
  assert.equal(extractGroups[3].segments.length, 15);

  const overlapped = context.addHlsAsrContextOverlapToGroups(extractGroups, segments, 8);
  assert.equal(overlapped[0].start, 0);
  assert.equal(overlapped[0].coreStart, 0);
  assert.equal(overlapped[0].coreEnd, 180);
  assert.equal(overlapped[0].end, 188);
  assert.equal(overlapped[1].start, 172);
  assert.equal(overlapped[1].coreStart, 180);
  assert.equal(overlapped[1].coreEnd, 360);
  assert.equal(overlapped[1].end, 368);

  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of extractGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `extract-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(state.logicalChunkSeconds, 900);
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups.at(-1).at(-1).end, 600);
  assert.equal(logicalPartGroups.reduce((sum, group) => sum + group.reduce((inner, part) => inner + part.bytes, 0), 0), 4096);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/long-window-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 900);
  assert.equal(internalGroups.length, 4);
  assert.equal(internalGroups[0].start, 0);
  assert.equal(internalGroups[0].coreStart, 0);
  assert.equal(internalGroups[0].coreEnd, 180);
  assert.equal(internalGroups[0].end, 180);
  assert.equal(internalGroups[1].start, 180);
  assert.equal(internalGroups[1].coreStart, 180);
  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `long-window-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/long-window-${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0].length, 4);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0][0].coreStart, 0);
  assert.equal(logicalPartGroups[0][0].coreEnd, 180);
  assert.equal(logicalPartGroups[0][1].start, 180);
  assert.equal(logicalPartGroups.at(-1).at(-1).end, 600);
  assert.equal(logicalPartGroups.at(-1).at(-1).coreEnd, 600);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/compat-vad-window-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 30);
  assert.equal(
    internalGroups.every(group => group.coreEnd - group.coreStart <= 30),
    true,
    "30 秒 ASR 窗口应参与 HLS 内部提取分组，避免先生成长中间 MP3 再二次切窗"
  );
  assert.equal(internalGroups[0].coreStart, 0);
  assert.equal(internalGroups[0].coreEnd <= 30, true);
  assert.equal(internalGroups[1].coreStart < 30, true);
}

{
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalReloadWebFfmpegFrame = context.reloadWebFfmpegFrame;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const cache = new Map();
  const requests = [];
  const reloads = [];
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.requestWebFfmpeg = async payload => {
    requests.push(JSON.parse(JSON.stringify({
      type: payload.type,
      options: payload.options
    })));
    return {
      chunks: [
        {
          index: 0,
          start: 0,
          end: 30,
          duration: 30,
          coreStart: 2,
          coreEnd: 28,
          coreDuration: 26,
          speechIntervalsReliable: false,
          file: {
            name: "asr-000.mp3",
            mime: "audio/mpeg",
            buffer: vm.runInContext("new Uint8Array([1, 2]).buffer", context)
          },
          bytes: 2
        },
        {
          index: 1,
          start: 26,
          end: 56,
          duration: 30,
          coreStart: 28,
          coreEnd: 54,
          coreDuration: 26,
          speechIntervalsReliable: false,
          file: {
            name: "asr-001.mp3",
            mime: "audio/mpeg",
            buffer: vm.runInContext("new Uint8Array([3, 4]).buffer", context)
          },
          bytes: 2
        }
      ]
    };
  };
  context.reloadWebFfmpegFrame = async url => {
    reloads.push(url);
  };

  try {
    const shortEnough = {
      index: 0,
      start: 0,
      end: 28,
      duration: 28,
      coreStart: 0,
      coreEnd: 26,
      file: { name: "short.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/short" }
    };
    assert.equal((await context.splitHlsInternalChunkForAsr({}, shortEnough, 30, 1))[0], shortEnough);

    const split = await context.splitHlsInternalChunkForAsr({
      cacheNamespace: "hls-split-test",
      webFfmpegUrl: "chrome-extension://fuguang-test/web-ffmpeg/index.html"
    }, {
      index: 1,
      start: 178,
      end: 362,
      duration: 184,
      coreStart: 180,
      coreEnd: 360,
      buffer: vm.runInContext("new Uint8Array([9, 8, 7]).buffer", context),
      file: { name: "internal.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/internal" }
    }, 30, 4);

    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], {
      type: "extract-audio",
      options: {
        format: "mp3",
        chunkSeconds: 30,
        overlapSeconds: 2,
        duration: 184,
        coreStart: 2,
        coreEnd: 182
      }
    });
    assert.deepEqual(JSON.parse(JSON.stringify(split.map(chunk => ({
      start: chunk.start,
      end: chunk.end,
      coreStart: chunk.coreStart,
      coreEnd: chunk.coreEnd,
      speechIntervalsReliable: chunk.speechIntervalsReliable
    })))), [
      { start: 178, end: 208, coreStart: 180, coreEnd: 206, speechIntervalsReliable: false },
      { start: 204, end: 234, coreStart: 206, coreEnd: 232, speechIntervalsReliable: false }
    ]);
    assert.equal(split.every(chunk => chunk.file.cacheUrl.includes("__fuguang_audio_cache")), true);
    assert.deepEqual(reloads, ["chrome-extension://fuguang-test/web-ffmpeg/index.html"]);
  } finally {
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.reloadWebFfmpegFrame = originalReloadWebFfmpegFrame;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const segments = Array.from({ length: 1800 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/logical-boundary-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 900);
  assert.equal(internalGroups.length, 10);
  assert.equal(internalGroups[4].coreStart, 720);
  assert.equal(internalGroups[4].coreEnd, 900);
  assert.equal(internalGroups[4].start, 720);
  assert.equal(internalGroups[4].end, 902);
  assert.equal(internalGroups[5].coreStart, 900);
  assert.equal(internalGroups[5].coreEnd, 1080);
  assert.equal(internalGroups[5].start, 898);
  assert.equal(internalGroups[5].end, 1080);

  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `logical-boundary-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/logical-boundary-${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 2);
  assert.equal(logicalPartGroups[0].length, 5);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0].at(-1).end, 902);
  assert.equal(logicalPartGroups[0].at(-1).coreEnd, 900);
  assert.equal(logicalPartGroups[1].length, 5);
  assert.equal(logicalPartGroups[1][0].start, 898);
  assert.equal(logicalPartGroups[1][0].coreStart, 900);
  assert.equal(logicalPartGroups[1].at(-1).end, 1800);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/mergeable-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 900);
  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `mergeable-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/mergeable-${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0].length, 4);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0].at(-1).end, 600);
}

{
  const selected = Array.from({ length: 150 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/cap-${index}.ts`
  }));
  const core = selected.slice(45, 105);
  const capped = context.capOverlappedHlsSegments(selected, core, 60);
  assert.equal(capped.length, 60);
  assert.equal(capped[0], core[0]);
  assert.equal(capped.at(-1), core.at(-1));
}

{
  const concatRequests = [];
  const deletedUrls = [];
  const cacheWrites = [];
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  context.Response = Response;
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cacheWrites.push({
          url,
          contentType: response.headers.get("Content-Type")
        });
      },
      delete: async url => {
        deletedUrls.push(url);
        return true;
      }
    })
  };
  const outputBuffer = vm.runInContext("new Uint8Array([9, 8, 7, 6]).buffer", context);
  context.requestWebFfmpeg = async (payload, transfer, onProgress) => {
    concatRequests.push({
      type: payload.type,
      outputName: payload.outputName,
      files: payload.files.map(file => ({
        name: file.name,
        mime: file.mime,
        bytes: file.buffer.byteLength
      })),
      transferBytes: transfer.map(buffer => buffer.byteLength)
    });
    onProgress?.({ percent: 50, message: "stub concat progress" });
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: outputBuffer
      },
      bytes: outputBuffer.byteLength
    };
  };

  try {
    const firstBuffer = vm.runInContext("new Uint8Array([1, 2]).buffer", context);
    const secondBuffer = vm.runInContext("new Uint8Array([3, 4, 5]).buffer", context);
    const result = await context.buildHlsLogicalAudioChunk(
      { tabId: 1, jobId: "hls-logical-concat-test", cacheNamespace: "hls-logical-concat" },
      0,
      [
        {
          index: 0,
          start: 0,
          end: 180,
          coreStart: 0,
          coreEnd: 180,
          file: {
            name: "internal-0.mp3",
            mime: "audio/mpeg",
            cacheUrl: "https://fuguang.local/audio/internal-0.mp3",
            bytes: firstBuffer.byteLength
          },
          buffer: firstBuffer,
          bytes: firstBuffer.byteLength,
          speechIntervals: [{ start: 1, end: 3 }]
        },
        {
          index: 1,
          start: 180,
          end: 360,
          coreStart: 180,
          coreEnd: 360,
          file: {
            name: "internal-1.mp3",
            mime: "audio/mpeg",
            cacheUrl: "https://fuguang.local/audio/internal-1.mp3",
            bytes: secondBuffer.byteLength
          },
          buffer: secondBuffer,
          bytes: secondBuffer.byteLength,
          speechIntervals: [{ start: 181, end: 183 }]
        }
      ],
      2
    );

    assert.equal(concatRequests.length, 1);
    assert.equal(concatRequests[0].type, "concat-audio");
    assert.equal(concatRequests[0].outputName, "logical-001.mp3");
    assert.deepEqual(Array.from(concatRequests[0].files, file => file.name), [
      "logical-1-part-001.mp3",
      "logical-1-part-002.mp3"
    ]);
    assert.deepEqual(Array.from(concatRequests[0].transferBytes), [2, 3]);
    assert.equal(result.logical, true);
    assert.equal(result.file.name, "logical-001.mp3");
    assert.equal(result.file.parts, undefined);
    assert.equal(result.file.bytes, outputBuffer.byteLength);
    assert.equal(result.internalChunkCount, 2);
    assert.deepEqual(deletedUrls, [
      "https://fuguang.local/audio/internal-0.mp3",
      "https://fuguang.local/audio/internal-1.mp3"
    ]);
    assert.equal(cacheWrites.length, 1);
    assert.match(cacheWrites[0].url, /^https:\/\/fuguang\.local\/__fuguang_audio_cache\/hls-logical-concat-logical-0\//);
    assert.equal(cacheWrites[0].contentType, "audio/mpeg");
  } finally {
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-MAP:URI="init-0.mp4",BYTERANGE="100@0"
#EXTINF:5.000,
seg.mp4
#EXT-X-BYTERANGE:120@100
#EXTINF:5.000,
seg.mp4
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init-1.mp4"
#EXTINF:5.000,
seg-2.m4s
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.segments.length, 3);
  assert.equal(media.segments[0].map.url, "https://cdn.example.test/path/init-0.mp4");
  assert.deepEqual(
    JSON.parse(JSON.stringify(media.segments[1].byteRange)),
    { offset: 100, length: 120, endExclusive: 220 }
  );
  assert.equal(media.segments[2].discontinuityBefore, true);

  const groups = context.groupHlsSegments(media.segments, { maxDurationSeconds: 60, maxSegments: 60 });
  assert.equal(groups.length, 2);

  const mapNames = new Map([
    [media.segments[0].map.id, "map-0.mp4"],
    [media.segments[2].map.id, "map-1.mp4"]
  ]);
  const local = context.buildLocalHlsPlaylist(
    [
      { ...media.segments[0], name: "seg-0.m4s", byteRange: null },
      { ...media.segments[1], name: "seg-1.m4s", byteRange: null },
      { ...media.segments[2], name: "seg-2.m4s", byteRange: null }
    ],
    "",
    new Map(),
    mapNames
  );
  assert.match(local, /#EXT-X-MAP:URI="map-0\.mp4"/);
  assert.match(local, /#EXT-X-DISCONTINUITY/);
  assert.match(local, /#EXT-X-MAP:URI="map-1\.mp4"/);
}

{
  const playlist = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://key-cdn.example.test/key.bin"
#EXT-X-MAP:URI="https://map-cdn.example.test/init.mp4"
#EXTINF:5.000,
https://segment-cdn.example.test/seg-000.m4s
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.deepEqual(JSON.parse(JSON.stringify(context.hlsMediaHeaderRuleUrls(media))), [
    "https://key-cdn.example.test/key.bin",
    "https://map-cdn.example.test/init.mp4",
    "https://segment-cdn.example.test/seg-000.m4s"
  ]);
}

{
  const sent = [];
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return { ok: true, domains: testDomainsFromUrls(message.urls) };
  };

  try {
    await context.updateMediaHeaderRuleDomains({ jobId: "hls-header-test" }, [
      "https://cdn.example.test/master.m3u8",
      "https://cdn.example.test/master.m3u8",
      "https://segment-cdn.example.test/seg.ts"
    ]);
    await context.updateMediaHeaderRuleDomains({}, ["https://ignored.example.test/seg.ts"]);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }

  assert.deepEqual(sent, [{
    type: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS",
    jobId: "hls-header-test",
    urls: [
      "https://cdn.example.test/",
      "https://segment-cdn.example.test/"
    ]
  }]);
}

{
  const originalSendMessage = chrome.runtime.sendMessage;
  let sent = 0;
  chrome.runtime.sendMessage = async () => {
    sent += 1;
    return { ok: false, error: "DNR failed" };
  };

  try {
    await assert.rejects(
      () => context.updateMediaHeaderRuleDomains({ jobId: "hls-header-fail-test" }, [
        "https://segment-cdn.example.test/seg.ts"
      ]),
      /DNR failed/
    );
    assert.equal(sent, 1);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalSendMessage = chrome.runtime.sendMessage;
  let sent = 0;
  chrome.runtime.sendMessage = async () => {
    sent += 1;
    return { updated: false, domains: [] };
  };

  try {
    await context.updateMediaHeaderRuleDomains({ jobId: "hls-public-no-session-test" }, [
      "https://public-cdn.example.test/seg.ts"
    ]);
    assert.equal(sent, 1);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const sent = [];
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    if (href === "https://cdn.example.test/master.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=128000
https://variant-cdn.example.test/audio.m3u8`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === "https://variant-cdn.example.test/audio.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://key-cdn.example.test/key.bin"
#EXT-X-MAP:URI="https://map-cdn.example.test/init.mp4"
#EXTINF:4.000,
https://segment-cdn.example.test/seg-000.m4s
#EXT-X-ENDLIST`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: Uint8Array.from([7, 8]).buffer
    },
    bytes: 2
  });
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return { domains: testDomainsFromUrls(message.urls) };
  };

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-cross-domain-header-test",
      sourceUrl: "https://cdn.example.test/master.m3u8",
      cacheNamespace: "hls-cross-domain-header-test",
      asrChunkSeconds: 900
    });
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }

  const domainUpdates = sent
    .filter(message => message.type === "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS")
    .map(message => message.urls);
  assert.deepEqual(domainUpdates, [
    ["https://cdn.example.test/"],
    ["https://variant-cdn.example.test/"],
    [
      "https://key-cdn.example.test/",
      "https://map-cdn.example.test/",
      "https://segment-cdn.example.test/"
    ]
  ]);
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const fetchedSegments = [];
  let ffmpegCalls = 0;
  let firstFfmpegResolve = null;
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    if (href === "https://cdn.example.test/two-groups.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXTINF:180.000,
https://segment-cdn.example.test/seg-000.ts
#EXTINF:180.000,
https://segment-cdn.example.test/seg-001.ts
#EXT-X-ENDLIST`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href.includes("seg-")) {
      fetchedSegments.push(href);
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => {
    ffmpegCalls += 1;
    if (ffmpegCalls === 1) {
      return await new Promise(resolve => {
        firstFfmpegResolve = () => resolve({
          file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([7, 8]).buffer },
          bytes: 2
        });
      });
    }
    return {
      file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([9, 10]).buffer },
      bytes: 2
    };
  };
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });
  try {
    const extractionPromise = context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-next-group-prefetch-test",
      sourceUrl: "https://cdn.example.test/two-groups.m3u8",
      cacheNamespace: "hls-next-group-prefetch-test",
      asrChunkSeconds: 180
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ffmpegCalls, 1);
    assert.ok(
      fetchedSegments.some(url => url.endsWith("seg-001.ts")),
      `expected next HLS group to prefetch while first group is in FFmpeg, got ${JSON.stringify(fetchedSegments)}`
    );
    firstFfmpegResolve();
    await extractionPromise;
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  let seg001Attempts = 0;
  let ffmpegCalls = 0;
  let firstFfmpegResolve = null;
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    if (href === "https://cdn.example.test/two-groups-prefetch-retry.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXTINF:180.000,
https://segment-cdn.example.test/seg-000.ts
#EXTINF:180.000,
https://segment-cdn.example.test/seg-001.ts
#EXT-X-ENDLIST`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href.endsWith("seg-001.ts")) {
      seg001Attempts += 1;
      if (seg001Attempts <= 4) {
        throw new Error("Failed to fetch");
      }
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => {
    ffmpegCalls += 1;
    if (ffmpegCalls === 1) {
      return await new Promise(resolve => {
        firstFfmpegResolve = () => resolve({
          file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([7, 8]).buffer },
          bytes: 2
        });
      });
    }
    return {
      file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([9, 10]).buffer },
      bytes: 2
    };
  };
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });
  try {
    const extractionPromise = context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-prefetch-failed-group-redownload-test",
      sourceUrl: "https://cdn.example.test/two-groups-prefetch-retry.m3u8",
      cacheNamespace: "hls-prefetch-failed-group-redownload-test",
      asrChunkSeconds: 180
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ffmpegCalls, 1);
    assert.equal(seg001Attempts > 0, true);
    firstFfmpegResolve();
    const result = await extractionPromise;
    assert.equal(seg001Attempts > 4, true);
    assert.equal(ffmpegCalls, 2);
    assert.equal(result.chunks.length > 0, true);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalFetch = context.fetch;
  let active = 0;
  let maxActive = 0;
  const completed = [];
  context.fetch = async url => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const match = String(url).match(/seg-(\d+)\.ts$/);
    const index = match ? Number(match[1]) : 0;
    await new Promise(resolve => setTimeout(resolve, 20 - index));
    active -= 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/mp2t" },
      arrayBuffer: async () => Uint8Array.from([index]).buffer
    };
  };
  try {
    const result = await context.downloadHlsSegmentsForGroup({
      segments: Array.from({ length: 8 }, (_, index) => ({
        start: index,
        end: index + 1,
        duration: 1,
        url: `https://cdn.example.test/seg-${index}.ts`
      }))
    }, {}, 7, progress => completed.push(progress.completed));
    assert.equal(maxActive, 8);
    assert.equal(JSON.stringify(result.map(item => item.itemIndex)), JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]));
    assert.equal(JSON.stringify(result.map(item => item.segmentFile.name)), JSON.stringify([
      "seg-7-00000.ts",
      "seg-7-00001.ts",
      "seg-7-00002.ts",
      "seg-7-00003.ts",
      "seg-7-00004.ts",
      "seg-7-00005.ts",
      "seg-7-00006.ts",
      "seg-7-00007.ts"
    ]));
    assert.equal(completed.at(-1), 8);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  assert.equal(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 0, length: 100, endExclusive: 100 }
    }),
    "https://cdn.example.test/range.mp4#0-100"
  );
  assert.equal(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 100, length: 120, endExclusive: 220 }
    }),
    "https://cdn.example.test/range.mp4#100-220"
  );
  assert.notEqual(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 0, length: 100, endExclusive: 100 }
    }),
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 100, length: 120, endExclusive: 220 }
    })
  );
}

{
  const originalFetch = context.fetch;
  let active = 0;
  let maxActive = 0;
  context.fetch = async url => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const match = String(url).match(/(?:key|init)-(\d+)/);
    const index = match ? Number(match[1]) : 0;
    await new Promise(resolve => setTimeout(resolve, 20 - index));
    active -= 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/octet-stream" },
      arrayBuffer: async () => Uint8Array.from([index]).buffer
    };
  };
  try {
    const segments = Array.from({ length: 8 }, (_, index) => ({
      start: index,
      end: index + 1,
      duration: 1,
      url: `https://cdn.example.test/s${index}.m4s`,
      map: {
        id: `map-${index}`,
        url: `https://cdn.example.test/init-${index}.mp4`
      },
      key: {
        id: `key-${index}`,
        method: "AES-128",
        uri: `https://cdn.example.test/key-${index}.bin`
      }
    }));
    const keyNames = new Map();
    const mapNames = new Map();
    const keyFiles = await context.downloadHlsKeysForGroup({ segments }, {}, 3, keyNames);
    const mapFiles = await context.downloadHlsMapsForGroup({ segments }, {}, 3, mapNames);
    assert.equal(maxActive, 8);
    assert.equal(JSON.stringify(keyFiles.map(file => file.name)), JSON.stringify([
      "key-3-0.key",
      "key-3-1.key",
      "key-3-2.key",
      "key-3-3.key",
      "key-3-4.key",
      "key-3-5.key",
      "key-3-6.key",
      "key-3-7.key"
    ]));
    assert.equal(JSON.stringify(mapFiles.map(file => file.name)), JSON.stringify([
      "map-3-0.mp4",
      "map-3-1.mp4",
      "map-3-2.mp4",
      "map-3-3.mp4",
      "map-3-4.mp4",
      "map-3-5.mp4",
      "map-3-6.mp4",
      "map-3-7.mp4"
    ]));
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const segments = Array.from({ length: 6 }, (_, index) => ({
    start: index * 5,
    end: (index + 1) * 5,
    duration: 5,
    url: `https://cdn.example.test/s${index}.m4s`,
    map: {
      id: `map-${index}`,
      url: `https://cdn.example.test/init-${index}.mp4`
    },
    key: {
      id: `key-${index}`,
      method: "AES-128",
      uri: `https://cdn.example.test/key-${index}.bin`
    }
  }));
  const groups = context.groupHlsSegments(segments, { maxDurationSeconds: 60, maxSegments: 60 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].segments.length, 6);
}

{
  const segments = Array.from({ length: 80 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/seg-${index}.ts`
  }));
  const extractGroups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 60,
    maxSegments: 60
  });
  assert.equal(extractGroups[0].segments.length, 60);
  const overlapped = context.addHlsAsrContextOverlapToGroups(extractGroups, segments, 8);
  assert.equal(overlapped[0].segments.length, 60);
  assert.equal(overlapped[1].segments.length, 28);
}

{
  const segments = Array.from({ length: 40 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/default-overlap-${index}.ts`
  }));
  const groups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 20,
    maxSegments: 20
  });
  const overlapped = context.addHlsAsrContextOverlapToGroups(groups, segments);
  assert.equal(overlapped[0].start, 0);
  assert.equal(overlapped[0].coreEnd, 20);
  assert.equal(overlapped[0].end, 22);
  assert.equal(overlapped[1].start, 18);
}

{
  const urls = context.buildLikelyAudioCompanionPlaylistUrls(
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/avc1/480x270/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  );
  assert.equal(urls.length, 3);
  assert.equal(
    urls[0],
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/mp4a/128000/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  );
  const genericUrls = context.buildLikelyAudioCompanionPlaylistUrls(
    "https://media.example.test/sample-hls/720p/video.m3u8"
  );
  assert.equal(JSON.stringify(genericUrls.slice(0, 4)), JSON.stringify([
    "https://media.example.test/sample-hls/720p/audio.m3u8",
    "https://media.example.test/sample-hls/audio/audio.m3u8",
    "https://media.example.test/sample-hls/audio/index.m3u8",
    "https://media.example.test/sample-hls/audio/playlist.m3u8"
  ]));
  const tedUrls = context.buildLikelyAudioCompanionPlaylistUrls(
    "https://hls.ted.com/project_masters/1253/index-f9-v1.m3u8?intro_master_id=9294&preview=true"
  );
  assert.equal(
    tedUrls[0],
    "https://hls.ted.com/project_masters/1253/index-f8-a1.m3u8?intro_master_id=9294&preview=true"
  );
  assert.ok(tedUrls.includes(
    "https://hls.ted.com/project_masters/1253/index-f9-a1.m3u8?intro_master_id=9294&preview=true"
  ));
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const fetched = [];
  const cache = new Map();
  const sourceVideo = "https://video.twimg.com/amplify_video/2049886560490053635/pl/avc1/480x270/A-rRO8JxdrgyScb.m3u8?tag=27";
  const guessedAudio = "https://video.twimg.com/amplify_video/2049886560490053635/pl/mp4a/128000/A-rRO8JxdrgyScb.m3u8?tag=27";
  const pageMaster = "https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag=27";
  const pageAudio = "https://video.twimg.com/amplify_video/2049886560490053635/pl/mp4a/128000/DhnK2ArBcP44Ib0O.m3u8?tag=27";
  const audioSegment = "https://video.twimg.com/amplify_video/2049886560490053635/pl/mp4a/128000/audio-000.m4s";
  const videoSegment = "https://video.twimg.com/amplify_video/2049886560490053635/pl/avc1/480x270/video-000.m4s";
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    fetched.push(href);
    if (href === guessedAudio || href.includes("/pl/mp4a/64000/A-rRO8JxdrgyScb.m3u8") || href.includes("/pl/mp4a/32000/A-rRO8JxdrgyScb.m3u8")) {
      return {
        ok: false,
        status: 404,
        text: async () => "",
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "text/plain" }
      };
    }
    if (href === "https://x.com/AndrewYNg/status/2049886895530967534") {
      return {
        ok: true,
        status: 200,
        text: async () => `<html><script>{"playlist":"${pageMaster.replace("=", "&#x3D;")}"}</script></html>`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "text/html" }
      };
    }
    if (href === pageMaster) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="/amplify_video/2049886560490053635/pl/mp4a/128000/DhnK2ArBcP44Ib0O.m3u8?tag=27"
#EXT-X-STREAM-INF:BANDWIDTH=832000,RESOLUTION=480x270,CODECS="avc1.4d001e,mp4a.40.2",AUDIO="audio"
/amplify_video/2049886560490053635/pl/avc1/480x270/A-rRO8JxdrgyScb.m3u8?tag=27`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === pageAudio) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MAP:URI="/amplify_video/2049886560490053635/pl/mp4a/128000/audio-init.mp4"
#EXTINF:4.000,
${audioSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === sourceVideo) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MAP:URI="/amplify_video/2049886560490053635/pl/avc1/480x270/video-init.mp4"
#EXTINF:4.000,
${videoSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
    },
    bytes: 2
  });
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "x-video-twimg-page-master-fallback-test",
      sourceUrl: sourceVideo,
      pageUrl: "https://x.com/AndrewYNg/status/2049886895530967534",
      cacheNamespace: "x-video-twimg-page-master-fallback-test",
      asrChunkSeconds: 900
    });
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }

  assert.ok(fetched.includes(pageMaster), "X page HTML master playlist should be used when same-name audio companion is absent");
  assert.ok(fetched.includes(audioSegment), "audio companion segment should be downloaded for extraction");
  assert.equal(fetched.includes(videoSegment), false, "video-only HLS segment should not be fed to Web FFmpeg for ASR");
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const fetched = [];
  const cache = new Map();
  const sourceVideo = "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/540x540/qaXSEeWSgekNJ8wE.m3u8?tag=16";
  const guessedAudio128 = "https://video.twimg.com/amplify_video/2059183692569071878/pl/mp4a/128000/qaXSEeWSgekNJ8wE.m3u8?tag=16";
  const fallbackAudio64 = "https://video.twimg.com/amplify_video/2059183692569071878/pl/mp4a/64000/qaXSEeWSgekNJ8wE.m3u8?tag=16";
  const videoSegment = "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/540x540/video-00001.m4s";
  const audioSegment = "https://video.twimg.com/amplify_video/2059183692569071878/pl/mp4a/64000/audio-00001.m4s";
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    fetched.push(href);
    if (href === guessedAudio128) {
      return {
        ok: false,
        status: 404,
        text: async () => "",
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "text/plain" }
      };
    }
    if (href === fallbackAudio64) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MAP:URI="/amplify_video/2059183692569071878/pl/mp4a/64000/audio-init.mp4"
#EXTINF:4.000,
${audioSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === sourceVideo) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MAP:URI="/amplify_video/2059183692569071878/pl/avc1/540x540/video-init.mp4"
#EXTINF:4.000,
${videoSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
    },
    bytes: 2
  });
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 6,
      jobId: "x-video-twimg-derived-audio-404-fallback-test",
      sourceUrl: guessedAudio128,
      originalSourceUrl: sourceVideo,
      hlsAudioCandidateUrls: [guessedAudio128, fallbackAudio64],
      pageUrl: "https://x.com/jaynitx/status/2059183692569071878",
      cacheNamespace: "x-video-twimg-derived-audio-404-fallback-test",
      asrChunkSeconds: 900,
      duration: 4
    });
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }

  assert.ok(fetched.includes(fallbackAudio64), "the next X audio sibling candidate should be tried after a 404");
  assert.ok(fetched.includes(audioSegment), "fallback audio segment should be downloaded for extraction");
  assert.equal(fetched.includes(videoSegment), false, "video-only original HLS segment should not be fed to Web FFmpeg when an audio sibling works");
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const fetched = [];
  const cache = new Map();
  const sourceVideo = "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/540x540/qaXSEeWSgekNJ8wE.m3u8?tag=16";
  const missingAudio128 = "https://video.twimg.com/amplify_video/2059183692569071878/pl/mp4a/128000/qaXSEeWSgekNJ8wE.m3u8?tag=16";
  const videoSegment = "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/540x540/video-00001.m4s";
  let ffmpegCalled = false;
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    fetched.push(href);
    if (href === missingAudio128) {
      return {
        ok: false,
        status: 404,
        text: async () => "",
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "text/plain" }
      };
    }
    if (href === sourceVideo) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-MAP:URI="/amplify_video/2059183692569071878/pl/avc1/540x540/video-init.mp4"
#EXTINF:4.000,
${videoSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async () => {
    ffmpegCalled = true;
    throw new Error("video-only HLS should not reach FFmpeg");
  };
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });

  let errorMessage = "";
  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 7,
      jobId: "x-video-twimg-video-only-preflight-test",
      sourceUrl: missingAudio128,
      originalSourceUrl: sourceVideo,
      hlsAudioCandidateUrls: [missingAudio128],
      pageUrl: "https://x.com/jaynitx/status/2059183692569071878",
      cacheNamespace: "x-video-twimg-video-only-preflight-test",
      asrChunkSeconds: 900,
      duration: 4
    });
  } catch (error) {
    errorMessage = error.message || String(error);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }

  assert.match(errorMessage, /没有可用音频轨/);
  assert.equal(ffmpegCalled, false, "video-only HLS must be rejected before Web FFmpeg runs");
  assert.equal(fetched.includes(videoSegment), false, "video-only HLS segments should not be downloaded for ASR preflight");
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const fetched = [];
  const cache = new Map();
  const sourceVideo = "https://hls.ted.com/project_masters/1253/index-f9-v1.m3u8?intro_master_id=9294&preview=true";
  const audioPlaylist = "https://hls.ted.com/project_masters/1253/index-f8-a1.m3u8?intro_master_id=9294&preview=true";
  const videoSegment = "https://pu.tedcdn.com/consus/videos/1253/segment-1-f9-v1.ts";
  const audioSegment = "https://pu.tedcdn.com/consus/videos/1253/segment-1-f8-a1.ts";
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    fetched.push(href);
    if (href === audioPlaylist) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.000,
${audioSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === sourceVideo) {
      return {
        ok: true,
        status: 200,
        text: async () => `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.000,
${videoSegment}
#EXT-X-ENDLIST`,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
    },
    bytes: 2
  });

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 5,
      jobId: "ted-hls-audio-companion-test",
      sourceUrl: sourceVideo,
      pageUrl: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity",
      cacheNamespace: "ted-hls-audio-companion-test",
      asrChunkSeconds: 900,
      duration: 6
    });
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }

  assert.ok(fetched.includes(audioPlaylist), "generic HLS companion probing should try the TED-style audio track");
  assert.ok(fetched.includes(audioSegment), "audio companion segment should be downloaded for ASR");
  assert.equal(fetched.includes(videoSegment), false, "video-only TED HLS segment should not be fed to Web FFmpeg for ASR");
}

{
  const state = context.createHlsLogicalChunkState(900);
  assert.equal(state.logicalChunkSeconds, 900);
  const readyBeforeLimit = [];
  for (let index = 0; index < 4; index += 1) {
    readyBeforeLimit.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: index * 180,
      end: (index + 1) * 180,
      duration: 180,
      file: { name: `internal-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/${index}` }
    }));
  }
  assert.equal(readyBeforeLimit.length, 0);

  const readyAtLimit = context.collectHlsLogicalPartGroups(state, {
    index: 4,
    start: 720,
    end: 900,
    duration: 180,
    file: { name: "internal-4.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/4" }
  });
  assert.equal(readyAtLimit.length, 1);
  assert.equal(readyAtLimit[0].length, 5);
}

{
  const rawSegments = [];
  let cursor = 0;
  for (let index = 0; index < 80; index += 1) {
    rawSegments.push({
      start: cursor,
      end: cursor + 180,
      duration: 180,
      url: `https://cdn.example.test/long-file-${index}.ts`
    });
    cursor += 180;
  }
  rawSegments.push({
    start: cursor,
    end: cursor + 15,
    duration: 15,
    url: "https://cdn.example.test/long-file-padding.ts"
  });
  const media = context.clipHlsMediaToRequestedDuration({
    segments: rawSegments,
    duration: 14415,
    mapUrl: "",
    unsupportedEncryption: ""
  }, 14373);
  assert.equal(media.duration, 14373);
  assert.equal(media.segments.at(-1).end, 14373);
  const internalGroups = context.buildHlsInternalExtractionGroups(media, 7200, { longFile: true });
  const state = context.createHlsLogicalChunkState(7200, { longFile: true });
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      file: { name: `long-file-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/long-file-${index}` }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 2);
  assert.equal(logicalPartGroups[0][0].coreStart, 0);
  assert.equal(logicalPartGroups.at(-1).at(-1).coreEnd, 14373);
}

{
  const rawSegments = [];
  let cursor = 0;
  for (let index = 0; index < 32; index += 1) {
    const duration = index === 31 ? 24 : 23.645;
    rawSegments.push({
      start: cursor,
      end: cursor + duration,
      duration,
      url: `https://delivery.domand.nicovideo.jp/audio-aac-192kbps-${index}.mp4`
    });
    cursor += duration;
  }
  const media = context.clipHlsMediaToRequestedDuration({
    segments: rawSegments,
    duration: cursor,
    mapUrl: "",
    unsupportedEncryption: ""
  }, 219);
  assert.equal(media.duration, 219);
  assert.equal(media.segments.at(-1).end, 219);
  assert.equal(media.segments.length < rawSegments.length, true);
  const unknownDurationMedia = context.clipHlsMediaToRequestedDuration({
    segments: rawSegments,
    duration: cursor,
    mapUrl: "",
    unsupportedEncryption: ""
  }, 0);
  assert.equal(unknownDurationMedia.duration, cursor);
  assert.equal(unknownDurationMedia.segments.length, rawSegments.length);
}

{
  assert.equal(
    context.guessHlsSegmentExtension("https://asset.domand.nicovideo.jp/video/audio-aac-192kbps/init01.cmfa?session=abc"),
    "cmfa"
  );
  assert.equal(
    context.guessHlsSegmentExtension("https://asset.domand.nicovideo.jp/video/video-h264-720p/01.cmfv?session=abc"),
    "cmfv"
  );
  assert.equal(context.guessHlsSegmentExtension("https://cdn.example.test/audio/segment.m4a?token=abc"), "m4a");
  assert.equal(context.guessHlsSegmentExtension("https://cdn.example.test/audio/segment.unknown?token=abc"), "ts");
}

{
  const state = context.createHlsLogicalChunkState(900);
  const first = context.collectHlsLogicalPartGroups(state, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    speechIntervals: [{ start: 2, end: 8 }],
    file: { name: "speech-a.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/speech-a" }
  });
  assert.equal(first.length, 0);
  const skippedSilence = context.collectHlsLogicalPartGroups(state, {
    index: 1,
    start: 30,
    end: 60,
    duration: 30,
    speechIntervals: [],
    file: { name: "silence.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/silence" }
  });
  assert.equal(skippedSilence.length, 1);
  assert.equal(skippedSilence[0].length, 1);
  assert.equal(skippedSilence[0][0].index, 0);
  const splitAtVadGap = context.collectHlsLogicalPartGroups(state, {
    index: 2,
    start: 60,
    end: 90,
    duration: 30,
    speechIntervals: [{ start: 70, end: 76 }],
    file: { name: "speech-b.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/speech-b" }
  });
  assert.equal(splitAtVadGap.length, 0);
  const tail = context.collectHlsLogicalPartGroups(state, null, true);
  assert.equal(tail.length, 1);
  assert.equal(tail[0].length, 1);
  assert.equal(tail[0][0].index, 2);
}

{
  const state = context.createHlsLogicalChunkState(900);
  const weakVadEmpty = context.collectHlsLogicalPartGroups(state, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    speechIntervals: [],
    speechIntervalsReliable: false,
    file: { name: "weak-vad-empty.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/weak-vad-empty" }
  });
  assert.equal(weakVadEmpty.length, 0);
  const tail = context.collectHlsLogicalPartGroups(state, null, true);
  assert.equal(tail.length, 1);
  assert.equal(tail[0][0].index, 0);
  assert.equal(tail[0][0].speechIntervalsReliable, false);
}

{
  const state = context.createHlsLogicalChunkState(900);
  const first = context.collectHlsLogicalPartGroups(state, {
    index: 0,
    start: 0,
    end: 33,
    coreStart: 0,
    coreEnd: 30,
    duration: 33,
    file: { name: "overlap-0.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/overlap-0" }
  });
  const second = context.collectHlsLogicalPartGroups(state, {
    index: 1,
    start: 27,
    end: 63,
    coreStart: 30,
    coreEnd: 60,
    duration: 36,
    file: { name: "overlap-1.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/overlap-1" }
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].length, 1);
}

{
  const sent = [];
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return {};
  };
  await context.reportWebFfmpegChunkReady(
    { tabId: 1, jobId: "browser-streaming-test" },
    {
      index: 0,
      start: 0,
      end: 180,
      duration: 180,
      file: {
        name: "chunk-001.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/chunk-001.mp3",
        bytes: 1024
      },
      bytes: 1024
    },
    { duration: 600, internalChunksDone: 1, internalChunksTotal: 4 }
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY");
  assert.equal(sent[0].jobId, "browser-streaming-test");
  assert.equal(sent[0].chunk.end, 180);
  chrome.runtime.sendMessage = originalSendMessage;
}
