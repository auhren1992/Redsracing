/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/document");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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

    const uid = request.auth.uid;
    const email = request.auth.token?.email || "";

    const auth = getAuth();
    const db = getFirestore();

    // Preserve existing role if present; only set a default when missing
    const userRecord = await auth.getUser(uid);
    const existingRole = userRecord.customClaims && userRecord.customClaims.role;

    // Admin override: if email matches ADMIN_EMAIL and not already admin, upgrade to admin
    if (ADMIN_EMAIL && email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      if (existingRole !== 'admin') {
        await auth.setCustomUserClaims(uid, { role: 'admin' });
        await db.collection('users').doc(uid).set({ role: 'admin' }, { merge: true });
        logger.info(`ensureDefaultRole: upgraded ${uid} to admin based on ADMIN_EMAIL`);
        return { status: 'upgraded', role: 'admin' };
      }
      return { status: 'noop', role: 'admin' };
    }

    // For non-admins: if role is missing, set to public-fan; do NOT overwrite team-member/follower/etc.
    if (!existingRole) {
      await auth.setCustomUserClaims(uid, { role: 'public-fan' });
      await db.collection('users').doc(uid).set({ role: 'public-fan' }, { merge: true });
      logger.info(`ensureDefaultRole: set default role 'public-fan' for user ${uid}`);
      return { status: 'defaulted', role: 'public-fan' };
    }

    logger.info(`ensureDefaultRole: preserved existing role '${existingRole}' for ${uid}`);
    return { status: 'noop', role: existingRole };
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
    const text = html.replace(/\s+/g, ' ');
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

// Fetch K1 Addison Adult Challenge GP row for Jonathan Kirsch and persist to Firestore
exports.fetchK1AddisonJon = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  try {
    const url = 'https://www.k1speed.com/challenge-gp-addison.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const text = html.replace(/\s+/g, ' ');
    // Match the standings row for Jonathan Kirsch: series of numbers (GP1..GP12) then TOTAL
    const rx = /Jonathan\s+Kirsch\s+((?:\d+\s+){1,24})(\d{1,4})(?!\s*\d)/i;
    const m = text.match(rx);
    if (!m) {
      return res.status(200).json({ ok: false, message: 'Row for Jonathan Kirsch not found' });
    }
    const gpPoints = m[1].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(Number.isFinite);
    const total = parseInt(m[2], 10);

    // Persist latest into Firestore (for history/diagnostics)
    try {
      const db = getFirestore();
      await db.collection('k1_stats').doc('jon_addison_2025').set({
        name: 'Jonathan Kirsch',
        season: 2025,
        location: 'Addison',
        series: 'Adult Challenge GP',
        gpPoints,
        total,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) { logger.warn('Failed to persist k1_stats/jon_addison_2025', e); }

    res.status(200).json({ ok: true, season: 2025, gpPoints, total, matchedName: 'Jonathan Kirsch' });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch K1 page' });
  }
});

