"""
reCAPTCHA Enterprise Account Defender Service
Provides assessment creation, evaluation, and annotation functionality.
"""

import os
import logging
from typing import Dict, Optional, List, Any
from google.cloud import recaptchaenterprise_v1
from google.cloud.recaptchaenterprise_v1 import Assessment

# Configure logging
logger = logging.getLogger(__name__)

class RecaptchaService:
    """reCAPTCHA Enterprise Account Defender service for user action protection."""
    
    def __init__(self):
        """Initialize the reCAPTCHA Enterprise client."""
        self.client = None
        self.project_id = os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "redsracing-a7f8b")
        self.site_key = os.environ.get("RECAPTCHA_SITE_KEY")
        
        # Risk score thresholds for decision making
        self.RISK_THRESHOLDS = {
            "ALLOW": 0.7,    # Above 0.7 is considered safe
            "CHALLENGE": 0.3, # Between 0.3-0.7 requires additional verification
            "BLOCK": 0.3     # Below 0.3 is considered risky
        }
    
    def _get_client(self):
        """Get or initialize the reCAPTCHA Enterprise client."""
        if self.client is None:
            try:
                self.client = recaptchaenterprise_v1.RecaptchaEnterpriseServiceClient()
            except Exception as e:
                logger.error(f"Failed to initialize reCAPTCHA Enterprise client: {e}")
                raise
        return self.client
    
    # TODO: Refactor this method to reduce complexity and improve readability.
        self,
        token: str,
        action: str,
        user_ip: str,
        user_agent: str,
        user_id: Optional[str] = None,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a reCAPTCHA Enterprise assessment for user action.
        
        Args:
            token: reCAPTCHA token from frontend
            action: Action name (LOGIN, REGISTRATION, PASSWORD_RESET, etc.)
            user_ip: User's IP address
            user_agent: User's browser user agent
            user_id: Internal user ID (if available)
            email: User's email address
            
        Returns:
            Assessment result with risk analysis and recommendations
        """
        try:
            if not self.site_key:
                logger.warning("RECAPTCHA_SITE_KEY not configured, skipping assessment")
                return self._create_fallback_result("ALLOW", "reCAPTCHA not configured")
            
            client = self._get_client()
            project_path = f"projects/{self.project_id}"
            
            # Build the assessment request
            event = recaptchaenterprise_v1.Event(
                token=token,
                site_key=self.site_key,
                expected_action=action,
                user_ip_address=user_ip,
                user_agent=user_agent
            )
            
            # Add user information if available
            if user_id or email:
                user_info = recaptchaenterprise_v1.UserInfo()
                if user_id:
                    user_info.account_id = user_id
                    user_info.user_ids = [user_id]
                if email:
                    user_info.user_ids = user_info.user_ids + [email] if user_info.user_ids else [email]
                event.user_info = user_info
            
            assessment = recaptchaenterprise_v1.Assessment(event=event)
            request = recaptchaenterprise_v1.CreateAssessmentRequest(
                parent=project_path,
                assessment=assessment
            )
            
            # Create the assessment
            response = client.create_assessment(request=request)
            
            # Extract assessment results
            return self._process_assessment_response(response, action)
            
        except Exception as e:
            logger.error(f"reCAPTCHA assessment failed for action {action}: {e}")
            # Return safe fallback on error
            return self._create_fallback_result("ALLOW", f"Assessment error: {str(e)}")
    
    def _process_assessment_response(self, response: Assessment, action: str) -> Dict[str, Any]:
        """Process the reCAPTCHA assessment response."""
        try:
            # Check token validity
            token_properties = response.token_properties
            if not token_properties.valid:
                logger.warning(f"Invalid reCAPTCHA token for action {action}: {token_properties.invalid_reason}")
                return self._create_fallback_result("BLOCK", "Invalid token")
            
            # Check action match
            if token_properties.action != action:
                logger.warning(f"Action mismatch. Expected: {action}, Got: {token_properties.action}")
                return self._create_fallback_result("BLOCK", "Action mismatch")
            
            # Get risk analysis
            risk_analysis = response.risk_analysis
            score = risk_analysis.score if risk_analysis else 0.5
            
            # Get Account Defender labels if available
            account_defender_labels = []
            if hasattr(response, 'account_defender_assessment') and response.account_defender_assessment:
                account_defender_labels = list(response.account_defender_assessment.labels)
            
            # Determine action based on score and labels
            decision = self._make_decision(score, account_defender_labels)
            
            return {
                "success": True,
                "decision": decision,
                "score": score,
                "valid_token": token_properties.valid,
                "action_match": token_properties.action == action,
                "account_defender_labels": account_defender_labels,
                "assessment_name": response.name,
                "reasons": self._get_decision_reasons(score, account_defender_labels)
            }
            
        except Exception as e:
            logger.error(f"Error processing assessment response: {e}")
            return self._create_fallback_result("ALLOW", f"Processing error: {str(e)}")
    
    def _make_decision(self, score: float, labels: List[str]) -> str:
        """Make a decision based on risk score and Account Defender labels."""
        # Check for explicit Account Defender labels first
        if "FRAUDULENT_ACCOUNT" in labels or "SUSPICIOUS_ACCOUNT_CREATION" in labels:
            return "BLOCK"
        
        if "LEGITIMATE_ACCOUNT" in labels:
            return "ALLOW"
        
        # Fall back to score-based decision
        if score >= self.RISK_THRESHOLDS["ALLOW"]:
            return "ALLOW"
        elif score >= self.RISK_THRESHOLDS["CHALLENGE"]:
            return "CHALLENGE"
        else:
            return "BLOCK"
    
    def _get_decision_reasons(self, score: float, labels: List[str]) -> List[str]:
        """Get human-readable reasons for the decision."""
        reasons = []
        
        if score < self.RISK_THRESHOLDS["BLOCK"]:
            reasons.append(f"Low risk score: {score:.2f}")
        elif score < self.RISK_THRESHOLDS["ALLOW"]:
            reasons.append(f"Medium risk score: {score:.2f}")
        else:
            reasons.append(f"High risk score: {score:.2f}")
        
        for label in labels:
            if label == "FRAUDULENT_ACCOUNT":
                reasons.append("Account flagged as fraudulent")
            elif label == "SUSPICIOUS_ACCOUNT_CREATION":
                reasons.append("Suspicious account creation pattern")
            elif label == "LEGITIMATE_ACCOUNT":
                reasons.append("Account verified as legitimate")
        
        return reasons
    
    def _create_fallback_result(self, decision: str, reason: str) -> Dict[str, Any]:
        """Create a fallback assessment result."""
        return {
            "success": False,
            "decision": decision,
            "score": 0.5,  # Neutral score
            "valid_token": False,
            "action_match": False,
            "account_defender_labels": [],
            "assessment_name": None,
            "reasons": [reason],
            "fallback": True
        }
    
    def annotate_assessment(
        self,
        assessment_name: str,
        annotation: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Annotate an assessment after the user action completes.
        
        Args:
            assessment_name: The name of the assessment to annotate
            annotation: The annotation type (e.g., "CORRECT_PASSWORD", "INCORRECT_PASSWORD")
            reason: Optional reason for the annotation
            
        Returns:
            True if annotation was successful, False otherwise
        """
        try:
            if not assessment_name:
                logger.warning("Cannot annotate assessment: missing assessment name")
                return False
            
            client = self._get_client()
            
            # Create annotation
            annotation_obj = recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.UNKNOWN
            
            # Map common annotations
            annotation_map = {
                "CORRECT_PASSWORD": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.LEGITIMATE,
                "INCORRECT_PASSWORD": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.FRAUDULENT,
                "SUCCESSFUL_LOGIN": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.LEGITIMATE,
                "FAILED_LOGIN": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.FRAUDULENT,
                "SUCCESSFUL_SIGNUP": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.LEGITIMATE,
                "SUCCESSFUL_MFA": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.LEGITIMATE,
                "FAILED_MFA": recaptchaenterprise_v1.AnnotateAssessmentRequest.Annotation.FRAUDULENT,
            }
            
            if annotation in annotation_map:
                annotation_obj = annotation_map[annotation]
            
            request = recaptchaenterprise_v1.AnnotateAssessmentRequest(
                name=assessment_name,
                annotation=annotation_obj,
                reason=reason or f"User action: {annotation}"
            )
            
            client.annotate_assessment(request=request)
            logger.info(f"Successfully annotated assessment {assessment_name} with {annotation}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to annotate assessment {assessment_name}: {e}")
            return False

# Global instance
recaptcha_service = RecaptchaService()