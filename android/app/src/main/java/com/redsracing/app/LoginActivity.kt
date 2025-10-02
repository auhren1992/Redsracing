package com.redsracing.app

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.redsracing.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        // Splash theme is applied via manifest
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
            if (binding.rememberCheck.isChecked) remember("signin")
            startMain("file:///android_asset/www/login.html", guest = false)
        }
        binding.guestButton.setOnClickListener {
            if (binding.rememberCheck.isChecked) remember("guest")
            startMain("file:///android_asset/www/index.html", guest = true)
        }
        binding.createAccountLink.setOnClickListener {
            if (binding.rememberCheck.isChecked) remember("signin")
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
        val i = Intent(this, MainActivity::class.java)
            .putExtra("initialUrl", url)
            .putExtra("guest", guest)
        startActivity(i)
        finish()
    }
}
