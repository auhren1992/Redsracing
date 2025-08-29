const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

admin.initializeApp();
const client = new vision.ImageAnnotatorClient();

const processInvitationCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const uid = context.auth.uid;
  const invitationCode = data.invitationCode;

  if (!invitationCode) {
    await admin.auth().setCustomUserClaims(uid, { role: "public-fan" });
    return { status: "success", message: "Public fan role assigned." };
  }

  const db = admin.firestore();
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
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (wasCodeSuccessfullyUsed) {
      await admin.auth().setCustomUserClaims(uid, { role: "team-member" });
      return { status: "success", message: "Team member role assigned." };
    } else {
      await admin.auth().setCustomUserClaims(uid, { role: "public-fan" });
      return {
        status: "success",
        message: "Invalid code. Public fan role assigned.",
      };
    }
  } catch (error) {
    try {
      await admin.auth().setCustomUserClaims(uid, { role: "public-fan" });
    } catch {}
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while processing the invitation code."
    );
  }
});

const generateTags = functions.storage.object().onFinalize(async (object) => {
  const bucket = object.bucket;
  const filePath = object.name;
  const contentType = object.contentType || "";


  if (!contentType.startsWith("image/")) return functions.logger.log("This is not an image.");
  if (!filePath || !filePath.startsWith("gallery/")) return functions.logger.log("This is not a gallery image.");


  const gcsUri = `gs://${bucket}/${filePath}`;


  try {
    const [result] = await client.labelDetection(gcsUri);
    const labels = (result.labelAnnotations || []).map((l) => l.description).filter(Boolean);


    const db = admin.firestore();
    const imageUrl = `https://storage.googleapis.com/${bucket}/${filePath}`;
    const snap = await db.collection("gallery_images").where("imageUrl", "==", imageUrl).limit(1).get();
    if (snap.empty) return functions.logger.error("No matching document found for image url:", imageUrl);


    await snap.docs[0].ref.update({ tags: labels, approved: true });
    functions.logger.log("Successfully added tags to document:", snap.docs[0].id);
  } catch (err) {
    functions.logger.error("Error processing image:", err);
  }
});

const sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");


    // Require Firebase ID token in Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) return res.status(401).send("Unauthorized");


    const decoded = await admin.auth().verifyIdToken(match[1]);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).send("Forbidden");
    }


    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).send("Missing title or body in request");


    const db = admin.firestore();
    const tokensSnapshot = await db.collection("fcmTokens").get();
    if (tokensSnapshot.empty) return res.status(200).send("No tokens found.");


    const tokens = tokensSnapshot.docs.map((d) => d.id);
    const payload = { notification: { title, body } };


    const response = await admin.messaging().sendToDevice(tokens, payload);
    return res.status(200).send({ success: true, message: `Notification sent to ${response.successCount} devices.` });
  } catch (error) {
    console.error("sendNotification error:", error);
    return res.status(500).send("Internal Server Error");
  }
});

exports.processInvitationCode = processInvitationCode;
exports.generateTags = generateTags;
exports.sendNotification = sendNotification;

module.exports = {
  processInvitationCode,
  generateTags,
  sendNotification,
};