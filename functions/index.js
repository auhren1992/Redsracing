/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/document");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const Sentry = require("@sentry/node");
let __dsn = process.env.SENTRY_DSN;
try {
  if (!__dsn) {
    const cfg = require("firebase-functions").config?.() || {};
    __dsn = cfg?.sentry?.dsn || undefined;
  }
} catch {}
Sentry.init({ dsn: __dsn, tracesSampleRate: 0.1 });
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const vision = require("@google-cloud/vision");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin SDK
initializeApp({ storageBucket: "redsracing-a7f8b.firebasestorage.app" });

/**
 * Processes an invitation code upon user signup.
 *
 * This function is triggered when a new user signs up and provides an
 * invitation code. It validates the code and assigns a custom user role
 * based on the code's type.
 *
 * @param {object} data The data passed to the function.
 * @param {string} data.code The invitation code provided by the user.
 * @param {string} data.uid The UID of the user who signed up.
 * @returns {Promise<object>} A promise that resolves with the result of the operation.
 */
exports.processInvitationCode = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  // Check if the user is authenticated.
  // While the rules on the function should prevent this, it's a good failsafe.
  if (!request.auth) {
    logger.error("processInvitationCode called by unauthenticated user.");
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to use an invitation code.",
    );
  }

  const { code, uid } = request.data;
  logger.info(`Processing invitation code '${code}' for user ${uid}`);

  if (!code || !uid) {
    logger.error("Missing code or UID for processInvitationCode.", {
      code,
      uid,
    });
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a 'code' and 'uid'.",
    );
  }

  // Security check: Enforce that users can only use codes for themselves
  if (uid !== request.auth.uid) {
    logger.error(
      `User ${request.auth.uid} attempted to use invitation code for user ${uid}.`,
    );
    throw new HttpsError(
      "permission-denied",
      "You can only use invitation codes for your own account.",
    );
  }

  const db = getFirestore();
  const auth = getAuth();
  const codesRef = db.collection("invitation_codes");

  try {
    // 1. Find the invitation code document by its ID
    const codeDocRef = codesRef.doc(code);
    const codeDoc = await codeDocRef.get();

    if (!codeDoc.exists) {
      logger.warn(`Invitation code '${code}' not found for user ${uid}.`);
      // Grant a default role if the code is invalid, to avoid confusion.
      await auth.setCustomUserClaims(uid, { role: "public-fan" });
      return { status: "error", message: "Invalid invitation code." };
    }
    const codeData = codeDoc.data();

    if (!codeData.role) {
      logger.info(
        `Invitation code '${code}' is missing a role. Defaulting to 'public-fan' and updating the document.`,
      );
      await codeDoc.ref.update({ role: "public-fan" });
      codeData.role = "public-fan"; // Update the local copy as well
    }

    // 2. Check if the code is still valid (not expired and not already used)
    const now = new Date();
    if (codeData.expiresAt && codeData.expiresAt.toDate() < now) {
      logger.warn(`Expired invitation code '${code}' used by ${uid}.`);
      return { status: "error", message: "This invitation code has expired." };
    }

    if (codeData.used === true) {
      logger.warn(
        `Already used invitation code '${code}' attempted by ${uid}.`,
      );
      return {
        status: "error",
        message: "This invitation code has already been used.",
      };
    }

    // 3. Assign the custom role to the user
    const roleToAssign = codeData.role; // No more fallback
    logger.info(`Assigning role '${roleToAssign}' to user ${uid}.`);
    await auth.setCustomUserClaims(uid, { role: roleToAssign });

    // 4. Mark the invitation code as used with tracking information
    await codeDoc.ref.update({
      used: true,
      usedBy: uid,
      usedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Marked invitation code '${code}' as used by ${uid}.`);

    // 5. Update user's public profile with the new role
    // This is useful for client-side checks without needing to refresh the ID token
    await db.collection("users").doc(uid).set(
      {
        role: roleToAssign,
      },
      { merge: true },
    );
    logger.info(
      `Set role '${roleToAssign}' in user's public profile (users/${uid}).`,
    );

    // 6. Award the "Community Member" achievement to get them on the leaderboard
    const achievementData = {
      userId: uid,
      achievementId: "community_member", // This is a default achievement
      dateEarned: FieldValue.serverTimestamp(),
      assignedBy: "system",
    };
    await db.collection("user_achievements").add(achievementData);
    logger.info(`Awarded 'community_member' achievement to user ${uid}.`);

    return {
      status: "success",
      message: `Role '${roleToAssign}' assigned successfully.`,
    };
  } catch (error) {
    logger.error(`Error processing invitation code for user ${uid}:`, error);
    try { Sentry.captureException(error); } catch (_) {}
    throw new HttpsError(
      "internal",
      "An internal error occurred while processing the code.",
      error,
    );
  }
});

