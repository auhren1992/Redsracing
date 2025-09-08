# Firebase Cloud Functions (Python)

This directory contains Python Firebase Cloud Functions for the RedsRacing website.

## Functions

### `handleAddSubscriber`
- **Endpoint**: `/add_subscriber`
- **Method**: POST
- **Purpose**: Handles email subscription requests from website footer forms
- **Input**: `{"email": "user@example.com"}`
- **Output**: Success/error message
- **Storage**: Saves to Firestore `subscribers` collection

### `handleSendFeedback`  
- **Endpoint**: `/send_feedback_email`
- **Method**: POST
- **Purpose**: Handles feedback form submissions
- **Input**: `{"name": "John Doe", "email": "user@example.com", "message": "..."}`
- **Output**: Success/error message
- **Actions**: Sends email via SendGrid, logs to Firestore `feedback` collection

### `handleSendSponsorship`
- **Endpoint**: `/send_sponsorship_email` 
- **Method**: POST
- **Purpose**: Handles sponsorship inquiry forms
- **Input**: `{"companyName": "ACME Corp", "contactName": "John Doe", "email": "user@example.com", "phone": "555-1234", "message": "..."}`
- **Output**: Success/error message  
- **Actions**: Sends email via SendGrid, logs to Firestore `sponsorship_inquiries` collection

## Environment Variables Required

- `SENDGRID_API_KEY`: API key for SendGrid email service

## Deployment

These functions are deployed as part of the Firebase project configuration in `firebase.json` with:
- Runtime: `python312`
- Codebase: `python-api`

## Email Configuration

Update the following email addresses in `main.py` to match your requirements:
- `from_email`: Verified sender address in SendGrid
- `to_emails`: Recipient addresses for feedback and sponsorship inquiries