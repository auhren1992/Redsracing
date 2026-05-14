// assets/js/auth-utils-simplified.js
import { getFirebaseAuth } from "./firebase-core.js";
import { getFriendlyAuthError } from "./auth-errors.js";
import { html, safeSetHTML } from "./sanitize.js";

// Simplified auth utilities without complex caching
const auth = getFirebaseAuth();

/**
 * Gets current user safely
 */
export function getCurrentUser() {
  try {
    return auth.currentUser;
  } catch (error) {
    return null;
  }
}

/**
 * Safe sign out - clears all auth state including localStorage markers
 */
export async function safeSignOut() {
  try {
    // Clear all auth-related localStorage items first
    try {
      localStorage.removeItem('rr_auth_uid');
      localStorage.removeItem('rr_user_name');
      localStorage.removeItem('rr_guest_ok');
    } catch (_) {}
    // Clear Android native auth storage
    try {
      if (window.FirebaseAuthBridge) window.FirebaseAuthBridge.clearAllAuth();
    } catch (_) {}
    try {
      if (typeof AppLockBridge !== "undefined" && AppLockBridge?.setBiometricUnlockEnabled) {
        AppLockBridge.setBiometricUnlockEnabled(false);
      }
    } catch (_) {}
    try {
      const h = window.webkit?.messageHandlers?.redsRacingAppLock;
      if (h && typeof h.postMessage === "function") {
        h.postMessage({ enabled: false });
      }
    } catch (_) {}
    
    await auth.signOut();
    return true;
  } catch (error) {
    // Even if signOut fails, ensure localStorage is cleared
    try {
      localStorage.removeItem('rr_auth_uid');
      localStorage.removeItem('rr_user_name');
      localStorage.removeItem('rr_guest_ok');
    } catch (_) {}
    try {
      if (window.FirebaseAuthBridge) window.FirebaseAuthBridge.clearAllAuth();
    } catch (_) {}
    try {
      if (typeof AppLockBridge !== "undefined" && AppLockBridge?.setBiometricUnlockEnabled) {
        AppLockBridge.setBiometricUnlockEnabled(false);
      }
    } catch (_) {}
    try {
      const h = window.webkit?.messageHandlers?.redsRacingAppLock;
      if (h && typeof h.postMessage === "function") {
        h.postMessage({ enabled: false });
      }
    } catch (_) {}
    return false;
  }
}

/**
 * Validate user claims without complex caching
 */
export async function validateUserClaims(requiredRoles = [], user = null) {
  try {
    const currentUser = user || getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: { message: "No authenticated user" },
      };
    }

    const tokenResult = await currentUser.getIdTokenResult(false); // Use cached token
    const claims = tokenResult.claims;

    if (requiredRoles.length > 0) {
      const userRole = claims.role;
      if (!requiredRoles.includes(userRole)) {
        return {
          success: false,
          claims,
          error: { message: "Insufficient permissions" },
        };
      }
    }

    return {
      success: true,
      claims,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: { message: error.message || "Token validation failed" },
    };
  }
}

/**
 * Simple auth state monitor
 */
export function monitorAuthState(onAuthChange, onError) {
  if (!auth) {
    onError({ message: "Firebase auth not initialized" });
    return () => {};
  }

  return auth.onAuthStateChanged(
    async (user) => {
      try {
        if (user) {
          let token = null;
          try {
            const tokenResult = await user.getIdTokenResult(false);
            token = tokenResult.token;
          } catch (tokenErr) {
            // Still notify listeners: auth-guard clears its grace timer only when
            // it sees a signed-in user. If getIdTokenResult throws (network,
            // clock skew, transient SDK error), skipping onAuthChange leaves the
            // timer running and the admin console redirects to login after 3–4s.
            onError({
              message: tokenErr?.message || "Token read failed",
              recoverable: true,
            });
          }
          await onAuthChange(user, token);
        } else {
          await onAuthChange(null, null);
        }
      } catch (error) {
        onError({ message: error.message || "Authentication error" });
      }
    },
    (error) => {
      onError({ message: error.message || "Auth listener error" });
    },
  );
}

/**
 * Show user-friendly error
 */
export function showAuthError(errorInfo, containerId = "auth-error-container") {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const message =
    typeof errorInfo === "string"
      ? errorInfo
      : errorInfo.userMessage || errorInfo.message || "An error occurred";

  const errorHTML = html`
    <div
      class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
      role="alert"
    >
      <strong class="font-bold">Error: </strong>
      <span class="block sm:inline">${message}</span>
    </div>
  `;

  safeSetHTML(container, errorHTML);
}

/**
 * Clear error display
 */
export function clearAuthError(containerId = "auth-error-container") {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = "";
  }
}
