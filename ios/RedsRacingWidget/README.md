# RedsRacing iOS Widget

A WidgetKit extension that shows a countdown to the next RedsRacing race.

These source files are ready to drop into the existing `RedsRacing.xcodeproj`,
but adding a new app extension target requires Xcode (the project's `pbxproj`
is most safely modified through the Xcode UI). Follow these steps on a Mac:

## 1. Add a Widget Extension target

1. Open `ios/RedsRacing.xcodeproj` in Xcode.
2. **File → New → Target… → Widget Extension**.
3. Name: **`RedsRacingWidget`**.
   - Bundle identifier: `com.redsracing.app.RedsRacingWidget`.
   - Language: **Swift**. Include configuration intent: **No**.
4. Xcode will create a new group; **delete** the default `RedsRacingWidget.swift`
   it generates because we already have a custom one.
5. **Right-click the new `RedsRacingWidget` group → Add Files to "RedsRacing"…**
   Select these files from `ios/RedsRacingWidget/`:
   - `RedsRacingWidget.swift`
   - `ScheduleService.swift`
   - `Info.plist` (replace the auto-generated one)
   - `RedsRacingWidget.entitlements`
6. In the target's **Build Settings**:
   - Set **Info.plist File** to `RedsRacingWidget/Info.plist`.
   - Set **Code Signing Entitlements** to `RedsRacingWidget/RedsRacingWidget.entitlements`.
   - Set **Deployment Target** to `iOS 17.0` (or whatever your main app targets, ≥ 14).
   - Set **Skip Install** to **YES** (it is for extensions).
7. In **Signing & Capabilities** for the widget target:
   - Pick the same team as the main app.
   - **+ Capability → App Groups**, then add `group.com.redsracing.app.shared`.

## 2. Add the same App Group to the main app

The widget reads its cached race data from the shared App Group. Without this
step, the widget will still fetch fine over the network but won't share state
with the main app.

1. Select the **RedsRacing** main target → **Signing & Capabilities**.
2. **+ Capability → App Groups**, add `group.com.redsracing.app.shared`.

If you need to use a different App Group ID, change it in **all four** places:
- `WidgetConfig.appGroup` (Swift constant in `ScheduleService.swift`)
- `RedsRacingWidget.entitlements`
- Main app entitlements file
- Apple Developer portal (provisioning profiles)

## 3. Embed the extension in the app

When you add a Widget Extension target via Xcode, this is set automatically.
If you ever delete/re-add: in the **RedsRacing** main target, ensure the widget
appears under **General → Frameworks, Libraries, and Embedded Content** with
**Embed Without Signing** (Xcode usually picks the right value).

## 4. Build & deploy

- Local build/run on a device that supports widgets (any modern iPhone/iPad).
- App Store: same archive flow as before — Xcode will include the widget when
  it sees the embedded extension.
- The GitHub Actions iOS workflow already builds with `xcodebuild` against the
  scheme; adding the target via Xcode commits the project changes, and CI
  picks them up automatically.

## How it works

- The widget calls `https://redsracing.org/data/schedule.json` (already hosted),
  picks the soonest race in the future, and caches it to the App Group.
- WidgetKit asks for a fresh timeline ~ every 30 minutes; we also pre-bake
  several future entries so the countdown ticks down between fetches.
- Tapping the widget opens the app to the schedule page (deep link is handled
  via the standard widget URL/navigation flow; if your `ContentView.swift`
  needs to react to it, observe `Environment(\.openURL)` or use `widgetURL` in
  the view — leave this as a follow-up if you want a specific page).
