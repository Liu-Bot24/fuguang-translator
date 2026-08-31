import assert from "node:assert/strict";
import test from "node:test";

import { FuguangJobStore } from "../../extension/src/background/job-store.js";
import { FuguangPaidRequestClient } from "../../extension/src/background/paid-request-client.js";
import { FuguangBrowserTranslationPipeline } from "../../extension/src/background/browser-translation-pipeline.js";
import { FuguangBrowserTranslationProvider } from "../../extension/src/background/browser-translation-provider.js";
import { FuguangPaidRequestRuntime } from "../../extension/src/offscreen/paid-request-runtime.js";

function activeJob(now = Date.now(), overrides = {}) {
  return {
    id: "job-a",
    runToken: "run-a",
    status: "running",
    stage: "translation",
    updatedAt: now,
    executionRunToken: "run-a",
    executionOwnerId: "owner-a",
    executionEpoch: 1,
    executionLeaseExpiresAt: now + 60_000,
    ...overrides
  };
}

function requestInput(overrides = {}) {
  return {
    jobId: "job-a",
    runToken: "run-a",
    executionOwnerId: "owner-a",
    executionEpoch: 1,
    provider: "openai",
    operationType: "translation",
    semanticRequestPath: "translation/batch/0/attempt/0/openai/json",
    url: "https://provider.example/v1/chat/completions?tenant=secret-tenant",
    init: {
      method: "POST",
      headers: {
        authorization: "Bearer sk-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({ model: "test", messages: [{ role: "user", content: "hello" }] })
    },
    timeoutMs: 1_000,
    ...overrides
  };
}

function createMemoryResponseCache() {
  const values = new Map();
  return {
    async put(ref, bodyText) { values.set(ref, String(bodyText)); },
    async get(ref) { return values.has(ref) ? values.get(ref) : null; },
    async delete(ref) { return values.delete(ref); },
    async deleteJob(jobId) {
      let deleted = 0;
      for (const [ref] of values) {
        if (decodeURIComponent(new URL(ref).pathname).includes(`/${jobId}/`)) {
          values.delete(ref);
          deleted += 1;
        }
      }
      return deleted;
    },
    values
  };
}

async function createHarness(fetchImpl) {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const responseCache = createMemoryResponseCache();
  const runtime = FuguangPaidRequestRuntime.create({ jobStore: store, responseCache, fetchImpl });
  const client = FuguangPaidRequestClient.create({
    dispatch: envelope => runtime.handleRequest(envelope),
    cancel: envelope => runtime.cancelRequest(envelope)
  });
  return { now, store, responseCache, runtime, client };
}

test("paid request replays an exact large cached response after the first message result is lost", async () => {
  const bodyText = JSON.stringify({
    items: [{ i: 0, text: "译文" }],
    long: "x".repeat(25_000),
    sourceUrl: "https://provider.example/result?id=1&token=must-remain-exact"
  });
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response(bodyText, {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "provider-request-1" }
    });
  });
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());

  await harness.runtime.handleRequest(envelope); // Simulate a completed fetch whose message response was lost.
  const response = await harness.client.request(requestInput());
  assert.equal(await response.text(), bodyText);
  assert.equal(response.status, 200);
  assert.equal(calls, 1);

  const operation = await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId);
  assert.equal(operation.state, "completed");
  assert.equal(operation.resultBytes, new TextEncoder().encode(bodyText).byteLength);
  assert.match(operation.resultRef, /^https:\/\/fuguang\.local\/__fuguang_operation_results\//);
  const serialized = JSON.stringify(operation);
  for (const forbidden of ["sk-secret", "secret-tenant", "must-remain-exact", "authorization", bodyText]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("missing or corrupt durable response bodies remain explicitly delivery-ambiguous", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
  });
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput({
    semanticRequestPath: "translation/durable-body-integrity"
  }));
  await harness.runtime.handleRequest(envelope);
  const operation = await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId);
  await harness.responseCache.delete(operation.resultRef);
  await assert.rejects(harness.runtime.handleRequest(envelope), error => {
    assert.equal(error?.code, "PAID_REQUEST_DURABLE_RESULT_MISSING");
    assert.equal(error?.deliveryAmbiguous, true);
    return true;
  });
  await harness.responseCache.put(operation.resultRef, '{"ok":"corrupt"}');
  await assert.rejects(harness.runtime.handleRequest(envelope), error => {
    assert.equal(error?.code, "PAID_REQUEST_DURABLE_RESULT_CORRUPT");
    assert.equal(error?.deliveryAmbiguous, true);
    return true;
  });
  assert.equal(calls, 1);
});

test("cancel-only FunASR task-id recovery reads only an exact verified completed submit response", async () => {
  const bodyText = JSON.stringify({ output: { task_id: "task-cancel-recovery" } });
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response(bodyText, { status: 200, headers: { "content-type": "application/json" } });
  });
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput({
    provider: "dashscope_funasr",
    operationType: "funasr-submit",
    semanticRequestPath: "funasr/job-a/run-a/chunk/0/submit",
    url: "https://dashscope.example/api/v1/services/audio/asr/transcription"
  }));
  await harness.runtime.handleRequest(envelope);
  const verified = await harness.runtime.readCompletedFunAsrSubmitForCancellation(envelope.operation);
  assert.equal(verified.bodyText, bodyText);
  assert.equal(calls, 1);

  const operation = await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId);
  await harness.responseCache.put(operation.resultRef, JSON.stringify({ output: { task_id: "tampered" } }));
  await assert.rejects(
    harness.runtime.readCompletedFunAsrSubmitForCancellation(envelope.operation),
    error => error?.code === "PAID_REQUEST_DURABLE_RESULT_CORRUPT"
  );
  assert.equal(calls, 1, "cancel-only recovery must never issue another submit request");
});

