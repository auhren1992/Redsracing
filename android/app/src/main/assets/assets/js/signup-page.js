import "./app.js";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  validateInvitationCode,
  processInvitationCode,
  captureInvitationCodeFromURL,
} from "./invitation-codes.js";

async function createDefaultProfile(user) {
  try {
    const db = getFirebaseDb();
    const profileRef = doc(db, "users", user.uid);
    const defaultProfile = {
      username: user.email.split("@")[0],
      displayName: user.displayName || user.email.split("@")[0],
      bio: "New member of the RedsRacing community!",
      avatarUrl: user.photoURL || "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
      totalPoints: 0,
      achievementCount: 0,
      role: "public-fan",
    };
    await setDoc(profileRef, defaultProfile, { merge: true });
  } catch (error) {
    // This error should be logged, but we don't want to fail the whole signup process
  }
}

export async function handleSignup(email, password, inviteCode) {
  try {
    const auth = getFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // If invite code provided, process it (admin/team code paths)
    if (inviteCode && inviteCode.trim()) {
      try {
        await processInvitationCode(inviteCode.trim(), user.uid);
      } catch (e) {
        // If invite invalid, continue as follower without blocking signup
        console.warn('Invite code processing failed, continuing as follower:', e?.message || e);
      }
    } else {
      // No invite provided: default to follower role via callable
      try {
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js');
        const f = getFunctions();
        const setFollowerRole = httpsCallable(f, 'setFollowerRole');
        await setFollowerRole();
        try { await user.getIdToken(true); } catch(_) {}
      } catch (e) {
        console.warn('setFollowerRole failed (continuing without blocking):', e?.message || e);
      }
    }

    // Ensure auth token is ready before writing to Firestore
    try { await user.getIdToken(true); } catch (_) {}

    // Create a default profile document in Firestore
    await createDefaultProfile(user);

    // Send email verification (best-effort)
    try { await sendEmailVerification(user); } catch(_) {}

    return user;
  } catch (error) {
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const signupError = document.getElementById("signup-error");
  const inviteCodeInput = document.getElementById("invite-code");
  const inviteCodeHelp = document.getElementById("invite-code-help");
  const teamRoleInputs = document.querySelectorAll('input[name="team-role"]');
  
  // Show/hide invite code requirement based on role selection
  teamRoleInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const role = e.target.value;
      if (role === 'racer' || role === 'crew') {
        // Team roles require invite code
        if (inviteCodeHelp) inviteCodeHelp.classList.remove('hidden');
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = 'Invite Code (required)';
          inviteCodeInput.classList.add('border-yellow-400');
        }
      } else {
        // Fan role - invite code optional
        if (inviteCodeHelp) inviteCodeHelp.classList.add('hidden');
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = 'Invite Code (optional)';
          inviteCodeInput.classList.remove('border-yellow-400');
        }
      }
    });
  });

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      signupError.textContent = "";

      const email = signupForm.email.value;
      const password = signupForm.password.value;
      const inviteCode = signupForm["invite-code"].value;
      const teamRole = signupForm["team-role"].value;

      // Validate invite code requirement for team roles
      if ((teamRole === 'racer' || teamRole === 'crew') && (!inviteCode || !inviteCode.trim())) {
        signupError.textContent = 'Invite code is required for Racer and Crew Member roles. Choose "Racing Fan" to sign up without a code.';
        return;
      }

      try {
        const user = await handleSignup(email, password, inviteCode);
        
        // Redirect based on role
        if (teamRole === 'fan' || !inviteCode || !inviteCode.trim()) {
          // Fan/follower - go to follower dashboard
          window.location.href = "/follower-dashboard.html";
        } else {
          // Team member with invite code - go to login to refresh token
          window.location.href = "/login.html";
        }
      } catch (error) {
        signupError.textContent = error.message;
      }
    });
  }

  // Capture invite code from URL
  const capturedCode = captureInvitationCodeFromURL();
  if (capturedCode && inviteCodeInput) {
    inviteCodeInput.value = capturedCode;
  }
});
