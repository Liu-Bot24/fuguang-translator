import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../../extension/src/diagnostics/diagnostics.html", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../../extension/src/diagnostics/diagnostics.js", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");

test("diagnostics page packages cache references without Base64 runtime payloads", async () => {
  assert.ok(html.includes('src="diagnostics.js"'));
  assert.ok(source.includes("caches.open(file.cacheName)"));
  assert.ok(source.includes("createTar(entries)"));
  assert.equal(serviceWorker.includes("arrayBufferToBase64"), false);
  assert.equal(/audioFiles\.push\(\{[\s\S]{0,500}\bbase64\s*:/.test(serviceWorker), false);

  const form = { addEventListener() {} };
  const input = { value: "" };
  const status = { textContent: "" };
  const context = vm.createContext({
    Blob,
    TextEncoder,
    Uint8Array,
    Date,
    URL,
    location: { href: "chrome-extension://test/src/diagnostics/diagnostics.html" },
    document: {
      querySelector(selector) {
        return selector === "#exportForm" ? form : selector === "#jobId" ? input : status;
      }
    },
    chrome: { runtime: { sendMessage: async () => ({ ok: false }) } },
    caches: { open: async () => ({ match: async () => null }) },
    setTimeout
  });
  vm.runInContext(source, context, { filename: "diagnostics.js" });
  const tar = context.createTar([
    { path: "diagnostics.json", bytes: new TextEncoder().encode("{}\n") },
    { path: "audio/chunk.mp3", bytes: Uint8Array.from([1, 2, 3]) }
  ]);
  const bytes = new Uint8Array(await tar.arrayBuffer());
  assert.equal(bytes.byteLength % 512, 0);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 16)).replace(/\0+$/, ""), "diagnostics.json");
  assert.equal(new TextDecoder().decode(bytes.slice(257, 262)), "ustar");
  assert.equal(bytes.slice(-1024).every(value => value === 0), true);
});
