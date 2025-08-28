package com.example.redsracing;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    private TextView welcomeTextView;
    private Button logoutButton;

    private FirebaseAuth mAuth;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mAuth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        FirebaseUser currentUser = mAuth.getCurrentUser();

        welcomeTextView = findViewById(R.id.welcomeTextView);
        logoutButton = findViewById(R.id.logoutButton);

        if (currentUser != null) {
            welcomeTextView.setText("Welcome, " + currentUser.getEmail() + "!");
            // After user is confirmed, ask for notification permission and get token
            askNotificationPermission();
        } else {
            // This should not happen if the user is coming from LoginActivity
            // But as a fallback, redirect to login if no user is found.
            redirectToLogin();
            return;
        }

        logoutButton.setOnClickListener(v -> {
            // Optional: delete the token on logout
            // For this implementation, we'll leave it to allow notifications even when logged out.
            mAuth.signOut();
            redirectToLogin();
        });
    }

    private void redirectToLogin() {
        startActivity(new Intent(MainActivity.this, LoginActivity.class));
        finish();
    }

    // Declare the launcher at the top of your Activity/Fragment:
    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    // FCM SDK (and your app) can post notifications.
                    Toast.makeText(this, "Notifications permission granted", Toast.LENGTH_SHORT).show();
                    getAndStoreFcmToken();
                } else {
                    // Inform user that notifications are disabled
                    Toast.makeText(this, "Notifications permission denied", Toast.LENGTH_SHORT).show();
                }
            });

    private void askNotificationPermission() {
        // This is only necessary for API level 33+ (TIRAMISU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED) {
                // Permission is already granted
                getAndStoreFcmToken();
            } else {
                // Directly ask for the permission
                requestPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        } else {
            // Permission not required for older versions
            getAndStoreFcmToken();
        }
    }

    private void getAndStoreFcmToken() {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                        return;
                    }

                    // Get new FCM registration token
                    String token = task.getResult();
                    Log.d(TAG, "FCM Token: " + token);

                    // Send token to server
                    sendTokenToServer(token);
                });
    }

    private void sendTokenToServer(String token) {
        FirebaseUser user = mAuth.getCurrentUser();
        if (user == null) {
            return; // Should not happen
        }
        String uid = user.getUid();

        // Add the token to a "fcmTokens" collection in Firestore
        // Using the token as the document ID to prevent duplicates
        Map<String, Object> data = new HashMap<>();
        data.put("uid", uid);
        data.put("timestamp", FieldValue.serverTimestamp());

        db.collection("fcmTokens").document(token).set(data)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "Token successfully written!"))
                .addOnFailureListener(e -> Log.w(TAG, "Error writing token", e));
    }
}
