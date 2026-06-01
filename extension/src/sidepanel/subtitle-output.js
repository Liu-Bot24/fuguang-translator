(function(global) {
  let runtimeStateProvider = () => ({ mode: "translated", isRunning: false });

  function setSubtitleOutputRuntimeStateProvider(provider) {
    runtimeStateProvider = typeof provider === "function" ? provider : runtimeStateProvider;
  }

  function subtitleOutputRuntimeState() {
    const state = runtimeStateProvider() || {};
    return {
      mode: normalizeSubtitleDisplayMode(state.mode),
      isRunning: state.isRunning === true
    };
  }

  function normalizeSubtitleDisplayMode(mode) {
    return ["translated", "source", "bilingual"].includes(mode) ? mode : "translated";
  }

  function parseVtt(vtt) {
    return String(vtt || "")
      .split(/\n\n+/)
      .map(block => block.trim())
      .filter(block => block && !block.startsWith("WEBVTT"))
      .map(block => {
        const lines = block.split("\n").filter(Boolean);
        const timeIndex = lines.findIndex(line => line.includes("-->"));
        if (timeIndex < 0) {
          return null;
        }
        const [startText, endText] = lines[timeIndex].split("-->").map(value => value.trim().split(/\s+/)[0]);
        const start = parseTimestamp(startText);
        const end = parseTimestamp(endText);
        const text = lines.slice(timeIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
        return {
          start,
          end,
          time: lines[timeIndex],
          text,
          sourceText: ""
        };
      })
      .filter(cue => cue && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text);
  }

  function cuesFromTranscript(transcript) {
    const source = Array.isArray(transcript?.source) ? transcript.source : [];
    const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
    const cues = [];
    for (const { sourceSegment, translatedSegment } of mergeTranscriptSegments(source, translated)) {
      const start = firstFiniteNumber(translatedSegment.start, sourceSegment.start);
      const end = firstFiniteNumber(translatedSegment.end, sourceSegment.end);
      const translatedText = cleanSubtitleText(translatedSegment.text);
      const sourceText = cleanSubtitleText(sourceSegment.text);
      const sourceOnly = !translatedText && Boolean(sourceText);
      const text = translatedText || sourceText;
      if (Number.isFinite(start) && Number.isFinite(end) && text) {
        const cue = {
          start,
          end,
          time: formatCueTime(start, end),
          text,
          sourceText: sourceText && (sourceOnly || sourceText !== text) ? sourceText : "",
          speakerLabel: cleanSubtitleText(sourceSegment.speakerLabel || translatedSegment.speakerLabel || ""),
          sourceOnly
        };
        const chunkIndex = firstFiniteNumber(translatedSegment.chunkIndex, sourceSegment.chunkIndex);
        const segmentIndex = firstFiniteNumber(translatedSegment.segmentIndex, sourceSegment.segmentIndex);
        if (Number.isInteger(chunkIndex) && Number.isInteger(segmentIndex)) {
          cue.chunkIndex = chunkIndex;
          cue.segmentIndex = segmentIndex;
        }
        cues.push(cue);
      }
    }
    return cues;
  }

  function transcriptHasRealTranslatedCue(transcript) {
    return (Array.isArray(transcript?.translated) ? transcript.translated : [])
      .some(segment => Boolean(cleanSubtitleText(segment?.text)));
  }

  function transcriptHasDisplayableCues(transcript, mode = subtitleOutputRuntimeState().mode, options = {}) {
    const cues = cuesFromTranscript(transcript);
    return cues.some(cue => shouldIncludeCueInSubtitleOutput(cue, mode, cues, {
      allowRunningSourcePreview: false,
      ...options
    }));
  }

  function mergeTranscriptSegments(source, translated) {
    const sourceSegments = Array.isArray(source) ? source : [];
    const translatedSegments = Array.isArray(translated) ? translated : [];
    const useIdentity = sourceSegments.some(hasSegmentIdentity) || translatedSegments.some(hasSegmentIdentity);
    if (!useIdentity) {
      const total = Math.max(sourceSegments.length, translatedSegments.length);
      return Array.from({ length: total }, (_, index) => ({
        sourceSegment: sourceSegments[index] || {},
        translatedSegment: translatedSegments[index] || {}
      }));
    }
    const translatedByKey = new Map();
    translatedSegments.forEach((segment, index) => {
      const key = segmentIdentityKey(segment);
      if (key) {
        translatedByKey.set(key, { segment, index });
      }
    });
    const usedKeys = new Set();
    const usedTranslatedIndexes = new Set();
    const merged = sourceSegments.map((segment, index) => {
      const key = segmentIdentityKey(segment);
      let translatedSegment = null;
      if (key && translatedByKey.has(key)) {
        const matched = translatedByKey.get(key);
        translatedSegment = matched.segment;
        usedKeys.add(key);
        usedTranslatedIndexes.add(matched.index);
      } else if (translatedSegments[index] && !segmentIdentityKey(translatedSegments[index])) {
        translatedSegment = translatedSegments[index];
        usedTranslatedIndexes.add(index);
      }
      return {
        sourceSegment: segment,
        translatedSegment: translatedSegment || {}
      };
    });
    for (const [index, segment] of translatedSegments.entries()) {
      if (usedTranslatedIndexes.has(index)) {
        continue;
      }
      const key = segmentIdentityKey(segment);
      if (!key || usedKeys.has(key)) {
        continue;
      }
      merged.push({
        sourceSegment: {},
        translatedSegment: segment
      });
    }
    return merged.sort((left, right) => {
      const leftStart = firstFiniteNumber(left.translatedSegment.start, left.sourceSegment.start);
      const rightStart = firstFiniteNumber(right.translatedSegment.start, right.sourceSegment.start);
      return leftStart - rightStart;
    });
  }

  function hasSegmentIdentity(segment) {
    return Boolean(segmentIdentityKey(segment));
  }

  function segmentIdentityKey(segment) {
    const chunkIndex = Number(segment?.chunkIndex);
    const segmentIndex = Number(segment?.segmentIndex);
    if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
      return `${chunkIndex}:${segmentIndex}`;
    }
    return "";
  }

  function transcriptFromCues(cues) {
    return {
      source: cues.map(cue => ({ start: cue.start, end: cue.end, text: cue.sourceText || "", speakerLabel: cue.speakerLabel || "" })),
      translated: cues.map(cue => ({ start: cue.start, end: cue.end, text: cue.text || "", speakerLabel: cue.speakerLabel || "" })),
      chunkStatuses: []
    };
  }

  function cuesToVtt(cues, mode = subtitleOutputRuntimeState().mode, options = {}) {
    const displayMode = normalizeSubtitleDisplayMode(mode);
    const lines = ["WEBVTT", ""];
    for (const cue of cues) {
      if (!shouldIncludeCueInSubtitleOutput(cue, displayMode, cues, options)) {
        continue;
      }
      const textLines = subtitleCueTextLines(cue, displayMode);
      if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || !textLines.length) {
        continue;
      }
      lines.push(formatCueTime(cue.start, cue.end));
      lines.push(textLines.join("\n"));
      lines.push("");
    }
    return lines.join("\n");
  }

  function cuesToSrt(cues, mode = subtitleOutputRuntimeState().mode, options = {}) {
    const displayMode = normalizeSubtitleDisplayMode(mode);
    const body = cues
      .filter(cue => shouldIncludeCueInSubtitleOutput(cue, displayMode, cues, options))
      .filter(cue => Number.isFinite(cue.start) && Number.isFinite(cue.end) && subtitleCueTextLines(cue, displayMode).length)
      .map((cue, index) => {
        const textLines = subtitleCueTextLines(cue, displayMode);
        return [
          String(index + 1),
          `${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}`,
          textLines.join("\n")
        ].join("\n");
      })
      .join("\n\n");
    if (!body) {
      return "";
    }
    return [formatSrtNoteBlock(options.srtMetadata), body]
      .filter(Boolean)
      .join("\n\n")
      .concat("\n");
  }

  function formatSrtNoteBlock(metadata = null) {
    const lines = [];
    const sourcePage = cleanSrtNoteValue(metadata?.sourcePage);
    const exportedBy = cleanSrtNoteValue(metadata?.exportedBy);
    if (sourcePage) {
      lines.push(`Source page: ${sourcePage}`);
    }
    if (exportedBy) {
      lines.push(`Exported by: ${exportedBy}`);
    }
    return lines.length ? ["NOTE", ...lines].join("\n") : "";
  }

  function cleanSrtNoteValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function shouldIncludeCueInSubtitleOutput(cue, mode, cues, options = {}) {
    if (!cue) {
      return false;
    }
    const displayMode = normalizeSubtitleDisplayMode(mode);
    if (displayMode === "source") {
      return Boolean(subtitleCueSourceText(cue));
    }
    if (displayMode !== "translated" || !cue.sourceOnly) {
      return true;
    }
    const hasRealTranslatedCue = Array.isArray(cues) && cues.some(item => item && !item.sourceOnly && cleanSubtitleText(item.text));
    if (hasRealTranslatedCue) {
      return false;
    }
    if (subtitleOutputRuntimeState().isRunning) {
      return options.allowRunningSourcePreview !== false;
    }
    return options.allowCompletedSourceFallback !== false;
  }

  function subtitleCueTextLines(cue, mode) {
    const displayMode = normalizeSubtitleDisplayMode(mode);
    const sourceText = subtitleCueSourceText(cue);
    const translatedText = cleanSubtitleText(cue?.text);
    if (displayMode === "source") {
      return sourceText ? [sourceText] : [];
    }
    if (displayMode === "bilingual") {
      return sourceText && sourceText !== translatedText
        ? [sourceText, translatedText].filter(Boolean)
        : [translatedText].filter(Boolean);
    }
    return [translatedText].filter(Boolean);
  }

  function subtitleCueSourceText(cue) {
    return cleanSubtitleText(cue?.sourceText || (cue?.sourceOnly ? cue?.text : ""));
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return number;
      }
    }
    return Number.NaN;
  }

  function cleanSubtitleText(value) {
    return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  function formatCueTime(start, end) {
    return `${formatTimestamp(start)} --> ${formatTimestamp(end)}`;
  }

  function formatTimestamp(value) {
    const time = Math.max(0, Number(value) || 0);
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function formatSrtTimestamp(value) {
    return formatTimestamp(value).replace(".", ",");
  }

  function parseTimestamp(value) {
    const parts = String(value || "").replace(",", ".").split(":");
    if (parts.length < 2 || parts.length > 3) {
      return Number.NaN;
    }
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  Object.assign(global, {
    setSubtitleOutputRuntimeStateProvider,
    normalizeSubtitleDisplayMode,
    parseVtt,
    cuesFromTranscript,
    transcriptHasRealTranslatedCue,
    transcriptHasDisplayableCues,
    mergeTranscriptSegments,
    hasSegmentIdentity,
    segmentIdentityKey,
    transcriptFromCues,
    cuesToVtt,
    cuesToSrt,
    formatSrtNoteBlock,
    shouldIncludeCueInSubtitleOutput,
    subtitleCueTextLines,
    subtitleCueSourceText,
    firstFiniteNumber,
    cleanSubtitleText,
    formatCueTime,
    formatTimestamp,
    formatSrtTimestamp,
    parseTimestamp
  });
})(globalThis);
