import assert from "node:assert/strict";
import test from "node:test";

import { FuguangBrowserMediaCandidates } from "../../extension/src/background/browser-media-candidates.js";

const currentDocumentProof = {
  observed: true,
  currentDocumentIdsByFrame: new Map([[0, "document-current"]])
};

test("private-network candidates require a successful browser-observed response", () => {
  for (const url of [
    "http://127.0.0.1/video.mp4",
    "http://127.0.0.1./video.mp4",
    "http://10.1.2.3/video.mp4",
    "http://172.16.2.3/video.mp4",
    "http://192.168.1.2/video.mp4",
    "http://[::1]/video.mp4",
    "http://[0:0:0:0:0:0:0:1]/video.mp4",
    "http://[0:0:0:0:0:0:0:0]/video.mp4",
    "http://[::ffff:192.168.1.2]/video.mp4",
    "http://[::ffff:c0a8:102]/video.mp4",
    "http://[fe90::1]/video.mp4",
    "http://[fea0::1]/video.mp4",
    "http://[febf::1]/video.mp4",
    "http://device.local/video.mp4",
    "http://router.lan/video.mp4",
    "https://nas.internal/video.mp4",
    "http://device.local./video.mp4",
    "http://localhost./video.mp4"
  ]) {
    assert.equal(FuguangBrowserMediaCandidates.isPrivateNetworkMediaUrl(url), true, url);
  }
  assert.equal(FuguangBrowserMediaCandidates.isPrivateNetworkMediaUrl("https://media.example.test/video.mp4"), false);
  assert.equal(FuguangBrowserMediaCandidates.isPrivateNetworkMediaUrl("https://[2001:4860:4860::8888]/video.mp4"), false);

  assert.deepEqual(
    FuguangBrowserMediaCandidates.mediaCandidateTrust({
      url: "http://127.0.0.1/video.mp4",
      source: "json-parse"
    }, { observed: true }),
    {
      trustTier: "untrusted-private-network",
      executionAllowed: false,
      trustReason: "private-network-source-not-observed"
    }
  );
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "request"
  }, { observed: true }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "response",
    responseStatus: 206,
    frameId: 0,
    documentId: "document-current"
  }, currentDocumentProof).executionAllowed, true);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "response",
    responseStatus: 304,
    frameId: 0,
    documentId: "document-current"
  }, currentDocumentProof).executionAllowed, true);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "response",
    responseStatus: 206
  }, currentDocumentProof).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "response",
    responseStatus: 404
  }, { observed: true }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://127.0.0.1/video.mp4",
    source: "media-element"
  }, { observed: true }).executionAllowed, false);
});

test("HTTP hostnames and observed private response IPs require exact response proof", () => {
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://media.example.test/video.mp4",
    source: "json-parse"
  }, { observed: true }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "http://media.example.test/video.mp4",
    source: "response",
    responseStatus: 206,
    responseIp: "192.168.1.25",
    frameId: 0,
    documentId: "document-current"
  }, currentDocumentProof).executionAllowed, true);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "https://media.example.test/video.mp4",
    source: "media-element",
    responseIp: "192.168.1.25"
  }, { observed: true }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "https://media.example.test/video.mp4",
    source: "response",
    responseStatus: 200,
    responseIp: "192.168.1.25",
    frameId: 0,
    documentId: "document-current"
  }, currentDocumentProof).executionAllowed, true);
});

test("public URLs remain compatible and file URLs require an exact authorized handle", () => {
  assert.deepEqual(
    FuguangBrowserMediaCandidates.mediaCandidateTrust({ url: "https://cdn.example.test/video.mp4" }, { observed: false }),
    {
      trustTier: "unverified-public",
      executionAllowed: true,
      trustReason: "public-url-with-sensitive-fields-removed"
    }
  );
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({ url: "file:///C:/Videos/a.mp4" }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "file:///C:/Videos/a.mp4",
    localMediaFileKey: "file:///C:/Videos/a.mp4"
  }).executionAllowed, true);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust({
    url: "file:///C:/Videos/a.mp4",
    localMediaFileKey: "file:///C:/Videos/other.mp4"
  }).executionAllowed, false);
});

test("candidate merging preserves and promotes browser-observed trust provenance", () => {
  const url = "http://192.168.1.20/media.mp4";
  const preserved = FuguangBrowserMediaCandidates.mergeCandidate(
    { url, kind: "media", source: "request", contentType: "video/mp4" },
    { url, kind: "media", source: "media-element", duration: 30 }
  );
  assert.equal(preserved.source, "request");
  assert.equal(preserved.duration, 30, "page metadata should still enrich the observed candidate");
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(preserved, { observed: true }).executionAllowed, false);

  const promoted = FuguangBrowserMediaCandidates.mergeCandidate(
    { url, kind: "media", source: "media-element" },
    {
      url,
      kind: "media",
      source: "response",
      responseStatus: 206,
      contentType: "video/mp4",
      frameId: 0,
      documentId: "document-current"
    }
  );
  assert.equal(promoted.source, "response");
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(promoted, currentDocumentProof).executionAllowed, true);
});

