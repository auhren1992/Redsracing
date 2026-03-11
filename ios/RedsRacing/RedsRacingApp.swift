import SwiftUI
import FirebaseCore
import FirebaseMessaging

@main
struct RedsRacingApp: App {
    
    init() {
        // Configure Firebase
        FirebaseApp.configure()
        
        // Subscribe to FCM topics
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
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
