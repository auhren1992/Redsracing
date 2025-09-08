import os
import firebase_admin
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn, options
from sendgrid_client import SendGridEmailClient

# Initialize Firebase Admin at module level
try:
    firebase_admin.get_app()
except ValueError:
    initialize_app()

# Declare the secret needed for SendGrid. (Deploy with: firebase functions:secrets:set SENDGRID_API_KEY)
options.set_global_options(secrets=["SENDGRID_API_KEY"])

# CORS configuration (allowing any origin; consider tightening in production)
CORS_OPTIONS = options.CorsOptions(
    cors_origins="*",
    cors_methods=["get", "post", "options"],
)

def get_email_client() -> SendGridEmailClient:
    """Lazily initialize the SendGrid client to avoid import-time failures when secret missing locally."""
    return SendGridEmailClient(
        api_key=os.environ.get("SENDGRID_API_KEY"),
        default_from="Reds Racing <noreply@redsracing.org>",  # Adjust to verified sender identity
    )

@https_fn.on_request(cors=CORS_OPTIONS)
def handleAddSubscriber(req: https_fn.Request) -> https_fn.Response:
    """Adds a subscriber email to Firestore collection 'subscribers'."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data or not data.get("email"):
        return https_fn.Response("Email is required", status=400)

    email = data["email"].strip()
    try:
        db = firestore.client()
        db.collection("subscribers").add({
            "email": email,
            "timestamp": firestore.SERVER_TIMESTAMP,
        })
        return https_fn.Response("Subscription successful!", status=200)
    except Exception as e:  # Broad except acceptable for surface-level API; log internally if needed.
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleSendFeedback(req: https_fn.Request) -> https_fn.Response:
    """Sends a feedback email using SendGrid."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not all([name, email, message]):
        return https_fn.Response("Missing required fields: name, email, message", status=400)

    try:
        client = get_email_client()
        subject = f"New Feedback from {name}"
        text_body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
        html_body = (
            f"<p><strong>Name:</strong> {name}</p>"
            f"<p><strong>Email:</strong> {email}</p>"
            f"<p><strong>Message:</strong><br>{message.replace(chr(10), '<br>')}</p>"
        )
        client.send_email(
            subject=subject,
            text=text_body,
            html=html_body,
            to_emails=["aaron@redsracing.org"],
            from_email="Feedback <feedback@redsracing.org>",
            reply_to=email,
        )
        return https_fn.Response("Feedback sent successfully!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred while sending email: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleSendSponsorship(req: https_fn.Request) -> https_fn.Response:
    """Sends a sponsorship inquiry via SendGrid."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    company = (data.get("company") or "").strip()
    message = (data.get("message") or "").strip()

    if not all([name, email, company, message]):
        return https_fn.Response("Missing required fields: name, email, company, message", status=400)

    try:
        client = get_email_client()
        subject = f"Sponsorship Inquiry from {name} ({company})"
        text_body = (
            f"Name: {name}\n"
            f"Email: {email}\n"
            f"Company: {company}\n\n"
            f"Message:\n{message}"
        )
        html_body = (
            f"<p><strong>Name:</strong> {name}</p>"
            f"<p><strong>Email:</strong> {email}</p>"
            f"<p><strong>Company:</strong> {company}</p>"
            f"<p><strong>Message:</strong><br>{message.replace(chr(10), '<br>')}</p>"
        )
        client.send_email(
            subject=subject,
            text=text_body,
            html=html_body,
            to_emails=["aaron@redsracing.org"],
            from_email="Sponsorship <sponsorship@redsracing.org>",
            reply_to=email,
        )
        return https_fn.Response("Sponsorship inquiry sent successfully!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred while sending email: {e}", status=500)
