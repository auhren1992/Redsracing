import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFirebaseConfig } from "./firebase-config.js";

let initPromise = null;
const ENABLE_FIRESTORE_DEBUG = location.hostname === "localhost";

export function initFirebase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const config = getFirebaseConfig();
    const app = getApps().length ? getApps()[0] : initializeApp(config);

    if (ENABLE_FIRESTORE_DEBUG) {
      setLogLevel("debug");
      console.info("[Firebase] Firestore debug logging enabled");
    }

    const db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

    const auth = getAuth(app);
    const storage = getStorage(app);
    console.info("[Firebase] Initialized");
    return { app, auth, db, storage };
  })().catch((err) => {
    console.error("[Firebase] Initialization failed:", err);
    throw err;
  });
  return initPromise;
}
