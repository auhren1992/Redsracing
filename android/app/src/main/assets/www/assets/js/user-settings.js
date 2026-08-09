/**
 * user-settings.js — shared fan customization helpers
 * Canonical storage: users/{uid}.settings + localStorage rr_settings
 * Theme API: window.__rrTheme + html[data-theme]
 */
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const LOCAL_KEY = "rr_settings";

export function readLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function writeLocalSettings(settings) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(settings || {}));
  } catch (_) {}
}

/** Map settings.theme (auto|light|dark) → site theme */
export function applySiteTheme(theme) {
  const t = theme || "auto";
  let resolved = t;
  if (t === "auto") {
    resolved =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
  }
  try {
    if (window.__rrTheme && typeof window.__rrTheme.set === "function") {
      window.__rrTheme.set(resolved === "light" ? "light" : "dark");
    } else {
      document.documentElement.dataset.theme = resolved === "light" ? "light" : "dark";
      localStorage.setItem("rr_theme", resolved === "light" ? "light" : "dark");
    }
  } catch (_) {}
  // Keep legacy class in sync for older CSS
  try {
    document.documentElement.classList.toggle("dark", resolved !== "light");
  } catch (_) {}
  return resolved;
}

export async function loadUserSettings(uid) {
  const local = readLocalSettings();
  if (!uid) return { ...local };
  try {
    const db = getFirebaseDb();
    if (!db) return { ...local };
    const snap = await getDoc(doc(db, "users", uid));
    const remote = snap.exists() ? snap.data()?.settings || {} : {};
    return { ...local, ...remote };
  } catch {
    return { ...local };
  }
}

export async function saveUserSettings(uid, settings) {
  const payload = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  writeLocalSettings(payload);
  applySiteTheme(payload.theme || "auto");

  if (!uid) return payload;
  try {
    const db = getFirebaseDb();
    if (!db) return payload;
    const patch = { settings: payload, updatedAt: new Date() };
    // Align push topics with favorite driver without wiping the other key
    if (payload.favoriteDriver === "jon" || payload.favoriteDriver === "jonny") {
      patch.subscriptions = {
        "fan-8": payload.favoriteDriver === "jon",
        "fan-88": payload.favoriteDriver === "jonny",
      };
    }
    await setDoc(doc(db, "users", uid), patch, { merge: true });
  } catch (e) {
    console.warn("settings Firestore save failed", e);
  }
  return payload;
}

export function favoriteDriverLabel(value) {
  if (value === "jon") return "Jon #8";
  if (value === "jonny") return "Jonny #88";
  return "Not set";
}

export async function currentUid() {
  try {
    const auth = getFirebaseAuth();
    return auth?.currentUser?.uid || null;
  } catch {
    return null;
  }
}
