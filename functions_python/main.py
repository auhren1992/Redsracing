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

@https_fn.on_call(region="us-central1")
def toggle_like_photo(req: https_fn.CallableRequest) -> https_fn.Response:
    if req.auth is None:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="You must be logged in to like a photo.")
    image_id = req.data.get("imageId")
    if not image_id:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Request must include an 'imageId'.")
    uid = req.auth.uid
    db = firestore.client()
    photo_ref = db.collection("gallery_images").document(image_id)
    like_ref = photo_ref.collection("likes").document(uid)
    @firestore.transactional
    def _toggle_like(transaction):
        like_doc = like_ref.get(transaction=transaction)
        if like_doc.exists:
            transaction.delete(like_ref)
            transaction.update(photo_ref, {"likeCount": firestore.Increment(-1)})
            return {"status": "unliked"}
        else:
            transaction.set(like_ref, {"likedAt": firestore.SERVER_TIMESTAMP})
            transaction.update(photo_ref, {"likeCount": firestore.Increment(1)})
            return {"status": "liked"}
    try:
        result = _toggle_like(db.transaction())
        return {"status": "success", "action": result["status"]}
    except Exception as e:
        print(f"Error toggling like for image {image_id} by user {uid}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An internal error occurred while toggling the like.")

@https_fn.on_call(region="us-central1")
def add_photo_comment(req: https_fn.CallableRequest) -> https_fn.Response:
    if req.auth is None:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="You must be logged in to comment.")
    image_id = req.data.get("imageId")
    text = req.data.get("text")
    if not image_id or not text or not text.strip():
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Request must include an 'imageId' and non-empty 'text'.")
    uid = req.auth.uid
    name = req.auth.token.get("name", "Anonymous User")
    try:
        db = firestore.client()
        comment_ref = db.collection("gallery_images").document(image_id).collection("comments").add({"authorUid": uid, "authorName": name, "text": text, "createdAt": firestore.SERVER_TIMESTAMP})
        return {"status": "success", "commentId": comment_ref[1].id}
    except Exception as e:
        print(f"Error adding comment for image {image_id} by user {uid}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="An internal error occurred while adding the comment.")
