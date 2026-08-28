import React, { useState } from 'react';
import { X, ShieldCheck, FileText, ExternalLink, CheckCircle2, AlertTriangle, Sparkles, Check, ChevronRight, Filter, Mail, Send, Copy } from 'lucide-react';
import { updateHrAction, generateOutreachEmail, sendOutreachEmail } from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

export default function CandidateDetailModal({ candidate, decision, onClose, onCandidateStatusUpdate }) {
  if (!candidate) return null;

  const [currentStatus, setCurrentStatus] = useState(candidate.status || 'completed');
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [breakdownFilter, setBreakdownFilter] = useState('CORRECT'); // 'CORRECT' | 'WRONG' | 'SKIPPED' | 'VOICE'

  // Agent 6: Engagement Agent State
  const [outreachEmail, setOutreachEmail] = useState(null);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentStatus, setEmailSentStatus] = useState(false);

  const handleSendEmail = async () => {
    if (!outreachEmail) return;
    setIsSendingEmail(true);
    try {
      const res = await sendOutreachEmail(candidate.candidate_id, {
        to_email: outreachEmail.candidate_email || candidate.email,
        subject: outreachEmail.subject,
        body: outreachEmail.body
      });
      setEmailSentStatus(true);
      if (res.simulated) {
        alert(res.message);
      } else {
        alert(`Email successfully dispatched to ${outreachEmail.candidate_email}!`);
      }
    } catch (err) {
      console.error("Error sending outreach email", err);
      alert(err.response?.data?.detail || "Failed to send email. Check SMTP configuration.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const proctoringPassed = decision?.proctoring_summary?.status === 'CLEAN';
  const fsExits = decision?.proctoring_summary?.fullscreen_exits || 0;
  const overallScore = decision?.overall_score !== undefined && decision?.overall_score !== null ? Math.round(decision.overall_score) : 0;

  const questionsList = decision?.test_breakdown?.questions || [];

  const filteredQuestions = questionsList.filter((q) => {
    if (breakdownFilter === 'CORRECT') return q.status === 'CORRECT';
    if (breakdownFilter === 'WRONG') return q.status === 'WRONG';
    if (breakdownFilter === 'SKIPPED') return q.status === 'SKIPPED';
    if (breakdownFilter === 'VOICE') return q.question_type === 'voice_hr' || q.status === 'VOICE_HR';
    return q.status === 'CORRECT';
  });

  const handleHrActionClick = async (action) => {
    setIsSavingAction(true);
    setIsGeneratingEmail(true);
    setEmailSentStatus(false);
    try {
      const res = await updateHrAction(candidate.candidate_id, action);
      setCurrentStatus(res.status);
      if (onCandidateStatusUpdate) {
        onCandidateStatusUpdate();
      }

      // Trigger Agent 6: Engagement Agent
      const emailRes = await generateOutreachEmail(candidate.candidate_id, action);
      setOutreachEmail(emailRes);

      // Smooth scroll down to reveal email preview box
      setTimeout(() => {
        const el = document.getElementById('engagement-email-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error("Error updating candidate HR status or generating outreach email", err);
    } finally {
      setIsSavingAction(false);
      setIsGeneratingEmail(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto font-sans">
      <div className="bg-white max-w-3xl w-full my-auto p-6 sm:p-7 border border-slate-200 rounded-3xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-slate-900">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{candidate.full_name}</h2>
              
              {/* Status Pill with Color Accents */}
              <span className={`text-xs font-mono font-extrabold px-3 py-1 rounded-full border flex items-center space-x-1 ${
                currentStatus === 'selected'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : currentStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {currentStatus === 'selected' ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Shortlisted</span>
                  </>
                ) : currentStatus === 'rejected' ? (
                  <>
                    <X size={13} />
                    <span>Rejected</span>
                  </>
                ) : (
                  <span>Evaluation Complete</span>
                )}
              </span>
            </div>
            
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              {candidate.email} • {candidate.phone}
            </p>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4 Score Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-2xl text-center space-y-0.5">
            <div className="text-2xl font-extrabold text-blue-600 font-mono">{overallScore}%</div>
            <div className="text-[11px] text-blue-800/80 font-bold uppercase tracking-wider">Overall Score</div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-2xl text-center space-y-0.5">
            <div className="text-2xl font-extrabold text-indigo-600 font-mono">
              {candidate?.github_url && candidate?.github_score !== undefined && candidate?.github_score !== null && candidate?.github_score > 0 
                ? `${Math.round(candidate.github_score)}%` 
                : '--'}
            </div>
            <div className="text-[11px] text-indigo-800/80 font-bold uppercase tracking-wider">GitHub Score</div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-2xl text-center space-y-0.5">
            <div className="text-2xl font-extrabold text-emerald-600 font-mono">
              {decision?.tech_score !== undefined && decision?.tech_score !== null ? `${Math.round(decision.tech_score)}%` : '0%'}
            </div>
            <div className="text-[11px] text-emerald-800/80 font-bold uppercase tracking-wider">Tech Score</div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl text-center space-y-0.5">
            <div className="text-2xl font-extrabold text-amber-600 font-mono">
              {decision?.voice_score !== undefined && decision?.voice_score !== null
                ? `${Math.round((decision.voice_score + (decision.communication_score || decision.voice_score)) / 2)}%`
                : '0%'}
            </div>
            <div className="text-[11px] text-amber-800/80 font-bold uppercase tracking-wider">Voice HR</div>
          </div>
        </div>

        {/* Proctoring Banner */}
        {decision?.proctoring_summary && (
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
            proctoringPassed
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/60 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center space-x-2">
              <ShieldCheck size={16} className={proctoringPassed ? 'text-emerald-600' : 'text-rose-600'} />
              <span className="font-semibold">
                Proctoring Integrity: <strong className="font-bold">{proctoringPassed ? 'Clean Record Passed' : 'Violation Detected'}</strong>
              </span>
            </div>

            <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${
              fsExits > 0 ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800'
            }`}>
              Fullscreen Exits: {fsExits} / 2
            </span>
          </div>
        )}

        {/* Interactive Test Performance Trigger Box (Opens Popup Modal) */}
        {decision?.test_breakdown && (
          <div className="space-y-2 pt-1">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
              Assessment Results
            </span>

            <div 
              onClick={() => setShowBreakdownModal(true)}
              className="bg-slate-50 hover:bg-blue-50/50 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 cursor-pointer transition-all flex items-center justify-between group shadow-2xs"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Test Performance Breakdown
                  </div>

                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Click to inspect detailed answers, correct solutions, and voice HR transcripts.
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-xs font-mono font-bold space-x-2 hidden md:flex">
                  <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    ✓ {decision.test_breakdown.correct_count || 0} Correct
                  </span>
                  <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    ✕ {decision.test_breakdown.wrong_count || 0} Wrong
                  </span>
                  <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    {decision.test_breakdown.skipped_count || 0} Skipped
                  </span>
                </div>

                <div className="text-blue-600 group-hover:translate-x-1 transition-transform p-2 rounded-xl bg-blue-50 border border-blue-200">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Evaluation Suggestion */}
        <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-200/70 space-y-1.5">
          <div className="flex items-center space-x-2 text-slate-900 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles size={15} className="text-blue-600" />
            <span>AI Evaluation Suggestion</span>
          </div>

          <p className="text-slate-700 text-xs leading-relaxed font-medium">
            {decision?.reasoning || "Candidate completed technical and voice assessments."}
          </p>
        </div>

        {/* Strengths & Weaknesses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-emerald-50/30 border border-emerald-200/70 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-900 font-extrabold">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Key Strengths</span>
            </div>
            <ul className="space-y-1 text-slate-700 font-medium list-disc list-inside">
              {(decision?.strengths || ["Proven core technical concepts"]).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="bg-rose-50/30 border border-rose-200/70 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-rose-900 font-extrabold">
              <AlertTriangle size={15} className="text-rose-600" />
              <span>Areas for Improvement</span>
            </div>
            <ul className="space-y-1 text-slate-700 font-medium list-disc list-inside">
              {(decision?.weaknesses || ["Improve technical accuracy"]).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* FOOTER: HR DECISION OPTIONS & ACTIONS */}
        <div className="pt-4 space-y-3 border-t border-slate-100">
          
          {/* Row 1: External Profiles & AI Outreach Email */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 text-xs">
              {candidate.github_url && (
                <a 
                  href={candidate.github_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 text-purple-700 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 font-semibold transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>GitHub</span>
                </a>
              )}
              {candidate.linkedin_url && (
                <a 
                  href={candidate.linkedin_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 text-sky-700 hover:text-sky-900 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 font-semibold transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>LinkedIn</span>
                </a>
              )}

              {/* View Resume Pill Box */}
              <button 
                onClick={() => setShowResumeModal(true)}
                className="flex items-center space-x-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold transition-colors cursor-pointer"
              >
                <FileText size={13} className="text-emerald-600" />
                <span>View Resume</span>
              </button>
            </div>

            {currentStatus !== 'completed' && (
              <button
                onClick={() => {
                  if (!outreachEmail && !isGeneratingEmail) {
                    handleHrActionClick(currentStatus === 'selected' ? 'SELECTED' : 'REJECTED');
                  } else {
                    const el = document.getElementById('engagement-email-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center space-x-1.5 cursor-pointer transition-all"
              >
                <Mail size={13} className="text-blue-600" />
                <span>{outreachEmail ? 'View AI Email Draft' : 'Generate Outreach Email'}</span>
              </button>
            )}
          </div>

          {/* Row 2: Core HR Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100/60">
            <button
              onClick={() => handleHrActionClick('REJECTED')}
              disabled={isSavingAction}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                currentStatus === 'rejected'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white'
              }`}
            >
              <span>{currentStatus === 'rejected' ? 'Candidate Rejected' : 'Reject Candidate'}</span>
            </button>

            <button
              onClick={() => handleHrActionClick('SELECTED')}
              disabled={isSavingAction}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                currentStatus === 'selected'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs'
              }`}
            >
              <span>{currentStatus === 'selected' ? '✓ Candidate Shortlisted' : 'Select / Shortlist Candidate'}</span>
            </button>

            <button 
              onClick={onClose}
              className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>

        </div>



        {/* AGENT 6: OUTREACH & SCHEDULING AGENT EMAIL DRAFT */}
        {(isGeneratingEmail || outreachEmail) && (
          <div id="engagement-email-section" className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3 shadow-xl">

            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-xs font-mono font-extrabold text-blue-400">
                <Mail size={16} />
                <span>Agent 6 — Engagement & Outreach Agent</span>
              </div>
              {outreachEmail && (
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-bold">
                  {outreachEmail.status === 'SELECTED' ? 'Interview Invite Draft' : 'Rejection Feedback Draft'}
                </span>
              )}
            </div>

            {isGeneratingEmail ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-2">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
                <p className="font-mono">Engagement Agent synthesizing personalized outreach email...</p>
              </div>
            ) : outreachEmail && (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-1 font-mono">
                  <div><span className="text-slate-400 font-bold">To: </span><span className="text-blue-300">{outreachEmail.candidate_email}</span></div>
                  <div><span className="text-slate-400 font-bold">Subject: </span><span className="text-white font-bold">{outreachEmail.subject}</span></div>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto text-xs">
                  {outreachEmail.body}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={async () => {
                      await copyToClipboard(`Subject: ${outreachEmail.subject}\n\n${outreachEmail.body}`);
                      alert("Email draft copied to clipboard!");
                    }}
                    className="text-xs text-slate-400 hover:text-white font-mono font-bold flex items-center space-x-1"
                  >
                    <Copy size={13} />
                    <span>Copy Email Draft</span>
                  </button>

                  <button
                    onClick={handleSendEmail}
                    disabled={emailSentStatus || isSendingEmail}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                      emailSentStatus
                        ? 'bg-emerald-600 text-white'
                        : isSendingEmail
                        ? 'bg-blue-800 text-slate-300 opacity-75'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                    }`}
                  >
                    {emailSentStatus ? <Check size={14} /> : <Send size={14} />}
                    <span>{emailSentStatus ? 'Email Sent to Candidate!' : isSendingEmail ? 'Sending Email...' : 'Send Email to Candidate'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* POPUP MODAL: DETAILED TEST PERFORMANCE BREAKDOWN */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto font-sans">
          <div className="bg-white max-w-4xl w-full my-auto p-6 sm:p-8 border border-slate-200 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] flex flex-col text-slate-900">
            
            {/* Breakdown Popup Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 shrink-0">
              <div>
                <span className="bg-blue-100 text-blue-800 text-xs font-mono font-extrabold px-3 py-1 rounded-full inline-block mb-1.5">
                  Detailed Test Breakdown
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">{candidate.full_name} — Question Performance</h3>
                <p className="text-xs text-slate-500 mt-0.5">Full question audit, candidate choices, correct solutions, and voice HR transcripts.</p>
              </div>

              <button 
                onClick={() => setShowBreakdownModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl bg-slate-100 border border-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                <Filter size={14} className="text-blue-600" />
                <span>Filter Questions:</span>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs font-mono font-bold">
                <button
                  onClick={() => setBreakdownFilter('CORRECT')}
                  className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    breakdownFilter === 'CORRECT'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  ✓ Correct ({decision?.test_breakdown?.correct_count || 0})
                </button>

                <button
                  onClick={() => setBreakdownFilter('WRONG')}
                  className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    breakdownFilter === 'WRONG'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  ✕ Wrong ({decision?.test_breakdown?.wrong_count || 0})
                </button>

                <button
                  onClick={() => setBreakdownFilter('SKIPPED')}
                  className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    breakdownFilter === 'SKIPPED'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  Skipped ({decision?.test_breakdown?.skipped_count || 0})
                </button>

                <button
                  onClick={() => setBreakdownFilter('VOICE')}
                  className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    breakdownFilter === 'VOICE'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  Voice HR
                </button>
              </div>
            </div>

            {/* Questions Scrollable Audit Body */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {filteredQuestions.map((qItem, idx) => {
                const isVoice = qItem.question_type === 'voice_hr' || qItem.status === 'VOICE_HR';
                const isCorrect = qItem.status === 'CORRECT';
                const isSkipped = qItem.status === 'SKIPPED';

                return (
                  <div key={idx} className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex justify-between items-start gap-3">
                      <span className="font-extrabold text-slate-900 text-sm leading-snug">
                        Q{idx + 1}. {qItem.question}
                      </span>
                      
                      <span className={`px-3 py-1 rounded-lg text-xs font-mono font-extrabold uppercase shrink-0 border ${
                        isVoice
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : isCorrect
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isSkipped
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {isVoice ? 'VOICE HR' : qItem.status}
                      </span>
                    </div>

                    {isVoice ? (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="text-xs text-slate-700 leading-relaxed">
                          <strong className="text-slate-900 font-bold">Candidate Voice Transcript: </strong>
                          <span className="italic">"{qItem.candidate_answer}"</span>
                        </div>
                        {qItem.score !== undefined && (
                          <div className="text-xs text-slate-500 font-mono pt-1 border-t border-slate-100 flex justify-between">
                            <span>Audio AI Evaluation Score:</span>
                            <strong className="text-purple-700 font-bold">{Math.round(qItem.score)}%</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-bold block mb-0.5">Candidate Answer:</span>
                          <span className={`font-extrabold text-sm ${
                            isCorrect ? 'text-emerald-700' : isSkipped ? 'text-amber-700' : 'text-rose-700'
                          }`}>
                            {qItem.candidate_answer || '[SKIPPED]'}
                          </span>
                        </div>

                        {!isCorrect && qItem.correct_answer && (
                          <div>
                            <span className="text-slate-500 font-bold block mb-0.5">Correct Answer:</span>
                            <span className="font-extrabold text-sm text-emerald-700">{qItem.correct_answer}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredQuestions.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold">
                  No questions match the selected filter.
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end shrink-0">
              <button 
                onClick={() => setShowBreakdownModal(false)}
                className="btn-secondary px-6 py-2.5 rounded-xl text-xs font-extrabold"
              >
                Close Breakdown
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP MODAL: IN-WEBSITE RESUME PDF VIEWER */}
      {showResumeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white max-w-5xl w-full h-[90vh] my-auto border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-center bg-slate-900 text-white px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">{candidate.full_name} — Resume PDF</h3>
                  <p className="text-[11px] text-slate-400">In-Website Interactive Resume Viewer</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`/api/v1/candidates/${candidate.candidate_id}/resume`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1"
                >
                  <ExternalLink size={13} />
                  <span>Open in New Tab</span>
                </a>
                <button
                  onClick={() => setShowResumeModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* PDF iframe Viewer */}
            <div className="flex-1 w-full bg-slate-100 relative">
              <iframe
                src={`/api/v1/candidates/${candidate.candidate_id}/resume`}
                title={`${candidate.full_name} Resume`}
                className="w-full h-full border-0 rounded-b-3xl"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}







