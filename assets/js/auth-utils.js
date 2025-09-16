/**
 * Authentication Utilities Module
 * Centralized authentication management with token validation, refresh, and error handling
 */

import { getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError, requiresReauth, isNetworkError, isRetryableError } from './auth-errors.js';

// Import sanitization utilities
import { html, safeSetHTML } from './sanitize.js';

// Authentication state and configuration
const AUTH_CONFIG = {
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // Refresh if token expires in 5 minutes
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_BASE_DELAY: 1000, // 1 second base delay
    TOKEN_VALIDATION_CACHE_DURATION: 30 * 1000 // Cache validation for 30 seconds
};

let tokenValidationCache = {
    lastValidation: null,
    isValid: false,
    expirationTime: null
};

/**
 * Enhanced authentication logger
 */
const authLogger = {
    info: (action, message, context = {}) => console.log(`[Auth:${action}] ${message}`, context),
    warn: (action, message, context = {}) => console.warn(`[Auth:${action}] ${message}`, context),
    error: (action, error, context = {}) => console.error(`[Auth:${action}] Error:`, error, context),
    success: (action, message, context = {}) => console.log(`[Auth:${action}] ✓ ${message}`, context)
};

/**
 * Gets current user with validation
 * @returns {Object|null} Current Firebase user or null
 */
export function getCurrentUser() {
    const auth = getFirebaseAuth();
    if (!auth) {
        authLogger.error('GetUser', 'Firebase auth not initialized');
        return null;
    }
    return auth.currentUser;
}

/**
 * Validates and refreshes authentication token if needed
 * @param {boolean} forceRefresh - Force token refresh regardless of expiration
 * @returns {Promise<{success: boolean, token: string|null, error: Object|null}>}
 */
export async function validateAndRefreshToken(forceRefresh = false) {
    const startTime = Date.now();
    authLogger.info('TokenValidation', 'Starting token validation', { forceRefresh });

    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            authLogger.warn('TokenValidation', 'No authenticated user found');
            return {
                success: false,
                token: null,
                error: {
                    code: 'auth/no-current-user',
                    message: 'No authenticated user found',
                    userMessage: 'Please sign in to continue',
                    requiresReauth: true
                }
            };
        }

        // Check cache if not forcing refresh
        if (!forceRefresh && tokenValidationCache.lastValidation) {
            const cacheAge = Date.now() - tokenValidationCache.lastValidation;
            if (cacheAge < AUTH_CONFIG.TOKEN_VALIDATION_CACHE_DURATION && tokenValidationCache.isValid) {
                authLogger.info('TokenValidation', 'Using cached valid token');
                return {
                    success: true,
                    token: await currentUser.getIdToken(false),
                    error: null
                };
            }
        }

        // Get current token and check expiration
        const tokenResult = await currentUser.getIdTokenResult(false);
        const now = Date.now();
        const expirationTime = new Date(tokenResult.expirationTime).getTime();
        const timeUntilExpiry = expirationTime - now;

        authLogger.info('TokenValidation', 'Token status', {
            expirationTime: tokenResult.expirationTime,
            timeUntilExpiry: Math.round(timeUntilExpiry / 1000) + 's',
            authTime: tokenResult.claims.auth_time,
            claims: {
                uid: tokenResult.claims.sub,
                role: tokenResult.claims.role,
                email: tokenResult.claims.email
            }
        });

        // Refresh token if it's expiring soon or force refresh is requested
        let finalToken = tokenResult.token;
        if (forceRefresh || timeUntilExpiry < AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD) {
            authLogger.info('TokenValidation', 'Refreshing token', {
                reason: forceRefresh ? 'forced' : 'expiring-soon',
                timeUntilExpiry: Math.round(timeUntilExpiry / 1000) + 's'
            });

            finalToken = await currentUser.getIdToken(true); // Force refresh
            
            // Get updated token result after refresh
            const refreshedTokenResult = await currentUser.getIdTokenResult(false);
            authLogger.success('TokenValidation', 'Token refreshed successfully', {
                newExpirationTime: refreshedTokenResult.expirationTime,
                refreshDuration: Date.now() - startTime + 'ms'
            });
        }

        // Update cache
        tokenValidationCache = {
            lastValidation: Date.now(),
            isValid: true,
            expirationTime: expirationTime
        };

        return {
            success: true,
            token: finalToken,
            error: null
        };

    } catch (error) {
        authLogger.error('TokenValidation', error, {
            forceRefresh,
            duration: Date.now() - startTime + 'ms'
        });

        // Clear cache on error
        tokenValidationCache = {
            lastValidation: null,
            isValid: false,
            expirationTime: null
        };

        const errorInfo = classifyAuthError(error);
        return {
            success: false,
            token: null,
            error: errorInfo
        };
    }
}

/**
 * Validates user claims and permissions
 * @param {Array<string>} requiredRoles - Required roles for the operation
 * @returns {Promise<{success: boolean, claims: Object|null, error: Object|null}>}
 */
