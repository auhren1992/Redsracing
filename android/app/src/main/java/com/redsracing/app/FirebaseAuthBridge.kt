package com.redsracing.app

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * JavaScript interface for storing and retrieving Firebase auth tokens securely.
 * Uses EncryptedSharedPreferences to protect tokens at rest.
 */
class FirebaseAuthBridge(private val context: Context) {
    
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }
    
    private val encryptedPrefs: SharedPreferences by lazy {
        try {
            EncryptedSharedPreferences.create(
                context,
                "firebase_auth_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            android.util.Log.e("FirebaseAuthBridge", "Failed to create encrypted prefs", e)
            // Fallback to regular SharedPreferences (not ideal but better than crashing)
            context.getSharedPreferences("firebase_auth_prefs_fallback", Context.MODE_PRIVATE)
        }
    }
    
    /**
     * Called from JavaScript when user successfully logs in.
     * Stores the Firebase ID token securely.
     */
    @JavascriptInterface
    fun storeAuthToken(token: String) {
        try {
            encryptedPrefs.edit().putString("firebase_token", token).apply()
            android.util.Log.d("FirebaseAuthBridge", "Auth token stored successfully")
        } catch (e: Exception) {
            android.util.Log.e("FirebaseAuthBridge", "Failed to store auth token", e)
        }
    }
    
    /**
     * Called from JavaScript when user logs out.
     * Clears the stored auth token.
     */
    @JavascriptInterface
    fun clearAuthToken() {
        try {
            encryptedPrefs.edit().remove("firebase_token").apply()
            android.util.Log.d("FirebaseAuthBridge", "Auth token cleared")
        } catch (e: Exception) {
            android.util.Log.e("FirebaseAuthBridge", "Failed to clear auth token", e)
        }
    }
    
    /**
     * Get the stored Firebase ID token.
     * Called natively on app launch to restore session.
     */
    fun getAuthToken(): String? {
        return try {
            encryptedPrefs.getString("firebase_token", null)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseAuthBridge", "Failed to retrieve auth token", e)
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
