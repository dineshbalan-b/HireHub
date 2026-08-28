from typing import TypedDict, Optional, List, Dict, Any

class AgentState(TypedDict):
    candidate_id: str
    drive_id: str
    job_title: str
    resume_path: str
    user_github_url: Optional[str]
    user_linkedin_url: Optional[str]
    self_reported_linkedin: Optional[Dict[str, Any]]
    
    # Agent 1 Outputs
    unified_profile: Optional[Dict[str, Any]]
    verified_skills: Optional[List[Dict[str, Any]]]
    
    # Agent 2 Outputs
    match_result: Optional[Dict[str, Any]]
    eligibility: Optional[str]  # "ELIGIBLE" | "NOT_ELIGIBLE"
    
    # Agent 3 Outputs
    profile_popup_summary: Optional[Dict[str, Any]]
    technical_qa_list: Optional[List[Dict[str, Any]]]
    voice_hr_qa_list: Optional[List[Dict[str, Any]]]
    tech_score: Optional[float]
    voice_score: Optional[float]
    communication_score: Optional[float]
    
    # Agent 4 Outputs
    decision: Optional[Dict[str, Any]]
    
    # Agent 5 Outputs
    memory_persisted: Optional[bool]
    current_node: str
    error: Optional[str]
