/**
 * Deprecated: site uses Firebase JS SDK v9 via firebase-core.js.
 * Kept as a thin re-export so any stale imports do not load v11.
 */
export {
  getFirebaseApp as initFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "./firebase-core.js";

import { getFirebaseApp, getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from "./firebase-core.js";

/** @deprecated Prefer getFirebaseAuth/getFirebaseDb from firebase-core.js */
export function initFirebase() {
  return Promise.resolve({
    app: getFirebaseApp(),
    auth: getFirebaseAuth(),
    db: getFirebaseDb(),
    storage: getFirebaseStorage(),
  });
}
