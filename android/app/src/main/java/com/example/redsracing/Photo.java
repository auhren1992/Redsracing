package com.example.redsracing;

public class Photo {
    private String imageUrl;

    // Required empty public constructor for Firestore
    public Photo() {}

    public Photo(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
