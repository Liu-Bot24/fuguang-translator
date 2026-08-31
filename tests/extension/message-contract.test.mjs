import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  background: read("extension/src/background/service-worker.js"),
  sidepanel: read("extension/src/sidepanel/sidepanel.js"),
  offscreen: read("extension/src/offscreen/offscreen.js"),
  overlay: read("extension/src/content/subtitle-overlay.js"),
  mediaBridge: read("extension/src/content/media-bridge.js"),
  pageSniffer: read("extension/src/content/page-sniffer.js")
};
const webFfmpeg = read("extension/web-ffmpeg/src/app.js");

const backgroundMessages = parseMessageObject(files.background);
const sidepanelMessages = parseMessageObject(files.sidepanel);
const offscreenMessages = parseMessageObject(files.offscreen);
const overlayMessages = parseMessageObject(files.overlay);

assert.deepEqual(sidepanelMessages, pick(backgroundMessages, Object.keys(sidepanelMessages)));
assert.deepEqual(offscreenMessages, pick(backgroundMessages, Object.keys(offscreenMessages)));
assert.deepEqual(
  overlayMessages,
  pick(backgroundMessages, ["DETACH_PRELOAD_VTT", "ATTACH_VTT", "GET_VIDEO_STATE", "SEEK_MEDIA"])
);

const backgroundHandled = messageKeysForPattern(files.background, /case MESSAGE\.([A-Z0-9_]+):/g);
assert.deepEqual(backgroundHandled, new Set([
  "GET_STATUS",
  "GET_CANDIDATES",
  "ACTIVATE_PAGE",
  "START_PRELOAD_AUTO",
  "RETRY_PRELOAD",
  "RETRY_PRELOAD_CHUNKS",
  "RERUN_ASR_PRELOAD",
  "RETRANSLATE_PRELOAD",
  "RETRANSLATE_TRANSCRIPT",
  "CANCEL_PRELOAD",
  "CLEAR_PRELOAD_AUDIO_CACHE",
  "CHECK_PRELOAD_JOB",
  "GET_PRELOAD_VTT",
  "GET_PRELOAD_TRANSCRIPT",
  "GET_PRELOAD_DIAGNOSTICS",
  "GET_VIDEO_STATE",
  "ATTACH_VTT_TEXT",
  "DETACH_PRELOAD_VTT",
  "CLEAR_PRELOAD_SUBTITLE_STATE",
  "SEEK_MEDIA",
  "PAGE_MEDIA_FOUND",
  "PAGE_CONTEXT_FOUND",
  "OFFSCREEN_WEB_FFMPEG_PROGRESS",
  "OFFSCREEN_WEB_FFMPEG_CHUNK_READY",
  "OFFSCREEN_WEB_FFMPEG_COMPLETED",
  "OFFSCREEN_WEB_FFMPEG_FAILED",
  "UPDATE_MEDIA_HEADER_RULE_DOMAINS"
]));

const sidepanelSent = messageKeysForPattern(files.sidepanel, /type:\s*MESSAGE\.([A-Z0-9_]+)/g);
sidepanelSent.delete("SIDEPANEL_SUBSCRIBE");
assert.equal(hasSetDifference(sidepanelSent, backgroundHandled), false);
assert.ok(files.sidepanel.includes("MESSAGE.SIDEPANEL_JOB_CHANGED"));
assert.ok(files.background.includes("MESSAGE.SIDEPANEL_SUBSCRIBE"));

const offscreenHandled = messageKeysForPattern(files.offscreen, /message\?\.type === MESSAGE\.([A-Z0-9_]+)/g);
assert.deepEqual(offscreenHandled, new Set([
  "OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  "OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO",
  "OFFSCREEN_CANCEL_JOB",
  "OFFSCREEN_GET_ACTIVE_MEDIA_HEADER_LEASES"
]));

const offscreenSent = messageKeysForPattern(files.offscreen, /type:\s*MESSAGE\.([A-Z0-9_]+)/g);
assert.equal(hasSetDifference(offscreenSent, backgroundHandled), false);

