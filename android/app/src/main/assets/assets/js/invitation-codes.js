import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js";
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
} from "./firebase-core.js";

const DEFAULT_PARAM_NAMES = ["invite", "code"];

export function captureInvitationCodeFromURL(
  paramNames = DEFAULT_PARAM_NAMES,
  stripFromUrl = true,
) {
  const urlParams = new URLSearchParams(window.location.search);
  let capturedCode = null;

  for (const name of paramNames) {
    if (urlParams.has(name)) {
      capturedCode = urlParams.get(name);
      if (stripFromUrl) {
        urlParams.delete(name);
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.replaceState({}, "", newUrl);
      }
      break;
    }
  }
  return capturedCode;
}

export async function validateInvitationCode(code) {
  if (!code) {
    return { valid: false, message: "No code provided." };
  }
  // This function would typically call a backend endpoint to validate the code
  // For now, we'll just do a basic client-side check
  if (code.length < 6) {
    return { valid: false, message: "Invalid invitation code." };
  }
  return { valid: true };
}

export async function processInvitationCode(code, uid) {
  if (!code || !uid) {
    throw new Error("Both code and UID are required to process an invitation.");
  }

  try {
    const functions = getFunctions(getFirebaseApp());
    const processCode = httpsCallable(functions, "processInvitationCode");
    const result = await processCode({ code, uid });
    return result.data;
  } catch (error) {
    throw error;
  }
}

export function setPendingInvitationCode(code) {
  if (code) {
    sessionStorage.setItem("pendingInvitationCode", code);
  }
}

export function getPendingInvitationCode() {
  return sessionStorage.getItem("pendingInvitationCode");
}

export function clearPendingInvitationCode() {
  sessionStorage.removeItem("pendingInvitationCode");
}

export async function applyPendingInvitationCode(currentUser) {
  const code = getPendingInvitationCode();
  if (!code || !currentUser) {
    return { success: false, error: "No pending code or user." };
  }

  try {
    const result = await processInvitationCode(code, currentUser.uid);
    if (result.status === "success") {
      clearPendingInvitationCode();
      // Force a token refresh to get the new custom claims
      await currentUser.getIdToken(true);
      return { success: true, role: result.role };
    } else {
      return { success: false, error: result.message, retryable: false };
    }
  } catch (error) {
    return { success: false, error: error.message, retryable: true };
  }
}

export async function userNeedsInvitationCode(currentUser) {
  if (!currentUser) return false;

  const idTokenResult = await currentUser.getIdTokenResult();
  const userRole = idTokenResult.claims.role;

  return !userRole || userRole === "public-fan";
}
