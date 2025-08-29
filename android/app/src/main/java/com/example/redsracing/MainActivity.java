package com.example.redsracing;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.content.Intent;
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
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";

    // UI Elements
    private TextView welcomeTextView, statsWins, statsPodiums, statsLaps;
    private EditText notesEditText;
    private Button saveNotesButton, logoutButton;
    private RecyclerView racesRecyclerView;

    // Firebase
    private FirebaseAuth mAuth;
    private FirebaseFirestore db;
    private FirebaseUser currentUser;

    // RecyclerView
    private RaceAdapter raceAdapter;
    private List<Race> raceList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize Firebase
        mAuth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        currentUser = mAuth.getCurrentUser();

        // If no user, redirect to login
        if (currentUser == null) {
            redirectToLogin();
            return;
        }

        // Initialize UI
        initViews();

        // Setup Listeners
        setupListeners();

        // Load data from Firestore
        loadDashboardData();
    }

    private void initViews() {
        welcomeTextView = findViewById(R.id.welcomeTextView);
        statsWins = findViewById(R.id.statsWins);
        statsPodiums = findViewById(R.id.statsPodiums);
        statsLaps = findViewById(R.id.statsLaps);
        notesEditText = findViewById(R.id.notesEditText);
        saveNotesButton = findViewById(R.id.saveNotesButton);
        logoutButton = findViewById(R.id.logoutButton);

        // Setup RecyclerView
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
    }

    private void loadDashboardData() {
        welcomeTextView.setText("Welcome, " + currentUser.getEmail() + "!");
        fetchStats();
        fetchDriverNotes();
        fetchRaces();
    }

    private void fetchStats() {
        // Assuming stats are stored in a document named 'stats' inside a 'dashboard' collection
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
                    Race race = document.toObject(Race.class);
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

        notesRef.set(data) // Using set with merge might be safer: .set(data, SetOptions.merge())
            .addOnSuccessListener(aVoid -> Toast.makeText(MainActivity.this, "Notes saved!", Toast.LENGTH_SHORT).show())
            .addOnFailureListener(e -> Toast.makeText(MainActivity.this, "Error saving notes.", Toast.LENGTH_SHORT).show());
    }

    private void redirectToLogin() {
        startActivity(new Intent(MainActivity.this, LoginActivity.class));
        finish();
    }
}
