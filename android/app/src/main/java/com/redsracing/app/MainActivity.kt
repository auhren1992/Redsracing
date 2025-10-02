package com.redsracing.app

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
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.redsracing.app.databinding.ActivityMainBinding
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

        createNotificationChannel()
        requestNotificationPermissionIfNeeded()

        setupWebView(binding.webview)

        permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { result ->
            // Notify web or proceed silently; we only requested before opening chooser
        }

        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { activityResult ->
            val resultData = activityResult.data
            val results = mutableListOf<Uri>()

            // Camera capture result
            cameraPhotoUri?.let { uri ->
                // If no data returned but we had a camera intent, use the saved URI
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
    }

    @Suppress("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
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
        }

        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Keep all http/https/file URLs inside the WebView
                return when {
                    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://") -> {
                        false // load in WebView
                    }
                    url.startsWith("tel:") || url.startsWith("mailto:") -> {
                        // Delegate to external apps for phone/email
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: ActivityNotFoundException) {
                            Toast.makeText(this@MainActivity, "No app to handle this action", Toast.LENGTH_SHORT).show()
                        }
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
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
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

        // JS interface for simple local notifications
        webView.addJavascriptInterface(NotificationsBridge(this), "AndroidNotifications")

        // Load bundled site from assets or a specific page
        val initialUrl = intent.getStringExtra("initialUrl") ?: "file:///android_asset/www/index.html"
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
                "com.redsracing.app.fileprovider",
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

    override fun onBackPressed() {
        if (binding.webview.canGoBack()) {
            binding.webview.goBack()
        } else {
            super.onBackPressed()
        }
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
