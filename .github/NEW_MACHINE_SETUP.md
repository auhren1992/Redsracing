# Working from another computer

Use this after `git clone` so you know what is already on GitHub vs what you must set up locally.

## Clone

```bash
git clone https://github.com/auhren1992/Redsracing.git
cd Redsracing
git checkout main
git pull origin main
```

Latest mobile release on `main` (when this doc was added): **11.2.18 (204)** — Releases check-in telemetry + device/OS reporting.

## Already in Git (you get everything below with `git pull`)

| Area | Included |
|------|----------|
| Website + Firebase config | Root HTML, `assets/`, `functions/`, `firebase.json`, `firestore.rules` |
| Android app | `android/` (Kotlin, bundled `www` login assets, `google-services.json`) |
| iOS app | `ios/` (Swift, bundled `www` login assets, `GoogleService-Info.plist`) |
| CI | `.github/workflows/android-build.yml`, `ios-build.yml` |
| Docs | `.github/SECRET_SETUP.md`, `ANDROID_WORKFLOW_SETUP.md` |
| Lockfiles | `package-lock.json`, `functions/package-lock.json`, Gradle wrapper |

You do **not** need a USB copy of the project folder if GitHub is up to date.

## Intentionally NOT in Git (security / machine-specific)

| Item | Where to get it on a new PC |
|------|-----------------------------|
| `.env` | Copy from password manager or recreate from `.env.example` |
| Android upload keystore (`.jks`) | Your backup, or download signed **AAB** from GitHub Actions |
| `android/local.properties` | Created automatically when you open the project in Android Studio (SDK path) |
| Firebase Admin SDK JSON | Password manager / Firebase Console — **never** commit |
| `node_modules/`, `android/app/build/` | Run `npm install` / Gradle build locally |
| Play/App Store signing secrets | **GitHub → Settings → Secrets** (CI only) |

## Build apps without local signing keys

Prefer **GitHub Actions** (secrets already stored on GitHub):

- [Android Build](https://github.com/auhren1992/Redsracing/actions/workflows/android-build.yml) → artifact **AAB**
- [iOS Build](https://github.com/auhren1992/Redsracing/actions/workflows/ios-build.yml) → TestFlight upload

Or push to `main` under `android/**` or `ios/**` to trigger workflows automatically.

## Optional local tooling

| Task | Command / notes |
|------|------------------|
| Web / Firebase Hosting | `npm install` then `npx firebase-tools deploy --only hosting` (after `firebase login`) |
| Android Studio | Open `android/`, JDK **17** |
| iOS (Mac only) | `cd ios && pod install`, open `RedsRacing.xcworkspace` in Xcode |

## Before you leave your current PC

1. `git status` → should be clean; `git push origin main` if anything is pending.
2. Confirm latest Actions runs are **green** on [Actions](https://github.com/auhren1992/Redsracing/actions).
3. Note secrets are on **GitHub**, not in the clone — see [SECRET_SETUP.md](./SECRET_SETUP.md).

## Private repo

Keep **auhren1992/Redsracing** private. On the new machine, sign in to GitHub (`git` / GitHub Desktop) with access to that repo before cloning.
