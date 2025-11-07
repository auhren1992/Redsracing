#!/usr/bin/env node
/**
 * Set Admin Role Script
 * 
 * This script sets the admin role for a user by email.
 * It updates both the Firebase Auth custom claims and the Firestore users collection.
 * 
 * Usage:
 *   node set-admin-role.js your-email@example.com
 * 
 * Or edit the email in this file and run:
 *   node set-admin-role.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  // Credentials will be loaded from GOOGLE_APPLICATION_CREDENTIALS environment variable
  // or from default credentials if running on Google Cloud
});

/**
 * Sets admin role for a user
 * @param {string} email - User's email address
 * @param {string} role - Role to assign (default: 'admin')
 */
async function setAdminRole(email, role = 'admin') {
  try {
    console.log(`🔍 Looking up user with email: ${email}`);
    
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${user.uid}`);
    
    // Set custom claims
    console.log(`🔑 Setting custom claims: role = ${role}`);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    
    // Update Firestore document
    console.log(`💾 Updating Firestore users/${user.uid}`);
    await admin.firestore().collection('users').doc(user.uid).set({
      email: email,
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'set-admin-role-script'
    }, { merge: true });
    
    console.log(`\n✨ Success! Role '${role}' set for ${email}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Have the user sign out and sign back in`);
    console.log(`   2. They should now have ${role} access`);
    console.log(`   3. They can verify by checking token claims in browser console:`);
    console.log(`      firebase.auth().currentUser.getIdTokenResult().then(t => console.log(t.claims))`);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error setting admin role:`, error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\n💡 Tip: Make sure the user has signed up first`);
    } else if (error.code === 'auth/invalid-email') {
      console.error(`\n💡 Tip: Check that the email address is valid`);
    }
    
    process.exit(1);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'auhren1992@gmail.com';

if (!email || !email.includes('@')) {
  console.error('❌ Invalid email address');
  console.error('\nUsage: node set-admin-role.js your-email@example.com');
  process.exit(1);
}

// Run the script
console.log('🚀 Firebase Admin Role Setup\n');
setAdminRole(email);
