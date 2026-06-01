import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sidepanel = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
const background = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");
const backgroundProfiles = loadBackgroundModelProfiles();
const sidepanelProfiles = loadSidepanelProfiles();
const sidepanelHtml = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8"));

assert.equal(constNumber(sidepanel, "MODEL_SETTINGS_VERSION"), constNumber(background, "MODEL_SETTINGS_VERSION"));
assert.equal(sidepanelProfiles.DEFAULT_ASR_PROFILE_ID, backgroundProfiles.DEFAULT_ASR_PROFILE_ID);
assert.equal(sidepanelProfiles.DEFAULT_LLM_PROFILE_ID, backgroundProfiles.DEFAULT_LLM_PROFILE_ID);
assert.deepEqual(sidepanelProfiles.KNOWN_ASR_PROFILES, backgroundProfiles.KNOWN_ASR_PROFILES);
assert.deepEqual(sidepanelProfiles.KNOWN_LLM_PROFILES, backgroundProfiles.KNOWN_LLM_PROFILES);

const asrProfiles = backgroundProfiles.KNOWN_ASR_PROFILES;
const llmProfiles = backgroundProfiles.KNOWN_LLM_PROFILES;
assert.ok(asrProfiles.some(profile => profile.id === backgroundProfiles.DEFAULT_ASR_PROFILE_ID));
assert.ok(llmProfiles.some(profile => profile.id === backgroundProfiles.DEFAULT_LLM_PROFILE_ID));
assert.equal(llmProfiles.length, 5);
const defaultLlmProfile = llmProfiles.find(profile => profile.id === backgroundProfiles.DEFAULT_LLM_PROFILE_ID);
assert.equal(defaultLlmProfile.id, "openai_custom");
assert.equal(defaultLlmProfile.name, "自定义档案");
assert.equal(defaultLlmProfile.providerType, "openai");
assert.equal(defaultLlmProfile.baseUrl, "");
assert.equal(defaultLlmProfile.model, "");
assert.deepEqual(
  llmProfiles.filter(profile => profile.id !== backgroundProfiles.DEFAULT_LLM_PROFILE_ID).map(profile => ({
    id: profile.id,
    providerType: profile.providerType,
    baseUrl: profile.baseUrl,
    model: profile.model
  })),
  [
    {
      id: "siliconflow_llm",
      providerType: "openai",
      baseUrl: "https://api.siliconflow.cn/v1",
      model: "deepseek-ai/DeepSeek-V4-Flash"
    },
    {
      id: "bailian_llm",
      providerType: "openai",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.7-max"
    },
    {
      id: "volcengine_llm",
      providerType: "openai",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      model: "doubao-seed-2-0-lite-260428"
    },
    {
      id: "openrouter_llm",
      providerType: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash:free"
    }
  ]
);
assert.equal(asrProfiles.every(profile => profile.apiKey === ""), true);
assert.equal(llmProfiles.every(profile => profile.apiKey === ""), true);
assert.equal(asrProfiles.every(profile => ["auto", "on", "off"].includes(profile.vadFilter)), true);

const defaultSettings = constObject(background, "DEFAULT_MODEL_SETTINGS");
assert.equal(defaultSettings.chunkMinutes, 15);
assert.equal(defaultSettings.webFfmpegPerformance, "auto");
assert.equal(constExpression(background, "BROWSER_ASR_UPLOAD_CHUNK_SECONDS"), 15 * 60);
assert.equal(constExpression(background, "BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS"), 30 * 60);
assert.equal(constExpression(background, "BROWSER_ASR_MAX_UPLOAD_BYTES"), 25 * 1024 * 1024);
assert.deepEqual(selectOptionValues(sidepanelHtml, "asrVadFilter"), ["auto", "on", "off"]);
assert.deepEqual(selectOptionValues(sidepanelHtml, "webFfmpegPerformance"), ["auto", "stable", "fast"]);
assert.ok(
  cspSourceList(manifest.content_security_policy.extension_pages, "connect-src").includes("file:"),
  "extension_pages connect-src must allow file: so local media files can be fetched after the user enables file URL access"
);

function constNumber(source, name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `${name} number constant missing`);
  return Number(match[1]);
}

function loadSidepanelProfiles() {
  const profileSource = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel-profiles.js", import.meta.url), "utf8");
  const context = vm.createContext({ URL, Map, Set, Date, String, Boolean, Number, Array, Object });
  vm.runInContext(profileSource, context, { filename: "sidepanel-profiles.js" });
  return JSON.parse(JSON.stringify(vm.runInContext("FuguangSidepanelProfiles", context)));
}

function constExpression(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(match, `${name} expression constant missing`);
  return vm.runInNewContext(match[1], {});
}

function constObject(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  assert.ok(match, `${name} object constant missing`);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${match[1]})`, {})));
}

function selectOptionValues(html, id) {
  const selectMatch = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`));
  assert.ok(selectMatch, `${id} select missing`);
  return Array.from(selectMatch[1].matchAll(/<option\s+value="([^"]+)"/g), match => match[1]);
}

function cspSourceList(policy, directiveName) {
  const directive = String(policy || "")
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${directiveName} `));
  assert.ok(directive, `${directiveName} directive missing`);
  return directive.split(/\s+/).slice(1);
}

function loadBackgroundModelProfiles() {
  const languageSource = fs.readFileSync(new URL("../../extension/src/background/browser-language.js", import.meta.url), "utf8")
    .replace("export const FuguangBrowserLanguage =", "var FuguangBrowserLanguage =");
  const asrProviderSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-provider.js", import.meta.url), "utf8")
    .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n\n', "")
    .replace("export const FuguangBrowserAsrProvider =", "var FuguangBrowserAsrProvider =");
  const profileSource = fs.readFileSync(new URL("../../extension/src/background/browser-model-profiles.js", import.meta.url), "utf8")
    .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n\n', "")
    .replace("export const FuguangBrowserModelProfiles =", "var FuguangBrowserModelProfiles =");
  const context = vm.createContext({ URL, Map, Set, String, Boolean, Number, Array, Object });
  vm.runInContext(languageSource, context, { filename: "browser-language.js" });
  vm.runInContext(asrProviderSource, context, { filename: "browser-asr-provider.js" });
  vm.runInContext(profileSource, context, { filename: "browser-model-profiles.js" });
  return JSON.parse(JSON.stringify(context.FuguangBrowserModelProfiles));
}
