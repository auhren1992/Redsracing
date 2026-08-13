#!/usr/bin/env node
// scripts/inject-page-meta.mjs
//
// Idempotently inserts into <head> of every PUBLIC HTML file (root + Android
// mirrors) the following bootstrap tags so each page picks up Firestore
// page_meta + PWA + site-search:
//
//   <link rel="manifest" href="/manifest.json" />
//   <meta name="theme-color" content="#fbbf24" />
//   <meta property="og:image" content="/assets/img/og-default.jpg" />
//   <script src="assets/js/page-meta.js" defer></script>
//   <script src="assets/js/site-search.js" defer></script>
//
// Existing tags of the same kind are preserved (we won't double-add). Lines
// are kept short so it diffs cleanly.
//
// Usage:  node scripts/inject-page-meta.mjs [--dry]

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TARGET_DIRS = [
  ROOT,
  join(ROOT, "android", "app", "src", "main", "assets"),
  join(ROOT, "android", "app", "src", "main", "assets", "www"),
  join(ROOT, "ios", "RedsRacing", "www")
];

const EXCLUDE_PREFIXES = [
  "admin",
  "debug",
  "test",
  "force-",
  "simple-",
  "migrate-",
  "modern-auth",
  "mobile-debug",
  "mobile-test",
  "live-race-admin",
  "live-race-widget",
  "setup-admin",
  "follower-login",
  "follower-dashboard",
  "team-settings",
  "fan-settings",
  "push-notifications",
  "redsracing-dashboard",
  "newsletter-footer",
  "temp_nav"
];
const EXCLUDE_EXACT = new Set([
  "404.html",
  "HEADER_TEMPLATE.html",
  "settings.html"
]);

function isPublicHtml(name) {
  if (!/\.html?$/i.test(name)) return false;
  if (EXCLUDE_EXACT.has(name)) return false;
  const lower = name.toLowerCase();
  for (const p of EXCLUDE_PREFIXES) if (lower.startsWith(p)) return false;
  return true;
}

const DRY = process.argv.includes("--dry");

function ensureLine(html, predicate, line) {
  if (predicate(html)) return { html, changed: false };
  const headClose = html.search(/<\/head>/i);
  if (headClose === -1) return { html, changed: false };
  const insert = "    " + line + "\n  ";
  const updated = html.slice(0, headClose) + insert + html.slice(headClose);
  return { html: updated, changed: true };
}

function processFile(filePath) {
  let html = readFileSync(filePath, "utf8");
  let changed = false;

  // 1. manifest link
  const hasManifest = /<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.json["'][^>]*>/i.test(html)
    || /<link[^>]+rel=["']manifest["'][^>]+href=["']manifest\.json["'][^>]*>/i.test(html);
  if (!hasManifest) {
    // Strip any existing site.webmanifest reference to avoid double
    if (/<link[^>]+rel=["']manifest["'][^>]+href=["']site\.webmanifest["'][^>]*>/i.test(html)) {
      html = html.replace(/<link[^>]+rel=["']manifest["'][^>]+href=["']site\.webmanifest["'][^>]*>/i,
        '<link rel="manifest" href="/manifest.json" />');
      changed = true;
    } else {
      const r = ensureLine(html, () => false, '<link rel="manifest" href="/manifest.json" />');
      if (r.changed) { html = r.html; changed = true; }
    }
  }

  // 2. theme-color
  const themeRe = /<meta[^>]+name=["']theme-color["'][^>]*>/i;
  if (!themeRe.test(html)) {
    const r = ensureLine(html, () => false, '<meta name="theme-color" content="#fbbf24" />');
    if (r.changed) { html = r.html; changed = true; }
  }

  // 3. og:image fallback (so social previews never blank out — runtime script
  //    overwrites when Firestore data is available)
  const ogImageRe = /<meta[^>]+property=["']og:image["'][^>]*>/i;
  if (!ogImageRe.test(html)) {
    const r = ensureLine(html, () => false,
      '<meta property="og:image" content="/assets/img/og-default.jpg" />');
    if (r.changed) { html = r.html; changed = true; }
    const twitterImg = /<meta[^>]+name=["']twitter:image["'][^>]*>/i;
    if (!twitterImg.test(html)) {
      const r2 = ensureLine(html, () => false,
        '<meta name="twitter:image" content="/assets/img/og-default.jpg" />');
      if (r2.changed) { html = r2.html; changed = true; }
    }
  }

  // 4. page-meta.js
  const pageMetaRe = /<script[^>]+src=["'][^"']*assets\/js\/page-meta\.js[^"']*["'][^>]*>/i;
  if (!pageMetaRe.test(html)) {
    const r = ensureLine(html, () => false,
      '<script src="assets/js/page-meta.js" defer></script>');
    if (r.changed) { html = r.html; changed = true; }
  }

  // 5. site-search.js
  const searchRe = /<script[^>]+src=["'][^"']*assets\/js\/site-search\.js[^"']*["'][^>]*>/i;
  if (!searchRe.test(html)) {
    const r = ensureLine(html, () => false,
      '<script src="assets/js/site-search.js" defer></script>');
    if (r.changed) { html = r.html; changed = true; }
  }

  if (changed && !DRY) writeFileSync(filePath, html);
  return changed;
}

function walk(dir) {
  let count = 0;
  let touched = 0;
  let names;
  try { names = readdirSync(dir); } catch { return { count, touched }; }
  for (const name of names) {
    if (!isPublicHtml(name)) continue;
    const fp = join(dir, name);
    try {
      if (!statSync(fp).isFile()) continue;
      count++;
      if (processFile(fp)) touched++;
    } catch (e) {
      console.warn("[inject] failed", fp, e.message);
    }
  }
  return { count, touched };
}

let totalSeen = 0;
let totalTouched = 0;
for (const dir of TARGET_DIRS) {
  if (!existsSync(dir)) continue;
  const { count, touched } = walk(dir);
  totalSeen += count;
  totalTouched += touched;
  console.log(`[inject] ${dir}: ${touched}/${count} updated`);
}
console.log(`[inject] total: ${totalTouched}/${totalSeen} HTML files updated${DRY ? " (dry-run)" : ""}`);
