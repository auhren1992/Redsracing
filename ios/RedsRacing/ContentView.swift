import SwiftUI
import WebKit

struct ContentView: View {
    @State private var isLoading = true
    @State private var showSplash = true
    
    var body: some View {
        ZStack {
            // Main WebView
            WebView(
                url: URL(string: "https://redsracing.org")!,
                isLoading: $isLoading
            )
            .edgesIgnoringSafeArea(.all)
            
            // Loading indicator
            if isLoading && !showSplash {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .yellow))
                    .scaleEffect(1.5)
            }
            
            // Splash screen
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
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Splash View
struct SplashView: View {
    @State private var scale: CGFloat = 0.8
    @State private var opacity: Double = 0
    
    var body: some View {
        ZStack {
            // Background gradient
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
                // Logo
                HStack(spacing: 0) {
                    Text("REDS")
                        .font(.system(size: 48, weight: .black, design: .default))
                        .foregroundColor(Color(red: 0, green: 0.78, blue: 1)) // #00c6ff
                    Text("RACING")
                        .font(.system(size: 48, weight: .black, design: .default))
                        .foregroundColor(Color(red: 0.97, green: 1, blue: 0)) // #f7ff00
                }
                .scaleEffect(scale)
                .opacity(opacity)
                
                // Subtitle
                Text("#8")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white.opacity(0.7))
                    .opacity(opacity)
                
                // Loading indicator
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
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        // Enable JavaScript
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
        
        // Custom user agent
        webView.customUserAgent = "RedsRacingApp/1.0 iOS"
        
        // Load the website
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No updates needed
    }
    
    // MARK: - Coordinator
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView
        
        init(_ parent: WebView) {
            self.parent = parent
        }
        
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            
            // Inject dark theme CSS if needed
            let darkModeCSS = """
                document.body.style.backgroundColor = '#05080f';
            """
            webView.evaluateJavaScript(darkModeCSS, completionHandler: nil)
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            print("WebView error: \\(error.localizedDescription)")
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            print("WebView provisional error: \\(error.localizedDescription)")
        }
        
        // Handle external links
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url {
                // Open external links in Safari
                if !url.absoluteString.contains("redsracing") && 
                   (url.scheme == "http" || url.scheme == "https") &&
                   navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
        
        // Handle JavaScript alerts
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            // You would present an alert here in a real app
            print("JS Alert: \\(message)")
            completionHandler()
        }
    }
}

#Preview {
    ContentView()
}
