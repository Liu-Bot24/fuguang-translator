import { FuguangMediaAssetModel } from "./media-asset-model.js";
import { FuguangMediaSourceResolvers } from "./media-source-resolvers.js";

export const FuguangBrowserMediaCandidates = (() => {
  const INTERNAL_REQUEST_HEADER_NAMES = new Set(["authorization"]);
  const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"]);
  const MANIFEST_EXTENSIONS = new Set(["m3u8", "m3u", "mpd"]);
  const MEDIA_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, ...MANIFEST_EXTENSIONS, "mp4", "m4s", "ts", "webm"]);
  const MEDIA_CONTENT_TYPES = [
    "audio/",
    "video/",
    "application/dash+xml",
    "application/m4s",
    "application/octet-stream",
    "application/vnd.apple.mpegurl",
    "application/x-mpegurl",
    "application/mpegurl",
    "video/mp2t"
  ];
  const ASR_AUDIO_IDEAL_MIN_BPS = 96_000;
  const ASR_AUDIO_IDEAL_MAX_BPS = 160_000;
  const ASR_AUDIO_ACCEPTABLE_LOW_BPS = 48_000;
  const ASR_AUDIO_ACCEPTABLE_HIGH_BPS = 320_000;
  const ASR_AUDIO_PLAUSIBLE_HIGH_BPS = 768_000;
  
  
  function candidateFingerprint(candidate) {
    const urlKey = canonicalStreamUrl(candidate.url);
    const urlInfo = parseUrlInfo(candidate.url);
    const bilibiliIdentity = getBilibiliMediaIdentity(urlInfo);
    if (bilibiliIdentity) {
      return `bilibili:${bilibiliIdentity}:${getBilibiliTrackIdentity(urlInfo, candidate)}`;
    }
    if (candidate.url && isManifestCandidate(candidate)) {
      const manifestKey = exactStreamUrl(candidate.url);
      return `${candidate.kind}:${manifestKey || candidate.url || ""}`;
    }
    if (candidate.url && isAsrSameContentCandidate(candidate)) {
      const trackIdentity = getGenericSegmentedTrackIdentity(urlInfo, candidate);
      return `media:${urlKey}${trackIdentity ? `:${trackIdentity}` : ""}`;
    }
    return `${candidate.kind}:${urlKey || candidate.url || ""}`;
  }
  
  function mergeCandidate(existing, incoming) {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
      if (key === "requestHeaders" || key === "responseHeaders") {
        continue;
      }
      if (shouldUseIncomingCandidateField(key, value, merged[key])) {
        merged[key] = value;
      }
    }
    return {
      ...merged,
      requestHeaders: {
        ...sanitizeInternalRequestHeaders(existing.requestHeaders),
        ...sanitizeInternalRequestHeaders(incoming.requestHeaders)
      },
      responseHeaders: {
        ...(existing.responseHeaders || {}),
        ...(incoming.responseHeaders || {})
      },
      firstSeenAt: existing.firstSeenAt || existing.seenAt,
      seenAt: incoming.seenAt || Date.now()
    };
  }

  function pruneCandidatesForRetention(candidates = [], maxCount = 80) {
    if (!Array.isArray(candidates) || candidates.length <= maxCount) {
      return Array.isArray(candidates) ? candidates : [];
    }
    return candidates
      .map((candidate, index) => ({
        candidate,
        index,
        score: candidateRetentionScore(candidate)
      }))
      .sort((a, b) =>
        b.score - a.score ||
        (b.candidate.seenAt || 0) - (a.candidate.seenAt || 0) ||
        a.index - b.index
      )
      .slice(0, maxCount)
      .sort((a, b) => a.index - b.index)
      .map(item => item.candidate);
  }

  function candidateRetentionScore(candidate = {}) {
    let score = 0;
    const contentType = String(candidate.contentType || candidate.responseHeaders?.type || "").toLowerCase();
    const ext = String(candidate.ext || "").toLowerCase();
    if (candidate.role === "audio" || candidate.kind === "audio" || contentType.startsWith("audio/")) {
      score += 90;
    }
    if (candidate.kind === "hls" || candidate.kind === "dash" || MANIFEST_EXTENSIONS.has(ext)) {
      score += 80;
    }
    if (candidate.playlistType === "audio" || candidate.playlistType === "master") {
      score += 20;
    }
    if (candidate.source === "json-parse" || candidate.source === "fetch-body" || candidate.source === "xhr-body") {
      score += 16;
    } else if (candidate.source === "response" || candidate.source === "media-element") {
      score += 10;
    }
    if (candidate.segmentType === "init") {
      score += 24;
    }
    if (candidate.role === "video" || contentType.startsWith("video/")) {
      score -= 8;
    }
    if (candidate.kind === "segment" || ["m4s", "ts", "cmfa", "cmfv"].includes(ext)) {
      score -= candidate.segmentType === "init" ? 4 : 32;
    }
    return score;
  }
  
  function shouldUseIncomingCandidateField(key, value, existingValue) {
    if (key === "seenAt") {
      return true;
    }
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === "string" && !value.trim()) {
      return false;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return false;
    }
    if (["duration", "size", "videoWidth", "videoHeight", "bandwidth"].includes(key)) {
      return Number(value) > 0;
    }
    if (key === "source") {
      return candidateSourceRank(value) >= candidateSourceRank(existingValue);
    }
    return true;
  }
  
  function candidateSourceRank(source) {
    return {
      "bilibili-playurl": 9,
      "media-element": 8,
      "json-parse": 7,
      "xhr-body": 6,
      response: 5,
      request: 4,
      "request-headers": 3,
      "performance-entry": 2,
      page: 1
    }[source] || 0;
  }
  
  function getGroupedCandidatesForState(state) {
    return filterDisplayableCandidateGroups(groupCandidatesForAsr(
      (state.candidates || [])
        .filter(candidate => !isIgnoredMediaUrl(candidate.url))
        .map(candidate => enrichCandidate(candidate, state))
    ), state);
  }

  function filterDisplayableCandidateGroups(groups, state = null) {
    return (Array.isArray(groups) ? groups : []).filter(candidate => isDisplayableCandidateGroup(candidate, state));
  }

  function isDisplayableCandidateGroup(candidate = {}, state = null) {
    if (isUnrelatedXTwitterMediaCandidate(candidate, state)) {
      return false;
    }
    if (!candidate.sourcePlan) {
      return !isKnownSeparatedXTwitterVideoOnlyCandidate(candidate);
    }
    return candidate.sourcePlan.executable !== false &&
      !sourcePlanHasBlockingWarning(candidate.sourcePlan);
  }

  function isUnrelatedXTwitterMediaCandidate(candidate = {}, state = null) {
    const targetMediaId = getXTwitterCurrentMediaIdentity(state);
    if (!targetMediaId) {
      return false;
    }
    const ids = xTwitterMediaIdentitiesForCandidate(candidate);
    return ids.length > 0 && !ids.includes(targetMediaId);
  }

  function getXTwitterCurrentMediaIdentity(state = null) {
    const candidates = [
      state?.context?.poster,
      state?.context?.currentSrc,
      state?.context?.sourceUrl
    ];
    for (const value of candidates) {
      const id = getXTwitterAnyMediaIdentity(parseUrlInfo(value || ""));
      if (id) {
        return id;
      }
    }
    return "";
  }

  function xTwitterMediaIdentitiesForCandidate(candidate = {}) {
    const ids = new Set();
    for (const item of [candidate, ...(Array.isArray(candidate.variants) ? candidate.variants : [])]) {
      const id = getXTwitterAnyMediaIdentity(parseUrlInfo(item?.url || ""));
      if (id) {
        ids.add(id);
      }
    }
    return [...ids];
  }

  function sourcePlanHasBlockingWarning(plan = {}) {
    return (Array.isArray(plan.warnings) ? plan.warnings : [])
      .some(warning => ["requires-signature-deciphering"].includes(String(warning?.code || "")));
  }

  function isKnownSeparatedXTwitterVideoOnlyCandidate(candidate = {}) {
    return isXTwitterSeparatedVideoUrl(candidate.url) ||
      (Array.isArray(candidate.variants) && candidate.variants.length > 0 &&
        candidate.variants.every(variant => isXTwitterSeparatedVideoUrl(variant.url)));
  }

  function isXTwitterSeparatedVideoUrl(rawUrl = "") {
    try {
      const url = new URL(rawUrl);
      if (!/(^|\.)video\.twimg\.com$/i.test(url.hostname)) {
        return false;
      }
      return /\/amplify_video\/\d+\/(?:vid|pl)\/(?:avc1|h264|h265|hevc|vp9|av01)(?:\/|$)/i.test(url.pathname);
    } catch {
      return false;
    }
  }
  
  function resolvePreloadCandidateForStart(state, candidate) {
    const internalCandidate = getGroupedCandidatesForState(state)
      .find(item => candidatesReferToSamePreloadTarget(item, candidate));
    if (!internalCandidate) {
      return removeUntrustedStartFields(stripCandidateRequestHeaders(candidate || {}));
    }
    const safeInternalCandidate = stripCandidateRequestHeaders(internalCandidate);
    return {
      ...safeInternalCandidate,
      ...localMediaFileStartFields(candidate),
      requestHeaders: internalCandidate.requestHeaders || null,
      responseHeaders: internalCandidate.responseHeaders || {},
      sourcePlanTrusted: Boolean(internalCandidate.sourcePlan)
    };
  }

  function localMediaFileStartFields(candidate = {}) {
    const key = String(candidate?.localMediaFileKey || "").trim();
    if (!key || !isFileUrl(key) || !isFileUrl(candidate?.url || "")) {
      return {};
    }
    const size = Number(candidate.localMediaFileSize || 0) || 0;
    const lastModified = Number(candidate.localMediaFileLastModified || 0) || 0;
    return {
      localMediaFileKey: key,
      localMediaFileName: String(candidate.localMediaFileName || ""),
      localMediaFileSize: Number.isFinite(size) && size > 0 ? size : 0,
      localMediaFileLastModified: Number.isFinite(lastModified) && lastModified > 0 ? lastModified : 0
    };
  }

  function isFileUrl(rawUrl = "") {
    try {
      return new URL(String(rawUrl || "")).protocol === "file:";
    } catch {
      return false;
    }
  }
  
  function candidatesReferToSamePreloadTarget(left, right) {
    if (!left?.url || !right?.url) {
      return false;
    }
    if (left.url === right.url) {
      return true;
    }
    const leftCanonical = canonicalStreamUrl(left.url);
    const rightCanonical = canonicalStreamUrl(right.url);
    if (leftCanonical && rightCanonical && leftCanonical === rightCanonical) {
      return true;
    }
    return candidateFingerprint(left) === candidateFingerprint(right);
  }
  
  function stripCandidateRequestHeaders(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }
    const { requestHeaders, variants, mediaAsset, ...safeCandidate } = candidate;
    return {
      ...safeCandidate,
      mediaAsset: sanitizeMediaAssetForDisplay(mediaAsset),
      variants: Array.isArray(variants) ? variants.map(stripCandidateRequestHeaders) : variants
    };
  }

  function sanitizeMediaAssetForDisplay(mediaAsset) {
    if (!mediaAsset || typeof mediaAsset !== "object") {
      return mediaAsset;
    }
    const { requestContext, ...safeMediaAsset } = mediaAsset;
    return safeMediaAsset;
  }

  function removeUntrustedStartFields(candidate = {}) {
    const { sourcePlan, sourcePlanTrusted, sourcePlanUsed, ...safeCandidate } = candidate || {};
    return safeCandidate;
  }
  
  function enrichCandidate(candidate, state) {
    const urlInfo = parseUrlInfo(candidate.url);
    const responseHeaders = candidate.responseHeaders || {};
    const contentType = normalizeContentType(candidate.contentType || responseHeaders.type || "");
    const size = Number(responseHeaders.size || candidate.size || 0) || 0;
    const inheritDuration = shouldInheritPageDuration(candidate, contentType, urlInfo, state);
    const inheritDimensions = shouldInheritPageDimensions(candidate, contentType, urlInfo);
    const pageTitle = pickCandidateDisplayTitle(candidate, state);
    const pageUrl = pickCandidatePageUrl(candidate, state);
    const duration = pickFinite(candidate.duration, inheritDuration ? state.context?.duration : null);
    const videoWidth = Number(candidate.videoWidth || (inheritDimensions ? state.context?.videoWidth : 0) || 0) || null;
    const videoHeight = Number(candidate.videoHeight || (inheritDimensions ? state.context?.videoHeight : 0) || 0) || null;
    const resolution = videoWidth && videoHeight ? `${videoWidth}x${videoHeight}` : "";
    const role = inferMediaRole(candidate, contentType, urlInfo, videoWidth, videoHeight);
    const quality = inferQuality(candidate.url, videoWidth, videoHeight);
    if (candidate.bandwidth) {
      quality.bandwidth = Number(candidate.bandwidth);
    }
    if (candidate.qualityLabel) {
      quality.label = candidate.qualityLabel;
    }
    const mediaAsset = legacyCandidateToMediaAsset({
      ...candidate,
      pageUrl,
      title: pageTitle,
      filename: candidate.filename || urlInfo.filename,
      origin: urlInfo.origin,
      contentType,
      size,
      duration,
      videoWidth,
      videoHeight,
      resolution,
      role,
      quality
    }, state);
    return {
      ...candidate,
      pageUrl,
      title: pageTitle,
      filename: candidate.filename || urlInfo.filename,
      origin: urlInfo.origin,
      contentType,
      size,
      duration,
      videoWidth,
      videoHeight,
      resolution,
      role,
      quality,
      assetKind: mediaAsset.kind,
      trackRole: mediaAsset.role,
      durationEvidence: mediaAsset.durationEvidence,
      mediaAsset,
      pageRelevanceScore: scoreCandidatePageRelevance(candidate, duration, state),
      asrScore: scoreCandidateForAsr(candidate, role, quality, size, duration, contentType, urlInfo, state)
    };
  }

  function legacyCandidateToMediaAsset(candidate, state = null) {
    const kind = inferMediaAssetKind(candidate);
    const role = inferMediaAssetRole(candidate);
    const durationEvidence = inferDurationEvidence(candidate, state, kind);
    const codecs = candidate.codecs || candidate.quality?.codecs || "";
    return FuguangMediaAssetModel.createMediaAsset({
      url: candidate.url,
      finalUrl: candidate.finalUrl || candidate.url,
      pageUrl: candidate.pageUrl,
      title: candidate.title,
      kind,
      role,
      container: inferMediaAssetContainer(candidate, kind),
      codecs,
      bitrate: candidate.audioBitrate || candidate.bitrate || candidate.averageBitrate || candidate.bandwidth || candidate.quality?.bandwidth,
      duration: candidate.duration,
      durationEvidence,
      dimensions: {
        width: candidate.videoWidth,
        height: candidate.videoHeight
      },
      segmentType: candidate.segmentType || "",
      requestContext: candidate.requestHeaders ? { headerNames: Object.keys(sanitizeInternalRequestHeaders(candidate.requestHeaders)).sort() } : null,
      relation: inferMediaAssetRelation(candidate),
      siteAdapter: inferCandidateSiteAdapter(candidate),
      evidence: inferMediaAssetEvidence(candidate, durationEvidence),
      warnings: inferMediaAssetWarnings(candidate)
    });
  }

  function inferMediaAssetKind(candidate = {}) {
    if (candidate.kind === "hls") {
      return candidate.playlistType === "master"
        ? FuguangMediaAssetModel.ASSET_KIND.HLS_MASTER
        : FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA;
    }
    if (candidate.kind === "dash" || candidate.ext === "mpd") {
      return FuguangMediaAssetModel.ASSET_KIND.DASH_MPD;
    }
    if (candidate.ext === "m4s" || candidate.ext === "ts" || /\.(?:m4s|ts|cmfa|cmfv|cmf)$/i.test(candidate.url || "")) {
      return FuguangMediaAssetModel.ASSET_KIND.SEGMENT;
    }
    return FuguangMediaAssetModel.ASSET_KIND.DIRECT;
  }

  function inferMediaAssetRole(candidate = {}) {
    if (candidate.role === "audio") {
      return FuguangMediaAssetModel.MEDIA_ROLE.AUDIO;
    }
    if (candidate.role === "video") {
      return FuguangMediaAssetModel.MEDIA_ROLE.VIDEO;
    }
    if (candidate.role === "playlist") {
      return FuguangMediaAssetModel.MEDIA_ROLE.PLAYLIST;
    }
    if (candidate.role === "media" || candidate.kind === "media") {
      return FuguangMediaAssetModel.MEDIA_ROLE.MUXED;
    }
    return FuguangMediaAssetModel.MEDIA_ROLE.UNKNOWN;
  }

  function inferDurationEvidence(candidate = {}, state = null, kind = "") {
    const duration = positiveNumber(candidate.duration);
    if (!duration) {
      return null;
    }
    if (candidate.durationEvidence) {
      return FuguangMediaAssetModel.createDurationEvidence(candidate.durationEvidence.source || candidate.durationEvidence, duration, candidate.durationEvidence);
    }
    if (candidate.source === "media-element") {
      return FuguangMediaAssetModel.createDurationEvidence(FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.MEDIA_ELEMENT, duration);
    }
    if (candidate.source === "bilibili-playurl" || candidate.source === "json-parse" || candidate.source === "xhr-body" || candidate.source === "structured-media") {
      return FuguangMediaAssetModel.createDurationEvidence(FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.PLAYER_JSON, duration, { detail: candidate.source });
    }
    if (kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MASTER || kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA || kind === FuguangMediaAssetModel.ASSET_KIND.DASH_MPD) {
      return FuguangMediaAssetModel.createDurationEvidence(FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.MANIFEST, duration);
    }
    if (positiveNumber(state?.context?.duration) === duration) {
      return FuguangMediaAssetModel.createDurationEvidence(FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.PAGE_META, duration);
    }
    return FuguangMediaAssetModel.createDurationEvidence(FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.INFERRED, duration);
  }

  function inferMediaAssetContainer(candidate = {}, kind = "") {
    if (kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MASTER || kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA) {
      return "hls";
    }
    if (kind === FuguangMediaAssetModel.ASSET_KIND.DASH_MPD) {
      return "dash";
    }
    return candidate.ext || parseUrlInfo(candidate.url || "").filename.split(".").pop()?.toLowerCase() || "";
  }

  function inferMediaAssetRelation(candidate = {}) {
    if (candidate.role === "audio") {
      return { track: "audio" };
    }
    if (candidate.role === "video") {
      return { track: "video" };
    }
    if (candidate.role === "playlist") {
      return { track: "playlist" };
    }
    return null;
  }

  function inferCandidateSiteAdapter(candidate = {}) {
    const info = parseUrlInfo(candidate.url || "");
    if (isLikelyBilibiliMedia(info) || candidate.source === "bilibili-playurl") {
      return "bilibili";
    }
    if (/(^|\.)video\.twimg\.com$/i.test(info.hostname) || /(^|\.)x\.com$/i.test(info.hostname) || /(^|\.)twitter\.com$/i.test(info.hostname)) {
      return "x-twitter";
    }
    if (/(^|\.)googlevideo\.com$/i.test(info.hostname) || /(^|\.)youtube\.com$/i.test(info.hostname)) {
      return "youtube";
    }
    return "";
  }

  function inferMediaAssetEvidence(candidate = {}, durationEvidence = null) {
    const evidence = [];
    if (candidate.source) {
      evidence.push({
        source: candidate.source,
        strength: candidateSourceRank(candidate.source) * 10,
        detail: candidate.contentType || candidate.ext || ""
      });
    }
    if (durationEvidence) {
      evidence.push({
        source: durationEvidence.source,
        strength: durationEvidence.strength,
        detail: `${Math.round(durationEvidence.seconds * 1000) / 1000}s`
      });
    }
    return evidence;
  }

  function inferMediaAssetWarnings(candidate = {}) {
    const warnings = [];
    if (candidate.requiresSignatureDeciphering) {
      warnings.push({
        code: "requires-signature-deciphering",
        message: "YouTube candidate requires player signature deciphering before extraction."
      });
    }
    return warnings;
  }
  
  function pickCandidateDisplayTitle(candidate, state) {
    return firstUsefulTitle(
      state.page?.title,
      state.context?.title,
      candidate.title
    );
  }
  
  function pickCandidatePageUrl(candidate, state) {
    return (
      state.page?.url ||
      state.context?.href ||
      candidate.pageUrl ||
      candidate.initiator ||
      ""
    );
  }
  
  function firstUsefulTitle(...titles) {
    for (const title of titles) {
      const cleaned = normalizeTitle(title);
      if (cleaned && !isNonVideoFrameTitle(cleaned)) {
        return cleaned;
      }
    }
    return "";
  }
  
  function normalizeTitle(title = "") {
    return String(title || "").trim().replace(/\s+/g, " ");
  }
  
  function isNonVideoFrameTitle(title) {
    return /^(cross origin local storage|about:blank|iframe)$/i.test(title);
  }
  
  function groupCandidatesForAsr(candidates) {
    const groups = new Map();
    for (const candidate of candidates) {
      const key = getSimilarityKey(candidate);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(candidate);
    }
    return [...groups.values()]
      .map(buildCandidateGroup)
      .sort((a, b) =>
        a.pageRelevanceScore - b.pageRelevanceScore ||
        a.asrScore - b.asrScore ||
        (b.seenAt || 0) - (a.seenAt || 0)
      );
  }
  
  function buildCandidateGroup(group) {
    const variants = [...group].sort((a, b) =>
      a.pageRelevanceScore - b.pageRelevanceScore ||
      a.asrScore - b.asrScore ||
      compareCandidateSourceForAsr(a, b) ||
      compareSizeForAsr(a, b)
    );
    const selected = variants[0];
    const hiddenCount = Math.max(variants.length - 1, 0);
    const variantStats = summarizeVariants(variants);
    const mergedHeaders = mergeVariantHeaders(variants);
    const resolvedSourcePlan = FuguangMediaSourceResolvers.resolveAudioSourcePlan({
      candidates: variants,
      duration: selected.duration || 0
    });
    const sourcePlan = summarizeAudioSourcePlan(
      sourcePlanMatchesSelectedCandidate(selected, resolvedSourcePlan) ? resolvedSourcePlan : null
    );
    return {
      ...selected,
      requestHeaders: mergedHeaders.requestHeaders,
      responseHeaders: mergedHeaders.responseHeaders,
      variants: variants.map(summarizeVariant),
      hiddenCount,
      variantStats,
      sourcePlan,
      selectionReason: describeSelection(selected, hiddenCount, variantStats)
    };
  }

  function sourcePlanMatchesSelectedCandidate(selected = {}, plan = null) {
    if (!plan?.primaryAsset) {
      return false;
    }
    if (!isManifestCandidate(selected)) {
      return true;
    }
    if (plan.kind === "muxed-media" && plan.ffmpegInput?.type === "direct") {
      return sameUrl(plan.ffmpegInput?.url || plan.primaryAsset.url, selected.url);
    }
    return true;
  }

  function sameUrl(left = "", right = "") {
    return exactStreamUrl(left) === exactStreamUrl(right);
  }

  function summarizeAudioSourcePlan(plan) {
    if (!plan?.primaryAsset) {
      return null;
    }
    return {
      kind: plan.kind,
      reason: plan.reason,
      confidence: plan.confidence,
      primaryUrl: plan.primaryAsset.url,
      primaryKind: plan.primaryAsset.kind,
      primaryRole: plan.primaryAsset.role,
      container: plan.primaryAsset.container,
      codecs: plan.primaryAsset.codecs,
      siteAdapter: plan.primaryAsset.siteAdapter || "",
      ffmpegInput: {
        type: plan.ffmpegInput?.type || "",
        url: plan.ffmpegInput?.url || "",
        audioCandidateUrls: summarizeUrlList(plan.ffmpegInput?.audioCandidateUrls),
        fragments: summarizeFfmpegFragments(plan.ffmpegInput?.fragments)
      },
      expectedAudio: {
        codec: plan.expectedAudio?.codec || "",
        container: plan.expectedAudio?.container || "",
        duration: plan.expectedAudio?.duration || 0
      },
      normalizeStrategy: summarizeNormalizeStrategy(plan.normalizeStrategy),
      executable: plan.executable !== false,
      warnings: plan.warnings?.length ? plan.warnings : (plan.primaryAsset.warnings || [])
    };
  }

  function summarizeUrlList(values = []) {
    const output = [];
    for (const value of Array.isArray(values) ? values : []) {
      const url = String(value || "");
      if (/^https?:\/\//i.test(url) && !output.includes(url)) {
        output.push(url);
      }
    }
    return output;
  }

  function summarizeNormalizeStrategy(strategy = {}) {
    return {
      type: strategy.type || "",
      action: strategy.action || "",
      inputType: strategy.inputType || "",
      requiresAssembly: Boolean(strategy.requiresAssembly),
      output: {
        codec: strategy.output?.codec || "mp3",
        container: strategy.output?.container || "mp3",
        sampleRate: strategy.output?.sampleRate || 16000,
        channels: strategy.output?.channels || 1,
        bitrate: strategy.output?.bitrate || 64000
      }
    };
  }

  function summarizeFfmpegFragments(fragments) {
    return (Array.isArray(fragments) ? fragments : [])
      .filter(fragment => fragment?.url)
      .map(fragment => ({
        url: fragment.url,
        name: fragment.name || "",
        segmentType: fragment.segmentType || "",
        role: fragment.role || "",
        duration: fragment.duration || 0,
        start: fragment.start || 0,
        end: fragment.end || 0,
        byteRange: fragment.byteRange || null
      }));
  }
  
  function mergeVariantHeaders(variants) {
    return variants.reduce(
      (headers, candidate) => ({
        requestHeaders: {
          ...headers.requestHeaders,
          ...sanitizeInternalRequestHeaders(candidate.requestHeaders)
        },
        responseHeaders: {
          ...headers.responseHeaders,
          ...(candidate.responseHeaders || {})
        }
      }),
      { requestHeaders: {}, responseHeaders: {} }
    );
  }
  
  function summarizeVariants(variants) {
    return variants.reduce(
      (stats, candidate) => {
        stats.total += 1;
        stats[candidate.role] = (stats[candidate.role] || 0) + 1;
        if (candidate.kind === "hls" || candidate.kind === "dash") {
          stats.manifest += 1;
        }
        return stats;
      },
      { total: 0, audio: 0, video: 0, media: 0, playlist: 0, manifest: 0 }
    );
  }
  
  function summarizeVariant(candidate) {
    return {
      url: candidate.url,
      kind: candidate.kind,
      ext: candidate.ext,
      role: candidate.role,
      source: candidate.source,
      size: candidate.size,
      contentType: candidate.contentType,
      quality: candidate.quality,
      assetKind: candidate.assetKind,
      trackRole: candidate.trackRole,
      filename: candidate.filename,
      statusId: candidate.statusId,
      segmentType: candidate.segmentType
    };
  }
  
  function describeSelection(candidate, hiddenCount, stats) {
    if (!hiddenCount) {
      return candidate.role === "audio" ? "直接音频轨" : "单一候选";
    }
    if (candidate.role === "audio") {
      return `已折叠 ${hiddenCount} 条相似候选，自动选择适合 ASR 的音频轨`;
    }
    if (stats.manifest > 1) {
      return `已折叠 ${hiddenCount} 条清晰度变体，选择较轻的流用于语音识别`;
    }
    return `已折叠 ${hiddenCount} 条相似候选`;
  }
  
  function getSimilarityKey(candidate) {
    const urlInfo = parseUrlInfo(candidate.url);
    const pageKey = normalizeText(candidate.pageUrl || candidate.title || candidate.origin);
    const bilibiliMediaKey = getBilibiliMediaIdentity(urlInfo);
    if (bilibiliMediaKey) {
      return `asr:bilibili:${bilibiliMediaKey}`;
    }
    const xTwitterMediaKey = getXTwitterAmplifyMediaIdentity(urlInfo);
    if (xTwitterMediaKey) {
      return `asr:x-twitter:${xTwitterMediaKey}`;
    }
    const durationKey = candidate.duration ? Math.round(candidate.duration / 5) * 5 : "";
    if (pageKey && durationKey && isAsrSameContentCandidate(candidate)) {
      return `asr:page-duration:${pageKey}:${durationKey}`;
    }
    const familyPath = canonicalAsrFamilyPath(candidate);
    if (pageKey && familyPath) {
      return `asr:${pageKey}:${familyPath}`;
    }
    if (pageKey && durationKey) {
      return `asr:${pageKey}:${durationKey}`;
    }
    return `${candidate.kind}:${canonicalStreamUrl(candidate.url)}`;
  }
  
  function isAsrSameContentCandidate(candidate) {
    return ["audio", "video", "playlist", "media"].includes(candidate.role) ||
      ["audio", "video", "hls", "dash", "media"].includes(candidate.kind);
  }

  function isManifestCandidate(candidate = {}) {
    return candidate.kind === "hls" || candidate.kind === "dash" || MANIFEST_EXTENSIONS.has(candidate.ext);
  }
  
  function canonicalAsrFamilyPath(candidate) {
    let path = canonicalMediaFamilyPath(candidate.url);
    if (candidate.role === "audio" || candidate.kind === "audio") {
      path = path.replace(/\.(?:aac|flac|m4a|mp3|mp4|oga|ogg|opus|wav|weba)(?=$)/i, ".{audio}");
    }
    return path;
  }
  
  function scoreCandidateForAsr(candidate, role, quality, size, duration, contentType = "", urlInfo = null, state = null) {
    const info = urlInfo || parseUrlInfo(candidate.url || "");
    if (candidate.ext === "m4s" && candidate.kind !== "audio" && !contentType.startsWith("audio/")) {
      return 30 + Math.min(size / 1024 / 1024, 60);
    }
    if (role === "audio") {
      if (isLowConfidenceDirectAudioCandidate(candidate, contentType, info, size, state)) {
        return 45 + audioContainerPenalty(candidate);
      }
      return audioSuitabilityForAsr(candidate, quality, size, duration);
    }
    if (candidate.kind === "hls") {
      return 10 + qualityForAsr(quality) + (candidate.playlistType === "master" ? 5 : 0);
    }
    if (candidate.kind === "dash") {
      return 20 + qualityForAsr(quality);
    }
    if (role === "video") {
      return 40 + qualityForAsr(quality);
    }
    return 50;
  }

  function scoreCandidatePageRelevance(candidate = {}, duration, state = null) {
    const targetMediaId = getXTwitterCurrentMediaIdentity(state);
    const candidateMediaId = getXTwitterAnyMediaIdentity(parseUrlInfo(candidate.url || ""));
    const targetStatusId = xTwitterStatusIdFromPageUrl(state?.page?.url || state?.context?.href || "");
    const candidateStatusId = firstDigits(candidate.statusId, candidate.tweetId);
    const durationScore = scoreCandidateDurationRelevance(duration, state);
    if (targetMediaId && candidateMediaId === targetMediaId) {
      return 0;
    }
    if (targetMediaId && candidateMediaId) {
      return 20 + durationScore;
    }
    if (targetStatusId && candidateStatusId === targetStatusId) {
      return 0;
    }
    if (targetStatusId && candidateStatusId) {
      return 16;
    }
    if (targetStatusId) {
      return 1 + durationScore;
    }
    return durationScore;
  }

  function scoreCandidateDurationRelevance(duration, state = null) {
    const targetDuration = positiveNumber(state?.context?.duration);
    if (!targetDuration || !state?.context?.hasMedia) {
      return 0;
    }
    const candidateDuration = positiveNumber(duration);
    if (!candidateDuration) {
      return 4;
    }
    const drift = Math.abs(candidateDuration - targetDuration);
    const tolerance = Math.max(2, Math.min(12, targetDuration * 0.03));
    if (drift <= tolerance) {
      return 0;
    }
    return 8 + Math.min(drift / targetDuration, 8);
  }

  function xTwitterStatusIdFromPageUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (!/(^|\.)x\.com$/i.test(url.hostname) && !/(^|\.)twitter\.com$/i.test(url.hostname)) {
        return "";
      }
      return url.pathname.match(/\/status\/(\d+)/i)?.[1] || "";
    } catch {
      return "";
    }
  }

  function getXTwitterAmplifyMediaIdentity(urlInfo = {}) {
    if (!/(^|\.)video\.twimg\.com$/i.test(urlInfo.hostname || "")) {
      return "";
    }
    return String(urlInfo.pathname || "").match(/\/amplify_video\/(\d+)\//i)?.[1] || "";
  }

  function getXTwitterAnyMediaIdentity(urlInfo = {}) {
    const hostname = String(urlInfo.hostname || "");
    const pathname = String(urlInfo.pathname || "");
    if (/(^|\.)video\.twimg\.com$/i.test(hostname)) {
      return pathname.match(/\/amplify_video\/(\d+)\//i)?.[1] || "";
    }
    if (/(^|\.)pbs\.twimg\.com$/i.test(hostname) || /(^|\.)pbs-[a-z0-9-]+\.twimg\.com$/i.test(hostname)) {
      return pathname.match(/\/amplify_video_thumb\/(\d+)\//i)?.[1] || "";
    }
    return pathname.match(/\/amplify_video_thumb\/(\d+)\//i)?.[1] || "";
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
  
  function compareSizeForAsr(a, b) {
    if (a.role === "audio" && b.role === "audio") {
      return audioSuitabilityForAsr(a, a.quality, a.size, a.duration) -
        audioSuitabilityForAsr(b, b.quality, b.size, b.duration) ||
        compareKnownSizeAscending(a, b);
    }
    if (a.kind === "hls" && b.kind === "hls") {
      return qualityForAsr(a.quality) - qualityForAsr(b.quality);
    }
    return (a.size || 0) - (b.size || 0);
  }
  
  function compareCandidateSourceForAsr(a, b) {
    return candidateSourceRank(b.source) - candidateSourceRank(a.source);
  }
  
  function audioSuitabilityForAsr(candidate, quality, size, duration) {
    const bitrate = inferAudioBitrate(candidate, quality, size, duration);
    let score = bitrate ? audioBitratePenalty(bitrate) : 2;
    score += audioContainerPenalty(candidate);
    if (!bitrate && size) {
      score += Math.min(size / 1024 / 1024 / 50, 6);
    }
    return score;
  }
  
  function inferAudioBitrate(candidate, quality, size, duration) {
    const bilibili = inferBilibiliAudioBitrate(candidate);
    if (bilibili) {
      return bilibili;
    }
    const urlBitrate = inferAudioBitrateFromUrl(candidate);
    if (urlBitrate) {
      return urlBitrate;
    }
    const explicit = positiveNumber(candidate.audioBitrate || candidate.bitrate || candidate.averageBitrate || quality?.bandwidth);
    if (explicit) {
      return explicit;
    }
    const seconds = positiveNumber(duration || candidate.duration);
    const bytes = positiveNumber(size || candidate.size);
    if (seconds && bytes) {
      return (bytes * 8) / seconds;
    }
    return 0;
  }

  function inferAudioBitrateFromUrl(candidate) {
    const urlInfo = parseUrlInfo(candidate.url || "");
    const text = `${urlInfo.pathname || ""} ${urlInfo.filename || ""}`.toLowerCase();
    const match = text.match(/(?:^|[^\d])([1-9]\d{1,3})(?:k|kbps)(?:[^\d]|$)/i);
    if (!match) {
      return 0;
    }
    return Number(match[1]) * 1000;
  }
  
  function inferBilibiliAudioBitrate(candidate) {
    const urlInfo = parseUrlInfo(candidate.url || "");
    const match = urlInfo.filename.match(/(?:^|-)302(16|32|80)(?=\.m4s$)/i);
    if (!match) {
      return 0;
    }
    if (match[1] === "16") {
      return 64_000;
    }
    if (match[1] === "32") {
      return 132_000;
    }
    return 192_000;
  }
  
  function audioBitratePenalty(bitrate) {
    if (bitrate < ASR_AUDIO_ACCEPTABLE_LOW_BPS) {
      return 8 + (ASR_AUDIO_ACCEPTABLE_LOW_BPS - bitrate) / ASR_AUDIO_ACCEPTABLE_LOW_BPS;
    }
    if (bitrate < ASR_AUDIO_IDEAL_MIN_BPS) {
      return 1 + (ASR_AUDIO_IDEAL_MIN_BPS - bitrate) / ASR_AUDIO_IDEAL_MIN_BPS;
    }
    if (bitrate <= ASR_AUDIO_IDEAL_MAX_BPS) {
      return 0;
    }
    if (bitrate <= ASR_AUDIO_ACCEPTABLE_HIGH_BPS) {
      return 1 + (bitrate - ASR_AUDIO_IDEAL_MAX_BPS) / ASR_AUDIO_IDEAL_MAX_BPS;
    }
    return 5 + Math.min((bitrate - ASR_AUDIO_ACCEPTABLE_HIGH_BPS) / ASR_AUDIO_ACCEPTABLE_HIGH_BPS, 12);
  }
  
  function audioContainerPenalty(candidate) {
    const ext = String(candidate.ext || parseUrlInfo(candidate.url || "").filename.split(".").pop() || "").toLowerCase();
    if (["flac", "wav", "aiff", "aif", "alac"].includes(ext)) {
      return 6;
    }
    if (["aac", "m4a", "mp3", "mp4", "m4s", "oga", "ogg", "opus", "weba"].includes(ext)) {
      return 0;
    }
    return 1;
  }
  
  function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }
  
  function compareKnownSizeAscending(a, b) {
    const sizeA = positiveNumber(a.size);
    const sizeB = positiveNumber(b.size);
    if (sizeA && sizeB) {
      return sizeA - sizeB;
    }
    if (sizeA) {
      return -1;
    }
    if (sizeB) {
      return 1;
    }
    return 0;
  }
  
  function qualityForAsr(quality) {
    if (!quality?.height && !quality?.bandwidth) {
      return 0;
    }
    return (quality.height || 0) / 1000 + (quality.bandwidth || 0) / 10_000_000;
  }
  
  function inferMediaRole(candidate, contentType, urlInfo, videoWidth, videoHeight) {
    if (["audio", "video", "playlist", "media"].includes(candidate.role)) {
      return candidate.role;
    }
    const separatedTrackRole = inferSeparatedTrackRoleFromUrl(urlInfo);
    if (separatedTrackRole) {
      return separatedTrackRole;
    }
    const genericSegmentContent = candidate.ext === "m4s" && contentType.includes("iso.segment");
    if (candidate.kind === "audio" || AUDIO_EXTENSIONS.has(candidate.ext)) {
      return "audio";
    }
    if ((candidate.kind === "hls" || candidate.kind === "dash") && isLikelyAudioOnlyManifest(candidate, urlInfo)) {
      return "audio";
    }
    if (candidate.kind === "hls" || candidate.kind === "dash") {
      return "playlist";
    }
    if ((contentType.startsWith("video/") && !genericSegmentContent) || videoWidth || videoHeight) {
      return "video";
    }
    if (contentType.startsWith("audio/")) {
      return "audio";
    }
    if (isLikelyBilibiliAudio(urlInfo)) {
      return "audio";
    }
    return "media";
  }

  function inferSeparatedTrackRoleFromUrl(urlInfo = {}) {
    if (!/(^|\.)video\.twimg\.com$/i.test(urlInfo.hostname || "")) {
      return "";
    }
    const path = String(urlInfo.pathname || "").toLowerCase();
    if (/\/amplify_video\/\d+\/(?:audio|pl\/mp4a)(?:\/|$)/i.test(path)) {
      return "audio";
    }
    if (/\/amplify_video\/\d+\/(?:vid|pl)\/(?:avc1|h264|h265|hevc|vp9|av01)(?:\/|$)/i.test(path)) {
      return "video";
    }
    return "";
  }

  function isLikelyAudioOnlyManifest(candidate, urlInfo) {
    if (candidate.audioOnly === true) {
      return true;
    }
    const codecs = String(candidate.codecs || candidate.quality?.codecs || "").toLowerCase();
    if (codecs && /(?:mp4a|aac|opus|vorbis)/i.test(codecs) && !/(?:avc|hvc|hev|vp8|vp9|av01)/i.test(codecs)) {
      return true;
    }
    const path = `${urlInfo.pathname || ""} ${urlInfo.filename || ""}`;
    return /(?:^|[-_/])(?:audio|aac|m4a|mp3|opus)(?:[-_.]|$)/i.test(path) ||
      /(?:^|[-_/])(?:f\d+[-_.])?a\d+(?=[-_.\/]|$)/i.test(path);
  }
  
  function shouldInheritPageDuration(candidate, contentType, urlInfo, state = null) {
    if (isIgnoredMediaUrl(candidate.url)) {
      return false;
    }
    if (candidate.duration) {
      return true;
    }
    if (candidate.source === "media-element") {
      return true;
    }
    if (candidate.kind === "hls" || candidate.kind === "dash") {
      return true;
    }
    if (candidate.ext === "m4s" || isLikelyBilibiliMedia(urlInfo)) {
      return true;
    }
    if (
      isDirectAudioCandidate(candidate, contentType, urlInfo) &&
      !hasTrustedFullLengthAudioEvidence(candidate, contentType, urlInfo, candidateKnownSize(candidate), state)
    ) {
      return false;
    }
    if (hasTrustedPageMediaContext(candidate, contentType, urlInfo, state)) {
      return true;
    }
    return false;
  }

  function isLowConfidenceDirectAudioCandidate(candidate, contentType, urlInfo, size, state) {
    if (!isDirectAudioCandidate(candidate, contentType, urlInfo)) {
      return false;
    }
    return !hasTrustedFullLengthAudioEvidence(candidate, contentType, urlInfo, size, state);
  }

  function isDirectAudioCandidate(candidate, contentType, urlInfo) {
    if (isManifestCandidate(candidate)) {
      return false;
    }
    return candidate.kind === "audio" ||
      contentType.startsWith("audio/") ||
      AUDIO_EXTENSIONS.has(candidate.ext) ||
      /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)$/i.test(urlInfo.pathname || "");
  }

  function hasTrustedFullLengthAudioEvidence(candidate, contentType, urlInfo, size, state) {
    if (!isDirectAudioCandidate(candidate, contentType, urlInfo)) {
      return true;
    }
    if (positiveNumber(candidate.duration)) {
      return true;
    }
    if (candidate.source === "media-element") {
      return true;
    }
    if (candidate.source === "bilibili-playurl" || isLikelyBilibiliMedia(urlInfo)) {
      return true;
    }
    if (hasPlausibleAudioSizeForPageDuration(size || candidateKnownSize(candidate), state)) {
      return true;
    }
    return isStructuredAudioSource(candidate.source) && hasExplicitAudioBitrate(candidate);
  }

  function hasPlausibleAudioSizeForPageDuration(size, state) {
    const bytes = positiveNumber(size);
    const duration = positiveNumber(state?.context?.duration);
    if (!bytes || !duration) {
      return false;
    }
    const bitrate = (bytes * 8) / duration;
    return bitrate >= ASR_AUDIO_ACCEPTABLE_LOW_BPS && bitrate <= ASR_AUDIO_PLAUSIBLE_HIGH_BPS;
  }

  function isStructuredAudioSource(source) {
    return source === "json-parse" || source === "xhr-body";
  }

  function hasExplicitAudioBitrate(candidate) {
    return positiveNumber(candidate.audioBitrate || candidate.bitrate || candidate.averageBitrate || candidate.bandwidth) > 0;
  }

  function candidateKnownSize(candidate) {
    const responseHeaders = candidate.responseHeaders || {};
    return positiveNumber(responseHeaders.size || candidate.size);
  }
  
  function hasTrustedPageMediaContext(candidate, contentType, urlInfo, state) {
    const duration = Number(state?.context?.duration);
    if (!state?.context?.hasMedia || !Number.isFinite(duration) || duration <= 0) {
      return false;
    }
    if (!isLikelyDirectPlayableMedia(candidate, contentType, urlInfo)) {
      return false;
    }
    const currentPageUrl = state.page?.url || state.context?.href || "";
    const initiator = candidate.pageUrl || candidate.initiator || "";
    if (!initiator || !currentPageUrl) {
      return true;
    }
    return normalizePageUrlForGrouping(initiator) === normalizePageUrlForGrouping(currentPageUrl) ||
      (initiator.startsWith("http") && currentPageUrl.startsWith("http"));
  }
  
  function isLikelyDirectPlayableMedia(candidate, contentType, urlInfo) {
    if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
      return true;
    }
    return AUDIO_EXTENSIONS.has(candidate.ext) || ["mp4", "webm"].includes(candidate.ext) ||
      /\.(?:m4a|mp3|aac|opus|oga|ogg|weba|mp4|webm)$/i.test(urlInfo.pathname || "");
  }
  
  function normalizePageUrlForGrouping(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.hash = "";
      return `${url.origin}${url.pathname}`;
    } catch {
      return String(rawUrl || "");
    }
  }
  
  function shouldInheritPageDimensions(candidate, contentType, urlInfo) {
    if (isIgnoredMediaUrl(candidate.url)) {
      return false;
    }
    if (candidate.videoWidth || candidate.videoHeight) {
      return true;
    }
    if (candidate.kind === "hls" || candidate.kind === "dash") {
      return true;
    }
    if (contentType.startsWith("video/") && !isLikelyBilibiliAudio(urlInfo)) {
      return true;
    }
    return candidate.source === "media-element" && !contentType.startsWith("audio/");
  }
  
  function isLikelyBilibiliAudio(urlInfo) {
    return /(?:^|-)302(?:16|32|80)(?=\.m4s$)/i.test(urlInfo.filename) || /\/audio\//i.test(urlInfo.pathname);
  }
  
  function isLikelyBilibiliMedia(urlInfo) {
    return isLikelyBilibiliHostOrPath(urlInfo);
  }

  function isLikelyBilibiliHostOrPath(urlInfo) {
    return /(?:^|\.)bilibili(?:video)?\.com$/i.test(urlInfo.hostname) ||
      /(?:^|\.)bilivideo\.(?:com|cn)$/i.test(urlInfo.hostname) ||
      /\/upgcxcode\//i.test(urlInfo.pathname);
  }
  
  function getBilibiliMediaIdentity(urlInfo) {
    if (!isLikelyBilibiliMedia(urlInfo)) {
      return "";
    }
    const filenameMatch = urlInfo.filename.match(/^(\d+-\d+)-\d+\.(?:m4s|mp4)$/i);
    if (filenameMatch) {
      return filenameMatch[1];
    }
    const pathMatch = urlInfo.pathname.match(/\/upgcxcode\/(?:[^/]+\/){0,4}(\d+)(?:\/|$)/i);
    if (pathMatch) {
      return pathMatch[1];
    }
    return canonicalMediaFamilyPath(urlInfo.pathname || "");
  }

  function getBilibiliTrackIdentity(urlInfo, candidate = {}) {
    const filenameMatch = urlInfo.filename.match(/^\d+-\d+-(\d+)\.(?:m4s|mp4)$/i);
    if (filenameMatch) {
      return `track:${filenameMatch[1]}`;
    }
    const contentType = normalizeContentType(candidate.contentType || candidate.responseHeaders?.type || "");
    if (isLikelyBilibiliAudio(urlInfo) || candidate.kind === "audio" || contentType.startsWith("audio/")) {
      return "role:audio";
    }
    if (candidate.kind === "video" || contentType.startsWith("video/") || candidate.videoWidth || candidate.videoHeight) {
      return "role:video";
    }
    return `role:${candidate.kind || "media"}`;
  }

  function getGenericSegmentedTrackIdentity(urlInfo, candidate = {}) {
    if (!/\.(?:m4s|mp4)$/i.test(urlInfo.filename || "")) {
      return "";
    }
    const filenameMatch = urlInfo.filename.match(/(?:^|[-_])(\d{4,6})(?=\.(?:m4s|mp4)$)/i);
    if (filenameMatch) {
      return `track:${filenameMatch[1]}`;
    }
    const contentType = normalizeContentType(candidate.contentType || candidate.responseHeaders?.type || "");
    if (candidate.role === "audio" || candidate.kind === "audio" || contentType.startsWith("audio/")) {
      return "role:audio";
    }
    if (candidate.role === "video" || candidate.kind === "video" || contentType.startsWith("video/") || candidate.videoWidth || candidate.videoHeight) {
      return "role:video";
    }
    return "";
  }
  
  function inferQuality(rawUrl, videoWidth, videoHeight) {
    const quality = {
      width: videoWidth || null,
      height: videoHeight || null,
      label: videoWidth && videoHeight ? `${videoHeight}p` : ""
    };
    try {
      const url = new URL(rawUrl);
      const text = `${url.pathname} ${url.search}`.toLowerCase();
      const heightMatch = text.match(/(?:^|[^\d])(\d{3,4})p(?:[^\d]|$)/);
      if (heightMatch) {
        quality.height = Number(heightMatch[1]);
        quality.label = `${quality.height}p`;
      }
      const resolutionMatch = text.match(/(\d{3,5})[x_](\d{3,5})/);
      if (resolutionMatch) {
        quality.width = Number(resolutionMatch[1]);
        quality.height = Number(resolutionMatch[2]);
        quality.label = `${quality.height}p`;
      }
      const bandwidthMatch = text.match(/(?:bandwidth|bw|br)=(\d+)/);
      if (bandwidthMatch) {
        quality.bandwidth = Number(bandwidthMatch[1]);
      }
      const audioBitrateMatch = text.match(/(?:^|[^\d])([1-9]\d{1,3})(?:k|kbps)(?:[^\d]|$)/);
      if (!quality.bandwidth && audioBitrateMatch) {
        quality.bandwidth = Number(audioBitrateMatch[1]) * 1000;
      }
    } catch {
      return quality;
    }
    return quality;
  }
  
  function parseUrlInfo(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
      return {
        hostname: url.hostname,
        origin: url.origin,
        pathname: url.pathname,
        filename
      };
    } catch {
      return {
        hostname: "",
        origin: "",
        pathname: "",
        filename: rawUrl || ""
      };
    }
  }
  
  function canonicalStreamUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `${url.host}${canonicalPathname(url.pathname)}`;
    } catch {
      return rawUrl || "";
    }
  }

  function exactStreamUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `${url.host}${url.pathname}${url.search}`;
    } catch {
      return rawUrl || "";
    }
  }
  
  function canonicalStreamPath(rawUrl) {
    try {
      return canonicalPathname(new URL(rawUrl).pathname);
    } catch {
      return rawUrl || "";
    }
  }
  
  function canonicalMediaFamilyPath(rawUrl) {
    const path = canonicalStreamPath(rawUrl);
    return path
      .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
      .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
      .replace(/(?:^|[-_/])f\d+[-_.][av]\d+(?=[-_/.]|$)/gi, "-{track}")
      .replace(/(?:^|[-_/])[av]\d+(?=[-_/.]|$)/gi, "-{track}")
      .replace(/(?:^|[-_/])\d{3,4}p(?=[-_/.]|$)/gi, "-{quality}")
      .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}");
  }
  
  function canonicalPathname(pathname) {
    return pathname
      .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
      .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
      .replace(/(?:^|[-_/])f\d+[-_.][av]\d+(?=[-_/.]|$)/gi, "-{track}")
      .replace(/(?:^|[-_/])[av]\d+(?=[-_/.]|$)/gi, "-{track}")
      .replace(/(?:^|[-_/])\d{3,4}p(?=[-_/.]|$)/gi, "-{quality}")
      .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}")
      .replace(/-\d{5,6}(?=\.m4s$)/i, "-{track}");
  }
  
  function normalizeText(value = "") {
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
  }
  
  function normalizeContentType(value = "") {
    return String(value).split(";")[0].trim().toLowerCase();
  }
  
  function pickFinite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }
    return null;
  }
  
    function classifyUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (isIgnoredMediaUrl(url.href)) {
      return null;
    }
    const ext = url.pathname.split(".").pop()?.toLowerCase() || "";
    const mime = normalizeContentType(url.searchParams.get("mime") || url.searchParams.get("mimeType") || "");
    if (mime.startsWith("audio/")) {
      return { kind: "audio", ext: extFromMime(mime, ext) };
    }
    if (mime.startsWith("video/")) {
      return { kind: "media", ext: extFromMime(mime, ext) };
    }
    if (mime.includes("mpegurl")) {
      return { kind: "hls", ext: "m3u8" };
    }
    if (mime.includes("dash+xml")) {
      return { kind: "dash", ext: "mpd" };
    }
    if (isYoutubePlaybackUrl(url)) {
      return { kind: "media", ext: ext || "" };
    }
    if (!MEDIA_EXTENSIONS.has(ext)) {
      return null;
    }
    if (AUDIO_EXTENSIONS.has(ext)) {
      return { kind: "audio", ext };
    }
    if (MANIFEST_EXTENSIONS.has(ext)) {
      return { kind: ext === "mpd" ? "dash" : "hls", ext };
    }
    return { kind: "media", ext };
  }
  
  function inferKindFromContentType(contentType) {
    const type = contentType.toLowerCase();
    if (type.startsWith("audio/")) {
      return "audio";
    }
    if (type.includes("dash+xml")) {
      return "dash";
    }
    if (type.includes("mpegurl")) {
      return "hls";
    }
    return "media";
  }
  
  function isMediaContentType(contentType) {
    const normalized = contentType.toLowerCase();
    return MEDIA_CONTENT_TYPES.some(type => normalized.includes(type));
  }
  
  function isIgnoredMediaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
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
  
  function isGenericBinaryContentType(contentType) {
    return normalizeContentType(contentType) === "application/octet-stream";
  }
  
  function getHeader(headers = [], name) {
    return headers.find(header => header.name.toLowerCase() === name)?.value || "";
  }
  
  function compactRequestHeaders(headers = []) {
    const output = {};
    for (const header of headers) {
      const name = header.name.toLowerCase();
      if (shouldKeepInternalRequestHeader(name)) {
        output[name] = header.value;
      }
    }
    return output;
  }
  
  function sanitizeInternalRequestHeaders(headers = {}) {
    const output = {};
    if (!headers || typeof headers !== "object") {
      return output;
    }
    if (Array.isArray(headers)) {
      return compactRequestHeaders(headers);
    }
    for (const [name, value] of Object.entries(headers)) {
      const normalized = String(name || "").toLowerCase();
      if (shouldKeepInternalRequestHeader(normalized) && value != null) {
        output[normalized] = String(value);
      }
    }
    return output;
  }
  
  function shouldKeepInternalRequestHeader(name) {
    return INTERNAL_REQUEST_HEADER_NAMES.has(String(name || "").toLowerCase());
  }
  
  function compactResponseHeaders(headers = []) {
    const output = {};
    for (const header of headers || []) {
      const name = header.name.toLowerCase();
      if (name === "content-length") {
        output.size = Number(header.value) || undefined;
      } else if (name === "content-type") {
        output.type = header.value.split(";")[0].toLowerCase();
      } else if (name === "content-disposition") {
        output.attachment = header.value;
      } else if (name === "content-range") {
        const size = header.value.split("/")[1];
        if (size && size !== "*") {
          output.size = Number(size) || output.size;
        }
      }
    }
    return output;
  }
  
  return {
    AUDIO_EXTENSIONS,
    MANIFEST_EXTENSIONS,
    candidateFingerprint,
    candidatesReferToSamePreloadTarget,
    classifyUrl,
    compactRequestHeaders,
    compactResponseHeaders,
    firstUsefulTitle,
    getGroupedCandidatesForState,
    getHeader,
    inferKindFromContentType,
    isGenericBinaryContentType,
    isIgnoredMediaUrl,
    isMediaContentType,
    mergeCandidate,
    pickFinite,
    pruneCandidatesForRetention,
    resolvePreloadCandidateForStart,
    sanitizeInternalRequestHeaders,
    stripCandidateRequestHeaders
  };
})();