export async function validateUserClaims(requiredRoles = []) {
    authLogger.info('ClaimsValidation', 'Validating user claims', { requiredRoles });

    try {
        const tokenValidation = await validateAndRefreshToken();
        if (!tokenValidation.success) {
            return {
                success: false,
                claims: null,
                error: tokenValidation.error
            };
        }

        const currentUser = getCurrentUser();
        const tokenResult = await currentUser.getIdTokenResult(false);
        const claims = tokenResult.claims;

        authLogger.info('ClaimsValidation', 'Retrieved user claims', {
            uid: claims.sub,
            role: claims.role,
            email: claims.email,
            customClaims: Object.keys(claims).filter(key => !['iss', 'aud', 'auth_time', 'user_id', 'sub', 'iat', 'exp', 'email', 'email_verified', 'firebase'].includes(key))
        });

        // Check required roles if specified
        if (requiredRoles.length > 0) {
            const userRole = claims.role;
            const hasRequiredRole = requiredRoles.includes(userRole);

            if (!hasRequiredRole) {
                authLogger.warn('ClaimsValidation', 'Insufficient permissions', {
                    userRole,
                    requiredRoles,
                    hasRequiredRole
                });

                return {
                    success: false,
                    claims: claims,
                    error: {
                        code: 'auth/insufficient-permissions',
                        message: `User role '${userRole}' does not have required permissions`,
                        userMessage: 'You do not have permission to perform this action',
                        requiresReauth: false
                    }
                };
            }
        }

        authLogger.success('ClaimsValidation', 'Claims validation successful', {
            role: claims.role,
            permissions: requiredRoles.length > 0 ? 'sufficient' : 'not-checked'
        });

        return {
            success: true,
            claims: claims,
            error: null
        };

    } catch (error) {
        authLogger.error('ClaimsValidation', error, { requiredRoles });
        return {
            success: false,
            claims: null,
            error: classifyAuthError(error)
        };
    }
}

/**
 * Safe Firestore operation wrapper with authentication validation
 * @param {Function} operation - Firestore operation to execute
 * @param {Array<string>} requiredRoles - Required roles for the operation
 * @param {string} operationName - Name for logging purposes
 * @returns {Promise<{success: boolean, data: any, error: Object|null}>}
 */
export async function safeFirestoreOperation(operation, requiredRoles = [], operationName = 'Unknown') {
    const startTime = Date.now();
    authLogger.info('FirestoreOperation', `Starting ${operationName}`, { requiredRoles });

    try {
        // Validate authentication and claims
        const claimsValidation = await validateUserClaims(requiredRoles);
        if (!claimsValidation.success) {
            return {
                success: false,
                data: null,
                error: claimsValidation.error
            };
        }

        // Execute the operation
        const result = await operation();
        
        authLogger.success('FirestoreOperation', `${operationName} completed successfully`, {
            duration: Date.now() - startTime + 'ms'
        });

        return {
            success: true,
            data: result,
            error: null
        };

    } catch (error) {
        authLogger.error('FirestoreOperation', error, {
            operationName,
            requiredRoles,
            duration: Date.now() - startTime + 'ms'
        });

        const errorInfo = classifyAuthError(error);
        return {
            success: false,
            data: null,
            error: errorInfo
        };
    }
}

/**
 * Retry mechanism for authentication operations
 * @param {Function} operation - Operation to retry
 * @param {string} operationName - Operation name for logging
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<any>}
 */
