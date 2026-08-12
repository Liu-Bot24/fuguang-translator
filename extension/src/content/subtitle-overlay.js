(() => {
  const LEGACY_OVERLAY_ID = "fuguang-caption-overlay";
  const LEGACY_STYLE_ID = "fuguang-caption-style";
  const OVERLAY_ID = "fuguang-caption-overlay-v2";
  const STYLE_ID = "fuguang-caption-style-v2";
  const OWNER_DATA_KEY = "fuguangCaptionOwner";
  const NATIVE_CUE_CLASS = "fuguang-caption-native-cues";
  const INSTANCE_TOKEN = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nativeTracksByMedia = window.__fuguangSubtitleNativeTracks instanceof WeakMap
    ? window.__fuguangSubtitleNativeTracks
    : new WeakMap();
  window.__fuguangSubtitleNativeTracks = nativeTracksByMedia;

  if (typeof window.__fuguangSubtitleOverlayCleanup === "function") {
    window.__fuguangSubtitleOverlayCleanup();
  }
  removeStaleOverlayDom();

  const MESSAGE = {
    DETACH_PRELOAD_VTT: "FUGUANG_DETACH_PRELOAD_VTT",
    ATTACH_VTT: "FUGUANG_ATTACH_VTT",
    GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE",
    SEEK_MEDIA: "FUGUANG_SEEK_MEDIA"
  };

  const POSITION_STORAGE_KEY = "captionPosition";
  const LEGACY_TOP_RATIO_KEY = "captionTopRatio";
  const SETTINGS_DEFAULTS = {
    subtitleFontSize: 28,
    subtitleBackgroundOpacity: 78,
    subtitleOverlayEnabled: true
  };
  const DEFAULT_POSITION = { x: 0.5, y: 0.72 };
  const MIN_POSITION_RATIO = 0.04;
  const MAX_POSITION_RATIO = 0.96;
  const SEEK_REFRESH_DELAYS = [120, 450, 1200];
  let captionPosition = { ...DEFAULT_POSITION };
  let captionSettings = { ...SETTINGS_DEFAULTS };
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let savePositionTimer = 0;
  let activeVttController = null;
  let lastPrimaryMedia = null;
  const pendingCaptionTimers = new Set();

  try {
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    window.__fuguangSubtitleOverlayCleanup = cleanup;
    document.documentElement.dataset[OWNER_DATA_KEY] = INSTANCE_TOKEN;
  } catch {
    return;
  }

  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (!isActiveOwner()) {
      if (message?.type === MESSAGE.DETACH_PRELOAD_VTT) {
        detachActiveVttController();
        clearCaption();
        sendResponse({ ok: false, stale: true });
        return false;
      }
      if (
        message?.type === MESSAGE.ATTACH_VTT ||
        message?.type === MESSAGE.GET_VIDEO_STATE ||
        message?.type === MESSAGE.SEEK_MEDIA
      ) {
        sendResponse({ ok: false, stale: true, state: null });
        return false;
      }
    }
    if (message?.type === MESSAGE.DETACH_PRELOAD_VTT) {
      detachActiveVttController();
      clearCaption();
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === MESSAGE.ATTACH_VTT) {
      sendResponse({ ok: attachVtt(message.vtt, message.label || "流声字幕", message.signature || "") });
      return false;
    }
    if (message?.type === MESSAGE.GET_VIDEO_STATE) {
      const state = getVideoState();
      sendResponse({ ok: Boolean(state), state });
      return false;
    }
    if (message?.type === MESSAGE.SEEK_MEDIA) {
      sendResponse({ ok: seekMedia(message.time) });
      return false;
    }
    return false;
  }

  loadCaptionSettings();
  loadCaptionPosition();
  try {
    chrome.storage.onChanged.addListener(handleStorageChange);
  } catch {
    // Old content scripts may remain briefly after extension reload.
  }
  document.addEventListener("fullscreenchange", handleFullscreenChange);

  function cleanup() {
    try {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    } catch {
      // Old content script contexts can be invalidated during extension reload.
    }
    detachActiveVttController();
    clearCaption({ force: true });
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("pointermove", dragCaption);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    document.removeEventListener("mousemove", dragCaption);
    document.removeEventListener("mouseup", endDrag);
    const overlay = document.getElementById(OVERLAY_ID);
    const dragHandle = overlay?.querySelector("[data-fuguang-drag-handle]");
    overlay?.removeEventListener("pointerdown", startDrag);
    overlay?.removeEventListener("mousedown", startDrag);
    overlay?.removeEventListener("dblclick", jumpToCurrentCue);
    dragHandle?.removeEventListener("pointerdown", startDrag);
    dragHandle?.removeEventListener("mousedown", startDrag);
    window.removeEventListener("resize", repositionOverlay);
    window.clearTimeout(savePositionTimer);
    if (window.__fuguangSubtitleOverlayCleanup === cleanup) {
      delete window.__fuguangSubtitleOverlayCleanup;
    }
    if (isActiveOwner()) {
      delete document.documentElement.dataset[OWNER_DATA_KEY];
    }
  }

  function renderCaption(text, mode = "preload", cueStart = null) {
    if (!isActiveOwner()) {
      return;
    }
    if (!captionSettings.subtitleOverlayEnabled) {
      clearCaption();
      return;
    }
    const overlay = ensureOverlay();
    const textNode = overlay.querySelector("[data-fuguang-caption-text]");
    const start = Number(cueStart);
    const nextText = String(text || "");
    const nextMode = String(mode || "preload");
    const nextCueStart = Number.isFinite(start) ? String(start) : "";
    const currentCueStart = overlay.dataset.cueStart || "";
    if (
      !overlay.hidden &&
      textNode.textContent === nextText &&
      overlay.dataset.mode === nextMode &&
      currentCueStart === nextCueStart
    ) {
      return;
    }
    if (textNode.textContent !== nextText) {
      textNode.textContent = nextText;
    }
    delete overlay.dataset.dragHold;
    overlay.dataset.mode = nextMode;
    if (Number.isFinite(start)) {
      overlay.dataset.cueStart = String(start);
      overlay.title = "双击跳转到这句字幕";
    } else {
      delete overlay.dataset.cueStart;
      overlay.removeAttribute("title");
    }
    overlay.hidden = false;
  }

  function clearCaption(options = {}) {
    if (!options.force && !isActiveOwner()) {
      return;
    }
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      if (options.deferWhileDragging && isDragging) {
        overlay.hidden = false;
        overlay.dataset.dragHold = "true";
        return;
      }
      delete overlay.dataset.dragHold;
      overlay.hidden = true;
      const textNode = overlay.querySelector("[data-fuguang-caption-text]");
      if (textNode) {
        textNode.textContent = "";
      }
      delete overlay.dataset.cueStart;
      overlay.removeAttribute("title");
    }
  }

  function ensureOverlay() {
    if (!isActiveOwner()) {
      return null;
    }
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      ensureStyle();
      bindOverlayEvents(overlay);
      moveOverlayToCurrentMount();
      applyCaptionPosition(overlay);
      return overlay;
    }
    ensureStyle();
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="fuguang-caption-drag-handle" data-fuguang-drag-handle aria-hidden="true">
        <span></span>
      </div>
      <div class="fuguang-caption-text" data-fuguang-caption-text></div>
    `;
    bindOverlayEvents(overlay);
    getOverlayMount().appendChild(overlay);
    moveOverlayToCurrentMount();
    applyCaptionPosition(overlay);
    return overlay;
  }

  function bindOverlayEvents(overlay) {
    const dragHandle = overlay.querySelector("[data-fuguang-drag-handle]");
    overlay.removeEventListener("pointerdown", startDrag);
    overlay.removeEventListener("mousedown", startDrag);
    overlay.removeEventListener("dblclick", jumpToCurrentCue);
    dragHandle?.removeEventListener("pointerdown", startDrag);
    dragHandle?.removeEventListener("mousedown", startDrag);
    overlay.addEventListener("pointerdown", startDrag);
    overlay.addEventListener("mousedown", startDrag);
    dragHandle?.addEventListener("pointerdown", startDrag);
    dragHandle?.addEventListener("mousedown", startDrag);
    overlay.addEventListener("dblclick", jumpToCurrentCue);
    window.removeEventListener("resize", repositionOverlay);
    window.addEventListener("resize", repositionOverlay);
  }

  function repositionOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      applyCaptionPosition(overlay);
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        align-items: center;
        background: rgba(22, 22, 24, var(--fuguang-caption-bg-opacity, 0.78));
        border-radius: 5px;
        box-sizing: border-box;
        color: #ffffff;
        cursor: grab;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: var(--fuguang-caption-font-size, 28px);
        font-weight: 400;
        justify-content: center;
        left: 50%;
        letter-spacing: 0;
        line-height: 1.25;
        max-width: calc(100vw - 32px);
        min-height: 58px;
        padding: 9px 18px 11px;
        pointer-events: auto;
        position: fixed;
        text-align: center;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
        top: 72vh;
        transform: translate(-50%, -50%);
        transition: background-color 120ms ease, opacity 120ms ease;
        user-select: none;
        white-space: pre-wrap;
        width: min(72vw, 980px);
        z-index: 2147483647;
      }

      #${OVERLAY_ID}[hidden] {
        display: none;
      }

      #${OVERLAY_ID}:hover,
      #${OVERLAY_ID}.is-dragging {
        background: rgba(18, 18, 20, var(--fuguang-caption-bg-hover-opacity, 0.86));
      }

      #${OVERLAY_ID}.is-dragging {
        cursor: grabbing;
      }

      #${OVERLAY_ID} .fuguang-caption-text {
        display: block;
        flex: 1 1 auto;
        max-width: 100%;
        min-width: 0;
        overflow-wrap: break-word;
        word-break: normal;
      }

      #${OVERLAY_ID} .fuguang-caption-drag-handle {
        align-items: center;
        cursor: move;
        display: flex;
        height: 20px;
        justify-content: center;
        left: 0;
        opacity: 0;
        position: absolute;
        right: 0;
        top: -20px;
        transition: opacity 120ms ease;
      }

      #${OVERLAY_ID}:hover .fuguang-caption-drag-handle,
      #${OVERLAY_ID}.is-dragging .fuguang-caption-drag-handle {
        opacity: 1;
      }

      #${OVERLAY_ID} .fuguang-caption-drag-handle span {
        background: rgba(255, 255, 255, 0.86);
        border-radius: 999px;
        box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
        height: 4px;
        width: 42px;
      }

      @media (max-width: 720px) {
        #${OVERLAY_ID} {
          font-size: min(var(--fuguang-caption-font-size, 28px), 32px);
          min-height: 48px;
          padding: 8px 14px 10px;
          width: 88vw;
        }
      }

      #${OVERLAY_ID}.is-fullscreen-mounted {
        max-width: calc(100% - 32px);
        position: absolute;
        width: min(72%, 980px);
      }

      video.${NATIVE_CUE_CLASS}::cue,
      audio.${NATIVE_CUE_CLASS}::cue {
        background-color: rgba(22, 22, 24, var(--fuguang-caption-bg-opacity, 0.78));
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: var(--fuguang-caption-font-size, 28px);
        line-height: 1.25;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
      }

      #${LEGACY_OVERLAY_ID} {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeStaleOverlayDom() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(LEGACY_OVERLAY_ID)?.remove();
    document.getElementById(LEGACY_STYLE_ID)?.remove();
  }

  function isActiveOwner() {
    return document.documentElement.dataset?.[OWNER_DATA_KEY] === INSTANCE_TOKEN;
  }

  function startDrag(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || isDragging) {
      return;
    }
    isDragging = true;
    overlay.classList.add("is-dragging");
    dragOffsetX = event.clientX - overlay.getBoundingClientRect().left - overlay.offsetWidth / 2;
    dragOffsetY = event.clientY - overlay.getBoundingClientRect().top - overlay.offsetHeight / 2;
    if (event.pointerId !== undefined) {
      try {
        overlay.setPointerCapture(event.pointerId);
      } catch {
        // Some synthetic pointer streams do not support capture; document listeners still handle dragging.
      }
      document.addEventListener("pointermove", dragCaption);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    } else {
      document.addEventListener("mousemove", dragCaption);
      document.addEventListener("mouseup", endDrag);
    }
    event.preventDefault();
  }

  function dragCaption(event) {
    if (!isDragging) {
      return;
    }
    const overlay = document.getElementById(OVERLAY_ID);
    const bounds = getOverlayPositionBounds(overlay);
    const targetX = event.clientX - dragOffsetX;
    const targetY = event.clientY - dragOffsetY;
    captionPosition = clampPosition(
      {
        x: (targetX - bounds.left) / bounds.width,
        y: (targetY - bounds.top) / bounds.height
      },
      overlay
    );
    applyCaptionPosition(overlay);
    scheduleCaptionPositionSave();
  }

  function endDrag(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      return;
    }
    isDragging = false;
    overlay.classList.remove("is-dragging");
    if (event.pointerId !== undefined && overlay.hasPointerCapture(event.pointerId)) {
      overlay.releasePointerCapture(event.pointerId);
    }
    document.removeEventListener("pointermove", dragCaption);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    document.removeEventListener("mousemove", dragCaption);
    document.removeEventListener("mouseup", endDrag);
    saveCaptionPosition();
    activeVttController?.updateCaption?.();
  }

  function applyCaptionPosition(overlay) {
    if (!overlay) {
      return;
    }
    captionPosition = clampPosition(captionPosition, overlay);
    const unit = getFullscreenOverlayMount(overlay) ? "%" : "vw";
    overlay.style.left = `${captionPosition.x * 100}${unit}`;
    overlay.style.top = `${captionPosition.y * 100}${unit === "%" ? "%" : "vh"}`;
  }

  async function loadCaptionPosition() {
    try {
      const data = await chrome.storage.sync.get({
        [POSITION_STORAGE_KEY]: DEFAULT_POSITION,
        [LEGACY_TOP_RATIO_KEY]: DEFAULT_POSITION.y
      });
      const stored = data[POSITION_STORAGE_KEY];
      if (stored && typeof stored === "object") {
        captionPosition = clampPosition(
          {
            x: Number(stored.x),
            y: Number(stored.y)
          },
          document.getElementById(OVERLAY_ID)
        );
      } else {
        captionPosition = clampPosition(
          {
            x: DEFAULT_POSITION.x,
            y: Number(data[LEGACY_TOP_RATIO_KEY])
          },
          document.getElementById(OVERLAY_ID)
        );
      }
      applyCaptionPosition(document.getElementById(OVERLAY_ID));
    } catch {
      captionPosition = { ...DEFAULT_POSITION };
    }
  }

  function saveCaptionPosition() {
    try {
      chrome.storage.sync.set({ [POSITION_STORAGE_KEY]: captionPosition }).catch(() => {});
    } catch {
      // The page may still have an old content script after the extension is reloaded.
    }
  }

  function scheduleCaptionPositionSave() {
    window.clearTimeout(savePositionTimer);
    savePositionTimer = window.setTimeout(saveCaptionPosition, 120);
  }

  function getOverlayMount() {
    const fullscreenElement = document.fullscreenElement;
    if (fullscreenElement && !isMediaElement(fullscreenElement)) {
      return fullscreenElement;
    }
    return document.documentElement;
  }

  function handleFullscreenChange() {
    moveOverlayToCurrentMount();
    activeVttController?.updateCaption?.();
  }

  function moveOverlayToCurrentMount() {
    const overlay = document.getElementById(OVERLAY_ID);
    const style = document.getElementById(STYLE_ID);
    const mount = getOverlayMount();
    if (style && style.parentElement !== document.documentElement) {
      document.documentElement.appendChild(style);
    }
    if (overlay && overlay.parentElement !== mount) {
      mount.appendChild(overlay);
    }
    syncOverlayMountState(overlay);
    applyCaptionPosition(overlay);
  }

  function syncOverlayMountState(overlay) {
    if (!overlay) {
      return;
    }
    if (getFullscreenOverlayMount(overlay)) {
      overlay.classList.add("is-fullscreen-mounted");
      overlay.dataset.fullscreenMounted = "true";
    } else {
      overlay.classList.remove("is-fullscreen-mounted");
      delete overlay.dataset.fullscreenMounted;
    }
  }

  async function loadCaptionSettings() {
    try {
      const data = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
      captionSettings = normalizeCaptionSettings(data);
      applyCaptionSettings();
      if (!captionSettings.subtitleOverlayEnabled) {
        detachActiveVttController();
        clearCaption();
      }
    } catch {
      captionSettings = { ...SETTINGS_DEFAULTS };
    }
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "sync") {
      return;
    }
    if (!changes.subtitleFontSize && !changes.subtitleBackgroundOpacity && !changes.subtitleOverlayEnabled) {
      if (!changes[POSITION_STORAGE_KEY]) {
        return;
      }
    }
    if (changes[POSITION_STORAGE_KEY]?.newValue) {
      const stored = changes[POSITION_STORAGE_KEY].newValue;
      captionPosition = clampPosition(
        {
          x: Number(stored.x),
          y: Number(stored.y)
        },
        document.getElementById(OVERLAY_ID)
      );
      applyCaptionPosition(document.getElementById(OVERLAY_ID));
    }
    captionSettings = normalizeCaptionSettings({
      subtitleFontSize: changes.subtitleFontSize?.newValue ?? captionSettings.subtitleFontSize,
      subtitleBackgroundOpacity: changes.subtitleBackgroundOpacity?.newValue ?? captionSettings.subtitleBackgroundOpacity,
      subtitleOverlayEnabled: changes.subtitleOverlayEnabled?.newValue ?? captionSettings.subtitleOverlayEnabled
    });
    applyCaptionSettings();
    if (!captionSettings.subtitleOverlayEnabled) {
      detachActiveVttController();
      clearCaption();
    } else {
      activeVttController?.updateCaption?.();
    }
  }

  function applyCaptionSettings() {
    const root = document.documentElement;
    const opacity = clampNumber(captionSettings.subtitleBackgroundOpacity, 0, 95) / 100;
    root.style.setProperty("--fuguang-caption-font-size", `${clampNumber(captionSettings.subtitleFontSize, 18, 48)}px`);
    root.style.setProperty("--fuguang-caption-bg-opacity", String(opacity));
    root.style.setProperty("--fuguang-caption-bg-hover-opacity", String(Math.min(0.96, opacity + 0.08)));
  }

  function normalizeCaptionSettings(data) {
    return {
      subtitleFontSize: clampNumber(Number(data.subtitleFontSize), 18, 48),
      subtitleBackgroundOpacity: clampNumber(Number(data.subtitleBackgroundOpacity), 0, 95),
      subtitleOverlayEnabled: data.subtitleOverlayEnabled !== false
    };
  }

  function clampPosition(position, overlay) {
    const { width, height } = getOverlayPositionBounds(overlay);
    const halfWidth = overlay ? overlay.offsetWidth / 2 / width : MIN_POSITION_RATIO;
    const halfHeight = overlay ? overlay.offsetHeight / 2 / height : MIN_POSITION_RATIO;
    return {
      x: clampNumber(Number(position.x), Math.max(MIN_POSITION_RATIO, halfWidth), Math.min(MAX_POSITION_RATIO, 1 - halfWidth)),
      y: clampNumber(Number(position.y), Math.max(MIN_POSITION_RATIO, halfHeight), Math.min(MAX_POSITION_RATIO, 1 - halfHeight))
    };
  }

  function getFullscreenOverlayMount(overlay) {
    const mount = document.fullscreenElement;
    if (!overlay || !mount || isMediaElement(mount) || overlay.parentElement !== mount) {
      return null;
    }
    return mount;
  }

  function getOverlayPositionBounds(overlay) {
    const mount = getFullscreenOverlayMount(overlay);
    if (!mount) {
      return {
        left: 0,
        top: 0,
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight)
      };
    }
    const rect = mount.getBoundingClientRect?.() || {};
    return {
      left: Number(rect.left || 0),
      top: Number(rect.top || 0),
      width: Math.max(1, Number(rect.width || mount.clientWidth || window.innerWidth)),
      height: Math.max(1, Number(rect.height || mount.clientHeight || window.innerHeight))
    };
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  function attachVtt(vtt, label, signature = "") {
    if (!vtt || !captionSettings.subtitleOverlayEnabled) {
      detachActiveVttController();
      clearCaption();
      return false;
    }
    const cues = parseVtt(vtt);
    if (!cues.length) {
      detachActiveVttController();
      clearCaption();
      return false;
    }
    detachActiveVttController();
    const events = ["timeupdate", "seeked", "seeking", "play", "pause", "loadedmetadata", "durationchange", "ratechange", "resize"];
    const controller = {
      cues,
      events,
      media: null,
      interval: 0,
      updateCaption: null,
      lastCue: null,
      pendingSeekCue: null,
      pendingSeekUntil: 0,
      label: String(label || "流声字幕"),
      signature: String(signature || ""),
      mediaSignature: "",
      nativeTrack: null,
      nativeTrackMedia: null,
      nativeCues: []
    };
    const updateCaption = () => {
      const media = bindControllerToMedia(controller);
      if (!media) {
        controller.lastCue = null;
        disableNativeSubtitleTrack(controller);
        clearCaption();
        return;
      }
      if (syncNativeFullscreenSubtitles(controller, media)) {
        controller.lastCue = findCueAt(cues, media.currentTime) || null;
        clearCaption({ force: true });
        return;
      }
      disableNativeSubtitleTrack(controller);
      const hasPendingSeekCue = controller.pendingSeekCue && performance.now() < controller.pendingSeekUntil;
      const cue = findCueAt(cues, media.currentTime);
      if (cue) {
        controller.pendingSeekCue = null;
        renderControllerCue(controller, cue);
      } else if (hasPendingSeekCue) {
        renderControllerCue(controller, controller.pendingSeekCue);
      } else if (media.seeking && controller.lastCue && findCueAt([controller.lastCue], media.currentTime)) {
        renderControllerCue(controller, controller.lastCue);
      } else {
        controller.lastCue = null;
        clearCaption({ deferWhileDragging: true });
      }
    };
    controller.updateCaption = updateCaption;
    activeVttController = controller;
    const media = bindControllerToMedia(controller);
    if (!media) {
      detachActiveVttController();
      clearCaption();
      return false;
    }
    controller.interval = window.setInterval(updateCaption, 500);
    updateCaption();
    return true;
  }

  function findCueAt(cues, time) {
    const current = Number(time);
    if (!Number.isFinite(current)) {
      return null;
    }
    let bestCue = null;
    cues.forEach((item, index) => {
      const start = Number(item.start);
      const end = Number(item.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return;
      }
      if (!(current >= start && (current < end || (index === cues.length - 1 && current <= end)))) {
        return;
      }
      if (!bestCue || start >= Number(bestCue.start)) {
        bestCue = item;
      }
    });
    return bestCue;
  }

  function renderControllerCue(controller, cue) {
    controller.lastCue = cue;
    renderCaption(cue.text, "preload", cue.start);
  }

  function bindControllerToMedia(controller) {
    const next = findPrimaryVideo(controller.media);
    if (!next) {
      return null;
    }
    const nextSignature = mediaElementSignature(next);
    if (controller.mediaSignature && nextSignature && controller.mediaSignature !== nextSignature) {
      detachActiveVttController();
      clearCaption();
      return null;
    }
    if (next === controller.media) {
      return controller.media;
    }
    if (controller.media) {
      controller.events.forEach(event => controller.media.removeEventListener(event, controller.updateCaption));
    }
    controller.media = next;
    if (nextSignature) {
      controller.mediaSignature = nextSignature;
    }
    controller.events.forEach(event => next.addEventListener(event, controller.updateCaption));
    return next;
  }

  function mediaElementSignature(media) {
    const source = String(media?.currentSrc || media?.src || "").trim();
    if (source) {
      return `src:${source}`;
    }
    return "";
  }

  function detachActiveVttController() {
    clearPendingCaptionTimers();
    if (!activeVttController) {
      return;
    }
    disableNativeSubtitleTrack(activeVttController);
    const { media, events, updateCaption, interval } = activeVttController;
    if (media) {
      events.forEach(event => media.removeEventListener(event, updateCaption));
    }
    window.clearInterval(interval);
    activeVttController = null;
  }

  function syncNativeFullscreenSubtitles(controller, media) {
    if (!controller || !isMediaElement(media) || document.fullscreenElement !== media) {
      return false;
    }
    const Cue = window.VTTCue || window.TextTrackCue;
    if (!Cue || typeof media.addTextTrack !== "function") {
      return false;
    }
    ensureStyle();
    if (controller.nativeTrackMedia !== media || !controller.nativeTrack) {
      disableNativeSubtitleTrack(controller);
      try {
        controller.nativeTrack = nativeTracksByMedia.get(media) || media.addTextTrack("subtitles", controller.label || "流声字幕", "");
        controller.nativeTrackMedia = media;
        nativeTracksByMedia.set(media, controller.nativeTrack);
      } catch {
        controller.nativeTrack = null;
        controller.nativeTrackMedia = null;
        return false;
      }
    }
    if (!controller.nativeCues.length) {
      controller.cues.forEach(cue => {
        try {
          const nativeCue = new Cue(cue.start, cue.end, cue.text);
          controller.nativeTrack.addCue(nativeCue);
          controller.nativeCues.push(nativeCue);
        } catch {
          // Skip malformed cues; the custom overlay uses the same validated cue list when not in media fullscreen.
        }
      });
    }
    applyNativeCueLayout(controller);
    try {
      controller.nativeTrack.mode = "showing";
    } catch {
      return false;
    }
    const active = controller.nativeCues.length > 0;
    if (active) {
      media.classList.add(NATIVE_CUE_CLASS);
    }
    return active;
  }

  function disableNativeSubtitleTrack(controller) {
    const track = controller?.nativeTrack;
    controller?.nativeTrackMedia?.classList?.remove(NATIVE_CUE_CLASS);
    if (!track) {
      return;
    }
    try {
      track.mode = "disabled";
    } catch {
      // Some browser/player wrappers expose read-only track state.
    }
    const cues = Array.from(track.cues || controller.nativeCues || []);
    cues.forEach(cue => {
      try {
        track.removeCue(cue);
      } catch {
        // The cue may already have been detached by the player.
      }
    });
    controller.nativeTrack = null;
    controller.nativeTrackMedia = null;
    controller.nativeCues = [];
  }

  function applyNativeCueLayout(controller) {
    const x = clampNumber(captionPosition.x * 100, 8, 92);
    const y = clampNumber(captionPosition.y * 100, 8, 92);
    controller.nativeCues.forEach(cue => {
      try {
        cue.snapToLines = false;
        cue.line = y;
        cue.position = x;
        cue.size = 72;
        cue.align = "center";
        if ("lineAlign" in cue) {
          cue.lineAlign = "center";
        }
        if ("positionAlign" in cue) {
          cue.positionAlign = "center";
        }
      } catch {
        // Native cue layout support differs by browser; the cue text still remains available.
      }
    });
  }

  function jumpToCurrentCue(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    const start = Number(overlay?.dataset?.cueStart);
    if (!Number.isFinite(start)) {
      return;
    }
    if (!seekMedia(start)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function parseVtt(vtt) {
    const lines = vtt.replace(/\r/g, "").split("\n");
    const cues = [];
    for (let index = 0; index < lines.length; index += 1) {
      let line = lines[index].trim();
      if (!line || line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
        continue;
      }
      if (!line.includes("-->") && lines[index + 1]?.includes("-->")) {
        index += 1;
        line = lines[index].trim();
      }
      if (!line.includes("-->")) {
        continue;
      }
      const [startText, endText] = line.split("-->").map(value => value.trim().split(/\s+/)[0]);
      const start = parseTimestamp(startText);
      const end = parseTimestamp(endText);
      const textLines = [];
      while (lines[index + 1] && lines[index + 1].trim()) {
        index += 1;
        textLines.push(lines[index].trim());
      }
      const text = textLines.join("\n").replace(/<[^>]+>/g, "").trim();
      if (Number.isFinite(start) && Number.isFinite(end) && text) {
        cues.push({ start, end, text });
      }
    }
    return cues;
  }

  function parseTimestamp(value) {
    const parts = value.replace(",", ".").split(":");
    if (parts.length < 2 || parts.length > 3) {
      return Number.NaN;
    }
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function getVideoState() {
    activeVttController?.updateCaption?.();
    const media = activeVttController ? bindControllerToMedia(activeVttController) : findPrimaryVideo();
    if (!media) {
      return null;
    }
    return {
      currentSrc: media.currentSrc || media.src || "",
      currentTime: media.currentTime,
      duration: media.duration,
      paused: media.paused,
      playbackRate: media.playbackRate,
      subtitleSignature: activeVttController?.signature || "",
      mediaSignature: activeVttController?.mediaSignature || mediaElementSignature(media),
      subtitleCueCount: activeVttController?.cues?.length || 0
    };
  }

  function seekMedia(time) {
    if (activeVttController) {
      bindControllerToMedia(activeVttController);
    }
    const media = activeVttController?.media || findPrimaryVideo();
    const target = Number(time);
    if (!media || !Number.isFinite(target)) {
      return false;
    }
    const targetCue = activeVttController ? findCueAt(activeVttController.cues, target) : null;
    if (activeVttController && targetCue) {
      activeVttController.pendingSeekCue = targetCue;
      activeVttController.pendingSeekUntil = performance.now() + 3000;
    }
    try {
      media.currentTime = Math.max(0, target);
      media.dispatchEvent(new Event("seeking", { bubbles: true }));
      media.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      if (activeVttController && targetCue) {
        renderControllerCue(activeVttController, targetCue);
      }
      activeVttController?.updateCaption?.();
      SEEK_REFRESH_DELAYS.forEach(scheduleCaptionRefresh);
    } catch {
      if (activeVttController) {
        activeVttController.pendingSeekCue = null;
        activeVttController.pendingSeekUntil = 0;
      }
      return false;
    }
    return true;
  }

  function scheduleCaptionRefresh(delay) {
    const timer = window.setTimeout(() => {
      pendingCaptionTimers.delete(timer);
      if (captionSettings.subtitleOverlayEnabled) {
        activeVttController?.updateCaption?.();
      }
    }, delay);
    pendingCaptionTimers.add(timer);
  }

  function clearPendingCaptionTimers() {
    for (const timer of pendingCaptionTimers) {
      window.clearTimeout(timer);
    }
    pendingCaptionTimers.clear();
  }

  function findPrimaryVideo(preferred = null) {
    const media = collectMediaElements(document).filter(mediaStillUsable);
    if (media.length === 0) {
      lastPrimaryMedia = null;
      return null;
    }
    const scored = media
      .map(element => ({
        element,
        score: mediaScore(element),
        visible: mediaIsVisible(element),
        playing: element.paused === false && element.ended !== true
      }))
      .sort((a, b) => b.score - a.score);
    const preferredEntry = scored.find(candidate => candidate.element === preferred);
    if (preferredEntry) {
      const betterPlaying = scored.find(candidate =>
        candidate.element !== preferredEntry.element
        && candidate.playing
        && (!preferredEntry.visible || candidate.score > preferredEntry.score)
      );
      if (betterPlaying) {
        lastPrimaryMedia = betterPlaying.element;
        return lastPrimaryMedia;
      }
      if (preferredEntry.visible || preferredEntry.playing) {
        lastPrimaryMedia = preferredEntry.element;
        return lastPrimaryMedia;
      }
    }
    const lastEntry = scored.find(candidate => candidate.element === lastPrimaryMedia);
    if (lastEntry?.visible || lastEntry?.playing) {
      const betterPlaying = scored.find(candidate =>
        candidate.element !== lastEntry.element
        && candidate.playing
        && candidate.visible
        && candidate.score > lastEntry.score
      );
      if (betterPlaying) {
        lastPrimaryMedia = betterPlaying.element;
        return lastPrimaryMedia;
      }
      return lastPrimaryMedia;
    }
    const bestEntry = scored[0];
    if (bestEntry.visible || bestEntry.playing) {
      lastPrimaryMedia = bestEntry.element;
      return lastPrimaryMedia;
    }
    lastPrimaryMedia = scored[0].element;
    return lastPrimaryMedia;
  }

  function collectMediaElements(root, output = [], seen = new Set()) {
    if (!root || seen.has(root)) {
      return output;
    }
    seen.add(root);
    if (root.matches?.("video, audio")) {
      output.push(root);
    }
    root.querySelectorAll?.("video, audio").forEach(element => output.push(element));
    root.querySelectorAll?.("*").forEach(element => {
      if (element.shadowRoot) {
        collectMediaElements(element.shadowRoot, output, seen);
      }
    });
    return [...new Set(output)];
  }

  function mediaScore(element) {
    const rect = element.getBoundingClientRect?.() || {};
    const width = Number(rect.width || element.clientWidth || element.videoWidth || 0);
    const height = Number(rect.height || element.clientHeight || element.videoHeight || 0);
    const area = Math.max(0, width) * Math.max(0, height);
    const hasDuration = Number.isFinite(element.duration) && element.duration > 0;
    const hasSource = Boolean(element.currentSrc || element.src);
    const visible = mediaIsVisible(element);
    const playing = element.paused === false && element.ended !== true;
    const tagBonus = element.tagName?.toLowerCase() === "video" ? 1_000_000 : 0;
    const readiness = Number(element.readyState || 0) * 1_000;
    return (
      (visible ? 100_000_000 : 0) +
      (playing ? 500_000 : 0) +
      tagBonus +
      area +
      readiness +
      (hasDuration ? 10_000 : 0) +
      (hasSource ? 5_000 : 0)
    );
  }

  function mediaStillUsable(media) {
    return Boolean(media && media.isConnected && typeof media.currentTime === "number");
  }

  function isMediaElement(element) {
    const tagName = String(element?.tagName || "").toLowerCase();
    return tagName === "video" || tagName === "audio";
  }

  function mediaIsVisible(element) {
    const rect = element?.getBoundingClientRect?.() || {};
    const width = Number(rect.width || element?.clientWidth || element?.videoWidth || 0);
    const height = Number(rect.height || element?.clientHeight || element?.videoHeight || 0);
    const style = window.getComputedStyle?.(element);
    const visibleStyle = !style || (style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01);
    const intersectsViewport =
      Number(rect.bottom || 0) > 0 &&
      Number(rect.right || 0) > 0 &&
      Number(rect.top || 0) < window.innerHeight &&
      Number(rect.left || 0) < window.innerWidth;
    return visibleStyle && width > 4 && height > 4 && intersectsViewport;
  }
})();
