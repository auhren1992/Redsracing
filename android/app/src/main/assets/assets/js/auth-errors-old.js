/**
 * Firebase Auth Error Mapping
 * Comprehensive mapping of Firebase auth error codes to user-friendly messages
 */

/**
 * Map of Firebase auth error codes to user-friendly error messages
 */
const AUTH_ERROR_MESSAGES = {
  // Email/Password Authentication Errors
  "auth/user-not-found":
    "No account found with this email address. Please check your email or sign up for a new account.",
  "auth/wrong-password":
    'Incorrect password. Please try again or use "Forgot password?" to reset it.',
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/invalid-password": "Password must be at least 6 characters long.",
  "auth/invalid-credential":
    "Invalid email or password. Please check your credentials and try again.",
  "auth/invalid-login-credentials":
    "Invalid email or password. Please check your credentials and try again.",
  "auth/user-disabled":
    "This account has been disabled. Please contact support for assistance.",
  "auth/email-already-in-use":
    "An account with this email address already exists. Please sign in instead.",
  "auth/weak-password":
    "Password is too weak. Please choose a stronger password.",

  // Rate Limiting and Network Errors
  "auth/too-many-requests":
    "Too many failed login attempts. Please wait a moment and try again.",
  "auth/network-request-failed":
    "Network error. Please check your internet connection and try again.",
  "auth/timeout": "Request timed out. Please try again.",

  // Multi-Factor Authentication Errors
  "auth/multi-factor-required":
    "Multi-factor authentication is required for this account.",
  "auth/multi-factor-info-not-found":
    "Multi-factor authentication information not found.",
  "auth/multi-factor-auth-required":
    "Additional authentication is required to complete sign-in.",
  "auth/invalid-multi-factor-session":
    "Multi-factor authentication session has expired. Please try again.",
  "auth/maximum-second-factor-count-exceeded":
    "Maximum number of second factors exceeded for this user.",
  "auth/second-factor-already-in-use":
    "This second factor is already registered for this account.",
  "auth/unsupported-first-factor": "The first factor is not supported.",
  "auth/unverified-email":
    "Please verify your email address before signing in.",

  // Phone Authentication Errors
  "auth/invalid-phone-number":
    "Please enter a valid phone number with country code (e.g., +1 555-555-5555).",
  "auth/missing-phone-number": "Please enter a phone number.",
  "auth/quota-exceeded": "SMS quota exceeded. Please try again later.",
  "auth/invalid-verification-code":
    "Invalid verification code. Please check the code and try again.",
  "auth/invalid-verification-id":
    "Verification session has expired. Please request a new code.",
  "auth/missing-verification-code": "Please enter the verification code.",
  "auth/missing-verification-id":
    "Verification session not found. Please request a new code.",
  "auth/code-expired":
    "Verification code has expired. Please request a new code.",
  "auth/captcha-check-failed":
    "reCAPTCHA verification failed. Please try again.",
  "auth/missing-app-credential":
    "Phone authentication configuration error. Please contact support.",

  // Google Sign-In Errors
  "auth/popup-blocked":
    "Sign-in popup was blocked by your browser. Please allow popups and try again.",
  "auth/popup-closed-by-user":
    "Sign-in cancelled. Please try again if you want to sign in.",
  "auth/cancelled-popup-request": "Sign-in cancelled. Please try again.",
  "auth/unauthorized-domain":
    "This domain is not authorized for authentication. Please contact support.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled. Please contact support.",
  "auth/account-exists-with-different-credential":
    "An account already exists with the same email but different sign-in method. Please try signing in with your original method.",
  "auth/credential-already-in-use":
    "This account is already linked to another user.",

  // Session and Token Errors
  "auth/requires-recent-login":
    "This operation requires recent authentication. Please sign out and sign in again.",
  "auth/token-expired": "Your session has expired. Please sign in again.",
  "auth/user-token-expired": "Your session has expired. Please sign in again.",
  "auth/invalid-user-token":
    "Invalid authentication token. Please sign in again.",
  "auth/null-user": "No user signed in.",

  // Configuration and Setup Errors
  "auth/app-deleted": "Firebase app has been deleted.",
  "auth/app-not-authorized":
    "App not authorized to use Firebase Authentication.",
  "auth/argument-error":
    "Authentication configuration error. Please contact support.",
  "auth/invalid-api-key":
    "Invalid Firebase configuration. Please contact support.",
  "auth/invalid-auth-domain": "Invalid authentication domain configuration.",
  "auth/invalid-continue-uri": "Invalid continue URL provided.",
  "auth/missing-continue-uri": "Continue URL is required but was not provided.",
  "auth/unauthorized-continue-uri": "Continue URL domain is not authorized.",

  // Password Reset Errors
  "auth/missing-email": "Please enter your email address.",
  "auth/invalid-action-code":
    "The password reset link is invalid or has expired. Please request a new one.",
  "auth/expired-action-code":
    "The password reset link has expired. Please request a new one.",
  "auth/user-mismatch": "The password reset link is for a different user.",

  // Generic Errors
  "auth/internal-error": "An internal error occurred. Please try again.",
  "auth/web-storage-unsupported":
    "Your browser does not support local storage required for authentication.",
  "permission-denied": "You do not have permission to perform this action.",
  unavailable: "The service is currently unavailable. Please try again later.",
};

/**
 * Gets a user-friendly error message for a Firebase auth error
 * @param {Error} error - Firebase auth error object
 * @returns {string} - User-friendly error message
 */
export function getFriendlyAuthError(error) {
  // Handle error object or error code string
  const errorCode = typeof error === "string" ? error : error?.code;

  if (!errorCode) {
    console.warn("[Auth Errors] No error code provided:", error);
    return "An unexpected error occurred. Please try again.";
  }

  const friendlyMessage = AUTH_ERROR_MESSAGES[errorCode];

  if (friendlyMessage) {
    console.log(`[Auth Errors] Mapped error ${errorCode} to friendly message`);
    return friendlyMessage;
  }

  // Log unmapped error codes for future improvement
  console.warn(
    `[Auth Errors] Unmapped error code: ${errorCode}, message: ${error?.message}`,
  );

  // Return original message if available, otherwise generic message
  return error?.message || "An unexpected error occurred. Please try again.";
}

/**
 * Checks if an error code is related to network connectivity
 * @param {string} errorCode - Firebase auth error code
 * @returns {boolean} - True if error is network-related
 */
export function isNetworkError(errorCode) {
  const networkErrors = [
    "auth/network-request-failed",
    "auth/timeout",
    "unavailable",
  ];
  return networkErrors.includes(errorCode);
}

/**
 * Checks if an error code indicates the user should retry the operation
 * @param {string} errorCode - Firebase auth error code
 * @returns {boolean} - True if user should retry
 */
export function isRetryableError(errorCode) {
  const retryableErrors = [
    "auth/network-request-failed",
    "auth/timeout",
    "auth/too-many-requests",
    "auth/internal-error",
    "unavailable",
    "auth/captcha-check-failed",
  ];
  return retryableErrors.includes(errorCode);
}

/**
 * Checks if an error code requires user credential verification
 * @param {string} errorCode - Firebase auth error code
 * @returns {boolean} - True if requires re-authentication
 */
export function requiresReauth(errorCode) {
  const reauthErrors = [
    "auth/requires-recent-login",
    "auth/token-expired",
    "auth/user-token-expired",
    "auth/invalid-user-token",
  ];
  return reauthErrors.includes(errorCode);
}

// Export the error messages map for testing or advanced usage
export { AUTH_ERROR_MESSAGES };
