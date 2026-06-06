import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

{
  const html = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.css", import.meta.url), "utf8");
  const background = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");
  for (const [, body] of js.matchAll(/chrome\.storage\.sync\.set\(\{([\s\S]*?)\}\)/g)) {
    assert.equal(/asrApiKey|llmApiKey|apiKey/.test(body), false);
  }
  assert.ok(!html.includes('id="exportDiagnostics"'), "diagnostics export must not be exposed in the sidepanel UI");
  assert.ok(!js.includes('document.querySelector("#exportDiagnostics")'), "sidepanel must not bind a diagnostics export button");
  assert.ok(!js.includes("GET_PRELOAD_DIAGNOSTICS"), "diagnostics message should stay out of the user-facing sidepanel");
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('role="tab"'));
  assert.ok(html.includes('aria-selected="true"'));
  assert.ok(html.includes('role="status"'));
  assert.match(html, /id="subtitleNotice"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.ok(html.includes('href="https://blog.liu-qi.cn/tools"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(css.includes("focus-visible"), "keyboard focus state missing");
  assert.equal(
    /id="subtitleModeToggle"[^>]*aria-pressed/.test(html),
    false,
    "three-state subtitle mode toggle should not expose binary aria-pressed"
  );
  assert.ok(css.includes("appearance: none"), "button/input rendering should not depend on OS defaults");
  assert.ok(html.includes('id="sourceLanguage"'), "source language selector missing");
  assert.equal(html.includes('id="asrVocabularyId"'), false, "Fun-ASR hotword vocabulary id should not be exposed to users");
  assert.ok(html.includes('data-i18n="funAsrLongFileHint"'), "Fun-ASR long-file concurrency hint missing");
  assert.ok(
    html.indexOf('id="sourceLanguage"') < html.indexOf('id="startPreload"'),
    "source language selector should sit near the task start controls"
  );
  assert.ok(js.includes('sourceLanguage: document.querySelector("#sourceLanguage")'));
  assert.equal(js.includes('asrVocabularyId: document.querySelector("#asrVocabularyId")'), false);
  assert.ok(js.includes("sourceLanguage: getSourceLanguageValue()"));
  assert.equal(
    js.match(/const MODEL_SETTINGS_VERSION = (\d+);/)?.[1],
    background.match(/const MODEL_SETTINGS_VERSION = (\d+);/)?.[1]
  );
  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
  const queriedIds = [...js.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map(match => match[1]).sort();
  assert.deepEqual(htmlIds, queriedIds);
  const webFfmpegHtml = fs.readFileSync(new URL("../../extension/web-ffmpeg/index.html", import.meta.url), "utf8");
  const webFfmpegJs = fs.readFileSync(new URL("../../extension/web-ffmpeg/src/app.js", import.meta.url), "utf8");
  const webFfmpegHtmlIds = [...webFfmpegHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
  const webFfmpegQueriedIds = [...webFfmpegJs.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map(match => match[1]).sort();
  assert.deepEqual(webFfmpegHtmlIds, webFfmpegQueriedIds);
  const literalClasses = new Set([
    ...[...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/className\s*=\s*"([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/classList\.(?:add|remove|toggle|contains)\("([^"]+)"\)/g)].map(match => match[1])
  ]);
  const dynamicCssClasses = new Set([
    "asr",
    "chunk",
    "completed",
    "completed_with_warnings",
    "cue-delete",
    "cue-edit-button",
    "cue-text-edit",
    "cue-time-edit",
    "cue-time-row",
    "done",
    "editable",
    "editing",
    "failed",
    "stage",
    "stage-cancelled",
    "stage-completed_with_warnings",
    "stage-error",
    "stage-failed",
    "subtitles-focus",
    "subtitle-text-row",
    "translated",
    "translation"
  ]);
  const cssClasses = [...new Set([...css.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)].map(match => match[1]))];
  const orphanCssClasses = cssClasses.filter(name => !literalClasses.has(name) && !dynamicCssClasses.has(name));
  assert.deepEqual(orphanCssClasses, []);
  const htmlClasses = [...new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)))];
  const jsClasses = new Set([
    ...[...js.matchAll(/className\s*=\s*"([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/classList\.(?:add|remove|toggle|contains)\("([^"]+)"\)/g)].map(match => match[1])
  ]);
  const cssClassSet = new Set(cssClasses);
  const unusedHtmlClasses = htmlClasses.filter(name => !cssClassSet.has(name) && !jsClasses.has(name));
  assert.deepEqual(unusedHtmlClasses, []);
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.textContent = "";
    this.hidden = false;
    this.value = "";
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.className = "";
    this.listeners = new Map();
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this._classes.add(name)),
      remove: (...names) => names.forEach(name => this._classes.delete(name)),
      toggle: (name, force) => {
        if (force === true) {
          this._classes.add(name);
          return true;
        }
        if (force === false) {
          this._classes.delete(name);
          return false;
        }
        if (this._classes.has(name)) {
          this._classes.delete(name);
          return false;
        }
        this._classes.add(name);
        return true;
      },
      contains: name => this._classes.has(name)
    };
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  setAttribute(name, value) {
    this[name] = String(value);
  }
  append(...children) {
    this.children.push(...children);
  }
  appendChild(child) {
    this.children.push(child);
  }
  replaceChildren(...children) {
    this.children = children;
    this.textContent = "";
  }
  querySelector(selector) {
    const cueMatch = String(selector).match(/^\.cue\[data-index="(-?\d+)"\]$/);
    if (!cueMatch) {
      return null;
    }
    const target = cueMatch[1];
    return this.children.find(child => child.className === "cue" && child.dataset?.index === target) || null;
  }
  querySelectorAll(selector) {
    if (selector === ".cue.active") {
      return this.children.filter(child => child.className === "cue" && child.classList.contains("active"));
    }
    return [];
  }
  scrollIntoView(options) {
    this.scrolledIntoView = options || true;
  }
  removeAttribute(name) {
    delete this[name];
  }
  click() {
    this.listeners.get("click")?.();
  }
}

const elementBySelector = new Map();
const document = {
  addEventListener: () => {},
  querySelector(selector) {
    if (!elementBySelector.has(selector)) {
      elementBySelector.set(selector, new FakeElement(selector));
    }
    return elementBySelector.get(selector);
  },
  createElement(tagName) {
    return new FakeElement(tagName);
  }
};

const chrome = {
  runtime: { sendMessage: async () => ({ ok: true }) },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {}
    },
    sync: {
      get: async () => ({}),
      set: async () => {}
    }
  },
  tabs: {
    query: async () => [{ id: 1, title: "Video", url: "https://example.test/watch/1" }]
  }
};

const context = vm.createContext({
  chrome,
  console,
  document,
  window: {
    setInterval,
    clearInterval
  },
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
  TextEncoder,
  crypto: {
    subtle: {
      digest: async (_algorithm, bytes) => {
        const input = new Uint8Array(bytes);
        const output = new Uint8Array(32);
        for (let index = 0; index < input.length; index += 1) {
          output[index % output.length] = (output[index % output.length] + input[index] + index) % 256;
        }
        return output.buffer;
      }
    }
  },
  FuguangSubtitleFormat: {
    parseSubtitleImportText: () => ({ transcript: { source: [], translated: [] }, metadata: {} })
  }
});

const source = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
const subtitleOutputSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-output.js", import.meta.url), "utf8");
const cacheUtilsSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-cache-utils.js", import.meta.url), "utf8");
const cacheStoreSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-cache-store.js", import.meta.url), "utf8");
const languageSource = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel-language.js", import.meta.url), "utf8");
const profilesSource = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel-profiles.js", import.meta.url), "utf8");
vm.runInContext(subtitleOutputSource, context, { filename: "subtitle-output.js" });
vm.runInContext(cacheUtilsSource, context, { filename: "subtitle-cache-utils.js" });
vm.runInContext(cacheStoreSource, context, { filename: "subtitle-cache-store.js" });
vm.runInContext(languageSource, context, { filename: "sidepanel-language.js" });
vm.runInContext(profilesSource, context, { filename: "sidepanel-profiles.js" });
vm.runInContext(source, context, { filename: "sidepanel.js" });

const scopedStatusMessagesState = await vm.runInContext(`
  (async () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    elements.message.textContent = "";
    elements.taskMessage.textContent = "";
    elements.taskMessage.hidden = true;

    setSettingsMessage(t("settingsSaved"));
    const afterSettings = {
      settingsMessage: elements.message.textContent,
      taskMessage: elements.taskMessage.textContent,
      taskHidden: elements.taskMessage.hidden
    };

    elements.message.textContent = "设置已保存。新任务会使用当前配置。";
    elements.taskMessage.textContent = "";
    elements.taskMessage.hidden = true;
    candidates = [];
    renderedCandidateSignature = "";
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return { ok: true, candidates: [] };
      }
      return { ok: true };
    };
    try {
      await refreshCandidates({ skipActivate: true });
      return {
        afterSettings,
        afterTask: {
          settingsMessage: elements.message.textContent,
          taskMessage: elements.taskMessage.textContent,
          taskHidden: elements.taskMessage.hidden,
          summary: elements.candidateSummary.textContent
        }
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(scopedStatusMessagesState)), {
  afterSettings: {
    settingsMessage: "设置已保存。新任务会使用当前配置。",
    taskMessage: "",
    taskHidden: true
  },
  afterTask: {
    settingsMessage: "设置已保存。新任务会使用当前配置。",
    taskMessage: "",
    taskHidden: true,
    summary: "还没有发现可抽取的媒体源。"
  }
});

const result = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "job-1";
    renderedSubtitleJobId = "job-1";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "旧字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "旧字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:test", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:test";
    subtitleLoadRequestId = 10;
    pendingSubtitlePromise = Promise.resolve({ cues: [{ start: 9, end: 10, text: "迟到字幕" }], source: "vtt", transcript: null });
    pendingSubtitleSignature = "old-load";
    elements.subtitleList.textContent = "旧字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:test";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async ids => ids.includes("subtitle:test") ? 1 : 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.detached = true;
    };
    setMessage = text => {
      globalThis.lastMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();

      return {
        detached: Boolean(globalThis.detached),
        message: globalThis.lastMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null,
        subtitleLoadRequestId,
        pendingSubtitlePromise,
        pendingSubtitleSignature
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      setMessage = originalSetMessage;
    }
  })()
`, context);

assert.equal(result.message, "已清除当前页面字幕缓存（1 条）。");
assert.equal(result.detached, true);
assert.equal(result.listText, "已清除当前页面字幕缓存。");
assert.equal(result.cuesLength, 0);
assert.equal(result.renderedSubtitleJobId, "");
assert.equal(result.currentTranscriptIsNull, true);
assert.equal(result.subtitleLoadRequestId, 11);
assert.equal(result.pendingSubtitlePromise, null);
assert.equal(result.pendingSubtitleSignature, "");

const clearCacheDetachesEvenWhenSuppressFailsState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "job-suppress-fails";
    renderedSubtitleJobId = "job-suppress-fails";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "缓存字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "缓存字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:suppress-fails", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:suppress-fails";
    elements.subtitleList.textContent = "缓存字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:suppress-fails";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async ids => ids.includes("subtitle:suppress-fails") ? 1 : 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.detachedAfterSuppressFailure = true;
    };
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE) {
        return { ok: false, error: "后台测试失败" };
      }
      return { ok: true };
    };
    setMessage = text => {
      globalThis.lastSuppressFailureMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.detachedAfterSuppressFailure),
        message: globalThis.lastSuppressFailureMessage,
        cuesLength: subtitleCues.length,
        currentTranscriptIsNull: currentTranscript === null
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      delete globalThis.detachedAfterSuppressFailure;
      delete globalThis.lastSuppressFailureMessage;
    }
  })()
`, context);

assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.detached, true);
assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.cuesLength, 0);
assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.currentTranscriptIsNull, true);
assert.match(clearCacheDetachesEvenWhenSuppressFailsState.message, /已清除当前页面字幕缓存/);
assert.match(clearCacheDetachesEvenWhenSuppressFailsState.message, /页面状态同步失败/);

const clearMissingDisplayedCacheState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "";
    renderedSubtitleJobId = "cache-subtitle:missing";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "已显示缓存字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "已显示缓存字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:missing", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:missing";
    subtitleLoadRequestId = 20;
    elements.subtitleList.textContent = "已显示缓存字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:missing";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async () => 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.missingDisplayedCacheDetached = true;
    };
    chrome.runtime.sendMessage = async () => ({ ok: true });
    setMessage = text => {
      globalThis.lastMissingDisplayedCacheMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.missingDisplayedCacheDetached),
        message: globalThis.lastMissingDisplayedCacheMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null,
        currentSubtitleCacheEntry,
        cachedSubtitleLoadedKey,
        subtitleLoadRequestId
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      delete globalThis.missingDisplayedCacheDetached;
      delete globalThis.lastMissingDisplayedCacheMessage;
    }
  })()
`, context);

assert.equal(clearMissingDisplayedCacheState.detached, true);
assert.match(clearMissingDisplayedCacheState.message, /没有已保存的字幕缓存/);
assert.match(clearMissingDisplayedCacheState.message, /已清除当前显示/);
assert.equal(clearMissingDisplayedCacheState.listText, "已清除当前页面字幕缓存。");
assert.equal(clearMissingDisplayedCacheState.cuesLength, 0);
assert.equal(clearMissingDisplayedCacheState.renderedSubtitleJobId, "");
assert.equal(clearMissingDisplayedCacheState.currentTranscriptIsNull, true);
assert.equal(clearMissingDisplayedCacheState.currentSubtitleCacheEntry, null);
assert.equal(clearMissingDisplayedCacheState.cachedSubtitleLoadedKey, "");
assert.equal(clearMissingDisplayedCacheState.subtitleLoadRequestId, 21);

const clearMissingNonCacheDisplayState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "running-job";
    currentJob = { id: "running-job", status: "running", stage: "translation", translation: { segmentCount: 1 } };
    renderedSubtitleJobId = "running-job";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "运行中字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "运行中字幕" }] };
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    elements.subtitleList.textContent = "运行中字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:missing-running";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async () => 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.missingNonCacheDetached = true;
    };
    setMessage = text => {
      globalThis.lastMissingNonCacheMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.missingNonCacheDetached),
        message: globalThis.lastMissingNonCacheMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      setMessage = originalSetMessage;
      delete globalThis.missingNonCacheDetached;
      delete globalThis.lastMissingNonCacheMessage;
    }
  })()
`, context);

assert.equal(clearMissingNonCacheDisplayState.detached, true);
assert.equal(clearMissingNonCacheDisplayState.message, "当前页面没有已保存的字幕缓存，已清除当前显示的缓存字幕。");
assert.equal(clearMissingNonCacheDisplayState.listText, "已清除当前页面字幕缓存。");
assert.equal(clearMissingNonCacheDisplayState.cuesLength, 0);
assert.equal(clearMissingNonCacheDisplayState.renderedSubtitleJobId, "");
assert.equal(clearMissingNonCacheDisplayState.currentTranscriptIsNull, true);

const clearCompletedNonCacheDisplayState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "completed-job";
    currentJob = { id: "completed-job", status: "completed", stage: "completed", translation: { segmentCount: 1 } };
    renderedSubtitleJobId = "completed-job";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "已完成字幕" }];
    currentTranscript = {
      source: [{ start: 1, end: 2, text: "こんにちは" }],
      translated: [{ start: 1, end: 2, text: "已完成字幕" }]
    };
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    elements.subtitleList.textContent = "已完成字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    const sent = [];
    buildSubtitleCacheKeyForCurrentPage = async () => "";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async () => 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.completedNonCacheDetached = true;
    };
    chrome.runtime.sendMessage = async message => {
      sent.push(message);
      return { ok: true };
    };
    setMessage = text => {
      globalThis.lastCompletedNonCacheMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        sentTypes: sent.map(message => message.type),
        sentJobIds: sent.map(message => message.jobId || ""),
        detached: Boolean(globalThis.completedNonCacheDetached),
        message: globalThis.lastCompletedNonCacheMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      delete globalThis.completedNonCacheDetached;
      delete globalThis.lastCompletedNonCacheMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(clearCompletedNonCacheDisplayState.sentTypes)), ["FUGUANG_CLEAR_PRELOAD_SUBTITLE_STATE"]);
assert.deepEqual(JSON.parse(JSON.stringify(clearCompletedNonCacheDisplayState.sentJobIds)), ["completed-job"]);
assert.equal(clearCompletedNonCacheDisplayState.detached, true);
assert.match(clearCompletedNonCacheDisplayState.message, /已清除当前显示/);
assert.equal(clearCompletedNonCacheDisplayState.listText, "已清除当前页面字幕缓存。");
assert.equal(clearCompletedNonCacheDisplayState.cuesLength, 0);
assert.equal(clearCompletedNonCacheDisplayState.renderedSubtitleJobId, "");
assert.equal(clearCompletedNonCacheDisplayState.currentTranscriptIsNull, true);

const audioButtonState = await vm.runInContext(`
  (() => {
    startRequestInFlight = false;
    retryRequestInFlight = false;
    const job = {
      id: "browser-cleared-job",
      status: "completed",
      audioCacheRemoved: true,
      translation: { chunksFailed: 0 }
    };
    updateActionButtons(job);
    return {
      disabled: elements.clearAudioCache.disabled,
      text: elements.clearAudioCache.textContent,
      title: elements.clearAudioCache.title
    };
  })()
`, context);

assert.equal(audioButtonState.disabled, false);
assert.equal(audioButtonState.text, "清音频缓存");
assert.match(audioButtonState.title, /浏览器音频缓存/);
assert.match(audioButtonState.title, /字幕缓存不受影响/);
assert.doesNotMatch(audioButtonState.title, /本机音频切片/);

const elapsedTextState = await vm.runInContext(`
  (() => ({
    positive: formatElapsedSeconds(123.48),
    zero: formatElapsedSeconds(0),
    negative: formatElapsedSeconds(-1)
  }))()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(elapsedTextState)), {
  positive: "123s",
  zero: "0s",
  negative: "0s"
});

const completedJobDisplayState = await vm.runInContext(`
  (() => ({
    completedTopStatus: statusLabel({ preload: "completed", preloadJob: { status: "completed" } }),
    warningTopStatus: statusLabel({ preload: "completed", preloadJob: { status: "completed", stage: "completed_with_warnings" } }),
    failedTopStatus: statusLabel({ preload: "failed", preloadJob: { status: "failed" } }),
    cancelledTopStatus: statusLabel({ preload: "cancelled", preloadJob: { status: "cancelled" } }),
    runningTopStatus: statusLabel({ preload: "running", preloadJob: { status: "running" } }),
    idleTopStatus: statusLabel({ preload: "idle" }),
    warningJobTitle: jobTitle({ status: "completed", stage: "completed_with_warnings" }),
    retryTranslationJobTitle: jobTitle({ status: "running", stage: "retry_translation" }),
    retryTranslationStage: stageLabel("retry_translation"),
    translationStage: stageLabel("translation"),
    unknownStage: stageLabel("retry_translation_unmapped"),
    unknownChunkStage: chunkStageLabel("retry_translation_unmapped"),
    completedStep: extractionActivityText({ status: "completed", message: "正在用 Web FFmpeg 提取音频" }),
    completedPhaseStep: extractionActivityText({ phase: "completed", message: "正在用 Web FFmpeg 提取音频" }),
    doneStep: extractionActivityText({ status: "done", message: "较旧的抽取进度" }),
    runningStep: extractionActivityText({ status: "running", message: "正在用 Web FFmpeg 提取音频" })
  }))()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(completedJobDisplayState)), {
  completedTopStatus: "字幕已完成",
  warningTopStatus: "完成，有警告",
  failedTopStatus: "任务失败",
  cancelledTopStatus: "任务已停止",
  runningTopStatus: "处理中",
  idleTopStatus: "待机",
  warningJobTitle: "完成，有警告",
  retryTranslationJobTitle: "正在重新翻译字幕，不会重新识别音频...",
  retryTranslationStage: "重翻译",
  translationStage: "翻译",
  unknownStage: "处理中",
  unknownChunkStage: "待识别",
  completedStep: "完成",
  completedPhaseStep: "完成",
  doneStep: "完成",
  runningStep: "正在用 Web FFmpeg 提取音频"
});

const subtitleFocusButtonState = await vm.runInContext(`
  (() => {
    currentJob = null;
    taskDetailsExpanded = false;
    subtitleDisplayMode = "translated";
    subtitleCues = [{ start: 1, end: 2, text: "缓存字幕" }];
    elements.toggleTaskDetails.hidden = true;
    elements.taskPanel.classList.remove("subtitles-focus");
    updateTaskPanelFocus(currentJob);
    const cacheSubtitleState = {
      hidden: elements.toggleTaskDetails.hidden,
      text: elements.toggleTaskDetails.textContent,
      focus: elements.taskPanel.classList.contains("subtitles-focus")
    };

    subtitleCues = [];
    elements.toggleTaskDetails.hidden = false;
    updateTaskPanelFocus(currentJob);
    const emptyState = {
      hidden: elements.toggleTaskDetails.hidden,
      focus: elements.taskPanel.classList.contains("subtitles-focus")
    };

    updateTaskPanelFocus({
      status: "completed",
      subtitleCleared: true,
      translation: { segmentCount: 2, chunksFailed: 0 }
    });
    const clearedJobState = {
      hidden: elements.toggleTaskDetails.hidden,
      focus: elements.taskPanel.classList.contains("subtitles-focus")
    };

    return { cacheSubtitleState, emptyState, clearedJobState };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleFocusButtonState)), {
  cacheSubtitleState: {
    hidden: false,
    text: "展开任务",
    focus: true
  },
  emptyState: {
    hidden: true,
    focus: false
  },
  clearedJobState: {
    hidden: true,
    focus: false
  }
});

