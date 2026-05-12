/**
 * Flip one or more feature flags in `config/flags` (Firestore).
 *
 * Use:
 *   node scripts/flip-flag.mjs enable_photo_of_week                # → true
 *   node scripts/flip-flag.mjs enable_photo_of_week=false          # → false
 *   node scripts/flip-flag.mjs enable_photo_of_week enable_race_day_hub
 *
 * Auth: Application Default Credentials. Set on Windows via
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GCLOUD_PROJECT = "redsracing-a7f8b"
 *
 * Idempotent. Uses `merge: true`, so unrelated flags are untouched.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('No flags supplied. Example:');
  console.error('  node scripts/flip-flag.mjs enable_photo_of_week enable_race_day_hub=false');
  process.exit(2);
}

const updates = {};
for (const raw of args) {
  let key = raw;
  let val = true;
  const eq = raw.indexOf('=');
  if (eq !== -1) {
    key = raw.slice(0, eq);
    const rhs = raw.slice(eq + 1).toLowerCase();
    val = !(rhs === 'false' || rhs === '0' || rhs === 'off' || rhs === 'no');
  }
  if (!key) continue;
  updates[key] = val;
}

(async () => {
  console.log(`[flip-flag] config/flags ← ${JSON.stringify(updates)}`);
  await db.doc('config/flags').set(updates, { merge: true });

  const snap = await db.doc('config/flags').get();
  const data = snap.data() || {};
  const lines = Object.keys(updates)
    .sort()
    .map((k) => `  ${k}: ${data[k]}`);
  console.log('[flip-flag] verified live values:\n' + lines.join('\n'));
  process.exit(0);
})().catch((err) => {
  console.error('[flip-flag] failed:', err);
  process.exit(1);
});
