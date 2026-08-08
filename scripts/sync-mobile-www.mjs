#!/usr/bin/env node
/**
 * Sync public web files from repo root into mobile app bundles.
 *
 * Targets:
 *   - android/app/src/main/assets/www
 *   - ios/RedsRacing/www
 *
 * Usage: node scripts/sync-mobile-www.mjs
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TARGETS = [
  join(ROOT, "android", "app", "src", "main", "assets", "www"),
  join(ROOT, "ios", "RedsRacing", "www"),
];

const SKIP_DIRS = new Set([
  "android",
  "ios",
  "node_modules",
  ".git",
  ".github",
  ".firebase",
  "dist",
  "functions",
  "functions_python",
  "tools",
  "temp",
  "tests",
  "services",
  "docs",
  "scripts",
  "api",
  "venv",
  ".venv",
  "__pycache__",
  "Redsracing", // nested accidental duplicate — never bundle
  "cms",
]);

const SKIP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "storage.rules",
  "webpack.config.js",
  "tailwind.config.js",
  "stats.json",
  ".firebaserc",
  "robots.txt",
  ".eslintrc.json",
  ".stylelintrc.json",
  "cors.json",
  "HEADER_TEMPLATE.html",
  "debug-logs-admin-panel.txt",
  "footer-replacement.txt",
  "temp-footer-content.txt",
  "sitemap.xml",
  "ads.txt",
]);

const ALLOWED_EXT = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".png",
  ".ico",
  ".svg",
  ".jpg",
  ".jpeg",
  ".webp",
  ".webmanifest",
  ".woff",
  ".woff2",
  ".ttf",
  ".map",
  ".ics",
  ".txt",
  ".xml",
]);

const ALWAYS_COPY_DIRS = new Set(["assets", "styles", "data", "components"]);

function shouldCopyFile(name) {
  if (SKIP_FILES.has(name)) return false;
  if (name.startsWith("_")) return false;
  if (/^(deploy-|validate_|set-admin|admin-diagnostic|dropdown-fallback|add-visual-editor)/.test(name)) {
    return false;
  }
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return ALLOWED_EXT.has(name.slice(dot).toLowerCase());
}

function copyTree(srcDir, destDir, rel = "") {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const name = entry.name;
    if (name === "." || name === "..") continue;
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    const relPath = rel ? `${rel}/${name}` : name;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      if (rel === "" && SKIP_DIRS.has(name)) continue;
      copyTree(srcPath, destPath, relPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (ALWAYS_COPY_DIRS.has(rel.split("/")[0] ?? "") || ALWAYS_COPY_DIRS.has(name)) {
      cpSync(srcPath, destPath);
      continue;
    }
    if (shouldCopyFile(name)) {
      cpSync(srcPath, destPath);
    }
  }
}

function prepareTarget(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

let files = 0;
function countFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) countFiles(p);
    else files++;
  }
}

console.log("Syncing web bundle from:", ROOT);
for (const target of TARGETS) {
  prepareTarget(target);
  copyTree(ROOT, target);
  files = 0;
  countFiles(target);
  console.log(`  ${relative(ROOT, target)} — ${files} files`);
}
console.log("Done.");
