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
            runCatching { webView?.clearCache(true) }
        }
    }

    fun onLowMemory() {
        // BACKGROUND covers UI release + cache drop without deprecated COMPLETE.
        onTrimMemory(ComponentCallbacks2.TRIM_MEMORY_BACKGROUND)
    }

    fun onActivityPause(webView: WebView?, adView: AdView?) {
        runCatching { webView?.onPause() }
        runCatching { adView?.pause() }
    }

    fun onActivityResume(webView: WebView?, adView: AdView?) {
        restoreForeground(webView)
        runCatching { webView?.onResume() }
        runCatching { adView?.resume() }
    }

    fun onActivityDestroy(webView: WebView?, adView: AdView?) {
        restoreForeground(webView)
        runCatching { adView?.destroy() }
        runCatching {
            webView?.let { wv ->
                wv.stopLoading()
                wv.loadUrl("about:blank")
                (wv.parent as? android.view.ViewGroup)?.removeView(wv)
                wv.removeAllViews()
                wv.destroy()
            }
        }
        webViewRef = null
        adViewRef = null
    }

    private fun releaseUiHidden(webView: WebView?, adView: AdView?) {
        if (!uiReleased) {
            uiReleased = true
            dropVisibleBitmaps(webView, adView)
        }
        pauseWebTimers(webView)
    }

    private fun dropVisibleBitmaps(webView: WebView?, adView: AdView?) {
        android.util.Log.d(TAG, "Releasing UI / bitmap memory (UI hidden)")
        waiveRenderer(webView)
        runCatching { webView?.clearCache(false) }
        runCatching { adView?.pause() }
    }

    private fun waiveRenderer(webView: WebView?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        runCatching {
            webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_WAIVED, true)
        }
    }

    private fun pauseWebTimers(webView: WebView?) {
        if (timersPaused || webView == null) return
        runCatching {
            webView.pauseTimers()
            timersPaused = true
        }
    }

    private fun restoreForeground(webView: WebView?) {
        if (timersPaused) {
            runCatching { webView?.resumeTimers() }
            timersPaused = false
        }
        if (!uiReleased) return
        uiReleased = false
        android.util.Log.d(TAG, "Restoring UI memory policy (foreground)")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        runCatching {
            webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
    }
}
