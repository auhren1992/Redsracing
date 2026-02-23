import SwiftUI
import WebKit
import UIKit

struct ContentView: View {
    @State private var isLoading = true
    @State private var showSplash = true
    @State private var showMenuOverlay = false
    @State private var overlayTitle = ""
    @State private var overlayItems: [MenuItem] = []
    @State private var currentURL: URL = URL(string: "https://redsracing.org")!
    @State private var webViewRef: WKWebView? = nil

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background
            Color(red: 0.02, green: 0.03, blue: 0.06).ignoresSafeArea()

            VStack(spacing: 0) {
                // Top App Bar (iOS-styled like Android)
                topBar

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
        }
        .preferredColorScheme(.dark)
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
                load(urlString: "https://redsracing.org/")
            }
            navButton(symbol: "person.2.fill", title: "Drivers") { showDriversMenu() }
            navButton(symbol: "flag.checkered.2.crossed", title: "Racing") { showRacingMenu() }
            navButton(symbol: "bubble.left.and.bubble.right.fill", title: "Community") { showCommunityMenu() }
            navButton(symbol: "ellipsis.circle.fill", title: "More") { showMoreMenu() }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(red: 0.05, green: 0.09, blue: 0.16).opacity(0.95))
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
            .init(icon: "🏎️", title: "Jon Kirsch #8 - Profile", url: "https://redsracing.org/driver.html"),
            .init(icon: "📸", title: "Jon Kirsch #8 - Gallery", url: "https://redsracing.org/gallery.html"),
            .init(icon: "📊", title: "Jon Kirsch #8 - Race Results", url: "https://redsracing.org/jons.html"),
            .init(icon: "🏎️", title: "Jonny Kirsch #88 - Profile", url: "https://redsracing.org/jonny.html"),
            .init(icon: "📸", title: "Jonny Kirsch #88 - Gallery", url: "https://redsracing.org/jonny-gallery.html"),
            .init(icon: "📊", title: "Jonny Kirsch #88 - Results", url: "https://redsracing.org/jonny-results.html"),
            .init(icon: "🏆", title: "Team Legends", url: "https://redsracing.org/legends.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showRacingMenu() {
        overlayTitle = "Racing"
        overlayItems = [
            .init(icon: "📅", title: "Schedule", url: "https://redsracing.org/schedule.html"),
            .init(icon: "🏆", title: "Leaderboard", url: "https://redsracing.org/leaderboard.html"),
            .init(icon: "📸", title: "Gallery", url: "https://redsracing.org/gallery.html"),
            .init(icon: "🎥", title: "Videos", url: "https://redsracing.org/videos.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showCommunityMenu() {
        overlayTitle = "Community"
        overlayItems = [
            .init(icon: "❓", title: "Q&A", url: "https://redsracing.org/qna.html"),
            .init(icon: "💬", title: "Feedback", url: "https://redsracing.org/feedback.html"),
            .init(icon: "💰", title: "Sponsorship", url: "https://redsracing.org/sponsorship.html")
        ]
        withAnimation { showMenuOverlay = true }
    }

    private func showMoreMenu() {
        // Try to detect login state via JS (optional). If it fails, fall back to guest menu.
        let guestItems: [MenuItem] = [
            .init(icon: "👤", title: "My Profile", url: "https://redsracing.org/profile.html"),
            .init(icon: "🔐", title: "Sign In", url: "https://redsracing.org/login.html"),
            .init(icon: "⚙️", title: "Settings", url: "https://redsracing.org/settings.html"),
            .init(icon: "📊", title: "Admin Console", url: "https://redsracing.org/admin-console.html")
        ]
        let authedItems: [MenuItem] = [
            .init(icon: "👤", title: "My Profile", url: "https://redsracing.org/profile.html"),
            .init(icon: "📊", title: "Admin Console", url: "https://redsracing.org/admin-console.html"),
            .init(icon: "⚙️", title: "Settings", url: "https://redsracing.org/settings.html"),
            .init(icon: "🚪", title: "Sign Out", url: "javascript:logout")
        ]
        overlayTitle = "More"
        if let web = webViewRef {
            web.evaluateJavaScript("(function(){ try { return localStorage.getItem('redsracing_user') !== null; } catch(e) { return false; } })();") { result, _ in
                let isLoggedIn = (result as? Bool) ?? false
                overlayItems = isLoggedIn ? authedItems : guestItems
                withAnimation { showMenuOverlay = true }
            }
        } else {
            overlayItems = guestItems
            withAnimation { showMenuOverlay = true }
        }
    }

    private func handleMenuItem(_ item: MenuItem) {
        if item.url == "javascript:logout" {
            let js = """
                (async function() {
                    try {
                        // Best-effort Firebase logout if site uses it
                        if (window.firebase?.auth) { await window.firebase.auth().signOut(); }
                        localStorage.removeItem('redsracing_user');
                        window.location.href = 'index.html';
                    } catch(e) { console.error('Logout error', e); }
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
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = true
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1)
        webView.scrollView.backgroundColor = UIColor(red: 0.02, green: 0.03, blue: 0.06, alpha: 1)
        webView.customUserAgent = "RedsRacingApp/1.0 iOS"
        DispatchQueue.main.async { self.webViewRef = webView }
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if uiView.url != url { uiView.load(URLRequest(url: url)) }
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            // Inject layout adjustments (hide site header etc.) similar to Android
            let js = """
                (function(){
                  setTimeout(function(){
                    var header = document.querySelector('header');
                    if (header) { header.style.display='none'; header.style.visibility='hidden'; header.style.height='0'; header.style.overflow='hidden'; }
                    document.body.style.backgroundColor = '#05080f';
                    document.body.style.paddingBottom = '120px';
                    var mains = document.querySelectorAll('main');
                    mains.forEach(function(m){ m.style.marginTop='0'; m.style.paddingTop='0'; m.style.paddingBottom='120px'; });
                    // Ensure countdown labels are visible
                    var countdownLabels = document.querySelectorAll('.countdown-label');
                    countdownLabels.forEach(function(label) {
                        label.style.display = 'block';
                        label.style.visibility = 'visible';
                        label.style.opacity = '1';
                        label.style.color = '#ffffff';
                    });
                    // Show admin sidebar on mobile for admin-console page
                    if (window.location.href.indexOf('admin-console') !== -1) {
                        var sidebar = document.querySelector('.sidebar-nav');
                        if (sidebar) {
                            sidebar.classList.remove('hidden', 'lg:block');
                            sidebar.style.display = 'block';
                            sidebar.style.position = 'relative';
                            sidebar.style.width = '100%';
                        }
                        var flexContainer = document.querySelector('.flex.min-h-screen');
                        if (flexContainer) {
                            flexContainer.style.flexDirection = 'column';
                        }
                    }
                  }, 100);
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
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url {
                if !url.absoluteString.contains("redsracing") && (url.scheme == "http" || url.scheme == "https") && navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
                if let scheme = url.scheme, ["tel","mailto"].contains(scheme) {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
    }
}

#Preview {
    ContentView()
}
