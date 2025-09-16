import { getFirebaseConfig } from '/assets/js/firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Initialize Firebase
const config = getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});
const storage = getStorage(app);

console.log("[Firebase Core] Firebase initialized at top level.");

// Export the initialized services
export function getFirebaseApp() {
    return app;
}

export function getFirebaseAuth() {
    return auth;
}

export function getFirebaseDb() {
    return db;
}

export function getFirebaseStorage() {
    return storage;
}