const sourcePreviewTaskFocusState = await vm.runInContext(`
  (() => {
    taskDetailsExpanded = false;
    taskDetailsManuallyCollapsed = false;
    subtitleDisplayMode = "translated";
    currentTranscript = {
      source: [{ start: 1, end: 2, text: "原文", chunkIndex: 0, segmentIndex: 0 }],
      translated: []
    };
    subtitleCues = [{ start: 1, end: 2, text: "原文", sourceText: "原文", sourceOnly: true }];
    elements.taskPanel.classList.remove("subtitles-focus");
    updateTaskPanelFocus({
      status: "completed",
      stage: "completed",
      translation: { segmentCount: 1, translatedSegments: 0, chunksFailed: 0 }
    });
    const initial = {
      hidden: elements.toggleTaskDetails.hidden,
      text: elements.toggleTaskDetails.textContent,
      focus: elements.taskPanel.classList.contains("subtitles-focus")
    };
    toggleTaskDetails();
    const collapsed = {
      hidden: elements.toggleTaskDetails.hidden,
      text: elements.toggleTaskDetails.textContent,
      focus: elements.taskPanel.classList.contains("subtitles-focus")
    };
    return { initial, collapsed };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourcePreviewTaskFocusState)), {
  initial: {
    hidden: false,
    text: "收起任务",
    focus: false
  },
  collapsed: {
    hidden: false,
    text: "展开任务",
    focus: true
  }
});

const speakerLabelListState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "translated";
    subtitleCues = [{
      start: 1,
      end: 2,
      time: "00:00:01.000 --> 00:00:02.000",
      text: "你好",
      sourceText: "こんにちは",
      speakerLabel: "分段 1 · 说话人 1"
    }];
    renderSubtitleCueList();
    const cue = elements.subtitleList.children[0];
    const textWrap = cue.children[1];
    return {
      speakerClass: textWrap.children[0].className,
      speakerText: textWrap.children[0].textContent,
      subtitleText: textWrap.children[1].children[0].textContent
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(speakerLabelListState)), {
  speakerClass: "subtitle-speaker",
  speakerText: "分段 1 · 说话人 1",
  subtitleText: "你好"
});

const refreshCompletedJobStatusState = await vm.runInContext(`
  (async () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalTabsQuery = chrome.tabs.query;
    chrome.tabs.query = async () => [{ id: 1, title: "Video", url: "https://example.test/watch/1" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.GET_STATUS) {
        return {
          ok: true,
          preload: "running",
          preloadJob: null,
          page: { title: "Video", url: "https://example.test/watch/1" },
          candidates: []
        };
      }
      if (message.type === MESSAGE.CHECK_PRELOAD_JOB) {
        return {
          ok: true,
          job: {
            id: "job-completed",
            status: "completed",
            stage: "completed",
            sourceUrl: "https://media.example.test/audio.m4s",
            progress: {
              extraction: {
                phase: "completed",
                percent: 100,
                message: "正在用 Web FFmpeg 提取音频",
                chunkSeconds: 1200
              },
              translation: {
                percent: 100,
                chunksDone: 1,
                chunksTotal: 1,
                chunkStatuses: []
              }
            },
            translation: {
              chunksDone: 1,
              chunksTotal: 1,
              chunkStatuses: []
            }
          }
        };
      }
      return { ok: true };
    };
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    lastActivatedTabKey = activeTabKey(activeTab);
    currentJobId = "job-completed";
    refreshStatusInFlight = false;
    try {
      await refreshStatus();
      const metrics = elements.jobStatus.children.find(child => child.className === "metrics");
      const currentStep = metrics.children
        .find(child => child.children[0].textContent === "当前步骤")
        .children[1].textContent;
      return {
        topStatus: elements.status.textContent,
        currentStep
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
      chrome.tabs.query = originalTabsQuery;
      refreshStatusInFlight = false;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(refreshCompletedJobStatusState)), {
  topStatus: "字幕已完成",
  currentStep: "完成"
});

const renderCompletedJobStatusState = await vm.runInContext(`
  (() => {
    elements.status.textContent = "预加载";
    renderJob({
      id: "job-render-completed",
      status: "completed",
      stage: "completed",
      sourceUrl: "https://media.example.test/audio.m4s",
      extract: {
        status: "completed",
        progress: 100,
        chunkSeconds: 1200
      },
      translation: {
        chunksDone: 1,
        chunksTotal: 1,
        chunksFailed: 0,
        segmentCount: 2,
        chunkStatuses: []
      }
    });
    return {
      topStatus: elements.status.textContent,
      startDisabled: elements.startPreload.disabled,
      stopDisabled: elements.cancelPreload.disabled
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(renderCompletedJobStatusState)), {
  topStatus: "字幕已完成",
  startDisabled: false,
  stopDisabled: true
});

const funAsrJobStatusMetricsState = await vm.runInContext(`
  (() => {
    renderJob({
      id: "job-funasr-status",
      pipeline: "funasr",
      status: "running",
      stage: "extracting",
      sourceUrl: "https://media.example.test/audio.m4s",
      extract: {
        status: "running",
        progress: 32.8,
        message: "",
        chunkSeconds: 1200,
        asrChunkSeconds: 7200
      },
      translation: {
        chunksDone: 0,
        chunksTotal: 0,
        chunksAsr: 0,
        chunksTranslating: 0,
        translationWorkers: 4,
        chunkStatuses: []
      }
    });
    const metrics = elements.jobStatus.children.find(child => child.className === "metrics");
    const values = Object.fromEntries(metrics.children.map(item => [item.children[0].textContent, item.children[1].textContent]));
    const progressRows = elements.jobStatus.children.filter(child => child.className === "progress-row");
    return {
      chunkLabel: Object.keys(values).find(label => label.includes("长文件")),
      chunkValue: values["长文件分段"],
      asrTranslationText: progressRows[1].children[0].children[1].textContent
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(funAsrJobStatusMetricsState)), {
  chunkLabel: "长文件分段",
  chunkValue: "最长 2 小时",
  asrTranslationText: "等待长文件音频"
});

const exportSubtitleState = await vm.runInContext(`
  (async () => {
    const originalDownloadBlob = downloadBlob;
    const originalSubtitleCues = subtitleCues;
    const originalPageTitle = elements.pageTitle.textContent;
    const originalActiveTab = activeTab;
    const downloads = [];
    downloadBlob = async (blob, filename) => {
      downloads.push({ filename, text: await blob.text() });
    };
    try {
      activeTab = { id: 1, title: "A/B: 视频标题?", url: "https://example.test/watch?v=source-page" };
      subtitleCues = [
        { start: 0, end: 1.5, time: "00:00:00.000 --> 00:00:01.500", sourceText: "hello", text: "你好" },
        { start: 2, end: 3, time: "00:00:02.000 --> 00:00:03.000", sourceText: "world", text: "世界" }
      ];
      subtitleDisplayMode = "bilingual";
      await exportCurrentSubtitle();
      const exportedMessage = elements.taskMessage.textContent;
      subtitleCues = [];
      await exportCurrentSubtitle();
      return {
        downloads,
        exportedMessage,
        emptyMessage: elements.taskMessage.textContent
      };
    } finally {
      downloadBlob = originalDownloadBlob;
      subtitleCues = originalSubtitleCues;
      activeTab = originalActiveTab;
      elements.pageTitle.textContent = originalPageTitle;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(exportSubtitleState)), {
  downloads: [{
    filename: "A B 视频标题.srt",
    text: [
      "NOTE",
      "Source page: https://example.test/watch?v=source-page",
      "Exported by: 流声字幕 https://blog.liu-qi.cn/tools",
      "",
      "1",
      "00:00:00,000 --> 00:00:01,500",
      "hello",
      "你好",
      "",
      "2",
      "00:00:02,000 --> 00:00:03,000",
      "world",
      "世界",
      ""
    ].join("\n")
  }],
  exportedMessage: "SRT 字幕已导出。",
  emptyMessage: "还没有可导出的字幕。"
});

const retryStageButtonState = await vm.runInContext(`
  (() => {
    startRequestInFlight = false;
    retryRequestInFlight = false;
    translationRetryRequestInFlight = false;

    updateActionButtons({
      id: "browser-resume-asr",
      status: "completed",
      reusableAudioChunks: 2,
      reusableSourceChunks: 0,
      translation: { chunksFailed: 0, chunkStatuses: [] }
    });
    const audioResume = {
      retryDisabled: elements.retryPreload.disabled,
      retryText: elements.retryPreload.textContent,
      retryTitle: elements.retryPreload.title,
      rerunAsrDisabled: elements.rerunAsr.disabled,
      rerunAsrText: elements.rerunAsr.textContent,
      rerunAsrTitle: elements.rerunAsr.title,
      translationDisabled: elements.retryTranslation.disabled
    };

    updateActionButtons({
      id: "browser-resume-translation",
      status: "completed",
      reusableAudioChunks: 2,
      reusableSourceChunks: 2,
      translation: {
        chunksFailed: 1,
        chunkStatuses: [{ index: 0, stage: "failed", sourceCount: 2, translatedCount: 0, error: "翻译失败" }]
      }
    });
    const translationResume = {
      retryDisabled: elements.retryPreload.disabled,
      retryText: elements.retryPreload.textContent,
      retryTitle: elements.retryPreload.title,
      rerunAsrDisabled: elements.rerunAsr.disabled,
      rerunAsrText: elements.rerunAsr.textContent,
      rerunAsrTitle: elements.rerunAsr.title,
      translationTitle: elements.retryTranslation.title,
      translationDisabled: elements.retryTranslation.disabled
    };

    return { audioResume, translationResume };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retryStageButtonState)), {
  audioResume: {
    retryDisabled: false,
    retryText: "继续",
    retryTitle: "从当前卡住的位置继续，不改变抽取、ASR、翻译的边界。",
    rerunAsrDisabled: false,
    rerunAsrText: "重新 ASR",
    rerunAsrTitle: "复用已抽取音频重新识别；会清除旧 ASR 原文和旧译文。",
    translationDisabled: true
  },
  translationResume: {
    retryDisabled: false,
    retryText: "继续",
    retryTitle: "从当前卡住的位置继续，不改变抽取、ASR、翻译的边界。",
    rerunAsrDisabled: false,
    rerunAsrText: "重新 ASR",
    rerunAsrTitle: "复用已抽取音频重新识别；会清除旧 ASR 原文和旧译文。",
    translationTitle: "只重新翻译已有原文。",
    translationDisabled: false
  }
});

const clearSubtitleButtonState = await vm.runInContext(`
  (() => {
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    renderedSubtitleJobId = "";
    currentTranscript = null;
    subtitleCues = [];
    updateActionButtons({
      id: "browser-no-subtitle",
      status: "completed",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const empty = elements.clearSubtitleCache.disabled;

    renderedSubtitleJobId = "browser-waiting-subtitle";
    updateActionButtons({
      id: "browser-waiting-subtitle",
      status: "running",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const waitingOnly = elements.clearSubtitleCache.disabled;

    renderedSubtitleJobId = "browser-has-subtitle";
    subtitleCues = [{ start: 1, end: 2, text: "译文" }];
    updateActionButtons({
      id: "browser-has-subtitle",
      status: "completed",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const loaded = elements.clearSubtitleCache.disabled;

    updateActionButtons({
      id: "browser-running-subtitle",
      status: "running",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const running = elements.clearSubtitleCache.disabled;

    subtitleCues = [];
    currentTranscript = null;
    updateActionButtons({
      id: "browser-job-vtt",
      status: "running",
      translation: { vttText: "WEBVTT\\n\\n00:00:01.000 --> 00:00:02.000\\n译文", chunkStatuses: [], chunksFailed: 0 }
    });
    const jobPayload = elements.clearSubtitleCache.disabled;
    return { empty, waitingOnly, loaded, running, jobPayload };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(clearSubtitleButtonState)), {
  empty: true,
  waitingOnly: true,
  loaded: false,
  running: false,
  jobPayload: false
});

const subtitleEditButtonRunningState = await vm.runInContext(`
  (() => {
    subtitleCues = [{ start: 1, end: 2, text: "译文" }];
    updateActionButtons({
      id: "browser-running-edit",
      status: "running",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const runningDisabled = elements.subtitleEditToggle.disabled;
    updateActionButtons({
      id: "browser-completed-edit",
      status: "completed",
      translation: { chunkStatuses: [], chunksFailed: 0 }
    });
    const completedDisabled = elements.subtitleEditToggle.disabled;
    return { runningDisabled, completedDisabled };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleEditButtonRunningState)), {
  runningDisabled: true,
  completedDisabled: false
});

const continueTaskButtonRouteState = await vm.runInContext(`
  (async () => {
    const sent = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch" };
    setTargetLanguageValue("zh-CN");
    currentJobId = "job-continue-translation";
    currentJob = {
      id: "job-continue-translation",
      status: "completed",
      stage: "completed_with_warnings",
      reusableSourceChunks: 1,
      reusableAudioChunks: 1,
      translation: {
        chunksFailed: 1,
        chunkStatuses: [
          { index: 0, stage: "failed", sourceCount: 12, translatedCount: 0, error: "翻译失败" }
        ]
      }
    };
    retryRequestInFlight = false;
    chrome.tabs.query = async () => [{ id: 1, title: "Video", url: "https://example.test/watch" }];
    chrome.runtime.sendMessage = async message => {
      sent.push({ type: message.type, tabId: message.tabId, targetLanguage: message.targetLanguage });
      return {
        ok: true,
        message: "继续翻译已提交",
        job: {
          id: "job-continue-translation",
          status: "running",
          stage: "retrying",
          translation: { chunkStatuses: [] }
        }
      };
    };
    try {
      await retryPreloadFromSidePanel();
      return { sent, message: elements.taskMessage.textContent };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(continueTaskButtonRouteState.sent)), [
  { type: "FUGUANG_RETRY_PRELOAD", tabId: 1 }
]);
assert.equal(continueTaskButtonRouteState.message, "继续翻译已提交");

const rerunAsrButtonRouteState = await vm.runInContext(`
  (async () => {
    const sent = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch" };
    setSourceLanguageValue("ja");
    setTargetLanguageValue("zh-CN");
    currentJobId = "job-rerun-asr";
    currentJob = {
      id: "job-rerun-asr",
      status: "completed",
      reusableSourceChunks: 1,
      reusableAudioChunks: 1,
      translation: { chunkStatuses: [{ index: 0, stage: "completed", sourceCount: 1, translatedCount: 1 }] }
    };
    asrRetryRequestInFlight = false;
    chrome.tabs.query = async () => [{ id: 1, title: "Video", url: "https://example.test/watch" }];
    chrome.runtime.sendMessage = async message => {
      sent.push({
        type: message.type,
        tabId: message.tabId,
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
        chunkIndexes: message.chunkIndexes
      });
      return {
        ok: true,
        message: "重新 ASR 已提交",
        job: {
          id: "job-rerun-asr",
          status: "running",
          stage: "retrying",
          translation: { chunkStatuses: [] }
        }
      };
    };
    try {
      await rerunAsrFromSidePanel([0]);
      return { sent, message: elements.taskMessage.textContent };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(rerunAsrButtonRouteState.sent)), [
  {
    type: "FUGUANG_RERUN_ASR_PRELOAD",
    tabId: 1,
    sourceLanguage: "ja",
    targetLanguage: "zh-CN",
    chunkIndexes: [0]
  }
]);
assert.equal(rerunAsrButtonRouteState.message, "重新 ASR 已提交");

const retranslateButtonTargetLanguageState = await vm.runInContext(`
  (async () => {
    const sent = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch" };
    setTargetLanguageValue("zh-CN");
    currentJobId = "job-retranslate-target";
    currentJob = {
      id: "job-retranslate-target",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        chunksFailed: 1,
        chunkStatuses: [
          { index: 0, stage: "failed", sourceCount: 8, translatedCount: 0, error: "翻译失败" }
        ]
      }
    };
    translationRetryRequestInFlight = false;
    chrome.tabs.query = async () => [{ id: 1, title: "Video", url: "https://example.test/watch" }];
    chrome.runtime.sendMessage = async message => {
      sent.push({
        type: message.type,
        tabId: message.tabId,
        targetLanguage: message.targetLanguage,
        chunkIndexes: message.chunkIndexes
      });
      return {
        ok: true,
        message: "重翻译已提交",
        job: {
          id: "job-retranslate-target",
          status: "running",
          stage: "retry_translation",
          translation: { chunkStatuses: [] }
        }
      };
    };
    try {
      await retryTranslationFromSidePanel([0]);
      return { sent, message: elements.taskMessage.textContent };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retranslateButtonTargetLanguageState.sent)), [
  {
    type: "FUGUANG_RETRANSLATE_PRELOAD",
    tabId: 1,
    targetLanguage: "zh-CN",
    chunkIndexes: [0]
  }
]);
assert.equal(retranslateButtonTargetLanguageState.message, "重翻译已提交");

const retryChunkTranslationOnlyTitleState = await vm.runInContext(`
  (() => {
    currentJob = {
      id: "browser-chunk-translation-title",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        chunksFailed: 1,
        chunkStatuses: [
          { index: 0, stage: "completed_with_warnings", sourceCount: 2, error: "bad translation" }
        ]
      }
    };
    renderJob(currentJob);
    const chunks = elements.jobStatus.children.find(child => child.className === "chunks");
    const row = chunks.children[0];
    const retryButton = row.children.find(child => child.className === "chunk-retry");
    return {
      text: retryButton.textContent,
      title: retryButton.title,
      disabled: retryButton.disabled
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retryChunkTranslationOnlyTitleState)), {
  text: "重翻译",
  title: "只重跑这个翻译分段。",
  disabled: false
});

const subtitleScrollState = await vm.runInContext(`
  (() => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    elements.subtitleList.replaceChildren(first, second);
    activeCueIndex = 1;

    subtitleListPointerInside = true;
    subtitleListUserControlUntil = Date.now() + 5000;
    setActiveCueIndex(0);
    const blockedAutoScroll = !first.scrolledIntoView;

    subtitleListPointerInside = true;
    subtitleListUserControlUntil = Date.now() + 5000;
    setActiveCueIndex(1, { forceScroll: true });
    return {
      blockedAutoScroll,
      forcedScroll: Boolean(second.scrolledIntoView),
      firstActiveRemoved: !first.classList.contains("active"),
      secondActive: second.classList.contains("active")
    };
  })()
`, context);

assert.equal(subtitleScrollState.blockedAutoScroll, true);
assert.equal(subtitleScrollState.forcedScroll, true);
assert.equal(subtitleScrollState.firstActiveRemoved, true);
assert.equal(subtitleScrollState.secondActive, true);

const singleActiveState = await vm.runInContext(`
  (() => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    const third = document.createElement("div");
    third.className = "cue";
    third.dataset.index = "2";
    elements.subtitleList.replaceChildren(first, second, third);
    first.classList.add("active");
    second.classList.add("active");
    activeCueIndex = 0;

    setActiveCueIndex(2);

    return {
      firstActive: first.classList.contains("active"),
      secondActive: second.classList.contains("active"),
      thirdActive: third.classList.contains("active")
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(singleActiveState)), {
  firstActive: false,
  secondActive: false,
  thirdActive: true
});

const asrProfileState = await vm.runInContext(`
  (() => {
    const profiles = normalizeStoredProfiles("asr", [
      { id: "custom_vad", name: "自定义 VAD", providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", vadFilter: "on" },
      { id: "old_custom_funasr", name: "旧自定义 FunASR", providerType: "dashscope_funasr", baseUrl: "https://dashscope.example/v1", model: "fun-asr", vadFilter: "off" }
    ]);
    const custom = profiles.find(profile => profile.id === "custom_vad");
    const oldCustomFunAsr = profiles.find(profile => profile.id === "old_custom_funasr");
    const openai = profiles.find(profile => profile.id === "openai_whisper");
    return {
      selected: normalizeSelectedProfileId(profiles, "missing_profile", "openai_whisper"),
      customVadFilter: custom?.vadFilter,
      oldCustomFunAsrProviderType: oldCustomFunAsr?.providerType,
      oldCustomFunAsrVadFilter: oldCustomFunAsr?.vadFilter,
      defaultVadFilter: openai?.vadFilter
    };
  })()
`, context);

assert.equal(asrProfileState.selected, "openai_whisper");
assert.equal(asrProfileState.customVadFilter, "on");
assert.equal(asrProfileState.oldCustomFunAsrProviderType, "openai");
assert.equal(asrProfileState.oldCustomFunAsrVadFilter, "auto");
assert.equal(asrProfileState.defaultVadFilter, "auto");

const asrProfileTemplateState = await vm.runInContext(`
  (() => {
    elements.asrProviderType.children = [
      { value: "openai", hidden: false, disabled: false },
      { value: "dashscope_funasr", hidden: false, disabled: false }
    ];
    asrProfiles = normalizeStoredProfiles("asr", []);
    renderProfileOptions(elements.asrProfileId, asrProfiles, "groq_whisper");
    elements.asrProfileId.value = "groq_whisper";
    renderSelectedProfile("asr");
    const groqBeforeSave = {
      formatHidden: elements.asrProviderTypeField?.hidden,
      formatDisabled: elements.asrProviderType?.disabled,
      formatValue: elements.asrProviderType?.value,
      deleteDisabled: elements.deleteAsrProfile?.disabled,
      providerType: asrProfiles.find(profile => profile.id === "groq_whisper")?.providerType,
      baseUrl: asrProfiles.find(profile => profile.id === "groq_whisper")?.baseUrl,
      model: asrProfiles.find(profile => profile.id === "groq_whisper")?.model,
      apiKeyLinkHidden: elements.asrApiKeyHelpLink.hidden,
      apiKeyLinkHref: elements.asrApiKeyHelpLink.href
    };
    if (elements.asrProviderType) {
      elements.asrProviderType.value = "dashscope_funasr";
    }
    saveProfileFields("asr", "groq_whisper");
    elements.asrProfileId.value = "xai_grok";
    renderSelectedProfile("asr");
    const xaiBuiltIn = {
      formatHidden: elements.asrProviderTypeField?.hidden,
      modelHidden: elements.asrModelField?.hidden,
      vadHidden: elements.asrVadFilterField?.hidden,
      formatDisplay: elements.asrProviderTypeField?.style.display,
      modelDisplay: elements.asrModelField?.style.display,
      vadDisplay: elements.asrVadFilterField?.style.display,
      deleteDisabled: elements.deleteAsrProfile?.disabled,
      apiKeyLinkHref: elements.asrApiKeyHelpLink.href
    };
    elements.asrProfileId.value = "dashscope_funasr";
    renderSelectedProfile("asr");
    const funAsrBuiltIn = {
      formatHidden: elements.asrProviderTypeField?.hidden,
      formatDisabled: elements.asrProviderType?.disabled,
      formatValue: elements.asrProviderType?.value,
      deleteDisabled: elements.deleteAsrProfile?.disabled,
      name: elements.asrProfileName.value,
      vadDisabled: elements.asrVadFilter.disabled,
      apiKeyLinkHref: elements.asrApiKeyHelpLink.href
    };
    elements.asrProfileId.value = "custom_asr";
    renderSelectedProfile("asr");
    const customOpenAi = {
      formatHidden: elements.asrProviderTypeField?.hidden,
      formatDisabled: elements.asrProviderType?.disabled,
      formatValue: elements.asrProviderType?.value,
      funAsrOptionHidden: (elements.asrProviderType.children || []).find(option => option.value === "dashscope_funasr")?.hidden,
      funAsrOptionDisabled: (elements.asrProviderType.children || []).find(option => option.value === "dashscope_funasr")?.disabled,
      deleteDisabled: elements.deleteAsrProfile?.disabled,
      name: elements.asrProfileName.value,
      apiKeyLinkHidden: elements.asrApiKeyHelpLink.hidden,
      apiKeyLinkHref: elements.asrApiKeyHelpLink.href || ""
    };
    elements.asrProviderType.value = "dashscope_funasr";
    updateAsrCustomProviderType();
    const customFunAsr = {
      formatHidden: elements.asrProviderTypeField?.hidden,
      formatDisabled: elements.asrProviderType?.disabled,
      formatValue: elements.asrProviderType?.value,
      name: elements.asrProfileName.value,
      vadDisabled: elements.asrVadFilter.disabled
    };
    const freshAsr = createEmptyProfile("asr");
    const freshLlm = createEmptyProfile("llm");
    return {
      names: asrProfiles.map(profile => profile.name),
      groqBeforeSave,
      groqAfterSave: asrProfiles.find(profile => profile.id === "groq_whisper")?.providerType,
      xaiBuiltIn,
      funAsrBuiltIn,
      customOpenAi,
      customFunAsr,
      freshAsrName: freshAsr.name,
      freshLlmName: freshLlm.name
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(asrProfileTemplateState.names)), [
  "OpenAI Whisper",
  "Groq Whisper",
  "xAI Grok",
  "Fun-ASR",
  "自定义档案"
]);
assert.equal(asrProfileTemplateState.groqBeforeSave.formatHidden, true);
assert.equal(asrProfileTemplateState.groqBeforeSave.formatDisabled, true);
assert.equal(asrProfileTemplateState.groqBeforeSave.formatValue, "openai");
assert.equal(asrProfileTemplateState.groqBeforeSave.deleteDisabled, true);
assert.equal(asrProfileTemplateState.groqBeforeSave.providerType, "groq");
assert.equal(asrProfileTemplateState.groqBeforeSave.baseUrl, "https://api.groq.com/openai/v1");
assert.equal(asrProfileTemplateState.groqBeforeSave.model, "whisper-large-v3-turbo");
assert.equal(asrProfileTemplateState.groqBeforeSave.apiKeyLinkHidden, false);
assert.equal(asrProfileTemplateState.groqBeforeSave.apiKeyLinkHref, "https://console.groq.com/keys");
assert.equal(asrProfileTemplateState.groqAfterSave, "groq");
assert.equal(asrProfileTemplateState.xaiBuiltIn.formatHidden, true);
assert.equal(asrProfileTemplateState.xaiBuiltIn.modelHidden, true);
assert.equal(asrProfileTemplateState.xaiBuiltIn.vadHidden, true);
assert.equal(asrProfileTemplateState.xaiBuiltIn.formatDisplay, "none");
assert.equal(asrProfileTemplateState.xaiBuiltIn.modelDisplay, "none");
assert.equal(asrProfileTemplateState.xaiBuiltIn.vadDisplay, "none");
assert.equal(asrProfileTemplateState.xaiBuiltIn.deleteDisabled, true);
assert.equal(asrProfileTemplateState.xaiBuiltIn.apiKeyLinkHref, "https://console.x.ai/");
assert.equal(asrProfileTemplateState.funAsrBuiltIn.formatHidden, true);
assert.equal(asrProfileTemplateState.funAsrBuiltIn.formatDisabled, true);
assert.equal(asrProfileTemplateState.funAsrBuiltIn.formatValue, "dashscope_funasr");
assert.equal(asrProfileTemplateState.funAsrBuiltIn.name, "Fun-ASR");
assert.equal(asrProfileTemplateState.funAsrBuiltIn.vadDisabled, false);
assert.equal(asrProfileTemplateState.funAsrBuiltIn.deleteDisabled, true);
assert.equal(asrProfileTemplateState.funAsrBuiltIn.apiKeyLinkHref, "https://bailian.console.aliyun.com/?tab=model#/api-key");
assert.equal(asrProfileTemplateState.customOpenAi.formatHidden, true);
assert.equal(asrProfileTemplateState.customOpenAi.formatDisabled, false);
assert.equal(asrProfileTemplateState.customOpenAi.formatValue, "openai");
assert.equal(asrProfileTemplateState.customOpenAi.funAsrOptionHidden, true);
assert.equal(asrProfileTemplateState.customOpenAi.funAsrOptionDisabled, true);
assert.equal(asrProfileTemplateState.customOpenAi.deleteDisabled, false);
assert.equal(asrProfileTemplateState.customOpenAi.name, "自定义档案");
assert.equal(asrProfileTemplateState.customOpenAi.apiKeyLinkHidden, true);
assert.equal(asrProfileTemplateState.customOpenAi.apiKeyLinkHref, "");
assert.equal(asrProfileTemplateState.customFunAsr.formatHidden, true);
assert.equal(asrProfileTemplateState.customFunAsr.formatDisabled, false);
assert.equal(asrProfileTemplateState.customFunAsr.formatValue, "openai");
assert.equal(asrProfileTemplateState.customFunAsr.name, "自定义档案");
assert.equal(asrProfileTemplateState.customFunAsr.vadDisabled, false);
assert.equal(asrProfileTemplateState.freshAsrName, "新档案");
assert.equal(asrProfileTemplateState.freshLlmName, "新档案");

const profileOptionRenameState = await vm.runInContext(`
  (async () => {
    asrProfiles = normalizeStoredProfiles("asr", []);
    llmProfiles = normalizeStoredProfiles("llm", []);
    const asrProfile = createEmptyProfile("asr");
    const llmProfile = createEmptyProfile("llm");
    asrProfiles.push(asrProfile);
    llmProfiles.push(llmProfile);
    renderProfileOptions(elements.asrProfileId, asrProfiles, asrProfile.id);
    renderProfileOptions(elements.llmProfileId, llmProfiles, llmProfile.id);
    currentAsrProfileId = elements.asrProfileId.value;
    currentLlmProfileId = elements.llmProfileId.value;
    renderSelectedProfile("asr");
    renderSelectedProfile("llm");
    elements.asrProfileName.value = "发";
    elements.llmProfileName.value = "翻译档案";
    await saveSettings();
    return {
      asrOptionText: elements.asrProfileId.children.find(option => option.value === asrProfile.id)?.textContent,
      llmOptionText: elements.llmProfileId.children.find(option => option.value === llmProfile.id)?.textContent,
      selectedAsrId: elements.asrProfileId.value,
      selectedLlmId: elements.llmProfileId.value
    };
  })()
`, context);

assert.equal(profileOptionRenameState.asrOptionText, "发");
assert.equal(profileOptionRenameState.llmOptionText, "翻译档案");
assert.equal(profileOptionRenameState.selectedAsrId.startsWith("asr_profile_"), true);
assert.equal(profileOptionRenameState.selectedLlmId.startsWith("llm_profile_"), true);

const webFfmpegPerformanceSettingsState = await vm.runInContext(`
  (async () => {
    const originalLocalSet = chrome.storage.local.set;
    const originalSyncSet = chrome.storage.sync.set;
    let localPayload = null;
    chrome.storage.local.set = async payload => {
      localPayload = payload;
    };
    chrome.storage.sync.set = async () => {};
    try {
      asrProfiles = normalizeStoredProfiles("asr", []);
      llmProfiles = normalizeStoredProfiles("llm", []);
      renderProfileOptions(elements.asrProfileId, asrProfiles, DEFAULT_ASR_PROFILE_ID);
      renderProfileOptions(elements.llmProfileId, llmProfiles, DEFAULT_LLM_PROFILE_ID);
      applyStoredSettings({ ...DEFAULTS, webFfmpegPerformance: "fast" });
      const loaded = elements.webFfmpegPerformance.value;
      elements.webFfmpegPerformance.value = "stable";
      await saveSettings();
      const saved = localPayload?.webFfmpegPerformance;
      applyStoredSettings({ ...DEFAULTS, webFfmpegPerformance: "turbo" });
      const fallback = elements.webFfmpegPerformance.value;
      return { loaded, saved, fallback };
    } finally {
      chrome.storage.local.set = originalLocalSet;
      chrome.storage.sync.set = originalSyncSet;
    }
  })()
`, context);

assert.equal(webFfmpegPerformanceSettingsState.loaded, "fast");
assert.equal(webFfmpegPerformanceSettingsState.saved, "stable");
assert.equal(webFfmpegPerformanceSettingsState.fallback, "auto");

const builtInAsrSaveState = await vm.runInContext(`
  (() => {
    asrProfiles = normalizeStoredProfiles("asr", [{ id: "groq_whisper", apiKey: "groq-key" }]);
    elements.asrProfileId.value = "groq_whisper";
    renderSelectedProfile("asr");
    elements.asrBaseUrl.value = "https://changed.example/v1";
    elements.asrModel.value = "changed-model";
    elements.asrVadFilter.value = "on";
    saveProfileFields("asr", "groq_whisper");
    const profile = asrProfiles.find(item => item.id === "groq_whisper");
    const storedProfile = profilesForStorage("asr", asrProfiles).find(item => item.id === "groq_whisper");
    return {
      baseUrl: profile?.baseUrl,
      model: profile?.model,
      vadFilter: profile?.vadFilter,
      apiKey: profile?.apiKey,
      storedProfile
    };
  })()
`, context);

assert.equal(builtInAsrSaveState.baseUrl, "https://api.groq.com/openai/v1");
assert.equal(builtInAsrSaveState.model, "whisper-large-v3-turbo");
assert.equal(builtInAsrSaveState.vadFilter, "auto");
assert.equal(builtInAsrSaveState.apiKey, "groq-key");
assert.deepEqual(JSON.parse(JSON.stringify(builtInAsrSaveState.storedProfile)), {
  id: "groq_whisper",
  apiKey: "groq-key"
});

const llmProfileTemplateState = await vm.runInContext(`
  (() => {
    llmProfiles = normalizeStoredProfiles("llm", [
      {
        id: "siliconflow_llm",
        baseUrl: "https://custom-siliconflow.test/v1",
        model: "custom-siliconflow-model",
        apiKey: "sf-key"
      }
    ]);
    renderProfileOptions(elements.llmProfileId, llmProfiles, "siliconflow_llm");
    elements.llmProfileId.value = "siliconflow_llm";
    renderSelectedProfile("llm");
    const siliconflowBeforeSave = {
      names: llmProfiles.map(profile => profile.name),
      providerDisabled: elements.llmProviderType.disabled,
      providerValue: elements.llmProviderType.value,
      nameDisabled: elements.llmProfileName.disabled,
      deleteDisabled: elements.deleteLlmProfile.disabled,
      baseUrl: elements.llmBaseUrl.value,
      model: elements.llmModel.value,
      modelSelectHidden: elements.llmModelSelect.hidden,
      modelSelectOptions: elements.llmModelSelect.children.map(option => option.value),
      apiKeyLinkHidden: elements.llmApiKeyHelpLink.hidden,
      apiKeyLinkHref: elements.llmApiKeyHelpLink.href,
      apiKey: elements.llmApiKey.value
    };
    elements.llmProviderType.value = "anthropic";
    elements.llmBaseUrl.value = "https://changed-siliconflow.test/v1";
    elements.llmModel.value = "changed-model";
    saveProfileFields("llm", "siliconflow_llm");
    const siliconflowAfterSave = llmProfiles.find(profile => profile.id === "siliconflow_llm");
    const storedSiliconflow = profilesForStorage("llm", llmProfiles).find(profile => profile.id === "siliconflow_llm");
    deleteProfile("llm");
    const afterBlockedDelete = {
      length: llmProfiles.length,
      selected: elements.llmProfileId.value,
      deleteDisabled: elements.deleteLlmProfile.disabled
    };
    elements.llmProfileId.value = "openai_custom";
    renderSelectedProfile("llm");
    const custom = {
      providerDisabled: elements.llmProviderType.disabled,
      nameDisabled: elements.llmProfileName.disabled,
      deleteDisabled: elements.deleteLlmProfile.disabled,
      modelSelectHidden: elements.llmModelSelect.hidden,
      modelSelectOptions: elements.llmModelSelect.children.map(option => option.value),
      apiKeyLinkHidden: elements.llmApiKeyHelpLink.hidden,
      apiKeyLinkHref: elements.llmApiKeyHelpLink.href || ""
    };
    return {
      siliconflowBeforeSave,
      siliconflowAfterSave,
      storedSiliconflow,
      afterBlockedDelete,
      custom
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(llmProfileTemplateState.siliconflowBeforeSave.names)), [
  "硅基流动",
  "阿里云百炼",
  "火山引擎",
  "OpenRouter",
  "自定义档案"
]);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.providerDisabled, true);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.providerValue, "openai");
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.nameDisabled, true);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.deleteDisabled, true);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.baseUrl, "https://custom-siliconflow.test/v1");
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.model, "custom-siliconflow-model");
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.modelSelectHidden, true);
assert.deepEqual(JSON.parse(JSON.stringify(llmProfileTemplateState.siliconflowBeforeSave.modelSelectOptions)), []);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.apiKeyLinkHidden, false);
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.apiKeyLinkHref, "https://cloud.siliconflow.cn/i/My0p5Jgs");
assert.equal(llmProfileTemplateState.siliconflowBeforeSave.apiKey, "sf-key");
assert.equal(llmProfileTemplateState.siliconflowAfterSave.name, "硅基流动");
assert.equal(llmProfileTemplateState.siliconflowAfterSave.providerType, "openai");
assert.equal(llmProfileTemplateState.siliconflowAfterSave.baseUrl, "https://changed-siliconflow.test/v1");
assert.equal(llmProfileTemplateState.siliconflowAfterSave.model, "changed-model");
assert.deepEqual(JSON.parse(JSON.stringify(llmProfileTemplateState.storedSiliconflow)), {
  id: "siliconflow_llm",
  baseUrl: "https://changed-siliconflow.test/v1",
  model: "changed-model",
  apiKey: "sf-key"
});
assert.equal(llmProfileTemplateState.afterBlockedDelete.length, 5);
assert.equal(llmProfileTemplateState.afterBlockedDelete.selected, "siliconflow_llm");
assert.equal(llmProfileTemplateState.afterBlockedDelete.deleteDisabled, true);
assert.equal(llmProfileTemplateState.custom.providerDisabled, false);
assert.equal(llmProfileTemplateState.custom.nameDisabled, false);
assert.equal(llmProfileTemplateState.custom.deleteDisabled, false);
assert.deepEqual(JSON.parse(JSON.stringify(llmProfileTemplateState.custom.modelSelectOptions)), []);
assert.equal(llmProfileTemplateState.custom.modelSelectHidden, true);
assert.equal(llmProfileTemplateState.custom.apiKeyLinkHidden, true);
assert.equal(llmProfileTemplateState.custom.apiKeyLinkHref, "");

const apiKeyLinkMatrix = await vm.runInContext(`
  (() => {
    asrProfiles = normalizeStoredProfiles("asr", []);
    llmProfiles = normalizeStoredProfiles("llm", []);
    renderProfileOptions(elements.asrProfileId, asrProfiles, "openai_whisper");
    renderProfileOptions(elements.llmProfileId, llmProfiles, "siliconflow_llm");
    const asrIds = ["openai_whisper", "groq_whisper", "xai_grok", "dashscope_funasr", "custom_asr"];
    const llmIds = ["siliconflow_llm", "bailian_llm", "volcengine_llm", "openrouter_llm", "openai_custom"];
    const asr = {};
    const llm = {};
    for (const id of asrIds) {
      elements.asrProfileId.value = id;
      renderSelectedProfile("asr");
      asr[id] = {
        hidden: elements.asrApiKeyHelpLink.hidden,
        href: elements.asrApiKeyHelpLink.href || ""
      };
    }
    for (const id of llmIds) {
      elements.llmProfileId.value = id;
      renderSelectedProfile("llm");
      llm[id] = {
        hidden: elements.llmApiKeyHelpLink.hidden,
        href: elements.llmApiKeyHelpLink.href || ""
      };
    }
    return { asr, llm };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(apiKeyLinkMatrix.asr)), {
  openai_whisper: { hidden: false, href: "https://platform.openai.com/api-keys" },
  groq_whisper: { hidden: false, href: "https://console.groq.com/keys" },
  xai_grok: { hidden: false, href: "https://console.x.ai/" },
  dashscope_funasr: { hidden: false, href: "https://bailian.console.aliyun.com/?tab=model#/api-key" },
  custom_asr: { hidden: true, href: "" }
});
assert.deepEqual(JSON.parse(JSON.stringify(apiKeyLinkMatrix.llm)), {
  siliconflow_llm: { hidden: false, href: "https://cloud.siliconflow.cn/i/My0p5Jgs" },
  bailian_llm: { hidden: false, href: "https://bailian.console.aliyun.com/?tab=model#/model-market" },
  volcengine_llm: { hidden: false, href: "https://console.volcengine.com/ark/region:ark+cn-beijing/model" },
  openrouter_llm: { hidden: false, href: "https://openrouter.ai/models" },
  openai_custom: { hidden: true, href: "" }
});

const llmModelListFetchState = await vm.runInContext(`
  (async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options = {}) => {
      requests.push({ url, auth: options.headers?.Authorization || "" });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "provider/model-a" },
            { id: "provider/model-b" }
          ]
        })
      };
    };
    try {
      llmProfiles = normalizeStoredProfiles("llm", []);
      renderProfileOptions(elements.llmProfileId, llmProfiles, "openrouter_llm");
      elements.llmProfileId.value = "openrouter_llm";
      renderSelectedProfile("llm");
      await refreshSelectedLlmModelList();
      const openrouter = {
        requests: [...requests],
        hidden: elements.llmModelSelect.hidden,
        options: elements.llmModelSelect.children.map(option => option.value),
        hint: elements.llmModelHint.textContent
      };
      requests.length = 0;
      elements.llmProfileId.value = "bailian_llm";
      renderSelectedProfile("llm");
      elements.llmApiKey.value = "";
      await refreshSelectedLlmModelList();
      const bailianWithoutKey = {
        requests: [...requests],
        hidden: elements.llmModelSelect.hidden,
        hint: elements.llmModelHint.textContent
      };
      requests.length = 0;
      elements.llmApiKey.value = "bailian-key";
      await refreshSelectedLlmModelList();
      const bailianWithKey = {
        requests: [...requests],
        hidden: elements.llmModelSelect.hidden,
        options: elements.llmModelSelect.children.map(option => option.value)
      };
      return { openrouter, bailianWithoutKey, bailianWithKey };
    } finally {
      globalThis.fetch = originalFetch;
    }
  })()
`, context);

assert.equal(llmModelListFetchState.openrouter.requests.length, 1);
assert.equal(llmModelListFetchState.openrouter.requests[0].url, "https://openrouter.ai/api/v1/models");
assert.equal(llmModelListFetchState.openrouter.requests[0].auth, "");
assert.equal(llmModelListFetchState.openrouter.hidden, false);
assert.deepEqual(JSON.parse(JSON.stringify(llmModelListFetchState.openrouter.options)), [
  "provider/model-a",
  "provider/model-b"
]);
assert.match(llmModelListFetchState.openrouter.hint, /已获取 2 个模型/);
assert.deepEqual(JSON.parse(JSON.stringify(llmModelListFetchState.bailianWithoutKey.requests)), []);
assert.equal(llmModelListFetchState.bailianWithoutKey.hidden, true);
assert.match(llmModelListFetchState.bailianWithoutKey.hint, /需要先填写 API Key/);
assert.equal(llmModelListFetchState.bailianWithKey.requests.length, 1);
assert.equal(llmModelListFetchState.bailianWithKey.requests[0].url, "https://dashscope.aliyuncs.com/compatible-mode/v1/models");
assert.equal(llmModelListFetchState.bailianWithKey.requests[0].auth, "Bearer bailian-key");
assert.equal(llmModelListFetchState.bailianWithKey.hidden, false);

const staleXaiProfileMigrationState = await vm.runInContext(`
  (() => {
    asrProfiles = normalizeStoredProfiles("asr", [
      {
        id: "xai_grok",
        name: "xAI Grok",
        providerType: "openai",
        baseUrl: "https://api.x.ai/v1",
        model: "stale-xai-model",
        vadFilter: "on",
        apiKey: "xai-key"
      }
    ]);
    renderProfileOptions(elements.asrProfileId, asrProfiles, "xai_grok");
    elements.asrProfileId.value = "xai_grok";
    renderSelectedProfile("asr");
    const xaiProfile = asrProfiles.find(profile => profile.id === "xai_grok");
    const xaiStoredProfile = profilesForStorage("asr", asrProfiles).find(profile => profile.id === "xai_grok");
    return {
      providerType: xaiProfile?.providerType,
      model: xaiProfile?.model,
      vadFilter: xaiProfile?.vadFilter,
      apiKey: xaiProfile?.apiKey,
      formatHidden: elements.asrProviderTypeField?.hidden,
      modelHidden: elements.asrModelField?.hidden,
      vadHidden: elements.asrVadFilterField?.hidden,
      formatDisplay: elements.asrProviderTypeField?.style.display,
      modelDisplay: elements.asrModelField?.style.display,
      vadDisplay: elements.asrVadFilterField?.style.display,
      storedProfile: xaiStoredProfile
    };
  })()
`, context);

assert.equal(staleXaiProfileMigrationState.providerType, "xai");
assert.equal(staleXaiProfileMigrationState.model, "");
assert.equal(staleXaiProfileMigrationState.vadFilter, "auto");
assert.equal(staleXaiProfileMigrationState.apiKey, "xai-key");
assert.equal(staleXaiProfileMigrationState.formatHidden, true);
assert.equal(staleXaiProfileMigrationState.modelHidden, true);
assert.equal(staleXaiProfileMigrationState.vadHidden, true);
assert.equal(staleXaiProfileMigrationState.formatDisplay, "none");
assert.equal(staleXaiProfileMigrationState.modelDisplay, "none");
assert.equal(staleXaiProfileMigrationState.vadDisplay, "none");
assert.deepEqual(JSON.parse(JSON.stringify(staleXaiProfileMigrationState.storedProfile)), {
  id: "xai_grok",
  apiKey: "xai-key"
});

const staleXaiLoadSettingsMigrationState = await vm.runInContext(`
  (async () => {
    const originalSyncGet = chrome.storage.sync.get;
    const originalLocalGet = chrome.storage.local.get;
    const originalLocalSet = chrome.storage.local.set;
    let savedPayload = null;
    chrome.storage.sync.get = async () => ({});
    chrome.storage.local.get = async () => ({
      modelSettingsVersion: MODEL_SETTINGS_VERSION,
      selectedAsrProfileId: "xai_grok",
      selectedLlmProfileId: "openai_custom",
      asrProfiles: [
        {
          id: "xai_grok",
          name: "xAI Grok",
          providerType: "openai",
          baseUrl: "https://api.x.ai/v1",
          model: "stale-xai-model",
          vadFilter: "on",
          apiKey: "xai-key"
        }
      ],
      llmProfiles: [
        {
          id: "openai_custom",
          name: "自定义档案",
          providerType: "openai",
          baseUrl: "",
          model: "",
          apiKey: ""
        }
      ]
    });
    chrome.storage.local.set = async payload => {
      savedPayload = payload;
    };
    try {
      await loadSettings();
      return {
        selectedAsrId: currentAsrProfileId,
        selectedLlmId: currentLlmProfileId,
        savedPayload
      };
    } finally {
      chrome.storage.sync.get = originalSyncGet;
      chrome.storage.local.get = originalLocalGet;
      chrome.storage.local.set = originalLocalSet;
    }
  })()
`, context);

assert.equal(staleXaiLoadSettingsMigrationState.selectedAsrId, "xai_grok");
assert.equal(staleXaiLoadSettingsMigrationState.selectedLlmId, "openai_custom");
assert.deepEqual(JSON.parse(JSON.stringify(staleXaiLoadSettingsMigrationState.savedPayload.asrProfiles.find(profile => profile.id === "xai_grok"))), {
  id: "xai_grok",
  apiKey: "xai-key"
});

const targetLanguageState = await vm.runInContext(`
  (() => {
    setTargetLanguageValue("en");
    const english = getTargetLanguageValue();
    setTargetLanguageValue("zh-CN");
    const chinese = getTargetLanguageValue();
    setTargetLanguageValue("ja");
    const japanese = getTargetLanguageValue();
    setTargetLanguageValue("fr");
    const french = getTargetLanguageValue();
    setTargetLanguageValue("ko");
    const korean = getTargetLanguageValue();
    setTargetLanguageValue("de");
    const german = getTargetLanguageValue();
    setTargetLanguageValue("ru");
    const russian = getTargetLanguageValue();
    setTargetLanguageValue("japanese");
    const menuAliasFallback = getTargetLanguageValue();
    setTargetLanguageValue("unknown-language");
    const fallback = getTargetLanguageValue();
    return { english, chinese, japanese, french, korean, german, russian, menuAliasFallback, fallback };
  })()
`, context);

assert.equal(targetLanguageState.english, "en");
assert.equal(targetLanguageState.chinese, "zh-CN");
assert.equal(targetLanguageState.japanese, "ja");
assert.equal(targetLanguageState.french, "fr");
assert.equal(targetLanguageState.korean, "ko");
assert.equal(targetLanguageState.german, "de");
assert.equal(targetLanguageState.russian, "ru");
assert.equal(targetLanguageState.menuAliasFallback, "zh-CN");
assert.equal(targetLanguageState.fallback, "zh-CN");

const sourceLanguageState = await vm.runInContext(`
  (() => {
    setSourceLanguageValue("auto");
    const auto = getSourceLanguageValue();
    setSourceLanguageValue("ja");
    const japanese = getSourceLanguageValue();
    setSourceLanguageValue("zh");
    const chinese = getSourceLanguageValue();
    setSourceLanguageValue("japanese");
    const menuAliasFallback = getSourceLanguageValue();
    setSourceLanguageValue("unknown-language");
    const fallback = getSourceLanguageValue();
    return { auto, japanese, chinese, menuAliasFallback, fallback };
  })()
`, context);

assert.equal(sourceLanguageState.auto, "auto");
assert.equal(sourceLanguageState.japanese, "ja");
assert.equal(sourceLanguageState.chinese, "zh");
assert.equal(sourceLanguageState.menuAliasFallback, "auto");
assert.equal(sourceLanguageState.fallback, "auto");

const sidepanelLanguageOptions = await vm.runInContext(`
  (() => ({
    target: FuguangSidepanelLanguage.targetLanguages.map(language => language.code),
    source: FuguangSidepanelLanguage.sourceLanguages.map(language => language.code)
  }))()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sidepanelLanguageOptions.target)), ["zh-CN", "en", "ja", "fr", "ko", "de", "ru"]);
assert.deepEqual(JSON.parse(JSON.stringify(sidepanelLanguageOptions.source)), ["auto", "zh", "en", "ja", "ko", "fr", "de", "ru", "es", "pt", "it"]);

const localeSwitchState = await vm.runInContext(`
  (() => {
    asrProfiles = normalizeStoredProfiles("asr", []);
    llmProfiles = normalizeStoredProfiles("llm", []);
    renderProfileOptions(elements.asrProfileId, asrProfiles, "openai_whisper");
    renderProfileOptions(elements.llmProfileId, llmProfiles, "openai_default");
    currentAsrProfileId = elements.asrProfileId.value;
    currentLlmProfileId = elements.llmProfileId.value;
    renderSelectedProfile("asr");
    renderSelectedProfile("llm");
    currentJob = null;
    candidates = [];
    renderedCandidateSignature = "";
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    setLocale("en");
    updateActionButtons(null);
    const english = {
      locale: currentLocale,
      englishActive: elements.localeEnglish.classList.contains("active"),
      chineseActive: elements.localeChinese.classList.contains("active"),
      startText: elements.startPreload.textContent,
      retryText: elements.retryPreload.textContent,
      overlayText: elements.subtitleOverlayToggle.textContent,
      candidateSummary: elements.candidateSummary.textContent,
      asrKeyHint: elements.asrApiKeyHint.textContent,
      asrKeyPlaceholder: elements.asrApiKey.placeholder,
      llmKeyHint: elements.llmApiKeyHint.textContent,
      llmKeyPlaceholder: elements.llmApiKey.placeholder
    };
    setLocale("zh");
    updateActionButtons(null);
    const chinese = {
      locale: currentLocale,
      englishActive: elements.localeEnglish.classList.contains("active"),
      chineseActive: elements.localeChinese.classList.contains("active"),
      startText: elements.startPreload.textContent,
      retryText: elements.retryPreload.textContent,
      overlayText: elements.subtitleOverlayToggle.textContent,
      candidateSummary: elements.candidateSummary.textContent,
      asrKeyHint: elements.asrApiKeyHint.textContent,
      asrKeyPlaceholder: elements.asrApiKey.placeholder,
      llmKeyHint: elements.llmApiKeyHint.textContent,
      llmKeyPlaceholder: elements.llmApiKey.placeholder
    };
    return { english, chinese };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(localeSwitchState)), {
  english: {
    locale: "en",
    englishActive: true,
    chineseActive: false,
    startText: "Start",
    retryText: "Continue",
    overlayText: "Overlay On",
    candidateSummary: "Reading media sources from this page.",
    asrKeyHint: "The API key stays in this browser.",
    asrKeyPlaceholder: "Stored in this browser only",
    llmKeyHint: "The API key stays in this browser.",
    llmKeyPlaceholder: "Stored in this browser only"
  },
  chinese: {
    locale: "zh",
    englishActive: false,
    chineseActive: true,
    startText: "开始抽取",
    retryText: "继续",
    overlayText: "浮层开",
    candidateSummary: "正在读取当前页面媒体源。",
    asrKeyHint: "API 密钥只保存在本机浏览器。",
    asrKeyPlaceholder: "只保存在本机浏览器",
    llmKeyHint: "API 密钥只保存在本机浏览器。",
    llmKeyPlaceholder: "只保存在本机浏览器"
  }
});

const syncedSubtitleSettingsState = await vm.runInContext(`
  (async () => {
    const originalSyncGet = chrome.storage.sync.get;
    const originalLocalGet = chrome.storage.local.get;
    let requestedKeys = [];
    chrome.storage.sync.get = async keys => {
      requestedKeys = keys;
      return {
        subtitleFontSize: 36,
        subtitleBackgroundOpacity: 42,
        subtitleOverlayEnabled: false,
        subtitleDisplayMode: "bilingual"
      };
    };
    chrome.storage.local.get = async () => ({ modelSettingsVersion: MODEL_SETTINGS_VERSION });
    try {
      await loadSettings();
      return {
        requestedKeys,
        fontSize: elements.subtitleFontSize.value,
        opacity: elements.subtitleBackgroundOpacity.value,
        overlayEnabled: subtitleOverlayEnabled,
        displayMode: subtitleDisplayMode,
        overlayText: elements.subtitleOverlayToggle.textContent,
        modeText: elements.subtitleModeToggle.textContent
      };
    } finally {
      chrome.storage.sync.get = originalSyncGet;
      chrome.storage.local.get = originalLocalGet;
    }
  })()
`, context);

assert.ok(syncedSubtitleSettingsState.requestedKeys.includes("subtitleFontSize"));
assert.ok(syncedSubtitleSettingsState.requestedKeys.includes("subtitleBackgroundOpacity"));
assert.equal(syncedSubtitleSettingsState.fontSize, 36);
assert.equal(syncedSubtitleSettingsState.opacity, 42);
assert.equal(syncedSubtitleSettingsState.overlayEnabled, false);
assert.equal(syncedSubtitleSettingsState.displayMode, "bilingual");
assert.equal(syncedSubtitleSettingsState.overlayText, "浮层关");
assert.equal(syncedSubtitleSettingsState.modeText, "双语");

const subtitleCacheVersionState = await vm.runInContext(`
  (async () => buildSubtitleCacheKey({
    pageUrl: "https://example.test/watch/1?utm_source=old",
    sourceUrl: "https://media.example.test/audio.mp4?token=secret"
  }))()
`, context);

assert.match(subtitleCacheVersionState, /^subtitle:v/);

const samePageDifferentMediaCacheKeyState = await vm.runInContext(`
  (async () => {
    const first = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=old",
      sourceUrl: "https://media.example.test/audio-a.mp4?token=secret-a"
    });
    const sameMediaRotatedToken = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=new",
      sourceUrl: "https://media.example.test/audio-a.mp4?token=secret-b"
    });
    const queryIdentityA = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-a&token=secret-a"
    });
    const queryIdentityARotatedToken = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-a&token=secret-b"
    });
    const queryIdentityB = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-b&token=secret-a"
    });
    const second = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=old",
      sourceUrl: "https://media.example.test/audio-b.mp4?token=secret-a"
    });
    return { first, sameMediaRotatedToken, queryIdentityA, queryIdentityARotatedToken, queryIdentityB, second };
  })()
`, context);

assert.equal(
  samePageDifferentMediaCacheKeyState.first,
  samePageDifferentMediaCacheKeyState.second,
  "same normalized page should share one subtitle cache key even when media sources differ"
);
assert.equal(
  samePageDifferentMediaCacheKeyState.first,
  samePageDifferentMediaCacheKeyState.sameMediaRotatedToken,
  "rotating tracking/source tokens should not create a new subtitle cache entry"
);
assert.equal(
  samePageDifferentMediaCacheKeyState.queryIdentityA,
  samePageDifferentMediaCacheKeyState.queryIdentityARotatedToken,
  "rotating media tokens should not change a query-identified media cache key"
);
assert.equal(
  samePageDifferentMediaCacheKeyState.queryIdentityA,
  samePageDifferentMediaCacheKeyState.queryIdentityB,
  "media identity query parameters should not split subtitle cache when the page identity is the same"
);

const subtitleCacheEntrySanitizesUrlsState = await vm.runInContext(`
  (async () => {
    const entry = await buildSubtitleCacheEntry(
      { source: [{ start: 0, end: 1, text: "hello" }], translated: [] },
      {
        pageUrl: "https://example.test/watch/1?access_token=page-secret&Policy=page-policy&utm_source=old",
        sourceUrl: "https://media.example.test/playback?id=clip-a&token=media-secret&signature=old-signature&Key-Pair-Id=key-pair&AWSAccessKeyId=aws-key",
        title: "Tokenized page"
      }
    );
    const malformed = normalizeMediaCacheUrl("not-a-url?token=bad-token&Policy=bad-policy&id=clip-a");
    return {
      pageUrl: entry.pageUrl,
      sourceUrl: entry.sourceUrl,
      malformed,
      serialized: JSON.stringify(entry)
    };
  })()
`, context);

assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("page-secret"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("page-policy"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("media-secret"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("old-signature"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("key-pair"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("aws-key"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.pageUrl, "https://example.test/watch/1");
assert.equal(subtitleCacheEntrySanitizesUrlsState.sourceUrl, "https://media.example.test/playback?id=clip-a");
assert.equal(subtitleCacheEntrySanitizesUrlsState.malformed, "not-a-url?id=clip-a");

const subtitleCacheIndexedDbStorageState = await vm.runInContext(`
  (async () => {
    function createFakeIndexedDB() {
      const databases = new Map();
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const schedule = callback => Promise.resolve().then(callback);

      class FakeRequest {
        constructor() {
          this.result = undefined;
          this.error = null;
          this.onupgradeneeded = null;
          this.onsuccess = null;
          this.onerror = null;
        }
      }

      class FakeStore {
        constructor(store, transaction) {
          this.store = store;
          this.transaction = transaction;
        }

        get(id) {
          return this.transaction.queue(() => clone(this.store.records.get(id)));
        }

        getAll() {
          return this.transaction.queue(() => [...this.store.records.values()].map(clone));
        }

        put(entry) {
          return this.transaction.queue(() => {
            const id = entry?.[this.store.keyPath];
            if (!id) {
              throw new Error("missing key");
            }
            this.store.records.set(id, clone(entry));
            return id;
          });
        }

        delete(id) {
          return this.transaction.queue(() => {
            this.store.records.delete(id);
            return undefined;
          });
        }
      }

      class FakeTransaction {
        constructor(store) {
          this.store = store;
          this.pending = 0;
          this.completed = false;
          this.error = null;
          this.oncomplete = null;
          this.onerror = null;
        }

        objectStore() {
          return new FakeStore(this.store, this);
        }

        queue(work) {
          const request = new FakeRequest();
          this.pending += 1;
          schedule(() => {
            try {
              request.result = work();
              request.onsuccess?.();
            } catch (error) {
              request.error = error;
              this.error = error;
              request.onerror?.();
              this.onerror?.();
            } finally {
              this.pending -= 1;
              if (!this.pending && !this.completed) {
                this.completed = true;
                schedule(() => this.oncomplete?.());
              }
            }
          });
          return request;
        }
      }

      class FakeDb {
        constructor(record) {
          this.record = record;
          this.objectStoreNames = {
            contains: name => this.record.stores.has(name)
          };
        }

        createObjectStore(name, options = {}) {
          const store = {
            keyPath: options.keyPath || "id",
            records: new Map()
          };
          this.record.stores.set(name, store);
          return new FakeStore(store, new FakeTransaction(store));
        }

        transaction(name) {
          const store = this.record.stores.get(name);
          if (!store) {
            throw new Error("missing store: " + name);
          }
          return new FakeTransaction(store);
        }

        close() {
          this.record.closeCount += 1;
        }
      }

      return {
        databases,
        open(name, version) {
          const request = new FakeRequest();
          schedule(() => {
            let record = databases.get(name);
            const needsUpgrade = !record || record.version < version;
            if (!record) {
              record = { version, stores: new Map(), closeCount: 0 };
              databases.set(name, record);
            }
            record.version = Math.max(record.version, version);
            request.result = new FakeDb(record);
            if (needsUpgrade) {
              request.onupgradeneeded?.();
            }
            request.onsuccess?.();
          });
          return request;
        }
      };
    }

    const hadIndexedDB = Object.prototype.hasOwnProperty.call(globalThis, "indexedDB");
    const originalIndexedDB = globalThis.indexedDB;
    const fakeIndexedDB = createFakeIndexedDB();
    globalThis.indexedDB = fakeIndexedDB;
    currentSubtitleCacheEntry = null;

    try {
      const entry = {
        id: "subtitle:vtest:indexeddb",
        pageUrl: "https://example.test/watch/1",
        sourceUrl: "https://media.example.test/audio.mp4",
        title: "IndexedDB storage",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        transcript: {
          source: [{ start: 0, end: 1, text: "hello" }],
          translated: [{ start: 0, end: 1, text: "你好" }]
        }
      };

      await putSubtitleCacheEntry(entry);
      const stored = await getSubtitleCacheEntry(entry.id);
      const allBeforeDelete = await getAllSubtitleCacheEntries();
      const deleted = await deleteSubtitleCacheEntries([entry.id, entry.id, "", "missing"]);
      const storedAfterDelete = await getSubtitleCacheEntry(entry.id);
      const allAfterDelete = await getAllSubtitleCacheEntries();
      const now = Date.now();
      const largeBytes = 3 * 1024 * 1024;
      for (const sizedEntry of [
        { id: "subtitle:vtest:space-new", updatedAt: new Date(now).toISOString(), approxBytes: largeBytes },
        { id: "subtitle:vtest:space-old", updatedAt: new Date(now - 1000).toISOString(), approxBytes: largeBytes },
        { id: "subtitle:vtest:space-protected", updatedAt: new Date(now - 2000).toISOString(), approxBytes: largeBytes }
      ]) {
        await putSubtitleCacheEntry({
          pageUrl: "https://example.test/watch/space",
          sourceUrl: "https://media.example.test/" + sizedEntry.id + ".mp4",
          title: sizedEntry.id,
          createdAt: sizedEntry.updatedAt,
          updatedAt: sizedEntry.updatedAt,
          approxBytes: sizedEntry.approxBytes,
          transcript: {
            source: [{ start: 0, end: 1, text: sizedEntry.id }],
            translated: [{ start: 0, end: 1, text: sizedEntry.id }]
          },
          id: sizedEntry.id
        });
      }
      const spacePruneIds = (await getAllSubtitleCacheEntries())
        .map(item => item.id)
        .sort();
      const dbRecord = fakeIndexedDB.databases.get(SUBTITLE_CACHE_DB_NAME);

      return {
        storedText: stored?.transcript?.translated?.[0]?.text || "",
        allBeforeDeleteLength: allBeforeDelete.length,
        deleted,
        storedAfterDelete,
        allAfterDeleteLength: allAfterDelete.length,
        spacePruneIds,
        storeExists: dbRecord?.stores?.has(SUBTITLE_CACHE_STORE) || false,
        closeCount: dbRecord?.closeCount || 0
      };
    } finally {
      if (hadIndexedDB) {
        globalThis.indexedDB = originalIndexedDB;
      } else {
        delete globalThis.indexedDB;
      }
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleCacheIndexedDbStorageState)), {
  storedText: "你好",
  allBeforeDeleteLength: 1,
  deleted: 1,
  storedAfterDelete: null,
  allAfterDeleteLength: 0,
  spacePruneIds: ["subtitle:vtest:space-new", "subtitle:vtest:space-protected"],
  storeExists: true,
  closeCount: 14
});

const bilibiliReloadCacheKeyState = await vm.runInContext(`
  (async () => {
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770000000&upsig=old&oi=111&trid=old&nbs=1";
    const reloadedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new&oi=222&trid=new&nbs=2";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const reloadedKey = await buildSubtitleCacheKey({ pageUrl: reloadedPage, sourceUrl: reloadedSource });
    const differentVideoKey = await buildSubtitleCacheKey({
      pageUrl: "https://www.bilibili.com/video/BVdifferent/",
      sourceUrl: reloadedSource
    });
    const bilibiliPageOnlyKey = await buildSubtitleCacheKey({
      pageUrl: reloadedPage,
      sourceUrl: ""
    });
    return {
      savedKey,
      reloadedKey,
      differentVideoKey,
      bilibiliPageOnlyKey,
      genericNoSlash: normalizeCacheUrl("https://example.test/watch/1"),
      genericSlash: normalizeCacheUrl("https://example.test/watch/1/"),
      bilibiliNoiseA: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old&spm_id_from=333.788&vd_source=old"),
      bilibiliNoiseB: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=new&share_source=copy_web"),
      bilibiliNoiseC: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK/"),
      bilibiliPartOne: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?p=1&trackid=old"),
      bilibiliPartTwo: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?p=2&trackid=old")
    };
  })()
`, context);

assert.equal(
  bilibiliReloadCacheKeyState.savedKey,
  bilibiliReloadCacheKeyState.reloadedKey,
  "Bilibili page reload slash and signed media parameter rotation should keep the subtitle cache key stable"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.savedKey,
  bilibiliReloadCacheKeyState.differentVideoKey,
  "different Bilibili videos must not share subtitle cache entries"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliPageOnlyKey,
  bilibiliReloadCacheKeyState.reloadedKey,
  "Bilibili video pages should use the page identity as the subtitle cache key"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.genericNoSlash,
  bilibiliReloadCacheKeyState.genericSlash,
  "generic page URLs should not be merged only because of a trailing slash"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliNoiseA,
  bilibiliReloadCacheKeyState.bilibiliNoiseB,
  "Bilibili video cache identity must ignore tracking query parameters"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliNoiseA,
  bilibiliReloadCacheKeyState.bilibiliNoiseC,
  "Bilibili video cache identity must survive tracking query loss"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.bilibiliPartOne,
  bilibiliReloadCacheKeyState.bilibiliPartTwo,
  "Bilibili multipart videos must keep the p query isolated"
);

const bilibiliReloadCacheAutoLoadState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770000000&upsig=old&oi=111&trid=old&nbs=1";
    const reloadedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new&oi=222&trid=new&nbs=2";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    activeTab = { id: 1, title: "Bilibili video", url: reloadedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: reloadedSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => {
      if (id === savedKey) {
        return {
          id,
          pageUrl: savedPage,
          sourceUrl: savedSource,
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "reloaded cached cue" }]
          }
        };
      }
      return null;
    };
    getAllSubtitleCacheEntries = async () => [];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliReloadAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliReloadFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliReloadAttached),
        follow: Boolean(globalThis.bilibiliReloadFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliReloadAttached;
      delete globalThis.bilibiliReloadFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliReloadCacheAutoLoadState)), {
  loadedText: "reloaded cached cue",
  cachedSubtitleLoadedKey: bilibiliReloadCacheAutoLoadState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(bilibiliReloadCacheAutoLoadState.cachedSubtitleLoadedKey, /^subtitle:v/);

const staleAsyncCacheLoadAfterNavigationIgnoredState = await vm.runInContext(`
  (async () => {
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalGetSubtitleCacheEntryForCurrentPage = getSubtitleCacheEntryForCurrentPage;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    activeTab = { id: 1, title: "old", url: "https://www.bilibili.com/video/BV1XadwBeEzP" };
    currentJobId = "";
    currentJob = null;
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    subtitleLoadRequestId = 100;
    elements.subtitleList.textContent = "";
    pruneSubtitleCache = async () => {};
    getSubtitleCacheEntryForCurrentPage = async () => {
      activeTab = { id: 1, title: "new", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
      clearSubtitles("新页面字幕生成后会显示在这里。");
      return {
        key: "subtitle:old",
        entry: {
          id: "subtitle:old",
          pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP",
          sourceUrl: "https://upos.example.test/old.m4s",
          transcript: {
            source: [],
            translated: [{ start: 0, end: 2, text: "old cached cue" }]
          }
        }
      };
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.staleAsyncCacheAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.staleAsyncCacheFollow = true;
    };
    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        listText: elements.subtitleList.textContent,
        attached: Boolean(globalThis.staleAsyncCacheAttached),
        follow: Boolean(globalThis.staleAsyncCacheFollow)
      };
    } finally {
      pruneSubtitleCache = originalPruneSubtitleCache;
      getSubtitleCacheEntryForCurrentPage = originalGetSubtitleCacheEntryForCurrentPage;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      delete globalThis.staleAsyncCacheAttached;
      delete globalThis.staleAsyncCacheFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleAsyncCacheLoadAfterNavigationIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  listText: "新页面字幕生成后会显示在这里。",
  attached: false,
  follow: false
});

const bilibiliOldSchemaWrongVideoCacheIgnoredState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new";
    const oldSchemaSeed = subtitleCacheSeed(normalizeCacheUrl(currentPage), normalizeMediaCacheUrl(currentSource));
    const wrongOldEntry = {
      id: "subtitle:v3:" + await sha256Text(oldSchemaSeed),
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "哦我的天,今天海绵强强有" }],
        translated: [{ start: 0, end: 3, text: "我的天哪 海绵强强今天" }],
        metadata: { pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP" }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [wrongOldEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliOldWrongAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliOldWrongFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliOldWrongAttached),
        follow: Boolean(globalThis.bilibiliOldWrongFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliOldWrongAttached;
      delete globalThis.bilibiliOldWrongFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliOldSchemaWrongVideoCacheIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false
});

const bilibiliOldSchemaExactCacheLoadsState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new";
    const oldSchemaSeed = subtitleCacheSeed(normalizeCacheUrl(currentPage), normalizeMediaCacheUrl(currentSource));
    const oldEntry = {
      id: "subtitle:v3:" + await sha256Text(oldSchemaSeed),
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:05:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "郝啦B梦原文" }],
        translated: [{ start: 0, end: 3, text: "郝啦B梦译文" }],
        metadata: { pageUrl: currentPage, sourceUrl: currentSource }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === oldEntry.id ? oldEntry : null;
    getAllSubtitleCacheEntries = async () => [oldEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliOldExactAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliOldExactFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliOldExactAttached),
        follow: Boolean(globalThis.bilibiliOldExactFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliOldExactAttached;
      delete globalThis.bilibiliOldExactFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliOldSchemaExactCacheLoadsState)), {
  loadedText: "郝啦B梦译文",
  cachedSubtitleLoadedKey: bilibiliOldSchemaExactCacheLoadsState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(bilibiliOldSchemaExactCacheLoadsState.cachedSubtitleLoadedKey, /^subtitle:v3:/);

const bilibiliCurrentSchemaWrongMetadataCacheIgnoredState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const wrongEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:30:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "哦我的天,今天海绵强强有" }],
        translated: [{ start: 0, end: 3, text: "我的天哪 海绵强强今天" }],
        metadata: { pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP" }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? wrongEntry : null;
    getAllSubtitleCacheEntries = async () => [wrongEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliCurrentWrongAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliCurrentWrongFollow = true;
    };
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.bilibiliCurrentWrongDetached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliCurrentWrongAttached),
        follow: Boolean(globalThis.bilibiliCurrentWrongFollow),
        detached: Boolean(globalThis.bilibiliCurrentWrongDetached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.bilibiliCurrentWrongAttached;
      delete globalThis.bilibiliCurrentWrongFollow;
      delete globalThis.bilibiliCurrentWrongDetached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliCurrentSchemaWrongMetadataCacheIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false,
  detached: true
});

const bilibiliReloadCacheSourceDriftState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const reloadedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const directReloadKey = await buildSubtitleCacheKey({ pageUrl: reloadedPage, sourceUrl: reloadedSource });
    activeTab = { id: 1, title: "Bilibili video", url: reloadedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: reloadedSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const savedEntry = {
      id: savedKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili video",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "same page source drift cue" }]
      }
    };
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [savedEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliSourceDriftAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliSourceDriftFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliSourceDriftAttached),
        follow: Boolean(globalThis.bilibiliSourceDriftFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliSourceDriftAttached;
      delete globalThis.bilibiliSourceDriftFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliReloadCacheSourceDriftState)), {
  loadedText: "same page source drift cue",
  cachedSubtitleLoadedKey: bilibiliReloadCacheSourceDriftState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(bilibiliReloadCacheSourceDriftState.cachedSubtitleLoadedKey, /^subtitle:v/);

const bilibiliBadExactCacheFallsBackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=current";
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id";
    const currentSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const badExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Bad exact cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: { source: [], translated: [] }
    };
    const fallbackEntry = {
      id: fallbackKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Fallback cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "fallback after bad exact cache" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? badExactEntry : null;
    getAllSubtitleCacheEntries = async () => [badExactEntry, fallbackEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliBadExactFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliBadExactFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: fallbackEntry.id,
        attached: Boolean(globalThis.bilibiliBadExactFallbackAttached),
        follow: Boolean(globalThis.bilibiliBadExactFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliBadExactFallbackAttached;
      delete globalThis.bilibiliBadExactFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliBadExactCacheFallsBackState)), {
  loadedText: "fallback after bad exact cache",
  cachedSubtitleLoadedKey: bilibiliBadExactCacheFallsBackState.expectedKey,
  expectedKey: bilibiliBadExactCacheFallsBackState.expectedKey,
  attached: true,
  follow: true
});

const bilibiliSourceOnlyExactCacheFallsBackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=current";
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id";
    const currentSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const sourceOnlyExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Source-only exact cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: {
        source: [{ start: 1, end: 2, text: "source-only preview cache" }],
        translated: []
      }
    };
    const fallbackEntry = {
      id: fallbackKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Translated fallback cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "translated fallback after source-only cache" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    subtitleDisplayMode = "translated";
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? sourceOnlyExactEntry : null;
    getAllSubtitleCacheEntries = async () => [sourceOnlyExactEntry, fallbackEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliSourceOnlyExactFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliSourceOnlyExactFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: sourceOnlyExactEntry.id,
        attached: Boolean(globalThis.bilibiliSourceOnlyExactFallbackAttached),
        follow: Boolean(globalThis.bilibiliSourceOnlyExactFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliSourceOnlyExactFallbackAttached;
      delete globalThis.bilibiliSourceOnlyExactFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliSourceOnlyExactCacheFallsBackState)), {
  loadedText: "source-only preview cache",
  cachedSubtitleLoadedKey: bilibiliSourceOnlyExactCacheFallsBackState.expectedKey,
  expectedKey: bilibiliSourceOnlyExactCacheFallsBackState.expectedKey,
  attached: true,
  follow: true
});

const ordinaryPageBadExactUsesPageFallbackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://example.test/watch/1";
    const currentSource = "https://cdn.example.test/current.mp4?token=current";
    const fallbackSource = "https://cdn.example.test/other.mp4?token=other";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: fallbackSource });
    const badExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Bad exact ordinary cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: { source: [], translated: [] }
    };
    const otherMediaEntry = {
      id: fallbackKey,
      pageUrl: currentPage,
      sourceUrl: fallbackSource,
      title: "Other media cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "must not cross-media fallback" }]
      }
    };
    activeTab = { id: 1, title: "Ordinary page", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "video", role: "video", url: currentSource, title: "Ordinary page", source: "performance-entry" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? badExactEntry : null;
    getAllSubtitleCacheEntries = async () => [badExactEntry, otherMediaEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.ordinaryBadExactAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.ordinaryBadExactFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.ordinaryBadExactAttached),
        follow: Boolean(globalThis.ordinaryBadExactFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.ordinaryBadExactAttached;
      delete globalThis.ordinaryBadExactFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(ordinaryPageBadExactUsesPageFallbackState)), {
  loadedText: "must not cross-media fallback",
  cachedSubtitleLoadedKey: ordinaryPageBadExactUsesPageFallbackState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});

const bilibiliSourceDriftPrefersNewestCacheState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const page = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id";
    const olderSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const newerSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30232.m4s?deadline=2";
    const currentSource = "https://upos.example.test/upgcxcode/55/66/55556666/55556666-1-30280.m4s?deadline=3";
    const olderEntry = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: olderSource }),
      pageUrl: page,
      sourceUrl: olderSource,
      title: "Bilibili older cache",
      updatedAt: "2026-05-23T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "older same page cue" }]
      }
    };
    const newerEntry = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: newerSource }),
      pageUrl: page,
      sourceUrl: newerSource,
      title: "Bilibili newer cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "newer same page cue" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [olderEntry, newerEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliNewestFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliNewestFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: newerEntry.id,
        attached: Boolean(globalThis.bilibiliNewestFallbackAttached),
        follow: Boolean(globalThis.bilibiliNewestFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliNewestFallbackAttached;
      delete globalThis.bilibiliNewestFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliSourceDriftPrefersNewestCacheState)), {
  loadedText: "newer same page cue",
  cachedSubtitleLoadedKey: bilibiliSourceDriftPrefersNewestCacheState.expectedKey,
  expectedKey: bilibiliSourceDriftPrefersNewestCacheState.expectedKey,
  attached: true,
  follow: true
});

