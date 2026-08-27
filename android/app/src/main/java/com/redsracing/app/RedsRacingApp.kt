package com.redsracing.app

import android.app.Application

/**
 * Process-level memory callbacks for Android 17 / Play dynamic-memory thresholds.
 * Activity-bound WebView/AdView release is handled via [AppMemoryTrimmer.bind].
 */
class RedsRacingApp : Application() {
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        AppMemoryTrimmer.onTrimMemory(level)
    }

    @Deprecated("Deprecated in Java")
    override fun onLowMemory() {
        super.onLowMemory()
        AppMemoryTrimmer.onLowMemory()
    }
}
