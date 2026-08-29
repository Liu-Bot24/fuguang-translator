import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const trackedFiles = sourceFiles();
const filesToContentScan = [...new Set([...trackedFiles, ...optionalLocalTextFiles()])]
  .filter(file => fs.existsSync(path.join(repoRoot, file)))
  .sort();

const secretPathPatterns = [
  { label: "tracked dotenv file", pattern: /(^|\/)\.env(?:\.|$)(?!example$)/ },
  { label: "tracked private key file", pattern: /(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx)$/i },
  { label: "tracked secret cache", pattern: /(^|\/)(?:secrets?|credentials?|tokens?)(?:\/|$)/i }
];

for (const file of trackedFiles) {
  for (const { label, pattern } of secretPathPatterns) {
    assert.equal(pattern.test(file), false, `${label}: ${file}`);
  }
}

const literalSecretPatterns = [
  { label: "private key block", pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { label: "OpenAI-style API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/ },
  { label: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/ },
  { label: "Groq API key", pattern: /\bgsk_[A-Za-z0-9]{24,}\b/ },
  { label: "xAI API key", pattern: /\bxai-[A-Za-z0-9_-]{24,}\b/ },
  { label: "GitHub personal access token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b/ },
  { label: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { label: "AWS access key id", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ }
];

const textFileExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".srt",
  ".svg",
  ".txt",
  ".vtt",
  ".xml",
  ".yaml",
  ".yml"
]);

for (const file of filesToContentScan) {
  if (!shouldScanText(file)) {
    continue;
  }
  const absolute = path.join(repoRoot, file);
  const content = fs.readFileSync(absolute, "utf8");
  for (const { label, pattern } of literalSecretPatterns) {
    assert.equal(pattern.test(content), false, `${label}: ${file}`);
  }
}

function shouldScanText(file) {
  const normalized = file.split(path.sep).join("/");
  if (normalized.startsWith("extension/web-ffmpeg/vendor/@ffmpeg/core/")) {
    return false;
  }
  return textFileExtensions.has(path.extname(normalized).toLowerCase())
    || normalized === ".gitignore"
    || normalized === "README.md";
}

function optionalLocalTextFiles() {
  return [
    // The local collaboration log is ignored and never packaged, but it still
    // must not become a place where plaintext credentials are pasted.
    "DEVELOPMENT_LOG.md"
  ].filter(file => fs.existsSync(path.join(repoRoot, file)));
}

function sourceFiles() {
  try {
    return execFileSync("git", [
      "-c",
      `safe.directory=${repoRoot}`,
      "ls-files",
      "-z"
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .split("\0")
      .filter(Boolean)
      .sort();
  } catch {
    return walkSourceTree(repoRoot).sort();
  }
}

function walkSourceTree(directory, relativeDirectory = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules"].includes(entry.name)) {
      continue;
    }
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceTree(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath.split(path.sep).join("/"));
    }
  }
  return files;
}
