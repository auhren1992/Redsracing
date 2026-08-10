package com.redsracing.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "New FCM token: $token")
        }
        subscribeToAppTopics()
        reportAppUsage(token)
    }

    /** Keep Firestore app_usage in sync when FCM rotates the token. */
    private fun reportAppUsage(fcmToken: String) {
        try {
            val pm = packageManager
            val pkg = packageName
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(pkg, android.content.pm.PackageManager.PackageInfoFlags.of(0)).longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(pkg, 0).versionCode
            }
            val versionName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(pkg, android.content.pm.PackageManager.PackageInfoFlags.of(0)).versionName
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(pkg, 0).versionName
            }
            val user = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser } catch (_: Exception) { null }
            val usageData = hashMapOf(
                "platform" to "android",
                "app_version" to versionCode,
                "app_version_code" to versionCode,
                "app_version_name" to (versionName ?: ""),
                "fcm_token" to fcmToken,
                "device_manufacturer" to Build.MANUFACTURER,
                "device_brand" to Build.BRAND,
                "device_model" to Build.MODEL,
                "device" to Build.DEVICE,
                "android_version" to Build.VERSION.RELEASE,
                "os_version" to Build.VERSION.RELEASE,
                "os_sdk" to Build.VERSION.SDK_INT,
                "auth_uid" to (user?.uid ?: ""),
                "auth_email" to (user?.email ?: ""),
                "last_seen" to com.google.firebase.Timestamp.now()
            )
            com.google.firebase.firestore.FirebaseFirestore.getInstance()
                .collection("app_usage")
                .document(fcmToken)
                .set(usageData)
                .addOnSuccessListener { Log.d(TAG, "App usage reported from onNewToken") }
                .addOnFailureListener { e -> Log.w(TAG, "Failed to report app usage from onNewToken", e) }
        } catch (e: Exception) {
            Log.e(TAG, "Error reporting app usage from onNewToken", e)
        }
    }
    
    private fun subscribeToAppTopics() {
        val messagingInstance = com.google.firebase.messaging.FirebaseMessaging.getInstance()
        
        messagingInstance.subscribeToTopic("all_users")
            .addOnSuccessListener { Log.d(TAG, "Subscribed to all_users") }
            .addOnFailureListener { Log.w(TAG, "Failed to subscribe to all_users", it) }
        
        messagingInstance.subscribeToTopic("android_users")
            .addOnSuccessListener { Log.d(TAG, "Subscribed to android_users") }
            .addOnFailureListener { Log.w(TAG, "Failed to subscribe to android_users", it) }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "Push received from: ${remoteMessage.from}")
        
        remoteMessage.notification?.let { notification ->
            sendNotification(
                notification.title ?: "RedsRacing",
                notification.body ?: "",
                remoteMessage.data
            )
            return
        }
        
        if (remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "RedsRacing"
            val body = remoteMessage.data["body"] ?: remoteMessage.data["message"] ?: ""
            if (body.isNotEmpty()) {
                sendNotification(title, body, remoteMessage.data)
            }
        }
    }

    private fun sendNotification(title: String, messageBody: String, data: Map<String, String>) {
        // One unique id per notification, reused for PendingIntent.requestCode and
        // NotificationManager.notify() so each push has its own routing+extras.
        val notificationId = (System.currentTimeMillis() and 0x7FFFFFFF).toInt()

        // Restrict push-driven deep links to the same site origin as MainActivity.
        // The default landing is the home page (not the admin console — non-admin users were
        // being dropped onto a page they cannot use). The explicit allow-list
        // prevents a malicious or compromised push from loading an arbitrary
        // URL into a WebView that has JS bridges attached.
        val safeUrl = pickSafeDeepLink(data["url"])

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("title", title)
            putExtra("body", messageBody)
            putExtra("url", safeUrl)
            data.forEach { (key, value) ->
                if (key !in listOf("title", "body", "url")) {
                    putExtra(key, value)
                }
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val channelId = getString(R.string.default_notification_channel_id)
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "RedsRacing Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for race updates and app announcements"
            }
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    /**
     * Returns a deep-link URL that is safe to load into the bridged WebView.
     * Same host policy as [MainActivity.sanitizeNotificationUrl] (www / apex + .html paths).
     */
    private fun pickSafeDeepLink(raw: String?): String {
        val home = MainActivity.siteUrl("index.html")
        if (raw.isNullOrBlank()) return home
        if (!raw.contains("://") && raw.endsWith(".html")) {
            return MainActivity.siteUrl(raw.removePrefix("/"))
        }
        return try {
            val uri = android.net.Uri.parse(raw)
            val scheme = uri.scheme?.lowercase()
            val host = uri.host?.lowercase() ?: ""
            val path = uri.path ?: "/"
            val allowedHost = host == "www.redsracing.org" || host == "redsracing.org"
            val allowedPath = path.endsWith(".html", ignoreCase = true) ||
                path == "/" || path.isEmpty()
            val allowed = (scheme == "https" || scheme == "http") && allowedHost && allowedPath
            if (!allowed) return home
            if (host == "redsracing.org") {
                val tail = path.removePrefix("/").trim()
                MainActivity.siteUrl(if (tail.isEmpty()) "index.html" else tail)
            } else {
                raw
            }
        } catch (_: Throwable) {
            home
        }
    }

    companion object {
        private const val TAG = "FCMService"
    }
}
