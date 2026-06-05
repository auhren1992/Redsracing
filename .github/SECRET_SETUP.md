# GitHub Actions — repository secrets

Keep this repo **private**. Names below are **references only** (never paste secret values into issues or chat).

## Android (`android-build.yml`)

| Secret | In your repo? | Purpose |
|--------|----------------|--------|
| `ANDROID_KEYSTORE_BASE64` | Yes | Base64 of upload keystore; decoded to `upload-keystore.jks` during CI. |
| `REDSRACING_KEYSTORE_PASSWORD` | Yes | Keystore password for `bundleRelease`. |
| `REDSRACING_KEY_PASSWORD` | Yes | Key password for signing. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | **Not listed** — add if you use the Play upload step | Play Console service account JSON (full text). Step skips upload if unset. |
| `GOOGLE_SERVICES_JSON` | **Optional** — add when ready | Full JSON → overwrites `android/app/google-services.json` before Gradle. If unset, CI uses the file from Git. |

#### Play Console — permissions for that service account (`Users and permissions`)

Scope the user to **this app** (`com.redsracing.app`), then turn on **App permissions** in this order (Play’s own banner asks for the read-only line first):

1. **View app information and download in bulk reports (read-only)** — enable **before** stronger permissions if the console shows the warning you saw (“not able to edit… select read-only first”).
2. **Release apps to testing tracks** — required for CI to upload AABs and manage **testing tracks** (Internal, **Closed** / API `alpha`, Open / `beta`). CI uses **`track = alpha`** (Play Console default **Closed testing**). It does **not** grant production rollout.
3. Leave **Release to production…** off unless you explicitly want this identity able to ship to production.

Optional: **Manage testing tracks and edit tester lists** only if you need that account to change tester lists or closed/open track settings; not required for a straight `publishBundle` upload.

### Download the signed Android bundle (.aab)

Every successful **Android Build** run uploads a downloadable artifact:

1. Open [Actions → Android Build](https://github.com/auhren1992/Redsracing/actions/workflows/android-build.yml).
2. Click the latest successful run (or **Run workflow** to build on demand).
3. Scroll to **Artifacts** at the bottom.
4. Download the artifact named like `reds-racing-aab-v{versionName}-b{versionCode}` (a zip file).
5. Unzip and upload `app-release.aab` to [Google Play Console](https://play.google.com/console).

The run summary also repeats these steps. Artifacts are kept for **90 days** (see workflow).

## iOS (`ios-build.yml`)

| Secret | In your repo? | Purpose |
|--------|----------------|--------|
| `APPLE_CERTIFICATE_BASE64` | Yes | Distribution cert `.p12` as base64. |
| `APPLE_CERTIFICATE_PASSWORD` | Yes | `.p12` password. |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Yes | Provisioning profile as base64. |
| `APPLE_TEAM_ID` | Yes | Apple Developer Team ID. |
| `ASC_API_KEY_BASE64` | Yes | App Store Connect API private key (base64). |
| `ASC_ISSUER_ID` | Yes | App Store Connect issuer UUID. |
| `ASC_KEY_ID` | Yes | App Store Connect API key id. |
| `IOS_GOOGLE_SERVICE_INFO_PLIST_BASE64` | **Optional** — add when ready | Base64 of `GoogleService-Info.plist` → written before `pod install`. If unset, CI uses the file from Git. |

### Encode iOS plist for `IOS_GOOGLE_SERVICE_INFO_PLIST_BASE64`

```bash
base64 -i ios/RedsRacing/GoogleService-Info.plist | tr -d '\n' | pbcopy
```

Paste into the secret (single line).

## Firebase Hosting (`firebase-hosting.yml`)

| Secret | In your repo? | Purpose |
|--------|----------------|--------|
| `FIREBASE_SERVICE_ACCOUNT_REDSRACING_A7F8B` | Yes | Service account JSON for `firebase deploy --only hosting` on push to `main`. |

Live site: https://redsracing-a7f8b.web.app

Manual deploy from repo root:

```bash
npm run deploy:hosting
```

## Other secrets (not wired in these workflows)

| Secret | Notes |
|--------|--------|
| `FIREBASE_SERVICE_ACCOUNT_REDSRACING_A7F8B` | Also used by **Firebase Hosting** workflow above — **keep one** canonical name. |
| `FIREBASE_SERVICE_ACCOUNT_REDS_RACING_A7F8B` | Looks like a **duplicate / typo** vs the name above. Confirm only one is needed; delete the unused secret in GitHub. |
| `SENDGRID_API_KEY` | For email — ensure no workflow logs it. |
| `SENTRY_DSN` | Client DSN; also appears in some HTML meta tags in the repo. |
| `CODACY_API_TOKEN` | Codacy integration. |

## Local development

Copy `.env.example` to `.env` for optional local tooling. `.env` is gitignored.

## Cursor / cloud AI

`.cursorignore` limits indexing of mobile Firebase config files and keystores so cloud sessions don’t pull those paths into context by default. Your **GitHub secrets** are never in the repo; only **Actions** can read them at build time.
