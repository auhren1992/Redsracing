# Red's Racing Android App - Version 5.9 Release Notes

## Release Information
- **Version Code**: 50
- **Version Name**: 5.9
- **Build Date**: December 18, 2025
- **Bundle Size**: ~4.0 MB
- **Bundle Location**: `android/app/build/outputs/bundle/release/app-release.aab`

## What's New

### 🏁 2026 Season Preparation Complete
Major updates to prepare the app for the upcoming 2026 racing season!

#### Team Updates
- **Jonny Kirsch Profile Updated**: Focus shifted to his 2026 rookie track racing debut
  - Removed K1 Speed goals and progress (K1 remains but site focuses on track racing)
  - Added 4 new rookie season goals:
    - First Track Racing Season (karting to full-size cars transition)
    - Learn & Adapt (master fundamentals)
    - Complete Every Race (build consistency)
    - Race with Dad (compete together as Team RedsRacing)
  - Updated badge to "2026 Rookie Season"
  - Corrected subtitle: "Rookie Driver | Making His Track Racing Debut"
  
- **Team Page Spacing**: Reduced excessive spacing between sections for better readability

- **Profile Links Fixed**: Full Profile buttons now correctly link to driver pages
  - Jon Kirsch → driver.html
  - Jonny Kirsch → jonny.html

#### Sponsor Updates
- **Removed**: Paul Ries & Sons
- **Current Sponsors**: OK1 Automotive, StepUp Construction

### 🎯 Dynamic Race Countdown
- **Homepage Countdown**: Now automatically displays the next upcoming 2026 race from Firestore
- **First Race**: Spring Classic at Grundy County Speedway (May 25, 2026)
- **Admin Sync**: Admin panel countdown matches homepage countdown
- **Navigation**: Added "Countdown" link to return to homepage from any page

### 🏆 Complete Race Management System
- **Firestore Integration**: All race data now managed through Firebase
  - 2026 races loaded from Firestore
  - Auto-filtered by season (2026 only)
  - Proper display of event names, tracks, and locations
  
- **Race Results System Overhaul**:
  - Direct Firestore integration (replaced Python API)
  - Schedule dropdown auto-fills race details
  - Stats display: Total Races, This Season, Jon's Wins, Jonny's Wins
  - Refresh and season/driver filters working correctly
  - Default season changed to 2026

- **Migration Tool**: Created tool for importing schedule data to Firestore
  - 14 races successfully imported for 2026 season
  - Duplicate checking prevents data duplication

### 🔒 Security
- **Firestore Rules**: Updated to allow team members to manage races and results

## Technical Details

### Files Updated
- `team.html` - Spacing, Jonny section, sponsor updates, profile links
- `index.html` - Dynamic countdown from Firestore
- `admin-console.html` - Race results system overhaul
- `assets/js/redsracing-dashboard.js` - Race filtering, countdown sync
- `migrate-schedule.html` - New migration tool
- `firestore.rules` - Security rules for team member access
- `android/app/build.gradle.kts` - Version bump to 5.9 (Code 50)

### Database
- Firestore collections: `races`, `race_results`
- Race fields: date, track, city, state, eventName, startTime, type, season, createdAt
- Result fields: driverId, driverName, carNumber, raceDate, trackName, trackLocation, season, raceType, startPosition, finishPosition, points, fastestLap, weather, notes, incidents, createdAt, createdBy

## Previous Version
- Version 5.8 (Code 49) - 2026 Season Schedule Added

---

## What's New in 5.9 (For Store Listing)

```
🏁 2026 SEASON PREPARATION
• Jonny Kirsch profile updated for 2026 rookie track racing debut
• New rookie season goals focused on track racing
• Team page spacing improvements for better readability
• Profile links fixed and verified

📅 DYNAMIC RACE COUNTDOWN
• Homepage now shows the next 2026 race automatically
• Spring Classic at Grundy County Speedway (May 25, 2026)
• Countdown navigation link added to all pages
• Admin panel countdown synchronized with homepage

🏆 RACE MANAGEMENT SYSTEM
• Complete Firestore integration for race data
• 2026 races auto-filtered and displayed
• Race results system overhaul with stats tracking
• Schedule dropdown auto-fills race details
• Real-time sync between admin panel and website

✨ UPDATES
• Sponsor updates (Paul Ries & Sons removed)
• Database security rules updated
• Migration tools for schedule management

Ready for the 2026 racing season! 🏁
```

---

## Testing Checklist
- [x] Bundle builds successfully
- [x] Team.html updates display correctly
- [x] Jonny's rookie goals show properly
- [x] Full Profile links navigate correctly
- [x] Homepage countdown shows Spring Classic
- [x] Admin panel countdown matches homepage
- [x] Countdown navigation works from all pages
- [x] Race management displays 2026 races only
- [x] Race results system functional
- [x] Stats calculation working
- [x] Sponsor section shows 2 sponsors
- [x] Team page spacing reduced

## Known Issues
None

## Notes
- Focus shifted to track racing for Jonny (K1 Speed still active but not primary)
- 2026 schedule is tentative and may be updated as dates are confirmed
- All race data now managed through Firestore for real-time updates
- Migration tool available for importing schedule data
