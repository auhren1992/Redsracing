# RedsRacing Android App - Version 6.1 Release Notes

**Version:** 6.1 (Build 52)  
**Release Date:** December 19, 2024

## 🐛 Bug Fixes

### Admin Console Navigation
- **Fixed Analytics Section Display**: Resolved issue where clicking "Analytics" in the admin console would incorrectly show the Overview section instead
- **Fixed Video Management Navigation**: Video Management section now properly displays video controls instead of showing Overview content
- **Improved Section Routing**: Enhanced navigation handler to correctly route all admin console sections including Analytics, Videos, Q&A, and Media Gallery

### Race Management
- **Fixed Invalid Date Display**: Race dates now display correctly in Race Management instead of showing "Invalid Date"
- **Removed Duplicate Events**: Cleaned up 3 duplicate Milwaukee World of Wheels entries from the schedule
- **Fixed Schedule Data Source**: Race Management now correctly displays the race schedule from the races collection with proper season filtering (2026)

### Mobile App Stability
- **Fixed Team Page Errors**: Resolved "Cannot set properties of null" error on team.html countdown timer
- **Fixed Unsafe Navigation**: Added team.html to allowed navigation paths to prevent navigation errors
- **Enhanced Schedule Loading**: Improved schedule.json loading in Android WebView with multi-path fallback and better error handling

## 🎨 UI Improvements

### Admin Console
- **Analytics Dashboard**: New dedicated Analytics section with Google Analytics and Firebase Analytics integration status
- **Better Section Separation**: Each admin section (Overview, Analytics, Race Management, etc.) now displays distinct content
- **Enhanced Overview Stats**: Overview dashboard now shows accurate race counts and next race information with live countdown

## 📊 Analytics & Tracking

### Page View Tracking
- **New Analytics Tracker**: Implemented analytics-tracker.js to track visitor data across the website
- **13 Pages Tracked**: Added tracking to index, team, driver, jonny, jons, schedule, gallery, leaderboard, feedback, qna, videos, sponsorship, and legends pages
- **Visitor Metrics**: Tracks page views, unique visitors, sessions, referrers, screen resolutions, and user agents
- **Privacy-Focused**: Skips tracking on localhost for development

## 🔧 Technical Improvements

- **Better Error Handling**: Enhanced error logging and validation for schedule loading and race data display
- **Firestore Timestamp Support**: Improved date handling for Firestore Timestamp objects throughout the admin console
- **Navigation Consistency**: Unified navigation behavior across all admin sections with proper hash routing
- **Code Optimization**: Removed duplicate function calls and improved section visibility management

## 📝 Known Issues

- Q&A Management requires a Firestore index to be created (link provided in console when accessing the section)
- Analytics data will populate once visitors interact with the tracked pages

## 🚀 What's Next

- Full analytics dashboard with real-time visitor statistics
- Enhanced race results management
- Additional admin tools and reporting features

---

**Installation:** Upload app-release.aab to Google Play Console  
**Minimum Android Version:** 7.0 (API 24)  
**Target Android Version:** 14 (API 35)
