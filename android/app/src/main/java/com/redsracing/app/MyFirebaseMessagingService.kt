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
        Log.d(TAG, "New FCM token: $token")
        
        // Subscribe to general topic for all users
        com.google.firebase.messaging.FirebaseMessaging.getInstance()
            .subscribeToTopic("all_users")
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d(TAG, "Subscribed to all_users topic")
                } else {
                    Log.w(TAG, "Failed to subscribe to all_users topic", task.exception)
                }
            }
        
        // Subscribe to android-specific topic
        com.google.firebase.messaging.FirebaseMessaging.getInstance()
            .subscribeToTopic("android_users")
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d(TAG, "Subscribed to android_users topic")
                } else {
                    Log.w(TAG, "Failed to subscribe to android_users topic", task.exception)
                }
            }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "Message received from: ${remoteMessage.from}")
        
        // Check if message contains notification payload
        remoteMessage.notification?.let { notification ->
            val title = notification.title ?: "RedsRacing"
            val body = notification.body ?: ""
            sendNotification(title, body, remoteMessage.data)
        }
        
        // Check if message contains data payload
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: ${remoteMessage.data}")
            
            // Handle specific data-only messages
            val messageType = remoteMessage.data["type"]
            when (messageType) {
                "app_update" -> {
                    val title = remoteMessage.data["title"] ?: "Update Available"
                    val body = remoteMessage.data["body"] ?: "A new version of RedsRacing is available!"
                    sendNotification(title, body, remoteMessage.data)
                }
                "race_update" -> {
                    val title = remoteMessage.data["title"] ?: "Race Update"
                    val body = remoteMessage.data["body"] ?: ""
                    sendNotification(title, body, remoteMessage.data)
                }
                else -> {
                    // Generic notification from data payload
                    val title = remoteMessage.data["title"] ?: "RedsRacing"
                    val body = remoteMessage.data["body"] ?: remoteMessage.data["message"] ?: ""
                    if (body.isNotEmpty()) {
                        sendNotification(title, body, remoteMessage.data)
                    }
                }
            }
        }
    }

    private fun sendNotification(title: String, messageBody: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // Pass data to MainActivity if needed
            data.forEach { (key, value) ->
                putExtra(key, value)
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

        notificationManager.notify(NOTIFICATION_ID, notificationBuilder.build())
    }

    companion object {
        private const val TAG = "FCMService"
        private const val NOTIFICATION_ID = 0
    }
}
