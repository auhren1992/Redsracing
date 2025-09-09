import firebase_admin
from firebase_admin import firestore, initialize_app, auth
from firebase_functions import https_fn, options
from mailgun.client import Client as MailgunClient
import os
import json
from datetime import datetime

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
mg = MailgunClient(auth=("api", os.environ.get("MAILGUN_API_KEY")))

# Define a default CORS policy to allow requests from any origin.
CORS_OPTIONS = options.CorsOptions(cors_origins="*", cors_methods=["get", "post", "put", "options"])

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
        data = {
            "from": "feedback@mg.redsracing.org",
            "to": "aaron@redsracing.org",
            "subject": email_subject,
            "text": email_body
        }
        
        response = mg.messages.create(data=data, domain="mg.redsracing.org")
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
        data = {
            "from": "sponsorship@mg.redsracing.org",
            "to": "aaron@redsracing.org",
            "subject": email_subject,
            "text": email_body
        }
        
        response = mg.messages.create(data=data, domain="mg.redsracing.org")
        return https_fn.Response("Sponsorship inquiry sent successfully!", status=200)
    except Exception as e:
        return https_fn.Response(f"An error occurred while sending email: {e}", status=500)

# ============================================================================
# USER PROFILE AND ACHIEVEMENTS SYSTEM
# ============================================================================

def _get_user_from_token(req):
    """Helper function to extract and verify Firebase Auth token."""
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, https_fn.Response("Missing or invalid Authorization header", status=401)
    
    token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token, None
    except Exception as e:
        return None, https_fn.Response(f"Invalid token: {e}", status=401)

def _is_admin(decoded_token):
    """Helper function to check if user has admin role."""
    custom_claims = decoded_token.get("role")
    return custom_claims == "team-member"

@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetProfile(req: https_fn.Request) -> https_fn.Response:
    """Retrieve a user's profile and achievements."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    # Extract user_id from URL path
    path_parts = req.path.strip("/").split("/")
    if len(path_parts) < 2 or path_parts[0] != "profile":
        return https_fn.Response("Invalid URL format. Use /profile/<user_id>", status=400)
    
    user_id = path_parts[1]
    
    try:
        db = firestore.client()
        
        # Get user profile
        profile_doc = db.collection("user_profiles").document(user_id).get()
        if not profile_doc.exists:
            return https_fn.Response("Profile not found", status=404)
        
        profile_data = profile_doc.to_dict()
        
        # Get user achievements
        achievements_query = db.collection("user_achievements").where("userId", "==", user_id).stream()
        user_achievements = []
        
        for ach_doc in achievements_query:
            ach_data = ach_doc.to_dict()
            # Get achievement details
            achievement_ref = db.collection("achievements").document(ach_data["achievementId"])
            achievement_doc = achievement_ref.get()
            if achievement_doc.exists:
                achievement_details = achievement_doc.to_dict()
                achievement_details["dateEarned"] = ach_data.get("dateEarned")
                user_achievements.append(achievement_details)
        
        # Combine profile with achievements
        result = {
            **profile_data,
            "achievements": user_achievements
        }
        
        return https_fn.Response(json.dumps(result, default=str), status=200, headers={"Content-Type": "application/json"})
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleUpdateProfile(req: https_fn.Request) -> https_fn.Response:
    """Update the authenticated user's profile."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "PUT":
        return https_fn.Response("Method not allowed", status=405)

    # Extract user_id from URL path
    path_parts = req.path.strip("/").split("/")
    if len(path_parts) < 2 or path_parts[0] != "profile":
        return https_fn.Response("Invalid URL format. Use /profile/<user_id>", status=400)
    
    user_id = path_parts[1]
    
    # Verify authentication
    decoded_token, auth_error = _get_user_from_token(req)
    if auth_error:
        return auth_error
    
    # Users can only update their own profile
    if decoded_token["uid"] != user_id:
        return https_fn.Response("Forbidden: Can only update your own profile", status=403)
    
    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)
    
    # Allowed fields for profile update
    allowed_fields = ["username", "displayName", "bio", "avatarUrl", "favoriteCars"]
    profile_data = {}
    
    for field in allowed_fields:
        if field in data:
            profile_data[field] = data[field]
    
    if not profile_data:
        return https_fn.Response("No valid fields provided for update", status=400)
    
    try:
        db = firestore.client()
        
        # Add/update timestamp
        profile_data["lastUpdated"] = firestore.SERVER_TIMESTAMP
        
        # Update profile document
        profile_ref = db.collection("user_profiles").document(user_id)
        profile_ref.set(profile_data, merge=True)
        
        return https_fn.Response("Profile updated successfully", status=200)
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetAchievements(req: https_fn.Request) -> https_fn.Response:
    """List all available achievements/badges."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    try:
        db = firestore.client()
        
        # Get all achievements
        achievements_query = db.collection("achievements").stream()
        achievements = []
        
        for doc in achievements_query:
            achievement_data = doc.to_dict()
            achievement_data["id"] = doc.id
            achievements.append(achievement_data)
        
        return https_fn.Response(json.dumps(achievements, default=str), status=200, headers={"Content-Type": "application/json"})
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleAssignAchievement(req: https_fn.Request) -> https_fn.Response:
    """Assign an achievement to a user (admins only)."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    # Verify authentication and admin role
    decoded_token, auth_error = _get_user_from_token(req)
    if auth_error:
        return auth_error
    
    if not _is_admin(decoded_token):
        return https_fn.Response("Forbidden: Admin role required", status=403)
    
    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)
    
    user_id = data.get("userId")
    achievement_id = data.get("achievementId")
    
    if not all([user_id, achievement_id]):
        return https_fn.Response("Missing required fields: userId, achievementId", status=400)
    
    try:
        db = firestore.client()
        
        # Verify achievement exists
        achievement_doc = db.collection("achievements").document(achievement_id).get()
        if not achievement_doc.exists:
            return https_fn.Response("Achievement not found", status=404)
        
        # Check if user already has this achievement
        existing_query = db.collection("user_achievements").where("userId", "==", user_id).where("achievementId", "==", achievement_id).limit(1).stream()
        if any(existing_query):
            return https_fn.Response("User already has this achievement", status=400)
        
        # Create user achievement record
        user_achievement_data = {
            "userId": user_id,
            "achievementId": achievement_id,
            "dateEarned": firestore.SERVER_TIMESTAMP,
            "assignedBy": decoded_token["uid"]
        }
        
        db.collection("user_achievements").add(user_achievement_data)
        
        return https_fn.Response("Achievement assigned successfully", status=200)
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)
