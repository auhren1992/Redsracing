import "./app.js";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-core.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  processInvitationCode,
  captureInvitationCodeFromURL,
} from "./invitation-codes.js";
import {
  checkUsernameAvailable,
  claimUsername,
  normalizeUsername,
  usernameFormatError,
} from "./username-auth.js";

async function createDefaultProfile(user, signupRole = "fan", username = "") {
  try {
    const db = getFirebaseDb();
    const profileRef = doc(db, "users", user.uid);
    const roleLabels = { fan: "Racing Fan", racer: "Racer", crew: "Crew Member" };
    const handle = username || user.email.split("@")[0];
    const defaultProfile = {
      username: handle,
      displayName: user.displayName || handle,
      bio: "New member of the RedsRacing community!",
      avatarUrl: user.photoURL || "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
      createdAt: new Date(),
      totalPoints: 0,
      achievementCount: 0,
      role: "public-fan",
      signupRole: signupRole,
      signupRoleLabel: roleLabels[signupRole] || "Racing Fan",
    };
    await setDoc(profileRef, defaultProfile, { merge: true });
  } catch (error) {
    // Don't fail signup if profile write fails; claimUsername already set username.
  }
}

export async function handleSignup(email, password, inviteCode, signupRole = "fan", username = "") {
  const formatErr = usernameFormatError(username);
  if (formatErr) throw new Error(formatErr);

  const availability = await checkUsernameAvailable(username);
  if (!availability.available) {
    throw new Error(availability.error || "That username is already taken.");
  }

  const auth = getFirebaseAuth();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const claimed = normalizeUsername(username);

  try {
    if (inviteCode && inviteCode.trim()) {
      try {
        await processInvitationCode(inviteCode.trim(), user.uid);
      } catch (e) {
        console.warn("Invite code processing failed, continuing as follower:", e?.message || e);
      }
    } else {
      try {
        const { getFunctions, httpsCallable } = await import(
          "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js"
        );
        const f = getFunctions();
        const setFollowerRole = httpsCallable(f, "setFollowerRole");
        await setFollowerRole();
        try {
          await user.getIdToken(true);
        } catch (tokenErr) {
          console.warn("Token refresh after setFollowerRole failed:", tokenErr?.message || tokenErr);
          throw new Error("Unable to refresh session after role assignment. Please try again.");
        }
      } catch (e) {
        console.warn("setFollowerRole failed (continuing without blocking):", e?.message || e);
      }
    }

    try {
      await user.getIdToken(true);
    } catch (tokenErr) {
      console.warn("Token refresh before profile write failed:", tokenErr?.message || tokenErr);
      throw new Error("Unable to refresh session. Please try signing up again.");
    }

    try {
      await claimUsername(claimed);
    } catch (claimErr) {
      console.error("Username claim failed after account create:", claimErr);
      throw new Error(
        claimErr?.message ||
          "Account was created but that username could not be claimed. Pick another in Profile settings.",
      );
    }

    await createDefaultProfile(user, signupRole, claimed);

    try {
      await sendEmailVerification(user);
    } catch (_) {}

    return user;
  } catch (error) {
    throw error;
  }
}

