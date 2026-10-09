import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.db.models import UnifiedProfile, VerifiedSkill, InterviewSession, HiringDecision
from app.services.rag_engine import get_rag_engine
from app.services.nexus_client import get_nexus_service

logger = logging.getLogger(__name__)

class MemoryAgent:
    """
    Agent 5: Memory Agent.
    Distils full session logs into compressed semantic summaries (~800 tokens),
    persists candidate state into SQLite relational DB,
    and indexes memory vectors into ChromaDB for similarity queries.
    """
    def __init__(self):
        self.rag_engine = get_rag_engine()
        self.nexus_service = get_nexus_service()

    async def persist_candidate_session(
        self,
        db_session: AsyncSession,
        candidate_id: str,
        unified_profile: Dict[str, Any],
        verified_skills: list,
        interview_session_data: Dict[str, Any],
        hiring_decision_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Persists candidate profile, verified skills, interview scores, and decision to SQLite."""
        try:
            # 1. Unified Profile
            res = await db_session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
            existing_up = res.scalars().first()
            if not existing_up:
                up = UnifiedProfile(
                    candidate_id=candidate_id,
                    parsed_resume=json.dumps(unified_profile.get("resume_claims", {})),
                    github_metrics=json.dumps(unified_profile.get("github_evidence", {})),
                    linkedin_data=json.dumps(unified_profile.get("linkedin_evidence", {})),
                    certificates=json.dumps(unified_profile.get("certificates", []))
                )
                db_session.add(up)

            # 2. Verified Skills
            for vs in verified_skills:
                skill_obj = VerifiedSkill(
                    candidate_id=candidate_id,
                    skill_name=vs.get("skill_name"),
                    confidence_score=vs.get("confidence_score", 0.0),
                    evidence_sources=json.dumps(vs.get("evidence_sources", [])),
                    evidence_level=vs.get("evidence_level", "MEDIUM"),
                    contradictions=json.dumps(vs.get("contradiction_reason")) if vs.get("contradiction") else None
                )
                db_session.add(skill_obj)

            # 3. Interview Session Record
            res_is = await db_session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
            existing_is = res_is.scalars().first()
            if existing_is:
                existing_is.tech_score = interview_session_data.get("tech_score")
                existing_is.voice_score = interview_session_data.get("voice_score")
                existing_is.communication_score = interview_session_data.get("communication_score")
                existing_is.overall_score = interview_session_data.get("overall_score")
                existing_is.status = "completed"
                existing_is.completed_at = datetime.now(timezone.utc)
                db_session.add(existing_is)
            else:
                is_obj = InterviewSession(
                    candidate_id=candidate_id,
                    tech_score=interview_session_data.get("tech_score"),
                    voice_score=interview_session_data.get("voice_score"),
                    communication_score=interview_session_data.get("communication_score"),
                    overall_score=interview_session_data.get("overall_score"),
                    status="completed",
                    completed_at=datetime.now(timezone.utc)
                )
                db_session.add(is_obj)

            # 4. Hiring Decision Record
            res_hd = await db_session.execute(select(HiringDecision).where(HiringDecision.candidate_id == candidate_id))
            existing_hd = res_hd.scalars().first()
            if not existing_hd:
                hd = HiringDecision(
                    candidate_id=candidate_id,
                    recommendation=hiring_decision_data.get("recommendation", "MAYBE"),
                    overall_confidence=hiring_decision_data.get("overall_confidence", 0.7),
                    skill_gaps=json.dumps(hiring_decision_data.get("skill_gaps", [])),
                    strengths=json.dumps(hiring_decision_data.get("strengths", [])),
                    weaknesses=json.dumps(hiring_decision_data.get("weaknesses", [])),
                    reasoning=hiring_decision_data.get("reasoning", "")
                )
                db_session.add(hd)

            await db_session.commit()

            # 5. ChromaDB Memory Embedding (Semantic Optimization)
            summary_text = (
                f"Candidate {unified_profile.get('name')} for role. "
                f"Recommendation: {hiring_decision_data.get('recommendation')}. "
                f"Overall Score: {hiring_decision_data.get('overall_score')}%. "
                f"Strengths: {', '.join(hiring_decision_data.get('strengths', []))}."
            )
            
            try:
                collection = self.rag_engine.chroma_client.get_or_create_collection("candidate_memory")
                emb = self.rag_engine.embedding_model.encode([summary_text]).tolist()
                collection.add(
                    ids=[f"cand_mem_{candidate_id}"],
                    documents=[summary_text],
                    embeddings=emb,
                    metadatas=[{"candidate_id": candidate_id, "recommendation": hiring_decision_data.get("recommendation")}]
                )
            except Exception as e:
                logger.warning(f"ChromaDB memory indexing skipped: {e}")

            return {"status": "persisted", "candidate_id": candidate_id}

        except Exception as e:
            logger.error(f"Error persisting candidate session in MemoryAgent: {e}")
            await db_session.rollback()
            raise

_memory_agent_instance = None

def get_memory_agent() -> MemoryAgent:
    global _memory_agent_instance
    if _memory_agent_instance is None:
        _memory_agent_instance = MemoryAgent()
    return _memory_agent_instance
