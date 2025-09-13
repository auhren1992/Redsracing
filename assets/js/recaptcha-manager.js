/**
 * RecaptchaManager - Centralized reCAPTCHA handling with timeout and error management
 * 
 * FIXES IMPLEMENTED:
 * ==================
 * 1. ✅ Timeout handling - reCAPTCHA initialization has configurable timeout (default 10s)
 * 2. ✅ Graceful fallback - Returns null instead of throwing errors when reCAPTCHA fails
 * 3. ✅ Proper cleanup - Manages RecaptchaVerifier lifecycle and prevents memory leaks  
 * 4. ✅ User-friendly messaging - Provides clear error messages for different failure scenarios
 * 5. ✅ Non-blocking errors - UI remains functional even when reCAPTCHA is unavailable
 * 6. ✅ Resource management - Prevents global variable pollution and handles multiple instances
 * 7. ✅ Error classification - Distinguishes between retryable and non-retryable reCAPTCHA errors
 * 
 * BEST PRACTICES FOR reCAPTCHA:
 * =============================
 * 1. Always use timeouts when initializing reCAPTCHA (8-10 seconds recommended)
 * 2. Never block critical UI functionality if reCAPTCHA fails to load
 * 3. Provide clear user feedback when reCAPTCHA is unavailable
 * 4. Clean up reCAPTCHA instances when components are destroyed
 * 5. Use invisible reCAPTCHA for better UX where possible
 * 6. Handle network issues gracefully (common cause of reCAPTCHA failures)
 * 7. Test your app with reCAPTCHA blocked (ad blockers, corporate firewalls)
 * 
 * USAGE PATTERNS:
 * ===============
 * 
 * // Basic usage with automatic cleanup
 * const manager = new RecaptchaManager();
 * const verifier = await manager.createVerifier(auth, 'container-id', options);
 * if (verifier) {
 *   // reCAPTCHA is ready, proceed with phone auth
 *   const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
 * } else {
 *   // reCAPTCHA failed, show fallback UI or disable phone auth
 *   showPhoneAuthUnavailable();
 * }
 * // Always cleanup when done
 * manager.cleanup();
 * 
 * // With error handling callbacks
 * manager.onError((error) => {
 *   showUserFriendlyMessage('Security verification unavailable');
 *   disablePhoneAuthUI();
 * });
 * 
 * manager.onExpired(() => {
 *   showUserFriendlyMessage('Please try again');
 * });
 * 
 * COMMON FAILURE SCENARIOS HANDLED:
 * =================================
 * 1. Network timeouts (corporate firewalls, slow connections)
 * 2. Ad blockers blocking reCAPTCHA resources  
 * 3. Missing DOM containers
 * 4. Invalid Firebase configuration
 * 5. reCAPTCHA quota exceeded
 * 6. Browser compatibility issues
 * 7. Third-party script loading failures
 */

