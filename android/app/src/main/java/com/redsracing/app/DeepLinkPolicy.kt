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

    /**
     * Resolve [raw] into a safe absolute URL to load, falling back to the site
     * home page when the input is missing, non-https, or off the allowed hosts.
     */
    fun sanitize(raw: String?): String {
        val home = MainActivity.siteUrl("index.html")
        if (raw.isNullOrBlank()) return home
        // Bare html filename -> same origin as the rest of the app WebView.
        if (!raw.contains("://") && raw.endsWith(".html")) {
            return MainActivity.siteUrl(raw.removePrefix("/"))
        }
        return try {
            val uri = android.net.Uri.parse(raw)
            val scheme = uri.scheme?.lowercase()
            val host = uri.host?.lowercase() ?: ""
            val path = uri.path ?: "/"
            val allowedHost = host == "www.redsracing.org" || host == "redsracing.org"
            val allowedPath = path.endsWith(".html", ignoreCase = true) ||
                path == "/" || path.isEmpty()
            val allowed = scheme == "https" && allowedHost && allowedPath
            if (!allowed) return home
            if (host == "redsracing.org") {
                val tail = path.removePrefix("/").trim()
                MainActivity.siteUrl(if (tail.isEmpty()) "index.html" else tail)
            } else {
                raw
            }
        } catch (_: Throwable) {
            home
        }
    }
}
