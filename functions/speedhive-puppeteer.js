/* eslint-env node */
"use strict";

const SPEEDHIVE_JON_RACES_URL =
  "https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e/races";

function isRaceAnchor(item) {
  return (
    /result|event|race/i.test(item.href) ||
    /Jonathan\s+Kirsch/i.test(item.label)
  );
}

function toRaceEvent(item) {
  const dm = String(item.parentText || "").match(
    /\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/,
  );
  return {
    name: item.label || "Race",
    link: item.href,
    date: dm ? dm[0] : "",
  };
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

    // Pull plain fields in the page, filter/map in Node (keeps page fn simple).
    const anchors = await page.$$eval("a", (nodes) =>
      nodes.map((a) => ({
        href: a.getAttribute("href") || "",
        label: (a.textContent || "").trim(),
        parentText: (
          (a.closest("div,li,section,article") || document.body).innerText || ""
        ).slice(0, 400),
      })),
    );

    return (anchors || [])
      .filter(isRaceAnchor)
      .slice(0, 50)
      .map(toRaceEvent);
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  extractSpeedhiveEventsWithPuppeteer,
};
