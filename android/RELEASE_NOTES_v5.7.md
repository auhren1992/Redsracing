# Red's Racing Android App - Version 5.7 Release Notes

## Release Information
- **Version Code**: 48
- **Version Name**: 5.7
- **Build Date**: December 3, 2025
- **Bundle Size**: ~3.99 MB
- **Bundle Location**: `android/app/build/outputs/bundle/release/app-release.aab`

## What's New

### 🏁 K1 Speed Auto-Update System for Jonny Kirsch
Jonny's K1 Speed Junior League stats now update automatically!

#### Features
- **Automatic Updates**: Stats refresh every 12 hours from K1 Speed's website
- **Real-time Data**: See Jonny's latest championship standing and points
- **Enhanced Display**: 
  - Championship position
  - Total season points (currently 75)
  - Individual Grand Prix breakdown
  - Best lap times and session count

#### Current Stats (2025 Junior League)
- **Total Points**: 75
- **GP Results**: 
  - GP1: 8 points
  - GP2: 1 point
  - GP3: 16 points
  - GP4: 4 points
  - GP5: 8 points
  - GP6: 13 points
  - GP7: 8 points
  - GP8: 12 points
  - GP9: 5 points

### Technical Improvements
- Integrated with Firebase Cloud Functions for live data fetching
- Fallback to local data if network unavailable
- Optimized data loading and caching

## Backend Updates
- New Cloud Function: `fetchK1AddisonJonnyJunior`
- New Scheduled Function: `k1AutoRefreshAddisonJonny` (runs every 12 hours)
- Firestore integration for stats persistence

## Files Updated
- `assets/js/k1-stats-jonny.js` - Enhanced stats display
- `data/k1_jonny_addison_2025.json` - Updated with current season data
- Firebase Functions - Added automatic scraping and updates

## Deployment Notes
- Firebase Functions deployed and active
- Hosting configuration updated with new API routes
- All changes synced to Android assets

## Known Issues
- K1 Speed website uses Airtable embed for 2025 data which requires HTML table parsing enhancement
- Local JSON fallback ensures data is always available

## Testing
- Verified bundle builds successfully
- Firebase Functions deployed and responding
- Stats display on Jonny's profile page

## Next Steps for Google Play
1. Upload `app-release.aab` to Google Play Console
2. Update store listing with new feature highlights
3. Submit for review

## Previous Version
- Version 5.6 (Code 47)

---

## For Developers

### Build Command
```bash
cd C:\Users\Parts\Documents\Desktop\Redsracing\android
.\gradlew bundleRelease
```

### Firebase Deploy
```bash
cd C:\Users\Parts\Documents\Desktop\Redsracing
firebase deploy --only functions,hosting
```

### Related Documentation
- See `docs/K1_JONNY_AUTO_UPDATE.md` for full technical documentation
- Deployment script: `deploy-k1-jonny.ps1`
