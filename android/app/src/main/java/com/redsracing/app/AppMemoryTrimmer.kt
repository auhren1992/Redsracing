package com.redsracing.app

import android.content.ComponentCallbacks2
import android.os.Build
import android.webkit.WebView
import com.google.android.gms.ads.AdView
import java.lang.ref.WeakReference

/**
 * Releases WebView / AdMob bitmaps when the app is not visible.
 *
 * Important: never clear the WebView HTTP disk cache from trim callbacks.
 * Clearing cache while the activity is backgrounded (then resumed) left the
 * Chromium compositor / layout in a bad state — the native tab bar looked
 * “gone” until the user wiped app cache/data. Cache invalidation belongs in
 * [MainActivity.clearCacheIfVersionChanged] on APK upgrades only.
 *
 * Call sites must pass the activity's own WebView/AdView so LoginActivity
 * cannot accidentally trim or destroy MainActivity's WebView during the
 * login → main hand-off (shared singleton refs used to race).
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

    /**
     * @param level [ComponentCallbacks2] trim level
     * @param webView activity-owned WebView (preferred); falls back to last [bind]
     * @param adView activity-owned AdView (preferred)
     */
    fun onTrimMemory(
        level: Int,
        webView: WebView? = webViewRef?.get(),
        adView: AdView? = adViewRef?.get(),
    ) {
        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            releaseUiHidden(webView, adView)
        }
        // Do NOT clearCache here — see class KDoc.
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
        // Only drop bound refs when they point at the views we just destroyed,
        // so LoginActivity.onDestroy cannot null out MainActivity's bind().
        if (webView != null && webViewRef?.get() === webView) {
            webViewRef = null
        }
        if (adView != null && adViewRef?.get() === adView) {
            adViewRef = null
        }
        if (webView == null && adView == null) {
            webViewRef = null
            adViewRef = null
        }
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
        // Keep renderer priority IMPORTANT — WAIVED + cache clears caused blank /
        // broken WebView chrome after reopen until the user cleared app data.
        runCatching { adView?.pause() }
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
