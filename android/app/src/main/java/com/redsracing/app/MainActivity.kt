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

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBottomNavBinding.inflate(layoutInflater)
        setContentView(binding.root)

        WebView.setWebContentsDebuggingEnabled(true)
        
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
        
        // No notification data - check auth and route normally
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
            MenuItem("🏎️", "Jon Kirsch #8 - Profile", "driver.html"),
            MenuItem("📸", "Jon Kirsch #8 - Gallery", "gallery.html"),
            MenuItem("📊", "Jon Kirsch #8 - Race Results", "jons.html"),
            MenuItem("🏎️", "Jonny Kirsch #88 - Profile", "jonny.html"),
            MenuItem("📸", "Jonny Kirsch #88 - Gallery", "jonny-gallery.html"),
            MenuItem("📊", "Jonny Kirsch #88 - Results", "jonny-results.html"),
            MenuItem("🏆", "Team Legends", "legends.html")
        )
        showMenuOverlay("Drivers", items)
    }

    private fun showRacingMenu() {
        val items = listOf(
            MenuItem("🔴", "Live Race", "live.html"),
            MenuItem("📅", "Schedule", "schedule.html"),
            MenuItem("📊", "Season Stats", "stats.html"),
            MenuItem("🏁", "Race Recaps", "recaps.html"),
            MenuItem("🏆", "Leaderboard", "leaderboard.html"),
            MenuItem("🗺️", "Track Guides", "tracks.html"),
            MenuItem("🎥", "Videos", "videos.html")
        )
        showMenuOverlay("Racing", items)
    }

    private fun showCommunityMenu() {
        val items = listOf(
            MenuItem("🏆", "Predictions", "predictions.html"),
            MenuItem("📣", "Fan Wall", "fan-wall.html"),
            MenuItem("❓", "Q&A", "qna.html"),
            MenuItem("💬", "Feedback", "feedback.html"),
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
            items.add(MenuItem("👤", "My Profile", "profile.html"))
            
            if (isLoggedIn) {
                if (isAdmin) {
                    items.add(MenuItem("📊", "Admin Console", "admin-console.html"))
                }
                items.add(MenuItem("⚙️", "Settings", "settings.html"))
                items.add(MenuItem("🚪", "Sign Out", "javascript:logout"))
            } else {
                items.add(MenuItem("🔐", "Sign In", "login.html"))
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
                            if (window.AndroidAuth) {
                                window.AndroidAuth.onLogout();
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
            binding.webview.clearCache(true)
            binding.webview.clearHistory()
            // Keep cookies/local auth state so users stay logged in after app updates.
            prefs.edit().putInt("app_version_code", currentVersion).apply()
            Toast.makeText(this, "App updated - loading new content", Toast.LENGTH_SHORT).show()
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
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
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
                            var header = document.querySelector('header');
                            if (header) {
                                header.style.display = 'none';
                                header.style.visibility = 'hidden';
                                header.style.height = '0';
                                header.style.overflow = 'hidden';
                            }
                            document.body.style.paddingTop = '0';
                            document.body.style.marginTop = '0';
                            document.body.style.paddingBottom = '120px';
                            document.body.style.overflow = 'visible';
                            var mainElements = document.querySelectorAll('main');
                            mainElements.forEach(function(main) {
                                main.style.marginTop = '0';
                                main.style.paddingTop = '0';
                                main.style.paddingBottom = '120px';
                            });
                            // Ensure countdown labels are visible
                            var countdownLabels = document.querySelectorAll('.countdown-label');
                            countdownLabels.forEach(function(label) {
                                label.style.display = 'block';
                                label.style.visibility = 'visible';
                                label.style.opacity = '1';
                                label.style.color = '#ffffff';
                            });
                            // Show admin sidebar on mobile for admin-console page
                            if (window.location.href.indexOf('admin-console') !== -1) {
                                var sidebar = document.querySelector('.sidebar-nav');
                                if (sidebar) {
                                    sidebar.classList.remove('hidden', 'lg:block');
                                    sidebar.style.display = 'block';
                                    sidebar.style.position = 'relative';
                                    sidebar.style.width = '100%';
                                }
                                // Make the layout stack vertically on mobile
                                var flexContainer = document.querySelector('.flex.min-h-screen');
                                if (flexContainer) {
                                    flexContainer.style.flexDirection = 'column';
                                }
                            }
                        }, 100);
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideNavJS, null)
                
                // Inject JavaScript to capture Firebase auth tokens and handle logout
                val authTokenCaptureJS = """
                    (function() {
                        // Check if Firebase auth is available (compat mode)
                        if (typeof firebase !== 'undefined' && firebase.auth) {
                            var auth = firebase.auth();
                            
                            // Listen for auth state changes
                            auth.onAuthStateChanged(function(user) {
                                if (user) {
                                    // User is signed in - get and store the ID token
                                    user.getIdToken().then(function(token) {
                                        if (window.FirebaseAuthBridge) {
                                            window.FirebaseAuthBridge.storeAuthToken(token);
                                            console.log('Auth token stored via FirebaseAuthBridge');
                                        }
                                    }).catch(function(error) {
                                        console.error('Error getting ID token:', error);
                                    });
                                } else {
                                    // User is signed out - clear the stored token
                                    if (window.FirebaseAuthBridge) {
                                        window.FirebaseAuthBridge.clearAuthToken();
                                        console.log('Auth token cleared via FirebaseAuthBridge');
                                    }
                                }
                            });
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(authTokenCaptureJS, null)
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
            
            val usageData = hashMapOf(
                "platform" to "android",
                "app_version" to versionCode,
                "app_version_name" to versionName,
                "fcm_token" to fcmToken,
                "device_model" to Build.MODEL,
                "android_version" to Build.VERSION.RELEASE,
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
        // Always start at index and let web Firebase auth/local persistence decide session state.
        // Native FirebaseAuth state is separate from WebView Firebase auth and should not route here.
        android.util.Log.d("MainActivity", "Loading index route and deferring auth state to WebView Firebase")
        binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
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

data class MenuItem(val icon: String, val title: String, val url: String)

class MenuAdapter(
    private val items: List<MenuItem>,
    private val onClick: (MenuItem) -> Unit
) : RecyclerView.Adapter<MenuAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val icon: TextView = view.findViewById(R.id.item_icon)
        val title: TextView = view.findViewById(R.id.item_title)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.menu_item_card, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.icon.text = item.icon
        holder.title.text = item.title
        holder.itemView.setOnClickListener { onClick(item) }
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
