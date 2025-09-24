import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig } from './firebase-config.js';

let initPromise = null;
const ENABLE_FIRESTORE_DEBUG = (location.hostname === 'localhost');

export function initFirebase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const config = getFirebaseConfig();
    const app = getApps().length ? getApps()[0] : initializeApp(config);

    if (ENABLE_FIRESTORE_DEBUG) {
      setLogLevel('debug');
      console.info('[Firebase] Firestore debug logging enabled');
    }

    const db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

    const auth = getAuth(app);
    const storage = getStorage(app);
    console.info('[Firebase] Initialized');
    return { app, auth, db, storage };
  })().catch(err => {
    console.error('[Firebase] Initialization failed:', err);
    throw err;
  });
  return initPromise;
}