const {onCall} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const vision = require("@google-cloud/vision");
const logger = require("firebase-functions/logger");

initializeApp();
const client = new vision.ImageAnnotatorClient();

const BUCKET_NAME = "redsracing-a7f8b.firebasestorage.app";

exports.processInvitationCode = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("The function must be called while authenticated.");
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email;
  const {invitationCode, displayName} = request.data;

  if (!displayName) {
      throw new Error("Display name is required.");
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(uid, {displayName: displayName});
  logger.info(`Updated display name for user ${uid} to ${displayName}`);

  await db.collection("users").doc(uid).set({
    uid: uid,
    email: email,
    displayName: displayName,
    createdAt: new Date(),
  });
  logger.info(`Created user document for ${uid}`);

  if (!invitationCode) {
    await auth.setCustomUserClaims(uid, {role: "public-fan"});
    return {status: "success", message: "Public fan role assigned."};
  }

  const codeRef = db.collection("invitation_codes").doc(invitationCode);
  let wasCodeSuccessfullyUsed = false;

  try {
    wasCodeSuccessfullyUsed = await db.runTransaction(async (transaction) => {
      const codeDoc = await transaction.get(codeRef);
      if (!codeDoc.exists || codeDoc.data().used) {
        return false;
      }
      transaction.update(codeRef, {
        used: true,
        usedBy: uid,
        usedAt: new Date(),
      });
      return true;
    });

    if (wasCodeSuccessfullyUsed) {
      await auth.setCustomUserClaims(uid, {role: "team-member"});
      logger.info(`Successfully assigned team-member role to ${uid}`);
      return {status: "success", message: "Team member role assigned."};
    } else {
      await auth.setCustomUserClaims(uid, {role: "public-fan"});
      logger.warn(`User ${uid} attempted to use invalid code. Assigned public-fan role.`);
      return {status: "success", message: "Invalid code. Public fan role assigned."};
    }
  } catch (error) {
    logger.error("Error processing invitation code:", error);
    try {
      await auth.setCustomUserClaims(uid, {role: "public-fan"});
    } catch (claimError) {
      logger.error("Critical: Failed to set default role after error:", claimError);
    }
    throw new Error("An error occurred while processing the invitation code.");
  }
});

exports.generateTags = onObjectFinalized({bucket: BUCKET_NAME}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  logger.info(`Processing file: ${filePath}`);

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

    const pathParts = filePath.split("/");
    if (pathParts.length < 3 || pathParts[0] !== "gallery") {
      return logger.log("Image is not in a user's gallery folder.");
    }
    const uploaderUid = pathParts[1];

    const db = getFirestore();
    const userRef = db.collection("users").doc(uploaderUid);
    const userDoc = await userRef.get();
    const uploaderDisplayName = userDoc.exists ? userDoc.data().displayName : "Anonymous";

    const imageUrl = `https://storage.googleapis.com/${fileBucket}/${filePath}`;
    const q = db.collection("gallery_images").where("imageUrl", "==", imageUrl).limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
      logger.error("No matching document found for image url:", imageUrl);
      return;
    }

    const docRef = snapshot.docs[0].ref;
    await docRef.update({
        tags: labels,
        uploaderDisplayName: uploaderDisplayName,
        approved: true,
    });

    logger.log("Successfully added tags and display name to document:", docRef.id);
  } catch (error) {
    logger.error("Error processing image:", error);
  }
});

exports.sendNotification = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) {
      return res.status(401).send("Unauthorized");
    }

    const decoded = await getAuth().verifyIdToken(match[1]);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).send("Forbidden");
    }

    const { title, body } = req.body || {};
    if (!title || !body) {
      return res.status(400).send("Missing title or body in request");
    }

    const db = getFirestore();
    const tokensSnapshot = await db.collection("fcmTokens").get();
    if (tokensSnapshot.empty) {
      return res.status(200).send("No tokens found.");
    }

    const tokens = tokensSnapshot.docs.map((d) => d.id);
    const payload = { notification: { title, body } };

    const response = await getMessaging().sendToDevice(tokens, payload);
    return res.status(200).send({ success: true, message: `Notification sent to ${response.successCount} devices.` });
  } catch (error) {
    logger.error("sendNotification error:", error);
    return res.status(500).send("Internal Server Error");
  }
});
