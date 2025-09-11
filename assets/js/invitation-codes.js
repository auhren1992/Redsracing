/**
 * Invitation Codes Module
 * Handles invitation code capture, storage, and application
 */

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getFirebaseApp } from './firebase-core.js';

// Constants
const PENDING_CODE_KEY = 'pendingInvitationCode';
const DEFAULT_PARAM_NAMES = ['invite', 'code'];

/**
 * Captures invitation code from URL parameters
 * @param {string[]} paramNames - Array of parameter names to check (default: ['invite', 'code'])
 * @param {boolean} stripFromUrl - Whether to remove the parameter from URL after capture (default: true)
 * @returns {string|null} - The captured invitation code or null if not found
 */
export function captureInvitationCodeFromURL(paramNames = DEFAULT_PARAM_NAMES, stripFromUrl = true) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let capturedCode = null;
        let foundParam = null;

        // Check each parameter name
        for (const paramName of paramNames) {
            const code = urlParams.get(paramName);
            if (code && code.trim()) {
                capturedCode = code.trim();
                foundParam = paramName;
                break;
            }
        }

        if (capturedCode) {
            console.log(`[InvitationCodes] Captured code from URL parameter '${foundParam}':`, capturedCode);
            
            // Store the pending code
            setPendingInvitationCode(capturedCode);

            // Strip from URL if requested
            if (stripFromUrl && foundParam) {
                urlParams.delete(foundParam);
                const newUrl = window.location.pathname + 
                    (urlParams.toString() ? '?' + urlParams.toString() : '') + 
                    window.location.hash;
                
                // Use replaceState to avoid adding to browser history
                window.history.replaceState({}, '', newUrl);
                console.log(`[InvitationCodes] Removed '${foundParam}' parameter from URL`);
            }

            return capturedCode;
        }

        return null;
    } catch (error) {
        console.error('[InvitationCodes] Error capturing code from URL:', error);
        return null;
    }
}

/**
 * Sets a pending invitation code in localStorage
 * @param {string} code - The invitation code to store
 */
export function setPendingInvitationCode(code) {
    try {
        if (!code || typeof code !== 'string') {
            console.warn('[InvitationCodes] Invalid code provided to setPendingInvitationCode');
            return;
        }

        const trimmedCode = code.trim();
        if (trimmedCode) {
            localStorage.setItem(PENDING_CODE_KEY, trimmedCode);
            console.log('[InvitationCodes] Pending invitation code stored');
        }
    } catch (error) {
        console.error('[InvitationCodes] Error storing pending code:', error);
    }
}

/**
 * Gets the pending invitation code from localStorage
 * @returns {string|null} - The pending invitation code or null if not found
 */
export function getPendingInvitationCode() {
    try {
        const code = localStorage.getItem(PENDING_CODE_KEY);
        return code && code.trim() ? code.trim() : null;
    } catch (error) {
        console.error('[InvitationCodes] Error retrieving pending code:', error);
        return null;
    }
}

/**
 * Clears the pending invitation code from localStorage
 */
export function clearPendingInvitationCode() {
    try {
        localStorage.removeItem(PENDING_CODE_KEY);
        console.log('[InvitationCodes] Pending invitation code cleared');
    } catch (error) {
        console.error('[InvitationCodes] Error clearing pending code:', error);
    }
}

/**
 * Applies a pending invitation code for the authenticated user
 * @param {Object} auth - Firebase auth instance
 * @returns {Promise<Object>} - Result object with success, error, and details
 */
