export const FuguangPaidRequestClient = (() => {
  async function createEnvelope(input = {}) {
    const jobId = requiredText(input.jobId, "jobId");
    const runToken = requiredText(input.runToken, "runToken");
    const executionOwnerId = requiredText(input.executionOwnerId, "executionOwnerId");
    const executionEpoch = positiveInteger(input.executionEpoch, "executionEpoch");
    const semanticRequestPath = requiredText(input.semanticRequestPath || input.requestPath, "semanticRequestPath");
    const provider = requiredText(input.provider, "provider");
    const operationType = requiredText(input.operationType || "paid-request", "operationType");
    const transientInit = await normalizeTransientRequestInit(input.init || {});
    const canonical = JSON.stringify({
      jobId,
      runToken,
      provider,
      operationType,
      semanticRequestPath,
      url: canonicalRequestUrl(requiredText(input.url, "url")),
      method: transientInit.method,
      headers: canonicalRequestHeaders(transientInit.headers),
      body: input.bodyIdentity !== undefined
        ? canonicalExplicitBodyIdentity(input.bodyIdentity)
        : await canonicalRequestBody(transientInit.body)
    });
    const digest = await sha256Hex(canonical, input.crypto || globalThis.crypto);
    const inputHash = `sha256:${digest}`;
    const operationId = `paid:${digest}`;
    return {
      operation: {
        jobId,
        runToken,
        operationId,
        provider,
        operationType,
        inputHash,
        batchStart: nonNegativeInteger(input.batchStart),
        batchEnd: nonNegativeInteger(input.batchEnd),
        retryAllowed: false,
        definitelyNotAccepted: false
      },
      ownership: {
        executionOwnerId,
        executionEpoch,
        checkedAt: positiveTimestamp(input.checkedAt)
      },
      request: {
        url: String(input.url),
        init: transientInit,
        timeoutMs: positiveDuration(input.timeoutMs)
      }
    };
  }

  function create(options = {}) {
    const dispatch = requiredFunction(options.dispatch, "dispatch");
    const cancel = typeof options.cancel === "function" ? options.cancel : async () => ({ cancelled: false });
    const client = {
      async request(input = {}) {
        const signal = input.signal || input.init?.signal || null;
        const envelope = await createEnvelope(input);
        if (signal?.aborted) {
          await cancel({ operation: envelope.operation, ownership: envelope.ownership }).catch(() => {});
          throw abortError(signal.reason);
        }
        let removeAbortListener = () => {};
        const dispatched = Promise.resolve().then(() => dispatch(envelope));
        try {
          const result = signal
            ? await Promise.race([
              dispatched,
              new Promise((_, reject) => {
                const onAbort = () => {
                  Promise.resolve(cancel({ operation: envelope.operation, ownership: envelope.ownership })).catch(() => {});
                  reject(abortError(signal.reason));
                };
                signal.addEventListener("abort", onAbort, { once: true });
                removeAbortListener = () => signal.removeEventListener("abort", onAbort);
                if (signal.aborted) {
                  onAbort();
                }
              })
            ])
            : await dispatched;
          return responseFromDurableResult(result);
        } finally {
          removeAbortListener();
        }
      },
      createRequestTransport(context = {}) {
        return (url, init = {}, requestOptions = {}) => client.request({
          ...context,
          ...requestOptions,
          url,
          init,
          signal: requestOptions.signal || init.signal || context.signal
        });
      }
    };
    return client;
  }

  function responseFromDurableResult(result = {}) {
    const responseData = result.response || result;
    const headers = new Headers();
    if (responseData.contentType) {
      headers.set("content-type", responseData.contentType);
    }
    if (responseData.providerRequestId) {
      headers.set("x-fuguang-provider-request-id", responseData.providerRequestId);
    }
    const status = Number(responseData.status || 0) || 200;
    const response = new Response([204, 205, 304].includes(status) ? null : String(responseData.bodyText ?? ""), {
      status,
      statusText: String(responseData.statusText || ""),
      headers
    });
    for (const [key, value] of Object.entries({
      durableOperationId: result.operationId || "",
      durableInputHash: result.inputHash || "",
      durableResultRef: responseData.resultRef || "",
      durableReplayed: Boolean(result.replayed),
      providerRequestId: responseData.providerRequestId || ""
    })) {
      Object.defineProperty(response, key, { value, enumerable: false, configurable: true });
    }
    return response;
  }

  async function normalizeTransientRequestInit(init = {}) {
    const headers = [...new Headers(init.headers || {}).entries()]
      .map(([name, value]) => [name.toLowerCase(), value])
      .sort(([left], [right]) => left.localeCompare(right));
    const normalized = {
      ...init,
      method: String(init.method || "GET").toUpperCase(),
      headers: Object.fromEntries(headers)
    };
    delete normalized.signal;
    return normalized;
  }

  async function canonicalRequestBody(body) {
    if (body == null) {
      return { type: "empty", value: "" };
    }
    if (typeof body === "string") {
      return { type: "text", value: body };
    }
    if (body instanceof URLSearchParams) {
      return { type: "url-search-params", value: body.toString() };
    }
    if (body instanceof ArrayBuffer) {
      return { type: "bytes", value: bytesToHex(new Uint8Array(body)) };
    }
    if (ArrayBuffer.isView(body)) {
      return { type: "bytes", value: bytesToHex(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)) };
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return { type: `blob:${body.type || ""}`, value: bytesToHex(new Uint8Array(await body.arrayBuffer())) };
    }
    throw new TypeError("Paid request body must be text, URLSearchParams, Blob, ArrayBuffer or a typed array.");
  }

  function canonicalExplicitBodyIdentity(value) {
    return { type: "explicit", value: canonicalJsonValue(value) };
  }

  function canonicalJsonValue(value, seen = new WeakSet()) {
    if (value == null || typeof value === "boolean" || typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new TypeError("Paid request body identity numbers must be finite.");
      }
      return value;
    }
    if (typeof value !== "object" || seen.has(value)) {
      throw new TypeError("Paid request body identity must be acyclic JSON data.");
    }
    seen.add(value);
    if (Array.isArray(value)) {
      const output = value.map(item => canonicalJsonValue(item, seen));
      seen.delete(value);
      return output;
    }
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalJsonValue(value[key], seen);
    }
    seen.delete(value);
    return output;
  }

  function canonicalRequestHeaders(headers = {}) {
    const excluded = new Set([
      "api-key",
      "authorization",
      "connection",
      "content-length",
      "cookie",
      "date",
      "host",
      "idempotency-key",
      "proxy-authorization",
      "set-cookie",
      "traceparent",
      "tracestate",
      "user-agent",
      "x-api-key",
      "x-auth-token",
      "x-correlation-id",
      "x-goog-api-key",
      "x-request-id"
    ]);
    return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.has(String(name).toLowerCase())));
  }

  function canonicalRequestUrl(value) {
    const url = new URL(String(value));
    const secretNames = new Set([
      "access_token",
      "api-key",
      "api_key",
      "apikey",
      "auth",
      "authorization",
      "credential",
      "key",
      "sig",
      "signature",
      "token",
      "x-api-key",
      "x-goog-api-key"
    ]);
    for (const name of [...url.searchParams.keys()]) {
      const normalized = String(name).toLowerCase();
      if (secretNames.has(normalized) || normalized.startsWith("x-amz-")) {
        url.searchParams.delete(name);
      }
    }
    url.searchParams.sort();
    return url.toString();
  }

  async function sha256Hex(value, cryptoImpl) {
    if (!cryptoImpl?.subtle?.digest) {
      throw new Error("Web Crypto SHA-256 is unavailable.");
    }
    const bytes = new TextEncoder().encode(String(value));
    return bytesToHex(new Uint8Array(await cryptoImpl.subtle.digest("SHA-256", bytes)));
  }

  function bytesToHex(bytes) {
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function requiredText(value, field) {
    const text = String(value || "").trim();
    if (!text) {
      throw new Error(`Paid request requires ${field}.`);
    }
    return text;
  }

  function requiredFunction(value, field) {
    if (typeof value !== "function") {
      throw new Error(`Paid request client requires ${field}.`);
    }
    return value;
  }

  function positiveInteger(value, field) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`Paid request requires a positive ${field}.`);
    }
    return number;
  }

  function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function positiveTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : Date.now();
  }

  function positiveDuration(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 90_000;
  }

  function abortError(reason) {
    const error = new Error(reason?.message || String(reason || "任务已停止。"));
    error.name = "AbortError";
    return error;
  }

  return {
    create,
    createEnvelope,
    responseFromDurableResult,
    sha256Hex
  };
})();