function wireUsernameAvailability(usernameInput, helpEl) {
  if (!usernameInput) return;
  let timer = null;
  const runCheck = async () => {
    const raw = usernameInput.value;
    const formatErr = usernameFormatError(raw);
    if (!raw.trim()) {
      if (helpEl) {
        helpEl.textContent =
          "3–20 characters: letters, numbers, underscores. You’ll use this or your email to sign in.";
        helpEl.className = "text-xs text-slate-500 mt-1.5";
      }
      return;
    }
    if (formatErr) {
      if (helpEl) {
        helpEl.textContent = formatErr;
        helpEl.className = "text-xs text-red-400 mt-1.5";
      }
      usernameInput.classList.add("border-red-500");
      return;
    }
    usernameInput.classList.remove("border-red-500");
    if (helpEl) {
      helpEl.textContent = "Checking availability…";
      helpEl.className = "text-xs text-slate-400 mt-1.5";
    }
    const result = await checkUsernameAvailable(raw);
    if (helpEl) {
      if (result.available) {
        helpEl.textContent = `@${result.username} is available`;
        helpEl.className = "text-xs text-emerald-400 mt-1.5";
      } else {
        helpEl.textContent = result.error || "That username is taken.";
        helpEl.className = "text-xs text-red-400 mt-1.5";
      }
    }
  };
  usernameInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(runCheck, 400);
  });
  usernameInput.addEventListener("blur", runCheck);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SIGNUP] DOM loaded, initializing signup form...");
  const signupForm = document.getElementById("signup-form");
  const signupError = document.getElementById("signup-error");
  const inviteCodeInput = document.getElementById("invite-code");
  const inviteCodeHelp = document.getElementById("invite-code-help");
  const usernameInput = document.getElementById("username");
  const usernameHelp = document.getElementById("username-help");
  const teamRoleInputs = document.querySelectorAll('input[name="team-role"]');

  if (!signupForm) {
    console.error("[SIGNUP] Form element not found!");
    return;
  }
  console.log("[SIGNUP] Form element found, setting up listeners...");

  wireUsernameAvailability(usernameInput, usernameHelp);

  teamRoleInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const role = e.target.value;
      if (role === "racer" || role === "crew") {
        if (inviteCodeHelp) inviteCodeHelp.classList.remove("hidden");
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = "Invite Code (required)";
          inviteCodeInput.classList.add("border-yellow-400");
        }
      } else {
        if (inviteCodeHelp) inviteCodeHelp.classList.add("hidden");
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = "Invite Code (optional)";
          inviteCodeInput.classList.remove("border-yellow-400");
        }
      }
    });
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("[SIGNUP] Form submitted!");
    signupError.textContent = "";

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Creating Account...';

    const username = signupForm.username?.value || "";
    const email = signupForm.email.value;
    const password = signupForm.password.value;
    const inviteCode = signupForm["invite-code"].value;
    const teamRole = signupForm["team-role"].value;

    console.log("[SIGNUP] Form data:", {
      email,
      username,
      teamRole,
      hasInviteCode: !!inviteCode,
    });

    if ((teamRole === "racer" || teamRole === "crew") && (!inviteCode || !inviteCode.trim())) {
      signupError.textContent =
        'Invite code is required for Racer and Crew Member roles. Choose "Racing Fan" to sign up without a code.';
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      return;
    }

    try {
      console.log("[SIGNUP] Calling handleSignup...");
      const user = await handleSignup(email, password, inviteCode, teamRole, username);
      console.log("[SIGNUP] Signup successful!", user.uid);

      try {
        await user.getIdToken(true);
        const tokenResult = await user.getIdTokenResult();
        const role = tokenResult?.claims?.role || null;
        console.log("[SIGNUP] User role after signup:", role);

        try {
          localStorage.setItem("rr_signup_role", teamRole || "fan");
        } catch (_) {}
        try {
          localStorage.setItem("rr_auth_uid", user.uid);
        } catch (_) {}
        try {
          if (window.FirebaseAuthBridge) {
            window.FirebaseAuthBridge.storeAuthUid(user.uid);
            if (user.email) window.FirebaseAuthBridge.storeAuthEmail(user.email);
          }
        } catch (_) {}

        if (role === "admin") {
          window.location.href = "/admin/index.html";
        } else if (role === "team-member") {
          window.location.href = "/crew/dashboard.html";
        } else {
          window.location.href = "/follower/index.html";
        }
      } catch (e2) {
        console.warn("[SIGNUP] Could not fetch role claims, defaulting to follower dashboard:", e2);
        window.location.href = "/follower/index.html";
      }
    } catch (error) {
      console.error("[SIGNUP] Signup failed:", error);
      signupError.textContent = error.message || "Signup failed. Please try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  const capturedCode = captureInvitationCodeFromURL();
  if (capturedCode && inviteCodeInput) {
    inviteCodeInput.value = capturedCode;
  }
});
