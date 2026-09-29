/**
 * Username claim / resolve helpers for login-by-username.
 * Collection: usernames/{normalizedUsername} -> { uid, email, username, updatedAt }
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-z0-9_]+$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "redsracing",
  "team",
  "crew",
  "system",
  "null",
  "undefined",
  "api",
  "www",
  "login",
  "signup",
  "owner",
]);

function isEmailIdentifier(value) {
  const s = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function validateUsernameFormat(raw) {
  const key = normalizeUsername(raw);
  if (!key || key.length < USERNAME_MIN || key.length > USERNAME_MAX) {
    throw new HttpsError(
      "invalid-argument",
      `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`,
    );
  }
  if (!USERNAME_RE.test(key)) {
    throw new HttpsError(
      "invalid-argument",
      "Username can only use letters, numbers, and underscores.",
    );
  }
  if (RESERVED.has(key)) {
    throw new HttpsError("invalid-argument", "That username is reserved.");
  }
  return key;
}

async function claimUsernameForUser(db, { uid, email, username }) {
  if (!uid) {
    throw new HttpsError("invalid-argument", "Missing user id.");
  }
  const key = validateUsernameFormat(username);
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const unameRef = db.collection("usernames").doc(key);
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const taken = await tx.get(unameRef);
    if (taken.exists && taken.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "That username is already taken.");
    }

    const userSnap = await tx.get(userRef);
    const prevRaw = userSnap.exists ? userSnap.data()?.username || "" : "";
    const prevKey = prevRaw ? normalizeUsername(prevRaw) : "";
    if (prevKey && prevKey !== key) {
      const prevRef = db.collection("usernames").doc(prevKey);
      const prevSnap = await tx.get(prevRef);
      if (prevSnap.exists && prevSnap.data()?.uid === uid) {
        tx.delete(prevRef);
      }
    }

    tx.set(
      unameRef,
      {
        uid,
        email: emailNorm,
        username: key,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(userRef, { username: key }, { merge: true });
  });

  return key;
}

async function emailForUid(db, uid) {
  if (!uid) return "";
  try {
    const { getAuth } = require("firebase-admin/auth");
    const user = await getAuth().getUser(uid);
    return String(user.email || "")
      .trim()
      .toLowerCase();
  } catch (_) {
    return "";
  }
}

/** Legacy profiles may have username without a usernames/ claim — adopt if unique. */
async function resolveFromLegacyUsers(db, key) {
  const snap = await db
    .collection("users")
    .where("username", "==", key)
    .limit(2)
    .get();
  if (snap.size !== 1) return null;
  const doc = snap.docs[0];
  const uid = doc.id;
  let email = String(doc.data()?.email || "")
    .trim()
    .toLowerCase();
  if (!email) email = await emailForUid(db, uid);
  if (!email) return null;
  try {
    await claimUsernameForUser(db, { uid, email, username: key });
  } catch (_) {
    // Another writer won the race; still return email for login.
  }
  return { email, via: "username", username: key };
}

async function resolveIdentifierToEmail(db, identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) {
    throw new HttpsError("invalid-argument", "Enter an email or username.");
  }
  if (isEmailIdentifier(raw)) {
    return { email: raw.toLowerCase(), via: "email" };
  }

  let key;
  try {
    key = validateUsernameFormat(raw);
  } catch (err) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid email address or username.",
    );
  }

  const snap = await db.collection("usernames").doc(key).get();
  if (snap.exists) {
    const email = String(snap.data()?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "This username is not linked to an email. Sign in with email or Google instead.",
      );
    }
    return { email, via: "username", username: key };
  }

  const legacy = await resolveFromLegacyUsers(db, key);
  if (legacy) return legacy;

  throw new HttpsError("not-found", "No account found for that username.");
}

module.exports = {
  isEmailIdentifier,
  normalizeUsername,
  validateUsernameFormat,
  claimUsernameForUser,
  resolveIdentifierToEmail,
  USERNAME_MIN,
  USERNAME_MAX,
};