export async function applyPendingInvitationCode(auth) {
    const pendingCode = getPendingInvitationCode();
    
    if (!pendingCode) {
        return { success: false, error: 'No pending invitation code found' };
    }

    if (!auth || !auth.currentUser) {
        return { success: false, error: 'User not authenticated' };
    }

    try {
        console.log('[InvitationCodes] Applying pending invitation code:', pendingCode);

        // Get Firebase Functions instance
        const app = getFirebaseApp();
        if (!app) {
            throw new Error('Firebase not initialized');
        }

        const functions = getFunctions(app);
        const processInvitationCode = httpsCallable(functions, 'processInvitationCode');

        // Call the Cloud Function
        const result = await processInvitationCode({
            code: pendingCode,
            uid: auth.currentUser.uid
        });

        const response = result.data;
        console.log('[InvitationCodes] Cloud Function response:', response);

        // Handle the response
        if (response.status === 'success') {
            // Success - clear the pending code and refresh token
            clearPendingInvitationCode();
            
            try {
                // Force refresh of ID token to get new custom claims
                await auth.currentUser.getIdToken(true);
                console.log('[InvitationCodes] ID token refreshed successfully');
            } catch (tokenError) {
                console.warn('[InvitationCodes] Token refresh failed:', tokenError);
                // Don't fail the entire operation for token refresh issues
            }

            // Dispatch success event
            dispatchCodeEvent('invitation-code-applied', { 
                code: pendingCode, 
                role: response.role || 'unknown' 
            });

            return { 
                success: true, 
                role: response.role,
                message: response.message 
            };

        } else {
            // Error from Cloud Function
            const errorMessage = response.message || 'Failed to process invitation code';
            
            // Determine if we should clear the code or keep it for retry
            const shouldClearCode = isNonRetryableError(response);
            
            if (shouldClearCode) {
                clearPendingInvitationCode();
                console.log('[InvitationCodes] Clearing code due to non-retryable error');
            } else {
                console.log('[InvitationCodes] Keeping code for potential retry');
            }

            // Dispatch failure event
            dispatchCodeEvent('invitation-code-failed', { 
                code: pendingCode, 
                error: errorMessage 
            });

            return { 
                success: false, 
                error: errorMessage,
                retryable: !shouldClearCode 
            };
        }

    } catch (error) {
        console.error('[InvitationCodes] Error applying invitation code:', error);
        
        // Handle different types of errors
        const isNetworkError = error.code === 'functions/unavailable' || 
                              error.code === 'functions/deadline-exceeded' ||
                              error.message.includes('Failed to fetch') ||
                              error.name === 'TypeError';

        let errorMessage = 'Failed to process invitation code';
        let shouldClearCode = true;

        if (isNetworkError) {
            errorMessage = 'Network error - please try again later';
            shouldClearCode = false; // Keep for retry
        } else if (error.code === 'functions/not-found') {
            errorMessage = 'Invitation system is not available';
            shouldClearCode = false; // Keep for retry when system is available
        } else if (error.code === 'functions/unauthenticated') {
            errorMessage = 'Please sign in to use invitation codes';
            shouldClearCode = false; // Keep for retry after auth
        }

        // Handle Cloud Functions not available in development
        if (error.message.includes('Cloud Functions') || 
            error.code === 'functions/not-found') {
            console.warn('[InvitationCodes] Cloud Functions not available, keeping code for later');
            shouldClearCode = false;
        }

        if (shouldClearCode) {
            clearPendingInvitationCode();
        }

        // Dispatch failure event
        dispatchCodeEvent('invitation-code-failed', { 
            code: pendingCode, 
            error: errorMessage 
        });

        return { 
            success: false, 
            error: errorMessage,
            retryable: !shouldClearCode 
        };
    }
}

/**
 * Determines if an error is non-retryable (should clear the code)
 * @param {Object} response - Cloud Function response
 * @returns {boolean} - True if the error is non-retryable
 */
function isNonRetryableError(response) {
    const message = response.message || '';
    
    // These errors indicate the code is invalid or already used
    const nonRetryableMessages = [
        'invalid invitation code',
        'already been used',
        'expired',
        'not found'
    ];

    return nonRetryableMessages.some(msg => 
        message.toLowerCase().includes(msg.toLowerCase())
    );
}

/**
 * Dispatches a custom event for invitation code operations
 * @param {string} eventName - Name of the event
 * @param {Object} detail - Event detail object
 */
function dispatchCodeEvent(eventName, detail) {
    try {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
        console.log(`[InvitationCodes] Dispatched event: ${eventName}`, detail);
    } catch (error) {
        console.warn('[InvitationCodes] Failed to dispatch event:', eventName, error);
    }
}

/**
 * Checks if the current user needs an invitation code
 * (user is authenticated but has no role or default role)
 * @param {Object} auth - Firebase auth instance
 * @returns {Promise<boolean>} - True if user needs an invitation code
 */
export async function userNeedsInvitationCode(auth) {
    if (!auth || !auth.currentUser) {
        return false;
    }

    try {
        const tokenResult = await auth.currentUser.getIdTokenResult();
        const role = tokenResult.claims.role;
        
        // User needs code if they have no role or the default 'public-fan' role
        return !role || role === 'public-fan';
    } catch (error) {
        console.error('[InvitationCodes] Error checking user role:', error);
        return false;
    }
}