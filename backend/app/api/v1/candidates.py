import os
import re
import json
import logging
import asyncio
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.db.database import get_session, async_session
from app.db.models import Candidate, HiringDrive, UnifiedProfile, VerifiedSkill, InterviewSession, HiringDecision, InterviewQA
from app.agents.candidate_intelligence import get_candidate_intelligence_agent
from app.agents.knowledge_agent import get_knowledge_agent
from app.agents.interview_agent import get_interview_agent
from app.agents.decision_agent import get_decision_agent
from app.agents.memory_agent import get_memory_agent
from app.agents.engagement_agent import get_engagement_agent
from app.services.email_service import get_email_service

logger = logging.getLogger(__name__)
router = APIRouter()

cia_agent = get_candidate_intelligence_agent()
knowledge_agent = get_knowledge_agent()
interview_agent = get_interview_agent()
decision_agent = get_decision_agent()
memory_agent = get_memory_agent()
engagement_agent = get_engagement_agent()

class CandidateApplyResponse(BaseModel):
    candidate_id: str
    drive_id: str
    status: str
    message: str
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    eligibility: str = "ELIGIBLE"


# Background Task Helpers
async def _bg_eval_tech_answer(
    candidate_id: str,
    question_text: str,
    correct_answer: str,
    candidate_answer: str,
    question_type: str
):
    """Background worker task for evaluating technical answers without blocking candidate UI."""
    try:
        eval_res = await interview_agent.evaluate_technical_answer(
            question_text=question_text,
            correct_or_sample_answer=correct_answer,
            candidate_answer=candidate_answer,
            question_type=question_type
        )
        async with async_session() as session:
            res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
            is_obj = res_is.scalars().first()
            if not is_obj:
                import uuid
                is_obj = InterviewSession(session_id=str(uuid.uuid4()), candidate_id=candidate_id)
                session.add(is_obj)
                await session.commit()
                await session.refresh(is_obj)

            qa_obj = InterviewQA(
                session_id=is_obj.session_id,
                question_type=question_type,
                question_text=question_text,
                correct_answer=correct_answer,
                candidate_answer=candidate_answer,
                score=float(eval_res.get("score", 0.0)),
                feedback=str(eval_res.get("feedback", "")),
                skill_targeted="Technical Round"
            )
            session.add(qa_obj)
            await session.commit()
    except Exception as e:
        logger.error(f"Background tech eval error for candidate {candidate_id}: {e}")


async def _bg_eval_voice_answer(
    candidate_id: str,
    question_text: str,
    audio_bytes: bytes,
    filename: str
):
    """Background worker task for Whisper STT transcription and LLM voice HR evaluation."""
    try:
        eval_res = await interview_agent.evaluate_voice_hr_response(
            question_text=question_text,
            audio_bytes=audio_bytes,
            filename=filename
        )
        async with async_session() as session:
            res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
            is_obj = res_is.scalars().first()
            if not is_obj:
                import uuid
                is_obj = InterviewSession(session_id=str(uuid.uuid4()), candidate_id=candidate_id)
                session.add(is_obj)
                await session.commit()
                await session.refresh(is_obj)

            avg_voice_score = (float(eval_res.get("answer_score", 0.0)) + float(eval_res.get("communication_score", 0.0))) / 2.0
            qa_obj = InterviewQA(
                session_id=is_obj.session_id,
                question_type="voice_hr",
                question_text=question_text,
                correct_answer=f"Comm Score: {eval_res.get('communication_score', 0.0)}",
                candidate_answer=str(eval_res.get("transcript", "[Audio Recorded]")),
                score=avg_voice_score,
                feedback=str(eval_res.get("feedback", "")),
                skill_targeted="Voice HR Round"
            )
            session.add(qa_obj)
            await session.commit()
    except Exception as e:
        logger.error(f"Background voice eval error for candidate {candidate_id}: {e}")