// Fetch K1 Addison Junior League row for Jonny Kirsch (best-effort parser)
exports.fetchK1AddisonJonnyJunior = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  try {
    const url = 'https://www.k1speed.com/addison-junior-league-results.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    
    // Try to find Jonny Kirsch row in HTML table
    // Look for <td>Jonny Kirsch</td> followed by <td> elements with numbers
    const tableMatch = html.match(/<td>\s*Jonny\s+Kirsch\s*<\/td>([\s\S]*?)<\/tr>/i);
    if (!tableMatch) {
      // Fallback to plain text format
      const text = html.replace(/\s+/g, ' ');
      const rx = /Jonny\s+Kirsch\s+((?:\d+\s+){1,24})(\d{1,4})(?!\s*\d)/i;
      const m = text.match(rx);
      if (!m) {
        return res.status(200).json({ ok: false, message: 'Row for Jonny Kirsch not found' });
      }
      const gpPoints = m[1].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(Number.isFinite);
      const total = parseInt(m[2], 10);
      
      // Persist and return
      try {
        const db = getFirestore();
        await db.collection('k1_stats').doc('jonny_addison_junior_2025').set({
          name: 'Jonny Kirsch',
          season: 2025,
          location: 'Addison',
          series: 'Junior League',
          gpPoints,
          total,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) { logger.warn('Failed to persist k1_stats/jonny_addison_junior_2025', e); }
      return res.status(200).json({ ok: true, season: 2025, gpPoints, total, matchedName: 'Jonny Kirsch' });
    }
    
    // Parse HTML table cells
    const rowContent = tableMatch[1];
    const tdMatches = rowContent.match(/<td[^>]*>([^<]*)<\/td>/g) || [];
    const gpPoints = tdMatches
      .map(td => td.replace(/<[^>]+>/g, '').trim())
      .map(n => parseInt(n, 10))
      .filter(Number.isFinite);
    
    // Last cell should be total
    const total = gpPoints.length > 0 ? gpPoints.pop() : 0;

    // Persist latest into Firestore (for history/diagnostics)
    try {
      const db = getFirestore();
      await db.collection('k1_stats').doc('jonny_addison_junior_2025').set({
        name: 'Jonny Kirsch',
        season: 2025,
        location: 'Addison',
        series: 'Junior League',
        gpPoints,
        total,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) { logger.warn('Failed to persist k1_stats/jonny_addison_junior_2025', e); }

    res.status(200).json({ ok: true, season: 2025, gpPoints, total, matchedName: 'Jonny Kirsch' });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch K1 Junior League page' });
  }
});

// Scheduled refresh for Jonny Kirsch K1 Addison Junior League standings (every 12 hours)
exports.k1AutoRefreshAddisonJonny = onSchedule({ schedule: 'every 12 hours', timeZone: 'America/Chicago', secrets: ["SENTRY_DSN"] }, async () => {
  try {
    const url = 'https://www.k1speed.com/addison-junior-league-results.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();

    // Parse HTML table format: find all <tr> rows with driver data
    const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const rows = [];
    
    for (const tr of trMatches) {
      // Look for rows that have a driver name in first <td>
      const nameMatch = tr.match(/<td[^>]*>\s*([A-Z][a-z]+\s+[A-Z][a-z]+)\s*<\/td>/i);
      if (!nameMatch) continue;
      
      const name = nameMatch[1].trim();
      const tdMatches = tr.match(/<td[^>]*>([^<]*)<\/td>/g) || [];
      
      // Extract all numeric cells (skip first which is name)
      const nums = tdMatches
        .slice(1) // skip name cell
        .map(td => td.replace(/<[^>]+>/g, '').trim())
        .map(n => parseInt(n, 10))
        .filter(Number.isFinite);
      
      if (nums.length > 0) {
        // Last number is total
        const total = nums[nums.length - 1];
        const gpPoints = nums.slice(0, -1); // all except last
        rows.push({ name, gpPoints, total });
      }
    }
    
    if (!rows.length) {
      logger.warn('k1AutoRefreshAddisonJonny: no rows found');
      return;
    }

    // Find Jonny's row (case-insensitive)
    const idx = rows.findIndex(r => /jonny\s+kirsch/i.test(r.name));
    if (idx === -1) {
      logger.warn('k1AutoRefreshAddisonJonny: Jonny Kirsch not found');
      return;
    }

    // Compute place by ranking by total desc
    const place = 1 + rows.filter(r => r.total > rows[idx].total).length;
    const gpPoints = rows[idx].gpPoints;
    const total = rows[idx].total;

    const db = getFirestore();
    await db.collection('k1_stats').doc('jonny_addison_junior_2025').set({
      name: 'Jonny Kirsch',
      season: 2025,
      location: 'Addison',
      series: 'Junior League',
      gpPoints,
      total,
      place,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info('k1AutoRefreshAddisonJonny updated Jonny standings');
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    logger.warn('k1AutoRefreshAddisonJonny failed');
  }
});

// Scheduled refresh for Jonathan Kirsch K1 Addison standings (every 12 hours)
exports.k1AutoRefreshAddisonJon = onSchedule({ schedule: 'every 12 hours', timeZone: 'America/Chicago', secrets: ["SENTRY_DSN"] }, async () => {
  try {
    const url = 'https://www.k1speed.com/challenge-gp-addison.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const text = html.replace(/\s+/g, ' ');

    // Helper to extract season chunk by label like "2025 Season"
    function chunkFor(year) {
      const marker = `${year} Season`;
      const i = text.indexOf(marker);
      if (i < 0) return null;
      let end = text.length;
      for (const y of [2024,2023,2022,2021]) {
        const j = text.indexOf(`${y} Season`, i + marker.length);
        if (j > -1) { end = Math.min(end, j); }
      }
      return text.slice(i, end);
    }

    const db = getFirestore();
    for (const year of [2025, 2024, 2023, 2022]) {
      const sect = chunkFor(year);
      if (!sect) continue;
      const rxRow = /(?!\bName\b)([A-Z][A-Za-z'\-]+\s+[A-Z][A-Za-z'\-]+)\s+((?:\d+\s+){1,24})(\d{1,4})(?!\s*\d)/g;
      let match;
      let rows = [];
      while ((match = rxRow.exec(sect)) !== null) {
        const name = match[1].trim();
        const nums = match[2].trim().split(/\s+/).map(n=>parseInt(n,10)).filter(Number.isFinite);
        const total = parseInt(match[3],10);
        rows.push({ name, nums, total });
      }
      if (!rows.length) continue;
      // Find Jonathan's row (case-insensitive)
      const idx = rows.findIndex(r => /jonathan\s+kirsch/i.test(r.name));
      if (idx === -1) continue;
      // Compute place by ranking by total desc
      const place = 1 + rows.filter(r => r.total > rows[idx].total).length;
      const gpPoints = rows[idx].nums;
      const total = rows[idx].total;

      await db.collection('k1_stats').doc(`jon_addison_${year}`).set({
        name: 'Jonathan Kirsch',
        season: year,
        location: 'Addison',
        series: 'Adult Challenge GP',
        gpPoints,
        total,
        place: year === 2025 ? 2 : place, // user-confirmed for 2025
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    logger.info('k1AutoRefreshAddisonJon updated multi-season standings');
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    logger.warn('k1AutoRefreshAddisonJon failed');
  }
});

// HTTP: return seasons array for 2025..2022 for Jonathan Kirsch
exports.fetchK1AddisonJonSeasons = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  try {
    const url = 'https://www.k1speed.com/challenge-gp-addison.html';
    const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const text = html.replace(/\s+/g, ' ');

    function chunkFor(year) {
      const marker = `${year} Season`;
      const i = text.indexOf(marker);
      if (i < 0) return null;
      let end = text.length;
      for (const y of [2025,2024,2023,2022,2021]) {
        if (y === year) continue;
        const j = text.indexOf(`${y} Season`, i + marker.length);
        if (j > -1) { end = Math.min(end, j); }
      }
      return text.slice(i, end);
    }

    const seasons = [];
    for (const year of [2025, 2024, 2023, 2022]) {
      const sect = chunkFor(year);
      if (!sect) continue;
      const rxRow = /(?!\bName\b)([A-Z][A-Za-z'\-]+\s+[A-Z][A-Za-z'\-]+)\s+((?:\d+\s+){1,24})(\d{1,4})(?!\s*\d)/g;
      let match;
      let rows = [];
      while ((match = rxRow.exec(sect)) !== null) {
        const name = match[1].trim();
        const nums = match[2].trim().split(/\s+/).map(n=>parseInt(n,10)).filter(Number.isFinite);
        const total = parseInt(match[3],10);
        rows.push({ name, nums, total });
      }
      if (!rows.length) continue;
      const idx = rows.findIndex(r => /jonathan\s+kirsch/i.test(r.name));
      if (idx === -1) continue;
      const placeComputed = 1 + rows.filter(r => r.total > rows[idx].total).length;
      const place = year === 2025 ? 2 : placeComputed; // user-provided correction
      seasons.push({
        year,
        series: 'K1 Addison Adult League',
        points: rows[idx].total,
        gpPoints: rows[idx].nums,
        place,
      });
    }

    res.status(200).json({ ok: true, seasons });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch K1 page' });
  }
});

// Speedhive: scrape profile page for Jonathan Kirsch and persist basic race data
exports.fetchSpeedhiveJon = onRequest({ secrets: ["SENTRY_DSN"], timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
  try {
    const PROFILE_URL = 'https://speedhive.mylaps.com/profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e';
    const r = await fetch(PROFILE_URL, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const text = html.replace(/\s+/g, ' ');

    // Attempt to find structured data blocks first
    const events = [];
    try {
      const scriptBlocks = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(m=>m[1]);
      for (const block of scriptBlocks) {
        if (/"@type"\s*:\s*"Event"/i.test(block)) {
          // Extract loose JSON objects with @type Event
          const objMatches = block.match(/\{[\s\S]*?\}/g) || [];
          for (const raw of objMatches) {
            try {
              const obj = JSON.parse(raw);
              if (obj['@type']==='Event') {
                events.push({
                  name: obj.name || null,
                  startDate: obj.startDate || null,
                  location: obj?.location?.name || null,
                });
              }
            } catch {}
          }
        }
      }
    } catch {}

    // Heuristic fallback: links that look like events with dates nearby
    if (!events.length) {
      const linkRx = /<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/gi;
      let m;
      while ((m = linkRx.exec(html)) !== null) {
        const href = m[1];
        const label = m[2].replace(/<[^>]+>/g,'').trim();
        if (/event|result|race/i.test(href) && label && label.length > 3) {
          // Try to find a nearby date
          const around = text.slice(Math.max(0, m.index - 120), Math.min(text.length, m.index + 200));
          const dateMatch = around.match(/\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/);
          events.push({ name: label, date: dateMatch ? dateMatch[0] : null, link: href });
        }
      }
    }

    // If still no events, render the JS-powered races page via headless browser
    if (!events.length) {
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          headless: 'new',
        });
        const page = await browser.newPage();
        const RACES_URL = PROFILE_URL.replace(/\/profile\/.+$/, 'profile/MYLAPS-GA-3a22ae250e154baf8f798908b7e3599e/races');
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
        await page.goto(RACES_URL, { waitUntil: 'networkidle2', timeout: 90000 });

        // Wait for anchor tags to render; adjust selector as needed
        await page.waitForSelector('a', { timeout: 30000 }).catch(() => {});

        const rendered = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a'));
          const items = [];
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            const label = (a.textContent || '').trim();
            // Look for race/result links mentioning Jonathan or generic race labels
            if (/result|event|race/i.test(href) || /Jonathan\s+Kirsch/i.test(label)) {
              // Try to find a nearby date text in parent containers
              let date = '';
              try {
                const parentText = (a.closest('div,li,section,article') || document.body).innerText || '';
                const m = parentText.match(/\b(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b/);
                date = m ? m[0] : '';
              } catch (e) {}
              items.push({ name: label || 'Race', link: href, date });
            }
          }
          return items.slice(0, 50);
        });
        await browser.close();
        if (Array.isArray(rendered) && rendered.length) {
          rendered.forEach(r => events.push(r));
        }
      } catch (e) {
        logger.warn('Puppeteer render failed for Speedhive races', e?.message || e);
      }
    }

    // Persist snapshot to Firestore for audit and client rendering
    try {
      const db = getFirestore();
      await db.collection('speedhive_profiles').doc('jon_kirsch').set({
        profileUrl: PROFILE_URL,
        lastFetchedAt: FieldValue.serverTimestamp(),
        eventCount: events.length,
        events: events.slice(0, 100),
      }, { merge: true });
    } catch {}

    res.status(200).json({ ok: true, events });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch Speedhive' });
  }
});

// Schedule: refresh Speedhive daily
exports.speedhiveAutoRefreshJon = onSchedule({ schedule: 'every 24 hours', timeZone: 'America/Chicago', secrets: ["SENTRY_DSN"] }, async (event) => {
  try {
    const url = 'https://us-central1-redsracing-a7f8b.cloudfunctions.net/fetchSpeedhiveJon';
    await fetch(url, { method: 'GET' });
  } catch (e) {
    try { Sentry.captureException(e); } catch (_) {}
  }
});

// Process queues for admin operations
exports.process_queues = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  try {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
      }

      const db = getFirestore();
      let processed = 0;
      let errors = 0;

      try {
        // Process pending gallery approvals
        const galleryQuery = db.collection('gallery_images')
          .where('approved', '==', false)
          .limit(50);
        const gallerySnapshot = await galleryQuery.get();
        
        for (const doc of gallerySnapshot.docs) {
          try {
            const data = doc.data();
            // Auto-approve images that have been pending for more than 24 hours
            const createdAt = data.createdAt?.toDate();
            if (createdAt && (Date.now() - createdAt.getTime()) > 24 * 60 * 60 * 1000) {
              await doc.ref.update({
                approved: true,
                approvedAt: FieldValue.serverTimestamp(),
                approvedBy: 'system-auto'
              });
              processed++;
            }
          } catch (e) {
            errors++;
            logger.warn(`Failed to process gallery image ${doc.id}:`, e.message);
          }
        }

        // Process pending Q&A submissions
        const qnaQuery = db.collection('qna_submissions')
          .where('status', '==', 'pending')
          .limit(50);
        const qnaSnapshot = await qnaQuery.get();
        
        for (const doc of qnaSnapshot.docs) {
          try {
            const data = doc.data();
            // Auto-publish questions that have been pending for more than 48 hours
            const submittedAt = data.submittedAt?.toDate();
            if (submittedAt && (Date.now() - submittedAt.getTime()) > 48 * 60 * 60 * 1000) {
              await doc.ref.update({
                status: 'published',
                publishedAt: FieldValue.serverTimestamp(),
                publishedBy: 'system-auto'
              });
              processed++;
            }
          } catch (e) {
            errors++;
            logger.warn(`Failed to process Q&A submission ${doc.id}:`, e.message);
          }
        }

        // Clean up old client logs (older than 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const logsQuery = db.collection('client_logs')
          .where('timestamp', '<', thirtyDaysAgo)
          .limit(100);
        const logsSnapshot = await logsQuery.get();
        
        const batch = db.batch();
        logsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        processed += logsSnapshot.docs.length;

        res.status(200).json({
          ok: true,
          message: 'Queue processing completed',
          processed,
          errors,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Queue processing failed:', error);
        try { Sentry.captureException(error); } catch (_) {}
        res.status(500).json({
          ok: false,
          message: 'Queue processing failed',
          error: error.message
        });
      }
    });
  } catch (error) {
    logger.error('process_queues function error:', error);
    try { Sentry.captureException(error); } catch (_) {}
    res.status(500).json({ ok: false, message: 'Internal server error' });
  }
});

