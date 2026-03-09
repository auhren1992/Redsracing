# Android Workflow Setup Guide

This guide explains how to set up GitHub Secrets for the automated Android build and upload workflow.

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### 1. ANDROID_KEYSTORE_BASE64
Your Android signing keystore encoded in base64.

**How to create:**
```bash
# Navigate to android directory
cd android

# Encode the keystore file to base64
# On Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks"))

# On macOS/Linux:
base64 -i upload-keystore.jks
```

Copy the entire output and paste it as the secret value.

### 2. REDSRACING_KEYSTORE_PASSWORD
The password for your keystore file (already set in your current secrets).

### 3. REDSRACING_KEY_PASSWORD
The password for the upload key alias (already set in your current secrets).

### 4. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
A Google Play service account JSON key for uploading to Google Play Console.

**How to create:**

1. **Go to Google Play Console**
   - https://play.google.com/console

2. **Enable Google Play Developer API**
   - Go to Google Cloud Console: https://console.cloud.google.com
   - Select your project (or create one linked to Play Console)
   - Enable "Google Play Android Developer API"

3. **Create Service Account**
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: `github-actions-uploader` (or similar)
   - Click "Create and Continue"
   - Skip granting roles (we'll do this in Play Console)
   - Click "Done"

4. **Create JSON Key**
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON" format
   - Click "Create" - this downloads the JSON file

5. **Grant Permissions in Play Console**
   - Go to Google Play Console
   - Settings → API access
   - Link the Google Cloud project (if not already linked)
   - Find your service account in the list
   - Click "Grant Access"
   - Select these permissions:
     - **Releases**: View app information and download bulk reports (read-only), Manage releases to testing tracks
     - **App Access**: View app information (read-only)
   - Click "Invite User" → "Send Invite"

6. **Add to GitHub Secrets**
   - Open the downloaded JSON file
   - Copy the ENTIRE content (all the JSON)
   - Paste it as the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret

## How the Workflow Works

The workflow automatically:
1. ✅ Builds the Android App Bundle (.aab)
2. ✅ Signs it with your keystore
3. ✅ Uploads to Google Play Console Internal Testing track
4. ✅ Saves the .aab file as an artifact (downloadable for 30 days)

## Triggering the Workflow

The workflow runs automatically when:
- You push changes to the `android/**` directory
- You push changes to the workflow file itself

You can also trigger it manually:
```bash
# Using GitHub CLI
gh workflow run android-build.yml

# Or via GitHub website
# Actions tab → Android Build → Run workflow
```

## Troubleshooting

### Keystore Issues
If you get signing errors, verify:
- The base64-encoded keystore is correct
- The passwords match your actual keystore passwords
- The keystore file exists at `android/upload-keystore.jks` in your local setup

### Google Play Upload Issues
If upload fails:
- Verify service account has correct permissions in Play Console
- Make sure the service account JSON is valid and complete
- Check that the app is already created in Play Console (first upload must be manual)
- Ensure version code is higher than previous uploads

### Build Failures
- Check the Actions tab for detailed logs
- Verify all dependencies in `build.gradle.kts` are available
- Ensure JDK 17 compatibility

## Testing

After setup, trigger a test build:
```bash
gh workflow run android-build.yml
```

Monitor at: https://github.com/auhren1992/Redsracing/actions

## Notes

- First app upload to Play Console MUST be done manually
- Subsequent builds can be uploaded automatically
- The workflow uploads to **Internal Testing** track by default
- You can promote builds from Internal → Alpha → Beta → Production in Play Console
- Artifacts are kept for 30 days and can be downloaded from Actions tab