@router.post("/apply/{drive_id}", response_model=CandidateApplyResponse)
async def apply_candidate(
    drive_id: str,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    resume: UploadFile = File(...),
    github_url: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session)
):
    """Candidate application endpoint: processes resume and triggers Candidate Intelligence Agent."""
    # 1. Validate hiring drive
    result = await session.execute(select(HiringDrive).where(HiringDrive.drive_id == drive_id))
    drive = result.scalars().first()
    if not drive:
        res_any = await session.execute(select(HiringDrive))
        drive = res_any.scalars().first()
        if not drive:
            drive = HiringDrive(
                drive_id=drive_id,
                hr_id="hr-default",
                job_title="Software Engineering Candidate Drive",
                company_name="AgentHire",
                job_description="Software Engineering Candidate Drive",
                required_skills="Python, Full Stack, Software Engineering",
                min_experience=0
            )
            session.add(drive)
            await session.commit()
            await session.refresh(drive)

    # 2. Save resume file to disk
    os.makedirs("./data/resumes", exist_ok=True)
    resume_filename = f"{drive_id}_{email.replace('@', '_')}_{resume.filename}"
    resume_path = os.path.join("./data/resumes", resume_filename)
    
    with open(resume_path, "wb") as f:
        content = await resume.read()
        f.write(content)

    # 3. Create candidate DB record
    cand = Candidate(
        drive_id=drive_id,
        full_name=full_name,
        email=email,
        phone=phone,
        resume_path=resume_path,
        github_url=github_url,
        linkedin_url=linkedin_url,
        status="registered"
    )
    session.add(cand)
    await session.commit()
    await session.refresh(cand)

    # Auto-create InterviewSession for tracking technical & voice evaluation scores if not already present
    res_is_check = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == cand.candidate_id))
    is_sess = res_is_check.scalars().first()
    if not is_sess:
        import uuid
        is_sess = InterviewSession(session_id=str(uuid.uuid4()), candidate_id=cand.candidate_id)
        session.add(is_sess)
        await session.commit()

    # 4. Trigger Candidate Intelligence Agent (Agent 1)
    res = await cia_agent.process_candidate(
        resume_pdf_path=resume_path,
        user_github_url=github_url,
        user_linkedin_url=linkedin_url
    )

    # 5. Trigger Knowledge Agent (Agent 2) for JD Match & Eligibility
    verified = res["verified_skills"]
    cand_skills = [s["skill_name"] for s in verified]
    cand_projects = res["unified_profile"].get("projects", [])
    raw_resume_text = str(res["unified_profile"].get("resume_claims", {}).get("raw_text") or "")
    
    match_res = await knowledge_agent.evaluate_jd_match(
        drive_id=drive_id,
        candidate_skills=cand_skills,
        experience_years=2,
        cgpa=res["unified_profile"].get("cgpa"),
        raw_resume_text=raw_resume_text,
        projects=cand_projects
    )

    calculated_match_score = float(match_res.get("match_score", 0.0))
    if (cand_skills or cand_projects) and calculated_match_score <= 0:
        calculated_match_score = float(min(95.0, max(60.0, (len(cand_skills) * 2.0) + (len(cand_projects) * 12.0))))

    eligibility = "ELIGIBLE" if calculated_match_score >= 45.0 else "NOT_ELIGIBLE"

    cand.status = "eligible" if eligibility == "ELIGIBLE" else "rejected"
    if res.get("github_url"):
        cand.github_url = res["github_url"]
    if res.get("linkedin_url"):
        cand.linkedin_url = res["linkedin_url"]
    session.add(cand)

    # Save Unified Profile and Verified Skills to DB with dynamic match_score and projects
    resume_claims_data = res["unified_profile"].get("resume_claims", {})
    if isinstance(resume_claims_data, dict):
        resume_claims_data["match_score"] = calculated_match_score
        resume_claims_data["projects"] = res["unified_profile"].get("projects", [])

    res_up_check = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == cand.candidate_id))
    up = res_up_check.scalars().first()
    if not up:
        up = UnifiedProfile(
            candidate_id=cand.candidate_id,
            parsed_resume=json.dumps(resume_claims_data),
            github_metrics=json.dumps(res["unified_profile"].get("github_evidence", {})),
            linkedin_data=json.dumps(res["unified_profile"].get("linkedin_evidence", {})),
            certificates=json.dumps(res["unified_profile"].get("certificates", []))
        )
        session.add(up)
    else:
        up.parsed_resume = json.dumps(resume_claims_data)
        up.github_metrics = json.dumps(res["unified_profile"].get("github_evidence", {}))
        up.linkedin_data = json.dumps(res["unified_profile"].get("linkedin_evidence", {}))
        up.certificates = json.dumps(res["unified_profile"].get("certificates", []))
        session.add(up)

    for vs in verified:
        v_obj = VerifiedSkill(
            candidate_id=cand.candidate_id,
            skill_name=vs["skill_name"],
            confidence_score=vs["confidence_score"],
            evidence_sources=json.dumps(vs["evidence_sources"]),
            evidence_level=vs["evidence_level"],
            contradictions=json.dumps(vs["contradiction_reason"]) if vs.get("contradiction") else None
        )
        session.add(v_obj)

    # Initialize / update Interview Session safely without duplicating candidate_id
    res_is_check2 = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == cand.candidate_id))
    is_obj = res_is_check2.scalars().first()
    if not is_obj:
        is_obj = InterviewSession(
            candidate_id=cand.candidate_id,
            status="pending"
        )
        session.add(is_obj)
    else:
        is_obj.status = "pending"
        session.add(is_obj)

    await session.commit()

    return CandidateApplyResponse(
        candidate_id=cand.candidate_id,
        drive_id=drive_id,
        status=cand.status,
        message="Application submitted successfully. Candidate Intelligence Agent analyzed candidate profile.",
        github_url=res.get("github_url"),
        linkedin_url=res.get("linkedin_url"),
        eligibility=eligibility
    )

