/**
 * Signup Page Controller
 * Handles user registration with reCAPTCHA Enterprise protection
 */

import { initializeFirebaseCore, getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError } from './auth-errors.js';
import { setPendingInvitationCode } from './invitation-codes.js';
import { recaptchaService } from './recaptcha-enterprise.js';
import { 
    createUserWithEmailAndPassword,
    sendEmailVerification,
    -    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';

/**
 * Signup Page Controller Class
 * Manages user registration with reCAPTCHA Enterprise protection
 */
class SignupPageController {
    constructor() {
        this.auth = null;
        this.googleProvider = null;
        this.isInitialized = false;
        this.elements = {};
        
        // UI state management
        this.uiState = {
            buttonsEnabled: false,
            loadingButton: null
        };
    }

    /**
     * Initialize the signup controller
     */
    async initialize() {
        try {
            console.log('[Signup Controller] Initializing...');
            
            // Initialize Firebase
            this.auth = await getFirebaseAuth();
            this.googleProvider = new GoogleAuthProvider();
            
            // Cache DOM elements
            this.cacheElements();
            
            // Bind event listeners
            this.bindEvents();
            
            // Enable UI
            this.enableUI();
            
            this.isInitialized = true;
            console.log('[Signup Controller] Initialization complete');
            
        } catch (error) {
            console.error('[Signup Controller] Initialization failed:', error);
            this.showMessage('Failed to initialize signup page. Please refresh and try again.');
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
            displayNameInput: document.getElementById('display-name'),
            invitationCodeInput: document.getElementById('invitation-code'),
            
            // Buttons
            signinButton: document.getElementById('signin-button'),
            signupButton: document.getElementById('signup-button'),
            googleSigninButton: document.getElementById('google-signin-button'),
            
            // UI containers
            errorBox: document.getElementById('error-box'),
            errorText: document.getElementById('error-text'),
            loginForm: document.getElementById('login-form')
        };
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Email/password sign up
        this.elements.signupButton?.addEventListener('click', () => this.handleSignUp());
        
        // Sign in redirect
        this.elements.signinButton?.addEventListener('click', () => this.handleSignInRedirect());
        
        // Google sign up
        this.elements.googleSigninButton?.addEventListener('click', () => this.handleGoogleSignUp());
        
        // Input validation and error clearing
        this.elements.emailInput?.addEventListener('input', () => this.hideMessage());
        this.elements.passwordInput?.addEventListener('input', () => this.hideMessage());
        this.elements.displayNameInput?.addEventListener('input', () => this.hideMessage());
    }

    /**
     * Enable UI interactions after Firebase initialization
     */
    enableUI() {
        const buttons = [
            this.elements.signinButton,
            this.elements.signupButton,
            this.elements.googleSigninButton
        ];

        buttons.forEach(button => {
            if (button) {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        this.uiState.buttonsEnabled = true;
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
        
        console.log(`[Signup Controller] ${isError ? 'Error' : 'Success'} message: ${message}`);
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
     * Validate signup form inputs
     */
    validateSignupForm(email, password, displayName) {
        if (!email || !password || !displayName) {
            this.showMessage('Please fill in all required fields.');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('Please enter a valid email address.');
            this.elements.emailInput?.focus();
            return false;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long.');
            this.elements.passwordInput?.focus();
            return false;
        }

        if (displayName.trim().length < 2) {
            this.showMessage('Display name must be at least 2 characters long.');
            this.elements.displayNameInput?.focus();
            return false;
        }

        return true;
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
            console.log(`[Signup Controller] Auth verification passed for ${actionType}:`, result.assessment);
            return result;

        } catch (error) {
            console.error(`[Signup Controller] Auth verification failed for ${actionType}:`, error);
            throw error;
        }
    }

    /**
     * Handle email/password sign up with reCAPTCHA Enterprise protection
     */
    async handleSignUp() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        const email = this.elements.emailInput?.value.trim();
        const password = this.elements.passwordInput?.value;
        const displayName = this.elements.displayNameInput?.value.trim();
        const invitationCode = this.elements.invitationCodeInput?.value.trim();

        this.hideMessage();

        if (!this.validateSignupForm(email, password, displayName)) {
            return;
        }

        this.setLoadingState(this.elements.signupButton, true, 'Create Account');

        try {
            // Protected action with reCAPTCHA Enterprise
            await recaptchaService.protectedAction(
                'REGISTRATION',
                async (recaptchaData) => {
                    // First verify with backend if reCAPTCHA token is present
                    if (recaptchaData.recaptchaToken) {
                        await this.verifyAuthAction('signup', { 
                            ...recaptchaData, 
                            email 
                        });
                    }
                    
                    // Create user account
                    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
                    const user = userCredential.user;

                    // Update user profile
                    await updateProfile(user, {
                        displayName: displayName
                    });

                    // Send email verification
                    await sendEmailVerification(user);

                    // Handle invitation code if provided
                    if (invitationCode) {
                        setPendingInvitationCode(invitationCode);
                    }

                    this.showMessage('Account created successfully! Please check your email to verify your account.', false);
                    
                    // Redirect after a delay
                    setTimeout(() => {
                        this.handleSuccess();
                    }, 2000);
                },
                null, // no user object yet
                {
                    fallbackOnError: true,
                    showUserMessage: true,
                    timeout: 120000,
                    maxRetries: 1
                }
            );
            
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
        } finally {
            this.setLoadingState(this.elements.signupButton, false, 'Create Account');
        }
    }

    /**
     * Handle Google sign up with reCAPTCHA Enterprise protection
     */
    async handleGoogleSignUp() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        this.setLoadingState(this.elements.googleSigninButton, true, 'Sign up with Google');

        try {
            // Protected action with reCAPTCHA Enterprise
            await recaptchaService.protectedAction(
                'REGISTRATION',
                async (recaptchaData) => {
                    // First verify with backend if reCAPTCHA token is present
                    if (recaptchaData.recaptchaToken) {
                        await this.verifyAuthAction('signup', { 
                            ...recaptchaData 
                        });
                    }
                    
                    // Perform Google authentication
                    const result = await signInWithPopup(this.auth, this.googleProvider);
                    const result = await signInWithPopup(this.auth, this.googleProvider);

                    // Handle invitation code if provided
                    const invitationCode = this.elements.invitationCodeInput?.value.trim();
                    if (invitationCode) {
                        setPendingInvitationCode(invitationCode);
                    }

                    this.showMessage('Account created successfully with Google! Redirecting...', false);
                    this.handleSuccess();
                },
                null, // no user object yet
                {
                    fallbackOnError: true,
                    showUserMessage: true,
                    timeout: 120000,
                    maxRetries: 1
                }
            );
            
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showMessage(getFriendlyAuthError(error));
            }
        } finally {
            this.setLoadingState(this.elements.googleSigninButton, false, 'Sign up with Google');
        }
    }

    /**
     * Handle sign in redirect
     */
    handleSignInRedirect() {
        navigateToInternal('/login.html');
    }

    /**
     * Handle successful registration
     */
    handleSuccess() {
        // Redirect to dashboard using the preferred route
        navigateToInternal('/dashboard');
    }
}

// Initialize the signup controller when DOM is ready
let signupController;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeFirebaseCore();
        signupController = new SignupPageController();
        await signupController.initialize();
    });
} else {
    (async () => {
        await initializeFirebaseCore();
        signupController = new SignupPageController();
        await signupController.initialize();
    })();
}

export { SignupPageController };