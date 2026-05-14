package com.redsracing.app

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface

/**
 * JS bridge: opt-in app open lock using device biometrics / PIN (Android only).
 * Preference lives in app_prefs next to AuthBridge.
 */
class AppLockBridge(private val context: Context) {

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun setBiometricUnlockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY, enabled).apply()
        android.util.Log.d(TAG, "App biometric unlock enabled=$enabled")
    }

    @JavascriptInterface
    fun isBiometricUnlockEnabled(): Boolean {
        return prefs.getBoolean(KEY, false)
    }

    companion object {
        private const val TAG = "AppLockBridge"
        const val PREF_KEY_APP_BIOMETRIC_UNLOCK = "app_biometric_unlock"

        private const val KEY = PREF_KEY_APP_BIOMETRIC_UNLOCK

        fun isEnabled(context: Context): Boolean {
            return context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                .getBoolean(KEY, false)
        }

        fun clear(context: Context) {
            context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                .edit().remove(KEY).apply()
        }
    }
}
