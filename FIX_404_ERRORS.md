# Firebase Functions 404 Error Fix

## Problem Description

Users were experiencing 404 errors when accessing profile-related endpoints:
- `GET /profile/{userId}` - Profile retrieval  
- `PUT /update_profile/{userId}` - Profile updates
- `GET /achievements` - Achievement loading

The console showed errors like:
```
profile.html:278 GET https://www.redsracing.org/profile/vP5NvbWzZfa8yYTaYrKxLxqTaUw1 404 (Not Found)
profile.html:327 PUT https://www.redsracing.org/update_profile/vP5NvbWzZfa8yYTaYrKxLxqTaUw1 404 (Not Found)  
profile.html:778 GET https://www.redsracing.org/achievements 404 (Not Found)
```

## Root Cause

The Firebase Functions in `functions_python/main.py` were failing to load during deployment because the Mailgun client was initialized at module import time:

```python
# This line caused the entire module to fail if MAILGUN_API_KEY was missing
mg = Client(api_key=os.environ.get("MAILGUN_API_KEY"), domain="mg.redsracing.org")
```

When the `MAILGUN_API_KEY` environment variable was not properly configured in the Firebase deployment, the entire module would fail to import, causing all functions to return 404 errors.

## Solution

Implemented lazy initialization of the Mailgun client so that profile and achievement functions can work independently of email configuration:

### Before (Problematic):
```python
mg = Client(api_key=os.environ.get("MAILGUN_API_KEY"), domain="mg.redsracing.org")
```

### After (Fixed):
```python
# Initialize Mailgun client lazily to avoid import failures if API key is missing
mg = None

def get_mailgun_client():
    """Get or initialize the Mailgun client."""
    global mg
    if mg is None:
        api_key = os.environ.get("MAILGUN_API_KEY")
        if not api_key:
            raise ValueError("MAILGUN_API_KEY environment variable is required for email functionality")
        mg = Client(api_key=api_key, domain="mg.redsracing.org")
    return mg
```

## Files Changed

- `functions_python/main.py` - Modified Mailgun client initialization and updated email functions

## Testing

Run the comprehensive test to verify the fix:

```bash
python3 test_404_fix.py
```

Expected output:
```
🎉 All tests passed! The 404 fix should resolve the deployment issues.
```

## Deployment Instructions

1. **Deploy the updated functions:**
   ```bash
   firebase deploy --only functions:python-api
   ```

2. **Verify the fix works:**
   - Visit your site's profile page (`/profile.html`)
   - Check browser console - should see successful API calls or proper 404 handling instead of network errors
   - Profile functionality should work even if MAILGUN_API_KEY is not configured

3. **Configure email functionality (optional):**
   If you want email features to work, ensure `MAILGUN_API_KEY` is properly configured in Firebase Functions secrets.

## Expected Results

After deployment:
- ✅ Profile endpoints should return proper HTTP responses (200 for existing profiles, 404 for non-existent)
- ✅ Achievement endpoints should return available achievements (200) or empty array
- ✅ Update profile endpoints should work for authenticated users
- ✅ Console errors about "Failed to fetch" should be resolved
- ✅ Email functions will only fail if actually called without MAILGUN_API_KEY configured

## Backward Compatibility

This fix is fully backward compatible:
- Email functionality works exactly the same when MAILGUN_API_KEY is properly configured
- Profile and achievement functionality now works independently of email configuration
- Existing error handling in `profile.html` continues to work as expected

## Technical Notes

- The fix uses lazy initialization to defer Mailgun client creation until actually needed
- Only email-related functions (`handleSendFeedback`, `handleSendSponsorship`) require MAILGUN_API_KEY
- Profile functions (`handleGetProfile`, `handleUpdateProfile`, `handleGetAchievements`) work without email configuration
- The change maintains the same security model - MAILGUN_API_KEY is still required for email functions