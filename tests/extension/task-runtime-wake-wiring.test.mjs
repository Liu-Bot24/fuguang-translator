import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");

test("service worker wakes the matching offscreen run only after durable work transitions", () => {
  assert.match(source, /await flushBrowserJobMirror\(record\.job\.id\);\s*await wakeOffscreenBrowserJob\(record, "audio-chunk-ready"\)/);
  assert.match(source, /await flushBrowserJobMirror\(record\.job\.id\);\s*await wakeOffscreenBrowserJob\(record, "extraction-completed"\)/);
  assert.match(source, /snapshot\.chunks\.some\([\s\S]*?chunk\?\.stage === "asr_done"[\s\S]*?await wakeOffscreenBrowserJob\(record, "work-queued"\)/);
  assert.match(source, /MESSAGE\.WAKE_JOB, \{\s*jobId: record\.job\.id,\s*runToken: record\.runToken/);
});
