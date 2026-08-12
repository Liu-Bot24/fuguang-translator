import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SAMPLE_VTT = `WEBVTT

00:00:00.500 --> 00:00:02.000
first cue

00:00:03.500 --> 00:00:05.000
second cue
`;

const OVERLAPPING_VTT = `WEBVTT

00:00:00.000 --> 00:02:00.000
stale long cue

00:01:16.000 --> 00:01:20.000
current cue
`;

const ADJACENT_VTT = `WEBVTT

00:00:48.760 --> 00:00:52.019
15斤30块

00:00:52.019 --> 00:00:57.000
这是什么啊
`;

const OVERLAY_ID = "fuguang-caption-overlay-v2";
const LEGACY_OVERLAY_ID = "fuguang-caption-overlay";

class FakeVTTCue {
  constructor(startTime, endTime, text) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.text = text;
  }
}

class FakeTextTrack {
  constructor(kind, label, language) {
    this.kind = kind;
    this.label = label;
    this.language = language;
    this.mode = "disabled";
    this.cues = [];
  }

  addCue(cue) {
    this.cues.push(cue);
  }

  removeCue(cue) {
    this.cues = this.cues.filter(item => item !== cue);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.hidden = false;
    this._textContent = "";
    this.textContentWrites = 0;
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.offsetWidth = 480;
    this.offsetHeight = 80;
    this.clientWidth = 480;
    this.clientHeight = 80;
    this.display = "block";
    this.visibility = "visible";
    this.opacity = "1";
    this.listeners = new Map();
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value))
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    };
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    this.textContentWrites += 1;
  }

  get textContent() {
    return this._textContent || "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    if (String(value).includes("data-fuguang-caption-text")) {
      const handle = new FakeElement("div");
      handle.dataset.fuguangDragHandle = "";
      const text = new FakeElement("div");
      text.dataset.fuguangCaptionText = "";
      this.appendChild(handle);
      this.appendChild(text);
    }
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  appendChild(child) {
    child.parentElement = this;
    child.isConnected = true;
    this.children.push(child);
    this.ownerDocument?.registerElement(child);
    child.ownerDocument = this.ownerDocument;
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
    this.ownerDocument?.unregisterElement(this);
    this.parentElement = null;
    this.isConnected = false;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = [...(this.listeners.get(event.type) || [])];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  querySelector(selector) {
    if (selector === "[data-fuguang-caption-text]") {
      return this.children.find(child => Object.hasOwn(child.dataset, "fuguangCaptionText")) || null;
    }
    if (selector === "[data-fuguang-drag-handle]") {
      return this.children.find(child => Object.hasOwn(child.dataset, "fuguangDragHandle")) || null;
    }
    return null;
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }
}

class FakeMedia extends FakeElement {
  constructor({ width = 640, height = 360, currentTime = 0, paused = false } = {}) {
    super("video");
    this.clientWidth = width;
    this.clientHeight = height;
    this.videoWidth = width;
    this.videoHeight = height;
    this.currentTime = currentTime;
    this.duration = 120;
    this.paused = paused;
    this.ended = false;
    this.readyState = 4;
    this.currentSrc = "https://media.example.test/video.mp4";
    this.src = this.currentSrc;
    this.textTracks = [];
  }

  addTextTrack(kind, label, language) {
    const track = new FakeTextTrack(kind, label, language);
    this.textTracks.push(track);
    return track;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }
}

class FakeDocument {
  constructor(videos) {
    this.byId = new Map();
    this.videos = videos;
    this.fullscreenElement = null;
    this.documentElement = new FakeElement("html");
    this.documentElement.ownerDocument = this;
    this.listeners = new Map();
  }

  registerElement(element) {
    if (element.id) {
      this.byId.set(element.id, element);
    }
    element.ownerDocument = this;
  }