const bilibiliSourceDriftClearCacheState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const page = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id";
    const oldSourceA = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const oldSourceB = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30232.m4s?deadline=2";
    const currentSource = "https://upos.example.test/upgcxcode/55/66/55556666/55556666-1-30280.m4s?deadline=3";
    const currentKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const entryA = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: oldSourceA }),
      pageUrl: page,
      sourceUrl: oldSourceA,
      title: "Bilibili source drift cache A",
      updatedAt: "2026-05-23T00:00:00.000Z",
      transcript: { source: [], translated: [{ start: 1, end: 2, text: "cache A" }] }
    };
    const entryB = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: oldSourceB }),
      pageUrl: page,
      sourceUrl: oldSourceB,
      title: "Bilibili source drift cache B",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: { source: [], translated: [{ start: 1, end: 2, text: "cache B" }] }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "cache B" }];
    currentTranscript = entryB.transcript;
    currentSubtitleCacheEntry = entryB;
    cachedSubtitleLoadedKey = entryB.id;
    renderedSubtitleJobId = "cache-" + entryB.id;
    getSubtitleCacheEntry = async id => {
      if (id === entryA.id) return entryA;
      if (id === entryB.id) return entryB;
      return null;
    };
    getAllSubtitleCacheEntries = async () => [entryA, entryB];
    let deletedIds = [];
    deleteSubtitleCacheEntries = async ids => {
      deletedIds = [...ids].sort();
      return ids.filter(id => [entryA.id, entryB.id].includes(id)).length;
    };
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.bilibiliSourceDriftDetached = true;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        deletedIds,
        expectedDeletedIds: [...new Set([currentKey, entryA.id, entryB.id])].sort(),
        detached: Boolean(globalThis.bilibiliSourceDriftDetached),
        cuesLength: subtitleCues.length,
        currentSubtitleCacheEntry,
        cachedSubtitleLoadedKey
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.bilibiliSourceDriftDetached;
    }
  })()