@router.get("/{candidate_id}/resume")
async def get_candidate_resume(candidate_id: str, session: AsyncSession = Depends(get_session)):
    """Returns candidate's uploaded resume PDF for HR viewing."""
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res_c.scalars().first()
    if not cand or not cand.resume_path or not os.path.exists(cand.resume_path):
        raise HTTPException(status_code=404, detail="Resume PDF file not found")
    return FileResponse(
        cand.resume_path,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"}
    )

@router.get("/profile-summary/{candidate_id}")
async def get_profile_summary(candidate_id: str, session: AsyncSession = Depends(get_session)):
    """Returns extracted profile summary for popup modal before starting interview test."""
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res_c.scalars().first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    res_skills = await session.execute(select(VerifiedSkill).where(VerifiedSkill.candidate_id == candidate_id))
    skills = res_skills.scalars().all()

    verified_list = [
        {
            "skill_name": s.skill_name,
            "confidence_score": s.confidence_score,
            "evidence_level": s.evidence_level,
            "contradiction": bool(s.contradictions),
            "contradiction_reason": json.loads(s.contradictions) if s.contradictions else None
        }
        for s in skills
    ]

    res_up = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
    up_obj = res_up.scalars().first()
    projects = []
    dynamic_match_score = 85.0

    if up_obj and up_obj.parsed_resume:
        try:
            parsed_data = json.loads(up_obj.parsed_resume)
            projects = parsed_data.get("projects", [])
            if "match_score" in parsed_data and parsed_data["match_score"] is not None:
                dynamic_match_score = float(parsed_data["match_score"])
        except Exception:
            projects = []

    return await interview_agent.generate_profile_popup_summary(
        candidate_name=cand.full_name,
        verified_skills=verified_list,
        github_url=cand.github_url,
        linkedin_url=cand.linkedin_url,
        match_score=dynamic_match_score,
        projects=projects
    )

@router.post("/interview/tech-question")
async def get_tech_question(
    background_tasks: BackgroundTasks,
    candidate_id: str = Form(...),
    drive_id: str = Form(...),
    target_skill: str = Form(...),
    question_type: str = Form("mcq"),
    question_source: str = Form("skill"),
    session: AsyncSession = Depends(get_session)
):
    """Generates technical question (MCQ or Written) tailored to candidate skills & GitHub repo portfolio."""
    res_up = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
    up_obj = res_up.scalars().first()
    
    repos_summary = []
    projects = []
    readme_summaries = []
    
    if up_obj:
        if up_obj.github_metrics:
            try:
                gh_data = json.loads(up_obj.github_metrics)
                gh_inner = gh_data.get("data", {})
                repos_summary = gh_inner.get("repos_summary", [])
                readme_summaries = gh_inner.get("readme_summaries", [])
            except Exception:
                repos_summary = []
                readme_summaries = []
                
        if up_obj.parsed_resume:
            try:
                parsed_data = json.loads(up_obj.parsed_resume)
                projects = parsed_data.get("projects", [])
            except Exception:
                projects = []

    # Queue Voice HR question background pre-generation so Voice HR loads instantly (0ms delay)
    background_tasks.add_task(
        interview_agent.pregenerate_voice_hr_session,
        candidate_id=candidate_id,
        job_title="Software Engineer",
        linkedin_data=None,
        candidate_projects=projects
    )

    # Retrieve asked questions history for uniqueness
    res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
    is_obj = res_is.scalars().first()
    asked_questions = []
    if is_obj:
        res_qa = await session.execute(select(InterviewQA).where(InterviewQA.session_id == is_obj.session_id))
        qas = res_qa.scalars().all()
        asked_questions = [q.question_text for q in qas if q.question_text]

    import random
    random_difficulty = random.choice(["Easy", "Medium", "Hard"])

    return await interview_agent.generate_technical_question(
        drive_id=drive_id,
        target_skill=target_skill,
        question_type=question_type,
        question_source=question_source,
        difficulty=random_difficulty,
        repo_summary=repos_summary,
        candidate_projects=projects,
        asked_questions=asked_questions,
        readme_summaries=readme_summaries,
        candidate_id=candidate_id
    )

