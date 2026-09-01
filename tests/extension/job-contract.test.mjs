import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobContract } from "../../extension/src/shared/job-contract.js";

test("job ledger stays small, derives chunk counts, and excludes runtime secrets", () => {
  const record = {
    tabId: 42,
    runToken: "run-a",
    candidate: {
      url: "https://media.example.test/video.m3u8?token=signed-token",
      kind: "hls",
      ext: "m3u8",
      requestHeaders: { authorization: "Bearer secret-header" }
    },
    presentationBinding: {
      frameId: 7,
      documentId: "document-a",
      lineageKey: "asr:https://example.test/watch/1:/video.m3u8"
    },
    asrCapabilities: {
      supportedRequestFields: ["vad_filter", "vad_filter", "no_speech_threshold", ""],
      speechTimestampsEndpoint: "https://asr.example.test/v1/audio/speech/timestamps"
    },
    modelConfig: {
      targetLanguage: "zh-CN",
      asr: { apiKey: "custom-asr-credential-value" },
      translation: { apiKey: "custom-translation-credential-value" },
      executionSpec: {
        version: 1,
        asrProfileId: "asr-a",
        llmProfileId: "llm-a",
        sourceLanguage: "ja",
        targetLanguage: "zh-CN",
        webFfmpegPerformance: "auto",
        asrWorkers: 1,
        translationWorkers: 2,
        chunkMinutes: 15,
        fingerprint: "a".repeat(64),
        apiKey: "must-never-persist"
      }
    },
    job: {
      id: "job-a",
      runToken: "run-a",
      pipeline: "browser",
      status: "running",
      stage: "translation",
      error: "Invalid API key custom-asr-credential-value; api_key=custom-translation-credential-value",
      sourceUrl: "https://media.example.test/video.m3u8?token=signed-token",
      createdAt: 100,
      updatedAt: 200,
      extract: { status: "completed", progress: 100, chunkCount: 4, duration: 120 },
      translation: {
        status: "running",
        chunksTotal: 4,
        chunkStatuses: [
          { index: 0, stage: "completed" },
          { index: 1, stage: "completed_with_warnings" },
          { index: 2, stage: "translation" },
          { index: 3, stage: "failed" }
        ],
        transcript: { source: [{ text: "large transcript" }] },
        vttText: "WEBVTT\nlarge payload"
      }
    }
  };

  const ledger = FuguangJobContract.createJobLedgerEntry(record, {
    pageIdentity: "https://example.test/watch/1"
  });
  assert.deepEqual(ledger.translation, {
    status: "running",
    targetLanguage: "zh-CN",
    sourceSegments: 0,
    translatedSegments: 0,
    asrWorkers: 0,
    translationWorkers: 0,
    total: 4,
    queued: 0,
    asr: 0,
    translating: 1,
    completed: 2,
    warnings: 1,
    failed: 1,
    done: 3
  });
  assert.equal(ledger.activeKey, "42:https://example.test/watch/1");
  assert.equal(ledger.schemaVersion, 4);
  assert.equal(ledger.executionSpec.fingerprint, "a".repeat(64));
  assert.equal(ledger.executionSpec.apiKey, undefined);
  assert.deepEqual(ledger.asrCapabilities, {
    supportedRequestFields: ["vad_filter", "no_speech_threshold"],
    speechTimestampsEndpoint: "https://asr.example.test/v1/audio/speech/timestamps"
  });
  assert.equal(ledger.source.identity, "https://media.example.test/video.m3u8");
  assert.equal(ledger.source.frameId, 7);
  assert.equal(ledger.source.documentId, "document-a");
  assert.equal(ledger.source.lineageKey, "asr:https://example.test/watch/1:/video.m3u8");
  const nullFrameLedger = FuguangJobContract.createJobLedgerEntry({
    ...record,
    presentationBinding: { frameId: null, documentId: "", lineageKey: "" }
  }, { pageIdentity: "https://example.test/watch/1" });
  assert.equal(nullFrameLedger.source.frameId, null, "a missing legacy frame must not be coerced to main frame 0");
  const serialized = JSON.stringify(ledger);
  assert.match(ledger.error, /\[REDACTED\]/);
  for (const forbidden of ["custom-asr-credential-value", "custom-translation-credential-value", "must-never-persist", "secret-header", "signed-token", "chunkStatuses", "transcript", "vttText"]) {
    assert.equal(serialized.includes(forbidden), false, `ledger must not include ${forbidden}`);
  }
});