`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(bilibiliSourceDriftClearCacheState.deletedIds)),
  JSON.parse(JSON.stringify(bilibiliSourceDriftClearCacheState.expectedDeletedIds))
);
assert.equal(bilibiliSourceDriftClearCacheState.detached, true);
assert.equal(bilibiliSourceDriftClearCacheState.cuesLength, 0);
assert.equal(bilibiliSourceDriftClearCacheState.currentSubtitleCacheEntry, null);
assert.equal(bilibiliSourceDriftClearCacheState.cachedSubtitleLoadedKey, "");

const bilibiliPartedVideoCacheIsolationState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?p=1";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK?p=2";
    const savedSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const currentSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30280.m4s?deadline=2";
    activeTab = { id: 1, title: "Bilibili part 2", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili part 2", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili part 1",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "part 1 cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliPartedVideoAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliPartedVideoAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliPartedVideoAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliPartedVideoCacheIsolationState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const bilibiliBangumiPageCacheFallbackMissState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/bangumi/play/ep123456?spm_id_from=333.337.0.0";
    const currentPage = "https://www.bilibili.com/bangumi/play/ep123456?from_spmid=666.25";
    const savedSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const currentSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30280.m4s?deadline=2";
    activeTab = { id: 1, title: "Bilibili bangumi", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili bangumi", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili bangumi old media",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "bangumi wrong media cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliBangumiFallbackAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliBangumiFallbackAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliBangumiFallbackAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliBangumiPageCacheFallbackMissState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const genericPageSourceDriftCacheMissState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://example.test/watch/1";
    const savedSource = "https://media.example.test/audio-a.mp4?token=old";
    const currentSource = "https://media.example.test/audio-b.mp4?token=new";
    activeTab = { id: 1, title: "Generic video", url: savedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Generic video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Generic video",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "wrong source cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.genericSourceDriftAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.genericSourceDriftAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.genericSourceDriftAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(genericPageSourceDriftCacheMissState)), {
  cuesLength: 1,
  cachedSubtitleLoadedKey: genericPageSourceDriftCacheMissState.cachedSubtitleLoadedKey,
  attached: true
});
assert.match(genericPageSourceDriftCacheMissState.cachedSubtitleLoadedKey, /^subtitle:v/);

const copiedTabLoadsPageCacheBeforeCandidatesState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const page = "https://example.test/watch/1?utm_source=shared";
    const savedSource = "https://media.example.test/hls/720p/video.m3u8?token=old";
    const savedEntry = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: savedSource }),
      pageUrl: page,
      sourceUrl: savedSource,
      title: "Copied tab video",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [{ start: 1, end: 2, text: "source cue" }],
        translated: [{ start: 1, end: 2, text: "copied tab cached cue" }]
      }
    };
    activeTab = { id: 2, title: "Copied tab video", url: page };
    currentJobId = "";
    currentJob = null;
    candidates = [];
    selectedCandidateKey = "";
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [savedEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.copiedTabPageCacheAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.copiedTabPageCacheFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.copiedTabPageCacheAttached),
        follow: Boolean(globalThis.copiedTabPageCacheFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.copiedTabPageCacheAttached;
      delete globalThis.copiedTabPageCacheFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(copiedTabLoadsPageCacheBeforeCandidatesState)), {
  loadedText: "copied tab cached cue",
  cachedSubtitleLoadedKey: copiedTabLoadsPageCacheBeforeCandidatesState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(copiedTabLoadsPageCacheBeforeCandidatesState.cachedSubtitleLoadedKey, /^subtitle:v/);

const legacySubtitleCacheMatchState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const lookups = [];
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1?utm_source=old" };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/audio-a.mp4?token=current" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const legacyKeys = await buildLegacySubtitleCacheKeys({
      pageUrl: activeTab.url,
      sourceUrl: "https://media.example.test/audio-a.mp4?token=old"
    });
    getSubtitleCacheEntry = async id => {
      lookups.push(id);
      if (id === legacyKeys[0]) {
        return {
          id,
          pageUrl: activeTab.url,
          sourceUrl: "https://media.example.test/audio-a.mp4?token=old",
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "legacy matched cue" }]
          }
        };
      }
      return null;
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.legacyMatchedAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.legacyMatchedFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        lookedUpLegacyPageKey: lookups.includes(legacyKeys[0]),
        attached: Boolean(globalThis.legacyMatchedAttached),
        follow: Boolean(globalThis.legacyMatchedFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.legacyMatchedAttached;
      delete globalThis.legacyMatchedFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(legacySubtitleCacheMatchState)), {
  loadedText: "legacy matched cue",
  cachedSubtitleLoadedKey: legacySubtitleCacheMatchState.cachedSubtitleLoadedKey,
  lookedUpLegacyPageKey: true,
  attached: true,
  follow: true
});
assert.match(legacySubtitleCacheMatchState.cachedSubtitleLoadedKey, /^subtitle:v3:/);

const legacySubtitleCacheMismatchState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1?utm_source=old" };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/audio-a.mp4?token=current" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const legacyKeys = await buildLegacySubtitleCacheKeys({
      pageUrl: activeTab.url,
      sourceUrl: "https://media.example.test/audio-b.mp4?token=old"
    });
    getSubtitleCacheEntry = async id => {
      if (id === legacyKeys[0]) {
        return {
          id,
          pageUrl: activeTab.url,
          sourceUrl: "https://media.example.test/audio-b.mp4?token=old",
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "wrong media cue" }]
          }
        };
      }
      return null;
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.legacyMismatchAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.legacyMismatchAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.legacyMismatchAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(legacySubtitleCacheMismatchState)), {
  cuesLength: 1,
  cachedSubtitleLoadedKey: legacySubtitleCacheMismatchState.cachedSubtitleLoadedKey,
  attached: true
});
assert.match(legacySubtitleCacheMismatchState.cachedSubtitleLoadedKey, /^subtitle:v3:/);

const funAsrProfileUiState = await vm.runInContext(`
  (() => {
    elements.asrVadFilter.children = [
      { value: "auto", hidden: false, textContent: "自动" },
      { value: "on", hidden: false, textContent: "强制开启（自建）" },
      { value: "off", hidden: false, textContent: "关闭" }
    ];
    asrProfiles = [
      {
        id: "dashscope_funasr",
        name: "阿里云 Fun-ASR",
        providerType: "dashscope_funasr",
        baseUrl: "https://dashscope.aliyuncs.com/api/v1",
        model: "fun-asr",
        vadFilter: "auto",
        apiKey: ""
      }
    ];
    elements.asrProfileId.value = "dashscope_funasr";
    renderSelectedProfile("asr");
    return {
      vadDisabled: elements.asrVadFilter.disabled,
      vadValue: elements.asrVadFilter.value,
      autoHidden: elements.asrVadFilter.children[0].hidden,
      forceHidden: elements.asrVadFilter.children[1].hidden,
      offText: elements.asrVadFilter.children[2].textContent,
      hint: elements.asrApiKeyHint.textContent,
      longFileHintHidden: elements.funAsrLongFileHint.hidden
    };
  })()
