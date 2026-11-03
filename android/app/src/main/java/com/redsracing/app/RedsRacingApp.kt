package com.redsracing.app

import android.app.Application
import android.content.ComponentCallbacks2

/**
 * Process-level memory callbacks for Android 17 / Play dynamic-memory thresholds.
 * Activity-bound AdView pause is handled via [AppMemoryTrimmer.bind].
 * Does not pause WebView timers or clear HTTP cache (those caused missing tab bar).
 */
class RedsRacingApp : Application() {
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        AppMemoryTrimmer.onTrimMemory(level)
    }

    @Deprecated("Deprecated in Java")
    override fun onLowMemory() {
        super.onLowMemory()
        AppMemoryTrimmer.onTrimMemory(ComponentCallbacks2.TRIM_MEMORY_BACKGROUND)
    }
}
