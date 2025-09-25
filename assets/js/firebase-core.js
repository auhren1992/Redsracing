// assets/js/firebase-core-fixed.js
import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
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

        // Check if app already exists
        const existingApps = getApps();
        if (existingApps.length > 0) {
            app = existingApps[0];
        } else {
            app = initializeApp(config);
        }

        auth = getAuth(app);
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