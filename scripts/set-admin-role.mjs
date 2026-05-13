/**
 * Grant admin permissions to a specific Firebase user.
 *
 * Sets BOTH so every existing rule path matches:
 *   1. Firestore `users/{uid}` doc → role: "admin", isAdmin: true
 *      (Legacy "owner" is treated as admin everywhere in the app; use admin for new grants.)
 *   2. Firebase Auth custom claims → { admin: true, role: "admin" }
 *
 * The user must sign out and back in (or wait ~1h for token refresh) for the
 * custom claim to take effect in client-side `auth.currentUser.getIdTokenResult()`.
 * The doc-side role works immediately.
 *
 * Auth: Application Default Credentials.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GCLOUD_PROJECT = "redsracing-a7f8b"
 *
 * Usage:  node scripts/set-admin-role.mjs <uid>
 *   ex.   node scripts/set-admin-role.mjs VDHP1DwfXWYGDIbcxkQK0aIgYsn2
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/set-admin-role.mjs <uid>');
  process.exit(2);
}

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

(async () => {
  console.log(`[set-admin-role] target uid: ${uid}`);

  let userRecord;
  try {
    userRecord = await auth.getUser(uid);
    console.log(`[set-admin-role] auth user: ${userRecord.email || '(no email)'}`);
  } catch (e) {
    console.error('[set-admin-role] FAILED to load auth user:', e.message);
    process.exit(1);
  }

  const existingClaims = userRecord.customClaims || {};
  const nextClaims = { ...existingClaims, admin: true, role: 'admin' };
  await auth.setCustomUserClaims(uid, nextClaims);
  console.log('[set-admin-role] custom claims set:', nextClaims);

  await db.collection('users').doc(uid).set(
    {
      role: 'admin',
      isAdmin: true,
      adminGrantedAt: FieldValue.serverTimestamp(),
      adminGrantedBy: 'scripts/set-admin-role.mjs',
      email: userRecord.email || null,
      displayName: userRecord.displayName || null,
    },
    { merge: true }
  );
  console.log('[set-admin-role] users/{uid} doc updated (role, isAdmin)');

  const snap = await db.collection('users').doc(uid).get();
  const data = snap.data() || {};
  console.log('[set-admin-role] verified doc fields:');
  console.log(`  role:    ${data.role}`);
  console.log(`  isAdmin: ${data.isAdmin}`);
  const refreshed = await auth.getUser(uid);
  console.log('[set-admin-role] verified claims:', refreshed.customClaims || {});

  console.log('\n[set-admin-role] DONE. The user must SIGN OUT and SIGN BACK IN');
  console.log('for the custom claim to apply in their browser (or wait ~1 h).');
  console.log('The Firestore doc-role takes effect immediately.');
  process.exit(0);
})().catch((err) => {
  console.error('[set-admin-role] FAILED:', err);
  process.exit(1);
});