/**
 * Analyzes an image uploaded to Cloud Storage and generates descriptive tags.
 *
 * This function is triggered when a new image is finalized in the
 * 'gallery/' path of the default Cloud Storage bucket. It uses the
 * Google Cloud Vision API to detect labels in the image and saves these
 * tags back to a corresponding Firestore document.
 *
 * @param {object} object The Cloud Storage object that triggered the function.
 */
exports.generateTags = onObjectFinalized(
  {
    region: "us-central1", // Explicitly specify the function's region
  bucket: "redsracing-a7f8b.firebasestorage.app", // Use the Firebase Storage bucket for this project
    cpu: 2, // Allocate more CPU
    memory: "1GiB", // Allocate more memory
    timeoutSeconds: 300, // Extend timeout
    secrets: ["SENTRY_DSN"], // Add secret access
  },
  async (event) => {
    const fileBucket = event.data.bucket; // The Storage bucket that contains the file.
    const filePath = event.data.name; // File path in the bucket.
    const contentType = event.data.contentType; // File content type.

    logger.info(`New image uploaded: ${filePath} in bucket: ${fileBucket}`);

    // Defensive checks for contentType and filePath
    if (!contentType || !filePath) {
      logger.error("Missing contentType or filePath in event data");
      return;
    }

    // Exit if this is triggered on a file that isn't an image.
    if (!contentType.startsWith("image/")) {
      return logger.log("This is not an image.");
    }
    // Exit if the image is not in the 'gallery/' folder.
    if (!filePath.startsWith("gallery/")) {
      return logger.log("This is not a gallery image, skipping.");
    }

    // Initialize Vision API client
    const visionClient = new vision.ImageAnnotatorClient();
    const db = getFirestore();

    // Construct the GCS URI for the Vision API
    const gcsUri = `gs://${fileBucket}/${filePath}`;
    logger.info(`Analyzing image with Vision API: ${gcsUri}`);

    try {
      // Perform label detection on the image file
      const [result] = await visionClient.labelDetection(gcsUri);
      const labels = result.labelAnnotations;

      if (!labels || labels.length === 0) {
        logger.warn(`No labels found for image ${filePath}.`);
        return;
      }

      // Extract the descriptions of the labels and create compact visionLabels array
      const tags = labels.map((label) => label.description.toLowerCase());
      const visionLabels = labels.slice(0, 10).map((label) => ({
        description: label.description,
        score: label.score,
      }));
      logger.info(`Generated tags for ${filePath}:`, tags);

      // Find the corresponding Firestore document to update using improved URL matching.
      // We construct both variants of the download URL to handle token scenarios.
      const storage = getStorage();

      // Get file metadata to obtain firebaseStorageDownloadTokens
      let downloadToken = null;
      try {
        const file = storage.bucket(fileBucket).file(filePath);
        const [metadata] = await file.getMetadata();
        downloadToken =
          metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens;
      } catch (metadataError) {
        logger.warn(`Could not fetch metadata for ${filePath}:`, metadataError);
      }

      // Build candidate URLs for both googleapis and firebasestorage.app domains
      const candidateUrls = [];

      // googleapis domain URLs
      const googleapisBaseUrl = `https://firebasestorage.googleapis.com/v0/b/${fileBucket}/o/${encodeURIComponent(filePath)}?alt=media`;
      candidateUrls.push(googleapisBaseUrl);
      if (downloadToken) {
        candidateUrls.push(`${googleapisBaseUrl}&token=${downloadToken}`);
      }

    // firebasestorage.app domain URLs (support both legacy appspot.com bucket IDs and new firebasestorage.app IDs)
    let appDomainHost;
    if (/\.appspot\.com$/.test(fileBucket)) {
      const prefix = fileBucket.replace(/\.appspot\.com$/, '');
      appDomainHost = `${prefix}.firebasestorage.app`;
    } else if (/\.firebasestorage\.app$/.test(fileBucket)) {
      appDomainHost = fileBucket; // Already a full host
    } else {
      appDomainHost = fileBucket; // Fallback
    }
    const appDomainBaseUrl = `https://${appDomainHost}/o/${encodeURIComponent(filePath)}?alt=media`;
    candidateUrls.push(appDomainBaseUrl);
    if (downloadToken) {
      candidateUrls.push(`${appDomainBaseUrl}&token=${downloadToken}`);
    }

      const galleryRef = db.collection("gallery_images");
      let imageDoc = null;
      let matchedUrl = null;

      // Try to find the document by iterating through all candidate URLs
      for (const url of candidateUrls) {
        const query = galleryRef.where("imageUrl", "==", url).limit(1);
        const querySnapshot = await query.get();
        if (!querySnapshot.empty) {
          imageDoc = querySnapshot.docs[0];
          matchedUrl = url;
          logger.info(`Found Firestore document using URL: ${url}`);
          break;
        }
      }

      if (!imageDoc) {
        logger.error(
          `No Firestore document found for image. Attempted URLs: ${candidateUrls.join(", ")}`,
        );
        return;
      }

      // Update the found document with the generated tags and compact vision data
      await imageDoc.ref.update({
        tags: tags,
        visionLabels: visionLabels, // Store compact array instead of full API response
        processedAt: FieldValue.serverTimestamp(),
        processed: true,
      });

      logger.info(
        `Successfully updated Firestore document ${imageDoc.id} with tags.`,
      );
    } catch (error) {
      logger.error(`Failed to analyze image ${filePath}. Error:`, error);
      try { Sentry.captureException(error); } catch (_) {}
      // Optionally, update the Firestore doc with an error state
      // This helps in debugging and re-triggering failed jobs.
    }
  },
);

