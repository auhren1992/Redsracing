package com.redsracing.app

/**
 * Shared allow-list policy for push/notification/widget deep links loaded into
 * the JS-bridged WebView (FirebaseAuthBridge / AndroidAuth / AndroidNotifications
 * are exposed there, so an attacker-controllable `url` payload must not be able
 * to load an arbitrary origin).
 *
 * Only https + the RedsRacing site hosts + .html-style paths are allowed;
 * anything else falls back to the home page.
 */
object DeepLinkPolicy {

    private fun homeUrl(): String = MainActivity.siteUrl("index.html")

    private fun isAllowedHost(host: String): Boolean {
        return host == "www.redsracing.org" || host == "redsracing.org"
    }

    private fun isAllowedPath(path: String): Boolean {
        return path.endsWith(".html", ignoreCase = true) ||
            path == "/" ||
            path.isEmpty()
    }

    private fun resolveRelativeHtml(raw: String): String? {
        if (raw.contains("://") || !raw.endsWith(".html")) return null
        return MainActivity.siteUrl(raw.removePrefix("/"))
    }

    private fun rewriteApexToWww(uri: android.net.Uri, raw: String): String {
        val host = uri.host?.lowercase() ?: return raw
        if (host != "redsracing.org") return raw
        val tail = (uri.path ?: "/").removePrefix("/").trim()
        return MainActivity.siteUrl(if (tail.isEmpty()) "index.html" else tail)
    }

    private fun sanitizeAbsolute(raw: String): String {
        val home = homeUrl()
        return try {
            val uri = android.net.Uri.parse(raw)
            val scheme = uri.scheme?.lowercase()
            val host = uri.host?.lowercase() ?: ""
            val path = uri.path ?: "/"
            if (scheme != "https" || !isAllowedHost(host) || !isAllowedPath(path)) {
                return home
            }
            rewriteApexToWww(uri, raw)
        } catch (_: IllegalArgumentException) {
            home
        } catch (_: NullPointerException) {
            home
        }
    }

    /**
     * Resolve [raw] into a safe absolute URL to load, falling back to the site
     * home page when the input is missing, non-https, or off the allowed hosts.
     */
    fun sanitize(raw: String?): String {
        if (raw.isNullOrBlank()) return homeUrl()
        resolveRelativeHtml(raw)?.let { return it }
        return sanitizeAbsolute(raw)
    }
}
