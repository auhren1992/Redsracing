// assets/js/auth-utils-simplified.js
import { getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError } from './auth-errors.js';
import { html, safeSetHTML } from './sanitize.js';

// Simplified auth utilities without complex caching
const auth = getFirebaseAuth();

/**
 * Gets current user safely
 */
export function getCurrentUser() {
    try {
        return auth.currentUser;
    } catch (error) {
        console.error('[Auth Utils] Error getting current user:', error);
        return null;
    }
}

/**
 * Safe sign out
 */
export async function safeSignOut() {
    try {
        await auth.signOut();
        return true;
    } catch (error) {
        console.error('[Auth Utils] Sign out error:', error);
        return false;
    }
}

/**
 * Validate user claims without complex caching
 */
export async function validateUserClaims(requiredRoles = []) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return {
                success: false,
                error: { message: 'No authenticated user' }
            };
        }

        const tokenResult = await user.getIdTokenResult(false); // Use cached token
        const claims = tokenResult.claims;

        if (requiredRoles.length > 0) {
            const userRole = claims.role;
            if (!requiredRoles.includes(userRole)) {
                return {
                    success: false,
                    claims,
                    error: { message: 'Insufficient permissions' }
                };
            }
        }

        return {
            success: true,
            claims,
            error: null
        };
    } catch (error) {
        console.error('[Auth Utils] Claims validation error:', error);
        return {
            success: false,
            error: { message: error.message || 'Token validation failed' }
        };
    }
}

/**
 * Simple auth state monitor
 */
export function monitorAuthState(onAuthChange, onError) {
    if (!auth) {
        onError({ message: 'Firebase auth not initialized' });
        return () => {};
    }

    return auth.onAuthStateChanged(
        async (user) => {
            try {
                if (user) {
                    // Simple token check without forced refresh
                    const tokenResult = await user.getIdTokenResult(false);
                    onAuthChange(user, tokenResult.token);
                } else {
                    onAuthChange(null, null);
                }
            } catch (error) {
                console.error('[Auth Utils] Auth state error:', error);
                onError({ message: error.message || 'Authentication error' });
            }
        },
        (error) => {
            console.error('[Auth Utils] Auth state listener error:', error);
            onError({ message: error.message || 'Auth listener error' });
        }
    );
}

/**
 * Show user-friendly error
 */
export function showAuthError(errorInfo, containerId = 'auth-error-container') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('[Auth Utils] Error container not found:', containerId);
        return;
    }

    const message = typeof errorInfo === 'string' ? errorInfo :
                   errorInfo.userMessage || errorInfo.message || 'An error occurred';

    const errorHTML = html`
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <strong class="font-bold">Error: </strong>
            <span class="block sm:inline">${message}</span>
        </div>
    `;

    safeSetHTML(container, errorHTML);
}

/**
 * Clear error display
 */
export function clearAuthError(containerId = 'auth-error-container') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}