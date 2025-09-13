/**
 * Authentication error helpers used by auth-utils.js and page modules.
 * Provides standardized classification and user-friendly messages.
 */

export function isNetworkError(error) {
  try {
    if (!error) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

    const code = (error.code || '').toString().toLowerCase();
    const name = (error.name || '').toString().toLowerCase();
    const msg = (error.message || String(error)).toLowerCase();

    return (
      code.includes('network') ||
      name.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('net::') ||
      name === 'aborterror' // fetch timeout via AbortController
    );
  } catch {
    return false;
  }
}

return ['captcha', 'recaptcha'].some(keyword => code.includes(keyword) || message.includes(keyword));
  try {
    if (!error) return false;
    
    const code = (error.code || '').toString().toLowerCase();
    const message = (error.message || String(error)).toLowerCase();
    
    return (
      code.includes('captcha') ||
      code.includes('recaptcha') ||
      message.includes('captcha') ||
      message.includes('recaptcha') ||
      code === 'auth/captcha-check-failed' ||
      code === 'auth/invalid-app-credential'
    );
  } catch {
    return false;
  }
}

export function isRetryableError(error) {
  try {
    if (isNetworkError(error)) return true;

    // reCAPTCHA errors are generally retryable unless it's a configuration issue
    if (isRecaptchaError(error)) {
      const code = (error.code || '').toString().toLowerCase();
      const message = (error.message || String(error)).toLowerCase();
      
      // These reCAPTCHA errors are not retryable
      if (code === 'auth/invalid-app-credential' || 
          message.includes('invalid site key') ||
          message.includes('invalid domain')) {
        return false;
      }
      
      return true; // Most reCAPTCHA errors are retryable
    }

    // HTTP-like errors
    const status = Number(error?.status ?? error?.response?.status ?? NaN);
    if (!Number.isNaN(status)) {
      if (status >= 500 && status <= 599) return true; // server errors
      if (status === 429) return true; // rate limit
      if (status === 408) return true; // request timeout
    }

    const name = (error?.name || '').toLowerCase();
    if (name === 'aborterror') return true;

    return false;
  } catch {
    return false;
  }
}

export function requiresReauth(error) {
  try {
    const code = (error?.code || '').toString();
    return [
      'auth/requires-recent-login',
      'auth/user-token-expired',
      'auth/invalid-user-token',
      'auth/no-current-user',
      'auth/id-token-expired'
    ].some((c) => code.includes(c));
  } catch {
    return false;
  }
}

export function getFriendlyAuthError(error) {
  const net = isNetworkError(error);
  const reauth = requiresReauth(error);
  const retryable = isRetryableError(error);
  const recaptcha = isRecaptchaError(error);
  const code = error?.code || '';
  const rawMessage = error?.message || String(error || '');

  if (net) {
    return {
      title: 'Network issue detected',
      userMessage: 'We could not reach the service. Please check your connection and try again.',
      icon: '🌐',
      requiresReauth: false,
      retryable: true,
      code,
      rawMessage
    };
  }

  if (reauth) {
    return {
      title: 'Please sign in again',
      userMessage: 'Your session expired. Please reauthenticate to continue.',
      icon: '🔒',
      requiresReauth: true,
      retryable: false,
      code,
      rawMessage
    };
  }

  // reCAPTCHA-specific errors with user-friendly messaging
  if (recaptcha) {
    const message = rawMessage.toLowerCase();
    
    if (message.includes('timeout')) {
      return {
        title: 'Security verification timed out',
        userMessage: 'Security verification took too long. You can continue without phone verification.',
        icon: '⏱️',
        requiresReauth: false,
        retryable: true,
        code,
        rawMessage
      };
    }
    
    if (code === 'auth/captcha-check-failed') {
      return {
        title: 'Security verification failed',
        userMessage: 'Security verification failed. Please try again or continue without phone verification.',
        icon: '🛡️',
        requiresReauth: false,
        retryable: true,
        code,
        rawMessage
      };
    }
    
    if (code.includes('quota-exceeded')) {
      return {
        title: 'Service temporarily unavailable',
        userMessage: 'Security verification is temporarily unavailable. Please continue without phone verification.',
        icon: '⏸️',
        requiresReauth: false,
        retryable: false,
        code,
        rawMessage
      };
    }
    
    // Generic reCAPTCHA error
    return {
      title: 'Security verification unavailable',
      userMessage: 'Security verification is currently unavailable. You can continue without phone verification.',
      icon: '🛡️',
      requiresReauth: false,
      retryable,
      code,
      rawMessage
    };
  }

  // Generic Firebase auth errors
  if (String(code).startsWith('auth/')) {
    return {
      title: 'Authentication error',
      userMessage: 'We had trouble verifying your account. Please try again.',
      icon: '⚠️',
      requiresReauth: false,
      retryable,
      code,
      rawMessage
    };
  }

  // Fallback
  return {
    title: 'Something went wrong',
    userMessage: 'An unexpected error occurred. Please try again.',
    icon: '⚠️',
    requiresReauth: false,
    retryable,
    code,
    rawMessage
  };
}