test("paid request identity survives lease takeover and credential rotation", async () => {
  const ownerA = await FuguangPaidRequestClient.createEnvelope(requestInput({
    url: "https://provider.example/v1/chat/completions?deployment=stable&api_key=old-secret&signature=old-signature"
  }));
  const ownerB = await FuguangPaidRequestClient.createEnvelope(requestInput({
    executionOwnerId: "owner-b",
    executionEpoch: 2,
    url: "https://provider.example/v1/chat/completions?signature=rotated-signature&api_key=rotated-secret&deployment=stable",
    init: {
      ...requestInput().init,
      headers: {
        ...requestInput().init.headers,
        authorization: "Bearer rotated-secret",
        "x-api-key": "rotated-x-api-key",
        "api-key": "rotated-api-key"
      }
    }
  }));
  assert.equal(ownerB.operation.operationId, ownerA.operation.operationId);
  assert.equal(ownerB.operation.inputHash, ownerA.operation.inputHash);
  const changedBusinessQuery = await FuguangPaidRequestClient.createEnvelope(requestInput({
    url: "https://provider.example/v1/chat/completions?deployment=canary&api_key=old-secret&signature=old-signature"
  }));
  assert.notEqual(changedBusinessQuery.operation.operationId, ownerA.operation.operationId);

  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
  });
  await harness.runtime.handleRequest(ownerA);
  const takeover = await harness.store.claimRun("job-a", "run-a", {
    ownerId: "owner-b",
    claimedAt: harness.now + 60_001,
    leaseDurationMs: 60_000
  });
  assert.equal(takeover.applied, true);
  assert.equal(takeover.job.executionEpoch, 2);
  const replayed = await harness.runtime.handleRequest(ownerB);
  assert.equal(replayed.replayed, true);
  assert.equal(calls, 1);
});

test("ordinary ASR multipart requests use an explicit stable body identity without serializing FormData", async () => {
  const createAsrInput = apiKey => {
    const form = new FormData();
    form.append("model", "whisper-1");
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }), "chunk.mp3");
    return requestInput({
      provider: "openai",
      operationType: "asr-primary",
      semanticRequestPath: "asr/job-a/run-a/chunk/0/primary",
      bodyIdentity: {
        requestFields: [["model", "whisper-1"]],
        audioHash: "sha256:010203",
        fileName: "chunk.mp3",
        mime: "audio/mpeg"
      },
      init: {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form
      }
    });
  };

  const first = await FuguangPaidRequestClient.createEnvelope(createAsrInput("key-one"));
  const rotated = await FuguangPaidRequestClient.createEnvelope(createAsrInput("key-two"));
  assert.equal(first.operation.operationId, rotated.operation.operationId);
  assert.equal(first.request.init.body instanceof FormData, true);
  assert.equal(first.operation.inputHash.includes("key-one"), false);
});

test("ordinary ASR primary artifact is durably checkpointed and exactly replayed before coverage", async () => {
  const harness = await createHarness(async () => {
    throw new Error("artifact checkpoint must not fetch");
  });
  const bodyText = JSON.stringify({
    segments: [{ start: 0, end: 1, text: "keep https://example.test/path?token=literal-as-subtitle" }],
    diagnostics: { phase: "primary" }
  });
  const operation = {
    jobId: "job-a",
    runToken: "run-a",
    operationId: "artifact:asr-primary-chunk-0",
    provider: "openai",
    operationType: "asr-primary-result",
    inputHash: "sha256:primary-request-operation",
    retryAllowed: false,
    definitelyNotAccepted: false
  };
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1 };

  const first = await harness.runtime.writeArtifact({ operation, ownership, bodyText });
  assert.equal(first.replayed, false);
  assert.equal(first.bodyText, bodyText);
  assert.equal((await harness.store.getOperation("job-a", "run-a", operation.operationId)).state, "completed");

  const takeover = await harness.store.claimRun("job-a", "run-a", {
    ownerId: "owner-b",
    claimedAt: harness.now + 60_001,
    leaseDurationMs: 60_000
  });
  assert.equal(takeover.applied, true);
  const replayed = await harness.runtime.writeArtifact({
    operation,
    ownership: { executionOwnerId: "owner-b", executionEpoch: 2 },
    bodyText
  });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.bodyText, bodyText);
  await assert.rejects(harness.runtime.writeArtifact({
    operation,
    ownership: { executionOwnerId: "owner-b", executionEpoch: 2 },
    bodyText: JSON.stringify({ segments: [{ start: 0, end: 1, text: "different primary" }] })
  }), error => error?.code === "PAID_REQUEST_OPERATION_CONFLICT");
});

test("FunASR uploaded file artifacts are readable after takeover and submit operations can record remote task ids", async () => {
  const harness = await createHarness(async () => {
    throw new Error("artifact metadata must not fetch");
  });
  const operation = {
    jobId: "job-a",
    runToken: "run-a",
    operationId: "artifact:funasr-upload-0",
    provider: "dashscope_funasr",
    operationType: "funasr-uploaded-file",
    inputHash: "sha256:funasr-upload-0",
    batchStart: 0,
    batchEnd: 1,
    retryAllowed: false,
    definitelyNotAccepted: false
  };
  await harness.runtime.writeArtifact({
    operation,
    ownership: { executionOwnerId: "owner-a", executionEpoch: 1 },
    bodyText: JSON.stringify({ fileUrl: "oss://bucket/private/audio.mp3" })
  });

  const takeover = await harness.store.claimRun("job-a", "run-a", {
    ownerId: "owner-b",
    claimedAt: harness.now + 60_001,
    leaseDurationMs: 60_000
  });
  assert.equal(takeover.applied, true);
  const ownership = { executionOwnerId: "owner-b", executionEpoch: 2 };
  const restored = await harness.runtime.readArtifact({ operation, ownership });
  assert.equal(restored.replayed, true);
  assert.deepEqual(JSON.parse(restored.bodyText), { fileUrl: "oss://bucket/private/audio.mp3" });

  await harness.runtime.annotateOperation({
    operation,
    ownership,
    remoteTaskId: "dashscope-task-123"
  });
  const annotated = await harness.store.getOperation("job-a", "run-a", operation.operationId);
  assert.equal(annotated.state, "completed");
  assert.equal(annotated.remoteTaskId, "dashscope-task-123");
  const idempotent = await harness.runtime.annotateOperation({
    operation, ownership, remoteTaskId: "dashscope-task-123"
  });
  assert.equal(idempotent.remoteTaskId, "dashscope-task-123");
  for (const invalidOperation of [
    { ...operation, provider: "wrong-provider" },
    { ...operation, operationType: "wrong-type" },
    { ...operation, inputHash: "sha256:wrong-hash" }
  ]) {
    await assert.rejects(
      harness.runtime.annotateOperation({ operation: invalidOperation, ownership, remoteTaskId: "dashscope-task-123" }),
      error => error?.code === "PAID_REQUEST_OPERATION_CONFLICT"
    );
  }
  await assert.rejects(
    harness.runtime.annotateOperation({ operation, ownership, remoteTaskId: "different-task" }),
    error => error?.code === "PAID_REQUEST_OPERATION_CONFLICT"
  );
});

