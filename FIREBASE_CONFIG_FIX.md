# Firebase Configuration Fix - Cloud Run to Functions Migration

## Issue Fixed
**Error**: `Cloud Run service handleSendFeedback does not exist in region us-central1 in this project.`

## Root Cause
The firebase.json configuration was set up to deploy Python functions as **Cloud Run services** using the `"run"` configuration, but these functions are actually **Firebase Functions** written in Python. Firebase was trying to find Cloud Run services that don't exist, causing deployment failures.

## Solution Applied

### 1. Updated firebase.json Configuration
Changed from Cloud Run service references to Firebase Functions references:

**Before (incorrect)**:
```json
{
  "source": "/send_feedback_email",
  "run": {
    "serviceId": "handleSendFeedback",
    "region": "us-central1"
  }
}
```

**After (correct)**:
```json
{
  "source": "/send_feedback_email", 
  "function": {
    "functionId": "handleSendFeedback",
    "codebase": "python-api"
  }
}
```

### 2. Fixed Functions Affected
- `handleSendFeedback` - Feedback form submission
- `handleAddSubscriber` - Newsletter subscription  
- `handleSendSponsorship` - Sponsorship inquiry form
- All other Python functions (profile, achievements, leaderboard)

### 3. Updated Frontend API Calls
Updated JavaScript files to use correct endpoints that match firebase.json routing:
- `assets/js/feedback.js`: `/handleSendFeedback` → `/send_feedback_email`
- `assets/js/sponsorship.js`: `/handleSendSponsorship` → `/send_sponsorship_email`  
- `assets/js/main.js`: `/handleAddSubscriber` → `/add_subscriber`

### 4. Fixed Data Field Mapping
Corrected data field mismatches in sponsorship form:
- Frontend: `companyName` → Backend: `company`
- Frontend: `contactName` → Backend: `name`

## Verification
- ✅ All 10 function references in firebase.json are valid
- ✅ All 8 frontend API calls are properly routed
- ✅ Python function syntax validated
- ✅ Node.js function syntax validated
- ✅ Dependencies installed successfully

## Files Modified
- `firebase.json` - Updated function routing configuration
- `assets/js/feedback.js` - Updated API endpoint
- `assets/js/sponsorship.js` - Updated API endpoint and data fields
- `assets/js/main.js` - Updated API endpoint

This fix ensures that Firebase Hosting properly routes requests to Firebase Functions instead of trying to find non-existent Cloud Run services.