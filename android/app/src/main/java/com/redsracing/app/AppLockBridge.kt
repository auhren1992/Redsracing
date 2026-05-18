package com.redsracing.app

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * JS bridge: opt-in app open lock using device biometrics / PIN (Android only).
 * Also exposes session probe + in-login biometric unlock for the native app flow.
 */
class AppLockBridge(
    private val activity: AppCompatActivity,
    private val authBridge: FirebaseAuthBridge,
) {

    private var webViewRef: WeakReference<WebView>? = null

    fun attachWebView(webView: WebView) {
        webViewRef = WeakReference(webView)
    }

    private val prefs: SharedPreferences
        get() = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @JavascriptInterface
    fun setBiometricUnlockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC, enabled).apply()
        if (!enabled) {
            prefs.edit().remove(KEY_LOCK_UID).apply()
        }
        android.util.Log.d(TAG, "App biometric unlock enabled=$enabled")
    }

    @JavascriptInterface
    fun setBiometricUnlockEnabledWithUid(enabled: Boolean, uid: String) {
        prefs.edit()
            .putBoolean(KEY_BIOMETRIC, enabled)
            .putString(KEY_LOCK_UID, if (enabled) uid.trim() else null)
            .apply()
        android.util.Log.d(TAG, "App biometric unlock enabled=$enabled uidSet=${uid.isNotBlank()}")
    }

    @JavascriptInterface
    fun isBiometricUnlockEnabled(): Boolean = isEnabled(activity)

    @JavascriptInterface
    fun getNativeSessionJson(): String {
        val uid = authBridge.peekStoredUid().ifBlank { prefs.getString(KEY_LOCK_UID, "") ?: "" }
        val email = authBridge.peekStoredEmail()
        val biometricEnabled = isEnabled(activity)
        val hasSession = uid.isNotBlank()
        return JSONObject()
            .put("uid", uid)
            .put("email", email)
            .put("biometricEnabled", biometricEnabled)
            .put("hasSession", hasSession)
            .toString()
    }

    @JavascriptInterface
    fun requestNativeUnlock() {
        activity.runOnUiThread {
            if (!canUseBiometric(activity)) {
                notifyUnlockResult(false)
            } else {
                runBiometricPrompt(
                    activity = activity,
                    onSuccess = { notifyUnlockResult(true) },
                    onFailure = { notifyUnlockResult(false) },
                    onCancel = { notifyUnlockResult(false) },
                )
            }
        }
    }

    private fun notifyUnlockResult(success: Boolean) {
        val js = "window.__rrNativeUnlockResult && window.__rrNativeUnlockResult($success)"
        webViewRef?.get()?.evaluateJavascript(js, null)
    }

    companion object {
        private const val TAG = "AppLockBridge"
        private const val PREFS_NAME = "app_prefs"
        const val PREF_KEY_APP_BIOMETRIC_UNLOCK = "app_biometric_unlock"
        private const val KEY_BIOMETRIC = PREF_KEY_APP_BIOMETRIC_UNLOCK
        private const val KEY_LOCK_UID = "app_lock_auth_uid"

        fun isEnabled(context: Context): Boolean {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_BIOMETRIC, false)
        }

        fun clear(context: Context) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_BIOMETRIC)
                .remove(KEY_LOCK_UID)
                .apply()
        }

        fun canUseBiometric(context: Context): Boolean {
            val bm = BiometricManager.from(context)
            val authenticators =
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            return bm.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS
        }

        fun shouldGateOnLaunch(context: Context, authBridge: FirebaseAuthBridge): Boolean {
            if (!isEnabled(context)) return false
            if (!authBridge.hasAuthUid()) return false
            return canUseBiometric(context)
        }

        fun runBiometricPrompt(
            activity: AppCompatActivity,
            onSuccess: () -> Unit,
            onFailure: () -> Unit = {},
            onCancel: () -> Unit = {},
        ) {
            val authenticators =
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            val executor = ContextCompat.getMainExecutor(activity)
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (
                        errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                        errorCode == BiometricPrompt.ERROR_CANCELED
                    ) {
                        onCancel()
                    } else {
                        onFailure()
                    }
                }

                override fun onAuthenticationFailed() {
                    onFailure()
                }
            }
            val prompt = BiometricPrompt(activity, executor, callback)
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock Reds Racing")
                .setSubtitle("Use your fingerprint, face, or screen lock")
                .setAllowedAuthenticators(authenticators)
                .build()
            prompt.authenticate(info)
        }
    }
}
