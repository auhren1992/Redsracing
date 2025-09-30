// assets/js/router-fixed.js
import { navigateToInternal } from "./navigation-helpers.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

let isProcessing = false; // Prevent race conditions

async function resolveRoleWithFallback(user) {
  // First try custom claims
  const claimsResult = await validateUserClaims();
  let role = claimsResult.success ? (claimsResult.claims.role || null) : null;
  if (role) return role;

  // Fallback to users/{uid}.role from Firestore
  try {
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const db = getFirestore();
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data() || {};
      if (typeof data.role === 'string' && data.role) {
        role = data.role;
      }
    }
  } catch (_) {}
  return role;
}

monitorAuthState(
  async (user, token) => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      if (user) {
        const role = await resolveRoleWithFallback(user);

        // Route based on role with fallbacks
        if (role === 'admin' || role === 'team-member') {
          navigateToInternal('/admin-console.html');
        } else if (role === 'TeamRedFollower') {
          navigateToInternal('/follower-dashboard.html');
        } else {
          // Unknown role, send to login to avoid confusing profile loop
          navigateToInternal('/login.html');
        }
      } else {
        navigateToInternal('/login.html');
      }
    } catch (error) {
      // Fallback to login on error
      navigateToInternal('/login.html');
    } finally {
      isProcessing = false;
    }
  },
  (error) => {
    isProcessing = false;
    navigateToInternal('/login.html');
  },
);