test("chunk ledger preserves resumable text and accepts only internal cache references", () => {
  const record = {
    runToken: "run-a",
    modelConfig: {
      asr: { apiKey: "custom-non-sk-asr-value" },
      translation: { apiKey: "custom-non-sk-translation-value" }
    },
    audioChunks: [
      {
        index: 0,
        asrExecutionMode: "offscreen-durable-v1",
        asrError: "provider rejected custom-non-sk-asr-value",
        speechIntervals: [{ start: 4, end: 7 }, { start: 1, end: 2 }, { start: 3, end: 3 }],
        speechIntervalsReliable: true,
        file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/0.mp3?ignored=1" }
      },
      {
        index: 1,
        speechIntervals: [],
        speechIntervalsReliable: false,
        file: { cacheUrl: "https://cdn.example.test/audio.mp3?token=secret" }
      }
    ],
    browserAsrDiagnosticsByChunk: new Map([[0, {
      request: {
        endpoint: "https://asr.example.test/v1/audio/transcriptions?api_key=query-secret",
        fields: [["model", "whisper-1"], ["authorization", "Bearer field-secret"], ["api_key", "field-secret"], ["file", "binary-secret"]]
      },
      rawPayload: { error: { message: "Invalid API key custom-non-sk-asr-value" }, apiKey: "payload-secret" },
      error: { stage: "asr_request", status: 500, message: "api_key=custom-non-sk-asr-value" },
      unknownSection: { secret: "must-not-persist" },
      finalSegments: Array.from({ length: 500 }, (_, index) => ({ start: index, end: index + 1, text: "x".repeat(1000) }))
    }]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "hello", rawSegment: { secret: true } }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "你好", providerResponse: "secret" }]]]),
    job: {
      id: "job-a",
      runToken: "run-a",
      updatedAt: 200,
      translation: {
        chunkStatuses: [
          {
            index: 0,
            stage: "completed",
            message: "provider echoed custom-non-sk-asr-value",
            error: "translation rejected custom-non-sk-translation-value",
            updatedAt: 190
          },
          { index: 1, stage: "queued", updatedAt: 195 }
        ]
      }
    }
  };

  const chunks = FuguangJobContract.createChunkLedgerEntries(record);
  assert.equal(chunks.length, 4);
  const groups = chunks.filter(entry => entry.entryType === "translation-group");
  const audio = chunks.filter(entry => entry.entryType === "audio-chunk");
  assert.equal(groups[0].key, "job-a:run-a:translation-group:0");
  assert.equal(audio[0].audioCacheRef, "https://fuguang.local/__fuguang_audio_cache/job-a/0.mp3");
  assert.deepEqual(audio[0].speechIntervals, [{ start: 1, end: 2 }, { start: 4, end: 7 }]);
  assert.equal(audio[0].speechIntervalsReliable, true);
  assert.deepEqual(audio[1].speechIntervals, []);
  assert.equal(audio[1].speechIntervalsReliable, false);
  assert.deepEqual(groups[0].sourceSegments[0], {
    start: 0,
    end: 1,
    text: "hello",
    chunkIndex: 0,
    segmentIndex: 0,
    speaker: "",
    translationFailed: false
  });
  assert.equal(audio[1].audioCacheRef, "");
  assert.deepEqual(audio[0].asrDiagnostics.request.fields, [["model", "whisper-1"]]);
  assert.equal(audio[0].asrDiagnostics.request.endpoint, "https://asr.example.test/v1/audio/transcriptions");
  assert.equal(audio[0].asrDiagnostics.rawPayload.apiKey, undefined);
  assert.equal(audio[0].asrDiagnostics.unknownSection, undefined);
  assert.match(audio[0].asrError, /\[REDACTED\]/);
  assert.match(groups[0].message, /\[REDACTED\]/);
  assert.match(groups[0].error, /\[REDACTED\]/);
  assert.equal(JSON.stringify(audio[0].asrDiagnostics).length <= 65_536, true);
  assert.equal(JSON.stringify(chunks).includes("providerResponse"), false);
  assert.equal(JSON.stringify(chunks).includes("token=secret"), false);
  for (const forbidden of ["custom-non-sk-asr-value", "custom-non-sk-translation-value", "query-secret", "field-secret", "binary-secret", "payload-secret", "must-not-persist"]) {
    assert.equal(JSON.stringify(chunks).includes(forbidden), false, `ASR diagnostics must not persist ${forbidden}`);
  }
});