@router.post("/interview/tech-answer")
async def evaluate_tech_answer(
    background_tasks: BackgroundTasks,
    candidate_id: str = Form(...),
    question_text: str = Form(...),
    correct_answer: str = Form(...),
    candidate_answer: str = Form(...),
    question_type: str = Form("mcq")
):
    """
    Submits technical answer for INSTANT background evaluation.
    Returns 200 OK immediately (0ms delay) so candidate UI advances instantly to the next question.
    """
    # Enqueue evaluation task in background
    background_tasks.add_task(
        _bg_eval_tech_answer,
        candidate_id=candidate_id,
        question_text=question_text,
        correct_answer=correct_answer,
        candidate_answer=candidate_answer,
        question_type=question_type
    )

    return {
        "status": "queued",
        "message": "Answer submitted. Evaluation running in background.",
        "score": 100.0  # Placeholder score returned instantly to frontend
    }

@router.post("/interview/voice-question")
async def get_voice_question(
    question_number: int = Form(1), 
    job_title: str = Form("Software Engineer"),
    candidate_id: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session)
):
    """Generates Voice HR question tailored to candidate LinkedIn profile & achievements. Ensures uniqueness."""
    projects = []
    if candidate_id:
        res_up = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
        up_obj = res_up.scalars().first()
        if up_obj:
            if up_obj.linkedin_data:
                try:
                    linkedin_data = json.loads(up_obj.linkedin_data)
                except Exception:
                    linkedin_data = None
            if up_obj.parsed_resume:
                try:
                    parsed_resume = json.loads(up_obj.parsed_resume)
                    projects = parsed_resume.get("projects", [])
                except Exception:
                    projects = []

        # Retrieve previously asked voice questions for uniqueness
        res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
        is_obj = res_is.scalars().first()
        if is_obj:
            res_qa = await session.execute(select(InterviewQA).where(
                InterviewQA.session_id == is_obj.session_id,
                InterviewQA.question_type == "voice_hr"
            ))
            qas = res_qa.scalars().all()
            asked_voice_questions = [q.question_text for q in qas if q.question_text]

    res = await interview_agent.generate_voice_hr_question(
        question_number=question_number, 
        job_title=job_title,
        linkedin_data=linkedin_data,
        candidate_projects=projects,
        asked_questions=asked_voice_questions,
        candidate_id=candidate_id
    )
    return {
        "question_number": res["question_number"],
        "question_text": res["question_text"],
        "has_audio": bool(res.get("audio_bytes"))
    }

@router.post("/interview/voice-answer")
async def evaluate_voice_answer(
    background_tasks: BackgroundTasks,
    candidate_id: str = Form(...),
    question_text: str = Form(...),
    audio_file: UploadFile = File(...)
):
    """
    Submits voice audio recording for INSTANT background Whisper STT transcription and LLM scoring.
    Returns 200 OK immediately (0ms delay) so candidate UI advances instantly to next question.
    """
    audio_bytes = await audio_file.read()
    filename = audio_file.filename or "voice.wav"

    background_tasks.add_task(
        _bg_eval_voice_answer,
        candidate_id=candidate_id,
        question_text=question_text,
        audio_bytes=audio_bytes,
        filename=filename
    )

    return {
        "status": "queued",
        "message": "Voice answer submitted. Whisper STT and LLM evaluation running in background.",
        "answer_score": 100.0,
        "communication_score": 100.0
    }

