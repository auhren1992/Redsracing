# Live Race Features - Installation Guide

## ✅ Created Files

1. **live-race-admin.html** - Mobile admin panel for track updates
2. **live-race-widget.html** - Real-time widget for fans
3. **VOICE-UPDATE-SETUP.md** - Voice assistant setup guide

## 📋 Installation Steps

### 1. Add Live Widget to Homepage

Edit `index.html` and add this right after the hero section:

```html
<!-- Live Race Widget -->
<?php include 'live-race-widget.html'; ?>
```

Or if not using PHP, copy/paste the entire content of `live-race-widget.html` into `index.html` after line ~200 (after hero section).

### 2. Add Firestore Security Rules

Edit `firestore.rules` and add:

```javascript
// Live race updates
match /live_race/{document} {
  // Anyone can read live race data
  allow read: if true;
  
  // Only authenticated team members can write
  allow write: if request.auth != null && 
    (request.auth.token.role == 'admin' || 
     request.auth.token.role == 'team-member');
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 3. Add Voice Update Function

Edit `functions/index.js` and add at the end (before the last closing brace):

```javascript
/**
 * Voice-activated race update webhook
 */
exports.voiceRaceUpdate = onRequest({ secrets: ["SENTRY_DSN"] }, async (req, res) => {
  cors(req, res, async () => {
    try {
      const apiKey = req.body?.key || req.query?.key;
      if (apiKey !== process.env.VOICE_UPDATE_KEY) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
      }

      const db = getFirestore();
      const raceRef = db.collection('live_race').doc('current');
      const raceDoc = await raceRef.get();
      
      if (!raceDoc.exists) {
        res.status(404).json({ error: 'No active race session' });
        return;
      }

      const updates = {};
      const { driver, position, lap, event } = req.body || req.query;
      
      if (driver && position) {
        if (driver === 'jon' || driver === 'Jon') {
          updates['drivers.jon.position'] = position;
        } else if (driver === 'jonny' || driver === 'Jonny') {
          updates['drivers.jonny.position'] = position;
        }
      }
      
      if (lap) updates.currentLap = parseInt(lap);
      if (event) {
        updates.event = event;
        updates.eventTimestamp = FieldValue.serverTimestamp();
      }
      
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid updates' });
        return;
      }

      updates.lastUpdate = FieldValue.serverTimestamp();
      await raceRef.update(updates);
      
      logger.info('Voice race update:', updates);
      res.status(200).json({ success: true, updates });
      
    } catch (error) {
      logger.error('Voice update error:', error);
      try { Sentry.captureException(error); } catch (_) {}
      res.status(500).json({ error: 'Update failed' });
    }
  });
});
```

Deploy function:
```bash
cd functions
npm install
cd ..
firebase deploy --only functions:voiceRaceUpdate
```

### 4. Copy Files to Android/iOS Apps

**Android:**
```bash
cp live-race-admin.html android/app/src/main/assets/www/
cp live-race-widget.html android/app/src/main/assets/www/
```

**iOS:** 
The iOS app loads from redsracing.org, so no copy needed!

### 5. Update Versions

**Android** (`android/app/build.gradle.kts`):
```kotlin
versionCode = 106
versionName = "10.6"
```

**iOS** (`ios/RedsRacing.xcodeproj/project.pbxproj`):
```
CURRENT_PROJECT_VERSION = 101;
MARKETING_VERSION = 10.1;
```

### 6. Build & Deploy

```bash
# Website
firebase deploy --only hosting

# Android
cd android
./gradlew bundleRelease

# iOS
# Open Xcode and build

# Commit
git add -A
git commit -m "Add live race features v10.6"
git push origin main
```

## 🎯 How to Use

### At the Track:
1. Open `https://redsracing.org/live-race-admin.html` on your phone
2. Login with your account
3. Enter track name and lap info
4. Update positions and tap "POST UPDATE"
5. Fans see updates instantly!

### Voice Updates (Optional):
See `VOICE-UPDATE-SETUP.md` for Siri/Google Assistant setup

## 📱 What Fans See

When you post an update, fans visiting the website see:
- Real-time position updates
- Lap counter
- Gap to leader
- Race events (green flag, caution, etc.)
- Last update timestamp

Widget appears automatically when race is live!

## 🔒 Security

- Admin panel requires login
- Voice updates require API key
- Firestore rules prevent unauthorized writes
- Live data is public (read-only for fans)

## ✨ Features

- ✅ Mobile-optimized admin panel
- ✅ Real-time updates (no refresh needed)
- ✅ Voice assistant support
- ✅ Works on Android & iOS apps
- ✅ Automatic show/hide when race active
- ✅ Update log with timestamps
- ✅ Quick race event buttons

## 📊 Next Steps

After deploying, test by:
1. Opening admin panel and starting a "test" race
2. Posting some updates
3. Opening homepage in another tab to see live widget
4. Ending the race session
5. Confirming widget disappears

Need help? Check Firebase console logs for any errors.
