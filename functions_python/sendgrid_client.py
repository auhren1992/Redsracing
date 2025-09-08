import os
from typing import List, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, ReplyTo

class SendGridEmailClient:
    """Minimal wrapper around SendGrid for sending plain text (and optional HTML) emails."""
    def __init__(self, api_key: Optional[str] = None, default_from: Optional[str] = None):
        api_key = api_key or os.environ.get("SENDGRID_API_KEY")
        if not api_key:
            raise ValueError("SENDGRID_API_KEY is not set.")
        self.sg = SendGridAPIClient(api_key)
        self.default_from = default_from

    def send_email(
        self,
        subject: str,
        text: str,
        to_emails: List[str],
        from_email: Optional[str] = None,
        html: Optional[str] = None,
        reply_to: Optional[str] = None,
    ):
        if not to_emails:
            raise ValueError("At least one recipient is required.")
        from_addr = from_email or self.default_from
        if not from_addr:
            raise ValueError("A from_email must be provided or configured as default_from.")
        tos = [To(email=addr) for addr in to_emails]
        content_parts = [Content(mime_type="text/plain", content=text)]
        if html:
            content_parts.append(Content(mime_type="text/html", content=html))
        message = Mail(
            from_email=Email(from_addr),
            subject=subject,
            to_emails=tos,
        )
        for c in content_parts:
            message.add_content(c)
        if reply_to:
            message.reply_to = ReplyTo(reply_to)
        response = self.sg.send(message)
        if response.status_code >= 400:
            raise RuntimeError(f"SendGrid error {response.status_code}: {response.body}")
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
        }