  unregisterElement(element) {
    if (element.id && this.byId.get(element.id) === element) {
      this.byId.delete(element.id);
    }
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  querySelectorAll(selector) {
    if (selector === "video, audio") {
      return this.videos;
    }
    return [];
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = [...(this.listeners.get(event.type) || [])];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }
}

class FakeEvent {
  constructor(type) {
    this.type = type;
  }
}

function createHarness({ settings = {}, videos = [new FakeMedia()], legacyOverlayText = "", existingCleanup = false } = {}) {
  const intervals = new Map();
  const timeouts = new Map();
  let nextTimer = 1;
  let messageListener = null;
  const messageListeners = [];
  let storageListener = null;
  let cleanupCalled = false;
  const document = new FakeDocument(videos);
  videos.forEach(video => {
    video.ownerDocument = document;
  });
  if (legacyOverlayText) {
    const staleOverlay = new FakeElement("div");
    staleOverlay.id = LEGACY_OVERLAY_ID;
    staleOverlay.textContent = legacyOverlayText;
    document.documentElement.appendChild(staleOverlay);
  }
  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    document,
    Event: FakeEvent,
    getComputedStyle: element => ({
      display: element?.display || "block",
      visibility: element?.visibility || "visible",
      opacity: element?.opacity || "1"
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval(fn, delay) {
      const id = nextTimer++;
      intervals.set(id, { fn, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(fn, delay) {
      const id = nextTimer++;
      timeouts.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    }
  };
  window.VTTCue = FakeVTTCue;
  window.TextTrackCue = FakeVTTCue;
  window.window = window;
  if (existingCleanup) {
    window.__fuguangSubtitleOverlayCleanup = () => {
      cleanupCalled = true;
    };
  }

  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          messageListeners.push(listener);
          messageListener = listener;
        },
        removeListener() {}
      }
    },
    storage: {
      sync: {
        get: async defaults => ({ ...defaults, ...settings }),
        set: async () => {}
      },
      onChanged: {
        addListener(listener) {
          storageListener = listener;
        },
        removeListener() {}
      }
    }
  };

  const context = vm.createContext({
    chrome,
    console,
    document,
    window,
    Event: FakeEvent,
    VTTCue: FakeVTTCue,
    TextTrackCue: FakeVTTCue,
    performance: { now: () => 1000 },
    Map,
    Set,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Promise
  });

  const source = fs.readFileSync(new URL("../../extension/src/content/subtitle-overlay.js", import.meta.url), "utf8");
  assert.equal(source.includes("FUGUANG_SET_CAPTION"), false);
  assert.equal(source.includes("FUGUANG_CLEAR_CAPTION"), false);
  assert.equal(source.includes("realtime"), false);
  vm.runInContext(source, context, { filename: "subtitle-overlay.js" });

  return {
    context,
    videos,
    intervals,
    timeouts,
    messageListeners,
    ready: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
    send: message => new Promise(resolve => {
      messageListener(message, {}, resolve);
    }),
    sendWith: (listener, message) => new Promise(resolve => {
      listener(message, {}, resolve);
    }),
    reload: () => {
      vm.runInContext(source, context, { filename: "subtitle-overlay.js" });
    },
    emitStorage: changes => storageListener(changes, "sync"),
    runIntervals: () => [...intervals.values()].forEach(timer => timer.fn()),
    cleanupCalled: () => cleanupCalled,
    overlayText: () => document.getElementById(OVERLAY_ID)
      ?.querySelector("[data-fuguang-caption-text]")
      ?.textContent || "",
    overlayTextWrites: () => document.getElementById(OVERLAY_ID)
      ?.querySelector("[data-fuguang-caption-text]")
      ?.textContentWrites || 0,
    overlayHidden: () => document.getElementById(OVERLAY_ID)?.hidden,
    overlay: () => document.getElementById(OVERLAY_ID),
    clearOverlayOnly: () => {
      const overlay = document.getElementById(OVERLAY_ID);
      overlay.hidden = true;
      const textNode = overlay.querySelector("[data-fuguang-caption-text]");
      if (textNode) {
        textNode.textContent = "";
      }
    }
  };
}

{
  const video = new FakeMedia({ currentTime: 1, paused: false });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  harness.overlay().dispatchEvent({
    type: "mousedown",
    clientX: 640,
    clientY: 520,
    preventDefault: () => {}
  });
  video.currentTime = 2.5;
  video.dispatchEvent(new harness.context.Event("timeupdate"));

  assert.equal(harness.overlayHidden(), false);
  assert.equal(harness.overlayText(), "first cue");

  harness.context.document.dispatchEvent({ type: "mouseup", clientX: 640, clientY: 520 });
  harness.runIntervals();

  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: false });
  const harness = createHarness({ videos: [video] });
  const fullscreenHost = harness.context.document.createElement("div");
  fullscreenHost.clientWidth = 1024;
  fullscreenHost.clientHeight = 576;
  harness.context.document.documentElement.appendChild(fullscreenHost);
  harness.context.document.fullscreenElement = fullscreenHost;
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);

  const overlay = harness.overlay();
  assert.equal(overlay.parentElement, fullscreenHost);
  assert.equal(overlay.classList.contains("is-fullscreen-mounted"), true);
  assert.equal(overlay.style.left, "50%");
  assert.equal(overlay.style.top, "72%");
  assert.equal(video.textTracks.length, 0);
}

