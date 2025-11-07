# RedsRacing Android App - Version 3.5 Release Notes

**Version Code:** 25  
**Version Name:** 3.5  
**Build Date:** November 3, 2025  
**Package:** com.redsracing.app

## What's New in Version 3.5

### 🌐 Navigation Consistency Across All Pages

**Critical Fix: Nested navigation now works on ALL pages, not just homepage**

Previously, the nested dropdown navigation structure (Jon/Jonny submenus) was only available on index.html. Users navigating to other pages saw the old flat navigation structure without access to galleries and race results through proper submenus.

#### Pages Updated (14 total):
1. **driver.html** - Jon Kirsch profile page
2. **jonny.html** - Jonny Kirsch profile page  
3. **legends.html** - Team legends
4. **schedule.html** - Race schedule
5. **leaderboard.html** - Championship leaderboard
6. **gallery.html** - Jon's race gallery
7. **jonny-gallery.html** - Jonny's race gallery
8. **jonny-results.html** - Jonny's race results
9. **videos.html** - Race videos
10. **qna.html** - Q&A section
11. **feedback.html** - Feedback form
12. **sponsorship.html** - Sponsorship information
13. **profile.html** - User profile page
14. **index.html** - Homepage (already had it)

### 📱 Consistent User Experience

#### Desktop Navigation (All Pages)
- **Jon Kirsch #8** dropdown with:
  - 👤 Profile (driver.html)
  - 📸 Gallery (gallery.html)
- **Jonny Kirsch #88** dropdown with:
  - 👤 Profile (jonny.html)
  - 📸 Gallery (jonny-gallery.html)
  - 📊 Race Results (jonny-results.html)
- Gallery removed from Racing section (moved to driver-specific)

#### Mobile Navigation (All Pages)
- Nested accordion structure for Jon and Jonny
- Proper indentation and visual hierarchy
- Same submenu structure as desktop

### 🎯 Benefits

- **Seamless navigation** - No confusion when moving between pages
- **Consistent UX** - Same menu structure everywhere
- **Better organization** - Driver content properly grouped
- **Easier access** - Galleries and results always one click away

## Technical Implementation

All 14 pages now have:
- Desktop nested dropdowns with hover/click functionality
- Mobile nested accordions with tap functionality
- Proper CSS classes for nested menu styling
- Event handlers from navigation.js working correctly

## Build Information
- **AAB Location:** `android/app/build/outputs/bundle/release/app-release.aab`
- **File Size:** ~3.8 MB
- **Build Type:** Release (signed with upload key)
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 35 (Android 15)

## Testing Checklist
- ✅ Navigation consistent across all 14 pages
- ✅ Desktop nested dropdowns work on every page
- ✅ Mobile nested accordions work on every page
- ✅ Gallery properly under driver submenus
- ✅ No broken links
- ✅ Sign-in still redirects to home page
- ✅ App builds successfully
- ✅ Version code incremented correctly

## Deployment
- Website deployed to Firebase hosting ✅
- Upload `app-release.aab` to Google Play Console for production release.

## Version History Summary
- v3.2: Fixed schedule display and mobile hotspots
- v3.3: Added nested navigation structure, fixed Jonny content
- v3.4: Fixed critical sign-in and nested menu issues  
- **v3.5: Applied nested navigation to ALL pages (major consistency fix)**
