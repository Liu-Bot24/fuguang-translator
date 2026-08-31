import { execSync } from "node:child_process";
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
const asrLanguageFields = [];
const server = http.createServer(handleRequest);
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-e2e-"));

try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const result = await runExtensionSmoke(origin);
  console.log(`SMOKE_STATUS=${result.latest?.job?.status}`);
  console.log(`SMOKE_STAGE=${result.latest?.job?.stage}`);
  console.log(`SMOKE_ERROR=${result.latest?.job?.error || ""}`);
  console.log(`SMOKE_SOURCE=${JSON.stringify(result.transcriptResponse?.transcript?.source || [])}`);
  console.log(`SMOKE_TRANSLATED=${JSON.stringify(result.transcriptResponse?.transcript?.translated || [])}`);
  console.log(`SMOKE_VTT=${JSON.stringify(result.vttResponse?.vtt || "")}`);
  console.log(`ASR_CALLS=${asrCalls}`);
  console.log(`ASR_LANGUAGES=${JSON.stringify(asrLanguageFields)}`);
  console.log(`LLM_CALLS=${llmCalls}`);
  console.log(`OPENAPI_CALLS=${openApiCalls}`);
  if (result.latest?.job?.status !== "completed") {
    throw new Error(`job did not complete: ${JSON.stringify(result.latest?.job)}`);
  }
  if (!String(result.vttResponse?.vtt || "").includes("你好，烟测")) {
    throw new Error("translated VTT missing expected text");
  }
  if (asrCalls !== 1) {
    throw new Error(`expected one ASR call, got ${asrCalls}`);
  }
  if (JSON.stringify(asrLanguageFields) !== JSON.stringify(["en"])) {
    throw new Error(`expected ASR language en, got ${JSON.stringify(asrLanguageFields)}`);
  }
  if (llmCalls !== 1) {
    throw new Error(`expected one LLM call, got ${llmCalls}`);
  }
  if (openApiCalls !== 0) {
    throw new Error(`expected no OpenAPI probe with vad off, got ${openApiCalls}`);
  }
  if (result.durableJob?.id !== result.latest?.job?.id || result.durableJob?.runToken !== result.latest?.job?.runToken) {
    throw new Error(`durable job ledger mismatch: ${JSON.stringify(result.durableJob)}`);
  }
  if (JSON.stringify(result.durableJob).includes("smoke-key")) {
    throw new Error("durable job ledger leaked model credentials");
  }
} finally {
  server.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

async function runExtensionSmoke(origin) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: chromiumHeadless,
    executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined,
    ignoreDefaultArgs: ["--disable-extensions"],
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
      await chrome.storage.local.set({
        modelSettingsVersion: 5,
        selectedAsrProfileId: "smoke_asr",
        selectedLlmProfileId: "smoke_llm",
        asrProfiles: [{
          id: "smoke_asr",
          name: "Smoke ASR",
          providerType: "openai",
          baseUrl: `${smokeOrigin}/asr/v1`,
          model: "smoke-asr",
          vadFilter: "off",
          apiKey: "smoke-key"
        }],
        llmProfiles: [{
          id: "smoke_llm",
          name: "Smoke LLM",
          providerType: "openai",
          baseUrl: `${smokeOrigin}/llm/v1`,
          model: "smoke-llm",
          apiKey: "smoke-key"
        }],
        targetLanguage: "zh-CN",
        sourceLanguage: "en",
        asrWorkers: 1,
        translationWorkers: 1,
        chunkMinutes: 15
      });
      const [tab] = await chrome.tabs.query({ url: `${smokeOrigin}/page.html` });
      if (!tab?.id) {
        throw new Error("smoke page tab not found");
      }
      const start = await chrome.runtime.sendMessage({
        type: "FUGUANG_START_PRELOAD_AUTO",
        tabId: tab.id,
        candidate: {
          url: `${smokeOrigin}/tone.wav`,
          pageUrl: `${smokeOrigin}/page.html`,
          kind: "audio",
          role: "audio",
          ext: "wav",
          contentType: "audio/wav",
          fileName: "tone.wav",
          duration: 2
        }
      });
      if (!start?.ok || !start.job?.id) {
        throw new Error(`start failed: ${JSON.stringify(start)}`);
      }
      let latest = start;
      for (let index = 0; index < 90; index += 1) {
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
      await new Promise(resolve => setTimeout(resolve, 50));
      const durableJob = await new Promise((resolve, reject) => {
        const request = indexedDB.open("liusheng-job-runtime");
        request.onerror = () => reject(request.error || new Error("job ledger database failed to open"));
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("jobs", "readonly");
          const getRequest = transaction.objectStore("jobs").get(start.job.id);
          getRequest.onerror = () => reject(getRequest.error || new Error("durable job read failed"));
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
            db.close();
          };
        };
      });
      return { start, latest, transcriptResponse, vttResponse, durableJob };
    }, { origin });
    return result;
  } finally {
    await context.close().catch(() => {});
  }
}

function handleRequest(request, response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "authorization, content-type");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.url === "/page.html") {
    response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
    response.end("<!doctype html><meta charset=\"utf-8\"><title>Fuguang smoke</title><audio controls src=\"/tone.wav\"></audio>");
    return;
  }
  if (request.url === "/tone.wav") {
    const wav = wavBuffer({ seconds: 2 });
    response.writeHead(200, { "content-type": "audio/wav", "content-length": wav.length });
    response.end(wav);
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
        text: "hello smoke",
        segments: [{ id: 0, start: 0.2, end: 1.6, text: "hello smoke" }]
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
        choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, text: "你好，烟测" }] }) } }]
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
