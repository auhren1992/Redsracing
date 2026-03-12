import SwiftUI
import FirebaseCore
import FirebaseMessaging
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
    }

    private func subscribeToDefaultTopics() {
        Messaging.messaging().subscribe(toTopic: "all_users") { error in
            if let error = error {
                print("Error subscribing to all_users topic: \(error.localizedDescription)")
            } else {
                print("Successfully subscribed to all_users topic")
            }
        }

        Messaging.messaging().subscribe(toTopic: "ios_users") { error in
            if let error = error {
                print("Error subscribing to ios_users topic: \(error.localizedDescription)")
            } else {
                print("Successfully subscribed to ios_users topic")
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
        // Configure Firebase
        FirebaseApp.configure()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
