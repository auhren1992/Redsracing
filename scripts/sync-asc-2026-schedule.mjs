/**
 * Sync ASC 2026 schedule into data/schedule.json, functions/schedule-data.json,
 * and Firestore `races` (season 2026).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=functions/serviceAccountKey.json \
 *     node scripts/sync-asc-2026-schedule.mjs
 *   node scripts/sync-asc-2026-schedule.mjs --dry-run
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const { races2026 } = require('./asc-2026-schedule.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';
const dryRun = process.argv.includes('--dry-run');

function toJsonRace(r) {
  return {
    raceNumber: r.raceNumber,
    date: r.date,
    track: r.track,
    city: r.city,
    state: r.state,
    eventName: r.eventName,
    startTime: r.startTime,
    type: r.type,
    status: r.status
  };
}

function patchScheduleFile(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const season = (raw.seasons || []).find((s) => s.year === 2026);
  if (!season) throw new Error(`No 2026 season in ${path}`);
  season.isActive = true;
  season.races = races2026.map(toJsonRace);
  season.notes = '2026 American Super Cups Series — Regular Season Racing. Championship Banquet TBA.';
  raw.currentSeason = 2026;
  if (!dryRun) {
    writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
  }
  console.log(`[sync] ${dryRun ? 'would update' : 'updated'} ${path} (${season.races.length} races)`);
}

function initAdmin() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || resolve(ROOT, 'functions/serviceAccountKey.json');
  try {
    const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
  } catch {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
}

async function syncFirestore() {
  initAdmin();
  const db = getFirestore();
  const existing = await db.collection('races').where('season', '==', 2026).get();
  console.log(`[sync] firestore existing 2026 races: ${existing.size}`);
  if (dryRun) {
    console.log('[sync] dry-run — not writing Firestore');
    races2026.forEach((r) => console.log(`  ${r.raceNumber}. ${r.date} ${r.track}, ${r.state} [${r.status}]`));
    return;
  }

  // Delete in chunks of 400
  const docs = existing.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  for (let i = 0; i < races2026.length; i += 400) {
    const batch = db.batch();
    races2026.slice(i, i + 400).forEach((race) => {
      const ref = db.collection('races').doc();
      batch.set(ref, { ...race });
    });
    await batch.commit();
  }
  console.log(`[sync] firestore wrote ${races2026.length} 2026 races`);
}

async function run() {
  patchScheduleFile(resolve(ROOT, 'data/schedule.json'));
  patchScheduleFile(resolve(ROOT, 'functions/schedule-data.json'));
  await syncFirestore();
  console.log('[sync] done');
}

run().catch((err) => {
  console.error('[sync] failed:', err);
  process.exit(1);
});
