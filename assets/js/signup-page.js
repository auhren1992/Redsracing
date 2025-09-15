import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { validateInvitationCode, processInvitationCode, captureInvitationCodeFromURL } from './invitation-codes.js';

export async function handleSignup(email, password, displayName, inviteCode) {
    if (!inviteCode) {
        throw new Error('Invite code required');
    }
    const isValid = await validateInvitationCode(inviteCode);
    if (!isValid) {
        throw new Error('Invalid or expired invite code');
    }
    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName });
    await processInvitationCode(inviteCode, user.uid);
    await sendEmailVerification(user);
    return userCredential;
}

document.addEventListener('DOMContentLoaded', () => {
    const inviteCodeInput = document.getElementById('invitation-code');
    const captured = captureInvitationCodeFromURL();
    if (inviteCodeInput && captured) inviteCodeInput.value = captured;
    const form = document.getElementById('signup-form');
    const errorDiv = document.getElementById('signup-error');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.textContent = "";
        const email = form.email.value.trim();
        const password = form.password.value;
        const displayName = form['display-name'].value.trim();
        const inviteCode = form['invitation-code'].value.trim();
        try {
            await handleSignup(email, password, displayName, inviteCode);
            window.location.href = '/dashboard.html';
        } catch (err) {
            errorDiv.textContent = err.message || "Signup failed.";
        }
    });
});