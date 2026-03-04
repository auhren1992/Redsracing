# Photo Deletion Permission Fix - Summary

## Problem
Users were getting `FirebaseError: Missing or insufficient permissions` when trying to delete photos from the gallery, even when logged in with admin credentials.

**Error messages:**
```
gallery.js:545 Failed to delete from Firestore: FirebaseError: Missing or insufficient permissions.
gallery.js:562 Error deleting photo: FirebaseError: Missing or insufficient permissions.
```

## Root Cause
The Firestore security rules required users to have the `team-member` or `admin` role set in their Firebase Authentication custom claims. However, users might not have had these claims properly set, or the claims weren't being checked correctly.

## Solution

### 1. Updated Firestore Security Rules
**File:** `firestore.rules`

Added fallback role checks to the `gallery_images` collection rules:

**Before:**
```javascript
allow delete: if hasRole('team-member');
allow update: if hasRole('team-member') || 
  (isAuthenticated() && request.auth.uid == resource.data.uploaderUid);
```

**After:**
```javascript
allow delete: if hasRole('team-member') || hasProfileRole('team-member') || 
  hasRole('admin') || hasProfileRole('admin');
allow update: if hasRole('team-member') || hasProfileRole('team-member') || 
  hasRole('admin') || hasProfileRole('admin') ||
  (isAuthenticated() && request.auth.uid == resource.data.uploaderUid);
```

**What this does:**
- `hasRole()` checks the Firebase Auth token custom claims
- `hasProfileRole()` checks the Firestore `users/{userId}` document as a fallback
- Both `admin` and `team-member` roles can delete and update photos
- Original uploaders can still update their own photos

### 2. Deployed Changes
- ✅ Firestore rules deployed
- ✅ Hosting redeployed with latest code

### 3. Created Admin Setup Tools

Created helper files to set up admin roles:

1. **ADMIN_ROLE_SETUP.md** - Complete guide with 3 options to set admin roles
2. **set-admin-role.js** - Node.js script to quickly bootstrap admin access

## How to Use

### Quick Fix (If you have Firebase CLI access):
```bash
# Run the script with your email
node set-admin-role.js your-email@example.com

# Or edit the default email in the script and run
node set-admin-role.js
```

### Manual Fix (Using Firebase Console):
1. Go to: https://console.firebase.google.com/project/redsracing-a7f8b/firestore
2. Navigate to the `users` collection
3. Find or create a document with your user ID
4. Set the `role` field to `"admin"` or `"team-member"`
5. Sign out and sign back in to refresh your token

### Using Admin Console:
Once you have admin access, you can assign roles to other users:
1. Go to: https://redsracing-a7f8b.web.app/admin-console.html
2. Navigate to "Roles & Invites"
3. Enter email addresses (one per line)
4. Select role and click "Assign Role"

## Testing the Fix

After setting your role:

1. **Sign out and sign back in** (important!)
2. Try to delete a photo from the gallery
3. You should no longer see permission errors

To verify your role:
```javascript
// Run in browser console
firebase.auth().currentUser.getIdTokenResult()
  .then(token => console.log('Your role:', token.claims.role));
```

## Role Hierarchy

- **admin**: Full system access, can assign roles, manage all content
- **team-member**: Can moderate content, delete photos, approve uploads, manage races
- **TeamRedFollower**: Enhanced fan features, community member
- **public-fan**: Basic authenticated user (default)

## Files Modified

1. `firestore.rules` - Updated security rules with fallback role checks
2. `ADMIN_ROLE_SETUP.md` - Documentation for setting up admin access
3. `set-admin-role.js` - Script to bootstrap admin role
4. `PERMISSION_FIX_SUMMARY.md` - This file

## Deployment Status

- ✅ Firestore rules deployed successfully
- ✅ Website hosting deployed
- ✅ Changes live at: https://redsracing-a7f8b.web.app

## Next Steps

1. Set up your admin role using one of the methods above
2. Test photo deletion to verify the fix works
3. Assign roles to other team members as needed
4. Continue with Android app AAB build

## Support

If you still experience permission issues after setting your role and signing back in:
1. Check the browser console for any new error messages
2. Verify your role is set in both Auth custom claims and Firestore
3. Try force-refreshing your token: `firebase.auth().currentUser.getIdToken(true)`