test("ASR diagnostics enforce the final serialized hard limit against structural overhead", () => {
  const dense = {};
  for (let outer = 0; outer < 100; outer += 1) {
    dense[`k${outer}`] = Object.fromEntries(
      Array.from({ length: 100 }, (_, inner) => [`v${inner}`, ""])
    );
  }
  dense.apiKey = "must-not-persist";
  dense.headers = { authorization: "Bearer must-not-persist" };
  const sanitized = FuguangJobContract.sanitizeAsrDiagnostics({
    request: { fields: [["model", "whisper"], ["cancel_token", "must-not-persist"]] },
    rawPayload: dense,
    finalSegments: Array.from({ length: 200 }, (_, index) => ({ start: index, end: index + 1, text: "" }))
  });
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.length <= 60_000, true, `serialized diagnostics used ${serialized.length} characters`);
  assert.equal(sanitized.truncated, true);
  assert.equal(serialized.includes("must-not-persist"), false);
  assert.deepEqual(sanitized.request.fields, [["model", "whisper"]]);
});

test("durable segment round-trip preserves only valid optional speaker metadata", () => {
  const record = {
    runToken: "run-a",
    sourceSegmentsByChunk: new Map([[0, [
      {
        start: 0,
        end: 1,
        text: "speaker zero",
        speakerId: 0,
        speakerLabel: "分段 1 · 说话人 1",
        unknownField: "must not persist"
      },
      {
        start: 1,
        end: 2,
        text: "invalid metadata",
        speakerId: Number.POSITIVE_INFINITY,
        speakerLabel: { text: "must not persist" },
        anotherUnknownField: true
      },
      {
        start: 2,
        end: 3,
        text: "legacy segment",
        speaker: "legacy speaker"
      }
    ]]]),
    translatedSegmentsByChunk: new Map([[0, [{
      start: 0,
      end: 1,
      text: "说话人零",
      speakerId: 0,
      speakerLabel: "分段 1 · 说话人 1"
    }]]]),
    job: {
      id: "job-a",
      runToken: "run-a",
      updatedAt: 200,
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "completed",
          updatedAt: 190
        }]
      }
    }
  };

  const restored = JSON.parse(JSON.stringify(
    FuguangJobContract.createChunkLedgerEntries(record)
  ));
  const group = restored.find(entry => entry.entryType === "translation-group");

  assert.equal(group.sourceSegments[0].speakerId, 0);
  assert.equal(group.sourceSegments[0].speakerLabel, "分段 1 · 说话人 1");
  assert.equal(Object.hasOwn(group.sourceSegments[0], "unknownField"), false);
  assert.equal(Object.hasOwn(group.sourceSegments[1], "speakerId"), false);
  assert.equal(Object.hasOwn(group.sourceSegments[1], "speakerLabel"), false);
  assert.equal(Object.hasOwn(group.sourceSegments[1], "anotherUnknownField"), false);
  assert.equal(group.sourceSegments[2].speaker, "legacy speaker");
  assert.equal(Object.hasOwn(group.sourceSegments[2], "speakerId"), false);
  assert.equal(Object.hasOwn(group.sourceSegments[2], "speakerLabel"), false);
  assert.equal(group.translatedSegments[0].speakerId, 0);
  assert.equal(group.translatedSegments[0].speakerLabel, "分段 1 · 说话人 1");
});

test("translation group persists only the recognized durable offscreen execution marker", () => {
  const base = {
    runToken: "run-marker",
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "source" }]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "job-marker",
      runToken: "run-marker",
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "translation",
          translationExecutionMode: "offscreen-durable-v1"
        }]
      }
    }
  };
  const accepted = FuguangJobContract.createChunkLedgerEntries(base)
    .find(entry => entry.entryType === "translation-group");
  assert.equal(accepted.translationExecutionMode, "offscreen-durable-v1");
  base.job.translation.chunkStatuses[0].translationExecutionMode = "arbitrary-mode";
  const rejected = FuguangJobContract.createChunkLedgerEntries(base)
    .find(entry => entry.entryType === "translation-group");
  assert.equal(rejected.translationExecutionMode, "");
});

test("job ledger persists only the explicit retry asset-preservation marker", () => {
  const marked = FuguangJobContract.createJobLedgerEntry({
    preserveExistingOnCancel: true,
    job: { id: "job-retry", runToken: "run-retry", status: "running", stage: "retrying", updatedAt: 1, translation: {} }
  });
  assert.equal(marked.preserveExistingOnCancel, true);
  const initial = FuguangJobContract.createJobLedgerEntry({
    job: { id: "job-initial", runToken: "run-initial", status: "running", stage: "asr", updatedAt: 1, translation: {} }
  });
  assert.equal(initial.preserveExistingOnCancel, false);
});

