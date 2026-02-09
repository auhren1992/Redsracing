import "./app.js";

/**
 * Login Page Controller
 * Centralized login flow management with deferred UI enablement, MFA support, and reCAPTCHA Enterprise
 */

import { getFriendlyAuthError } from "./auth-errors.js";
import { setPendingInvitationCode, processInvitationCode } from "./invitation-codes.js";
import { navigateToInternal, validateRedirectUrl } from "./navigation-helpers.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

/**
 * Login Page Controller Class
 * Manages the complete login lifecycle with proper initialization sequence
 */
class LoginPageController {
  constructor() {
    this.auth = null;
    this.googleProvider = null;
    this.confirmationResult = null;
    this.isInitialized = false;
    this.elements = {};

    // UI state management
    this.uiState = {
      buttonsEnabled: false,
      loadingButton: null,
    };
  }

  /**
   * Persist auth marker for guest gate checks
   */
  setAuthMarker(user) {
    try {
      if (user?.uid) {
        localStorage.setItem("rr_auth_uid", user.uid);
      }
    } catch (_) {}
  }

  /**
   * Initialize the login controller
   */
  async initialize() {
    try {
      console.info("[Login] Initializing controller");

      // Get DOM elements
      this.cacheElements();

      // Disable UI initially
      this.disableUI();

      // Initialize Firebase via CDN if needed and get auth
      const cfg = {
        apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:24cae262e1d98832757b62"
      };
      if (getApps().length === 0) initializeApp(cfg);
      this.auth = getAuth();
      try { await setPersistence(this.auth, browserLocalPersistence); } catch(_) {}
      this.googleProvider = new GoogleAuthProvider();
      console.info("[Login] Firebase auth ready:", !!this.auth);

      // Bind event listeners
      this.bindEvents();

      // Enable UI after initialization
      this.enableUI();
      this.isInitialized = true;
      console.info("[Login] UI enabled");
    } catch (error) {
      console.error("[Login] Initialization failed:", error);
      this.showMessage(
        "Failed to initialize authentication system. Please refresh the page.",
      );
    }
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      // Form inputs
      emailInput: document.getElementById("email"),
      passwordInput: document.getElementById("password"),
      invitationCodeInput: document.getElementById("invitation-code"),

      // Buttons
      signinButton: document.getElementById("signin-button"),
      signupButton: document.getElementById("signup-button"),
      googleSigninButton: document.getElementById("google-signin-button"),
      forgotPasswordLink: document.getElementById("forgot-password-link"),
      continueGuestButton: document.getElementById("continue-guest-button"),

      // UI containers
      errorBox: document.getElementById("error-box"),
      errorText: document.getElementById("error-text"),
      loginForm: document.getElementById("login-form"),
    };