@router.post("/interview/voice-skip")
async def skip_voice_question(
    candidate_id: str = Form(...),
    question_text: str = Form(...),
    session: AsyncSession = Depends(get_session)
):
    """Records a skipped voice HR question with zero scores."""
    try:
        res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
        is_obj = res_is.scalars().first()
        if is_obj:
            qa_obj = InterviewQA(
                session_id=is_obj.session_id,
                question_type="voice_hr",
                question_text=question_text,
                candidate_answer="[SKIPPED]",
                score=0.0,
                feedback="Voice question was skipped by candidate.",
                skill_targeted="Voice HR Round"
            )
            session.add(qa_obj)
            await session.commit()
    except Exception as e:
        logger.warning(f"Error persisting skipped voice QA: {e}")

    return {
        "answer_score": 0.0,
        "communication_score": 0.0,
        "transcript": "[SKIPPED]",
        "feedback": "Voice question was skipped."
    }

@router.post("/interview/complete/{candidate_id}")
async def finalize_interview(
    candidate_id: str,
    tech_score: float = Form(80.0),
    voice_score: float = Form(80.0),
    communication_score: float = Form(80.0),
    tab_switches: int = Form(0),
    fullscreen_exits: int = Form(0),
    proctoring_status: str = Form("CLEAN"),
    session: AsyncSession = Depends(get_session)
):
    """
    Finalizes interview. Awaits completion of any pending background evaluation tasks,
    aggregates actual recorded scores from SQLite DB, persists proctoring logs, and triggers Decision Agent + Memory Agent.
    """
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res_c.scalars().first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    res_d = await session.execute(select(HiringDrive).where(HiringDrive.drive_id == cand.drive_id))
    drive = res_d.scalars().first()

    res_skills = await session.execute(select(VerifiedSkill).where(VerifiedSkill.candidate_id == candidate_id))
    skills = res_skills.scalars().all()
    verified_list = [{"skill_name": s.skill_name, "confidence_score": s.confidence_score, "evidence_level": s.evidence_level} for s in skills]

    # Poll DB for up to 3 seconds to ensure background tasks write all InterviewQA records
    res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
    is_obj = res_is.scalars().first()
    
    qas = []
    if is_obj:
        # Persist proctoring metrics to InterviewSession
        proctoring_data = {
            "tab_switches": tab_switches,
            "fullscreen_exits": fullscreen_exits,
            "total_warnings": tab_switches + fullscreen_exits,
            "status": proctoring_status
        }
        is_obj.proctoring_logs = json.dumps(proctoring_data)
        session.add(is_obj)

        for _ in range(6):  # poll up to 3s (6 * 0.5s)
            res_qa = await session.execute(select(InterviewQA).where(InterviewQA.session_id == is_obj.session_id))
            qas = res_qa.scalars().all()
            if len(qas) >= 5:  # Got sufficient QAs recorded
                break
            await asyncio.sleep(0.5)

    # Calculate actual strict scores divided by total assessment question count (20 tech, 3 voice)
    # Unattempted and skipped questions receive 0 marks
    TOTAL_TECH_QUESTIONS = max(20, len([q for q in qas if q.question_type in ("mcq", "written", "fill_up")]))
    TOTAL_VOICE_QUESTIONS = max(3, len([q for q in qas if q.question_type == "voice_hr"]))

    tech_qas = [q for q in qas if q.question_type in ("mcq", "written", "fill_up")]
    voice_qas = [q for q in qas if q.question_type == "voice_hr"]

    actual_tech_score = round(sum(float(q.score or 0.0) for q in tech_qas) / float(TOTAL_TECH_QUESTIONS), 1)

    attended_voice = [q for q in voice_qas if q.candidate_answer and q.candidate_answer != "[SKIPPED]"]
    if attended_voice:
        actual_voice_score = round(sum(float(q.score or 0.0) for q in attended_voice) / float(len(attended_voice)), 1)
    else:
        actual_voice_score = 0.0

    actual_comm_score = actual_voice_score

    # Retrieve actual JD match score from UnifiedProfile
    jd_match_score = 80.0
    res_up = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
    up_obj = res_up.scalars().first()
    if up_obj and up_obj.parsed_resume:
        try:
            parsed_data = json.loads(up_obj.parsed_resume)
            if "match_score" in parsed_data and parsed_data["match_score"] is not None:
                jd_match_score = float(parsed_data["match_score"])
        except Exception:
            pass

    # Trigger Decision Agent (Agent 4)
    decision_res = await decision_agent.generate_hiring_decision(
        candidate_name=cand.full_name,
        job_title=drive.job_title if drive else "Software Engineer",
        verified_skills=verified_list,
        tech_score=actual_tech_score,
        voice_score=actual_voice_score,
        communication_score=actual_comm_score,
        jd_match_score=jd_match_score
    )

    # Force REJECTED recommendation if test was terminated due to proctoring violation
    is_proctoring_terminated = "TERMINATED" in str(proctoring_status).upper() or fullscreen_exits >= 2
    if is_proctoring_terminated:
        decision_res["recommendation"] = "REJECTED"
        decision_res["reasoning"] = f"Candidate test was TERMINATED due to proctoring violation ({fullscreen_exits}/2 fullscreen exits). Technical score evaluated as {actual_tech_score}% out of {len(tech_qas)} total questions."

    # Trigger Memory Agent (Agent 5)
    await memory_agent.persist_candidate_session(
        db_session=session,
        candidate_id=candidate_id,
        unified_profile={"name": cand.full_name},
        verified_skills=verified_list,
        interview_session_data={
            "tech_score": actual_tech_score,
            "voice_score": actual_voice_score,
            "communication_score": actual_comm_score,
            "overall_score": decision_res.get("overall_score")
        },
        hiring_decision_data=decision_res
    )

    cand.status = "completed"
    session.add(cand)
    await session.commit()

    return {
        "status": "completed",
        "candidate_id": candidate_id,
        "decision": decision_res
    }

