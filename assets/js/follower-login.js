import "./app.js";

/**
 * Follower Login Page Controller
 * Simplified login flow specifically for followers
 */

import { getFirebaseAuth, getFirebaseApp } from "./firebase-core.js";
import { getFriendlyAuthError } from "./auth-errors.js";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { navigateToInternal } from "./navigation-helpers.js";
import { validateUserClaims } from "./auth-utils.js";

const ADMIN_EMAIL = 'auhren1992@gmail.com';

class FollowerLoginController {
  constructor() {
    this.auth = null;
    this.googleProvider = null;
    this.isInitialized = false;
    this.elements = {};

    // UI state management
    this.uiState = {
      buttonsEnabled: false,
      loadingButton: null,
    };
  }

  /**
   * Initialize the follower login controller
   */
  async initialize() {
    try {
      // Get DOM elements
      this.cacheElements();

      // Disable UI initially
      this.disableUI();

      // Get Firebase auth instance
      this.auth = getFirebaseAuth();
      this.googleProvider = new GoogleAuthProvider();

      // Bind event listeners
      this.bindEvents();

      // Enable UI after initialization
      this.enableUI();
      this.isInitialized = true;

      console.log("Follower login controller initialized");
    } catch (error) {
      console.error("Failed to initialize follower login:", error);
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

      // Buttons
      signinButton: document.getElementById("signin-button"),
      googleSigninButton: document.getElementById("google-signin-button"),
      forgotPasswordLink: document.getElementById("forgot-password-link"),

      // UI containers
      errorBox: document.getElementById("error-box"),
      errorText: document.getElementById("error-text"),
      loginForm: document.getElementById("follower-login-form"),
    };
  }

  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Email/password sign in
    this.elements.signinButton?.addEventListener("click", () =>
      this.handleEmailSignIn(),
    );

    // Google sign in
    this.elements.googleSigninButton?.addEventListener("click", () =>
      this.handleGoogleSignIn(),
    );

