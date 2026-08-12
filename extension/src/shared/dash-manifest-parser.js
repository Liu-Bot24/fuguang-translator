export const FuguangDashManifestParser = (() => {
  function parse(text, baseUrl = "") {
    const duration = parseIsoDuration(matchAttr(text, "mediaPresentationDuration"));
    const adaptationSets = [];
    for (const adaptationBlock of matchElements(text, "AdaptationSet")) {
      const adaptationAttrs = parseXmlAttributes(adaptationBlock.open);
      const adaptationBaseUrl = firstElementText(adaptationBlock.body, "BaseURL") || "";
      const contentType = String(adaptationAttrs.contentType || "").toLowerCase();
      const mimeType = String(adaptationAttrs.mimeType || "").toLowerCase();
      const role = inferDashRole({ contentType, mimeType, codecs: adaptationAttrs.codecs });
      const representations = [];
      for (const representationBlock of matchElements(adaptationBlock.body, "Representation")) {
        const representationAttrs = parseXmlAttributes(representationBlock.open);
        const representationBaseUrl = firstElementText(representationBlock.body, "BaseURL") || adaptationBaseUrl;
        const segmentTemplate = parseSegmentTemplate(representationBlock.body) || parseSegmentTemplate(adaptationBlock.body);
        representations.push({
          id: representationAttrs.id || "",
          role,
          mimeType: representationAttrs.mimeType || adaptationAttrs.mimeType || "",
          codecs: representationAttrs.codecs || adaptationAttrs.codecs || "",
          bandwidth: Number(representationAttrs.bandwidth || 0) || 0,
          width: Number(representationAttrs.width || adaptationAttrs.width || 0) || 0,
          height: Number(representationAttrs.height || adaptationAttrs.height || 0) || 0,
          baseUrl: resolveDashUrl(representationBaseUrl, baseUrl),
          segmentTemplate
        });
      }
      adaptationSets.push({
        role,
        mimeType: adaptationAttrs.mimeType || "",
        codecs: adaptationAttrs.codecs || "",
        representations
      });
    }
    return { duration, adaptationSets };
  }

  function parseSegmentTemplate(body) {
    const match = String(body || "").match(/<SegmentTemplate\b([^>]*)>([\s\S]*?)<\/SegmentTemplate>|<SegmentTemplate\b([^>]*)\/>/i);
    if (!match) {
      return null;
    }
    const attrs = parseXmlAttributes(match[1] || match[3] || "");
    const timelineBody = match[2] || "";
    return {
      initialization: attrs.initialization || "",
      media: attrs.media || "",
      startNumber: Number(attrs.startNumber || 1) || 1,
      timescale: Number(attrs.timescale || 1) || 1,
      duration: Number(attrs.duration || 0) || 0,
      timeline: parseSegmentTimeline(timelineBody)
    };
  }

  function expandRepresentationFragments(representation = {}, fallbackDuration = 0) {
    const template = representation.segmentTemplate || null;
    if (!template?.initialization || !template?.media) {
      return [];
    }
    const fragments = [];
    const initUrl = resolveDashUrl(
      expandSegmentTemplateUrl(template.initialization, representation, template.startNumber, 0),
      representation.baseUrl || ""
    );
    if (initUrl) {
      fragments.push({
        url: initUrl,
        segmentType: "init",
        role: representation.role || "unknown",
        duration: 0,
        start: 0,
        end: 0
      });
    }
    const mediaSegments = expandMediaSegments(representation, fallbackDuration);
    return [...fragments, ...mediaSegments];
  }

  function expandMediaSegments(representation = {}, fallbackDuration = 0) {
    const template = representation.segmentTemplate || null;
    if (!template?.media) {
      return [];
    }
    const timescale = Number(template.timescale || 1) || 1;
    const startNumber = Number(template.startNumber || 1) || 1;
    const timeline = Array.isArray(template.timeline) ? template.timeline : [];
    const segments = [];
    if (timeline.length) {
      let number = startNumber;
      let cursorUnits = Number(timeline[0]?.t || 0) || 0;
      for (let index = 0; index < timeline.length; index += 1) {
        const item = timeline[index] || {};
        if (Number.isFinite(Number(item.t)) && Number(item.t) > 0) {
          cursorUnits = Number(item.t);
        }
        const durationUnits = Number(item.d || 0) || 0;
        if (durationUnits <= 0) {
          continue;
        }
        const repeat = normalizeTimelineRepeat(item.r, cursorUnits, durationUnits, timeline[index + 1], fallbackDuration, timescale);
        for (let offset = 0; offset <= repeat; offset += 1) {
          segments.push(createMediaSegment(
            representation,
            template,
            number,
            cursorUnits,
            cursorUnits / timescale,
            durationUnits / timescale
          ));
          number += 1;
          cursorUnits += durationUnits;
        }
      }
      return segments;
    }
    const segmentDuration = Number(template.duration || 0) / timescale;
    const totalDuration = Number(fallbackDuration || 0) || 0;
    if (segmentDuration <= 0 || totalDuration <= 0) {
      return [];
    }
    const count = Math.ceil(totalDuration / segmentDuration);
    for (let index = 0; index < count; index += 1) {
      const start = index * segmentDuration;
      const duration = Math.min(segmentDuration, Math.max(0, totalDuration - start));
      if (duration > 0) {
        segments.push(createMediaSegment(
          representation,
          template,
          startNumber + index,
          index * Number(template.duration || 0),
          start,
          duration
        ));
      }
    }
    return segments;
  }

  function normalizeTimelineRepeat(value, cursorUnits, durationUnits, nextItem, fallbackDuration, timescale) {
    const repeat = Number(value || 0) || 0;
    if (repeat >= 0) {
      return repeat;
    }
    const nextStart = Number(nextItem?.t || 0) || 0;
    if (nextStart > cursorUnits) {
      return Math.max(0, Math.ceil((nextStart - cursorUnits) / durationUnits) - 1);
    }
    const fallbackUnits = Number(fallbackDuration || 0) * (Number(timescale || 1) || 1);
    if (fallbackUnits > cursorUnits) {
      return Math.max(0, Math.ceil((fallbackUnits - cursorUnits) / durationUnits) - 1);
    }
    return 0;
  }

  function createMediaSegment(representation, template, number, time, start, duration) {
    return {
      url: resolveDashUrl(
        expandSegmentTemplateUrl(template.media, representation, number, time),
        representation.baseUrl || ""
      ),
      segmentType: "media",
      role: representation.role || "unknown",
      duration,
      start,
      end: start + duration
    };
  }

  function expandSegmentTemplateUrl(value, representation = {}, number = 1, time = 0) {
    const escapedDollar = "\u0000";
    return String(value || "")
      .replace(/\$\$/g, escapedDollar)
      .replace(/\$RepresentationID\$/g, String(representation.id || ""))
      .replace(/\$Bandwidth\$/g, String(representation.bandwidth || ""))
      .replace(/\$Number(?:%0(\d+)d)?\$/g, (_match, width) => formatSegmentTemplateNumber(number, width))
      .replace(/\$Time(?:%0(\d+)d)?\$/g, (_match, width) => formatSegmentTemplateNumber(time, width))
      .replaceAll(escapedDollar, "$");
  }

  function formatSegmentTemplateNumber(value, width = 0) {
    const text = String(Number(value) || 0);
    const size = Number(width || 0) || 0;
    return size > 0 ? text.padStart(size, "0") : text;
  }

  function parseSegmentTimeline(body) {
    const timeline = [];
    const timelineMatch = String(body || "").match(/<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/i);
    if (!timelineMatch) {
      return timeline;
    }
    for (const segmentMatch of timelineMatch[1].matchAll(/<S\b([^>]*)\/?>/gi)) {
      const attrs = parseXmlAttributes(segmentMatch[1]);
      timeline.push({
        t: Number(attrs.t || 0) || 0,
        d: Number(attrs.d || 0) || 0,
        r: Number(attrs.r || 0) || 0
      });
    }
    return timeline;
  }

  function inferDashRole({ contentType = "", mimeType = "", codecs = "" } = {}) {
    const text = `${contentType} ${mimeType} ${codecs}`.toLowerCase();
    if (text.includes("audio") || /(?:mp4a|opus|vorbis|flac)/i.test(text)) {
      return "audio";
    }
    if (text.includes("video") || /(?:avc|hvc|hev|vp8|vp9|av01)/i.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function matchElements(text, tagName) {
    const items = [];
    const pattern = new RegExp(`<${tagName}\\b([^>]*?)\\/>|<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
    let match;
    while ((match = pattern.exec(String(text || "")))) {
      items.push({ open: match[1] || match[2] || "", body: match[3] || "" });
    }
    return items;
  }

  function firstElementText(text, tagName) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = String(text || "").match(pattern);
    return match ? decodeXmlEntities(match[1].trim()) : "";
  }

  function parseXmlAttributes(value) {
    const attrs = {};
    const pattern = /([:\w-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
    let match;
    while ((match = pattern.exec(String(value || "")))) {
      attrs[match[1]] = decodeXmlEntities(String(match[2] || "").slice(1, -1));
    }
    return attrs;
  }

  function matchAttr(text, attrName) {
    const match = String(text || "").match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i"));
    return match?.[1] || "";
  }

  function parseIsoDuration(value) {
    const match = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (!match) {
      return 0;
    }
    return (Number(match[1] || 0) * 86400) +
      (Number(match[2] || 0) * 3600) +
      (Number(match[3] || 0) * 60) +
      Number(match[4] || 0);
  }

  function resolveDashUrl(value, baseUrl = "") {
    try {
      return new URL(String(value || ""), baseUrl || undefined).href;
    } catch {
      return String(value || "");
    }
  }

  function decodeXmlEntities(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function isUnsupportedWebmOpusRepresentation(representation = {}) {
    return representationContainerFamily(representation) === "webm-ogg";
  }

  function representationContainerFamily(representation = {}) {
    const template = representation.segmentTemplate || {};
    const text = [
      representation.mimeType,
      representation.codecs,
      representation.baseUrl,
      template.initialization,
      template.media
    ].map(value => String(value || "").toLowerCase()).join(" ");
    const mp4Container = /(?:mp4|m4a|m4s|cmf|cmfa|cmfv|iso\.segment)/.test(text);
    const webmOrOggContainer = /(?:webm|weba|ogg|oga)/.test(text) ||
      (!mp4Container && /(?:^|[\s,])opus(?:[\s,]|$)/.test(text));
    if (webmOrOggContainer && !mp4Container) {
      return "webm-ogg";
    }
    if (mp4Container) {
      return "mp4";
    }
    return "unknown";
  }

  function fragmentsContainUnsupportedWebmOpus(fragments = []) {
    return (Array.isArray(fragments) ? fragments : []).some(fragment => {
      const text = [
        fragment.url,
        fragment.name,
        fragment.mimeType,
        fragment.contentType,
        fragment.codec,
        fragment.codecs
      ].flat().map(value => String(value || "").toLowerCase()).join(" ");
      const mp4Container = /(?:mp4|m4a|m4s|cmf|cmfa|cmfv|iso\.segment)/.test(text);
      const webmOrOggContainer = /(?:webm|weba|ogg|oga)/.test(text) ||
        (!mp4Container && /(?:^|[\s,])opus(?:[\s,]|$)/.test(text));
      return webmOrOggContainer && !mp4Container;
    });
  }

  return {
    expandRepresentationFragments,
    fragmentsContainUnsupportedWebmOpus,
    isUnsupportedWebmOpusRepresentation,
    parse
  };
})();
