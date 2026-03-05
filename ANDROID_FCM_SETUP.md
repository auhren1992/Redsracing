# Android FCM Setup - Final Step

## Required File
You need to download `google-services.json` from the Firebase Console and place it at:
```
android/app/google-services.json
```

## How to Get the File
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your Redsracing project
3. Go to Project Settings (gear icon)
4. Under "Your apps", find your Android app
5. Download `google-services.json`
6. Place it in `android/app/` directory

## What's Already Done
✅ Firebase Cloud Messaging dependencies added to build.gradle
✅ FCM service created (`MyFirebaseMessagingService.kt`)
✅ Push notification handling implemented
✅ App version checking implemented  
✅ Version reporting to Firestore implemented
✅ AndroidManifest configured for FCM
✅ Notification icons and channels configured
✅ Topic subscription (all_users, android_users)

## Testing After Adding File
1. Build the Android app:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

2. The app will now:
   - Subscribe to FCM topics on launch
   - Report its version to Firestore `app_usage` collection
   - Check for updates from Firestore `app_config/android_version`
   - Receive push notifications sent from admin console
   - Show update dialogs when new versions are available

## Push Notification Flow
1. Admin sends notification via admin console
2. Notification is saved to Firestore `push_notifications` collection
3. You'll need a Cloud Function to read from `push_notifications` and send via FCM API
4. App receives the notification and displays it

## Alternative: Direct FCM API Call
If you want to send push notifications immediately without Cloud Functions, you can use Firebase Admin SDK from a Node.js backend or use the Firebase Console directly.
