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
const logger = require("firebase-functions/logger");
const vision = require("@google-cloud/vision");

// Initialize Firebase Admin SDK
initializeApp();

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

    // 2. Check if the code is still valid (not expired or fully used)
    const now = new Date();
    if (codeData.expiresAt && codeData.expiresAt.toDate() < now) {
      logger.warn(`Expired invitation code '${code}' used by ${uid}.`);
      return {status: "error", message: "This invitation code has expired."};
    }

    if (codeData.usesLeft !== undefined && codeData.usesLeft <= 0) {
      logger.warn(`Depleted invitation code '${code}' used by ${uid}.`);
      return {status: "error", message: "This invitation code has no uses left."};
    }

    // 3. Assign the custom role to the user
    const roleToAssign = codeData.role || "public-fan"; // Default role if not specified
    logger.info(`Assigning role '${roleToAssign}' to user ${uid}.`);
    await auth.setCustomUserClaims(uid, {role: roleToAssign});

    // 4. Update the invitation code document (decrement usesLeft)
    if (codeData.usesLeft) {
      await codeDoc.ref.update({
        usesLeft: FieldValue.increment(-1),
        usersWhoClaimed: FieldValue.arrayUnion({uid: uid, claimedAt: new Date()}),
      });
      logger.info(`Decremented uses for code '${code}'.`);
    }

    // 5. Update user's public profile with the new role
    // This is useful for client-side checks without needing to refresh the ID token
    await db.collection("users").doc(uid).set({
      role: roleToAssign,
    }, {merge: true});
    logger.info(`Set role '${roleToAssign}' in user's public profile (users/${uid}).`);


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
  bucket: "redsracing-a7f8b.appspot.com", // Use the correct GCS bucket name
  cpu: 2, // Allocate more CPU
  memory: "1GiB", // Allocate more memory
  timeoutSeconds: 300, // Extend timeout
}, async (event) => {
  const fileBucket = event.data.bucket; // The Storage bucket that contains the file.
  const filePath = event.data.name; // File path in the bucket.
  const contentType = event.data.contentType; // File content type.

  logger.info(`New image uploaded: ${filePath} in bucket: ${fileBucket}`);

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

    // Extract the descriptions of the labels
    const tags = labels.map((label) => label.description.toLowerCase());
    logger.info(`Generated tags for ${filePath}:`, tags);

    // Find the corresponding Firestore document to update.
    // We construct the download URL and query for it. This is a robust way
    // to link the storage object to its Firestore record.
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${fileBucket}/o/${encodeURIComponent(filePath)}?alt=media`;

    const galleryRef = db.collection("gallery_images");
    const q = galleryRef.where("imageUrl", "==", downloadUrl).limit(1);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      logger.error(`No Firestore document found for image URL: ${downloadUrl}`);
      return;
    }

    // Update the found document with the generated tags
    const imageDoc = querySnapshot.docs[0];
    await imageDoc.ref.update({
      tags: tags,
      processed: true, // Mark as processed
      visionApiResults: result, // Optional: store the full API response
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
