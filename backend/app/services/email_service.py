import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

def _load_env():
    # Resolve absolute path to backend/.env regardless of CWD
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
    env_path = os.path.join(backend_dir, ".env")
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        load_dotenv(override=True)

class EmailService:
    """
    Service responsible for sending real email notifications via SMTP / Email Relay.
    Supports environment configuration for Gmail, SendGrid, Mailtrap, or custom SMTP servers.
    """
    def __init__(self):
        _load_env()
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_pass = os.getenv("SMTP_PASSWORD", "")
        self.sender_email = os.getenv("SENDER_EMAIL", self.smtp_user or "noreply@agenthire.ai")
        self.sender_name = os.getenv("SENDER_NAME", "AgentHire Talent Acquisition")

    def send_email(self, to_email: str, subject: str, body: str) -> Dict[str, Any]:
        """
        Dispatches an email to the candidate via SMTP.
        If SMTP credentials are not configured, logs the email safely.
        """
        if not to_email:
            raise ValueError("Candidate email address is required")

        _load_env()
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASSWORD", "")
        sender_email = os.getenv("SENDER_EMAIL") or smtp_user or "noreply@agenthire.ai"
        sender_name = os.getenv("SENDER_NAME", "AgentHire Talent Acquisition")

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach text body
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if not smtp_user or not smtp_pass:
            logger.warning(
                f"[EmailService] SMTP credentials not set (SMTP_USER/SMTP_PASSWORD). "
                f"Email to '{to_email}' simulated successfully.\nSubject: {subject}\nBody: {body[:100]}..."
            )
            return {
                "success": True,
                "simulated": True,
                "message": f"Email logged for {to_email} (Simulated Mode). Please add SMTP_USER and SMTP_PASSWORD to backend/.env to send real emails to your Gmail/Inbox."
            }

        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(sender_email, [to_email], msg.as_string())

            logger.info(f"[EmailService] Real email successfully sent to {to_email}")
            return {
                "success": True,
                "simulated": False,
                "message": f"Email successfully dispatched to {to_email}"
            }
        except Exception as e:
            logger.error(f"[EmailService] Failed to send email via SMTP: {e}")
            return {
                "success": False,
                "simulated": False,
                "error": str(e),
                "message": f"SMTP dispatch failed: {str(e)}"
            }

_email_service_instance = None

def get_email_service() -> EmailService:
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance
