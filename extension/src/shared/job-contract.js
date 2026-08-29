export const FuguangJobContract = (() => {
  const JOB_SCHEMA_VERSION = 3;
  const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
  const INTERNAL_CACHE_ORIGIN = "https://fuguang.local";

  function createJobId(randomUUID = defaultRandomUUID) {
    return String(randomUUID()).trim();
  }

  function createRunToken(randomUUID = defaultRandomUUID) {
    return String(randomUUID()).trim();
  }

  function defaultRandomUUID() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof globalThis.crypto?.getRandomValues !== "function") {
      throw new Error("Web Crypto randomUUID is unavailable.");
    }
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  function isTerminalStatus(status) {
    return TERMINAL_STATUSES.has(String(status || ""));
  }

  function activeJobKey(tabId, pageIdentity) {
    const numericTabId = Number(tabId);
    const page = String(pageIdentity || "").trim();
    return Number.isInteger(numericTabId) && numericTabId >= 0 && page
      ? `${numericTabId}:${page}`
      : "";
  }

  function chunkKey(jobId, runToken, index, entryType = "") {
    const prefix = `${String(jobId || "")}:${String(runToken || "")}`;
    const normalizedIndex = Math.max(0, Number(index) || 0);
    return entryType
      ? `${prefix}:${String(entryType)}:${normalizedIndex}`
      : `${prefix}:${normalizedIndex}`;
  }

  function jobRunKey(jobId, runToken) {
    return `${String(jobId || "")}:${String(runToken || "")}`;
  }

  function deriveTranslationSummary(job = {}) {
    const translation = job.translation || {};
    const statuses = Array.isArray(translation.chunkStatuses) ? translation.chunkStatuses.filter(Boolean) : [];
    const declaredTotal = nonNegativeInteger(translation.chunksTotal || translation.chunkCount);
    const total = Math.max(declaredTotal, statuses.length);
    const summary = {
      total,
      queued: 0,
      asr: 0,
      translating: 0,
      completed: 0,
      warnings: 0,
      failed: 0,
      done: 0
    };
    for (const status of statuses) {
      const stage = String(status?.stage || "queued");
      if (stage === "asr") {
        summary.asr += 1;
      } else if (stage === "translation") {
        summary.translating += 1;
      } else if (stage === "completed") {
        summary.completed += 1;
      } else if (stage === "completed_with_warnings") {
        summary.completed += 1;
        summary.warnings += 1;
      } else if (stage === "failed") {
        summary.failed += 1;
      } else {
        summary.queued += 1;
      }
    }
    summary.queued += Math.max(0, total - statuses.length);
    summary.done = summary.completed + summary.failed;
    return summary;
  }

  function createJobSummary(record = {}, options = {}) {
    const job = record.job || record;
    const tabId = Number(options.tabId ?? record.tabId);
    const pageIdentity = String(options.pageIdentity || "");
    const runToken = String(record.runToken || job.runToken || "");
    const translationSummary = deriveTranslationSummary(job);
    const extract = job.extract || {};
    const translation = job.translation || {};
    return {
      schemaVersion: JOB_SCHEMA_VERSION,
      id: String(job.id || ""),
      runToken,
      pipeline: String(job.pipeline || record.pipeline || "browser"),
      status: String(job.status || "queued"),
      stage: String(job.stage || "queued"),
      tabId: Number.isInteger(tabId) ? tabId : null,
      pageIdentity,
      activeKey: isTerminalStatus(job.status) ? "" : activeJobKey(tabId, pageIdentity),
      cancelRequested: Boolean(record.cancelRequested || job.cancelRequested),
      createdAt: finiteTimestamp(job.createdAt || record.startedAt),
      updatedAt: finiteTimestamp(job.updatedAt || Date.now()),
      error: compactText(job.error, 1000),
      extract: {
        status: String(extract.status || ""),
        phase: String(extract.phase || ""),
        progress: finiteNumber(extract.progress),
        chunkCount: nonNegativeInteger(extract.chunkCount),
        chunkSeconds: finiteNumber(extract.chunkSeconds),
        asrChunkSeconds: finiteNumber(extract.asrChunkSeconds),
        bitrate: String(extract.bitrate || ""),
        availableSeconds: finiteNumber(extract.availableSeconds),
        duration: finiteNumberOrNull(extract.duration),
        elapsedSeconds: finiteNumber(extract.elapsedSeconds)
      },
      translation: {
        status: String(translation.status || ""),
        targetLanguage: String(translation.targetLanguage || record.modelConfig?.targetLanguage || ""),
        sourceSegments: nonNegativeInteger(translation.sourceSegments),
        translatedSegments: nonNegativeInteger(translation.translatedSegments),
        asrWorkers: nonNegativeInteger(translation.asrWorkers),
        translationWorkers: nonNegativeInteger(translation.translationWorkers || translation.workers),
        ...translationSummary
      }
    };
  }

  function createJobLedgerEntry(record = {}, options = {}) {
    const summary = createJobSummary(record, options);
    const job = record.job || record;
    const candidate = record.candidate || {};
    return {
      ...summary,
      executionSpec: sanitizeExecutionSpec(record.modelConfig?.executionSpec || job.executionSpec),
      source: {
        kind: String(candidate.kind || ""),
        ext: String(candidate.ext || ""),
        identity: safeUrlIdentity(job.sourceUrl || job.source || candidate.url)
      },
      cacheNamespace: String(job.id || "")
    };
  }

  function sanitizeExecutionSpec(spec = {}) {
    const fingerprint = compactText(spec.fingerprint, 128);
    if (!fingerprint) {
      return null;
    }
    return {
      version: Math.max(1, nonNegativeInteger(spec.version) || 1),
      asrProfileId: compactText(spec.asrProfileId, 200),
      llmProfileId: compactText(spec.llmProfileId, 200),
      sourceLanguage: compactText(spec.sourceLanguage, 50),
      targetLanguage: compactText(spec.targetLanguage, 50),
      webFfmpegPerformance: compactText(spec.webFfmpegPerformance, 50),
      asrWorkers: nonNegativeInteger(spec.asrWorkers),
      translationWorkers: nonNegativeInteger(spec.translationWorkers),
      chunkMinutes: nonNegativeInteger(spec.chunkMinutes),
      fingerprint
    };
  }

  function createChunkLedgerEntries(record = {}) {
    const job = record.job || record;
    const jobId = String(job.id || "");
    const runToken = String(record.runToken || job.runToken || "");
    if (!jobId || !runToken) {
      return [];
    }
    const statuses = Array.isArray(job.translation?.chunkStatuses) ? job.translation.chunkStatuses : [];
    const statusByIndex = new Map(statuses.map((status, index) => [nonNegativeInteger(status?.index ?? index), status]));
    const groupIndexes = new Set(statusByIndex.keys());
    for (const index of record.sourceSegmentsByChunk?.keys?.() || []) {
      groupIndexes.add(nonNegativeInteger(index));
    }
    for (const index of record.translatedSegmentsByChunk?.keys?.() || []) {
      groupIndexes.add(nonNegativeInteger(index));
    }
    const translationGroups = [...groupIndexes].sort((left, right) => left - right).map(index => {
      const status = statusByIndex.get(index) || {};
      return {
        key: chunkKey(jobId, runToken, index, "translation-group"),
        jobRunKey: jobRunKey(jobId, runToken),
        jobId,
        runToken,
        entryType: "translation-group",
        index,
        stage: String(status.stage || "queued"),
        status: compactText(status.status, 100),
        attempts: nonNegativeInteger(status.attempts),
        sourceCount: nonNegativeInteger(status.sourceCount),
        translatedCount: nonNegativeInteger(status.translatedCount),
        asrFailures: nonNegativeInteger(status.asrFailures || status.asr_failures),
        translationFailures: nonNegativeInteger(status.translationFailures),
        message: compactText(status.message, 1000),
        error: compactText(status.error, 1000),
        updatedAt: finiteTimestamp(status.updatedAt || job.updatedAt || Date.now()),
        sourceSegments: sanitizeSegments(record.sourceSegmentsByChunk?.get?.(index)),
        translatedSegments: sanitizeSegments(record.translatedSegmentsByChunk?.get?.(index))
      };
    });
    const audioChunks = (record.audioChunks || [])
      .map((audio, fallbackIndex) => {
        const index = nonNegativeInteger(audio?.index ?? fallbackIndex);
        const audioParts = internalAudioParts(audio?.file);
        const audioCacheRefs = audioParts.map(part => part.cacheRef);
        const mappedGroupIndex = record.browserAsrChunkToTranslationGroup?.get?.(index);
        const translationGroupIndex = nonNegativeInteger(
          mappedGroupIndex ?? audio?.translationGroupIndex ?? index
        );
        return {
          key: chunkKey(jobId, runToken, index, "audio-chunk"),
          jobRunKey: jobRunKey(jobId, runToken),
          jobId,
          runToken,
          entryType: "audio-chunk",
          index,
          translationGroupIndex,
          updatedAt: finiteTimestamp(audio?.updatedAt || job.updatedAt || Date.now()),
          audioCacheRef: audioCacheRefs[0] || "",
          audioCacheRefs,
          audioParts,
          audioStart: finiteNumber(audio?.start),
          audioEnd: finiteNumber(audio?.end),
          audioDuration: finiteNumber(audio?.duration),
          audioCoreStart: finiteNumber(audio?.coreStart),
          audioCoreEnd: finiteNumber(audio?.coreEnd),
          asrCompleted: Boolean(audio?.asrCompleted),
          asrFailed: Boolean(audio?.asrFailed),
          asrError: compactText(audio?.asrError, 1000),
          sourceSegments: sanitizeSegments(audio?.sourceSegments)
        };
      })
      .sort((left, right) => left.index - right.index);
    return [...translationGroups, ...audioChunks];
  }

  function internalAudioParts(file = {}) {
    const rawParts = Array.isArray(file?.parts) && file.parts.length
      ? file.parts
      : [{ file }];
    return rawParts.map((part, index) => {
      const cacheRef = internalCacheRef(part?.file?.cacheUrl || part?.cacheUrl);
      if (!cacheRef) {
        return null;
      }
      return {
        index: nonNegativeInteger(part?.index ?? index),
        cacheRef,
        start: finiteNumber(part?.start),
        end: finiteNumber(part?.end),
        duration: finiteNumber(part?.duration),
        coreStart: finiteNumber(part?.coreStart),
        coreEnd: finiteNumber(part?.coreEnd),
        bytes: nonNegativeInteger(part?.bytes || part?.file?.bytes),
        name: compactText(part?.file?.name, 500),
        mime: compactText(part?.file?.mime, 200)
      };
    }).filter(Boolean);
  }

  function sanitizeSegments(segments) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    return segments.map(segment => ({
      start: finiteNumber(segment?.start),
      end: finiteNumber(segment?.end),
      text: compactText(segment?.text, 20000),
      chunkIndex: nonNegativeInteger(segment?.chunkIndex),
      segmentIndex: nonNegativeInteger(segment?.segmentIndex),
      speaker: compactText(segment?.speaker, 200),
      translationFailed: Boolean(segment?.translationFailed)
    }));
  }

  function internalCacheRef(value) {
    const text = String(value || "");
    if (!text) {
      return "";
    }
    try {
      const url = new URL(text);
      return url.origin === INTERNAL_CACHE_ORIGIN && url.pathname.startsWith("/__fuguang_audio_cache/")
        ? `${url.origin}${url.pathname}`
        : "";
    } catch {
      return "";
    }
  }

  function safeUrlIdentity(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    try {
      const url = new URL(text);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return text.split(/[?#]/, 1)[0];
    }
  }

  function compactText(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function finiteNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function finiteTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : Date.now();
  }

  return {
    JOB_SCHEMA_VERSION,
    TERMINAL_STATUSES,
    activeJobKey,
    chunkKey,
    createChunkLedgerEntries,
    createJobId,
    createJobLedgerEntry,
    createJobSummary,
    createRunToken,
    deriveTranslationSummary,
    isTerminalStatus,
    jobRunKey,
    safeUrlIdentity
  };
})();
