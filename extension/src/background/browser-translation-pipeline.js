import { FuguangBrowserTranslationProvider } from "./browser-translation-provider.js";

export const FuguangBrowserTranslationPipeline = (() => {
  const BROWSER_TRANSLATION_BATCH_SIZE = 60;
  const BROWSER_TRANSLATION_MAX_AUTO_SPLIT_DEPTH = 6;
  const BROWSER_TRANSLATION_FAILURES = Symbol("fuguang.browserTranslationFailures");

  const {
    requestBrowserTranslationItems,
    browserTranslationErrorIsPermanent,
    browserTranslationErrorIsRateLimited,
    browserTranslationErrorIsContentPolicy,
    browserTranslationErrorIsDeliveryAmbiguous,
    browserTranslationErrorIsRepairable,
    browserTranslationRepairableError,
    isBrowserTranslationAbortError
  } = FuguangBrowserTranslationProvider;

  async function translateBrowserSegments(sourceSegments, llmConfig, targetLanguage, metadata, options = {}) {
    throwIfBrowserTranslationAborted(options.signal);
    const batches = splitSegmentsForBrowserTranslation(sourceSegments, BROWSER_TRANSLATION_BATCH_SIZE);
    const translationContext = createBrowserTranslationContext(llmConfig, targetLanguage, metadata, options);
    const translatedByBatch = new Array(batches.length);
    const failuresByBatch = new Array(batches.length);
    const failures = [];
    const batchErrors = new Array(batches.length);
    let fatalError = null;
    let nextBatchIndex = 0;
    const workerCount = browserTranslationBatchWorkerCount(options, batches.length);
    async function worker() {
      while (nextBatchIndex < batches.length && !fatalError) {
        throwIfBrowserTranslationAborted(options.signal);
        const batchIndex = nextBatchIndex;
        nextBatchIndex += 1;
        await translateBrowserSegmentsBatchAtIndex(batchIndex);
      }
    }
    async function translateBrowserSegmentsBatchAtIndex(batchIndex) {
      throwIfBrowserTranslationAborted(options.signal);
      options.onProgress?.({
        batchIndex: batchIndex + 1,
        batchTotal: batches.length,
        segmentCount: batches[batchIndex].length
      });
      let batchTranslated = [];
      try {
        batchTranslated = await translateBrowserBatchState(createBrowserTranslationBatchState(
          batches[batchIndex],
          translationContext,
          0,
          null,
          joinBrowserTranslationRequestPath(
            translationContext.options.semanticRequestPath || translationContext.options.requestPath || "translation",
            `batch/${batchIndex}`
          )
        ));
      } catch (error) {
        throwIfBrowserTranslationAborted(options.signal, error);
        if (browserTranslationErrorIsRateLimited(error) && batches.length > 1) {
          batchErrors[batchIndex] = error;
          failuresByBatch[batchIndex] = createBrowserTranslationFailuresForSources(batches[batchIndex], error);
          return;
        }
        if (browserTranslationErrorIsPermanent(error) || batches.length <= 1) {
          fatalError = error;
          throw error;
        }
        batchErrors[batchIndex] = error;
        failuresByBatch[batchIndex] = createBrowserTranslationFailuresForSources(batches[batchIndex], error);
        return;
      }
      translatedByBatch[batchIndex] = batchTranslated;
      failuresByBatch[batchIndex] = browserTranslationFailures(batchTranslated);
    }
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const translated = translatedByBatch.flatMap(batch => Array.isArray(batch) ? batch : []);
    for (const batchFailures of failuresByBatch) {
      if (Array.isArray(batchFailures)) {
        failures.push(...batchFailures);
      }
    }
    const firstBatchError = batchErrors.find(Boolean);
    if (!translated.length && firstBatchError) {
      throw firstBatchError;
    }
    return attachBrowserTranslationFailures(translated, failures);
  }

  function browserTranslationBatchWorkerCount(options = {}, batchCount = 0) {
    const requested = Number(options.batchWorkers || 1);
    return Math.max(1, Math.min(
      Number.isFinite(requested) ? Math.floor(requested) : 1,
      Math.max(1, Number(batchCount) || 1)
    ));
  }

  function createBrowserTranslationContext(llmConfig, targetLanguage, metadata, options = {}) {
    return {
      llmConfig,
      targetLanguage,
      metadata: metadata || {},
      options: options || {}
    };
  }

  function isBrowserTranslationContext(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(value, "llmConfig") &&
      Object.prototype.hasOwnProperty.call(value, "targetLanguage")
    );
  }

  function resolveBrowserTranslationBatchArgs(translationContextOrConfig, targetLanguage, metadata, options, autoSplitDepth) {
    if (isBrowserTranslationContext(translationContextOrConfig)) {
      return createBrowserTranslationBatchState(
        null,
        translationContextOrConfig,
        Number.isFinite(Number(targetLanguage)) ? Number(targetLanguage) : 0
      );
    }
    return createBrowserTranslationBatchState(
      null,
      createBrowserTranslationContext(translationContextOrConfig, targetLanguage, metadata, options),
      Number.isFinite(Number(autoSplitDepth)) ? Number(autoSplitDepth) : 0
    );
  }

  function createBrowserTranslationBatchState(sourceSegments, translationContext, autoSplitDepth = 0, error = null, requestPath = "") {
    return {
      sourceSegments: Array.isArray(sourceSegments) ? sourceSegments : [],
      translationContext,
      autoSplitDepth: Math.max(0, Number(autoSplitDepth) || 0),
      error,
      requestPath: requestPath || joinBrowserTranslationRequestPath(
        translationContext?.options?.semanticRequestPath || translationContext?.options?.requestPath || "translation",
        "batch/direct"
      )
    };
  }

  async function translateBrowserSegmentsBatch(sourceSegments, translationContextOrConfig, targetLanguage, metadata, options = {}, autoSplitDepth = 0) {
    const state = resolveBrowserTranslationBatchArgs(
      translationContextOrConfig,
      targetLanguage,
      metadata,
      options,
      autoSplitDepth
    );
    state.sourceSegments = sourceSegments;
    return translateBrowserBatchState(state);
  }

  async function translateBrowserBatchState(state) {
    try {
      throwIfBrowserTranslationAborted(state.translationContext?.options?.signal);
      return await requestAndAlignBrowserTranslationBatch(state);
    } catch (error) {
      throwIfBrowserTranslationAborted(state.translationContext?.options?.signal, error);
      if (browserTranslationErrorMustNotBeRepaired(error)) {
        throw error;
      }
      return await retrySplitBrowserTranslationBatch({
        ...state,
        error
      });
    }
  }

  async function requestAndAlignBrowserTranslationBatch(state) {
    const { sourceSegments, translationContext, autoSplitDepth } = state;
    const attempts = autoSplitDepth === 0 ? 2 : 1;
    let lastError = null;
    let items = [];
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        throwIfBrowserTranslationAborted(translationContext?.options?.signal);
        items = await requestBrowserTranslationItems(sourceSegments, {
          ...translationContext,
          options: {
            ...translationContext.options,
            batchStart: browserTranslationBatchBoundary(sourceSegments[0], 0),
            batchEnd: browserTranslationBatchBoundary(sourceSegments[sourceSegments.length - 1], sourceSegments.length - 1) + 1,
            semanticRequestPath: joinBrowserTranslationRequestPath(state.requestPath, `attempt/${attempt}`)
          }
        });
        if (items.length) {
          if (shouldRetryWholeBrowserTranslationBatchBeforeSplit(sourceSegments, items, autoSplitDepth, attempt, attempts)) {
            throw translationAlignmentError(sourceSegments, collectTranslationAlignment(sourceSegments, items));
          }
          break;
        }
        throw browserTranslationRepairableError("翻译模型没有返回可用字幕条目。");
      } catch (error) {
        throwIfBrowserTranslationAborted(translationContext?.options?.signal, error);
        lastError = error;
        if (!browserTranslationErrorIsRepairable(error) || attempt === attempts - 1) {
          break;
        }
      }
    }
    if (!items.length) {
      throw lastError || browserTranslationRepairableError("翻译模型没有返回可用字幕条目。");
    }
    return await alignOrRepairTranslatedSegments(
      state,
      items
    );
  }

  function shouldRetryWholeBrowserTranslationBatchBeforeSplit(sourceSegments, items, autoSplitDepth, attempt, attempts) {
    if (autoSplitDepth !== 0 || attempt >= attempts - 1) {
      return false;
    }
    const alignment = collectTranslationAlignment(sourceSegments, items);
    return alignment.invalidReasons.length > 0 && alignment.byIndex.size === 0;
  }

  async function retrySplitBrowserTranslationBatch(state) {
    const { sourceSegments, autoSplitDepth, error } = state;
    throwIfBrowserTranslationAborted(state.translationContext?.options?.signal, error);
    if (browserTranslationErrorMustNotBeRepaired(error)) {
      throw error;
    }
    if (sourceSegments.length <= 1) {
      if (autoSplitDepth > 0 || browserTranslationErrorIsContentPolicy(error?.message || error)) {
        return attachBrowserTranslationFailures([], [
          createBrowserTranslationFailure(sourceSegments[0], error)
        ]);
      }
      throw error;
    }
    if (autoSplitDepth >= BROWSER_TRANSLATION_MAX_AUTO_SPLIT_DEPTH) {
      throw new Error(`翻译模型返回不稳定，已达到自动拆分重试上限（逐级拆分到单句前仍失败）。原错误：${error.message || error}`);
    }
    const { translated, failures } = await runBrowserTranslationSplitQueue(state);
    if (!translated.length) {
      if (autoSplitDepth > 0) {
        return attachBrowserTranslationFailures(
          [],
          failures.length ? failures : createBrowserTranslationFailuresForSources(sourceSegments, error)
        );
      }
      throw new Error(`翻译模型返回不稳定，自动拆分到单句后仍没有得到可用译文。原错误：${error.message || error}`);
    }
    return attachBrowserTranslationFailures(
      translated.map(item => item.segment),
      failures
    );
  }

  async function runBrowserTranslationSplitQueue(state) {
    const { sourceSegments, translationContext, autoSplitDepth, error: originalError } = state;
    const queue = splitBrowserTranslationQueueTask({
      segments: sourceSegments,
      indexes: sourceSegments.map((_, index) => index),
      depth: autoSplitDepth,
      error: originalError,
      requestPath: state.requestPath
    });
    const translated = [];
    const failures = [];
    let fatalError = null;
    async function worker() {
      while (queue.length && !fatalError) {
        throwIfBrowserTranslationAborted(translationContext?.options?.signal);
        const task = queue.shift();
        if (!task) {
          return;
        }
        try {
          const result = await requestAndAlignBrowserTranslationBatch({
            sourceSegments: task.segments,
            translationContext,
            autoSplitDepth: task.depth,
            error: task.error,
            requestPath: task.requestPath
          });
          failures.push(...browserTranslationFailures(result));
          result.forEach((segment, position) => {
            translated.push({
              index: browserTranslationOutputIndex(task, segment, position),
              segment
            });
          });
        } catch (error) {
          throwIfBrowserTranslationAborted(translationContext?.options?.signal, error);
          if (browserTranslationErrorIsDeliveryAmbiguous(error)) {
            failures.push(...createBrowserTranslationFailuresForSources(task.segments, error));
            continue;
          }
          if (browserTranslationErrorMustNotBeRepaired(error)) {
            fatalError = error || task.error || originalError;
            throw fatalError;
          }
          if (task.segments.length <= 1 || task.depth >= BROWSER_TRANSLATION_MAX_AUTO_SPLIT_DEPTH) {
            failures.push(...createBrowserTranslationFailuresForSources(task.segments, error || task.error || originalError));
            continue;
          }
          queue.push(...splitBrowserTranslationQueueTask({
            segments: task.segments,
            indexes: task.indexes,
            depth: task.depth,
            error: error || task.error || originalError,
            requestPath: task.requestPath
          }));
        }
      }
    }
    const workerCount = browserTranslationSplitWorkerCount(translationContext.options, queue.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (fatalError) {
      throw fatalError;
    }
    translated.sort((left, right) => left.index - right.index);
    return { translated, failures };
  }

  function browserTranslationSplitWorkerCount(options = {}, taskCount = 0) {
    const requested = Number(options.splitWorkers || 1);
    return Math.max(1, Math.min(
      Number.isFinite(requested) ? Math.floor(requested) : 1,
      Math.max(1, Number(taskCount) || 1)
    ));
  }

  function browserTranslationErrorMustNotBeRepaired(error) {
    if (browserTranslationErrorIsRateLimited(error)
        || browserTranslationErrorIsPermanent(error)
        || browserTranslationErrorIsDeliveryAmbiguous(error)) {
      return true;
    }
    return !browserTranslationErrorIsRepairable(error)
      && !browserTranslationErrorIsContentPolicy(error?.message || error);
  }

  function splitBrowserTranslationQueueTask(task) {
    const midpoint = Math.ceil(task.segments.length / 2);
    return [
      {
        segments: task.segments.slice(0, midpoint),
        indexes: task.indexes.slice(0, midpoint),
        depth: task.depth + 1,
        error: task.error,
        requestPath: joinBrowserTranslationRequestPath(task.requestPath, "split/0")
      },
      {
        segments: task.segments.slice(midpoint),
        indexes: task.indexes.slice(midpoint),
        depth: task.depth + 1,
        error: task.error,
        requestPath: joinBrowserTranslationRequestPath(task.requestPath, "split/1")
      }
    ].filter(item => item.segments.length);
  }

  function browserTranslationOutputIndex(task, translatedSegment, fallbackPosition) {
    const matchIndex = task.segments.findIndex(sourceSegment => browserTranslationSegmentsReferToSameSource(sourceSegment, translatedSegment));
    if (matchIndex >= 0) {
      return task.indexes[matchIndex];
    }
    return task.indexes[Math.min(fallbackPosition, task.indexes.length - 1)] ?? fallbackPosition;
  }

  function browserTranslationSegmentsReferToSameSource(sourceSegment, translatedSegment) {
    const sourceKey = segmentIdentityKey(sourceSegment);
    const translatedKey = segmentIdentityKey(translatedSegment);
    if (sourceKey && translatedKey) {
      return sourceKey === translatedKey;
    }
    const sourceStart = Number(sourceSegment?.start);
    const sourceEnd = Number(sourceSegment?.end);
    const translatedStart = Number(translatedSegment?.start);
    const translatedEnd = Number(translatedSegment?.end);
    return Number.isFinite(sourceStart)
      && Number.isFinite(sourceEnd)
      && Number.isFinite(translatedStart)
      && Number.isFinite(translatedEnd)
      && Math.abs(sourceStart - translatedStart) < 0.001
      && Math.abs(sourceEnd - translatedEnd) < 0.001;
  }

  function splitSegmentsForBrowserTranslation(sourceSegments, batchSize) {
    const size = Math.max(1, Number(batchSize) || 1);
    const batches = [];
    for (let index = 0; index < sourceSegments.length; index += size) {
      batches.push(sourceSegments.slice(index, index + size));
    }
    return batches;
  }

  function throwIfBrowserTranslationAborted(signal, error = null) {
    if (!isBrowserTranslationAbortError(error, signal)) {
      return;
    }
    const aborted = new Error(signal?.reason?.message || error?.message || "任务已停止。");
    aborted.name = "AbortError";
    throw aborted;
  }

  async function alignOrRepairTranslatedSegments(state, items) {
    const { sourceSegments, translationContext, autoSplitDepth } = state;
    const alignment = collectTranslationAlignment(sourceSegments, items);
    if (!alignment.missingIndexes.length && !alignment.invalidReasons.length) {
      return alignTranslatedSegments(sourceSegments, items);
    }
    if (alignment.missingIndexes.length && alignment.byIndex.size > 0) {
      const retrySourceSegments = alignment.missingIndexes.map(index => sourceSegments[index]);
      let retryTranslated = [];
      let retryError = null;
      try {
        retryTranslated = await translateBrowserBatchState(createBrowserTranslationBatchState(
          retrySourceSegments,
          translationContext,
          autoSplitDepth + 1,
          null,
          joinBrowserTranslationRequestPath(
            state.requestPath,
            `missing/${alignment.missingIndexes.join("-")}`
          )
        ));
      } catch (error) {
        retryError = error;
      }
      const repairedByIndex = new Map(alignment.byIndex);
      const retrySourceIndexesByKey = new Map();
      retrySourceSegments.forEach((segment, position) => {
        const key = segmentIdentityKey(segment);
        if (key) {
          retrySourceIndexesByKey.set(key, alignment.missingIndexes[position]);
        }
      });
      retryTranslated.forEach((translatedSegment, position) => {
        const key = segmentIdentityKey(translatedSegment);
        const originalIndex = key && retrySourceIndexesByKey.has(key)
          ? retrySourceIndexesByKey.get(key)
          : alignment.missingIndexes[position];
        const text = cleanVttText(translatedSegment?.text ?? "");
        if (Number.isInteger(originalIndex) && text) {
          repairedByIndex.set(originalIndex, text);
        }
      });
      const retryFailures = browserTranslationFailures(retryTranslated);
      const missingAfterRetry = sourceSegments
        .map((_, index) => index)
        .filter(index => !repairedByIndex.has(index));
      const fallbackFailures = retryFailures.length
        ? retryFailures
        : missingAfterRetry.map(index => createBrowserTranslationFailure(sourceSegments[index], retryError || translationAlignmentError(sourceSegments, alignment)));
      if (missingAfterRetry.length && !fallbackFailures.length) {
        throw retryError || translationAlignmentError(sourceSegments, alignment);
      }
      const repaired = translatedSegmentsFromByIndex(sourceSegments, repairedByIndex, {
        allowMissing: Boolean(missingAfterRetry.length)
      });
      if (!repaired.length) {
        throw retryError || translationAlignmentError(sourceSegments, alignment);
      }
      return attachBrowserTranslationFailures(repaired, fallbackFailures);
    }
    const error = translationAlignmentError(sourceSegments, alignment);
    if (sourceSegments.length > 1) {
      return await retrySplitBrowserTranslationBatch({
        ...state,
        sourceSegments,
        error
      });
    }
    throw error;
  }

  function alignTranslatedSegments(sourceSegments, items) {
    const translatedByIndex = normalizedTranslationItemsByIndex(sourceSegments, items);
    return translatedSegmentsFromByIndex(sourceSegments, translatedByIndex);
  }

  function translatedSegmentsFromByIndex(sourceSegments, translatedByIndex, options = {}) {
    const allowMissing = Boolean(options.allowMissing);
    return sourceSegments.flatMap((segment, index) => {
      const text = cleanVttText(translatedByIndex.get(index) ?? "");
      if (!text) {
        if (allowMissing) {
          return [];
        }
        throw browserTranslationRepairableError(`翻译模型缺少条目索引：${index}。`);
      }
      return [{
        start: segment.start,
        end: segment.end,
        chunkIndex: segment.chunkIndex,
        segmentIndex: segment.segmentIndex,
        text
      }];
    });
  }

  function attachBrowserTranslationFailures(translatedSegments, failures = []) {
    const segments = Array.isArray(translatedSegments) ? translatedSegments : [];
    const existing = browserTranslationFailures(segments);
    const normalized = (Array.isArray(failures) ? failures : [])
      .filter(Boolean)
      .map(failure => ({
        source: normalizeBrowserTranslationFailureSource(failure.source),
        error: String(failure.error || "翻译失败")
      }))
      .filter(failure => failure.source);
    const merged = [...existing, ...normalized];
    if (!merged.length) {
      return segments;
    }
    Object.defineProperty(segments, BROWSER_TRANSLATION_FAILURES, {
      value: merged,
      enumerable: false,
      configurable: true
    });
    return segments;
  }

  function browserTranslationFailures(translatedSegments) {
    if (!Array.isArray(translatedSegments)) {
      return [];
    }
    return Array.isArray(translatedSegments[BROWSER_TRANSLATION_FAILURES])
      ? translatedSegments[BROWSER_TRANSLATION_FAILURES]
      : [];
  }

  function createBrowserTranslationFailure(sourceSegment, error) {
    return {
      source: normalizeBrowserTranslationFailureSource(sourceSegment),
      error: error?.message || String(error || "翻译失败")
    };
  }

  function createBrowserTranslationFailuresForSources(sourceSegments, error) {
    return (Array.isArray(sourceSegments) ? sourceSegments : [])
      .map(segment => createBrowserTranslationFailure(segment, error));
  }

  function normalizeBrowserTranslationFailureSource(sourceSegment) {
    if (!sourceSegment) {
      return null;
    }
    return {
      start: sourceSegment.start,
      end: sourceSegment.end,
      text: sourceSegment.text || "",
      chunkIndex: sourceSegment.chunkIndex,
      segmentIndex: sourceSegment.segmentIndex
    };
  }

  function normalizedTranslationItemsByIndex(sourceSegments, items) {
    const alignment = collectTranslationAlignment(sourceSegments, items);
    if (alignment.missingIndexes.length || alignment.invalidReasons.length) {
      throw translationAlignmentError(sourceSegments, alignment);
    }
    return alignment.byIndex;
  }

  function collectTranslationAlignment(sourceSegments, items) {
    const itemList = Array.isArray(items) ? items : [];
    const byIndex = new Map();
    const invalidReasons = [];
    itemList.forEach((item, position) => {
      const hasExplicitIndex = Object.prototype.hasOwnProperty.call(item || {}, "i")
        && item.i !== null
        && item.i !== "";
      const index = hasExplicitIndex ? Number(item.i) : position;
      if (!Number.isInteger(index) || index < 0 || index >= sourceSegments.length) {
        invalidReasons.push(`索引无效：${String(item?.i ?? "")}`);
        return;
      }
      if (byIndex.has(index)) {
        invalidReasons.push(`重复条目索引：${index}`);
        return;
      }
      const text = translatedItemText(item);
      if (!text) {
        invalidReasons.push(`空译文：${index}`);
        return;
      }
      byIndex.set(index, text);
    });
    const missingIndexes = [];
    for (let index = 0; index < sourceSegments.length; index += 1) {
      if (!byIndex.has(index)) {
        missingIndexes.push(index);
      }
    }
    return {
      byIndex,
      invalidReasons,
      itemCount: itemList.length,
      missingIndexes
    };
  }

  function translationAlignmentError(sourceSegments, alignment) {
    const details = [];
    if (alignment.itemCount !== sourceSegments.length) {
      details.push(`条目数量不一致：原文 ${sourceSegments.length}，译文 ${alignment.itemCount}`);
    }
    details.push(...alignment.invalidReasons);
    if (alignment.missingIndexes.length) {
      details.push(`缺少条目索引：${alignment.missingIndexes.join(",")}`);
    }
    return browserTranslationRepairableError(`翻译模型返回不完整：${details.join("；")}。`);
  }

  function translatedItemText(item) {
    for (const key of ["text", "translation", "translated"]) {
      const text = cleanVttText(item?.[key] ?? "");
      if (text) {
        return text;
      }
    }
    return "";
  }

  function segmentIdentityKey(segment) {
    const chunkIndex = Number(segment?.chunkIndex);
    const segmentIndex = Number(segment?.segmentIndex);
    if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
      return `${chunkIndex}:${segmentIndex}`;
    }
    return "";
  }

  function cleanVttText(value) {
    return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  function joinBrowserTranslationRequestPath(...parts) {
    return parts
      .map(part => String(part || "").replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
  }

  function browserTranslationBatchBoundary(segment, fallback) {
    const segmentIndex = Number(segment?.segmentIndex);
    return Number.isInteger(segmentIndex) && segmentIndex >= 0 ? segmentIndex : Math.max(0, Number(fallback) || 0);
  }

  const api = {
    translateBrowserSegments,
    translateBrowserSegmentsBatch,
    browserTranslationFailures
  };
  return api;
})();
