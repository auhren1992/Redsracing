import { navigateToInternal } from "./navigation-helpers.js";
import { monitorAuthState } from "./auth-utils.js";
import {
  APP_ROLE,
  resolveAppRoleForUser,
  defaultDashboardPath,
  toStoredFirestoreRole,
} from "./roles.js";

const protectedPages = [
  "redsracing-dashboard.html",
  "follower-dashboard.html",
  "profile.html",
  "admin-console.html",
];
const crewPages = ["redsracing-dashboard.html"];
const adminOnlyPages = ["admin-console.html"];
const followerPages = ["follower-dashboard.html"];

const currentPage = window.location.pathname.split("/").pop();

const hasAuthMarker = !!localStorage.getItem("rr_auth_uid");
const REDIRECT_GRACE_MS = hasAuthMarker ? 4000 : 3000;

if (protectedPages.includes(currentPage)) {
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
          (adminOnlyPages.includes(currentPage) && appRole !== APP_ROLE.ADMIN) ||
          (crewPages.includes(currentPage) && !isStaff(appRole))
        ) {
          appRole = await resolveAppRoleForUser(user, { forceTokenRefresh: true });
        }

        const finalAdmin = appRole === APP_ROLE.ADMIN;
        const finalStaff = isStaff(appRole);
        const finalFollower = appRole === APP_ROLE.FOLLOWER;

        if (adminOnlyPages.includes(currentPage) && !finalAdmin) {
          console.warn(
            "[AuthGuard] Admin-only page; user is not admin/owner. Role:",
            appRole,
          );
          navigateToInternal(defaultDashboardPath(appRole));
        } else if (crewPages.includes(currentPage) && !finalStaff) {
          console.warn(
            "[AuthGuard] Crew dashboard requires staff role. Role:",
            appRole,
          );
          navigateToInternal("/follower-dashboard.html");
        } else if (followerPages.includes(currentPage) && !finalFollower) {
          console.warn(
            "[AuthGuard] Follower hub is for fans only; redirecting staff.",
            appRole,
          );
          if (finalAdmin) navigateToInternal("/admin-console.html");
          else navigateToInternal("/redsracing-dashboard.html");
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