const backgroundRuntimeSent = messageKeysForPattern(files.background, /chrome\.runtime\.sendMessage\(\{\s*type:\s*MESSAGE\.([A-Z0-9_]+)/g);
assert.deepEqual(backgroundRuntimeSent, new Set([
  "OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  "OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO",
  "OFFSCREEN_CANCEL_JOB",
  "OFFSCREEN_GET_ACTIVE_MEDIA_HEADER_LEASES"
]));
assert.equal(hasSetDifference(backgroundRuntimeSent, offscreenHandled), false);

const overlayHandled = messageKeysForPattern(files.overlay, /message\?\.type === MESSAGE\.([A-Z0-9_]+)/g);
const backgroundTabSent = messageKeysForPattern(files.background, /(?:broadcastMessageToFrames\([^,]+,\s*\{\s*type:\s*MESSAGE\.|chrome\.tabs\.sendMessage\([^,]+,\s*\{\s*type:\s*MESSAGE\.)([A-Z0-9_]+)/g);
assert.equal(hasSetDifference(backgroundTabSent, overlayHandled), false);

for (const messageKey of Object.keys(backgroundMessages)) {
  const occurrences = countMessageKeyOccurrences(files.background, messageKey);
  assert.ok(occurrences > 1, `background message ${messageKey} is defined but never used`);
}

assert.deepEqual(runtimeMessagesFromMediaBridge(), new Set([
  backgroundMessages.PAGE_MEDIA_FOUND,
  backgroundMessages.PAGE_CONTEXT_FOUND
]));
assert.ok(files.pageSniffer.includes("FUGUANG_PAGE_SNIFFER_MEDIA"));
assert.ok(files.pageSniffer.includes("FUGUANG_PAGE_SNIFFER_CONTEXT"));

const offscreenWebFfmpegRequests = new Set([
  ...files.offscreen.matchAll(/type:\s*"([^"]+)"/g)
].map(match => match[1]).filter(type => ["ping", "load", "extract-audio", "concat-audio", "collect-speech-audio"].includes(type)));
assert.deepEqual(offscreenWebFfmpegRequests, new Set(["ping", "load", "extract-audio", "concat-audio", "collect-speech-audio"]));

const webFfmpegHandledRequests = new Set([
  ...webFfmpeg.matchAll(/message\.type === "([^"]+)"/g)
].map(match => match[1]));
assert.deepEqual(webFfmpegHandledRequests, new Set(["ping", "load", "extract-audio", "concat-audio", "collect-speech-audio"]));

const webFfmpegReplies = new Set([
  ...webFfmpeg.matchAll(/type:\s*"([^"]+)"/g)
].map(match => match[1]).filter(type => ["ready", "loaded", "result", "progress", "error"].includes(type)));
assert.deepEqual(webFfmpegReplies, new Set(["ready", "loaded", "result", "progress", "error"]));
const offscreenHandledReplies = new Set([
  ...files.offscreen.matchAll(/message\.type === "([^"]+)"/g)
].map(match => match[1]).filter(type => ["ready", "loaded", "result", "progress", "error"].includes(type)));
assert.deepEqual(offscreenHandledReplies, new Set(["ready", "loaded", "result", "progress", "error"]));

for (const [name, source] of Object.entries(files)) {
  const rawRuntimeMessages = [...source.matchAll(/["'](FUGUANG_[A-Z0-9_]+)["']/g)].map(match => match[1]);
  const known = new Set([
    ...Object.values(backgroundMessages),
    "FUGUANG_PAGE_SNIFFER_MEDIA",
    "FUGUANG_PAGE_SNIFFER_CONTEXT"
  ]);
  const unknown = rawRuntimeMessages.filter(value => !known.has(value));
  assert.deepEqual(unknown, [], `${name} contains unknown Fuguang message strings`);
}

function parseMessageObject(source) {
  const block = source.match(/const MESSAGE = \{([\s\S]*?)\n\s*};/)?.[1] || "";
  const entries = {};
  for (const match of block.matchAll(/\b([A-Z0-9_]+):\s*"([^"]+)"/g)) {
    entries[match[1]] = match[2];
  }
  return entries;
}

function pick(source, keys) {
  return Object.fromEntries(keys.map(key => [key, source[key]]));
}

function messageKeysForPattern(source, pattern) {
  return new Set([...source.matchAll(pattern)].map(match => match[1]));
}

function hasSetDifference(left, right) {
  return [...left].some(value => !right.has(value));
}

function countMessageKeyOccurrences(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (source.match(new RegExp(`\\b(?:${escaped}|MESSAGE\\.${escaped})\\b`, "g")) || []).length;
}

function runtimeMessagesFromMediaBridge() {
  const values = new Set();
  const constants = {};
  for (const match of files.mediaBridge.matchAll(/\b([A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) {
    constants[match[1]] = match[2];
  }
  for (const match of files.mediaBridge.matchAll(/type:\s*([A-Z0-9_]+)/g)) {
    if (constants[match[1]]) {
      values.add(constants[match[1]]);
    }
  }
  return values;
}

function read(relativePath) {
  return fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}
