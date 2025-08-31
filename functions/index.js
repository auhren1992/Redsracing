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
    logger.info("Step 1: Finding invitation code document by ID.");
    const codeDoc = await codesRef.doc(code).get();

    if (!codeDoc.exists) {
      logger.warn(`Invitation code document with ID '${code}' not found for user ${uid}.`);
      throw new HttpsError("not-found", "The invitation code you entered is invalid. Please check the code and try again.");
    }

    const codeData = codeDoc.data();
    logger.info("Step 1 Complete: Found code document.", {codeData});

    logger.info("Step 2: Checking code validity (expiration and uses).");
    const now = new Date();
    if (codeData.expiresAt && codeData.expiresAt.toDate() < now) {
      logger.warn(`Expired invitation code '${code}' used by ${uid}.`);
      throw new HttpsError("deadline-exceeded", "This invitation code has expired.");
    }

    if (codeData.usesLeft !== undefined && codeData.usesLeft <= 0) {
      logger.warn(`Depleted invitation code '${code}' used by ${uid}.`);
      throw new HttpsError("resource-exhausted", "This invitation code has no uses left.");
    }
    logger.info("Step 2 Complete: Code is valid.");

    const roleToAssign = codeData.role || "public-fan";
    logger.info(`Step 3: Assigning role '${roleToAssign}' to user ${uid}.`);
    await auth.setCustomUserClaims(uid, {role: roleToAssign});
    logger.info("Step 3 Complete: Custom claims set.");

    if (codeData.usesLeft) {
      logger.info(`Step 4: Updating code document uses for code '${code}'.`);
      await codeDoc.ref.update({
        usesLeft: FieldValue.increment(-1),
        usersWhoClaimed: FieldValue.arrayUnion({uid: uid, claimedAt: new Date()}),
      });
      logger.info("Step 4 Complete: Code document updated.");
    }

    logger.info(`Step 5: Updating user's public profile (users/${uid}).`);
    await db.collection("users").doc(uid).set({
      role: roleToAssign,
    }, {merge: true});
    logger.info("Step 5 Complete: User profile updated.");


    return {status: "success", message: `Role '${roleToAssign}' assigned successfully.`};
  } catch (error) {
    logger.error(`Error at some step for user ${uid}:`, error);
    // If it's already an HttpsError, rethrow it. Otherwise, wrap it.
    if (error instanceof HttpsError) {
      throw error;
    } else {
      throw new HttpsError("internal", "An internal error occurred while processing the code.", error);
    }
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
  bucket: "redsracing-a7f8b.appspot.com", // Explicitly specify the bucket
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
