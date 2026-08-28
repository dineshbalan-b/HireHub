import json
import logging
from typing import Dict, Any, List

from app.services.nexus_client import get_nexus_service

logger = logging.getLogger(__name__)

class DecisionAgent:
    """
    Agent 4: Decision Agent.
    Responsible for evidence verification, contradiction analysis,
    confidence calculation, and generating an explainable hiring recommendation.
    """
    def __init__(self):
        self.nexus_service = get_nexus_service()

    async def generate_hiring_decision(
        self,
        candidate_name: str,
        job_title: str,
        verified_skills: List[Dict[str, Any]],
        tech_score: float,
        voice_score: float,
        communication_score: float,
        jd_match_score: float
    ) -> Dict[str, Any]:
        """
        Synthesizes multi-source evidence and interview evaluations to produce an explainable hiring decision.
        Strict scoring rules apply — no silent high-score fallbacks for missing or zero scores.
        """
        # Strict score coercion (0.0 if missing, None, or zero)
        tech = float(tech_score) if tech_score is not None else 0.0
        voice = float(voice_score) if voice_score is not None else 0.0
        comm = float(communication_score) if communication_score is not None else 0.0
        jd_m = float(jd_match_score) if jd_match_score is not None else 0.0

        # Calculate overall multi-modal score:
        # 50% Technical Test + 25% Voice/Communication + 25% JD/GitHub Alignment
        overall_score = (0.50 * tech) + (0.25 * ((voice + comm) / 2.0)) + (0.25 * jd_m)
        overall_confidence = round(overall_score / 100.0, 3)

        # Recommendation thresholding logic
        if overall_score >= 80.0 and tech >= 60.0:
            recommendation = "STRONG_HIRE"
        elif overall_score >= 65.0 and tech >= 50.0:
            recommendation = "HIRE"
        elif overall_score >= 45.0:
            recommendation = "MAYBE"
        else:
            recommendation = "NO_HIRE"

        # Call GPT-4.1 Nano for explainable reasoning narrative
        system_prompt = (
            "You are the Decision Agent for an AI recruitment platform. Synthesize evidence strictly based on numbers: "
            "resume alignment, GitHub evidence, LinkedIn profile, technical test accuracy, and voice HR communication. "
            "If candidate scored low or 0 on technical test or voice interview, explicitly highlight this as a critical failure."
        )

        user_prompt = f"""
Candidate: {candidate_name}
Target Role: {job_title}

Evaluation Metrics (Strict Scores):
- Overall Score: {overall_score:.1f}% (Confidence: {overall_confidence})
- Preliminary JD Match Score: {jd_m:.1f}%
- Technical Test Score: {tech:.1f}%
- Voice HR Score: {voice:.1f}%
- Communication Score: {comm:.1f}%

Verified Skills Data:
{json.dumps(verified_skills, indent=2)}

Recommendation: {recommendation}

Generate output strictly in JSON format with keys:
"recommendation": "{recommendation}",
"overall_confidence": {overall_confidence},
"strengths": list of 2-4 bullet strings (or note lack of evidence if scores are low),
"weaknesses": list of 2-4 bullet strings highlighting low scores or unverified skills,
"skill_gaps": list of missing or weak skills,
"reasoning": detailed paragraph explaining why this recommendation was reached based on actual test scores and evidence.
"""

        response_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.1)
        try:
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            parsed["overall_score"] = round(overall_score, 1)
            parsed["tech_score"] = round(tech, 1)
            parsed["voice_score"] = round(voice, 1)
            parsed["communication_score"] = round(comm, 1)
            return parsed
        except Exception as e:
            logger.error(f"Error parsing DecisionAgent response: {e}")
            return {
                "recommendation": recommendation,
                "overall_confidence": overall_confidence,
                "overall_score": round(overall_score, 1),
                "tech_score": round(tech, 1),
                "voice_score": round(voice, 1),
                "communication_score": round(comm, 1),
                "strengths": ["Preliminary resume qualification"] if overall_score >= 50 else ["Application recorded"],
                "weaknesses": ["Low assessment performance or missing voice/technical responses"],
                "skill_gaps": [s.get("skill_name") for s in verified_skills if s.get("confidence_score", 0) < 0.5],
                "reasoning": f"Candidate achieved an overall score of {overall_score:.1f}% (Tech: {tech:.1f}%, Voice: {voice:.1f}%, Comm: {comm:.1f}%) and is evaluated as {recommendation}."
            }

_decision_agent_instance = None

def get_decision_agent() -> DecisionAgent:
    global _decision_agent_instance
    if _decision_agent_instance is None:
        _decision_agent_instance = DecisionAgent()
    return _decision_agent_instance
