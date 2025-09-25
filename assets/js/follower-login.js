import './app.js';
import { getFirebaseAuth } from './firebase-core.js';
import { getFriendlyAuthError } from './auth-errors.js';
import { navigateToInternal } from './navigation-helpers.js';
import { validateUserClaims, safeSignOut } from './auth-utils.js';
import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

document.addEventListener('DOMContentLoaded', () => {
    const auth = getFirebaseAuth();
    const googleProvider = new GoogleAuthProvider();

    // DOM Elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const signinButton = document.getElementById('signin-button');
    const googleSigninButton = document.getElementById('google-signin-button');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');

    const showMessage = (message, isError = true) => {
        if (!errorText || !errorBox) return;
        errorText.textContent = message;
        errorBox.className = isError
            ? 'error-message p-4 rounded-md mb-4'
            : 'bg-green-800 text-green-300 border-l-4 border-green-500 p-4 rounded-md mb-4';
        errorBox.classList.remove('hidden');
    };

    const hideMessage = () => {
        if (errorBox) {
            errorBox.classList.add('hidden');
        }
    };

    const setLoadingState = (button, isLoading, originalText) => {
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.textContent = 'Processing...';
            button.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            button.disabled = false;
            button.textContent = originalText;
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    };

    const handleSuccess = async () => {
        showMessage('Login successful! Verifying permissions...', false);

        const claimsResult = await validateUserClaims(['TeamRedFollower']);

        if (claimsResult.success) {
            // Role is valid, redirect to follower dashboard
            setTimeout(() => {
                navigateToInternal('/follower-dashboard.html');
            }, 1500);
        } else {
            // Sign out user immediately if they don't have the right role.
            await safeSignOut();

            // Role is not valid or another error occurred
            if (claimsResult.error && claimsResult.error.message.includes('Insufficient permissions')) {
                showMessage('You do not have permission to access the follower dashboard. Please use the team member login if you are a team member.');
            } else {
                // Fallback for other errors
                showMessage('Could not verify your permissions. Please try again.');
            }
        }
    };

    const handleEmailSignIn = async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        hideMessage();

        if (!email || !password) {
            showMessage('Please fill in all required fields.');
            return;
        }

        setLoadingState(signinButton, true, 'Sign In');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            await handleSuccess();
        } catch (error) {
            showMessage(getFriendlyAuthError(error));
        } finally {
            // Only reset loading state if not redirecting
            if (!document.querySelector('.bg-green-800')) {
                 setLoadingState(signinButton, false, 'Sign In');
            }
        }
    };

    const handleGoogleSignIn = async () => {
        hideMessage();
        setLoadingState(googleSigninButton, true, 'Sign in with Google');

        try {
            await signInWithPopup(auth, googleProvider);
            await handleSuccess();
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                showMessage(getFriendlyAuthError(error));
            }
        } finally {
            if (!document.querySelector('.bg-green-800')) {
                 setLoadingState(googleSigninButton, false, 'Sign in with Google');
            }
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            showMessage("Please enter your email address above, then click 'Forgot password?'.");
            emailInput.focus();
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showMessage('Password reset email sent! Please check your inbox.', false);
        } catch (error) {
            showMessage(getFriendlyAuthError(error));
        }
    };

    // Event Listeners
    if(signinButton) signinButton.addEventListener('click', handleEmailSignIn);
    if(googleSigninButton) googleSigninButton.addEventListener('click', handleGoogleSignIn);
    if(forgotPasswordLink) forgotPasswordLink.addEventListener('click', handleForgotPassword);
    if(emailInput) emailInput.addEventListener('input', hideMessage);
    if(passwordInput) passwordInput.addEventListener('input', hideMessage);
});