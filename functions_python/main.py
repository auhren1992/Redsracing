import firebase_admin
from firebase_admin import firestore, initialize_app, auth
from firebase_functions import https_fn, options
from mailgun.client import Client as MailgunClient
import os
import json
from datetime import datetime

# Initialize Firebase Admin SDK via the before_request decorator.
# This ensures it only runs once per server instance.
# NOTE: Commented out due to compatibility issues with current firebase-functions version
# @https_fn.before_request
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

    # Initialize Firebase Admin SDK
    init_firebase()

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

    # Initialize Firebase Admin SDK
    init_firebase()
    
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

    # Initialize Firebase Admin SDK
    init_firebase()
    
    # Extract user_id from URL path
    path_parts = req.path.strip("/").split("/")
    if len(path_parts) < 2 or path_parts[0] != "update_profile":
        return https_fn.Response("Invalid URL format. Use /update_profile/<user_id>", status=400)
    
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
            value = data[field]
            
            # Validate field types and constraints
            if field == "username":
                if not isinstance(value, str) or not value.strip():
                    return https_fn.Response("Username is required and must be a string", status=400)
                # Username validation: alphanumeric and underscores only, 3-30 chars
                username = value.strip().lower()
                if not username.replace('_', '').isalnum() or len(username) < 3 or len(username) > 30:
                    return https_fn.Response("Username must be 3-30 characters, alphanumeric and underscores only", status=400)
                profile_data[field] = username
                
            elif field == "displayName":
                if not isinstance(value, str) or not value.strip():
                    return https_fn.Response("Display name is required and must be a string", status=400)
                display_name = value.strip()
                if len(display_name) > 100:
                    return https_fn.Response("Display name must be 100 characters or less", status=400)
                profile_data[field] = display_name
                
            elif field == "bio":
                if isinstance(value, str):
                    bio = value.strip()
                    if len(bio) > 500:
                        return https_fn.Response("Bio must be 500 characters or less", status=400)
                    profile_data[field] = bio
                    
            elif field == "avatarUrl":
                if isinstance(value, str):
                    avatar_url = value.strip()
                    if avatar_url:  # Only validate if not empty
                        if not avatar_url.startswith(('http://', 'https://')):
                            return https_fn.Response("Avatar URL must be a valid HTTP/HTTPS URL", status=400)
                        if len(avatar_url) > 500:
                            return https_fn.Response("Avatar URL must be 500 characters or less", status=400)
                    profile_data[field] = avatar_url
                    
            elif field == "favoriteCars":
                if isinstance(value, list):
                    # Validate each car name
                    validated_cars = []
                    for car in value[:10]:  # Limit to 10 cars
                        if isinstance(car, str):
                            car_name = car.strip()
                            if car_name and len(car_name) <= 50:  # Max 50 chars per car name
                                validated_cars.append(car_name)
                    profile_data[field] = validated_cars
    
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

    # Initialize Firebase Admin SDK
    init_firebase()

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

