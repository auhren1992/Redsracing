package com.example.redsracing;

import androidx.appcompat.app.AppCompatActivity;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;

public class EditRaceActivity extends AppCompatActivity {

    private EditText editRaceName, editRaceDate;
    private Button saveRaceButton, deleteRaceButton;

    private FirebaseFirestore db;
    private String currentRaceId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_race);

        db = FirebaseFirestore.getInstance();

        editRaceName = findViewById(R.id.editRaceName);
        editRaceDate = findViewById(R.id.editRaceDate);
        saveRaceButton = findViewById(R.id.saveRaceButton);
        deleteRaceButton = findViewById(R.id.deleteRaceButton);

        // Check if we are editing an existing race
        if (getIntent().hasExtra("RACE_ID")) {
            currentRaceId = getIntent().getStringExtra("RACE_ID");
            setTitle("Edit Race");
            loadRaceData();
            deleteRaceButton.setVisibility(View.VISIBLE);
        } else {
            setTitle("Add New Race");
        }

        saveRaceButton.setOnClickListener(v -> saveRace());

        deleteRaceButton.setOnClickListener(v -> showDeleteConfirmationDialog());
    }

    private void loadRaceData() {
        db.collection("races").document(currentRaceId).get().addOnSuccessListener(documentSnapshot -> {
            if (documentSnapshot.exists()) {
                Race race = documentSnapshot.toObject(Race.class);
                if (race != null) {
                    editRaceName.setText(race.getName());
                    editRaceDate.setText(race.getDate());
                }
            } else {
                Toast.makeText(this, "Error: Race not found.", Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void saveRace() {
        String name = editRaceName.getText().toString().trim();
        String date = editRaceDate.getText().toString().trim();

        if (TextUtils.isEmpty(name) || TextUtils.isEmpty(date)) {
            Toast.makeText(this, "Please fill out all fields", Toast.LENGTH_SHORT).show();
            return;
        }

        Map<String, Object> race = new HashMap<>();
        race.put("name", name);
        race.put("date", date);
        // In a real app, you would add the other fields like 'type' and 'race' number here as well.

        if (currentRaceId != null) {
            // Update existing race
            db.collection("races").document(currentRaceId).set(race)
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(this, "Race updated successfully", Toast.LENGTH_SHORT).show();
                    finish();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Error updating race", Toast.LENGTH_SHORT).show());
        } else {
            // Add new race
            db.collection("races").add(race)
                .addOnSuccessListener(documentReference -> {
                    Toast.makeText(this, "Race added successfully", Toast.LENGTH_SHORT).show();
                    finish();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Error adding race", Toast.LENGTH_SHORT).show());
        }
    }

    private void showDeleteConfirmationDialog() {
        new android.app.AlertDialog.Builder(this)
            .setTitle("Delete Race")
            .setMessage("Are you sure you want to delete this race? This action cannot be undone.")
            .setPositiveButton("Delete", (dialog, which) -> deleteRace())
            .setNegativeButton("Cancel", null)
            .setIcon(android.R.drawable.ic_dialog_alert)
            .show();
    }

    private void deleteRace() {
        if (currentRaceId != null) {
            db.collection("races").document(currentRaceId).delete()
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(this, "Race deleted successfully", Toast.LENGTH_SHORT).show();
                    finish();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Error deleting race", Toast.LENGTH_SHORT).show());
        }
    }
}
