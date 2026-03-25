import SwiftUI
import FirebaseCore
import FirebaseMessaging
import FirebaseFirestore
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        requestPushPermissions(application)
        return true
    }

    private func requestPushPermissions(_ application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                print("Push permission request failed: \(error.localizedDescription)")
                return
            }
            print("Push permission granted: \(granted)")
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        print("APNs token registered")
        subscribeToDefaultTopics()
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \(error.localizedDescription)")
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else {
            print("FCM token not available")
            return
        }
        print("FCM registration token: \(token)")
        subscribeToDefaultTopics()
        reportAppUsage(fcmToken: token)
    }

    private func reportAppUsage(fcmToken: String) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        let usageData: [String: Any] = [
            "platform": "ios",
            "app_version": Int(build) ?? 0,
            "app_version_name": version,
            "fcm_token": fcmToken,
            "device_model": UIDevice.current.model,
            "ios_version": UIDevice.current.systemVersion,
            "last_seen": Timestamp()
        ]
        Firestore.firestore().collection("app_usage").document(fcmToken).setData(usageData) { error in
            if let error = error {
                print("Failed to report app usage: \(error.localizedDescription)")
            } else {
                print("App usage reported successfully")
            }
        }
    }

    private func subscribeToDefaultTopics() {
        let topics = ["all_users", "ios_users"]
        for topic in topics {
            Messaging.messaging().subscribe(toTopic: topic) { error in
                if let error = error {
                    print("Failed to subscribe to \(topic): \(error.localizedDescription)")
                } else {
                    print("Subscribed to \(topic)")
                }
            }
        }
    }

    // Show banner while app is foregrounded
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // Handle notification taps
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        print("Notification opened: \(response.notification.request.content.userInfo)")
        completionHandler()
    }
}

@main
struct RedsRacingApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    init() {
        // Configure Firebase for iOS app (only if not already configured)
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
