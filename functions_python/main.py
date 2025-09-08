import os
import json
from datetime import datetime
from flask import Request
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
import sendgrid
from sendgrid.helpers.mail import Mail

# Initialize Firebase Admin SDK
initialize_app()

# Initialize Firestore
db = firestore.client()

@https_fn.on_request()
def handleAddSubscriber(req: Request) -> dict:
    """
    Handles email subscription requests.
    Stores subscriber email in Firestore and returns success/error response.
    """
    # Enable CORS
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    try:
        # Parse request data
        if req.method != 'POST':
            return (json.dumps({'error': 'Method not allowed'}), 405, headers)
        
        request_json = req.get_json(silent=True)
        if not request_json or 'email' not in request_json:
            return (json.dumps({'error': 'Email is required'}), 400, headers)
        
        email = request_json['email']
        
        # Validate email format (basic validation)
        if '@' not in email or '.' not in email:
            return (json.dumps({'error': 'Invalid email format'}), 400, headers)
        
        # Check if email already exists
        subscribers_ref = db.collection('subscribers')
        existing = subscribers_ref.where('email', '==', email).limit(1).get()
        
        if len(existing) > 0:
            return (json.dumps({'message': 'Already subscribed!'}), 200, headers)
        
        # Add new subscriber
        subscriber_data = {
            'email': email,
            'subscribedAt': datetime.utcnow(),
            'active': True
        }
        
        subscribers_ref.add(subscriber_data)
        
        return (json.dumps({'message': 'Successfully subscribed!'}), 200, headers)
        
    except Exception as e:
        print(f"Error in handleAddSubscriber: {str(e)}")
        return (json.dumps({'error': 'Internal server error'}), 500, headers)


@https_fn.on_request()
def handleSendFeedback(req: Request) -> dict:
    """
    Handles feedback form submissions.
    Sends email via SendGrid and returns success/error response.
    """
    # Enable CORS
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    try:
        # Parse request data
        if req.method != 'POST':
            return (json.dumps({'error': 'Method not allowed'}), 405, headers)
        
        request_json = req.get_json(silent=True)
        if not request_json:
            return (json.dumps({'error': 'Invalid JSON data'}), 400, headers)
        
        # Validate required fields
        required_fields = ['name', 'email', 'message']
        for field in required_fields:
            if field not in request_json or not request_json[field]:
                return (json.dumps({'error': f'{field} is required'}), 400, headers)
        
        name = request_json['name']
        email = request_json['email']
        message = request_json['message']
        
        # Get SendGrid API key from environment
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
            print("SendGrid API key not configured")
            return (json.dumps({'error': 'Email service not configured'}), 500, headers)
        
        # Create email
        sg = sendgrid.SendGridAPIClient(api_key=sendgrid_api_key)
        
        # Email content
        subject = f"Feedback from {name}"
        html_content = f"""
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> {name}</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Message:</strong></p>
        <p>{message}</p>
        <hr>
        <p><em>Sent from RedsRacing website feedback form</em></p>
        """
        
        # Create mail object
        mail = Mail(
            from_email='noreply@redsracing.com',  # This should be a verified sender in SendGrid
            to_emails='info@redsracing.com',      # Recipient email
            subject=subject,
            html_content=html_content
        )
        
        # Send email
        response = sg.send(mail)
        
        # Log to Firestore for record keeping
        feedback_data = {
            'name': name,
            'email': email,
            'message': message,
            'submittedAt': datetime.utcnow(),
            'emailSent': True,
            'sendgridResponse': response.status_code
        }
        
        db.collection('feedback').add(feedback_data)
        
        return (json.dumps({'message': 'Feedback sent successfully!'}), 200, headers)
        
    except Exception as e:
        print(f"Error in handleSendFeedback: {str(e)}")
        return (json.dumps({'error': 'Failed to send feedback'}), 500, headers)


@https_fn.on_request()
def handleSendSponsorship(req: Request) -> dict:
    """
    Handles sponsorship inquiry form submissions.
    Sends email via SendGrid and returns success/error response.
    """
    # Enable CORS
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    try:
        # Parse request data
        if req.method != 'POST':
            return (json.dumps({'error': 'Method not allowed'}), 405, headers)
        
        request_json = req.get_json(silent=True)
        if not request_json:
            return (json.dumps({'error': 'Invalid JSON data'}), 400, headers)
        
        # Validate required fields
        required_fields = ['companyName', 'contactName', 'email', 'message']
        for field in required_fields:
            if field not in request_json or not request_json[field]:
                return (json.dumps({'error': f'{field} is required'}), 400, headers)
        
        company_name = request_json['companyName']
        contact_name = request_json['contactName']
        email = request_json['email']
        phone = request_json.get('phone', 'Not provided')
        message = request_json['message']
        
        # Get SendGrid API key from environment
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
            print("SendGrid API key not configured")
            return (json.dumps({'error': 'Email service not configured'}), 500, headers)
        
        # Create email
        sg = sendgrid.SendGridAPIClient(api_key=sendgrid_api_key)
        
        # Email content
        subject = f"Sponsorship Inquiry from {company_name}"
        html_content = f"""
        <h2>New Sponsorship Inquiry</h2>
        <p><strong>Company:</strong> {company_name}</p>
        <p><strong>Contact:</strong> {contact_name}</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Phone:</strong> {phone}</p>
        <p><strong>Message:</strong></p>
        <p>{message}</p>
        <hr>
        <p><em>Sent from RedsRacing website sponsorship form</em></p>
        """
        
        # Create mail object
        mail = Mail(
            from_email='noreply@redsracing.com',  # This should be a verified sender in SendGrid
            to_emails='sponsorship@redsracing.com',  # Sponsorship-specific email
            subject=subject,
            html_content=html_content
        )
        
        # Send email
        response = sg.send(mail)
        
        # Log to Firestore for record keeping
        sponsorship_data = {
            'companyName': company_name,
            'contactName': contact_name,
            'email': email,
            'phone': phone,
            'message': message,
            'submittedAt': datetime.utcnow(),
            'emailSent': True,
            'sendgridResponse': response.status_code
        }
        
        db.collection('sponsorship_inquiries').add(sponsorship_data)
        
        return (json.dumps({'message': 'Sponsorship inquiry sent successfully!'}), 200, headers)
        
    except Exception as e:
        print(f"Error in handleSendSponsorship: {str(e)}")
        return (json.dumps({'error': 'Failed to send sponsorship inquiry'}), 500, headers)