{
  const video = new FakeMedia({ currentTime: 1, paused: false });
  const harness = createHarness({ videos: [video] });
  harness.context.document.fullscreenElement = video;
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);

  const overlay = harness.overlay();
  assert.equal(overlay?.hidden ?? true, true);
  assert.equal(video.textTracks.length, 1);
  assert.equal(video.textTracks[0].label, "流声字幕");
  assert.equal(video.textTracks[0].mode, "showing");
  assert.equal(video.textTracks[0].cues.length, 2);
  assert.equal(video.textTracks[0].cues[0].snapToLines, false);
  assert.equal(video.textTracks[0].cues[0].line, 72);
  assert.equal(video.textTracks[0].cues[0].position, 50);
  assert.equal(video.textTracks[0].cues[0].align, "center");
  assert.equal(video.textTracks[0].cues[0].size, 72);
  assert.equal(video.classList.contains("fuguang-caption-native-cues"), true);
  assert.match(
    harness.context.document.getElementById("fuguang-caption-style-v2").textContent,
    /video\.fuguang-caption-native-cues::cue/
  );
  assert.doesNotMatch(
    harness.context.document.getElementById("fuguang-caption-style-v2").textContent,
    /(?:^|\s)video::cue/
  );

  harness.context.document.fullscreenElement = null;
  harness.context.document.dispatchEvent(new harness.context.Event("fullscreenchange"));

  assert.equal(video.textTracks[0].mode, "disabled");
  assert.equal(video.classList.contains("fuguang-caption-native-cues"), false);
  assert.equal(harness.overlay().parentElement, harness.context.document.documentElement);
  assert.equal(harness.overlayHidden(), false);
  assert.equal(harness.overlayText(), "first cue");

  harness.context.document.fullscreenElement = video;
  harness.context.document.dispatchEvent(new harness.context.Event("fullscreenchange"));

  assert.equal(video.textTracks.length, 1, "反复进出媒体全屏应复用同一条插件字幕轨");
  assert.equal(video.textTracks[0].mode, "showing");
  assert.equal(video.textTracks[0].cues.length, 2);
  assert.equal(video.classList.contains("fuguang-caption-native-cues"), true);
}

{
  const video = new FakeMedia({ currentTime: 1 });
  const harness = createHarness({ videos: [video], legacyOverlayText: "REAL_CHROME_CUE_0700" });
  await harness.ready();
  assert.equal(harness.context.document.getElementById(LEGACY_OVERLAY_ID), null);
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
}

{
  const video = new FakeMedia({ currentTime: 1 });
  const harness = createHarness({ videos: [video], legacyOverlayText: "REAL_CHROME_CUE_0700", existingCleanup: true });
  await harness.ready();
  assert.equal(harness.cleanupCalled(), true);
  assert.equal(harness.context.document.getElementById(LEGACY_OVERLAY_ID), null);
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
}