export async function retryAuthOperation(operation, operationName = 'Operation', maxAttempts = AUTH_CONFIG.MAX_RETRY_ATTEMPTS) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            authLogger.info('RetryOperation', `${operationName} attempt ${attempt}/${maxAttempts}`);
            const result = await operation();
            
            if (attempt > 1) {
                authLogger.success('RetryOperation', `${operationName} succeeded on attempt ${attempt}`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            authLogger.warn('RetryOperation', `${operationName} failed on attempt ${attempt}`, {
                error: error.message,
                code: error.code
            });

            const errorInfo = classifyAuthError(error);
            
            // Don't retry if it's not a retryable error
            if (!errorInfo.retryable || attempt === maxAttempts) {
                break;
            }

            // Exponential backoff delay
            const delay = AUTH_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
            authLogger.info('RetryOperation', `Waiting ${delay}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    authLogger.error('RetryOperation', `${operationName} failed after ${maxAttempts} attempts`, lastError);
    throw lastError;
}

/**
 * Classifies authentication and Firestore errors
 * @param {Error} error - Error to classify
 * @returns {Object} Classified error information
 */
function classifyAuthError(error) {
    if (!error) {
        return {
            code: 'unknown',
            message: 'Unknown error occurred',
            userMessage: 'An unexpected error occurred. Please try again.',
            requiresReauth: false,
            retryable: false
        };
    }

    // Firebase Auth errors
    if (error.code && error.code.startsWith('auth/')) {
        return {
            code: error.code,
            message: error.message,
            userMessage: getFriendlyAuthError(error),
            requiresReauth: requiresReauth(error.code),
            retryable: isRetryableError(error.code)
        };
    }

    // Firestore errors
    if (error.code) {
        switch (error.code) {
            case 'permission-denied':
                return {
                    code: error.code,
                    message: error.message,
                    userMessage: 'You do not have permission to access this data. Please check your account status.',
                    requiresReauth: true,
                    retryable: false
                };
            case 'unauthenticated':
                return {
                    code: error.code,
                    message: error.message,
                    userMessage: 'Authentication required. Please sign in again.',
                    requiresReauth: true,
                    retryable: false
                };
            case 'unavailable':
            case 'deadline-exceeded':
                return {
                    code: error.code,
                    message: error.message,
                    userMessage: 'Service temporarily unavailable. Please try again in a moment.',
                    requiresReauth: false,
                    retryable: true
                };
            case 'failed-precondition':
                return {
                    code: error.code,
                    message: error.message,
                    userMessage: 'Operation failed due to system constraints. Please contact support.',
                    requiresReauth: false,
                    retryable: false
                };
            default:
                return {
                    code: error.code,
                    message: error.message,
                    userMessage: 'A service error occurred. Please try again.',
                    requiresReauth: false,
                    retryable: true
                };
        }
    }

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        return {
            code: 'network-error',
            message: 'Network connection failed',
            userMessage: 'Please check your internet connection and try again.',
            requiresReauth: false,
            retryable: true
        };
    }

    // Generic errors
    return {
        code: 'generic-error',
        message: error.message || String(error),
        userMessage: 'An unexpected error occurred. Please try again.',
        requiresReauth: false,
        retryable: true
    };
}

/**
 * Shows user-friendly error message
 * @param {Object} errorInfo - Classified error information
 * @param {string} containerId - ID of container to show error in
 */
export function showAuthError(errorInfo, containerId = 'auth-error-container') {
    authLogger.info('ErrorDisplay', 'Showing user error message', {
        code: errorInfo.code,
        userMessage: errorInfo.userMessage,
        requiresReauth: errorInfo.requiresReauth
    });

    const container = document.getElementById(containerId);
    if (!container) {
        // Fallback to alert if container not found
        alert(errorInfo.userMessage);
        return;
    }

    const reauthHTML = errorInfo.requiresReauth ? 
        '<p class="mt-2 text-sm"><a href="login.html" class="underline">Please sign in again</a></p>' : 
        '';
    
    const retryHTML = errorInfo.retryable ? 
        '<p class="mt-2 text-sm">You can try again in a moment.</p>' : 
        '';

    const errorHTML = html`
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <strong class="font-bold">Error: </strong>
            <span class="block sm:inline">${errorInfo.userMessage}</span>
            ${reauthHTML}
            ${retryHTML}
        </div>
    `;

    safeSetHTML(container, errorHTML);
    
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Clears authentication error display
 * @param {string} containerId - ID of container to clear
 */
export function clearAuthError(containerId = 'auth-error-container') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Authentication state monitor - sets up listeners for auth state changes
 * @param {Function} onAuthChange - Callback for auth state changes
 * @param {Function} onError - Callback for auth errors
 */
export function monitorAuthState(onAuthChange, onError) {
    const auth = getFirebaseAuth();
    if (!auth) {
        const error = {
            code: 'auth/not-initialized',
            message: 'Firebase auth not initialized',
            userMessage: 'Authentication service unavailable. Please refresh the page.',
            requiresReauth: false,
            retryable: true
        };
        onError(error);
        return;
    }

    authLogger.info('AuthMonitor', 'Setting up authentication state monitoring');

    return auth.onAuthStateChanged(
        async (user) => {
            if (user) {
                authLogger.info('AuthMonitor', 'User signed in', {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified
                });

                // For new users, force a token refresh to get custom claims immediately.
                // For existing users, use the standard validation (which might be cached).
                const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
                authLogger.info('AuthMonitor', `User is ${isNewUser ? 'new' : 'existing'}.`);

                const tokenValidation = await validateAndRefreshToken(isNewUser);
                if (tokenValidation.success) {
                    onAuthChange(user, tokenValidation.token);
                } else {
                    authLogger.error('AuthMonitor', 'Token validation failed for signed-in user', tokenValidation.error);
                    onError(tokenValidation.error);
                }
            } else {
                authLogger.info('AuthMonitor', 'User signed out');
                // Clear token cache when user signs out
                tokenValidationCache = {
                    lastValidation: null,
                    isValid: false,
                    expirationTime: null
                };
                onAuthChange(null, null);
            }
        },
        (error) => {
            authLogger.error('AuthMonitor', 'Auth state change error', error);
            const errorInfo = classifyAuthError(error);
            onError(errorInfo);
        }
    );
}

// Export configuration for testing
export const AUTH_UTILS_CONFIG = AUTH_CONFIG;