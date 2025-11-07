# RedsRacing Android App - Version 3.4 Release Notes

**Version Code:** 24  
**Version Name:** 3.4  
**Build Date:** November 3, 2025  
**Package:** com.redsracing.app

## What's New in Version 3.4

### 🔧 Critical Fixes

#### Sign-In Black Screen Fixed
- **Issue:** After signing in, app showed black screen instead of home page
- **Fix:** Changed sign-out redirect from `login.html` to `index.html`
- **Result:** Signing in now properly displays the home page

#### Nested Dropdown Menus Now Work
- **Issue:** Driver submenus (Jon/Jonny) showed but couldn't be opened
- **Fix:** Added click event handlers for nested dropdown toggles (`.dropdown-nested-toggle`)
- **Implementation:**
  - Detects clicks on nested menu items
  - Toggles visibility of nested submenus
  - Closes other nested menus when opening a new one
  - Properly handles CSS display, visibility, and opacity
  - Outside click closes all nested menus

### 📱 App Navigation Improvements
- Nested dropdowns now fully functional on mobile
- Smooth transitions for nested menu open/close
- Better event handling to prevent conflicts
- Proper z-index and positioning for nested menus

### 🎯 User Experience
- Home page loads immediately after sign-in
- Driver submenus work as expected with hover/click
- Clean navigation flow throughout the app

## Technical Changes

### navigation.js Updates
1. **Sign-in redirect fix:**
   - Line 102: `window.location.href = 'index.html';` (was login.html)
   - Line 109: `window.location.href = 'index.html';` (was login.html)

2. **Nested dropdown functionality:**
   - Added `nestedToggleBtn` detection in click handler
   - Added logic to show/hide `.dropdown-menu-nested` elements
   - Close all nested menus on outside click
   - Proper CSS manipulation for visibility

### File Updates
- `navigation.js` - Fixed sign-in redirect and nested dropdown functionality
- All navigation structures remain from v3.3

## Build Information
- **AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`
- **File Size:** ~3.8 MB
- **Build Type:** Release (signed with upload key)
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 35 (Android 15)

## Testing Checklist
- ✅ Sign-in shows home page (not black screen)
- ✅ Nested driver menus open on click
- ✅ Jon Kirsch submenu (Profile, Gallery) works
- ✅ Jonny Kirsch submenu (Profile, Gallery, Results) works
- ✅ Desktop and mobile navigation both functional
- ✅ Outside clicks close menus properly
- ✅ App builds successfully with no errors
- ✅ Version code incremented correctly

## Deployment
- Website deployed to Firebase hosting ✅
- Upload `app-release.aab` to Google Play Console for production release.

## Known Improvements from Previous Versions
- v3.2: Fixed schedule display and mobile hotspots
- v3.3: Added nested navigation structure, fixed Jonny content
- v3.4: Fixed critical sign-in and nested menu issues
