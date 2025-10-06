package com.example.redsracing

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.ActionBarDrawerToggle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.activity.OnBackPressedCallback
import androidx.drawerlayout.widget.DrawerLayout
import androidx.webkit.WebViewAssetLoader
import com.google.android.material.navigation.NavigationView
import com.example.redsracing.databinding.ActivityMainBinding
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var permissionLauncher: ActivityResultLauncher<Array<String>>

    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 12+ splash screen API (with compat on older versions)
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Enable remote debugging for WebView (inspect via chrome://inspect)
        WebView.setWebContentsDebuggingEnabled(true)

        // Drawer + toolbar setup
        val toggle = ActionBarDrawerToggle(
            this,
            binding.drawerLayout,
            binding.toolbar,
            0, 0
        )
        binding.drawerLayout.addDrawerListener(toggle)
        toggle.syncState()

        binding.navView.setNavigationItemSelectedListener { item ->
            val base = "https://www.redsracing.org/"
            when (item.itemId) {
                R.id.nav_home -> binding.webview.loadUrl(base)
                R.id.nav_drivers -> binding.webview.loadUrl(base + "driver.html")
                R.id.nav_schedule -> binding.webview.loadUrl(base + "schedule.html")
                R.id.nav_gallery -> binding.webview.loadUrl(base + "gallery.html")
                R.id.nav_videos -> binding.webview.loadUrl(base + "videos.html")
                R.id.nav_admin -> binding.webview.loadUrl(base + "admin-console.html")
                R.id.nav_login -> binding.webview.loadUrl(base + "login.html")
                R.id.nav_signout -> binding.webview.evaluateJavascript("try{localStorage.clear(); sessionStorage.clear(); if(window.AndroidAuth&&AndroidAuth.onLogout){AndroidAuth.onLogout();}}catch(e){}", null)
            }
            binding.drawerLayout.closeDrawers()
            true
        }

        createNotificationChannel()

        // Register activity result launchers before any use
        permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { result ->
            // Permissions result handled as needed
        }

        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { activityResult ->
            val resultData = activityResult.data
            val results = mutableListOf<Uri>()

            // Camera capture result
            cameraPhotoUri?.let { uri ->
                if (activityResult.resultCode == RESULT_OK) {
                    results.add(uri)
                }
                cameraPhotoUri = null
            }

            // File(s) picked from gallery or documents
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

        setupWebView(binding.webview)

        // Handle system back using OnBackPressedDispatcher
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.drawerLayout.isDrawerOpen(android.view.Gravity.START)) {
                    binding.drawerLayout.closeDrawers(); return
                }
                if (binding.webview.canGoBack()) binding.webview.goBack() else finish()
            }
        })
    }

    @Suppress("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        // Serve app assets over a safe, consistent origin to avoid CORS/cookie issues
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
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
                // Intercept appassets host; map missing "/assets/" prefix to our assets/www folder
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
                if (url.host == "www.redsracing.org" && url.encodedPath == "/favicon.ico") {
                    val favicon = Uri.parse("https://appassets.androidplatform.net/assets/www/favicon.svg")
                    return assetLoader.shouldInterceptRequest(favicon)
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val urlStr = url.toString()

                // Open OAuth/external intents in browser to avoid WebView restrictions
                if (url.host?.endsWith("google.com") == true || urlStr.startsWith("intent:") || urlStr.startsWith("market:")) {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                        true
                    } catch (_: Exception) {
                        false
                    }
                }

                // If a login/admin page is requested from appassets, force the live site origin
                if (url.host == "appassets.androidplatform.net") {
                    val path = url.encodedPath ?: "/"
                    val loginPaths = listOf(
                        "/assets/www/login.html",
                        "/assets/www/follower-login.html",
                        "/assets/www/admin-console.html"
                    )
                    if (loginPaths.any { path.equals(it, ignoreCase = true) }) {
                        val live = Uri.parse("https://www.redsracing.org/" + path.removePrefix("/assets/www/"))
                        view?.loadUrl(live.toString())
                        return true
                    }
                }

                // Keep http/https/file in WebView
                return when {
                    urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("file://") -> false
                    urlStr.startsWith("tel:") || urlStr.startsWith("mailto:") -> {
                        try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: Exception) {}
                        true
                    }
                    else -> false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // If launched as guest, set a flag in localStorage for the web app
                if (intent.getBooleanExtra("guest", false)) {
                    view?.evaluateJavascript("try{localStorage.setItem('guest','1');}catch(e){}", null)
                }
                // If user session is present in localStorage, persist remember choice in app
                val persistLoginJs = """
                    (function(){
                      try{
                        var uid = localStorage.getItem('rr_auth_uid');
                        if(uid && window.AndroidAuth && AndroidAuth.onLoginSuccess){ AndroidAuth.onLoginSuccess(); }
                      }catch(e){}
                    })();
                """.trimIndent()
                view?.evaluateJavascript(persistLoginJs, null)

                // Ensure a visible Sign Out is available inside mobile menu/hamburger
                val injectSignOutJs = """
                    (function(){
                      try{
                        var panel = document.getElementById('mobile-menu-dropdown') || document.getElementById('mobile-menu');
                        if(!panel) return;
                        if(!document.getElementById('rr-signout-hamburger')){
                          var btn = document.createElement('a');
                          btn.id = 'rr-signout-hamburger';
                          btn.href = '#';
                          btn.textContent = 'Sign Out';
                          btn.style.display = 'block';
                          btn.style.padding = '10px 16px';
                          btn.style.color = '#fca5a5';
                          btn.style.fontWeight = '600';
                          btn.style.borderTop = '1px solid rgba(100,116,139,0.5)';
                          panel.appendChild(btn);
                          btn.addEventListener('click', async function(e){
                            try{ e.preventDefault(); }catch(_){}
                            try{
                              // Try Firebase signOut (CDN v9 compat)
                              const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
                              try { await signOut(getAuth()); } catch(_){ try{ await getAuth().signOut(); }catch(_){} }
                            }catch(_){ }
                            try{ localStorage.clear(); sessionStorage.clear(); }catch(_){}
                            try{ if (window.AndroidAuth && AndroidAuth.onLogout) AndroidAuth.onLogout(); }catch(_){}
                            try{ window.location.href = 'login.html'; }catch(_){}
                          }, {passive:false});
                        }
                      }catch(_){ }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(injectSignOutJs, null)
                // Inject generic hamburger/menu toggle fixer for pages that rely on JS/CSS toggles
                val js = """
                    (function(){
                      function findMenu(){
                        return document.getElementById('mobile-menu') ||
                               document.querySelector('#mobile-menu-dropdown') ||
                               document.querySelector('.mobile-menu') ||
                               document.querySelector('nav .menu') ||
                               document.querySelector('.nav-menu') ||
                               document.getElementById('menu');
                      }
                      function toggle(btn){
                        var m = findMenu(); if(!m) return;
                        // Ensure panel is visible on top
                        try{ m.style.zIndex = 10000; }catch(_){ }
                        if (m.classList) m.classList.toggle('hidden');
                        var st = window.getComputedStyle(m).display;
                        if (st === 'none') { m.style.display='block'; } else if (!m.classList.contains('hidden')) { m.style.display='none'; }
                        // Update aria
                        try { if(btn) btn.setAttribute('aria-expanded', String(!(m.classList&&m.classList.contains('hidden')))); } catch(_){}
                      }
                      var selectors = ['#mobile-menu-button','#menu-toggle','#hamburger','.hamburger','.menu-toggle','.nav-toggle','.menu-btn','[aria-controls]'];
                      selectors.forEach(function(s){
                        Array.prototype.forEach.call(document.querySelectorAll(s), function(btn){
                          // De-dupe: replace node to clear old handlers
                          try { var clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn); btn = clone; } catch(_){ }
                          btn.addEventListener('click', function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} toggle(btn); }, {passive:false});
                          btn.addEventListener('touchstart', function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} toggle(btn); }, {passive:false});
                        });
                      });
                    })();
                """.trimIndent()
                view?.evaluateJavascript(js, null)
                
                // Hide web navigation to avoid double navigation (Android drawer + web nav)
                val hideWebNavCSS = """
                    (function(){
                        var style = document.createElement('style');
                        style.textContent = `
                            /* Hide main website navigation */
                            nav, .nav, .navbar, .navigation, .main-nav,
                            header nav, .header-nav, .site-nav, .primary-nav,
                            .nav-container, .navigation-container,
                            /* Hide mobile menu toggles since we use Android drawer */
                            .mobile-menu-button, #mobile-menu-button, .hamburger,
                            .menu-toggle, .nav-toggle, #menu-toggle,
                            /* Hide any fixed headers that might conflict */
                            .fixed-header, .sticky-header,
                            /* Common navigation selectors */
                            [role="navigation"]:not(.drawer):not(.sidebar) {
                                display: none !important;
                                visibility: hidden !important;
                            }
                            
                            /* Adjust body padding/margin if header was fixed */
                            body {
                                padding-top: 0 !important;
                                margin-top: 0 !important;
                            }
                            
                            /* Ensure content flows properly */
                            main, .main, .content, .main-content {
                                margin-top: 0 !important;
                                padding-top: 0 !important;
                            }
                            
                            /* Hide any overlays or backdrops from web mobile menus */
                            .menu-overlay, .nav-overlay, .mobile-menu-backdrop {
                                display: none !important;
                            }
                        `;
                        document.head.appendChild(style);
                        
                        // Also hide any visible mobile menus that might be open
                        var mobileMenus = document.querySelectorAll('#mobile-menu, .mobile-menu, #mobile-menu-dropdown');
                        mobileMenus.forEach(function(menu) {
                            if (menu) {
                                menu.style.display = 'none';
                                menu.style.visibility = 'hidden';
                            }
                        });
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideWebNavCSS, null)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                // Handle target="_blank" and window.open by loading URL in the same WebView
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

                // Ensure permissions before opening chooser
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

        // JS interface for simple local notifications and auth callbacks
        webView.addJavascriptInterface(NotificationsBridge(this), "AndroidNotifications")
        webView.addJavascriptInterface(AuthBridge(this), "AndroidAuth")

        // Load live site by default for full functionality, fallback to assets if given
        var initialUrl = intent.getStringExtra("initialUrl") ?: "https://www.redsracing.org/"
        if (initialUrl.startsWith("file:///android_asset/")) {
            initialUrl = initialUrl.replace("file:///android_asset/", "https://appassets.androidplatform.net/assets/")
        }
        webView.loadUrl(initialUrl)
    }

    private fun ensureMediaAndCameraPermissions() {
        val needed = mutableListOf<String>()
        val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (!hasCamera) needed.add(Manifest.permission.CAMERA)

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
            val photoURI = FileProvider.getUriForFile(
                this,
                "com.example.redsracing.fileprovider",
                photoFile
            )
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
        return File.createTempFile(
            "JPEG_${'$'}timeStamp_",
            ".jpg",
            storageDir
        )
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
}

class AuthBridge(private val context: Context) {
    private val prefs by lazy { context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE) }

    @android.webkit.JavascriptInterface
    fun onLoginSuccess() {
        prefs.edit()
            .putBoolean("remember_choice", true)
            .putString("mode", "signin")
            .apply()
    }

    @android.webkit.JavascriptInterface
    fun onLogout() {
        prefs.edit()
            .remove("remember_choice")
            .remove("mode")
            .apply()
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