test("accepted artifacts only recover the exact previously checkpointed body", async () => {
  const harness = await createHarness(async () => { throw new Error("unused"); });
  const operation = {
    jobId: "job-a", runToken: "run-a", operationId: "artifact:accepted-upload",
    provider: "dashscope_funasr", operationType: "funasr-uploaded-file",
    inputHash: "sha256:accepted-upload", retryAllowed: false, definitelyNotAccepted: false
  };
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1 };
  const exactBody = JSON.stringify({ fileUrl: "oss://bucket/exact.mp3" });
  const exactHash = `sha256:${await FuguangPaidRequestClient.sha256Hex(exactBody, globalThis.crypto)}`;
  const resultRef = "https://fuguang.local/__fuguang_operation_results/job-a/run-a/artifact%3Aaccepted-upload";
  assert.equal((await harness.store.prepareOperation(operation, ownership)).applied, true);
  assert.equal((await harness.store.updateOperation({
    ...operation, state: "accepted", resultRef,
    resultHash: exactHash, resultBytes: new TextEncoder().encode(exactBody).byteLength
  }, ownership)).applied, true);

  await assert.rejects(harness.runtime.writeArtifact({
    operation, ownership,
    bodyText: JSON.stringify({ fileUrl: "oss://bucket/different.mp3" })
  }), error => error?.code === "PAID_REQUEST_OPERATION_CONFLICT");

  const recovered = await harness.runtime.writeArtifact({ operation, ownership, bodyText: exactBody });
  assert.equal(recovered.bodyText, exactBody);
  assert.equal((await harness.store.getOperation("job-a", "run-a", operation.operationId)).state, "completed");

  const corruptHarness = await createHarness(async () => { throw new Error("unused"); });
  assert.equal((await corruptHarness.store.prepareOperation(operation, ownership)).applied, true);
  assert.equal((await corruptHarness.store.updateOperation({
    ...operation, state: "accepted", resultRef,
    resultHash: exactHash, resultBytes: new TextEncoder().encode(exactBody).byteLength
  }, ownership)).applied, true);
  await corruptHarness.responseCache.put(resultRef, "corrupt");
  await assert.rejects(
    corruptHarness.runtime.writeArtifact({ operation, ownership, bodyText: exactBody }),
    error => error?.code === "PAID_REQUEST_DURABLE_RESULT_CORRUPT"
  );
});

test("runtime checkpoints accepted before reading the response body", async () => {
  let releaseBody;
  const bodyGate = new Promise(resolve => { releaseBody = resolve; });
  const harness = await createHarness(async () => ({
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json", "x-request-id": "accepted-first" }),
    text: async () => {
      await bodyGate;
      return '{"ok":true}';
    }
  }));
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  const pending = harness.runtime.handleRequest(envelope);
  let state = "";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    state = (await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId))?.state || "";
    if (state === "accepted") break;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(state, "accepted");
  releaseBody();
  await pending;
  assert.equal((await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId)).state, "completed");
});

test("response body read failure becomes unknown and is never resent", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return {
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json", "x-request-id": "body-read-failed" }),
      text: async () => { throw new Error("stream interrupted"); }
    };
  });
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  await assert.rejects(harness.runtime.handleRequest(envelope), error => (
    error?.code === "PAID_REQUEST_DELIVERY_AMBIGUOUS" && error?.deliveryAmbiguous === true
  ));
  assert.equal((await harness.store.getOperation("job-a", "run-a", envelope.operation.operationId)).state, "unknown");
  await assert.rejects(harness.runtime.handleRequest(envelope), error => error?.code === "PAID_REQUEST_DELIVERY_AMBIGUOUS");
  assert.equal(calls, 1);
});

test("accepted operation recovers a cached body after the completed checkpoint is interrupted", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const responseCache = createMemoryResponseCache();
  let rejectCompletedOnce = true;
  const interruptedStore = {
    ...store,
    async updateOperation(operation, ownership) {
      if (operation.state === "completed" && rejectCompletedOnce) {
        rejectCompletedOnce = false;
        return { applied: false, reason: "simulated-checkpoint-interruption" };
      }
      return await store.updateOperation(operation, ownership);
    }
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{"durable":"body"}', {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "checkpoint-recovery" }
    });
  };
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  const interruptedRuntime = FuguangPaidRequestRuntime.create({
    jobStore: interruptedStore,
    responseCache,
    fetchImpl
  });
  await assert.rejects(interruptedRuntime.handleRequest(envelope), error => (
    error?.code === "PAID_REQUEST_DELIVERY_AMBIGUOUS" && error?.deliveryAmbiguous === true
  ));
  const accepted = await store.getOperation("job-a", "run-a", envelope.operation.operationId);
  assert.equal(accepted.state, "accepted");
  assert.equal(await responseCache.get(accepted.resultRef), '{"durable":"body"}');

  const recoveredRuntime = FuguangPaidRequestRuntime.create({ jobStore: store, responseCache, fetchImpl });
  const recovered = await recoveredRuntime.handleRequest(envelope);
  assert.equal(recovered.replayed, true);
  assert.equal(recovered.response.bodyText, '{"durable":"body"}');
  assert.equal((await store.getOperation("job-a", "run-a", envelope.operation.operationId)).state, "completed");
  assert.equal(calls, 1);
});

