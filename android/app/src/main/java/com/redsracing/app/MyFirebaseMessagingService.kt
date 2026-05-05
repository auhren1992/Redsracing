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
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            // Pass notification data to MainActivity
            putExtra("title", title)
            putExtra("body", messageBody)
            // Add URL for deep linking - default to admin console
            val url = data["url"] ?: "https://appassets.androidplatform.net/assets/www/admin-console.html"
            putExtra("url", url)
            // Pass any additional data
            data.forEach { (key, value) ->
                if (key !in listOf("title", "body", "url")) {
                    putExtra(key, value)
                }
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
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

        val notificationId = (System.currentTimeMillis() and 0x7FFFFFFF).toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    companion object {
        private const val TAG = "FCMService"
    }
}
