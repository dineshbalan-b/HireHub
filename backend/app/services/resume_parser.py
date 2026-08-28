import re
import fitz  # PyMuPDF
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Common tech skill keywords for fallback parsing
SKILL_KEYWORDS = [
    "Python", "FastAPI", "Flask", "Django", "JavaScript", "TypeScript", "React", "Node.js",
    "Vue", "Angular", "HTML", "CSS", "TailwindCSS", "SQL", "SQLite", "PostgreSQL", "MySQL",
    "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "GitHub",
    "PyTorch", "TensorFlow", "Scikit-Learn", "spaCy", "NLTK", "OpenCV", "LangChain",
    "LangGraph", "ChromaDB", "Pinecone", "Vector DB", "RAG", "LLM", "REST API", "GraphQL",
    "C++", "Java", "C#", "Go", "Rust", "Linux", "CI/CD", "Microservices", "CNNs", "YOLO",
    "Voice AI", "AI Agents", "Machine Learning", "Prompt Engineering"
]

# Non-project title patterns to filter out
_NOISE_TITLES = {
    "soft skills", "courses", "certifications", "education", "hobbies",
    "languages", "declaration", "summary", "personal details", "contact",
    "technical skills", "academic background", "references", "achievements",
    "work experience", "internships", "extracurricular", "responsibilities",
    "problem-solving", "team collaboration", "adaptability", "attention to detail",
    "skills", "objective", "profile", "about me", "interests"
}

def _is_non_project_title(title: str) -> bool:
    """Returns True if the title is a URL, GitHub Pages link, section header, or non-project noise."""
    t = title.strip()
    lower_t = t.lower()

    # Skip URLs (github.io, http links, .com domains, etc.)
    if re.search(r'\.github\.io', lower_t):
        return True
    if re.search(r'https?://', lower_t):
        return True
    if re.search(r'\.(com|org|net|io|dev|app|co)\b', lower_t):
        return True

    # Skip section headers and soft skills
    if any(noise in lower_t for noise in _NOISE_TITLES):
        return True

    # Skip if title is just a single word and too generic
    if len(t.split()) <= 1 and lower_t in {"project", "projects", "portfolio", "resume", "cv", "profile"}:
        return True

    return False


# Expanded noise filters for education, degrees, locations, scores, and sentence fragments
_EDUCATION_LOCATION_NOISE = {
    "institute", "college", "university", "school", "academy", "campus", "polytechnic",
    "b.tech", "m.tech", "b.e", "b.sc", "m.sc", "bca", "mca", "diploma", "hsc", "sslc",
    "degree", "education", "academics", "score", "cgpa", "gpa", "percentage", "marks",
    "bannari", "amman", "secondary", "government",
    # Places / Locations in India & globally
    "erode", "sathyamangalam", "dharmapuri", "vathalmalai", "coimbatore", "chennai",
    "bangalore", "bengaluru", "hyderabad", "mumbai", "delhi", "pune", "salem", "madurai",
    "trichy", "tirupur", "karur", "namakkal", "kerala", "tamil nadu", "india",
    # Common sentence words / prepositions / verbs
    "showcasing", "handwritten", "sketches", "practical", "use", "using", "built",
    "developed", "created", "working", "knowledge", "fundamentals"
}

_NOISE_SKILLS = {
    "declaration", "objective", "summary", "profile", "about me", "interests",
    "hobbies", "references", "education", "academics", "certifications",
    "experience", "work experience", "internship", "internships", "projects",
    "project", "achievements", "responsibilities", "personal details", "contact",
    "courses", "soft skills", "extracurricular", "languages known",
    "problem solving", "teamwork", "team collaboration", "adaptability",
    "attention to detail", "communication", "leadership", "time management",
    "critical thinking", "creativity", "self motivated", "detail oriented"
}

def clean_and_normalize_skill(skill_text: str) -> str:
    """Normalizes skill text by stripping leading conjunctions, bullets, and trailing punctuation."""
    s = skill_text.strip()
    s = re.sub(r'^[•\*\-\s\.\,]+', '', s)
    s = re.sub(r'[\.\,\;]+$', '', s).strip()
    # Strip leading prepositions (e.g. 'and large language models' -> 'Large Language Models')
    s = re.sub(r'^(?:and|of|in|with|using|for|to|on|by|at|from)\s+', '', s, flags=re.IGNORECASE).strip()
    return s

