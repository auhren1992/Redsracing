import "./app.js";

// Firebase-dependent functionality
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  where,
  limit,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import { monitorAuthState } from "./auth-utils.js";

// Import invitation code utilities
import {
  captureInvitationCodeFromURL,
  applyPendingInvitationCode,
} from "./invitation-codes.js";

async function initFirebase() {
  try {
    // Capture invitation code from URL as early as possible
    captureInvitationCodeFromURL();

    // Initialize Firebase using the core module
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    // UI Elements
    const authLink = document.getElementById("auth-link");
    const authLinkMobile = document.getElementById("auth-link-mobile");

    // Auth State Change
    monitorAuthState(async (user) => {
      if (user) {
        if (authLink) authLink.textContent = "Dashboard";
        if (authLink) authLink.href = "dashboard.html";
        if (authLinkMobile) authLinkMobile.textContent = "Dashboard";
        if (authLinkMobile) authLinkMobile.href = "dashboard.html";

        // Apply pending invitation code if available
        try {
          await applyPendingInvitationCode(user);
        } catch (error) {
          // Don't block the auth flow for invitation code errors
        }

        // Check for first login achievement
        checkFirstLoginAchievement(user.uid);
      } else {
        if (authLink) authLink.textContent = "DRIVER LOGIN";
        if (authLink) authLink.href = "login.html";
        if (authLinkMobile) authLinkMobile.textContent = "DRIVER LOGIN";
        if (authLinkMobile) authLinkMobile.href = "login.html";
      }
    });

    // Check and award first login achievement
    async function checkFirstLoginAchievement(userId) {
      // Only run this check once per session to avoid repeated calls
      const sessionKey = `firstLoginCheck_${userId}`;
      if (sessionStorage.getItem(sessionKey)) return;

      try {
        const response = await fetch("/auto_award_achievement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            actionType: "first_login",
          }),
        });

        if (response.ok) {
        } else if (response.status === 404) {
        } else {
        }

        sessionStorage.setItem(sessionKey, "true");
      } catch (error) {
        if (
          error.message.includes("Failed to fetch") ||
          error.name === "TypeError"
        ) {
        } else {
        }
        sessionStorage.setItem(sessionKey, "true"); // Mark as attempted to avoid retries
      }
    }

// Subscribe Form Logic (supports both legacy IDs and new footer IDs)
    const subscribeFormLegacy = document.getElementById("subscribeForm");
    const subscribeStatusLegacy = document.getElementById("subscribeStatus");
    const emailInputLegacy = document.getElementById("emailInput");
    const subscribeFormNew = document.getElementById("subscribe-form");
    const subscribeEmailNew = document.getElementById("subscribe-email");
    const subscribeMsgNew = document.getElementById("subscribe-message");

    async function writeSubscriberToFirestore(email) {
      try {
        const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
        if (getApps().length === 0) {
          initializeApp({
            apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
            authDomain: "redsracing-a7f8b.firebaseapp.com",
            projectId: "redsracing-a7f8b",
            storageBucket: "redsracing-a7f8b.firebasestorage.app",
            messagingSenderId: "517034606151",
            appId: "1:517034606151:web:24cae262e1d98832757b62"
          });
        }
        const db = getFirestore();
        await addDoc(collection(db, 'subscribers'), { email, createdAt: serverTimestamp() });
        return true;
      } catch (_) { return false; }
    }

    async function handleSubscribe(email, onStatus) {
      if (!email) { onStatus('Please enter a valid email.', 'error'); return; }
      onStatus('Subscribing...', 'info');
      try {
        // Try backend endpoint first if available
        const resp = await fetch("/add_subscriber", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        if (resp.ok) {
          try { const json = await resp.json(); onStatus(json.message || 'Subscribed successfully!', 'success'); } catch { onStatus('Subscribed successfully!', 'success'); }
          return;
        }
        // Fallback to Firestore
        const ok = await writeSubscriberToFirestore(email);
        if (ok) { onStatus('Subscribed successfully!', 'success'); } else { throw new Error('Subscription failed'); }
      } catch (e) {
        onStatus(e?.message || 'Failed to subscribe.', 'error');
      }
    }

    if (subscribeFormLegacy) {
      subscribeFormLegacy.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email = (emailInputLegacy?.value || '').trim();
        await handleSubscribe(email, (msg, type)=>{
          if (subscribeStatusLegacy) {
            subscribeStatusLegacy.textContent = msg;
            subscribeStatusLegacy.classList.remove('text-red-500','text-green-500');
            if (type==='success') subscribeStatusLegacy.classList.add('text-green-500');
            if (type==='error') subscribeStatusLegacy.classList.add('text-red-500');
          }
          if (type==='success') try { subscribeFormLegacy.reset(); } catch {}
        });
      });
    }

    if (subscribeFormNew) {
      subscribeFormNew.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email = (subscribeEmailNew?.value || '').trim();
        await handleSubscribe(email, (msg, type)=>{
          if (subscribeMsgNew) {
            subscribeMsgNew.textContent = msg;
            subscribeMsgNew.className = 'text-sm mt-2 h-4 ' + (type==='success' ? 'text-green-400' : type==='error' ? 'text-red-400' : 'text-slate-400');
          }
          if (type==='success') try { subscribeFormNew.reset(); } catch {}
        });
      });
    }
  } catch (error) {
    // Firebase functionality will not be available, but navigation still works
  }
}

// Initialize Firebase functionality
initFirebase();

// Lazy-load Sentry only in production and only if DSN is present
if (process.env.NODE_ENV === 'production') {
  setTimeout(() => {
    import(/* webpackChunkName: "sentry" */ './sentry-init.js')
      .then(({ initSentry }) => initSentry && initSentry())
      .catch(() => {});
  }, 0);
}
