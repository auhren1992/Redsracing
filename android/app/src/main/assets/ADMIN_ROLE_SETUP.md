# Admin Role Setup Instructions

## Issue Fixed
The Firestore permission errors when deleting photos have been resolved by updating the security rules to check both:
1. Custom claims on the Firebase Auth token (`role` field)
2. The Firestore `users` collection as a fallback

## What Was Changed
- **firestore.rules**: Updated gallery_images delete and update rules to include fallback checks using `hasProfileRole()` function
- Both `team-member` and `admin` roles can now delete and update photos
- Rules deployed successfully

## Setting Up Your Admin Role

You have 3 options to set your admin role:

### Option 1: Use the Admin Console (Recommended)
1. Go to your admin console: https://redsracing-a7f8b.web.app/admin-console.html
2. Navigate to "Roles & Invites" section in the sidebar
3. In the "Assign Roles" card, enter your email address in the textarea
4. Select "admin" from the role dropdown
5. Click "Assign Role"

**Note**: This requires you to already have an admin role. If this is your first admin setup, use Option 2 or 3.

### Option 2: Use Firebase Console (Bootstrap First Admin)
1. Go to Firebase Console: https://console.firebase.google.com/project/redsracing-a7f8b/firestore
2. Navigate to Firestore Database
3. Find or create the `users` collection
4. Add/Edit your user document:
   - Document ID: Your Firebase Auth UID
   - Fields:
     - `email`: your-email@example.com
     - `role`: "admin"
     - `updatedAt`: (timestamp)

5. Next, you need to set the custom claim using Firebase Functions
6. Go to Firebase Console > Functions
7. Find the `setAdminRole` function
8. In the Cloud Shell or your terminal, run:
```bash
firebase functions:shell
setAdminRole({targetEmail: "your-email@example.com", role: "admin"})
```

### Option 3: Use Firebase CLI to Set Claims Directly
If you have Firebase Admin SDK access, you can run this script:

```javascript
// set-admin-role.js
const admin = require('firebase-admin');
admin.initializeApp();

async function setAdminRole(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    await admin.firestore().collection('users').doc(user.uid).set({
      email: email,
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`Admin role set for ${email}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Replace with your email
setAdminRole('your-email@example.com');
```

Run it with:
```bash
node set-admin-role.js
```

## After Setting Admin Role

1. **Sign out and sign back in** to refresh your authentication token
2. You should now be able to:
   - Delete photos from the gallery
   - Update photo approvals
   - Manage other users' roles via the admin console
   - Access all admin-only features

## Troubleshooting

### Still Getting Permission Errors?
1. Make sure you've signed out and signed back in after setting the role
2. Check your role by opening the browser console and running:
```javascript
firebase.auth().currentUser.getIdTokenResult().then(token => console.log(token.claims));
```
3. Verify your role is set in Firestore at `users/{your-uid}`
4. If needed, force token refresh: 
```javascript
firebase.auth().currentUser.getIdToken(true);
```

### Setting Other Team Members
Once you have admin access, you can use the Admin Console:
1. Go to Roles & Invites section
2. Enter their email(s) - one per line
3. Select role: `team-member` (for moderators) or `admin` (full access)
4. Click "Assign Role"

## Role Types
- **admin**: Full access to all features and can assign roles
- **team-member**: Can moderate content, approve photos, delete photos, manage races
- **TeamRedFollower**: Basic fan access with some interactive features
- **public-fan**: Default role for signed-in users

## Support
If you continue to have issues, check the Firebase Console logs or reach out for additional support.