def _is_non_skill(skill_text: str, candidate_name: str = "") -> bool:
    """Returns True if the text is a person name, college/school name, location, score, year, or non-technical noise."""
    s = clean_and_normalize_skill(skill_text)
    if not s or len(s) < 2 or len(s) > 40:
        return True

    lower_s = s.lower()

    # 1. Skip years, scores, percentages (e.g. '2026', 'Score:69%', '85%')
    if re.search(r'^\d{4}$', s) or re.search(r'score[:\s]*\d+', lower_s) or re.search(r'\d+%', lower_s):
        return True

    # 2. Skip candidate name parts
    if candidate_name:
        name_parts = [p.lower() for p in candidate_name.split() if len(p) > 2]
        if any(part in lower_s for part in name_parts) and not any(tech in lower_s for tech in ['python', 'java', 'react', 'node', 'sql', 'git', 'docker', 'aws', 'api', 'ai', 'ml']):
            return True

    # 3. Skip URLs, emails, phone numbers
    if re.search(r'https?://', lower_s) or re.search(r'\.(com|org|net|io|dev|app|github)\b', lower_s) or '@' in s or re.match(r'^[\d\s\+\-\(\)]{7,}$', s):
        return True

    # 4. Skip Education & Location terms (e.g., 'Bannari Amman', 'Erode', 'B.Tech', 'School', 'Sathyamangalam')
    valid_tech_exceptions = ["computer vision", "large language models", "deep learning", "machine learning", "data science", "data structures", "cloud computing"]
    for noise_word in _EDUCATION_LOCATION_NOISE:
        if noise_word in lower_s:
            if not any(v in lower_s for v in valid_tech_exceptions):
                return True

    # 5. Skip noise section headers & soft skills
    if lower_s in _NOISE_SKILLS or any(noise == lower_s for noise in _NOISE_SKILLS):
        return True

    # 6. Skip ALL CAPS section headers (2+ words, all uppercase, no tech keywords)
    words = s.split()
    if len(words) >= 2 and s == s.upper() and not any(tech in lower_s for tech in ['api', 'sql', 'css', 'html', 'aws', 'gcp', 'ci/cd', 'llm', 'rag', 'nlp', 'cnn', 'yolo', 'jdbc', 'oop', 'dsa', 'ml', 'ai']):
        return True

    return False


