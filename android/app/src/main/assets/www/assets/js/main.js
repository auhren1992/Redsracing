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

    // Subscribe Form Logic
    const subscribeForm = document.getElementById("subscribeForm");
    const subscribeStatus = document.getElementById("subscribeStatus");
    const emailInput = document.getElementById("emailInput");

    if (subscribeForm) {
      subscribeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = emailInput.value;

        subscribeStatus.textContent = "Subscribing...";
        subscribeStatus.classList.remove("text-red-500", "text-green-500");

        try {
          const response = await fetch("/add_subscriber", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Something went wrong");
          }

          subscribeStatus.textContent =
            result.message || "Subscribed successfully!";
          subscribeStatus.classList.add("text-green-500");
          subscribeForm.reset();
        } catch (error) {
          subscribeStatus.textContent = error.message || "Failed to subscribe.";
          subscribeStatus.classList.add("text-red-500");
        }
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
