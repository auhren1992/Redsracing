package com.example.redsracing;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;
import com.google.firebase.storage.UploadTask;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class GalleryActivity extends AppCompatActivity {

    private static final String TAG = "GalleryActivity";

    private RecyclerView galleryRecyclerView;
    private FloatingActionButton uploadFab;
    private PhotoAdapter photoAdapter;
    private List<Photo> photoList = new ArrayList<>();

    private FirebaseFirestore db;
    private FirebaseStorage storage;
    private FirebaseAuth auth;
    private FirebaseUser currentUser;

    private final ActivityResultLauncher<Intent> imagePickerLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                Uri imageUri = result.getData().getData();
                uploadImageToStorage(imageUri);
            }
        }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_gallery);
        setTitle("Photo Gallery");

        db = FirebaseFirestore.getInstance();
        storage = FirebaseStorage.getInstance();
        auth = FirebaseAuth.getInstance();
        currentUser = auth.getCurrentUser();

        galleryRecyclerView = findViewById(R.id.galleryRecyclerView);
        uploadFab = findViewById(R.id.uploadFab);

        galleryRecyclerView.setLayoutManager(new GridLayoutManager(this, 3));
        photoAdapter = new PhotoAdapter(this, photoList);
        galleryRecyclerView.setAdapter(photoAdapter);

        uploadFab.setOnClickListener(v -> openImagePicker());

        loadGalleryImages();
    }

    private void openImagePicker() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        imagePickerLauncher.launch(intent);
    }

    private void uploadImageToStorage(Uri imageUri) {
        if (currentUser == null) {
            Toast.makeText(this, "You must be logged in to upload.", Toast.LENGTH_SHORT).show();
            return;
        }

        Toast.makeText(this, "Uploading...", Toast.LENGTH_SHORT).show();

        String userId = currentUser.getUid();
        String uniqueFileName = UUID.randomUUID().toString() + ".jpg";
        StorageReference storageRef = storage.getReference().child("gallery/" + userId + "/" + uniqueFileName);

        storageRef.putFile(imageUri).addOnSuccessListener(taskSnapshot ->
            storageRef.getDownloadUrl().addOnSuccessListener(this::saveImageInfoToFirestore)
        ).addOnFailureListener(e -> {
            Toast.makeText(this, "Upload failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            Log.e(TAG, "Upload failed", e);
        });
    }

    private void saveImageInfoToFirestore(Uri downloadUri) {
        if (currentUser == null) return;

        currentUser.getIdToken(true).addOnSuccessListener(idTokenResult -> {
            String role = (String) idTokenResult.getClaims().get("role");
            boolean isTeamMember = "team-member".equals(role);

            Map<String, Object> photoData = new HashMap<>();
            photoData.put("imageUrl", downloadUri.toString());
            photoData.put("uploaderUid", currentUser.getUid());
            photoData.put("uploaderEmail", currentUser.getEmail());
            photoData.put("createdAt", FieldValue.serverTimestamp());

            if (isTeamMember) {
                photoData.put("approved", true);
                db.collection("gallery_images").add(photoData)
                    .addOnSuccessListener(docRef -> Toast.makeText(GalleryActivity.this, "Photo uploaded successfully!", Toast.LENGTH_SHORT).show())
                    .addOnFailureListener(e -> Toast.makeText(GalleryActivity.this, "Error saving photo details.", Toast.LENGTH_SHORT).show());
            } else {
                // Fans' uploads go to a request queue for approval
                db.collection("photo_requests").add(photoData)
                    .addOnSuccessListener(docRef -> Toast.makeText(GalleryActivity.this, "Photo submitted for approval!", Toast.LENGTH_SHORT).show())
                    .addOnFailureListener(e -> Toast.makeText(GalleryActivity.this, "Error submitting photo.", Toast.LENGTH_SHORT).show());
            }
        });
    }

    private void loadGalleryImages() {
        db.collection("gallery_images")
          .whereEqualTo("approved", true)
          .orderBy("createdAt", Query.Direction.DESC)
          .limit(30)
          .get()
          .addOnCompleteListener(task -> {
              if (task.isSuccessful() && task.getResult() != null) {
                  photoList.clear();
                  for (com.google.firebase.firestore.DocumentSnapshot document : task.getResult()) {
                      Photo photo = document.toObject(Photo.class);
                      photoList.add(photo);
                  }
                  photoAdapter.notifyDataSetChanged();
              } else {
                  Log.d(TAG, "Error getting documents: ", task.getException());
                  Toast.makeText(this, "Failed to load images.", Toast.LENGTH_SHORT).show();
              }
          });
    }
}
