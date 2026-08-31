export const FuguangMediaHeaderRules = (() => {
  const MEDIA_HEADER_RULE_ID_BASE = 250000;
  const MEDIA_HEADER_RULE_ID_LIMIT = 10000;
  const MEDIA_HEADER_RULE_STATE_KEY = "liushengMediaHeaderRuleStateV2";
  const LEGACY_MEDIA_HEADER_RULE_STATE_KEY = "liushengMediaHeaderRuleStateV1";
  const NON_TAB_REQUEST_ID = -1;
  let nextMediaHeaderRuleId = 0;
  let fallbackState = createEmptyState();
  let stateLock = Promise.resolve();
  const mediaHeaderRuleSessions = new Map();

  async function withMediaRequestHeaderRules(sourceUrl, pageUrl, task, sessionKey = "") {
    const acquired = await acquireMediaHeaderLease({
      sourceUrls: sourceUrl,
      pageUrl,
      jobId: String(sessionKey || ""),
      runToken: ""
    });
    if (!acquired.applied || !acquired.lease) {
      return task();
    }
    try {
      return await task(acquired.lease);
    } finally {
      await releaseMediaHeaderLease(acquired.lease).catch(() => {});
    }
  }

  async function acquireMediaHeaderLease(options = {}) {
    const input = mediaHeaderRuleInput(options.sourceUrls ?? options.sourceUrl, options.pageUrl);
    if (!input || !chrome.declarativeNetRequest?.updateSessionRules) {
      return { applied: false, reason: "not-required", lease: null };
    }
    const identity = {
      jobId: String(options.jobId || options.sessionId || ""),
      runToken: String(options.runToken || "")
    };
    return withStateLock(async () => ({
      applied: true,
      lease: await installOwnedLease(input, identity)
    }));
  }

  async function releaseMediaHeaderLease(value = {}) {
    const lease = normalizeLease(value);
    if (!lease) {
      return { released: false, retryable: false, reason: "invalid-lease" };
    }
    return withStateLock(() => releaseOwnedLease(lease));
  }

  async function reconcileMediaHeaderLeases(options = {}) {
    const activeLeaseTokens = new Set((Array.isArray(options.activeLeases) ? options.activeLeases : [])
      .map(value => normalizeLease(value)?.leaseToken)
      .filter(Boolean));
    const offscreenPresent = Boolean(options.offscreenPresent);
    const queryAuthoritative = Boolean(options.queryAuthoritative);
    return withStateLock(async () => {
      let state;
      let installedRules;
      try {
        state = await readState();
        installedRules = await getSessionRules();
      } catch {
        return {
          removedRuleIds: [],
          retainedLeaseTokens: [],
          failedRuleIds: [],
          deferred: true,
          reason: "state-unavailable"
        };
      }
      const installedById = new Map(installedRules.map(rule => [Number(rule.id), rule]));
      const removedRuleIds = [];
      const failedRuleIds = [];
      const retainedLeaseTokens = [];
      let stateChanged = false;

      for (const [leaseToken, storedValue] of Object.entries(state.owners)) {
        const lease = normalizeLease(storedValue, leaseToken);
        if (!lease) {
          delete state.owners[leaseToken];
          deleteSessionsForLease(state, leaseToken);
          stateChanged = true;
          continue;
        }
        if (!installedById.has(lease.ruleId)) {
          delete state.owners[leaseToken];
          deleteSessionsForLease(state, leaseToken);
          clearMemorySession(lease);
          stateChanged = true;
          continue;
        }
        if (activeLeaseTokens.has(leaseToken)) {
          retainedLeaseTokens.push(leaseToken);
          continue;
        }
        if (offscreenPresent && !queryAuthoritative) {
          retainedLeaseTokens.push(leaseToken);
          continue;
        }
        try {
          await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [lease.ruleId] });
          removedRuleIds.push(lease.ruleId);
          installedById.delete(lease.ruleId);
          delete state.owners[leaseToken];
          deleteSessionsForLease(state, leaseToken);
          clearMemorySession(lease);
          stateChanged = true;
        } catch {
          failedRuleIds.push(lease.ruleId);
          retainedLeaseTokens.push(leaseToken);
        }
      }

      if (!offscreenPresent || queryAuthoritative) {
        const ownedRuleIds = new Set(Object.values(state.owners)
          .map(value => normalizeLease(value)?.ruleId)
          .filter(Number.isFinite));
        for (const rule of installedRules) {
          const ruleId = Number(rule?.id);
          if (!isReservedRuleId(ruleId) || ownedRuleIds.has(ruleId) || removedRuleIds.includes(ruleId)) {
            continue;
          }
          try {
            await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
            removedRuleIds.push(ruleId);
          } catch {
            failedRuleIds.push(ruleId);
          }
        }
      }

      let metadataPending = false;
      if (stateChanged) {
        try {
          await writeState(state);
        } catch {
          metadataPending = true;
        }
      }
      return {
        removedRuleIds: [...new Set(removedRuleIds)].sort((left, right) => left - right),
        retainedLeaseTokens: [...new Set(retainedLeaseTokens)].sort(),
        failedRuleIds: [...new Set(failedRuleIds)].sort((left, right) => left - right),
        deferred: offscreenPresent && !queryAuthoritative,
        ...(offscreenPresent && !queryAuthoritative ? { reason: "active-query-unavailable" } : {}),
        metadataPending
      };
    });
  }

  function buildMediaHeaderRules(sourceUrl, pageUrl) {
    const input = mediaHeaderRuleInput(sourceUrl, pageUrl);
    if (!input) {
      return [];
    }
    const id = MEDIA_HEADER_RULE_ID_BASE + (nextMediaHeaderRuleId = (nextMediaHeaderRuleId + 1) % MEDIA_HEADER_RULE_ID_LIMIT);
    return [buildMediaHeaderRule(id, input.pageHref, input.pageOrigin, input.domains)];
  }

  function mediaHeaderRuleInput(sourceUrl, pageUrl) {
    let page;
    try {
      page = new URL(String(pageUrl || ""));
    } catch {
      return null;
    }
    if (!["http:", "https:"].includes(page.protocol)) {
      return null;
    }
    const domains = mediaHeaderRuleDomainsFromUrls(sourceUrl);
    if (!domains.length) {
      return null;
    }
    return { pageHref: page.href, pageOrigin: page.origin, domains };
  }

  function buildMediaHeaderRule(id, pageHref, pageOrigin, domains) {
    return {
      id,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "referer", operation: "set", value: pageHref },
          { header: "origin", operation: "set", value: pageOrigin }
        ]
      },
      condition: {
        requestDomains: [...domains].sort(),
        resourceTypes: ["xmlhttprequest", "media", "other"],
        tabIds: [NON_TAB_REQUEST_ID]
      }
    };
  }

  function mediaHeaderRuleDomainsFromUrls(sourceUrls) {
    const urls = Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls];
    const domains = new Set();
    for (const sourceUrl of urls) {
      try {
        const source = new URL(String(sourceUrl || ""));
        if (["http:", "https:"].includes(source.protocol) && source.hostname) {
          domains.add(source.hostname.toLowerCase());
        }
      } catch {
        // Malformed child playlist or segment URLs will surface through the fetch path.
      }
    }
    return [...domains].sort();
  }

  async function updateMediaRequestHeaderRuleDomains(sessionKey, sourceUrls) {
    const sessionId = String(sessionKey || "");
    if (!sessionId || !chrome.declarativeNetRequest?.updateSessionRules) {
      return { updated: false, domains: [] };
    }
    return withStateLock(async () => {
      const state = await readState();
      const leaseToken = state.sessions[sessionId];
      const owner = leaseToken ? normalizeLease(state.owners[leaseToken], leaseToken) : null;
      const memoryOwner = mediaHeaderRuleSessions.get(sessionId);
      const session = owner || normalizeLease(memoryOwner);
      if (!session) {
        return { updated: false, domains: [] };
      }
      return updateLeaseDomainsUnlocked(state, session, sourceUrls);
    });
  }

  async function updateMediaHeaderLeaseDomains(value, sourceUrls) {
    const lease = normalizeLease(value);
    if (!lease) return { updated: false, domains: [], reason: "invalid-lease" };
    return withStateLock(async () => {
      const state = await readState();
      const stored = normalizeLease(state.owners[lease.leaseToken], lease.leaseToken);
      if (!stored || !leasesMatch(stored, lease)) {
        return { updated: false, domains: [], reason: "stale-lease" };
      }
      return updateLeaseDomainsUnlocked(state, stored, sourceUrls);
    });
  }

  async function updateLeaseDomainsUnlocked(state, lease, sourceUrls) {
    const installedRules = await getSessionRules();
    const installed = installedRules.find(rule => Number(rule.id) === lease.ruleId);
    const domains = new Set([
      ...(lease.domains || []),
      ...(installed?.condition?.requestDomains || []),
      ...mediaHeaderRuleDomainsFromUrls(sourceUrls)
    ]);
    const sortedDomains = [...domains].sort();
    const installedDomains = [...(installed?.condition?.requestDomains || [])].sort();
    const changed = !installed || JSON.stringify(installedDomains) !== JSON.stringify(sortedDomains);
    if (changed) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [lease.ruleId],
        addRules: [buildMediaHeaderRule(lease.ruleId, lease.pageHref, lease.pageOrigin, sortedDomains)]
      });
    }
    lease.domains = sortedDomains;
    lease.updatedAt = Date.now();
    state.owners[lease.leaseToken] = lease;
    await writeState(state);
    if (lease.jobId) mediaHeaderRuleSessions.set(lease.jobId, lease);
    return { updated: changed, domains: sortedDomains, lease: cloneLease(lease) };
  }

  async function installOwnedLease(input, identity) {
    const state = await readState();
    const installedRules = await getSessionRules();
    const previousLeaseToken = identity.jobId ? state.sessions[identity.jobId] : "";
    const previousOwner = previousLeaseToken ? normalizeLease(state.owners[previousLeaseToken], previousLeaseToken) : null;
    const ruleId = allocateRuleId(state, installedRules);
    const leaseToken = createOwnerToken(identity.jobId);
    const now = Date.now();
    const lease = {
      leaseToken,
      ownerToken: leaseToken,
      ruleId,
      id: ruleId,
      jobId: identity.jobId,
      sessionId: identity.jobId,
      runToken: identity.runToken,
      pageHref: input.pageHref,
      pageOrigin: input.pageOrigin,
      domains: [...input.domains],
      createdAt: now,
      updatedAt: now
    };
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [buildMediaHeaderRule(ruleId, lease.pageHref, lease.pageOrigin, lease.domains)]
    });
    state.owners[leaseToken] = lease;
    if (identity.jobId) {
      state.sessions[identity.jobId] = leaseToken;
    }
    try {
      await writeState(state);
    } catch (error) {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] }).catch(() => {});
      throw error;
    }
    if (identity.jobId) mediaHeaderRuleSessions.set(identity.jobId, lease);
    if (previousOwner && previousOwner.leaseToken !== leaseToken) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [previousOwner.ruleId] });
        delete state.owners[previousOwner.leaseToken];
        await writeState(state);
      } catch {
        // Keep the old ownership record so a later session update can still identify it.
      }
    }
    return cloneLease(lease);
  }

  async function releaseOwnedLease(lease) {
    let state = null;
    let metadataPending = false;
    try {
      state = await readState();
    } catch {
      metadataPending = true;
    }
    const stored = state ? normalizeLease(state.owners[lease.leaseToken], lease.leaseToken) : null;
    if (stored && !leasesMatch(stored, lease)) {
      return { released: false, retryable: false, reason: "stale-lease" };
    }
    if (state && !stored) {
      const conflicting = Object.values(state.owners)
        .map(value => normalizeLease(value))
        .find(value => value?.ruleId === lease.ruleId && value.leaseToken !== lease.leaseToken);
      if (conflicting) return { released: false, retryable: false, reason: "stale-lease" };
      try {
        const installed = (await getSessionRules()).some(rule => Number(rule.id) === lease.ruleId);
        if (!installed) {
          return { released: true, alreadyAbsent: true, metadataPending: false, lease: cloneLease(lease) };
        }
      } catch {
        metadataPending = true;
      }
    }
    try {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [lease.ruleId] });
    } catch {
      return { released: false, retryable: true, reason: "dnr-remove-failed", lease: cloneLease(lease) };
    }
    if (state) {
      delete state.owners[lease.leaseToken];
      deleteSessionsForLease(state, lease.leaseToken);
      try {
        await writeState(state);
      } catch {
        metadataPending = true;
      }
    }
    clearMemorySession(lease);
    return { released: true, alreadyAbsent: false, metadataPending, lease: cloneLease(lease) };
  }

  function allocateRuleId(state, installedRules) {
    const used = new Set(installedRules.map(rule => Number(rule.id)));
    for (const owner of Object.values(state.owners)) {
      used.add(Number(owner.id));
    }
    for (let attempt = 0; attempt < MEDIA_HEADER_RULE_ID_LIMIT - 1; attempt += 1) {
      state.nextOffset = (Number(state.nextOffset || 0) + 1) % MEDIA_HEADER_RULE_ID_LIMIT;
      if (!state.nextOffset) {
        state.nextOffset = 1;
      }
      const id = MEDIA_HEADER_RULE_ID_BASE + state.nextOffset;
      if (!used.has(id)) {
        return id;
      }
    }
    throw new Error("媒体请求头临时规则已用尽，请稍后重试。");
  }

  async function getSessionRules() {
    if (!chrome.declarativeNetRequest?.getSessionRules) {
      return [];
    }
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    return Array.isArray(rules) ? rules : [];
  }

  function createOwnerToken(sessionId) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${sessionId || "anonymous"}:${random}`;
  }

  function createEmptyState() {
    return { schemaVersion: 2, nextOffset: 0, sessions: {}, owners: {} };
  }

  function normalizeState(value) {
    const state = value && typeof value === "object" ? value : {};
    const owners = {};
    for (const [token, raw] of Object.entries(state.owners && typeof state.owners === "object" ? state.owners : {})) {
      const lease = normalizeLease(raw, token);
      if (lease) owners[lease.leaseToken] = lease;
    }
    return {
      schemaVersion: 2,
      nextOffset: Number(state.nextOffset || 0),
      sessions: state.sessions && typeof state.sessions === "object" ? { ...state.sessions } : {},
      owners
    };
  }

  function normalizeLease(value, fallbackToken = "") {
    const source = value && typeof value === "object" ? value : {};
    const leaseToken = String(source.leaseToken || source.ownerToken || fallbackToken || "");
    const ruleId = Number(source.ruleId ?? source.id);
    if (!leaseToken || !Number.isInteger(ruleId) || !isReservedRuleId(ruleId)) return null;
    const jobId = String(source.jobId || source.sessionId || "");
    return {
      leaseToken,
      ownerToken: leaseToken,
      ruleId,
      id: ruleId,
      jobId,
      sessionId: jobId,
      runToken: String(source.runToken || ""),
      pageHref: String(source.pageHref || ""),
      pageOrigin: String(source.pageOrigin || ""),
      domains: [...new Set((Array.isArray(source.domains) ? source.domains : [])
        .map(domain => String(domain || "").toLowerCase())
        .filter(Boolean))].sort(),
      createdAt: Number(source.createdAt || 0) || 0,
      updatedAt: Number(source.updatedAt || source.createdAt || 0) || 0
    };
  }

  function cloneLease(lease) {
    return normalizeLease(lease);
  }

  function leasesMatch(left, right) {
    return Boolean(left && right &&
      left.leaseToken === right.leaseToken &&
      left.ruleId === right.ruleId &&
      left.jobId === right.jobId &&
      left.runToken === right.runToken);
  }

  function isReservedRuleId(ruleId) {
    return Number.isInteger(ruleId) &&
      ruleId >= MEDIA_HEADER_RULE_ID_BASE &&
      ruleId < MEDIA_HEADER_RULE_ID_BASE + MEDIA_HEADER_RULE_ID_LIMIT;
  }

  function deleteSessionsForLease(state, leaseToken) {
    for (const [sessionId, token] of Object.entries(state.sessions)) {
      if (String(token || "") === String(leaseToken || "")) delete state.sessions[sessionId];
    }
  }

  function clearMemorySession(lease) {
    if (lease?.jobId && mediaHeaderRuleSessions.get(lease.jobId)?.leaseToken === lease.leaseToken) {
      mediaHeaderRuleSessions.delete(lease.jobId);
    }
  }

  async function readState() {
    if (!chrome.storage?.session?.get) {
      return normalizeState(fallbackState);
    }
    const stored = await chrome.storage.session.get([
      MEDIA_HEADER_RULE_STATE_KEY,
      LEGACY_MEDIA_HEADER_RULE_STATE_KEY
    ]);
    return normalizeState(stored?.[MEDIA_HEADER_RULE_STATE_KEY] ?? stored?.[LEGACY_MEDIA_HEADER_RULE_STATE_KEY]);
  }

  async function writeState(state) {
    const normalized = normalizeState(state);
    if (chrome.storage?.session?.set) {
      await chrome.storage.session.set({ [MEDIA_HEADER_RULE_STATE_KEY]: normalized });
    }
    fallbackState = normalized;
  }

  function withStateLock(task) {
    const next = stateLock.then(task, task);
    stateLock = next.catch(() => {});
    return next;
  }

  const api = {
    withMediaRequestHeaderRules,
    acquireMediaHeaderLease,
    releaseMediaHeaderLease,
    reconcileMediaHeaderLeases,
    buildMediaHeaderRules,
    buildMediaHeaderRule,
    mediaHeaderRuleDomainsFromUrls,
    updateMediaRequestHeaderRuleDomains,
    updateMediaHeaderLeaseDomains
  };
  return api;
})();
