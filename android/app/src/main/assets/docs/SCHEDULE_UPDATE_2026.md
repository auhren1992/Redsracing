# 2026 Race Schedule Update

## Summary
Updated the race schedule to include the 2026 season while preserving the 2025 season history with a dropdown selector.

## Changes Made

### 1. Schedule Data Structure (`data/schedule.json`)
**New Structure:**
- Changed from single-season format to multi-season format
- Added `currentSeason: 2026`
- Added `seasons` array containing both 2026 and 2025 seasons
- Each season has:
  - `year`: Season year
  - `isActive`: Boolean indicating if it's the current season
  - `races`: Array of race objects

### 2. 2026 Season Schedule
Based on the tentative 2026 schedule, added:

**Special Events:**
- Dec 11-13, 2025: Performance Racing Industry Show (Indianapolis, IN)
- Feb 20-22, 2026: Milwaukee World of Wheels (Milwaukee, WI)

**Super Cup Races:**
- May 25 (Mon): Grundy County Speedway - Spring Classic
- June 7 (Sun): Golden Sands Speedway - Memorial Day Show
- July 3 (Fri): Slinger Speedway
- July 4 (Sat): Tomah Speedway - 4th of July Show (Back-to-Back)
- July 4 (Sat): LaCrosse Speedway - 4th of July Show (Back-to-Back)
- July 11 (Sat): Dells Raceway Park
- July 19 (Sun): Slinger Speedway - Small Car Nationals
- August 2 (Sun): Slinger Speedway
- August 15 (Sat): Dells Raceway Park
- September 6 (Sun): Dells Raceway Park - Labor Day of Doom (Back to Back)
- September 7 (Mon): Golden Sands Speedway - Labor Day (Back-to-Back)

### 3. UI Updates (`schedule.html`)
**Added Season Selector:**
- Dropdown menu to switch between 2026 and 2025 seasons
- Styled to match the modern UI theme
- Located above the schedule grid
- Automatically populates with available seasons

### 4. New JavaScript Handler (`assets/js/schedule-handler.js`)
**Features:**
- Loads multi-season schedule data
- Populates dropdown with available seasons
- Displays races for selected season
- Separates Super Cup races from Special Events
- Updates countdown timer based on active season
- Shows "Season Complete" message for past seasons
- Marks past races vs upcoming races
- Sorts races chronologically

### 5. 2025 Season (Preserved)
Kept the following 2025 races for historical reference:
- Oct 12, 2025: Sycamore Speedway - Fall Nationals
- Nov 2, 2025: Rockford Speedway - Championship Weekend
- Dec 6, 2025: Milwaukee Mile - Holiday Classic

## Files Modified

### Website
- `data/schedule.json` - Complete restructure with multi-season support
- `assets/js/schedule-handler.js` - New standalone handler (created)
- `schedule.html` - Added season selector dropdown

### Android App
- `android/app/src/main/assets/www/data/schedule.json` - Synced
- `android/app/src/main/assets/www/assets/js/schedule-handler.js` - Synced
- `android/app/src/main/assets/www/schedule.html` - Synced

## How It Works

1. **On Page Load:**
   - Fetches `data/schedule.json`
   - Populates season dropdown with available years
   - Displays the current/active season (2026)

2. **Season Selection:**
   - User selects a season from dropdown
   - Schedule grid updates to show that season's races
   - Countdown updates based on season:
     - Active season: Shows countdown to next race
     - Past season: Shows "Season Complete" message

3. **Race Display:**
   - Super Cup races appear in left column
   - Special Events appear in right column
   - Past races are dimmed with "Completed" badge
   - Upcoming races are highlighted with "Upcoming" badge
   - Races sorted chronologically

## Testing

### Website
1. Visit: `schedule.html`
2. Should default to showing 2026 Season
3. Use dropdown to switch to 2025 Season
4. Verify races display correctly for each season
5. Check countdown timer behavior

### Android App
1. Navigate to Schedule section
2. Test same functionality as website

## Notes

- All start times for 2026 are listed as "TBD" as they weren't specified in the source
- Friday Night Grundy Speedway Super Cups noted as "Coming Soon" (not included in schedule yet)
- 27th Annual Championship Banquet noted as "TBD" (not included in schedule)
- The schedule is marked as "Tentative" - updates can be made as dates/times are confirmed

## Future Enhancements

Possible improvements:
- Add track information/links
- Add weather widget for upcoming races
- Enable filtering by track or event type
- Add calendar export (iCal) functionality
- Integration with Firestore for dynamic updates