`, context);

assert.equal(funAsrProfileUiState.vadDisabled, false);
assert.equal(funAsrProfileUiState.vadValue, "auto");
assert.equal(funAsrProfileUiState.autoHidden, false);
assert.equal(funAsrProfileUiState.forceHidden, false);
assert.match(funAsrProfileUiState.offText, /关闭|Off/);
assert.equal(funAsrProfileUiState.hint, "API 密钥只保存在本机浏览器。");
assert.equal(funAsrProfileUiState.longFileHintHidden, false);

const xaiProfileUiState = await vm.runInContext(`
  (() => {
    asrProfiles = [
      {
        id: "xai_asr",
        name: "xAI ASR",
        providerType: "xai",
        baseUrl: "https://api.x.ai/v1",
        model: "",
        apiKey: ""
      }
    ];
    elements.asrProfileId.value = "xai_asr";
    renderSelectedProfile("asr");
    if (elements.asrProviderType) {
      elements.asrProviderType.value = "openai";
    }
    saveProfileFields("asr", "xai_asr");
    return {
      formatHidden: elements.asrProviderTypeField?.hidden,
      modelHidden: elements.asrModelField?.hidden,
      vadHidden: elements.asrVadFilterField?.hidden,
      formatDisplay: elements.asrProviderTypeField?.style.display,
      modelDisplay: elements.asrModelField?.style.display,
      vadDisplay: elements.asrVadFilterField?.style.display,
      providerType: asrProfiles[0].providerType,
      disabled: elements.asrModel.disabled,
      placeholder: elements.asrModel.placeholder,
      hint: elements.asrApiKeyHint.textContent,
      vadFilter: elements.asrVadFilter.value,
      autoHidden: elements.asrVadFilter.children[0].hidden,
      offText: elements.asrVadFilter.children[2].textContent,
      longFileHintHidden: elements.funAsrLongFileHint.hidden
    };
  })()
