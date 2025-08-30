package com.example.redsracing;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    // UI Elements
    private TextView welcomeTextView, statsWins, statsPodiums, statsLaps;
    private EditText notesEditText;
    private Button saveNotesButton, logoutButton, addRaceButton, galleryButton;
    private RecyclerView racesRecyclerView;

    // Firebase
    private FirebaseAuth mAuth;
    private FirebaseFirestore db;
    private FirebaseUser currentUser;

    // RecyclerView
    private RaceAdapter raceAdapter;
    private List<Race> raceList = new ArrayList<>();

    // Declare the launcher at the top of your Activity/Fragment.
    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    Toast.makeText(this, "Notifications permission granted.", Toast.LENGTH_SHORT).show();
                    getAndStoreFcmToken();
                } else {
                    Toast.makeText(this, "Notifications permission denied.", Toast.LENGTH_SHORT).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize Firebase
        mAuth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        currentUser = mAuth.getCurrentUser();

        if (currentUser == null) {
            redirectToLogin();
            return;
        }

        initViews();
        setupListeners();
        loadDashboardData();
        askNotificationPermission(); // Ask for permission on startup
    }

    private void initViews() {
        welcomeTextView = findViewById(R.id.welcomeTextView);
        statsWins = findViewById(R.id.statsWins);
        statsPodiums = findViewById(R.id.statsPodiums);
        statsLaps = findViewById(R.id.statsLaps);
        notesEditText = findViewById(R.id.notesEditText);
        saveNotesButton = findViewById(R.id.saveNotesButton);
        logoutButton = findViewById(R.id.logoutButton);
        addRaceButton = findViewById(R.id.addRaceButton);
        galleryButton = findViewById(R.id.galleryButton);

        racesRecyclerView = findViewById(R.id.racesRecyclerView);
        racesRecyclerView.setLayoutManager(new LinearLayoutManager(this));
        raceAdapter = new RaceAdapter(raceList);
        racesRecyclerView.setAdapter(raceAdapter);
    }

    private void setupListeners() {
        logoutButton.setOnClickListener(v -> {
            mAuth.signOut();
            redirectToLogin();
        });

        saveNotesButton.setOnClickListener(v -> saveDriverNotes());

        addRaceButton.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, EditRaceActivity.class));
        });

        galleryButton.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, GalleryActivity.class));
        });
    }

    private void loadDashboardData() {
        welcomeTextView.setText("Welcome, " + currentUser.getEmail() + "!");
        fetchStats();
        fetchDriverNotes();
        fetchRaces();
    }

    private void fetchStats() {
        db.collection("dashboard").document("stats").get().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                DocumentSnapshot document = task.getResult();
                if (document.exists()) {
                    statsWins.setText("Wins: " + document.getLong("wins"));
                    statsPodiums.setText("Podiums: " + document.getLong("podiums"));
                    statsLaps.setText("Laps: " + document.getLong("laps"));
                } else {
                    Log.d(TAG, "No such document for stats");
                }
            } else {
                Log.d(TAG, "get failed with ", task.getException());
            }
        });
    }

    private void fetchDriverNotes() {
        db.collection("driver_notes").document(currentUser.getUid()).get().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                DocumentSnapshot document = task.getResult();
                if (document.exists() && document.contains("notes")) {
                    notesEditText.setText(document.getString("notes"));
                }
            } else {
                 Log.d(TAG, "get failed with ", task.getException());
            }
        });
    }

    private void fetchRaces() {
        db.collection("races").orderBy("date", Query.Direction.ASCENDING).get().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                raceList.clear();
                for (DocumentSnapshot document : task.getResult()) {
                    Race race = document.toObject(Race.class).withId(document.getId());
                    raceList.add(race);
                }
                raceAdapter.notifyDataSetChanged();
            } else {
                Log.d(TAG, "Error getting documents: ", task.getException());
            }
        });
    }

    private void saveDriverNotes() {
        String notes = notesEditText.getText().toString();
        DocumentReference notesRef = db.collection("driver_notes").document(currentUser.getUid());

        Map<String, Object> data = new HashMap<>();
        data.put("notes", notes);

        notesRef.set(data)
            .addOnSuccessListener(aVoid -> Toast.makeText(MainActivity.this, "Notes saved!", Toast.LENGTH_SHORT).show())
            .addOnFailureListener(e -> Toast.makeText(MainActivity.this, "Error saving notes.", Toast.LENGTH_SHORT).show());
    }

    private void askNotificationPermission() {
        // This is only necessary for API level 33+ (TIRAMISU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED) {
                // Permission is already granted
                getAndStoreFcmToken();
            } else if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                // We can show an educational UI here if needed
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            } else {
                // Directly ask for the permission
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
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
                    String token = task.getResult();
                    Log.d(TAG, "FCM Token: " + token);
                    sendTokenToServer(token);
                });
    }

    private void sendTokenToServer(String token) {
        if (currentUser == null) return;
        String uid = currentUser.getUid();

        Map<String, Object> data = new HashMap<>();
        data.put("uid", uid);
        data.put("timestamp", FieldValue.serverTimestamp());

        db.collection("fcmTokens").document(token).set(data)
                .addOnSuccessListener(aVoid -> Log.d(TAG, "Token successfully written!"))
                .addOnFailureListener(e -> Log.w(TAG, "Error writing token", e));
    }

    private void redirectToLogin() {
        startActivity(new Intent(MainActivity.this, LoginActivity.class));
        finish();
    }
}
