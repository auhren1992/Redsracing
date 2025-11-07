from firebase_admin import firestore, initialize_app, auth, storage
from firebase_functions import https_fn, options
import sendgrid
from sendgrid.helpers.mail import Mail
import os
import json
import random
from datetime import datetime, timedelta
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from PIL import Image
import piexif
import io
import base64
from statistics import mean, median

# Sentry error monitoring
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# Initialize Firebase Admin SDK.
# In local analysis environments, ADC may be unavailable; avoid failing hard.
try:
    initialize_app()
except Exception as e:
    try:
        # Best-effort capture; don’t block function analysis
        sentry_sdk.capture_exception(e)
    except Exception:
        pass

# Configure secrets for email functionality
# Keep SENTRY_DSN optional to avoid deployment failure when the secret is not present
options.set_global_options(secrets=["SENDGRID_API_KEY", "RECAPTCHA_SITE_KEY", "SENTRY_DSN"])

# Initialize Sentry (non-blocking if DSN not provided)
SENTRY_DSN = os.environ.get("SENTRY_DSN")
SENTRY_ENV = os.environ.get("SENTRY_ENV", "production")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENV,
        integrations=[FlaskIntegration()],
        traces_sample_rate=1.0,  # Capture 100% of transactions for performance monitoring
        send_default_pii=True,  # Include request headers, IP addresses, and user info
        include_source_context=True,  # Include source code context in error reports
        include_local_variables=True,  # Include local variables in stack traces
        max_request_body_size="medium",  # Send request bodies up to medium size
    )

# Configure secrets for email functionality
# The SENDGRID_API_KEY secret should be configured in Google Cloud Secret Manager
# If the secret is not available or empty, email functions will fail at runtime with proper error messages


# Initialize SendGrid client lazily to avoid import failures if API key is missing
sg = None


def get_sendgrid_client():
    """Get or initialize the SendGrid client."""
    global sg
    if sg is None:
        api_key = os.environ.get("SENDGRID_API_KEY")
        if not api_key or api_key.strip() == "":
            raise ValueError(
                "SENDGRID_API_KEY is not configured or is empty. Please configure the secret in Google Cloud Secret Manager."
            )
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
    return sg


def get_client_ip(req):
    """Extract client IP address from request headers."""
    # Check for forwarded IP first (common in cloud environments)
    forwarded_for = req.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    # Fallback to other headers
    real_ip = req.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Last resort - direct connection IP (may be load balancer IP)
    return req.environ.get("REMOTE_ADDR", "unknown")


def get_user_agent(req):
    """Extract user agent from request headers."""
    return req.headers.get("User-Agent", "unknown")


def queue_fallback(collection_name: str, payload: dict, req: https_fn.Request):
    """Queue the payload to Firestore so it is not lost if email fails.
    Returns (True, doc_ref_id) on success, (False, error_message) on failure.
    """
    try:
        db = firestore.client()
        now = datetime.utcnow()
        record = {
            **payload,
            "status": "queued",
            "retryCount": 0,
            "queuedAt": firestore.SERVER_TIMESTAMP,
            "nextAttemptAt": now,
            "clientIp": get_client_ip(req),
            "userAgent": get_user_agent(req),
        }
        doc_ref = db.collection(collection_name).add(record)
        return True, str(doc_ref[1].id)
    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return False, str(e)

# Define a default CORS policy to allow requests from any origin.
CORS_OPTIONS = options.CorsOptions(
    cors_origins="*", cors_methods=["get", "post", "put", "options"]
)


def ts_to_dict(value):
    """Helper function to convert datetime objects to Firestore-like timestamp format."""
    if isinstance(value, datetime):
        # Convert to {seconds: int, nanoseconds: int} format
        timestamp = value.timestamp()
        seconds = int(timestamp)
        nanoseconds = (
            int((timestamp - seconds) * 1_000_000) * 1000
        )  # Convert microseconds to nanoseconds
        return {"seconds": seconds, "nanoseconds": nanoseconds}
    return value


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
        db.collection("subscribers").add(
            {"email": email, "timestamp": firestore.SERVER_TIMESTAMP}
        )
        return https_fn.Response(
            json.dumps({"message": "Subscription successful!"}),
            status=200,
            headers={"Content-Type": "application/json"},
        )
    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(
            json.dumps({"message": f"An error occurred: {str(e)}"}),
            status=500,
            headers={"Content-Type": "application/json"},
        )


@https_fn.on_request(cors=CORS_OPTIONS)
def handleTest(req: https_fn.Request) -> https_fn.Response:
    """A simple test function to verify rewrite functionality."""
    print("handleTest function was invoked.")
    
    # Test Sentry error reporting if test_error parameter is passed
    if req.args.get('test_error') == 'true':
        try:
            # Force an error for Sentry testing
            result = 1 / 0  # This will cause a ZeroDivisionError
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return https_fn.Response(
                json.dumps({"status": "error", "message": "Test error sent to Sentry!"}),
                status=500,
                headers={"Content-Type": "application/json"},
            )
    
    return https_fn.Response(
        json.dumps({"status": "success", "message": "Hello from the test function!"}),
        status=200,
        headers={"Content-Type": "application/json"},
    )