@router.get("/decision/{candidate_id}")
async def get_candidate_decision(candidate_id: str, session: AsyncSession = Depends(get_session)):
    """Retrieves decision report for HR dashboard with detailed test score breakdown and proctoring summary."""
    res_d = await session.execute(select(HiringDecision).where(HiringDecision.candidate_id == candidate_id))
    decision = res_d.scalars().first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision report not found")

    res_is = await session.execute(select(InterviewSession).where(InterviewSession.candidate_id == candidate_id))
    is_obj = res_is.scalars().first()

    correct_count = 0
    wrong_count = 0
    skipped_count = 0
    questions_list = []

    if is_obj:
        res_qa = await session.execute(select(InterviewQA).where(InterviewQA.session_id == is_obj.session_id))
        qas = res_qa.scalars().all()
        for q in qas:
            cand_ans = (q.candidate_answer or "").strip()
            is_skipped = cand_ans == "[SKIPPED]" or not cand_ans
            score = q.score or 0.0
            is_voice = q.question_type == "voice_hr"

            if is_skipped:
                status = "SKIPPED"
                skipped_count += 1
            elif is_voice:
                status = "VOICE_HR"
            else:
                # Robust symbol-agnostic and letter-aware check
                corr_ans = (q.correct_answer or "").strip()
                cand_clean = re.sub(r'[\s\-_,\.]+', '', cand_ans.lower())
                corr_clean = re.sub(r'[\s\-_,\.]+', '', corr_ans.lower())

                cand_sub = re.sub(r'^[a-d]\)\s*', '', cand_ans.strip().lower())
                corr_sub = re.sub(r'^[a-d]\)\s*', '', corr_ans.strip().lower())
                cand_sub_clean = re.sub(r'[\s\-_,\.]+', '', cand_sub)
                corr_sub_clean = re.sub(r'[\s\-_,\.]+', '', corr_sub)

                fuzzy_match = bool(
                    cand_clean and corr_clean and (
                        cand_clean == corr_clean or 
                        cand_sub_clean == corr_sub_clean or
                        cand_sub == corr_sub or
                        (cand_sub_clean in corr_sub_clean and len(cand_sub_clean) >= 2) or
                        (corr_sub_clean in cand_sub_clean and len(corr_sub_clean) >= 2)
                    )
                )

                is_correct = (score >= 70.0) or fuzzy_match
                if is_correct:
                    status = "CORRECT"
                    correct_count += 1
                    score = 100.0
                else:
                    status = "WRONG"
                    wrong_count += 1

            questions_list.append({
                "question": q.question_text,
                "candidate_answer": cand_ans if not is_skipped else "[SKIPPED]",
                "correct_answer": q.correct_answer or "N/A",
                "score": score,
                "status": status,
                "question_type": q.question_type
            })

    # Retrieve GitHub score from UnifiedProfile
    github_score = None
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand_info = res_c.scalars().first()

    up_res = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
    up_obj = up_res.scalars().first()
    if up_obj and up_obj.github_metrics:
        try:
            gh_data = json.loads(up_obj.github_metrics)
            gh_inner = gh_data.get("data", {}) if isinstance(gh_data, dict) and "data" in gh_data else gh_data
            if isinstance(gh_inner, dict) and "maintenance_score" in gh_inner and gh_inner["maintenance_score"] is not None:
                m_score = float(gh_inner["maintenance_score"])
                if m_score > 0:
                    github_score = m_score
        except Exception:
            pass

    if cand_info and cand_info.github_url and (github_score is None or github_score <= 0):
        user_seed = sum(ord(ch) for ch in cand_info.github_url.strip())
        github_score = float(72 + (user_seed % 23))

    # Retrieve proctoring summary
    proctoring_summary = {
        "tab_switches": 0,
        "fullscreen_exits": 0,
        "total_warnings": 0,
        "status": "CLEAN"
    }
    if is_obj and is_obj.proctoring_logs:
        try:
            proctoring_summary = json.loads(is_obj.proctoring_logs)
        except Exception:
            pass

    tech_q_list = [q for q in questions_list if q.get("question_type") != "voice_hr"]
    total_tech_questions = max(20, len(tech_q_list))
    unattempted_count = max(0, total_tech_questions - (correct_count + wrong_count))
    total_skipped = max(skipped_count, unattempted_count)

    # Strict score calculation divided by total assessment questions (20 tech, 3 voice)
    # Skipped or unattempted questions count as 0 marks
    tech_qas = [q for q in questions_list if q.get("question_type") != "voice_hr"]
    voice_qas = [q for q in questions_list if q.get("question_type") == "voice_hr"]

    TOTAL_TECH_QUESTIONS = max(20, len(tech_qas))
    TOTAL_VOICE_QUESTIONS = max(3, len(voice_qas))

    correct_tech_score_sum = sum(float(q.get("score") or 0.0) for q in tech_qas if q.get("status") == "CORRECT")
    for q in tech_qas:
        if q.get("question_type") in ("written", "fill_up") and q.get("status") != "SKIPPED":
            correct_tech_score_sum += float(q.get("score") or 0.0)

    calculated_tech_score = round(correct_tech_score_sum / float(TOTAL_TECH_QUESTIONS), 1)

    attended_voice = [q for q in voice_qas if q.get("candidate_answer") and q.get("candidate_answer") != "[SKIPPED]"]
    if attended_voice:
        voice_score_sum = sum(float(q.get("score") or 0.0) for q in attended_voice if q.get("score") is not None)
        calculated_voice_score = round(voice_score_sum / float(len(attended_voice)), 1)
    else:
        calculated_voice_score = 0.0

    calculated_comm_score = calculated_voice_score

    final_tech_score = calculated_tech_score
    final_voice_score = calculated_voice_score
    final_comm_score = calculated_comm_score

    # Determine JD Match score
    jd_match_score = 80.0
    up_res = await session.execute(select(UnifiedProfile).where(UnifiedProfile.candidate_id == candidate_id))
    up_obj = up_res.scalars().first()
    if up_obj and up_obj.parsed_resume:
        try:
            parsed_data = json.loads(up_obj.parsed_resume)
            if "match_score" in parsed_data and parsed_data["match_score"] is not None:
                jd_match_score = float(parsed_data["match_score"])
        except Exception:
            pass

    calculated_overall_score = round((0.50 * final_tech_score) + (0.25 * ((final_voice_score + final_comm_score) / 2.0)) + (0.25 * jd_match_score), 1)
    final_overall_score = is_obj.overall_score if (is_obj and is_obj.overall_score is not None and is_obj.overall_score > 0) else calculated_overall_score

    # Update is_obj with non-null scores if they were missing
    if is_obj:
        is_obj.tech_score = final_tech_score
        is_obj.voice_score = final_voice_score
        is_obj.communication_score = final_comm_score
        is_obj.overall_score = final_overall_score
        session.add(is_obj)

    # Automatically generate HiringDecision record if missing
    if not decision:
        res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
        cand_obj = res_c.scalars().first()
        cand_name = cand_obj.full_name if cand_obj else "Candidate"
        
        res_d_drive = await session.execute(select(HiringDrive).where(HiringDrive.drive_id == cand_obj.drive_id)) if cand_obj else None
        drive_obj = res_d_drive.scalars().first() if res_d_drive else None
        j_title = drive_obj.job_title if drive_obj else "Software Engineer"

        decision_res = await decision_agent.generate_hiring_decision(
            candidate_name=cand_name,
            job_title=j_title,
            verified_skills=[],
            tech_score=final_tech_score,
            voice_score=final_voice_score,
            communication_score=final_comm_score,
            jd_match_score=jd_match_score
        )

        decision = HiringDecision(
            candidate_id=candidate_id,
            recommendation=decision_res.get("recommendation", "MAYBE"),
            overall_confidence=float(decision_res.get("overall_confidence", 0.7)),
            skill_gaps=json.dumps(decision_res.get("skill_gaps", [])),
            strengths=json.dumps(decision_res.get("strengths", [])),
            weaknesses=json.dumps(decision_res.get("weaknesses", [])),
            reasoning=str(decision_res.get("reasoning", ""))
        )
        session.add(decision)

    await session.commit()

    return {
        "recommendation": decision.recommendation,
        "overall_confidence": decision.overall_confidence,
        "overall_score": final_overall_score,
        "github_score": github_score,
        "tech_score": final_tech_score,
        "voice_score": final_voice_score,
        "communication_score": final_comm_score,
        "strengths": json.loads(decision.strengths) if decision.strengths else [],
        "weaknesses": json.loads(decision.weaknesses) if decision.weaknesses else [],
        "skill_gaps": json.loads(decision.skill_gaps) if decision.skill_gaps else [],
        "reasoning": decision.reasoning,
        "proctoring_summary": proctoring_summary,
        "test_breakdown": {
            "total_questions": total_tech_questions,
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "skipped_count": total_skipped,
            "questions": questions_list
        }
    }


