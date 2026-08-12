# Android Workflow Setup Guide

This guide explains how to set up GitHub Secrets for the automated Android build and upload workflow.

## Security (read this first)

- **Never** commit service account JSON to git, paste it in issues/chat, or put it in Firebase Hosting.
- **Only** store the full JSON in **GitHub Actions → Secrets → `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`**.
- If a private key was exposed anywhere **public** (chat, screenshot, ticket): in **Google Cloud Console → IAM → Service accounts → your account → Keys**, **delete** that key, **Add key → Create new key → JSON**, then update the GitHub secret with the new file contents.

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
  - [https://play.google.com/console](https://play.google.com/console)
2. **Enable Google Play Developer API**
  - Go to Google Cloud Console: [https://console.cloud.google.com](https://console.cloud.google.com)
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
5. **Grant the service account access in Play Console**
  Play Console no longer centers this under **Settings** for everyone. Use **Users and permissions**:
  - Open [Google Play Console](https://play.google.com/console) → **Users and permissions** (from the left nav / account menu).
  - **Invite new users** (or open the existing row if you already invited this email).
  - Enter the `**client_email`** from your JSON (looks like `name@YOUR_PROJECT_ID.iam.gserviceaccount.com`).
  - **Critical — app access:** the account must be allowed to change **this** app (`com.redsracing.app`). When you pick a role (e.g. **Release manager**), use **App permissions** / **Apps** and include your Reds Racing listing, not “no apps” or only another package.
  - Permissions must include creating/editing releases on **testing tracks** (including **Closed testing**; the API track Gradle uses is `alpha`). **Release manager** or **Admin** on the app is typical. Exact labels vary by console version.
  - Send the invite. Service accounts do not “accept” email; access applies once the user appears as **Active** in **Users and permissions**.
   Optional: some accounts still have **Settings → Developer account → API access** to link a Cloud project; if you see it, link the **same** GCP project where you created the service account and where **Google Play Android Developer API** is enabled.
6. **Add to GitHub Secrets**
  - Open the downloaded JSON file.
  - Copy the **entire** JSON.
  - Paste it as the `**GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`** secret.
   The **Android Build** workflow maps that secret to the environment variable `**ANDROID_PUBLISHER_CREDENTIALS`**, which is what **Gradle Play Publisher 3.x** reads. (The old `-Pplay.serviceAccountCredentials=...` path is optional; the env var is the primary CI path.)

## How the Workflow Works

The workflow automatically:

1. ✅ Builds the Android App Bundle (.aab)
2. ✅ Signs it with your keystore
3. ✅ Uploads the bundle to Google Play **closed testing** (Play Developer API track `alpha` — see `android/app/build.gradle.kts` `play { track }`)
4. ✅ Saves the .aab file as an artifact (downloadable for 30 days)

## Triggering the Workflow

The workflow runs automatically when:

- You push changes to the `android/`** directory
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

### `403`: "Version code N has already been used"

Play never accepts the same `versionCode` twice (even if a prior CI run only partially committed an edit). Fix:

1. Bump **both** platforms together: Android `versionCode` / `versionName` and iOS `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION` (keep them equal).
2. Update `.github/NEW_MACHINE_SETUP.md` “Latest mobile release”.
3. Sync Firestore: `GOOGLE_APPLICATION_CREDENTIALS=functions/serviceAccountKey.json node scripts/sync-app-version-config.mjs` (or Admin → Releases → Sync config to seen).
4. Re-run **Android Build**.

The workflow uploads the signed `.aab` as an Actions artifact **before** Play publish, so you can still download the bundle when this error occurs.

### `400` / `FAILED_PRECONDITION`: "This edit has expired" / "This edit has been deleted"

The Play Developer API allows **only one active edit** per app (`com.redsracing.app`) at a time. If another CI run, Play Console session, or API client opens a new edit while upload is in progress, the first edit is invalidated mid-upload.

What CI already does:

1. **Concurrency** — `android-build.yml` uses `concurrency.group: android-play-publish` with `cancel-in-progress: false` so publishes queue instead of overlapping.
2. **Fast publish** — after `bundleRelease`, upload uses `publishBundle --artifact-dir app/build/outputs/bundle/release` so Gradle does not rebuild during the edit window.
3. **Retries** — transient edit expired/deleted / `FAILED_PRECONDITION` failures retry up to 3 times with backoff.

If it still fails after retries:

- Avoid editing the same app in Play Console while the workflow is uploading.
- Confirm no other automation uses the same Play service account against this package at the same time.
- Re-run **Actions → Android Build → Run workflow**.

### `403` / `PERMISSION_DENIED` on `.../applications/com.redsracing.app/edits`

Gradle Play Publisher is **authenticated** (otherwise you would see credential errors), but Play Console is **denying** that principal permission to open an **edit** for this app.

Fix in **Play Console** (not in Gradle):

1. Open **Users and permissions** → find the user whose email matches the `**client_email`** in your JSON (the workflow log also prints `Play Publisher principal: …` for the same value).
2. Open that user → **App permissions** (or **Account permissions** + per-app access, depending on UI). Ensure `**com.redsracing.app`** / your Reds Racing app is included with a role that can **manage releases** (e.g. **Release manager** on that app).
3. If you only granted **account-level** access with **no apps**, or a different app, you will get this `403` until you add this app.
4. Confirm **Google Play Android Developer API** is enabled in the **same** Google Cloud project as the service account (`APIs & services → Library`).
5. After changing permissions, wait a few minutes and re-run the workflow.

### Build Failures

- Check the Actions tab for detailed logs
- Verify all dependencies in `build.gradle.kts` are available
- Ensure JDK 17 compatibility

## Testing

After setup, trigger a test build:

```bash
gh workflow run android-build.yml
```

Monitor at: [https://github.com/auhren1992/Redsracing/actions](https://github.com/auhren1992/Redsracing/actions)

## Notes

- First app upload to Play Console MUST be done manually
- Subsequent builds can be uploaded automatically
- The workflow uploads to **closed testing** by default (API track `**alpha`** in `android/app/build.gradle.kts`; in Play Console this is the default **Closed testing** track).
- If you use multiple closed tracks or renamed tracks, confirm in Play Console that `**alpha`** is the track you want; change `play { track.set("…") }` if your default closed track differs.
- You can promote builds between testing tracks and production in Play Console.
- Artifacts are kept for **90 days** (see `android-build.yml`) and can be downloaded from the Actions tab

