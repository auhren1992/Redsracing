# Firebase Configuration Files - Download Guide

## 🔥 Step 1: Download google-services.json (Android)

### Quick Steps:
1. Open Firebase Console: https://console.firebase.google.com/
2. Select your **Redsracing** project
3. Click the **⚙️ gear icon** (top left) → **Project settings**
4. Scroll down to **"Your apps"** section
5. Find the Android app icon with package name: `com.redsracing.app`
6. Click the **"google-services.json"** button to download
7. **Save the file to:** `C:\Users\Parts\Documents\Desktop\Redsracing\android\app\google-services.json`

### If You Don't See the Android App:
If the app doesn't exist in Firebase yet:
1. Click **"Add app"** → Android icon
2. Package name: `com.redsracing.app`
3. App nickname: `Redsracing Android`
4. Click **"Register app"**
5. Download `google-services.json`
6. Click **"Next"** through remaining steps (dependencies already added)

---

## 🍎 Step 2: Download GoogleService-Info.plist (iOS)

### Quick Steps:
1. In the same Firebase Console → Project settings
2. In **"Your apps"** section, find the iOS app
3. Click the **"GoogleService-Info.plist"** button to download
4. **Save the file to:** `C:\Users\Parts\Documents\Desktop\Redsracing\ios\Redsracing\GoogleService-Info.plist`

### If You Don't See the iOS App:
1. Click **"Add app"** → iOS icon
2. Bundle ID: `com.redsracing.app` (or your iOS bundle ID)
3. App nickname: `Redsracing iOS`
4. App Store ID: (leave blank for now)
5. Click **"Register app"**
6. Download `GoogleService-Info.plist`
7. Click **"Next"** through remaining steps

---

## ✅ After Downloading Both Files

### Verify Files Exist:
```powershell
# Check Android file
Test-Path "C:\Users\Parts\Documents\Desktop\Redsracing\android\app\google-services.json"

# Check iOS file
Test-Path "C:\Users\Parts\Documents\Desktop\Redsracing\ios\Redsracing\GoogleService-Info.plist"
```

### Build Android App:
```powershell
cd C:\Users\Parts\Documents\Desktop\Redsracing\android
.\build-with-fcm.ps1
```

### iOS Setup:
Follow the complete instructions in `IOS_FCM_SETUP.md`

---

## 🎯 What Happens After Setup

### Android App Will:
- ✅ Subscribe to FCM topics (`all_users`, `android_users`)
- ✅ Report app version to Firestore automatically
- ✅ Check for updates on every launch
- ✅ Receive push notifications from admin console

### iOS App Will:
- ✅ Subscribe to FCM topics (`all_users`, `ios_users`)
- ✅ Report app version to Firestore automatically  
- ✅ Check for updates on every launch
- ✅ Receive push notifications from admin console

### Admin Console Can:
- ✅ See version distribution for both platforms
- ✅ Set minimum and latest versions
- ✅ Send push notifications to Android, iOS, or both
- ✅ Track which users are on outdated versions

---

## 🆘 Troubleshooting

**Can't find Firebase project?**
- Make sure you're logged into the correct Google account
- Check project name matches your deployment

**Download button not showing?**
- You may need to re-add the app (it won't duplicate)
- Ensure you're in "Project settings" not "Console home"

**Wrong package name?**
- Android must be: `com.redsracing.app`
- Check `android/app/build.gradle.kts` applicationId if unsure
