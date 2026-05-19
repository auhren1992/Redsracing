package com.redsracing.app

import android.content.Context
import android.webkit.WebResourceResponse
import java.io.IOException
import java.net.URLDecoder

/**
 * Serves bundled www auth assets for the native app login flow.
 * URL stays https://www.redsracing.org/... so Firebase Auth + cookies match the main WebView.
 */
object NativeAuthAssets {

    private val SITE_HOSTS = setOf("www.redsracing.org", "redsracing.org")

    private val EXACT_PATHS = setOf(
        "/login.html",
        "/signup.html",
    )

    private val PREFIX_PATHS = listOf(
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
    )

    fun shouldServeFromBundle(host: String?, path: String?): Boolean {
        if (host == null || path == null) return false
        if (host.lowercase() !in SITE_HOSTS) return false
        val normalized = normalizePath(path)
        if (normalized in EXACT_PATHS) return true
        return PREFIX_PATHS.any { normalized.startsWith(it) }
    }

    fun load(context: Context, path: String): WebResourceResponse? {
        val normalized = normalizePath(path)
        val assetPath = "www$normalized"
        return try {
            val stream = context.assets.open(assetPath)
            WebResourceResponse(guessMimeType(assetPath), "utf-8", stream)
        } catch (_: IOException) {
            null
        }
    }

    private fun normalizePath(path: String): String {
        var p = path.trim()
        if (!p.startsWith("/")) p = "/$p"
        return try {
            URLDecoder.decode(p, "UTF-8")
        } catch (_: Exception) {
            p
        }
    }

    private fun guessMimeType(assetPath: String): String {
        return when {
            assetPath.endsWith(".html", ignoreCase = true) -> "text/html"
            assetPath.endsWith(".js", ignoreCase = true) -> "application/javascript"
            assetPath.endsWith(".css", ignoreCase = true) -> "text/css"
            assetPath.endsWith(".json", ignoreCase = true) -> "application/json"
            assetPath.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
            assetPath.endsWith(".png", ignoreCase = true) -> "image/png"
            assetPath.endsWith(".jpg", ignoreCase = true) || assetPath.endsWith(".jpeg", ignoreCase = true) ->
                "image/jpeg"
            else -> "application/octet-stream"
        }
    }
}