test("accepted paid responses require a previously checkpointed exact body hash", async () => {
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput({
    semanticRequestPath: "translation/accepted-body-proof"
  }));
  const bodyText = '{"durable":"exact"}';
  const resultHash = `sha256:${await FuguangPaidRequestClient.sha256Hex(bodyText, globalThis.crypto)}`;
  const resultBytes = new TextEncoder().encode(bodyText).byteLength;
  const resultRef = `https://fuguang.local/__fuguang_operation_results/job-a/run-a/${encodeURIComponent(envelope.operation.operationId)}`;
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1 };

  async function seedAccepted({ cacheBody, withHash = true }) {
    const harness = await createHarness(async () => { throw new Error("accepted replay must not fetch"); });
    assert.equal((await harness.store.prepareOperation(envelope.operation, ownership)).applied, true);
    assert.equal((await harness.store.updateOperation({
      ...envelope.operation, state: "accepted", resultRef,
      status: 200, contentType: "application/json",
      resultHash: withHash ? resultHash : "", resultBytes: withHash ? resultBytes : 0
    }, ownership)).applied, true);
    if (cacheBody !== null) await harness.responseCache.put(resultRef, cacheBody);
    return harness;
  }

  const exact = await seedAccepted({ cacheBody: bodyText });
  assert.equal((await exact.runtime.handleRequest(envelope)).response.bodyText, bodyText);

  for (const harness of [
    await seedAccepted({ cacheBody: "corrupt" }),
    await seedAccepted({ cacheBody: bodyText, withHash: false }),
    await seedAccepted({ cacheBody: null })
  ]) {
    await assert.rejects(
      harness.runtime.handleRequest(envelope),
      error => error?.code === "PAID_REQUEST_DELIVERY_AMBIGUOUS" ||
        error?.code === "PAID_REQUEST_DURABLE_RESULT_CORRUPT" ||
        error?.code === "PAID_REQUEST_DURABLE_RESULT_MISSING"
    );
  }
});

test("completed paid responses and artifacts without a trusted body hash are never replayed", async () => {
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1 };
  const harness = await createHarness(async () => { throw new Error("unverified completed body must not fetch"); });
  const paid = await FuguangPaidRequestClient.createEnvelope(requestInput({
    semanticRequestPath: "translation/completed-without-proof"
  }));
  const artifact = {
    jobId: "job-a", runToken: "run-a", operationId: "artifact:completed-without-proof",
    provider: "dashscope_funasr", operationType: "funasr-uploaded-file",
    inputHash: "sha256:completed-without-proof"
  };
  for (const operation of [paid.operation, artifact]) {
    const resultRef = `https://fuguang.local/__fuguang_operation_results/job-a/run-a/${encodeURIComponent(operation.operationId)}`;
    assert.equal((await harness.store.prepareOperation(operation, ownership)).applied, true);
    assert.equal((await harness.store.updateOperation({
      ...operation, state: "completed", resultRef, resultBytes: 10, resultHash: ""
    }, ownership)).applied, true);
    await harness.responseCache.put(resultRef, "UNVERIFIED");
  }
  await assert.rejects(harness.runtime.handleRequest(paid), error => error?.deliveryAmbiguous === true);
  await assert.rejects(harness.runtime.readArtifact({ operation: artifact, ownership }), error => error?.deliveryAmbiguous === true);
  await assert.rejects(
    harness.runtime.writeArtifact({ operation: artifact, ownership, bodyText: "UNVERIFIED" }),
    error => error?.deliveryAmbiguous === true || error?.code === "PAID_REQUEST_OPERATION_CONFLICT"
  );
});

test("offscreen message listener exposes JSON-safe execute, cancel and delete operations", async () => {
  let listener = null;
  const calls = [];
  const chromeRuntime = {
    onMessage: {
      addListener(value) { listener = value; },
      removeListener(value) { if (listener === value) listener = null; }
    }
  };
  const installed = FuguangPaidRequestRuntime.installChromeRuntimeMessageListener({
    chromeRuntime,
    runtime: {
      async handleRequest(envelope) { calls.push(["execute", envelope]); return { operationId: "paid:test" }; },
      async cancelRequest(envelope) { calls.push(["cancel", envelope]); return { cancelled: true }; },
      async cleanupExpiredJobResults(cleanup) { calls.push(["cleanup", cleanup]); return { applied: true }; },
      async drainPendingCleanupResults() { calls.push(["drain"]); return { completed: 1, failed: 0 }; },
      async deleteJobResults(jobId) { calls.push(["delete", jobId]); return { jobs: 1 }; }
    }
  });
  async function send(message) {
    return await new Promise(resolve => {
      assert.equal(listener(message, {}, resolve), true);
    });
  }
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  assert.equal((await send({ type: FuguangPaidRequestRuntime.MESSAGE_TYPES.execute, envelope })).ok, true);
  assert.equal((await send({ type: FuguangPaidRequestRuntime.MESSAGE_TYPES.cancel, envelope: {
    operation: envelope.operation,
    ownership: envelope.ownership
  } })).ok, true);
  assert.equal((await send({
    type: FuguangPaidRequestRuntime.MESSAGE_TYPES.cleanupExpiredJobResults,
    cleanup: { jobId: "job-a", runToken: "run-a", expectedUpdatedAt: 1, cutoff: 2 }
  })).ok, true);
  assert.equal((await send({ type: FuguangPaidRequestRuntime.MESSAGE_TYPES.deleteJobResults, jobId: "job-a" })).ok, true);
  assert.equal((await send({ type: FuguangPaidRequestRuntime.MESSAGE_TYPES.drainPendingCleanupResults })).ok, true);
  assert.deepEqual(calls.map(item => item[0]), ["execute", "cancel", "cleanup", "delete", "drain"]);

  const unsafe = structuredClone(envelope);
  unsafe.request.init.body = new Blob(["binary body"]);
  const rejected = await send({ type: FuguangPaidRequestRuntime.MESSAGE_TYPES.execute, envelope: unsafe });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "PAID_REQUEST_MESSAGE_NOT_JSON_SAFE");
  installed.uninstall();
  assert.equal(listener, null);
});

test("HTTP 500 is durably replayed as a received response without a second fetch", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response('{"error":{"message":"upstream failed"}}', {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "content-type": "application/json" }
    });
  });
  const first = await harness.client.request(requestInput());
  const second = await harness.client.request(requestInput());
  assert.equal(first.status, 500);
  assert.equal(second.status, 500);
  assert.equal(await second.text(), '{"error":{"message":"upstream failed"}}');
  assert.equal(calls, 1);
});

