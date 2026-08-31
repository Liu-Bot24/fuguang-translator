import assert from "node:assert/strict";
import fs from "node:fs";

const extensionRoot = new URL("../../extension/", import.meta.url);
const manifest = readJson(new URL("manifest.json", extensionRoot));
const requiredLocales = ["zh_CN", "zh_TW", "en", "ja", "ko", "es", "pt_BR", "hi", "id"];
const requiredMessageKeys = ["appName", "appShortName", "appDescription", "actionTitle"];

assert.equal(manifest.default_locale, "zh_CN");
assert.equal(manifest.name, "__MSG_appName__");
assert.equal(manifest.short_name, "__MSG_appShortName__");
assert.equal(manifest.description, "__MSG_appDescription__");
assert.equal(manifest.action.default_title, "__MSG_actionTitle__");
assert.equal(
  manifest.permissions.includes("unlimitedStorage"),
  true,
  "durable IndexedDB and CacheStorage replay evidence must be protected from quota eviction"
);

const localeDirs = fs
  .readdirSync(new URL("_locales/", extensionRoot), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
assert.deepEqual(localeDirs, [...requiredLocales].sort());

for (const locale of requiredLocales) {
  const messages = readJson(new URL(`_locales/${locale}/messages.json`, extensionRoot));
  for (const key of requiredMessageKeys) {
    assert.equal(typeof messages[key]?.message, "string", `${locale}.${key} message missing`);
    assert.ok(messages[key].message.trim(), `${locale}.${key} message empty`);
  }
  assert.ok(messages.appName.message.length <= 75, `${locale} appName is too long for Chrome manifest`);
  assert.ok(messages.appDescription.message.length <= 132, `${locale} appDescription is too long for Chrome manifest`);
}

const zhCN = readJson(new URL("_locales/zh_CN/messages.json", extensionRoot));
assert.equal(
  zhCN.appName.message,
  "流声字幕 - 基于 ASR 与大语言模型的流媒体影视、动漫生肉视频字幕生成与翻译"
);

function readJson(url) {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}