`, context);

assert.equal(xaiProfileUiState.formatHidden, true);
assert.equal(xaiProfileUiState.modelHidden, true);
assert.equal(xaiProfileUiState.vadHidden, true);
assert.equal(xaiProfileUiState.formatDisplay, "none");
assert.equal(xaiProfileUiState.modelDisplay, "none");
assert.equal(xaiProfileUiState.vadDisplay, "none");
assert.equal(xaiProfileUiState.providerType, "xai");
assert.equal(xaiProfileUiState.disabled, true);
assert.equal(xaiProfileUiState.placeholder, "");
assert.doesNotMatch(xaiProfileUiState.hint, /配置备注|profile note/);
assert.equal(xaiProfileUiState.vadFilter, "auto");
assert.equal(xaiProfileUiState.autoHidden, false);
assert.match(xaiProfileUiState.offText, /关闭|Off/);
assert.equal(xaiProfileUiState.longFileHintHidden, true);

const syntheticHighlightState = await vm.runInContext(`
  (async () => {
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = 1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 0.5, paused: true, synthetic: true }
    });
    await syncSubtitleHighlight();
    return {
      activeCueIndex
    };
  })()
`, context);

assert.equal(syntheticHighlightState.activeCueIndex, 1);

const pausedHighlightState = await vm.runInContext(`
  (async () => {
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 0.5, paused: true, synthetic: false }
    });
    await syncSubtitleHighlight();
    return { activeCueIndex };
  })()
`, context);

assert.equal(pausedHighlightState.activeCueIndex, 0);

const editModeHighlightState = await vm.runInContext(`
  (async () => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    elements.subtitleList.replaceChildren(first, second);
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    subtitleEditMode = true;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 3.5, paused: false, synthetic: false }
    });
    await syncSubtitleHighlight();
    subtitleEditMode = false;
    return {
      activeCueIndex,
      secondActive: second.classList.contains("active"),
      secondScrolled: Boolean(second.scrolledIntoView)
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(editModeHighlightState)), {
  activeCueIndex: 1,
  secondActive: true,
  secondScrolled: false
});

const gapHighlightState = await vm.runInContext(`
  (async () => {
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 2.5, paused: false, synthetic: false }
    });
    await syncSubtitleHighlight();
    const gapIndex = activeCueIndex;
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 6, paused: false, synthetic: false }
    });
    await syncSubtitleHighlight();
    return { gapIndex, afterLastIndex: activeCueIndex };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(gapHighlightState)), {
  gapIndex: 0,
  afterLastIndex: 1
});

const boundarySeekState = await vm.runInContext(`
  (async () => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    elements.subtitleList.replaceChildren(first, second);
    subtitleCues = [
      { start: 48.760, end: 52.019, time: "00:00:48.760 --> 00:00:52.019", text: "15斤30块" },
      { start: 52.019, end: 57.000, time: "00:00:52.019 --> 00:00:57.000", text: "这是什么啊" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async message => (
      message.type === "FUGUANG_SEEK_MEDIA" ? { ok: true } : { ok: false, error: "unexpected" }
    );

    const boundaryIndex = findCueIndexAt(52.019);
    await seekToCue(52.019, 1);

    return {
      boundaryIndex,
      activeCueIndex,
      firstActive: first.classList.contains("active"),
      secondActive: second.classList.contains("active")
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(boundarySeekState)), {
  boundaryIndex: 1,
  activeCueIndex: 1,
  firstActive: false,
  secondActive: true
});

const overlappingCueState = await vm.runInContext(`
  (() => {
    subtitleCues = [
      { start: 0, end: 120, time: "00:00:00.000 --> 00:02:00.000", text: "stale long cue" },
      { start: 76, end: 80, time: "00:01:16.000 --> 00:01:20.000", text: "current cue" }
    ];
    return { activeIndex: findCueIndexAt(77) };
  })()
`, context);

assert.equal(overlappingCueState.activeIndex, 1);

const partialTranscriptMergeState = await vm.runInContext(`
  (() => {
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    });
    return cues.map(cue => ({
      text: cue.text,
      sourceText: cue.sourceText,
      sourceOnly: cue.sourceOnly,
      start: cue.start,
      end: cue.end
    }));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(partialTranscriptMergeState)), [
  { text: "source first", sourceText: "source first", sourceOnly: true, start: 0, end: 2 },
  { text: "translated second", sourceText: "source second", sourceOnly: false, start: 3, end: 5 }
]);

const mixedIdentityTranscriptMergeState = await vm.runInContext(`
  (() => {
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
      ],
      translated: [
        { start: 0, end: 2, text: "translated first without identity" },
        { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
      ]
    });
    return cues.map(cue => ({
      text: cue.text,
      sourceText: cue.sourceText,
      sourceOnly: cue.sourceOnly,
      start: cue.start,
      end: cue.end
    }));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(mixedIdentityTranscriptMergeState)), [
  { text: "translated first without identity", sourceText: "source first", sourceOnly: false, start: 0, end: 2 },
  { text: "translated second", sourceText: "source second", sourceOnly: false, start: 3, end: 5 }
]);

const partialTranscriptAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "partial", status: "completed", stage: "completed_with_warnings" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
      ]
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return { attachedVtt: attachMessage?.vtt || "" };
  })()
`, context);

assert.doesNotMatch(partialTranscriptAttachState.attachedVtt, /source first/);
assert.match(partialTranscriptAttachState.attachedVtt, /translated second/);

const sourceOnlyBilingualCueState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "bilingual";
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    });
    return {
      cues: cues.map(cue => ({ text: cue.text, sourceText: cue.sourceText, sourceOnly: cue.sourceOnly })),
      vtt: cuesToVtt(cues),
      srt: cuesToSrt(cues)
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyBilingualCueState.cues)), [
  { text: "source only", sourceText: "source only", sourceOnly: true }
]);
assert.equal((sourceOnlyBilingualCueState.vtt.match(/source only/g) || []).length, 1);
assert.equal((sourceOnlyBilingualCueState.srt.match(/source only/g) || []).length, 1);

const sourceOnlyCompletedTranslatedAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "source-only-completed", status: "completed", stage: "completed_with_warnings" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      types: messages.map(message => message.type),
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyCompletedTranslatedAttachState.types)), ["FUGUANG_ATTACH_VTT_TEXT"]);
assert.match(sourceOnlyCompletedTranslatedAttachState.attachedVtt, /source only/);

const sourceOnlyCompletedTranslatedListState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "translated";
    currentJob = { id: "source-only-completed-list", status: "completed", stage: "completed_with_warnings" };
    renderedSubtitleJobId = "source-only-completed-list";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only",
        sourceText: "source only",
        sourceOnly: true
      },
      {
        start: 3,
        end: 5,
        time: "00:00:03.000 --> 00:00:05.000",
        text: "translated second",
        sourceText: "source second",
        sourceOnly: false
      }
    ];
    renderSubtitleCueList();
    return {
      listText: elements.subtitleList.textContent,
      children: elements.subtitleList.children.map(item => item.children[1].children.map(line => line.children?.[0]?.textContent || line.textContent))
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyCompletedTranslatedListState.children)), [
  ["translated second"]
]);

const sourceOnlyRunningTranslatedPreviewState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "source-only-running", status: "running", stage: "asr" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only while running", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      types: messages.map(message => message.type),
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyRunningTranslatedPreviewState.types)), ["FUGUANG_ATTACH_VTT_TEXT"]);
assert.match(sourceOnlyRunningTranslatedPreviewState.attachedVtt, /source only while running/);

const sourceOnlyRunningTranslatedListState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "translated";
    currentJob = { id: "source-only-running-list", status: "running", stage: "asr" };
    renderedSubtitleJobId = "source-only-running-list";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only while running",
        sourceText: "source only while running",
        sourceOnly: true
      }
    ];
    renderSubtitleCueList();
    return elements.subtitleList.children.map(item => item.children[1].children.map(line => line.children?.[0]?.textContent || line.textContent));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyRunningTranslatedListState)), [
  ["source only while running"]
]);

const sourceOnlyTranslatedExportState = await vm.runInContext(`
  (async () => {
    const downloads = [];
    subtitleDisplayMode = "translated";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only while running",
        sourceText: "source only while running",
        sourceOnly: true
      }
    ];
    downloadBlob = async (blob, filename) => {
      downloads.push({ text: await blob.text(), filename });
    };
    await exportCurrentSubtitle();
    return {
      downloads: downloads.length,
      message: elements.taskMessage.textContent,
      text: downloads[0]?.text || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyTranslatedExportState)), {
  downloads: 0,
  message: "当前模式下还没有可导出的字幕。",
  text: ""
});

const sourceOnlyBilingualAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    renderedSubtitleJobId = "cache-source-only";
    renderedSubtitleSignature = "source-only:1";
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await toggleSubtitleMode();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      subtitleDisplayMode,
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.equal(sourceOnlyBilingualAttachState.subtitleDisplayMode, "source");
assert.equal((sourceOnlyBilingualAttachState.attachedVtt.match(/source only/g) || []).length, 1);

const subtitleModeCycleState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1 };
    subtitleOverlayEnabled = false;
    subtitleDisplayMode = "translated";
    renderSubtitleModeButton();
    const translatedPressed = elements.subtitleModeToggle["aria-pressed"] ?? null;
    const translatedActive = elements.subtitleModeToggle.dataset.active;
    const translatedLabel = elements.subtitleModeToggle["aria-label"];
    await toggleSubtitleMode();
    const first = subtitleDisplayMode;
    const sourcePressed = elements.subtitleModeToggle["aria-pressed"] ?? null;
    const sourceActive = elements.subtitleModeToggle.dataset.active;
    const sourceLabel = elements.subtitleModeToggle["aria-label"];
    await toggleSubtitleMode();
    const second = subtitleDisplayMode;
    const bilingualPressed = elements.subtitleModeToggle["aria-pressed"] ?? null;
    const bilingualActive = elements.subtitleModeToggle.dataset.active;
    const bilingualLabel = elements.subtitleModeToggle["aria-label"];
    await toggleSubtitleMode();
    const third = subtitleDisplayMode;
    return {
      first,
      second,
      third,
      buttonText: elements.subtitleModeToggle.textContent,
      translatedPressed,
      sourcePressed,
      bilingualPressed,
      translatedActive,
      sourceActive,
      bilingualActive,
      translatedLabel,
      sourceLabel,
      bilingualLabel
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleModeCycleState)), {
  first: "source",
  second: "bilingual",
  third: "translated",
  buttonText: "译文",
  translatedPressed: null,
  sourcePressed: null,
  bilingualPressed: null,
  translatedActive: "true",
  sourceActive: "false",
  bilingualActive: "true",
  translatedLabel: "译文",
  sourceLabel: "原文",
  bilingualLabel: "双语"
});

const subtitleEditModeState = await vm.runInContext(`
  (async () => {
    function findAllByClassName(root, className) {
      if (!root) {
        return [];
      }
      const own = String(root.className || "").split(/\\s+/).includes(className) ? [root] : [];
      return own.concat((root.children || []).flatMap(child => findAllByClassName(child, className)));
    }
    const originalCacheCurrentSubtitles = cacheCurrentSubtitles;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    const originalSyncSet = chrome.storage.sync.set;
    const syncPayloads = [];
    chrome.storage.sync.set = async payload => {
      syncPayloads.push(payload);
    };
    cacheCurrentSubtitles = async () => {};
    attachCurrentSubtitlesToPage = async () => {};
    try {
      currentTranscript = {
        source: [
          { start: 0, end: 1.76, text: "오늘 재미있었다 그치?", chunkIndex: 0, segmentIndex: 0 },
          { start: 2, end: 3, text: "원문만 있는 줄", chunkIndex: 0, segmentIndex: 1 }
        ],
        translated: [{ start: 0, end: 1.76, text: "今天很有趣，对吧?", chunkIndex: 0, segmentIndex: 0 }],
        chunkStatuses: []
      };
      subtitleCues = cuesFromTranscript(currentTranscript);
      subtitleCueSource = "transcript";
      subtitleDisplayMode = "source";
      subtitleOverlayEnabled = true;
      subtitleEditMode = false;
      activeCueIndex = -1;
      elements.subtitleList.scrollTop = 180;
      await toggleSubtitleEditMode();
      const cue = elements.subtitleList.children[0];
      const textWrap = cue.children[1];
      const sourceOnlyCue = elements.subtitleList.children[1];
      const sourceOnlyTextWrap = sourceOnlyCue.children[1];
      return {
        mode: subtitleDisplayMode,
        editMode: subtitleEditMode,
        buttonText: elements.subtitleEditToggle.textContent,
        sourceEditButtons: findAllByClassName(textWrap.children[0], "cue-text-edit").length,
        textEditButtons: findAllByClassName(textWrap, "cue-text-edit").length,
        timeEditButtons: findAllByClassName(cue, "cue-time-edit").length,
        deleteButtons: findAllByClassName(cue, "cue-delete").length,
        sourceText: textWrap.children[0].textContent,
        translatedText: textWrap.children[1].children[0].textContent,
        sourceOnlySourceEditButtons: findAllByClassName(sourceOnlyTextWrap.children[0], "cue-text-edit").length,
        sourceOnlyTextEditButtons: findAllByClassName(sourceOnlyTextWrap, "cue-text-edit").length,
        sourceOnlySourceText: sourceOnlyTextWrap.children[0].textContent,
        sourceOnlyTranslatedText: sourceOnlyTextWrap.children[1].children[0].textContent,
        listScrollTop: elements.subtitleList.scrollTop,
        firstCueScrolled: cue.scrolledIntoView || null,
        syncPayloads
      };
    } finally {
      cacheCurrentSubtitles = originalCacheCurrentSubtitles;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
      chrome.storage.sync.set = originalSyncSet;
    }
  })()
`, context);

assert.equal(subtitleEditModeState.mode, "bilingual");
assert.equal(subtitleEditModeState.editMode, true);
assert.equal(subtitleEditModeState.buttonText, "退出");
assert.equal(subtitleEditModeState.sourceEditButtons, 0);
assert.equal(subtitleEditModeState.textEditButtons, 1);
assert.equal(subtitleEditModeState.timeEditButtons, 1);
assert.equal(subtitleEditModeState.deleteButtons, 1);
assert.equal(subtitleEditModeState.sourceText, "오늘 재미있었다 그치?");
assert.equal(subtitleEditModeState.translatedText, "今天很有趣，对吧?");
assert.equal(subtitleEditModeState.sourceOnlySourceEditButtons, 0);
assert.equal(subtitleEditModeState.sourceOnlyTextEditButtons, 1);
assert.equal(subtitleEditModeState.sourceOnlySourceText, "원문만 있는 줄");
assert.equal(subtitleEditModeState.sourceOnlyTranslatedText, "");
assert.equal(subtitleEditModeState.listScrollTop, 180);
assert.equal(subtitleEditModeState.firstCueScrolled, null);
assert.deepEqual(JSON.parse(JSON.stringify(subtitleEditModeState.syncPayloads)), [{ subtitleDisplayMode: "bilingual" }]);

