# Speedhive Go Service (Cloud Run)

This microservice exposes selected Speedhive/Sporthive endpoints via a simple HTTP API.

Endpoints
- GET /healthz — health check
- GET /events — list events (via eventresult client)
- GET /practice/locations — list practice locations

Local build
- Requires Go 1.22+
- go build ./

Container build
- gcloud builds submit --tag gcr.io/PROJECT_ID/speedhive-go-service services/speedhive-go-service

Deploy to Cloud Run
- gcloud run deploy speedhive-go-service \
    --image gcr.io/PROJECT_ID/speedhive-go-service \
    --region us-central1 \
    --allow-unauthenticated

Firebase Hosting rewrite
Add to firebase.json rewrites:
{
  "source": "/api/speedhive/**",
  "run": { "serviceId": "speedhive-go-service", "region": "us-central1" }
}

Then: firebase deploy --only hosting

Frontend integration
- Call /api/speedhive/events from the site to render events in Race Results.
- You can add more endpoints (e.g., /sessions/{id}/results) by expanding main.go using the Go SDK.
