# Queue Processing and Indexes

This project uses Firestore queues to persist feedback and sponsorship submissions when email fails or is temporarily unavailable. A background HTTP function processes the queues, with exponential backoff.

## Endpoints
- POST /process_queues → handleProcessQueues (python-api)
  - Allowed callers:
    - Cloud Scheduler with OIDC (service account email ends with gserviceaccount.com)
    - Authenticated Firebase user with admin/team-member role
  - 200 JSON summary: { feedback: {processed, dead_letter}, sponsorship: {processed, dead_letter} }

## Firestore Indexes
Composite indexes required for queue queries are defined in `firestore.indexes.json`:
- feedback_queue: status ASC, nextAttemptAt ASC
- sponsorship_queue: status ASC, nextAttemptAt ASC

If Firestore prompts for an index, deploy (or add via console) and re-try.

## Cloud Scheduler (recommended)
Create a job to run the processor every 5 minutes:

- In Cloud Shell:

```
gcloud config set project redsracing-a7f8b
gcloud scheduler jobs create http process-queues \
  --schedule="*/5 * * * *" \
  --uri="https://redsracing.org/process_queues" \
  --http-method=POST \
  --oidc-service-account-email=517034606151-compute@developer.gserviceaccount.com
```

## Admin Console
- Queue Management displays queued items, next attempt time, inspect modal, retry/resolve.
- Dead Letter Queue viewer supports inspect, requeue, delete.
- Sparkline shows items eligible within the next hour.

## Notes
- Exponential backoff: base 30s, doubles per retry, capped at 1 hour, with 20% jitter.
- Items move to `queue_dead_letter` after 5 failures.
- Secrets required: SENDGRID_API_KEY; optional SENTRY_DSN.