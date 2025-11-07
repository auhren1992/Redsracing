# RedsRacing Android App - Version 3.3 Release Notes

**Version Code:** 23  
**Version Name:** 3.3  
**Build Date:** November 3, 2025  
**Package:** com.redsracing.app

## What's New in Version 3.3

### 🧭 Navigation Overhaul
- **Nested dropdown menus for drivers**
  - Jon Kirsch #8 now has a submenu with Profile and Gallery
  - Jonny Kirsch #88 now has a submenu with Profile, Gallery, and Race Results
  - Cleaner organization of driver-specific content
- **Gallery moved from Racing section to driver-specific sections**
  - Jon's gallery now accessible under Jon Kirsch menu
  - Jonny's gallery accessible under Jonny Kirsch menu
- **Mobile navigation enhanced**
  - Added nested accordion structure for driver submenus
  - Improved visual hierarchy and indentation

### 🏁 Jonny Kirsch Updates
- **Fixed missing race results and gallery on Jonny page**
  - Updated racer-schedule.js with latest race data
  - Updated jonny-kids.js for interactive features
  - Updated k1-stats-jonny.js for K1 Speed stats
  - Updated cms-render.js for content rendering
  - Updated jonny-gallery.js for gallery display
- **Updated race data files**
  - jonny-2025-speedhive-results.json
  - k1_jonny_addison_2025.json
  - k1_jonny_addison_history.json

### 🎨 CSS Improvements
- Added nested dropdown hover effects for desktop
- Added nested accordion styles for mobile
- Smooth transitions and animations for nested menus
- Better visual indicators (chevron icons) for nested items

### 📱 Mobile Experience
- Nested menu items properly indented (32px for level 2, 60px for level 3)
- Proper max-height transitions for smooth expand/collapse
- Background differentiation for nested levels

## File Updates
- `index.html` - Updated navigation structure
- `modern-nav.css` - Added nested dropdown/accordion styles
- `jonny.html` - Latest version with all features
- `racer-schedule.js` - Updated with latest data
- `jonny-kids.js` - Updated interactive features
- `k1-stats-jonny.js` - Updated K1 stats
- `cms-render.js` - Updated content rendering
- `jonny-gallery.js` - Updated gallery functionality
- Data files: `jonny-2025-speedhive-results.json`, `k1_jonny_addison_*.json`

## Build Information
- **AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`
- **File Size:** ~3.8 MB
- **Build Type:** Release (signed with upload key)
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 35 (Android 15)

## Testing Checklist
- ✅ Desktop navigation shows nested dropdowns on hover
- ✅ Mobile navigation shows nested accordions on tap
- ✅ Gallery moved from Racing to driver-specific sections
- ✅ Jonny race results now displaying correctly
- ✅ Jonny gallery now displaying correctly
- ✅ All navigation links functional
- ✅ App builds successfully with no errors
- ✅ Version code incremented correctly

## Deployment
- Website deployed to Firebase hosting ✅
- Upload `app-release.aab` to Google Play Console for production release.
