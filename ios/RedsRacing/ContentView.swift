import SwiftUI
import WebKit
import UIKit
import LocalAuthentication
import FirebaseFirestore
import FirebaseMessaging
import UserNotifications
import Security

private enum AppLockUserDefaultsKeys {
    static let biometricEnabled = "app_biometric_unlock"
    static let lockAuthUid = "app_lock_auth_uid"
}

/// Non-sensitive identity metadata only. The Firebase ID token itself is
/// never written here — see `KeychainStore` — so a UserDefaults dump (e.g.
/// via a jailbroken device or backup extraction) cannot yield a usable token.
private enum NativeAuthUserDefaultsKeys {
    static let uid = "firebase_native_auth_uid"
    static let email = "firebase_native_auth_email"
    /// Lets a returning guest skip the forced-login redirect without a uid.
    static let guestOk = "rr_native_guest_ok"
}

private enum AppUpdateUserDefaultsKeys {
    static let optionalDismissedBuild = "rr_optional_update_dismissed_build"
}

/// Minimal Keychain-backed store for the Firebase ID token (C4). Tokens are
/// sensitive bearer credentials and must not live in UserDefaults/plist,
/// which are trivially readable from an unencrypted backup. Writes fail
/// closed: if the Keychain write fails for any reason, no token is stored
/// rather than silently falling back to a weaker store.
enum KeychainStore {
    private static let service = "org.redsracing.RedsRacing.authtoken"
    private static let account = "firebaseIdToken"

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    /// Stores `token`, replacing any previous value. Returns `false` (and
    /// stores nothing) on any Keychain failure — callers must not fall back
    /// to another storage mechanism when this returns `false`.
    @discardableResult
    static func setToken(_ token: String) -> Bool {
        guard let data = token.data(using: .utf8) else { return false }
        // Always start from a clean slate so partial/duplicate items can't
        // cause SecItemAdd to fail with errSecDuplicateItem.
        SecItemDelete(baseQuery() as CFDictionary)
        var addQuery = baseQuery()
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Reads the stored token, if any. Optional by design — callers (native
    /// or the JS bridge's `getAuthToken` parity method) must handle a `nil`/
    /// empty result gracefully rather than assuming a token always exists.
    static func getToken() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data,
              let token = String(data: data, encoding: .utf8), !token.isEmpty else {
            return nil
        }
        return token
    }

    static func deleteToken() {
        SecItemDelete(baseQuery() as CFDictionary)
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var isLoading = true
    @State private var showSplash = true
    @State private var appAuthenticationRequired = false
    @State private var showMenuOverlay = false
    @State private var overlayTitle = ""
    @State private var overlayItems: [MenuItem] = []
    @State private var currentURL: URL = URL(string: "https://www.redsracing.org/") ?? URL(fileURLWithPath: "/")
    @State private var webViewRef: WKWebView? = nil
    @State private var updateAvailable = false
    @State private var updateForced = false
    @State private var updateLatestBuild = 0
    @State private var updateVersionName = ""
    @State private var updateMessage = ""
    @State private var updateStoreURL: URL? = nil
    @State private var showUpdateAlert = false
    private let deepLinkPublisher = NotificationCenter.default.publisher(for: .deepLinkTarget)

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background
            Color(red: 0.02, green: 0.03, blue: 0.06).ignoresSafeArea()

            VStack(spacing: 0) {
                // Top App Bar (iOS-styled like Android)
                topBar

                if updateAvailable {
                    updateAvailableBanner
                }

                // WebView
                WebView(
                    url: currentURL,
                    isLoading: $isLoading,
                    webViewRef: $webViewRef
                )
                .edgesIgnoringSafeArea(.horizontal)

                // Bottom Navigation
                bottomNav
            }
            .edgesIgnoringSafeArea(.vertical)

            // Loading indicator (only when not showing splash)
            if isLoading && !showSplash {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .yellow))
                    .scaleEffect(1.3)
            }

