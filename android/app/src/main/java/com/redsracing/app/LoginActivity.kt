package com.redsracing.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.redsracing.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        // Splash theme is applied via manifest
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.signInButton.setOnClickListener {
            startMain("file:///android_asset/www/login.html", guest = false)
        }
        binding.guestButton.setOnClickListener {
            startMain("file:///android_asset/www/index.html", guest = true)
        }
    }

    private fun startMain(url: String, guest: Boolean) {
        val i = Intent(this, MainActivity::class.java)
            .putExtra("initialUrl", url)
            .putExtra("guest", guest)
        startActivity(i)
        finish()
    }
}