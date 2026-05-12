#!/usr/bin/env node
// scripts/seed-photo-tags.mjs
//
// One-shot: seeds `config/photo_tags` with the canonical tag vocabulary used
// by the gallery upload autocomplete. Safe to re-run (idempotent via set with
// merge:true) — uploaders can still type custom tags; this just powers the
// autocomplete suggestions.
//
// Auth: uses Application Default Credentials. Run with
//   gcloud auth application-default login
// or set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
//
// Usage:  node scripts/seed-photo-tags.mjs

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "redsracing-a7f8b";

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();

// Curated vocabulary. Order = preferred display order in the chip picker.
// Keep these lowercase + dash-cased; the renderer uppercases as needed.
const tags = [
  // Cars / drivers
  "#8",
  "#88",
  // Sessions / phases
  "qualifying",
  "feature-race",
  "heat-race",
  "practice",
  "podium",
  "victory-lane",
  "checkered-flag",
  "first-lap",
  "wreck",
  "comeback",
  "fastest-lap",
  "lap-traffic",
  // People
  "crew",
  "pit-crew",
  "family",
  "fans",
  // Vehicle / setup
  "engine",
  "chassis",
  "tires",
  "setup",
  "in-the-garage",
  "behind-the-scenes",
  // Tracks / surfaces
  "dirt-track",
  "asphalt",
  "short-track",
  "track-day",
  // Conditions
  "wet-track",
  "dusty",
  "night-race",
  "day-race",
  // Sponsors / media
  "sponsor",
  "sponsor-day",
  "interview",
  "social-content",
  // Milestones
  "milestone",
  "win",
  "championship",
  "rookie",
];

async function main() {
  console.log(`[seed-photo-tags] Writing to ${PROJECT_ID}/config/photo_tags`);
  await db
    .collection("config")
    .doc("photo_tags")
    .set(
      {
        tags,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "scripts/seed-photo-tags.mjs",
      },
      { merge: true }
    );
  console.log(`[seed-photo-tags] Wrote ${tags.length} tags.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-photo-tags] FAILED:", err);
    process.exit(1);
  });