            // Splash screen overlay
            if showSplash {
                SplashView()
                    .transition(.opacity)
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                            withAnimation(.easeOut(duration: 0.5)) {
                                showSplash = false
                            }
                        }
                    }
            }

            // Menu Overlay
            if showMenuOverlay {
                MenuOverlay(title: overlayTitle, items: overlayItems) { item in
                    handleMenuItem(item)
                } onDismiss: {
                    withAnimation { showMenuOverlay = false }
                }
                .transition(.opacity)
            }

            if appAuthenticationRequired {
                appLockOverlay
            }
        }
        .preferredColorScheme(.dark)
        .alert(updateForced ? "Update Required" : "Update Available", isPresented: $showUpdateAlert) {
            Button("Update") { openStoreForUpdate() }
            if !updateForced {
                Button("Later", role: .cancel) {
                    UserDefaults.standard.set(updateLatestBuild, forKey: AppUpdateUserDefaultsKeys.optionalDismissedBuild)
                }
            }
        } message: {
            Text(updateAlertBody)
        }
        .onReceive(deepLinkPublisher) { notification in
            let requested = notification.userInfo?["page"] as? String ?? ""
            let page = Self.sanitizedDeepLinkPage(requested)
            guard let target = URL(string: "https://www.redsracing.org/" + page) else { return }
            // Reset the splash/overlay state so the deep-link page is visible
            // immediately when the user opens the app via the widget.
            withAnimation { showSplash = false }
            showMenuOverlay = false
            currentURL = target
            webViewRef?.load(URLRequest(url: target))
        }
        .onChange(of: showSplash) { stillShowing in
            if !stillShowing {
                routeToStandaloneLoginIfNeeded()
                evaluateStartupAppLockIfNeeded()
                checkAppVersion(promptDialog: true)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .nativeLoginComplete)) { _ in
            withAnimation { showSplash = false }
            showMenuOverlay = false
            let home = URL(string: "https://www.redsracing.org/index.html") ?? currentURL
            currentURL = home
            webViewRef?.load(URLRequest(url: home))
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                if appAuthenticationRequired {
                    runDeviceOwnerAuthGate()
                }
                checkAppVersion(promptDialog: updateForced)
            }
        }
        .onAppear {
            checkAppVersion(promptDialog: true)
        }
    }

    private var updateAlertBody: String {
        if !updateMessage.isEmpty { return updateMessage }
        let label = updateVersionName.isEmpty
            ? "v\(updateLatestBuild)"
            : "v\(updateLatestBuild) (\(updateVersionName))"
        if updateForced {
            return "A required update (\(label)) is available. Please update to continue using the app."
        }
        return "A new version (\(label)) is available. Would you like to update?"
    }

    private var updateAvailableBanner: some View {
        Button(action: { openStoreForUpdate() }) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(updateForced ? "Update required" : "Update available")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(red: 0.06, green: 0.09, blue: 0.16))
                    Text(updateBannerSubtitle)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.8))
                }
                Spacer(minLength: 8)
                Text("Update")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                    .cornerRadius(8)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(red: 0.96, green: 0.62, blue: 0.04))
        }
        .buttonStyle(.plain)
    }

    private var updateBannerSubtitle: String {
        if updateVersionName.isEmpty {
            return "v\(updateLatestBuild) is ready in the App Store"
        }
        return "v\(updateLatestBuild) (\(updateVersionName)) is ready in the App Store"
    }

    private func currentInstalledBuild() -> Int {
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
        return Int(build) ?? 0
    }

    private func checkAppVersion(promptDialog: Bool) {
        let current = currentInstalledBuild()
        guard current > 0 else { return }
        Firestore.firestore().collection("app_config").document("ios_version").getDocument { snapshot, error in
            if let error = error {
                print("Failed to check iOS app version: \(error.localizedDescription)")
                return
            }
            guard let data = snapshot?.data() else {
                DispatchQueue.main.async {
                    self.updateAvailable = false
                    self.updateForced = false
                }
                return
            }
            let latest = (data["latest_version"] as? Int)
                ?? (data["latest_version"] as? NSNumber)?.intValue
                ?? Int("\(data["latest_version"] ?? 0)")
                ?? 0
            let minimum = (data["minimum_version"] as? Int)
                ?? (data["minimum_version"] as? NSNumber)?.intValue
                ?? Int("\(data["minimum_version"] ?? 0)")
                ?? 0
            let name = ((data["version_name"] as? String) ?? (data["latest_version_name"] as? String) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let message = ((data["update_message"] as? String) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let store = ((data["store_url"] as? String) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let storeURL = URL(string: store.isEmpty ? "https://apps.apple.com/search?term=Reds%20Racing" : store)

            DispatchQueue.main.async {
                self.updateLatestBuild = latest
                self.updateVersionName = name
                self.updateMessage = message
                self.updateStoreURL = storeURL

                if minimum > 0 && current < minimum {
                    self.updateForced = true
                    self.updateAvailable = true
                    if promptDialog || !self.showUpdateAlert {
                        self.showUpdateAlert = true
                    }
                } else if latest > 0 && current < latest {
                    self.updateForced = false
                    self.updateAvailable = true
                    let dismissed = UserDefaults.standard.integer(forKey: AppUpdateUserDefaultsKeys.optionalDismissedBuild)
                    if promptDialog && dismissed != latest {
                        self.showUpdateAlert = true
                    }
                } else {
                    self.updateForced = false
                    self.updateAvailable = false
                    self.showUpdateAlert = false
                }
            }
        }
    }

    private func openStoreForUpdate() {
        guard let url = updateStoreURL ?? URL(string: "https://apps.apple.com/search?term=Reds%20Racing") else { return }
        UIApplication.shared.open(url)
        if updateForced {
            // Keep the forced alert visible if they return without updating.
            showUpdateAlert = true
        }
    }

    private var appLockOverlay: some View {
        ZStack {
            Color(red: 0.02, green: 0.03, blue: 0.06).opacity(0.98).ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Color(red: 0.97, green: 1, blue: 0))
                Text("Unlock Reds Racing")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                Text("Use Face ID, Touch ID, fingerprint, or your device passcode.")
                    .font(.system(size: 15))
                    .foregroundColor(Color(white: 0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Button(action: { runDeviceOwnerAuthGate() }) {
                    Text("Try again")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(Color(red: 0.02, green: 0.03, blue: 0.06))
                        .padding(.horizontal, 28)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.97, green: 1, blue: 0))
                        .cornerRadius(12)
                }
                .padding(.top, 8)
            }
        }
    }

    private func clearNativeAuthSession() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.uid)
        defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.email)
        defaults.removeObject(forKey: AppLockUserDefaultsKeys.lockAuthUid)
        defaults.set(false, forKey: AppLockUserDefaultsKeys.biometricEnabled)
        KeychainStore.deleteToken()
    }

    /// Skips forcing the login redirect when the user is either signed in
    /// (uid present) or has explicitly chosen to continue as a guest
    /// (`rr_native_guest_ok`), matching the web/Android guest-continue flow.
    private func routeToStandaloneLoginIfNeeded() {
        let defaults = UserDefaults.standard
        let uid = defaults.string(forKey: NativeAuthUserDefaultsKeys.uid)
            ?? defaults.string(forKey: AppLockUserDefaultsKeys.lockAuthUid)
            ?? ""
        let guestOk = defaults.bool(forKey: NativeAuthUserDefaultsKeys.guestOk)
        guard uid.isEmpty && !guestOk else { return }
        let login = URL(string: "https://www.redsracing.org/login.html") ?? currentURL
        if currentURL.absoluteString != login.absoluteString {
            currentURL = login
            webViewRef?.load(URLRequest(url: login))
        }
    }

    private func evaluateStartupAppLockIfNeeded() {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: AppLockUserDefaultsKeys.biometricEnabled) else { return }
        let uid = defaults.string(forKey: NativeAuthUserDefaultsKeys.uid)
            ?? defaults.string(forKey: AppLockUserDefaultsKeys.lockAuthUid)
            ?? ""
        guard !uid.isEmpty else { return }
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { return }
        appAuthenticationRequired = true
        runDeviceOwnerAuthGate()
    }

    private func runDeviceOwnerAuthGate() {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock to open Reds Racing.") { success, err in
            DispatchQueue.main.async {
                if success {
                    self.appAuthenticationRequired = false
                    return
                }
                if let laError = err as? LAError {
                    switch laError.code {
                    case .userCancel, .appCancel, .systemCancel:
                        // Just stay on the lock overlay — no private API calls
                        // (NSXPCConnection.suspend) are needed here.
                        break
                    default:
                        break
                    }
                }
            }
        }
    }

    // MARK: - Top Bar
    private var topBar: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.02, green: 0.03, blue: 0.06),
                    Color(red: 0.05, green: 0.09, blue: 0.16)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            HStack(spacing: 8) {
                Text("REDS")
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(Color(red: 0, green: 0.78, blue: 1))
                Text("RACING")
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(Color(red: 0.97, green: 1, blue: 0))
                Spacer()
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 56)
    }

    // MARK: - Bottom Navigation
    private var bottomNav: some View {
        HStack {
            navButton(symbol: "house.fill", title: "Home") {
                hideMenu()
                load(urlString: "https://www.redsracing.org/")
            }
            navButton(symbol: "person.2.fill", title: "Drivers") { showDriversMenu() }
            navButton(symbol: "flag.checkered.2.crossed", title: "Racing") { showRacingMenu() }
            navButton(symbol: "bubble.left.and.bubble.right.fill", title: "Community") { showCommunityMenu() }
            navButton(symbol: "ellipsis.circle.fill", title: "More") { showMoreMenu() }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(Color(red: 0.05, green: 0.09, blue: 0.16).opacity(0.98))
    }

    private func navButton(symbol: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color(white: 0.8))
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Menus
    private func showDriversMenu() {
        overlayTitle = "Drivers"
        overlayItems = [
            .init(icon: "🏎️", title: "Jon Kirsch #8 - Profile", url: "https://www.redsracing.org/driver.html"),
            .init(icon: "📸", title: "Jon Kirsch #8 - Gallery", url: "https://www.redsracing.org/gallery.html"),
            .init(icon: "📊", title: "Jon Kirsch #8 - K1 Karting Archive", url: "https://www.redsracing.org/jons.html"),
            .init(icon: "🏎️", title: "Jonny Kirsch #88 - Profile", url: "https://www.redsracing.org/jonny.html"),
            .init(icon: "📸", title: "Jonny Kirsch #88 - Gallery", url: "https://www.redsracing.org/jonny-gallery.html"),
            .init(icon: "📊", title: "Jonny Kirsch #88 - Results", url: "https://www.redsracing.org/jonny-results.html"),
            .init(icon: "👥", title: "Team Home", url: "https://www.redsracing.org/team.html"),
            .init(icon: "🏆", title: "Team Legends", url: "https://www.redsracing.org/legends.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showRacingMenu() {
        overlayTitle = "Racing"
        overlayItems = [
            .init(icon: "🔴", title: "Live Race", url: "https://www.redsracing.org/live.html"),
            .init(icon: "⏱️", title: "Next Race Hub", url: "https://www.redsracing.org/next-race.html"),
            .init(icon: "📅", title: "Schedule", url: "https://www.redsracing.org/schedule.html"),
            .init(icon: "📊", title: "Season Stats", url: "https://www.redsracing.org/stats.html"),
            .init(icon: "🏁", title: "Race Recaps", url: "https://www.redsracing.org/recaps.html"),
            .init(icon: "🏆", title: "Leaderboard", url: "https://www.redsracing.org/leaderboard.html"),
            .init(icon: "🗺️", title: "Track Guides", url: "https://www.redsracing.org/tracks.html"),
            .init(icon: "🎥", title: "Videos", url: "https://www.redsracing.org/videos.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showCommunityMenu() {
        overlayTitle = "Community"
        overlayItems = [
            .init(icon: "🏆", title: "Predictions", url: "https://www.redsracing.org/predictions.html"),
            .init(icon: "📣", title: "Fan Wall", url: "https://www.redsracing.org/fan-wall.html"),
            .init(icon: "❓", title: "Q&A", url: "https://www.redsracing.org/qna.html"),
            .init(icon: "💬", title: "Feedback", url: "https://www.redsracing.org/feedback.html"),
            .init(icon: "ℹ️", title: "About Us", url: "https://www.redsracing.org/about.html"),
            .init(icon: "📞", title: "Contact", url: "https://www.redsracing.org/contact.html"),
            .init(icon: "📖", title: "Racing Guide", url: "https://www.redsracing.org/racing-guide.html"),
            .init(icon: "💰", title: "Sponsorship", url: "https://www.redsracing.org/sponsorship.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showMoreMenu() {
        overlayTitle = "More"
        // Check login state and admin role from cached localStorage values
        if let web = webViewRef {
            web.evaluateJavaScript("(function(){ try { var l=!!localStorage.getItem('rr_auth_uid'); var r=localStorage.getItem('rr_user_role')||''; return JSON.stringify({l:l,r:r}); } catch(e){ return '{\"l\":false,\"r\":\"\"}'; } })();") { result, _ in
                // Parse the JSON payload properly rather than substring-matching
                // the raw string, which is brittle against key/value reordering
                // or whitespace differences in the serialized JSON.
                var isLoggedIn = false
                var isAdmin = false
                if let resultStr = result as? String,
                   let data = resultStr.data(using: .utf8),
                   let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                    isLoggedIn = (obj["l"] as? Bool) ?? false
                    let role = (obj["r"] as? String) ?? ""
                    isAdmin = role == "admin"
                }

                var items: [MenuItem] = []
                items.append(.init(icon: "👤", title: "My Profile", url: "https://www.redsracing.org/profile.html"))
                
                if isLoggedIn {
                    if isAdmin {
                        items.append(.init(icon: "📊", title: "Admin Console", url: "https://www.redsracing.org/admin-console.html"))
                    }
                    items.append(.init(icon: "⚙️", title: "Settings", url: "https://www.redsracing.org/settings.html"))
                    items.append(.init(icon: "🚪", title: "Sign Out", url: "javascript:logout"))
                } else {
                    items.append(.init(icon: "🔐", title: "Sign In", url: "https://www.redsracing.org/login.html"))
                    items.append(.init(icon: "✏️", title: "Create Account", url: "https://www.redsracing.org/signup.html"))
                    items.append(.init(icon: "⚙️", title: "Settings", url: "https://www.redsracing.org/settings.html"))
                }
                
                self.overlayItems = items
                withAnimation { self.showMenuOverlay = true }
            }
        } else {
            overlayItems = [
                .init(icon: "👤", title: "My Profile", url: "https://www.redsracing.org/profile.html"),
                .init(icon: "🔐", title: "Sign In", url: "https://www.redsracing.org/login.html"),
                .init(icon: "✏️", title: "Create Account", url: "https://www.redsracing.org/signup.html"),
                .init(icon: "⚙️", title: "Settings", url: "https://www.redsracing.org/settings.html")
            ]
            withAnimation { showMenuOverlay = true }
        }
    }

    private func handleMenuItem(_ item: MenuItem) {
        if item.url == "javascript:logout" {
            clearNativeAuthSession()
            let js = """
                (async function() {
                    try {
                        try { localStorage.removeItem('rr_auth_uid'); } catch(e) {}
                        try { localStorage.removeItem('rr_user_name'); } catch(e) {}
                        try { localStorage.removeItem('rr_user_role'); } catch(e) {}
                        try { localStorage.removeItem('rr_guest_ok'); } catch(e) {}
                        try { localStorage.removeItem('redsracing_user'); } catch(e) {}
                        try {
                          if (window.FirebaseAuthBridge && window.FirebaseAuthBridge.clearAllAuth) {
                            window.FirebaseAuthBridge.clearAllAuth();
                          }
                        } catch(e) {}
                        try {
                          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.redsRacingAuth) {
                            window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'clear' });
                          }
                        } catch(e) {}
                        try {
                          if (window.firebase && window.firebase.auth) { await window.firebase.auth().signOut(); }
                        } catch(e) {}
                        try {
                          var m = await import('/assets/js/auth-utils.js');
                          if (m && m.safeSignOut) { await m.safeSignOut(); }
                        } catch(e) {}
                        window.location.href = 'https://www.redsracing.org/login.html';
                    } catch(e) {
                        console.error('Logout error', e);
                        window.location.href = 'https://www.redsracing.org/login.html';
                    }
                })();
            """
            webViewRef?.evaluateJavaScript(js, completionHandler: nil)
            hideMenu()
        } else {
            hideMenu()
            load(urlString: item.url)
        }
    }

    private func hideMenu() { withAnimation { showMenuOverlay = false } }

    private func load(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        currentURL = url
    }

    /// Deep-link "page" values arrive from push-notification payloads and the
    /// widget's `redsracing://target/<page>` URL, neither of which is fully
    /// trusted input. Only allow a bare `name.html` component — no path
    /// traversal (`..`), no extra path separators, no scheme/host injection —
    /// falling back to `index.html` for anything else.
    private static func sanitizedDeepLinkPage(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.contains(".."),
              !trimmed.contains("/"),
              !trimmed.contains("\\"),
              trimmed.range(of: "^[a-zA-Z0-9_-]+\\.html$", options: .regularExpression) != nil
        else {
            return "index.html"
        }
        return trimmed
    }
}

// MARK: - MenuOverlay
struct MenuItem: Identifiable {
    var id = UUID()
    let icon: String
    let title: String
    let url: String
}

struct MenuOverlay: View {
    let title: String
    let items: [MenuItem]
    let onSelect: (MenuItem) -> Void
    let onDismiss: () -> Void

    var body: some View {
        ZStack(alignment: .center) {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture { onDismiss() }

            VStack(spacing: 16) {
                Text(title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(items) { item in
                            Button(action: { onSelect(item) }) {
                                HStack(spacing: 12) {
                                    Text(item.icon)
                                        .font(.system(size: 20))
                                    Text(item.title)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(.white)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.white.opacity(0.5))
                                }
                                .padding()
                                .background(Color.white.opacity(0.06))
                                .cornerRadius(12)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                Button("Close") { onDismiss() }
                    .padding(.vertical, 8)
            }
            .padding(.vertical, 24)
            .frame(maxWidth: 480)
            .background(Color(red: 0.05, green: 0.09, blue: 0.16))
            .cornerRadius(16)
            .padding(24)
        }
    }
}

// MARK: - Splash View (unchanged)
struct SplashView: View {
    @State private var scale: CGFloat = 0.8
    @State private var opacity: Double = 0
    
    var body: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.02, green: 0.03, blue: 0.06),
                    Color(red: 0.05, green: 0.09, blue: 0.16)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                HStack(spacing: 0) {
                    Text("REDS")
                        .font(.system(size: 48, weight: .black, design: .default))
                        .foregroundColor(Color(red: 0, green: 0.78, blue: 1))
                    Text("RACING")
                        .font(.system(size: 48, weight: .black, design: .default))
                        .foregroundColor(Color(red: 0.97, green: 1, blue: 0))
                }
                .scaleEffect(scale)
                .opacity(opacity)
                
                Text("#8")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white.opacity(0.7))
                    .opacity(opacity)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: Color(red: 0.97, green: 1, blue: 0)))
                    .scaleEffect(1.2)
                    .padding(.top, 40)
                    .opacity(opacity)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                scale = 1.0
                opacity = 1.0
            }
        }
    }
}

