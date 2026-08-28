import json
import logging
import re
import random
from typing import Dict, Any, List, Optional

from app.services.nexus_client import get_nexus_service
from app.agents.knowledge_agent import get_knowledge_agent

logger = logging.getLogger(__name__)

def is_gibberish(text: str) -> bool:
    """Detects random keyboard mash / gibberish answers."""
    cleaned = text.strip()
    if not cleaned:
        return True
    
    words = cleaned.split()
    # Extremely long single token with no punctuation or code constructs
    if len(words) == 1 and len(cleaned) > 30 and not re.search(r'[_\-\.\(\)]', cleaned):
        return True

    # Check for excessive repeated char sequences (e.g. 'asdfghjkl')
    gibberish_patterns = [r'[asdfghjkl]{8,}', r'[zxcvbnm]{8,}']
    for pat in gibberish_patterns:
        if re.search(pat, cleaned, re.IGNORECASE):
            return True

    return False


def _normalize_mcq_answer(answer: str) -> tuple:
    """
    Normalizes an MCQ answer by extracting the option letter and the text content separately.
    Returns (letter, cleaned_text) where letter is 'a','b','c','d' or '' and cleaned_text is lowercase stripped content.
    """
    answer = answer.strip()
    # Match option letter prefix like "A)", "B.", "C:", "D-", "A )" etc.
    letter_match = re.match(r'^([A-Da-d])\s*[\)\.\:\-]\s*', answer)
    if letter_match:
        letter = letter_match.group(1).lower()
        text = answer[letter_match.end():].strip().lower()
    else:
        letter = ''
        text = answer.lower()
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return (letter, text)


def _execute_sql_test(candidate_query: str, target_skill: str = "sql") -> Optional[Dict[str, Any]]:
    """
    Safely executes candidate SQL query against an in-memory SQLite database (:memory:).
    Verifies query syntax, execution validity, and returns result status.
    """
    import sqlite3
    query_upper = candidate_query.strip().upper()
    if not any(kw in query_upper for kw in ["SELECT", "INSERT", "UPDATE", "DELETE", "FROM", "WHERE", "GROUP BY", "JOIN", "HAVING"]):
        return None
    try:
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE test_data (id INT, dept TEXT, score INT, sales INT)")
        cursor.executemany("INSERT INTO test_data VALUES (?, ?, ?, ?)", [
            (1, 'Engineering', 95, 1200),
            (2, 'Sales', 80, 2400),
            (3, 'Engineering', 88, 1500)
        ])
        conn.commit()
        
        cursor.execute(candidate_query)
        rows = cursor.fetchall()
        conn.close()
        return {"valid": True, "rows_count": len(rows), "error": None}
    except Exception as e:
        return {"valid": False, "rows_count": 0, "error": str(e)}


