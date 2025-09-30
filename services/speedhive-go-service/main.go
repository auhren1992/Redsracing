package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/ysmilda/speedhive-go/eventresult"
	"github.com/ysmilda/speedhive-go/practice"
)

type apiError struct{ Error string `json:"error"` }

type apiOK struct{ OK bool `json:"ok"` }

func writeJSON(w http.ResponseWriter, v interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func listEvents(w http.ResponseWriter, r *http.Request) {
	cli := eventresult.NewClient(nil)
	res, err := cli.Events.List()
	if err != nil {
		writeJSON(w, apiError{"failed to list events"}, http.StatusBadGateway)
		return
	}
	writeJSON(w, res, http.StatusOK)
}

func listPracticeLocations(w http.ResponseWriter, r *http.Request) {
	cli := practice.NewClient(nil)
	res, err := cli.Locations.List()
	if err != nil {
		writeJSON(w, apiError{"failed to list practice locations"}, http.StatusBadGateway)
		return
	}
	writeJSON(w, res, http.StatusOK)
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
