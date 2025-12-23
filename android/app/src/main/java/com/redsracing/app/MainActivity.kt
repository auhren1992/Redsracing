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

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.root.findViewById<View>(R.id.menu_overlay)?.visibility == View.VISIBLE) {
                    hideMenuOverlay()
                    return
                }
                if (binding.webview.canGoBack()) binding.webview.goBack() else finish()
            }
        })

        // Load home page
        binding.webview.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
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
            MenuItem("📅", "Schedule", "schedule.html"),
            MenuItem("🏆", "Leaderboard", "leaderboard.html"),
            MenuItem("📸", "Gallery", "gallery.html"),
            MenuItem("🎥", "Videos", "videos.html")
        )
        showMenuOverlay("Racing", items)
    }

    private fun showCommunityMenu() {
        val items = listOf(
            MenuItem("❓", "Q&A", "qna.html"),
            MenuItem("💬", "Feedback", "feedback.html"),
            MenuItem("💰", "Sponsorship", "sponsorship.html")
        )
        showMenuOverlay("Community", items)
    }

    private fun showMoreMenu() {
        // Check if user is logged in via JavaScript
        binding.webview.evaluateJavascript(
            "(function(){ try { return localStorage.getItem('redsracing_user') !== null; } catch(e) { return false; } })();"
        ) { result ->
            val isLoggedIn = result == "true"
            
            val items = if (isLoggedIn) {
                listOf(
                    MenuItem("👤", "My Profile", "profile.html"),
                    MenuItem("📊", "Admin Console", "admin-console.html"),
                    MenuItem("⚙️", "Settings", "settings.html"),
                    MenuItem("🚪", "Sign Out", "javascript:logout")
                )
            } else {
                listOf(
                    MenuItem("👤", "My Profile", "profile.html"),
                    MenuItem("🔐", "Sign In", "login.html"),
                    MenuItem("⚙️", "Settings", "settings.html"),
                    MenuItem("📊", "Admin Console", "admin-console.html")
                )
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
                            // Remove any stray text nodes at the top of body
                            var walker = document.createTreeWalker(
                                document.body,
                                NodeFilter.SHOW_TEXT,
                                null,
                                false
                            );
                            var textNodesToRemove = [];
                            var node;
                            while (node = walker.nextNode()) {
                                var parent = node.parentNode;
                                if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
                                    var text = node.textContent.trim();
                                    if (text && text.length < 5 && !parent.closest('main')) {
                                        textNodesToRemove.push(node);
                                    }
                                }
                            }
                            textNodesToRemove.forEach(function(n) {
                                n.textContent = '';
                            });
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
                            var heroSection = document.querySelector('.modern-hero, section');
                            if (heroSection) {
                                heroSection.style.minHeight = 'auto';
                                heroSection.style.paddingTop = '100px';
                                heroSection.style.paddingBottom = '200px';
                            }
                            var ctaButtons = document.querySelector('.flex.flex-col.sm\\:flex-row');
                            if (ctaButtons) {
                                ctaButtons.style.flexDirection = 'column';
                                ctaButtons.style.width = '100%';
                                ctaButtons.style.marginBottom = '150px';
                                ctaButtons.style.gap = '16px';
                                var buttons = ctaButtons.querySelectorAll('a');
                                buttons.forEach(function(btn) {
                                    btn.style.width = '100%';
                                    btn.style.maxWidth = '400px';
                                    btn.style.display = 'block';
                                    btn.style.textAlign = 'center';
                                    btn.style.visibility = 'visible';
                                    btn.style.opacity = '1';
                                });
                            }
                        }, 100);
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideNavJS, null)
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
            val photoURI = FileProvider.getUriForFile(this, "com.example.redsracing.fileprovider", photoFile)
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
