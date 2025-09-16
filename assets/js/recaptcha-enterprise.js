/**
 * reCAPTCHA Enterprise Account Defender Service
 * Provides frontend integration for reCAPTCHA Enterprise across all critical user actions
 */

class RecaptchaEnterpriseService {
    constructor() {
        this.siteKey = null;
        this.isLoaded = false;
        this.loadPromise = null;
        this.fallbackEnabled = true;
    }

    /**
     * Initialize reCAPTCHA Enterprise
     * @param {string} siteKey - reCAPTCHA site key
     */
    async initialize(siteKey) {
        if (this.isLoaded && this.siteKey === siteKey) {
            return true;
        }

        this.siteKey = siteKey;
        
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this._loadRecaptchaScript();
        return this.loadPromise;
    }

    /**
     * Load the reCAPTCHA Enterprise script
     */
    async _loadRecaptchaScript() {
        try {
            // Check if already loaded
            if (window.grecaptcha && window.grecaptcha.enterprise) {
                this.isLoaded = true;
                return true;
            }

            // Create script element
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/enterprise.js?render=${this.siteKey}`;
            script.async = true;
            script.defer = true;

            // Wait for script to load
            const loadPromise = new Promise((resolve, reject) => {
                script.onload = () => {
                    // Wait for grecaptcha to be available
                    const checkRecaptcha = () => {
                        if (window.grecaptcha && window.grecaptcha.enterprise) {
                            this.isLoaded = true;
                            resolve(true);
                        } else {
                            setTimeout(checkRecaptcha, 100);
                        }
                    };
                    checkRecaptcha();
                };
                
                script.onerror = () => {
                    console.warn('[reCAPTCHA] Failed to load reCAPTCHA Enterprise script');
                    reject(new Error('Failed to load reCAPTCHA script'));
                };

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!this.isLoaded) {
                        reject(new Error('reCAPTCHA script load timeout'));
                    }
                }, 10000);
            });

            document.head.appendChild(script);
            return loadPromise;

        } catch (error) {
            console.warn('[reCAPTCHA] Error loading reCAPTCHA Enterprise:', error);
            return false;
        }
    }

    /**
     * Execute reCAPTCHA for a specific action
     * @param {string} action - Action name (LOGIN, REGISTRATION, PASSWORD_RESET, etc.)
     * @param {number} timeout - Timeout in milliseconds (default: 5000)
     * @returns {Promise<string|null>} reCAPTCHA token or null if failed
     */
    async executeAction(action, timeout = 5000) {
        try {
            if (!this.isLoaded || !window.grecaptcha || !window.grecaptcha.enterprise) {
                console.warn('[reCAPTCHA] reCAPTCHA Enterprise not loaded, using fallback');
                return null;
            }

            if (!this.siteKey) {
                console.warn('[reCAPTCHA] Site key not configured');
                return null;
            }

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('reCAPTCHA timeout')), timeout);
            });

            // Execute reCAPTCHA with timeout
            const executePromise = window.grecaptcha.enterprise.execute(this.siteKey, { action });

            const token = await Promise.race([executePromise, timeoutPromise]);

            console.log(`[reCAPTCHA] Successfully executed action: ${action}`);
            return token;

        } catch (error) {
            console.warn(`[reCAPTCHA] Failed to execute action ${action}:`, error);

            // Return null for fallback handling
            return null;
        }
    }

    /**
     * Get user identifier for reCAPTCHA assessment
     * @param {Object} user - Firebase user object
     * @returns {string|null} User identifier (preferably internal ID or email)
     */
    getUserIdentifier(user) {
        if (!user) return null;
        
        // Prefer internal user ID, fallback to email
        return user.uid || user.email || null;
    }

    /**
     * Prepare reCAPTCHA data for API requests
     * @param {string} action - Action name
     * @param {string} token - reCAPTCHA token
     * @param {Object} user - Firebase user object (optional)
     * @returns {Object} Data to include in API request
     */
    prepareRequestData(action, token, user = null) {
        const data = {
            recaptchaToken: token,
            recaptchaAction: action
        };

        // Add user information if available
        if (user) {
            data.userId = user.uid;
            data.email = user.email;
        }

        return data;
    }

    /**
     * Handle reCAPTCHA protected action
     * @param {string} action - Action name
     * @param {Function} actionCallback - Function to execute if reCAPTCHA passes
     * @param {Object} user - Firebase user object (optional)
     * @param {Object} options - Additional options
     * @returns {Promise<any>} Result of the action
     */
    async protectedAction(action, actionCallback, user = null, options = {}) {
        const { 
            fallbackOnError = true,
            showUserMessage = true,
            timeout = 5000
        } = options;

        try {
            // Execute reCAPTCHA
            const token = await this.executeAction(action, timeout);
            
            if (!token && !fallbackOnError) {
                throw new Error('reCAPTCHA verification required but failed');
            }

            // Prepare data for the action
            const recaptchaData = token ? this.prepareRequestData(action, token, user) : {};
            
            // Execute the protected action
            return await actionCallback(recaptchaData);

        } catch (error) {
            console.error(`[reCAPTCHA] Protected action ${action} failed:`, error);
            
            if (fallbackOnError) {
                console.warn(`[reCAPTCHA] Attempting fallback for action: ${action}`);
                // Execute action without reCAPTCHA data
                return await actionCallback({});
            } else {
                if (showUserMessage) {
                    this._showUserMessage('Security verification failed. Please try again.', true);
                }
                throw error;
            }
        }
    }

    /**
     * Show user message (can be overridden by specific page implementations)
     * @param {string} message - Message to show
     * @param {boolean} isError - Whether this is an error message
     */
    _showUserMessage(message, isError = false) {
        // Default implementation - can be overridden
        if (isError) {
            console.error('[reCAPTCHA] User message:', message);
        } else {
            console.log('[reCAPTCHA] User message:', message);
        }
        
        // Try to find a common error display element
        const errorBox = document.getElementById('error-box');
        const errorText = document.getElementById('error-text');
        
        if (errorBox && errorText) {
            errorText.textContent = message;
            errorBox.classList.remove('hidden');
            
            // Hide after 5 seconds for non-error messages
            if (!isError) {
                setTimeout(() => {
                    errorBox.classList.add('hidden');
                }, 5000);
            }
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    /**
     * Reset reCAPTCHA (useful for retry scenarios)
     */
    reset() {
        try {
            if (this.isLoaded && window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.reset) {
                window.grecaptcha.enterprise.reset();
            }
        } catch (error) {
            console.warn('[reCAPTCHA] Error resetting reCAPTCHA:', error);
        }
    }

    /**
     * Check if reCAPTCHA is available and ready
     * @returns {boolean} True if reCAPTCHA is ready
     */
    isReady() {
        return this.isLoaded && 
               window.grecaptcha && 
               window.grecaptcha.enterprise && 
               this.siteKey;
    }
}

// Global instance
const recaptchaService = new RecaptchaEnterpriseService();

// Auto-initialize with default site key from environment
// In production, this should be loaded from a secure configuration
const RECAPTCHA_SITE_KEY = '6Lf8rYoqAAAAAJtF-YOUR-SITE-KEY-HERE'; // Replace with actual site key

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        recaptchaService.initialize(RECAPTCHA_SITE_KEY).catch(console.warn);
    });
} else {
    recaptchaService.initialize(RECAPTCHA_SITE_KEY).catch(console.warn);
}

export { recaptchaService, RecaptchaEnterpriseService };