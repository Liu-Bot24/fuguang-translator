(() => {
  const PAGE_SNIFFER_REVISION = "20260829-light-deep-modes";
  if (
    window.__fuguangPageSnifferRevision === PAGE_SNIFFER_REVISION &&
    typeof window.__fuguangPageSnifferRescan === "function"
  ) {
    try {
      window.__fuguangPageSnifferRescan();
    } catch {
      // Page inspection must never affect the host page.
    }
    return;
  }
  if (typeof window.__fuguangPageSnifferCleanup === "function") {
    window.__fuguangPageSnifferCleanup();
  }

  const MESSAGE_TYPE = "FUGUANG_PAGE_SNIFFER_MEDIA";
  const CONTEXT_TYPE = "FUGUANG_PAGE_SNIFFER_CONTEXT";
  const MAX_DEPTH = 8;
  const MAX_DOCUMENT_MARKUP_SCAN_CHARS = 2_000_000;
  const MAX_FMP4_BINARY_INSPECTIONS = 80;
  const MAX_FMP4_BINARY_INSPECTION_BYTES = 768 * 1024;
  const X_TWITTER_TWEET_RESULT_FALLBACK = {
    queryId: "SgZWKwvBiOKrSC0QeOGvXw",
    operationName: "TweetResultByRestId",
    featureSwitches: [
      "creator_subscriptions_tweet_preview_api_enabled",
      "premium_content_api_read_enabled",
      "communities_web_enable_tweet_community_results_fetch",
      "c9s_tweet_anatomy_moderator_badge_enabled",
      "responsive_web_grok_analyze_button_fetch_trends_enabled",
      "responsive_web_grok_analyze_post_followups_enabled",
      "rweb_cashtags_composer_attachment_enabled",
      "responsive_web_jetfuel_frame",
      "responsive_web_grok_share_attachment_enabled",
      "responsive_web_grok_annotations_enabled",
      "articles_preview_enabled",
      "responsive_web_edit_tweet_api_enabled",
      "rweb_conversational_replies_downvote_enabled",
      "graphql_is_translatable_rweb_tweet_is_translatable_enabled",
      "view_counts_everywhere_api_enabled",
      "longform_notetweets_consumption_enabled",
      "responsive_web_twitter_article_tweet_consumption_enabled",
      "content_disclosure_indicator_enabled",
      "content_disclosure_ai_generated_indicator_enabled",
      "responsive_web_grok_show_grok_translated_post",
      "responsive_web_grok_analysis_button_from_backend",
      "post_ctas_fetch_enabled",
      "rweb_cashtags_enabled",
      "freedom_of_speech_not_reach_fetch_enabled",
      "standardized_nudges_misinfo",
      "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled",
      "longform_notetweets_rich_text_read_enabled",
      "longform_notetweets_inline_media_enabled",
      "profile_label_improvements_pcf_label_in_post_enabled",
      "responsive_web_profile_redirect_enabled",
      "rweb_tipjar_consumption_enabled",
      "verified_phone_label_enabled",
      "responsive_web_grok_image_annotation_enabled",
      "responsive_web_grok_imagine_annotation_enabled",
      "responsive_web_grok_community_note_auto_translation_is_enabled",
      "responsive_web_graphql_skip_user_profile_image_extensions_enabled",
      "responsive_web_graphql_timeline_navigation_enabled"
    ],
    fieldToggles: [
      "withArticleRichContentState",
      "withArticlePlainText",
      "withArticleSummaryText",
      "withArticleVoiceOver",
      "withGrokAnalyze",
      "withDisallowedReplyControls",
      "withPayments",
      "withAuxiliaryUserLabels"
    ]
  };
  const X_TWITTER_BEARER_FALLBACK = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const URL_PATTERN = /https?:\/\/[^\s"'<>\\)]+|\/\/[^\s"'<>\\)]+/gi;
  const MEDIA_EXTENSIONS = new Set([
    "aac",
    "flac",
    "m3u",
    "m3u8",
    "m4a",
    "m4s",
    "mp3",
    "mp4",
    "mpd",
    "oga",
    "ogg",
    "opus",
    "ts",
    "wav",
    "weba",
    "webm"
  ]);

  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const originalJsonParse = JSON.parse;
  let lastContextSignature = "";
  let lastDocumentMarkupSignature = "";
  let fmp4BinaryInspections = 0;
  let jsonHookEnabled = false;
  const seenPerformanceUrls = new Set();
  const timers = [];
  const contextTimer = setInterval(reportPageContext, 1200);
  const performanceTimer = setInterval(scanPerformanceEntries, 1500);
  timers.push(contextTimer, performanceTimer);

  reportPageContext();
  scheduleInitialScan();
  window.__fuguangPageSnifferCleanup = cleanup;
  window.__fuguangPageSnifferRescan = scheduleInitialScan;
  window.__fuguangPageSnifferSetMode = setSniffingMode;
  window.__fuguangPageSnifferRevision = PAGE_SNIFFER_REVISION;

  const fuguangFetch = function fuguangFetch(input, init) {
    safelyInspect(() => {
      inspectUrl(typeof input === "string" ? input : input?.url, "fetch-url");
      inspectHeaders(init?.headers);
    });
    const promise = originalFetch.apply(this, arguments);
    safelyInspect(() => {
      promise?.then?.(
        response => safelyInspect(() => inspectResponse(response)),
        () => {}
      );
    });
    return promise;
  };
  fuguangFetch.toString = () => originalFetch.toString();
  window.fetch = fuguangFetch;

  const fuguangXhrOpen = function fuguangXhrOpen(method, url) {
    safelyInspect(() => {
      this.__fuguangUrl = url;
    });
    return originalXhrOpen.apply(this, arguments);
  };
  fuguangXhrOpen.toString = () => originalXhrOpen.toString();
  XMLHttpRequest.prototype.open = fuguangXhrOpen;

  const fuguangXhrSend = function fuguangXhrSend() {
    this.addEventListener("load", () => {
      safelyInspect(() => {
        const url = this.responseURL || this.__fuguangUrl;
        inspectUrl(url, "xhr-url");
        if (typeof this.response === "string") {
          inspectText(this.response, url, "xhr-body");
        } else if (this.response && typeof this.response === "object") {
          if (this.response instanceof ArrayBuffer) {
            inspectBinaryResponse(this.response, url, "xhr-body", this.getResponseHeader?.("content-type") || "", this.getResponseHeader?.("content-length") || "");
          } else if (typeof this.response.arrayBuffer === "function") {
            this.response.arrayBuffer()
              .then(buffer => safelyInspect(() => inspectBinaryResponse(buffer, url, "xhr-body", this.getResponseHeader?.("content-type") || "", this.getResponseHeader?.("content-length") || "")))
              .catch(() => {});
          } else {
            inspectObject(this.response, "xhr-object");
          }
        }
      });
    });
    return originalXhrSend.apply(this, arguments);
  };
  fuguangXhrSend.toString = () => originalXhrSend.toString();
  XMLHttpRequest.prototype.send = fuguangXhrSend;

  const fuguangJsonParse = function fuguangJsonParse(text, reviver) {
    const result = originalJsonParse.apply(this, arguments);
    safelyInspect(() => inspectObject(result, "json-parse"));
    return result;
  };
  fuguangJsonParse.toString = () => originalJsonParse.toString();

  function setSniffingMode(mode) {
    const deep = String(mode || "").toLowerCase() === "deep";
    if (deep && !jsonHookEnabled && JSON.parse === originalJsonParse) {
      JSON.parse = fuguangJsonParse;
      jsonHookEnabled = true;
    } else if (!deep && jsonHookEnabled && JSON.parse === fuguangJsonParse) {
      JSON.parse = originalJsonParse;
      jsonHookEnabled = false;
    }
    scheduleInitialScan();
    return deep ? "deep" : "light";
  }

  function safelyInspect(task) {
    try {
      return task();
    } catch {
      return undefined;
    }
  }

  function cleanup() {
    if (window.fetch === fuguangFetch) {
      window.fetch = originalFetch;
    }
    if (XMLHttpRequest.prototype.open === fuguangXhrOpen) {
      XMLHttpRequest.prototype.open = originalXhrOpen;
    }
    if (XMLHttpRequest.prototype.send === fuguangXhrSend) {
      XMLHttpRequest.prototype.send = originalXhrSend;
    }
    setSniffingMode("light");
    timers.forEach(timer => clearTimeout(timer));
    timers.length = 0;
    if (window.__fuguangPageSnifferCleanup === cleanup) {
      delete window.__fuguangPageSnifferCleanup;
    }
    if (window.__fuguangPageSnifferRescan === scheduleInitialScan) {
      delete window.__fuguangPageSnifferRescan;
    }
    if (window.__fuguangPageSnifferSetMode === setSniffingMode) {
      delete window.__fuguangPageSnifferSetMode;
    }
    if (window.__fuguangPageSnifferRevision === PAGE_SNIFFER_REVISION) {
      delete window.__fuguangPageSnifferRevision;
    }
  }

  function scheduleInitialScan() {
    scanKnownPageState();
    scanDocumentMarkup();
    scanPerformanceEntries();
    probeXTwitterTweetMedia();
    probeBilibiliPlayurl();
    timers.push(setTimeout(scanKnownPageState, 500));
    timers.push(setTimeout(scanDocumentMarkup, 500));
    timers.push(setTimeout(scanPerformanceEntries, 500));
    timers.push(setTimeout(probeXTwitterTweetMedia, 1000));
    timers.push(setTimeout(probeBilibiliPlayurl, 1000));
    timers.push(setTimeout(scanKnownPageState, 2000));
    timers.push(setTimeout(scanDocumentMarkup, 2000));
    timers.push(setTimeout(scanPerformanceEntries, 2000));
    timers.push(setTimeout(probeXTwitterTweetMedia, 3000));
    timers.push(setTimeout(probeBilibiliPlayurl, 3000));
    timers.push(setTimeout(probeXTwitterTweetMedia, 7000));
    timers.push(setTimeout(probeBilibiliPlayurl, 7000));
  }

  async function probeXTwitterTweetMedia() {
    const statusId = readXTwitterStatusId();
    if (!statusId) {
      return;
    }
    const key = `tweet:${statusId}`;
    const lastProbe = window.__fuguangLastXTwitterTweetProbe || {};
    if (lastProbe.key === key && lastProbe.ok) {
      return;
    }
    window.__fuguangLastXTwitterTweetProbe = { key, ok: false, at: Date.now() };
    try {
      const operation = await resolveXTwitterTweetResultOperation();
      const bearer = operation.bearer || X_TWITTER_BEARER_FALLBACK;
      if (!operation.queryId || !bearer) {
        return;
      }
      const response = await fetchXTwitterTweetResult(statusId, operation, bearer);
      if (!response || response.ok === false) {
        return;
      }
      const text = await response.text();
      const json = originalJsonParse(text);
      inspectObject(json, "x-twitter-player-json");
      await probeXTwitterHlsManifests(collectXTwitterHlsUrls(json));
      window.__fuguangLastXTwitterTweetProbe = { key, ok: true, at: Date.now() };
    } catch {
      // X/Twitter probing is a targeted enrichment layer; normal sniffing still runs.
    }
  }

  function readXTwitterStatusId() {
    if (!/(^|\.)x\.com$/i.test(location.hostname) && !/(^|\.)twitter\.com$/i.test(location.hostname)) {
      return "";
    }
    try {
      return new URL(location.href).pathname.match(/\/status\/(\d+)/i)?.[1] || "";
    } catch {
      return "";
    }
  }

  async function resolveXTwitterTweetResultOperation() {
    const inlineText = [...(document.scripts || [])].map(script => script.textContent || "").join("\n");
    const inlineOperation = extractXTwitterOperationConfig(inlineText, "TweetResultByRestId");
    const inlineBearer = extractXTwitterBearerToken(inlineText);
    if (inlineOperation.queryId && inlineBearer) {
      return { ...inlineOperation, bearer: inlineBearer };
    }
    const scriptTexts = [];
    for (const src of xTwitterScriptUrls()) {
      const text = await fetchXTwitterScriptText(src);
      if (text) {
        scriptTexts.push(text);
      }
      const operation = extractXTwitterOperationConfig(text, "TweetResultByRestId");
      const bearer = inlineBearer || extractXTwitterBearerToken(text);
      if (operation.queryId && bearer) {
        return { ...operation, bearer };
      }
    }
    const externalText = scriptTexts.join("\n");
    const fallbackBearer = inlineBearer || extractXTwitterBearerToken(externalText) || X_TWITTER_BEARER_FALLBACK;
    return { ...X_TWITTER_TWEET_RESULT_FALLBACK, bearer: fallbackBearer };
  }

  function xTwitterScriptUrls() {
    return [...(document.scripts || [])]
      .map(script => script.src || "")
      .filter(src => /\/responsive-web\/client-web\/(?:main|vendor)\.[^/]+\.js(?:$|[?#])/i.test(src));
  }

  async function fetchXTwitterScriptText(src) {
    try {
      const response = await originalFetch.call(window, src, { credentials: "omit", cache: "force-cache" });
      if (response.ok === false) {
        return "";
      }
      return response.text();
    } catch {
      return "";
    }
  }

  function extractXTwitterBearerToken(text) {
    return String(text || "").match(/Bearer\s+([A-Za-z0-9%._-]+)/)?.[1] || "";
  }

  function extractXTwitterOperationConfig(text, operationName) {
    const source = String(text || "");
    const marker = `operationName:"${operationName}"`;
    const index = source.indexOf(marker);
    if (index < 0) {
      return {};
    }
    const segment = source.slice(Math.max(0, index - 1000), index + 4000);
    return {
      queryId: segment.match(/queryId:"([^"]+)"/)?.[1] || "",
      operationName,
      featureSwitches: extractQuotedList(segment, "featureSwitches"),
      fieldToggles: extractQuotedList(segment, "fieldToggles")
    };
  }

  function extractQuotedList(text, key) {
    const list = String(text || "").match(new RegExp(`${key}:\\[([^\\]]*)\\]`))?.[1] || "";
    return [...list.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  }

  async function fetchXTwitterTweetResult(statusId, operation, bearer) {
    const query = new URLSearchParams({
      variables: JSON.stringify({
        tweetId: statusId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false
      }),
      features: JSON.stringify(trueMap(operation.featureSwitches || X_TWITTER_TWEET_RESULT_FALLBACK.featureSwitches)),
      fieldToggles: JSON.stringify(trueMap(operation.fieldToggles || X_TWITTER_TWEET_RESULT_FALLBACK.fieldToggles))
    });
    const url = `/i/api/graphql/${operation.queryId}/${operation.operationName || "TweetResultByRestId"}?${query}`;
    const headers = xTwitterApiHeaders(bearer);
    if (!headers["x-csrf-token"]) {
      const guestToken = await activateXTwitterGuestToken(bearer);
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }
    }
    return originalFetch.call(window, url, {
      credentials: "include",
      headers
    });
  }

  function xTwitterApiHeaders(bearer) {
    const csrf = readCookieValue("ct0");
    return {
      authorization: `Bearer ${bearer}`,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": document.documentElement.lang || "en",
      ...(csrf ? {
        "x-csrf-token": csrf,
        "x-twitter-auth-type": "OAuth2Session"
      } : {})
    };
  }

  async function activateXTwitterGuestToken(bearer) {
    try {
      const response = await originalFetch.call(window, "https://api.x.com/1.1/guest/activate.json", {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`
        }
      });
      if (response.ok === false) {
        return "";
      }
      const payload = originalJsonParse(await response.text());
      return String(payload?.guest_token || "");
    } catch {
      return "";
    }
  }

  function readCookieValue(name) {
    const cookieText = String(document.cookie || "");
    return cookieText
      .split(/;\s*/)
      .find(item => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) || "";
  }

  function trueMap(keys) {
    return Object.fromEntries((Array.isArray(keys) ? keys : []).map(key => [key, true]));
  }

  function collectXTwitterHlsUrls(value, output = new Set(), depth = 0, seen = new WeakSet()) {
    if (!value || depth > MAX_DEPTH) {
      return [...output];
    }
    if (typeof value === "string") {
      if (/^https?:\/\/video\.twimg\.com\/.+\.m3u8(?:$|[?#])/i.test(value)) {
        output.add(value.replace(/\\u0026/gi, "&"));
      }
      return [...output];
    }
    if (typeof value !== "object" || seen.has(value)) {
      return [...output];
    }
    seen.add(value);
    const variants = value?.video_info?.variants || value?.videoInfo?.variants;
    if (Array.isArray(variants)) {
      for (const variant of variants) {
        const url = String(variant?.url || "").replace(/\\u0026/gi, "&");
        const mime = normalizeMime(variant?.content_type || variant?.contentType || "");
        if (/\.m3u8(?:$|[?#])/i.test(url) || mime.includes("mpegurl")) {
          output.add(url);
        }
      }
    }
    if (Array.isArray(value)) {
      value.forEach(item => collectXTwitterHlsUrls(item, output, depth + 1, seen));
    } else {
      Object.values(value).forEach(item => collectXTwitterHlsUrls(item, output, depth + 1, seen));
    }
    return [...output];
  }

  async function probeXTwitterHlsManifests(urls) {
    for (const url of Array.isArray(urls) ? urls.slice(0, 4) : []) {
      try {
        const response = await originalFetch.call(window, url, { credentials: "include" });
        if (response.ok === false) {
          continue;
        }
        inspectText(await response.text(), response.url || url, "x-twitter-hls-master");
      } catch {
        // A single stale HLS URL should not block other candidates.
      }
    }
  }

  async function probeBilibiliPlayurl() {
    const ids = readBilibiliVideoIds();
    if (!ids.bvid || !ids.cid) {
      return;
    }
    const key = `${ids.bvid}:${ids.cid}`;
    const lastProbe = window.__fuguangLastBilibiliPlayurlProbe || {};
    if (lastProbe.key === key && lastProbe.ok) {
      return;
    }
    window.__fuguangLastBilibiliPlayurlProbe = { key, ok: false, at: Date.now() };
    const params = new URLSearchParams({
      bvid: ids.bvid,
      cid: String(ids.cid),
      qn: "80",
      fnval: "4048",
      fnver: "0",
      fourk: "1"
    });
    if (ids.aid) {
      params.set("avid", String(ids.aid));
    }
    try {
      const response = await originalFetch.call(window, `https://api.bilibili.com/x/player/playurl?${params}`, {
        credentials: "include"
      });
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      postBilibiliPlayurlMedia(json?.data || json?.result || {});
      window.__fuguangLastBilibiliPlayurlProbe = { key, ok: true, at: Date.now() };
    } catch {
      // Bilibili fallback is opportunistic; normal network sniffing remains active.
    }
  }

  function readBilibiliVideoIds() {
    if (!/(^|\.)bilibili\.com$/i.test(location.hostname)) {
      return {};
    }
    const initial = window.__INITIAL_STATE__ || {};
    const videoData = initial.videoData || {};
    const pages = Array.isArray(videoData.pages) ? videoData.pages : Array.isArray(initial.pages) ? initial.pages : [];
    const bvid = String(
      videoData.bvid ||
      initial.bvid ||
      location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] ||
      ""
    );
    const aid = parseInteger(videoData.aid || initial.aid || initial.aidInfo?.aid);
    const cid = parseInteger(
      videoData.cid ||
      initial.cid ||
      initial.cidMap?.[bvid]?.cid ||
      pages.find(page => parseInteger(page?.cid))?.cid
    );
    return { bvid, aid, cid };
  }

  function postBilibiliPlayurlMedia(data) {
    const duration = parseDurationValue(data?.dash?.duration || data?.duration || data?.timelength);
    const audioItems = Array.isArray(data?.dash?.audio) ? data.dash.audio : [];
    const videoItems = Array.isArray(data?.dash?.video) ? data.dash.video : [];
    for (const item of audioItems) {
      postBilibiliDashItem(item, "audio", duration);
    }
    for (const item of videoItems) {
      postBilibiliDashItem(item, "media", duration);
    }
  }

  function postBilibiliDashItem(item, kind, duration) {
    const urls = [
      item?.baseUrl,
      item?.base_url,
      ...(Array.isArray(item?.backupUrl) ? item.backupUrl : []),
      ...(Array.isArray(item?.backup_url) ? item.backup_url : [])
    ].filter(Boolean);
    const contentType = normalizeMime(item?.mimeType || item?.mime || (kind === "audio" ? "audio/mp4" : "video/mp4"));
    for (const url of [...new Set(urls)]) {
      postMedia(url, kind, "m4s", "bilibili-playurl", {
        contentType,
        duration,
        videoWidth: parseInteger(item?.width),
        videoHeight: parseInteger(item?.height),
        bandwidth: parseInteger(item?.bandwidth || item?.bitrate),
        qualityLabel: item?.qualityLabel || item?.quality || String(item?.id || "")
      });
    }
  }

  function scanKnownPageState() {
    [
      "__playinfo__",
      "__INITIAL_STATE__",
      "__NEXT_DATA__",
      "__NUXT__",
      "__APOLLO_STATE__",
      "ytInitialData",
      "ytInitialPlayerResponse"
    ].forEach(name => {
      try {
        inspectObject(window[name], `global:${name}`);
      } catch {
        // Ignore page globals that throw during access.
      }
    });
  }

  function scanDocumentMarkup() {
    try {
      const markup = document.documentElement?.innerHTML || "";
      if (!markup || markup.length > MAX_DOCUMENT_MARKUP_SCAN_CHARS) {
        return;
      }
      const signature = `${markup.length}:${markup.slice(0, 512)}:${markup.slice(-512)}`;
      if (signature === lastDocumentMarkupSignature) {
        return;
      }
      lastDocumentMarkupSignature = signature;
      inspectText(markup, location.href, "document-markup");
    } catch {
      // Initial server markup is only a discovery hint; dynamic sniffing remains active.
    }
  }

  function scanPerformanceEntries() {
    try {
      const entries = window.performance?.getEntriesByType?.("resource") || [];
      for (const entry of entries) {
        if (!entry?.name || seenPerformanceUrls.has(entry.name)) {
          continue;
        }
        seenPerformanceUrls.add(entry.name);
        const classified = classifyUrl(entry.name);
        if (!classified) {
          continue;
        }
        postMedia(classified.url, classified.kind, classified.ext, "performance-entry", {
          size: parseInteger(entry.transferSize || entry.encodedBodySize || entry.decodedBodySize)
        });
      }
      if (seenPerformanceUrls.size > 2000) {
        seenPerformanceUrls.clear();
      }
    } catch {
      // Resource timing can be unavailable on some pages/frames.
    }
  }

  function inspectResponse(response) {
    const contentType = response.headers?.get("content-type") || "";
    if (shouldInspectTextResponse(response.url, contentType)) {
      response
        .clone()
        .text()
        .then(text => inspectText(text, response.url, "fetch-body"))
        .catch(() => {});
    }
    if (shouldInspectFmp4Response(response.url, contentType, response.headers?.get("content-length") || "")) {
      response
        .clone()
        .arrayBuffer()
        .then(buffer => inspectBinaryResponse(buffer, response.url, "fetch-body", contentType, response.headers?.get("content-length") || ""))
        .catch(() => {});
    }
  }

  function shouldInspectTextResponse(url, contentType) {
    const normalized = contentType.toLowerCase();
    const classified = classifyUrl(url);
    return (
      classified?.kind === "hls" ||
      classified?.kind === "dash" ||
      normalized.includes("json") ||
      normalized.includes("mpegurl") ||
      normalized.includes("dash+xml") ||
      normalized.includes("text/") ||
      normalized.includes("javascript")
    );
  }

  function shouldInspectFmp4Response(url, contentType, contentLength = "") {
    if (fmp4BinaryInspections >= MAX_FMP4_BINARY_INSPECTIONS) {
      return false;
    }
    const classified = classifyUrl(url);
    const ext = classified?.ext || "";
    const normalizedType = normalizeMime(contentType);
    const looksFmp4 = ["m4s", "mp4", "cmf", "cmfa", "cmfv", "m4a", "m4v"].includes(ext) ||
      normalizedType.includes("mp4") ||
      normalizedType.includes("iso.segment");
    if (!looksFmp4) {
      return false;
    }
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > MAX_FMP4_BINARY_INSPECTION_BYTES) {
      return false;
    }
    fmp4BinaryInspections += 1;
    return true;
  }

  function inspectBinaryResponse(buffer, rawUrl, source, contentType = "", contentLength = "") {
    const classified = classifyUrl(rawUrl);
    if (!classified) {
      return;
    }
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > MAX_FMP4_BINARY_INSPECTION_BYTES) {
      return;
    }
    const init = inspectFmp4InitSegment(buffer);
    if (!init?.role) {
      return;
    }
    const kind = init.role === "audio" ? "audio" : "media";
    postMedia(classified.url, kind, classified.ext || "m4s", source, {
      contentType: init.role === "audio" ? "audio/mp4" : init.role === "video" ? "video/mp4" : normalizeMime(contentType),
      role: init.role,
      segmentType: "init",
      trackHandler: init.handlerType
    });
  }

  function inspectFmp4InitSegment(buffer) {
    const bytes = normalizeUint8Array(buffer);
    if (!bytes || bytes.byteLength < 16) {
      return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const moovBoxes = findChildBoxes(view, 0, view.byteLength, "moov");
    if (!moovBoxes.length) {
      return null;
    }
    const handlerTypes = [];
    for (const moov of moovBoxes) {
      for (const trak of findChildBoxes(view, moov.contentStart, moov.end, "trak")) {
        for (const mdia of findChildBoxes(view, trak.contentStart, trak.end, "mdia")) {
          for (const hdlr of findChildBoxes(view, mdia.contentStart, mdia.end, "hdlr")) {
            const handlerType = readAscii(view, hdlr.contentStart + 8, 4);
            if (handlerType) {
              handlerTypes.push(handlerType);
            }
          }
        }
      }
    }
    const hasAudio = handlerTypes.includes("soun");
    const hasVideo = handlerTypes.includes("vide");
    if (hasAudio && !hasVideo) {
      return { role: "audio", handlerType: "soun" };
    }
    if (hasVideo && !hasAudio) {
      return { role: "video", handlerType: "vide" };
    }
    return null;
  }

  function normalizeUint8Array(buffer) {
    if (buffer instanceof Uint8Array) {
      return buffer;
    }
    if (buffer instanceof ArrayBuffer) {
      return new Uint8Array(buffer);
    }
    if (ArrayBuffer.isView?.(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    if (buffer && typeof buffer.byteLength === "number") {
      return new Uint8Array(buffer);
    }
    return null;
  }

  function findChildBoxes(view, start, end, type) {
    const boxes = [];
    for (let cursor = start; cursor + 8 <= end;) {
      const size = readBoxSize(view, cursor, end);
      const name = readAscii(view, cursor + 4, 4);
      const headerSize = view.getUint32(cursor) === 1 ? 16 : 8;
      if (!size || size < headerSize || cursor + size > end) {
        break;
      }
      const box = {
        type: name,
        start: cursor,
        end: cursor + size,
        contentStart: cursor + headerSize
      };
      if (name === type) {
        boxes.push(box);
      }
      cursor += size;
    }
    return boxes;
  }

  function readBoxSize(view, offset, end) {
    const size = view.getUint32(offset);
    if (size === 0) {
      return end - offset;
    }
    if (size === 1) {
      if (offset + 16 > end || typeof view.getBigUint64 !== "function") {
        return 0;
      }
      const wide = Number(view.getBigUint64(offset + 8));
      return Number.isSafeInteger(wide) ? wide : 0;
    }
    return size;
  }

  function readAscii(view, offset, length) {
    if (offset < 0 || offset + length > view.byteLength) {
      return "";
    }
    let output = "";
    for (let index = 0; index < length; index += 1) {
      output += String.fromCharCode(view.getUint8(offset + index));
    }
    return output;
  }

  function inspectHeaders(headers) {
    if (!headers) {
      return;
    }
    try {
      if (headers instanceof Headers) {
        headers.forEach(value => inspectText(String(value), location.href, "fetch-header"));
      } else if (Array.isArray(headers)) {
        headers.forEach(([, value]) => inspectText(String(value), location.href, "fetch-header"));
      } else if (typeof headers === "object") {
        Object.values(headers).forEach(value => inspectText(String(value), location.href, "fetch-header"));
      }
    } catch {
      return;
    }
  }

  function inspectObject(value, source, depth = 0, seen = new WeakSet()) {
    if (!value || depth > MAX_DEPTH) {
      return;
    }
    if (typeof value === "string") {
      inspectText(value, location.href, source);
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    inspectStructuredMediaObject(value, source);
    inspectXTwitterTweetMedia(value, source);
    if (Array.isArray(value)) {
      value.forEach(item => inspectObject(item, source, depth + 1, seen));
      return;
    }
    Object.values(value).forEach(item => inspectObject(item, source, depth + 1, seen));
  }

  function inspectText(text, baseUrl, source) {
    if (!text) {
      return;
    }
    if (text.slice(0, 7).toUpperCase() === "#EXTM3U") {
      const manifest = parseHlsManifest(text, baseUrl);
      postMedia(baseUrl, "hls", "m3u8", source, manifest);
      for (const variant of manifest.variants) {
        postMedia(variant.url, "hls", "m3u8", source, variant);
      }
      return;
    }
    if (text.includes("urn:mpeg:dash:schema:mpd") || text.includes("<MPD")) {
      postMedia(baseUrl, "dash", "mpd", source, parseDashManifest(text));
      return;
    }
    const urlText = decodeHtmlEntitiesForUrlScan(text);
    for (const match of urlText.matchAll(URL_PATTERN)) {
      inspectUrl(match[0], source);
    }
  }

  function inspectXTwitterTweetMedia(value, source) {
    const statusId = xTwitterStatusIdFromObject(value);
    const mediaItems = xTwitterMediaItemsFromObject(value);
    if (!statusId || !mediaItems.length) {
      return;
    }
    for (const media of mediaItems) {
      const videoInfo = media?.video_info || media?.videoInfo || {};
      const duration = parseXTwitterVideoDuration(videoInfo);
      const dimensions = xTwitterMediaDimensions(media);
      const variants = Array.isArray(videoInfo.variants) ? videoInfo.variants : [];
      for (const variant of variants) {
        const rawUrl = variant?.url;
        if (typeof rawUrl !== "string" || !rawUrl.trim()) {
          continue;
        }
        const mime = normalizeMime(variant.content_type || variant.contentType || variant.mimeType || "");
        const classified = classifyUrl(rawUrl);
        if (!classified && !mime.startsWith("audio/") && !mime.startsWith("video/") && !mime.includes("mpegurl")) {
          continue;
        }
        const kind = mime.includes("mpegurl")
          ? "hls"
          : mime.startsWith("audio/")
            ? "audio"
            : classified?.kind || "media";
        postMedia(rawUrl, kind, classified?.ext || extFromMime(mime), source, {
          contentType: mime,
          duration,
          videoWidth: dimensions.width,
          videoHeight: dimensions.height,
          bandwidth: parseInteger(variant.bitrate),
          statusId,
          role: inferXTwitterVariantRole(rawUrl, mime)
        });
      }
    }
  }

  function inferXTwitterVariantRole(rawUrl, mime = "") {
    let path = "";
    try {
      path = new URL(rawUrl, location.href).pathname.toLowerCase();
    } catch {
      path = String(rawUrl || "").toLowerCase();
    }
    const normalizedMime = normalizeMime(mime);
    if (normalizedMime.startsWith("audio/") || /\/(?:audio|mp4a)(?:\/|$)/i.test(path)) {
      return "audio";
    }
    if (normalizedMime.startsWith("video/") || /\/(?:vid|pl)\/(?:avc1|h264|h265|hevc|vp9|av01)(?:\/|$)/i.test(path)) {
      return "video";
    }
    return undefined;
  }

  function xTwitterStatusIdFromObject(value) {
    return firstDigits(
      value?.rest_id,
      value?.id_str,
      value?.id,
      value?.legacy?.id_str,
      value?.legacy?.id
    );
  }

  function xTwitterMediaItemsFromObject(value) {
    const groups = [
      value?.legacy?.extended_entities?.media,
      value?.legacy?.entities?.media,
      value?.extended_entities?.media,
      value?.entities?.media
    ];
    return groups.find(group => Array.isArray(group) && group.length) || [];
  }

  function parseXTwitterVideoDuration(videoInfo) {
    const milliseconds = Number(videoInfo?.duration_millis || videoInfo?.durationMillis || 0);
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return milliseconds / 1000;
    }
    return parseStructuredMediaDuration(videoInfo || {});
  }

  function xTwitterMediaDimensions(media) {
    const sizes = media?.sizes || {};
    const candidates = [
      sizes.large,
      sizes.medium,
      sizes.small,
      sizes.thumb,
      media
    ];
    for (const item of candidates) {
      const width = parseInteger(item?.w || item?.width);
      const height = parseInteger(item?.h || item?.height);
      if (width && height) {
        return { width, height };
      }
    }
    return { width: undefined, height: undefined };
  }

  function firstDigits(...values) {
    for (const value of values) {
      const text = String(value || "").trim();
      if (/^\d+$/.test(text)) {
        return text;
      }
    }
    return "";
  }

  function decodeHtmlEntitiesForUrlScan(text) {
    const value = String(text || "");
    if (!/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/i.test(value)) {
      return value;
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = value;
      return textarea.value || value;
    } catch {
      return value
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#x3D;|&#61;/gi, "=")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
    }
  }

  function inspectUrl(rawUrl, source) {
    const classified = classifyUrl(rawUrl);
    if (!classified) {
      return;
    }
    postMedia(classified.url, classified.kind, classified.ext, source);
  }

  function classifyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return null;
    }
    let url = rawUrl.trim().replace(/[),.;]+$/, "");
    if (url.startsWith("//")) {
      url = `${location.protocol}${url}`;
    }
    try {
      url = new URL(url, location.href).href;
    } catch {
      return null;
    }
    if (isIgnoredMediaUrl(url)) {
      return null;
    }
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const ext = pathname.split(".").pop() || "";
    const mime = normalizeMime(parsed.searchParams.get("mime") || parsed.searchParams.get("mimeType") || "");
    if (mime.startsWith("audio/")) {
      return { url, kind: "audio", ext: extFromMime(mime, ext) };
    }
    if (mime.startsWith("video/")) {
      return { url, kind: "media", ext: extFromMime(mime, ext) };
    }
    if (mime.includes("mpegurl")) {
      return { url, kind: "hls", ext: "m3u8" };
    }
    if (mime.includes("dash+xml")) {
      return { url, kind: "dash", ext: "mpd" };
    }
    if (isYoutubePlaybackUrl(parsed)) {
      return { url, kind: "media", ext: ext || "" };
    }
    if (!MEDIA_EXTENSIONS.has(ext)) {
      return null;
    }
    if (ext === "m3u8" || ext === "m3u") {
      return { url, kind: "hls", ext };
    }
    if (ext === "mpd") {
      return { url, kind: "dash", ext };
    }
    if (["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"].includes(ext)) {
      return { url, kind: "audio", ext };
    }
    return { url, kind: "media", ext };
  }

  function isIgnoredMediaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      const pathname = url.pathname.toLowerCase();
      if (url.hostname === "cdn.plyr.io" && pathname === "/static/blank.mp4") {
        return true;
      }
      if (isYoutubePlaceholderAudio(url)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function inspectStructuredMediaObject(value, source) {
    if (!value || typeof value !== "object") {
      return;
    }
    const urls = extractStructuredMediaUrls(value);
    if (!urls.length) {
      return;
    }
    const mime = normalizeMime(value.mimeType || value.mime || value.contentType || "");
    for (const rawUrl of urls) {
      const classified = classifyUrl(rawUrl);
      if (!classified && !mime.startsWith("audio/") && !mime.startsWith("video/")) {
        continue;
      }
      const kind = mime.startsWith("audio/") ? "audio" : classified?.kind || "media";
      postMedia(rawUrl, kind, classified?.ext || extFromMime(mime), source, {
        contentType: mime,
        size: parseInteger(value.contentLength || value.size || value.clen),
        duration: parseStructuredMediaDuration(value),
        videoWidth: parseInteger(value.width),
        videoHeight: parseInteger(value.height),
        bandwidth: parseInteger(value.bitrate || value.averageBitrate || value.bandwidth),
        qualityLabel: value.qualityLabel || value.quality || value.audioQuality || "",
        source: "structured-media"
      });
    }
  }

  function extractStructuredMediaUrls(value) {
    const urls = [];
    addUrl(value.url);
    addUrl(value.baseUrl);
    addUrl(value.base_url);
    addUrl(parseCipherUrl(value.signatureCipher));
    addUrl(parseCipherUrl(value.cipher));
    addUrls(value.backupUrl);
    addUrls(value.backup_url);
    addUrls(value.backupUrls);
    return [...new Set(urls)];

    function addUrls(items) {
      if (Array.isArray(items)) {
        items.forEach(addUrl);
      } else {
        addUrl(items);
      }
    }

    function addUrl(url) {
      if (typeof url === "string" && url.trim()) {
        urls.push(url);
      }
    }
  }

  function parseCipherUrl(cipher) {
    try {
      return new URLSearchParams(cipher).get("url") || "";
    } catch {
      return "";
    }
  }

  function normalizeMime(value) {
    return String(value || "").split(";", 1)[0].trim().toLowerCase();
  }

  function parseInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
  }

  function parseStructuredMediaDuration(value) {
    const milliseconds = Number(value.approxDurationMs || value.durationMs || value.lengthMs);
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return milliseconds / 1000;
    }
    return parseDurationValue(value.duration || value.lengthSeconds || value.durationSeconds);
  }

  function isYoutubePlaceholderAudio(url) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return hostname.endsWith("youtube.com") && pathname === "/s/search/audio/no_input.mp3";
  }

  function isYoutubePlaybackUrl(url) {
    return /(^|\.)googlevideo\.com$/i.test(url.hostname) && /\/videoplayback$/i.test(url.pathname);
  }

  function extFromMime(mime, fallback = "") {
    if (mime.includes("mp4")) {
      return "mp4";
    }
    if (mime.includes("webm")) {
      return "webm";
    }
    if (mime.includes("mp3") || mime.includes("mpeg")) {
      return "mp3";
    }
    if (mime.includes("ogg")) {
      return "ogg";
    }
    return fallback || "";
  }

  function parseHlsManifest(text, baseUrl) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const manifest = {
      duration: 0,
      playlistType: "media",
      variants: []
    };
    let pendingVariant = null;
    for (const line of lines) {
      if (line.startsWith("#EXT-X-MEDIA:")) {
        const attrs = parseHlsAttributes(line.slice("#EXT-X-MEDIA:".length));
        if (String(attrs.type || "").toUpperCase() === "AUDIO" && attrs.uri) {
          const url = absoluteUrl(attrs.uri, baseUrl);
          if (url) {
            manifest.playlistType = "master";
            manifest.variants.push({
              ...attrs,
              url,
              playlistType: "audio",
              role: "audio"
            });
          }
        }
        continue;
      }
      if (line.startsWith("#EXTINF:")) {
        const seconds = Number.parseFloat(line.slice(8).split(",", 1)[0]);
        if (Number.isFinite(seconds)) {
          manifest.duration += seconds;
        }
        continue;
      }
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        manifest.playlistType = "master";
        pendingVariant = parseHlsAttributes(line.slice(18));
        continue;
      }
      if (pendingVariant && !line.startsWith("#")) {
        const url = absoluteUrl(line, baseUrl);
        if (url) {
          manifest.variants.push({
            ...pendingVariant,
            url,
            playlistType: "variant"
          });
        }
        pendingVariant = null;
      }
    }
    if (!manifest.duration) {
      delete manifest.duration;
    }
    return manifest;
  }

  function parseHlsAttributes(value) {
    const attrs = {};
    const pattern = /([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/gi;
    let match;
    while ((match = pattern.exec(value))) {
      attrs[match[1].toUpperCase()] = String(match[2] || "").replace(/^"|"$/g, "");
    }
    const output = {};
    const resolution = String(attrs.RESOLUTION || "").match(/(\d+)x(\d+)/i);
    if (resolution) {
      output.videoWidth = Number(resolution[1]);
      output.videoHeight = Number(resolution[2]);
      output.qualityLabel = `${output.videoHeight}p`;
    }
    const bandwidth = Number(attrs.BANDWIDTH || attrs["AVERAGE-BANDWIDTH"] || 0) || 0;
    if (bandwidth) {
      output.bandwidth = bandwidth;
    }
    if (attrs.CODECS) {
      output.codecs = attrs.CODECS;
    }
    if (attrs.AUDIO) {
      output.audioGroupId = attrs.AUDIO;
    }
    if (attrs.URI) {
      output.uri = attrs.URI;
    }
    if (attrs.TYPE) {
      output.type = attrs.TYPE;
    }
    if (attrs["GROUP-ID"]) {
      output.groupId = attrs["GROUP-ID"];
    }
    return output;
  }

  function parseDashManifest(text) {
    const durationMatch = text.match(/\bmediaPresentationDuration=(["'])(.*?)\1/i);
    return {
      duration: durationMatch ? parseIsoDuration(durationMatch[2]) : undefined
    };
  }

  function reportPageContext() {
    const context = extractPageContext();
    const signature = JSON.stringify(context);
    if (signature === lastContextSignature) {
      return;
    }
    lastContextSignature = signature;
    window.postMessage(
      {
        type: CONTEXT_TYPE,
        context
      },
      "*"
    );
  }

  function extractPageContext() {
    const media = findPrimaryMedia();
    const dimensions = media
      ? {
          videoWidth: media.videoWidth || null,
          videoHeight: media.videoHeight || null,
          elementWidth: media.clientWidth || null,
          elementHeight: media.clientHeight || null,
          mediaTag: media.tagName.toLowerCase(),
          poster: media.poster || "",
          currentSrc: media.currentSrc || media.src || "",
          readyState: media.readyState || 0
        }
      : {};
    return {
      href: location.href,
      title: document.title,
      description: readMetaDescription(),
      language: readPageLanguage(),
      hasMedia: Boolean(media),
      duration: firstFiniteDuration(
        media?.duration,
        readStructuredDuration(),
        readKnownPlayerDuration(window.__INITIAL_STATE__),
        readKnownPlayerDuration(window.__playinfo__),
        readKnownPlayerDuration(window.ytInitialPlayerResponse)
      ),
      currentTime: Number.isFinite(media?.currentTime) ? media.currentTime : null,
      ...dimensions
    };
  }

  function readMetaDescription() {
    return (
      document.querySelector('meta[property="og:description"]')?.content ||
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[name="twitter:description"]')?.content ||
      ""
    ).trim();
  }

  function readPageLanguage() {
    return (
      document.documentElement.lang ||
      document.querySelector('meta[http-equiv="content-language"]')?.content ||
      document.querySelector('meta[property="og:locale"]')?.content ||
      ""
    ).trim();
  }

  function findPrimaryMedia() {
    const media = [...document.querySelectorAll("video, audio")];
    if (!media.length) {
      return null;
    }
    return media
      .map(element => ({
        element,
        area: (element.clientWidth || 0) * (element.clientHeight || 0)
      }))
      .sort((a, b) => b.area - a.area)[0].element;
  }

  function readStructuredDuration() {
    const metaDuration =
      document.querySelector('meta[property="video:duration"]')?.content ||
      document.querySelector('meta[itemprop="duration"]')?.content ||
      document.querySelector("time[datetime]")?.getAttribute("datetime") ||
      "";
    const parsedMeta = parseDurationValue(metaDuration);
    if (parsedMeta) {
      return parsedMeta;
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = originalJsonParse(script.textContent || "{}");
        const duration = findStructuredDuration(json);
        if (duration) {
          return duration;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function findStructuredDuration(value, depth = 0) {
    if (!value || depth > 5) {
      return null;
    }
    if (typeof value === "string") {
      return parseDurationValue(value);
    }
    if (typeof value !== "object") {
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const duration = findStructuredDuration(item, depth + 1);
        if (duration) {
          return duration;
        }
      }
      return null;
    }
    const explicit = parseDurationValue(value.duration || value.lengthSeconds || value.durationSeconds);
    if (explicit) {
      return explicit;
    }
    for (const item of Object.values(value)) {
      const duration = findStructuredDuration(item, depth + 1);
      if (duration) {
        return duration;
      }
    }
    return null;
  }

  function readKnownPlayerDuration(value) {
    const candidates = [
      value?.videoData?.duration,
      value?.epInfo?.duration,
      value?.videoDetails?.lengthSeconds,
      value?.data?.dash?.duration,
      value?.dash?.duration
    ];
    for (const candidate of candidates) {
      const duration = parseDurationValue(candidate);
      if (duration) {
        return duration;
      }
    }
    return findDurationByKey(value);
  }

  function findDurationByKey(value, depth = 0, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) {
      return null;
    }
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (["duration", "durationsec", "durationseconds", "lengthseconds"].includes(normalizedKey)) {
        const duration = parseDurationValue(item);
        if (duration) {
          return duration;
        }
      }
      const nested = findDurationByKey(item, depth + 1, seen);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  function firstFiniteDuration(...values) {
    for (const value of values) {
      const duration = parseDurationValue(value);
      if (duration) {
        return duration;
      }
    }
    return null;
  }

  function parseDurationValue(value) {
    if (typeof value === "string" && value.trim().startsWith("P")) {
      return parseIsoDuration(value.trim());
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }
    return number > 100000 ? number / 1000 : number;
  }

  function parseIsoDuration(value) {
    const match = String(value).match(
      /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
    );
    if (!match) {
      return null;
    }
    const [, years, months, weeks, days, hours, minutes, seconds] = match.map(part => Number(part || 0));
    return (
      years * 31536000 +
      months * 2592000 +
      weeks * 604800 +
      days * 86400 +
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  function absoluteUrl(rawUrl, baseUrl) {
    try {
      return new URL(rawUrl, baseUrl || location.href).href;
    } catch {
      return "";
    }
  }

  function postMedia(url, kind, ext, source, extra = {}) {
    if (!url) {
      return;
    }
    window.postMessage(
      {
        type: MESSAGE_TYPE,
        media: {
          url,
          kind,
          ext,
          source,
          href: location.href,
          title: document.title,
          duration: extra.duration,
          contentType: extra.contentType,
          codecs: extra.codecs,
          size: extra.size,
          videoWidth: extra.videoWidth,
          videoHeight: extra.videoHeight,
          bandwidth: extra.bandwidth,
          qualityLabel: extra.qualityLabel,
          playlistType: extra.playlistType,
          statusId: extra.statusId,
          role: extra.role,
          segmentType: extra.segmentType,
          trackHandler: extra.trackHandler
        }
      },
      "*"
    );
  }
})();
