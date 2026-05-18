/**
 * Diagnostic: print the live state of an admin user vs the deployed rules.
 * Run: node scripts/check-admin-state.mjs <uid>
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/check-admin-state.mjs <uid>');
  process.exit(2);
}

initializeApp({ projectId: 'redsracing-a7f8b', credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

(async () => {
  const ur = await auth.getUser(uid);
  console.log('=== Firebase Auth user ===');
  console.log('  email:        ', ur.email);
  console.log('  emailVerified:', ur.emailVerified);
  console.log('  disabled:     ', ur.disabled);
  console.log('  customClaims: ', ur.customClaims || {});
  console.log('  metadata:     ', { creation: ur.metadata.creationTime, lastSignIn: ur.metadata.lastSignInTime });

  const snap = await db.collection('users').doc(uid).get();
  console.log('\n=== Firestore users/' + uid + ' ===');
  if (!snap.exists) {
    console.log('  DOC DOES NOT EXIST');
  } else {
    const d = snap.data();
    console.log('  role:    ', d.role);
    console.log('  isAdmin: ', d.isAdmin);
    console.log('  isTeamMember:', d.isTeamMember);
    console.log('  isOwner:', d.isOwner);
    console.log('  all keys:', Object.keys(d));
  }

  console.log('\n=== Effective rule checks ===');
  const cc = ur.customClaims || {};
  const tokenAdmin = cc.role === 'admin' || cc.admin === true;
  const docRole = snap.exists && (snap.data().role === 'admin' || snap.data().isAdmin === true);
  console.log('  via TOKEN CLAIM (needs re-login if just set):', tokenAdmin);
  console.log('  via DOC ROLE (immediate, no re-login needed):', docRole);
  console.log('  isAdminOnly() should pass:', tokenAdmin || docRole);

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
