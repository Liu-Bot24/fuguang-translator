import assert from "node:assert/strict";
import test from "node:test";

import { FuguangRequestSemaphore } from "../../extension/src/shared/request-semaphore.js";

test("provider semaphore caps cross-job work and releases the next waiter", async () => {
  const order = [];
  let releaseFirst;
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });
  const first = FuguangRequestSemaphore.withPermit("llm|test", 1, async () => {
    order.push("first-start");
    await firstGate;
    order.push("first-end");
  });
  const second = FuguangRequestSemaphore.withPermit("llm|test", 1, async () => {
    order.push("second-start");
  });
  await Promise.resolve();
  assert.deepEqual(order, ["first-start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first-start", "first-end", "second-start"]);
});

test("queued permits honor cancellation and provider keys exclude credentials", async () => {
  let releaseFirst;
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });
  const first = FuguangRequestSemaphore.withPermit("asr|test", 1, () => firstGate);
  const controller = new AbortController();
  const second = FuguangRequestSemaphore.withPermit("asr|test", 1, async () => "unexpected", controller.signal);
  controller.abort(new Error("任务已停止。"));
  await assert.rejects(second, error => error?.name === "AbortError");
  releaseFirst();
  await first;

  const key = FuguangRequestSemaphore.providerKey("asr", {
    providerType: "openai",
    baseUrl: "https://api.example.test/v1/",
    model: "Whisper",
    apiKey: "secret"
  });
  assert.equal(key, "asr|openai|https://api.example.test/v1|whisper");
  assert.equal(key.includes("secret"), false);
});

test("Retry-After parses seconds and dates with a bounded delay", () => {
  const headers = value => ({ get: name => name.toLowerCase() === "retry-after" ? value : "" });
  assert.equal(FuguangRequestSemaphore.retryAfterMs(headers("2"), 0), 2000);
  assert.equal(FuguangRequestSemaphore.retryAfterMs(headers("Thu, 01 Jan 2026 00:00:03 GMT"), Date.parse("2026-01-01T00:00:00Z")), 3000);
  assert.equal(FuguangRequestSemaphore.retryAfterMs(headers("999"), 0), 120000);
  assert.equal(FuguangRequestSemaphore.retryAfterMs(headers("invalid"), 0), 0);
});
