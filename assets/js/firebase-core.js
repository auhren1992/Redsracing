/**
 * Firebase Core Module
 * Centralized Firebase initialization with config validation, caching, and error handling
 */

import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Cache for initialized Firebase services
let firebaseCache = {
    app: null,
    auth: null,
    db: null,
    storage: null,
    initialized: false,
    initPromise: null
};

/**
 * Validates Firebase configuration
 * @param {Object} config - Firebase configuration object
 * @returns {boolean} - True if config is valid
 */
function validateFirebaseConfig(config) {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
    
    for (const key of requiredKeys) {
        if (!config[key] || typeof config[key] !== 'string' || config[key].trim() === '') {
            console.error(`[Firebase Core] Missing or invalid required config key: ${key}`);
            return false;
        }
    }
    
    return true;
}

/**
 * Initializes Firebase with validation and caching
 * @returns {Promise<Object>} - Object containing initialized Firebase services
 */
export async function initializeFirebaseCore() {
    // Return cached services if already initialized
    if (firebaseCache.initialized) {
        console.log('[Firebase Core] Using cached Firebase services');
        return {
            app: firebaseCache.app,
            auth: firebaseCache.auth,
            db: firebaseCache.db,
            storage: firebaseCache.storage
        };
    }

    // Return existing initialization promise if in progress
    if (firebaseCache.initPromise) {
        console.log('[Firebase Core] Firebase initialization in progress, waiting...');
        return firebaseCache.initPromise;
    }

    // Create new initialization promise
    firebaseCache.initPromise = (async () => {
        try {
            console.log('[Firebase Core] Initializing Firebase...');
            
            // Get and validate configuration
            const config = await getFirebaseConfig();
            if (!validateFirebaseConfig(config)) {
                throw new Error('Invalid Firebase configuration');
            }

            // Initialize Firebase app
            const app = initializeApp(config);
            const auth = getAuth(app);
            const db = getFirestore(app);
            const storage = getStorage(app);

            // Cache the services
            firebaseCache.app = app;
            firebaseCache.auth = auth;
            firebaseCache.db = db;
            firebaseCache.storage = storage;
            firebaseCache.initialized = true;

            console.log(`[Firebase Core] Initialized successfully for project: ${config.projectId}`);
            
            return {
                app,
                auth,
                db,
                storage
            };
            
        } catch (error) {
            console.error('[Firebase Core] Initialization failed:', error);
            
            // Reset cache on failure
            firebaseCache.app = null;
            firebaseCache.auth = null;
            firebaseCache.db = null;
            firebaseCache.storage = null;
            firebaseCache.initialized = false;
            firebaseCache.initPromise = null;
            
            throw new Error(`Firebase initialization failed: ${error.message}`);
        }
    })();

    return firebaseCache.initPromise;
}

/**
 * Gets cached Firebase auth instance (must be called after initialization)
 * @returns {Object|null} - Firebase auth instance or null if not initialized
 */
export function getFirebaseAuth() {
    if (!firebaseCache.initialized) {
        console.warn('[Firebase Core] Auth requested before initialization');
        return null;
    }
    return firebaseCache.auth;
}

/**
 * Gets cached Firebase app instance (must be called after initialization)
 * @returns {Object|null} - Firebase app instance or null if not initialized
 */
export function getFirebaseApp() {
    if (!firebaseCache.initialized) {
        console.warn('[Firebase Core] App requested before initialization');
        return null;
    }
    return firebaseCache.app;
}

/**
 * Gets cached Firestore instance (must be called after initialization)
 * @returns {Object|null} - Firestore instance or null if not initialized
 */
export function getFirebaseDb() {
    if (!firebaseCache.initialized) {
        console.warn('[Firebase Core] Database requested before initialization');
        return null;
    }
    return firebaseCache.db;
}

/**
 * Gets cached Firebase storage instance (must be called after initialization)
 * @returns {Object|null} - Firebase storage instance or null if not initialized
 */
export function getFirebaseStorage() {
    if (!firebaseCache.initialized) {
        console.warn('[Firebase Core] Storage requested before initialization');
        return null;
    }
    return firebaseCache.storage;
}

/**
 * Checks if Firebase is initialized
 * @returns {boolean} - True if Firebase is initialized
 */
export function isFirebaseInitialized() {
    return firebaseCache.initialized;
}

/**
 * Clears Firebase cache (for testing purposes)
 */
export function clearFirebaseCache() {
    firebaseCache.app = null;
    firebaseCache.auth = null;
    firebaseCache.db = null;
    firebaseCache.storage = null;
    firebaseCache.initialized = false;
    firebaseCache.initPromise = null;
    console.log('[Firebase Core] Cache cleared');
}