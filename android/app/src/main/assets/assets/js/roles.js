/**
 * Canonical RedsRacing app roles (one mental model everywhere):
 *   admin  — full site + Firestore admin (treats legacy "owner" as admin)
 *   crew   — team / staff dashboard (Firestore still uses "team-member")
 *   follower — fans / public-fan / follower claims
 *
 * Storage may still use: admin | owner | team-member | public-fan | follower | …
 * Always resolve through this module for routing, nav visibility, and new profiles.
 *
 * Role-specific pages (edit these trees independently):
 *   admin/          → admin/index.html (redirect) + admin-console.html (app)
 *   crew/           → crew/dashboard.html (+ add more crew/*.html as needed)
 *   follower/       → follower/index.html (redirect) + fan/dashboard.html (+ fan/* as needed)
 *   racer/          → racer/dashboard.html (signup “racer” persona)
 */

export const APP_ROLE = {
  ADMIN: "admin",
  CREW: "crew",
  FOLLOWER: "follower",
};

/**
 * @param {unknown} role
 * @returns {string|null}
 */
export function normalizeRoleString(role) {
  if (typeof role !== "string") return null;
  const n = role.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return n || null;
}

/**
 * Combine custom claims + users/{uid} doc into one canonical role.
 * Priority: admin (incl. owner) > crew > follower.
 *
 * @param {{ tokenClaims?: Record<string, unknown>, userDoc?: Record<string, unknown>|null }} sources
 * @returns {"admin"|"crew"|"follower"}
 */
export function resolveCanonicalRoleFromSources({ tokenClaims = {}, userDoc = null } = {}) {
  const c = tokenClaims && typeof tokenClaims === "object" ? tokenClaims : {};
  const d = userDoc && typeof userDoc === "object" ? userDoc : {};

  const claimRole = normalizeRoleString(c.role);
  const docRole = normalizeRoleString(d.role);

  if (c.admin === true) return APP_ROLE.ADMIN;
  if (claimRole === "admin" || claimRole === "owner") return APP_ROLE.ADMIN;

  if (d.isAdmin === true || d.isOwner === true) return APP_ROLE.ADMIN;
  if (docRole === "admin" || docRole === "owner") return APP_ROLE.ADMIN;

  if (c.teamMember === true) return APP_ROLE.CREW;
  if (claimRole === "team-member" || claimRole === "crew" || claimRole === "team") return APP_ROLE.CREW;

  if (d.isTeamMember === true) return APP_ROLE.CREW;
  if (docRole === "team-member" || docRole === "crew" || docRole === "team") return APP_ROLE.CREW;

  return APP_ROLE.FOLLOWER;
}

/**
 * Resolve signed-in user's canonical app role (reads Firestore users/{uid}).
 */
export async function resolveAppRoleForUser(user, options = {}) {
  if (!user) return APP_ROLE.FOLLOWER;
  const { forceTokenRefresh = false } = options;

  let claims = {};
  try {
    const tr = await user.getIdTokenResult(!!forceTokenRefresh);
    claims = tr.claims || {};
  } catch (_) {
    try {
      const tr = await user.getIdTokenResult(false);
      claims = tr.claims || {};
    } catch (_) {}
  }

  let userDoc = null;
  try {
    const { getFirebaseDb } = await import("./firebase-core.js");
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js",
    );
    const snap = await getDoc(doc(getFirebaseDb(), "users", user.uid));
    if (snap.exists()) userDoc = snap.data() || {};
  } catch (_) {}

  return resolveCanonicalRoleFromSources({ tokenClaims: claims, userDoc });
}

/** Default landing URLs after login (role-specific namespaces). */
export const ROLE_HUB_PATH = {
  admin: "/admin/index.html",
  crew: "/crew/dashboard.html",
  follower: "/follower/index.html",
};

/**
 * Default home after login when no returnTo is present.
 * @param {"admin"|"crew"|"follower"} appRole
 */
export function defaultDashboardPath(appRole) {
  if (appRole === APP_ROLE.ADMIN) return ROLE_HUB_PATH.admin;
  if (appRole === APP_ROLE.CREW) return ROLE_HUB_PATH.crew;
  return ROLE_HUB_PATH.follower;
}

/**
 * Firestore `users/{uid}.role` string for brand-new profiles (rules understand these).
 * @param {"admin"|"crew"|"follower"} appRole
 */
export function toStoredFirestoreRole(appRole) {
  if (appRole === APP_ROLE.ADMIN) return "admin";
  if (appRole === APP_ROLE.CREW) return "team-member";
  return "public-fan";
}

/** @param {"admin"|"crew"|"follower"} appRole */
export function isAdminAppRole(appRole) {
  return appRole === APP_ROLE.ADMIN;
}

/** Admin or crew may use staff tooling / dashboards */
export function isStaffAppRole(appRole) {
  return appRole === APP_ROLE.ADMIN || appRole === APP_ROLE.CREW;
}