    // Password reset
    this.elements.forgotPasswordLink?.addEventListener("click", (e) =>
      this.handleForgotPassword(e),
    );

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
      // Preserve original label
      if (!button.dataset.originalLabel) button.dataset.originalLabel = originalText || button.textContent || '';
      button.innerHTML = '<svg class="animate-spin w-4 h-4 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l3 3-3 3v-4a8 8 0 01-8-8z"></path></svg> Processing...';
      button.classList.add("opacity-50", "cursor-not-allowed");
      this.uiState.loadingButton = button;
    } else {
      button.disabled = false;
      const label = button.dataset.originalLabel || originalText || 'Submit';
      button.innerHTML = label;
      button.classList.remove("opacity-50", "cursor-not-allowed");
      if (this.uiState.loadingButton === button) {
        this.uiState.loadingButton = null;
      }
    }
  }

  /**
   * Show message to user
   */
  showMessage(message, isError = true) {
    if (!this.elements.errorText || !this.elements.errorBox) return;

    this.elements.errorText.textContent = message;
    this.elements.errorBox.className = isError
      ? "error-message p-4 rounded-md mb-4"
      : "bg-green-800 text-green-300 border-l-4 border-green-500 p-4 rounded-md mb-4";
    this.elements.errorBox.classList.remove("hidden");
  }

  /**
   * Hide message display
   */
  hideMessage() {
    if (this.elements.errorBox) {
      this.elements.errorBox.classList.add("hidden");
    }
  }

  /**
   * Validate email field in real-time
   */
  validateEmailField() {
    const email = this.elements.emailInput?.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email && !emailRegex.test(email)) {
      this.elements.emailInput.classList.add("border-red-500");
      this.elements.emailInput.classList.remove("border-gray-300");
    } else {
      this.elements.emailInput.classList.remove("border-red-500");
      this.elements.emailInput.classList.add("border-gray-300");
    }
  }

  /**
   * Validate login form inputs
   */
  validateLoginForm(email, password) {
    if (!email || !password) {
      this.showMessage("Please fill in all required fields.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage("Please enter a valid email address.");
      return false;
    }

    if (password.length < 6) {
      this.showMessage("Password must be at least 6 characters long.");
      return false;
    }

    return true;
  }

  /**
   * Handle email/password sign in
   */
  async handleEmailSignIn() {
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

    this.setLoadingState(
      this.elements.signinButton,
      true,
      "Sign In as Follower",
    );

    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password,
      );

      // Ensure default role and refresh claims
      try { await httpsCallable(getFunctions(undefined,'us-central1'), 'ensureDefaultRole')({}); } catch(_) {}
      let role = null; let emailLower = '';
      try {
        await userCredential.user.getIdToken(true);
        const tr = await userCredential.user.getIdTokenResult(true);
        role = tr?.claims?.role || null;
        emailLower = (userCredential.user.email || '').toLowerCase();
      } catch(_) {}

      // Route
      if (role === 'admin' || emailLower === ADMIN_EMAIL.toLowerCase()) {
        try { navigateToInternal('admin-console.html'); } catch(_) { try { window.location.href = 'admin-console.html'; } catch(_){} }
        return;
      }
      if (role === 'team-member') {
        try { navigateToInternal('redsracing-dashboard.html'); } catch(_) { try { window.location.href = 'redsracing-dashboard.html'; } catch(_){} }
        return;
      }

      // Fallback to follower flow
      await this.checkUserRoleAndRedirect(userCredential.user);
    } catch (error) {
      console.error("Email sign in error:", error);
      this.showMessage(this.getFriendlyErrorMessage(error));
    } finally {
      this.setLoadingState(
        this.elements.signinButton,
        false,
        "Sign In as Follower",
      );
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
      const userCredential = await signInWithPopup(
        this.auth,
        this.googleProvider,
      );

      // Ensure default role and refresh claims
      try { await httpsCallable(getFunctions(undefined,'us-central1'), 'ensureDefaultRole')({}); } catch(_) {}
      let role = null; let emailLower = '';
      try {
        await userCredential.user.getIdToken(true);
        const tr = await userCredential.user.getIdTokenResult(true);
        role = tr?.claims?.role || null;
        emailLower = (userCredential.user.email || '').toLowerCase();
      } catch(_) {}

      // Route
      if (role === 'admin' || emailLower === ADMIN_EMAIL.toLowerCase()) {
        try { navigateToInternal('admin-console.html'); } catch(_) { try { window.location.href = 'admin-console.html'; } catch(_){} }
        return;
      }
      if (role === 'team-member') {
        try { navigateToInternal('redsracing-dashboard.html'); } catch(_) { try { window.location.href = 'redsracing-dashboard.html'; } catch(_){} }
        return;
      }

      // Fallback to follower flow
      await this.checkUserRoleAndRedirect(userCredential.user);
    } catch (error) {
      console.error("Google sign in error:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        this.showMessage(this.getFriendlyErrorMessage(error));
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
   * Check user role and redirect appropriately
   */
  async checkUserRoleAndRedirect(user) {
    try {
      // Wait a moment for the token to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Validate user claims
      const claimsResult = await validateUserClaims();
      let userRole = claimsResult.success ? claimsResult.claims.role : null;

      console.log("User role detected:", userRole);

      if (userRole === "team-member") {
        this.showMessage(
          "Team member detected. Redirecting to team dashboard...",
          false,
        );
        setTimeout(() => {
          navigateToInternal("/redsracing-dashboard.html");
        }, 800);
        return;
      }

      // Followers: if role missing or public, automatically assign follower role
      if (userRole !== "TeamRedFollower") {
        try {
          const functions = getFunctions(getFirebaseApp());
          const setFollowerRole = httpsCallable(functions, "setFollowerRole");
          const result = await setFollowerRole();
          if (
            result?.data?.status === "success" ||
            result?.data?.status === "noop"
          ) {
            // Force token refresh to get new claims
            await user.getIdToken(true);
            userRole = "TeamRedFollower";
          }
        } catch (e) {
          console.warn("Failed to assign follower role automatically:", e);
        }
      }

      this.showMessage(
        "Login successful! Redirecting to your dashboard...",
        false,
      );
      setTimeout(() => {
        navigateToInternal("/follower-dashboard.html");
      }, 800);
    } catch (error) {
      console.error("Error checking user role:", error);
      this.showMessage("Login successful. Redirecting...", false);
      setTimeout(() => {
        navigateToInternal("/follower-dashboard.html");
      }, 800);
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
      console.error("Password reset error:", error);
      this.showMessage(this.getFriendlyErrorMessage(error));
    }
  }

  /**
   * Get friendly error message
   */
  getFriendlyErrorMessage(error) {
    const friendlyError = getFriendlyAuthError(error);
    return (
      friendlyError.userMessage ||
      "An unexpected error occurred. Please try again."
    );
  }
}

// Initialize follower login controller when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Initializing follower login controller...");
  const followerLoginController = new FollowerLoginController();
  await followerLoginController.initialize();
});