/**
 * Fetches a user's profile data.
 *
 * This function is designed to be called from the client-side to retrieve
 * public profile information for any user. It requires authentication to prevent
 * abuse.
 *
 * @param {object} data The data passed to the function.
 * @param {string} data.userId The UID of the user profile to fetch.
 * @returns {Promise<object>} A promise that resolves with the user's profile data.
 */
exports.getProfile = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    logger.error("getProfile called by unauthenticated user.");
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to view profiles.",
    );
  }

  const { userId } = request.data;
  if (!userId) {
    logger.error("getProfile called without a userId.");
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a 'userId'.",
    );
  }

  logger.info(`Fetching profile for user ${userId}`);
  const db = getFirestore();

  try {
    const userDocRef = db.collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.warn(`Profile for user ${userId} not found.`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    return userDoc.data();
  } catch (error) {
    logger.error(`Error fetching profile for user ${userId}:`, error);
    try { Sentry.captureException(error); } catch (_) {}
    if (error.code === "not-found") {
      throw error; // Re-throw HttpsError
    }
    throw new HttpsError(
      "internal",
      "An internal error occurred while fetching the profile.",
      error,
    );
  }
});


// Assign default role based on configured admin email vs everyone else
exports.ensureDefaultRole = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    logger.error("ensureDefaultRole called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  try {
    // Read admin email from config or env
    let ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    try {
      const cfg = require("firebase-functions").config?.() || {};
      ADMIN_EMAIL = cfg?.admin?.email || ADMIN_EMAIL;
    } catch {}
    // Final fallback to hardcoded admin email if config/env missing
    if (!ADMIN_EMAIL) ADMIN_EMAIL = "auhren1992@gmail.com";
    if (typeof ADMIN_EMAIL === 'string') ADMIN_EMAIL = ADMIN_EMAIL.trim().toLowerCase();

    const auth = getAuth();
    const db = getFirestore();

    const uid = request.auth.uid;
    // Prefer token email, but fall back to fetching user record
    let email = request.auth.token?.email || "";
    if (!email) {
      try {
        const u = await auth.getUser(uid);
        email = u?.email || "";
      } catch (_) {}
    }
    if (typeof email === 'string') email = email.trim().toLowerCase();

    let roleToAssign = "public-fan";
    if (ADMIN_EMAIL && email && email === ADMIN_EMAIL) {
      roleToAssign = "admin";
    }

    await auth.setCustomUserClaims(uid, { role: roleToAssign });
    await db.collection("users").doc(uid).set({ role: roleToAssign }, { merge: true });

    logger.info(`ensureDefaultRole: adminEmail='${ADMIN_EMAIL}', userEmail='${email}', set role '${roleToAssign}' for user ${uid}.`);
    return { status: "success", role: roleToAssign, adminEmail: ADMIN_EMAIL, userEmail: email };
  } catch (error) {
    logger.error("ensureDefaultRole failed", error);
    try { Sentry.captureException(error); } catch(_) {}
    throw new HttpsError("internal", "Failed to set default role.");
  }
});

