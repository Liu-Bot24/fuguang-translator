(function () {
  const LOCAL_MEDIA_DEMUX_CACHE_BYTES = 16 * 1024 * 1024;
  const LOCAL_MEDIA_DURATION_TOLERANCE_RATIO = 0.002;
  const LOCAL_MEDIA_DURATION_MIN_TOLERANCE_SECONDS = 2;
  const LOCAL_MEDIA_DURATION_MAX_TOLERANCE_SECONDS = 10;

  function createLocalMediaExtractor(deps = {}) {
    const {
      WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS,
      loadMediabunny,
      isLocalFileMediaSourceUrl,
      isHlsSource,
      isDashSource,
      isMseFragmentSource,
      isLongFileAsrMode,
      reportWebFfmpegExtractionProgress,
      normalizeHlsLogicalChunkSeconds,
      pickFiniteNumber,
      roundHlsSecond,
      parseContentRangeHeader,
      createHlsWebFfmpegRecyclePolicy,
      reloadWebFfmpegFrame,
      requestWebFfmpeg,
      persistWebFfmpegAudioResult,
      offsetSpeechIntervals,
      createRemoteMediaMediabunnyInput
    } = deps;

    function localMediaOverride(name, fallback) {
      const override = globalThis.FuguangLocalMediaExtractorOverrides?.[name];
      return typeof override === "function" ? override : fallback;
    }

    function shouldUseLocalMediaChunkedExtraction(message) {
      const sourceUrl = String(message?.sourceUrl || "");
      const supportedSource = isLocalFileMediaSourceUrl(sourceUrl) ||
        (message?.remoteRangeExtraction === true && /^https?:\/\//i.test(sourceUrl));
      return supportedSource &&
        !isHlsSource(message) &&
        !isDashSource(message) &&
        !isMseFragmentSource(message);
    }

    async function extractLocalMediaAudioWithWebFfmpeg(message) {
      const sourceUrl = String(message.sourceUrl || "");
      if (!isLocalFileMediaSourceUrl(sourceUrl) && message.remoteRangeExtraction !== true) {
        throw new Error("媒体分片抽取只支持已授权的本地文件或启用 Range 的直连媒体。");
      }
      const mediabunny = await loadMediabunny();
      const inputInfo = await createLocalMediaMediabunnyInput(sourceUrl, mediabunny, message);
      const input = inputInfo.input;
      if (message.abortSignal?.aborted) {
        input.dispose?.();
        throw message.abortSignal.reason instanceof Error
          ? message.abortSignal.reason
          : new Error("任务已停止。");
      }
      const onAbort = () => input.dispose?.();
      message.abortSignal?.addEventListener?.("abort", onAbort, { once: true });
      const logicalChunkSeconds = normalizeLocalMediaLogicalChunkSeconds(message.asrChunkSeconds || message.chunkSeconds, {
        longFile: isLongFileAsrMode(message)
      });
      reportWebFfmpegExtractionProgress(message, {
        phase: "local-media",
        percent: 3,
        message: localMediaInputProgressMessage(inputInfo)
      });
      try {
        const audioTrack = await input.getPrimaryAudioTrack();
        if (!audioTrack) {
          throw new Error("本地媒体文件没有可用音轨。");
        }
        const codec = await audioTrack.getCodec();
        if (!codec) {
          throw new Error("本地媒体音轨编码未知，无法分片抽取。");
        }
        const outputSpec = selectLocalMediaAudioOutputSpec(mediabunny, codec);
        if (!outputSpec) {
          throw new Error(`本地媒体音轨编码 ${codec} 暂不能在浏览器内无损分片封装。`);
        }
        const duration = await resolveLocalMediaAudioDuration(input, audioTrack, message);
        if (!duration) {
          throw new Error("无法确定本地媒体音轨时长。");
        }
        const specs = buildLocalMediaLogicalChunkSpecs(duration, logicalChunkSeconds);
        if (!specs.length) {
          throw new Error("本地媒体音轨没有可抽取的时间范围。");
        }
        const decoderConfig = await audioTrack.getDecoderConfig().catch(() => null);
        const sink = new mediabunny.EncodedPacketSink(audioTrack);
        const chunks = inputInfo.sourceMode === "stream"
          ? await extractLocalMediaAudioChunksSequentially(message, mediabunny, sink, codec, decoderConfig, outputSpec, specs)
          : await extractLocalMediaAudioChunksByRange(message, mediabunny, sink, codec, decoderConfig, outputSpec, specs);
        const bytes = chunks.reduce((sum, chunk) => sum + (Number(chunk.bytes || chunk.file?.bytes || 0) || 0), 0);
        if (!chunks.length) {
          throw new Error("本地媒体音轨没有生成可上传 ASR 的音频分片。");
        }
        return {
          chunks,
          bytes,
          duration,
          chunkSeconds: logicalChunkSeconds,
          chunkOverlapSeconds: WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS,
          sourceType: "local-media"
        };
      } catch (error) {
        throw describeLocalMediaExtractionError(error);
      } finally {
        message.abortSignal?.removeEventListener?.("abort", onAbort);
        input.dispose?.();
      }
    }

    async function createLocalMediaMediabunnyInput(sourceUrl, mediabunny, message = {}) {
      const stored = await createStoredLocalMediaMediabunnyInput(message, mediabunny);
      if (stored) {
        return stored;
      }
      if (message.remoteRangeExtraction === true && /^https?:\/\//i.test(sourceUrl)) {
        if (typeof createRemoteMediaMediabunnyInput !== "function") {
          throw new Error("直连媒体 Range 读取模块不可用。");
        }
        return createRemoteMediaMediabunnyInput(sourceUrl, mediabunny, message);
      }
      const size = await getLocalMediaSourceSize(sourceUrl).catch(error => {
        if (isLocalMediaSizeUnavailableError(error)) {
          return 0;
        }
        throw error;
      });
      const source = size > 0
        ? createLocalMediaMediabunnyRangeSource(sourceUrl, mediabunny, size)
        : await createLocalMediaMediabunnyStreamSource(sourceUrl, mediabunny);
      return {
        input: new mediabunny.Input({
          formats: mediabunny.ALL_FORMATS,
          source
        }),
        sourceMode: size > 0 ? "range" : "stream",
        size
      };
    }

    async function createStoredLocalMediaMediabunnyInput(message = {}, mediabunny) {
      const key = String(message.localMediaFileKey || "").trim();
      if (!key) {
        return null;
      }
      const files = globalThis.FuguangLocalMediaFiles;
      if (!files?.getStoredLocalMediaFile) {
        throw new Error("本地媒体文件授权模块未加载，请重新加载扩展后重试。");
      }
      if (typeof mediabunny.BlobSource !== "function") {
        throw new Error("本地媒体文件随机读取模块不可用，请重新加载扩展后重试。");
      }
      let stored;
      try {
        stored = await files.getStoredLocalMediaFile(key);
      } catch (error) {
        throw new Error(`本地媒体文件授权读取失败：${error.message || String(error)}`);
      }
      const file = stored?.file;
      if (!file || typeof file.size !== "number" ||
          (typeof Blob === "function" && !(file instanceof Blob))) {
        throw new Error("本地媒体文件授权结果无效，请点击重新抽取并重新选择当前文件。");
      }
      validateStoredLocalMediaFile(message, file);
      return {
        input: new mediabunny.Input({
          formats: mediabunny.ALL_FORMATS,
          source: new mediabunny.BlobSource(file, {
            maxCacheSize: LOCAL_MEDIA_DEMUX_CACHE_BYTES,
            useStreamReader: false
          })
        }),
        sourceMode: "blob",
        size: file.size || Number(message.localMediaFileSize || 0) || 0,
        fileName: file.name || message.localMediaFileName || ""
      };
    }

    function validateStoredLocalMediaFile(message = {}, file) {
      const expectedName = String(message.localMediaFileName || "").trim();
      const actualName = String(file?.name || "").trim();
      if (expectedName && actualName && expectedName !== actualName) {
        throw new Error("本地媒体文件授权结果与当前播放器不一致，请重新选择当前文件。");
      }
      const expectedSize = Number(message.localMediaFileSize || 0) || 0;
      if (expectedSize > 0 && Number(file?.size || 0) !== expectedSize) {
        throw new Error("本地媒体文件授权结果与当前播放器不一致，请重新选择当前文件。");
      }
      const expectedLastModified = Number(message.localMediaFileLastModified || 0) || 0;
      const actualLastModified = Number(file?.lastModified || 0) || 0;
      if (expectedLastModified > 0 && actualLastModified > 0 && actualLastModified !== expectedLastModified) {
        throw new Error("本地媒体文件授权结果与当前播放器不一致，请重新选择当前文件。");
      }
    }

    function localMediaInputProgressMessage(inputInfo = {}) {
      if (inputInfo.sourceMode === "stream") {
        return "正在流式解析本地媒体音轨";
      }
      if (inputInfo.sourceMode === "blob") {
        return "正在读取已授权本地媒体音轨";
      }
      if (inputInfo.sourceMode === "url-range") {
        return "正在通过 Range 读取直连媒体音轨";
      }
      return "正在解析本地媒体音轨";
    }

    function createLocalMediaMediabunnySource(sourceUrl, mediabunny) {
      return createLocalMediaMediabunnyRangeSource(sourceUrl, mediabunny);
    }

    function createLocalMediaMediabunnyRangeSource(sourceUrl, mediabunny, knownSize = 0) {
      return new mediabunny.CustomSource({
        getSize: () => knownSize > 0 ? knownSize : getLocalMediaSourceSize(sourceUrl),
        read: (start, end) => fetchLocalMediaRange(sourceUrl, start, end),
        maxCacheSize: LOCAL_MEDIA_DEMUX_CACHE_BYTES,
        prefetchProfile: "fileSystem"
      });
    }

    async function createLocalMediaMediabunnyStreamSource(sourceUrl, mediabunny) {
      let response;
      try {
        response = await fetch(sourceUrl);
      } catch (error) {
        throw new Error(`本地媒体文件读取失败：${error.message || String(error)}。请确认文件仍可访问，并在扩展详情中允许访问文件网址。`);
      }
      if (!localMediaStreamResponseLooksReadable(response)) {
        throw new Error(`本地媒体流式读取失败：HTTP ${response?.status || 0}`);
      }
      return new mediabunny.ReadableStreamSource(response.body, {
        maxCacheSize: LOCAL_MEDIA_DEMUX_CACHE_BYTES
      });
    }

    async function getLocalMediaSourceSize(sourceUrl) {
      let response;
      try {
        response = await fetch(sourceUrl, {
          headers: { Range: "bytes=0-0" }
        });
      } catch (error) {
        throw new Error(`本地媒体文件读取失败：${error.message || String(error)}。请确认文件仍可访问，并在扩展详情中允许访问文件网址。`);
      }
      try {
        const contentRange = parseContentRangeHeader(
          response.headers?.get?.("content-range") || response.headers?.get?.("Content-Range") || ""
        );
        if (contentRange?.total && Number.isFinite(contentRange.total)) {
          return contentRange.total;
        }
        if (Number(response?.status || 0) !== 206) {
          throw createLocalMediaSizeUnavailableError();
        }
        throw createLocalMediaSizeUnavailableError();
      } finally {
        response.body?.cancel?.().catch?.(() => {});
      }
    }

    function createLocalMediaSizeUnavailableError() {
      const error = new Error("浏览器没有返回本地文件大小。");
      error.localMediaSizeUnavailable = true;
      return error;
    }

    function isLocalMediaSizeUnavailableError(error) {
      return Boolean(error?.localMediaSizeUnavailable) ||
        /浏览器没有返回本地文件大小/.test(String(error?.message || error || ""));
    }

    async function fetchLocalMediaRange(sourceUrl, start, end) {
      const offset = Math.max(0, Math.floor(Number(start) || 0));
      const endExclusive = Math.max(offset + 1, Math.floor(Number(end) || 0));
      const length = endExclusive - offset;
      let response;
      try {
        response = await fetch(sourceUrl, {
          headers: { Range: `bytes=${offset}-${endExclusive - 1}` }
        });
      } catch (error) {
        throw new Error(`本地媒体文件读取失败：${error.message || String(error)}。请确认文件仍可访问，并在扩展详情中允许访问文件网址。`);
      }
      if (!localMediaRangeResponseLooksReadable(response)) {
        throw new Error(`本地媒体分片读取失败：HTTP ${response?.status || 0}`);
      }
      const contentRange = parseContentRangeHeader(
        response.headers?.get?.("content-range") || response.headers?.get?.("Content-Range") || ""
      );
      if (response.status === 206) {
        if (contentRange && (contentRange.offset !== offset || contentRange.endExclusive !== endExclusive)) {
          throw new Error("浏览器返回的本地文件 Range 与请求不一致。");
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== length) {
          throw new Error("浏览器未按 Range 返回本地文件片段。");
        }
        return new Uint8Array(buffer);
      }
      const contentLength = Number.parseInt(
        response.headers?.get?.("content-length") || response.headers?.get?.("Content-Length") || "",
        10
      );
      if (offset === 0 && Number.isFinite(contentLength) && contentLength <= length) {
        const buffer = await readLocalMediaResponseWithLimit(response, length);
        return new Uint8Array(buffer);
      }
      response.body?.cancel?.().catch?.(() => {});
      throw new Error("浏览器没有按 Range 返回本地文件片段。");
    }

    function localMediaRangeResponseLooksReadable(response) {
      return Boolean(response?.ok) ||
        Number(response?.status || 0) === 206 ||
        (Number(response?.status || 0) === 0 && typeof response?.arrayBuffer === "function");
    }

    function localMediaStreamResponseLooksReadable(response) {
      return Boolean(response?.body?.getReader) && (
        Boolean(response?.ok) ||
        Number(response?.status || 0) === 0 ||
        Number(response?.status || 0) === 200
      );
    }

    async function readLocalMediaResponseWithLimit(response, maxBytes) {
      if (!response.body?.getReader) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > maxBytes) {
          throw new Error("浏览器返回的本地文件片段超过请求范围。");
        }
        return buffer;
      }
      const reader = response.body.getReader();
      const parts = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
          total += bytes.byteLength;
          if (total > maxBytes) {
            throw new Error("浏览器返回的本地文件片段超过请求范围。");
          }
          parts.push(bytes);
        }
      } finally {
        reader.cancel?.().catch?.(() => {});
      }
      const output = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
      }
      return output.buffer;
    }

    function normalizeLocalMediaLogicalChunkSeconds(value, options = {}) {
      return normalizeHlsLogicalChunkSeconds(value, options);
    }

    async function resolveLocalMediaAudioDuration(input, audioTrack, message = {}) {
      const fallback = pickFiniteNumber(message.duration, 0);
      if (fallback) {
        if (shouldValidateLocalMediaSelectedFileDuration(message)) {
          const metadataDuration = await input.getDurationFromMetadata([audioTrack], { skipLiveWait: true }).catch(() => null);
          assertLocalMediaDurationMatches(fallback, metadataDuration);
        }
        return fallback;
      }
      const metadataDuration = await input.getDurationFromMetadata([audioTrack], { skipLiveWait: true }).catch(() => null);
      const computedDuration = metadataDuration
        ? null
        : await input.computeDuration([audioTrack], { skipLiveWait: true }).catch(() => null);
      return pickFiniteNumber(metadataDuration, computedDuration, 0);
    }

    function shouldValidateLocalMediaSelectedFileDuration(message) {
      return Boolean(String(message?.localMediaFileKey || "").trim());
    }

    function assertLocalMediaDurationMatches(expectedDuration, actualDuration) {
      const expected = pickFiniteNumber(expectedDuration, 0);
      const actual = pickFiniteNumber(actualDuration, 0);
      if (!expected || !actual || !localMediaDurationsMismatch(expected, actual)) {
        return;
      }
      throw new Error(
        `本地媒体文件时长与当前播放器时长不一致：当前播放器 ${formatLocalMediaDuration(expected)}，` +
        `已授权文件 ${formatLocalMediaDuration(actual)}。请重新抽取并选择当前正在播放的文件。`
      );
    }

    function localMediaDurationsMismatch(expectedDuration, actualDuration) {
      const difference = Math.abs(Number(actualDuration) - Number(expectedDuration));
      return difference > localMediaDurationToleranceSeconds(expectedDuration, actualDuration);
    }

    function localMediaDurationToleranceSeconds(expectedDuration, actualDuration) {
      const duration = Math.max(Math.abs(Number(expectedDuration) || 0), Math.abs(Number(actualDuration) || 0));
      const scaled = duration * LOCAL_MEDIA_DURATION_TOLERANCE_RATIO;
      return Math.max(
        LOCAL_MEDIA_DURATION_MIN_TOLERANCE_SECONDS,
        Math.min(LOCAL_MEDIA_DURATION_MAX_TOLERANCE_SECONDS, scaled)
      );
    }

    function formatLocalMediaDuration(seconds) {
      return `${Math.round((Number(seconds) || 0) * 1000) / 1000} 秒`;
    }

    function buildLocalMediaLogicalChunkSpecs(duration, logicalChunkSeconds) {
      const totalDuration = pickFiniteNumber(duration, 0);
      const coreSeconds = normalizeLocalMediaLogicalChunkSeconds(logicalChunkSeconds);
      if (!totalDuration || !coreSeconds) {
        return [];
      }
      const overlap = Math.min(WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS, Math.max(0, coreSeconds / 3));
      const specs = [];
      for (let coreStart = 0, index = 0; coreStart < totalDuration - 0.001; coreStart += coreSeconds, index += 1) {
        const coreEnd = Math.min(totalDuration, coreStart + coreSeconds);
        const start = roundHlsSecond(Math.max(0, coreStart - overlap));
        const end = roundHlsSecond(Math.min(totalDuration, coreEnd + overlap));
        specs.push({
          index,
          start,
          end,
          duration: Math.max(0, end - start),
          coreStart: roundHlsSecond(coreStart),
          coreEnd: roundHlsSecond(coreEnd),
          coreDuration: Math.max(0, coreEnd - coreStart)
        });
      }
      return specs;
    }

    function selectLocalMediaAudioOutputSpec(mediabunny, codec) {
      const candidates = [
        { Class: mediabunny.AdtsOutputFormat, options: undefined, extension: "aac", mime: "audio/aac" },
        { Class: mediabunny.Mp3OutputFormat, options: { xingHeader: false }, extension: "mp3", mime: "audio/mpeg" },
        { Class: mediabunny.FlacOutputFormat, options: undefined, extension: "flac", mime: "audio/flac" },
        { Class: mediabunny.OggOutputFormat, options: undefined, extension: "ogg", mime: "audio/ogg" },
        { Class: mediabunny.WavOutputFormat, options: undefined, extension: "wav", mime: "audio/wav" },
        { Class: mediabunny.MpegTsOutputFormat, options: undefined, extension: "ts", mime: "video/MP2T" },
        { Class: mediabunny.Mp4OutputFormat, options: undefined, extension: "m4a", mime: "audio/mp4" },
        { Class: mediabunny.WebMOutputFormat, options: undefined, extension: "webm", mime: "video/webm" },
        { Class: mediabunny.MkvOutputFormat, options: undefined, extension: "mka", mime: "audio/x-matroska" }
      ];
      for (const candidate of candidates) {
        if (typeof candidate.Class !== "function") {
          continue;
        }
        const format = new candidate.Class(candidate.options);
        if (!format.getSupportedCodecs?.().includes(codec)) {
          continue;
        }
        return {
          ...candidate,
          createFormat: () => new candidate.Class(candidate.options)
        };
      }
      return null;
    }

    async function muxLocalMediaAudioWindow(mediabunny, sink, codec, decoderConfig, outputSpec, spec) {
      const startPacket = await sink.getPacket(Math.max(0, spec.start)).catch(() => null) ||
        await sink.getFirstPacket().catch(() => null);
      if (!startPacket) {
        throw new Error("本地媒体音轨没有可读取的音频 packet。");
      }
      const session = await createLocalMediaMuxSession(mediabunny, codec, outputSpec, spec);
      for await (const packet of sink.packets(startPacket)) {
        const packetStart = pickFiniteNumber(packet.timestamp, 0);
        const packetDuration = Math.max(0, Number(packet.duration || 0) || 0);
        const packetEnd = packetStart + packetDuration;
        if (packetStart >= spec.end - 0.0001) {
          break;
        }
        if (packetEnd <= spec.start + 0.0001 || packet.isMetadataOnly) {
          continue;
        }
        await addPacketToLocalMediaMuxSession(session, packet, decoderConfig);
      }
      if (!session.packetCount) {
        session.source.close();
        await session.output.cancel?.().catch?.(() => {});
        return null;
      }
      return finalizeLocalMediaMuxSession(session);
    }

    async function extractLocalMediaAudioChunksByRange(message, mediabunny, sink, codec, decoderConfig, outputSpec, specs) {
      const chunks = [];
      const recyclePolicy = createHlsWebFfmpegRecyclePolicy(message.webFfmpegPerformance);
      for (let index = 0; index < specs.length; index += 1) {
        const spec = specs[index];
        if (message.webFfmpegUrl && recyclePolicy.shouldRecycleBefore(index)) {
          reportWebFfmpegExtractionProgress(message, {
            phase: "ffmpeg",
            percent: localMediaExtractionPercent(index, 0, specs.length),
            internalChunksDone: index,
            internalChunksTotal: specs.length,
            readySeconds: Math.round(spec.coreStart),
            message: `正在重置 Web FFmpeg 工作区，准备处理本地音频分片 ${index + 1}/${specs.length}`
          });
          await reloadWebFfmpegFrame(message.webFfmpegUrl);
          recyclePolicy.noteRecycle(index);
        }
        const encoded = await localMediaOverride("muxLocalMediaAudioWindow", muxLocalMediaAudioWindow)(
          mediabunny,
          sink,
          codec,
          decoderConfig,
          outputSpec,
          spec
        );
        if (!encoded) {
          continue;
        }
        const chunk = await extractLocalMediaAudioWindowWithWebFfmpegWithRetry(
          message,
          recyclePolicy,
          encoded,
          spec,
          index,
          specs.length
        );
        if (chunk) {
          chunks.push(chunk);
        }
      }
      return chunks;
    }

    async function extractLocalMediaAudioChunksSequentially(message, mediabunny, sink, codec, decoderConfig, outputSpec, specs) {
      const chunks = [];
      const active = [];
      let nextSpecIndex = 0;

      async function openSpecsForPacket(packetEnd) {
        while (nextSpecIndex < specs.length && packetEnd > specs[nextSpecIndex].start + 0.0001) {
          active.push(await createLocalMediaMuxSession(mediabunny, codec, outputSpec, specs[nextSpecIndex]));
          nextSpecIndex += 1;
        }
      }

      async function finalizeReady(packetStart) {
        for (let index = 0; index < active.length;) {
          const session = active[index];
          if (packetStart < session.spec.end - 0.0001) {
            index += 1;
            continue;
          }
          active.splice(index, 1);
          const chunk = await finalizeAndExtractLocalMediaMuxSession(message, session, specs.length);
          if (chunk) {
            chunks.push(chunk);
          }
        }
      }

      for await (const packet of sink.packets()) {
        if (packet.isMetadataOnly) {
          continue;
        }
        const packetStart = pickFiniteNumber(packet.timestamp, 0);
        const packetDuration = Math.max(0, Number(packet.duration || 0) || 0);
        const packetEnd = packetStart + packetDuration;
        await openSpecsForPacket(packetEnd);
        for (const session of active) {
          if (packetEnd <= session.spec.start + 0.0001 || packetStart >= session.spec.end - 0.0001) {
            continue;
          }
          await addPacketToLocalMediaMuxSession(session, packet, decoderConfig);
        }
        await finalizeReady(packetStart);
      }
      await openSpecsForPacket(Number.POSITIVE_INFINITY);
      for (const session of active.splice(0)) {
        const chunk = await finalizeAndExtractLocalMediaMuxSession(message, session, specs.length);
        if (chunk) {
          chunks.push(chunk);
        }
      }
      return chunks.sort((left, right) => left.index - right.index);
    }

    async function createLocalMediaMuxSession(mediabunny, codec, outputSpec, spec) {
      const target = new mediabunny.BufferTarget();
      const output = new mediabunny.Output({
        format: outputSpec.createFormat(),
        target
      });
      const source = new mediabunny.EncodedAudioPacketSource(codec);
      output.addAudioTrack(source);
      await output.start();
      return {
        spec,
        outputSpec,
        target,
        output,
        source,
        packetCount: 0
      };
    }

    async function addPacketToLocalMediaMuxSession(session, packet, decoderConfig) {
      const packetStart = pickFiniteNumber(packet.timestamp, 0);
      const shifted = cloneLocalMediaEncodedPacket(packet, {
        timestamp: Math.max(0, packetStart - session.spec.start),
        sequenceNumber: session.packetCount
      });
      await session.source.add(
        shifted,
        session.packetCount === 0 && decoderConfig ? { decoderConfig } : undefined
      );
      session.packetCount += 1;
    }

    async function finalizeLocalMediaMuxSession(session) {
      session.source.close();
      await session.output.finalize();
      const buffer = session.target.buffer;
      if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || !session.packetCount) {
        throw new Error("本地媒体音轨分片封装结果为空。");
      }
      return {
        buffer,
        name: `local-media-${String(session.spec.index + 1).padStart(3, "0")}.${session.outputSpec.extension}`,
        mime: session.outputSpec.mime,
        packetCount: session.packetCount,
        spec: session.spec
      };
    }

    async function finalizeAndExtractLocalMediaMuxSession(message, session, groupCount) {
      if (!session.packetCount) {
        session.source.close();
        await session.output.cancel?.().catch?.(() => {});
        return null;
      }
      const encoded = await finalizeLocalMediaMuxSession(session);
      return extractLocalMediaAudioWindowWithWebFfmpeg(
        message,
        encoded,
        session.spec,
        session.spec.index,
        groupCount
      );
    }

    async function extractLocalMediaAudioWindowWithWebFfmpegWithRetry(message, recyclePolicy, encoded, spec, index, groupCount) {
      try {
        return await extractLocalMediaAudioWindowWithWebFfmpeg(message, encoded, spec, index, groupCount);
      } catch (error) {
        if (!message.webFfmpegUrl) {
          throw error;
        }
        recyclePolicy?.noteFfmpegFailure?.();
        reportWebFfmpegExtractionProgress(message, {
          phase: "ffmpeg",
          percent: localMediaExtractionPercent(index, 0.9, groupCount),
          internalChunksDone: index,
          internalChunksTotal: groupCount,
          readySeconds: Math.round(spec.coreStart),
          message: `本地音频分片 ${index + 1}/${groupCount} 转码异常，正在重置 Web FFmpeg 后重试`
        });
        try {
          await reloadWebFfmpegFrame(message.webFfmpegUrl);
          recyclePolicy?.noteRecycle?.(index);
          return await extractLocalMediaAudioWindowWithWebFfmpeg(message, encoded, spec, index, groupCount);
        } catch (retryError) {
          throw new Error(`${retryError.message || retryError}（已重置 Web FFmpeg 后重试本地音频分片 ${index + 1}/${groupCount}，仍然失败；原错误：${error.message || error}）`);
        }
      }
    }

    function cloneLocalMediaEncodedPacket(packet, overrides = {}) {
      const data = packet.data instanceof Uint8Array
        ? new Uint8Array(packet.data)
        : new Uint8Array(packet.data || []);
      if (typeof packet.clone === "function") {
        return packet.clone({
          data,
          timestamp: overrides.timestamp,
          sequenceNumber: overrides.sequenceNumber
        });
      }
      return new packet.constructor(
        data,
        packet.type || "key",
        overrides.timestamp,
        packet.duration,
        overrides.sequenceNumber,
        packet.byteLength,
        packet.sideData
      );
    }

    async function extractLocalMediaAudioWindowWithWebFfmpeg(message, encoded, spec, index, groupCount) {
      const requestBuffer = cloneArrayBuffer(encoded.buffer);
      const result = await requestWebFfmpeg({
        app: WEB_FFMPEG_APP,
        type: "extract-audio",
        id: `extract-local-media-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        file: {
          name: encoded.name,
          mime: encoded.mime,
          buffer: requestBuffer
        },
        outputName: `local-media-${String(index + 1).padStart(3, "0")}.mp3`,
        options: {
          format: "mp3",
          duration: spec.duration
        }
      }, [requestBuffer], progress => {
        reportWebFfmpegExtractionProgress(message, {
          phase: "ffmpeg",
          percent: localMediaExtractionPercent(index, 0.5 + (Number(progress.percent || 0) / 100) * 0.4, groupCount),
          internalChunksDone: index,
          internalChunksTotal: groupCount,
          readySeconds: Math.round(spec.coreStart),
          message: progress.message
            ? `正在转码本地音频分片 ${index + 1}/${groupCount}：${progress.message}`
            : `正在转码本地音频分片 ${index + 1}/${groupCount}`
        });
      }, {
        jobId: String(message?.jobId || ""),
        runToken: String(message?.runToken || ""),
        signal: message?.abortSignal
      });
      const persisted = await persistWebFfmpegAudioResult(result, `${message.cacheNamespace || "local-media"}-${index}`);
      const file = persisted.file || persisted.chunks?.[0]?.file;
      if (!file) {
        return null;
      }
      const relativeSpeechIntervals = persisted.speechIntervalsReliable === false
        ? undefined
        : persisted.speechIntervals || persisted.chunks?.[0]?.speechIntervals;
      return {
        index,
        start: spec.start,
        end: spec.end,
        duration: spec.duration,
        coreStart: spec.coreStart,
        coreEnd: spec.coreEnd,
        coreDuration: spec.coreDuration,
        speechIntervals: offsetSpeechIntervals(relativeSpeechIntervals, spec.start),
        speechIntervalsReliable: persisted.speechIntervalsReliable === false || persisted.chunks?.[0]?.speechIntervalsReliable === false ? false : undefined,
        file,
        bytes: persisted.bytes || persisted.chunks?.[0]?.bytes || file.bytes || 0
      };
    }

    function cloneArrayBuffer(buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        return new Uint8Array(buffer || []).buffer;
      }
      return buffer.slice(0);
    }

    function localMediaExtractionPercent(index, ratio, total) {
      const count = Math.max(1, Number(total) || 1);
      const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
      return 4 + (((Math.max(0, Number(index) || 0) + safeRatio) / count) * 94);
    }

    function describeLocalMediaExtractionError(error) {
      const message = error?.message || String(error || "未知错误");
      if (/本地媒体/.test(message)) {
        return error;
      }
      return new Error(`本地媒体音轨分片抽取失败：${message}`);
    }

    return {
      shouldUseLocalMediaChunkedExtraction,
      extractLocalMediaAudioWithWebFfmpeg,
      createLocalMediaMediabunnyInput,
      createStoredLocalMediaMediabunnyInput,
      localMediaInputProgressMessage,
      createLocalMediaMediabunnySource,
      createLocalMediaMediabunnyRangeSource,
      createLocalMediaMediabunnyStreamSource,
      getLocalMediaSourceSize,
      createLocalMediaSizeUnavailableError,
      isLocalMediaSizeUnavailableError,
      fetchLocalMediaRange,
      localMediaRangeResponseLooksReadable,
      localMediaStreamResponseLooksReadable,
      readLocalMediaResponseWithLimit,
      normalizeLocalMediaLogicalChunkSeconds,
      resolveLocalMediaAudioDuration,
      buildLocalMediaLogicalChunkSpecs,
      selectLocalMediaAudioOutputSpec,
      muxLocalMediaAudioWindow,
      extractLocalMediaAudioChunksByRange,
      extractLocalMediaAudioChunksSequentially,
      createLocalMediaMuxSession,
      addPacketToLocalMediaMuxSession,
      finalizeLocalMediaMuxSession,
      finalizeAndExtractLocalMediaMuxSession,
      extractLocalMediaAudioWindowWithWebFfmpegWithRetry,
      cloneLocalMediaEncodedPacket,
      extractLocalMediaAudioWindowWithWebFfmpeg,
      cloneArrayBuffer,
      localMediaExtractionPercent,
      describeLocalMediaExtractionError
    };
  }

  globalThis.FuguangLocalMediaExtractor = {
    createLocalMediaExtractor
  };
})();
