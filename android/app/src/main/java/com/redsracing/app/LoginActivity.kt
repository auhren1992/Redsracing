package com.redsracing.app

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.redsracing.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var prefs: SharedPreferences
    private lateinit var firebaseAuthBridge: FirebaseAuthBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
        firebaseAuthBridge = FirebaseAuthBridge(this)

        if (prefs.getBoolean("remember_choice", false)) {
            when (prefs.getString("mode", "")) {
                "signin" -> {
                    startMain("https://www.redsracing.org/", guest = false)
                    return
                }
                "guest" -> {
                    startMain("https://www.redsracing.org/index.html", guest = true)
                    return
                }
            }
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (hasBiometricUnlockSession()) {
            binding.unlockButton.visibility = View.VISIBLE
            binding.unlockButton.setOnClickListener { runBiometricUnlockAndOpen() }
        }

        binding.signInButton.setOnClickListener {
            startMain("https://www.redsracing.org/login.html", guest = false)
        }
        binding.guestButton.setOnClickListener {
            if (binding.rememberCheck.isChecked) remember("guest")
            startMain("https://www.redsracing.org/index.html", guest = true)
        }
        binding.createAccountLink.setOnClickListener {
            startMain("https://www.redsracing.org/signup.html", guest = false)
        }
    }

    private fun hasBiometricUnlockSession(): Boolean {
        return AppLockBridge.isEnabled(this) &&
            firebaseAuthBridge.hasAuthUid() &&
            AppLockBridge.canUseBiometric(this)
    }

    private fun runBiometricUnlockAndOpen() {
        AppLockBridge.runBiometricPrompt(
            activity = this,
            onSuccess = {
                remember("signin")
                startMain("https://www.redsracing.org/", guest = false)
            },
            onCancel = { },
        )
    }

    private fun remember(mode: String) {
        prefs.edit()
            .putBoolean("remember_choice", true)
            .putString("mode", mode)
            .apply()
    }

    private fun startMain(url: String, guest: Boolean) {
        val base = "https://www.redsracing.org/"
        val resolved = when {
            url.startsWith("http://") || url.startsWith("https://") -> url
            url.startsWith("file:///android_asset/www/") -> url
            url.startsWith("file://") -> url
            url.startsWith("/") -> base + url.removePrefix("/")
            else -> base + url
        }
        val i = Intent(this, MainActivity::class.java)
            .putExtra("initialUrl", resolved)
            .putExtra("guest", guest)
        startActivity(i)
        finish()
    }
}
