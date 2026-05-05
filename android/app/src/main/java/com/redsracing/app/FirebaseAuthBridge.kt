package com.redsracing.app

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.io.IOException
import java.security.GeneralSecurityException

/**
 * JavaScript interface for storing and retrieving Firebase auth tokens securely.
 * Uses EncryptedSharedPreferences to protect tokens at rest.
 */
class FirebaseAuthBridge(private val context: Context) {
    
    companion object {
        private const val TAG = "FirebaseAuthBridge"
        private const val PREFS_NAME = "firebase_auth_prefs"
        private const val PREFS_NAME_FALLBACK = "firebase_auth_prefs_fallback"
        private const val KEY_TOKEN = "firebase_token"
        private const val KEY_UID = "firebase_uid"
        private const val KEY_EMAIL = "firebase_email"
    }
    
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }
    
    private data class PrefsState(
        val prefs: SharedPreferences,
        val supportsSensitiveStorage: Boolean
    )

    private val prefsState: PrefsState by lazy {
        try {
            val encrypted = EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            PrefsState(encrypted, supportsSensitiveStorage = true)
        } catch (e: GeneralSecurityException) {
            android.util.Log.e(TAG, "Failed to create encrypted prefs (security)", e)
            // Fail closed for sensitive values: we still allow non-sensitive session markers.
            PrefsState(context.getSharedPreferences(PREFS_NAME_FALLBACK, Context.MODE_PRIVATE), supportsSensitiveStorage = false)
        } catch (e: IOException) {
            android.util.Log.e(TAG, "Failed to create encrypted prefs (IO)", e)
            PrefsState(context.getSharedPreferences(PREFS_NAME_FALLBACK, Context.MODE_PRIVATE), supportsSensitiveStorage = false)
        }
    }
    
    /**
     * Called from JavaScript when user successfully logs in.
     * Stores the Firebase ID token securely.
     */
    @JavascriptInterface
    fun storeAuthToken(token: String) {
        try {
            if (!prefsState.supportsSensitiveStorage) {
                android.util.Log.w(TAG, "Encrypted storage unavailable; refusing to store auth token")
                return
            }
            prefsState.prefs.edit().putString(KEY_TOKEN, token).apply()
            android.util.Log.d(TAG, "Auth token stored successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to store auth token", e)
        }
    }
    
    /**
     * Called from JavaScript when user logs out.
     * Clears the stored auth token.
     */
    @JavascriptInterface
    fun clearAuthToken() {
        try {
            prefsState.prefs.edit().remove(KEY_TOKEN).apply()
            android.util.Log.d(TAG, "Auth token cleared")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to clear auth token", e)
        }
    }
    
    /**
     * Get the stored Firebase ID token.
     * Called natively on app launch to restore session.
     */
    fun getAuthToken(): String? {
        return try {
            prefsState.prefs.getString(KEY_TOKEN, null)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to retrieve auth token", e)
            null
        }
    }
    
    /**
     * Check if an auth token is stored.
     */
    fun hasAuthToken(): Boolean {
        return getAuthToken() != null
    }

    /**
     * Called from JavaScript when user logs in or signs up.
     * Stores the Firebase UID so we can restore auth state on app restart.
     */
    @JavascriptInterface
    fun storeAuthUid(uid: String) {
        try {
            prefsState.prefs.edit().putString(KEY_UID, uid).apply()
            android.util.Log.d(TAG, "Auth UID stored successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to store auth UID", e)
        }
    }

    /**
     * Called from JavaScript when user logs in or signs up.
     * Stores the user's email for session restoration.
     */
    @JavascriptInterface
    fun storeAuthEmail(email: String) {
        try {
            prefsState.prefs.edit().putString(KEY_EMAIL, email).apply()
            android.util.Log.d(TAG, "Auth email stored successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to store auth email", e)
        }
    }

    /**
     * Get the stored Firebase UID.
     * Called from JS synchronously via @JavascriptInterface to restore localStorage.
     */
    @JavascriptInterface
    fun getAuthUid(): String {
        return try {
            prefsState.prefs.getString(KEY_UID, "") ?: ""
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to retrieve auth UID", e)
            ""
        }
    }

    /**
     * Get the stored email.
     */
    @JavascriptInterface
    fun getAuthEmail(): String {
        return try {
            prefsState.prefs.getString(KEY_EMAIL, "") ?: ""
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Clear all stored auth data (token, uid, email).
     * Called on logout.
     */
    @JavascriptInterface
    fun clearAllAuth() {
        try {
            prefsState.prefs.edit()
                .remove(KEY_TOKEN)
                .remove(KEY_UID)
                .remove(KEY_EMAIL)
                .apply()
            android.util.Log.d(TAG, "All auth data cleared")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to clear auth data", e)
        }
    }

    /**
     * Check if a UID is stored (called natively on app launch).
     */
    fun hasAuthUid(): Boolean {
        return try {
            val uid = prefsState.prefs.getString(KEY_UID, null)
            !uid.isNullOrEmpty()
        } catch (e: Exception) {
            false
        }
    }
}
