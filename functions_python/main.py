import firebase_admin
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn, options
from mailgun import Mailgun
import os

# Initialize Firebase Admin SDK via the before_request decorator.
# This ensures it only runs once per server instance.
@https_fn.before_request
def init_firebase():
    try:
        firebase_admin.get_app()
    except ValueError:
        initialize_app()

# Set the Mailgun API key from environment variables/secrets.
# This is crucial for security. The secret name is 'MAILGUN_API_KEY'.
options.set_global_options(secrets=["MAILGUN_API_KEY"])
mg = Mailgun(api_key=os.environ.get("MAILGUN_API_KEY"))

# Define a default CORS policy to allow requests from any origin.
CORS_OPTIONS = options.CorsOptions(cors_origins="*", cors_methods=["get", "post", "options"])

@https_fn.on_request(cors=CORS_OPTIONS)
def handleAddSubscriber(req: https_fn.Request) -> https_fn.Response:
    """Adds a subscriber's email to the Firestore 'subscribers' collection."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data or not data.get("email"):
        return https_fn.Response("Email is required", status=400)

    email = data["email"]
    try:
        db = firestore.client()
        db.collection("subscribers").add({"email": email, "timestamp": firestore.SERVER_TIMESTAMP})
        return https_fn.Response("Subscription successful!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleSendFeedback(req: https_fn.Request) -> https_fn.Response:
    """Sends feedback from a user as an email via Mailgun."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    name = data.get("name")
    email = data.get("email")
    message = data.get("message")

    if not all([name, email, message]):
        return https_fn.Response("Missing required fields: name, email, message", status=400)

    try:
        email_subject = f"New Feedback from {name}"
        email_body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"

        # IMPORTANT: Replace with your actual Mailgun domain and recipient email.
        mg.send_email(
            from_email="feedback@mg.redsracing.org",
            to_emails=["aaron@redsracing.org"],
            subject=email_subject,
            text=email_body
        )
        return https_fn.Response("Feedback sent successfully!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred while sending email: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleSendSponsorship(req: https_fn.Request) -> https_fn.Response:
    """Sends a sponsorship inquiry as an email via Mailgun."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    company = data.get("company", "N/A")
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone", "N/A")
    message = data.get("message")

    if not all([name, email, message]):
        return https_fn.Response("Missing required fields: name, email, message", status=400)

    try:
        email_subject = f"New Sponsorship Inquiry from {name}"
        email_body = (
            f"Company: {company}\n"
            f"Contact Name: {name}\n"
            f"Email: {email}\n"
            f"Phone: {phone}\n\n"
            f"Message:\n{message}"
        )

        # IMPORTANT: Replace with your actual Mailgun domain and recipient email.
        mg.send_email(
            from_email="sponsorship@mg.redsracing.org",
            to_emails=["aaron@redsracing.org"],
            subject=email_subject,
            text=email_body
        )
        return https_fn.Response("Sponsorship inquiry sent successfully!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred while sending email: {e}", status=500)