// Set admin role for a user (admin-only function)
exports.setAdminRole = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  // Check if the user is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if the current user is an admin (or allow initial admin setup)
  const currentUserRole = request.auth.token.role;
  const { targetEmail, role = 'admin' } = request.data;

  if (!targetEmail) {
    throw new HttpsError('invalid-argument', 'Target email is required');
  }

  // Allow initial admin setup for your email specifically
  const isInitialSetup = targetEmail === 'partspimp75@gmail.com' && !currentUserRole;
  const isCurrentAdmin = currentUserRole === 'admin';

  if (!isInitialSetup && !isCurrentAdmin) {
    throw new HttpsError('permission-denied', 'Only admins can assign roles');
  }

  try {
    const auth = getAuth();
    const db = getFirestore();
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(targetEmail);
    const uid = userRecord.uid;

    // Set custom claims
    await auth.setCustomUserClaims(uid, { role });
    
    // Also update the user document in Firestore
    await db.collection('users').doc(uid).set({
      email: targetEmail,
      role: role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    }, { merge: true });

    logger.info(`Role '${role}' assigned to user ${targetEmail} (${uid}) by ${request.auth.uid}`);
    
    return {
      success: true,
      message: `Role '${role}' assigned successfully to ${targetEmail}`,
      uid: uid
    };
  } catch (error) {
    logger.error('Error setting admin role:', error);
    try { Sentry.captureException(error); } catch (_) {}
    throw new HttpsError('internal', 'Failed to set role: ' + error.message);
  }
});

