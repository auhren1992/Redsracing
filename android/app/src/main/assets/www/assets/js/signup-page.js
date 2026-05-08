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

async function createDefaultProfile(user, signupRole = 'fan') {
  try {
    const db = getFirebaseDb();
    const profileRef = doc(db, "users", user.uid);
    const roleLabels = { fan: 'Racing Fan', racer: 'Racer', crew: 'Crew Member' };
    const defaultProfile = {
      username: user.email.split("@")[0],
      displayName: user.displayName || user.email.split("@")[0],
      bio: "New member of the RedsRacing community!",
      avatarUrl: user.photoURL || "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
      createdAt: new Date(),
      totalPoints: 0,
      achievementCount: 0,
      role: "public-fan",
      signupRole: signupRole,
      signupRoleLabel: roleLabels[signupRole] || 'Racing Fan',
    };
    await setDoc(profileRef, defaultProfile, { merge: true });
  } catch (error) {
    // This error should be logged, but we don't want to fail the whole signup process
  }
}

export async function handleSignup(email, password, inviteCode, signupRole = 'fan') {
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

    // Create a default profile document in Firestore with signup role
    await createDefaultProfile(user, signupRole);

    // Send email verification (best-effort)
    try { await sendEmailVerification(user); } catch(_) {}

    return user;
  } catch (error) {
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log('[SIGNUP] DOM loaded, initializing signup form...');
  const signupForm = document.getElementById("signup-form");
  const signupError = document.getElementById("signup-error");
  const inviteCodeInput = document.getElementById("invite-code");
  const inviteCodeHelp = document.getElementById("invite-code-help");
  const teamRoleInputs = document.querySelectorAll('input[name="team-role"]');
  
  if (!signupForm) {
    console.error('[SIGNUP] Form element not found!');
    return;
  }
  console.log('[SIGNUP] Form element found, setting up listeners...');
  
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
    console.log('[SIGNUP] Attaching submit listener to form...');
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log('[SIGNUP] Form submitted!');
      signupError.textContent = "";
      
      // Show loading state
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Creating Account...';

      const email = signupForm.email.value;
      const password = signupForm.password.value;
      const inviteCode = signupForm["invite-code"].value;
      const teamRole = signupForm["team-role"].value;
      
      console.log('[SIGNUP] Form data:', { email, teamRole, hasInviteCode: !!inviteCode });

      // Validate invite code requirement for team roles
      if ((teamRole === 'racer' || teamRole === 'crew') && (!inviteCode || !inviteCode.trim())) {
        signupError.textContent = 'Invite code is required for Racer and Crew Member roles. Choose "Racing Fan" to sign up without a code.';
        return;
      }

      try {
        console.log('[SIGNUP] Calling handleSignup...');
        const user = await handleSignup(email, password, inviteCode, teamRole);
        console.log('[SIGNUP] Signup successful!', user.uid);
        
        // Refresh token to get latest claims after role assignment
        try {
          await user.getIdToken(true);
          const tokenResult = await user.getIdTokenResult();
          const role = tokenResult?.claims?.role || null;
          console.log('[SIGNUP] User role after signup:', role);
          
          // Cache signup role for theme system
          try { localStorage.setItem('rr_signup_role', teamRole || 'fan'); } catch(_) {}
          try { localStorage.setItem('rr_auth_uid', user.uid); } catch(_) {}
          // Persist auth to Android native storage so it survives app restart
          try {
            if (window.FirebaseAuthBridge) {
              window.FirebaseAuthBridge.storeAuthUid(user.uid);
              if (user.email) window.FirebaseAuthBridge.storeAuthEmail(user.email);
            }
          } catch (_) {}
          // Redirect based on assigned role from claims
          if (role === 'admin') {
            console.log('[SIGNUP] Redirecting to admin console...');
            window.location.href = "/admin-console.html";
          } else if (role === 'team-member') {
            console.log('[SIGNUP] Redirecting to dashboard...');
            window.location.href = "/follower-dashboard.html";
          } else {
            console.log('[SIGNUP] Redirecting to dashboard...');
            window.location.href = "/follower-dashboard.html";
          }
        } catch (e) {
          console.warn('[SIGNUP] Could not fetch role claims, defaulting to follower dashboard:', e);
          window.location.href = "/follower-dashboard.html";
        }
      } catch (error) {
        console.error('[SIGNUP] Signup failed:', error);
        signupError.textContent = error.message || 'Signup failed. Please try again.';
      } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

  // Capture invite code from URL
  const capturedCode = captureInvitationCodeFromURL();
  if (capturedCode && inviteCodeInput) {
    inviteCodeInput.value = capturedCode;
  }
});
