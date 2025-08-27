const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * A callable function that processes a user's invitation code upon signup.
 *
 * This function checks if a provided invitation code is valid and unused.
 * If it is, it assigns the 'team-member' custom claim to the user.
 * Otherwise, it assigns the 'public-fan' custom claim.
 * It also marks the invitation code as used to prevent reuse.
 *
 * @param {object} data The data passed to the function, expecting { invitationCode: string }.
 * @param {object} context The context of the function call, containing auth information.
 * @returns {object} A result object indicating success or failure.
 */
exports.processInvitationCode = functions.https.onCall(async (data, context) => {
  // 1. Check if the user is authenticated. If not, throw an error.
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
    );
  }

  const uid = context.auth.uid;
  const invitationCode = data.invitationCode;

  // 2. If no invitation code is provided, assign 'public-fan' role and exit.
  if (!invitationCode) {
    await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
    return {status: "success", message: "Public fan role assigned."};
  }

  const db = admin.firestore();
  const codeRef = db.collection("invitation_codes").doc(invitationCode);
  let wasCodeSuccessfullyUsed = false;

  try {
    // 3. Run a transaction to safely check and claim the invitation code.
    wasCodeSuccessfullyUsed = await db.runTransaction(async (transaction) => {
      const codeDoc = await transaction.get(codeRef);
      if (!codeDoc.exists || codeDoc.data().used) {
        return false; // Code is invalid or already used.
      }
      // Code is valid, so claim it in the transaction.
      transaction.update(codeRef, {
        used: true,
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true; // Return true to indicate success.
    });

    // 4. Set custom claims based on the transaction's outcome.
    if (wasCodeSuccessfullyUsed) {
      await admin.auth().setCustomUserClaims(uid, {role: "team-member"});
      console.log(`Successfully assigned team-member role to ${uid}`);
      return {status: "success", message: "Team member role assigned."};
    } else {
      await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
      console.log(`User ${uid} attempted to use invalid code. Assigned public-fan role.`);
      return {status: "success", message: "Invalid code. Public fan role assigned."};
    }
  } catch (error) {
    console.error("Error processing invitation code:", error);
    // As a safe fallback, assign 'public-fan' role if anything goes wrong.
    try {
      await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
    } catch (claimError) {
      console.error("Critical: Failed to set default role after error:", claimError);
    }
    // Throw an internal error to the client.
    throw new functions.https.HttpsError(
        "internal",
        "An error occurred while processing the invitation code.",
    );
  }
});

const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient();

exports.generateTags = functions.storage.object().onFinalize(async (object) => {
    const bucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType.startsWith("image/")) {
        return functions.logger.log("This is not an image.");
    }

    if (!filePath.startsWith("gallery/")) {
        return functions.logger.log("This is not a gallery image.");
    }

    const gcsUri = `gs://${bucket}/${filePath}`;

    try {
        const [result] = await client.labelDetection(gcsUri);
        const labels = result.labelAnnotations.map(label => label.description);

        functions.logger.log(`Labels for ${filePath}:`, labels);

        const db = admin.firestore();
        const imageUrl = `https://storage.googleapis.com/${bucket}/${filePath}`;

        const q = db.collection("gallery_images").where("imageUrl", "==", imageUrl).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            functions.logger.error("No matching document found for image url:", imageUrl);
            return;
        }

        const docRef = snapshot.docs[0].ref;
        await docRef.update({ tags: labels, approved: true }); // Auto-approve for now

        functions.logger.log("Successfully added tags to document:", docRef.id);

    } catch (error) {
        functions.logger.error("Error processing image:", error);
    }
});
