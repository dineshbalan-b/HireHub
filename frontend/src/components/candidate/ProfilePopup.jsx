import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Github, Linkedin, Award, ArrowRight, Link as LinkIcon, XCircle, Code2, FolderGit2 } from 'lucide-react';

export default function ProfilePopup({ summary, onStartTest }) {
  const [customGithub, setCustomGithub] = useState('');
  const [customLinkedin, setCustomLinkedin] = useState('');

  if (!summary) return null;

  const matchScore = typeof summary.match_score === 'number' ? summary.match_score : 0;
  const isEligible = matchScore >= 45;

  const githubConnected = summary.github_linked || Boolean(customGithub.trim());
  const linkedinConnected = summary.linkedin_linked || Boolean(customLinkedin.trim());

  const handleProceed = () => {
    if (!isEligible) return;
    onStartTest({
      githubUrl: customGithub.trim() || null,
      linkedinUrl: customLinkedin.trim() || null
    });
  };

  const handleCloseTab = () => {
    try {
      window.opener = null;
      window.open('', '_self', '');
      window.close();
    } catch (e) {
      console.log("Browser prevented window.close()", e);
    }
    alert("Application finished. You may safely close this browser tab.");
  };

  const skillsList = summary.top_skills || [];
  const projectsList = summary.projects || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fadeIn select-none">
      <div className="bg-white max-w-4xl lg:max-w-5xl w-full my-auto p-6 sm:p-8 border border-slate-200/90 rounded-3xl shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-slate-900">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider ${
                isEligible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isEligible ? '✓ Eligibility Verified (≥45%)' : '✕ Not Eligible (<45%)'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Candidate Profile Summary
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Review your extracted resume claims, skills matrix, and verified accounts before starting.
            </p>
          </div>

          {/* Score Badge */}
          <div className="flex items-center space-x-3 bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-700 shadow-md shrink-0">
            <div className="text-right">
              <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${isEligible ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Math.round(matchScore)}%
              </div>
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">JD Match Score</div>
            </div>
          </div>
        </div>

        {/* Ineligibility Warning Box */}
        {!isEligible && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-2 text-xs text-rose-800">
            <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm">
              <XCircle size={18} />
              <span>Candidate Not Eligible for Assessment</span>
            </div>
            <p className="leading-relaxed">
              Your resume JD match score is <span className="font-bold text-rose-900 font-mono">{Math.round(matchScore)}%</span>, which does not meet the minimum eligibility threshold of <span className="font-bold text-slate-900 font-mono">45%</span> required for this role.
            </p>
          </div>
        )}

        {/* SECTION 1: Connected Platforms Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* GitHub Card */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`p-2.5 rounded-xl ${githubConnected ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                <Github size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-extrabold text-slate-900">GitHub Profile</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    githubConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {githubConnected ? 'Connected' : 'Not Linked'}
                  </span>
                </div>
                {(summary.github_url || customGithub) ? (
                  <a
                    href={customGithub.trim() || summary.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline truncate block font-mono font-medium pt-0.5"
                  >
                    {customGithub.trim() || summary.github_url}
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono italic">No URL provided</span>
                )}
              </div>
            </div>
          </div>

          {/* LinkedIn Card */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`p-2.5 rounded-xl ${linkedinConnected ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                <Linkedin size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-extrabold text-slate-900">LinkedIn Profile</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    linkedinConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {linkedinConnected ? 'Connected' : 'Form Link'}
                  </span>
                </div>
                {(summary.linkedin_url || customLinkedin) ? (
                  <a
                    href={customLinkedin.trim() || summary.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-600 hover:underline truncate block font-mono font-medium pt-0.5"
                  >
                    {customLinkedin.trim() || summary.linkedin_url}
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono italic">No URL provided</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Skills & Projects Split View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Extracted Skills Matrix Card */}
          <div className="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/90 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-600 font-extrabold text-sm">
                  <Award size={18} />
                  <span>Extracted Technical Skills ({skillsList.length})</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 pr-2">
                {skillsList.length > 0 ? (
                  skillsList.map((skill, idx) => (
                    <span 
                      key={idx} 
                      className="bg-white hover:bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-xl border border-blue-200/80 font-bold font-mono shadow-2xs transition-colors cursor-default"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No skills extracted from resume.</span>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Projects Card */}
          <div className="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/90 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-indigo-600 font-extrabold text-sm">
                <FolderGit2 size={18} />
                <span>Project Experience ({projectsList.length})</span>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {projectsList.length > 0 ? (
                  projectsList.map((proj, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-1 shadow-2xs">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-extrabold text-slate-900 line-clamp-1">{proj.title}</h4>
                        {proj.year && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono font-extrabold border border-indigo-100">
                            {proj.year}
                          </span>
                        )}
                      </div>
                      {proj.highlights && proj.highlights.length > 0 && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                          {proj.highlights[0]}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400 italic">
                    General Software Engineering Experience
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Prompt Candidate if Profiles are Missing */}
        {isEligible && (!summary.github_linked || !summary.linkedin_linked) && (
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
              <LinkIcon size={14} />
              <span>Provide Missing Professional Links</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!summary.github_linked && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">GitHub Profile URL</label>
                  <input
                    type="url"
                    value={customGithub}
                    onChange={(e) => setCustomGithub(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                  />
                </div>
              )}

              {!summary.linkedin_linked && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={customLinkedin}
                    onChange={(e) => setCustomLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky Action Footer */}
        <div className="pt-2 border-t border-slate-100">
          {isEligible ? (
            <button
              onClick={handleProceed}
              className="w-full btn-primary py-4 rounded-2xl font-extrabold text-base flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer"
            >
              <span>Proceed to Technical & Voice HR Test</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleCloseTab}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 py-3.5 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>End Application & Close Tab</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