// Get current user's role and permissions
exports.getUserRole = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const auth = getAuth();
    const db = getFirestore();
    const uid = request.auth.uid;
    
    // Get fresh user record to check claims
    const userRecord = await auth.getUser(uid);
    const customClaims = userRecord.customClaims || {};
    
    // Also check Firestore document as fallback
    let firestoreRole = null;
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        firestoreRole = userDoc.data()?.role;
      }
    } catch (e) {
      logger.warn('Could not fetch user document:', e.message);
    }
    
    const role = customClaims.role || firestoreRole || 'public-fan';
    
    return {
      uid: uid,
      email: userRecord.email,
      role: role,
      customClaims: customClaims,
      firestoreRole: firestoreRole,
      isAdmin: role === 'admin',
      isTeamMember: ['admin', 'team-member'].includes(role)
    };
  } catch (error) {
    logger.error('Error getting user role:', error);
    try { Sentry.captureException(error); } catch (_) {}
    throw new HttpsError('internal', 'Failed to get user role: ' + error.message);
  }
});

// Speedhive: scrape a specific event or session URL and extract rows for "Jonathan Kirsch"
exports.fetchSpeedhiveEvent = onRequest({ secrets: ["SENTRY_DSN"], timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
  try {
    const targetUrl = (req.query.url || req.body?.url || '').toString();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ ok: false, message: 'Missing ?url=' });
    }
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

    // Wait for any table rows or list items to render
    await page.waitForSelector('table, .table, tr, li, .results', { timeout: 30000 }).catch(()=>{});

    const eventName = (await page.title()) || 'Speedhive Event';

    const parsed = await page.evaluate(() => {
      const rows = [];
      // Match "Jonathan Kirsch", "Jon Kirsch", or "Kirsch, Jonathan|Jon"
      const nameRx = /(jonathan|jon)\s+kirsch|kirsch\s*,\s*(jonathan|jon)/i;
      const tables = Array.from(document.querySelectorAll('table'));
      for (const t of tables) {
        const trs = Array.from(t.querySelectorAll('tr'));
        trs.forEach(tr => {
          const txt = (tr.innerText || '').trim();
          if (nameRx.test(txt)) {
            const tds = Array.from(tr.querySelectorAll('td')).map(td => (td.innerText || '').trim());
            rows.push({ text: txt, cells: tds });
          }
        });
      }
      // Also scan generic list items
      const lis = Array.from(document.querySelectorAll('li'));
      lis.forEach(li => {
        const txt = (li.innerText || '').trim();
        if (nameRx.test(txt)) rows.push({ text: txt, cells: [] });
      });
      return rows;
    });

    await browser.close();

    // Persist an event snapshot for reference
    try {
      const db = getFirestore();
      const id = Buffer.from(targetUrl).toString('base64').replace(/=+$/,'');
      await db.collection('speedhive_events').doc(id).set({
        url: targetUrl,
        eventName,
        matchedName: 'Jonathan Kirsch',
        entries: Array.isArray(parsed) ? parsed.slice(0, 50) : [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch {}

    res.status(200).json({ ok: true, url: targetUrl, eventName, entriesCount: Array.isArray(parsed) ? parsed.length : 0, entries: parsed });
  } catch (error) {
    try { Sentry.captureException(error); } catch (_) {}
    res.status(200).json({ ok: false, message: 'Failed to fetch Speedhive event' });
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

  // Check if the user has team-member or admin role
  const userRole = request.auth.token.role;
  if (userRole !== "team-member" && userRole !== "admin") {
    logger.error(
      `getInvitationCodes called by user ${request.auth.uid} with role '${userRole}'.`,
    );
    throw new HttpsError(
      "permission-denied",
      "You must be a team member or admin to view invitation codes.",
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
 * Admin-only: set role for one or more users by email.
 * data: { emails: string[] | string, role: 'admin'|'team-member'|'TeamRedFollower'|'public-fan' }
 */
exports.setUserRole = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }
  const callerRole = request.auth.token?.role || '';
  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  const { emails, role } = request.data || {};
  if (!emails || !role) {
    throw new HttpsError('invalid-argument', "Provide 'emails' and 'role'.");
  }
  const list = Array.isArray(emails) ? emails : [emails];
  const auth = getAuth();
  const db = getFirestore();
  const results = [];
  for (const raw of list) {
    const email = String(raw || '').trim();
    if (!email) continue;
    try {
      const userRecord = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(userRecord.uid, { role });
      await db.collection('users').doc(userRecord.uid).set({ role }, { merge: true });
      results.push({ email, uid: userRecord.uid, status: 'ok' });
    } catch (e) {
      results.push({ email, error: e?.message || String(e) });
    }
  }
  return { status: 'done', results };
});

/**
 * Admin-only: create invitation codes.
 * data: { role: string, codes?: string[], count?: number, prefix?: string, expiresAt?: string }
 * If codes not provided, generate 'count' random codes.
 */
exports.createInvitationCodes = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }
  const callerRole = request.auth.token?.role || '';
  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  const { role, codes, count, prefix, expiresAt } = request.data || {};
  if (!role) throw new HttpsError('invalid-argument', "'role' is required");
  const db = getFirestore();
  const out = [];
  const gen = (n=10)=>{
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s=''; for (let i=0;i<n;i++) s+=chars[Math.floor(Math.random()*chars.length)];
    return s;
  };
  const list = Array.isArray(codes) && codes.length ? codes : Array.from({length: Math.max(1, Number(count)||1)}, ()=> (prefix? (String(prefix)+gen(6)) : gen(10)));
  let expTs = null;
  try { if (expiresAt) expTs = new Date(expiresAt); } catch {}
  for (const code of list) {
    const id = String(code).trim(); if (!id) continue;
    try {
      await db.collection('invitation_codes').doc(id).set({
        role,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
        ...(expTs ? { expiresAt: expTs } : {}),
      }, { merge: true });
      out.push({ code: id, status: 'ok' });
    } catch (e) {
      out.push({ code: id, error: e?.message || String(e) });
    }
  }
  return { status: 'done', created: out };
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
 * Admin/team: Add a TikTok video by URL.
 * Upserts into tiktok_videos, ID derived from video/photo ID.
 */
exports.addTikTokVideo = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token?.role || '';
  if (role !== 'admin' && role !== 'team-member') {
    throw new HttpsError('permission-denied', 'Team-member or admin only');
  }
  const { url, title, published } = request.data || {};
  if (!url || typeof url !== 'string') throw new HttpsError('invalid-argument', "'url' required");
  const m = url.match(/\/(video|photo)\/(\d{6,})/);
  if (!m) throw new HttpsError('invalid-argument', 'Unsupported TikTok URL');
  const id = m[2];
  const db = getFirestore();
  const docId = id;
  const data = {
    platform: 'tiktok',
    url, title: title || null,
    videoId: id,
    published: published !== false,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.collection('tiktok_videos').doc(docId).set({
    createdAt: FieldValue.serverTimestamp(),
    ...data,
  }, { merge: true });
  return { status: 'ok', id: docId };
});

/**
 * Refresh TikTok videos for a handle stored in config/tiktok.handle.
 * Best-effort HTML parse of profile page for /video/ and /photo/ links.
 */
exports.refreshTikTokVideos = onCall({ secrets: ["SENTRY_DSN"] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token?.role || '';
  if (role !== 'admin' && role !== 'team-member') {
    throw new HttpsError('permission-denied', 'Team-member or admin only');
  }
  const db = getFirestore();
  const cfgSnap = await db.collection('config').doc('tiktok').get();
  const handle = (cfgSnap.exists && cfgSnap.data().handle) ? cfgSnap.data().handle : '@redsracing';
  const handleSlug = handle.startsWith('@') ? handle.slice(1) : handle;
  const url = `https://www.tiktok.com/@${handleSlug}`;
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    html = await r.text();
  } catch (e) {
    logger.error('Failed to fetch TikTok profile:', e);
    throw new HttpsError('unavailable', 'TikTok fetch failed');
  }
  const ids = new Set();
  const rx = /\/(video|photo)\/(\d{6,})/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    ids.add(m[2]);
  }
  let found = ids.size;
  let added = 0;
  for (const id of ids) {
    try {
      const ref = db.collection('tiktok_videos').doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          platform: 'tiktok',
          url: `https://www.tiktok.com/@${handleSlug}/video/${id}`,
          videoId: id,
          published: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        added++;
      } else {
        await ref.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    } catch (e) {
      logger.warn('Failed to upsert video', id, e?.message || e);
    }
  }
  return { status: 'success', found, added };
});