const subtitleEditAutosaveState = await vm.runInContext(`
  (async () => {
    function findAllByClassName(root, className) {
      if (!root) {
        return [];
      }
      const own = String(root.className || "").split(/\\s+/).includes(className) ? [root] : [];
      return own.concat((root.children || []).flatMap(child => findAllByClassName(child, className)));
    }
    function findByClassName(root, className) {
      return findAllByClassName(root, className)[0] || null;
    }
    const originalCacheCurrentSubtitles = cacheCurrentSubtitles;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    let cacheWrites = 0;
    let attachWrites = 0;
    cacheCurrentSubtitles = async () => {
      cacheWrites += 1;
    };
    attachCurrentSubtitlesToPage = async () => {
      attachWrites += 1;
    };
    try {
      currentTranscript = {
        source: [
          { start: 0, end: 1.76, text: "오늘 재미있었다 그치?", chunkIndex: 0, segmentIndex: 0 },
          { start: 4.019, end: 10.599, text: "바깥에서 계속 껴안았잖아", chunkIndex: 0, segmentIndex: 1 }
        ],
        translated: [
          { start: 0, end: 1.76, text: "今天很有趣，对吧?", chunkIndex: 0, segmentIndex: 0 },
          { start: 4.019, end: 10.599, text: "但是我一直在外面露胸，你没心动吗?", chunkIndex: 0, segmentIndex: 1 }
        ],
        chunkStatuses: []
      };
      subtitleCues = cuesFromTranscript(currentTranscript);
      subtitleCueSource = "transcript";
      subtitleDisplayMode = "bilingual";
      subtitleEditMode = true;
      subtitleEditingTextIndex = -1;
      subtitleEditingTimeIndex = -1;
      activeCueIndex = -1;
      renderSubtitleCueList();

      findByClassName(elements.subtitleList.children[0], "cue-text-edit").listeners.get("click")({ preventDefault() {}, stopPropagation() {} });
      const textArea = findByClassName(elements.subtitleList.children[0], "subtitle-edit-textarea");
      const textAreaAriaLabel = textArea["aria-label"];
      textArea.value = "今天真的很有趣，对吧？";
      await textArea.listeners.get("input")({ target: textArea });
      const cacheWritesAfterTextInput = cacheWrites;
      const attachWritesAfterTextInput = attachWrites;
      await handleSubtitleInlineEditPointerDown({ target: textArea });
      const textEditingIndexAfterInsideClick = subtitleEditingTextIndex;
      await handleSubtitleInlineEditPointerDown({ target: elements.subtitleList });
      const textEditingIndexAfterOutsideClick = subtitleEditingTextIndex;

      findByClassName(elements.subtitleList.children[0], "cue-time-edit").listeners.get("click")({ preventDefault() {}, stopPropagation() {} });
      const timeInputs = findAllByClassName(elements.subtitleList.children[0], "subtitle-time-input");
      timeInputs[0].value = "00:00:00.250 --> 00:00:01.500";
      await timeInputs[0].listeners.get("input")({ target: timeInputs[0] });
      await handleSubtitleInlineEditPointerDown({ target: timeInputs[0] });
      const timeEditingIndexAfterInsideClick = subtitleEditingTimeIndex;
      await handleSubtitleInlineEditPointerDown({ target: elements.subtitleList });
      const timeEditingIndexAfterOutsideClick = subtitleEditingTimeIndex;

      elements.taskMessage.hidden = true;
      elements.taskMessage.textContent = "";
      elements.subtitleList.scrollTop = 240;
      elements.subtitleList.scrollLeft = 4;
      window.scrollY = 620;
      window.scrollX = 8;
      const scrollToCalls = [];
      window.scrollTo = (left, top) => {
        scrollToCalls.push([left, top]);
        window.scrollX = left;
        window.scrollY = top;
      };
      await findByClassName(elements.subtitleList.children[1], "cue-delete").listeners.get("click")({ preventDefault() {}, stopPropagation() {} });

      return {
        cueText: subtitleCues[0]?.text,
        cueStart: subtitleCues[0]?.start,
        cueEnd: subtitleCues[0]?.end,
        translatedText: currentTranscript.translated[0]?.text,
        translatedStart: currentTranscript.translated[0]?.start,
        translatedEnd: currentTranscript.translated[0]?.end,
        sourceStart: currentTranscript.source[0]?.start,
        sourceEnd: currentTranscript.source[0]?.end,
        cueCount: subtitleCues.length,
        sourceCount: currentTranscript.source.length,
        translatedCount: currentTranscript.translated.length,
        textEditingIndexAfterInsideClick,
        textEditingIndexAfterOutsideClick,
        timeEditingIndexAfterInsideClick,
        timeEditingIndexAfterOutsideClick,
        textAreaAriaLabel,
        cacheWritesAfterTextInput,
        attachWritesAfterTextInput,
        listScrollTopAfterDelete: elements.subtitleList.scrollTop,
        listScrollLeftAfterDelete: elements.subtitleList.scrollLeft,
        pageScrollYAfterDelete: window.scrollY,
        pageScrollXAfterDelete: window.scrollX,
        scrollToCalls,
        taskMessageHiddenAfterDelete: elements.taskMessage.hidden,
        taskMessageTextAfterDelete: elements.taskMessage.textContent,
        cacheWrites,
        attachWrites
      };
    } finally {
      cacheCurrentSubtitles = originalCacheCurrentSubtitles;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
    }
  })()
`, context);

assert.equal(subtitleEditAutosaveState.cueText, "今天真的很有趣，对吧？");
assert.equal(subtitleEditAutosaveState.translatedText, "今天真的很有趣，对吧？");
assert.equal(subtitleEditAutosaveState.cueStart, 0.25);
assert.equal(subtitleEditAutosaveState.cueEnd, 1.5);
assert.equal(subtitleEditAutosaveState.translatedStart, 0.25);
assert.equal(subtitleEditAutosaveState.translatedEnd, 1.5);
assert.equal(subtitleEditAutosaveState.sourceStart, 0.25);
assert.equal(subtitleEditAutosaveState.sourceEnd, 1.5);
assert.equal(subtitleEditAutosaveState.cueCount, 1);
assert.equal(subtitleEditAutosaveState.sourceCount, 1);
assert.equal(subtitleEditAutosaveState.translatedCount, 1);
assert.equal(subtitleEditAutosaveState.textEditingIndexAfterInsideClick, 0);
assert.equal(subtitleEditAutosaveState.textEditingIndexAfterOutsideClick, -1);
assert.equal(subtitleEditAutosaveState.timeEditingIndexAfterInsideClick, 0);
assert.equal(subtitleEditAutosaveState.timeEditingIndexAfterOutsideClick, -1);
assert.equal(subtitleEditAutosaveState.textAreaAriaLabel, "编辑译文");
assert.equal(subtitleEditAutosaveState.cacheWritesAfterTextInput, 0);
assert.equal(subtitleEditAutosaveState.attachWritesAfterTextInput, 0);
assert.equal(subtitleEditAutosaveState.listScrollTopAfterDelete, 240);
assert.equal(subtitleEditAutosaveState.listScrollLeftAfterDelete, 4);
assert.equal(subtitleEditAutosaveState.pageScrollYAfterDelete, 620);
assert.equal(subtitleEditAutosaveState.pageScrollXAfterDelete, 8);
assert.deepEqual(JSON.parse(JSON.stringify(subtitleEditAutosaveState.scrollToCalls.at(-1))), [8, 620]);
assert.equal(subtitleEditAutosaveState.taskMessageHiddenAfterDelete, true);
assert.equal(subtitleEditAutosaveState.taskMessageTextAfterDelete, "");
assert.equal(subtitleEditAutosaveState.cacheWrites >= 3, true);
assert.equal(subtitleEditAutosaveState.attachWrites >= 3, true);

const sourcePreviewNoticeText = await vm.runInContext(`
  (() => {
    currentJob = null;
    currentSubtitleCacheEntry = null;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    subtitleCues = [
      { start: 0, end: 2, text: "source first", sourceText: "source first" }
    ];
    currentTranscript = {
      source: [{ start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 }],
      translated: []
    };
    return subtitleNoticeText();
  })()
`, context);

assert.match(sourcePreviewNoticeText, /先显示原文/);
assert.match(sourcePreviewNoticeText, /译文完成后自动更新/);
assert.doesNotMatch(sourcePreviewNoticeText, /拒绝|补位|ASR 原文|列表.*浮层.*导出/);

const partialSourcePreviewNoticeText = await vm.runInContext(`
  (() => {
    currentJob = null;
    currentSubtitleCacheEntry = null;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    subtitleCues = [
      { start: 0, end: 2, text: "source first", sourceText: "source first", sourceOnly: true },
      { start: 3, end: 5, text: "translated second", sourceText: "source second", sourceOnly: false }
    ];
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    };
    return subtitleNoticeText();
  })()
`, context);

assert.match(partialSourcePreviewNoticeText, /部分译文已完成/);
assert.match(partialSourcePreviewNoticeText, /剩余句子/);
assert.doesNotMatch(partialSourcePreviewNoticeText, /拒绝|补位|ASR 原文|列表.*浮层.*导出/);

const runningPartialTranslationNoticeState = await vm.runInContext(`
  (() => {
    currentSubtitleCacheEntry = { id: "subtitle:v1:test", title: "缓存标题" };
    currentJob = {
      id: "running-partial",
      status: "running",
      translation: {
        chunksTotal: 2,
        chunksDone: 1,
        chunkStatuses: [
          { index: 0, stage: "completed", sourceCount: 1, translatedCount: 1 },
          { index: 1, stage: "translation", sourceCount: 1, translatedCount: 0 }
        ]
      }
    };
    taskDetailsExpanded = false;
    taskDetailsManuallyCollapsed = false;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 0, end: 2, text: "translated first", chunkIndex: 0, segmentIndex: 0 }
      ]
    };
    subtitleCues = [
      { start: 0, end: 2, text: "translated first", sourceText: "source first", sourceOnly: false },
      { start: 3, end: 5, text: "source second", sourceText: "source second", sourceOnly: true }
    ];
    elements.taskPanel.classList.remove("subtitles-focus");
    renderSubtitleCueList();
    return {
      hidden: elements.subtitleNotice.hidden,
      notice: elements.subtitleNotice.textContent,
      focus: elements.taskPanel.classList.contains("subtitles-focus"),
      toggleText: elements.toggleTaskDetails.textContent
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(runningPartialTranslationNoticeState)), {
  hidden: false,
  notice: "第 1/2 部分翻译已完成，字幕已可先行观看，剩余翻译仍在后台继续。",
  focus: true,
  toggleText: "展开任务"
});
assert.doesNotMatch(runningPartialTranslationNoticeState.notice, /已加载本地缓存/);

const completedCacheNoticeText = await vm.runInContext(`
  (() => {
    currentJob = {
      id: "completed-cache",
      status: "completed",
      translation: {
        chunksTotal: 2,
        chunksDone: 2,
        chunkStatuses: [
          { index: 0, stage: "completed", sourceCount: 1, translatedCount: 1 },
          { index: 1, stage: "completed", sourceCount: 1, translatedCount: 1 }
        ]
      }
    };
    currentSubtitleCacheEntry = { id: "subtitle:v1:test", title: "缓存标题" };
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 0, end: 2, text: "translated first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    };
    subtitleCues = [
      { start: 0, end: 2, text: "translated first", sourceText: "source first", sourceOnly: false },
      { start: 3, end: 5, text: "translated second", sourceText: "source second", sourceOnly: false }
    ];
    return subtitleNoticeText();
  })()
`, context);

assert.equal(completedCacheNoticeText, "已加载本地缓存：缓存标题");

const attachRefreshState = await vm.runInContext(`
  (async () => {
    let attachCount = 0;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    renderedSubtitleSignature = "job-1:2";
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachCount += 1;
      }
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    await attachCurrentSubtitlesToPage();
    return { attachCount };
  })()
`, context);

assert.equal(attachRefreshState.attachCount, 2);

const staleAttachIgnoredState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old cue" }
    ];
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      messages.push({ type: message.type, tabId: message.tabId });
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        activeTab = { id: 2, title: "New video", url: "https://example.test/watch/new" };
        currentJobId = "job-new";
      }
      return { ok: true };
    };
    try {
      await attachCurrentSubtitlesToPage();
      return {
        messages,
        attachedSubtitleTabId,
        attachedSubtitleSignature
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.equal(staleAttachIgnoredState.attachedSubtitleTabId, 0);
assert.equal(staleAttachIgnoredState.attachedSubtitleSignature, "");
assert.deepEqual(
  JSON.parse(JSON.stringify(staleAttachIgnoredState.messages)),
  [
    { type: "FUGUANG_ATTACH_VTT_TEXT", tabId: 1 },
    { type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }
  ]
);

const staleRetryResultIgnoredState = await vm.runInContext(`
  (async () => {
    const sent = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let queryCount = 0;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    currentJob = {
      id: "job-old",
      status: "failed",
      stage: "failed",
      translation: { chunksFailed: 1, chunkStatuses: [] },
      progress: { chunksFailed: 1 }
    };
    retryRequestInFlight = false;
    chrome.tabs.query = async () => {
      queryCount += 1;
      return queryCount === 1
        ? [{ id: 1, title: "Old video", url: "https://example.test/watch/old" }]
        : [{ id: 2, title: "New video", url: "https://example.test/watch/new" }];
    };
    chrome.runtime.sendMessage = async message => {
      sent.push({ type: message.type, tabId: message.tabId });
      return {
        ok: true,
        message: "旧任务重试返回",
        job: {
          id: "job-stale",
          status: "running",
          stage: "translation",
          translation: { chunkStatuses: [] }
        }
      };
    };
    try {
      await retryPreloadFromSidePanel();
      return {
        sent,
        activeTabId: activeTab.id,
        currentJobId,
        message: elements.taskMessage.textContent
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleRetryResultIgnoredState.sent)), [
  { type: "FUGUANG_RETRY_PRELOAD", tabId: 1 },
  { type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }
]);
assert.equal(staleRetryResultIgnoredState.activeTabId, 2);
assert.notEqual(staleRetryResultIgnoredState.currentJobId, "job-stale");
assert.match(staleRetryResultIgnoredState.message, /标签页.*变化|忽略/);

const cachedSubtitleOverlayRecoveryState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1, url: "https://example.test/watch" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "cached cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === "FUGUANG_GET_VIDEO_STATE") {
        return {
          ok: true,
          state: {
            currentTime: 0,
            subtitleSignature: "",
            subtitleCueCount: 0
          }
        };
      }
      return { ok: true };
    };
    await tryLoadCachedSubtitleForCurrentPage();
    stopSubtitleFollow();
    return { messages };
  })()
`, context);

assert.equal(cachedSubtitleOverlayRecoveryState.messages.includes("FUGUANG_GET_VIDEO_STATE"), true);
assert.equal(cachedSubtitleOverlayRecoveryState.messages.at(-1), "FUGUANG_ATTACH_VTT_TEXT");

const cachedSubtitleAlreadyAttachedState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1, url: "https://example.test/watch" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "cached cue" }
    ];
    const vtt = cuesToVtt(subtitleCues);
    const pageSignature = (() => {
      let hash = 0;
      for (let index = 0; index < vtt.length; index += 1) {
        hash = ((hash << 5) - hash + vtt.charCodeAt(index)) | 0;
      }
      return "manual:" + vtt.length + ":" + Math.abs(hash);
    })();
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, vtt);
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === "FUGUANG_GET_VIDEO_STATE") {
        return {
          ok: true,
          state: {
            currentTime: 0,
            subtitleSignature: pageSignature,
            subtitleCueCount: 1
          }
        };
      }
      return { ok: true };
    };
    await tryLoadCachedSubtitleForCurrentPage();
    stopSubtitleFollow();
    return { messages };
  })()
`, context);

assert.equal(cachedSubtitleAlreadyAttachedState.messages.includes("FUGUANG_GET_VIDEO_STATE"), true);
assert.equal(cachedSubtitleAlreadyAttachedState.messages.includes("FUGUANG_ATTACH_VTT_TEXT"), false);

const noCacheDetachesStaleOverlayState = await vm.runInContext(`
  (async () => {
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalGetSubtitleCacheEntryForCurrentPage = getSubtitleCacheEntryForCurrentPage;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    activeTab = { id: 1, url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    pruneSubtitleCache = async () => {};
    getSubtitleCacheEntryForCurrentPage = async () => ({ key: "", entry: null });
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.noCacheStaleOverlayDetached = true;
    };
    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        detached: Boolean(globalThis.noCacheStaleOverlayDetached),
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey
      };
    } finally {
      pruneSubtitleCache = originalPruneSubtitleCache;
      getSubtitleCacheEntryForCurrentPage = originalGetSubtitleCacheEntryForCurrentPage;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.noCacheStaleOverlayDetached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(noCacheDetachesStaleOverlayState)), {
  detached: true,
  cuesLength: 0,
  cachedSubtitleLoadedKey: ""
});

const sameTabNavigationDetachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    currentJob = { id: "job-old" };
    candidates = [{ key: "old-candidate" }];
    selectedCandidateKey = "old-candidate";
    selectedCandidatePinned = true;
    renderedCandidateSignature = "old-signature";
    lastActivatedTabKey = "old-tab-key";
    clearedSubtitleJobIds.add("job-old");
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    const before = {
      activeUrl: activeTab.url,
      cuesLength: subtitleCues.length,
      attachedSubtitleTabId,
      shouldDetach: Boolean(activeTab?.id && subtitleCues.length)
    };
    chrome.tabs.query = async () => [{ id: 1, title: "New video", url: "https://example.test/watch/new" }];
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      return { ok: true };
    };
    try {
      await refreshActiveTab();
      return {
        messages,
        before,
        changed: Boolean(activeTab?.id && activeTab.url === "https://example.test/watch/new"),
        activeUrl: activeTab.url,
        cuesLength: subtitleCues.length,
        attachedSubtitleTabId,
        selectedCandidateKey,
        selectedCandidatePinned,
        clearedSize: clearedSubtitleJobIds.size
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.equal(
  sameTabNavigationDetachState.messages.includes("FUGUANG_DETACH_PRELOAD_VTT"),
  true,
  JSON.stringify(sameTabNavigationDetachState)
);
assert.equal(sameTabNavigationDetachState.activeUrl, "https://example.test/watch/new");
assert.equal(sameTabNavigationDetachState.cuesLength, 0);
assert.equal(sameTabNavigationDetachState.attachedSubtitleTabId, 0);
assert.equal(sameTabNavigationDetachState.selectedCandidateKey, "");
assert.equal(sameTabNavigationDetachState.selectedCandidatePinned, false);
assert.equal(sameTabNavigationDetachState.clearedSize, 0);

const differentTabDetachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old tab", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "";
    currentJob = null;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old tab cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.tabs.query = async () => [{ id: 2, title: "New tab", url: "https://www.bilibili.com/video/BV1XadwBeEzP" }];
    chrome.runtime.sendMessage = async message => {
      messages.push({ type: message.type, tabId: message.tabId });
      return { ok: true };
    };
    try {
      await refreshActiveTab();
      return {
        messages,
        activeTabId: activeTab.id,
        cuesLength: subtitleCues.length,
        attachedSubtitleTabId
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(differentTabDetachState.messages.filter(message => message.type === "FUGUANG_DETACH_PRELOAD_VTT"))),
  [{ type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }]
);
assert.equal(differentTabDetachState.activeTabId, 2);
assert.equal(differentTabDetachState.cuesLength, 0);
assert.equal(differentTabDetachState.attachedSubtitleTabId, 0);

const staleSubtitleLoadIgnoredState = await vm.runInContext(`
  (async () => {
    const originalLoadSubtitleCues = loadSubtitleCues;
    const originalSendMessage = chrome.runtime.sendMessage;
    let resolveLoad;
    activeTab = { id: 1, title: "Old video", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "job-old";
    subtitleLoadRequestId = 0;
    renderedSubtitleJobId = "";
    renderedSubtitleSignature = "";
    subtitleCues = [];
    loadSubtitleCues = async () => new Promise(resolve => {
      resolveLoad = resolve;
    });
    chrome.runtime.sendMessage = async () => ({ ok: true });
    const pending = renderSubtitles("job-old", {
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        chunksFailed: 0,
        vttPath: "browser-memory",
        contentHash: "old-hash"
      }
    });
    await Promise.resolve();
    activeTab = { id: 1, title: "New video", url: "https://www.bilibili.com/video/BV1XadwBeEzP" };
    currentJobId = "job-new";
    resolveLoad({
      cues: [{ start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "late old cue" }],
      source: "vtt",
      transcript: null
    });
    await pending;
    const state = {
      cuesLength: subtitleCues.length,
      renderedSubtitleJobId,
      renderedSubtitleSignature
    };
    loadSubtitleCues = originalLoadSubtitleCues;
    chrome.runtime.sendMessage = originalSendMessage;
    return state;
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleSubtitleLoadIgnoredState)), {
  cuesLength: 0,
  renderedSubtitleJobId: "",
  renderedSubtitleSignature: ""
});

const startPreloadRefreshesCandidatesState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    const messages = [];
    let startedCandidate = null;
    activeTab = { id: 1, title: "Fresh video", url: "https://example.test/watch/fresh" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/old.m4s", title: "Old video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Fresh video", url: "https://example.test/watch/fresh" }];
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/fresh.m4s", title: "Fresh video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-fresh",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        messages,
        startedUrl: startedCandidate?.url || "",
        selectedCandidateKey,
        candidateCount: candidates.length
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(
  startPreloadRefreshesCandidatesState.startedUrl,
  "https://media.example.test/fresh.m4s",
  JSON.stringify(startPreloadRefreshesCandidatesState)
);
assert.deepEqual(JSON.parse(JSON.stringify(startPreloadRefreshesCandidatesState.messages.slice(0, 3))), [
  "FUGUANG_ACTIVATE_PAGE",
  "FUGUANG_GET_CANDIDATES",
  "FUGUANG_START_PRELOAD_AUTO"
]);
assert.equal(startPreloadRefreshesCandidatesState.candidateCount, 1);
assert.match(startPreloadRefreshesCandidatesState.selectedCandidateKey, /fresh\.m4s$/);

const startPreloadResetsUnpinnedBilibiliSelectionState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let startedCandidate = null;
    activeTab = { id: 1, title: "Bilibili video", url: "https://www.bilibili.com/video/BV1test" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      {
        kind: "audio",
        role: "audio",
        url: "https://upos.example.test/audio.m4s?bili=1",
        title: "Bilibili video",
        source: "bilibili-playurl"
      },
      {
        kind: "media",
        role: "audio",
        url: "https://mcdn.example.test/audio.m4s?perf=1",
        title: "Bilibili video",
        source: "performance-entry"
      }
    ];
    selectedCandidateKey = candidateKey(candidates[1], 1);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Bilibili video", url: "https://www.bilibili.com/video/BV1test" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            {
              kind: "audio",
              role: "audio",
              url: "https://upos.example.test/audio.m4s?bili=1",
              title: "Bilibili video",
              source: "bilibili-playurl"
            },
            {
              kind: "media",
              role: "audio",
              url: "https://mcdn.example.test/audio.m4s?perf=1",
              title: "Bilibili video",
              source: "performance-entry"
            }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-bilibili",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        startedUrl: startedCandidate?.url || "",
        startedSource: startedCandidate?.source || "",
        selectedCandidateKey,
        selectedCandidatePinned
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(startPreloadResetsUnpinnedBilibiliSelectionState.startedSource, "bilibili-playurl");
assert.match(startPreloadResetsUnpinnedBilibiliSelectionState.startedUrl, /bili=1/);
assert.match(startPreloadResetsUnpinnedBilibiliSelectionState.selectedCandidateKey, /bili=1/);
assert.equal(startPreloadResetsUnpinnedBilibiliSelectionState.selectedCandidatePinned, false);