// Fetch K1 Addison Junior League row for Jonny/Jonathon/Jonathan Kirsch (best-effort parser)
exports.fetchK1AddisonJonny = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  try {
    const url = 'https://www.k1speed.com/addison-junior-league-results.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    // Normalize whitespace
    const text = html.replace(/\s+/g, ' ');
    // Capture the row for "Jonny|Jonathon|Jonathan Kirsch": a sequence of numbers (GP) then a total
    const rx = /(Jonny|Jonathon|Jonathan)\s+Kirsch\s+((?:\d+\s+){1,24})(\d{1,4})(?!\s*\d)/i;
    const m = text.match(rx);
    if (!m) {
      return res.status(200).json({ ok: false, message: 'Row for Jonny/Jonathon/Jonathan Kirsch not found' });
    }
    const nums = m[2].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(Number.isFinite);
    const total = parseInt(m[3], 10);
    res.status(200).json({ ok: true, season: 2025, gpPoints: nums, total, matchedName: m[1] + ' Kirsch' });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch K1 page' });
  }
});

/**
 * Creates or updates a user's profile data.
 *
 * This function allows a user to update their own profile information.
 * It ensures that users can only modify their own data.
 *
 * @param {object} data The data passed to the function.
 * @param {string} data.userId The UID of the user profile to update.
 * @param {object} data.profileData The new profile data.
 * @returns {Promise<object>} A promise that resolves with the result of the operation.
 */
exports.updateProfile = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    logger.error("updateProfile called by unauthenticated user.");
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to update your profile.",
    );
  }

  const { userId, profileData } = request.data;
  const callerUid = request.auth.uid;

  if (!userId || !profileData) {
    logger.error("updateProfile called with missing data.", {
      userId,
      profileData,
    });
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with 'userId' and 'profileData'.",
    );
  }

  // Security check: Ensure users can only update their own profile
  if (userId !== callerUid) {
    logger.error(
      `User ${callerUid} attempted to update profile of user ${userId}.`,
    );
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to update this profile.",
    );
  }

  logger.info(`Updating profile for user ${userId}`);
  const db = getFirestore();

  try {
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.set(profileData, { merge: true }); // Use merge to avoid overwriting fields
    logger.info(`Profile for user ${userId} updated successfully.`);
    return { status: "success", message: "Profile updated successfully." };
  } catch (error) {
    logger.error(`Error updating profile for user ${userId}:`, error);
    throw new HttpsError(
      "internal",
      "An internal error occurred while updating the profile.",
      error,
    );
  }
});

/**
 * Gets invitation codes for team member administration.
 *
 * This function allows team members to view all invitation codes
 * and their usage status for administrative purposes.
 *
 * @returns {Promise<object>} A promise that resolves with the codes data.
 */
exports.getInvitationCodes = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  // Check if the user is authenticated
  if (!request.auth) {
    logger.error("getInvitationCodes called by unauthenticated user.");
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to view invitation codes.",
    );
  }

  // Check if the user has team-member role
  const userRole = request.auth.token.role;
  if (userRole !== "team-member") {
    logger.error(
      `getInvitationCodes called by user ${request.auth.uid} with role '${userRole}'.`,
    );
    throw new HttpsError(
      "permission-denied",
      "You must be a team member to view invitation codes.",
    );
  }

  logger.info(`Getting invitation codes for team member ${request.auth.uid}`);
  const db = getFirestore();

  try {
    const codesRef = db.collection("invitation_codes");
    const snapshot = await codesRef.get();

    const codes = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      codes.push({
        id: doc.id,
        role: data.role,
        used: data.used || false,
        usedBy: data.usedBy || null,
        usedAt: data.usedAt || null,
        expiresAt: data.expiresAt || null,
      });
    });

    logger.info(
      `Retrieved ${codes.length} invitation codes for team member ${request.auth.uid}`,
    );
    return { status: "success", codes: codes };
  } catch (error) {
    logger.error(
      `Error retrieving invitation codes for user ${request.auth.uid}:`,
      error,
    );
    throw new HttpsError(
      "internal",
      "An internal error occurred while retrieving invitation codes.",
      error,
    );
  }
});

/**
 * Sets the caller's role to TeamRedFollower if they don't already have a role.
 * This lets followers sign in without an invitation code.
 */
exports.setFollowerRole = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    logger.error("setFollowerRole called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const currentRole = request.auth.token.role || null;
  const auth = getAuth();
  const db = getFirestore();

  try {
    // If already team-member or follower, do nothing
    if (currentRole === "team-member" || currentRole === "TeamRedFollower") {
      return { status: "noop", role: currentRole };
    }

    await auth.setCustomUserClaims(uid, { role: "TeamRedFollower" });
    await db
      .collection("users")
      .doc(uid)
      .set({ role: "TeamRedFollower" }, { merge: true });
    logger.info(`Assigned TeamRedFollower role to user ${uid}.`);
    return { status: "success", role: "TeamRedFollower" };
  } catch (error) {
    logger.error(`Error setting follower role for user ${uid}:`, error);
    throw new HttpsError("internal", "Failed to assign follower role.", error);
  }
});

