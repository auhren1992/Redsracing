package com.example.redsracing;

import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFirebaseMsgService";

    /**
     * Called when a new token for the default Firebase project is generated.
     * This is called when the app is first installed and whenever a new token is generated.
     */
    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "Refreshed token: " + token);

        // We will send this token to the server in the next step.
    }

    /**
     * Called when a message is received.
     * This is also called when a notification is received while the app is in the foreground.
     */
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // The FCM SDK handles displaying notifications in the system tray when the app is in the background.
        // We can add custom handling here for foreground messages if needed later.
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message Notification Body: " + remoteMessage.getNotification().getBody());
        }
    }
}
