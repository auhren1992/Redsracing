// Central Firebase configuration (no mutable service exports)
export const firebaseConfig = {
  apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
  authDomain: "redsracing-a7f8b.firebaseapp.com",
  projectId: "redsracing-a7f8b",
  storageBucket: "redsracing-a7f8b.appspot.com",
  messagingSenderId: "517034606151",
  appId: "1:517034606151:web:24cae262e1d98832757b62"
};

export function getFirebaseConfig() {
  return firebaseConfig;
}