// MARK: - WebView
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var webViewRef: WKWebView?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // CRITICAL: Enable data storage for localStorage, IndexedDB, cookies
        configuration.websiteDataStore = WKWebsiteDataStore.default()

        // Media playback
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        // JavaScript preferences
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        // Enable picture-in-picture
        configuration.allowsPictureInPictureMediaPlayback = true

        // IMPORTANT: append our identifier to the standard Safari UA rather than
        // replacing it. Google sign-in / reCAPTCHA / AdMob's consent dialogs all
        // sniff the UA — `customUserAgent` blew the whole Safari UA away and
        // those flows refuse to load. `applicationNameForUserAgent` only
        // appends to the default product line.
        configuration.applicationNameForUserAgent = "RedsRacingApp/1.0 iOS"

        // Native marker on every page; standalone-login flag is set only on login.html
        // (see decidePolicy / didFinish) so finishStandaloneAppLogin() cannot fire elsewhere.
        let nativeAppFlag = WKUserScript(
            source: "try{window.__RR_NATIVE_APP__='ios';document.documentElement.classList.add('rr-native-app');}catch(e){}",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(nativeAppFlag)

        // FirebaseAuthBridge (C4): inject at document start so it exists
        // before any page script runs, instead of only after `didFinish`
        // (which left a stale/undefined bridge for scripts that ran during
        // page load, and never reflected auth changes that happened after
        // the initial injection). `_uid`/`_email` are updated live by native
        // whenever the stored session changes — see `pushAuthBridgeState`.
        let authBridgeScript = WKUserScript(
            source: WebView.authBridgeSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(authBridgeScript)

        configuration.userContentController.add(context.coordinator, name: "redsRacingAppLock")
        configuration.userContentController.add(context.coordinator, name: "redsRacingAuth")
        configuration.userContentController.add(context.coordinator, name: "redsRacingAppUnlock")
        configuration.userContentController.add(context.coordinator, name: "redsRacingNotifications")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = true
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1)
        webView.scrollView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1)
        
        // IMPORTANT: Allow link previews and interactions
        webView.allowsLinkPreview = true
        
        DispatchQueue.main.async { self.webViewRef = webView }
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Compare URLs without fragment (#hash) to prevent reload loops
        // from hash-based routing (e.g., admin-console.html#overview)
        func stripFragment(_ u: URL?) -> String {
            guard let u = u else { return "" }
            var comp = URLComponents(url: u, resolvingAgainstBaseURL: false)
            comp?.fragment = nil
            return comp?.url?.absoluteString ?? u.absoluteString
        }
        if stripFragment(uiView.url) != stripFragment(url) {
            uiView.load(URLRequest(url: url))
        }
    }

    /// C11: release everything the WebView was holding onto when SwiftUI
    /// tears the representable down (e.g. view hierarchy replaced), so
    /// script message handlers and delegate references don't outlive it.
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeAllScriptMessageHandlers()
        uiView.navigationDelegate = nil
        uiView.uiDelegate = nil
        uiView.stopLoading()
        coordinator.webView = nil
    }

    /// Live-updating auth bridge injected at `.atDocumentStart`. `_uid`/
    /// `_email` are plain properties that native overwrites after every
    /// session change (see `pushAuthBridgeState`), so scripts that read them
    /// early in page load — or that re-check them after a native auth event
    /// — always see current values instead of a one-shot snapshot baked in
    /// after `didFinish`. The bearer token itself is intentionally never
    /// exposed to JS (`getAuthToken` returns `''` here); it lives only in
    /// the native Keychain (`KeychainStore`).
    static let authBridgeSource = """
        (function() {
          try {
            var bridge = window.FirebaseAuthBridge || {};
            bridge._uid = bridge._uid || '';
            bridge._email = bridge._email || '';
            bridge.getAuthUid = function() { return bridge._uid || ''; };
            bridge.getAuthEmail = function() { return bridge._email || ''; };
            bridge.getAuthToken = function() { return ''; };
            bridge.storeAuthUid = function(u) {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'storeSession', uid: u }); } catch(e) {}
            };
            bridge.storeAuthEmail = function(e) {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'storeSession', email: e }); } catch(err) {}
            };
            bridge.storeAuthToken = function(t) {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'storeSession', token: t }); } catch(e) {}
            };
            bridge.clearAllAuth = function() {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'clear' }); } catch(e) {}
            };
            bridge.clearAuthToken = function() {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'clearToken' }); } catch(e) {}
            };
            bridge.guestContinue = function() {
              try { window.webkit.messageHandlers.redsRacingAuth.postMessage({ action: 'guestContinue' }); } catch(e) {}
            };
            window.FirebaseAuthBridge = bridge;
          } catch (e) {}
        })();
    """

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        weak var webView: WKWebView?
        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            // Standalone login flag only on login page (matches Android LoginActivity behavior)
            if let url = webView.url?.absoluteString, url.contains("login.html") {
                webView.evaluateJavaScript(
                    "try{window.__RR_STANDALONE_APP_LOGIN__=true;}catch(e){}",
                    completionHandler: nil
                )
            } else {
                webView.evaluateJavaScript(
                    "try{window.__RR_STANDALONE_APP_LOGIN__=false;}catch(e){}",
                    completionHandler: nil
                )
            }
            // Inject layout adjustments (hide site header etc.) similar to Android
            let js = """
                (function(){
                  setTimeout(function(){
                    try {
                      document.documentElement.classList.add('rr-native-app');
                      if (document.body) document.body.classList.add('mobile-app');
                    } catch (eMark) {}
                    var header = document.querySelector('header');
                    if (header) { header.style.display='none'; header.style.visibility='hidden'; header.style.height='0'; header.style.overflow='hidden'; }
                    try {
                      document.querySelectorAll('.home-mobile-bar, nav.home-mobile-bar').forEach(function(el) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.setAttribute('hidden', 'true');
                        el.setAttribute('aria-hidden', 'true');
                      });
                      var orphan = document.getElementById('mobile-menu-button');
                      if (orphan && orphan.getAttribute('data-rr-orphan') === '1') orphan.remove();
                      var tabs = document.getElementById('mobile-menu-tabs');
                      if (tabs) tabs.remove();
                    } catch (eNav) {}
                    document.body.style.backgroundColor = '#05080f';
                    // Native tab bar sits outside the WebView — small scroll cushion only.
                    document.body.style.paddingBottom = '20px';
                    var mains = document.querySelectorAll('main');
                    mains.forEach(function(m){ m.style.marginTop='0'; m.style.paddingTop='0'; m.style.paddingBottom='20px'; });
                    try {
                      document.documentElement.style.setProperty('--rr-native-bottom-pad', '20px');
                      document.querySelectorAll('.container').forEach(function(c) {
                        c.style.minHeight = 'auto';
                        c.style.justifyContent = 'flex-start';
                        c.style.paddingTop = '1.15rem';
                        c.style.paddingBottom = '1rem';
                      });
                      document.querySelectorAll('.race-info').forEach(function(el) {
                        el.style.margin = '0 auto 1.65rem';
                        el.style.lineHeight = '1.5';
                        el.style.position = 'relative';
                        el.style.zIndex = '5';
                      });
                      document.querySelectorAll('.feature-carousel').forEach(function(el) {
                        el.style.margin = '0.75rem auto 1.35rem';
                      });
                      document.querySelectorAll('.fc-viewport').forEach(function(el) {
                        el.style.minHeight = '320px';
                        el.style.aspectRatio = 'auto';
                        el.style.maxHeight = 'none';
                      });
                    } catch (ePad) {}
                    // Ensure countdown labels are visible
                    var countdownLabels = document.querySelectorAll('.countdown-label');
                    countdownLabels.forEach(function(label) {
                        label.style.display = 'block';
                        label.style.visibility = 'visible';
                        label.style.opacity = '1';
                        label.style.color = '#ffffff';
                    });
                    // Admin console keeps its own UI (menu bar / Command Center drawer)
                    if (window.location.href.indexOf('admin-console') !== -1) {
                        var adminBar = document.getElementById('admin-menu-bar');
                        if (adminBar) {
                            adminBar.style.display = 'flex';
                            adminBar.style.visibility = 'visible';
                        }
                    }
                  }, 100);
                })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)

            // C12: guard the (log-only) auth state monitor so it is only
            // ever installed once per document, even across repeated
            // `didFinish` calls (SPA navigations, hash routing, etc.).
            let authMonitorJS = """
                (function() {
                    if (window.__rrAuthMonitorInstalled) { return; }
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        window.__rrAuthMonitorInstalled = true;
                        var auth = firebase.auth();
                        auth.onAuthStateChanged(function(user) {
                            if (user) {
                                console.log('[iOS WebView] User signed in:', user.uid);
                            } else {
                                console.log('[iOS WebView] User signed out');
                            }
                        });
                    }
                })();
            """
            webView.evaluateJavaScript(authMonitorJS, completionHandler: nil)

            Self.pushAuthBridgeState(to: webView)
        }
        /// Pushes the current native session's uid/email into the live
        /// `FirebaseAuthBridge._uid`/`_email` properties (see
        /// `WebView.authBridgeSource`). Called after every page load and
        /// whenever a `storeSession`/`clear`/`clearToken`/`guestContinue`
        /// message updates the stored session, so the bridge never goes
        /// stale for the lifetime of the WebView.
        static func pushAuthBridgeState(to webView: WKWebView) {
            let defaults = UserDefaults.standard
            let uid = defaults.string(forKey: NativeAuthUserDefaultsKeys.uid) ?? ""
            let email = defaults.string(forKey: NativeAuthUserDefaultsKeys.email) ?? ""
            let uidJson = (try? JSONEncoder().encode(uid)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
            let emailJson = (try? JSONEncoder().encode(email)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
            let js = """
                (function() {
                  try {
                    if (!window.FirebaseAuthBridge) { return; }
                    window.FirebaseAuthBridge._uid = \(uidJson);
                    window.FirebaseAuthBridge._email = \(emailJson);
                    if (\(uidJson).length > 0) {
                      try { localStorage.setItem('rr_auth_uid', \(uidJson)); } catch (e) {}
                    }
                  } catch (e) { console.warn('[iOS] Auth bridge update', e); }
                })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            print("WebView error: \(error.localizedDescription)")
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            print("WebView provisional error: \(error.localizedDescription)")
        }
        // Auth-related hosts that must stay inside the WebView for sign-in to
        // work. Matched against `URL.host` (exact host or subdomain of an
        // allowlisted domain) rather than a substring of the full URL, so a
        // hostile URL like `https://evil.example/?x=accounts.google.com`
        // can't spoof its way past this check.
        private static let authHostAllowlist: Set<String> = [
            "accounts.google.com",
            "google.com",
            "googleapis.com",
            "firebaseapp.com",
            "gstatic.com",
            "securetoken.googleapis.com",
            "redsracing-a7f8b.firebaseapp.com",
            "redsracing-a7f8b.web.app"
        ]

        private func isAuthURL(_ url: URL) -> Bool {
            guard let host = url.host?.lowercased() else { return false }
            return Coordinator.authHostAllowlist.contains { allowed in
                host == allowed || host.hasSuffix("." + allowed)
            }
        }
        
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url {
                print("[iOS WebView] Navigation to: \(url.absoluteString)")
                
                // Allow all redsracing URLs
                if url.absoluteString.contains("redsracing") {
                    decisionHandler(.allow)
                    return
                }
                
                // Allow all auth-related URLs inside the WebView (Google OAuth, Firebase Auth)
                if isAuthURL(url) {
                    print("[iOS WebView] Allowing auth URL inside WebView: \(url.host ?? "")")
                    decisionHandler(.allow)
                    return
                }
                
                // Open truly external links in Safari (only user-tapped links)
                if (url.scheme == "http" || url.scheme == "https") && navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
                
                // Handle tel: and mailto: links
                if let scheme = url.scheme, ["tel","mailto"].contains(scheme) {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
        
        // Handle popup windows (needed for Google OAuth signInWithPopup)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // If the target is a popup (no target frame), load it in the current webview
            if navigationAction.targetFrame?.isMainFrame != true {
                if let url = navigationAction.request.url {
                    print("[iOS WebView] Popup requested: \(url.absoluteString)")
                    webView.load(navigationAction.request)
                }
            }
            return nil
        }
    }
}