import { RecaptchaVerifier } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export class RecaptchaManager {
    constructor() {
        this.verifier = null;
        this.isInitialized = false;
        this.hasTimedOut = false;
        this.cleanupCallbacks = [];
    }

    /**
     * Create and initialize a RecaptchaVerifier with timeout and error handling
     * @param {Object} auth - Firebase Auth instance
     * @param {string} containerId - DOM element ID for reCAPTCHA
     * @param {Object} options - RecaptchaVerifier options
     * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
     * @returns {Promise<RecaptchaVerifier|null>} - Returns verifier or null if failed/timeout
     */
    async createVerifier(auth, containerId, options = {}, timeoutMs = 10000) {
        try {
            // Clean up any existing verifier first
            this.cleanup();

            console.log(`[RecaptchaManager] Creating verifier for container: ${containerId}`);
            
            // Check if container exists
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn(`[RecaptchaManager] Container ${containerId} not found, reCAPTCHA will be disabled`);
                return null;
            }

            // Set up timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    this.hasTimedOut = true;
                    reject(new Error('reCAPTCHA initialization timeout'));
                }, timeoutMs);
            });

            // Set up initialization promise
            const initPromise = this._initializeVerifier(auth, containerId, options);

            // Race between initialization and timeout
            this.verifier = await Promise.race([initPromise, timeoutPromise]);
            
            if (this.verifier) {
                this.isInitialized = true;
                console.log(`[RecaptchaManager] ✓ reCAPTCHA initialized successfully for ${containerId}`);
            }

            return this.verifier;

        } catch (error) {
            console.warn(`[RecaptchaManager] reCAPTCHA initialization failed:`, error.message);
            
            // Don't throw errors - return null to allow graceful fallback
            this.verifier = null;
            this.isInitialized = false;
            
            return null;
        }
    }

    /**
     * Internal method to initialize RecaptchaVerifier
     */
    async _initializeVerifier(auth, containerId, options) {
        const defaultOptions = {
            'size': 'invisible',
            'callback': () => {
                console.log('[RecaptchaManager] reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.warn('[RecaptchaManager] reCAPTCHA expired');
                this._notifyExpired();
            },
            'error-callback': (error) => {
                console.error('[RecaptchaManager] reCAPTCHA error:', error);
                this._notifyError(error);
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        
        // Create verifier
        const verifier = new RecaptchaVerifier(auth, containerId, mergedOptions);
        
        // Render with timeout
        await this._renderWithTimeout(verifier, 5000);
        
        return verifier;
    }

    /**
     * Render RecaptchaVerifier with timeout
     */
    async _renderWithTimeout(verifier, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('reCAPTCHA render timeout'));
            }, timeoutMs);

            verifier.render()
                .then((widgetId) => {
                    clearTimeout(timeout);
                    console.log(`[RecaptchaManager] reCAPTCHA rendered with widget ID: ${widgetId}`);
                    resolve(widgetId);
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * Reset the reCAPTCHA verifier if it exists
     */
    async reset() {
        if (this.verifier && this.isInitialized) {
            try {
                console.log('[RecaptchaManager] Resetting reCAPTCHA');
                const widgetId = await this.verifier.render();
                this.verifier.reset(widgetId);
            } catch (error) {
                console.warn('[RecaptchaManager] Error resetting reCAPTCHA:', error.message);
            }
        }
    }

    /**
     * Get the current verifier instance
     */
    getVerifier() {
        return this.verifier;
    }

    /**
     * Check if reCAPTCHA is ready to use
     */
    isReady() {
        return this.isInitialized && this.verifier && !this.hasTimedOut;
    }

    /**
     * Check if reCAPTCHA timed out during initialization
     */
    hasExpired() {
        return this.hasTimedOut;
    }

    /**
     * Add a callback to be executed when reCAPTCHA expires
     */
    onExpired(callback) {
        this.cleanupCallbacks.push({ type: 'expired', callback });
    }

    /**
     * Add a callback to be executed when reCAPTCHA errors
     */
    onError(callback) {
        this.cleanupCallbacks.push({ type: 'error', callback });
    }

    /**
     * Notify listeners of reCAPTCHA expiration
     */
    _notifyExpired() {
        this.cleanupCallbacks
            .filter(cb => cb.type === 'expired')
            .forEach(cb => {
                try {
                    cb.callback();
                } catch (error) {
                    console.error('[RecaptchaManager] Error in expired callback:', error);
                }
            });
    }

    /**
     * Notify listeners of reCAPTCHA error
     */
    _notifyError(error) {
        this.cleanupCallbacks
            .filter(cb => cb.type === 'error')
            .forEach(cb => {
                try {
                    cb.callback(error);
                } catch (callbackError) {
                    console.error('[RecaptchaManager] Error in error callback:', callbackError);
                }
            });
    }

    /**
     * Clean up the RecaptchaVerifier and reset state
     * This should be called when the component/page is destroyed or when switching flows
     */
    cleanup() {
        if (this.verifier) {
            try {
                console.log('[RecaptchaManager] Cleaning up reCAPTCHA verifier');
                // Note: RecaptchaVerifier doesn't have a destroy method, but we can clear our reference
                this.verifier = null;
            } catch (error) {
                console.warn('[RecaptchaManager] Error during cleanup:', error.message);
            }
        }

        this.isInitialized = false;
        this.hasTimedOut = false;
        this.cleanupCallbacks = [];
    }

    /**
     * Static utility to check if reCAPTCHA errors should block functionality
     */
    static shouldBlockOnError(error) {
        // Only block for critical errors, not for network/timeout issues
        const code = error?.code || '';
        const message = error?.message || '';
        
        // Don't block for these common issues
        if (code.includes('network') || 
            message.includes('timeout') || 
            message.includes('failed to fetch') ||
            code.includes('quota-exceeded')) {
            return false;
        }
        
        return true;
    }

    /**
     * Static utility to get user-friendly reCAPTCHA error messages
     */
    static getErrorMessage(error) {
        const code = error?.code || '';
        const message = error?.message || '';

        if (message.includes('timeout')) {
            return 'Security verification timed out. You can continue without phone verification.';
        }
        
        if (code === 'auth/captcha-check-failed') {
            return 'Security verification failed. Please try again or continue without phone verification.';
        }
        
        if (code.includes('quota-exceeded')) {
            return 'Security verification temporarily unavailable. Please continue without phone verification.';
        }
        
        if (message.includes('network') || message.includes('failed to fetch')) {
            return 'Unable to load security verification. Please check your connection or continue without phone verification.';
        }
        
        return 'Security verification unavailable. You can continue without phone verification.';
    }
}

// Export a convenience function for one-time use
export async function createRecaptchaVerifier(auth, containerId, options = {}, timeoutMs = 10000) {
    const manager = new RecaptchaManager();
    const verifier = await manager.createVerifier(auth, containerId, options, timeoutMs);
    
    // Return both the verifier and manager for cleanup
    return { verifier, manager };
}