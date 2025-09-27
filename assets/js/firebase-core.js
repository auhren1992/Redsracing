// assets/js/firebase-core-fixed.js
import { getFirebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
