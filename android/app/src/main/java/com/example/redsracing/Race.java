package com.example.redsracing;

import com.google.firebase.firestore.Exclude;

public class Race {
    @Exclude
    private String id;

    private String name;
    private String date;
    private String type; // e.g., "superCup" or "specialEvent"
    private String race; // e.g., "#1" for superCup

    // Required empty public constructor for Firestore
    public Race() {}

    // Constructor for creating a new race object
    public Race(String name, String date, String type, String race) {
        this.name = name;
        this.date = date;
        this.type = type;
        this.race = race;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public String getId() {
        return id;
    }

    public Race withId(String id) {
        this.id = id;
        return this;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRace() {
        return race;
    }

    public void setRace(String race) {
        this.race = race;
    }
}