// Scheduled auto-ingest every 2 hours
exports.tiktokAutoIngest = onSchedule('every 120 minutes', async (event) => {
  const db = getFirestore();
  try {
    const cfgSnap = await db.collection('config').doc('tiktok').get();
    const handle = (cfgSnap.exists && cfgSnap.data().handle) ? cfgSnap.data().handle : '@redsracing';
    const handleSlug = handle.startsWith('@') ? handle.slice(1) : handle;
    const url = `https://www.tiktok.com/@${handleSlug}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const ids = new Set();
    const rx = /\/(video|photo)\/(\d{6,})/g;
    let m; while ((m = rx.exec(html)) !== null) ids.add(m[2]);
    for (const id of ids) {
      try {
        await db.collection('tiktok_videos').doc(id).set({
          platform: 'tiktok',
          url: `https://www.tiktok.com/@${handleSlug}/video/${id}`,
          videoId: id,
          published: true,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        logger.warn('AutoIngest upsert failed', id, e?.message || e);
      }
    }
    logger.info(`tiktokAutoIngest processed ${ids.size} ids`);
  } catch (e) {
    logger.error('tiktokAutoIngest failed', e);
  }
});

// Newsletter functions
const newsletter = require('./newsletter');
exports.sendWelcomeEmail = newsletter.sendWelcomeEmail;
exports.notifyNewRace = newsletter.notifyNewRace;
exports.sendUpcomingRaceReminders = newsletter.sendUpcomingRaceReminders;
