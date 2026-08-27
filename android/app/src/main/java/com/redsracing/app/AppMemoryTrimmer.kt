package com.redsracing.app

import android.content.ComponentCallbacks2
import android.os.Build
import android.webkit.WebView
import com.google.android.gms.ads.AdView
import java.lang.ref.WeakReference

/**
 * Releases WebView / AdMob bitmap and dynamic memory when the app is not visible
 * (Play / Android 17 guidance: do not hold bitmaps in background or cached states).
 */
object AppMemoryTrimmer {
    private const val TAG = "AppMemoryTrimmer"

    @Volatile
    private var timersPaused = false

    @Volatile
    private var uiReleased = false

    private var webViewRef: WeakReference<WebView>? = null
    private var adViewRef: WeakReference<AdView>? = null

    fun bind(webView: WebView?, adView: AdView?) {
        webViewRef = webView?.let { WeakReference(it) }
        adViewRef = adView?.let { WeakReference(it) }
    }

    /** @param level [ComponentCallbacks2] trim level */
    fun onTrimMemory(level: Int) {
        val webView = webViewRef?.get()
        val adView = adViewRef?.get()
        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            releaseUiHidden(webView, adView)
        }
        if (level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) {
            try {
                webView?.clearCache(true)
            } catch (_: Throwable) {
            }
        }
    }

    fun onLowMemory() {
        onTrimMemory(ComponentCallbacks2.TRIM_MEMORY_COMPLETE)
    }

    fun onActivityPause(webView: WebView?, adView: AdView?) {
        try {
            webView?.onPause()
        } catch (_: Throwable) {
        }
        try {
            adView?.pause()
        } catch (_: Throwable) {
        }
    }

    fun onActivityStop(webView: WebView?, adView: AdView?) {
        releaseUiHidden(webView, adView)
    }

    fun onActivityResume(webView: WebView?, adView: AdView?) {
        restoreForeground(webView)
        try {
            webView?.onResume()
        } catch (_: Throwable) {
        }
        try {
            adView?.resume()
        } catch (_: Throwable) {
        }
    }

    fun onActivityDestroy(webView: WebView?, adView: AdView?) {
        restoreForeground(webView)
        try {
            adView?.destroy()
        } catch (_: Throwable) {
        }
        try {
            webView?.let { wv ->
                wv.stopLoading()
                wv.loadUrl("about:blank")
                (wv.parent as? android.view.ViewGroup)?.removeView(wv)
                wv.removeAllViews()
                wv.destroy()
            }
        } catch (_: Throwable) {
        }
        webViewRef = null
        adViewRef = null
    }

    private fun releaseUiHidden(webView: WebView?, adView: AdView?) {
        if (!uiReleased) {
            uiReleased = true
            android.util.Log.d(TAG, "Releasing UI / bitmap memory (UI hidden)")
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_WAIVED, true)
                }
            } catch (_: Throwable) {
            }
            try {
                webView?.clearCache(false)
            } catch (_: Throwable) {
            }
            try {
                adView?.pause()
            } catch (_: Throwable) {
            }
        }
        if (!timersPaused && webView != null) {
            try {
                webView.pauseTimers()
                timersPaused = true
            } catch (_: Throwable) {
            }
        }
    }

    private fun restoreForeground(webView: WebView?) {
        if (timersPaused) {
            try {
                webView?.resumeTimers()
            } catch (_: Throwable) {
            }
            timersPaused = false
        }
        if (!uiReleased) return
        uiReleased = false
        android.util.Log.d(TAG, "Restoring UI memory policy (foreground)")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
            }
        } catch (_: Throwable) {
        }
    }
}
