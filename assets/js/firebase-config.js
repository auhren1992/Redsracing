// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
  authDomain: "redsracing-a7f8b.firebaseapp.com",
  projectId: "redsracing-a7f8b",
  storageBucket: "redsracing-a7f8b.appspot.com",
  messagingSenderId: "517034606151",
  appId: "1:517034606151:web:24cae262e1d98832757b62"
};

// Function to get Firebase configuration
export async function getFirebaseConfig() {
    return firebaseConfig;
}

// Legacy exports for backward compatibility (dynamically initialized elsewhere)
// These will be set by firebase-core.js after initialization
export let app = null;
export let auth = null;
export let db = null;
export let storage = null;
