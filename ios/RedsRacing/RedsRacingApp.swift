import SwiftUI
import FirebaseCore
import FirebaseMessaging
import FirebaseFirestore
import FirebaseAuth
import UIKit
import UserNotifications
import Darwin

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    private var lastFcmToken: String? = nil
    private var authListener: AuthStateDidChangeListenerHandle? = nil
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, _ in
            guard let self = self else { return }
            if let token = self.lastFcmToken, !token.isEmpty {
                self.reportAppUsage(fcmToken: token)
            }
        }
        requestPushPermissions(application)
        URLProtocol.registerClass(BundledAuthURLProtocol.self)
        return true
    }

    /// Called when the SwiftUI scene becomes active so Releases "last check-in" stays fresh.
    func refreshAppUsageIfPossible() {
        guard let token = lastFcmToken, !token.isEmpty else { return }
        reportAppUsage(fcmToken: token)
    }

    /// Register for APNs when already authorized. Do not prompt at cold start —
    /// the homepage Enable Notifications CTA owns the first permission dialog so
    /// mobile WebView opt-in is not pre-denied by a launch prompt.
    private func requestPushPermissions(_ application: UIApplication) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            case .notDetermined, .denied:
                print("Push permission not granted yet (status=\(settings.authorizationStatus.rawValue)); waiting for in-app Enable Notifications")
            @unknown default:
                break
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
        lastFcmToken = token
        subscribeToDefaultTopics()
        reportAppUsage(fcmToken: token)
    }

    private func deviceMachineIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: 1) { cString in
                String(cString: cString)
            }
        }
    }

    private func reportAppUsage(fcmToken: String) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        let buildCode = Int(build) ?? 0
        let user = Auth.auth().currentUser
        let machine = deviceMachineIdentifier()
        let modelName = UIDevice.current.model
        let usageData: [String: Any] = [
            "platform": "ios",
            "app_version": buildCode,
            "app_version_code": buildCode,
            "app_version_name": version,
            "fcm_token": fcmToken,
            "device_manufacturer": "Apple",
            "device_model": machine.isEmpty ? modelName : machine,
            "device_model_name": modelName,
            "ios_version": UIDevice.current.systemVersion,
            "os_version": UIDevice.current.systemVersion,
            // Optional identity fields (present only when signed in)
            "auth_uid": user?.uid ?? "",
            "auth_email": user?.email ?? "",
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
        // If the user already granted notification permission, also join race/schedule topics.
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                for topic in ["race_reminders", "schedule_updates"] {
                    Messaging.messaging().subscribe(toTopic: topic) { error in
                        if let error = error {
                            print("Failed to subscribe to \(topic): \(error.localizedDescription)")
                        } else {
                            print("Subscribed to \(topic)")
                        }
                    }
                }
            default:
                break
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

    // Handle notification taps → deep-link the WebView when a page is provided
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        print("Notification opened: \(info)")
        let page = Self.resolveNotificationDeepLink(info)
        if let page {
            NotificationCenter.default.post(
                name: .deepLinkTarget,
                object: nil,
                userInfo: ["page": page]
            )
        }
        completionHandler()
    }

    /// Accepts FCM/APS payloads with `page`, `url`, or `deepLink` keys (e.g. `next-race.html` or full https URL).
    static func resolveNotificationDeepLink(_ info: [AnyHashable: Any]) -> String? {
        let candidates: [Any?] = [
            info["page"],
            info["url"],
            info["deepLink"],
            (info["data"] as? [AnyHashable: Any])?["page"],
            (info["data"] as? [AnyHashable: Any])?["url"]
        ]
        for raw in candidates {
            guard let value = raw as? String else { continue }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            if trimmed.lowercased().hasPrefix("http") {
                if let url = URL(string: trimmed), let host = url.host?.lowercased(),
                   host.contains("redsracing.org") {
                    let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    return path.isEmpty ? "index.html" : path
                }
                continue
            }
            return trimmed.contains(".") ? trimmed : "\(trimmed).html"
        }
        return nil
    }
}

/// Centralised broadcast bus for widget / notification deep-links.
/// `ContentView` listens on `.deepLinkTarget` and navigates the WebView when
/// a payload arrives.
extension Notification.Name {
    static let deepLinkTarget = Notification.Name("RR.DeepLinkTarget")
    static let nativeLoginComplete = Notification.Name("RR.NativeLoginComplete")
}

@main
struct RedsRacingApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Configure Firebase for iOS app (only if not already configured)
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                appDelegate.refreshAppUsageIfPossible()
            }
        }
    }

    /// Maps `redsracing://target/<page>` URLs (sent by the home-screen widget
    /// via `.widgetURL`) into a WebView-page name and broadcasts it to
    /// `ContentView`.
    private func handleDeepLink(_ url: URL) {
        guard url.scheme?.lowercased() == "redsracing" else { return }
        let host = url.host?.lowercased() ?? ""
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let target: String? = {
            if host == "target" {
                switch path.lowercased() {
                case "schedule": return "schedule.html"
                case "live":     return "live.html"
                case "recaps":   return "recaps.html"
                case "gallery":  return "gallery.html"
                case "predictions": return "predictions.html"
                default:         return nil
                }
            }
            return nil
        }()
        guard let target else { return }
        NotificationCenter.default.post(
            name: .deepLinkTarget,
            object: nil,
            userInfo: ["page": target]
        )
    }
}
