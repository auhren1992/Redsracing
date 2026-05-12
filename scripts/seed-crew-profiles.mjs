#!/usr/bin/env node
// scripts/seed-crew-profiles.mjs
//
// One-shot: seeds 3 placeholder crew_profiles docs in Firestore so the team
// page has something to render until the user fills them in via the admin UI.
//
// Auth: uses Application Default Credentials. Run with the Firebase CLI's
// service account or `gcloud auth application-default login`.
//
// Usage:  node scripts/seed-crew-profiles.mjs
//   (idempotent — uses `set` with { merge: true } so re-runs are safe)

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "redsracing-a7f8b";

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();

const seeds = [
  {
    slug: "crew-member-1",
    name: "Crew Member 1",
    role: "crew-chief",
    bio: "Profile coming soon.",
    photoUrl: "",
    joinedYear: 2024,
    pinned: true,
    order: 1,
    social: {}
  },
  {
    slug: "crew-member-2",
    name: "Crew Member 2",
    role: "mechanic",
    bio: "Profile coming soon.",
    photoUrl: "",
    joinedYear: 2024,
    pinned: false,
    order: 2,
    social: {}
  },
  {
    slug: "crew-member-3",
    name: "Crew Member 3",
    role: "tire-tech",
    bio: "Profile coming soon.",
    photoUrl: "",
    joinedYear: 2025,
    pinned: false,
    order: 3,
    social: {}
  }
];

async function main() {
  let wrote = 0;
  for (const s of seeds) {
    const ref = db.collection("crew_profiles").doc(s.slug);
    await ref.set(
      {
        ...s,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    wrote++;
  }
  console.log(`[seed-crew-profiles] wrote ${wrote} docs to crew_profiles`);
}

main().catch((e) => {
  console.error("[seed-crew-profiles] failed:", e);
  process.exit(1);
});
