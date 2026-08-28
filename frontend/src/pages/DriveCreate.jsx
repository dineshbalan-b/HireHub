import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Building, FileText, CheckCircle2, ArrowLeft, Upload } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import { createDrive } from '../services/api';

export default function DriveCreate() {
  const navigate = useNavigate();

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [minExperience, setMinExperience] = useState(2);
  const [minCgpa, setMinCgpa] = useState(7.0);
  const [constraints, setConstraints] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const skillsArray = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
      const drivePayload = {
        job_title: jobTitle,
        company_name: companyName,
        job_description: jobDescription,
        required_skills: skillsArray,
        min_experience: Number(minExperience),
        min_cgpa: Number(minCgpa),
        constraints: constraints.trim() ? { rules: constraints.trim() } : null
      };

      const res = await createDrive(drivePayload);
      alert(`Hiring drive created successfully!\nCandidate Application Link: ${window.location.origin}${res.application_link}`);
      navigate('/dashboard');
    } catch (err) {
      console.error("Error creating drive:", err);
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : err.message || "Failed to create hiring drive.");
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 mb-6 text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Create New Hiring Drive</h1>
            <p className="text-slate-500 text-sm mt-1">Fill in the job details. Knowledge Agent (RAG) will index the parameters into ChromaDB.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Job Title *</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <Briefcase size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Senior AI Systems Engineer"
                  className="input-field input-field-icon w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Company Name *</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <Building size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Navigate Labs"
                  className="input-field input-field-icon w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Job Description (JD) *</label>
              <textarea
                rows={5}
                required
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste full Job Description here. Knowledge Agent will chunk and generate embeddings for ChromaDB..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Required Skills (Comma separated) *</label>
              <input
                type="text"
                required
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="Python, FastAPI, LangGraph, Vector DB, RAG"
                className="input-field w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Min Experience (Years)</label>
                <input
                  type="number"
                  min="0"
                  value={minExperience}
                  onChange={(e) => setMinExperience(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Min CGPA / Grade</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Hiring Constraints / Rules (Optional)</label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="Must have verified GitHub activity; Remote position"
                className="input-field w-full"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3.5 rounded-xl font-bold text-base mt-4 shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? 'Ingesting Knowledge & Creating Drive...' : 'Create Hiring Drive & Index RAG'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}


