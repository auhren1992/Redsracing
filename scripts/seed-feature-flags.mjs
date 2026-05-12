/**
 * Seed config/flags in Firestore — idempotent (merge: true).
 * All flags default to false; admin can flip them on via the admin panel.
 * Usage: node scripts/seed-feature-flags.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'redsracing-a7f8b';

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

const DEFAULT_FLAGS = {
  enable_predictions_league: false,
  enable_driver_of_day:      false,
  enable_photo_of_week:      false,
  enable_sponsor_hotspots:   false,
  enable_fan_passport:       false,
  enable_audit_log_panel:    false,
  enable_quick_composer:     false,
  enable_race_day_hub:       false,
  enable_bulk_importer:      false
};

async function run() {
  console.log('Seeding config/flags …');
  await db.doc('config/flags').set(DEFAULT_FLAGS, { merge: true });
  console.log('Done. Flags set (merge=true — existing values preserved).');
  process.exit(0);
}

run().catch(function (err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