{
  const video = new FakeMedia({ currentTime: 1 });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  const oldListener = harness.messageListeners[0];
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  harness.reload();
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: OVERLAPPING_VTT })).ok, true);
  assert.equal(harness.overlayText(), "stale long cue");

  const staleAttachResponse = await harness.sendWith(oldListener, { type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT });
  assert.equal(staleAttachResponse.ok, false);
  const staleStateResponse = await harness.sendWith(oldListener, { type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(staleStateResponse.ok, false);
  assert.equal(staleStateResponse.state, null);
  const staleSeekResponse = await harness.sendWith(oldListener, { type: "FUGUANG_SEEK_MEDIA", time: 4 });
  assert.equal(staleSeekResponse.ok, false);
  harness.runIntervals();
  assert.equal(harness.overlayText(), "stale long cue");
}

{
  const harness = createHarness({ settings: { subtitleOverlayEnabled: false } });
  await harness.ready();
  const response = await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT });
  assert.equal(response.ok, false);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.overlayText(), "");
}

{
  const video = new FakeMedia({ currentTime: 52.019 });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: ADJACENT_VTT })).ok, true);
  assert.equal(harness.overlayText(), "这是什么啊");

  video.currentTime = 52.01;
  harness.runIntervals();
  assert.equal(harness.overlayText(), "15斤30块");

  video.currentTime = 52.05;
  harness.runIntervals();
  assert.equal(harness.overlayText(), "这是什么啊");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: true });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "sample-signature" })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  const writesAfterFirstAttach = harness.overlayTextWrites();
  assert.equal((await harness.send({
    type: "FUGUANG_ATTACH_VTT",
    vtt: `${SAMPLE_VTT}
00:00:06.000 --> 00:00:07.000
later cue
`,
    signature: "sample-signature-2"
  })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  assert.equal(harness.overlayTextWrites(), writesAfterFirstAttach);
}

{
  const video = new FakeMedia({ currentTime: 1, paused: true });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "sample-signature" })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.state.subtitleSignature, "sample-signature");
  assert.equal(stateResponse.state.subtitleCueCount, 2);

  video.paused = false;
  harness.runIntervals();
  assert.equal(harness.overlayText(), "first cue");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: true });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "sample-signature" })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  assert.equal(harness.intervals.size, 1);

  assert.equal((await harness.send({ type: "FUGUANG_DETACH_PRELOAD_VTT" })).ok, true);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.subtitleSignature, "");
  assert.equal(stateResponse.state.subtitleCueCount, 0);
}

{
  const video = new FakeMedia({ currentTime: 1, paused: true });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "sample-signature" })).ok, true);
  harness.clearOverlayOnly();
  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");

  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.subtitleSignature, "sample-signature");
  assert.equal(stateResponse.state.subtitleCueCount, 2);
  assert.equal(harness.overlayHidden(), false);
  assert.equal(harness.overlayText(), "first cue");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: true });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal((await harness.send({ type: "FUGUANG_SEEK_MEDIA", time: 4 })).ok, true);
  assert.equal(harness.overlayText(), "second cue");
}

{
  const video = new FakeMedia({ currentTime: 77, paused: false });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: OVERLAPPING_VTT })).ok, true);
  assert.equal(harness.overlayText(), "current cue");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: false });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  video.isConnected = false;
  harness.runIntervals();

  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
}

{
  const oldVideo = new FakeMedia({ width: 1200, height: 680, currentTime: 1, paused: false });
  oldVideo.currentSrc = "https://media.example.test/old-video.mp4";
  oldVideo.src = oldVideo.currentSrc;
  const harness = createHarness({ videos: [oldVideo] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  oldVideo.isConnected = false;
  const newVideo = new FakeMedia({ width: 1200, height: 680, currentTime: 4, paused: false });
  newVideo.currentSrc = "https://media.example.test/old-video.mp4";
  newVideo.src = newVideo.currentSrc;
  newVideo.ownerDocument = harness.context.document;
  harness.videos.push(newVideo);
  harness.runIntervals();

  assert.equal(harness.overlayText(), "second cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 4);
}

{
  const oldVideo = new FakeMedia({ width: 1200, height: 680, currentTime: 1, paused: false });
  oldVideo.currentSrc = "https://media.example.test/old-video.mp4";
  oldVideo.src = oldVideo.currentSrc;
  const harness = createHarness({ videos: [oldVideo] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "old-video-signature" })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  oldVideo.isConnected = false;
  const newVideo = new FakeMedia({ width: 1200, height: 680, currentTime: 4, paused: false });
  newVideo.currentSrc = "https://media.example.test/new-video.mp4";
  newVideo.src = newVideo.currentSrc;
  newVideo.ownerDocument = harness.context.document;
  harness.videos.push(newVideo);
  harness.runIntervals();

  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.subtitleSignature, "");
}

{
  const video = new FakeMedia({ width: 1200, height: 680, currentTime: 1, paused: false });
  video.currentSrc = "https://media.example.test/old-video.mp4";
  video.src = video.currentSrc;
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT, signature: "old-video-signature" })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  video.currentSrc = "https://media.example.test/new-video.mp4";
  video.src = video.currentSrc;
  video.currentTime = 4;
  harness.runIntervals();

  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.subtitleSignature, "");
}

