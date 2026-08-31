import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/content/page-sniffer.js", import.meta.url), "utf8");

{
  const harness = createHarness({
    html: `
      <html>
        <body>
          <a href="https://t.co/BmJcY2BZXu">pic.twitter.com/BmJcY2BZXu</a>
          <script>
            {"playlist":"https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag&#x3D;27"}
            {"mp4":"https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag&#x3D;27"}
          </script>
        </body>
      </html>
    `
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.kind === "hls" && item.ext === "m3u8" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag=27"),
    "X initial HTML HLS playlist should be discovered and HTML entities should be decoded"
  );
  assert.ok(
    media.some(item => item.kind === "media" && item.ext === "mp4" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag=27"),
    "X initial HTML MP4 fallback should be discovered"
  );
  assert.equal(
    media.some(item => item.url.startsWith("https://t.co/")),
    false,
    "ordinary social links must not be reported as media"
  );
}

{
  const harness = createHarness();
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  harness.context.JSON.parse(JSON.stringify({
    rest_id: "2059183692569071878",
    legacy: {
      extended_entities: {
        media: [{
          sizes: {
            large: { w: 650, h: 360 }
          },
          video_info: {
            duration_millis: 82000,
            variants: [{
              url: "https://video.twimg.com/amplify_video/2058970000000000153/pl/avc1/650x360/status-82s.m3u8?tag=16",
              content_type: "application/x-mpegURL",
              bitrate: 832000
            }, {
              url: "https://video.twimg.com/amplify_video/2058970000000000153/audio/128000/audio-track.mp4",
              content_type: "audio/mp4",
              bitrate: 128000
            }]
          }
        }]
      }
    }
  }));

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const statusMedia = media.find(item => /status-82s\.m3u8/.test(item.url));
  assert.equal(statusMedia?.statusId, "2059183692569071878");
  assert.equal(statusMedia?.duration, 82);
  assert.equal(statusMedia?.videoWidth, 650);
  assert.equal(statusMedia?.videoHeight, 360);
  assert.equal(statusMedia?.role, "video");
  const audioMedia = media.find(item => /audio-track\.mp4/.test(item.url));
  assert.equal(audioMedia?.role, "audio");
  assert.equal(audioMedia?.kind, "audio");
}

{
  const harness = createHarness();
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  const extensionFetch = harness.context.window.fetch;
  const pageFetch = function pageFetch() {
    return extensionFetch.apply(this, arguments);
  };
  harness.context.window.fetch = pageFetch;

  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  assert.equal(
    harness.context.window.fetch,
    pageFetch,
    "re-activating the sniffer must not remove a page-installed fetch wrapper"
  );
  assert.equal(harness.context.window.__fuguangPageSnifferRevision, "20260831-baseline-hooks");
  assert.doesNotThrow(() => vm.runInContext(`
    JSON.parse('{"value":1}', (_key, value) =>
      value && value.value === 1
        ? new Proxy(value, { ownKeys() { throw new Error("inspection-only failure"); } })
        : value
    )
  `, harness.context));

  harness.context.window.__fuguangPageSnifferCleanup();
  assert.equal(
    harness.context.window.fetch,
    pageFetch,
    "cleanup must not overwrite a fetch wrapper installed after the sniffer"
  );
}

{
  const harness = createHarness();
  const pageFetchResult = { pageOwned: true };
  harness.context.window.fetch = () => pageFetchResult;
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  assert.equal(
    harness.context.window.fetch("https://example.test/not-a-standard-fetch"),
    pageFetchResult,
    "inspection must preserve a page-owned fetch wrapper's non-Promise return value"
  );
}

{
  const masterUrl = "https://video.twimg.com/amplify_video/2059183631126667264/pl/ujqQBpTjKwgRUz5h.m3u8?tag=14&v=cfc";
  const master = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-32000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/32000/GbDAND4wQKvzaKjK.m3u8"
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-64000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/64000/nYblN7k8RN5JSUbL.m3u8"
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-128000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8"
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=499344,BANDWIDTH=663810,RESOLUTION=1280x720,CODECS="mp4a.40.2,avc1.64001F",AUDIO="audio-128000"
/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8`;
  const harness = createHarness({
    fetchResponse: createFakeResponse(masterUrl, master, {
      "content-type": "application/vnd.apple.mpegurl",
      "content-length": String(master.length)
    })
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  await harness.context.window.fetch(masterUrl);
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const audio = media.filter(item => /\/pl\/mp4a\//.test(item.url));
  assert.equal(audio.length, 3);
  assert.ok(
    audio.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8" && item.role === "audio"),
    "HLS master audio renditions should be emitted as executable audio candidates"
  );
  assert.ok(
    media.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8"),
    "HLS master video variants should still be discovered for grouping"
  );
}

{
  const audioInitUrl = "https://video.twimg.com/amplify_video/2059183692569071878/track/init-001.m4s";
  const harness = createHarness({
    fetchResponse: createFakeResponse(audioInitUrl, createFmp4InitSegment("soun"), {
      "content-type": "video/iso.segment",
      "content-length": "96"
    })
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  await harness.context.window.fetch(audioInitUrl);
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const init = media.find(item => item.url === audioInitUrl && item.segmentType === "init");
  assert.equal(init?.segmentType, "init");
  assert.equal(init?.role, "audio");
  assert.equal(init?.contentType, "audio/mp4");
}

{
  const masterUrl = "https://video.twimg.com/amplify_video/2059183631126667264/pl/ujqQBpTjKwgRUz5h.m3u8?tag=14&v=cfc";
  const mainScriptUrl = "https://abs.twimg.com/responsive-web/client-web/main.test.js";
  const mainScript = `
    const token = "Bearer TEST_PUBLIC_TOKEN";
    e.exports={queryId:"TweetResultQueryId",operationName:"TweetResultByRestId",operationType:"query",metadata:{featureSwitches:["view_counts_everywhere_api_enabled"],fieldToggles:["withArticlePlainText"]}};
  `;
  const tweetJson = JSON.stringify({
    data: {
      tweetResult: {
        result: {
          rest_id: "2059183692569071878",
          legacy: {
            extended_entities: {
              media: [{
                id_str: "2059183631126667264",
                media_url_https: "https://pbs.twimg.com/amplify_video_thumb/2059183631126667264/img/9DBL3kfKP41LFG2H.jpg",
                sizes: { large: { w: 1280, h: 720 } },
                video_info: {
                  duration_millis: 81915,
                  variants: [{
                    content_type: "application/x-mpegURL",
                    url: masterUrl
                  }, {
                    bitrate: 2176000,
                    content_type: "video/mp4",
                    url: "https://video.twimg.com/amplify_video/2059183631126667264/vid/avc1/1280x720/6B5Ja8knj279z4U-.mp4?tag=14"
                  }]
                }
              }]
            }
          }
        }
      }
    }
  });
  const master = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-128000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8"
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=499344,BANDWIDTH=663810,RESOLUTION=1280x720,CODECS="mp4a.40.2,avc1.64001F",AUDIO="audio-128000"
/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8`;
  const harness = createHarness({
    locationHref: "https://x.com/jaynitx/status/2059183692569071878",
    scripts: [{ src: mainScriptUrl, textContent: "" }],
    fetchResponses(url) {
      if (url === mainScriptUrl) {
        return createFakeResponse(url, mainScript, { "content-type": "application/javascript" });
      }
      if (String(url).includes("/i/api/graphql/TweetResultQueryId/TweetResultByRestId")) {
        return createFakeResponse(url, tweetJson, { "content-type": "application/json" });
      }
      if (url === masterUrl) {
        return createFakeResponse(url, master, { "content-type": "application/vnd.apple.mpegurl" });
      }
      return null;
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await flushPromises();
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.url === masterUrl && item.statusId === "2059183692569071878"),
    "X GraphQL probe should emit only the current status media playlist"
  );
  assert.ok(
    media.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8" && item.role === "audio"),
    "X GraphQL probe should fetch the HLS master and expose the audio rendition"
  );
}

function createHarness({ html = "", fetchResponse = null, fetchResponses = null, scripts = [], locationHref = "https://x.com/AndrewYNg/status/2049886895530967534" } = {}) {
  const messages = [];
  let nextTimer = 1;
  const window = {
    fetch(input) {
      const url = typeof input === "string" ? input : input?.url || "";
      if (fetchResponses) {
        const matched = fetchResponses(url);
        if (matched) {
          return Promise.resolve(matched);
        }
      }
      if (fetchResponse) {
        return Promise.resolve(fetchResponse);
      }
      return Promise.reject(new Error("fetch not used by this test"));
    },
    postMessage(message) {
      messages.push(message);
    }
  };
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function open() {};
  XMLHttpRequest.prototype.send = function send() {};
  const document = {
    title: "X test page",
    documentElement: { innerHTML: html, lang: "en" },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    scripts,
    createElement() {
      return {
        value: "",
        set innerHTML(value) {
          this.value = String(value || "")
            .replace(/&#x3D;/gi, "=")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, "\"")
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">");
        }
      };
    }
  };
  const context = vm.createContext({
    window,
    document,
    location: {
      href: locationHref,
      hostname: new URL(locationHref).hostname,
      protocol: new URL(locationHref).protocol
    },
    XMLHttpRequest,
    URL,
    URLSearchParams,
    Headers,
    JSON,
    Number,
    String,
    Boolean,
    Promise,
    WeakSet,
    Set,
    setInterval() {
      const id = nextTimer;
      nextTimer += 1;
      return id;
    },
    clearTimeout() {},
    setTimeout() {
      const id = nextTimer;
      nextTimer += 1;
      return id;
    }
  });
  return { context, messages };
}

function createFakeResponse(url, body, headers = {}) {
  const textBody = typeof body === "string" ? body : body && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) ? JSON.stringify(body) : "";
  return {
    url,
    body,
    headers: {
      get(name) {
        return headers[String(name || "").toLowerCase()] || "";
      }
    },
    clone() {
      return createFakeResponse(url, body, headers);
    },
    async text() {
      return textBody;
    },
    async arrayBuffer() {
      const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

function createFmp4InitSegment(handlerType) {
  return concatBytes(
    box("ftyp", Uint8Array.from([0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x36])),
    box("moov", box("trak", box("mdia", box("hdlr", concatBytes(new Uint8Array(8), asciiBytes(handlerType), new Uint8Array(12))))))
  );
}

function box(type, payload) {
  const output = new Uint8Array(8 + payload.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, output.length);
  output.set(asciiBytes(type), 4);
  output.set(payload, 8);
  return output;
}

function asciiBytes(value) {
  return Uint8Array.from(String(value).split("").map(char => char.charCodeAt(0) & 0xff));
}

function concatBytes(...chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
