/**
 * Login Page Controller
 * Centralized login flow management with deferred UI enablement, MFA support, and reCAPTCHA Enterprise
 */

import { getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';
import { setPendingInvitationCode } from './invitation-codes.js';
import { recaptchaService } from './recaptcha-enterprise.js';
import { 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { navigateToInternal } from './navigation-helpers.js';

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
            console.log('[Login Controller] Initializing...');
            
            // Get DOM elements
            this.cacheElements();
            
            // Disable UI initially
            this.disableUI();
            
            // Get Firebase auth instance
            this.auth = getFirebaseAuth();
            this.googleProvider = new GoogleAuthProvider();
            
            // Bind event listeners
            this.bindEvents();
            
            // Enable UI after initialization
            this.enableUI();
            this.isInitialized = true;
            
            console.log('[Login Controller] Initialization complete');
            
        } catch (error) {
            console.error('[Login Controller] Initialization failed:', error);
            this.showMessage('Failed to initialize authentication system. Please refresh the page.');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Form inputs
            emailInput: document.getElementById('email'),
            passwordInput: document.getElementById('password'),
            invitationCodeInput: document.getElementById('invitation-code'),
            
            // Buttons
            signinButton: document.getElementById('signin-button'),
            signupButton: document.getElementById('signup-button'),
            googleSigninButton: document.getElementById('google-signin-button'),
            forgotPasswordLink: document.getElementById('forgot-password-link'),
            
            // UI containers
            errorBox: document.getElementById('error-box'),
            errorText: document.getElementById('error-text'),
            loginForm: document.getElementById('login-form'),
        };

        // Validate all elements exist
        for (const [name, element] of Object.entries(this.elements)) {
            if (!element) {
                console.warn(`[Login Controller] Element not found: ${name}`);
            }
        }
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Email/password sign in
        this.elements.signinButton?.addEventListener('click', () => this.handleEmailSignIn());
        
        // Sign up redirect
        this.elements.signupButton?.addEventListener('click', () => this.handleSignUpRedirect());
        
        // Google sign in
        this.elements.googleSigninButton?.addEventListener('click', () => this.handleGoogleSignIn());
        
        // Password reset
        this.elements.forgotPasswordLink?.addEventListener('click', (e) => this.handleForgotPassword(e));
        
        // Input validation and error clearing
        this.elements.emailInput?.addEventListener('input', () => this.hideMessage());
        this.elements.passwordInput?.addEventListener('input', () => this.hideMessage());
        this.elements.emailInput?.addEventListener('blur', () => this.validateEmailField());
        
        console.log('[Login Controller] Event listeners bound');
    }

    /**
     * Enable UI interactions after Firebase initialization
     */
    enableUI() {
        const buttons = [
            this.elements.signinButton,
            this.elements.signupButton,
            this.elements.googleSigninButton,
        ];

        buttons.forEach(button => {
            if (button) {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        this.uiState.buttonsEnabled = true;
        console.log('[Login Controller] UI enabled');
    }

    /**
     * Disable UI interactions during initialization
     */
    disableUI() {
        const buttons = [
            this.elements.signinButton,
            this.elements.signupButton,
            this.elements.googleSigninButton,
        ];

        buttons.forEach(button => {
            if (button) {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
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
            button.textContent = 'Processing...';
            button.classList.add('opacity-50', 'cursor-not-allowed');
            this.uiState.loadingButton = button;
        } else {
            button.disabled = false;
            button.textContent = originalText;
            button.classList.remove('opacity-50', 'cursor-not-allowed');
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
            ? 'error-message p-4 rounded-md mb-4'
            : 'bg-green-800 text-green-300 border-l-4 border-green-500 p-4 rounded-md mb-4';
        this.elements.errorBox.classList.remove('hidden');
        
        console.log(`[Login Controller] ${isError ? 'Error' : 'Success'} message: ${message}`);
    }

    /**
     * Hide message display
     */
    hideMessage() {
        if (this.elements.errorBox) {
            this.elements.errorBox.classList.add('hidden');
        }
    }

    /**
     * Validate email field in real-time
     */
    validateEmailField() {
        const email = this.elements.emailInput?.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            this.elements.emailInput.classList.add('border-red-500');
            this.elements.emailInput.classList.remove('border-gray-300');
        } else {
            this.elements.emailInput.classList.remove('border-red-500');
            this.elements.emailInput.classList.add('border-gray-300');
        }
    }

    /**
     * Validate login form inputs
     */
    validateLoginForm(email, password) {
        if (!email || !password) {
            this.showMessage('Please fill in all required fields.');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('Please enter a valid email address.');
            return false;
        }
        
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long.');
            return false;
        }
        
        return true;
    }

    /**
     * Handle email/password sign in with reCAPTCHA Enterprise protection
     */
    async handleEmailSignIn() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        const email = this.elements.emailInput?.value.trim();
        const password = this.elements.passwordInput?.value;

        this.hideMessage();

        if (!this.validateLoginForm(email, password)) {
            return;
        }

        this.setLoadingState(this.elements.signinButton, true, 'Sign In');

        try {
            // Protected action with reCAPTCHA Enterprise
            await recaptchaService.protectedAction(
                'LOGIN',
                async (recaptchaData) => {
                    // First verify with backend if reCAPTCHA token is present
                    if (recaptchaData.recaptchaToken) {
                        await this.verifyAuthAction('login', { 
                            ...recaptchaData, 
                            email 
                        });
                    }
                    
                    // Perform Firebase authentication
                    await signInWithEmailAndPassword(this.auth, email, password);
                    this.showMessage('Login successful! Redirecting...', false);
                    this.handleSuccess();
                },
                null, // no user object yet
                {
                    fallbackOnError: true,
                    showUserMessage: true
                }
            );
            
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
        } finally {
            this.setLoadingState(this.elements.signinButton, false, 'Sign In');
        }
    }


    /**
     * Verify authentication action with backend reCAPTCHA assessment
     */
    async verifyAuthAction(actionType, data) {
        try {
            const response = await fetch('/auth_action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    actionType,
                    ...data
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Authentication verification failed: ${response.status}`);
            }

            const result = await response.json();
            console.log(`[Login Controller] Auth verification passed for ${actionType}:`, result.assessment);
            return result;

        } catch (error) {
            console.error(`[Login Controller] Auth verification failed for ${actionType}:`, error);
            throw error;
        }
    }

    /**
     * Handle Google sign in with reCAPTCHA Enterprise protection
     */
    async handleGoogleSignIn() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        this.setLoadingState(this.elements.googleSigninButton, true, 'Sign in with Google');

        try {
            // Protected action with reCAPTCHA Enterprise
            await recaptchaService.protectedAction(
                'LOGIN',
                async (recaptchaData) => {
                    // First verify with backend if reCAPTCHA token is present
                    if (recaptchaData.recaptchaToken) {
                        await this.verifyAuthAction('login', { 
                            ...recaptchaData 
                        });
                    }
                    
                    // Perform Google authentication
                    await signInWithPopup(this.auth, this.googleProvider);
                    this.showMessage('Google sign-in successful! Redirecting...', false);
                    this.handleSuccess();
                },
                null, // no user object yet
                {
                    fallbackOnError: true,
                    showUserMessage: true
                }
            );
            
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showMessage(getFriendlyAuthError(error));
            }
        } finally {
            this.setLoadingState(this.elements.googleSigninButton, false, 'Sign in with Google');
        }
    }


    /**
     * Handle forgot password with reCAPTCHA Enterprise protection
     */
    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = this.elements.emailInput?.value.trim();
        
        if (!email) {
            this.showMessage("Please enter your email address above, then click 'Forgot password?'.");
            this.elements.emailInput?.focus();
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('Please enter a valid email address.');
            this.elements.emailInput?.focus();
            return;
        }

        try {
            // Protected action with reCAPTCHA Enterprise
            await recaptchaService.protectedAction(
                'PASSWORD_RESET',
                async (recaptchaData) => {
                    // Verify with backend if reCAPTCHA token is present
                    if (recaptchaData.recaptchaToken) {
                        await this.verifyPasswordReset({ 
                            ...recaptchaData, 
                            email 
                        });
                    }
                    
                    // Send password reset email
                    await sendPasswordResetEmail(this.auth, email);
                    this.showMessage('Password reset email sent! Please check your inbox and spam folder.', false);
                },
                null, // no user object yet
                {
                    fallbackOnError: true,
                    showUserMessage: true
                }
            );
            
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
        }
    }

    /**
     * Verify password reset action with backend
     */
    async verifyPasswordReset(data) {
        try {
            const response = await fetch('/password_reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Password reset verification failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Login Controller] Password reset verification passed:', result.assessment);
            return result;

        } catch (error) {
            console.error('[Login Controller] Password reset verification failed:', error);
            throw error;
        }
    }

    /**
     * Handle sign up redirect
     */
    handleSignUpRedirect() {
        navigateToInternal('/signup.html');
    }

    /**
     * Handle successful authentication
     */
    handleSuccess() {
        // Capture invitation code from form if entered
        const invitationCode = this.elements.invitationCodeInput?.value?.trim();
        if (invitationCode) {
            setPendingInvitationCode(invitationCode);
            console.log('[Login] Stored invitation code for post-login processing');
        }

        setTimeout(() => {
            navigateToInternal('/dashboard.html');
        }, 1500);
    }
}

// Initialize login controller when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const loginController = new LoginPageController();
    await loginController.initialize();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        loginController.cleanup();
    });
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle initialization
} else {
    // DOM is already loaded
    const loginController = new LoginPageController();
    await loginController.initialize();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        loginController.cleanup();
    });
}