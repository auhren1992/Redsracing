package com.example.redsracing;

public class Race {
    private String name;
    private String date;

    // Required empty public constructor for Firestore
    public Race() {}

    public Race(String name, String date) {
        this.name = name;
        this.date = date;
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
}
