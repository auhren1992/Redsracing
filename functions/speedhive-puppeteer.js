/* eslint-env node */
"use strict";

const SPEEDHIVE_JON_RACES_URL =
  "https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e/races";

function collectRaceAnchorsInPage() {
  const anchors = Array.from(document.querySelectorAll("a"));
  const items = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const label = (a.textContent || "").trim();
    const interesting =
      /result|event|race/i.test(href) || /Jonathan\s+Kirsch/i.test(label);
    if (!interesting) continue;
    let date = "";
    const parent = a.closest("div,li,section,article") || document.body;
    const parentText = parent.innerText || "";
    const dm = parentText.match(
      /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/,
    );
    if (dm) date = dm[0];
    items.push({ name: label || "Race", link: href, date });
  }
  return items.slice(0, 50);
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
    const rendered = await page.evaluate(collectRaceAnchorsInPage);
    return Array.isArray(rendered) ? rendered : [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  extractSpeedhiveEventsWithPuppeteer,
};
