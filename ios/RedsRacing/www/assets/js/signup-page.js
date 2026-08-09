import "./app.js";
import { getFirebaseAuth, getFirebaseApp, getFirebaseDb } from "./firebase-core.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  processInvitationCode,
  captureInvitationCodeFromURL,
} from "./invitation-codes.js";
import { getFriendlyAuthError } from "./auth-errors.js";

function safeReturnTo() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const raw = params.get("returnTo") || "";
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    // Only allow same-origin relative paths
    if (!decoded || decoded.startsWith("http") || decoded.startsWith("//") || decoded.includes("..")) {
      return null;
    }
    if (decoded.includes("signup.html") || decoded.includes("login.html")) return null;
    return decoded.startsWith("/") ? decoded : `/${decoded.replace(/^\.\//, "")}`;
  } catch {
    return null;
  }
}

function redirectAfterSignup(role) {
  const returnTo = safeReturnTo();
  if (returnTo) {
    window.location.replace(returnTo);
    return;
  }
  if (role === "admin") {
    window.location.replace("/admin/index.html");
    return;
  }
  if (role === "team-member") {
    window.location.replace("/crew/dashboard.html");
    return;
  }
  // Fans land on profile (stable) — fan hub also works, but profile avoids auth races
  window.location.replace("/profile.html");
}

async function createDefaultProfile(user, signupRole = "fan", assignedRole = null) {
  try {
    const db = getFirebaseDb();
    const profileRef = doc(db, "users", user.uid);
    const roleLabels = { fan: "Racing Fan", racer: "Racer", crew: "Crew Member" };
    const defaultProfile = {
      username: (user.email || "fan").split("@")[0],
      displayName: user.displayName || (user.email || "fan").split("@")[0],
      bio: "New member of the RedsRacing community!",
      avatarUrl: user.photoURL || "",
      favoriteCars: [],
      joinDate: new Date().toISOString(),
      createdAt: new Date(),
      totalPoints: 0,
      achievementCount: 0,
      signupRole: signupRole,
      signupRoleLabel: roleLabels[signupRole] || "Racing Fan",
    };
    // Only set role when invite/claims already assigned one — never clobber admin/team
    if (assignedRole) {
      defaultProfile.role = assignedRole;
    } else if (signupRole === "fan") {
      defaultProfile.role = "public-fan";
    }
    await setDoc(profileRef, defaultProfile, { merge: true });
  } catch (error) {
    console.warn("[SIGNUP] Profile bootstrap failed (non-blocking):", error?.message || error);
  }
}

async function assignFollowerRole(user) {
  try {
    const { getFunctions, httpsCallable } = await import(
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js"
    );
    const f = getFunctions(getFirebaseApp());
    const setFollowerRole = httpsCallable(f, "setFollowerRole");
    const out = await setFollowerRole();
    try {
      await user.getIdToken(true);
    } catch (_) {}
    return out?.data?.role || "TeamRedFollower";
  } catch (e) {
    console.warn("setFollowerRole failed (continuing without blocking):", e?.message || e);
    return null;
  }
}

/**
 * @param {import('firebase/auth').User} user
 * @param {string} inviteCode
 * @param {{ requireInvite?: boolean }} opts
 */
async function applyInviteOrFollowerRole(user, inviteCode, opts = {}) {
  const requireInvite = !!opts.requireInvite;
  try {
    const existing = await user.getIdTokenResult();
    const current = existing?.claims?.role;
    if (current === "admin" || current === "team-member") {
      return current;
    }
  } catch (_) {}
  if (inviteCode && inviteCode.trim()) {
    try {
      const result = await processInvitationCode(inviteCode.trim(), user.uid);
      if (result?.status === "success") {
        try {
          await user.getIdToken(true);
        } catch (_) {}
        if (result.role) return result.role;
        try {
          const tok = await user.getIdTokenResult();
          if (tok?.claims?.role) return tok.claims.role;
        } catch (_) {}
        return "public-fan";
      }
      const msg = result?.message || "Invalid invitation code.";
      if (requireInvite) throw new Error(msg);
      console.warn("[SIGNUP] Optional invite rejected, continuing as fan:", msg);
    } catch (e) {
      if (requireInvite) throw e;
      console.warn("[SIGNUP] Optional invite failed, continuing as fan:", e?.message || e);
    }
  }
  return assignFollowerRole(user);
}

export async function handleSignup(email, password, inviteCode, signupRole = "fan") {
  const auth = getFirebaseAuth();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const requireInvite = signupRole === "racer" || signupRole === "crew";

  let assignedRole = null;
  try {
    assignedRole = await applyInviteOrFollowerRole(user, inviteCode, { requireInvite });
  } catch (e) {
    // Account already created — keep a clear invite error for team roles
    const err = new Error(
      (e?.message || "Invite code failed") +
        " Your account was created — sign in, then ask an admin for a fresh code.",
    );
    err.code = e?.code || "invite-failed";
    throw err;
  }

  try {
    await user.getIdToken(true);
  } catch (_) {}

  await createDefaultProfile(user, signupRole, assignedRole);

  try {
    await sendEmailVerification(user);
  } catch (_) {}

  return { user, assignedRole };
}

