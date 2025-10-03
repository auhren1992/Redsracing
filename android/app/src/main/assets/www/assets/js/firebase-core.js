// assets/js/firebase-core-fixed.js
import { getFirebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, initializeFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Singleton pattern to prevent multiple initializations
let app = null;
let auth = null;
let db = null;
let storage = null;

function initializeFirebaseIfNeeded() {
  if (!app) {
    const config = getFirebaseConfig();
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(config);
    auth = getAuth(app);
    try {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (e) {}
    // Use long-polling in WebView environments to avoid streaming issues (400s)
    try {
      db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
    } catch (_) {
      db = getFirestore(app);
    }
    storage = getStorage(app);
  }
  return { app, auth, db, storage };
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
