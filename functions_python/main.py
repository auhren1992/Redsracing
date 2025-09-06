import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

firebase_admin.initialize_app()

@https_fn.on_call(region="us-central1")
def add_subscriber(req: https_fn.CallableRequest) -> https_fn.Response:
    email = req.data.get("email")
    if not email or "@" not in email or "." not in email:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="A valid email address is required.")
    try:
        db = firestore.client()
        db.collection("subscribers").document(email).set({"subscribedAt": firestore.SERVER_TIMESTAMP})
        return {"status": "success", "message": "You have been subscribed successfully!"}
    except Exception as e:
        print(f"Error adding subscriber {email}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An internal error occurred.")

@https_fn.on_call(region="us-central1")
def send_feedback_email(req: https_fn.CallableRequest) -> https_fn.Response:
    feedback_text = req.data.get("feedbackText")
    user_email = req.data.get("email", "Not provided")
    if not feedback_text:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Feedback text cannot be empty.")
    db = firestore.client()
    try:
        db.collection("feedback").add({"feedbackText": feedback_text, "submitterEmail": user_email, "submittedAt": firestore.SERVER_TIMESTAMP})
    except Exception as e:
        print(f"Error saving feedback to Firestore: {e}")
    sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
    to_email = 'redsracing65@gmail.com'
    if not sendgrid_api_key:
        print("CRITICAL: SENDGRID_API_KEY environment variable not set.")
        return {"status": "success", "message": "Thank you for your feedback! (Admin note: email not sent)"}
    message = Mail(from_email='feedback-bot@redsracing.com', to_emails=to_email, subject=f'New Website Feedback from {user_email}', html_content=f'<strong>Feedback from:</strong> {user_email}<br><br><strong>Message:</strong><br><p>{feedback_text}</p>')
    try:
        sg = SendGridAPIClient(sendgrid_api_key)
        sg.send(message)
        return {"status": "success", "message": "Thank you for your feedback!"}
    except Exception as e:
        print(f"Error sending feedback email via SendGrid: {e}")
        return {"status": "success", "message": "Thank you for your feedback! (Admin note: email failed to send)"}
