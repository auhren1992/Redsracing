# RedsRacing Android App - Version 3.2 Release Notes

**Version Code:** 22  
**Version Name:** 3.2  
**Build Date:** November 3, 2025  
**Package:** com.redsracing.app

## What's New in Version 3.2

### 🏁 Schedule Page Improvements
- **Fixed race recap display issue** where HTML content was showing as plain text
- Race recaps now properly display formatted results and summaries
- Added cache-busting for schedule.js to ensure latest updates load

### 📱 Mobile UI Enhancements
- **Optimized "Meet the Beast" interactive section** on driver.html
  - Reduced hotspot button sizes for better mobile display (2rem on tablets, 1.75rem on phones)
  - Made info panels smaller and more readable on mobile devices
  - Improved text sizing for better mobile readability
  - Adjusted padding and spacing for mobile optimization

### 🔧 Technical Improvements
- Enhanced HTML template handling to prevent content escaping
- Improved responsive design for car showcase interactive elements
- Better font sizing and layout on small screens

## File Updates
- `schedule.html` - Updated cache-busting version
- `schedule.js` - Fixed HTML rendering issue
- `driver.html` - Included latest version with interactive car showcase
- `hotspot-3d.css` - Optimized for mobile devices

## Build Information
- **AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`
- **File Size:** ~3.7 MB
- **Build Type:** Release (signed with upload key)
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 35 (Android 15)

## Testing Checklist
- ✅ Schedule page displays race recaps properly
- ✅ Interactive car hotspots display at appropriate size on mobile
- ✅ Info panels readable on small screens
- ✅ App builds successfully with no errors
- ✅ Version code incremented correctly

## Deployment
Upload `app-release.aab` to Google Play Console for production release.
