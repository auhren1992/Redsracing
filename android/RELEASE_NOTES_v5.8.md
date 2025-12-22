# Red's Racing Android App - Version 5.8 Release Notes

## Release Information
- **Version Code**: 49
- **Version Name**: 5.8
- **Build Date**: December 18, 2025
- **Bundle Size**: ~4.0 MB
- **Bundle Location**: `android/app/build/outputs/bundle/release/app-release.aab`

## What's New

### 📅 2026 Racing Season Schedule Added
The 2026 race season is here! View the complete tentative schedule for next year.

#### New Features
- **2026 Season Schedule**: Full lineup of American Super Cup races and special events
- **Season Dropdown Selector**: Easily switch between 2026 and 2025 seasons
- **Schedule Disclaimer**: Clear notice that 2026 schedule may change
- **Multi-Season Support**: View current and past season schedules

#### 2026 Schedule Highlights
**Special Events:**
- February 20-22: Milwaukee World of Wheels

**Super Cup Races (11 races):**
- May 25: Grundy County Speedway - Spring Classic
- June 7: Golden Sands Speedway - Memorial Day Show
- July 3: Slinger Speedway
- July 4: Tomah Speedway & LaCrosse Speedway (Back-to-Back)
- July 11: Dells Raceway Park
- July 19: Slinger Speedway - Small Car Nationals
- August 2: Slinger Speedway
- August 15: Dells Raceway Park
- September 6: Dells Raceway Park - Labor Day of Doom
- September 7: Golden Sands Speedway - Labor Day

### 🔄 Schedule Improvements
- **Past Season Access**: View 2025 season history anytime
- **Visual Indicators**: Clear badges for upcoming vs completed races
- **Smart Countdown**: Countdown timer adapts based on selected season
- **Date Sorting**: Races automatically sorted chronologically

### ⚠️ Important Note
The 2026 racing season schedule is tentative and may change. Check back regularly for updates!

## Technical Details
- Removed Performance Racing Industry events from schedule
- Updated schedule data structure to support multiple seasons
- Enhanced schedule handler for better season switching
- Improved UI with disclaimer messaging

## Files Updated
- `data/schedule.json` - Added 2026 season data
- `schedule.html` - Added season selector and disclaimer
- `assets/js/schedule-handler.js` - Multi-season support
- `android/app/build.gradle.kts` - Version bump

## Previous Version
- Version 5.7 (Code 48) - K1 Speed Auto-Updates

---

## For Developers

### Build Command
```bash
cd C:\Users\Parts\Documents\Desktop\Redsracing\android
.\gradlew bundleRelease
```

### Next Steps for Google Play
1. Upload `app-release.aab` to Google Play Console
2. Version: 5.8 (Code 49)
3. Release notes: See "What's New in 5.8" section below

---

## What's New in 5.8 (For Store Listing)

```
📅 2026 SEASON SCHEDULE
• View the complete 2026 American Super Cup race schedule
• Switch between 2026 and 2025 seasons with dropdown selector
• 11 Super Cup races and special events planned
• Schedule subject to change - check regularly for updates

IMPROVEMENTS:
• Multi-season schedule support
• Past season history access (2025)
• Visual indicators for upcoming vs completed races
• Smart countdown adapts to selected season
• Clear disclaimer about schedule changes

Stay tuned for an exciting 2026 season! 🏁
```

---

## Testing Checklist
- [x] Bundle builds successfully
- [x] 2026 schedule displays correctly
- [x] Season dropdown switches between 2026/2025
- [x] Disclaimer message shows for 2026 season
- [x] Countdown timer works for active season
- [x] Past season shows "Season Complete" message
- [x] All schedule data synced to Android assets

## Known Issues
None

## Notes
- 2026 schedule is tentative and may be updated as dates are confirmed
- Start times currently listed as "TBD" for most 2026 races
- Performance Racing Industry events removed per user request
