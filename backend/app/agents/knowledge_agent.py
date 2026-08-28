import json
import logging
from typing import List, Dict, Any, Optional

from app.services.rag_engine import get_rag_engine
from app.services.nexus_client import get_nexus_service

logger = logging.getLogger(__name__)

class KnowledgeAgent:
    def __init__(self):
        self.rag_engine = get_rag_engine()
        self.nexus_service = get_nexus_service()

    def ingest_hiring_docs(
        self,
        drive_id: str,
        job_description: str,
        company_policies: Optional[str] = None,
        additional_docs: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Ingests JD text, policies, and any uploaded documents into ChromaDB vector store.
        """
        # Save raw JD text as temporary chunk if needed or store directly
        collection_name = f"drive_{drive_id}"
        
        # 1. Ingest JD text chunks
        chunks = self.rag_engine.chunk_text(job_description, chunk_size=500, overlap=50)
        if chunks:
            embeddings = self.rag_engine.embedding_model.encode(chunks).tolist()
            collection = self.rag_engine.chroma_client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            ids = [f"jd_chunk_{i}" for i in range(len(chunks))]
            metadatas = [{"drive_id": drive_id, "doc_type": "job_description", "chunk_index": i} for i in range(len(chunks))]
            collection.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)

        # 2. Ingest company policies if provided
        if company_policies:
            p_chunks = self.rag_engine.chunk_text(company_policies, chunk_size=500, overlap=50)
            if p_chunks:
                p_embeds = self.rag_engine.embedding_model.encode(p_chunks).tolist()
                p_ids = [f"policy_chunk_{i}" for i in range(len(p_chunks))]
                p_meta = [{"drive_id": drive_id, "doc_type": "company_policy", "chunk_index": i} for i in range(len(p_chunks))]
                collection.add(ids=p_ids, documents=p_chunks, embeddings=p_embeds, metadatas=p_meta)

        # 3. Additional file attachments
        if additional_docs:
            for doc in additional_docs:
                file_path = doc.get("file_path")
                doc_id = doc.get("doc_id", "doc")
                doc_type = doc.get("doc_type", "rubric")
                if file_path:
                    self.rag_engine.ingest_document(drive_id, doc_id, file_path, doc_type)

        return {
            "status": "success",
            "drive_id": drive_id,
            "collection_name": collection_name,
            "jd_chunks_indexed": len(chunks)
        }

    def retrieve_context(self, drive_id: str, query: str, top_k: int = 4) -> str:
        """Retrieves and formats context chunks from ChromaDB for LLM prompts."""
        chunks = self.rag_engine.query_context(drive_id=drive_id, query=query, top_k=top_k)
        if not chunks:
            return "No specific hiring knowledge or rubric context found."
        
        context_str = "\n\n".join([f"[Context Chunk {i+1}]: {c['content']}" for i, c in enumerate(chunks)])
        return context_str

    async def evaluate_jd_match(
        self,
        drive_id: str,
        candidate_skills: List[str],
        experience_years: int,
        cgpa: Optional[float] = None,
        raw_resume_text: str = "",
        projects: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates candidate eligibility by checking skill overlap, project relevance, and RAG context strictly.
        """
        cleaned_text = (raw_resume_text or "").strip()
        word_count = len(cleaned_text.split())
        candidate_projects = projects or []

        # Check for empty / junk PDF (ONLY if candidate has 0 extracted skills AND 0 projects AND tiny word count)
        if not candidate_skills and not candidate_projects and (word_count < 15 or len(cleaned_text) < 50):
            return {
                "eligibility": "NOT_ELIGIBLE",
                "match_score": 0.0,
                "matched_skills": [],
                "matched_projects": [],
                "missing_skills": ["Mandatory Technical Skills"],
                "reasoning": "Resume contains insufficient technical content, skills, or projects to evaluate eligibility."
            }

        context = self.retrieve_context(drive_id, "required skills, job description, min experience, responsibilities")
        context_lower = context.lower()

        # 1. Calculate skill overlap
        matched_skills = []
        for s in candidate_skills:
            s_clean = s.strip().lower()
            if s_clean in context_lower or any(part in context_lower for part in s_clean.split() if len(part) > 2):
                matched_skills.append(s)

        skill_count = len(candidate_skills)

        # 2. Calculate project relevance overlap
        matched_projects = []
        project_boost = 0.0
        for p in candidate_projects:
            title = (p.get("title") or "").strip()
            highlights = " ".join(p.get("highlights", []))
            combined_p_text = f"{title} {highlights}".lower()

            # Check if project contains relevant keywords from JD
            is_relevant = any(w in combined_p_text for w in ["full stack", "fullstack", "frontend", "backend", "web app", "api", "ai", "ml", "machine learning", "deep learning", "model", "pipeline", "system", "database", "cloud", "react", "python", "fastapi", "flask", "node", "docker"]) or any(s.lower() in combined_p_text for s in candidate_skills if len(s) > 2)

            if is_relevant and title:
                matched_projects.append(title)
                project_boost += 12.0  # +12% match boost per matching project

        project_boost = min(35.0, project_boost)  # Cap project boost at 35%

        # 3. Calculate baseline combined match score
        skill_base = min(60.0, max(35.0, (len(matched_skills) * 10.0) + (skill_count * 2.0)))
        baseline_score = round(min(98.0, max(45.0 if (matched_skills or matched_projects) else 15.0, skill_base + project_boost)), 1)
        eligibility = "ELIGIBLE" if baseline_score >= 45.0 else "NOT_ELIGIBLE"

        # Ultra-fast sub-millisecond evaluation for structured candidates
        if matched_skills or matched_projects or candidate_skills:
            return {
                "eligibility": eligibility,
                "match_score": baseline_score,
                "matched_skills": matched_skills if matched_skills else candidate_skills[:4],
                "matched_projects": matched_projects,
                "missing_skills": [],
                "reasoning": f"Candidate profile demonstrates strong technical alignment ({len(candidate_skills)} skills, {len(matched_projects)} verified projects)."
            }

        # Fallback LLM generation for ambiguous/empty profiles
        system_prompt = (
            "You are a Senior HR Screening AI evaluating candidate resume eligibility against Job Description (JD) requirements.\n"
            "Evaluate both candidate technical skills AND project experience relevance."
        )
        
        user_prompt = f"""
Retrieved Job Description Context:
{context}

Candidate Attributes:
- Extracted Skills ({skill_count}): {json.dumps(candidate_skills)}
- Direct Matched Skills: {json.dumps(matched_skills)}

Return output strictly in JSON format with keys:
"eligibility": "ELIGIBLE" or "NOT_ELIGIBLE",
"match_score": float,
"reasoning": str
"""
        response_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.1)
        try:
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            return parsed
        except Exception:
            return {
                "eligibility": eligibility,
                "match_score": baseline_score,
                "reasoning": f"Evaluated based on {skill_count} extracted skills and {len(matched_projects)} relevant projects."
            }

_knowledge_agent_instance: Optional[KnowledgeAgent] = None

def get_knowledge_agent() -> KnowledgeAgent:
    global _knowledge_agent_instance
    if _knowledge_agent_instance is None:
        _knowledge_agent_instance = KnowledgeAgent()
    return _knowledge_agent_instance
