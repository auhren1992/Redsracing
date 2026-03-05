# iOS FCM Setup Instructions

## Required Steps to Enable Push Notifications for iOS

### 1. Firebase Configuration
- Download `GoogleService-Info.plist` from Firebase Console (iOS app configuration)
- Add it to the Xcode project at `ios/Redsracing/GoogleService-Info.plist`

### 2. Add Firebase SDK Dependencies
Add to `ios/Podfile`:
```ruby
pod 'FirebaseMessaging'
pod 'FirebaseFirestore'
```

Then run:
```bash
cd ios
pod install
```

### 3. Update AppDelegate
The iOS app needs an AppDelegate to handle FCM. Create `ios/Redsracing/AppDelegate.swift`:

```swift
import UIKit
import Firebase
import FirebaseMessaging
import UserNotifications
import AppTrackingTransparency

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        
        // Request App Tracking Transparency permission (required for AdMob)
        if #available(iOS 14, *) {
            ATTrackingManager.requestTrackingAuthorization { status in
                print("ATT Status: \(status.rawValue)")
            }
        }
        
        // Request notification permissions
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, _ in
            print("Notification permission granted: \(granted)")
        }
        application.registerForRemoteNotifications()
        
        // Set FCM messaging delegate
        Messaging.messaging().delegate = self
        
        return true
    }
    
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }
    
    // MARK: - MessagingDelegate
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("FCM Token: \(token)")
        
        // Subscribe to topics
        Messaging.messaging().subscribe(toTopic: "all_users")
        Messaging.messaging().subscribe(toTopic: "ios_users")
        
        // Report app usage to Firestore
        reportAppUsage(fcmToken: token)
    }
    
    private func reportAppUsage(fcmToken: String) {
        let db = Firestore.firestore()
        
        guard let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
              let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String else {
            return
        }
        
        let usageData: [String: Any] = [
            "platform": "ios",
            "app_version": Int(build) ?? 0,
            "app_version_name": version,
            "fcm_token": fcmToken,
            "device_model": UIDevice.current.model,
            "ios_version": UIDevice.current.systemVersion,
            "last_seen": Timestamp(date: Date())
        ]
        
        db.collection("app_usage").document(fcmToken).setData(usageData) { error in
            if let error = error {
                print("Failed to report app usage: \(error)")
            } else {
                print("App usage reported successfully")
            }
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([[.banner, .sound]])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }
}
```

### 4. Update RedsracingApp.swift
Modify the main app file to use the AppDelegate:

```swift
import SwiftUI
import Firebase

@main
struct RedsracingApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 5. Check App Version on Launch
Add version checking to `ContentView.swift` in the `.onAppear` modifier:

```swift
.onAppear {
    checkAppVersion()
}

private func checkAppVersion() {
    guard let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String,
          let currentVersion = Int(build) else {
        return
    }
    
    let db = Firestore.firestore()
    db.collection("app_config").document("ios_version").getDocument { snapshot, error in
        guard let data = snapshot?.data(),
              let latestVersion = data["latest_version"] as? Int,
              let minimumVersion = data["minimum_version"] as? Int else {
            return
        }
        
        if currentVersion < minimumVersion {
            // Show force update alert
            showUpdateAlert(isForced: true, latestVersion: latestVersion)
        } else if currentVersion < latestVersion {
            // Show optional update alert
            showUpdateAlert(isForced: false, latestVersion: latestVersion)
        }
    }
}

private func showUpdateAlert(isForced: Bool, latestVersion: Int) {
    let alert = UIAlertController(
        title: isForced ? "Update Required" : "Update Available",
        message: isForced ? "A required update is available. Please update to continue using the app." : "A new version (v\(latestVersion)) is available. Would you like to update?",
        preferredStyle: .alert
    )
    
    alert.addAction(UIAlertAction(title: "Update", style: .default) { _ in
        if let url = URL(string: "https://apps.apple.com/app/idYOUR_APP_ID") {
            UIApplication.shared.open(url)
        }
    })
    
    if !isForced {
        alert.addAction(UIAlertAction(title: "Later", style: .cancel))
    }
    
    if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
       let rootVC = scene.windows.first?.rootViewController {
        rootVC.present(alert, animated: true)
    }
}
```

### 6. Configure Push Notification Capabilities
In Xcode:
1. Select the project target
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add "Push Notifications"
5. Add "Background Modes" and enable "Remote notifications"

### 7. Upload APNs Certificate to Firebase
1. Generate an APNs certificate in Apple Developer Portal
2. Upload it to Firebase Console under Project Settings > Cloud Messaging > APNs Certificates

## Testing
Once configured:
1. Run the iOS app
2. Accept notification permissions
3. Check Xcode console for FCM token
4. Use admin console to send a test push notification to "ios" or "both" platforms
