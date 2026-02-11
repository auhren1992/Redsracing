# RedsRacing iOS App

A native iOS app that wraps the RedsRacing website in a WebView.

## Features

- Native iOS app with SwiftUI
- Animated splash screen with RedsRacing branding
- Full-screen WebView with dark theme
- Supports back/forward navigation gestures
- Opens external links in Safari
- iOS 15.0+ support (iPhone & iPad)

## Requirements

- **Xcode 15.0+** (only available on macOS)
- **Apple Developer Account** ($99/year) for App Store distribution
- **iOS 15.0+** deployment target

## Building Locally (on Mac)

1. Open `RedsRacing.xcodeproj` in Xcode
2. Select your development team in the Signing & Capabilities tab
3. Choose a simulator or connected device
4. Press `Cmd + R` to build and run

## Building with GitHub Actions

This project includes a GitHub Actions workflow that builds on macOS runners.

### For Debug Builds (no signing required)

1. Push changes to the `ios/` folder
2. The workflow runs automatically
3. Check the Actions tab for results

### For Release Builds (requires signing)

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE_BASE64` | Your distribution certificate (.p12) encoded in base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 certificate |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Provisioning profile encoded in base64 |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID |

### How to get the secrets:

1. **Certificate**: Export from Keychain Access on Mac → Select certificate → Export as .p12
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

2. **Provisioning Profile**: Download from Apple Developer Portal
   ```bash
   base64 -i profile.mobileprovision | pbcopy
   ```

3. **Team ID**: Find in Apple Developer Portal → Membership → Team ID

## App Store Submission

1. Run the GitHub Action with "release" build type
2. Download the IPA from artifacts
3. Upload to App Store Connect using Transporter app or `xcrun altool`

Or use Xcode on a Mac:
1. Archive the project (Product → Archive)
2. Distribute to App Store Connect

## Project Structure

```
ios/
├── RedsRacing/
│   ├── RedsRacingApp.swift     # App entry point
│   ├── ContentView.swift       # Main view with WebView
│   ├── Info.plist              # App configuration
│   └── Assets.xcassets/        # App icons and colors
├── RedsRacing.xcodeproj/       # Xcode project file
└── README.md
```

## Customization

### Change Website URL
Edit `ContentView.swift` line 12:
```swift
url: URL(string: "https://redsracing.org")!
```

### Change App Icon
Replace the image in `Assets.xcassets/AppIcon.appiconset/` with a 1024x1024 PNG.

### Change Splash Colors
Edit the color values in `SplashView` in `ContentView.swift`.

## Bundle Identifier

The default bundle ID is `com.redsracing.app`. Change it in:
- Xcode project settings
- `project.pbxproj` file (search for `PRODUCT_BUNDLE_IDENTIFIER`)
