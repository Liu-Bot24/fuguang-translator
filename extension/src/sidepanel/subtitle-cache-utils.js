(function(global) {
  function subtitleCacheSeed(normalizedPage, normalizedSource) {
    if (normalizedPage) {
      return `page:${normalizedPage}`;
    }
    if (normalizedSource) {
      return `source:${normalizedSource}`;
    }
    return "";
  }

  function subtitleCacheEntryMatchesContext(entry, context) {
    if (!entry?.transcript) {
      return false;
    }
    if (!subtitleCacheEntryMetadataMatchesContext(entry, context)) {
      return false;
    }
    const currentSource = normalizeMediaCacheUrl(context.sourceUrl);
    const entrySource = normalizeMediaCacheUrl(entry.sourceUrl);
    const currentPage = normalizeCacheUrl(context.pageUrl);
    const entryPage = normalizeCacheUrl(entry.pageUrl);
    if (currentPage && entryPage) {
      return currentPage === entryPage;
    }
    if (currentSource) {
      if (!(entrySource && entrySource === currentSource)) {
        return false;
      }
      return true;
    }
    return false;
  }

  function subtitleCacheEntryMatchesPageForClear(entry, normalizedPage) {
    return Boolean(
      entry?.id &&
      normalizedPage &&
      normalizeCacheUrl(entry.pageUrl) === normalizedPage
    );
  }

  function subtitleCacheEntryHasSameMediaIdentity(entry, context) {
    const currentSource = normalizeMediaCacheUrl(context.sourceUrl);
    const entrySource = normalizeMediaCacheUrl(entry.sourceUrl);
    return Boolean(currentSource && entrySource && currentSource === entrySource);
  }

  function subtitleCacheEntryMetadataMatchesContext(entry, context) {
    const metadata = entry?.transcript?.metadata;
    if (!metadata || typeof metadata !== "object") {
      return true;
    }
    const currentPage = normalizeCacheUrl(context.pageUrl);
    const entryPage = normalizeCacheUrl(entry.pageUrl);
    const metadataPage = normalizeCacheUrl(metadata.pageUrl || metadata.url || "");
    if (metadataPage) {
      if (currentPage && metadataPage !== currentPage) {
        return false;
      }
      if (entryPage && metadataPage !== entryPage) {
        return false;
      }
    }
    const currentSource = normalizeMediaCacheUrl(context.sourceUrl);
    const entrySource = normalizeMediaCacheUrl(entry.sourceUrl);
    const metadataSource = normalizeMediaCacheUrl(metadata.sourceUrl || metadata.mediaUrl || metadata.sourceUrlOriginal || "");
    if (metadataSource && !currentPage) {
      if (currentSource && metadataSource !== currentSource) {
        return false;
      }
      if (entrySource && metadataSource !== entrySource) {
        return false;
      }
    }
    return true;
  }

  function canUsePageOnlySubtitleCacheFallback(normalizedPage) {
    return isBilibiliVideoCachePage(normalizedPage);
  }

  function isBilibiliVideoCachePage(normalizedPage) {
    if (!normalizedPage) {
      return false;
    }
    try {
      const url = new URL(normalizedPage);
      return /(^|\.)bilibili\.com$/i.test(url.hostname) && /^\/video\/[A-Za-z0-9_-]+$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function subtitleCacheEntryTime(entry) {
    return Date.parse(entry?.updatedAt || entry?.createdAt || "") || 0;
  }

  function normalizeCacheUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.hash = "";
      normalizeBilibiliPageCacheUrl(url);
      for (const key of [...url.searchParams.keys()]) {
        if (isTrackingCacheQueryParam(key) || isSensitiveCacheQueryParam(key)) {
          url.searchParams.delete(key);
        }
      }
      url.searchParams.sort();
      return url.toString();
    } catch {
      return stripSensitiveQueryText(rawUrl, { removeTracking: true });
    }
  }

  function normalizeMediaCacheUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.hash = "";
      const bilibiliIdentity = getBilibiliMediaCacheIdentity(url);
      if (bilibiliIdentity) {
        return `bilibili:${bilibiliIdentity}`;
      }
      for (const key of [...url.searchParams.keys()]) {
        if (isTrackingCacheQueryParam(key) || isSensitiveCacheQueryParam(key)) {
          url.searchParams.delete(key);
        }
      }
      url.searchParams.sort();
      return url.toString();
    } catch {
      return stripSensitiveQueryText(rawUrl);
    }
  }

  function isTrackingCacheQueryParam(key) {
    return /^(utm_|spm_|vd_source$|from$|share_|fbclid$|gclid$)/i.test(String(key || ""));
  }

  function isSensitiveCacheQueryParam(key) {
    return /^(token$|access_?token$|auth(?:_key)?$|authorization$|signature$|sign$|sig$|policy$|key-pair-id$|awsaccesskeyid$|expires?$|expiration$|deadline$|timestamp$|ts$|nonce$|session(?:id)?$|sid$|x-amz-|x-oss-|x-goog-)/i.test(String(key || ""));
  }

  function stripSensitiveQueryText(rawUrl, { removeTracking = false } = {}) {
    const text = String(rawUrl || "").trim();
    const [withoutHash] = text.split("#");
    const queryStart = withoutHash.indexOf("?");
    if (queryStart < 0) {
      return withoutHash;
    }
    const base = withoutHash.slice(0, queryStart);
    const query = withoutHash.slice(queryStart + 1);
    const params = query.split("&").filter(Boolean).filter(part => {
      const key = decodeQueryKey(part.split("=")[0] || "");
      return !isSensitiveCacheQueryParam(key) && !(removeTracking && isTrackingCacheQueryParam(key));
    });
    params.sort();
    return params.length ? `${base}?${params.join("&")}` : base;
  }

  function decodeQueryKey(value) {
    try {
      return decodeURIComponent(String(value || "").replace(/\+/g, " "));
    } catch {
      return String(value || "");
    }
  }

  function normalizeBilibiliPageCacheUrl(url) {
    if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) {
      return;
    }
    const match = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/?$/);
    if (match) {
      url.pathname = `/video/${match[1]}`;
      const part = url.searchParams.get("p");
      url.search = "";
      if (part && /^\d+$/.test(part)) {
        url.searchParams.set("p", part);
      }
    }
  }

  function getBilibiliMediaCacheIdentity(url) {
    if (!isLikelyBilibiliMediaCacheUrl(url)) {
      return "";
    }
    const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
    const filenameMatch = filename.match(/^(\d+-\d+)-\d+\.(?:m4s|mp4)$/i);
    if (filenameMatch) {
      return filenameMatch[1];
    }
    const pathMatch = url.pathname.match(/\/upgcxcode\/(?:[^/]+\/){0,4}(\d+)(?:\/|$)/i);
    if (pathMatch) {
      return pathMatch[1];
    }
    const path = canonicalMediaCachePathname(url.pathname || "");
    return path ? `${url.hostname}${path}` : "";
  }

  function isLikelyBilibiliMediaCacheUrl(url) {
    return (
      /(?:^|\.)bilibili(?:video)?\.com$/i.test(url.hostname) ||
      /(?:^|\.)bilivideo\.(?:com|cn)$/i.test(url.hostname) ||
      /\/upgcxcode\//i.test(url.pathname)
    );
  }

  function canonicalMediaCachePathname(pathname) {
    return String(pathname || "")
      .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
      .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
      .replace(/(?:^|[-_/])\d{3,4}p(?=[-_/.]|$)/gi, "-{quality}")
      .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}")
      .replace(/-\d{5,6}(?=\.m4s$)/i, "-{track}");
  }

  async function sha256Text(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  Object.assign(global, {
    subtitleCacheSeed,
    subtitleCacheEntryMatchesContext,
    subtitleCacheEntryMatchesPageForClear,
    subtitleCacheEntryHasSameMediaIdentity,
    subtitleCacheEntryMetadataMatchesContext,
    canUsePageOnlySubtitleCacheFallback,
    isBilibiliVideoCachePage,
    subtitleCacheEntryTime,
    normalizeCacheUrl,
    normalizeMediaCacheUrl,
    isTrackingCacheQueryParam,
    isSensitiveCacheQueryParam,
    stripSensitiveQueryText,
    decodeQueryKey,
    normalizeBilibiliPageCacheUrl,
    getBilibiliMediaCacheIdentity,
    isLikelyBilibiliMediaCacheUrl,
    canonicalMediaCachePathname,
    sha256Text
  });
})(globalThis);
