package com.redsracing.app

import android.os.Build
import android.webkit.WebView
import com.google.android.gms.ads.AdView
import java.lang.ref.WeakReference

/**
 * Releases WebView / AdMob bitmap and dynamic memory when the app is not visible
 * (Play / Android 17 guidance: do not hold bitmaps in background or cached states).
 *
 * [WebView.pauseTimers] is process-wide, so pause/resume is refcounted here.
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

    fun unbind() {
        webViewRef = null
        adViewRef = null
    }

    /** @param level [android.content.ComponentCallbacks2] trim level */
    fun onTrimMemory(level: Int) {
        val webView = webViewRef?.get()
        val adView = adViewRef?.get()
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            releaseUiHidden(webView, adView)
        }
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) {
            releaseBackground(webView)
        }
    }

    fun onLowMemory() {
        releaseUiHidden(webViewRef?.get(), adViewRef?.get())
        releaseBackground(webViewRef?.get())
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
        unbind()
    }

    private fun releaseUiHidden(webView: WebView?, adView: AdView?) {
        if (uiReleased) {
            pauseTimersIfNeeded(webView)
            return
        }
        uiReleased = true
        android.util.Log.d(TAG, "Releasing UI / bitmap memory (UI hidden)")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Allow the system to reclaim the WebView renderer (page bitmaps).
                webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_WAIVED, true)
            }
        } catch (_: Throwable) {
        }
        // Memory HTTP cache only — keep disk cache for faster resume.
        try {
            webView?.clearCache(false)
        } catch (_: Throwable) {
        }
        try {
            adView?.pause()
        } catch (_: Throwable) {
        }
        pauseTimersIfNeeded(webView)
    }

    private fun releaseBackground(webView: WebView?) {
        android.util.Log.d(TAG, "Releasing background memory (cached candidate)")
        try {
            webView?.clearCache(true)
        } catch (_: Throwable) {
        }
    }

    private fun restoreForeground(webView: WebView?) {
        resumeTimersIfNeeded(webView)
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

    private fun pauseTimersIfNeeded(webView: WebView?) {
        if (timersPaused || webView == null) return
        try {
            // Still pauses layout/JS timers for all WebViews in the process.
            webView.pauseTimers()
            timersPaused = true
        } catch (_: Throwable) {
        }
    }

    private fun resumeTimersIfNeeded(webView: WebView?) {
        if (!timersPaused) return
        try {
            webView?.resumeTimers()
            timersPaused = false
        } catch (_: Throwable) {
            timersPaused = false
        }
    }
}

