import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
  authDomain: "redsracing-a7f8b.firebaseapp.com",
  projectId: "redsracing-a7f8b",
  storageBucket: "redsracing-a7f8b.appspot.com",
  messagingSenderId: "517034606151",
  appId: "1:517034606151:web:24cae262e1d98832757b62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the initialized services
export { app, auth, db, storage };
