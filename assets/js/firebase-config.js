// This is a placeholder. In a real Firebase Hosting setup,
// this file would be automatically generated.
// For local development, you need to replace this with your actual
// Firebase project configuration.
// IMPORTANT: DO NOT COMMIT YOUR REAL CONFIGURATION TO A PUBLIC REPOSITORY.
// Use environment variables or a secure method to manage your keys.

// Function to fetch and cache the Firebase config
let firebaseConfig = null;

async function fetchFirebaseConfig() {
    try {
        // Firebase Hosting provides config at this path
        const response = await fetch('/__/firebase/init.json');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase config.');
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch Firebase config, falling back to placeholder. This is expected in local development if you haven't set up the local Firebase server.", error);
        // Fallback for local development if the above path doesn't work
        // IMPORTANT: Replace with your actual config for local testing,
        // but it's better to use the Firebase Local Emulator Suite which serves this file.
        // Fallback configuration for local development
        return {
            apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
            authDomain: "redsracing-a7f8b.firebaseapp.com",
            projectId: "redsracing-a7f8b",
            storageBucket: "redsracing-a7f8b.appspot.com",
            messagingSenderId: "517034606151",
            appId: "1:517034606151:web:24cae262e1d98832757b62"
        };
    }
}


export async function getFirebaseConfig() {
    if (!firebaseConfig) {
        firebaseConfig = await fetchFirebaseConfig();
    }
    return firebaseConfig;
}
