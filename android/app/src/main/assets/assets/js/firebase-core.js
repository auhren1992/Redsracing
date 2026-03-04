// assets/js/firebase-core-fixed.js
import { getFirebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
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
    // CRITICAL: Get the DEFAULT app specifically, not just any app (e.g. newsletter-app)
    // Named apps like "newsletter-app" should not be used for auth
    const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');
    app = defaultApp || initializeApp(config);
    auth = getAuth(app);
    try {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (e) {}
    db = getFirestore(app);
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
