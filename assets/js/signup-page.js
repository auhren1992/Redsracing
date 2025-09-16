import { getFirebaseAuth, getFirebaseDb } from '/assets/js/firebase-core.js';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { validateInvitationCode, processInvitationCode, captureInvitationCodeFromURL } from '/assets/js/invitation-codes.js';

async function createDefaultProfile(user) {
    try {
        const db = getFirebaseDb();
        const profileRef = doc(db, 'users', user.uid);
        const defaultProfile = {
            username: user.email.split('@')[0],
            displayName: user.displayName || user.email.split('@')[0],
            bio: 'New member of the RedsRacing community!',
            avatarUrl: user.photoURL || '',
            favoriteCars: [],
            joinDate: new Date().toISOString(),
            totalPoints: 0,
            achievementCount: 0
        };
        await setDoc(profileRef, defaultProfile);
        console.log(`[Signup] Default profile created for user: ${user.uid}`);
    } catch (error) {
        console.error("Failed to create default profile:", error);
        // This error should be logged, but we don't want to fail the whole signup process
    }
}

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

        // Create a default profile document in Firestore
        await createDefaultProfile(user);

        // Send email verification
        await sendEmailVerification(user);

        return user;
    } catch (error) {
        console.error("Signup failed:", error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
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