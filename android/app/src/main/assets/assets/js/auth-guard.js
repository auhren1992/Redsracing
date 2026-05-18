import { navigateToInternal } from "./navigation-helpers.js";
import { monitorAuthState } from "./auth-utils.js";
import {
  APP_ROLE,
  resolveAppRoleForUser,
  defaultDashboardPath,
  toStoredFirestoreRole,
} from "./roles.js";

/** Path under site root, no leading slash, lowercase (e.g. fan/dashboard.html). */
function getPageKey() {
  const raw = (window.location.pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return raw || "index.html";
}

const pageKey = getPageKey();

const protectedPaths = new Set([
  "admin-console.html",
  "profile.html",
  "follower-dashboard.html",
  "fan/dashboard.html",
  "crew/dashboard.html",
  "racer/dashboard.html",
  "redsracing-dashboard.html",
]);

const crewPaths = new Set(["crew/dashboard.html", "redsracing-dashboard.html"]);
const adminOnlyPaths = new Set(["admin-console.html"]);
const followerPaths = new Set([
  "follower-dashboard.html",
  "follower/index.html",
  "fan/dashboard.html",
  "racer/dashboard.html",
]);

const hasAuthMarker = !!localStorage.getItem("rr_auth_uid");
const REDIRECT_GRACE_MS = hasAuthMarker ? 4000 : 3000;

if (protectedPaths.has(pageKey)) {
  let redirected = false;
  const safeRedirectToLogin = () => {
    if (redirected) return;
    redirected = true;
    navigateToInternal("/login.html");
  };

  const graceTimer = setTimeout(() => {
    safeRedirectToLogin();
  }, REDIRECT_GRACE_MS);

  monitorAuthState(
    async (user) => {
      if (!user) {
        return;
      }

      clearTimeout(graceTimer);

      try {
        let appRole = await resolveAppRoleForUser(user, { forceTokenRefresh: false });

        const ensureUserProfile = async (canonical) => {
          const { getFirebaseDb } = await import("./firebase-core.js");
          const db = getFirebaseDb();
          const { doc, getDoc, setDoc } = await import(
            "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js",
          );
          const profileRef = doc(db, "users", user.uid);
          const snap = await getDoc(profileRef);
          if (snap.exists()) return;
          const storedRole = toStoredFirestoreRole(canonical);
          const profile = {
            username: user.email ? user.email.split("@")[0] : "user",
            displayName:
              user.displayName ||
              (user.email ? user.email.split("@")[0] : "New Member"),
            bio: "New member of the RedsRacing community!",
            avatarUrl: user.photoURL || "",
            favoriteCars: [],
            joinDate: new Date().toISOString(),
            totalPoints: 0,
            achievementCount: 0,
            role: storedRole,
          };
          await setDoc(profileRef, profile, { merge: true });
        };

        try {
          await ensureUserProfile(appRole);
        } catch (error) {
          console.warn("[AuthGuard] Failed to ensure user profile:", error);
        }

        if (
          (adminOnlyPaths.has(pageKey) && appRole !== APP_ROLE.ADMIN) ||
          (crewPaths.has(pageKey) && !isStaff(appRole))
        ) {
          appRole = await resolveAppRoleForUser(user, { forceTokenRefresh: true });
        }

        const finalAdmin = appRole === APP_ROLE.ADMIN;
        const finalStaff = isStaff(appRole);
        const finalFollower = appRole === APP_ROLE.FOLLOWER;

        if (adminOnlyPaths.has(pageKey) && !finalAdmin) {
          console.warn(
            "[AuthGuard] Admin-only page; user is not admin/owner. Role:",
            appRole,
          );
          navigateToInternal(defaultDashboardPath(appRole));
        } else if (crewPaths.has(pageKey) && !finalStaff) {
          console.warn(
            "[AuthGuard] Crew workspace requires staff role. Role:",
            appRole,
          );
          navigateToInternal(defaultDashboardPath(APP_ROLE.FOLLOWER));
        } else if (followerPaths.has(pageKey) && !finalFollower) {
          console.warn(
            "[AuthGuard] Fan/follower hub only; redirecting staff.",
            appRole,
          );
          if (finalAdmin) navigateToInternal(defaultDashboardPath(APP_ROLE.ADMIN));
          else navigateToInternal(defaultDashboardPath(APP_ROLE.CREW));
        }
      } catch (error) {
        console.error("[AuthGuard] Error resolving role:", error);
      }
    },
    () => {},
  );
}

function isStaff(role) {
  return role === APP_ROLE.ADMIN || role === APP_ROLE.CREW;
}
