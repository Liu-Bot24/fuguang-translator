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
const speachesBaseUrl = normalizeBaseUrl(process.env.SPEACHES_BASE_URL || "http://127.0.0.1:8000/v1");
const speachesModel = process.env.SPEACHES_MODEL || "Systran/faster-whisper-large-v3";
const llmBaseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL || "");
const llmModel = process.env.LLM_MODEL || "";
const llmApiKey = process.env.LLM_API_KEY || "";
const allowRealServices = process.env.FUGUANG_ALLOW_REAL_SERVICES === "1";
const realSmokeVerbose = process.env.FUGUANG_REAL_SMOKE_VERBOSE === "1";
const chromiumHeadless = process.env.FUGUANG_SMOKE_HEADLESS === "1";

if (!allowRealServices) {
  throw new Error("FUGUANG_ALLOW_REAL_SERVICES=1 is required before running real Speaches/LLM smoke.");
}

if (!llmBaseUrl || !llmModel || !llmApiKey) {
  throw new Error("LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY are required; do not put keys in this repository.");
}

const sayBin = resolveCommand("say");
const ffmpegBin = resolveCommand("ffmpeg");
const { chromium } = loadPlaywright();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-real-hls-smoke-"));
const userDataDir = path.join(tmpRoot, "profile");
const aiffPath = path.join(tmpRoot, "speech.aiff");
const wavPath = path.join(tmpRoot, "speech.wav");
const hlsPath = path.join(tmpRoot, "audio.m3u8");
const phrase = "hello h l s smoke test, this is local segmented audio";

execFileSync(sayBin, ["-v", "Samantha", "-o", aiffPath, phrase]);
execFileSync(ffmpegBin, ["-hide_banner", "-loglevel", "error", "-y", "-i", aiffPath, "-ar", "16000", "-ac", "1", wavPath]);
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

const server = http.createServer(handleRequest);

