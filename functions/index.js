/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/document");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const vision = require("@google-cloud/vision");
const cors = require("cors")({origin: true});

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
exports.processInvitationCode = onCall(async (request) => {
  // Check if the user is authenticated.
  // While the rules on the function should prevent this, it's a good failsafe.
  if (!request.auth) {
    logger.error("processInvitationCode called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in to use an invitation code.");
  }

  const {code, uid} = request.data;
  logger.info(`Processing invitation code '${code}' for user ${uid}`);

  if (!code || !uid) {
    logger.error("Missing code or UID for processInvitationCode.", {code, uid});
    throw new HttpsError("invalid-argument", "The function must be called with a 'code' and 'uid'.");
  }

  // Security check: Enforce that users can only use codes for themselves
  if (uid !== request.auth.uid) {
    logger.error(`User ${request.auth.uid} attempted to use invitation code for user ${uid}.`);
    throw new HttpsError("permission-denied", "You can only use invitation codes for your own account.");
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
      await auth.setCustomUserClaims(uid, {role: "public-fan"});
      return {status: "error", message: "Invalid invitation code."};
    }
    const codeData = codeDoc.data();

    if (!codeData.role) {
      logger.info(`Invitation code '${code}' is missing a role. Defaulting to 'team-member' and updating the document.`);
      await codeDoc.ref.update({ role: "team-member" });
      codeData.role = "team-member"; // Update the local copy as well
    }

    // 2. Check if the code is still valid (not expired and not already used)
    const now = new Date();
    if (codeData.expiresAt && codeData.expiresAt.toDate() < now) {
      logger.warn(`Expired invitation code '${code}' used by ${uid}.`);
      return {status: "error", message: "This invitation code has expired."};
    }

    if (codeData.used === true) {
      logger.warn(`Already used invitation code '${code}' attempted by ${uid}.`);
      return {status: "error", message: "This invitation code has already been used."};
    }

    // 3. Assign the custom role to the user
    const roleToAssign = codeData.role; // No more fallback
    logger.info(`Assigning role '${roleToAssign}' to user ${uid}.`);
    await auth.setCustomUserClaims(uid, {role: roleToAssign});

    // 4. Mark the invitation code as used with tracking information
    await codeDoc.ref.update({
      used: true,
      usedBy: uid,
      usedAt: FieldValue.serverTimestamp()
    });
    logger.info(`Marked invitation code '${code}' as used by ${uid}.`);

    // 5. Update user's public profile with the new role
    // This is useful for client-side checks without needing to refresh the ID token
    await db.collection("users").doc(uid).set({
      role: roleToAssign,
    }, {merge: true});
    logger.info(`Set role '${roleToAssign}' in user's public profile (users/${uid}).`);


    // 6. Award the "Community Member" achievement to get them on the leaderboard
    const achievementData = {
        userId: uid,
        achievementId: "community_member", // This is a default achievement
        dateEarned: FieldValue.serverTimestamp(),
        assignedBy: "system"
    };
    await db.collection("user_achievements").add(achievementData);
    logger.info(`Awarded 'community_member' achievement to user ${uid}.`);

    return {status: "success", message: `Role '${roleToAssign}' assigned successfully.`};
  } catch (error) {
    logger.error(`Error processing invitation code for user ${uid}:`, error);
    throw new HttpsError("internal", "An internal error occurred while processing the code.", error);
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
exports.generateTags = onObjectFinalized({
  region: "us-central1", // Explicitly specify the function's region
  bucket: "redsracing-a7f8b.firebasestorage.app", // Use the correct GCS bucket name
  cpu: 2, // Allocate more CPU
  memory: "1GiB", // Allocate more memory
  timeoutSeconds: 300, // Extend timeout
}, async (event) => {
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
      score: label.score
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
      downloadToken = metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens;
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
    
    // firebasestorage.app domain URLs  
    const appDomainBaseUrl = `https://${fileBucket}.firebasestorage.app/o/${encodeURIComponent(filePath)}?alt=media`;
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
      logger.error(`No Firestore document found for image. Attempted URLs: ${candidateUrls.join(', ')}`);
      return;
    }

    // Update the found document with the generated tags and compact vision data
    await imageDoc.ref.update({
      tags: tags,
      visionLabels: visionLabels, // Store compact array instead of full API response
      processedAt: FieldValue.serverTimestamp(),
      processed: true
    });

    logger.info(`Successfully updated Firestore document ${imageDoc.id} with tags.`);
  } catch (error) {
    logger.error(`Failed to analyze image ${filePath}. Error:`, error);
    // Optionally, update the Firestore doc with an error state
    // This helps in debugging and re-triggering failed jobs.
  }
});

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
exports.getProfile = onCall(async (request) => {
  if (!request.auth) {
    logger.error("getProfile called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in to view profiles.");
  }

  const {userId} = request.data;
  if (!userId) {
    logger.error("getProfile called without a userId.");
    throw new HttpsError("invalid-argument", "The function must be called with a 'userId'.");
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
    if (error.code === "not-found") {
      throw error; // Re-throw HttpsError
    }
    throw new HttpsError("internal", "An internal error occurred while fetching the profile.", error);
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
exports.updateProfile = onCall(async (request) => {
  if (!request.auth) {
    logger.error("updateProfile called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in to update your profile.");
  }

  const {userId, profileData} = request.data;
  const callerUid = request.auth.uid;

  if (!userId || !profileData) {
    logger.error("updateProfile called with missing data.", {userId, profileData});
    throw new HttpsError("invalid-argument", "The function must be called with 'userId' and 'profileData'.");
  }

  // Security check: Ensure users can only update their own profile
  if (userId !== callerUid) {
    logger.error(`User ${callerUid} attempted to update profile of user ${userId}.`);
    throw new HttpsError("permission-denied", "You do not have permission to update this profile.");
  }

  logger.info(`Updating profile for user ${userId}`);
  const db = getFirestore();

  try {
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.set(profileData, {merge: true}); // Use merge to avoid overwriting fields
    logger.info(`Profile for user ${userId} updated successfully.`);
    return {status: "success", message: "Profile updated successfully."};
  } catch (error) {
    logger.error(`Error updating profile for user ${userId}:`, error);
    throw new HttpsError("internal", "An internal error occurred while updating the profile.", error);
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
exports.getInvitationCodes = onCall(async (request) => {
  // Check if the user is authenticated
  if (!request.auth) {
    logger.error("getInvitationCodes called by unauthenticated user.");
    throw new HttpsError("unauthenticated", "You must be logged in to view invitation codes.");
  }

  // Check if the user has team-member role
  const userRole = request.auth.token.role;
  if (userRole !== 'team-member') {
    logger.error(`getInvitationCodes called by user ${request.auth.uid} with role '${userRole}'.`);
    throw new HttpsError("permission-denied", "You must be a team member to view invitation codes.");
  }

  logger.info(`Getting invitation codes for team member ${request.auth.uid}`);
  const db = getFirestore();

  try {
    const codesRef = db.collection("invitation_codes");
    const snapshot = await codesRef.get();
    
    const codes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      codes.push({
        id: doc.id,
        role: data.role,
        used: data.used || false,
        usedBy: data.usedBy || null,
        usedAt: data.usedAt || null,
        expiresAt: data.expiresAt || null
      });
    });

    logger.info(`Retrieved ${codes.length} invitation codes for team member ${request.auth.uid}`);
    return {status: "success", codes: codes};
  } catch (error) {
    logger.error(`Error retrieving invitation codes for user ${request.auth.uid}:`, error);
    throw new HttpsError("internal", "An internal error occurred while retrieving invitation codes.", error);
  }
});