const startPreloadKeepsFreshUserSelectionState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let startedCandidate = null;
    activeTab = { id: 1, title: "Current video", url: "https://example.test/watch/current" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/official.m4s", title: "Current video" },
      { kind: "audio", role: "audio", url: "https://media.example.test/user-selected.m4s", title: "Current video" }
    ];
    selectedCandidateKey = candidateKey(candidates[1], 1);
    selectedCandidatePinned = true;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Current video", url: "https://example.test/watch/current" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/official.m4s", title: "Current video" },
            { kind: "audio", role: "audio", url: "https://media.example.test/user-selected.m4s", title: "Current video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-user-selected",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        startedUrl: startedCandidate?.url || "",
        selectedCandidateKey,
        selectedCandidatePinned
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(startPreloadKeepsFreshUserSelectionState.startedUrl, "https://media.example.test/user-selected.m4s");
assert.match(startPreloadKeepsFreshUserSelectionState.selectedCandidateKey, /user-selected\.m4s$/);
assert.equal(startPreloadKeepsFreshUserSelectionState.selectedCandidatePinned, true);

const startPreloadCancelsIfTabChangesState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    const messages = [];
    let queryCount = 0;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/old.m4s", title: "Old video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => {
      queryCount += 1;
      if (queryCount >= 4) {
        return [{ id: 1, title: "New video", url: "https://example.test/watch/new" }];
      }
      return [{ id: 1, title: "Old video", url: "https://example.test/watch/old" }];
    };
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/old-refreshed.m4s", title: "Old video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        throw new Error("START_PRELOAD_AUTO should not run after tab changes");
      }
      return { ok: true };
    };
    setMessage = text => {
      globalThis.startCancelledMessage = text;
    };
    try {
      await startPreloadFromSidePanel();
      return {
        messages,
        message: globalThis.startCancelledMessage || "",
        activeUrl: activeTab?.url || "",
        queryCount
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
      delete globalThis.startCancelledMessage;
    }
  })()
`, context);

assert.equal(startPreloadCancelsIfTabChangesState.messages.includes("FUGUANG_START_PRELOAD_AUTO"), false);
assert.equal(startPreloadCancelsIfTabChangesState.message, "当前标签页已经变化，已取消提交。请确认媒体源后再开始。");
assert.equal(startPreloadCancelsIfTabChangesState.activeUrl, "https://example.test/watch/new");

const localStartPreloadCancelsIfTabChangesDuringFilePickState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalLocalMediaFiles = globalThis.FuguangLocalMediaFiles;
    const originalSetMessage = setMessage;
    const messages = [];
    let tabChanged = false;
    activeTab = { id: 1, title: "Old local video", url: "file:///Volumes/old/Movie.mp4" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "media", role: "audio", url: "file:///Volumes/old/Movie.mp4", title: "Movie.mp4" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-local-signature";
    chrome.tabs.query = async () => [tabChanged
      ? { id: 2, title: "New local video", url: "file:///Volumes/new/Other.mp4" }
      : { id: 1, title: "Old local video", url: "file:///Volumes/old/Movie.mp4" }
    ];
    globalThis.FuguangLocalMediaFiles = {
      localMediaFileNameFromUrl: () => "Movie.mp4",
      pickLocalMediaFileForSource: async sourceUrl => {
        tabChanged = true;
        return {
          key: sourceUrl,
          name: "Movie.mp4",
          size: 123,
          lastModified: 456
        };
      }
    };
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        throw new Error("START_PRELOAD_AUTO should not run after local file picker changes the active tab");
      }
      return { ok: true };
    };
    setMessage = text => {
      globalThis.localStartCancelledMessage = text;
    };
    try {
      await startPreloadFromSidePanel();
      return {
        messages,
        message: globalThis.localStartCancelledMessage || "",
        activeTabId: activeTab?.id || 0,
        activeUrl: activeTab?.url || ""
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      globalThis.FuguangLocalMediaFiles = originalLocalMediaFiles;
      setMessage = originalSetMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
      delete globalThis.localStartCancelledMessage;
    }
  })()
`, context);

assert.equal(localStartPreloadCancelsIfTabChangesDuringFilePickState.messages.includes("FUGUANG_START_PRELOAD_AUTO"), false);
assert.equal(localStartPreloadCancelsIfTabChangesDuringFilePickState.message, "当前标签页已经变化，已取消提交。请确认媒体源后再开始。");
assert.equal(localStartPreloadCancelsIfTabChangesDuringFilePickState.activeTabId, 2);

const unchangedSubtitleReattachState = await vm.runInContext(`
  (async () => {
    let attachCount = 0;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-reattach";
    renderedSubtitleSignature = "job-reattach:2:2:0";
    subtitleCueSource = "vtt";
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    const currentVtt = cuesToVtt(subtitleCues);
    const currentJob = {
      translation: {
        segmentCount: 2,
        chunksDone: 2,
        chunksFailed: 0,
        vttPath: "cache.vtt",
        vttText: currentVtt
      }
    };
    renderedSubtitleSignature = subtitleSignature("job-reattach", currentJob);
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, currentVtt);
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachCount += 1;
      }
      return { ok: true };
    };
    await renderSubtitles("job-reattach", currentJob);
    stopSubtitleFollow();
    return { attachCount };
  })()
`, context);

assert.equal(unchangedSubtitleReattachState.attachCount, 1);

const sameCountUpdatedSubtitleState = await vm.runInContext(`
  (async () => {
    let attachedVtt = "";
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-text-change";
    renderedSubtitleSignature = "job-text-change:1:1:0";
    subtitleCueSource = "vtt";
    subtitleCues = [
      { start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "old text" }
    ];
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_GET_PRELOAD_TRANSCRIPT") {
        return { ok: false };
      }
      if (message.type === "FUGUANG_GET_PRELOAD_VTT") {
        return { ok: true, vtt: "WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\nnew text\\n" };
      }
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachedVtt = message.vtt;
        return { ok: true };
      }
      return { ok: true };
    };
    await renderSubtitles("job-text-change", {
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        chunksFailed: 0,
        vttPath: "browser-memory"
      }
    });
    stopSubtitleFollow();
    return {
      cueText: subtitleCues[0]?.text,
      attachedVtt
    };
  })()
`, context);

assert.equal(sameCountUpdatedSubtitleState.cueText, "new text");
assert.match(sameCountUpdatedSubtitleState.attachedVtt, /new text/);

const manualSubtitleEditSurvivesRefreshState = await vm.runInContext(`
  (async () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalCacheCurrentSubtitles = cacheCurrentSubtitles;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    let preloadVttRequests = 0;
    let attachCount = 0;
    cacheCurrentSubtitles = async () => {};
    attachCurrentSubtitlesToPage = async () => {
      attachCount += 1;
    };
    try {
      activeTab = { id: 1, url: "https://example.test/manual-edit" };
      currentJobId = "job-manual-edit";
      renderedSubtitleJobId = "job-manual-edit";
      renderedSubtitleSignature = "job-manual-edit:1:1:0";
      manualSubtitleOverride = null;
      subtitleCueSource = "transcript";
      subtitleCues = [
        { start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "旧译文", sourceText: "原文", chunkIndex: 0, segmentIndex: 0 }
      ];
      currentTranscript = {
        source: [{ start: 0, end: 1, text: "原文", chunkIndex: 0, segmentIndex: 0 }],
        translated: [{ start: 0, end: 1, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }],
        chunkStatuses: []
      };
      chrome.runtime.sendMessage = async message => {
        if (message.type === "FUGUANG_GET_PRELOAD_VTT") {
          preloadVttRequests += 1;
          return { ok: true, vtt: "WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\n后台旧字幕\\n" };
        }
        return { ok: true };
      };
      await applySubtitleCueTextEdit(0, "手动新译文");
      await renderSubtitles("job-manual-edit", {
        translation: {
          segmentCount: 1,
          chunksDone: 1,
          chunksFailed: 0,
          vttPath: "browser-memory"
        }
      });
      stopSubtitleFollow();
      return {
        cueText: subtitleCues[0]?.text,
        translatedText: currentTranscript.translated[0]?.text,
        preloadVttRequests,
        attachCount,
        overrideJobId: manualSubtitleOverride?.jobId || ""
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
      cacheCurrentSubtitles = originalCacheCurrentSubtitles;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
      manualSubtitleOverride = null;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(manualSubtitleEditSurvivesRefreshState)), {
  cueText: "手动新译文",
  translatedText: "手动新译文",
  preloadVttRequests: 0,
  attachCount: 2,
  overrideJobId: "job-manual-edit"
});

const manualSubtitleEditCancelsInFlightRenderState = await vm.runInContext(`
  (async () => {
    const originalLoadSubtitleCues = loadSubtitleCues;
    const originalCacheCurrentSubtitles = cacheCurrentSubtitles;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    let resolveLoad;
    let attachCount = 0;
    cacheCurrentSubtitles = async () => {};
    attachCurrentSubtitlesToPage = async () => {
      attachCount += 1;
    };
    loadSubtitleCues = async () => new Promise(resolve => {
      resolveLoad = resolve;
    });
    try {
      activeTab = { id: 1, url: "https://example.test/manual-race" };
      currentJobId = "job-manual-race";
      renderedSubtitleJobId = "job-manual-race";
      renderedSubtitleSignature = "";
      manualSubtitleOverride = null;
      subtitleCueSource = "transcript";
      subtitleCues = [
        { start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "旧译文", sourceText: "原文", chunkIndex: 0, segmentIndex: 0 }
      ];
      currentTranscript = {
        source: [{ start: 0, end: 1, text: "原文", chunkIndex: 0, segmentIndex: 0 }],
        translated: [{ start: 0, end: 1, text: "旧译文", chunkIndex: 0, segmentIndex: 0 }],
        chunkStatuses: []
      };
      const renderPromise = renderSubtitles("job-manual-race", {
        translation: {
          segmentCount: 1,
          chunksDone: 1,
          chunksFailed: 0,
          vttPath: "browser-memory"
        }
      });
      await Promise.resolve();
      await applySubtitleCueTextEdit(0, "竞态手动译文");
      resolveLoad({
        cues: [{ start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "在途旧字幕" }],
        source: "vtt",
        transcript: null
      });
      await renderPromise;
      stopSubtitleFollow();
      return {
        cueText: subtitleCues[0]?.text,
        transcriptText: currentTranscript.translated[0]?.text,
        attachCount,
        overrideJobId: manualSubtitleOverride?.jobId || ""
      };
    } finally {
      loadSubtitleCues = originalLoadSubtitleCues;
      cacheCurrentSubtitles = originalCacheCurrentSubtitles;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
      manualSubtitleOverride = null;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(manualSubtitleEditCancelsInFlightRenderState)), {
  cueText: "竞态手动译文",
  transcriptText: "竞态手动译文",
  attachCount: 1,
  overrideJobId: "job-manual-race"
});

const importedSubtitleSurvivesRefreshState = await vm.runInContext(`
  (async () => {
    const originalParseSubtitleImportText = FuguangSubtitleFormat.parseSubtitleImportText;
    const originalPutSubtitleCacheEntry = putSubtitleCacheEntry;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    const originalLoadSubtitleCues = loadSubtitleCues;
    let putEntryId = "";
    let loadCalls = 0;
    putSubtitleCacheEntry = async entry => {
      putEntryId = entry.id;
    };
    attachCurrentSubtitlesToPage = async () => {};
    loadSubtitleCues = async () => {
      loadCalls += 1;
      return {
        cues: [{ start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "后台旧字幕" }],
        source: "vtt",
        transcript: null
      };
    };
    FuguangSubtitleFormat.parseSubtitleImportText = () => ({
      transcript: {
        source: [{ start: 0, end: 1, text: "导入原文" }],
        translated: [{ start: 0, end: 1, text: "导入译文" }],
        chunkStatuses: [],
        metadata: {
          pageUrl: "https://example.test/import",
          sourceUrl: "https://cdn.example.test/import.mp4",
          jobId: "job-import"
        }
      },
      metadata: {
        pageUrl: "https://example.test/import",
        sourceUrl: "https://cdn.example.test/import.mp4",
        jobId: "job-import"
      },
      format: "srt"
    });
    try {
      activeTab = { id: 1, url: "https://example.test/import", title: "Import page" };
      currentJobId = "job-import";
      renderedSubtitleJobId = "job-import";
      renderedSubtitleSignature = "";
      manualSubtitleOverride = null;
      subtitleCues = [];
      currentTranscript = null;
      elements.subtitleImportFile.files = [{
        name: "manual.srt",
        type: "application/x-subrip",
        text: async () => "1\\n00:00:00,000 --> 00:00:01,000\\n导入译文\\n"
      }];
      await importSubtitleFile();
      await renderSubtitles("job-import", {
        translation: {
          segmentCount: 1,
          chunksDone: 1,
          chunksFailed: 0,
          vttPath: "browser-memory"
        }
      });
      stopSubtitleFollow();
      return {
        cueText: subtitleCues[0]?.text,
        transcriptText: currentTranscript.translated[0]?.text,
        cueSource: subtitleCueSource,
        overrideJobId: manualSubtitleOverride?.jobId || "",
        loadCalls,
        hasCacheEntry: Boolean(putEntryId)
      };
    } finally {
      FuguangSubtitleFormat.parseSubtitleImportText = originalParseSubtitleImportText;
      putSubtitleCacheEntry = originalPutSubtitleCacheEntry;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
      loadSubtitleCues = originalLoadSubtitleCues;
      manualSubtitleOverride = null;
      elements.subtitleImportFile.files = [];
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(importedSubtitleSurvivesRefreshState)), {
  cueText: "导入译文",
  transcriptText: "导入译文",
  cueSource: "transcript",
  overrideJobId: "job-import",
  loadCalls: 0,
  hasCacheEntry: true
});

const subtitleTimeEditValidationState = await vm.runInContext(`
  (async () => {
    const originalPersistSubtitleEdits = persistSubtitleEdits;
    persistSubtitleEdits = async () => {};
    try {
      subtitleCues = [
        { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "A" },
        { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "B" },
        { start: 6, end: 8, time: "00:00:06.000 --> 00:00:08.000", text: "C" }
      ];
      currentTranscript = {
        source: subtitleCues.map(cue => ({ start: cue.start, end: cue.end, text: cue.text })),
        translated: subtitleCues.map(cue => ({ start: cue.start, end: cue.end, text: cue.text })),
        chunkStatuses: []
      };
      const zeroSaved = await applySubtitleCueTimeEdit(1, "00:00:04.000 --> 00:00:04.000");
      const overlapPreviousSaved = await applySubtitleCueTimeEdit(1, "00:00:01.500 --> 00:00:04.000");
      const overlapNextSaved = await applySubtitleCueTimeEdit(1, "00:00:04.000 --> 00:00:06.500");
      const validSaved = await applySubtitleCueTimeEdit(1, "00:00:02.000 --> 00:00:06.000");
      return {
        zeroSaved,
        overlapPreviousSaved,
        overlapNextSaved,
        validSaved,
        cueStart: subtitleCues[1].start,
        cueEnd: subtitleCues[1].end,
        sourceStart: currentTranscript.source[1].start,
        translatedEnd: currentTranscript.translated[1].end
      };
    } finally {
      persistSubtitleEdits = originalPersistSubtitleEdits;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleTimeEditValidationState)), {
  zeroSaved: false,
  overlapPreviousSaved: false,
  overlapNextSaved: false,
  validSaved: true,
  cueStart: 2,
  cueEnd: 6,
  sourceStart: 2,
  translatedEnd: 6
});

const vttRenderClearsStaleTranscriptState = await vm.runInContext(`
  (async () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalCacheCurrentSubtitles = cacheCurrentSubtitles;
    const originalAttachCurrentSubtitlesToPage = attachCurrentSubtitlesToPage;
    cacheCurrentSubtitles = async () => {};
    attachCurrentSubtitlesToPage = async () => {};
    try {
      activeTab = { id: 1, url: "https://example.test/vtt-only" };
      currentJobId = "job-vtt-only";
      renderedSubtitleJobId = "";
      renderedSubtitleSignature = "";
      subtitleCues = [];
      subtitleCueSource = "";
      activeCueIndex = -1;
      currentTranscript = {
        source: [{ start: 10, end: 11, text: "旧原文", chunkIndex: 9, segmentIndex: 9 }],
        translated: [{ start: 10, end: 11, text: "旧译文", chunkIndex: 9, segmentIndex: 9 }],
        chunkStatuses: []
      };
      chrome.runtime.sendMessage = async message => {
        if (message.type === "FUGUANG_GET_PRELOAD_TRANSCRIPT") {
          return { ok: false };
        }
        if (message.type === "FUGUANG_GET_PRELOAD_VTT") {
          return { ok: true, vtt: "WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\nVTT text\\n" };
        }
        return { ok: true };
      };
      await renderSubtitles("job-vtt-only", {
        translation: {
          segmentCount: 1,
          chunksDone: 1,
          chunksFailed: 0,
          vttPath: "cache.vtt"
        }
      });
      const transcriptAfterRenderIsNull = currentTranscript === null;
      await applySubtitleCueTextEdit(0, "新译文");
      return {
        cueSource: subtitleCueSource,
        transcriptAfterRenderIsNull,
        sourceLength: currentTranscript.source.length,
        translatedLength: currentTranscript.translated.length,
        sourceText: currentTranscript.source[0]?.text,
        translatedText: currentTranscript.translated[0]?.text
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
      cacheCurrentSubtitles = originalCacheCurrentSubtitles;
      attachCurrentSubtitlesToPage = originalAttachCurrentSubtitlesToPage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(vttRenderClearsStaleTranscriptState)), {
  cueSource: "vtt",
  transcriptAfterRenderIsNull: true,
  sourceLength: 1,
  translatedLength: 1,
  sourceText: "",
  translatedText: "新译文"
});

const subtitlePendingFailureClearsState = await vm.runInContext(`
  (async () => {
    const originalLoadSubtitleCues = loadSubtitleCues;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-pending-fail";
    renderedSubtitleSignature = "";
    subtitleCues = [];
    pendingSubtitlePromise = null;
    pendingSubtitleSignature = "";
    let firstError = "";
    loadSubtitleCues = async () => {
      throw new Error("simulated subtitle load failure");
    };
    try {
      await renderSubtitles("job-pending-fail", {
        translation: { segmentCount: 1, chunksDone: 1, chunksFailed: 0, vttPath: "browser-memory" }
      });
    } catch (error) {
      firstError = error.message;
    }
    const afterFailure = {
      pendingSubtitlePromise,
      pendingSubtitleSignature
    };
    loadSubtitleCues = async () => ({
      cues: [{ start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "loaded after failure" }],
      source: "vtt",
      transcript: null
    });
    try {
      await renderSubtitles("job-pending-fail", {
        translation: { segmentCount: 1, chunksDone: 1, chunksFailed: 0, vttPath: "browser-memory" }
      });
      stopSubtitleFollow();
      return {
        firstError,
        afterFailure,
        cueText: subtitleCues[0]?.text || "",
        pendingSubtitlePromise,
        pendingSubtitleSignature
      };
    } finally {
      loadSubtitleCues = originalLoadSubtitleCues;
    }
  })()
`, context);

assert.equal(subtitlePendingFailureClearsState.firstError, "simulated subtitle load failure");
assert.equal(subtitlePendingFailureClearsState.afterFailure.pendingSubtitlePromise, null);
assert.equal(subtitlePendingFailureClearsState.afterFailure.pendingSubtitleSignature, "");
assert.equal(subtitlePendingFailureClearsState.cueText, "loaded after failure");
assert.equal(subtitlePendingFailureClearsState.pendingSubtitlePromise, null);
assert.equal(subtitlePendingFailureClearsState.pendingSubtitleSignature, "");

const overlayToggleRoundTripState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    currentSubtitleCacheEntry = null;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "paused cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      return { ok: true };
    };

    await setSubtitleOverlayEnabled(false);
    await setSubtitleOverlayEnabled(true);
    stopSubtitleFollow();

    return {
      messages,
      enabled: subtitleOverlayEnabled,
      attachedSubtitleTabId,
      attachedSubtitleSignature,
      overlayText: elements.subtitleOverlayToggle.textContent,
      ariaPressed: elements.subtitleOverlayToggle["aria-pressed"]
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(overlayToggleRoundTripState.messages)), [
  "FUGUANG_DETACH_PRELOAD_VTT",
  "FUGUANG_ATTACH_VTT_TEXT"
]);
assert.equal(overlayToggleRoundTripState.enabled, true);
assert.equal(overlayToggleRoundTripState.attachedSubtitleTabId, 1);
assert.match(overlayToggleRoundTripState.attachedSubtitleSignature, /^manual:/);
assert.equal(overlayToggleRoundTripState.overlayText, "浮层开");
assert.equal(overlayToggleRoundTripState.ariaPressed, "true");

const chunkMessageState = await vm.runInContext(`
  (() => chunkMetaText({
    stage: "translation",
    attempts: 1,
    sourceCount: 32,
    message: "第 1 次尝试 · 第 2/4 批"
  }))()
`, context);

assert.match(chunkMessageState, /第 2\/4 批/);
