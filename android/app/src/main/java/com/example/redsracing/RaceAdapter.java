package com.example.redsracing;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class RaceAdapter extends RecyclerView.Adapter<RaceAdapter.RaceViewHolder> {

    private List<Race> raceList;

    public RaceAdapter(List<Race> raceList) {
        this.raceList = raceList;
    }

    @NonNull
    @Override
    public RaceViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.race_list_item, parent, false);
        return new RaceViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull RaceViewHolder holder, int position) {
        Race race = raceList.get(position);
        holder.raceNameTextView.setText(race.getName());
        holder.raceDateTextView.setText(race.getDate());
    }

    @Override
    public int getItemCount() {
        return raceList.size();
    }

    public static class RaceViewHolder extends RecyclerView.ViewHolder {
        public TextView raceNameTextView;
        public TextView raceDateTextView;

        public RaceViewHolder(View view) {
            super(view);
            raceNameTextView = view.findViewById(R.id.raceNameTextView);
            raceDateTextView = view.findViewById(R.id.raceDateTextView);
        }
    }
}
