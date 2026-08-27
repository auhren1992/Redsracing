package com.redsracing.app

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.webkit.WebViewCompat
import com.redsracing.app.databinding.ActivityLoginBinding

/**
 * Standalone native-app login (bundled login.html + JS, not dependent on Firebase Hosting deploy).
 * After sign-in, session is stored in [FirebaseAuthBridge] and the main app loads www.redsracing.org.
 */
class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var firebaseAuthBridge: FirebaseAuthBridge
    private lateinit var appLockBridge: AppLockBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        firebaseAuthBridge = FirebaseAuthBridge(this)
        if (firebaseAuthBridge.hasAuthUid()) {
            openMainApp()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (hasBiometricUnlockSession()) {
            binding.loginFallbackPanel.visibility = View.VISIBLE
            binding.unlockButton.visibility = View.VISIBLE
            binding.unlockButton.setOnClickListener { runBiometricUnlockAndOpen() }
        } else {
            binding.loginFallbackPanel.visibility = View.GONE
        }

        binding.guestButton.setOnClickListener {
            openMainApp(guest = true)
        }

        setupLoginWebView(binding.loginWebView)
        binding.loginWebView.loadUrl(MainActivity.siteUrl("login.html"))
        AppMemoryTrimmer.bind(binding.loginWebView, null)
    }

    override fun onPause() {
        super.onPause()
        if (!::binding.isInitialized) return
        AppMemoryTrimmer.onActivityPause(binding.loginWebView, null)
    }

    override fun onStop() {
        super.onStop()
        if (!::binding.isInitialized) return
        AppMemoryTrimmer.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN)
    }

    override fun onResume() {
        super.onResume()
        if (!::binding.isInitialized) return
        AppMemoryTrimmer.onActivityResume(binding.loginWebView, null)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        AppMemoryTrimmer.onTrimMemory(level)
    }

    @Deprecated("Deprecated in Java")
    override fun onLowMemory() {
        super.onLowMemory()
        AppMemoryTrimmer.onLowMemory()
    }

    override fun onDestroy() {
        AppMemoryTrimmer.onActivityDestroy(
            if (::binding.isInitialized) binding.loginWebView else null,
            null,
        )
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupLoginWebView(webView: WebView) {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }

        val bg = ContextCompat.getColor(this, R.color.website_background)
        webView.setBackgroundColor(bg)

        try {
            val base = WebSettings.getDefaultUserAgent(this)
            webView.settings.userAgentString = "$base RedsRacingApp/1.0 Android"
        } catch (_: Throwable) {
        }

        try {
            WebViewCompat.addDocumentStartJavaScript(
                webView,
                "try{window.__RR_NATIVE_APP__='android';window.__RR_STANDALONE_APP_LOGIN__=true;}catch(e){}",
                setOf("*"),
            )
        } catch (_: Throwable) {
        }

        appLockBridge = AppLockBridge(this, firebaseAuthBridge)
        appLockBridge.attachWebView(webView)
        webView.addJavascriptInterface(firebaseAuthBridge, "FirebaseAuthBridge")
        webView.addJavascriptInterface(
            AuthBridge(this) { openMainApp() },
            "AndroidAuth",
        )
        webView.addJavascriptInterface(appLockBridge, "AppLockBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                val url = request.url
                if (NativeAuthAssets.shouldServeFromBundle(url.host, url.path)) {
                    NativeAuthAssets.load(this@LoginActivity, url.path ?: "")?.let { return it }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript(
                    "try{window.__RR_NATIVE_APP__='android';window.__RR_STANDALONE_APP_LOGIN__=true;}catch(e){}",
                    null,
                )
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?,
            ): Boolean {
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                val temp = WebView(this@LoginActivity)
                temp.settings.javaScriptEnabled = true
                temp.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView?, req: WebResourceRequest?): Boolean {
                        val target = req?.url?.toString() ?: return false
                        view?.loadUrl(target)
                        return true
                    }
                }
                transport.webView = temp
                resultMsg.sendToTarget()
                return true
            }
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
            onSuccess = { openMainApp() },
            onCancel = { },
        )
    }

    private fun openMainApp(guest: Boolean = false) {
        val intent = Intent(this, MainActivity::class.java)
            .putExtra("initialUrl", MainActivity.siteUrl(if (guest) "index.html" else "index.html"))
            .putExtra("guest", guest)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.loginWebView.canGoBack()) {
            binding.loginWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
