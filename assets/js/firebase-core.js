import { getFirebaseConfig } from '/assets/js/firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let firebaseCache = {
    app: null,
    auth: null,
    db: null,
    storage: null,
    initialized: false,
    initPromise: null
};

export async function initializeFirebaseCore() {
    if (firebaseCache.initialized) {
        return firebaseCache;
    }
    if (firebaseCache.initPromise) {
        return firebaseCache.initPromise;
    }
    firebaseCache.initPromise = (async () => {
        try {
            const config = await getFirebaseConfig();
            const app = initializeApp(config);
            const auth = getAuth(app);
            const db = initializeFirestore(app, {
                experimentalForceLongPolling: true,
                useFetchStreams: false
            });
            const storage = getStorage(app);

            firebaseCache.app = app;
            firebaseCache.auth = auth;
            firebaseCache.db = db;
            firebaseCache.storage = storage;
            firebaseCache.initialized = true;
            firebaseCache.initPromise = null;

            return firebaseCache;
        } catch (error) {
            firebaseCache.initPromise = null; // Also clear on failure
            throw error;
        }
    })();
    return firebaseCache.initPromise;
}

export function getFirebaseApp() {
    if (!firebaseCache.initialized) {
        throw new Error("Firebase not initialized");
    }
    return firebaseCache.app;
}

export function getFirebaseAuth() {
    if (!firebaseCache.initialized) {
        throw new Error("Firebase not initialized");
    }
    return firebaseCache.auth;
}

export function getFirebaseDb() {
    if (!firebaseCache.initialized) {
        throw new Error("Firebase not initialized");
    }
    return firebaseCache.db;
}

export function getFirebaseStorage() {
    if (!firebaseCache.initialized) {
        throw new Error("Firebase not initialized");
    }
    return firebaseCache.storage;
}