test("chunk ledger keeps translation groups separate from audio chunks", () => {
  const record = {
    runToken: "run-a",
    audioChunks: [
      {
        index: 0,
        asrExecutionMode: "offscreen-durable-v1",
        start: 0,
        end: 30,
        coreStart: 0,
        coreEnd: 30,
        file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/audio-0.mp3" }
      },
      {
        index: 1,
        asrExecutionMode: "arbitrary-mode",
        start: 30,
        end: 60,
        coreStart: 30,
        coreEnd: 60,
        file: {
          parts: [
            { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1a.mp3" } },
            { file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1b.mp3" } }
          ]
        }
      }
    ],
    browserAsrChunkToTranslationGroup: new Map([[0, 0], [1, 0]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "hello" }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "你好" }]]]),
    job: {
      id: "job-a",
      runToken: "run-a",
      updatedAt: 200,
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "completed",
          updatedAt: 190,
          expectedAudioChunkIndexes: [0, 1],
          asrRequired: true
        }]
      }
    }
  };

  const entries = FuguangJobContract.createChunkLedgerEntries(record);
  const groups = entries.filter(entry => entry.entryType === "translation-group");
  const audio = entries.filter(entry => entry.entryType === "audio-chunk");

  assert.equal(groups.length, 1);
  assert.equal(audio.length, 2);
  assert.equal(groups[0].key, "job-a:run-a:translation-group:0");
  assert.deepEqual(audio.map(entry => entry.translationGroupIndex), [0, 0]);
  assert.equal(audio[0].asrExecutionMode, "offscreen-durable-v1");
  assert.equal(audio[1].asrExecutionMode, "");
  assert.deepEqual(groups[0].expectedAudioChunkIndexes, [0, 1]);
  assert.equal(groups[0].asrRequired, true);
  assert.deepEqual(audio[1].audioCacheRefs, [
    "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1a.mp3",
    "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1b.mp3"
  ]);
  assert.deepEqual(groups[0].sourceSegments.map(segment => segment.text), ["hello"]);
  assert.deepEqual(groups[0].translatedSegments.map(segment => segment.text), ["你好"]);
  assert.equal(audio.some(entry => entry.sourceSegments?.length || entry.translatedSegments?.length), false);

  record.audioChunks = record.audioChunks.slice(0, 1);
  const afterReconcile = FuguangJobContract.createChunkLedgerEntries(record)
    .find(entry => entry.entryType === "translation-group");
  assert.deepEqual(afterReconcile.expectedAudioChunkIndexes, [0, 1],
    "the durable expected membership must not shrink when a cached audio row is reconciled away");
});

test("terminal jobs have no active key and identifiers are injectable", () => {
  assert.equal(FuguangJobContract.createJobId(() => "job-uuid"), "job-uuid");
  assert.equal(FuguangJobContract.createRunToken(() => "run-uuid"), "run-uuid");
  assert.equal(FuguangJobContract.isTerminalStatus("completed"), true);
  assert.equal(FuguangJobContract.isTerminalStatus("running"), false);
  const summary = FuguangJobContract.createJobSummary({
    tabId: 1,
    runToken: "run-a",
    job: { id: "job-a", status: "completed", createdAt: 1, updatedAt: 2 }
  }, { pageIdentity: "https://example.test/watch" });
  assert.equal(summary.activeKey, "");
});

test("job ledger persists verified audio availability and only internal removal tombstones", () => {
  const entry = FuguangJobContract.createJobLedgerEntry({
    runToken: "run-a",
    job: {
      id: "job-a",
      runToken: "run-a",
      status: "completed",
      updatedAt: 200,
      reusableAudioChunks: 0,
      audioCacheRemoved: true,
      audioCacheRemovedCount: 2,
      audioCacheVerified: true,
      audioCacheVerifiedAt: 190,
      audioCacheRemovedRefs: [
        "https://fuguang.local/__fuguang_audio_cache/job-a/one.mp3",
        "https://attacker.example/audio.mp3"
      ]
    }
  });

  assert.equal(entry.audioCacheRemoved, true);
  assert.equal(entry.audioCacheRemovedCount, 2);
  assert.equal(entry.audioCacheVerified, true);
  assert.equal(entry.audioCacheVerifiedAt, 190);
  assert.deepEqual(entry.audioCacheRemovedRefs, [
    "https://fuguang.local/__fuguang_audio_cache/job-a/one.mp3"
  ]);
});

