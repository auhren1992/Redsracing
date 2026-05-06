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

## Other secrets (not wired in these workflows)

| Secret | Notes |
|--------|--------|
| `FIREBASE_SERVICE_ACCOUNT_REDSRACING_A7F8B` | Likely for Firebase CLI / deploy elsewhere — **keep one** canonical name. |
| `FIREBASE_SERVICE_ACCOUNT_REDS_RACING_A7F8B` | Looks like a **duplicate / typo** vs the name above. Confirm only one is needed; delete the unused secret in GitHub. |
| `SENDGRID_API_KEY` | For email — ensure no workflow logs it. |
| `SENTRY_DSN` | Client DSN; also appears in some HTML meta tags in the repo. |
| `CODACY_API_TOKEN` | Codacy integration. |

## Local development

Copy `.env.example` to `.env` for optional local tooling. `.env` is gitignored.

## Firebase Functions runtime configuration

| Name | Where | Purpose |
|------|-------|---------|
| `ADMIN_BOOTSTRAP_EMAILS` | Firebase Functions runtime env | Optional, comma-separated list of emails allowed to **self-promote** to `admin` via the `setAdminRole` callable when they have no role yet. Example: `auh­ren1992@gmail.com` |

## Cursor / cloud AI

`.cursorignore` limits indexing of mobile Firebase config files and keystores so cloud sessions don’t pull those paths into context by default. Your **GitHub secrets** are never in the repo; only **Actions** can read them at build time.
