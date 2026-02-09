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

// Check for persistent session marker
const hasAuthMarker = !!localStorage.getItem('rr_auth_uid');

// Add a grace period to allow Firebase Auth to hydrate before redirecting
// If we have an auth marker, wait longer to avoid premature redirect
const REDIRECT_GRACE_MS = hasAuthMarker ? 4000 : 3000;

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

  const normalizeRole = (role) => {
    if (typeof role !== "string") return null;
    return role.trim().toLowerCase().replace(/[\s_]+/g, "-");
  };

  monitorAuthState(
    async (user) => {
      if (!user) {
        // Do not immediately redirect; wait for grace period
        return;
      }

      // We have a user - cancel redirect timer
      clearTimeout(graceTimer);

      try {
        const resolveRole = async (forceRefresh = false) => {
          // Pass user object to ensure we validate the correct user even if auth global isn't ready
          let claimsResult = await validateUserClaims([], user);
          let nextRole = claimsResult.success ? (claimsResult.claims.role || null) : null;

          if (user && (!nextRole || forceRefresh)) {
            try {
              const tokenResult = await user.getIdTokenResult(true);
              nextRole = tokenResult?.claims?.role || nextRole;
            } catch (_) {}
          }

          if (!nextRole && user) {
            // Fallback to users doc role
            try {
              const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
              const db = getFirestore();
              const snap = await getDoc(doc(db, 'users', user.uid));
              if (snap.exists()) {
                const data = snap.data() || {};
                if (typeof data.role === 'string' && data.role) nextRole = data.role;
              }
            } catch (_) {}
          }

          return normalizeRole(nextRole);
        };

        let normalizedRole = await resolveRole(false);
        const isTeamMember = ['team-member', 'admin'].includes(normalizedRole);
        const isFollower = ['teamredfollower', 'public-fan', 'follower'].includes(normalizedRole);

        if (teamMemberPages.includes(currentPage) && !isTeamMember) {
          normalizedRole = await resolveRole(true);
        }
        const finalIsTeamMember = ['team-member', 'admin'].includes(normalizedRole);
        const finalIsFollower = ['teamredfollower', 'public-fan', 'follower'].includes(normalizedRole);

        if (teamMemberPages.includes(currentPage) && !finalIsTeamMember) {
          console.warn('[AuthGuard] User does not have team-member role, redirecting to follower dashboard. Role:', normalizedRole);
          navigateToInternal('/follower-dashboard.html');
        } else if (
          followerPages.includes(currentPage) &&
          !finalIsFollower
        ) {
          console.warn('[AuthGuard] User does not have follower role, redirecting to main dashboard. Role:', normalizedRole);
          navigateToInternal('/redsracing-dashboard.html');
        }
      } catch (error) {
        console.error('[AuthGuard] Error resolving role:', error);
        // On error, only redirect after grace period (which we've already cleared due to user)
        // safeRedirectToLogin();
      }
    },
    (error) => {
      // On auth errors, only redirect after the grace period
      // clearTimeout(graceTimer);
      // safeRedirectToLogin();
    },
  );
}
