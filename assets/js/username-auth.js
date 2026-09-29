/**
 * Client helpers for email-or-username login and signup username claims.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const USERNAME_RE = /^[a-z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailIdentifier(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

export function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

/** @returns {string|null} error message, or null if valid */
export function usernameFormatError(raw) {
  const key = normalizeUsername(raw);
  if (!key || key.length < USERNAME_MIN || key.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(key)) {
    return "Username can only use letters, numbers, and underscores.";
  }
  return null;
}

async function getCallable(name) {
  const { getFunctions, httpsCallable } = await import(
    "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js"
  );
  const functions = getFunctions();
  return httpsCallable(functions, name);
}

function cleanFirebaseMessage(msg) {
  return String(msg || "")
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "");
}

function mapResolveLookupError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (code.includes("not-found") || /no account/i.test(msg)) {
    return new Error("No account found for that username.");
  }
  if (code.includes("invalid-argument")) {
    return new Error("Enter a valid email address or username.");
  }
  return new Error(cleanFirebaseMessage(msg) || "Unable to look up that username.");
}

async function lookupUsernameEmail(raw) {
  const fn = await getCallable("resolveLoginIdentifier");
  const res = await fn({ identifier: raw });
  const email = res?.data?.email;
  if (!email) throw new Error("No account found for that username.");
  return String(email).toLowerCase();
}

/**
 * Resolve login field (email or username) to a Firebase Auth email.
 */
export async function resolveLoginEmail(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) throw new Error("Enter an email or username.");
  if (isEmailIdentifier(raw)) return raw.toLowerCase();
  if (usernameFormatError(raw)) {
    throw new Error("Enter a valid email address or username.");
  }
  try {
    return await lookupUsernameEmail(raw);
  } catch (err) {
    throw mapResolveLookupError(err);
  }
}

export async function claimUsername(username) {
  const formatErr = usernameFormatError(username);
  if (formatErr) throw new Error(formatErr);
  const fn = await getCallable("claimUsername");
  const res = await fn({ username: normalizeUsername(username) });
  return res?.data?.username || normalizeUsername(username);
}

export async function checkUsernameAvailable(username) {
  const formatErr = usernameFormatError(username);
  if (formatErr) return { available: false, error: formatErr };
  try {
    const fn = await getCallable("checkUsernameAvailable");
    const res = await fn({ username: normalizeUsername(username) });
    return {
      available: !!res?.data?.available,
      username: res?.data?.username || normalizeUsername(username),
      error: res?.data?.available ? null : "That username is already taken.",
    };
  } catch (err) {
    return { available: false, error: err?.message || "Unable to check username." };
  }
}