@https_fn.on_request(cors=CORS_OPTIONS, secrets=["SENDGRID_API_KEY", "SENTRY_DSN"])
def handleSendFeedback(req: https_fn.Request) -> https_fn.Response:
    """Sends feedback from a user as an email via SendGrid."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    name = data.get("name")
    email = data.get("email")
    message_content = data.get("message")

    if not all([name, email, message_content]):
        return https_fn.Response(
            "Missing required fields: name, email, message", status=400
        )

    try:
        email_subject = f"New Feedback from {name}"
        email_body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message_content}"

        message = Mail(
            from_email="feedback@redsracing.org",  # Must be a verified sender in SendGrid
            to_emails="aaron@redsracing.org",
            subject=email_subject,
            plain_text_content=email_body,
        )

        sg_client = get_sendgrid_client()
        response = sg_client.send(message)

        if response.status_code >= 200 and response.status_code < 300:
            return https_fn.Response(
                json.dumps({"message": "Feedback sent successfully!"}),
                status=200,
                headers={"Content-Type": "application/json"},
            )
        else:
            # Email failed — queue to Firestore so it isn't lost
            ok, info = queue_fallback(
                "feedback_queue",
                {"name": name, "email": email, "message": message_content},
                req,
            )
            if ok:
                return https_fn.Response(
                    json.dumps({
                        "message": "Feedback received and queued due to email error.",
                        "queueId": info,
                    }),
                    status=202,
                    headers={"Content-Type": "application/json"},
                )
            # Queueing also failed; return original error
            return https_fn.Response(
                json.dumps({"message": f"Error sending email: {response.body}"}),
                status=response.status_code,
                headers={"Content-Type": "application/json"},
            )

    except ValueError as ve:
        # Email service not configured — queue instead
        ok, info = queue_fallback(
            "feedback_queue",
            {"name": name, "email": email, "message": message_content},
            req,
        )
        if ok:
            return https_fn.Response(
                json.dumps({
                    "message": "Feedback received and queued (email service temporarily unavailable).",
                    "queueId": info,
                }),
                status=202,
                headers={"Content-Type": "application/json"},
            )
        # If queueing fails, report configuration error
        try:
            sentry_sdk.capture_exception(ve)
        except Exception:
            pass
        return https_fn.Response(
            json.dumps({"message": f"Email service not configured: {str(ve)}"}),
            status=503,
            headers={"Content-Type": "application/json"},
        )
    except Exception as e:
        # Other unexpected errors — queue and acknowledge receipt
        ok, info = queue_fallback(
            "feedback_queue",
            {"name": name, "email": email, "message": message_content},
            req,
        )
        if ok:
            return https_fn.Response(
                json.dumps({
                    "message": "Feedback received and queued due to temporary error.",
                    "queueId": info,
                }),
                status=202,
                headers={"Content-Type": "application/json"},
            )
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(
            json.dumps({"message": f"An error occurred while sending email: {str(e)}"}),
            status=500,
            headers={"Content-Type": "application/json"},
        )


@https_fn.on_request(cors=CORS_OPTIONS, secrets=["SENDGRID_API_KEY", "SENTRY_DSN"])
def handleSendSponsorship(req: https_fn.Request) -> https_fn.Response:
    """Sends a sponsorship inquiry as an email via SendGrid."""
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
    message_content = data.get("message")

    if not all([name, email, message_content]):
        return https_fn.Response(
            "Missing required fields: name, email, message", status=400
        )

    try:
        email_subject = f"New Sponsorship Inquiry from {name}"
        email_body = (
            f"Company: {company}\n"
            f"Contact Name: {name}\n"
            f"Email: {email}\n"
            f"Phone: {phone}\n\n"
            f"Message:\n{message_content}"
        )

        message = Mail(
            from_email="sponsorship@redsracing.org",  # Must be a verified sender in SendGrid
            to_emails="aaron@redsracing.org",
            subject=email_subject,
            plain_text_content=email_body,
        )

        sg_client = get_sendgrid_client()
        response = sg_client.send(message)

        if response.status_code >= 200 and response.status_code < 300:
            return https_fn.Response(
                json.dumps({"message": "Sponsorship inquiry sent successfully!"}),
                status=200,
                headers={"Content-Type": "application/json"},
            )
        else:
            ok, info = queue_fallback(
                "sponsorship_queue",
                {
                    "company": company,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "message": message_content,
                },
                req,
            )
            if ok:
                return https_fn.Response(
                    json.dumps({
                        "message": "Sponsorship inquiry received and queued due to email error.",
                        "queueId": info,
                    }),
                    status=202,
                    headers={"Content-Type": "application/json"},
                )
            return https_fn.Response(
                json.dumps({"message": f"Error sending email: {response.body}"}),
                status=response.status_code,
                headers={"Content-Type": "application/json"},
            )

    except ValueError as ve:
        ok, info = queue_fallback(
            "sponsorship_queue",
            {
                "company": company,
                "name": name,
                "email": email,
                "phone": phone,
                "message": message_content,
            },
            req,
        )
        if ok:
            return https_fn.Response(
                json.dumps({
                    "message": "Sponsorship inquiry received and queued (email service temporarily unavailable).",
                    "queueId": info,
                }),
                status=202,
                headers={"Content-Type": "application/json"},
            )
        try:
            sentry_sdk.capture_exception(ve)
        except Exception:
            pass
        return https_fn.Response(
            json.dumps({"message": f"Email service not configured: {str(ve)}"}),
            status=503,
            headers={"Content-Type": "application/json"},
        )
    except Exception as e:
        ok, info = queue_fallback(
            "sponsorship_queue",
            {
                "company": company,
                "name": name,
                "email": email,
                "phone": phone,
                "message": message_content,
            },
            req,
        )
        if ok:
            return https_fn.Response(
                json.dumps({
                    "message": "Sponsorship inquiry received and queued due to temporary error.",
                    "queueId": info,
                }),
                status=202,
                headers={"Content-Type": "application/json"},
            )
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(
            json.dumps({"message": f"An error occurred while sending email: {str(e)}"}),
            status=500,
            headers={"Content-Type": "application/json"},
        )


@https_fn.on_request(cors=CORS_OPTIONS, secrets=["SENDGRID_API_KEY", "SENTRY_DSN"])
def handleProcessQueues(req: https_fn.Request) -> https_fn.Response:
    """HTTP endpoint to process queued feedback and sponsorship items.
    Intended to be invoked by Cloud Scheduler (OIDC) or Admins.
    Only POST is allowed. Valid callers:
      - Cloud Scheduler with OIDC Bearer token (service account email ends with gserviceaccount.com)
      - Authenticated Firebase user with admin/team-member role
    """
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    # AuthZ: Try Cloud Scheduler OIDC first
    authorized = False
    auth_header = req.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            oidc_token = auth_header.split("Bearer ")[1]
            info = google_id_token.verify_oauth2_token(oidc_token, google_requests.Request())
            email = info.get("email", "")
            if email.endswith("gserviceaccount.com"):
                authorized = True
        except Exception:
            authorized = False

    # If not OIDC authorized, require Firebase Admin user
    if not authorized:
        decoded, err_resp = _get_user_from_token(req)
        if err_resp is None and decoded and _is_admin(decoded):
            authorized = True

    if not authorized:
        return https_fn.Response(
            json.dumps({"message": "Unauthorized"}),
            status=401,
            headers={"Content-Type": "application/json"},
        )

    db = firestore.client()

    def _compute_next_attempt(retry_count: int) -> datetime:
        base = 30  # seconds
        # cap individual delay to 1 hour
        delay = min(3600, base * (2 ** max(0, retry_count)))
        jitter = delay * 0.2
        actual = delay - jitter + (random.random() * 2 * jitter)
        return datetime.utcnow() + timedelta(seconds=actual)

    def _send_email(subject: str, body: str, from_email: str) -> tuple[bool, str]:
        try:
            message = Mail(
                from_email=from_email,
                to_emails="aaron@redsracing.org",
                subject=subject,
                plain_text_content=body,
            )
            sg_client = get_sendgrid_client()
            resp = sg_client.send(message)
            if 200 <= resp.status_code < 300:
                return True, "sent"
            return False, f"sendgrid_non_2xx:{resp.status_code}:{resp.body}"
        except Exception as ex:
            try:
                sentry_sdk.capture_exception(ex)
            except Exception:
                pass
            return False, f"exception:{str(ex)}"

    def _process_collection(col_name: str, kind: str):
        coll = db.collection(col_name)
        # Fetch a limited number of queued/retry items ordered by nextAttemptAt
        docs = (
            coll.where("status", "in", ["queued", "retry"]).order_by("nextAttemptAt").limit(50).stream()
        )
        processed = 0
        moved_to_dlq = 0
        for doc in docs:
            d = doc.to_dict() or {}
            retry_count = int(d.get("retryCount", 0))
            # Respect nextAttemptAt backoff window
            try:
                naa = d.get("nextAttemptAt")
                if naa is not None and isinstance(naa, datetime):
                    if naa > datetime.utcnow():
                        continue
            except Exception:
                pass
            try:
                # Build subject/body
                if kind == "feedback":
                    subject = f"Queued Feedback from {d.get('name','Unknown')}"
                    body = (
                        f"Name: {d.get('name','')}\n"
                        f"Email: {d.get('email','')}\n\n"
                        f"Message:\n{d.get('message','')}"
                    )
                    from_email = "feedback@redsracing.org"
                else:
                    subject = f"Queued Sponsorship from {d.get('name','Unknown')}"
                    body = (
                        f"Company: {d.get('company','N/A')}\n"
                        f"Contact Name: {d.get('name','')}\n"
                        f"Email: {d.get('email','')}\n"
                        f"Phone: {d.get('phone','N/A')}\n\n"
                        f"Message:\n{d.get('message','')}"
                    )
                    from_email = "sponsorship@redsracing.org"

                ok, info = _send_email(subject, body, from_email)
                if ok:
                    doc.reference.update({
                        "status": "sent",
                        "sentAt": firestore.SERVER_TIMESTAMP,
                        "lastError": firestore.DELETE_FIELD if hasattr(firestore, 'DELETE_FIELD') else None,
                    })
                else:
                    retry_count += 1
                    if retry_count >= 5:
                        # Move to dead-letter
                        dlq = db.collection("queue_dead_letter")
                        dlq.add({
                            **d,
                            "originalCollection": col_name,
                            "movedAt": firestore.SERVER_TIMESTAMP,
                            "lastError": info,
                            "retryCount": retry_count,
                        })
                        doc.reference.delete()
                        moved_to_dlq += 1
                    else:
                        # Exponential backoff and set next attempt window
                        doc.reference.update({
                            "status": "retry",
                            "retryCount": retry_count,
                            "lastError": info,
                            "updatedAt": firestore.SERVER_TIMESTAMP,
                            "nextAttemptAt": _compute_next_attempt(retry_count),
                        })
                processed += 1
            except Exception as ex2:
                try:
                    sentry_sdk.capture_exception(ex2)
                except Exception:
                    pass
                # mark error but keep queued
                doc.reference.update({
                    "status": "retry",
                    "lastError": f"processor:{str(ex2)}",
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                })
        return processed, moved_to_dlq

    fb_done, fb_dlq = _process_collection("feedback_queue", "feedback")
    sp_done, sp_dlq = _process_collection("sponsorship_queue", "sponsorship")

    return https_fn.Response(
        json.dumps({
            "status": "ok",
            "feedback": {"processed": fb_done, "dead_letter": fb_dlq},
            "sponsorship": {"processed": sp_done, "dead_letter": sp_dlq},
        }),
        status=200,
        headers={"Content-Type": "application/json"},
    )


# ============================================================================
# USER PROFILE AND ACHIEVEMENTS SYSTEM
# ============================================================================


def _get_user_from_token(req):
    """Helper function to extract and verify Firebase Auth token."""
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, https_fn.Response(
            "Missing or invalid Authorization header", status=401
        )

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
        return https_fn.Response(
            "Invalid URL format. Use /profile/<user_id>", status=400
        )

    user_id = path_parts[1]

    try:
        db = firestore.client()

        # Get user profile
        profile_doc = db.collection("users").document(user_id).get()
        if not profile_doc.exists:
            return https_fn.Response("Profile not found", status=404)

        profile_data = profile_doc.to_dict()

        # Get user achievements
        achievements_query = (
            db.collection("user_achievements").where("userId", "==", user_id).stream()
        )
        user_achievements = []

        for ach_doc in achievements_query:
            ach_data = ach_doc.to_dict()
            # Get achievement details
            achievement_ref = db.collection("achievements").document(
                ach_data["achievementId"]
            )
            achievement_doc = achievement_ref.get()
            if achievement_doc.exists:
                achievement_details = achievement_doc.to_dict()
                # Convert dateEarned to Firestore-like format if it's a datetime
                date_earned = ach_data.get("dateEarned")
                achievement_details["dateEarned"] = (
                    ts_to_dict(date_earned) if date_earned else None
                )
                user_achievements.append(achievement_details)

        # Combine profile with achievements
        result = {**profile_data, "achievements": user_achievements}

        return https_fn.Response(
            json.dumps(result, default=ts_to_dict),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


@https_fn.on_request(cors=CORS_OPTIONS)
def handleAuthAction(req: https_fn.Request) -> https_fn.Response:
    """Handle authentication actions."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    action_type = data.get("actionType")
    if not action_type:
        return https_fn.Response("Missing actionType", status=400)

    # This function now only validates that the action type is known
    # and returns a success message. The actual auth logic is on the client.
    known_actions = ["login", "signup", "password_reset", "mfa_setup", "mfa_verify"]
    if action_type not in known_actions:
        return https_fn.Response(f"Unknown action type: {action_type}", status=400)

    response_data = {
        "success": True,
        "message": f"Action '{action_type}' acknowledged.",
    }

    return https_fn.Response(
        json.dumps(response_data),
        status=200,
        headers={"Content-Type": "application/json"},
    )


