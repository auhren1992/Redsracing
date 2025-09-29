import "./app.js";

// Fixed Profile Module - Resolves infinite loading and logout issues
import {
  getFirebaseAuth,
  getFirebaseApp,
  getFirebaseDb,
} from "./firebase-core.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Import centralized authentication utilities
import {
  validateUserClaims,
  showAuthError,
  clearAuthError,
  monitorAuthState,
  getCurrentUser,
  safeSignOut,
} from "./auth-utils.js";

// Import sanitization utilities
import {
  html,
  safeSetHTML,
  setSafeText,
  createSafeElement,
} from "./sanitize.js";

// Import navigation helpers
import { navigateToInternal } from "./navigation-helpers.js";

// Import error handling utilities
import { getFriendlyAuthError } from "./auth-errors.js";
import { LoadingService } from "./loading.js";

// Wrap everything in an async function to allow early returns
(async function () {
  // Track initialization and cleanup state
  let isInitialized = false;
  let isDestroyed = false;
  let loadingTimeout = null;
  let authStateUnsubscribe = null;
  let isProcessingAuth = false; // Guard against re-entrant auth calls

  const auth = getFirebaseAuth();
  const app = getFirebaseApp();
  const db = getFirebaseDb();

  // Check if Firebase services are available
  if (!auth || !app || !db) {
    hideLoadingAndShowFallback();
    return;
  }

  // Add immediate loading timeout as backup
  function startLoadingTimeout() {
    if (loadingTimeout) clearTimeout(loadingTimeout);

    loadingTimeout = setTimeout(() => {
      if (isDestroyed) return;

      hideLoadingAndShowFallback();
    }, 8000); // 8 second timeout

    // Extra failsafe at 4s to ensure spinner never hangs
    setTimeout(() => {
      if (isDestroyed) return;
      const loader = document.getElementById('loading-state');
      const content = document.getElementById('profile-content');
      if (loader && !loader.classList.contains('hidden')) {
        // Show minimal profile shell
        if (content && content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          if (!content.innerHTML || content.innerHTML.trim() === '') {
            content.innerHTML = '<div class="text-center py-12 text-slate-400">Profile is loading slowly. Try again shortly.</div>';
          }
        }
        loader.classList.add('hidden');
      }
    }, 4000);
  }

  function clearLoadingTimeout() {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  }

  function hideLoadingAndShowFallback() {
    if (isDestroyed) return;

    const loadingState = document.getElementById("loading-state");
    const profileContent = document.getElementById("profile-content");

    if (loadingState) {
      loadingState.style.display = "none";
      loadingState.style.visibility = "hidden";
      loadingState.classList.add("hidden");
      loadingState.setAttribute("hidden", "true");
    }

    if (profileContent) {
      profileContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">User <span class="neon-yellow">Profile</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold">Profile Temporarily Unavailable</h2>
                        <p class="mt-2">We're unable to load your profile right now.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
      profileContent.classList.remove("hidden");
    }

    clearLoadingTimeout();
  }

  function hideLoadingAndShowContent() {
    if (isDestroyed) return;

    const loadingState = document.getElementById("loading-state");
    const profileContent = document.getElementById("profile-content");

    if (loadingState) {
      loadingState.classList.add("hidden");
    }
    if (profileContent) {
      profileContent.classList.remove("hidden");
    }

    clearLoadingTimeout();
  }

  function showErrorState(type = "generic", message = null) {
    if (isDestroyed) return;

    const loadingState = document.getElementById("loading-state");
    const profileContent = document.getElementById("profile-content");
    const errorState = document.getElementById("error-state");

    if (loadingState) loadingState.classList.add("hidden");
    if (profileContent) profileContent.classList.add("hidden");
    if (errorState) errorState.classList.remove("hidden");

    clearLoadingTimeout();
  }

  // UI Elements
  const loadingState = document.getElementById("loading-state");
  const profileContent = document.getElementById("profile-content");
  const errorState = document.getElementById("error-state");
  const logoutButton = document.getElementById("logout-button");

  // Profile elements
  const profileAvatar = document.getElementById("profile-avatar");
  const profileAvatarPlaceholder = document.getElementById(
    "profile-avatar-placeholder",
  );
  const profileDisplayName = document.getElementById("profile-display-name");
  const profileStatusEmoji = document.getElementById("profile-status-emoji");
  const profileThemeDot = document.getElementById("profile-theme-dot");
  const profileUsername = document.getElementById("profile-username");
  const profileBio = document.getElementById("profile-bio");
  const profileFavoriteCars = document.getElementById("profile-favorite-cars");
  const profileFavoriteTrack = document.getElementById("profile-favorite-track");
  const profileJoinDate = document.getElementById("profile-join-date");

  // Form elements
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const profileDisplay = document.getElementById("profile-display");
  const profileEditForm = document.getElementById("profile-edit-form");
  const editUsername = document.getElementById("edit-username");
  const editDisplayName = document.getElementById("edit-display-name");
  const editBio = document.getElementById("edit-bio");
  const editAvatarUrl = document.getElementById("edit-avatar-url");
  const editFavoriteCars = document.getElementById("edit-favorite-cars");
  const editStatusEmoji = document.getElementById("edit-status-emoji");
  const editFavoriteTrack = document.getElementById("edit-favorite-track");
  const editThemeColor = document.getElementById("edit-theme-color");
  const surpriseMeBtn = document.getElementById("surprise-me-btn");
  const saveProfileBtn = document.getElementById("save-profile-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const saveToast = document.getElementById("save-toast");

  let currentUser = null;
  let isEditing = false;
  let isCurrentUserProfile = false;

  // Enhanced logout handler
  async function handleLogout() {
    if (isDestroyed) return;

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
        setTimeout(() => {
          navigateToInternal("/login.html");
        }, 100);
      } else {
        navigateToInternal("/login.html");
      }
    } catch (error) {
      navigateToInternal("/login.html");
    }
  }

  // Cleanup function to prevent memory leaks
  function cleanup() {
    isDestroyed = true;

    clearLoadingTimeout();

    if (authStateUnsubscribe) {
      authStateUnsubscribe();
      authStateUnsubscribe = null;
    }
  }

  // Start centralized loading guard (3s max visible for loader)
  LoadingService.bind({ loaderId: 'loading-state', contentId: 'profile-content', errorId: 'error-state', maxMs: 3000 });
  // Start legacy timeout as additional backup
  startLoadingTimeout();

  // Set up logout button with enhanced error handling
  if (logoutButton) {
    logoutButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Get user ID from URL or use current user
  function getUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  }

  // Helper function to safely format timestamps from various sources
  function formatFirestoreTimestamp(timestamp, fallback = "Unknown") {
    if (!timestamp) {
      return fallback;
    }

    try {
      // Handle Firestore Timestamp objects with .seconds property
      if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
      }

      // Handle Date objects
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString();
      }

      // Handle string representations
      if (typeof timestamp === "string") {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }

      // Handle numeric timestamps (milliseconds)
      if (typeof timestamp === "number") {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }

      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  // Helper function to call profile API endpoints
  async function callProfileAPI(endpoint, method = "GET", data = null) {
    if (isDestroyed) return null;

    try {
      // Firestore fallback: GET /profile/:id
      const profileGet = endpoint.match(/^\/profile\/([^/]+)$/);
      if (db && method === "GET" && profileGet) {
        const userId = profileGet[1];
        const profileRef = doc(db, "users", userId);
        const snap = await getDoc(profileRef);

        if (!snap.exists()) {
          const error = new Error("Profile not found");
          error.code = "not-found";
          throw error;
        }

        const profile = snap.data() || {};

        // Load achievements subcollection (optional)
        let achievements = [];
        try {
          const achRef = collection(db, "users", userId, "achievements");
          const achSnap = await getDocs(achRef);
          achievements = achSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() || {}),
          }));
        } catch (_) {
          /* ignore if missing */
        }

        return { ...profile, achievements };
      }

      // Firestore fallback: PUT/PATCH /update_profile/:id
      const profilePut = endpoint.match(/^\/update_profile\/([^/]+)$/);
      if (db && (method === "PUT" || method === "PATCH") && profilePut) {
        const userId = profilePut[1];
        const profileRef = doc(db, "users", userId);

        const payload = {
          username: data?.username || "",
          displayName: data?.displayName || "Anonymous User",
          bio: data?.bio || "",
          avatarUrl: data?.avatarUrl || "",
          favoriteCars: Array.isArray(data?.favoriteCars)
            ? data.favoriteCars
            : [],
          joinDate: data?.joinDate || new Date().toISOString(),
          totalPoints:
            typeof data?.totalPoints === "number" ? data.totalPoints : 0,
          achievementCount:
            typeof data?.achievementCount === "number"
              ? data.achievementCount
              : 0,
        };

        await setDoc(profileRef, payload, { merge: true });
        const saved = await getDoc(profileRef);
        return saved.exists() ? saved.data() : payload;
      }

      // If we get here, no Firestore fallback was available
      throw new Error(
        `API endpoint ${endpoint} not available - backend service unavailable`,
      );
    } catch (error) {
      throw error;
    }
  }

  // Load user profile
  async function loadUserProfile(userId) {
    if (isDestroyed) return;

    try {
      const profileData = await callProfileAPI(`/profile/${userId}`);
      displayProfile(profileData);
    } catch (error) {
      // Distinguish errors and show minimal profile
      if (isCurrentUserProfile) {
        try {
          await createDefaultProfile(userId);
          return;
        } catch (_) {
          displayMinimalProfile(userId);
          hideLoadingAndShowContent();
          return;
        }
      } else {
        displayMinimalProfile(userId);
        hideLoadingAndShowContent();
        return;
      }
    }
  }


  // Create default profile for new users
  async function createDefaultProfile(userId) {
    if (isDestroyed) {
      return;
    }

    const defaultProfile = {
      username: currentUser.email.split("@")[0], // Use email username as default
      displayName: currentUser.displayName || "Anonymous User",
      bio: "",
      avatarUrl: "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
    };

    try {
      await callProfileAPI(`/update_profile/${userId}`, "PUT", defaultProfile);

      // Reload profile after creation
      await loadUserProfile(userId);
    } catch (error) {
      displayMinimalProfile(userId);
      hideLoadingAndShowContent();
    }
  }

  // Display profile data
  function displayProfile(profileData) {
    if (isDestroyed) return;

    if (profileDisplayName)
      setSafeText(
        profileDisplayName,
        profileData.displayName || "Anonymous User",
      );
    if (profileUsername)
      setSafeText(profileUsername, `@${profileData.username || "unknown"}`);
    if (profileBio)
      setSafeText(profileBio, profileData.bio || "No bio provided.");

    // Handle avatar
    if (profileData.avatarUrl && profileAvatar && profileAvatarPlaceholder) {
      profileAvatar.src = profileData.avatarUrl;
      profileAvatar.classList.remove("hidden");
      profileAvatarPlaceholder.classList.add("hidden");
    } else if (profileAvatar && profileAvatarPlaceholder) {
      profileAvatar.classList.add("hidden");
      profileAvatarPlaceholder.classList.remove("hidden");
      setSafeText(
        profileAvatarPlaceholder,
        (profileData.displayName || "U").charAt(0).toUpperCase(),
      );
    }

    // Handle favorite cars
    if (profileFavoriteCars) {
      if (profileData.favoriteCars && profileData.favoriteCars.length > 0) {
        profileFavoriteCars.innerHTML = "";
        profileData.favoriteCars.forEach((car) => {
          const span = createSafeElement(
            "span",
            car,
            "bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-sm mr-2",
          );
          profileFavoriteCars.appendChild(span);
        });
      } else {
        setSafeText(profileFavoriteCars, "No favorite cars added.");
        profileFavoriteCars.className = "text-slate-400";
      }
    }

    // Handle join date
    if (profileJoinDate) {
      if (profileData.joinDate) {
        setSafeText(
          profileJoinDate,
          formatFirestoreTimestamp(profileData.joinDate),
        );
      } else {
        setSafeText(profileJoinDate, "Unknown");
      }
    }

    // Fun display bits
    if (profileStatusEmoji) setSafeText(profileStatusEmoji, profileData.funStatusEmoji || "");
    if (profileThemeDot) {
      const col = profileData.themeColor || "#f7ff00";
      profileThemeDot.style.backgroundColor = col;
      try { document.documentElement.style.setProperty('--fun-accent', col); } catch {}
    }
    if (profileFavoriteTrack) setSafeText(profileFavoriteTrack, profileData.favoriteTrack || "Add one in edit mode.");

    // Pre-fill edit form
    if (editUsername) editUsername.value = profileData.username || "";
    if (editDisplayName) editDisplayName.value = profileData.displayName || "";
    if (editBio) editBio.value = profileData.bio || "";
    if (editAvatarUrl) editAvatarUrl.value = profileData.avatarUrl || "";
    if (editFavoriteCars)
      editFavoriteCars.value = profileData.favoriteCars
        ? profileData.favoriteCars.join(", ")
        : "";

    // Show edit button only for current user's profile
    if (editProfileBtn) {
      editProfileBtn.style.display = isCurrentUserProfile ? "block" : "none";
    }

    hideLoadingAndShowContent();
    try { LoadingService.done('profile-content'); } catch {}
  }

  // Display minimal profile when backend is not available
  function displayMinimalProfile(userId) {
    if (isDestroyed) return;

    const user = getCurrentUser();
    if (!user) {
      hideLoadingAndShowFallback();
      return;
    }

    // Create a basic profile - if viewing current user, use their data; otherwise show generic profile
    const isViewingOwnProfile = userId === user.uid;
    const basicProfile = {
      username:
        isViewingOwnProfile && user.email
          ? user.email.split("@")[0]
          : "unknown",
      displayName:
        isViewingOwnProfile && user.displayName
          ? user.displayName
          : "User Not Found",
      bio: isViewingOwnProfile
        ? "Profile backend not available. Some features may not work correctly."
        : "This user profile could not be loaded",
      avatarUrl: isViewingOwnProfile ? user.photoURL || "" : "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
    };

    displayProfile(basicProfile);
  }

  // Toggle edit mode
  async function toggleEditMode() {
    if (isDestroyed) return;

    isEditing = !isEditing;
    if (isEditing) {
      if (profileDisplay) profileDisplay.classList.add("hidden");
      if (profileEditForm) profileEditForm.classList.remove("hidden");
      if (editProfileBtn) setSafeText(editProfileBtn, "Cancel");
    } else {
      if (profileDisplay) profileDisplay.classList.remove("hidden");
      if (profileEditForm) profileEditForm.classList.add("hidden");
      if (editProfileBtn) setSafeText(editProfileBtn, "Edit Profile");
    }
  }

  // Event listeners with null checks
  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", toggleEditMode);
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", toggleEditMode);
  }
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      if (isDestroyed || !currentUser) return;
      try {
        const userId = currentUser.uid;
        const payload = {
          username: (editUsername?.value || '').trim(),
          displayName: (editDisplayName?.value || '').trim(),
          bio: (editBio?.value || '').trim(),
          avatarUrl: (editAvatarUrl?.value || '').trim(),
          favoriteCars: (editFavoriteCars?.value || '')
            .split(',')
            .map((s)=>s.trim())
            .filter(Boolean),
          joinDate: new Date().toISOString(),
          // Fun fields
          funStatusEmoji: (editStatusEmoji?.value || '').trim(),
          favoriteTrack: (editFavoriteTrack?.value || '').trim(),
          themeColor: (editThemeColor?.value || '#f7ff00'),
        };
const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js');
        const app = getFirebaseApp();
        const functions = getFunctions(app);
        const updateProfile = httpsCallable(functions, 'updateProfile');
        await updateProfile({ userId, profileData: payload });
        // Ensure custom fields persist even if callable filters them
        try {
const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
          const db2 = getFirebaseDb();
          await setDoc(doc(db2, 'users', userId), {
            funStatusEmoji: payload.funStatusEmoji,
            favoriteTrack: payload.favoriteTrack,
            themeColor: payload.themeColor,
          }, { merge: true });
        } catch {}
        // Reload
        await loadUserProfile(userId);
        // Exit edit mode
        if (isEditing) await toggleEditMode();
        // Celebrate!
        showToast('Profile saved! 🎉');
        launchConfetti();
      } catch (e) {
        showAuthError({ code: 'profile-save-failed', message: e?.message || 'Failed to save profile.' });
      }
    });
  }

  // Surprise Me button
  if (surpriseMeBtn) {
    surpriseMeBtn.addEventListener('click', () => {
      const emojis = ['🏁','🔥','🚀','😎','💥','✨','⚡','🏎️','🌟','🎯'];
      const randEmoji = emojis[Math.floor(Math.random()*emojis.length)];
      if (editStatusEmoji) editStatusEmoji.value = randEmoji;
      const colors = ['#f7ff00','#00c6ff','#ff5ccd','#22c55e','#f97316','#a78bfa'];
      const randColor = colors[Math.floor(Math.random()*colors.length)];
      if (editThemeColor) editThemeColor.value = randColor;
      showToast('Feeling lucky! 🎲');
    });
  }

  function showToast(message) {
    if (!saveToast) return;
    saveToast.textContent = message;
    saveToast.style.display = 'block';
    clearTimeout(saveToast._t);
    saveToast._t = setTimeout(()=>{ saveToast.style.display = 'none'; }, 2000);
  }

  function launchConfetti() {
    const emojis = ['🏁','🔥','🚀','😎','💥','✨','⚡','🏎️','🌟','🎯'];
    const count = 18;
    for (let i=0;i<count;i++) {
      const span = document.createElement('span');
      span.className = 'confetti';
      span.style.left = Math.random()*100 + 'vw';
      span.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
      span.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      document.body.appendChild(span);
      setTimeout(()=> span.remove(), 1600);
    }
  }

  // Set up authentication state monitoring with enhanced error handling

  try {
    authStateUnsubscribe = monitorAuthState(
      async (user, validToken) => {
        if (isDestroyed || isProcessingAuth) {
          if (isProcessingAuth) return;
        }

        isProcessingAuth = true;

        try {
          clearAuthError();

          if (user && validToken) {
            currentUser = user;
            const targetUserId = getUserIdFromUrl() || user.uid;
            isCurrentUserProfile = targetUserId === user.uid;

            // Load the user profile with enhanced error handling
            try {
              await loadUserProfile(targetUserId);
            } catch (profileError) {
              showAuthError({
                code: "profile-load-failed",
                message: "Failed to load user profile",
                userMessage:
                  "Unable to load profile data. Please refresh the page and try again.",
                requiresReauth: false,
                retryable: true,
              });
              showErrorState();
              return;
            }

            // No admin/achievements UI anymore
          } else {
            cleanup();
            navigateToInternal("/login.html");
          }
        } finally {
          isProcessingAuth = false;
        }
      },
      (error) => {
        if (isDestroyed) return;

        showAuthError(error);

        if (error.requiresReauth) {
          // Redirect to login for auth errors that require re-authentication
          setTimeout(() => {
            cleanup();
            navigateToInternal("/login.html");
          }, 3000);
        } else {
          // Show error state for other auth issues
          showErrorState();
        }
      },
    );
  } catch (error) {
    hideLoadingAndShowFallback();
    return;
  }

  // Handle page unload cleanup
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("unload", cleanup);

  // Handle visibility change (page becomes hidden)
  if (typeof document.visibilityState !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
      } else if (isDestroyed) {
        window.location.reload();
      }
    });
  }

  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  isInitialized = true;
})();
