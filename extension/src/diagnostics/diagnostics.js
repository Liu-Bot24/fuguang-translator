const GET_PRELOAD_DIAGNOSTICS = "FUGUANG_GET_PRELOAD_DIAGNOSTICS";

const form = document.querySelector("#exportForm");
const jobIdInput = document.querySelector("#jobId");
const status = document.querySelector("#status");

const requestedJobId = new URL(location.href).searchParams.get("job") || "";
jobIdInput.value = requestedJobId;

form.addEventListener("submit", event => {
  event.preventDefault();
  exportDiagnostics(jobIdInput.value.trim()).catch(error => {
    status.textContent = `导出失败：${error.message || String(error)}`;
  });
});

async function exportDiagnostics(jobId) {
  if (!jobId) {
    throw new Error("请输入任务 ID。");
  }
  status.textContent = "正在读取诊断信息…";
  const response = await chrome.runtime.sendMessage({
    type: GET_PRELOAD_DIAGNOSTICS,
    jobId
  });
  if (!response?.ok) {
    throw new Error(response?.error || "后台没有返回诊断信息。");
  }
  const diagnostics = response.diagnostics || {};
  const entries = [{
    path: "diagnostics.json",
    bytes: new TextEncoder().encode(`${JSON.stringify(diagnostics, null, 2)}\n`)
  }];
  for (const file of response.audioFiles || []) {
    const cache = await caches.open(file.cacheName);
    const cached = await cache.match(file.cacheUrl);
    if (!cached) {
      throw new Error(`音频缓存已失效：${file.path}`);
    }
    entries.push({
      path: file.path,
      bytes: new Uint8Array(await cached.arrayBuffer())
    });
  }
  const tar = createTar(entries);
  const objectUrl = URL.createObjectURL(tar);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `liusheng-diagnostics-${safeFilePart(jobId)}.tar`;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  status.textContent = `已生成诊断包：${entries.length - 1} 个音频文件。`;
}

function createTar(entries) {
  const parts = [];
  for (const entry of entries) {
    const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || 0);
    parts.push(tarHeader(entry.path, bytes.byteLength), bytes);
    const padding = (512 - (bytes.byteLength % 512)) % 512;
    if (padding) {
      parts.push(new Uint8Array(padding));
    }
  }
  parts.push(new Uint8Array(1024));
  return new Blob(parts, { type: "application/x-tar" });
}

function tarHeader(path, size) {
  const header = new Uint8Array(512);
  const name = safeTarPath(path);
  writeTarText(header, 0, 100, name);
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarText(header, 257, 6, "ustar");
  writeTarText(header, 263, 2, "00");
  const checksum = header.reduce((sum, value) => sum + value, 0);
  writeTarOctal(header, 148, 8, checksum);
  return header;
}

function writeTarText(target, offset, length, value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  target.set(bytes.slice(0, Math.max(0, length - 1)), offset);
}

function writeTarOctal(target, offset, length, value) {
  const text = Math.max(0, Number(value) || 0).toString(8).padStart(length - 1, "0").slice(-(length - 1));
  writeTarText(target, offset, length, text);
}

function safeTarPath(value) {
  return String(value || "file.bin").replace(/^[/\\]+/, "").replace(/\.\.(?:[/\\]|$)/g, "_").slice(0, 99);
}

function safeFilePart(value) {
  return String(value || "job").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "job";
}
