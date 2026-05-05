package com.redsracing.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.LinearGradient
import android.graphics.Shader
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.widget.TextView
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.webkit.WebViewAssetLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import com.redsracing.app.databinding.ActivityMainBottomNavBinding
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBottomNavBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var permissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var firebaseAuthBridge: FirebaseAuthBridge
    private var lastFcmToken: String? = null
    private var initialUrl: String? = null
    private var isGuest: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBottomNavBinding.inflate(layoutInflater)
        setContentView(binding.root)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        initialUrl = intent?.getStringExtra("initialUrl")
        isGuest = intent?.getBooleanExtra("guest", false) ?: false
        
        // Remove navigation icon from toolbar
        binding.toolbar.navigationIcon = null
        
        // Set gradient text for toolbar title
        setupToolbarGradient()

        createNotificationChannel()
        initializeFirebaseMessaging()
        checkAppVersion()

        permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { }

        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { activityResult ->
            val resultData = activityResult.data
            val results = mutableListOf<Uri>()

            cameraPhotoUri?.let { uri ->
                if (activityResult.resultCode == RESULT_OK) {
                    results.add(uri)
                }
                cameraPhotoUri = null
            }

            if (resultData != null && activityResult.resultCode == RESULT_OK) {
                val clipData = resultData.clipData
                val dataUri = resultData.data
                if (clipData != null) {
                    for (i in 0 until clipData.itemCount) {
                        results.add(clipData.getItemAt(i).uri)
                    }
                } else if (dataUri != null) {
                    results.add(dataUri)
                }
            }

            filePathCallback?.onReceiveValue(if (results.isNotEmpty()) results.toTypedArray() else null)
            filePathCallback = null
        }

        requestNotificationPermissionIfNeeded()
        clearCacheIfVersionChanged()
        setupWebView(binding.webview)
        setupBottomNavigation()
        setupMenuOverlay()
        
        // Initialize Mobile Ads SDK and load banner ad
        try {
            MobileAds.initialize(this) {}
            val adRequest = AdRequest.Builder().build()
            binding.adView.loadAd(adRequest)
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to initialize ads", e)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.root.findViewById<View>(R.id.menu_overlay)?.visibility == View.VISIBLE) {
                    hideMenuOverlay()
                    return
                }
                if (binding.webview.canGoBack()) binding.webview.goBack() else finish()
            }
        })

        // Handle notification intent if present
        handleNotificationIntent(intent)
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent(intent)
    }

    override fun onPause() {
        super.onPause()
        // Force WebView to flush localStorage/cookies to disk so auth persists across app restarts
        try {
            CookieManager.getInstance().flush()
        } catch (_: Exception) {}
    }

    override fun onStop() {
        super.onStop()
        try {
            CookieManager.getInstance().flush()
        } catch (_: Exception) {}
    }
    
    private fun handleNotificationIntent(intent: Intent?) {
        intent?.extras?.let { extras ->
            // Check if this intent came from a notification
            val hasNotificationData = extras.containsKey("title") || 
                                     extras.containsKey("body") ||
                                     extras.containsKey("url")
            
            if (hasNotificationData) {
                // Notification was tapped - navigate to admin console
                val rawUrl = extras.getString("url")
                val url = when {
                    rawUrl.isNullOrBlank() -> "https://appassets.androidplatform.net/assets/www/admin-console.html"
                    rawUrl.startsWith("http://") || rawUrl.startsWith("https://") -> rawUrl
                    rawUrl.endsWith(".html") -> "https://appassets.androidplatform.net/assets/www/$rawUrl"
                    else -> "https://appassets.androidplatform.net/assets/www/admin-console.html"
                }
                android.util.Log.d("MainActivity", "Opening from notification: $url")
                binding.webview.loadUrl(url)
                return
            }
        }
        
        // No notification data - honor explicit initialUrl when present (LoginActivity flow)
        val next = intent?.getStringExtra("initialUrl") ?: initialUrl
        val guest = intent?.getBooleanExtra("guest", false) ?: isGuest
        if (!next.isNullOrBlank()) {
            binding.webview.loadUrl(next)
            return
        }

        // Otherwise route based on saved auth / guest mode
        if (guest) {
            binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
            return
        }
        checkAuthAndRoute()
    }

    private fun setupToolbarGradient() {
        // Find the TextView inside the toolbar
        for (i in 0 until binding.toolbar.childCount) {
            val child = binding.toolbar.getChildAt(i)
            if (child is TextView) {
                child.post {
                    val paint = child.paint
                    val width = paint.measureText(child.text.toString())
                    val shader = LinearGradient(
                        0f, 0f, width, 0f,
                        intArrayOf(
                            0xFF3b82f6.toInt(),  // Blue
                            0xFFfbbf24.toInt()   // Yellow
                        ),
                        null,
                        Shader.TileMode.CLAMP
                    )
                    child.paint.shader = shader
                }
                break
            }
        }
    }

    private fun setupBottomNavigation() {
        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
                    hideMenuOverlay()
                    true
                }
                R.id.nav_drivers -> {
                    showDriversMenu()
                    true
                }
                R.id.nav_racing -> {
                    showRacingMenu()
                    true
                }
                R.id.nav_community -> {
                    showCommunityMenu()
                    true
                }
                R.id.nav_more -> {
                    showMoreMenu()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupMenuOverlay() {
        val overlay = layoutInflater.inflate(R.layout.menu_overlay, binding.root as ViewGroup, false)
        (binding.root as ViewGroup).addView(overlay)
        
        overlay.setOnClickListener {
            hideMenuOverlay()
        }
    }

    private fun showDriversMenu() {
        val items = listOf(
            MenuItem("", "Jon Kirsch #8", "", isHeader = true),
            MenuItem("👤", "Profile", "driver.html"),
            MenuItem("📸", "Gallery", "gallery.html"),
            MenuItem("📊", "Race Results", "jons.html"),
            MenuItem("", "Jonny Kirsch #88", "", isHeader = true),
            MenuItem("👤", "Profile", "jonny.html"),
            MenuItem("📸", "Gallery", "jonny-gallery.html"),
            MenuItem("📊", "Race Results", "jonny-results.html"),
            MenuItem("", "Team", "", isHeader = true),
            MenuItem("🏆", "Team Legends", "legends.html")
        )
        showMenuOverlay("Drivers", items)
    }

    private fun showRacingMenu() {
        val items = listOf(
            MenuItem("", "Live", "", isHeader = true),
            MenuItem("🔴", "Live Race", "live.html"),
            MenuItem("", "Season", "", isHeader = true),
            MenuItem("📅", "Schedule", "schedule.html"),
            MenuItem("📊", "Season Stats", "stats.html"),
            MenuItem("🏁", "Race Recaps", "recaps.html"),
            MenuItem("🏆", "Leaderboard", "leaderboard.html"),
            MenuItem("", "Media", "", isHeader = true),
            MenuItem("🗺️", "Track Guides", "tracks.html"),
            MenuItem("🎥", "Videos", "videos.html")
        )
        showMenuOverlay("Racing", items)
    }

    private fun showCommunityMenu() {
        val items = listOf(
            MenuItem("", "Interact", "", isHeader = true),
            MenuItem("🏆", "Predictions", "predictions.html"),
            MenuItem("📣", "Fan Wall", "fan-wall.html"),
            MenuItem("❓", "Q&A", "qna.html"),
            MenuItem("💬", "Feedback", "feedback.html"),
            MenuItem("", "Info", "", isHeader = true),
            MenuItem("ℹ️", "About Us", "about.html"),
            MenuItem("📞", "Contact", "contact.html"),
            MenuItem("📖", "Racing Guide", "racing-guide.html"),
            MenuItem("💰", "Sponsorship", "sponsorship.html")
        )
        showMenuOverlay("Community", items)
    }

    private fun showMoreMenu() {
        // Check login state and admin role from cached localStorage values
        binding.webview.evaluateJavascript(
            "(function(){ try { var l=!!localStorage.getItem('rr_auth_uid'); var r=localStorage.getItem('rr_user_role')||''; return JSON.stringify({l:l,r:r}); } catch(e){ return '{\"l\":false,\"r\":\"\"}'; } })();"
        ) { result ->
            val clean = result?.trim()?.removeSurrounding("\"")?.replace("\\\"", "\"") ?: ""
            val isLoggedIn = clean.contains("\"l\":true")
            val isAdmin = clean.contains("\"r\":\"admin\"")
            
            val items = mutableListOf<MenuItem>()
            items.add(MenuItem("", "Account", "", isHeader = true))
            items.add(MenuItem("👤", "My Profile", "profile.html"))
            
            if (isLoggedIn) {
                if (isAdmin) {
                    items.add(MenuItem("", "Admin", "", isHeader = true))
                    items.add(MenuItem("📊", "Admin Console", "admin-console.html"))
                }
                items.add(MenuItem("", "", "", isHeader = true))
                items.add(MenuItem("⚙️", "Settings", "settings.html"))
                items.add(MenuItem("🚪", "Sign Out", "javascript:logout"))
            } else {
                items.add(MenuItem("", "Get Started", "", isHeader = true))
                items.add(MenuItem("🔐", "Sign In", "login.html"))
                items.add(MenuItem("✏️", "Create Account", "signup.html"))
                items.add(MenuItem("⚙️", "Settings", "settings.html"))
            }
            
            runOnUiThread {
                showMenuOverlay("More", items)
            }
        }
    }

    private fun showMenuOverlay(title: String, items: List<MenuItem>) {
        val overlay = binding.root.findViewById<View>(R.id.menu_overlay)
        val menuTitle = overlay.findViewById<TextView>(R.id.menu_title)
        val recyclerView = overlay.findViewById<RecyclerView>(R.id.menu_items)

        menuTitle.text = title
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = MenuAdapter(items) { item ->
            if (item.url == "javascript:logout") {
                // Handle logout
                binding.webview.evaluateJavascript(
                    """
                    (async function() {
                        try {
                            const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
                            const auth = getAuth();
                            await signOut(auth);
                            localStorage.removeItem('redsracing_user');
                            localStorage.removeItem('rr_auth_uid');
                            localStorage.removeItem('rr_user_name');
                            localStorage.removeItem('rr_guest_ok');
                            if (window.AndroidAuth) {
                                window.AndroidAuth.onLogout();
                            }
                            if (window.FirebaseAuthBridge) {
                                window.FirebaseAuthBridge.clearAllAuth();
                            }
                            window.location.href = 'index.html';
                        } catch(e) {
                            console.error('Logout error:', e);
                        }
                    })();
                    """.trimIndent(),
                    null
                )
                hideMenuOverlay()
            } else {
                binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/${item.url}")
                hideMenuOverlay()
            }
        }

        overlay.visibility = View.VISIBLE
        val fadeIn = AnimationUtils.loadAnimation(this, android.R.anim.fade_in)
        overlay.startAnimation(fadeIn)
    }

    private fun hideMenuOverlay() {
        val overlay = binding.root.findViewById<View>(R.id.menu_overlay)
        val fadeOut = AnimationUtils.loadAnimation(this, android.R.anim.fade_out)
        overlay.startAnimation(fadeOut)
        overlay.visibility = View.GONE
    }

    private fun clearCacheIfVersionChanged() {
        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val savedVersion = prefs.getInt("app_version_code", -1)
        val currentVersion = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0)).longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0).versionCode
            }
        } catch (e: Exception) {
            -1
        }

        if (savedVersion != currentVersion && currentVersion > 0) {
            // Force clear cache ONCE to flush stale admin-console.html
            // This will sign the user out this one time, but fixes the stuck cache
            if (savedVersion < 147) {
                binding.webview.clearCache(true)
                android.util.Log.d("MainActivity", "One-time cache clear for build 147+ transition")
            }
            binding.webview.clearHistory()
            prefs.edit().putInt("app_version_code", currentVersion).apply()
            android.util.Log.d("MainActivity", "Version changed from $savedVersion to $currentVersion")
        }
    }

    @Suppress("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") {
                    val path = url.encodedPath ?: "/"
                    if (path == "/favicon.ico") {
                        val favicon = Uri.parse("https://appassets.androidplatform.net/assets/www/favicon.svg")
                        assetLoader.shouldInterceptRequest(favicon)?.let { return it }
                    }
                    if (!path.startsWith("/assets/")) {
                        val fixed = Uri.parse("https://appassets.androidplatform.net/assets/www" + (if (path.startsWith("/")) path else "/$path"))
                        assetLoader.shouldInterceptRequest(fixed)?.let { return it }
                    }
                    if (path.startsWith("/assets/") && !path.startsWith("/assets/www/")) {
                        val fixed = Uri.parse("https://appassets.androidplatform.net/assets/www$path")
                        assetLoader.shouldInterceptRequest(fixed)?.let { return it }
                    }
                    return assetLoader.shouldInterceptRequest(url)
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val urlStr = url.toString()

                if (url.host?.endsWith("google.com") == true || urlStr.startsWith("intent:") || urlStr.startsWith("market:")) {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }

                // Handle relative URLs (internal navigation)
                if (!urlStr.startsWith("http") && !urlStr.startsWith("file") && 
                    (urlStr.endsWith(".html") || urlStr.contains(".html"))) {
                    // Extract just the filename from the URL
                    val fileName = url.path?.split("/")?.lastOrNull() ?: urlStr
                    view?.loadUrl("https://appassets.androidplatform.net/assets/www/$fileName")
                    return true
                }

                return when {
                    urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("file://") -> false
                    urlStr.startsWith("tel:") || urlStr.startsWith("mailto:") -> {
                        try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: Exception) {}
                        true
                    }
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Hide website navigation and add bottom padding for bottom nav
                val hideNavJS = """
                    (function(){
                        setTimeout(function() {
                            var isAdmin = window.location.href.indexOf('admin-console') !== -1;
                            var header = document.querySelector('header');
                            if (header) {
                                header.style.display = 'none';
                                header.style.visibility = 'hidden';
                                header.style.height = '0';
                                header.style.overflow = 'hidden';
                            }
                            // On admin console: show the admin menu bar and ensure mobile-menu works
                            if (isAdmin) {
                                var adminBar = document.getElementById('admin-menu-bar');
                                if (adminBar) {
                                    adminBar.style.display = 'flex';
                                    adminBar.style.visibility = 'visible';
                                }
                                // Hide desktop sidebar on app
                                var sidebar = document.querySelector('.sidebar-nav');
                                if (sidebar) sidebar.style.display = 'none';
                            }
                            document.body.style.paddingTop = '0';
                            document.body.style.marginTop = '0';
                            document.body.style.paddingBottom = '120px';
                            var mainElements = document.querySelectorAll('main');
                            mainElements.forEach(function(main) {
                                main.style.marginTop = '0';
                                main.style.paddingTop = '0';
                                main.style.paddingBottom = '120px';
                            });
                            var countdownLabels = document.querySelectorAll('.countdown-label');
                            countdownLabels.forEach(function(label) {
                                label.style.display = 'block';
                                label.style.visibility = 'visible';
                                label.style.opacity = '1';
                                label.style.color = '#ffffff';
                            });
                        }, 100);
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideNavJS, null)
                
                // Restore auth markers from native storage into localStorage
                // This runs AFTER guest-gate.js (which is a <script> tag in the HTML head),
                // but guest-gate.js itself also checks the native bridge synchronously.
                // This ensures localStorage stays populated for subsequent JS that checks it.
                val restoreAuthJS = """
                    (function() {
                        try {
                            if (window.FirebaseAuthBridge) {
                                var uid = window.FirebaseAuthBridge.getAuthUid();
                                if (uid && uid.length > 0) {
                                    localStorage.setItem('rr_auth_uid', uid);
                                }
                            }
                        } catch(e) { console.warn('Auth restore error:', e); }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(restoreAuthJS, null)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                val context = view?.context ?: return false
                val tempWebView = WebView(context)
                tempWebView.settings.javaScriptEnabled = true
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun onPageStarted(v: WebView?, url: String?, favicon: Bitmap?) {
                        if (url != null && view != null) {
                            view.loadUrl(url)
                        }
                    }
                }
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                transport.webView = tempWebView
                resultMsg.sendToTarget()
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback = filePathCallback
                ensureMediaAndCameraPermissions()
                val captureIntent = createCameraIntent()
                val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                val intentArray = arrayOfNulls<Intent>(if (captureIntent != null) 1 else 0)
                captureIntent?.let { intentArray[0] = it }
                val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentIntent)
                    if (intentArray.isNotEmpty()) putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
                    putExtra(Intent.EXTRA_TITLE, "Select or capture image")
                }
                fileChooserLauncher.launch(chooser)
                return true
            }
        }

        firebaseAuthBridge = FirebaseAuthBridge(this)
        webView.addJavascriptInterface(firebaseAuthBridge, "FirebaseAuthBridge")
        webView.addJavascriptInterface(NotificationsBridge(this), "AndroidNotifications")
        webView.addJavascriptInterface(AuthBridge(this), "AndroidAuth")
    }

    private fun ensureMediaAndCameraPermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_MEDIA_IMAGES)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun createCameraIntent(): Intent? {
        val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (takePictureIntent.resolveActivity(packageManager) == null) return null
        val photoFile = try {
            createImageFile()
        } catch (ex: IOException) {
            null
        }
        return if (photoFile != null) {
            val photoURI = FileProvider.getUriForFile(this, "com.redsracing.app.fileprovider", photoFile)
            cameraPhotoUri = photoURI
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            takePictureIntent
        } else {
            null
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NotificationsBridge.CHANNEL_ID,
                "App Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
            }
        }
    }

    private fun initializeFirebaseMessaging() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                android.util.Log.w("MainActivity", "FCM token fetch failed", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            android.util.Log.d("MainActivity", "FCM Token: $token")
            lastFcmToken = token

            // Subscribe to topics
            FirebaseMessaging.getInstance().subscribeToTopic("all_users")
                .addOnCompleteListener { topicTask ->
                    if (topicTask.isSuccessful) {
                        android.util.Log.d("MainActivity", "Subscribed to all_users topic")
                    }
                }

            FirebaseMessaging.getInstance().subscribeToTopic("android_users")
                .addOnCompleteListener { topicTask ->
                    if (topicTask.isSuccessful) {
                        android.util.Log.d("MainActivity", "Subscribed to android_users topic")
                    }
                }
            
            // Report app version and device info to Firestore
            reportAppUsage(token)
        }
    }
    
    private fun reportAppUsage(fcmToken: String) {
        try {
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0)).longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0).versionCode
            }
            
            val versionName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0)).versionName
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0).versionName
            }
            
            // Prefer identity saved by WebView (FirebaseAuthBridge) since most auth happens in JS.
            val bridgeUid = try { firebaseAuthBridge.getAuthUid().trim() } catch (_: Exception) { "" }
            val bridgeEmail = try { firebaseAuthBridge.getAuthEmail().trim() } catch (_: Exception) { "" }
            val currentUser = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser } catch (_: Exception) { null }
            val uid = if (bridgeUid.isNotEmpty()) bridgeUid else (currentUser?.uid ?: "")
            val email = if (bridgeEmail.isNotEmpty()) bridgeEmail else (currentUser?.email ?: "")
            val usageData = hashMapOf(
                "platform" to "android",
                "app_version" to versionCode,
                "app_version_name" to versionName,
                "fcm_token" to fcmToken,
                "device_model" to Build.MODEL,
                "android_version" to Build.VERSION.RELEASE,
                // Optional identity fields (present only when signed in)
                "auth_uid" to uid,
                "auth_email" to email,
                "last_seen" to com.google.firebase.Timestamp.now()
            )
            
            // Use FCM token as document ID for upsert behavior
            FirebaseFirestore.getInstance()
                .collection("app_usage")
                .document(fcmToken)
                .set(usageData)
                .addOnSuccessListener {
                    android.util.Log.d("MainActivity", "App usage reported successfully")
                }
                .addOnFailureListener { e ->
                    android.util.Log.w("MainActivity", "Failed to report app usage", e)
                }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error reporting app usage", e)
        }
    }

    override fun onResume() {
        super.onResume()
        // Refresh app_usage on resume so "who updated / last seen" stays current after login/navigation.
        try {
            val token = lastFcmToken
            if (!token.isNullOrEmpty()) {
                reportAppUsage(token)
            }
        } catch (_: Exception) {}
    }

    private fun checkAppVersion() {
        val currentVersionCode = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0)).longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0).versionCode
            }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to get version code", e)
            return
        }

        // Check Firestore for latest version
        FirebaseFirestore.getInstance()
            .collection("app_config")
            .document("android_version")
            .get()
            .addOnSuccessListener { document ->
                if (document.exists()) {
                    val latestVersion = document.getLong("latest_version")?.toInt() ?: currentVersionCode
                    val minimumVersion = document.getLong("minimum_version")?.toInt() ?: currentVersionCode
                    
                    if (currentVersionCode < minimumVersion) {
                        // Force update required
                        showUpdateDialog(true, latestVersion)
                    } else if (currentVersionCode < latestVersion) {
                        // Optional update available
                        showUpdateDialog(false, latestVersion)
                    }
                }
            }
            .addOnFailureListener { e ->
                android.util.Log.w("MainActivity", "Failed to check app version", e)
            }
    }

    private fun checkAuthAndRoute() {
        if (firebaseAuthBridge.hasAuthUid()) {
            // User was previously authenticated — go to home page
            android.util.Log.d("MainActivity", "Saved auth UID found, loading home page")
            binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        } else {
            // No saved auth — show signup/login
            android.util.Log.d("MainActivity", "No saved auth, loading signup")
            binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/signup.html")
        }
    }
    
    private fun showUpdateDialog(isForced: Boolean, latestVersion: Int) {
        val message = if (isForced) {
            "A required update is available. Please update to continue using the app."
        } else {
            "A new version (v$latestVersion) is available. Would you like to update?"
        }

        val builder = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(if (isForced) "Update Required" else "Update Available")
            .setMessage(message)
            .setPositiveButton("Update") { _, _ ->
                // Open Play Store
                val playStoreIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
                )
                try {
                    startActivity(playStoreIntent)
                } catch (e: Exception) {
                    Toast.makeText(this, "Unable to open Play Store", Toast.LENGTH_SHORT).show()
                }
                if (isForced) {
                    finish()
                }
            }
            .setCancelable(!isForced)

        if (!isForced) {
            builder.setNegativeButton("Later") { dialog, _ ->
                dialog.dismiss()
            }
        } else {
            builder.setOnCancelListener {
                finish()
            }
        }

        runOnUiThread {
            builder.create().show()
        }
    }
}

