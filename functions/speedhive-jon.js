/* eslint-env node */
"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const SPEEDHIVE_JON_PROFILE_URL =
  "https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e";
const SPEEDHIVE_JON_RACES_URL =
  "https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e/races";

function extractSpeedhiveEventsFromHtml(html) {
  const text = html.replace(/\s+/g, " ");
  const events = [];
  try {
    const scriptBlocks = Array.from(
      html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi),
    ).map((m) => m[1]);
    for (const block of scriptBlocks) {
      if (!/"@type"\s*:\s*"Event"/i.test(block)) continue;
      const objMatches = block.match(/\{[\s\S]*?\}/g) || [];
      for (const raw of objMatches) {
        try {
          const obj = JSON.parse(raw);
          if (obj["@type"] !== "Event") continue;
          events.push({
            name: obj.name || null,
            startDate: obj.startDate || null,
            location: obj?.location?.name || null,
          });
        } catch (_) {
          /* ignore bad JSON fragments */
        }
      }
    }
  } catch (_) {
    /* ignore parse failures */
  }

  if (events.length) return events;

  const linkRx = /<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/gi;
  let m;
  while ((m = linkRx.exec(html)) !== null) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    if (!(/event|result|race/i.test(href) && label && label.length > 3)) continue;
    const around = text.slice(
      Math.max(0, m.index - 120),
      Math.min(text.length, m.index + 200),
    );
    const dateMatch = around.match(
      /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/,
    );
    events.push({
      name: label,
      date: dateMatch ? dateMatch[0] : null,
      link: href,
    });
  }
  return events;
}

async function extractSpeedhiveEventsWithPuppeteer() {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    );
    // Fixed allowlisted URL only (no user-controlled navigation).
    await page.goto(SPEEDHIVE_JON_RACES_URL, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });
    await page.waitForSelector("a", { timeout: 30000 }).catch(() => {});
    const rendered = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const items = [];
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        const label = (a.textContent || "").trim();
        if (
          !(
            /result|event|race/i.test(href) ||
            /Jonathan\s+Kirsch/i.test(label)
          )
        ) {
          continue;
        }
        let date = "";
        try {
          const parentText =
            (a.closest("div,li,section,article") || document.body).innerText ||
            "";
          const dm = parentText.match(
            /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/,
          );
          date = dm ? dm[0] : "";
        } catch (_) {
          /* ignore */
        }
        items.push({ name: label || "Race", link: href, date });
      }
      return items.slice(0, 50);
    });
    return Array.isArray(rendered) ? rendered : [];
  } finally {
    await browser.close().catch(() => {});
  }
}

async function scrapeSpeedhiveJon() {
  const r = await fetch(SPEEDHIVE_JON_PROFILE_URL, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await r.text();
  let events = extractSpeedhiveEventsFromHtml(html);

  if (!events.length) {
    try {
      events = await extractSpeedhiveEventsWithPuppeteer();
    } catch (e) {
      logger.warn(
        "Puppeteer render failed for Speedhive races",
        e?.message || e,
      );
    }
  }

  try {
    const db = getFirestore();
    await db.collection("speedhive_profiles").doc("jon_kirsch").set(
      {
        profileUrl: SPEEDHIVE_JON_PROFILE_URL,
        lastFetchedAt: FieldValue.serverTimestamp(),
        eventCount: events.length,
        events: events.slice(0, 100),
      },
      { merge: true },
    );
  } catch (_) {
    /* best-effort persist */
  }

  return events;
}

module.exports = {
  SPEEDHIVE_JON_PROFILE_URL,
  scrapeSpeedhiveJon,
};
