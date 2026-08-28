from datetime import datetime
from typing import Optional
from uuid import uuid4
from sqlmodel import Field, SQLModel
import json

def get_uuid() -> str:
    return uuid4().hex

class HRUser(SQLModel, table=True):
    hr_id: str = Field(default_factory=get_uuid, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class HiringDrive(SQLModel, table=True):
    drive_id: str = Field(default_factory=get_uuid, primary_key=True)
    hr_id: str = Field(foreign_key="hruser.hr_id")
    job_title: str
    company_name: str
    job_description: str
    required_skills: str
    min_experience: int
    min_cgpa: Optional[float] = None
    constraints: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class KnowledgeDocument(SQLModel, table=True):
    doc_id: str = Field(default_factory=get_uuid, primary_key=True)
    drive_id: str = Field(foreign_key="hiringdrive.drive_id")
    file_name: str
    doc_type: str
    chroma_collection_id: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class Candidate(SQLModel, table=True):
    candidate_id: str = Field(default_factory=get_uuid, primary_key=True)
    drive_id: str = Field(foreign_key="hiringdrive.drive_id")
    full_name: str
    email: str = Field(index=True)
    phone: str
    resume_path: str
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: str = Field(default="registered")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UnifiedProfile(SQLModel, table=True):
    profile_id: str = Field(default_factory=get_uuid, primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.candidate_id", unique=True)
    parsed_resume: str
    github_metrics: Optional[str] = None
    linkedin_data: Optional[str] = None
    certificates: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VerifiedSkill(SQLModel, table=True):
    skill_id: str = Field(default_factory=get_uuid, primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.candidate_id")
    skill_name: str
    confidence_score: float
    evidence_sources: str
    evidence_level: str
    contradictions: Optional[str] = None

class InterviewSession(SQLModel, table=True):
    session_id: str = Field(default_factory=get_uuid, primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.candidate_id", unique=True)
    tech_score: Optional[float] = None
    voice_score: Optional[float] = None
    communication_score: Optional[float] = None
    overall_score: Optional[float] = None
    status: str = Field(default="pending")
    proctoring_logs: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class InterviewQA(SQLModel, table=True):
    qa_id: str = Field(default_factory=get_uuid, primary_key=True)
    session_id: str = Field(foreign_key="interviewsession.session_id")
    question_type: str
    question_text: str
    options: Optional[str] = None
    correct_answer: Optional[str] = None
    candidate_answer: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    skill_targeted: str
    asked_at: datetime = Field(default_factory=datetime.utcnow)

class HiringDecision(SQLModel, table=True):
    decision_id: str = Field(default_factory=get_uuid, primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.candidate_id", unique=True)
    recommendation: str
    overall_confidence: float
    skill_gaps: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    reasoning: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
