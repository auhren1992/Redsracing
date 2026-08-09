// assets/js/firebase-core-fixed.js
import { getFirebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, initializeFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js";

// Singleton pattern to prevent multiple initializations
let app = null;
let auth = null;
let db = null;
let storage = null;
let functions = null;

function initializeFirebaseIfNeeded() {
  if (!app) {
    const config = getFirebaseConfig();
    const existingApps = getApps();
    // CRITICAL: Get the DEFAULT app specifically, not just any app (e.g. newsletter-app)
    // Named apps like "newsletter-app" should not be used for auth
    const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');
    app = defaultApp || initializeApp(config);
    auth = getAuth(app);
    try {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (e) {}
    // Android/iOS WebView + file:// origins can have issues with Firestore's WebChannel (Listen/channel),
    // causing intermittent HTTP 400s. Force long polling in those environments to stabilize reads/writes.
    const isLikelyWebView =
      (typeof navigator !== "undefined" && /wv|Android/i.test(navigator.userAgent || "")) ||
      (typeof location !== "undefined" && location.protocol === "file:");
    // Avoid double-init: compat `firebase.firestore()` or earlier getFirestore starts Firestore too;
    // initializeFirestore throws in that case — fall back to the default modular instance.
    try {
      db = isLikelyWebView
        ? initializeFirestore(app, {
            experimentalAutoDetectLongPolling: true,
            useFetchStreams: false,
          })
        : getFirestore(app);
    } catch (_) {
      db = getFirestore(app);
    }
    storage = getStorage(app);
    functions = getFunctions(app);
  }
  return { app, auth, db, storage, functions };
}

// Export getter functions that initialize if needed
export function getFirebaseApp() {
  return initializeFirebaseIfNeeded().app;
}

export function getFirebaseAuth() {
  return initializeFirebaseIfNeeded().auth;
}

export function getFirebaseDb() {
  return initializeFirebaseIfNeeded().db;
}

export function getFirebaseStorage() {
  return initializeFirebaseIfNeeded().storage;
}

export function getFirebaseFunctions() {
  return initializeFirebaseIfNeeded().functions;
}
