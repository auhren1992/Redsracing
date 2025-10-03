package com.redsracing.app

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.redsracing.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        // Ensure SplashScreen compat switches to postSplashScreenTheme early on pre-Android 12
        installSplashScreen()
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)

        // If user chose to remember last choice, skip this screen
        if (prefs.getBoolean("remember_choice", false)) {
            when (prefs.getString("mode", "")) {
                "signin" -> {
                    startMain("file:///android_asset/www/login.html", guest = false)
                    return
                }
                "guest" -> {
                    startMain("file:///android_asset/www/index.html", guest = true)
                    return
                }
            }
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.signInButton.setOnClickListener {
            // Do not remember here; remember only after the web app confirms successful sign-in via AndroidAuth.onLoginSuccess()
            startMain("file:///android_asset/www/login.html", guest = false)
        }
        binding.guestButton.setOnClickListener {
            if (binding.rememberCheck.isChecked) remember("guest")
            startMain("file:///android_asset/www/index.html", guest = true)
        }
        binding.createAccountLink.setOnClickListener {
            // Do not remember yet; only after account creation + login is successful in the web app
            startMain("file:///android_asset/www/signup.html", guest = false)
        }
    }

    private fun remember(mode: String) {
        prefs.edit()
            .putBoolean("remember_choice", true)
            .putString("mode", mode)
            .apply()
    }

    private fun startMain(url: String, guest: Boolean) {
        // Prefer live site URLs to ensure all navigation and dynamic data work
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