data class MenuItem(val icon: String, val title: String, val url: String, val isHeader: Boolean = false)

class MenuAdapter(
    private val items: List<MenuItem>,
    private val onClick: (MenuItem) -> Unit
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val TYPE_HEADER = 0
        private const val TYPE_ITEM = 1
    }

    class ItemViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon: TextView = view.findViewById(R.id.item_icon)
        val title: TextView = view.findViewById(R.id.item_title)
    }

    class HeaderViewHolder(val textView: TextView) : RecyclerView.ViewHolder(textView)

    override fun getItemViewType(position: Int): Int {
        return if (items[position].isHeader) TYPE_HEADER else TYPE_ITEM
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == TYPE_HEADER) {
            val tv = TextView(parent.context).apply {
                layoutParams = ViewGroup.MarginLayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 16
                    bottomMargin = 4
                }
                setPadding(4, 0, 0, 0)
                setTextColor(0xFF64748b.toInt())
                textSize = 11f
                isAllCaps = true
                letterSpacing = 0.08f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
            HeaderViewHolder(tv)
        } else {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.menu_item_card, parent, false)
            ItemViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = items[position]
        if (holder is HeaderViewHolder) {
            holder.textView.text = item.title
        } else if (holder is ItemViewHolder) {
            holder.icon.text = item.icon
            holder.title.text = item.title
            holder.itemView.setOnClickListener { onClick(item) }
        }
    }

    override fun getItemCount() = items.size
}

class AuthBridge(private val context: Context) {
    private val prefs by lazy { context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE) }

    @android.webkit.JavascriptInterface
    fun onLoginSuccess() {
        prefs.edit().putBoolean("remember_choice", true).putString("mode", "signin").apply()
    }

    @android.webkit.JavascriptInterface
    fun onLogout() {
        prefs.edit().remove("remember_choice").remove("mode").apply()
    }
}

class NotificationsBridge(private val context: Context) {
    companion object {
        const val CHANNEL_ID = "default_channel"
    }

    @android.webkit.JavascriptInterface
    fun notify(title: String, text: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val builder = androidx.core.app.NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
        nm.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