/**
 * TikTok auto-ingest: fetch latest public video URLs for @redsracing and store in Firestore.
 * No official API is used; this parses the public profile page for video links.
 */
async function fetchTikTokVideoUrls(username) {
  const profileUrl = `https://www.tiktok.com/@${username}`;
  const res = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  const urls = new Set();

  // 1) Try parsing embedded JSON (SIGI_STATE)
  try {
    const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
    if (sigiMatch && sigiMatch[1]) {
      const state = JSON.parse(sigiMatch[1]);
      // Preferred: ItemModule contains items keyed by videoId
      const itemModule = state && state.ItemModule ? state.ItemModule : null;
      if (itemModule && typeof itemModule === 'object') {
        for (const key of Object.keys(itemModule)) {
          const item = itemModule[key];
          const id = (item && (item.id || item.video?.id)) || key;
          if (id && /^\d+$/.test(String(id))) {
            urls.add(`https://www.tiktok.com/@${username}/video/${id}`);
          }
        }
      }
      // Fallback: sometimes ItemList.itemList contains IDs
      if (urls.size === 0 && state && state.ItemList && Array.isArray(state.ItemList)) {
        try {
          state.ItemList.forEach(list => {
            const idList = list?.itemList || list?.list || [];
            idList.forEach(id => {
              if (id && /^\d+$/.test(String(id))) {
                urls.add(`https://www.tiktok.com/@${username}/video/${id}`);
              }
            });
          });
        } catch(_) {}
      }
    }
  } catch (e) {
    logger.warn('SIGI_STATE parse failed', e);
  }

  // 2) Regex fallback (if JSON parse didn’t produce anything)
  if (urls.size === 0) {
    const rx = /https?:\/\/www\.tiktok\.com\/@[^\/#?\s]+\/(video|photo)\/(\d+)/g;
    let m;
    while ((m = rx.exec(html)) !== null) {
      try { urls.add(m[0]); } catch (_) {}
    }
  }

  return Array.from(urls);
}

async function upsertTikTokVideos(urls) {
  const db = getFirestore();
  const col = db.collection('videos');
  // Load existing URLs to de-duplicate
  const existingSnap = await col.where('platform','==','tiktok').get();
  const existing = new Set();
  existingSnap.forEach((d) => { const u = d.data()?.url; if (u) existing.add(u); });

  let added = 0;
  for (const url of urls) {
    if (existing.has(url)) continue;
    await col.add({
      platform: 'tiktok',
      url,
      published: true,
      createdAt: FieldValue.serverTimestamp(),
      source: 'auto'
    });
    added++;
  }
  return added;
}

// Callable to trigger a refresh (admin-only)
exports.refreshTikTokVideos = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated','Must be signed in.');
  }
  // Admin by role or email
  const role = request.auth.token?.role || '';
  const email = (request.auth.token?.email || '').toLowerCase();
  let ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  try { const cfg = require('firebase-functions').config?.() || {}; ADMIN_EMAIL = cfg?.admin?.email || ADMIN_EMAIL; } catch {}
  if (!ADMIN_EMAIL) ADMIN_EMAIL = 'auhren1992@gmail.com';
  if (!(role === 'admin' || (email && email === ADMIN_EMAIL.toLowerCase()))) {
    throw new HttpsError('permission-denied','Admin only');
  }
  const username = 'redsracing';
  try {
    const urls = await fetchTikTokVideoUrls(username);
    const added = await upsertTikTokVideos(urls);
    return { status: 'success', found: urls.length, added };
  } catch (e) {
    logger.error('refreshTikTokVideos failed', e);
    try { Sentry.captureException(e); } catch(_){}
    throw new HttpsError('internal','Failed to refresh TikTok videos');
  }
});

// Scheduled auto-ingest hourly
exports.tiktokAutoIngest = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Etc/UTC' }, async (event) => {
  try {
    const urls = await fetchTikTokVideoUrls('redsracing');
    const added = await upsertTikTokVideos(urls);
    logger.info(`TikTok auto-ingest: found=${urls.length}, added=${added}`);
  } catch (e) {
    logger.error('tiktokAutoIngest failed', e);
    try { Sentry.captureException(e); } catch(_){}
  }
});
