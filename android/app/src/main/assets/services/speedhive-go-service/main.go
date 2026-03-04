package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

type apiError struct{ Error string `json:"error"` }

type apiOK struct{ OK bool `json:"ok"` }

func writeJSON(w http.ResponseWriter, v interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// Temporary stub: return empty list to ensure service deploys
// Frontend will fall back to functions endpoint if empty
func listEvents(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, []interface{}{}, http.StatusOK)
}

func listPracticeLocations(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, []interface{}{}, http.StatusOK)
}

func health(w http.ResponseWriter, r *http.Request) { writeJSON(w, apiOK{OK: true}, http.StatusOK) }

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/events", listEvents)
	mux.HandleFunc("/practice/locations", listPracticeLocations)

	addr := ":8080"
	if p := os.Getenv("PORT"); strings.TrimSpace(p) != "" { addr = ":" + p }
	log.Printf("Speedhive service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
