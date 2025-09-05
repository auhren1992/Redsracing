# main.py for Python Cloud Functions

import firebase_admin
from firebase_admin import firestore, auth
from firebase_functions import https_fn, storage_fn
from google.cloud import vision
import datetime
import pytz
import urllib.parse

# The Firebase Admin SDK is initialized automatically by the Cloud Functions runtime.
# Calling initialize_app() without arguments is sufficient.
firebase_admin.initialize_app()

@https_fn.on_call(region="us-central1")
def process_invitation_code(req: https_fn.CallableRequest) -> https_fn.Response:
    """
    Processes an invitation code upon user signup, assigning a custom role.

    This function validates an invitation code provided by a user, assigns the
    corresponding role via custom claims, and updates the user's public profile.

    Args:
        req: The request object, containing authentication info and data.
             - req.data['code']: The invitation code.
             - req.data['uid']: The UID of the user.

    Returns:
        A dictionary with the status and a message.

    Raises:
        HttpsError: If the user is unauthenticated, or if required data is missing.
    """
    # 1. Check for authentication
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called by an authenticated user."
        )

    uid = req.data.get("uid")
    code = req.data.get("code")

    # 2. Validate input data
    if not uid or not code:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="The function requires a 'code' and 'uid' to be provided."
        )

    db = firestore.client()

    try:
        # 3. Retrieve the invitation code from Firestore
        code_ref = db.collection("invitation_codes").document(code)
        code_doc = code_ref.get()

        if not code_doc.exists:
            # If the code is invalid, assign a default role to prevent a broken state.
            auth.set_custom_user_claims(uid, {"role": "public-fan"})
            return {"status": "error", "message": "Invalid invitation code."}

        code_data = code_doc.to_dict()

        # 4. Check code validity (expiration and uses)
        now = datetime.datetime.now(pytz.utc)
        if "expiresAt" in code_data and code_data["expiresAt"] < now:
            return {"status": "error", "message": "This invitation code has expired."}

        if "usesLeft" in code_data and code_data.get("usesLeft", 0) <= 0:
            return {"status": "error", "message": "This invitation code has no uses left."}

        # 5. Assign the custom role to the user
        role_to_assign = code_data.get("role", "public-fan")
        auth.set_custom_user_claims(uid, {"role": role_to_assign})

        # 6. Atomically update the invitation code document
        update_payload = {
            "usersWhoClaimed": firestore.ArrayUnion([{"uid": uid, "claimedAt": firestore.SERVER_TIMESTAMP}])
        }
        if "usesLeft" in code_data:
            update_payload["usesLeft"] = firestore.Increment(-1)

        code_ref.update(update_payload)

        # 7. Update the user's public profile for client-side access
        db.collection("users").document(uid).set({"role": role_to_assign}, merge=True)

        return {"status": "success", "message": f"Role '{role_to_assign}' assigned successfully."}

    except Exception as e:
        # In a production app, you would log the error `e` here.
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while processing the invitation code."
        )


@storage_fn.on_object_finalized(
    region="us-central1",
    bucket="redsracing-a7f8b.firebasestorage.app",
    cpu=2,
    memory=1024,  # 1GiB
    timeout_sec=300,
)
def generate_tags(event: storage_fn.CloudEvent) -> None:
    """
    Analyzes an image uploaded to Cloud Storage and generates descriptive tags.

    This function is triggered when a new image is finalized in the 'gallery/'
    path of the specified Cloud Storage bucket. It uses the Google Cloud Vision
    API to detect labels and saves them to a corresponding Firestore document.
    """
    bucket_name = event.data.bucket
    file_path = event.data.name
    content_type = event.data.content_type

    # 1. Validate the uploaded file to ensure it's a gallery image
    if not content_type or not content_type.startswith("image/"):
        print(f"File {file_path} is not an image. Skipping.")
        return

    if not file_path.startswith("gallery/"):
        print(f"File {file_path} is not a gallery image. Skipping.")
        return

    # 2. Initialize clients and prepare the request for the Vision API
    vision_client = vision.ImageAnnotatorClient()
    db = firestore.client()
    gcs_uri = f"gs://{bucket_name}/{file_path}"
    image = vision.Image(source=vision.ImageSource(image_uri=gcs_uri))

    try:
        # 3. Call the Vision API for label detection
        response = vision_client.label_detection(image=image)
        labels = response.label_annotations

        if not labels:
            print(f"No labels found for image {file_path}.")
            return

        # 4. Process the results into a list of lowercase tags
        tags = [label.description.lower() for label in labels]
        print(f"Generated tags for {file_path}: {tags}")

        # 5. Find the corresponding Firestore document via its download URL.
        # This approach mirrors the logic from the original Node.js function.
        encoded_path = urllib.parse.quote(file_path, safe='')
        download_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{encoded_path}?alt=media"

        gallery_ref = db.collection("gallery_images")
        query = gallery_ref.where("imageUrl", "==", download_url).limit(1)
        docs = list(query.stream())

        if not docs:
            print(f"Error: No Firestore document found for image URL: {download_url}")
            return

        # 6. Update the Firestore document with the new tags and processed status
        image_doc_ref = docs[0].reference
        vision_api_results = [
            {"description": label.description, "score": label.score, "topicality": label.topicality}
            for label in labels
        ]
        image_doc_ref.update({
            "tags": tags,
            "processed": True,
            "visionApiResults": vision_api_results,
        })

        print(f"Successfully updated Firestore document {image_doc_ref.id} with tags.")

    except Exception as e:
        print(f"Failed to analyze image {file_path}. Error: {e}")


