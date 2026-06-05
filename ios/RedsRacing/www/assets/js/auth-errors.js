/**
 * Authentication error helpers used by auth-utils.js and page modules.
 * Provides standardized classification and user-friendly messages.
 */

export function isNetworkError(error) {
  try {
    if (!error) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      return true;

    const code = (error.code || "").toString().toLowerCase();
    const name = (error.name || "").toString().toLowerCase();
    const msg = (error.message || String(error)).toLowerCase();

    return (
      code.includes("network") ||
      name.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("net::") ||
      name === "aborterror" // fetch timeout via AbortController
    );
  } catch {
    return false;
  }
}

export function isRetryableError(error) {
  try {
    if (isNetworkError(error)) return true;

    // HTTP-like errors
    const status = Number(error?.status ?? error?.response?.status ?? NaN);
    if (!Number.isNaN(status)) {
      if (status >= 500 && status <= 599) return true; // server errors
      if (status === 429) return true; // rate limit
      if (status === 408) return true; // request timeout
    }

    const name = (error?.name || "").toLowerCase();
    if (name === "aborterror") return true;

    return false;
  } catch {
    return false;
  }
}

export function requiresReauth(error) {
  try {
    const code = (error?.code || "").toString();
    return [
      "auth/requires-recent-login",
      "auth/user-token-expired",
      "auth/invalid-user-token",
      "auth/no-current-user",
      "auth/id-token-expired",
    ].some((c) => code.includes(c));
  } catch {
    return false;
  }
}

export function getFriendlyAuthError(error) {
  const net = isNetworkError(error);
  const reauth = requiresReauth(error);
  const retryable = isRetryableError(error);
  const code = error?.code || "";
  const rawMessage = error?.message || String(error || "");

  if (net) {
    return {
      title: "Network issue detected",
      userMessage:
        "We could not reach the service. Please check your connection and try again.",
      icon: "🌐",
      requiresReauth: false,
      retryable: true,
      code,
      rawMessage,
    };
  }

  if (reauth) {
    return {
      title: "Please sign in again",
      userMessage: "Your session expired. Please reauthenticate to continue.",
      icon: "🔒",
      requiresReauth: true,
      retryable: false,
      code,
      rawMessage,
    };
  }

  // Specific Firebase auth error messages
  if (String(code).startsWith("auth/")) {
    let userMessage = "We had trouble verifying your account. Please try again.";
    
    // Common auth errors with user-friendly messages
    if (code === "auth/invalid-login-credentials" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      userMessage = "Invalid email or password. Please check your credentials and try again.";
    } else if (code === "auth/user-disabled") {
      userMessage = "This account has been disabled. Please contact support.";
    } else if (code === "auth/too-many-requests") {
      userMessage = "Too many failed login attempts. Please try again later or reset your password.";
    } else if (code === "auth/invalid-email") {
      userMessage = "Please enter a valid email address.";
    } else if (code === "auth/email-already-in-use") {
      userMessage = "This email is already registered. Please sign in instead.";
    } else if (code === "auth/weak-password") {
      userMessage = "Password should be at least 6 characters long.";
    } else if (code === "auth/operation-not-allowed") {
      userMessage = "This sign-in method is not enabled. Please contact support.";
    } else if (code === "auth/popup-closed-by-user") {
      userMessage = "Sign-in popup was closed. Please try again.";
    }
    
    return {
      title: "Authentication error",
      userMessage,
      icon: "⚠️",
      requiresReauth: false,
      retryable,
      code,
      rawMessage,
    };
  }

  // Fallback
  return {
    title: "Something went wrong",
    userMessage: "An unexpected error occurred. Please try again.",
    icon: "⚠️",
    requiresReauth: false,
    retryable,
    code,
    rawMessage,
  };
}