    // Validate all elements exist
    for (const [name, element] of Object.entries(this.elements)) {
      if (!element) {
      }
    }
  }

  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Form submit (Enter key)
    this.elements.loginForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleEmailSignIn();
    });

    // Email/password sign in
    this.elements.signinButton?.addEventListener("click", () => {
      console.info("[Login] Sign-in button clicked");
      this.handleEmailSignIn();
    });

    // Sign up redirect
    this.elements.signupButton?.addEventListener("click", () => {
      console.info("[Login] Sign-up button clicked");
      this.handleSignUp();
    });

    // Google sign in
    this.elements.googleSigninButton?.addEventListener("click", () => {
      console.info("[Login] Google sign-in clicked");
      this.handleGoogleSignIn();
    });

    // Password reset
    this.elements.forgotPasswordLink?.addEventListener("click", (e) => {
      console.info("[Login] Forgot password clicked");
      this.handleForgotPassword(e);
    });

    // Continue as guest
    this.elements.continueGuestButton?.addEventListener("click", () => {
      console.info("[Login] Continue as guest clicked");
      this.handleContinueAsGuest();
    });

    // Input validation and error clearing
    this.elements.emailInput?.addEventListener("input", () =>
      this.hideMessage(),
    );
    this.elements.passwordInput?.addEventListener("input", () =>
      this.hideMessage(),
    );
    this.elements.emailInput?.addEventListener("blur", () =>
      this.validateEmailField(),
    );
  }

  /**
   * Enable UI interactions after Firebase initialization
   */
  enableUI() {
    const buttons = [
      this.elements.signinButton,
      this.elements.signupButton,
      this.elements.googleSigninButton,
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = false;
        button.classList.remove("opacity-50", "cursor-not-allowed");
      }
    });

    this.uiState.buttonsEnabled = true;
  }

  /**
   * Disable UI interactions during initialization
   */
  disableUI() {
    const buttons = [
      this.elements.signinButton,
      this.elements.signupButton,
      this.elements.googleSigninButton,
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = true;
        button.classList.add("opacity-50", "cursor-not-allowed");
      }
    });

    this.uiState.buttonsEnabled = false;
  }

  /**
   * Set loading state for a specific button
   */
  setLoadingState(button, isLoading, originalText) {
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      button.textContent = "Processing...";
      button.classList.add("opacity-50", "cursor-not-allowed");
      this.uiState.loadingButton = button;
    } else {
      button.disabled = false;
      button.textContent = originalText;
      button.classList.remove("opacity-50", "cursor-not-allowed");
      this.uiState.loadingButton = null;
    }
  }

  /**
   * Show message in error box
   */
  showMessage(message, isError = true) {
    if (!this.elements.errorBox || !this.elements.errorText) return;

    this.elements.errorText.textContent = message;
    this.elements.errorBox.classList.remove("hidden");

    if (isError) {
      this.elements.errorBox.classList.remove("bg-green-500/20", "border-green-500/30");
      this.elements.errorBox.classList.add("bg-red-500/20", "border-red-500/30");
    } else {
      this.elements.errorBox.classList.remove("bg-red-500/20", "border-red-500/30");
      this.elements.errorBox.classList.add("bg-green-500/20", "border-green-500/30");
    }
  }

  /**
   * Hide message box
   */
  hideMessage() {
    if (!this.elements.errorBox) return;
    this.elements.errorBox.classList.add("hidden");
  }

  /**
   * Validate email input
   */
  validateEmailField() {
    const email = this.elements.emailInput?.value.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage("Please enter a valid email address.");
      return false;
    }
    return true;
  }

  /**
   * Validate login form
   */
  validateLoginForm(email, password) {
    if (!email || !password) {
      this.showMessage("Please enter both email and password.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage("Please enter a valid email address.");
      return false;
    }

    if (password.length < 6) {
      this.showMessage("Password must be at least 6 characters.");
      return false;
    }

    return true;
  }

  /**
   * Handle email sign in
   */
  async handleEmailSignIn() {
    if (!this.isInitialized) {
      console.warn("[Login] handleEmailSignIn called before init");
      this.showMessage("Please wait for the page to load completely.");
      return;
    }

    // If already signed in (stale session), sign out both contexts first so user can log in fresh
    try {
      if (this.auth?.currentUser) {
        try { await this.auth.signOut(); } catch(_) {}
        try {
          const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
          const cdnAuth = getAuth();
          if (cdnAuth?.currentUser) { try { await cdnAuth.signOut(); } catch(_) {} }
        } catch(_) {}
      }
    } catch(_) {}

    const email = this.elements.emailInput?.value.trim();
    const password = this.elements.passwordInput?.value;

    this.hideMessage();

    if (!this.validateLoginForm(email, password)) {
      return;
    }

    if (!this.auth) {
      console.error("[Login] Firebase auth not ready");
      this.showMessage("Authentication not ready. Please refresh the page.");
      return;
    }

    this.setLoadingState(this.elements.signinButton, true, "Sign In");

    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      console.info("[Login] Email sign-in success");
      // Force refresh to get latest custom claims
      const user = this.auth.currentUser;
      this.setAuthMarker(user);
      let role = null;
      try {
        const tokenResult = await user.getIdTokenResult(true);
        role = tokenResult?.claims?.role || null;
        console.info("[Login] Claims role:", role);
      } catch (e) {
        console.warn("[Login] Failed to refresh token for claims:", e);
      }

      const invitationCode = this.elements.invitationCodeInput?.value?.trim();
      if (invitationCode) {
        try {
          const result = await processInvitationCode(invitationCode, user.uid);
          if (result?.status === "success") {
            const refreshed = await user.getIdTokenResult(true);
            role = refreshed?.claims?.role || role;
          } else {
            console.warn("[Login] Invitation code not applied:", result?.message);
          }
        } catch (error) {
          console.warn("[Login] Invitation code processing failed:", error);
        }
      }

      this.showMessage("Login successful! Redirecting...", false);

      const returnTo = this.getReturnTo();
      if (returnTo) {
        navigateToInternal(returnTo);
        return;
      }
      const normalizeRole = (value) => {
        if (typeof value !== "string") return null;
        return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
      };
      const normalizedRole = normalizeRole(role);
      // Route based on role
      if (normalizedRole === 'admin') {
        navigateToInternal('/admin-console.html');
        return;
      } else if (normalizedRole === 'team-member') {
        navigateToInternal('/dashboard.html'); // Racer/Crew dashboard
        return;
      } else if (['teamredfollower', 'public-fan', 'follower'].includes(normalizedRole)) {
        navigateToInternal('/follower-dashboard.html'); // Fan dashboard
        return;
      }

      // Unknown role: default to follower dashboard
      navigateToInternal('/follower-dashboard.html');
    } catch (error) {
      console.error("[Login] Email sign-in failed:", error);
      this.showMessage(getFriendlyAuthError(error));
    } finally {
      this.setLoadingState(this.elements.signinButton, false, "Sign In");
    }
  }

  /**
   * Handle Google sign in
   */
  async handleGoogleSignIn() {
    if (!this.isInitialized) {
      this.showMessage("Please wait for the page to load completely.");
      return;
    }

    this.setLoadingState(
      this.elements.googleSigninButton,
      true,
      "Sign in with Google",
    );

    try {
      await signInWithPopup(this.auth, this.googleProvider);
      this.showMessage("Google sign-in successful! Redirecting...", false);
      this.setAuthMarker(this.auth.currentUser);
      const returnTo = this.getReturnTo();
      if (returnTo) {
        navigateToInternal(returnTo);
      } else {
        this.handleSuccess();
      }
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        this.showMessage(getFriendlyAuthError(error));
      }
    } finally {
      this.setLoadingState(
        this.elements.googleSigninButton,
        false,
        "Sign in with Google",
      );
    }
  }

  /**
   * Handle forgot password
   */
  async handleForgotPassword(e) {
    e.preventDefault();

    const email = this.elements.emailInput?.value.trim();

    if (!email) {
      this.showMessage(
        "Please enter your email address above, then click 'Forgot password?'.",
      );
      this.elements.emailInput?.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage("Please enter a valid email address.");
      this.elements.emailInput?.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(this.auth, email);
      this.showMessage(
        "Password reset email sent! Please check your inbox and spam folder.",
        false,
      );
    } catch (error) {
      this.showMessage(getFriendlyAuthError(error));
    }
  }

  /**
   * Handle sign up (create new account)
   */
  async handleSignUp() {
    if (!this.isInitialized) {
      this.showMessage("Please wait for the page to load completely.");
      return;
    }

    const email = this.elements.emailInput?.value.trim();
    const password = this.elements.passwordInput?.value;

    this.hideMessage();

    if (!this.validateLoginForm(email, password)) {
      return;
    }

    this.setLoadingState(this.elements.signupButton, true, "Sign Up");

    try {
      const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      console.info("[Login] Sign-up success:", user.uid);
      this.setAuthMarker(user);

      const invitationCode = this.elements.invitationCodeInput?.value?.trim();
      let defaultRole = "public-fan";
      if (invitationCode) {
        try {
          const result = await processInvitationCode(invitationCode, user.uid);
          if (result?.status === "success") {
            defaultRole = null;
            await user.getIdToken(true);
          } else {
            console.warn('[Login] Invitation code invalid:', result?.message);
          }
        } catch (e) {
          console.warn('[Login] Failed to process invitation code:', e);
        }
      }
      if (defaultRole) {
        // Set follower role by default (fans)
        try {
          const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js');
          const functions = getFunctions();
          const setFollowerRole = httpsCallable(functions, 'setFollowerRole');
          await setFollowerRole();
          await user.getIdToken(true); // Refresh token
        } catch (e) {
          console.warn('[Login] Failed to set follower role:', e);
        }
      }

      // Create default profile
      try {
        const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
        const db = getFirestore();
        const profileRef = doc(db, "users", user.uid);
        const profile = {
          username: email.split("@")[0],
          displayName: email.split("@")[0],
          bio: "New member of the RedsRacing community!",
          avatarUrl: "",
          favoriteCars: [],
          joinDate: new Date().toISOString(),
          totalPoints: 0,
          achievementCount: 0,
        };
        if (defaultRole) {
          profile.role = defaultRole;
        }
        await setDoc(profileRef, profile, { merge: true });
      } catch (e) {
        console.warn('[Login] Failed to create profile:', e);
      }

      this.showMessage("Account created! Redirecting to fan dashboard...", false);
      
      // Redirect to follower dashboard for new accounts
      setTimeout(() => {
        navigateToInternal("/follower-dashboard.html");
      }, 1000);
    } catch (error) {
      console.error("[Login] Sign-up failed:", error);
      this.showMessage(getFriendlyAuthError(error));
    } finally {
      this.setLoadingState(this.elements.signupButton, false, "Sign Up");
    }
  }

  /**
   * Get a safe returnTo target from query params (same-origin only)
   */
  getReturnTo() {
    try {
      const params = new URLSearchParams(window.location.search);
      const rt = params.get('returnTo');
      if (!rt) return null;
      const safeReturnTo = validateRedirectUrl(rt, null);
      if (safeReturnTo) {
        return safeReturnTo;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Handle successful authentication
   */
  handleSuccess() {
    // Capture invitation code from form if entered
    const invitationCode = this.elements.invitationCodeInput?.value?.trim();
    if (invitationCode) {
      setPendingInvitationCode(invitationCode);
    }

    const returnTo = this.getReturnTo();
    setTimeout(() => {
      navigateToInternal(returnTo || "/dashboard.html");
    }, 800);
  }

  /**
   * Continue as guest handler
   */
  handleContinueAsGuest() {
    try { localStorage.setItem('rr_guest_ok', '1'); } catch(_) {}
    const returnTo = this.getReturnTo();
    navigateToInternal(returnTo || "/");
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const controller = new LoginPageController();
  controller.initialize();
});
