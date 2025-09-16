import { getFirebaseAuth, initializeFirebaseCore } from '/assets/js/firebase-core.js';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { validateInvitationCode, processInvitationCode, captureInvitationCodeFromURL } from '/assets/js/invitation-codes.js';

export async function handleSignup(email, password, inviteCode) {
    if (!inviteCode) {
        throw new Error("Invitation code is required.");
    }

    try {
        const auth = getFirebaseAuth();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Process invitation code
        await processInvitationCode(inviteCode, user.uid);

        // Send email verification
        await sendEmailVerification(user);

        return user;
    } catch (error) {
        console.error("Signup failed:", error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeFirebaseCore();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        // Optionally, display a message to the user
    }

    const signupForm = document.getElementById('signup-form');
    const signupError = document.getElementById('signup-error');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            signupError.textContent = '';

            const email = signupForm.email.value;
            const password = signupForm.password.value;
            const inviteCode = signupForm['invite-code'].value;

            try {
                await handleSignup(email, password, inviteCode);
                // Redirect to a success page or login page
                window.location.href = '/login.html';
            } catch (error) {
                signupError.textContent = error.message;
            }
        });
    }

    // Capture invite code from URL
    const capturedCode = captureInvitationCodeFromURL();
    if (capturedCode) {
        const inviteCodeInput = document.getElementById('invite-code');
        if (inviteCodeInput) {
            inviteCodeInput.value = capturedCode;
        }
    }
});