@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetLeaderboard(req: https_fn.Request) -> https_fn.Response:
    """Get user leaderboard sorted by achievement points."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    try:
        db = firestore.client()
        
        # Get all user achievements and calculate total points
        user_achievements = db.collection("user_achievements").stream()
        achievements_data = {}
        
        # First get all achievements to know their point values
        for doc in db.collection("achievements").stream():
            achievements_data[doc.id] = doc.to_dict()
        
        # Calculate total points per user
        user_points = {}
        user_achievement_counts = {}
        
        for doc in user_achievements:
            data = doc.to_dict()
            user_id = data["userId"]
            achievement_id = data["achievementId"]
            
            if user_id not in user_points:
                user_points[user_id] = 0
                user_achievement_counts[user_id] = 0
            
            if achievement_id in achievements_data:
                user_points[user_id] += achievements_data[achievement_id].get("points", 0)
                user_achievement_counts[user_id] += 1
        
        # Get user profile data for leaderboard display
        leaderboard = []
        for user_id, total_points in user_points.items():
            try:
                profile_doc = db.collection("user_profiles").document(user_id).get()
                if profile_doc.exists:
                    profile_data = profile_doc.to_dict()
                    leaderboard.append({
                        "userId": user_id,
                        "displayName": profile_data.get("displayName", "Anonymous User"),
                        "username": profile_data.get("username", ""),
                        "avatarUrl": profile_data.get("avatarUrl", ""),
                        "totalPoints": total_points,
                        "achievementCount": user_achievement_counts[user_id]
                    })
            except:
                # Skip users with missing profiles
                continue
        
        # Sort by total points descending
        leaderboard.sort(key=lambda x: x["totalPoints"], reverse=True)
        
        # Limit to top 50 users
        leaderboard = leaderboard[:50]
        
        # Add rank numbers
        for i, user in enumerate(leaderboard):
            user["rank"] = i + 1
        
        return https_fn.Response(
            json.dumps(leaderboard, default=str), 
            status=200, 
            headers={"Content-Type": "application/json"}
        )
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleAutoAwardAchievement(req: https_fn.Request) -> https_fn.Response:
    """Automatically award achievements based on user actions."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    # This endpoint can be called internally or by authenticated users
    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)
    
    user_id = data.get("userId")
    action_type = data.get("actionType")
    action_data = data.get("actionData", {})
    
    if not all([user_id, action_type]):
        return https_fn.Response("Missing required fields: userId, actionType", status=400)

    try:
        db = firestore.client()
        
        # Get all achievements to check which ones to award
        achievements_query = db.collection("achievements").stream()
        achievements = {}
        
        for doc in achievements_query:
            achievement_data = doc.to_dict()
            achievement_data["id"] = doc.id
            achievements[doc.id] = achievement_data
        
        # Get user's current achievements
        user_achievements_query = db.collection("user_achievements").where("userId", "==", user_id).stream()
        user_achievement_ids = {doc.to_dict()["achievementId"] for doc in user_achievements_query}
        
        # Determine which achievements to award based on action type
        achievements_to_award = []
        
        if action_type == "first_login":
            if "community_member" not in user_achievement_ids:
                achievements_to_award.append("community_member")
        
        elif action_type == "photo_upload":
            # Check for photographer achievement (5 photos)
            if "photographer" not in user_achievement_ids:
                photo_count = action_data.get("totalPhotos", 1)
                if photo_count >= 5:
                    achievements_to_award.append("photographer")
        
        elif action_type == "photo_liked":
            # Check for fan favorite achievement (10 total likes across all photos)
            if "fan_favorite" not in user_achievement_ids:
                total_likes = action_data.get("totalLikes", 1)
                if total_likes >= 10:
                    achievements_to_award.append("fan_favorite")
        
        elif action_type == "profile_created":
            if "community_member" not in user_achievement_ids:
                achievements_to_award.append("community_member")
        
        # Award the achievements
        awarded_achievements = []
        for achievement_id in achievements_to_award:
            if achievement_id in achievements:
                user_achievement_data = {
                    "userId": user_id,
                    "achievementId": achievement_id,
                    "dateEarned": firestore.SERVER_TIMESTAMP,
                    "assignedBy": "system",
                    "autoAwarded": True,
                    "actionType": action_type
                }
                
                db.collection("user_achievements").add(user_achievement_data)
                awarded_achievements.append({
                    "id": achievement_id,
                    "name": achievements[achievement_id]["name"],
                    "description": achievements[achievement_id]["description"],
                    "points": achievements[achievement_id]["points"]
                })
        
        return https_fn.Response(
            json.dumps({
                "awardedAchievements": awarded_achievements,
                "message": f"Awarded {len(awarded_achievements)} achievement(s)"
            }, default=str),
            status=200,
            headers={"Content-Type": "application/json"}
        )
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)

@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetAchievementProgress(req: https_fn.Request) -> https_fn.Response:
    """Get achievement progress for a user."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    # Extract user_id from URL path
    path_parts = req.path.strip("/").split("/")
    if len(path_parts) < 2 or path_parts[0] != "achievement_progress":
        return https_fn.Response("Invalid URL format. Use /achievement_progress/<user_id>", status=400)
    
    user_id = path_parts[1]

    try:
        db = firestore.client()
        
        # Get user's current achievements
        user_achievements_query = db.collection("user_achievements").where("userId", "==", user_id).stream()
        user_achievement_ids = {doc.to_dict()["achievementId"] for doc in user_achievements_query}
        
        # Define progress tracking for specific achievements
        progress_data = {}
        
        # Photographer achievement progress (upload 5 photos)
        if "photographer" not in user_achievement_ids:
            try:
                photos_query = db.collection("gallery_images").where("uploaderUid", "==", user_id).stream()
                photo_count = sum(1 for _ in photos_query)
                progress_data["photographer"] = {
                    "current": photo_count,
                    "target": 5,
                    "percentage": min((photo_count / 5) * 100, 100),
                    "completed": photo_count >= 5,
                    "description": f"Upload {photo_count}/5 photos to the gallery"
                }
            except Exception as e:
                print(f"Error getting photo count: {e}")
        
        # Fan Favorite achievement progress (get 10 total likes)
        if "fan_favorite" not in user_achievement_ids:
            try:
                user_photos_query = db.collection("gallery_images").where("uploaderUid", "==", user_id).stream()
                total_likes = 0
                for photo_doc in user_photos_query:
                    photo_data = photo_doc.to_dict()
                    total_likes += photo_data.get("likeCount", 0)
                
                progress_data["fan_favorite"] = {
                    "current": total_likes,
                    "target": 10,
                    "percentage": min((total_likes / 10) * 100, 100),
                    "completed": total_likes >= 10,
                    "description": f"Receive {total_likes}/10 total likes on your photos"
                }
            except Exception as e:
                print(f"Error getting like count: {e}")
        
        # Community Member achievement (already earned or not)
        if "community_member" not in user_achievement_ids:
            progress_data["community_member"] = {
                "current": 0,
                "target": 1,
                "percentage": 0,
                "completed": False,
                "description": "Join the RedsRacing community (automatic on login)"
            }
        
        return https_fn.Response(
            json.dumps(progress_data, default=str),
            status=200,
            headers={"Content-Type": "application/json"}
        )
    
    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)
