import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('hr_user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/apply')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (name, email, password) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

// HR Drives APIs
export const getDrives = async () => {
  const response = await api.get('/hr/drives/');
  return response.data;
};

export const createDrive = async (driveData) => {
  const response = await api.post('/hr/drives/', driveData);
  return response.data;
};

export const getDriveCandidates = async (driveId) => {
  const response = await api.get(`/hr/drives/${driveId}/candidates`);
  return response.data;
};

export const deleteDrive = async (driveId) => {
  const response = await api.delete(`/hr/drives/${driveId}`);
  return response.data;
};

export const deleteCandidate = async (driveId, candidateId) => {
  const response = await api.delete(`/hr/drives/${driveId}/candidates/${candidateId}`);
  return response.data;
};

// Candidate Portal APIs
export const applyAsCandidate = async (driveId, formData) => {
  const response = await api.post(`/candidates/apply/${driveId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getProfileSummary = async (candidateId) => {
  const response = await api.get(`/candidates/profile-summary/${candidateId}`);
  return response.data;
};

export const getTechQuestion = async (candidateId, driveId, targetSkill, questionType = 'mcq', questionSource = 'skill') => {
  const formData = new FormData();
  formData.append('candidate_id', candidateId);
  formData.append('drive_id', driveId);
  formData.append('target_skill', targetSkill);
  formData.append('question_type', questionType);
  formData.append('question_source', questionSource);
  const response = await api.post('/candidates/interview/tech-question', formData);
  return response.data;
};

export const submitTechAnswer = async (candidateId, questionText, correctAnswer, candidateAnswer, questionType = 'mcq') => {
  const formData = new FormData();
  formData.append('candidate_id', candidateId);
  formData.append('question_text', questionText);
  formData.append('correct_answer', correctAnswer);
  formData.append('candidate_answer', candidateAnswer);
  formData.append('question_type', questionType);
  const response = await api.post('/candidates/interview/tech-answer', formData);
  return response.data;
};

export const getVoiceQuestion = async (questionNumber = 1, jobTitle = 'Software Engineer', candidateId = null) => {
  const formData = new FormData();
  formData.append('question_number', questionNumber);
  formData.append('job_title', jobTitle);
  if (candidateId) formData.append('candidate_id', candidateId);
  const response = await api.post('/candidates/interview/voice-question', formData);
  return response.data;
};

export const submitVoiceAnswer = async (formData) => {
  const response = await api.post('/candidates/interview/voice-answer', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const skipVoiceQuestion = async (candidateId, questionText) => {
  const formData = new FormData();
  formData.append('candidate_id', candidateId);
  formData.append('question_text', questionText);
  const response = await api.post('/candidates/interview/voice-skip', formData);
  return response.data;
};

export const completeInterview = async (
  candidateId, 
  techScore, 
  voiceScore, 
  communicationScore,
  tabSwitches = 0,
  fullscreenExits = 0,
  proctoringStatus = "CLEAN"
) => {
  const formData = new FormData();
  formData.append('tech_score', techScore);
  formData.append('voice_score', voiceScore);
  formData.append('communication_score', communicationScore);
  formData.append('tab_switches', tabSwitches);
  formData.append('fullscreen_exits', fullscreenExits);
  formData.append('proctoring_status', proctoringStatus);
  const response = await api.post(`/candidates/interview/complete/${candidateId}`, formData);
  return response.data;
};

export const getCandidateDecision = async (candidateId) => {
  const response = await api.get(`/candidates/decision/${candidateId}`);
  return response.data;
};

export const updateHrAction = async (candidateId, action) => {
  const formData = new FormData();
  formData.append('candidate_id', candidateId);
  formData.append('action', action);
  const response = await api.post('/candidates/hr-action', formData);
  return response.data;
};

export const generateOutreachEmail = async (candidateId, action) => {
  const formData = new FormData();
  formData.append('candidate_id', candidateId);
  formData.append('action', action);
  const response = await api.post('/candidates/outreach-email', formData);
  return response.data;
};

export const sendOutreachEmail = async (candidateId, payload) => {
  const response = await api.post(`/candidates/${candidateId}/send-outreach-email`, payload);
  return response.data;
};

export default api;


