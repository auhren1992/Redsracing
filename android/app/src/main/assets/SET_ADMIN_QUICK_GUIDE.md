# Quick Admin Role Setup - auhren1992@gmail.com

## 🚀 Fastest Method: Firebase Console

Since you already have Firebase access, the quickest way is through the Firebase Console:

### Step 1: Set Role in Firestore
1. Go to: https://console.firebase.google.com/project/redsracing-a7f8b/firestore/databases/-default-/data/~2F
2. Navigate to the `users` collection
3. Find your user document (search for `auhren1992@gmail.com`)
   - If it doesn't exist, create a new document with your Firebase Auth UID as the document ID
4. Add/Update these fields:
   - `email`: auhren1992@gmail.com
   - `role`: admin (type: string)
   - `updatedAt`: Click "Add field" > Field type: timestamp > Click "Set to current time"

### Step 2: Call Cloud Function to Set Custom Claims
Open your browser console at https://redsracing-a7f8b.web.app and run:

```javascript
// First, get the functions module
const functions = firebase.functions();

// Call the setUserRole function
functions.httpsCallable('setUserRole')({
  emails: ['auhren1992@gmail.com'],
  role: 'admin'
}).then(result => {
  console.log('✅ Success!', result);
}).catch(error => {
  console.error('❌ Error:', error);
  // If this fails, try the alternative method below
});
```

**Alternative if you're not yet admin:**
```javascript
// Use the setAdminRole function which allows initial setup
const functions = firebase.functions();
functions.httpsCallable('setAdminRole')({
  targetEmail: 'auhren1992@gmail.com',
  role: 'admin'
}).then(result => {
  console.log('✅ Success!', result);
}).catch(error => {
  console.error('❌ Error:', error);
});
```

### Step 3: Sign Out and Back In
1. Click "Sign Out" in the admin console
2. Sign back in with `auhren1992@gmail.com`
3. Your auth token will now have the admin role

### Step 4: Verify It Works
Open browser console and run:
```javascript
firebase.auth().currentUser.getIdTokenResult().then(token => {
  console.log('Your role:', token.claims.role);
  // Should show: "admin"
});
```

### Step 5: Test Photo Deletion
1. Go to the gallery page
2. Try to delete a photo
3. Should work without permission errors! ✅

---

## 🔧 Alternative: Using Firebase CLI

If you prefer command line:

```bash
# 1. Start Firebase functions shell
firebase functions:shell

# 2. In the shell, run:
setUserRole({emails: ['auhren1992@gmail.com'], role: 'admin'})

# 3. Exit with Ctrl+C
```

---

## ✅ Quick Verification Checklist

After setup:
- [ ] Firestore `users/{uid}` document has `role: "admin"`
- [ ] Signed out and back in
- [ ] Browser console shows `role: "admin"` in token claims
- [ ] Can delete photos without permission errors
- [ ] Can access "Roles & Invites" section in admin console
- [ ] Can assign roles to other users

---

## 🎯 What You Can Do Now

With admin access, you can:
- ✅ Delete and moderate photos
- ✅ Approve/reject photo submissions
- ✅ Add and edit race results
- ✅ Manage user roles
- ✅ Create invitation codes
- ✅ Access all admin console features
- ✅ Upload to Google Play Store

---

## 💡 Troubleshooting

### "Permission Denied" errors
- Make sure you signed out and back in after setting the role
- Try force-refreshing token: `firebase.auth().currentUser.getIdToken(true)`

### Cloud function fails
- The function expects you to already have some role or be the initial setup email
- Use the Firestore method first, then sign out/in, then the function will work

### Still not working?
1. Check Firebase Console > Authentication > find your user
2. Verify email is correct: `auhren1992@gmail.com`
3. Check Firestore > users collection > your UID document
4. Clear browser cache and try again

---

## 📞 Need Help?

If you're still having issues:
1. Check Firebase Console error logs
2. Look for errors in browser console (F12)
3. Verify you're using the correct email
4. Make sure you're signed in with the right account

---

**Your Email**: auhren1992@gmail.com  
**Target Role**: admin  
**Project**: redsracing-a7f8b

Good luck! 🏁
