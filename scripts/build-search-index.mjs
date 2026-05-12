#!/usr/bin/env node
// scripts/build-search-index.mjs
//
// Walks every public HTML page at the repo root and writes a search index to
// data/search-index.json. Each entry: { slug, url, title, description, body }.
// `body` is the first ~500 chars of visible text.
//
// Usage:  node scripts/build-search-index.mjs

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
];

const EXCLUDE_EXACT = new Set([
  "404.html",
  "HEADER_TEMPLATE.html",
  "newsletter-footer.html",
  "temp_nav.html",
  "settings.html",
  "signup.html",
  "login.html",
]);

function isPublicHtml(name) {
  if (!/\.html?$/i.test(name)) return false;
  if (EXCLUDE_EXACT.has(name)) return false;
  const lower = name.toLowerCase();
  for (const p of EXCLUDE_PREFIXES) if (lower.startsWith(p)) return false;
  return true;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  return {
    title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : "",
    description: descMatch ? descMatch[1].trim() : "",
  };
}

function processFile(file) {
  const full = join(ROOT, file);
  const html = readFileSync(full, "utf8");
  const { title, description } = extractMeta(html);
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[0] : html;
  const body = stripTags(bodyHtml).slice(0, 500);
  const slug = file.replace(/\.html?$/i, "");
  return {
    slug,
    url: "/" + file,
    title: title || slug,
    description,
    body,
  };
}

function main() {
  const entries = readdirSync(ROOT)
    .filter((f) => {
      try {
        return statSync(join(ROOT, f)).isFile() && isPublicHtml(f);
      } catch (_) {
        return false;
      }
    })
    .sort();

  const pages = entries
    .map((f) => {
      try {
        return processFile(f);
      } catch (e) {
        console.warn("[search-index] failed to process", f, e.message);
        return null;
      }
    })
    .filter(Boolean);

  const outDir = join(ROOT, "data");
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (_) {}
  const outFile = join(outDir, "search-index.json");
  writeFileSync(outFile, JSON.stringify(pages, null, 2) + "\n");
  console.log(
    "[search-index] wrote",
    pages.length,
    "pages →",
    "data/search-index.json",
  );
}

main();