# ------------------ Admin-only Functions for Race Management ------------------

def _check_admin_role(req: https_fn.CallableRequest):
    """Helper function to ensure a user is an authenticated admin."""
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="The function must be called by an authenticated user."
        )
    if req.auth.token.get("role") != "admin":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="This action requires administrator privileges."
        )

@https_fn.on_call(region="us-central1")
def create_race(req: https_fn.CallableRequest) -> https_fn.Response:
    """
    Creates a new race event in the 'races' collection.
    Requires admin privileges.
    """
    _check_admin_role(req)

    data = req.data
    required_fields = ["trackName", "raceDate", "series", "laps"]
    if not all(field in data for field in required_fields):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing required fields for race creation."
        )

    try:
        db = firestore.client()
        # The raceDate will likely come as an ISO 8601 string from the client.
        # Firestore client library can handle converting this to a Timestamp.
        new_race_ref = db.collection("races").add({
            "trackName": data["trackName"],
            "raceDate": data["raceDate"],
            "series": data["series"],
            "laps": int(data["laps"]),
            "isComplete": False,
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        # The 'add' method returns a tuple (timestamp, reference)
        race_id = new_race_ref[1].id
        print(f"Admin user {req.auth.uid} created race {race_id}.")
        return {"status": "success", "raceId": race_id}

    except Exception as e:
        print(f"Error creating race: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while creating the race."
        )


@https_fn.on_call(region="us-central1")
def update_race(req: https_fn.CallableRequest) -> https_fn.Response:
    """
    Updates an existing race event document.
    Requires admin privileges.
    """
    _check_admin_role(req)

    data = req.data
    race_id = data.get("raceId")
    update_payload = data.get("payload")

    if not race_id or not isinstance(update_payload, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Request must include a 'raceId' and a 'payload' object."
        )

    try:
        db = firestore.client()
        # For security, you might want to sanitize the payload here
        # to prevent certain fields from being updated (e.g., 'createdAt').
        db.collection("races").document(race_id).update(update_payload)

        print(f"Admin user {req.auth.uid} updated race {race_id}.")
        return {"status": "success", "message": f"Race {race_id} updated successfully."}

    except Exception as e:
        print(f"Error updating race {race_id}: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while updating the race."
        )


@https_fn.on_call(region="us-central1")
def post_results(req: https_fn.CallableRequest) -> https_fn.Response:
    """
    Posts the results for a given race, adding them to the 'results'
    subcollection and marking the race as complete.
    Requires admin privileges.
    """
    _check_admin_role(req)

    data = req.data
    race_id = data.get("raceId")
    results_list = data.get("results")

    if not race_id or not isinstance(results_list, list) or not results_list:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Request must include a 'raceId' and a non-empty 'results' array."
        )

    try:
        db = firestore.client()
        batch = db.batch()

        race_ref = db.collection("races").document(race_id)

        # Add each result to the batch
        for result in results_list:
            required_keys = ["driverUid", "driverName", "finishPosition", "pointsEarned"]
            if not all(k in result for k in required_keys):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                    message="Each result object is missing required fields."
                )

            # The document ID for each result will be the driver's UID
            result_ref = race_ref.collection("results").document(result["driverUid"])
            batch.set(result_ref, {
                "driverName": result["driverName"],
                "startPosition": result.get("startPosition"), # Optional field
                "finishPosition": result["finishPosition"],
                "pointsEarned": result["pointsEarned"]
            })

        # Mark the race as complete in the same batch
        batch.update(race_ref, {"isComplete": True})

        # Commit the atomic operation
        batch.commit()

        print(f"Admin user {req.auth.uid} posted results for race {race_id}.")
        return {"status": "success", "message": f"Results for race {race_id} posted successfully."}

    except Exception as e:
        print(f"Error posting results for race {race_id}: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while posting results."
        )


# ------------------ Admin-only Function for Announcements ------------------

@https_fn.on_call(region="us-central1")
def create_announcement(req: https_fn.CallableRequest) -> https_fn.Response:
    """
    Creates a new announcement in the 'announcements' collection.
    Requires admin privileges.
    """
    _check_admin_role(req)

    data = req.data
    title = data.get("title")
    content = data.get("content")

    if not title or not content:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Request must include a 'title' and 'content'."
        )

    try:
        db = firestore.client()

        # Get the admin's display name or email to store as the author
        author_name = req.auth.token.get("name", req.auth.token.get("email", "Admin"))

        new_announcement_ref = db.collection("announcements").add({
            "title": title,
            "content": content,
            "author": author_name,
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        announcement_id = new_announcement_ref[1].id
        print(f"Admin user {req.auth.uid} created announcement {announcement_id}.")
        return {"status": "success", "announcementId": announcement_id}

    except Exception as e:
        print(f"Error creating announcement: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while creating the announcement."
        )
