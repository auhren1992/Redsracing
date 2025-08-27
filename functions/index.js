const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {logger} = require("firebase-functions");

admin.initializeApp({
  storageBucket: "redsracing-a7f8b.appspot.com"
});

const client = new vision.ImageAnnotatorClient();
const db = admin.firestore();

exports.processInvitationCode = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  const invitationCode = request.data.invitationCode;

  if (!invitationCode) {
    await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
    return {status: "success", message: "Public fan role assigned."};
  }

  const codeRef = db.collection("invitation_codes").doc(invitationCode);
  
  try {
    const wasCodeSuccessfullyUsed = await db.runTransaction(async (transaction) => {
      const codeDoc = await transaction.get(codeRef);
      if (!codeDoc.exists || codeDoc.data().used) {
        return false;
      }
      transaction.update(codeRef, {
        used: true,
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (wasCodeSuccessfullyUsed) {
      await admin.auth().setCustomUserClaims(uid, {role: "team-member"});
      logger.log(`Successfully assigned team-member role to ${uid}`);
      return {status: "success", message: "Team member role assigned."};
    } else {
      await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
      logger.log(`User ${uid} attempted to use invalid code. Assigned public-fan role.`);
      return {status: "success", message: "Invalid code. Public fan role assigned."};
    }
  } catch (error) {
    logger.error("Error processing invitation code:", error);
    try {
      await admin.auth().setCustomUserClaims(uid, {role: "public-fan"});
    } catch (claimError) {
      logger.error("Critical: Failed to set default role after error:", claimError);
    }
    throw new HttpsError(
        "internal",
        "An error occurred while processing the invitation code.",
    );
  }
});

exports.generateTags = onObjectFinalized({region: "us-central1", cpu: 2}, async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!contentType.startsWith("image/")) {
        return logger.log("This is not an image.");
    }

    if (!filePath.startsWith("gallery/")) {
        return logger.log("This is not a gallery image.");
    }

    const gcsUri = `gs://${fileBucket}/${filePath}`;

    try {
        const [result] = await client.labelDetection(gcsUri);
        const labels = result.labelAnnotations.map((label) => label.description);
        
        logger.log(`Labels for ${filePath}:`, labels);

        const imageUrl = `https://storage.googleapis.com/${fileBucket}/${filePath}`;
        
        const q = db.collection("gallery_images").where("imageUrl", "==", imageUrl).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            logger.error("No matching document found for image url:", imageUrl);
            return;
        }

        const docRef = snapshot.docs[0].ref;
        await docRef.update({ tags: labels, approved: true });

        logger.log("Successfully added tags to document:", docRef.id);

    } catch (error) {
        logger.error("Error processing image:", error);
    }
});