class ResumeParser:
    def __init__(self):
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
        except Exception:
            logger.warning("spaCy model en_core_web_sm not found, using regex extraction fallback.")
            self.nlp = None

    def extract_text_and_links(self, pdf_path: str) -> Dict[str, Any]:
        """Extract text and PDF embedded link URIs using PyMuPDF."""
        try:
            doc = fitz.open(pdf_path)
            full_text = []
            extracted_uris = []

            for page in doc:
                full_text.append(page.get_text())
                # Extract embedded link annotations (hyperlinks)
                for link in page.get_links():
                    uri = link.get("uri")
                    if uri:
                        extracted_uris.append(uri)

            doc.close()
            return {
                "text": "\n".join(full_text),
                "uris": extracted_uris
            }
        except Exception as e:
            logger.error(f"Error extracting text and links from {pdf_path}: {e}")
            return {"text": "", "uris": []}

    def _extract_skills_from_section(self, text: str) -> List[str]:
        """Dynamically extracts all skill items listed under the SKILLS section of the resume."""
        skills = set()
        
        # Locate SKILLS header
        header_match = re.search(
            r'^\s*(?:SKILLS|TECHNICAL SKILLS|SKILLS & EXPERTISE|KEY SKILLS|CORE COMPETENCIES)\s*$', 
            text, 
            re.MULTILINE | re.IGNORECASE
        )
        if not header_match:
            header_match = re.search(r'\b(?:SKILLS|TECHNICAL SKILLS)\b', text, re.IGNORECASE)
            
        if header_match:
            start_pos = header_match.end()
            # Find next major standalone section header
            next_section_match = re.search(
                r'^\s*(?:PROJECT|PROJECTS|PROJECT EXPERIENCE|EXPERIENCE|WORK EXPERIENCE|INTERNSHIP|INTERNSHIPS|EDUCATION|ACADEMICS|CERTIFICATIONS|PUBLICATIONS|ADDITIONAL)\s*$',
                text[start_pos:],
                re.MULTILINE | re.IGNORECASE
            )
            end_pos = start_pos + next_section_match.start() if next_section_match else len(text)
            section_text = text[start_pos:end_pos]

            for line in section_text.split('\n'):
                cleaned_line = line.strip()
                if not cleaned_line:
                    continue
                # Remove leading bullet points
                cleaned_line = re.sub(r'^[•\*\-\s]+', '', cleaned_line)
                # If line has category prefix like 'Languages:', remove it
                if ':' in cleaned_line:
                    cleaned_line = cleaned_line.split(':', 1)[1]
                
                # Split items by comma, bullet, slash
                items = re.split(r'[,•|]', cleaned_line)
                for item in items:
                    clean_item = item.strip()
                    if clean_item and 1 < len(clean_item) < 50:
                        if not re.match(r'^(and|or|with|using|etc\.?)$', clean_item, re.IGNORECASE):
                            skills.add(clean_item)
                            
        return list(skills)

    def _extract_projects(self, text: str) -> List[Dict[str, Any]]:
        """Dynamically extracts all project titles, years, and descriptions from the resume."""
        projects = []
        header_match = re.search(
            r'^\s*(?:PROJECT EXPERIENCE|PROJECTS|KEY PROJECTS|PROJECT|ACADEMIC PROJECTS|PERSONAL PROJECTS|FEATURED PROJECTS)\s*$', 
            text, 
            re.MULTILINE | re.IGNORECASE
        )
        if not header_match:
            header_match = re.search(
                r'\b(?:PROJECT EXPERIENCE|PROJECTS|KEY PROJECTS|PROJECT|ACADEMIC PROJECTS|PERSONAL PROJECTS)\b', 
                text, 
                re.IGNORECASE
            )
        if not header_match:
            return projects

        start_pos = header_match.end()
        # Require standalone line header match to prevent matching words inside bullet point sentences
        next_section_match = re.search(
            r'^\s*(?:INTERNSHIP|INTERNSHIPS|INTERNSHIP EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|EDUCATION|ACADEMICS|CERTIFICATIONS|PUBLICATIONS|ADDITIONAL INFORMATION)\s*$',
            text[start_pos:],
            re.MULTILINE | re.IGNORECASE
        )
        end_pos = start_pos + next_section_match.start() if next_section_match else len(text)
        section_text = text[start_pos:end_pos].strip()

        lines = [l.strip() for l in section_text.split('\n') if l.strip()]
        current_project = None

        dangling_words = {"and", "or", "with", "using", "for", "that", "in", "to", "of", "a", "the", "by", "on", "from", "as", "via", "is", "are"}

        for line in lines:
            is_bullet = bool(re.match(r'^[•\*\-\s]', line))
            year_match = re.search(r'(\b20\d{2}\b)', line)
            
            # Sentence fragment validation
            lower_line = line.lower().strip()
            words = lower_line.split()
            starts_lowercase = line[0].islower() if line else False
            starts_dangling = words[0] in dangling_words if words else False
            ends_dangling = words[-1] in dangling_words if words else False
            too_long = len(words) > 10

            is_invalid_title = starts_lowercase or starts_dangling or ends_dangling or too_long

            is_title_candidate = not is_bullet and not is_invalid_title and (year_match or line.isupper() or not line.endswith('.'))

            if is_title_candidate:
                year = year_match.group(1) if year_match else None
                title = re.sub(r'(\b20\d{2}\b)', '', line).strip()
                title = re.sub(r'^[•\*\-\s]+', '', title).strip()
                
                # Skip GitHub Pages URLs, portfolio links, and non-project items
                if _is_non_project_title(title):
                    continue

                if current_project:
                    projects.append(current_project)
                current_project = {
                    'title': title,
                    'year': year,
                    'highlights': []
                }
            elif is_bullet:
                cleaned_bullet = re.sub(r'^[•\*\-\s]+', '', line).strip()
                if current_project:
                    current_project['highlights'].append(cleaned_bullet)
            else:
                if current_project:
                    if current_project['highlights']:
                        current_project['highlights'][-1] += ' ' + line
                    else:
                        current_project['highlights'].append(line)
                    
        if current_project:
            projects.append(current_project)
            
        return projects

    def parse(self, pdf_path: str) -> Dict[str, Any]:
        """Parses a resume PDF and extracts structured candidate data."""
        data = self.extract_text_and_links(pdf_path)
        text = data["text"]
        uris = data["uris"]
        
        # 1. Extract Email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        email = email_match.group(0) if email_match else None

        # 2. Extract Phone
        phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
        phone = phone_match.group(0) if phone_match else None

        # 3. Extract GitHub URL & Username
        github_url = None
        github_username = None
        
        gh_match = re.search(r'(?:https?://)?(?:www\.)?github\.com/\s*([a-zA-Z0-9_-]+)', text, re.IGNORECASE)
        if not gh_match:
            gh_match = re.search(r'\bgithub[:\s]+(?:https?://)?(?:www\.)?(?:github\.com/)?([a-zA-Z0-9_-]+)', text, re.IGNORECASE)
        if gh_match:
            candidate_u = gh_match.group(1).strip()
            if candidate_u.lower() not in {"projects", "repositories", "profile", "com", "org", "net", "io", "dev", "app"}:
                github_username = candidate_u
                github_url = f"https://github.com/{github_username}"

        if not github_url:
            for uri in uris:
                if "github.com" in uri.lower():
                    gh_uri_match = re.search(r'github\.com/([a-zA-Z0-9_-]+)', uri, re.IGNORECASE)
                    if gh_uri_match:
                        candidate_u = gh_uri_match.group(1).strip()
                        if candidate_u.lower() not in {"projects", "repositories", "profile", "com"}:
                            github_username = candidate_u
                            github_url = f"https://github.com/{github_username}"
                            break

        # 4. Extract LinkedIn URL
        linkedin_url = None
        li_match = re.search(r'(?:https?://)?(?:www\.)?linkedin\.com/(?:in|profile)/([a-zA-Z0-9_-]+)', text, re.IGNORECASE)
        if not li_match:
            li_match = re.search(r'\blinkedin[:\s]+(?:https?://)?(?:www\.)?(?:linkedin\.com/in/)?([a-zA-Z0-9_-]+)', text, re.IGNORECASE)
        if li_match:
            linkedin_url = f"https://linkedin.com/in/{li_match.group(1).strip()}"

        if not linkedin_url:
            for uri in uris:
                if "linkedin.com" in uri.lower():
                    li_uri_match = re.search(r'linkedin\.com/(?:in|profile)/([a-zA-Z0-9_-]+)', uri, re.IGNORECASE)
                    if li_uri_match:
                        linkedin_url = f"https://linkedin.com/in/{li_uri_match.group(1).strip()}"
                        break

        # 5. Extract CGPA
        cgpa_match = re.search(r'(?:CGPA|GPA|Grade)[:\s]*([0-9]\.[0-9]{1,2}|\d{1,2}(?:\.\d)?(?=\s*(?:/|out of)\s*10))', text, re.IGNORECASE)
        cgpa = float(cgpa_match.group(1)) if cgpa_match else None

        # 6. Extract Skills (Combine Section-based dynamic parsing & Keyword matching with strict technical filter)
        section_skills = self._extract_skills_from_section(text)
        keyword_skills = []
        for skill in SKILL_KEYWORDS:
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                keyword_skills.append(skill)

        all_skills_map = {}
        for raw_s in section_skills + keyword_skills:
            cleaned_s = clean_and_normalize_skill(str(raw_s))
            if cleaned_s and not _is_non_skill(cleaned_s, candidate_name=""):
                key = cleaned_s.lower()
                if key not in all_skills_map:
                    all_skills_map[key] = cleaned_s

        found_skills = list(all_skills_map.values())

        # 7. Extract Projects
        projects = self._extract_projects(text)

        # 8. spaCy / Header Name extraction
        name = None
        first_line = [line.strip() for line in text.split('\n') if line.strip()]
        if first_line:
            candidate_first_line = first_line[0]
            if len(candidate_first_line.split()) <= 4 and not any(char in candidate_first_line for char in ['@', 'http', '+', ':']):
                name = candidate_first_line

        if not name and self.nlp:
            doc = self.nlp(text[:500])
            for ent in doc.ents:
                if ent.label_ == "PERSON" and len(ent.text.split()) >= 2:
                    name = ent.text.strip()
                    break

        return {
            "name": name or "Candidate",
            "email": email,
            "phone": phone,
            "github_url": github_url,
            "github_username": github_username,
            "linkedin_url": linkedin_url,
            "cgpa": cgpa,
            "skills": found_skills,
            "projects": projects,
            "raw_text_length": len(text),
            "raw_text": text,
            "certificates_detected": ["Certificate detected in resume text"] if "certificate" in text.lower() or "certified" in text.lower() else []
        }

    async def parse_async(self, pdf_path: str) -> Dict[str, Any]:
        """Asynchronously parses resume using PyMuPDF + LLM (NexusAIService) structured extraction."""
        base_data = self.parse(pdf_path)
        raw_text = base_data.get("raw_text", "")
        
        if not raw_text or len(raw_text.strip()) < 20:
            return base_data

        try:
            from app.services.nexus_client import get_nexus_service
            import json
            nexus = get_nexus_service()

            system_prompt = (
                "You are an elite Candidate Intelligence Resume Parser AI.\n"
                "Extract structured candidate information from raw resume text accurately into JSON format.\n"
                "RULES FOR EXTRACTION:\n"
                "1. SKILLS: Extract ONLY technical skills, programming languages, frameworks, libraries, databases, tools, and platforms. "
                "NEVER include: person names, college/school names, degrees (B.Tech, M.Tech), locations (city/state names), section headers (DECLARATION, OBJECTIVE, SUMMARY), "
                "scores, dates, or soft skills!\n"
                "2. PROJECTS: Extract ONLY actual software/technical/engineering projects (e.g., 'E-Commerce Web App', 'Heart Disease ML Model', 'Smart Asset Tracker'). "
                "CRITICAL: DO NOT include section headers, portfolio URLs (*.github.io), soft skills, or personal attributes as projects!\n"
                "3. Each project MUST be an object with keys: 'title': str (clean project name), 'year': str (e.g. '2024' or null), 'highlights': list of str (1-2 bullet points explaining what was built).\n"
                "Format strictly as JSON with keys: 'name', 'email', 'phone', 'github_url', 'linkedin_url', 'cgpa', 'skills', 'projects'."
            )

            user_prompt = f"Resume PDF Text:\n{raw_text[:12000]}"

            resp = await nexus.generate(system_prompt, user_prompt, temperature=0.1)
            clean_json = resp.replace("```json", "").replace("```", "").strip()
            llm_data = json.loads(clean_json)

            # Combine LLM extractions with base PyMuPDF URIs & regex fallbacks
            llm_skills = llm_data.get("skills") if isinstance(llm_data.get("skills"), list) else []
            candidate_name = llm_data.get("name") or base_data.get("name") or ""

            all_skills_map = {}
            for raw_s in (llm_skills + base_data.get("skills", [])):
                cleaned_s = clean_and_normalize_skill(str(raw_s))
                if cleaned_s and not _is_non_skill(cleaned_s, candidate_name):
                    key = cleaned_s.lower()
                    if key not in all_skills_map:
                        all_skills_map[key] = cleaned_s

            final_skills = list(all_skills_map.values())
            
            raw_llm_projects = llm_data.get("projects") if isinstance(llm_data.get("projects"), list) else []
            candidate_projects = raw_llm_projects or base_data.get("projects", [])

            # Filter out non-project items (URLs, section headers, soft skills)
            final_projects = []
            for p in candidate_projects:
                if isinstance(p, dict):
                    t = (p.get("title") or "").strip()
                    if t and not _is_non_project_title(t) and len(t.split()) <= 8:
                        final_projects.append(p)

            return {
                "name": llm_data.get("name") or base_data.get("name") or "Candidate",
                "email": llm_data.get("email") or base_data.get("email"),
                "phone": llm_data.get("phone") or base_data.get("phone"),
                "github_url": llm_data.get("github_url") or base_data.get("github_url"),
                "github_username": base_data.get("github_username"),
                "linkedin_url": llm_data.get("linkedin_url") or base_data.get("linkedin_url"),
                "cgpa": llm_data.get("cgpa") if llm_data.get("cgpa") is not None else base_data.get("cgpa"),
                "skills": final_skills,
                "projects": final_projects,
                "raw_text_length": len(raw_text),
                "certificates_detected": base_data.get("certificates_detected", [])
            }
        except Exception as e:
            logger.warning(f"LLM resume parsing fallback to regex: {e}")
            return base_data

_resume_parser_instance = None

def get_resume_parser() -> ResumeParser:
    global _resume_parser_instance
    if _resume_parser_instance is None:
        _resume_parser_instance = ResumeParser()
    return _resume_parser_instance
