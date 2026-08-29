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
    modelConfig: {
      targetLanguage: "zh-CN",
      asr: { apiKey: "sk-secret" },
      translation: { apiKey: "llm-secret" },
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
  assert.equal(ledger.schemaVersion, 3);
  assert.equal(ledger.executionSpec.fingerprint, "a".repeat(64));
  assert.equal(ledger.executionSpec.apiKey, undefined);
  assert.equal(ledger.source.identity, "https://media.example.test/video.m3u8");
  const serialized = JSON.stringify(ledger);
  for (const forbidden of ["sk-secret", "llm-secret", "must-never-persist", "secret-header", "signed-token", "chunkStatuses", "transcript", "vttText"]) {
    assert.equal(serialized.includes(forbidden), false, `ledger must not include ${forbidden}`);
  }
});

test("chunk ledger preserves resumable text and accepts only internal cache references", () => {
  const record = {
    runToken: "run-a",
    audioChunks: [
      { index: 0, file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/0.mp3?ignored=1" } },
      { index: 1, file: { cacheUrl: "https://cdn.example.test/audio.mp3?token=secret" } }
    ],
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "hello", rawSegment: { secret: true } }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "你好", providerResponse: "secret" }]]]),
    job: {
      id: "job-a",
      runToken: "run-a",
      updatedAt: 200,
      translation: {
        chunkStatuses: [
          { index: 0, stage: "completed", updatedAt: 190 },
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
  assert.equal(JSON.stringify(chunks).includes("providerResponse"), false);
  assert.equal(JSON.stringify(chunks).includes("token=secret"), false);
});

test("chunk ledger keeps translation groups separate from audio chunks", () => {
  const record = {
    runToken: "run-a",
    audioChunks: [
      {
        index: 0,
        start: 0,
        end: 30,
        coreStart: 0,
        coreEnd: 30,
        file: { cacheUrl: "https://fuguang.local/__fuguang_audio_cache/job-a/audio-0.mp3" }
      },
      {
        index: 1,
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
        chunkStatuses: [{ index: 0, stage: "completed", updatedAt: 190 }]
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
  assert.deepEqual(audio[1].audioCacheRefs, [
    "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1a.mp3",
    "https://fuguang.local/__fuguang_audio_cache/job-a/audio-1b.mp3"
  ]);
  assert.deepEqual(groups[0].sourceSegments.map(segment => segment.text), ["hello"]);
  assert.deepEqual(groups[0].translatedSegments.map(segment => segment.text), ["你好"]);
  assert.equal(audio.some(entry => entry.sourceSegments?.length || entry.translatedSegments?.length), false);
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
