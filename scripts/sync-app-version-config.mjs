/**
 * Sync Firestore app_config/{android,ios}_version to the current native
 * marketing + build versions (from gradle / Xcode), keeping both platforms equal.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=functions/serviceAccountKey.json \
 *     node scripts/sync-app-version-config.mjs
 *   node scripts/sync-app-version-config.mjs --code 205 --name 11.2.19
 *   node scripts/sync-app-version-config.mjs --dry-run
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function readNativeVersions() {
  const gradle = readFileSync(resolve(ROOT, 'android/app/build.gradle.kts'), 'utf8');
  const pbx = readFileSync(resolve(ROOT, 'ios/RedsRacing.xcodeproj/project.pbxproj'), 'utf8');
  const codeMatch = gradle.match(/versionCode\s*=\s*(\d+)/);
  const nameMatch = gradle.match(/versionName\s*=\s*"([^"]+)"/);
  const iosCodeMatch = pbx.match(/CURRENT_PROJECT_VERSION\s*=\s*(\d+)/);
  const iosNameMatch = pbx.match(/MARKETING_VERSION\s*=\s*([0-9.]+)/);
  const androidCode = codeMatch ? Number(codeMatch[1]) : 0;
  const androidName = nameMatch ? nameMatch[1] : '';
  const iosCode = iosCodeMatch ? Number(iosCodeMatch[1]) : 0;
  const iosName = iosNameMatch ? iosNameMatch[1] : '';
  if (androidCode && iosCode && androidCode !== iosCode) {
    throw new Error(`Native build mismatch: Android ${androidCode} vs iOS ${iosCode}`);
  }
  if (androidName && iosName && androidName !== iosName) {
    throw new Error(`Native name mismatch: Android ${androidName} vs iOS ${iosName}`);
  }
  return {
    latest_version: androidCode || iosCode,
    version_name: androidName || iosName
  };
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

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const fromFiles = readNativeVersions();
  const latest_version = Number(argValue('--code') || fromFiles.latest_version) || 0;
  const version_name = String(argValue('--name') || fromFiles.version_name || '').trim();
  if (!latest_version || !version_name) {
    throw new Error('Need both build code and version name (from files or --code/--name)');
  }

  const payloadBase = {
    latest_version,
    version_name,
    latest_version_name: version_name
  };

  console.log(`[sync-app-version-config] target build ${latest_version} (${version_name})`);
  if (dryRun) {
    console.log('[sync-app-version-config] dry-run only — not writing Firestore');
    process.exit(0);
  }

  initAdmin();
  const db = getFirestore();
  for (const id of ['android_version', 'ios_version']) {
    const ref = db.doc(`app_config/${id}`);
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : {};
    const next = {
      ...payloadBase,
      minimum_version: Number(prev.minimum_version || 0) || 0,
      update_message: typeof prev.update_message === 'string' ? prev.update_message : '',
      updated_at: FieldValue.serverTimestamp(),
      updated_by: 'sync-app-version-config.mjs'
    };
    await ref.set(next, { merge: true });
    console.log(`[sync-app-version-config] wrote app_config/${id}`, {
      latest_version: next.latest_version,
      version_name: next.version_name,
      minimum_version: next.minimum_version
    });
  }
  console.log('[sync-app-version-config] done');
  process.exit(0);
}

run().catch((err) => {
  console.error('[sync-app-version-config] failed:', err);
  process.exit(1);
});
