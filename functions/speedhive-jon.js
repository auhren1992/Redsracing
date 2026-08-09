/* eslint-env node */
"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const speedhiveHtml = require("./speedhive-html");
const speedhivePuppeteer = require("./speedhive-puppeteer");

const SPEEDHIVE_JON_PROFILE_URL =
  "https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e";

async function scrapeSpeedhiveJon() {
  const r = await fetch(SPEEDHIVE_JON_PROFILE_URL, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const html = await r.text();
  let events = speedhiveHtml.extractSpeedhiveEventsFromHtml(html);

  if (!events.length) {
    try {
      events = await speedhivePuppeteer.extractSpeedhiveEventsWithPuppeteer();
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
