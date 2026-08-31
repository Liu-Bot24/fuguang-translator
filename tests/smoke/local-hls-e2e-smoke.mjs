import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const extensionPath = path.join(repoRoot, "extension");
const { chromium } = loadPlaywright();
const chromiumHeadless = process.env.FUGUANG_SMOKE_HEADLESS === "1";

let asrCalls = 0;
let llmCalls = 0;
let openApiCalls = 0;
let playlistRequests = 0;
let segmentRequests = 0;
const asrLanguageFields = [];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-local-hls-smoke-"));
const userDataDir = path.join(tmpRoot, "profile");
const wavPath = path.join(tmpRoot, "tone.wav");
const hlsPath = path.join(tmpRoot, "audio.m3u8");
const server = http.createServer(handleRequest);

try {
  createHlsFixture();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const result = await runExtensionSmoke(origin);
  const vtt = String(result.vttResponse?.vtt || "");
  console.log(`HLS_SMOKE_STATUS=${result.latest?.job?.status}`);
  console.log(`HLS_SMOKE_STAGE=${result.latest?.job?.stage}`);
  console.log(`HLS_SMOKE_ERROR=${result.latest?.job?.error || ""}`);
  console.log(`HLS_PLAYLIST_REQUESTS=${playlistRequests}`);
  console.log(`HLS_SEGMENT_REQUESTS=${segmentRequests}`);
  console.log(`HLS_ASR_CALLS=${asrCalls}`);
  console.log(`HLS_ASR_LANGUAGES=${JSON.stringify(asrLanguageFields)}`);
  console.log(`HLS_LLM_CALLS=${llmCalls}`);
  console.log(`HLS_OPENAPI_CALLS=${openApiCalls}`);
  console.log(`HLS_VTT_BYTES=${Buffer.byteLength(vtt, "utf8")}`);
  console.log(`HLS_SOURCE=${JSON.stringify(result.transcriptResponse?.transcript?.source || [])}`);
  console.log(`HLS_TRANSLATED=${JSON.stringify(result.transcriptResponse?.transcript?.translated || [])}`);
  console.log(`HLS_VTT=${JSON.stringify(vtt)}`);
  if (result.latest?.job?.status !== "completed") {
    throw new Error(`HLS smoke job did not complete: ${JSON.stringify(result.latest?.job)}`);
  }
  if (playlistRequests < 1 || segmentRequests < 1) {
    throw new Error(`expected HLS playlist and segment requests, got playlist=${playlistRequests}, segments=${segmentRequests}`);
  }
  if (!vtt.includes("你好，HLS烟测")) {
    throw new Error("translated HLS VTT missing expected local text");
  }
  if (vtt.includes("越界字幕") || vtt.includes("out of bounds")) {
    throw new Error("HLS VTT included an ASR segment outside the core ownership window");
  }
  const transcriptSource = JSON.stringify(result.transcriptResponse?.transcript?.source || []);
  if (transcriptSource.includes("越界字幕") || transcriptSource.includes("out of bounds")) {
    throw new Error("HLS transcript source included an ASR segment outside the core ownership window");
  }
  if (asrCalls !== 1) {
    throw new Error(`expected one HLS ASR call, got ${asrCalls}`);
  }
  if (JSON.stringify(asrLanguageFields) !== JSON.stringify(["en"])) {
    throw new Error(`expected HLS ASR language en, got ${JSON.stringify(asrLanguageFields)}`);
  }
  if (llmCalls !== 1) {
    throw new Error(`expected one HLS LLM call, got ${llmCalls}`);
  }
  if (openApiCalls !== 0) {
    throw new Error(`expected no OpenAPI probe with vad off, got ${openApiCalls}`);
  }
} finally {
  server.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

async function runExtensionSmoke(origin) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: chromiumHeadless,
    executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  try {
    const mediaPage = await context.newPage();
    await mediaPage.goto(`${origin}/page.html`, { waitUntil: "domcontentloaded", timeout: 10_000 });
    let serviceWorker = context.serviceWorkers()[0] || null;
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
    }
    const extensionId = serviceWorker.url().match(/^chrome-extension:\/\/([^/]+)\//)?.[1] || "";
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/src/sidepanel/sidepanel.html`, {
      waitUntil: "domcontentloaded",
      timeout: 10_000
    });
    const result = await extensionPage.evaluate(async ({ origin: smokeOrigin }) => {
      try {
        await chrome.storage.local.set({
          modelSettingsVersion: 5,
          selectedAsrProfileId: "local_hls_asr",
          selectedLlmProfileId: "local_hls_llm",
          asrProfiles: [{
            id: "local_hls_asr",
            name: "Local HLS ASR",
            providerType: "openai",
            baseUrl: `${smokeOrigin}/asr/v1`,
            model: "local-hls-asr",
            vadFilter: "off",
            apiKey: "local-hls-key"
          }],
          llmProfiles: [{
            id: "local_hls_llm",
            name: "Local HLS LLM",
            providerType: "openai",
            baseUrl: `${smokeOrigin}/llm/v1`,
            model: "local-hls-llm",
            apiKey: "local-hls-key"
          }],
          targetLanguage: "zh-CN",
          sourceLanguage: "en",
          asrWorkers: 1,
          translationWorkers: 1,
          chunkMinutes: 15
        });
        const [tab] = await chrome.tabs.query({ url: `${smokeOrigin}/page.html` });
        if (!tab?.id) {
          throw new Error("local HLS smoke page tab not found");
        }
        const start = await chrome.runtime.sendMessage({
          type: "FUGUANG_START_PRELOAD_AUTO",
          tabId: tab.id,
          candidate: {
            url: `${smokeOrigin}/audio.m3u8`,
            pageUrl: `${smokeOrigin}/page.html`,
            kind: "hls",
            role: "audio",
            ext: "m3u8",
            contentType: "application/vnd.apple.mpegurl",
            fileName: "audio.m3u8",
            duration: 2
          }
        });
        if (!start?.ok || !start.job?.id) {
          throw new Error(`start failed: ${JSON.stringify(start)}`);
        }
        let latest = start;
        for (let index = 0; index < 120; index += 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          latest = await chrome.runtime.sendMessage({
            type: "FUGUANG_CHECK_PRELOAD_JOB",
            tabId: tab.id,
            jobId: start.job.id
          });
          if (["completed", "failed", "cancelled"].includes(latest?.job?.status)) {
            break;
          }
        }
        const transcriptResponse = await chrome.runtime.sendMessage({
          type: "FUGUANG_GET_PRELOAD_TRANSCRIPT",
          jobId: start.job.id
        });
        const vttResponse = await chrome.runtime.sendMessage({
          type: "FUGUANG_GET_PRELOAD_VTT",
          jobId: start.job.id
        });
        return { ok: true, start, latest, transcriptResponse, vttResponse };
      } catch (error) {
        return { ok: false, error: error?.message || String(error), stack: error?.stack || "" };
      }
    }, { origin });
    if (!result?.ok) {
      throw new Error(`local HLS smoke page failed: ${result?.error || "unknown error"}`);
    }
    return result;
  } finally {
    await context.close().catch(() => {});
  }
}

function handleRequest(request, response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "authorization, content-type, range");
  response.setHeader("access-control-allow-methods", "GET, HEAD, POST, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.url === "/page.html") {
    response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
    response.end("<!doctype html><meta charset=\"utf-8\"><title>Fuguang local HLS smoke</title><audio controls src=\"/audio.m3u8\"></audio>");
    return;
  }
  const requestPath = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
  const media = mediaFileForPath(requestPath);
  if (media) {
    if (requestPath === "/audio.m3u8") {
      playlistRequests += 1;
    } else {
      segmentRequests += 1;
    }
    const bytes = fs.readFileSync(media.file);
    response.writeHead(200, { "content-type": media.type, "content-length": bytes.length });
    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(bytes);
    }
    return;
  }
  if (request.url === "/asr/v1/audio/transcriptions" && request.method === "POST") {
    asrCalls += 1;
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      const languageMatch = body.match(/name="language"\r\n\r\n([^\r\n]+)/);
      if (languageMatch) {
        asrLanguageFields.push(languageMatch[1]);
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        text: "hello hls smoke out of bounds",
        segments: [
          { id: 0, start: 0.2, end: 1.6, text: "hello hls smoke" },
          { id: 1, start: 60, end: 61, text: "out of bounds" }
        ]
      }));
    });
    return;
  }
  if (request.url === "/llm/v1/chat/completions" && request.method === "POST") {
    llmCalls += 1;
    request.resume();
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              items: [
                { i: 0, text: "你好，HLS烟测" }
              ]
            })
          }
        }]
      }));
    });
    return;
  }
  if (String(request.url || "").endsWith("/openapi.json")) {
    openApiCalls += 1;
    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}");
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
}

function mediaFileForPath(requestPath) {
  if (requestPath === "/audio.m3u8") {
    return { file: hlsPath, type: "application/vnd.apple.mpegurl" };
  }
  if (/^\/seg-\d+\.ts$/.test(requestPath)) {
    const file = path.join(tmpRoot, requestPath.slice(1));
    if (fs.existsSync(file)) {
      return { file, type: "video/mp2t" };
    }
  }
  return null;
}

function createHlsFixture() {
  fs.writeFileSync(wavPath, wavBuffer({ seconds: 2 }));
  const ffmpegBin = resolveCommand("ffmpeg");
  execFileSync(ffmpegBin, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    wavPath,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-f",
    "hls",
    "-hls_time",
    "1",
    "-hls_list_size",
    "0",
    "-hls_segment_filename",
    path.join(tmpRoot, "seg-%03d.ts"),
    hlsPath
  ]);
}

function wavBuffer({ seconds, sampleRate = 16_000, freq = 440 }) {
  const samples = Math.floor(seconds * sampleRate);
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * freq) * 12_000);
    buffer.writeInt16LE(value, 44 + index * 2);
  }
  return buffer;
}

function resolveCommand(command) {
  try {
    const locator = process.platform === "win32" ? "where.exe" : "which";
    return execFileSync(locator, [command], { encoding: "utf8" })
      .split(/\r?\n/)
      .map(value => value.trim())
      .find(Boolean) || "";
  } catch {
    throw new Error(`Missing required command: ${command}`);
  }
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const configuredRoot = String(process.env.PLAYWRIGHT_NODE_MODULES || "").trim();
    if (configuredRoot) {
      return require(path.join(configuredRoot, "playwright"));
    }
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, "playwright"));
  }
}
