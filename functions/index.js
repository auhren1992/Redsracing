const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.processInvitationCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
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
      await admin.auth().setCustomUserClaims(uid, { role: "team-member" });
      return { status: "success", message: "Team member role assigned." };
    } else {
      await admin.auth().setCustomUserClaims(uid, { role: "public-fan" });
      return { status: "success", message: "Invalid code. Public fan role assigned." };
    }

  } catch (error) {
    console.error("Error processing invitation code:", error);
    try {
      await admin.auth().setCustomUserClaims(uid, { role: "public-fan" });
    } catch (claimError) {
      console.error("Critical: Failed to set default role after error:", claimError);
    }
    throw new functions.https.HttpsError("internal", "An error occurred while processing the code.");
  }
});