class InterviewAgent:
    """
    Agent 3: Interview Agent.
    Manages Technical Round (MCQ + Written questions, dynamic adaptive selection)
    and Voice HR Round (Audio questions, audio response evaluation, communication scoring).
    """
    def __init__(self):
        self.nexus_service = get_nexus_service()
        self.knowledge_agent = get_knowledge_agent()
        self.candidate_generated_questions: Dict[str, set] = {}
        self.voice_hr_cache: Dict[str, Dict[int, Dict[str, Any]]] = {}

    async def generate_profile_popup_summary(
        self,
        candidate_name: str,
        verified_skills: List[Dict[str, Any]],
        github_url: Optional[str],
        linkedin_url: Optional[str],
        match_score: float,
        projects: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Prepares data for candidate popup display before starting interview test."""
        top_skills = [s["skill_name"] for s in verified_skills]
        high_evidence_skills = [s["skill_name"] for s in verified_skills if s.get("evidence_level") == "HIGH"]

        return {
            "candidate_name": candidate_name,
            "match_score": match_score,
            "top_skills": top_skills,
            "projects": projects or [],
            "verified_skills_count": len(verified_skills),
            "high_evidence_skills": high_evidence_skills,
            "contradiction_flags": [],
            "github_url": github_url,
            "github_linked": bool(github_url),
            "linkedin_url": linkedin_url,
            "linkedin_linked": bool(linkedin_url),
            "message": "Your profile has been analyzed! Click 'Start Test' to proceed to the Technical & Voice HR assessment."
        }

    async def generate_technical_question(
        self,
        drive_id: str,
        target_skill: str,
        question_type: str = "mcq",
        question_source: str = "skill",
        difficulty: str = "balanced",
        repo_summary: Optional[List[Dict[str, Any]]] = None,
        candidate_projects: Optional[List[Dict[str, Any]]] = None,
        asked_questions: Optional[List[str]] = None,
        readme_summaries: Optional[List[Dict[str, Any]]] = None,
        candidate_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a targeted technical question (MCQ or Written) using GPT-4.1 Nano.
        Concise 1-2 line questions, short options (1-6 words), balanced between skill concepts and GitHub/resume projects.
        Randomizes Easy / Medium / Hard difficulty, formats code snippets cleanly, and prevents duplicates per candidate.
        """
        import random

        # Randomize Easy / Medium / Hard difficulty if not specified
        if not difficulty or difficulty.lower() in ["balanced", "random", "auto"]:
            chosen_difficulty = random.choice(["Easy", "Medium", "Hard"])
        else:
            chosen_difficulty = difficulty.capitalize()

        diff_instructions = {
            "Easy": "Target EASY / ENTRY-LEVEL difficulty. Test foundational mechanics, direct syntax, primary keyword usage, or straightforward function behavior.",
            "Medium": "Target MEDIUM / INTERMEDIATE difficulty. Test algorithm logic, code output prediction, data structure operations, or multi-step clauses.",
            "Hard": "Target HARD / ADVANCED difficulty. Test complex edge cases, concurrency/async race conditions, window function aggregations, memory/closure mechanics, or architectural trade-offs."
        }
        diff_directive = diff_instructions.get(chosen_difficulty, diff_instructions["Medium"])

        # Track candidate-level asked questions history in-memory + DB to eliminate duplicate questions
        history_set = set(asked_questions or [])
        if candidate_id:
            if candidate_id not in self.candidate_generated_questions:
                self.candidate_generated_questions[candidate_id] = set()
            history_set.update(self.candidate_generated_questions[candidate_id])

        context = self.knowledge_agent.retrieve_context(drive_id, f"technical questions and rubrics for {target_skill}")
        
        # Build candidate repo & project context snippet
        candidate_context_lines = []
        if repo_summary:
            repos_formatted = []
            for r in repo_summary:
                r_name = r.get("name", "")
                r_lang = r.get("language") or "Code"
                r_desc = r.get("description")
                if not r_name or '.github.io' in r_name.lower() or r_name.lower().endswith('.io'):
                    continue
                item_str = f"GitHub Repo: '{r_name}' ({r_lang})"
                if r_desc:
                    item_str += f" - {r_desc}"
                repos_formatted.append(item_str)
            if repos_formatted:
                candidate_context_lines.append("Candidate GitHub Repositories:\n- " + "\n- ".join(repos_formatted))

        if candidate_projects:
            proj_formatted = []
            for p in candidate_projects:
                p_title = (p.get("title") or "").strip()
                p_highlights = p.get("highlights", [])
                if not p_title or '.github.io' in p_title.lower() or re.search(r'https?://', p_title.lower()) or re.search(r'\.(com|org|net|io|dev|app)\b', p_title.lower()):
                    continue
                p_str = f"Project: '{p_title}'"
                if p_highlights:
                    p_str += f" - {p_highlights[0]}"
                proj_formatted.append(p_str)
            if proj_formatted:
                candidate_context_lines.append("Candidate Resume Projects:\n- " + "\n- ".join(proj_formatted))

        # Add README content for richer project-based questions
        readme_context = ""
        if readme_summaries:
            readme_parts = []
            for rm in readme_summaries[:3]:
                repo_name = rm.get("repo_name", "Unknown")
                readme_text = rm.get("readme_text", "")
                if '.github.io' in repo_name.lower() or repo_name.lower().endswith('.io'):
                    continue
                if readme_text:
                    truncated = readme_text[:800]
                    readme_parts.append(f"README of '{repo_name}':\n{truncated}")
            if readme_parts:
                readme_context = "\n\nCandidate GitHub README Documentation:\n" + "\n---\n".join(readme_parts)

        candidate_ctx = "\n\n".join(candidate_context_lines) + readme_context
        previously_asked_ctx = f"\nPREVIOUSLY ASKED QUESTIONS (STRICTLY DO NOT REPEAT OR RE-ASK SIMILAR):\n" + "\n".join(history_set) if history_set else ""

        if question_source == "project" and (repo_summary or candidate_projects or readme_summaries):
            source_directive = (
                "MUST explicitly frame the question scenario directly around one of the candidate's actual "
                "GitHub repositories or resume projects. Use specific details from the README or project description."
            )
        else:
            source_directive = (
                f"Focus directly on core technical mechanics, internal behavior, or best practices of {target_skill}."
            )

        system_prompt = (
            f"You are a Staff Principal Technical Architect generating a crisp, high-value {chosen_difficulty.upper()} technical question.\n"
            "STRICT CONCISENESS & LENGTH RULES:\n"
            "1. MAXIMUM QUESTION LENGTH: The question text MUST be MAXIMUM 2 short sentences (UNDER 25 WORDS TOTAL). Never write multi-paragraph stories!\n"
            "2. MAXIMUM OPTION LENGTH: Each MCQ option MUST be a short, crisp phrase (1 to 8 WORDS MAXIMUM per option). NEVER write long paragraph options!\n"
            f"3. TARGET DIFFICULTY ({chosen_difficulty.upper()}): {diff_directive}\n"
            "4. TOUGH & SMART OPTIONS: The 3 distractor options must be subtle technical traps/misconceptions, but kept strictly under 8 words each.\n"
            "5. NO LETTER PREFIXES: Do NOT put A), B), C), D) prefixes inside option strings or question text.\n"
            f"6. SOURCE TARGET: {source_directive}\n"
            "7. UNIQUENESS: Ensure question is 100% unique."
        )

        if question_type == "mcq":
            user_prompt = f"""
Target Skill: {target_skill}
Target Difficulty: {chosen_difficulty}
Question Source: {question_source.upper()}
Retrieved JD Context: {context}
{candidate_ctx}
{previously_asked_ctx}

Generate a SHORT, PUNCHY {chosen_difficulty}-level Multiple Choice Question (MCQ) testing {target_skill}.
STRICT RULES:
1. Question: 1-2 short sentences (MAX 25 WORDS TOTAL).
2. Options: Exactly 4 short, crisp options (1 to 8 WORDS PER OPTION).
3. Do NOT write long paragraphs. Keep options short, tough, and fast to read.

Format strictly as JSON with keys:
"question": str (max 25 words),
"options": list of 4 str (max 8 words each),
"correct_answer": str (exact text matching the correct option string),
"explanation": str
"""
        else:
            user_prompt = f"""
Target Skill: {target_skill}
Target Difficulty: {chosen_difficulty}
Question Source: {question_source.upper()}
Retrieved JD Context: {context}
{candidate_ctx}
{previously_asked_ctx}

Generate a SHORT, PUNCHY {chosen_difficulty}-level Fill-in-the-Blank technical question testing {target_skill}.
STRICT RULES:
1. Question: 1-2 short sentences (MAX 20 WORDS TOTAL).
2. Target Answer: A single keyword, function name, or short code term expected.

Format strictly as JSON with keys:
"question": str (max 20 words),
"correct_answer": str (short keyword/phrase),
"explanation": str
"""

        response_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.5)
        try:
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            parsed["question_type"] = question_type
            parsed["skill_targeted"] = target_skill
            parsed["difficulty"] = chosen_difficulty

            # Clean question text: strip any hallucinated trailing option choices A) ... B) ... from question field
            q_raw = str(parsed.get("question", "")).strip()
            q_cleaned = re.sub(r'\s*A\)\s+.*$', '', q_raw, flags=re.IGNORECASE | re.DOTALL).strip()
            parsed["question"] = q_cleaned

            # Record in candidate's in-memory history set
            if candidate_id:
                self.candidate_generated_questions[candidate_id].add(q_cleaned.lower())

            # Randomize option order and label A), B), C), D) for MCQs
            if question_type == "mcq" and isinstance(parsed.get("options"), list) and len(parsed["options"]) == 4:
                opts = [str(o).strip() for o in parsed["options"]]
                raw_correct = str(parsed.get("correct_answer", "")).strip()
                matching_idx = 0
                for i, o in enumerate(opts):
                    if o.lower() == raw_correct.lower() or raw_correct.lower() in o.lower():
                        matching_idx = i
                        break
                correct_text = opts[matching_idx]
                
                shuffled = list(opts)
                random.shuffle(shuffled)
                
                relabeled = []
                final_correct = ""
                letters = ["A", "B", "C", "D"]
                for i, text in enumerate(shuffled):
                    lbl = f"{letters[i]}) {text}"
                    relabeled.append(lbl)
                    if text == correct_text:
                        final_correct = lbl
                
                parsed["options"] = relabeled
                parsed["correct_answer"] = final_correct if final_correct else relabeled[0]

            return parsed
        except Exception as e:
            logger.warning(f"Error parsing generated tech question: {e}")
            return {
                "question_type": question_type,
                "skill_targeted": target_skill,
                "difficulty": chosen_difficulty,
                "question": f"In {target_skill}, which pattern is used for thread-safe execution?",
                "options": [
                    "A) Distributed Redis lock",
                    "B) Unbounded memory cache",
                    "C) Global blocking lock",
                    "D) Synchronous database poll"
                ],
                "correct_answer": "A) Distributed Redis lock",
                "explanation": "Distributed locks manage thread safety."
            }

    async def evaluate_technical_answer(
        self,
        question_text: str,
        correct_or_sample_answer: str,
        candidate_answer: str,
        question_type: str = "mcq"
    ) -> Dict[str, Any]:
        """Evaluates candidate's technical answer and returns score. Handles MCQ, Fill-in-the-blank (fill_up), and SQL execution."""
        if not candidate_answer or candidate_answer.strip() == "[SKIPPED]":
            return {
                "score": 0.0,
                "is_correct": False,
                "feedback": "Question was skipped by candidate."
            }

        # For non-MCQ answers, check for gibberish
        if question_type != "mcq" and is_gibberish(candidate_answer):
            return {
                "score": 0.0,
                "is_correct": False,
                "feedback": "Answer was empty or contained random non-sensical input."
            }

        if question_type == "mcq":
            cand_raw = candidate_answer.strip().lower()
            correct_raw = correct_or_sample_answer.strip().lower()
            if cand_raw == correct_raw:
                return {
                    "score": 100.0,
                    "is_correct": True,
                    "feedback": "Correct answer!"
                }

            # Fuzzy MCQ matching: compare by letter AND by text content
            cand_letter, cand_text = _normalize_mcq_answer(candidate_answer)
            correct_letter, correct_text = _normalize_mcq_answer(correct_or_sample_answer)

            # Match by letter if both have letters
            letter_match = bool(cand_letter and correct_letter and cand_letter == correct_letter)
            
            # Match by normalized text content
            cand_clean_norm = re.sub(r'[\s\-_,\.]+', '', cand_text)
            corr_clean_norm = re.sub(r'[\s\-_,\.]+', '', correct_text)
            text_match = (cand_clean_norm == corr_clean_norm) if (cand_clean_norm and corr_clean_norm) else False

            # Substring containment match for edge cases
            substring_match = False
            if cand_text and correct_text:
                substring_match = (cand_text in correct_text or correct_text in cand_text or cand_clean_norm in corr_clean_norm or corr_clean_norm in cand_clean_norm)

            is_correct = letter_match or text_match or substring_match
            score = 100.0 if is_correct else 0.0
            return {
                "score": score,
                "is_correct": is_correct,
                "feedback": "Correct answer!" if is_correct else f"Incorrect. Correct option was: {correct_or_sample_answer}"
            }

        if question_type == "fill_up":
            # Check if answer contains SQL query for in-memory execution test
            sql_test_res = _execute_sql_test(candidate_answer)
            if sql_test_res and sql_test_res.get("valid"):
                return {
                    "score": 100.0,
                    "is_correct": True,
                    "feedback": f"Valid SQL query! Executed successfully in SQLite sandbox ({sql_test_res['rows_count']} rows returned)."
                }

            cand_clean = candidate_answer.strip().lower()
            correct_clean = correct_or_sample_answer.strip().lower()

            cand_normalized = re.sub(r'^[\'"]|[\'"]$', '', cand_clean)
            correct_normalized = re.sub(r'^[\'"]|[\'"]$', '', correct_clean)

            # 1. Exact match (case insensitive)
            exact_match = (cand_clean == correct_clean) or (cand_normalized == correct_normalized)
            
            # 2. Punctuation/hyphen/space-agnostic match (e.g. "z index" vs "z-index", "z_index" vs "z-index")
            no_symbol_cand = re.sub(r'[\s\-_,\.]+', '', cand_normalized)
            no_symbol_corr = re.sub(r'[\s\-_,\.]+', '', correct_normalized)
            symbol_agnostic_match = bool(no_symbol_cand and no_symbol_corr and no_symbol_cand == no_symbol_corr)

            # 3. Substring & Containment match
            substring_match = (
                (cand_normalized in correct_normalized and len(cand_normalized) >= 1) or
                (correct_normalized in cand_normalized and len(correct_normalized) >= 1) or
                (no_symbol_cand in no_symbol_corr and len(no_symbol_cand) >= 2) or
                (no_symbol_corr in no_symbol_cand and len(no_symbol_corr) >= 2)
            )

            # 4. Token set overlap match (split on non-alphanumeric chars)
            cand_tokens = set(re.split(r'[\s\-_,\.]+', cand_normalized))
            correct_tokens = set(re.split(r'[\s\-_,\.]+', correct_normalized))
            cand_tokens.discard('')
            correct_tokens.discard('')
            token_match = bool(cand_tokens and correct_tokens and (cand_tokens.issubset(correct_tokens) or correct_tokens.issubset(cand_tokens)))

            is_correct = exact_match or symbol_agnostic_match or substring_match or token_match
            score = 100.0 if is_correct else 0.0
            return {
                "score": score,
                "is_correct": is_correct,
                "feedback": "Correct answer!" if is_correct else f"Incorrect. Correct answer was: '{correct_or_sample_answer}'"
            }
        else:
            system_prompt = (
                "You are a strict technical evaluator scoring a written candidate response on a 0 to 100 scale. "
                "If the answer is incorrect, irrelevant, superficial, or nonsensical, assign a score of 0.0."
            )
            user_prompt = f"""
Question: {question_text}
Ideal Answer Rubric: {correct_or_sample_answer}
Candidate Answer: {candidate_answer}

Rate accuracy, depth, and technical logic.
Return JSON with keys:
"score": float (0.0 to 100.0),
"feedback": str
"""
            response_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.1)
            try:
                clean_text = response_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_text)
                parsed["score"] = float(parsed.get("score", 0.0))
                return parsed
            except Exception:
                return {"score": 0.0, "feedback": "Answer could not be verified as correct."}

    async def pregenerate_voice_hr_session(
        self,
        candidate_id: str,
        job_title: str = "Software Engineer",
        linkedin_data: Optional[Dict[str, Any]] = None,
        candidate_projects: Optional[List[Any]] = None
    ):
        """Pre-generates all 5 Voice HR questions in background while candidate takes the technical test."""
        if not candidate_id or candidate_id in self.voice_hr_cache:
            return

        self.voice_hr_cache[candidate_id] = {}
        asked_so_far = []
        for q_num in range(1, 6):
            q_res = await self.generate_voice_hr_question(
                question_number=q_num,
                job_title=job_title,
                linkedin_data=linkedin_data,
                candidate_projects=candidate_projects,
                asked_questions=asked_so_far
            )
            if q_res and q_res.get("question_text"):
                asked_so_far.append(q_res["question_text"])
            self.voice_hr_cache[candidate_id][q_num] = q_res

    async def generate_voice_hr_question(
        self, 
        question_number: int, 
        job_title: str = "Software Engineer",
        linkedin_data: Optional[Dict[str, Any]] = None,
        candidate_projects: Optional[List[Any]] = None,
        asked_questions: Optional[List[str]] = None,
        candidate_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates 5 Voice HR questions dynamically across 3 topics:
        Topic 1: Core HR Behavioral (Motivational, Pressure, Teamwork, Value)
        Topic 2: Candidate Resume Projects (Technical ownership & decisions)
        Topic 3: Job Description & Role Fit (Alignment with target job_title)
        """
        # Instant 0ms cache check for pre-generated Voice HR questions
        if candidate_id and candidate_id in self.voice_hr_cache and question_number in self.voice_hr_cache[candidate_id]:
            return self.voice_hr_cache[candidate_id][question_number]
        core_hr_topics = [
            "Why did you choose to apply for this company and role?",
            "What are your long-term career goals and what motivates you?",
            "Describe a challenging team situation and how you resolved it.",
            "How do you handle high pressure or tight project deadlines?",
            "What unique value do you bring to a team that others typically don't?",
            "Tell me about a time you learned a new technology quickly under deadline."
        ]

        question_text = None
        previously_asked_ctx = ""
        if asked_questions:
            previously_asked_ctx = "\nPreviously Asked HR Questions (DO NOT REPEAT):\n" + "\n".join(f"- {q}" for q in asked_questions)

        # Topic Distribution across 5 Questions:
        # Question 1: Behavioral Motivation (Topic 1)
        # Question 2: Candidate Resume Project Scenario (Topic 2)
        # Question 3: Job Description & Role Fit (Topic 3)
        # Question 4: Behavioral Teamwork / Pressure (Topic 1)
        # Question 5: Project / Role Fit Synergy (Topic 2 or 3)
        topic_mode = "behavioral"
        if question_number == 2 or (question_number == 5 and candidate_projects):
            topic_mode = "project"
        elif question_number == 3:
            topic_mode = "jd_fit"

        # 1. Project-Based HR Question (Topic 2)
        if topic_mode == "project" and candidate_projects:
            proj_info = random.choice(candidate_projects)
            proj_title = proj_info.get("title") or proj_info.get("name") if isinstance(proj_info, dict) else str(proj_info)
            proj_desc = proj_info.get("description", "") if isinstance(proj_info, dict) else ""
            
            system_prompt = (
                "You are an HR Director generating a single, clear, conversational HR question inquiring about candidate's project work. "
                "Keep the question natural, direct, under 25 words."
            )
            user_prompt = f"""
Candidate Project Title: {proj_title}
Project Details: {proj_desc}
Target Role: {job_title}
{previously_asked_ctx}

Generate 1 open-ended interview question asking about their role, technical decision, or challenge overcome in project '{proj_title}'.
Return JSON with key: "question_text": str
"""
            try:
                res_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.4)
                clean_text = res_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_text)
                question_text = parsed.get("question_text")
            except Exception as e:
                logger.warning(f"Error generating project HR question: {e}")

        # 2. JD / Role Fit HR Question (Topic 3)
        if topic_mode == "jd_fit" or (topic_mode == "project" and not question_text):
            system_prompt = (
                "You are an HR Director generating a single, professional HR question asking about candidate's fit for the role. "
                "Keep question under 25 words."
            )
            user_prompt = f"""
Target Job Role: {job_title}
{previously_asked_ctx}

Generate 1 open-ended HR interview question about how their skills and background align with the expectations for a {job_title}.
Return JSON with key: "question_text": str
"""
            try:
                res_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.4)
                clean_text = res_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_text)
                question_text = parsed.get("question_text")
            except Exception as e:
                logger.warning(f"Error generating JD fit HR question: {e}")

        # 3. Behavioral Core HR Question (Topic 1 Fallback)
        if not question_text:
            available = [q for q in core_hr_topics if not asked_questions or q not in asked_questions]
            if not available:
                available = core_hr_topics
            question_text = random.choice(available)

        audio_bytes = None
        try:
            audio_bytes = await self.nexus_service.generate_speech(question_text)
        except Exception as e:
            logger.error(f"TTS audio generation error: {e}")

        return {
            "question_number": question_number,
            "question_text": question_text,
            "audio_bytes": audio_bytes
        }

    async def evaluate_voice_hr_response(
        self,
        question_text: str,
        audio_bytes: bytes,
        filename: str = "candidate_voice.wav"
    ) -> Dict[str, Any]:
        """
        Transcribes voice audio using Whisper-1, then evaluates both answer content and communication quality strictly.
        """
        # Step 1: Transcribe Audio using Whisper-1
        transcript = await self.nexus_service.transcribe_audio(audio_bytes, filename)
        
        # Check for empty, noise-only, or blank speech
        cleaned_tr = transcript.strip() if transcript else ""
        noise_keywords = ["thank you", "subtitles", "amara.org", "you", "[blank audio]", "[silence]", "[music]"]
        is_noise = cleaned_tr.lower() in noise_keywords or len(cleaned_tr) < 8

        # Detect non-English / non-Latin characters (Devanagari, Cyrillic, Arabic, Asian scripts)
        has_non_english_script = bool(re.search(r'[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3000-\u9FFF]', cleaned_tr))

        if not cleaned_tr or is_noise or has_non_english_script:
            return {
                "transcript": "[Non-English audio detected - please speak in English]" if has_non_english_script else "[No clear spoken speech detected in audio]",
                "answer_score": 0.0,
                "communication_score": 0.0,
                "feedback": "Non-English speech detected. The HR interview evaluation requires responses in clear English." if has_non_english_script else "No intelligible spoken speech was detected in the audio recording."
            }

        # Step 2: Evaluate Transcript using GPT-4.1 Nano
        system_prompt = (
            "You are an extremely strict Senior HR Director evaluating candidate voice responses for substance, logic, relevance, and professional communication.\n"
            "STRICT SCORING GUIDELINES:\n"
            "1. Off-topic, nonsensical, irrelevant, or fluffy responses (e.g., 'I love to work in the forest', 'I like this company because of my X-TAC') MUST be assigned LOW scores between 0.0 and 25.0.\n"
            "2. Superficial, generic, or brief 1-sentence answers without concrete examples or professional context MUST be assigned scores between 25.0 and 45.0.\n"
            "3. Only well-structured, clear, professional answers directly addressing the question with relevant experience deserve scores of 70.0+.\n"
            "Be uncompromising, realistic, and rigorous."
        )
        user_prompt = f"""
HR Question: {question_text}
Candidate Transcribed Audio Answer: "{cleaned_tr}"

Evaluate:
1. Answer Content Quality (relevance, specificity, depth) 0-100.
2. Communication Quality (clarity, articulation, confidence, professional tone) 0-100.

Return JSON with keys:
"answer_score": float (0.0 to 100.0),
"communication_score": float (0.0 to 100.0),
"feedback": str,
"key_strengths": str
"""
        response_text = await self.nexus_service.generate(system_prompt, user_prompt, temperature=0.2)
        try:
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            result = json.loads(clean_text)
            result["transcript"] = cleaned_tr
            result["answer_score"] = float(result.get("answer_score", 0.0))
            result["communication_score"] = float(result.get("communication_score", 0.0))
            return result
        except Exception:
            return {
                "transcript": cleaned_tr,
                "answer_score": 0.0,
                "communication_score": 0.0,
                "feedback": "Evaluation could not confirm response quality.",
                "key_strengths": "Audio recorded"
            }

_interview_agent_instance = None

def get_interview_agent() -> InterviewAgent:
    global _interview_agent_instance
    if _interview_agent_instance is None:
        _interview_agent_instance = InterviewAgent()
    return _interview_agent_instance
