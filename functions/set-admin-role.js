const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get email from command line argument or use default
const email = process.argv[2] || 'auhren1992@gmail.com';

admin.auth().getUserByEmail(email)
  .then(user => {
    console.log(`Found user: ${user.email} (${user.uid})`);
    return admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
  })
  .then(() => {
    console.log('✅ Admin role set successfully!');
    console.log('⚠️  User must sign out and sign back in for changes to take effect.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