@https_fn.on_request(cors=CORS_OPTIONS)
def handlePasswordReset(req: https_fn.Request) -> https_fn.Response:
    """Handle password reset requests."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    data = req.get_json(silent=True)
    if not data:
        return https_fn.Response("Invalid request body", status=400)

    email = data.get("email")
    if not email:
        return https_fn.Response("Email is required", status=400)

    # The client-side code handles sending the password reset email.
    # This endpoint now serves as a simple acknowledgment.
    response_data = {"success": True, "message": "Password reset request acknowledged."}

    return https_fn.Response(
        json.dumps(response_data),
        status=200,
        headers={"Content-Type": "application/json"},
    )


@https_fn.on_request(cors=CORS_OPTIONS)
def handleUpdateProfile(req: https_fn.Request) -> https_fn.Response:
    """Update the authenticated user's profile."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "PUT":
        return https_fn.Response("Method not allowed", status=405)

    # Extract user_id from URL path
    path_parts = req.path.strip("/").split("/")
    if len(path_parts) < 2 or path_parts[0] != "update_profile":
        return https_fn.Response(
            "Invalid URL format. Use /update_profile/<user_id>", status=400
        )

    user_id = path_parts[1]

    # Verify authentication
    decoded_token, auth_error = _get_user_from_token(req)
    if auth_error:
        return auth_error

    # Users can only update their own profile
    if decoded_token["uid"] != user_id:
        return https_fn.Response(
            "Forbidden: Can only update your own profile", status=403
        )

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
                    return https_fn.Response(
                        "Username is required and must be a string", status=400
                    )
                # Username validation: alphanumeric and underscores only, 3-30 chars
                username = value.strip().lower()
                if (
                    not username.replace("_", "").isalnum()
                    or len(username) < 3
                    or len(username) > 30
                ):
                    return https_fn.Response(
                        "Username must be 3-30 characters, alphanumeric and underscores only",
                        status=400,
                    )
                profile_data[field] = username

            elif field == "displayName":
                if not isinstance(value, str) or not value.strip():
                    return https_fn.Response(
                        "Display name is required and must be a string", status=400
                    )
                display_name = value.strip()
                if len(display_name) > 100:
                    return https_fn.Response(
                        "Display name must be 100 characters or less", status=400
                    )
                profile_data[field] = display_name

            elif field == "bio":
                if isinstance(value, str):
                    bio = value.strip()
                    if len(bio) > 500:
                        return https_fn.Response(
                            "Bio must be 500 characters or less", status=400
                        )
                    profile_data[field] = bio

            elif field == "avatarUrl":
                if isinstance(value, str):
                    avatar_url = value.strip()
                    if avatar_url:  # Only validate if not empty
                        if not avatar_url.startswith(("http://", "https://")):
                            return https_fn.Response(
                                "Avatar URL must be a valid HTTP/HTTPS URL", status=400
                            )
                        if len(avatar_url) > 500:
                            return https_fn.Response(
                                "Avatar URL must be 500 characters or less", status=400
                            )
                    profile_data[field] = avatar_url

            elif field == "favoriteCars":
                if isinstance(value, list):
                    # Validate each car name
                    validated_cars = []
                    for car in value[:10]:  # Limit to 10 cars
                        if isinstance(car, str):
                            car_name = car.strip()
                            if (
                                car_name and len(car_name) <= 50
                            ):  # Max 50 chars per car name
                                validated_cars.append(car_name)
                    profile_data[field] = validated_cars

    if not profile_data:
        return https_fn.Response("No valid fields provided for update", status=400)

    try:
        db = firestore.client()

        # Add/update timestamp
        profile_data["lastUpdated"] = firestore.SERVER_TIMESTAMP

        # Update profile document
        profile_ref = db.collection("users").document(user_id)
        profile_ref.set(profile_data, merge=True)

        return https_fn.Response("Profile updated successfully", status=200)

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
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

        return https_fn.Response(
            json.dumps(achievements, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

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
        return https_fn.Response(
            "Missing required fields: userId, achievementId", status=400
        )

    try:
        db = firestore.client()

        # Verify achievement exists
        achievement_doc = db.collection("achievements").document(achievement_id).get()
        if not achievement_doc.exists:
            return https_fn.Response("Achievement not found", status=404)

        # Check if user already has this achievement
        existing_query = (
            db.collection("user_achievements")
            .where("userId", "==", user_id)
            .where("achievementId", "==", achievement_id)
            .limit(1)
            .stream()
        )
        if any(existing_query):
            return https_fn.Response("User already has this achievement", status=400)

        # Create user achievement record
        user_achievement_data = {
            "userId": user_id,
            "achievementId": achievement_id,
            "dateEarned": firestore.SERVER_TIMESTAMP,
            "assignedBy": decoded_token["uid"],
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
                user_points[user_id] += achievements_data[achievement_id].get(
                    "points", 0
                )
                user_achievement_counts[user_id] += 1

        # Get user profile data for leaderboard display
        leaderboard = []
        for user_id, total_points in user_points.items():
            try:
                profile_doc = db.collection("users").document(user_id).get()
                if profile_doc.exists:
                    profile_data = profile_doc.to_dict()
                    leaderboard.append(
                        {
                            "userId": user_id,
                            "displayName": profile_data.get(
                                "displayName", "Anonymous User"
                            ),
                            "username": profile_data.get("username", ""),
                            "avatarUrl": profile_data.get("avatarUrl", ""),
                            "totalPoints": total_points,
                            "achievementCount": user_achievement_counts[user_id],
                        }
                    )
            except Exception as e:
                # Skip users with missing profiles
                print(
                    f"Warning: Skipping user {user_id} due to missing profile data: {str(e)}"
                )
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
            headers={"Content-Type": "application/json"},
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
        return https_fn.Response(
            "Missing required fields: userId, actionType", status=400
        )

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
        user_achievements_query = (
            db.collection("user_achievements").where("userId", "==", user_id).stream()
        )
        user_achievement_ids = {
            doc.to_dict()["achievementId"] for doc in user_achievements_query
        }

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
                    "actionType": action_type,
                }

                db.collection("user_achievements").add(user_achievement_data)
                awarded_achievements.append(
                    {
                        "id": achievement_id,
                        "name": achievements[achievement_id]["name"],
                        "description": achievements[achievement_id]["description"],
                        "points": achievements[achievement_id]["points"],
                    }
                )

        return https_fn.Response(
            json.dumps(
                {
                    "awardedAchievements": awarded_achievements,
                    "message": f"Awarded {len(awarded_achievements)} achievement(s)",
                },
                default=str,
            ),
            status=200,
            headers={"Content-Type": "application/json"},
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
        return https_fn.Response(
            "Invalid URL format. Use /achievement_progress/<user_id>", status=400
        )

    user_id = path_parts[1]

    try:
        db = firestore.client()

        # Get user's current achievements
        user_achievements_query = (
            db.collection("user_achievements").where("userId", "==", user_id).stream()
        )
        user_achievement_ids = {
            doc.to_dict()["achievementId"] for doc in user_achievements_query
        }

        # Define progress tracking for specific achievements
        progress_data = {}

        # Photographer achievement progress (upload 5 photos)
        if "photographer" not in user_achievement_ids:
            try:
                photos_query = (
                    db.collection("gallery_images")
                    .where("uploaderUid", "==", user_id)
                    .stream()
                )
                photo_count = sum(1 for _ in photos_query)
                progress_data["photographer"] = {
                    "current": photo_count,
                    "target": 5,
                    "percentage": min((photo_count / 5) * 100, 100),
                    "completed": photo_count >= 5,
                    "description": f"Upload {photo_count}/5 photos to the gallery",
                }
            except Exception as e:
                print(f"Error getting photo count: {e}")

        # Fan Favorite achievement progress (get 10 total likes)
        if "fan_favorite" not in user_achievement_ids:
            try:
                user_photos_query = (
                    db.collection("gallery_images")
                    .where("uploaderUid", "==", user_id)
                    .stream()
                )
                total_likes = 0
                for photo_doc in user_photos_query:
                    photo_data = photo_doc.to_dict()
                    total_likes += photo_data.get("likeCount", 0)

                progress_data["fan_favorite"] = {
                    "current": total_likes,
                    "target": 10,
                    "percentage": min((total_likes / 10) * 100, 100),
                    "completed": total_likes >= 10,
                    "description": f"Receive {total_likes}/10 total likes on your photos",
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
                "description": "Join the RedsRacing community (automatic on login)",
            }

        return https_fn.Response(
            json.dumps(progress_data, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        return https_fn.Response(f"An error occurred: {e}", status=500)


# ============================================================================
# RACE ANALYTICS SYSTEM
# ============================================================================


@https_fn.on_request(cors=CORS_OPTIONS)
def handleAddRaceResult(req: https_fn.Request) -> https_fn.Response:
    """Add a new race result to Firestore (Admin only)."""
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

    # Required fields
    required_fields = ["driverId", "driverName", "raceDate", "trackName", "season"]
    if not all(field in data for field in required_fields):
        return https_fn.Response(f"Missing required fields: {required_fields}", status=400)

    try:
        db = firestore.client()

        race_result = {
            "driverId": data["driverId"],
            "driverName": data["driverName"],
            "carNumber": data.get("carNumber", ""),
            "raceDate": data["raceDate"],
            "trackName": data["trackName"],
            "trackLocation": data.get("trackLocation", ""),
            "season": data["season"],
            "raceType": data.get("raceType", "Feature"),  # Heat, Feature, etc.
            "startPosition": data.get("startPosition"),
            "finishPosition": data.get("finishPosition"),
            "lapTimes": data.get("lapTimes", []),
            "fastestLap": data.get("fastestLap"),
            "points": data.get("points", 0),
            "incidents": data.get("incidents", []),
            "weather": data.get("weather", ""),
            "notes": data.get("notes", ""),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "createdBy": decoded_token["uid"],
        }

        doc_ref = db.collection("race_results").add(race_result)

        return https_fn.Response(
            json.dumps({"message": "Race result added successfully", "id": doc_ref[1].id}),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetRaceAnalytics(req: https_fn.Request) -> https_fn.Response:
    """Get comprehensive race analytics for a driver."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    driver_id = req.args.get("driverId")
    season = req.args.get("season")
    track_name = req.args.get("trackName")

    if not driver_id:
        return https_fn.Response("driverId parameter is required", status=400)

    try:
        db = firestore.client()

        # Build query
        query = db.collection("race_results").where("driverId", "==", driver_id)
        if season:
            query = query.where("season", "==", season)
        if track_name:
            query = query.where("trackName", "==", track_name)

        races = list(query.stream())

        if not races:
            return https_fn.Response(
                json.dumps({"message": "No race data found", "analytics": {}}),
                status=200,
                headers={"Content-Type": "application/json"},
            )

        # Calculate analytics
        finish_positions = []
        start_positions = []
        fastest_laps = []
        points_total = 0
        races_data = []

        for race_doc in races:
            race_data = race_doc.to_dict()
            races_data.append({"id": race_doc.id, **race_data})

            if race_data.get("finishPosition"):
                finish_positions.append(race_data["finishPosition"])
            if race_data.get("startPosition"):
                start_positions.append(race_data["startPosition"])
            if race_data.get("fastestLap"):
                fastest_laps.append(race_data["fastestLap"])
            points_total += race_data.get("points", 0)

        analytics = {
            "driverId": driver_id,
            "totalRaces": len(races),
            "totalPoints": points_total,
            "avgFinishPosition": round(mean(finish_positions), 2) if finish_positions else None,
            "medianFinishPosition": median(finish_positions) if finish_positions else None,
            "bestFinish": min(finish_positions) if finish_positions else None,
            "worstFinish": max(finish_positions) if finish_positions else None,
            "avgStartPosition": round(mean(start_positions), 2) if start_positions else None,
            "avgPositionsGained": (
                round(mean([s - f for s, f in zip(start_positions, finish_positions)]), 2)
                if start_positions and finish_positions and len(start_positions) == len(finish_positions)
                else None
            ),
            "fastestLapTime": min(fastest_laps) if fastest_laps else None,
            "avgLapTime": round(mean(fastest_laps), 2) if fastest_laps else None,
            "races": races_data,
        }

        return https_fn.Response(
            json.dumps(analytics, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


@https_fn.on_request(cors=CORS_OPTIONS)
def handleDriverComparison(req: https_fn.Request) -> https_fn.Response:
    """Compare two drivers' performance."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    driver1_id = req.args.get("driver1Id")
    driver2_id = req.args.get("driver2Id")
    season = req.args.get("season")

    if not driver1_id or not driver2_id:
        return https_fn.Response("Both driver1Id and driver2Id are required", status=400)

    try:
        db = firestore.client()

        # Get analytics for both drivers
        def get_driver_stats(driver_id):
            query = db.collection("race_results").where("driverId", "==", driver_id)
            if season:
                query = query.where("season", "==", season)

            races = list(query.stream())
            if not races:
                return None

            finish_positions = []
            points_total = 0
            fastest_laps = []

            for race_doc in races:
                race_data = race_doc.to_dict()
                if race_data.get("finishPosition"):
                    finish_positions.append(race_data["finishPosition"])
                points_total += race_data.get("points", 0)
                if race_data.get("fastestLap"):
                    fastest_laps.append(race_data["fastestLap"])

            return {
                "driverId": driver_id,
                "driverName": races[0].to_dict().get("driverName", "Unknown"),
                "totalRaces": len(races),
                "totalPoints": points_total,
                "avgFinishPosition": round(mean(finish_positions), 2) if finish_positions else None,
                "bestFinish": min(finish_positions) if finish_positions else None,
                "worstFinish": max(finish_positions) if finish_positions else None,
                "fastestLapTime": min(fastest_laps) if fastest_laps else None,
            }

        driver1_stats = get_driver_stats(driver1_id)
        driver2_stats = get_driver_stats(driver2_id)

        if not driver1_stats or not driver2_stats:
            return https_fn.Response(
                json.dumps({"message": "Insufficient data for comparison"}),
                status=200,
                headers={"Content-Type": "application/json"},
            )

        comparison = {
            "driver1": driver1_stats,
            "driver2": driver2_stats,
            "winner": {
                "avgFinish": driver1_stats["driverId"] if (driver1_stats.get("avgFinishPosition") or 999) < (driver2_stats.get("avgFinishPosition") or 999) else driver2_stats["driverId"],
                "totalPoints": driver1_stats["driverId"] if driver1_stats["totalPoints"] > driver2_stats["totalPoints"] else driver2_stats["driverId"],
                "bestFinish": driver1_stats["driverId"] if (driver1_stats.get("bestFinish") or 999) < (driver2_stats.get("bestFinish") or 999) else driver2_stats["driverId"],
            },
        }

        return https_fn.Response(
            json.dumps(comparison, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetTrackRecords(req: https_fn.Request) -> https_fn.Response:
    """Get track records across all drivers."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    track_name = req.args.get("trackName")
    season = req.args.get("season")

    try:
        db = firestore.client()

        query = db.collection("race_results")
        if track_name:
            query = query.where("trackName", "==", track_name)
        if season:
            query = query.where("season", "==", season)

        races = list(query.stream())

        if not races:
            return https_fn.Response(
                json.dumps({"message": "No race data found"}),
                status=200,
                headers={"Content-Type": "application/json"},
            )

        # Find records
        fastest_lap_record = None
        best_finish_record = None

        for race_doc in races:
            race_data = race_doc.to_dict()

            # Fastest lap
            if race_data.get("fastestLap"):
                if not fastest_lap_record or race_data["fastestLap"] < fastest_lap_record["fastestLap"]:
                    fastest_lap_record = {
                        "driverName": race_data.get("driverName"),
                        "fastestLap": race_data["fastestLap"],
                        "raceDate": race_data.get("raceDate"),
                        "trackName": race_data.get("trackName"),
                    }

            # Best finish
            if race_data.get("finishPosition") == 1:
                if not best_finish_record:
                    best_finish_record = {
                        "driverName": race_data.get("driverName"),
                        "raceDate": race_data.get("raceDate"),
                        "trackName": race_data.get("trackName"),
                    }

        records = {
            "trackName": track_name,
            "season": season,
            "fastestLapRecord": fastest_lap_record,
            "bestFinishRecord": best_finish_record,
            "totalRaces": len(races),
        }

        return https_fn.Response(
            json.dumps(records, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


@https_fn.on_request(cors=CORS_OPTIONS)
def handleGetSeasonStandings(req: https_fn.Request) -> https_fn.Response:
    """Get season standings sorted by points."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    season = req.args.get("season", "2025")

    try:
        db = firestore.client()

        races = db.collection("race_results").where("season", "==", season).stream()

        # Aggregate points by driver
        driver_standings = {}

        for race_doc in races:
            race_data = race_doc.to_dict()
            driver_id = race_data.get("driverId")
            driver_name = race_data.get("driverName")
            points = race_data.get("points", 0)

            if driver_id not in driver_standings:
                driver_standings[driver_id] = {
                    "driverId": driver_id,
                    "driverName": driver_name,
                    "carNumber": race_data.get("carNumber", ""),
                    "totalPoints": 0,
                    "racesEntered": 0,
                    "wins": 0,
                    "top5s": 0,
                }

            driver_standings[driver_id]["totalPoints"] += points
            driver_standings[driver_id]["racesEntered"] += 1

            finish_pos = race_data.get("finishPosition")
            if finish_pos == 1:
                driver_standings[driver_id]["wins"] += 1
            if finish_pos and finish_pos <= 5:
                driver_standings[driver_id]["top5s"] += 1

        # Sort by points
        standings_list = sorted(
            driver_standings.values(), key=lambda x: x["totalPoints"], reverse=True
        )

        # Add position numbers
        for i, driver in enumerate(standings_list):
            driver["position"] = i + 1

        return https_fn.Response(
            json.dumps({"season": season, "standings": standings_list}, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


# ============================================================================
# PHOTO MANAGEMENT SYSTEM
# ============================================================================


@https_fn.on_request(cors=CORS_OPTIONS)
def handlePhotoProcess(req: https_fn.Request) -> https_fn.Response:
    """Process uploaded photo: resize, generate thumbnails, extract EXIF."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "POST":
        return https_fn.Response("Method not allowed", status=405)

    # Verify authentication
    decoded_token, auth_error = _get_user_from_token(req)
    if auth_error:
        return auth_error

    data = req.get_json(silent=True)
    if not data or "imageUrl" not in data:
        return https_fn.Response("imageUrl is required", status=400)

    image_url = data["imageUrl"]

    try:
        # Download image from URL
        import requests as http_requests
        response = http_requests.get(image_url, timeout=30)
        response.raise_for_status()
        image_data = response.content

        # Open image with Pillow
        img = Image.open(io.BytesIO(image_data))

        # Extract EXIF data
        exif_data = {}
        try:
            exif_dict = piexif.load(image_data)
            if piexif.ExifIFD.DateTimeOriginal in exif_dict.get("Exif", {}):
                date_taken = exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal].decode("utf-8")
                exif_data["dateTaken"] = date_taken
            if piexif.GPSIFD.GPSLatitude in exif_dict.get("GPS", {}):
                exif_data["hasGPS"] = True
        except Exception:
            pass

        # Generate sizes
        sizes = {
            "original": {"width": img.width, "height": img.height},
            "large": self._resize_image(img, 1920),
            "medium": self._resize_image(img, 1024),
            "small": self._resize_image(img, 640),
            "thumbnail": self._resize_image(img, 320),
        }

        # Get image info
        image_info = {
            "format": img.format,
            "mode": img.mode,
            "sizes": sizes,
            "exif": exif_data,
            "fileSize": len(image_data),
        }

        return https_fn.Response(
            json.dumps(image_info),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)


def _resize_image(img: Image.Image, max_size: int) -> dict:
    """Resize image maintaining aspect ratio."""
    aspect = img.width / img.height
    if img.width > img.height:
        new_width = min(max_size, img.width)
        new_height = int(new_width / aspect)
    else:
        new_height = min(max_size, img.height)
        new_width = int(new_height * aspect)
    return {"width": new_width, "height": new_height}


@https_fn.on_request(cors=CORS_OPTIONS)
def handlePhotoSort(req: https_fn.Request) -> https_fn.Response:
    """Sort and organize photos by date, track, or driver."""
    if req.method == "OPTIONS":
        return https_fn.Response("", status=204)
    if req.method != "GET":
        return https_fn.Response("Method not allowed", status=405)

    sort_by = req.args.get("sortBy", "date")  # date, track, driver
    driver_id = req.args.get("driverId")
    track_name = req.args.get("trackName")
    start_date = req.args.get("startDate")
    end_date = req.args.get("endDate")

    try:
        db = firestore.client()

        query = db.collection("gallery_images")

        if driver_id:
            query = query.where("driverId", "==", driver_id)
        if track_name:
            query = query.where("trackName", "==", track_name)

        photos = list(query.stream())

        # Convert to list with IDs
        photos_data = [{"id": doc.id, **doc.to_dict()} for doc in photos]

        # Filter by date range if provided
        if start_date or end_date:
            filtered_photos = []
            for photo in photos_data:
                photo_date = photo.get("uploadedAt") or photo.get("dateTaken")
                if photo_date:
                    if start_date and photo_date < start_date:
                        continue
                    if end_date and photo_date > end_date:
                        continue
                filtered_photos.append(photo)
            photos_data = filtered_photos

        # Sort photos
        if sort_by == "date":
            photos_data.sort(
                key=lambda x: x.get("uploadedAt") or x.get("dateTaken") or "",
                reverse=True,
            )
        elif sort_by == "track":
            photos_data.sort(key=lambda x: x.get("trackName", ""))
        elif sort_by == "driver":
            photos_data.sort(key=lambda x: x.get("driverName", ""))
        elif sort_by == "likes":
            photos_data.sort(key=lambda x: x.get("likeCount", 0), reverse=True)

        # Group if needed
        grouped = {}
        if sort_by == "track":
            for photo in photos_data:
                track = photo.get("trackName", "Unknown")
                if track not in grouped:
                    grouped[track] = []
                grouped[track].append(photo)
        elif sort_by == "driver":
            for photo in photos_data:
                driver = photo.get("driverName", "Unknown")
                if driver not in grouped:
                    grouped[driver] = []
                grouped[driver].append(photo)

        result = {
            "photos": photos_data,
            "totalCount": len(photos_data),
            "sortedBy": sort_by,
        }

        if grouped:
            result["grouped"] = grouped

        return https_fn.Response(
            json.dumps(result, default=str),
            status=200,
            headers={"Content-Type": "application/json"},
        )

    except Exception as e:
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return https_fn.Response(f"An error occurred: {e}", status=500)
