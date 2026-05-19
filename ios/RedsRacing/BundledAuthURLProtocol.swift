import Foundation

/// Serves bundled `www` auth files while keeping https://www.redsracing.org URLs (Firebase Auth origin).
final class BundledAuthURLProtocol: URLProtocol {
    private static let siteHosts: Set<String> = ["www.redsracing.org", "redsracing.org"]

    private static let exactPaths: Set<String> = [
        "/login.html",
        "/signup.html",
    ]

    private static let prefixPaths: [String] = [
        "/assets/js/login-page.js",
        "/assets/js/native-app-auth.js",
        "/assets/js/auth-errors.js",
        "/assets/js/navigation-helpers.js",
        "/assets/js/roles.js",
        "/assets/js/app.js",
        "/navigation.js",
        "/vendors.js",
        "/styles/tailwind.css",
        "/styles/main.css",
        "/styles/input-fix.css",
        "/styles/modern-nav.css",
        "/styles/modern-effects.css",
        "/assets/js/page-meta.js",
        "/assets/js/site-search.js",
    ]

    private var stopped = false

    override class func canInit(with request: URLRequest) -> Bool {
        guard let url = request.url, let host = url.host?.lowercased() else { return false }
        guard siteHosts.contains(host) else { return false }
        let path = url.path.isEmpty ? "/" : url.path
        if exactPaths.contains(path) { return true }
        return prefixPaths.contains { path.hasPrefix($0) }
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let url = request.url else {
            fail(404)
            return
        }
        let path = url.path.isEmpty ? "/" : url.path
        let relative = String(path.dropFirst())
        guard let data = loadBundledData(relativePath: relative) else {
            fail(404)
            return
        }
        let mime = Self.mimeType(for: relative)
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": mime, "Access-Control-Allow-Origin": "*"]
        ) else {
            fail(500)
            return
        }
        if !stopped {
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() {
        stopped = true
    }

    private func fail(_ code: Int) {
        let err = NSError(domain: NSURLErrorDomain, code: code, userInfo: nil)
        client?.urlProtocol(self, didFailWithError: err)
    }

    private func loadBundledData(relativePath: String) -> Data? {
        let name = (relativePath as NSString).deletingPathExtension
        let ext = (relativePath as NSString).pathExtension
        let subdirectory: String?
        let resourceName: String
        if relativePath.contains("/") {
            let dir = (relativePath as NSString).deletingLastPathComponent
            resourceName = (relativePath as NSString).lastPathComponent
            subdirectory = "www/\(dir)"
        } else {
            resourceName = relativePath
            subdirectory = "www"
        }
        let base = (resourceName as NSString).deletingPathExtension
        let fileExt = ext.isEmpty ? nil : ext
        if let url = Bundle.main.url(
            forResource: base,
            withExtension: fileExt,
            subdirectory: subdirectory
        ) {
            return try? Data(contentsOf: url)
        }
        if let url = Bundle.main.url(forResource: relativePath, withExtension: nil, subdirectory: "www") {
            return try? Data(contentsOf: url)
        }
        return nil
    }

    private static func mimeType(for path: String) -> String {
        let lower = path.lowercased()
        if lower.hasSuffix(".html") { return "text/html; charset=utf-8" }
        if lower.hasSuffix(".js") { return "application/javascript; charset=utf-8" }
        if lower.hasSuffix(".css") { return "text/css; charset=utf-8" }
        if lower.hasSuffix(".json") { return "application/json; charset=utf-8" }
        if lower.hasSuffix(".svg") { return "image/svg+xml" }
        if lower.hasSuffix(".png") { return "image/png" }
        if lower.hasSuffix(".jpg") || lower.hasSuffix(".jpeg") { return "image/jpeg" }
        return "application/octet-stream"
    }
}
