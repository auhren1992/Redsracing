import { getFirebaseConfig } from '/assets/js/firebase-config.js';
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Initialize Firebase
const config = getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
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