async function finishAuthSession(user, teamRole) {
  try {
    await user.getIdToken(true);
  } catch (_) {}
  let role = null;
  try {
    const tokenResult = await user.getIdTokenResult();
    role = tokenResult?.claims?.role || null;
  } catch (_) {}

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

  redirectAfterSignup(role);
}

function showSignupError(el, error) {
  if (!el) return;
  const friendly = getFriendlyAuthError?.(error);
  const msg =
    friendly?.userMessage ||
    error?.message ||
    (typeof error === "string" ? error : "") ||
    "Signup failed. Please try again.";
  el.textContent = msg;
  el.style.color = "#f87171";
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SIGNUP] DOM loaded, initializing signup form...");
  const signupForm = document.getElementById("signup-form");
  const signupError = document.getElementById("signup-error");
  const inviteCodeInput = document.getElementById("invite-code");
  const inviteCodeHelp = document.getElementById("invite-code-help");
  const teamRoleInputs = document.querySelectorAll('input[name="team-role"]');
  const googleBtn = document.getElementById("google-signin-button");

  // Default select Racing Fan if nothing chosen
  const fanRadio = document.querySelector('input[name="team-role"][value="fan"]');
  if (fanRadio && !document.querySelector('input[name="team-role"]:checked')) {
    fanRadio.checked = true;
  }

  if (!signupForm) {
    console.error("[SIGNUP] Form element not found!");
    return;
  }
  console.log("[SIGNUP] Form element found, setting up listeners...");

  teamRoleInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const role = e.target.value;
      if (role === "racer" || role === "crew") {
        if (inviteCodeHelp) inviteCodeHelp.classList.remove("hidden");
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = "Invite Code (required)";
          inviteCodeInput.classList.add("border-yellow-400");
          inviteCodeInput.required = true;
        }
      } else {
        if (inviteCodeHelp) inviteCodeHelp.classList.add("hidden");
        if (inviteCodeInput) {
          inviteCodeInput.placeholder = "Invite Code (optional — use for admin/team)";
          inviteCodeInput.classList.remove("border-yellow-400");
          inviteCodeInput.required = false;
        }
      }
    });
  });

  console.log("[SIGNUP] Attaching submit listener to form...");
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("[SIGNUP] Form submitted!");
    if (signupError) signupError.textContent = "";

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Create Account";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Creating Account...';
    }

    const email = (signupForm.email?.value || "").trim();
    const password = signupForm.password?.value || "";
    const inviteCode = (signupForm["invite-code"]?.value || "").trim();
    const teamRole =
      signupForm["team-role"]?.value ||
      document.querySelector('input[name="team-role"]:checked')?.value ||
      "fan";

    console.log("[SIGNUP] Form data:", { email, teamRole, hasInviteCode: !!inviteCode });

    try {
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if ((teamRole === "racer" || teamRole === "crew") && !inviteCode) {
        throw new Error(
          'Invite code is required for Racer and Crew Member roles. Choose "Racing Fan" to sign up without a code.',
        );
      }

      console.log("[SIGNUP] Calling handleSignup...");
      const { user } = await handleSignup(email, password, inviteCode, teamRole);
      console.log("[SIGNUP] Signup successful!", user.uid);
      await finishAuthSession(user, teamRole);
    } catch (error) {
      console.error("[SIGNUP] Signup failed:", error);
      showSignupError(signupError, error);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });

  if (googleBtn && !googleBtn.dataset.bound) {
    googleBtn.dataset.bound = "1";
    googleBtn.addEventListener("click", async () => {
      if (signupError) signupError.textContent = "";
      googleBtn.disabled = true;
      try {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        const user = cred.user;
        const inviteCode = (inviteCodeInput?.value || "").trim();
        const teamRole =
          document.querySelector('input[name="team-role"]:checked')?.value || "fan";

        const requireInvite = teamRole === "racer" || teamRole === "crew";
        const assignedRole = await applyInviteOrFollowerRole(user, inviteCode, {
          requireInvite,
        });
        await createDefaultProfile(user, teamRole, assignedRole);
        await finishAuthSession(user, teamRole);
      } catch (error) {
        if (error?.code !== "auth/popup-closed-by-user") {
          console.error("[SIGNUP] Google sign-in failed:", error);
          showSignupError(signupError, error);
        }
        googleBtn.disabled = false;
      }
    });
  }

  const capturedCode = captureInvitationCodeFromURL();
  if (capturedCode && inviteCodeInput) {
    inviteCodeInput.value = capturedCode;
  }
});