test("submitted and unknown operations are never automatically resent", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response("unexpected");
  });
  const ownership = { executionOwnerId: "owner-a", executionEpoch: 1, checkedAt: harness.now + 1 };
  for (const [index, state] of ["submitted", "unknown"].entries()) {
    const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput({ semanticRequestPath: `translation/${state}` }));
    await harness.store.prepareOperation(envelope.operation, ownership);
    await harness.store.updateOperation({ ...envelope.operation, state }, ownership);
    await assert.rejects(harness.runtime.handleRequest(envelope), error => error?.code === "PAID_REQUEST_DELIVERY_AMBIGUOUS");
    assert.equal(index >= 0, true);
  }
  assert.equal(calls, 0);
});

test("same body on different semantic paths produces distinct concurrent operations", async () => {
  let calls = 0;
  const pending = [];
  const harness = await createHarness(async () => {
    calls += 1;
    await new Promise(resolve => pending.push(resolve));
    return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
  });
  const left = FuguangPaidRequestClient.createEnvelope(requestInput({ semanticRequestPath: "translation/split/left" }));
  const right = FuguangPaidRequestClient.createEnvelope(requestInput({ semanticRequestPath: "translation/split/right" }));
  const [leftEnvelope, rightEnvelope] = await Promise.all([left, right]);
  assert.notEqual(leftEnvelope.operation.operationId, rightEnvelope.operation.operationId);
  const requests = [harness.runtime.handleRequest(leftEnvelope), harness.runtime.handleRequest(rightEnvelope)];
  while (pending.length < 2) await Promise.resolve();
  pending.splice(0).forEach(resolve => resolve());
  await Promise.all(requests);
  assert.equal(calls, 2);
});

test("runtime rejects stale ownership, expired leases and cancelled jobs before fetch", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response("unexpected");
  });
  await assert.rejects(
    harness.runtime.handleRequest(await FuguangPaidRequestClient.createEnvelope(requestInput({ executionOwnerId: "owner-b" }))),
    error => error?.code === "PAID_REQUEST_STALE_EXECUTION"
  );
  await harness.store.putSnapshot({
    job: activeJob(harness.now, { executionLeaseExpiresAt: harness.now - 1, updatedAt: harness.now + 1 }),
    chunks: []
  });
  await assert.rejects(
    harness.runtime.handleRequest(await FuguangPaidRequestClient.createEnvelope(requestInput({ semanticRequestPath: "translation/expired" }))),
    error => error?.code === "PAID_REQUEST_STALE_EXECUTION"
  );
  await harness.store.putSnapshot({
    job: activeJob(harness.now, { cancelRequested: true, cancelRequestedAt: harness.now, updatedAt: harness.now + 2 }),
    chunks: []
  });
  await assert.rejects(
    harness.runtime.handleRequest(await FuguangPaidRequestClient.createEnvelope(requestInput({ semanticRequestPath: "translation/cancelled" }))),
    error => error?.name === "AbortError"
  );
  assert.equal(calls, 0);
});

test("client abort sends explicit cancel and runtime marks a submitted request unknown", async () => {
  let cancelCalls = 0;
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const responseCache = createMemoryResponseCache();
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store,
    responseCache,
    fetchImpl: (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    })
  });
  const client = FuguangPaidRequestClient.create({
    dispatch: envelope => runtime.handleRequest(envelope),
    cancel: envelope => {
      cancelCalls += 1;
      return runtime.cancelRequest(envelope);
    }
  });
  const controller = new AbortController();
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  const promise = client.request(requestInput({ signal: controller.signal }));
  let submitted = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await store.getOperation("job-a", "run-a", envelope.operation.operationId))?.state === "submitted") {
      submitted = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(submitted, true, "paid request should reach submitted before explicit cancellation");
  controller.abort(new Error("stop"));
  await assert.rejects(promise, error => error?.name === "AbortError");
  assert.equal(cancelCalls, 1);
  assert.equal((await store.getOperation("job-a", "run-a", envelope.operation.operationId)).state, "unknown");
});

test("runtime job cleanup removes cached response bodies and operations", async () => {
  const harness = await createHarness(async () => new Response("cached-body"));
  await harness.client.request(requestInput());
  assert.equal(harness.responseCache.values.size, 1);
  const deleted = await harness.runtime.deleteJobResults("job-a");
  assert.equal(deleted.cachedResults, 1);
  assert.equal(deleted.operations, 1);
  assert.equal(harness.responseCache.values.size, 0);
  assert.deepEqual(await harness.store.listOperations("job-a"), []);
});

test("expired cleanup atomically deletes the exact terminal run before its captured response bodies", async () => {
  const harness = await createHarness(async () => new Response("cached-body"));
  await harness.client.request(requestInput());
  const updatedAt = harness.now;
  const cutoff = updatedAt + 1;
  await harness.store.putSnapshot({
    job: activeJob(harness.now, {
      status: "completed",
      stage: "completed",
      updatedAt,
      executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  const result = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a",
    runToken: "run-a",
    expectedUpdatedAt: updatedAt,
    cutoff
  });
  assert.equal(result.applied, true);
  assert.equal(result.cachedResults, 1);
  assert.equal(harness.responseCache.values.size, 0);
  assert.equal(await harness.store.getJob("job-a"), null);
  assert.deepEqual(await harness.store.listOperations("job-a"), []);
});

test("expired cleanup rejects active, recent and changed runs without deleting durable results", async () => {
  const harness = await createHarness(async () => new Response("cached-body"));
  await harness.client.request(requestInput());
  const cutoff = harness.now - 10_000;
  const active = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a",
    runToken: "run-a",
    expectedUpdatedAt: harness.now,
    cutoff
  });
  assert.equal(active.reason, "active-job");
  await harness.store.putSnapshot({
    job: activeJob(harness.now, { status: "completed", stage: "completed", executionLeaseExpiresAt: 0 }),
    chunks: []
  });
  const recent = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a",
    runToken: "run-a",
    expectedUpdatedAt: harness.now,
    cutoff
  });
  assert.equal(recent.reason, "recent-job");
  const stale = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a",
    runToken: "older-run",
    expectedUpdatedAt: harness.now,
    cutoff: harness.now + 1
  });
  assert.equal(stale.reason, "stale-run");
  assert.equal(harness.responseCache.values.size, 1);
  assert.notEqual(await harness.store.getJob("job-a"), null);
  assert.equal((await harness.store.listOperations("job-a")).length, 1);
});

