import "./app.js";

// Fixed Dashboard Module - Resolves infinite loading and logout issues
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
} from "./firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Import centralized authentication utilities
import {
  validateAndRefreshToken,
  validateUserClaims,
  safeFirestoreOperation,
  retryAuthOperation,
  showAuthError,
  clearAuthError,
  monitorAuthState,
  getCurrentUser,
  safeSignOut,
} from "./auth-utils.js";

// Import sanitization utilities
import { html, safeSetHTML, setSafeText } from "./sanitize.js";

// Import navigation helpers
import { navigateToInternal } from "./navigation-helpers.js";

// Main IIFE to encapsulate dashboard logic
(async function () {
  // --- Start of Variable Declarations ---

  const INITIAL_TIMEOUT = 15000; // Reduced from 30s to 15s
  const MAX_RETRIES = 2; // Reduced from 3 to 2
  const RETRY_BASE_DELAY = 1000;

  let loadingTimeout = null;
  let countdownInterval;
  let authStateUnsubscribe = null;

  // DOM Element Lookups
  const loadingState = document.getElementById("loading-state");
  const dashboardContent = document.getElementById("dashboard-content");
  const userEmailEl = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");
  const emailVerificationNotice = document.getElementById(
    "email-verification-notice",
  );
  const resendVerificationBtn = document.getElementById(
    "resend-verification-btn",
  );
  const driverNotesCard = document.getElementById("driver-notes-card");
  const raceManagementCard = document.getElementById("race-management-card");
  const driverNotesEl = document.getElementById("driver-notes");
  const notesStatusEl = document.getElementById("notes-status");
  const addRaceBtn = document.getElementById("add-race-btn");

  // Firebase Services
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  // Track initialization state
  let isInitialized = false;
  let isDestroyed = false;
  let isProcessingAuth = false; // Guard against re-entrant auth calls

  // --- Start of Function Declarations ---

  function startLoadingTimeout() {
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(async () => {
      if (isDestroyed) return;

      console.error(
        "[Dashboard:Timeout] Loading timeout reached after",
        INITIAL_TIMEOUT,
        "ms",
      );

      // Before showing fallback, check if it's a network issue
      const isOnline = await checkNetworkConnectivity();

      if (!isOnline) {
        showNetworkErrorFallback();
      } else {
        hideLoadingAndShowFallback();
      }
    }, INITIAL_TIMEOUT);
  }

  function clearLoadingTimeout() {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  }

  function hideLoadingAndShowContent() {
    if (isDestroyed) return;

    console.log(
      "[Dashboard:UI] Hiding loading state and showing dashboard content",
    );
    if (loadingState) {
      loadingState.style.display = "none";
      loadingState.setAttribute("hidden", "true");
      loadingState.classList.add("hidden");
    }
    if (dashboardContent) {
      dashboardContent.classList.remove("hidden");
      dashboardContent.style.display = "block";
    }
    clearLoadingTimeout();
    console.log("[Dashboard:UI] ✓ Dashboard content displayed successfully");
  }

  function hideLoadingAndShowFallback() {
    if (isDestroyed) return;

    console.log("[Dashboard:UI] Showing fallback content");

    if (loadingState) {
      loadingState.style.display = "none";
      loadingState.classList.add("hidden");
    }

    if (dashboardContent) {
      dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
                        <p class="mt-2">We're unable to load your dashboard right now.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
      dashboardContent.classList.remove("hidden");
      dashboardContent.style.display = "block";
    }

    clearLoadingTimeout();
  }

  function showNetworkErrorFallback() {
    if (isDestroyed) return;

    console.log("[Dashboard:Network] Showing network error fallback");

    if (loadingState) {
      loadingState.style.display = "none";
      loadingState.classList.add("hidden");
    }

    if (dashboardContent) {
      dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-red-400 mb-6">
                        <div class="text-6xl mb-4">🌐</div>
                        <h2 class="text-2xl font-bold">Network Connection Issue</h2>
                        <p class="mt-2">Unable to connect to our servers.</p>
                        <p class="text-sm text-slate-400 mt-2">Please check your internet connection and try again.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
      dashboardContent.classList.remove("hidden");
      dashboardContent.style.display = "block";
    }

    clearLoadingTimeout();
  }

  async function checkNetworkConnectivity() {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return false;
      }

      const response = await fetch("https://www.google.com/favicon.ico", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
      });
      return true;
    } catch (error) {
      console.warn("[Dashboard:Network] Network check failed:", error);
      return false;
    }
  }

  function startCountdown(races) {
    if (isDestroyed) return;

    if (countdownInterval) clearInterval(countdownInterval);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let nextRace = null;

    for (const race of races) {
      if (race && race.date && !isNaN(new Date(race.date + "T00:00:00"))) {
        const raceDate = new Date(race.date + "T00:00:00");
        if (raceDate >= today) {
          nextRace = race;
          break;
        }
      }
    }

    const nextRaceNameEl = document.getElementById("next-race-name");
    const countdownTimerEl = document.getElementById("countdown-timer");

    if (!nextRace) {
      if (nextRaceNameEl) safeSetHTML(nextRaceNameEl, html`Season Complete!`);
      if (countdownTimerEl)
        safeSetHTML(
          countdownTimerEl,
          html`<div class="col-span-4 text-2xl font-racing">
            Thanks for a great season!
          </div>`,
        );
      return;
    }

    if (nextRaceNameEl) safeSetHTML(nextRaceNameEl, html`${nextRace.name}`);
    const nextRaceDate = new Date(nextRace.date + "T19:00:00").getTime();

    if (isNaN(nextRaceDate)) {
      console.error(
        `[Dashboard:Countdown] Invalid date for next race:`,
        nextRace,
      );
      if (countdownTimerEl)
        safeSetHTML(
          countdownTimerEl,
          html`<div class="col-span-4 text-red-500">
            Error: Invalid race date
          </div>`,
        );
      return;
    }

    countdownInterval = setInterval(() => {
      if (isDestroyed) {
        clearInterval(countdownInterval);
        return;
      }

      const now = new Date().getTime();
      const distance = nextRaceDate - now;

      if (distance < 0) {
        clearInterval(countdownInterval);
        if (countdownTimerEl)
          safeSetHTML(
            countdownTimerEl,
            html`<div class="col-span-4 text-3xl font-racing neon-yellow">
              RACE DAY!
            </div>`,
          );
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const daysEl = document.getElementById("days");
      const hoursEl = document.getElementById("hours");
      const minutesEl = document.getElementById("minutes");
      const secondsEl = document.getElementById("seconds");

      if (daysEl) setSafeText(daysEl, days.toString());
      if (hoursEl) setSafeText(hoursEl, hours.toString());
      if (minutesEl) setSafeText(minutesEl, minutes.toString());
      if (secondsEl) setSafeText(secondsEl, seconds.toString());
    }, 1000);
  }

  function renderRacesTable(races) {
    const tableBody = document.getElementById("races-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    races.forEach((race) => {
      const row = document.createElement("tr");
      row.className = "border-b border-slate-700 hover:bg-slate-800";

      const dateStr = race.date
        ? new Date(race.date).toLocaleDateString()
        : "TBD";
      const raceName = race.name || "Unnamed Race";
      const raceType =
        race.type === "specialEvent"
          ? race.special || "Special Event"
          : `Race ${race.race || "?"}`;

      safeSetHTML(
        row,
        html`
          <td class="p-2">${dateStr}</td>
          <td class="p-2">${raceName} - ${raceType}</td>
          <td class="p-2">
            <button
              class="edit-race-btn bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-500 transition mr-1"
              data-id="${race.id}"
            >
              Edit
            </button>
            <button
              class="delete-race-btn bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition"
              data-id="${race.id}"
            >
              Delete
            </button>
          </td>
        `,
      );

      tableBody.appendChild(row);
    });

    // Re-attach event listeners
    document.querySelectorAll(".edit-race-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const race = races.find((r) => r.id === btn.dataset.id);
        if (race) openRaceModal(race);
      });
    });

    document.querySelectorAll(".delete-race-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteRace(btn.dataset.id));
    });
  }

  async function getRaceData() {
    if (isDestroyed) return;

    try {
      const racesCol = collection(db, "races");
      const q = query(racesCol, orderBy("date", "asc"));
      const raceSnapshot = await getDocs(q);
      const raceList = raceSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      renderRacesTable(raceList);
      startCountdown(raceList);

      console.log(
        "[Dashboard:Races] Successfully loaded races:",
        raceList.length,
      );
    } catch (error) {
      console.error("[Dashboard:Races] Error loading race data:", error);
      showAuthError({
        code: "race-load-failed",
        message: "Failed to load race data",
        userMessage:
          "Unable to load race information. Please try refreshing the page.",
        requiresReauth: false,
        retryable: true,
      });
    }
  }

  function openRaceModal(race = null) {
    // Placeholder - implement race modal functionality
    console.log("[Dashboard:Modal] Opening race modal for:", race);
  }

  function deleteRace(raceId) {
    if (confirm("Are you sure you want to delete this race?")) {
      // Placeholder - implement race deletion
      console.log("[Dashboard:Delete] Deleting race:", raceId);
    }
  }

  // Enhanced logout handler
  async function handleLogout() {
    if (isDestroyed) return;

    console.log("[Dashboard:Logout] Starting logout process");

    try {
      // Disable the logout button to prevent multiple clicks
      if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";
      }

      // Clean up any ongoing operations
      cleanup();

      // Attempt safe sign out
      const success = await safeSignOut();

      if (success) {
        console.log("[Dashboard:Logout] Logout successful, redirecting...");
        // Short delay before redirect to ensure cleanup
        setTimeout(() => {
          navigateToInternal("/login.html");
        }, 100);
      } else {
        console.warn(
          "[Dashboard:Logout] Logout failed, but redirecting anyway",
        );
        // Even if logout fails, redirect to login
        navigateToInternal("/login.html");
      }
    } catch (error) {
      console.error("[Dashboard:Logout] Logout error:", error);
      // Always redirect to login even if there's an error
      navigateToInternal("/login.html");
    }
  }

  // Cleanup function to prevent memory leaks
  function cleanup() {
    console.log("[Dashboard:Cleanup] Starting cleanup");
    isDestroyed = true;

    // Clear timers
    clearLoadingTimeout();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Unsubscribe from auth state changes
    if (authStateUnsubscribe) {
      authStateUnsubscribe();
      authStateUnsubscribe = null;
    }

    console.log("[Dashboard:Cleanup] Cleanup completed");
  }

  // --- Start of Main Execution Logic ---

  // Prevent multiple initializations
  if (isInitialized) {
    console.warn("[Dashboard] Already initialized");
    return;
  }

  console.log("[Dashboard:Init] Starting dashboard initialization");

  // Check if Firebase services are available
  if (!auth || !db) {
    console.error("[Dashboard:Init] Firebase services not available");
    hideLoadingAndShowFallback();
    return;
  }

  // Start loading timeout immediately
  startLoadingTimeout();

  // Setup logout button handler
  if (logoutButton) {
    logoutButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
    console.log("[Dashboard:Init] Logout button handler attached");
  } else {
    console.warn("[Dashboard:Init] Logout button not found");
  }

  // Setup auth state monitoring
  try {
    authStateUnsubscribe = monitorAuthState(
      async (user, validToken) => {
        console.log("[Dashboard:Auth] Auth state change event received.");
        if (isDestroyed || isProcessingAuth) {
          if (isProcessingAuth)
            console.log(
              "[Dashboard:Auth] Auth processing already in progress, skipping.",
            );
          return;
        }

        isProcessingAuth = true;
        console.log("[Dashboard:Auth] Starting auth processing.");

        try {
          clearAuthError();

          if (user && validToken) {
            console.log(
              "[Dashboard:Auth] User is authenticated. Loading dashboard data...",
            );

            // Update UI with user info
            if (userEmailEl) {
              setSafeText(userEmailEl, user.email);
            }

            try {
              console.log(
                "[Dashboard:Auth] Validating user claims for team-member role.",
              );
              const claimsResult = await validateUserClaims(["team-member"]);
              const isTeamMember =
                claimsResult.success &&
                claimsResult.claims.role === "team-member";

              console.log("[Dashboard:Auth] User role check completed:", {
                isTeamMember,
                role: claimsResult.claims?.role,
              });

              if (isTeamMember) {
                console.log(
                  "[Dashboard:Auth] User is a team member. Displaying race management and loading race data.",
                );
                if (raceManagementCard) {
                  raceManagementCard.style.display = "block";
                }
                await getRaceData();
                console.log("[Dashboard:Auth] Race data loaded.");
              }

              if (driverNotesCard) {
                driverNotesCard.classList.remove("hidden");
              }

              hideLoadingAndShowContent();
              console.log(
                "[Dashboard:Auth] Dashboard content successfully displayed.",
              );
            } catch (error) {
              console.error(
                "[Dashboard:Auth] Error during dashboard data loading:",
                error,
              );
              showAuthError({
                code: "dashboard-data-load-failed",
                message: "Failed to load dashboard data",
                userMessage:
                  "Unable to load dashboard information. Please try refreshing the page.",
                requiresReauth: false,
                retryable: true,
              });
              hideLoadingAndShowFallback();
            }
          } else {
            console.log(
              "[Dashboard:Auth] User is not authenticated. Redirecting to login.",
            );
            cleanup();
            navigateToInternal("/login.html");
          }
        } finally {
          isProcessingAuth = false;
          console.log("[Dashboard:Auth] Finished auth processing.");
        }
      },
      (error) => {
        if (isDestroyed) return;

        console.error("[Dashboard:Auth] Authentication error:", error);
        showAuthError(error);

        if (error.requiresReauth) {
          // Redirect to login after showing error briefly
          setTimeout(() => {
            cleanup();
            navigateToInternal("/login.html");
          }, 2000);
        } else {
          // Show fallback for non-auth errors
          hideLoadingAndShowFallback();
        }
      },
    );
  } catch (error) {
    console.error("[Dashboard:Init] Failed to setup auth monitoring:", error);
    hideLoadingAndShowFallback();
    return;
  }

  // Event listeners for other functionality
  if (addRaceBtn) {
    addRaceBtn.addEventListener("click", () => openRaceModal());
  }

  // Set footer year
  const yearEl = document.getElementById("year");
  if (yearEl) {
    setSafeText(yearEl, new Date().getFullYear().toString());
  }

  // Handle page unload cleanup
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("unload", cleanup);

  // Handle visibility change (page becomes hidden)
  if (typeof document.visibilityState !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Page is now hidden, could pause some operations
        console.log("[Dashboard:Visibility] Page hidden");
      } else if (isDestroyed) {
        // Page became visible but we're destroyed, reload
        console.log(
          "[Dashboard:Visibility] Page visible but destroyed, reloading",
        );
        window.location.reload();
      }
    });
  }

  isInitialized = true;
  console.log("[Dashboard:Complete] Dashboard initialization setup complete");
})();
