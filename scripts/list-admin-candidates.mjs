/**
 * Enumerate every Firebase Auth user along with their custom claims AND their
 * matching `users/{uid}` Firestore doc (role / isAdmin / isTeamMember).
 *
 * Purpose: when an admin console session reports "Missing or insufficient
 * permissions", we need to know:
 *   1. Which UID is actually signed in,
 *   2. Whether that UID has admin claims AND a matching users-doc,
 *   3. Whether there are *other* admin candidates (e.g. an email signed in
 *      under a different UID than the one we previously granted).
 *
 * Auth: ADC.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   $env:GCLOUD_PROJECT                  = "redsracing-a7f8b"
 *
 * Usage: node scripts/list-admin-candidates.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'redsracing-a7f8b';
initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

function flagsFromDoc(d) {
  if (!d) return { role: null, isAdmin: false, isTeamMember: false, isOwner: false };
  return {
    role: d.role || null,
    isAdmin: d.isAdmin === true,
    isTeamMember: d.isTeamMember === true,
    isOwner: d.isOwner === true,
  };
}

function isAdminByDoc(d) {
  if (!d) return false;
  return d.role === 'admin' || d.isAdmin === true;
}

function isAdminByClaim(c) {
  if (!c) return false;
  return c.role === 'admin' || c.admin === true;
}

(async () => {
  console.log(`\n[list-admin-candidates] project: ${PROJECT_ID}\n`);
  console.log('Walking all Auth users in pages of 1000…\n');

  const admins = [];
  const teamMembers = [];
  const orphanDocs = []; // users-docs with admin role but no Auth user

  let nextPageToken = undefined;
  let total = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const u of page.users) {
      total++;
      const claims = u.customClaims || {};
      let docData = null;
      try {
        const snap = await db.doc(`users/${u.uid}`).get();
        if (snap.exists) docData = snap.data();
      } catch (e) {
        // ignore, will show null
      }

      const adminClaim = isAdminByClaim(claims);
      const adminDoc = isAdminByDoc(docData);
      const teamClaim = claims.role === 'team-member' || claims.teamMember === true;
      const teamDoc = docData ? (docData.role === 'team-member' || docData.isTeamMember === true) : false;

      if (adminClaim || adminDoc) {
        admins.push({
          uid: u.uid,
          email: u.email || '(no email)',
          providers: u.providerData.map((p) => p.providerId).join(','),
          adminClaim,
          adminDoc,
          docFlags: flagsFromDoc(docData),
          claims,
          lastSignInTime: u.metadata?.lastSignInTime || '',
        });
      } else if (teamClaim || teamDoc) {
        teamMembers.push({
          uid: u.uid,
          email: u.email || '(no email)',
          teamClaim,
          teamDoc,
        });
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`Scanned ${total} Auth user(s).\n`);

  console.log(`================ ADMIN CANDIDATES (${admins.length}) ================`);
  if (!admins.length) {
    console.log('  (none — no one has admin claims OR admin users-doc role)');
  } else {
    for (const a of admins) {
      console.log(`  uid=${a.uid}`);
      console.log(`    email:       ${a.email}`);
      console.log(`    providers:   ${a.providers}`);
      console.log(`    claim admin: ${a.adminClaim}   doc admin: ${a.adminDoc}`);
      console.log(`    doc flags:   ${JSON.stringify(a.docFlags)}`);
      console.log(`    claims:      ${JSON.stringify(a.claims)}`);
      console.log(`    last signin: ${a.lastSignInTime}`);
      const consistent = a.adminClaim && a.adminDoc;
      const verdict = consistent ? 'OK (claim AND doc)' : (a.adminClaim ? 'CLAIM-ONLY (will work via token)' : 'DOC-ONLY (works only with isPrivilegedStaff() in rules)');
      console.log(`    verdict:     ${verdict}`);
      console.log('');
    }
  }

  if (teamMembers.length) {
    console.log(`================ TEAM MEMBERS (${teamMembers.length}) ================`);
    for (const t of teamMembers) {
      console.log(`  uid=${t.uid}  email=${t.email}  claim=${t.teamClaim}  doc=${t.teamDoc}`);
    }
  }

  // Orphan check — any users-doc with admin role for a non-existent Auth user?
  console.log('\nScanning users collection for admin docs without an Auth user…');
  const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
  for (const docSnap of usersSnap.docs) {
    try {
      await auth.getUser(docSnap.id);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        orphanDocs.push({ uid: docSnap.id, ...docSnap.data() });
      }
    }
  }
  if (orphanDocs.length) {
    console.log(`\nORPHAN admin docs (no matching Auth user): ${orphanDocs.length}`);
    for (const o of orphanDocs) console.log(`  uid=${o.uid}  email=${o.email}`);
  } else {
    console.log('  (none)');
  }

  process.exit(0);
})().catch((e) => {
  console.error('[list-admin-candidates] FAILED:', e);
  process.exit(1);
});
