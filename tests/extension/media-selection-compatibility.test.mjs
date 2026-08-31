import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { FuguangBrowserMediaCandidates } from "../../extension/src/background/browser-media-candidates.js";

const {
  getMediaLineageKey,
  mergeCandidate,
  getGroupedCandidatesForState,
  resolvePreloadCandidateForStart
} = FuguangBrowserMediaCandidates;

test("candidate merging preserves the baseline source-quality order", () => {
  const url = "https://cdn.example.test/media.mp4";
  const mediaElementCandidate = mergeCandidate(
    { url, source: "response", responseStatus: 206 },
    { url, source: "media-element", duration: 120 }
  );
  assert.equal(mediaElementCandidate.source, "media-element");

  const playerJsonCandidate = mergeCandidate(
    { url, source: "response", responseStatus: 206 },
    { url, source: "json-parse", audioBitrate: 128_000 }
  );
  assert.equal(playerJsonCandidate.source, "json-parse");

  const lowerQualityObservation = mergeCandidate(
    { url, source: "media-element", duration: 120 },
    { url, source: "response", responseStatus: 206 }
  );
  assert.equal(lowerQualityObservation.source, "media-element");
  assert.equal(lowerQualityObservation.responseStatus, 206);
});

test("multiple audio qualities keep the ASR-efficient baseline choice", () => {
  const candidates = [
    audioCandidate("low-32", 32_000, 480_000),
    audioCandidate("ideal-128", 128_000, 1_920_000),
    audioCandidate("high-320", 320_000, 4_800_000)
  ];

  const [selected] = getGroupedCandidatesForState(mediaState(candidates));
  assert.equal(selected.url, "https://cdn.example.test/ideal-128.m4a");
  assert.equal(selected.sourcePlan.primaryRole, "audio");
  assert.equal(selected.sourcePlan.ffmpegInput.url, selected.url);
});

test("dedicated audio remains preferred over a much larger video source", () => {
  const audio = audioCandidate("audio-128", 128_000, 1_920_000);
  const video = {
    url: "https://cdn.example.test/video-1080.mp4",
    kind: "video",
    ext: "mp4",
    role: "video",
    duration: 120,
    size: 80_000_000,
    bandwidth: 5_000_000,
    pageUrl: "https://example.test/watch",
    source: "media-element"
  };

  const [selected] = getGroupedCandidatesForState(mediaState([video, audio]));
  assert.equal(selected.url, audio.url);
  assert.equal(selected.hiddenCount, 1);
  assert.equal(selected.sourcePlan.kind, "direct-audio");
});

test("durable media lineage distinguishes equal-duration media without depending on duration metadata", () => {
  const pageUrl = "https://example.test/watch/two-players?sid=volatile";
  const mediaA = {
    url: "https://cdn.example.test/program-a/audio.m4a?token=old",
    kind: "audio",
    role: "audio",
    duration: 600,
    pageUrl
  };
  const mediaB = {
    url: "https://cdn.example.test/program-b/audio.m4a?token=other",
    kind: "audio",
    role: "audio",
    duration: 600,
    pageUrl
  };

  assert.notEqual(
    getMediaLineageKey(mediaA),
    getMediaLineageKey(mediaB),
    "different media on one page must not share a durable identity merely because their durations match"
  );
  assert.equal(
    getMediaLineageKey({ ...mediaA, duration: undefined, url: "https://cdn.example.test/program-a/audio.m4a?token=fresh" }),
    getMediaLineageKey(mediaA),
    "the same media must keep its durable identity across missing duration metadata and renewed URL tokens"
  );
  assert.notEqual(
    getMediaLineageKey({ ...mediaA, url: "https://cdn.example.test/play?asset_id=program-a&token=old" }),
    getMediaLineageKey({ ...mediaA, url: "https://cdn.example.test/play?asset_id=program-b&token=fresh" }),
    "stable content query parameters must distinguish media that share one CDN path"
  );
});

test("remote media remains directly attemptable without execution-block metadata", () => {
  const remoteUrls = [
    "https://cdn.example.test/video.mp4",
    "http://media.example.test/video.mp4",
    "http://127.0.0.1/video.mp4",
    "http://192.168.1.2/video.mp4",
    "http://[::1]/video.mp4",
    "http://device.local/video.mp4"
  ];

  for (const url of remoteUrls) {
    const resolved = resolvePreloadCandidateForStart({ candidates: [] }, {
      url,
      kind: "video",
      ext: "mp4",
      source: "page",
      responseStatus: 404,
      responseIp: "198.18.0.1",
      documentId: "stale-document"
    });
    assert.equal(resolved.url, url);
    assert.equal(Object.hasOwn(resolved, "executionAllowed"), false);
    assert.equal(Object.hasOwn(resolved, "trustTier"), false);
  }
});

test("local file start preserves an exact browser file key without gating the baseline URL path", () => {
  const url = "file:///C:/Videos/a.mp4";
  const state = mediaState([{
    url,
    kind: "video",
    ext: "mp4",
    role: "video",
    duration: 120,
    pageUrl: url,
    source: "media-element"
  }], { pageUrl: url });

  const authorized = resolvePreloadCandidateForStart(state, { url, localMediaFileKey: url });
  assert.equal(authorized.localMediaFileKey, url);

  const direct = resolvePreloadCandidateForStart(state, { url });
  assert.equal(direct.url, url);
  assert.equal(direct.localMediaFileKey, undefined);

  const mismatched = resolvePreloadCandidateForStart(state, {
    url,
    localMediaFileKey: "file:///C:/Videos/other.mp4"
  });
  assert.equal(mismatched.localMediaFileKey, undefined);

  const serviceWorkerSource = fs.readFileSync(
    new URL("../../extension/src/background/service-worker.js", import.meta.url),
    "utf8"
  );
  assert.equal(
    serviceWorkerSource.includes("本地媒体文件需要先授权读取，请重新选择当前文件。"),
    false,
    "an optional browser file handle must not become a new hard gate over baseline file:// extraction"
  );
});

function audioCandidate(name, audioBitrate, size) {
  return {
    url: `https://cdn.example.test/${name}.m4a`,
    kind: "audio",
    ext: "m4a",
    role: "audio",
    duration: 120,
    size,
    audioBitrate,
    pageUrl: "https://example.test/watch",
    source: "json-parse"
  };
}

function mediaState(candidates, { pageUrl = "https://example.test/watch" } = {}) {
  return {
    page: { url: pageUrl, title: "Episode" },
    context: { href: pageUrl, duration: 120, hasMedia: true },
    candidates
  };
}
