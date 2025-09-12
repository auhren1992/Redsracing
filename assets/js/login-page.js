/**
 * Login Page Controller
 * Centralized login flow management with deferred UI enablement, MFA support, and phone auth
 */

import { initializeFirebaseCore, getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError } from './auth-errors.js';
import { setPendingInvitationCode } from './invitation-codes.js';
import { 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    PhoneMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/**
 * Login Page Controller Class
 * Manages the complete login lifecycle with proper initialization sequence
 */
class LoginPageController {
    constructor() {
        this.auth = null;
        this.googleProvider = null;
        this.recaptchaVerifier = null;
        this.confirmationResult = null;
        this.isInitialized = false;
        this.elements = {};
        
        // UI state management
        this.uiState = {
            buttonsEnabled: false,
            currentFlow: 'email', // 'email', 'phone', 'mfa'
            loadingButton: null
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
            
            // Initialize Firebase
            const { auth } = await initializeFirebaseCore();
            this.auth = auth;
            this.googleProvider = new GoogleAuthProvider();
            
            // Setup reCAPTCHA for phone auth
            this.setupRecaptcha();
            
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
            phoneNumberInput: document.getElementById('phone-number'),
            verificationCodeInput: document.getElementById('verification-code'),
            
            // Buttons
            signinButton: document.getElementById('signin-button'),
            signupButton: document.getElementById('signup-button'),
            googleSigninButton: document.getElementById('google-signin-button'),
            sendCodeButton: document.getElementById('send-code-button'),
            verifyCodeButton: document.getElementById('verify-code-button'),
            forgotPasswordLink: document.getElementById('forgot-password-link'),
            
            // UI containers
            errorBox: document.getElementById('error-box'),
            errorText: document.getElementById('error-text'),
            loginForm: document.getElementById('login-form'),
            phoneAuthContainer: document.getElementById('phone-auth-container'),
            phoneForm: document.getElementById('phone-form'),
            codeForm: document.getElementById('code-form'),
            recaptchaContainer: document.getElementById('recaptcha-container')
        };

        // Validate all elements exist
        for (const [name, element] of Object.entries(this.elements)) {
            if (!element) {
                console.warn(`[Login Controller] Element not found: ${name}`);
            }
        }
    }

    /**
     * Setup reCAPTCHA verifier for phone authentication
     */
    setupRecaptcha() {
        try {
            if (this.elements.recaptchaContainer) {
                this.recaptchaVerifier = new RecaptchaVerifier(this.auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': (response) => {
                        console.log('[Login Controller] reCAPTCHA solved');
                    },
                    'expired-callback': () => {
                        console.log('[Login Controller] reCAPTCHA expired');
                        this.showMessage('Security verification expired. Please try again.');
                    }
                });
                console.log('[Login Controller] reCAPTCHA verifier initialized');
            }
        } catch (error) {
            console.error('[Login Controller] reCAPTCHA setup failed:', error);
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
        
        // Phone authentication
        this.elements.sendCodeButton?.addEventListener('click', () => this.handleSendPhoneCode());
        this.elements.verifyCodeButton?.addEventListener('click', () => this.handleVerifyPhoneCode());
        
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
            this.elements.sendCodeButton,
            this.elements.verifyCodeButton
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
            this.elements.sendCodeButton,
            this.elements.verifyCodeButton
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
     * Handle email/password sign in
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
            await signInWithEmailAndPassword(this.auth, email, password);
            this.showMessage('Login successful! Redirecting...', false);
            this.handleSuccess();
            
        } catch (error) {
            if (error.code === 'auth/multi-factor-required') {
                await this.handleMFARequired(error);
            } else {
                this.showMessage(getFriendlyAuthError(error));
            }
        } finally {
            this.setLoadingState(this.elements.signinButton, false, 'Sign In');
        }
    }

    /**
     * Handle MFA requirement
     */
    async handleMFARequired(error) {
        try {
            this.showMessage('2-Step Verification required. Sending code...', false);
            const resolver = error.resolver;
            const phoneInfoOptions = {
                multiFactorHint: resolver.hints[0],
                session: resolver.session
            };
            const phoneAuthProvider = new PhoneAuthProvider(this.auth);

            const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, this.recaptchaVerifier);
            
            // Switch to MFA code input mode
            this.switchToMFAMode(verificationId, resolver);
            
        } catch (err) {
            console.error('[Login Controller] MFA setup failed:', err);
            this.showMessage('Could not send 2-step verification code. Please try again.');
        }
    }

    /**
     * Switch UI to MFA code input mode
     */
    switchToMFAMode(verificationId, resolver) {
        this.uiState.currentFlow = 'mfa';
        
        // Hide login form and show code verification
        this.elements.loginForm?.classList.add('hidden');
        this.elements.phoneAuthContainer?.classList.remove('hidden');
        this.elements.phoneForm?.classList.add('hidden');
        this.elements.codeForm?.classList.remove('hidden');

        // Override verify button for MFA
        const verifyMFACode = async () => {
            const code = this.elements.verificationCodeInput?.value.trim();
            
            if (!code) {
                this.showMessage('Please enter the verification code.');
                return;
            }

            this.setLoadingState(this.elements.verifyCodeButton, true, 'Verify and Sign In');

            try {
                const cred = PhoneMultiFactorGenerator.credential({
                    verificationId: verificationId,
                    verificationCode: code
                });
                
                await resolver.resolveSignIn(cred);
                this.handleSuccess();
                
            } catch (err) {
                this.showMessage(getFriendlyAuthError(err));
            } finally {
                this.setLoadingState(this.elements.verifyCodeButton, false, 'Verify and Sign In');
            }
        };

        // Replace event listener for MFA flow
        this.elements.verifyCodeButton?.removeEventListener('click', this.handleVerifyPhoneCode);
        this.elements.verifyCodeButton?.addEventListener('click', verifyMFACode);
    }

    /**
     * Handle Google sign in
     */
    async handleGoogleSignIn() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        this.setLoadingState(this.elements.googleSigninButton, true, 'Sign in with Google');

        try {
            await signInWithPopup(this.auth, this.googleProvider);
            this.showMessage('Google sign-in successful! Redirecting...', false);
            this.handleSuccess();
            
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showMessage(getFriendlyAuthError(error));
            }
        } finally {
            this.setLoadingState(this.elements.googleSigninButton, false, 'Sign in with Google');
        }
    }

    /**
     * Handle phone code sending
     */
    async handleSendPhoneCode() {
        if (!this.isInitialized) {
            this.showMessage('Please wait for the page to load completely.');
            return;
        }

        const phoneNumber = this.elements.phoneNumberInput?.value.trim();
        
        if (!phoneNumber) {
            this.showMessage('Please enter a valid phone number.');
            return;
        }

        this.setLoadingState(this.elements.sendCodeButton, true, 'Send Verification Code');

        try {
            this.confirmationResult = await signInWithPhoneNumber(this.auth, phoneNumber, this.recaptchaVerifier);
            this.showMessage('Verification code sent to your phone!', false);
            
            // Switch to code verification UI
            this.elements.phoneForm?.classList.add('hidden');
            this.elements.codeForm?.classList.remove('hidden');
            this.uiState.currentFlow = 'phone';
            
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
            
            // Reset reCAPTCHA on failure
            if (this.recaptchaVerifier) {
                try {
                    await this.recaptchaVerifier.render();
                } catch (e) {
                    console.error('[Login Controller] Error resetting reCAPTCHA:', e);
                }
            }
        } finally {
            this.setLoadingState(this.elements.sendCodeButton, false, 'Send Verification Code');
        }
    }

    /**
     * Handle phone code verification
     */
    async handleVerifyPhoneCode() {
        if (!this.confirmationResult) {
            this.showMessage('Please request a verification code first.');
            return;
        }

        const code = this.elements.verificationCodeInput?.value.trim();
        
        if (!code) {
            this.showMessage('Please enter the verification code.');
            return;
        }

        this.setLoadingState(this.elements.verifyCodeButton, true, 'Verify and Sign In');

        try {
            await this.confirmationResult.confirm(code);
            this.showMessage('Phone verification successful! Redirecting...', false);
            this.handleSuccess();
            
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
        } finally {
            this.setLoadingState(this.elements.verifyCodeButton, false, 'Verify and Sign In');
        }
    }

    /**
     * Handle forgot password
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
            await sendPasswordResetEmail(this.auth, email);
            this.showMessage('Password reset email sent! Please check your inbox and spam folder.', false);
        } catch (error) {
            this.showMessage(getFriendlyAuthError(error));
        }
    }

    /**
     * Handle sign up redirect
     */
    handleSignUpRedirect() {
        window.location.href = 'signup.html';
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
            window.location.href = 'dashboard.html';
        }, 1500);
    }
}

// Initialize login controller when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const loginController = new LoginPageController();
    await loginController.initialize();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle initialization
} else {
    // DOM is already loaded
    const loginController = new LoginPageController();
    await loginController.initialize();
}