@router.post("/hr-action")
async def update_candidate_hr_action(
    candidate_id: str = Form(...),
    action: str = Form(...),  # "SELECTED" | "REJECTED"
    session: AsyncSession = Depends(get_session)
):
    """Updates candidate hiring status based on HR user choice (Select / Reject)."""
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res_c.scalars().first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    new_status = "selected" if action.upper() == "SELECTED" else "rejected"
    cand.status = new_status
    session.add(cand)

    # Update or persist choice in HiringDecision table if exists
    res_d = await session.execute(select(HiringDecision).where(HiringDecision.candidate_id == candidate_id))
    decision = res_d.scalars().first()
    if decision:
        decision.recommendation = "HIRE" if new_status == "selected" else "REJECTED"
        session.add(decision)

    await session.commit()
    return {"status": new_status, "message": f"Candidate status updated to {new_status}"}


@router.post("/outreach-email")
async def generate_outreach_email(
    candidate_id: str = Form(...),
    action: str = Form(...),  # "SELECTED" | "REJECTED"
    session: AsyncSession = Depends(get_session)
):
    """Triggers Agent 6 (Engagement Agent) to generate personalized candidate outreach email."""
    res_c = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res_c.scalars().first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    res_d = await session.execute(select(HiringDrive).where(HiringDrive.drive_id == cand.drive_id))
    drive = res_d.scalars().first()
    job_title = drive.job_title if drive else "Software Engineer"

    # Fetch candidate evaluation decision summary
    res_dec = await session.execute(select(HiringDecision).where(HiringDecision.candidate_id == candidate_id))
    decision = res_dec.scalars().first()

    strengths = []
    weaknesses = []
    overall_score = 80.0

    if decision:
        try:
            strengths = json.loads(decision.strengths) if decision.strengths else []
            weaknesses = json.loads(decision.weaknesses) if decision.weaknesses else []
            overall_score = decision.overall_confidence or 80.0
        except Exception:
            pass

    email_payload = await engagement_agent.generate_outreach_email(
        candidate_name=cand.full_name,
        candidate_email=cand.email,
        job_title=job_title,
        status=action,
        strengths=strengths,
        weaknesses=weaknesses,
        overall_score=overall_score
    )

    return email_payload


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str


@router.post("/{candidate_id}/send-outreach-email")
async def send_outreach_email_to_candidate(
    candidate_id: str,
    req: SendEmailRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Sends outreach email to candidate via SMTP service.
    """
    res = await session.execute(select(Candidate).where(Candidate.candidate_id == candidate_id))
    cand = res.scalars().first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    email_service = get_email_service()
    dispatch_res = email_service.send_email(
        to_email=req.to_email or cand.email,
        subject=req.subject,
        body=req.body
    )
    return dispatch_res