test("operation contract persists only resumable request metadata and removes secrets", () => {
  const operation = FuguangJobContract.sanitizeOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "asr-coverage-0",
    provider: "funasr",
    operationType: "asr-coverage-retry",
    inputHash: "sha256:abc",
    batchStart: 0,
    batchEnd: 2,
    state: "accepted",
    providerRequestId: "request-1",
    remoteTaskId: "task-123",
    submittedAt: 100,
    retryAllowed: false,
    definitelyNotAccepted: false,
    resultSummary: "accepted",
    result: {
      status: "queued",
      transcriptUrl: "https://provider.example/result/1?token=secret-query",
      headers: { authorization: "Bearer secret-header" },
      apiKey: "sk-secret",
      nested: { count: 2, secret: "nested-secret", accessToken: "nested-access-token" }
    },
    requestHeaders: { authorization: "Bearer top-level-secret" },
    apiKey: "top-level-key",
    arbitrary: "must-not-persist"
  });

  assert.deepEqual({
    key: operation.key,
    jobRunKey: operation.jobRunKey,
    jobId: operation.jobId,
    runToken: operation.runToken,
    operationId: operation.operationId
  }, {
    key: "job-a:run-a:operation:asr-coverage-0",
    jobRunKey: "job-a:run-a",
    jobId: "job-a",
    runToken: "run-a",
    operationId: "asr-coverage-0"
  });
  assert.equal(operation.remoteTaskId, "task-123");
  assert.equal(operation.result.transcriptUrl, "https://provider.example/result/1");
  assert.deepEqual(operation.result.nested, { count: 2 });
  for (const field of ["requestHeaders", "apiKey", "arbitrary"]) {
    assert.equal(Object.hasOwn(operation, field), false);
  }
  const serialized = JSON.stringify(operation);
  for (const forbidden of ["secret-query", "secret-header", "sk-secret", "nested-secret", "nested-access-token", "top-level-secret", "top-level-key", "must-not-persist"]) {
    assert.equal(serialized.includes(forbidden), false, `operation must not include ${forbidden}`);
  }
});

test("operation contract accepts only internal query-free paid response references", () => {
  const accepted = FuguangJobContract.sanitizeOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "paid-1",
    state: "completed",
    resultRef: "https://fuguang.local/__fuguang_operation_results/job-a/random-id",
    resultBytes: 42_000,
    resultHash: "sha256:abc",
    status: 500,
    statusText: "Internal Server Error",
    contentType: "application/json"
  });
  assert.equal(accepted.resultRef, "https://fuguang.local/__fuguang_operation_results/job-a/random-id");
  assert.equal(accepted.resultBytes, 42_000);
  assert.equal(accepted.status, 500);

  const rejected = FuguangJobContract.sanitizeOperation({
    jobId: "job-a",
    runToken: "run-a",
    operationId: "paid-2",
    resultRef: "https://fuguang.local/__fuguang_operation_results/job-a/id?token=secret"
  });
  assert.equal(rejected.resultRef, "");
});

test("cleanup claim contract keeps only exact internal refs and retirement metadata", () => {
  const claim = FuguangJobContract.sanitizeCleanupClaim({
    jobId: "job-a",
    runToken: "run-a",
    expectedUpdatedAt: 123,
    state: "pending",
    createdAt: 456,
    resultRefs: [
      "https://fuguang.local/__fuguang_operation_results/job-a/run-a/paid%3Aone",
      "https://fuguang.local/__fuguang_operation_results/job-a/run-a/paid%3Aone",
      "https://provider.example/result?api_key=secret",
      "https://fuguang.local/__fuguang_operation_results/job-a/run-a/two?token=secret"
    ],
    apiKey: "must-not-persist",
    headers: { authorization: "Bearer secret" },
    arbitrary: "must-not-persist"
  });
  assert.deepEqual(claim.resultRefs, [
    "https://fuguang.local/__fuguang_operation_results/job-a/run-a/paid%3Aone"
  ]);
  assert.equal(claim.key, "job-a:run-a:cleanup:123");
  assert.equal(claim.jobRunKey, "job-a:run-a");
  assert.equal(claim.state, "pending");
  const serialized = JSON.stringify(claim);
  for (const forbidden of ["must-not-persist", "authorization", "apiKey", "provider.example", "token=secret"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
