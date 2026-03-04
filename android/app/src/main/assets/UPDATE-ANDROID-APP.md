# How to Update the Android App

The Android app is standalone and includes all website files bundled locally. When you make changes to the website, follow these steps to update the app.

## Prerequisites

- Android device connected via USB with ADB enabled
- Gradle installed (via Android Studio or standalone)

## Update Steps

### 1. Navigate to Project Root

```powershell
cd C:\Users\Parts\Documents\Desktop\Redsracing
```

### 2. Copy Latest Website Files to Android Assets

```powershell
# Copy HTML, CSS, and JS files
robocopy . "android\app\src\main\assets\www" *.html *.css *.js /S /XD android node_modules .firebase dist functions functions_python .git

# Copy assets folder (images, fonts, etc.)
robocopy "assets" "android\app\src\main\assets\www\assets" /S /XD node_modules

# Copy styles folder
robocopy "styles" "android\app\src\main\assets\www\styles" /S
```

### 3. Rebuild the App

```powershell
cd android
.\gradlew assembleDebug
```

### 4. Install on Device

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Quick One-Liner (from project root)

```powershell
robocopy . "android\app\src\main\assets\www" *.html *.css *.js /S /XD android node_modules .firebase dist functions functions_python .git; robocopy "assets" "android\app\src\main\assets\www\assets" /S /XD node_modules; robocopy "styles" "android\app\src\main\assets\www\styles" /S; cd android; .\gradlew assembleDebug; adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- The app loads files from `https://appassets.androidplatform.net/assets/www/` which maps to the bundled assets
- The app works completely offline and independently from the live website
- Any changes to HTML, CSS, or JavaScript require rebuilding and reinstalling the app
- Firebase backend changes (Firestore, Functions) work immediately without app updates

## Troubleshooting

### Device Not Found
```powershell
adb devices
```
Make sure your device shows up. Enable USB debugging if needed.

### Build Fails
```powershell
cd android
.\gradlew clean
.\gradlew assembleDebug
```

### App Not Updating
Force close the app and clear app data before reinstalling:
```powershell
adb shell pm clear com.redsracing.app
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