test("expired cleanup never claims a terminal-looking run with an active execution lease", async () => {
  const harness = await createHarness(async () => new Response("cached-body"));
  await harness.client.request(requestInput());
  const updatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(updatedAt, {
      status: "completed", stage: "completed", updatedAt,
      executionLeaseExpiresAt: updatedAt + 60_000
    }),
    chunks: []
  });
  const result = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: updatedAt,
    cutoff: updatedAt + 1, checkedAt: updatedAt + 1
  });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "active-lease");
  assert.equal(harness.responseCache.values.size, 1);
  assert.notEqual(await harness.store.getJob("job-a"), null);
  assert.equal((await harness.store.listOperations("job-a")).length, 1);
  assert.deepEqual(await harness.store.listCleanupClaims({ state: "pending" }), []);
});

test("expired cleanup losing a race to a new run never touches old or new cached results", async () => {
  const harness = await createHarness(async () => new Response("old-cached-body"));
  await harness.client.request(requestInput());
  const oldRef = [...harness.responseCache.values.keys()][0];
  const oldUpdatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(harness.now, {
      status: "completed", stage: "completed", updatedAt: oldUpdatedAt,
      executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  const originalDeleteExpiredJob = harness.store.deleteExpiredJob;
  harness.store.deleteExpiredJob = async expected => {
    await harness.store.beginAttempt({
      job: activeJob(harness.now + 10, {
        runToken: "run-new", executionRunToken: "run-new", status: "running", stage: "asr",
        updatedAt: harness.now + 10, executionOwnerId: "owner-new", executionEpoch: 1
      }),
      chunks: []
    }, "run-a");
    return originalDeleteExpiredJob(expected);
  };
  const newRef = "https://fuguang.local/__fuguang_operation_results/job-a/run-new/paid%3Anew";
  await harness.responseCache.put(newRef, "new-cached-body");
  const result = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: oldUpdatedAt, cutoff: oldUpdatedAt + 1
  });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "stale-run");
  assert.equal(await harness.responseCache.get(oldRef), "old-cached-body");
  assert.equal(await harness.responseCache.get(newRef), "new-cached-body");
  assert.equal((await harness.store.getJob("job-a")).runToken, "run-new");
});

test("expired cleanup keeps a durable retry claim when CacheStorage deletion throws", async () => {
  const harness = await createHarness(async () => new Response("cached-body"));
  await harness.client.request(requestInput());
  const updatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(updatedAt, {
      status: "completed", stage: "completed", updatedAt, executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  const originalDelete = harness.responseCache.delete;
  let attempts = 0;
  harness.responseCache.delete = async ref => {
    attempts += 1;
    if (attempts === 1) throw new Error("simulated CacheStorage failure");
    return originalDelete(ref);
  };

  await assert.rejects(harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: updatedAt,
    cutoff: updatedAt + 1, checkedAt: updatedAt + 1
  }), /simulated CacheStorage failure/);
  assert.equal(await harness.store.getJob("job-a"), null);
  assert.equal((await harness.store.listCleanupClaims({ state: "pending" })).length, 1);
  assert.equal(harness.responseCache.values.size, 1);

  const retried = await harness.runtime.drainPendingCleanupResults();
  assert.equal(retried.completed, 1);
  assert.equal(harness.responseCache.values.size, 0);
  assert.equal((await harness.store.listCleanupClaims({ state: "pending" })).length, 0);
  const retired = await harness.store.listCleanupClaims({ jobId: "job-a", runToken: "run-a" });
  assert.equal(retired.length, 1, "a completed claim remains as a retired-run guard");
  assert.equal(retired[0].state, "completed");
  assert.deepEqual(retired[0].resultRefs, []);
});

test("expired cleanup CAS loss creates no claim and touches no cached result", async () => {
  const harness = await createHarness(async () => new Response("old-cached-body"));
  await harness.client.request(requestInput());
  const oldRef = [...harness.responseCache.values.keys()][0];
  const oldUpdatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(oldUpdatedAt, {
      status: "completed", stage: "completed", updatedAt: oldUpdatedAt, executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  await harness.store.beginAttempt({
    job: activeJob(oldUpdatedAt + 10, {
      runToken: "run-new", executionRunToken: "run-new", status: "running", stage: "asr",
      updatedAt: oldUpdatedAt + 10, executionOwnerId: "owner-new", executionEpoch: 1
    }),
    chunks: []
  }, "run-a");
  const newRef = "https://fuguang.local/__fuguang_operation_results/job-a/run-new/paid%3Anew";
  await harness.responseCache.put(newRef, "new-cached-body");

  const result = await harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: oldUpdatedAt,
    cutoff: oldUpdatedAt + 1, checkedAt: oldUpdatedAt + 1
  });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "stale-run");
  assert.deepEqual(await harness.store.listCleanupClaims({ jobId: "job-a", runToken: "run-a" }), []);
  assert.equal(await harness.responseCache.get(oldRef), "old-cached-body");
  assert.equal(await harness.responseCache.get(newRef), "new-cached-body");
});

