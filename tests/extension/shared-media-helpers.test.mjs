import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({
  URL,
  URLSearchParams,
  String,
  Number,
  Array,
  Boolean,
  Math,
  RegExp,
  Set
});

function loadSharedModule(path, exportName) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(`export const ${exportName} =`, `var ${exportName} =`);
  vm.runInContext(source, context, { filename: path });
  return context[exportName];
}

const hlsUrlHelpers = loadSharedModule("../../extension/src/shared/hls-url-helpers.js", "FuguangHlsUrlHelpers");
const dashParser = loadSharedModule("../../extension/src/shared/dash-manifest-parser.js", "FuguangDashManifestParser");

function fixture(name) {
  return fs.readFileSync(new URL(`../fixtures/media-sites/${name}`, import.meta.url), "utf8");
}

{
  const urls = hlsUrlHelpers.buildLikelyAudioCompanionPlaylistUrls(
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/avc1/480x270/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  );
  assert.equal(JSON.stringify(urls), JSON.stringify([
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/mp4a/128000/GNTxdMNeTEMv2IMX.m3u8?tag=16",
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/mp4a/64000/GNTxdMNeTEMv2IMX.m3u8?tag=16",
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/mp4a/32000/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  ]));
}

{
  const genericUrls = hlsUrlHelpers.buildLikelyAudioCompanionPlaylistUrls(
    "https://media.example.test/sample-hls/720p/video.m3u8"
  );
  assert.equal(JSON.stringify(genericUrls.slice(0, 6)), JSON.stringify([
    "https://media.example.test/sample-hls/720p/audio.m3u8",
    "https://media.example.test/sample-hls/audio/audio.m3u8",
    "https://media.example.test/sample-hls/audio/index.m3u8",
    "https://media.example.test/sample-hls/audio/playlist.m3u8",
    "https://media.example.test/sample-hls/audio.m3u8",
    "https://media.example.test/sample-hls/mp4a/audio.m3u8"
  ]));
}

{
  const tedUrls = hlsUrlHelpers.buildLikelyAudioCompanionPlaylistUrls(
    "https://hls.ted.com/project_masters/1253/index-f9-v1.m3u8?intro_master_id=9294&preview=true"
  );
  assert.equal(
    tedUrls[0],
    "https://hls.ted.com/project_masters/1253/index-f8-a1.m3u8?intro_master_id=9294&preview=true"
  );
  assert.ok(tedUrls.includes(
    "https://hls.ted.com/project_masters/1253/index-f9-a1.m3u8?intro_master_id=9294&preview=true"
  ));
}

{
  const conservativeUrls = hlsUrlHelpers.buildAudioSiblingUrls(
    "https://media.example.test/sample-hls/720p/video.m3u8"
  );
  assert.equal(conservativeUrls.includes("https://media.example.test/sample-hls/audio/audio.m3u8"), false);
  assert.equal(conservativeUrls[0], "https://media.example.test/sample-hls/720p/audio.m3u8");
}

{
  assert.equal(hlsUrlHelpers.inferHlsRoleFromUrl("https://cdn.example.test/audio-aac-192kbps.m3u8"), "audio");
  assert.equal(hlsUrlHelpers.inferHlsRoleFromUrl("https://video.twimg.com/path/pl/mp4a/128000/audio.m3u8"), "audio");
  assert.equal(hlsUrlHelpers.inferHlsRoleFromUrl("https://delivery.example.test/video-h264-720p.m3u8"), "video");
  assert.equal(hlsUrlHelpers.inferHlsRoleFromUrl("https://video.twimg.com/path/pl/avc1/650x360/video.m3u8"), "video");
}

{
  const parsed = dashParser.parse(fixture("generic-dash.mpd"), "https://cdn.example.test/manifest/generic.mpd");
  const audioRepresentation = parsed.adaptationSets
    .flatMap(set => set.representations)
    .find(representation => representation.role === "audio");
  const fragments = dashParser.expandRepresentationFragments(audioRepresentation, parsed.duration);
  assert.equal(fragments.length, 3);
  assert.equal(fragments[0].segmentType, "init");
  assert.match(fragments[0].url, /\/manifest\/audio\/init\.mp4$/);
  assert.equal(dashParser.isUnsupportedWebmOpusRepresentation(audioRepresentation), false);
}

{
  const parsed = dashParser.parse(`<?xml version="1.0"?>
<MPD mediaPresentationDuration="PT2S">
  <Period>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" codecs="mp4a.40.2">
      <Representation id="audio-time" bandwidth="128000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init-$RepresentationID$.mp4" media="chunk-$Time%05d$-$$-$Number%03d$.m4s" startNumber="7" timescale="1000">
          <SegmentTimeline>
            <S t="500" d="500" r="2" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`, "https://cdn.example.test/manifest/time.mpd");
  const representation = parsed.adaptationSets[0].representations[0];
  const fragments = dashParser.expandRepresentationFragments(representation, parsed.duration);
  assert.deepEqual(JSON.parse(JSON.stringify(fragments.map(fragment => fragment.url))), [
    "https://cdn.example.test/manifest/audio/init-audio-time.mp4",
    "https://cdn.example.test/manifest/audio/chunk-00500-$-007.m4s",
    "https://cdn.example.test/manifest/audio/chunk-01000-$-008.m4s",
    "https://cdn.example.test/manifest/audio/chunk-01500-$-009.m4s"
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(fragments.slice(1).map(fragment => fragment.start))), [0.5, 1, 1.5]);
}

{
  const parsed = dashParser.parse(`<?xml version="1.0"?>
<MPD mediaPresentationDuration="PT10S">
  <Period>
    <AdaptationSet mimeType="audio/webm" contentType="audio" codecs="opus">
      <Representation id="audio-opus" bandwidth="96000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init.webm" media="seg-$Number$.webm" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`, "https://cdn.example.test/manifest/webm-opus.mpd");
  const representation = parsed.adaptationSets[0].representations[0];
  const fragments = dashParser.expandRepresentationFragments(representation, parsed.duration);
  assert.equal(dashParser.isUnsupportedWebmOpusRepresentation(representation), true);
  assert.equal(dashParser.fragmentsContainUnsupportedWebmOpus(fragments), true);
  assert.equal(dashParser.fragmentsContainUnsupportedWebmOpus([
    { url: "https://cdn.example.test/opaque-segment", name: "audio.webm" }
  ]), true);
  assert.equal(dashParser.fragmentsContainUnsupportedWebmOpus([
    { url: "https://cdn.example.test/audio.m4s", name: "audio.webm" }
  ]), false);
}
