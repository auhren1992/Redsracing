const admin = require("firebase-admin");

// Path to your service account key
const serviceAccount = require("./service-account-key.json");

// The email address of the user you want to make a team member
const userEmail = process.argv[2];

if (!userEmail) {
  console.error("Please provide an email address as an argument.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setTeamMemberRole() {
  try {
    const user = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'team-member' });
    console.log(`Success! Custom claim 'team-member' set for ${userEmail}`);
  } catch (error) {
    console.error("Error setting custom claim:", error);
    process.exit(1);
  }
}

setTeamMemberRole();