test("claimed old-run cleanup remains exact after a new run with the same job id starts", async () => {
  const harness = await createHarness(async () => new Response("old-cached-body"));
  await harness.client.request(requestInput());
  const oldRef = [...harness.responseCache.values.keys()][0];
  const oldUpdatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(oldUpdatedAt, {
      status: "completed", stage: "completed", updatedAt: oldUpdatedAt, executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  const claim = await harness.store.deleteExpiredJob({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: oldUpdatedAt,
    cutoff: oldUpdatedAt + 1, checkedAt: oldUpdatedAt + 1
  });
  assert.equal(claim.applied, true);
  await harness.store.beginAttempt({
    job: activeJob(oldUpdatedAt + 10, {
      runToken: "run-new", executionRunToken: "run-new", status: "running", stage: "asr",
      updatedAt: oldUpdatedAt + 10, executionOwnerId: "owner-new", executionEpoch: 1
    }),
    chunks: []
  }, "");
  const newRef = "https://fuguang.local/__fuguang_operation_results/job-a/run-new/paid%3Anew";
  await harness.responseCache.put(newRef, "new-cached-body");

  const drained = await harness.runtime.drainPendingCleanupResults();
  assert.equal(drained.completed, 1);
  assert.equal(await harness.responseCache.get(oldRef), null);
  assert.equal(await harness.responseCache.get(newRef), "new-cached-body");
  assert.equal((await harness.store.getJob("job-a")).runToken, "run-new");
});

test("partial cleanup failure retries all exact refs idempotently", async () => {
  const harness = await createHarness(async request => new Response(String(request.url)));
  await harness.client.request(requestInput({ semanticRequestPath: "translation/cleanup/one" }));
  await harness.client.request(requestInput({ semanticRequestPath: "translation/cleanup/two" }));
  const updatedAt = harness.now;
  await harness.store.putSnapshot({
    job: activeJob(updatedAt, {
      status: "completed", stage: "completed", updatedAt, executionLeaseExpiresAt: 0
    }),
    chunks: []
  });
  const refs = [...harness.responseCache.values.keys()].sort();
  const originalDelete = harness.responseCache.delete;
  let failedOnce = false;
  harness.responseCache.delete = async ref => {
    if (ref === refs[1] && !failedOnce) {
      failedOnce = true;
      throw new Error("second ref failed once");
    }
    return originalDelete(ref);
  };

  await assert.rejects(harness.runtime.cleanupExpiredJobResults({
    jobId: "job-a", runToken: "run-a", expectedUpdatedAt: updatedAt,
    cutoff: updatedAt + 1, checkedAt: updatedAt + 1
  }), /second ref failed once/);
  assert.equal(harness.responseCache.values.size, 1, "the first ref was already removed");
  assert.equal((await harness.store.listCleanupClaims({ state: "pending" }))[0].resultRefs.length, 2);

  const retried = await harness.runtime.drainPendingCleanupResults();
  assert.equal(retried.completed, 1);
  assert.equal(harness.responseCache.values.size, 0);
  assert.equal((await harness.store.listCleanupClaims({ state: "pending" })).length, 0);
});

test("a permanently failing cleanup claim does not starve later pending claims", async () => {
  const harness = await createHarness(async request => new Response(String(request.url)));
  await harness.client.request(requestInput({ semanticRequestPath: "translation/cleanup/job-a" }));
  await harness.store.putSnapshot({
    job: activeJob(harness.now, {
      id: "job-b", runToken: "run-b", executionRunToken: "run-b",
      executionOwnerId: "owner-b", executionEpoch: 1
    }),
    chunks: []
  });
  await harness.client.request(requestInput({
    jobId: "job-b", runToken: "run-b", executionOwnerId: "owner-b",
    semanticRequestPath: "translation/cleanup/job-b"
  }));
  for (const [jobId, runToken] of [["job-a", "run-a"], ["job-b", "run-b"]]) {
    await harness.store.putSnapshot({
      job: activeJob(harness.now, {
        id: jobId, runToken, executionRunToken: runToken,
        executionOwnerId: jobId === "job-a" ? "owner-a" : "owner-b",
        status: "completed", stage: "completed", executionLeaseExpiresAt: 0
      }),
      chunks: []
    });
    await harness.store.deleteExpiredJob({
      jobId, runToken, expectedUpdatedAt: harness.now,
      cutoff: harness.now + 1, checkedAt: harness.now + 1
    });
  }
  const claims = await harness.store.listCleanupClaims({ state: "pending" });
  const firstRef = claims.find(claim => claim.jobId === "job-a").resultRefs[0];
  const secondRef = claims.find(claim => claim.jobId === "job-b").resultRefs[0];
  const originalDelete = harness.responseCache.delete;
  harness.responseCache.delete = async ref => {
    if (ref === firstRef) throw new Error("job-a cache stays unavailable");
    return originalDelete(ref);
  };

  const drained = await harness.runtime.drainPendingCleanupResults();
  assert.equal(drained.completed, 1);
  assert.equal(drained.failed, 1);
  assert.notEqual(await harness.responseCache.get(firstRef), null);
  assert.equal(await harness.responseCache.get(secondRef), null);
  assert.deepEqual((await harness.store.listCleanupClaims({ state: "pending" })).map(claim => claim.jobId), ["job-a"]);
});

test("CacheStorage response adapter preserves large bodies exactly and deletes job results", async () => {
  const values = new Map();
  const cacheStorage = {
    async open() {
      return {
        async put(ref, response) { values.set(String(ref), await response.text()); },
        async match(ref) { return values.has(String(ref)) ? new Response(values.get(String(ref))) : undefined; },
        async delete(ref) { return values.delete(typeof ref === "string" ? ref : ref.url); },
        async keys() { return [...values.keys()].map(url => new Request(url)); }
      };
    }
  };
  const cache = FuguangPaidRequestRuntime.createCacheStorageResponseCache(cacheStorage);
  const ref = "https://fuguang.local/__fuguang_operation_results/job-a/run-a/paid%3Aexact";
  const bodyText = `https://provider.example/result?id=1&token=must-remain-exact\n${"字幕".repeat(15_000)}`;
  await cache.put(ref, bodyText);
  assert.equal(await cache.get(ref), bodyText);
  assert.equal(await cache.deleteJob("job-a"), 1);
  assert.equal(await cache.get(ref), null);
});

test("translation provider injects transport and gives response-format variants distinct stable paths", async () => {
  const paths = [];
  const timeouts = [];
  let calls = 0;
  const items = await FuguangBrowserTranslationProvider.requestBrowserTranslationItems(
    [{ start: 0, end: 1, text: "hello" }],
    {
      providerType: "openai",
      baseUrl: "https://transport-compat.example/v1",
      model: "test",
      apiKey: "secret"
    },
    "zh-CN",
    {},
    {
      semanticRequestPath: "translation/batch/0/attempt/0",
      requestTransport: async (_url, _init, options) => {
        paths.push(options.semanticRequestPath);
        timeouts.push(options.timeoutMs);
        calls += 1;
        return calls === 1
          ? new Response('{"error":{"message":"response_format is not supported"}}', {
            status: 400,
            headers: { "content-type": "application/json" }
          })
          : new Response('{"choices":[{"message":{"content":"{\\"items\\":[{\\"i\\":0,\\"text\\":\\"你好\\"}]}"}}]}', {
            status: 200,
            headers: { "content-type": "application/json" }
          });
      }
    }
  );
  assert.deepEqual(items, [{ i: 0, text: "你好" }]);
  assert.deepEqual(paths, [
    "translation/batch/0/attempt/0/openai/json",
    "translation/batch/0/attempt/0/openai/plain"
  ]);
  assert.deepEqual(timeouts, [120_000, 120_000]);
});

test("translation pipeline assigns stable initial-batch and missing-repair request paths", async () => {
  const paths = [];
  const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
    [
      { start: 0, end: 1, text: "first", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "second", chunkIndex: 0, segmentIndex: 1 }
    ],
    { providerType: "openai", baseUrl: "https://path-missing.example/v1", model: "test", apiKey: "secret" },
    "zh-CN",
    {},
    {
      semanticRequestPath: "translation/group/7",
      requestTransport: async (_url, init, options) => {
        paths.push(options.semanticRequestPath);
        const segments = JSON.parse(init.body).messages
          ? JSON.parse(JSON.parse(init.body).messages.find(message => message.role === "user").content).segments
          : [];
        const items = paths.length === 1
          ? [{ i: 0, text: "第一" }]
          : segments.map((segment, index) => ({ i: index, text: `修补-${segment.text}` }));
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items }) } }] }), {
          headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.deepEqual(translated.map(segment => segment.text), ["第一", "修补-second"]);
  assert.deepEqual(paths, [
    "translation/group/7/batch/0/attempt/0/openai/json",
    "translation/group/7/batch/0/missing/1/attempt/0/openai/json"
  ]);
});