test("private response provenance never crosses exact URL variants", () => {
  const observed = {
    url: "http://192.168.1.20/media.mp4?token=allowed",
    kind: "media",
    source: "response",
    requestId: "request-a",
    responseStatus: 206,
    requestHeaders: { authorization: "Bearer allowed" }
  };
  const unobserved = {
    url: "http://192.168.1.20/media.mp4?token=other",
    kind: "media",
    source: "media-element"
  };

  assert.notEqual(
    FuguangBrowserMediaCandidates.candidateFingerprint(observed),
    FuguangBrowserMediaCandidates.candidateFingerprint(unobserved),
    "private variants with different queries must not share a merge key"
  );

  const merged = FuguangBrowserMediaCandidates.mergeCandidate(observed, unobserved);
  assert.equal(merged.url, unobserved.url);
  assert.equal(merged.source, "media-element");
  assert.equal(merged.responseStatus, undefined);
  assert.equal(merged.requestId, undefined);
  assert.deepEqual(merged.requestHeaders, {});
  assert.equal(
    FuguangBrowserMediaCandidates.mediaCandidateTrust(merged, { observed: true }).executionAllowed,
    false,
    "an unobserved private variant must not inherit response authorization"
  );
});

test("private response proof stays bound to the active document", () => {
  const candidate = {
    url: "http://192.168.1.20/media.mp4",
    kind: "media",
    source: "response",
    responseStatus: 206,
    documentId: "document-old"
  };
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(candidate, {
    observed: true,
    currentDocumentIds: new Set(["document-new"])
  }).executionAllowed, false);
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(candidate, {
    observed: true,
    currentDocumentIds: new Set(["document-old"])
  }).executionAllowed, true);
});

test("nested private response proof fails closed without a parent document id", () => {
  const candidate = {
    url: "http://192.168.1.20/media.mp4",
    kind: "media",
    source: "response",
    responseStatus: 206,
    frameId: 7,
    documentId: "child-current",
    parentFrameId: 3,
    parentDocumentId: ""
  };
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(candidate, {
    observed: true,
    currentDocumentIdsByFrame: new Map([[7, "child-current"], [3, "parent-current"]])
  }).executionAllowed, false);
});

test("response proof stays atomic when a current page reports the same private URL", () => {
  const url = "http://192.168.1.20/media.mp4";
  const observed = {
    url,
    kind: "media",
    source: "response",
    requestId: "request-old",
    responseStatus: 206,
    frameId: 0,
    documentId: "document-old",
    requestHeaders: { authorization: "Bearer old" }
  };
  const currentPage = {
    url,
    kind: "media",
    source: "media-element",
    frameId: 0,
    documentId: "document-current",
    duration: 30
  };

  const merged = FuguangBrowserMediaCandidates.mergeCandidate(observed, currentPage);
  assert.equal(merged.source, "response");
  assert.equal(merged.documentId, "document-old", "page metadata must not rebind an old response proof");
  assert.equal(merged.requestId, "request-old");
  assert.deepEqual(merged.requestHeaders, { authorization: "Bearer old" });
  assert.equal(FuguangBrowserMediaCandidates.mediaCandidateTrust(merged, {
    observed: true,
    currentDocumentIdsByFrame: new Map([[0, "document-current"]])
  }).executionAllowed, false);
});

test("a newer response attestation replaces stale authorization instead of merging it", () => {
  const url = "http://192.168.1.20/media.mp4";
  const oldResponse = {
    url,
    kind: "media",
    source: "response",
    requestId: "request-old",
    responseStatus: 206,
    frameId: 0,
    documentId: "document-old",
    requestHeaders: { authorization: "Bearer old" },
    responseHeaders: { etag: "old" }
  };
  const currentResponse = {
    url,
    kind: "media",
    source: "response",
    requestId: "request-current",
    responseStatus: 206,
    frameId: 0,
    documentId: "document-current",
    requestHeaders: {},
    responseHeaders: { etag: "current" }
  };

  const merged = FuguangBrowserMediaCandidates.mergeCandidate(oldResponse, currentResponse);
  assert.equal(merged.documentId, "document-current");
  assert.equal(merged.requestId, "request-current");
  assert.deepEqual(merged.requestHeaders, {}, "a new response without authorization must clear the old bearer token");
  assert.deepEqual(merged.responseHeaders, { etag: "current" });
});
