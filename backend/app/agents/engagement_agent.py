import json
import logging
from typing import Dict, Any, List, Optional
from app.services.nexus_client import get_nexus_service

logger = logging.getLogger(__name__)

class EngagementAgent:
    """
    Agent 6: Automated HR Outreach & Scheduling Agent (Engagement Agent).
    Generates personalized, high-converting interview invitation emails for selected candidates
    or respectful, constructive rejection & learning feedback emails for rejected candidates.
    """
    def __init__(self):
        self.nexus_service = get_nexus_service()

    async def generate_outreach_email(
        self,
        candidate_name: str,
        candidate_email: str,
        job_title: str,
        status: str,  # "SELECTED" | "REJECTED"
        strengths: Optional[List[str]] = None,
        weaknesses: Optional[List[str]] = None,
        overall_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes candidate evaluation metrics and hiring status to generate personalized email draft.
        """
        is_selected = status.upper() == "SELECTED"
        strengths_str = ", ".join(strengths) if strengths else "strong technical foundation and problem-solving"
        weaknesses_str = ", ".join(weaknesses) if weaknesses else "minor speed and precision areas"
        score_val = round(overall_score, 1) if overall_score else 80.0

        prompt = f"""
You are an expert HR Communication & Talent Engagement AI Agent for AgentHire.
Generate a highly professional, personalized email draft for a candidate based on their recruitment evaluation results.

Candidate Name: {candidate_name}
Candidate Email: {candidate_email}
Job Title: {job_title}
Hiring Decision Status: {"SHORTLISTED FOR NEXT ROUND" if is_selected else "REJECTED / ALTERNATE ROLES"}
Candidate Overall Score: {score_val}%
Key Strengths: {strengths_str}
Improvement Areas: {weaknesses_str}

    Instructions:
1. If Status is SHORTLISTED FOR NEXT ROUND (Selected):
   - Subject line must be enthusiastic and clear (e.g. "Interview Invitation: {job_title} at AgentHire").
   - Congratulate {candidate_name} on their strong assessment performance.
   - Highlight 1-2 specific key strengths ({strengths_str}).
   - Provide clear instructions for the next interview stage.
   - Include a placeholder scheduling link: "https://calendly.com/agenthire-interview-schedule".

2. If Status is REJECTED (Not Selected):
   - Subject line must be respectful and polite (e.g. "Application Status Update — {job_title}").
   - Thank {candidate_name} for investing their time in completing our assessment process.
   - Highlight positive aspects of their profile ({strengths_str}).
   - Respectfully inform them that we are advancing other candidates for this specific role.
   - DO NOT include raw score metrics, percentage numbers (e.g. 0.0%, 28.5%), or internal diagnostic audit messages in the email body.
   - End on a warm, positive, encouraging note for future career opportunities.

Format your output STRICTLY as a JSON object with keys:
"subject": "Email Subject Line String",
"body": "Full Email Body Text String with proper line breaks '\\n'",
"status": "{'SELECTED' if is_selected else 'REJECTED'}",
"scheduling_link": "https://calendly.com/agenthire-interview-schedule"
"""

        try:
            raw_response = await self.nexus_service.generate_completion(prompt, temperature=0.3)
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1].split("```")[0].strip()

            result = json.loads(cleaned)
            return {
                "candidate_email": candidate_email,
                "subject": result.get("subject", f"Update regarding your application for {job_title}"),
                "body": result.get("body", f"Dear {candidate_name},\n\nThank you for applying."),
                "status": "SELECTED" if is_selected else "REJECTED",
                "scheduling_link": result.get("scheduling_link", "https://calendly.com/agenthire-interview-schedule")
            }
        except Exception as e:
            logger.warning(f"LLM outreach email generation fallback: {e}")
            # Robust rule-based fallback
            if is_selected:
                return {
                    "candidate_email": candidate_email,
                    "subject": f"Interview Invitation: {job_title} Position at AgentHire",
                    "body": f"Dear {candidate_name},\n\nCongratulations! Based on your strong technical foundation, we are delighted to invite you to the next interview round for the {job_title} position.\n\nOur team was particularly impressed by your {strengths_str}.\n\nPlease select a convenient time for your 30-minute technical interview using our scheduling link below:\nhttps://calendly.com/agenthire-interview-schedule\n\nBest regards,\nAgentHire Talent Acquisition Team",
                    "status": "SELECTED",
                    "scheduling_link": "https://calendly.com/agenthire-interview-schedule"
                }
            else:
                return {
                    "candidate_email": candidate_email,
                    "subject": f"Application Status — {job_title} at AgentHire",
                    "body": f"Dear {candidate_name},\n\nThank you for taking the time to complete our assessment process for the {job_title} role. We sincerely appreciate your effort and interest in AgentHire.\n\nWe were impressed by your strong skills and experience in technical domain areas ({strengths_str}). After careful evaluation, we have decided to move forward with candidates whose current profile alignment more closely matches our immediate technical requirements for this specific role.\n\nWe greatly appreciate your time and dedication throughout the process. We encourage you to apply for future opportunities with us and will keep your resume on file for upcoming openings.\n\nWe wish you all the best in your career search.\n\nWarm regards,\nAgentHire Recruitment Team",
                    "status": "REJECTED",
                    "scheduling_link": None
                }

_engagement_agent = None

def get_engagement_agent() -> EngagementAgent:
    global _engagement_agent
    if _engagement_agent is None:
        _engagement_agent = EngagementAgent()
    return _engagement_agent