extension WebView.Coordinator: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let defaults = UserDefaults.standard

        if message.name == "redsRacingAppLock" {
            guard let dict = message.body as? [String: Any] else { return }
            let enabled = dict["enabled"] as? Bool ?? false
            defaults.set(enabled, forKey: AppLockUserDefaultsKeys.biometricEnabled)
            if enabled, let uid = dict["authUid"] as? String, !uid.isEmpty {
                defaults.set(uid, forKey: AppLockUserDefaultsKeys.lockAuthUid)
            }
            if !enabled {
                defaults.removeObject(forKey: AppLockUserDefaultsKeys.lockAuthUid)
                defaults.set(false, forKey: AppLockUserDefaultsKeys.biometricEnabled)
            }
            return
        }

        if message.name == "redsRacingAuth" {
            guard let dict = message.body as? [String: Any] else { return }
            let action = dict["action"] as? String ?? ""
            if action == "clear" {
                defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.uid)
                defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.email)
                defaults.removeObject(forKey: AppLockUserDefaultsKeys.lockAuthUid)
                defaults.set(false, forKey: AppLockUserDefaultsKeys.biometricEnabled)
                KeychainStore.deleteToken()
                if let webView = self.webView { Self.pushAuthBridgeState(to: webView) }
                return
            }
            if action == "clearToken" {
                // FirebaseAuthBridge.clearAuthToken() (C4): drop only the
                // bearer token, keep the uid/email session intact.
                KeychainStore.deleteToken()
                return
            }
            if action == "guestContinue" {
                // C3: user explicitly chose to continue as a guest — don't
                // force them back to the login screen on next launch.
                defaults.set(true, forKey: NativeAuthUserDefaultsKeys.guestOk)
                return
            }
            if action == "getSession" {
                let uid = defaults.string(forKey: NativeAuthUserDefaultsKeys.uid)
                    ?? defaults.string(forKey: AppLockUserDefaultsKeys.lockAuthUid)
                    ?? ""
                let email = defaults.string(forKey: NativeAuthUserDefaultsKeys.email) ?? ""
                let biometricEnabled = defaults.bool(forKey: AppLockUserDefaultsKeys.biometricEnabled)
                let hasSession = !uid.isEmpty
                let payload: [String: Any] = [
                    "uid": uid,
                    "email": email,
                    "biometricEnabled": biometricEnabled,
                    "hasSession": hasSession,
                ]
                guard let data = try? JSONSerialization.data(withJSONObject: payload),
                      let json = String(data: data, encoding: .utf8) else { return }
                let js = "window.__rrAuthSessionCallback && window.__rrAuthSessionCallback(\(json))"
                webView?.evaluateJavaScript(js, completionHandler: nil)
                return
            }
            if action == "storeSession" {
                if let uid = dict["uid"] as? String, !uid.isEmpty {
                    defaults.set(uid, forKey: NativeAuthUserDefaultsKeys.uid)
                    // A real session takes over from any guest-continue flag.
                    defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.guestOk)
                }
                if let email = dict["email"] as? String, !email.isEmpty {
                    defaults.set(email, forKey: NativeAuthUserDefaultsKeys.email)
                }
                if let token = dict["token"] as? String, !token.isEmpty {
                    // C4: the Firebase ID token belongs in the Keychain, not
                    // UserDefaults. Fail closed — if the write fails, no
                    // token is persisted rather than silently degrading to a
                    // less-secure store.
                    _ = KeychainStore.setToken(token)
                }
                if let webView = self.webView { Self.pushAuthBridgeState(to: webView) }
                return
            }
            if action == "loginComplete" {
                defaults.removeObject(forKey: NativeAuthUserDefaultsKeys.guestOk)
                DispatchQueue.main.async {
                    NotificationCenter.default.post(name: .nativeLoginComplete, object: nil)
                }
                return
            }
            return
        }

        if message.name == "redsRacingAppUnlock" {
            guard let dict = message.body as? [String: Any] else { return }
            guard dict["action"] as? String == "unlock" else { return }
            let context = LAContext()
            context.localizedCancelTitle = "Cancel"
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock to sign in to Reds Racing.") { success, _ in
                DispatchQueue.main.async {
                    let js = "window.__rrNativeUnlockResult && window.__rrNativeUnlockResult(\(success ? "true" : "false"))"
                    self.webView?.evaluateJavaScript(js, completionHandler: nil)
                }
            }
            return
        }

        if message.name == "redsRacingNotifications" {
            guard let dict = message.body as? [String: Any] else { return }
            let action = (dict["action"] as? String ?? "").lowercased()
            if action == "getstatus" || action == "getStatus" {
                Self.notificationAuthorizationStatus { status in
                    self.deliverNativeNotifResult(["status": status, "platform": "ios"])
                }
                return
            }
            if action == "enable" {
                Self.enableRaceNotifications { payload in
                    self.deliverNativeNotifResult(payload)
                }
                return
            }
        }
    }

    private func deliverNativeNotifResult(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.__rrNativeNotifResult && window.__rrNativeNotifResult(\(json))"
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private static func notificationAuthorizationStatus(completion: @escaping (String) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let status: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                status = "granted"
            case .denied:
                status = "denied"
            case .notDetermined:
                status = "default"
            @unknown default:
                status = "default"
            }
            DispatchQueue.main.async { completion(status) }
        }
    }

    private static func enableRaceNotifications(completion: @escaping ([String: Any]) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                Self.subscribeRaceAlertTopics()
                Self.postLocalConfirmation()
                DispatchQueue.main.async {
                    completion(["status": "already", "platform": "ios"])
                }
            case .denied:
                DispatchQueue.main.async {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                    completion([
                        "status": "denied",
                        "platform": "ios",
                        "message": "Enable notifications in iOS Settings for RedsRacing"
                    ])
                }
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
                    if let error = error {
                        DispatchQueue.main.async {
                            completion([
                                "status": "error",
                                "platform": "ios",
                                "message": error.localizedDescription
                            ])
                        }
                        return
                    }
                    DispatchQueue.main.async {
                        if granted {
                            UIApplication.shared.registerForRemoteNotifications()
                            Self.subscribeRaceAlertTopics()
                            Self.postLocalConfirmation()
                            completion(["status": "granted", "platform": "ios"])
                        } else {
                            completion(["status": "denied", "platform": "ios"])
                        }
                    }
                }
            @unknown default:
                DispatchQueue.main.async {
                    completion(["status": "default", "platform": "ios"])
                }
            }
        }
    }

    private static func subscribeRaceAlertTopics() {
        let topics = ["all_users", "ios_users", "race_reminders", "schedule_updates"]
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

    private static func postLocalConfirmation() {
        let content = UNMutableNotificationContent()
        content.title = "RedsRacing"
        content.body = "Notifications on — you'll get race reminders and schedule updates."
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "rr-notif-enabled-\(Int(Date().timeIntervalSince1970))",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
}

#Preview {
    ContentView()
}
