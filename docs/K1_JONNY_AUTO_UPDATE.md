# K1 Speed Auto-Update System for Jonny Kirsch

## Overview
This document describes the automatic update system for Jonny Kirsch's K1 Speed Junior League stats from the Addison location.

## What Was Implemented

### 1. Backend Cloud Functions (functions/index.js)

#### `fetchK1AddisonJonnyJunior`
- **Type**: HTTP endpoint
- **URL**: `/k1/addison/junior/jonny`
- **Purpose**: Fetches Jonny's current Junior League standings from https://www.k1speed.com/addison-junior-league-results.html
- **Returns**: JSON with `{ ok, season, gpPoints, total, matchedName }`
- **Firestore**: Persists data to `k1_stats/jonny_addison_junior_2025`

#### `k1AutoRefreshAddisonJonny`
- **Type**: Scheduled function
- **Schedule**: Every 12 hours
- **Purpose**: Automatically scrapes and updates Jonny's stats in Firestore
- **Data Stored**:
  - name: "Jonny Kirsch"
  - season: 2025
  - location: "Addison"
  - series: "Junior League"
  - gpPoints: array of points per GP
  - total: total points
  - place: championship standing
  - updatedAt: timestamp

### 2. Frontend Updates (assets/js/k1-stats-jonny.js)
- Calls the new backend endpoint `/k1/addison/junior/jonny`
- Falls back to local JSON files if backend is unavailable
- Displays:
  - Championship standing (place)
  - Total points
  - Individual GP points breakdown
  - Best lap, average lap, and session count

### 3. Data Files
- **data/k1_jonny_addison_2025.json**: Updated with current stats
  - GP Points: [8, 1, 16, 4, 8, 13, 8, 12, 5]
  - Total: 75 points

### 4. Firebase Hosting Configuration
- Added URL rewrite in `firebase.json` to route `/k1/addison/junior/jonny` to the cloud function

## Current Stats (as of last update)
- **Total Points**: 75
- **GP Breakdown**: 
  - GP1: 8
  - GP2: 1
  - GP3: 16
  - GP4: 4
  - GP5: 8
  - GP6: 13
  - GP7: 8
  - GP8: 12
  - GP9: 5

## Deployment Instructions

### Step 1: Deploy Cloud Functions
```powershell
cd C:\Users\Parts\Documents\Desktop\Redsracing
firebase deploy --only functions:fetchK1AddisonJonnyJunior,functions:k1AutoRefreshAddisonJonny
```

### Step 2: Deploy Hosting (for URL rewrites)
```powershell
firebase deploy --only hosting
```

### Step 3: Verify Deployment
1. Check the cloud function is live:
   ```powershell
   curl https://redsracing-a7f8b.web.app/k1/addison/junior/jonny
   ```

2. Visit Jonny's page on the website to see the updated stats:
   - Website: https://redsracing-a7f8b.web.app/jonny.html
   - Look for the "Karting Stats (Addison)" section

### Step 4: Android App Update
The changes have already been synced to:
- `android/app/src/main/assets/www/assets/js/k1-stats-jonny.js`
- `android/app/src/main/assets/www/data/k1_jonny_addison_2025.json`

To deploy the Android app update:
1. Increment version in `android/app/build.gradle`
2. Build and publish to Google Play Store

## Automatic Updates
The system automatically updates every 12 hours via the `k1AutoRefreshAddisonJonny` scheduled function. The scheduler:
- Runs at 12-hour intervals (timezone: America/Chicago)
- Scrapes the K1 Speed website
- Updates Firestore with latest stats
- No manual intervention required

## Monitoring
To check the last update time:
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Look at `k1_stats/jonny_addison_junior_2025`
4. Check the `updatedAt` field

## Troubleshooting

### Stats Not Updating
1. Check Cloud Functions logs in Firebase Console
2. Verify the K1 Speed website structure hasn't changed
3. Manually trigger the function:
   ```powershell
   curl https://us-central1-redsracing-a7f8b.cloudfunctions.net/fetchK1AddisonJonnyJunior
   ```

### Frontend Not Showing Data
1. Check browser console for errors
2. Verify the endpoint is responding
3. Check if local JSON fallback is working

## Future Enhancements
- Add multi-season support (like the adult league implementation)
- Add historical tracking
- Display more detailed race-by-race stats
- Add notifications when Jonny moves up in standings
