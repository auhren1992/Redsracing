package com.redsracing.app

import android.content.ComponentCallbacks2
import android.os.Build
import android.webkit.WebView
import com.google.android.gms.ads.AdView
import java.lang.ref.WeakReference

/**
 * Releases AdMob bitmaps when the app is not visible.
 *
 * Do **not**:
 * - clear the WebView HTTP disk cache from trim callbacks (left Chromium /
 *   layout broken until the user wiped app data — see MainActivity
 *   clearCacheIfVersionChanged for upgrade-only clears)
 * - call [WebView.pauseTimers] / resumeTimers (process-wide; resume races left
 *   the native tab bar looking gone after reopen until Clear storage)
 *
 * Call sites must pass the activity's own WebView/AdView so LoginActivity
 * cannot accidentally trim or destroy MainActivity's WebView during the
 * login → main hand-off (shared singleton refs used to race).
 */
object AppMemoryTrimmer {
    private const val TAG = "AppMemoryTrimmer"

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
            releaseUiHidden(adView)
        }
        // Do NOT clearCache or pauseTimers here — see class KDoc.
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
        // Only drop bound refs when they point at the views we just destroyed.
        // Never clear on (null, null) — LoginActivity early-exit (session valid →
        // open Main without inflating) used to wipe MainActivity's bind().
        if (webView != null && webViewRef?.get() === webView) {
            webViewRef = null
        }
        if (adView != null && adViewRef?.get() === adView) {
            adViewRef = null
        }
    }

    private fun releaseUiHidden(adView: AdView?) {
        if (uiReleased) return
        uiReleased = true
        android.util.Log.d(TAG, "Releasing UI / bitmap memory (UI hidden)")
        // Keep renderer priority IMPORTANT — WAIVED + cache clears caused blank /
        // broken WebView chrome after reopen until the user cleared app data.
        // Do not pauseTimers — process-wide pause left the tab bar missing on resume.
        runCatching { adView?.pause() }
    }

    private fun restoreForeground(webView: WebView?) {
        if (!uiReleased) return
        uiReleased = false
        android.util.Log.d(TAG, "Restoring UI memory policy (foreground)")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        runCatching {
            webView?.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
    }
}
