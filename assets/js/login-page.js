import "./app.js";

/**
 * Login Page Controller
 * Centralized login flow management with deferred UI enablement, MFA support, and reCAPTCHA Enterprise
 */

import { getFirebaseAuth, getFirebaseApp } from "./firebase-core.js";
import { getFriendlyAuthError } from "./auth-errors.js";
import { setPendingInvitationCode } from "./invitation-codes.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { navigateToInternal } from "./navigation-helpers.js";
import { getFunctions, httpsCallable } from "firebase/functions";

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
   * Initialize the login controller
   */
  async initialize() {
    try {
      console.info("[Login] Initializing controller");

      // Get DOM elements
      this.cacheElements();

      // Disable UI initially
      this.disableUI();

      // Get Firebase auth instance
      this.auth = getFirebaseAuth();
      this.googleProvider = new GoogleAuthProvider();
      console.info("[Login] Firebase auth ready:", !!this.auth);

      // Tabs setup
      this.initTabs();

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
      // Tabs
      tabTeam: document.getElementById("tab-team"),
      tabFollower: document.getElementById("tab-follower"),
      panelTeam: document.getElementById("panel-team"),
      panelFollower: document.getElementById("panel-follower"),

      // Form inputs
      emailInput: document.getElementById("email"),
      passwordInput: document.getElementById("password"),
      invitationCodeInput: document.getElementById("invitation-code"),

      // Buttons
      signinButton: document.getElementById("signin-button"),
      signupButton: document.getElementById("signup-button"),
      googleSigninButton: document.getElementById("google-signin-button"),
      forgotPasswordLink: document.getElementById("forgot-password-link"),

      // UI containers
      errorBox: document.getElementById("error-box"),
      errorText: document.getElementById("error-text"),
      loginForm: document.getElementById("login-form"),

      // Follower inline form elements
      followerEmail: document.getElementById('follower-email'),
      followerPassword: document.getElementById('follower-password'),
      followerSigninButton: document.getElementById('follower-signin'),
      followerGoogleButton: document.getElementById('follower-google'),
      followerForgotLink: document.getElementById('follower-forgot-password'),
      followerErrorBox: document.getElementById('follower-error-box'),
      followerErrorText: document.getElementById('follower-error-text'),
    };
  }

  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Email/password sign in
    this.elements.signinButton?.addEventListener("click", () => {
      console.info("[Login] Sign-in button clicked");
      this.handleEmailSignIn();
    });

    // Follower inline sign in
    this.elements.followerSigninButton?.addEventListener("click", () => {
      this.handleFollowerSignIn();
    });

    // Follower google
    this.elements.followerGoogleButton?.addEventListener("click", () => {
      this.handleFollowerGoogle();
    });

    // Follower forgot
    this.elements.followerForgotLink?.addEventListener("click", (e) => {
      this.handleFollowerForgot(e);
    });

    // Sign up redirect
    this.elements.signupButton?.addEventListener("click", () => {
      console.info("[Login] Sign-up button clicked");
      this.handleSignUpRedirect();
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

  /** Tabs initialization **/
  initTabs() {
    const { tabTeam, tabFollower, panelTeam, panelFollower } = this.elements;
    if (!tabTeam || !tabFollower || !panelTeam || !panelFollower) return;

    const activate = (which) => {
      const isTeam = which === 'team';
      // Toggle classes
      tabTeam.classList.toggle('active', isTeam);
      tabTeam.classList.toggle('bg-yellow-400', isTeam);
      tabTeam.classList.toggle('text-slate-900', isTeam);
      tabTeam.classList.toggle('bg-slate-700', !isTeam);
      tabTeam.classList.toggle('text-white', !isTeam);

      tabFollower.classList.toggle('active', !isTeam);
      tabFollower.classList.toggle('bg-yellow-400', !isTeam);
      tabFollower.classList.toggle('text-slate-900', !isTeam);
      tabFollower.classList.toggle('bg-slate-700', isTeam);
      tabFollower.classList.toggle('text-white', isTeam);

      panelTeam.classList.toggle('hidden', !isTeam);
      panelFollower.classList.toggle('hidden', isTeam);
    };

    tabTeam.addEventListener('click', (e) => { e.preventDefault(); activate('team'); });
    tabFollower.addEventListener('click', (e) => { e.preventDefault(); activate('follower'); });

    // Default to Team/Admin
    activate('team');
  }

  /**
   * Enable UI interactions after Firebase initialization
   */
  enableUI() {
    const buttons = [
      this.elements.signinButton,
      this.elements.signupButton,
      this.elements.googleSigninButton,
      this.elements.followerSigninButton,
      this.elements.followerGoogleButton,
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
      this.elements.followerSigninButton,
      this.elements.followerGoogleButton,
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

  /** toast **/
  showToast(message, type = 'info') {
    try {
      const c = document.getElementById('toast-container');
      if (!c) return;
      const div = document.createElement('div');
      const base = 'px-4 py-2 rounded-md shadow-lg text-sm';
      let cls = base + ' bg-slate-800 text-white border border-slate-600';
      if (type === 'success') cls = base + ' bg-green-600 text-white';
      if (type === 'error') cls = base + ' bg-red-600 text-white';
      div.className = cls;
      div.textContent = message;
      c.appendChild(div);
      setTimeout(() => { try { div.remove(); } catch(_){} }, 3000);
    } catch(_) {}
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

  goInternal(path) {
    try { navigateToInternal(path); }
    catch(_) { try { window.location.href = path.replace(/^\//,''); } catch(_) {} }
  }

  /**
   * Handle email/password sign in
   */
  async handleEmailSignIn() {
    if (!this.isInitialized) {
      console.warn("[Login] handleEmailSignIn called before init");
      this.showMessage("Please wait for the page to load completely.");
      return;
    }

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

      const user = this.auth.currentUser;

      // Ensure default role (sets admin for admin email, otherwise public-fan)
      try {
        const region = 'us-central1';
        await httpsCallable(getFunctions(undefined, region), 'ensureDefaultRole')({});
      } catch (_) {}

      // Force refresh to get latest custom claims
      let role = null;
      let emailLower = '';
      try {
        const tokenResult = await user.getIdTokenResult(true);
        role = tokenResult?.claims?.role || null;
        emailLower = (user?.email || '').toLowerCase();
        console.info("[Login] Claims role:", role);
      } catch (e) {
        console.warn("[Login] Failed to refresh token for claims:", e);
      }

      this.showMessage("Login successful! Redirecting...", false);

      // Route based on role/email
      const ADMIN_EMAIL = 'auhren1992@gmail.com';
      const isAdmin = role === 'admin' || (emailLower && emailLower === ADMIN_EMAIL.toLowerCase());
if (isAdmin) {
        this.goInternal('admin-console.html');
        return;
      }
if (role === "team-member") {
        this.goInternal("redsracing-dashboard.html");
        return;
      } else if (role === "TeamRedFollower") {
        this.goInternal("follower-dashboard.html");
        return;
      }
      // Fallback
      this.handleSuccess();
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
      const cred = await signInWithPopup(this.auth, this.googleProvider);

      // Ensure default role
      try {
        const region = 'us-central1';
        await httpsCallable(getFunctions(undefined, region), 'ensureDefaultRole')({});
      } catch (_) {}

      // Refresh claims and route
      let role = null; let emailLower = '';
      try {
        const user = cred?.user || this.auth.currentUser;
        const tokenResult = await user?.getIdTokenResult?.(true);
        role = tokenResult?.claims?.role || null;
        emailLower = (user?.email || '').toLowerCase();
      } catch (_) {}

      this.showMessage("Google sign-in successful! Redirecting...", false);

      const ADMIN_EMAIL = 'auhren1992@gmail.com';
      const isAdmin = role === 'admin' || (emailLower && emailLower === ADMIN_EMAIL.toLowerCase());
if (isAdmin) { this.goInternal('admin-console.html'); return; }
      if (role === 'team-member') { this.goInternal('redsracing-dashboard.html'); return; }
      if (role === 'TeamRedFollower') { this.goInternal('follower-dashboard.html'); return; }

      this.handleSuccess();
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
   * Handle sign up redirect
   */
  handleSignUpRedirect() {
    navigateToInternal("/signup.html");
  }

  /** follower inline handlers **/
  async handleFollowerSignIn() {
    const email = this.elements.followerEmail?.value?.trim();
    const password = this.elements.followerPassword?.value;
    if (!email || !password) { this.showToast('Please fill in all fields', 'error'); return; }
    this.setLoadingState(this.elements.followerSigninButton, true, 'Sign In as Follower');
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      try { await httpsCallable(getFunctions(undefined,'us-central1'), 'ensureDefaultRole')({}); } catch(_) {}
      let role = null; let emailLower = '';
      try { await this.auth.currentUser?.getIdToken(true); const tr = await this.auth.currentUser?.getIdTokenResult(true); role = tr?.claims?.role || null; emailLower = (this.auth.currentUser?.email||'').toLowerCase(); } catch(_){}
      const ADMIN_EMAIL = 'auhren1992@gmail.com';
      if (role === 'admin' || emailLower === ADMIN_EMAIL.toLowerCase()) { navigateToInternal('/admin-console.html'); return; }
      if (role === 'team-member') { navigateToInternal('/redsracing-dashboard.html'); return; }
      navigateToInternal('/follower-dashboard.html');
    } catch (e) {
      this.showToast(getFriendlyAuthError(e), 'error');
    } finally {
      this.setLoadingState(this.elements.followerSigninButton, false, 'Sign In as Follower');
    }
  }

  async handleFollowerGoogle() {
    this.setLoadingState(this.elements.followerGoogleButton, true, 'Sign in with Google');
    try {
      const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
      try { await httpsCallable(getFunctions(undefined,'us-central1'), 'ensureDefaultRole')({}); } catch(_) {}
      let role = null; let emailLower = (cred?.user?.email||'').toLowerCase();
      try { await cred?.user?.getIdToken(true); const tr = await cred?.user?.getIdTokenResult(true); role = tr?.claims?.role || null; } catch(_){}
      const ADMIN_EMAIL = 'auhren1992@gmail.com';
      if (role === 'admin' || emailLower === ADMIN_EMAIL.toLowerCase()) { navigateToInternal('/admin-console.html'); return; }
      if (role === 'team-member') { navigateToInternal('/redsracing-dashboard.html'); return; }
      navigateToInternal('/follower-dashboard.html');
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') this.showToast(getFriendlyAuthError(e), 'error');
    } finally {
      this.setLoadingState(this.elements.followerGoogleButton, false, 'Sign in with Google');
    }
  }

  async handleFollowerForgot(e) {
    e.preventDefault();
    const email = this.elements.followerEmail?.value?.trim();
    if (!email) { this.showToast('Enter your email first', 'error'); return; }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; if (!re.test(email)) { this.showToast('Please enter a valid email', 'error'); return; }
    try { await sendPasswordResetEmail(this.auth, email); this.showToast('Password reset email sent', 'success'); }
    catch (err) { this.showToast(getFriendlyAuthError(err), 'error'); }
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

    setTimeout(() => {
      navigateToInternal("/dashboard.html");
    }, 1500);
  }
}

// Initialize login controller when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  console.info("[Login] DOMContentLoaded");
  const loginController = new LoginPageController();
  await loginController.initialize();
});
