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

        // Restrict push-driven deep links to the asset-loader origin. The default
        // landing is the home page (not the admin console — non-admin users were
        // being dropped onto a page they can't use). The explicit allow-list
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
     * Only the asset-loader host is honored. Everything else falls back to home.
     */
    private fun pickSafeDeepLink(raw: String?): String {
        val home = "https://appassets.androidplatform.net/assets/www/index.html"
        if (raw.isNullOrBlank()) return home
        // Allow only http(s) URLs whose host is the bundled asset-loader.
        return try {
            val uri = android.net.Uri.parse(raw)
            val scheme = uri.scheme?.lowercase()
            val host = uri.host?.lowercase()
            val allowed = (scheme == "https" || scheme == "http") &&
                host == "appassets.androidplatform.net"
            if (allowed) raw else home
        } catch (_: Throwable) {
            home
        }
    }

    companion object {
        private const val TAG = "FCMService"
    }
}