{
  const video = new FakeMedia({ currentTime: 1, paused: false });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  video.paused = true;
  video.dispatchEvent(new harness.context.Event("pause"));
  assert.equal(harness.overlayText(), "first cue");

  video.currentTime = 2.5;
  video.dispatchEvent(new harness.context.Event("timeupdate"));
  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");

  video.currentTime = 4;
  video.paused = false;
  video.dispatchEvent(new harness.context.Event("play"));
  assert.equal(harness.overlayHidden(), false);
  assert.equal(harness.overlayText(), "second cue");
}

{
  const video = new FakeMedia({ currentTime: 1 });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  assert.equal(harness.intervals.size, 1);

  assert.equal((await harness.send({ type: "FUGUANG_SEEK_MEDIA", time: 4 })).ok, true);
  assert.equal(harness.overlayText(), "second cue");
  assert.equal(harness.timeouts.size, 3);

  harness.emitStorage({ subtitleOverlayEnabled: { newValue: false } });
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.timeouts.size, 0);
  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
}

{
  const firstVideo = new FakeMedia({ width: 900, height: 500, currentTime: 1, paused: false });
  const secondVideo = new FakeMedia({ width: 240, height: 160, currentTime: 4, paused: true });
  const harness = createHarness({ videos: [firstVideo, secondVideo] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  secondVideo.clientWidth = 1200;
  secondVideo.clientHeight = 680;
  secondVideo.paused = false;
  harness.runIntervals();

  assert.equal(harness.overlayText(), "second cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 4);
}

{
  const hiddenPreview = new FakeMedia({ width: 320, height: 180, currentTime: 12, paused: true });
  hiddenPreview.display = "none";
  const visibleMain = new FakeMedia({ width: 1200, height: 680, currentTime: 1, paused: true });
  const harness = createHarness({ videos: [hiddenPreview, visibleMain] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 1);
}

{
  const firstVideo = new FakeMedia({ width: 900, height: 500, currentTime: 1, paused: true });
  const secondVideo = new FakeMedia({ width: 240, height: 160, currentTime: 4, paused: true });
  const harness = createHarness({ videos: [firstVideo, secondVideo] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  firstVideo.display = "none";
  secondVideo.clientWidth = 1200;
  secondVideo.clientHeight = 680;
  secondVideo.paused = false;
  harness.runIntervals();

  assert.equal(harness.overlayText(), "second cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 4);
}

{
  const firstVideo = new FakeMedia({ width: 900, height: 500, currentTime: 1, paused: true });
  const secondVideo = new FakeMedia({ width: 240, height: 160, currentTime: 4, paused: true });
  const harness = createHarness({ videos: [firstVideo, secondVideo] });
  await harness.ready();
  const initialState = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(initialState.ok, true);
  assert.equal(initialState.state.currentTime, 1);

  secondVideo.clientWidth = 1400;
  secondVideo.clientHeight = 900;
  harness.runIntervals();

  const stableState = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stableState.ok, true);
  assert.equal(stableState.state.currentTime, 1);
}

{
  const mainVideo = new FakeMedia({ width: 1200, height: 680, currentTime: 1, paused: true });
  const visiblePreview = new FakeMedia({ width: 180, height: 100, currentTime: 4, paused: false });
  const harness = createHarness({ videos: [mainVideo, visiblePreview] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  harness.runIntervals();

  assert.equal(harness.overlayText(), "first cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 1);
}
