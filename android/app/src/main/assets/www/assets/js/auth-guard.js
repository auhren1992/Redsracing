import { navigateToInternal } from "./navigation-helpers.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

const protectedPages = [
  'redsracing-dashboard.html',
  'follower-dashboard.html',
  'profile.html',
  'admin-console.html',
];
const teamMemberPages = ['redsracing-dashboard.html', 'admin-console.html'];
const followerPages = ["follower-dashboard.html"];

const currentPage = window.location.pathname.split("/").pop();


// Add a short grace period to allow Firebase Auth to hydrate before redirecting
const REDIRECT_GRACE_MS = 1500;

if (protectedPages.includes(currentPage)) {
  let redirected = false;
  const safeRedirectToLogin = () => {
    if (redirected) return;
    redirected = true;
    navigateToInternal("/login.html");
  };

  const graceTimer = setTimeout(() => {
    // If we still haven't seen a user after the grace period, redirect to login
    safeRedirectToLogin();
  }, REDIRECT_GRACE_MS);

  const normalizeRole = (role) =>
    typeof role === "string" ? role.trim().toLowerCase() : null;

  monitorAuthState(
    async (user) => {
      if (!user) {
        // Do not immediately redirect; wait for grace period
        return;
      }

      // We have a user - cancel redirect timer
      clearTimeout(graceTimer);

      try {
        let claimsResult = await validateUserClaims();
        let role = claimsResult.success ? (claimsResult.claims.role || null) : null;

        if (!role && user) {
          try {
            const tokenResult = await user.getIdTokenResult(true);
            role = tokenResult?.claims?.role || null;
          } catch (_) {}
        }

        if (!role && user) {
          // Fallback to users doc role
          try {
            const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
            const db = getFirestore();
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
              const data = snap.data() || {};
              if (typeof data.role === 'string' && data.role) role = data.role;
            }
          } catch (_) {}
        }

        const normalizedRole = normalizeRole(role);
        const isTeamMember = ['team-member', 'admin'].includes(normalizedRole);
        const isFollower = normalizedRole === 'teamredfollower';

        if (teamMemberPages.includes(currentPage) && !isTeamMember) {
          navigateToInternal('/follower-dashboard.html');
        } else if (
          followerPages.includes(currentPage) &&
          !isFollower
        ) {
          navigateToInternal('/redsracing-dashboard.html');
        }
      } catch (error) {
        // On error, only redirect after grace period (which we've already cleared due to user)
        safeRedirectToLogin();
      }
    },
    (error) => {
      // On auth errors, only redirect after the grace period
      clearTimeout(graceTimer);
      safeRedirectToLogin();
    },
  );
}