try {
  await assertSpeachesAvailable();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const result = await runExtensionSmoke(origin);
  printResult(result);
  assertCompletedResult(result);
} finally {
  server.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

async function runExtensionSmoke(origin) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: chromiumHeadless,
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
    const result = await extensionPage.evaluate(async config => {
      await chrome.storage.local.set({
        modelSettingsVersion: 5,
        selectedAsrProfileId: "real_speaches_hls",
        selectedLlmProfileId: "real_llm_hls",
        asrProfiles: [{
          id: "real_speaches_hls",
          name: "Real Speaches HLS",
          providerType: "openai",
          baseUrl: config.speachesBaseUrl,
          model: config.speachesModel,
          vadFilter: "on",
          apiKey: "local-speaches"
        }],
        llmProfiles: [{
          id: "real_llm_hls",
          name: "Real LLM HLS",
          providerType: "openai",
          baseUrl: config.llmBaseUrl,
          model: config.llmModel,
          apiKey: config.llmApiKey
        }],
        targetLanguage: "zh-CN",
        sourceLanguage: "en",
        asrWorkers: 1,
        translationWorkers: 1,
        chunkMinutes: 20
      });
      const [tab] = await chrome.tabs.query({ url: `${config.origin}/page.html` });
      if (!tab?.id) {
        throw new Error("media page tab not found");
      }
      const start = await chrome.runtime.sendMessage({
        type: "FUGUANG_START_PRELOAD_AUTO",
        tabId: tab.id,
        candidate: {
          url: `${config.origin}/audio.m3u8`,
          pageUrl: `${config.origin}/page.html`,
          kind: "hls",
          role: "audio",
          ext: "m3u8",
          contentType: "application/vnd.apple.mpegurl",
          fileName: "audio.m3u8",
          duration: 4
        }
      });
      if (!start?.ok || !start.job?.id) {
        throw new Error(`start failed: ${JSON.stringify(start)}`);
      }
      let latest = start;
      const history = [];
      for (let index = 0; index < 240; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        latest = await chrome.runtime.sendMessage({
          type: "FUGUANG_CHECK_PRELOAD_JOB",
          tabId: tab.id,
          jobId: start.job.id
        });
        history.push({
          status: latest?.job?.status,
          stage: latest?.job?.stage,
          message: latest?.job?.message || "",
          error: latest?.job?.error || ""
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
      return { latest, transcriptResponse, vttResponse, historyTail: history.slice(-12) };
    }, {
      origin,
      speachesBaseUrl,
      speachesModel,
      llmBaseUrl,
      llmModel,
      llmApiKey
    });
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
    response.end("<!doctype html><meta charset=\"utf-8\"><title>Fuguang HLS Speaches LLM smoke</title><audio controls src=\"/audio.m3u8\"></audio>");
    return;
  }
  const requestPath = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
  const entry = mediaFileForPath(requestPath);
  if (entry) {
    const bytes = fs.readFileSync(entry.file);
    response.writeHead(200, { "content-type": entry.type, "content-length": bytes.length });
    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(bytes);
    }
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
}

function mediaFileForPath(requestPath) {
  if (requestPath === "/audio.m3u8") {
    return { file: hlsPath, type: "application/vnd.apple.mpegurl" };
  }
  const segmentMatch = requestPath.match(/^\/seg-\d+\.ts$/);
  if (segmentMatch) {
    const file = path.join(tmpRoot, requestPath.slice(1));
    if (fs.existsSync(file)) {
      return { file, type: "video/mp2t" };
    }
  }
  return null;
}

async function assertSpeachesAvailable() {
  const url = `${speachesBaseUrl}/models`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Speaches models check failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const models = Array.isArray(data?.data) ? data.data.map(model => model?.id).filter(Boolean) : [];
  if (!models.includes(speachesModel)) {
    throw new Error(`Speaches model ${speachesModel} not found. Available: ${models.join(", ")}`);
  }
}

function printResult(result) {
  const sourceSegments = result.transcriptResponse?.transcript?.source || [];
  const translatedSegments = result.transcriptResponse?.transcript?.translated || [];
  const vtt = result.vttResponse?.vtt || "";
  const historyTail = Array.isArray(result.historyTail) ? result.historyTail : [];
  const errorText = result.latest?.job?.error || "";
  console.log(`REAL_HLS_SMOKE_STATUS=${result.latest?.job?.status}`);
  console.log(`REAL_HLS_SMOKE_STAGE=${result.latest?.job?.stage}`);
  console.log(`REAL_HLS_SMOKE_ERROR=${errorText ? "[redacted; set FUGUANG_REAL_SMOKE_VERBOSE=1 for details]" : ""}`);
  console.log(`REAL_HLS_SMOKE_SOURCE_COUNT=${sourceSegments.length}`);
  console.log(`REAL_HLS_SMOKE_TRANSLATED_COUNT=${translatedSegments.length}`);
  console.log(`REAL_HLS_SMOKE_VTT_BYTES=${Buffer.byteLength(String(vtt), "utf8")}`);
  console.log(`REAL_HLS_SMOKE_HISTORY_TAIL_COUNT=${historyTail.length}`);
  if (realSmokeVerbose) {
    console.log(`REAL_HLS_SMOKE_ERROR_VERBOSE=${JSON.stringify(errorText)}`);
    console.log(`REAL_HLS_SMOKE_SOURCE_VERBOSE=${JSON.stringify(sourceSegments)}`);
    console.log(`REAL_HLS_SMOKE_TRANSLATED_VERBOSE=${JSON.stringify(translatedSegments)}`);
    console.log(`REAL_HLS_SMOKE_VTT_VERBOSE=${JSON.stringify(vtt)}`);
    console.log(`REAL_HLS_SMOKE_HISTORY_TAIL_VERBOSE=${JSON.stringify(historyTail)}`);
  }
}

function assertCompletedResult(result) {
  if (result.latest?.job?.status !== "completed") {
    throw new Error(`HLS smoke did not complete: ${JSON.stringify(result.latest?.job)}`);
  }
  const sourceSegments = result.transcriptResponse?.transcript?.source || [];
  const sourceText = JSON.stringify(sourceSegments).toLowerCase();
  if (!sourceText.includes("hello") || !sourceText.includes("local segmented audio")) {
    throw new Error(
      `HLS ASR transcript missing expected synthetic speech markers: source_segments=${sourceSegments.length}; source_chars=${sourceText.length}`
    );
  }
  const translatedSegments = result.transcriptResponse?.transcript?.translated || [];
  const translatedText = JSON.stringify(translatedSegments);
  if (!/[\u4e00-\u9fff]/.test(translatedText)) {
    throw new Error(
      `HLS translation missing Chinese output: translated_segments=${translatedSegments.length}; translated_chars=${translatedText.length}`
    );
  }
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveCommand(command) {
  try {
    return execSync(`command -v ${command}`, { encoding: "utf8", shell: "/bin/zsh" }).trim();
  } catch {
    throw new Error(`Missing required command: ${command}`);
  }
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, "playwright"));
  }
}
