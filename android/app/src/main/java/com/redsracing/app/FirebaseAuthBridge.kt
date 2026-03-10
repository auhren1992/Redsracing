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
    }
    
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }
    
    private val encryptedPrefs: SharedPreferences by lazy {
        try {
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: GeneralSecurityException) {
            android.util.Log.e(TAG, "Failed to create encrypted prefs (security)", e)
            context.getSharedPreferences(PREFS_NAME_FALLBACK, Context.MODE_PRIVATE)
        } catch (e: IOException) {
            android.util.Log.e(TAG, "Failed to create encrypted prefs (IO)", e)
            context.getSharedPreferences(PREFS_NAME_FALLBACK, Context.MODE_PRIVATE)
        }
    }
    
    /**
     * Called from JavaScript when user successfully logs in.
     * Stores the Firebase ID token securely.
     */
    @JavascriptInterface
    fun storeAuthToken(token: String) {
        try {
            encryptedPrefs.edit().putString(KEY_TOKEN, token).apply()
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
            encryptedPrefs.edit().remove(KEY_TOKEN).apply()
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
            encryptedPrefs.getString(KEY_TOKEN, null)
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
}
