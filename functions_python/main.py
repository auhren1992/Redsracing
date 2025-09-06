# main.py
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
import os

# Initialize Firebase Admin SDK.
# It's safe to call this multiple times; it will only initialize once.
try:
    initialize_app()
except ValueError:
    pass

db = firestore.client()

@https_fn.on_request(region="us-central1")
def add_subscriber(req: https_fn.Request) -> https_fn.Response:
    """Adds a subscriber's email to the Firestore database."""
    # Set CORS headers for preflight requests
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response("", status=204, headers=headers)

    # Set CORS headers for the main request
    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    if req.method != "POST":
        return https_fn.Response("Method not allowed.", status=405, headers=headers)

    try:
        data = req.get_json()
        email = data.get("email")

        if not email:
            return https_fn.Response('{"message": "Email is required."}', status=400, mimetype="application/json", headers=headers)

        # Using the email as the document ID is a simple way to prevent duplicates.
        db.collection("subscribers").document(email).set({
            "subscribed_at": firestore.SERVER_TIMESTAMP
        })

        return https_fn.Response('{"message": "Thank you for subscribing!"}', status=200, mimetype="application/json", headers=headers)

    except Exception as e:
        print(f"Error adding subscriber: {e}")
        return https_fn.Response('{"message": "An internal error occurred."}', status=500, mimetype="application/json", headers=headers)


@https_fn.on_request(region="us-central1")
def send_feedback_email(req: https_fn.Request) -> https_fn.Response:
    """Receives feedback from a user and logs it."""
    # Set CORS headers
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response("", status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    if req.method != "POST":
        return https_fn.Response("Method not allowed.", status=405, headers=headers)

    try:
        data = req.get_json()
        name = data.get("name")
        email = data.get("email")
        message = data.get("message")

        if not all([name, email, message]):
            return https_fn.Response('{"message": "Name, email, and message are required."}', status=400, mimetype="application/json", headers=headers)

        # In a real application, you would use a transactional email service
        # like SendGrid or Mailgun to send the email. For this example, we
        # will just log the feedback, which is a good first step.
        print("--- New Feedback Received ---")
        print(f"From: {name} <{email}>")
        print(f"Message: {message}")
        print("-----------------------------")

        # You can also store the feedback in Firestore
        db.collection("feedback").add({
            "name": name,
            "email": email,
            "message": message,
            "received_at": firestore.SERVER_TIMESTAMP
        })

        return https_fn.Response('{"message": "Thank you for your feedback!"}', status=200, mimetype="application/json", headers=headers)

    except Exception as e:
        print(f"Error sending feedback: {e}")
        return https_fn.Response('{"message": "An internal error occurred."}', status=500, mimetype="application/json", headers=headers)


@https_fn.on_request(region="us-central1")
def send_sponsorship_email(req: https_fn.Request) -> https_fn.Response:
    """Receives a sponsorship inquiry and logs it."""
    # Set CORS headers
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response("", status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    if req.method != "POST":
        return https_fn.Response("Method not allowed.", status=405, headers=headers)

    try:
        data = req.get_json()
        companyName = data.get("companyName")
        contactName = data.get("contactName")
        email = data.get("email")
        phone = data.get("phone")
        message = data.get("message")

        if not all([companyName, contactName, email, message]):
            return https_fn.Response('{"message": "Company name, contact name, email, and message are required."}', status=400, mimetype="application/json", headers=headers)

        # Log the inquiry and also save it to Firestore
        print("--- New Sponsorship Inquiry ---")
        print(f"Company: {companyName}")
        print(f"Contact: {contactName} <{email}>")
        print(f"Phone: {phone}")
        print(f"Message: {message}")
        print("-------------------------------")

        db.collection("sponsorship_inquiries").add({
            "companyName": companyName,
            "contactName": contactName,
            "email": email,
            "phone": phone,
            "message": message,
            "received_at": firestore.SERVER_TIMESTAMP
        })

        return https_fn.Response('{"message": "Thank you for your inquiry! We will be in touch soon."}', status=200, mimetype="application/json", headers=headers)

    except Exception as e:
        print(f"Error sending sponsorship inquiry: {e}")
        return https_fn.Response('{"message": "An internal error occurred."}', status=500, mimetype="application/json", headers=headers)
