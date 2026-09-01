export const FuguangJobContract = (() => {
  const JOB_SCHEMA_VERSION = 4;
  const OPERATION_SCHEMA_VERSION = 2;
  const CLEANUP_CLAIM_SCHEMA_VERSION = 1;
  const CLEANUP_CLAIM_STATES = new Set(["pending", "completed"]);
  const OPERATION_STATES = new Set(["prepared", "submitted", "accepted", "completed", "unknown", "failed"]);
  const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
  const INTERNAL_CACHE_ORIGIN = "https://fuguang.local";
  const INTERNAL_OPERATION_RESULT_PREFIX = "/__fuguang_operation_results/";
  const SENSITIVE_RESULT_FIELD = /api.?key|authorization|bearer|cookie|credential|headers?|password|secret|signature|signed.?url|token/i;
  const ASR_DIAGNOSTIC_KEYS = new Set([
    "chunk", "request", "vad", "rawPayload", "normalizedSegments", "speechFilteredSegments",
    "hallucinationFilteredSegments", "finalSegments", "matureAsrPlan", "collectedSpeech",
    "postprocess", "error", "retry", "clipTimestampsAttempt", "emptyVadAttempt", "directAttempt"
  ]);
  const ASR_DIAGNOSTICS_MAX_CHARS = 60_000;

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

  function operationKey(jobId, runToken, operationId) {
    return `${jobRunKey(jobId, runToken)}:operation:${String(operationId || "")}`;
  }

  function cleanupClaimKey(jobId, runToken, expectedUpdatedAt) {
    return `${jobRunKey(jobId, runToken)}:cleanup:${nonNegativeInteger(expectedUpdatedAt)}`;
  }

  function sanitizeCleanupClaim(input = {}) {
    const jobId = compactText(input.jobId, 200).trim();
    const runToken = compactText(input.runToken, 200).trim();
    const expectedUpdatedAt = nonNegativeInteger(input.expectedUpdatedAt);
    const state = CLEANUP_CLAIM_STATES.has(String(input.state || ""))
      ? String(input.state)
      : "pending";
    const resultRefs = [...new Set((Array.isArray(input.resultRefs) ? input.resultRefs : [])
      .map(internalOperationResultRef)
      .filter(Boolean))];
    return {
      schemaVersion: CLEANUP_CLAIM_SCHEMA_VERSION,
      key: cleanupClaimKey(jobId, runToken, expectedUpdatedAt),
      jobRunKey: jobRunKey(jobId, runToken),
      jobId,
      runToken,
      expectedUpdatedAt,
      state,
      resultRefs,
      createdAt: optionalTimestamp(input.createdAt),
      completedAt: state === "completed" ? optionalTimestamp(input.completedAt) : 0
    };
  }

  function sanitizeOperation(input = {}) {
    const jobId = compactText(input.jobId, 200).trim();
    const runToken = compactText(input.runToken, 200).trim();
    const operationId = sanitizeIdentifier(input.operationId, 300);
    const state = OPERATION_STATES.has(String(input.state || ""))
      ? String(input.state)
      : "prepared";
    const result = sanitizeSerializableResult(input.result);
    return {
      schemaVersion: OPERATION_SCHEMA_VERSION,
      key: operationKey(jobId, runToken, operationId),
      jobRunKey: jobRunKey(jobId, runToken),
      jobId,
      runToken,
      operationId,
      provider: sanitizeIdentifier(input.provider, 100),
      operationType: sanitizeIdentifier(input.operationType, 100),
      inputHash: sanitizeIdentifier(input.inputHash, 300),
      batchStart: nonNegativeInteger(input.batchStart),
      batchEnd: nonNegativeInteger(input.batchEnd),
      state,
      claimId: sanitizeIdentifier(input.claimId, 300),
      claimedAt: optionalTimestamp(input.claimedAt),
      claimLeaseExpiresAt: optionalTimestamp(input.claimLeaseExpiresAt),
      providerRequestId: sanitizeIdentifier(input.providerRequestId, 500),
      remoteTaskId: sanitizeIdentifier(input.remoteTaskId, 500),
      submittedAt: optionalTimestamp(input.submittedAt),
      completedAt: optionalTimestamp(input.completedAt),
      resultRef: internalOperationResultRef(input.resultRef),
      resultBytes: nonNegativeInteger(input.resultBytes),
      resultHash: compactText(input.resultHash, 300),
      status: nonNegativeInteger(input.status),
      statusText: compactText(input.statusText, 500),
      contentType: compactText(input.contentType, 500),
      resultSummary: sanitizeFreeText(input.resultSummary, 4000),
      ...(result !== undefined ? { result } : {}),
      retryAllowed: Boolean(input.retryAllowed),
      definitelyNotAccepted: Boolean(input.definitelyNotAccepted),
      error: sanitizeFreeText(input.error, 4000),
      preparedAt: optionalTimestamp(input.preparedAt),
      updatedAt: optionalTimestamp(input.updatedAt)
    };
  }

  function sanitizeSerializableResult(value, depth = 0, seen = new WeakSet()) {
    if (value == null || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      return sanitizeFreeText(value, 20000);
    }
    if (typeof value !== "object" || depth >= 8 || seen.has(value)) {
      return undefined;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      return value.slice(0, 2000)
        .map(item => sanitizeSerializableResult(item, depth + 1, seen))
        .filter(item => item !== undefined);
    }
    const output = {};
    for (const [rawKey, rawValue] of Object.entries(value).slice(0, 500)) {
      const key = compactText(rawKey, 200);
      if (!key || key === "__proto__" || key === "prototype" || key === "constructor" || SENSITIVE_RESULT_FIELD.test(key)) {
        continue;
      }
      const sanitized = sanitizeSerializableResult(rawValue, depth + 1, seen);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }
    return output;
  }

  function sanitizeAsrDiagnostics(input, knownSecrets = []) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const secrets = [...new Set((Array.isArray(knownSecrets) ? knownSecrets : [knownSecrets])
      .map(value => String(value || ""))
      .filter(Boolean))]
      .sort((left, right) => right.length - left.length);
    const output = {};
    let truncated = false;
    const truncatedMarkerReserve = serializedJsonLength({ truncated: true }) + 1;
    for (const key of ASR_DIAGNOSTIC_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      const propertyOverhead = (Object.keys(output).length ? 1 : 0) + serializedJsonLength(key) + 1;
      const available = ASR_DIAGNOSTICS_MAX_CHARS
        - serializedJsonLength(output)
        - propertyOverhead
        - truncatedMarkerReserve;
      if (available < 2) {
        truncated = true;
        continue;
      }
      const result = sanitizeDiagnosticValue(input[key], available, 0, new WeakSet(), secrets);
      truncated ||= result.truncated;
      if (result.value === undefined) continue;
      output[key] = result.value;
      if (serializedJsonLength(output) + truncatedMarkerReserve > ASR_DIAGNOSTICS_MAX_CHARS) {
        delete output[key];
        truncated = true;
      }
    }
    if (truncated) output.truncated = true;
    while (serializedJsonLength(output) > ASR_DIAGNOSTICS_MAX_CHARS) {
      const removable = Object.keys(output).filter(key => key !== "truncated").at(-1);
      if (!removable) return { truncated: true };
      delete output[removable];
      output.truncated = true;
    }
    return Object.keys(output).length ? output : null;
  }

  function sanitizeDiagnosticValue(value, maxChars, depth, seen, knownSecrets = []) {
    if (maxChars <= 0 || depth > 6) return { value: undefined, truncated: true };
    if (value == null || typeof value === "boolean") {
      return serializedJsonLength(value) <= maxChars
        ? { value, truncated: false }
        : { value: undefined, truncated: true };
    }
    if (typeof value === "number") {
      const normalized = Number.isFinite(value) ? value : null;
      return serializedJsonLength(normalized) <= maxChars
        ? { value: normalized, truncated: false }
        : { value: undefined, truncated: true };
    }
    if (typeof value === "string") {
      const text = sanitizeKnownCredentialText(value, 4000, knownSecrets);
      if (serializedJsonLength(text) <= maxChars) return { value: text, truncated: text.length < String(value).length };
      let low = 0;
      let high = text.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (serializedJsonLength(text.slice(0, middle)) <= maxChars) low = middle;
        else high = middle - 1;
      }
      return low || maxChars >= 2
        ? { value: text.slice(0, low), truncated: true }
        : { value: undefined, truncated: true };
    }
    if (typeof value !== "object" || seen.has(value) || maxChars < 2) {
      return { value: undefined, truncated: Boolean(value && typeof value === "object") };
    }
    seen.add(value);
    if (Array.isArray(value)) {
      const output = [];
      let truncated = value.length > 200;
      for (const item of value.slice(0, 200)) {
        const available = maxChars - serializedJsonLength(output) - (output.length ? 1 : 0);
        const result = sanitizeDiagnosticValue(item, available, depth + 1, seen, knownSecrets);
        truncated ||= result.truncated;
        if (result.value === undefined) {
          truncated = true;
          break;
        }
        output.push(result.value);
        if (serializedJsonLength(output) > maxChars) {
          output.pop();
          truncated = true;
          break;
        }
      }
      seen.delete(value);
      return { value: output, truncated };
    }
    const output = {};
    const entries = Object.entries(value);
    let truncated = entries.length > 100;
    for (const [rawKey, rawValue] of entries.slice(0, 100)) {
      const key = compactText(rawKey, 100);
      if (!key || key === "__proto__" || key === "prototype" || key === "constructor" || SENSITIVE_RESULT_FIELD.test(key)) continue;
      const propertyOverhead = (Object.keys(output).length ? 1 : 0) + serializedJsonLength(key) + 1;
      const available = maxChars - serializedJsonLength(output) - propertyOverhead;
      const result = key === "fields" && Array.isArray(rawValue)
        ? sanitizeDiagnosticFields(rawValue, available, depth + 1, seen, knownSecrets)
        : sanitizeDiagnosticValue(rawValue, available, depth + 1, seen, knownSecrets);
      truncated ||= result.truncated;
      if (result.value === undefined) {
        truncated = true;
        break;
      }
      output[key] = result.value;
      if (serializedJsonLength(output) > maxChars) {
        delete output[key];
        truncated = true;
        break;
      }
    }
    seen.delete(value);
    return { value: output, truncated };
  }

  function sanitizeDiagnosticFields(fields, maxChars, depth, seen, knownSecrets = []) {
    const filtered = [];
    let truncated = fields.length > 100;
    for (const field of fields.slice(0, 100)) {
      if (!Array.isArray(field) || field.length < 2) continue;
      const name = compactText(field[0], 100);
      if (!name || name === "file" || SENSITIVE_RESULT_FIELD.test(name)) continue;
      filtered.push([name, field[1]]);
    }
    const result = sanitizeDiagnosticValue(filtered, maxChars, depth, seen, knownSecrets);
    return { value: result.value, truncated: truncated || result.truncated };
  }

  function redactKnownDiagnosticSecrets(value, knownSecrets = []) {
    let output = String(value || "");
    for (const secret of knownSecrets) {
      output = output.split(secret).join("[REDACTED]");
    }
    return output;
  }

  function serializedJsonLength(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function sanitizeIdentifier(value, maxLength) {
    const text = compactText(value, maxLength).trim();
    return /^https?:\/\//i.test(text) ? safeUrlIdentity(text) : text;
  }

  function sanitizeFreeText(value, maxLength) {
    return compactText(value, maxLength)
      .replace(/https?:\/\/[^\s"'<>]+/gi, url => safeUrlIdentity(url))
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]");
  }

  function optionalTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function internalOperationResultRef(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    try {
      const url = new URL(text);
      if (url.origin !== INTERNAL_CACHE_ORIGIN ||
          !url.pathname.startsWith(INTERNAL_OPERATION_RESULT_PREFIX) ||
          url.pathname.length <= INTERNAL_OPERATION_RESULT_PREFIX.length ||
          url.search ||
          url.hash ||
          url.username ||
          url.password) {
        return "";
      }
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
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
    const knownSecrets = knownRecordCredentials(record);
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
      preserveExistingOnCancel: Boolean(record.preserveExistingOnCancel || job.preserveExistingOnCancel),
      subtitleCleared: Boolean(job.subtitleCleared),
      createdAt: finiteTimestamp(job.createdAt || record.startedAt),
      updatedAt: finiteTimestamp(job.updatedAt || Date.now()),
      error: sanitizeKnownCredentialText(job.error, 1000, knownSecrets),
      reusableAudioChunks: nonNegativeInteger(job.reusableAudioChunks || translation.reusableAudioChunks),
      audioCacheRemoved: Boolean(job.audioCacheRemoved),
      audioCacheRemovedCount: nonNegativeInteger(job.audioCacheRemovedCount),
      audioCacheVerified: Boolean(job.audioCacheVerified),
      audioCacheVerifiedAt: optionalTimestamp(job.audioCacheVerifiedAt),
      audioCacheRemovedRefs: sanitizeInternalCacheRefs(job.audioCacheRemovedRefs),
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
    const presentationBinding = record.presentationBinding || {};
    const asrCapabilities = sanitizeAsrCapabilities(record.asrCapabilities || job.asrCapabilities);
    const rawFrameId = presentationBinding.frameId;
    const frameId = rawFrameId === null || rawFrameId === undefined || rawFrameId === ""
      ? null
      : Number(rawFrameId);
    return {
      ...summary,
      executionSpec: sanitizeExecutionSpec(record.modelConfig?.executionSpec || job.executionSpec),
      ...(asrCapabilities ? { asrCapabilities } : {}),
      source: {
        kind: String(candidate.kind || ""),
        ext: String(candidate.ext || ""),
        identity: safeUrlIdentity(job.sourceUrl || job.source || candidate.url),
        frameId: Number.isInteger(frameId) && frameId >= 0 ? frameId : null,
        documentId: compactText(presentationBinding.documentId, 500).trim(),
        lineageKey: compactText(presentationBinding.lineageKey, 2000).trim()
      },
      cacheNamespace: String(job.id || "")
    };
  }

  function sanitizeAsrCapabilities(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const fields = Array.isArray(value.supportedRequestFields)
      ? value.supportedRequestFields
        .map(item => compactText(item, 200).trim())
        .filter(Boolean)
        .slice(0, 200)
      : [];
    return {
      supportedRequestFields: [...new Set(fields)],
      speechTimestampsEndpoint: compactText(value.speechTimestampsEndpoint, 2000).trim()
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
    const diagnosticSecrets = knownRecordCredentials(record);
    const statusByIndex = new Map(statuses.map((status, index) => [nonNegativeInteger(status?.index ?? index), status]));
    const groupIndexes = new Set(statusByIndex.keys());
    const expectedAudioChunkIndexesByGroup = new Map();
    for (const [fallbackIndex, audio] of (record.audioChunks || []).entries()) {
      const audioIndex = nonNegativeInteger(audio?.index ?? fallbackIndex);
      const mappedGroupIndex = record.browserAsrChunkToTranslationGroup?.get?.(audioIndex);
      const groupIndex = nonNegativeInteger(mappedGroupIndex ?? audio?.translationGroupIndex ?? audioIndex);
      groupIndexes.add(groupIndex);
      const expected = expectedAudioChunkIndexesByGroup.get(groupIndex) || new Set();
      expected.add(audioIndex);
      expectedAudioChunkIndexesByGroup.set(groupIndex, expected);
    }
    for (const index of record.sourceSegmentsByChunk?.keys?.() || []) {
      groupIndexes.add(nonNegativeInteger(index));
    }
    for (const index of record.translatedSegmentsByChunk?.keys?.() || []) {
      groupIndexes.add(nonNegativeInteger(index));
    }
    const translationGroups = [...groupIndexes].sort((left, right) => left - right).map(index => {
      const status = statusByIndex.get(index) || {};
      const expectedAudioChunkIndexes = new Set(
        (Array.isArray(status.expectedAudioChunkIndexes) ? status.expectedAudioChunkIndexes : [])
          .map(nonNegativeInteger)
      );
      for (const audioIndex of expectedAudioChunkIndexesByGroup.get(index) || []) {
        expectedAudioChunkIndexes.add(audioIndex);
      }
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
        expectedAudioChunkIndexes: [...expectedAudioChunkIndexes].sort((left, right) => left - right),
        asrRequired: Boolean(status.asrRequired),
        asrFailures: nonNegativeInteger(status.asrFailures || status.asr_failures),
        translationFailures: nonNegativeInteger(status.translationFailures),
        translationErrorStatus: nonNegativeInteger(status.translationErrorStatus),
        translationErrorCode: compactText(status.translationErrorCode, 100),
        translationDeliveryAmbiguous: Boolean(status.translationDeliveryAmbiguous),
        translationExecutionMode: status.translationExecutionMode === "offscreen-durable-v1"
          ? "offscreen-durable-v1"
          : "",
        message: sanitizeKnownCredentialText(status.message, 1000, diagnosticSecrets),
        error: sanitizeKnownCredentialText(status.error, 1000, diagnosticSecrets),
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
        const asrDiagnostics = sanitizeAsrDiagnostics(record.browserAsrDiagnosticsByChunk?.get?.(index), diagnosticSecrets);
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
          ...(Array.isArray(audio?.speechIntervals)
            ? { speechIntervals: sanitizeSpeechIntervals(audio.speechIntervals) }
            : {}),
          ...(typeof audio?.speechIntervalsReliable === "boolean"
            ? { speechIntervalsReliable: audio.speechIntervalsReliable }
            : {}),
          asrCompleted: Boolean(audio?.asrCompleted),
          asrExecutionMode: audio?.asrExecutionMode === "offscreen-durable-v1"
            ? "offscreen-durable-v1"
            : "",
          asrFailed: Boolean(audio?.asrFailed),
          asrError: sanitizeKnownCredentialText(audio?.asrError, 1000, diagnosticSecrets),
          asrErrorStatus: nonNegativeInteger(audio?.asrErrorStatus),
          asrErrorCode: compactText(audio?.asrErrorCode, 100),
          asrDeliveryAmbiguous: Boolean(audio?.asrDeliveryAmbiguous),
          asrStage: compactText(audio?.asrStage, 100),
          ...(asrDiagnostics ? { asrDiagnostics } : {}),
          sourceSegments: sanitizeSegments(audio?.sourceSegments)
        };
      })
      .sort((left, right) => left.index - right.index);
    return [...translationGroups, ...audioChunks];
  }

  function knownRecordCredentials(record = {}) {
    const configs = [
      record.modelConfig?.asr,
      record.modelConfig?.translation,
      record.modelConfig?.llm
    ];
    const values = [];
    for (const config of configs) {
      if (!config || typeof config !== "object") continue;
      for (const key of ["apiKey", "api_key", "accessToken", "access_token", "token", "authorization"]) {
        if (config[key]) values.push(String(config[key]));
      }
    }
    return [...new Set(values.filter(Boolean))];
  }

  function sanitizeKnownCredentialText(value, maxLength, knownSecrets = []) {
    const redacted = redactKnownDiagnosticSecrets(String(value || ""), knownSecrets);
    return redactKnownDiagnosticSecrets(sanitizeFreeText(redacted, maxLength), knownSecrets);
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
    return segments.map(segment => {
      const speakerId = segment?.speakerId;
      const speakerLabel = segment?.speakerLabel;
      return {
        start: finiteNumber(segment?.start),
        end: finiteNumber(segment?.end),
        text: compactText(segment?.text, 20000),
        chunkIndex: nonNegativeInteger(segment?.chunkIndex),
        segmentIndex: nonNegativeInteger(segment?.segmentIndex),
        speaker: compactText(segment?.speaker, 200),
        translationFailed: Boolean(segment?.translationFailed),
        ...(Number.isFinite(speakerId) ? { speakerId } : {}),
        ...(typeof speakerLabel === "string" ? { speakerLabel: compactText(speakerLabel, 200) } : {})
      };
    });
  }

  function sanitizeSpeechIntervals(intervals) {
    return intervals
      .map(interval => ({
        start: Number(interval?.start),
        end: Number(interval?.end)
      }))
      .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
      .sort((left, right) => left.start - right.start || left.end - right.end);
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

  function sanitizeInternalCacheRefs(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(internalCacheRef).filter(Boolean))].slice(-4096);
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
    OPERATION_SCHEMA_VERSION,
    CLEANUP_CLAIM_SCHEMA_VERSION,
    CLEANUP_CLAIM_STATES,
    OPERATION_STATES,
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
    operationKey,
    cleanupClaimKey,
    sanitizeAsrDiagnostics,
    sanitizeOperation,
    sanitizeCleanupClaim,
    safeUrlIdentity
  };
})();
