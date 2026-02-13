package com.redsracing.app

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.webkit.*
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashContainer: FrameLayout
    private lateinit var logoContainer: LinearLayout
    private lateinit var loadingIndicator: ProgressBar
    
    private var isLoading = true
    private var showSplash = true

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        
        // Edge-to-edge display like iOS
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.parseColor("#05080F")
        
        // Use the simple layout
        setContentView(R.layout.activity_main_simple)
        
        // Find views
        webView = findViewById(R.id.webview)
        splashContainer = findViewById(R.id.splashContainer)
        logoContainer = findViewById(R.id.logoContainer)
        loadingIndicator = findViewById(R.id.loadingIndicator)
        
        setupWebView()
        showSplashScreen()
        
        // Load the website directly like iOS
        webView.loadUrl("https://redsracing.org")
        
        // Handle back navigation like iOS
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun showSplashScreen() {
        splashContainer.visibility = View.VISIBLE
        splashContainer.alpha = 1f

        // Initial state - scaled down and transparent (like iOS)
        logoContainer.scaleX = 0.8f
        logoContainer.scaleY = 0.8f
        logoContainer.alpha = 0f

        // Animate logo (matching iOS: scale 0.8 -> 1.0, opacity 0 -> 1)
        val scaleX = ObjectAnimator.ofFloat(logoContainer, View.SCALE_X, 0.8f, 1f)
        val scaleY = ObjectAnimator.ofFloat(logoContainer, View.SCALE_Y, 0.8f, 1f)
        val fadeIn = ObjectAnimator.ofFloat(logoContainer, View.ALPHA, 0f, 1f)

        AnimatorSet().apply {
            playTogether(scaleX, scaleY, fadeIn)
            duration = 800
            interpolator = DecelerateInterpolator()
            start()
        }

        // Hide splash after 2 seconds (like iOS)
        splashContainer.postDelayed({
            hideSplash()
        }, 2000)
    }

    private fun hideSplash() {
        showSplash = false
        
        // Fade out animation (like iOS)
        ObjectAnimator.ofFloat(splashContainer, View.ALPHA, 1f, 0f).apply {
            duration = 500
            interpolator = DecelerateInterpolator()
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    splashContainer.visibility = View.GONE
                }
            })
            start()
        }
        
        updateLoadingIndicator()
    }

    private fun updateLoadingIndicator() {
        if (isLoading && !showSplash) {
            loadingIndicator.visibility = View.VISIBLE
        } else {
            loadingIndicator.visibility = View.GONE
        }
    }

    @Suppress("SetJavaScriptEnabled")
    private fun setupWebView() {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            // Custom user agent like iOS
            userAgentString = "RedsRacingApp/1.0 Android"
        }

        // Dark background like iOS
        webView.setBackgroundColor(Color.parseColor("#05080F"))

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                isLoading = true
                updateLoadingIndicator()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                isLoading = false
                updateLoadingIndicator()

                // Inject dark theme CSS like iOS
                view?.evaluateJavascript(
                    "document.body.style.backgroundColor = '#05080f';",
                    null
                )
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val urlStr = url.toString()

                // Open external links in browser (like iOS)
                if (!urlStr.contains("redsracing") && 
                    (urlStr.startsWith("http://") || urlStr.startsWith("https://")) &&
                    request.isForMainFrame) {
                    try {
                        startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, url))
                        return true
                    } catch (_: Exception) {}
                }

                // Handle tel: and mailto: links
                if (urlStr.startsWith("tel:") || urlStr.startsWith("mailto:")) {
                    try {
                        startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, url))
                    } catch (_: Exception) {}
                    return true
                }

                return false
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                isLoading = false
                updateLoadingIndicator()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress == 100) {
                    isLoading = false
                    updateLoadingIndicator()
                }
            }
        }
    }
}
