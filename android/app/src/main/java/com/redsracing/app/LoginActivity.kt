package com.redsracing.app

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
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
                    // Open site home; app flow will route as needed
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

        // iOS-style entrance animation
        animateEntrance()

        binding.signInButton.setOnClickListener {
            // Do not remember here; remember only after the web app confirms successful sign-in via AndroidAuth.onLoginSuccess()
            // Open the login page to sign in
            startMain("https://www.redsracing.org/login.html", guest = false)
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

    private fun animateEntrance() {
        // Set initial state - scaled down and transparent (like iOS)
        val logoContainer = binding.logoContainer
        val buttonsContainer = binding.buttonsContainer
        
        logoContainer.scaleX = 0.8f
        logoContainer.scaleY = 0.8f
        logoContainer.alpha = 0f
        buttonsContainer.alpha = 0f
        buttonsContainer.translationY = 30f

        // Animate logo (matching iOS: scale 0.8 -> 1.0, opacity 0 -> 1)
        val scaleX = ObjectAnimator.ofFloat(logoContainer, View.SCALE_X, 0.8f, 1f)
        val scaleY = ObjectAnimator.ofFloat(logoContainer, View.SCALE_Y, 0.8f, 1f)
        val fadeIn = ObjectAnimator.ofFloat(logoContainer, View.ALPHA, 0f, 1f)
        
        val logoAnimator = AnimatorSet().apply {
            playTogether(scaleX, scaleY, fadeIn)
            duration = 800
            interpolator = DecelerateInterpolator()
        }

        // Animate buttons with slight delay
        val buttonsFade = ObjectAnimator.ofFloat(buttonsContainer, View.ALPHA, 0f, 1f)
        val buttonsSlide = ObjectAnimator.ofFloat(buttonsContainer, View.TRANSLATION_Y, 30f, 0f)
        
        val buttonsAnimator = AnimatorSet().apply {
            playTogether(buttonsFade, buttonsSlide)
            duration = 600
            startDelay = 400
            interpolator = DecelerateInterpolator()
        }

        // Start animations
        logoAnimator.start()
        buttonsAnimator.start()
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
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }
}