test("whole-batch second attempt and split children keep different deterministic paths", async () => {
  const paths = [];
  const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
    Array.from({ length: 4 }, (_, index) => ({
      start: index,
      end: index + 0.5,
      text: `source-${index}`,
      chunkIndex: 0,
      segmentIndex: index
    })),
    { providerType: "openai", baseUrl: "https://path-split.example/v1", model: "test", apiKey: "secret" },
    "zh-CN",
    {},
    {
      semanticRequestPath: "translation/group/8",
      splitWorkers: 2,
      requestTransport: async (_url, init, options) => {
        paths.push(options.semanticRequestPath);
        const request = JSON.parse(init.body);
        const segments = JSON.parse(request.messages.find(message => message.role === "user").content).segments;
        let content;
        if (options.semanticRequestPath.includes("/attempt/0/") && !options.semanticRequestPath.includes("/split/")) {
          content = JSON.stringify({ items: [{ i: 999, text: "invalid" }] });
        } else if (options.semanticRequestPath.includes("/attempt/1/")) {
          content = "not json";
        } else {
          content = JSON.stringify({ items: segments.map((segment, index) => ({ i: index, text: `译-${segment.text}` })) });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
          headers: { "content-type": "application/json" }
        });
      }
    }
  );
  assert.deepEqual(translated.map(segment => segment.text), ["译-source-0", "译-source-1", "译-source-2", "译-source-3"]);
  assert.equal(paths[0], "translation/group/8/batch/0/attempt/0/openai/json");
  assert.equal(paths[1], "translation/group/8/batch/0/attempt/1/openai/json");
  assert.ok(paths.includes("translation/group/8/batch/0/split/0/attempt/0/openai/json"));
  assert.ok(paths.includes("translation/group/8/batch/0/split/1/attempt/0/openai/json"));
  assert.equal(new Set(paths).size, paths.length);
});

test("translation pipeline can execute its HTTP request through the durable offscreen transport", async () => {
  let calls = 0;
  const harness = await createHarness(async () => {
    calls += 1;
    return new Response('{"choices":[{"message":{"content":"{\\"items\\":[{\\"i\\":0,\\"text\\":\\"持久翻译\\"}]}"}}]}', {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "request-e2e" }
    });
  });
  const transport = harness.client.createRequestTransport({
    jobId: "job-a",
    runToken: "run-a",
    executionOwnerId: "owner-a",
    executionEpoch: 1
  });
  const translated = await FuguangBrowserTranslationPipeline.translateBrowserSegments(
    [{ start: 0, end: 1, text: "durable", chunkIndex: 0, segmentIndex: 0 }],
    { providerType: "openai", baseUrl: "https://durable-provider.example/v1", model: "test", apiKey: "sk-transient" },
    "zh-CN",
    {},
    { semanticRequestPath: "translation/group/e2e", requestTransport: transport }
  );
  assert.deepEqual(translated.map(segment => segment.text), ["持久翻译"]);
  assert.equal(calls, 1);
  const operations = await harness.store.listOperations("job-a", "run-a");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].state, "completed");
  assert.equal(operations[0].providerRequestId, "request-e2e");
  assert.equal(JSON.stringify(operations[0]).includes("sk-transient"), false);
});

test("runtime monitoring aborts an in-flight request when the durable job is cancelled", async () => {
  const now = Date.now();
  const store = FuguangJobStore.createMemory();
  await store.putSnapshot({ job: activeJob(now), chunks: [] });
  const responseCache = createMemoryResponseCache();
  let calls = 0;
  const runtime = FuguangPaidRequestRuntime.create({
    jobStore: store,
    responseCache,
    monitorIntervalMs: 1,
    fetchImpl: (_url, init) => new Promise((_, reject) => {
      calls += 1;
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    })
  });
  const envelope = await FuguangPaidRequestClient.createEnvelope(requestInput());
  const pending = runtime.handleRequest(envelope);
  let submitted = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await store.getOperation("job-a", "run-a", envelope.operation.operationId))?.state === "submitted") {
      submitted = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(submitted, true);
  await store.markCancelRequested("job-a", "run-a", Date.now());
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(calls, 1);
  assert.equal((await store.getOperation("job-a", "run-a", envelope.operation.operationId)).state, "submitted");
});
