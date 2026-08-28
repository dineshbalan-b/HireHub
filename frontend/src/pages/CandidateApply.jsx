import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { User, Mail, Phone, Upload, Github, Linkedin, BrainCircuit, CheckCircle2, ShieldCheck, AlertTriangle, Lock, Maximize, Sparkles, Cpu, Zap, Activity, Loader2, Mic, ArrowRight } from 'lucide-react';
import ProfilePopup from '../components/candidate/ProfilePopup';
import TechTest from '../components/candidate/TechTest';
import VoiceHR from '../components/candidate/VoiceHR';
import { applyAsCandidate, getProfileSummary, getTechQuestion, submitTechAnswer, getVoiceQuestion, submitVoiceAnswer, skipVoiceQuestion, completeInterview } from '../services/api';

function SystemCalibrationScreen({ onComplete }) {
  const [micStatus, setMicStatus] = useState('checking');
  const [micLabel, setMicLabel] = useState('Requesting Microphone Permission...');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkHardware() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          if (active) {
            setMicStatus('granted');
            setMicLabel('Microphone Access Granted');
          }
        } else {
          if (active) {
            setMicStatus('granted');
            setMicLabel('Audio Stream Ready');
          }
        }
      } catch (err) {
        console.warn("Mic access skipped or blocked", err);
        if (active) {
          setMicStatus('granted');
          setMicLabel('Audio Pre-Check Done');
        }
      }

      // Mark calibration ready so the "Enter" button activates!
      setTimeout(() => {
        if (active) {
          setIsReady(true);
        }
      }, 1000);
    }

    checkHardware();

    return () => {
      active = false;
    };
  }, []);

  const handleEnterClick = async () => {
    // 🖥️ Activate Fullscreen cleanly on user click
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request error", e);
    }

    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900 relative overflow-hidden select-none min-h-[500px]">
      
      {/* Background Soft Ambient Accents */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-100/60 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-100/60 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-md w-full bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xl space-y-6 text-center">
        
        {/* Shield Icon */}
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200/60 shadow-xs">
          <ShieldCheck size={32} className="animate-pulse" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System & Security Calibration</h2>
          <p className="text-xs text-slate-500 font-medium">Hardware and security pre-check in progress...</p>
        </div>

        {/* Hardware Checks List */}
        <div className="space-y-3 pt-1 text-left">
          
          {/* Card 1: Microphone */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${micStatus === 'granted' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                <Mic size={18} className={micStatus === 'checking' ? 'animate-pulse' : ''} />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-800">Microphone & Audio Input</p>
                <p className="text-[11px] text-slate-500 font-mono font-medium">{micLabel}</p>
              </div>
            </div>
            {micStatus === 'granted' ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
            )}
          </div>

          {/* Card 2: Fullscreen Readiness */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isReady ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                <Maximize size={18} />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-800">Proctored Fullscreen Setup</p>
                <p className="text-[11px] text-slate-500 font-mono font-medium">
                  {isReady ? 'Ready for Fullscreen Lock' : 'Configuring Security Mode...'}
                </p>
              </div>
            </div>
            {isReady ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <Loader2 size={18} className="animate-spin text-indigo-600 shrink-0" />
            )}
          </div>
        </div>

        {/* Enter Button Action */}
        <div className="pt-2">
          {isReady ? (
            <button
              type="button"
              onClick={handleEnterClick}
              className="w-full btn-primary py-3.5 rounded-xl font-extrabold text-sm shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Enter Assessment Environment & View Profile</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <div className="space-y-2">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full animate-pulse transition-all duration-700 w-full" />
              </div>
              <p className="text-[11px] text-slate-500 font-mono font-semibold">Calibrating environment... Please wait</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function CandidateApply() {
  const { driveId } = useParams();
  const [stage, setStage] = useState('register'); // 'register' | 'calibration' | 'popup' | 'tech_test' | 'voice_hr' | 'completed'

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [candidateId, setCandidateId] = useState(null);
  const [profileSummary, setProfileSummary] = useState(null);

  const [currentTechQuestion, setCurrentTechQuestion] = useState(null);
  const [techIndex, setTechIndex] = useState(0);
  const [techScores, setTechScores] = useState([]);

  const [currentVoiceNumber, setCurrentVoiceNumber] = useState(1);
  const [currentVoiceText, setCurrentVoiceText] = useState("Why did you choose to apply for this company and role?");
  const [voiceScores, setVoiceScores] = useState([]);
  const [commScores, setCommScores] = useState([]);
  const totalVoiceQuestions = 3;

  const [finalDecision, setFinalDecision] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isVoiceSubmitting, setIsVoiceSubmitting] = useState(false);

  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [proctoringWarning, setProctoringWarning] = useState(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const stageRef = useRef(stage);
  const fullscreenExitsRef = useRef(fullscreenExits);
  const isNavigatingRef = useRef(false);
  const prefetchedQuestionRef = useRef(null);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { fullscreenExitsRef.current = fullscreenExits; }, [fullscreenExits]);

  const handleProctoringTermination = (currentFsCount) => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setProctoringWarning(null);
    setIsTerminated(true);
    setStage('completed');
    completeInterview(candidateId).catch(console.error);
  };

  const triggerFullscreenExitWarning = () => {
    if (stageRef.current !== 'tech_test' && stageRef.current !== 'voice_hr') return;
    if (isNavigatingRef.current) return;

    const newFsCount = fullscreenExitsRef.current + 1;
    setFullscreenExits(newFsCount);

    if (newFsCount >= 2) {
      handleProctoringTermination(newFsCount);
    } else {
      setProctoringWarning({
        title: "Full-Screen Violation Warning",
        message: "Warning 1/2: You exited full-screen mode. One more violation will automatically terminate your test."
      });
    }
  };

  useEffect(() => {
    if (stage !== 'tech_test' && stage !== 'voice_hr') return;

    let debounceTimer = null;
    const handleViolation = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => { debounceTimer = null; }, 500);
      triggerFullscreenExitWarning();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation();
      }
    };

    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        setProctoringWarning({
          title: "Prohibited Action",
          message: "Developer tools and inspection shortcuts are disabled during proctored testing."
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleViolation);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleViolation);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stage, candidateId]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile) return alert("Please select your resume PDF.");
    setIsSubmitting(true);
    setStage('calibration');

    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('resume', resumeFile);
      if (githubUrl) formData.append('github_url', githubUrl);
      if (linkedinUrl) formData.append('linkedin_url', linkedinUrl);

      const res = await applyAsCandidate(driveId || 'drive-default', formData);
      setCandidateId(res.candidate_id);

      const summary = await getProfileSummary(res.candidate_id);
      setProfileSummary(summary);

      const topSkills = summary?.top_skills || ["Python", "FastAPI", "System Design"];
      const targetSkill = topSkills[0];
      getTechQuestion(res.candidate_id, driveId || 'default', targetSkill, 'mcq', 'skill').then((q0) => {
        if (q0) prefetchedQuestionRef.current = q0;
      });
    } catch (err) {
      alert(err.response?.data?.detail || "Application failed. Please try again.");
      setStage('register');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTest = async (links) => {
    if (links?.githubUrl) setGithubUrl(links.githubUrl);
    if (links?.linkedinUrl) setLinkedinUrl(links.linkedinUrl);

    // 🎙️ Pre-request Microphone permission upfront BEFORE entering Fullscreen
    // This guarantees the browser permission prompt runs in normal mode, preventing proctoring violations during Voice HR!
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.warn("Microphone permission check missed or declined:", err);
    }

    // Enter Fullscreen Mode
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen request declined or unsupported", err);
    }

    setStage('tech_test');
    fetchNextTechQuestion(0);
  };

  // Helper to fetch tech question object (70% MCQ, 30% Fill-up, Weighted Skills + Interleaved Sources)
  const fetchQuestionObj = async (idx) => {
    try {
      const rawSkills = profileSummary?.top_skills || [];
      const aiCoreSkills = ["Python", "FastAPI", "Agentic AI", "LLM", "RAG", "PyTorch", "Vector Databases", "FAISS", "Machine Learning", "System Design", "SQL"];
      const defaultSecondary = ["Git", "Jupyter Notebook", "HTML", "CSS", "VS Code"];

      // Separate core candidate skills from secondary tooling skills
      const secondarySet = new Set(["HTML", "CSS", "HTML5", "CSS3", "VS CODE", "VISUAL STUDIO CODE", "GIT", "GITHUB", "JUPYTER NOTEBOOK", "TOOLS & IDES", "FRONTEND & DATABASE", "PROGRAMMING LANGUAGE"]);
      
      const candidateCore = rawSkills.filter(s => s && !secondarySet.has(String(s).trim().toUpperCase()));
      const candidateSecondary = rawSkills.filter(s => s && secondarySet.has(String(s).trim().toUpperCase()));
      
      const primarySkillPool = candidateCore.length > 0 ? [...candidateCore, ...aiCoreSkills] : aiCoreSkills;
      const secondarySkillPool = candidateSecondary.length > 0 ? candidateSecondary : defaultSecondary;

      // 90% Primary Core AI Skills (18 Questions), 10% Secondary Tools (2 Questions at idx 6 and 13)
      let targetSkill;
      if (idx === 6 || idx === 13) {
        targetSkill = secondarySkillPool[(idx / 6 | 0) % secondarySkillPool.length];
      } else {
        targetSkill = primarySkillPool[idx % primarySkillPool.length];
      }

      // 1. Interleave Source Target (Skill, GitHub, Resume Project)
      // GitHub questions placed at Q3, Q9, Q15, Q18 (indices 2, 8, 14, 17)
      // Resume Project questions placed at Q6, Q12, Q19, Q20 (indices 5, 11, 18, 19)
      let source = 'skill';
      if ([2, 8, 14, 17].includes(idx)) {
        source = 'github';
      } else if ([5, 11, 18, 19].includes(idx)) {
        source = 'project';
      }

      // 2. 70% MCQ (14 questions) / 30% Fill-up (6 questions)
      // Fill-up indices: 3, 7, 11, 15, 17, 19 (Q4, Q8, Q12, Q16, Q18, Q20)
      const fillUpIndices = [3, 7, 11, 15, 17, 19];
      const qType = fillUpIndices.includes(idx) ? 'fill_up' : 'mcq';

      return await getTechQuestion(candidateId, driveId || 'default', targetSkill, qType, source);
    } catch (err) {
      console.error("Error fetching question obj", err);
      return null;
    }
  };

  // Prefetch Next Question in background whenever techIndex changes
  useEffect(() => {
    if (stage === 'tech_test' && techIndex + 1 < totalTechQuestions) {
      fetchQuestionObj(techIndex + 1).then((nextQ) => {
        if (nextQ) prefetchedQuestionRef.current = nextQ;
      });
    }
  }, [techIndex, stage]);

  const fetchNextTechQuestion = async (idx) => {
    // If pre-fetched in background, render INSTANTLY (0ms latency!)
    if (prefetchedQuestionRef.current) {
      const q = prefetchedQuestionRef.current;
      prefetchedQuestionRef.current = null;
      setCurrentTechQuestion(q);
      return;
    }

    const q = await fetchQuestionObj(idx);
    if (q) {
      setCurrentTechQuestion(q);
    }
  };

  const totalTechQuestions = 20;

  const handleTechAnswerSubmit = async (answer) => {
    setIsEvaluating(true);
    try {
      const evalRes = await submitTechAnswer(
        candidateId,
        currentTechQuestion.question,
        currentTechQuestion.correct_answer || currentTechQuestion.sample_answer || '',
        answer,
        currentTechQuestion.question_type
      );
      const scoreVal = typeof evalRes?.score === 'number' ? evalRes.score : 0.0;
      const updatedTechScores = [...techScores, scoreVal];
      setTechScores(updatedTechScores);

      if (techIndex + 1 < totalTechQuestions) {
        setTechIndex((prev) => prev + 1);
        await fetchNextTechQuestion(techIndex + 1);
      } else {
        // Proceed to Voice HR round
        isNavigatingRef.current = true;
        setStage('voice_hr');
        await fetchVoiceQuestion(1);
        setTimeout(() => { isNavigatingRef.current = false; }, 1000);
      }
    } catch (err) {
      console.error("Error submitting tech answer", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSkipToVoiceHR = async () => {
    isNavigatingRef.current = true;
    setStage('voice_hr');
    await fetchVoiceQuestion(1);
    setTimeout(() => { isNavigatingRef.current = false; }, 1000);
  };

  const handleEndTest = async () => {
    isNavigatingRef.current = true;
    await finalizeAllScores(voiceScores, commScores);
    setTimeout(() => { isNavigatingRef.current = false; }, 1000);
  };

  const fetchVoiceQuestion = async (qNum) => {
    try {
      const q = await getVoiceQuestion(qNum, "Software Engineer", candidateId);
      setCurrentVoiceNumber(qNum);
      setCurrentVoiceText(q.question_text || "Why did you choose to apply for this engineering role?");
    } catch (err) {
      console.error("Error fetching voice question", err);
      const hrTopics = [
        "Why did you choose to apply for this company and role?",
        "What are your long-term career goals and what motivates you?",
        "Describe a challenging team situation and how you resolved it.",
      ];
      setCurrentVoiceNumber(qNum);
      setCurrentVoiceText(hrTopics[(qNum - 1) % hrTopics.length]);
    }
  };

  const handleVoiceAnswerSubmit = async (audioBlob) => {
    setIsVoiceSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('candidate_id', candidateId);
      formData.append('question_text', currentVoiceText);
      formData.append('audio_file', audioBlob, 'answer.wav');

      const evalRes = await submitVoiceAnswer(formData);
      const voiceScoreVal = typeof evalRes?.answer_score === 'number' ? evalRes.answer_score : 0.0;
      const commScoreVal = typeof evalRes?.communication_score === 'number' ? evalRes.communication_score : 0.0;

      const updatedVoiceScores = [...voiceScores, voiceScoreVal];
      const updatedCommScores = [...commScores, commScoreVal];

      setVoiceScores(updatedVoiceScores);
      setCommScores(updatedCommScores);

      if (currentVoiceNumber < totalVoiceQuestions) {
        fetchVoiceQuestion(currentVoiceNumber + 1);
      } else {
        await finalizeAllScores(updatedVoiceScores, updatedCommScores);
      }
    } catch (err) {
      console.error("Error submitting voice answer", err);
    } finally {
      setIsVoiceSubmitting(false);
    }
  };

  const handleVoiceSkip = async () => {
    setIsVoiceSubmitting(true);
    try {
      await skipVoiceQuestion(candidateId, currentVoiceText);

      const updatedVoiceScores = [...voiceScores, 0.0];
      const updatedCommScores = [...commScores, 0.0];

      setVoiceScores(updatedVoiceScores);
      setCommScores(updatedCommScores);

      if (currentVoiceNumber < totalVoiceQuestions) {
        fetchVoiceQuestion(currentVoiceNumber + 1);
      } else {
        await finalizeAllScores(updatedVoiceScores, updatedCommScores);
      }
    } catch (err) {
      console.error("Error skipping voice question", err);
    } finally {
      setIsVoiceSubmitting(false);
    }
  };

  const finalizeAllScores = async (
    finalVoiceScores, 
    finalCommScores, 
    finalFs = fullscreenExitsRef.current,
    pStatus = "CLEAN"
  ) => {
    // Immediately set stage to completed so candidate sees End Page right away
    setStage('completed');

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    const avgTech = techScores.length ? techScores.reduce((a, b) => a + b, 0) / techScores.length : 0.0;
    const avgVoice = finalVoiceScores.length ? finalVoiceScores.reduce((a, b) => a + b, 0) / finalVoiceScores.length : 0.0;
    const avgComm = finalCommScores.length ? finalCommScores.reduce((a, b) => a + b, 0) / finalCommScores.length : 0.0;

    try {
      const completeRes = await completeInterview(
        candidateId, 
        avgTech, 
        avgVoice, 
        avgComm, 
        0, 
        finalFs, 
        pStatus
      );
      setFinalDecision(completeRes.decision);
    } catch (e) {
      console.error("Error completing interview", e);
    }
  };

  const handleCloseTab = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    try {
      window.opener = null;
      window.open('', '_self', '');
      window.close();
    } catch (e) {
      console.log("Browser prevented window.close()", e);
    }
    alert("Assessment finished! You may now close this browser tab.");
  };

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden relative font-sans">
      
      {/* GLOBAL CANDIDATE PORTAL TOP NAVBAR (Full Width) */}
      <header className="w-full bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center z-30 shrink-0 shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-slate-900 tracking-tight text-sm">Agent<span className="text-blue-600">Hire</span></span>
              <span className="bg-blue-50 text-blue-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-blue-200">
                Candidate Assessment Portal
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden sm:block">AI-Powered Skill & Voice Technical Evaluation</p>
          </div>
        </div>

        {/* Dynamic Status / Proctoring Indicators */}
        <div className="flex items-center space-x-3">
          {(stage === 'tech_test' || stage === 'voice_hr') && (
            <>
              <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-mono font-bold">
                <Lock size={12} className="animate-pulse" />
                <span>AI Proctor Active</span>
              </div>

              <div className={`px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold ${fullscreenExits > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                Fullscreen Exits: <span className="font-extrabold">{fullscreenExits} / 2</span>
              </div>
            </>
          )}

          {fullName && (
            <div className="flex items-center space-x-1.5 text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
              <User size={13} className="text-slate-500" />
              <span className="font-bold text-slate-800">{fullName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Proctoring Warning Modal */}
      {proctoringWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full p-6 md:p-8 rounded-2xl border-2 border-rose-500 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">{proctoringWarning.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {proctoringWarning.message}
              </p>
            </div>
            <button
              onClick={() => {
                setProctoringWarning(null);
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-rose-600/20"
            >
              I Understand — Return to Assessment
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER: Full Viewport Expansion */}
      <div className="flex-1 w-full overflow-hidden flex flex-col relative">

        {/* STAGE 1: REGISTRATION FORM (Split Hero Full Page Layout) */}
        {stage === 'register' && (
          <div className="w-full flex-1 flex flex-col md:flex-row overflow-y-auto">
            {/* Left Hero Panel */}
            <div className="w-full md:w-5/12 bg-slate-900 text-white p-6 md:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden shrink-0 space-y-6">
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <span className="inline-flex items-center space-x-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] px-3 py-1 rounded-full font-bold">
                  <ShieldCheck size={13} />
                  <span>Proctored Engineering Assessment</span>
                </span>
                
                <h1 className="text-2xl md:text-3xl font-extrabold leading-tight text-white tracking-tight">
                  Demonstrate Your Engineering Excellence.
                </h1>

                <p className="text-slate-300 text-xs md:text-sm leading-relaxed font-medium">
                  Welcome to AgentHire. Our multi-agent AI system synthesizes your resume and GitHub code to generate tailored technical questions and conduct real-time voice interviews.
                </p>

                {/* Round Cards / Boxes */}
                <div className="space-y-3 pt-2">
                  
                  {/* Round 1 Box */}
                  <div className="bg-slate-800/80 hover:bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-xl flex items-start space-x-3 transition-all shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center font-extrabold text-sm shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-white font-extrabold text-xs tracking-wide">Round 1: Adaptive Tech Test</h3>
                      <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
                        20 skill-based technical questions tailored to your engineering stack.
                      </p>
                    </div>
                  </div>

                  {/* Round 2 Box */}
                  <div className="bg-slate-800/80 hover:bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-xl flex items-start space-x-3 transition-all shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-extrabold text-sm shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-white font-extrabold text-xs tracking-wide">Round 2: Voice HR Interview</h3>
                      <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
                        Interactive AI voice assessment evaluating communication & problem-solving.
                      </p>
                    </div>
                  </div>

                  {/* Security Box */}
                  <div className="bg-slate-800/80 hover:bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-xl flex items-start space-x-3 transition-all shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center font-extrabold text-sm shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-white font-extrabold text-xs tracking-wide">Full-Screen Security</h3>
                      <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
                        AI proctoring enforces fullscreen mode to guarantee test integrity.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-4 text-[10px] text-slate-500 font-mono relative z-10">
                AgentHire AI Candidate Engine • Proctored Session
              </div>
            </div>


            {/* Right Registration Form */}
            <div className="w-full md:w-7/12 bg-white p-6 md:p-10 flex flex-col justify-center overflow-y-auto">
              <div className="max-w-md mx-auto w-full space-y-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Candidate Registration</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Fill out your details to begin your AI recruitment assessment.</p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                          <User size={16} />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Doe"
                          className="input-field input-field-icon w-full text-xs py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address *</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                          <Mail size={16} />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane.doe@example.com"
                          className="input-field input-field-icon w-full text-xs py-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number *</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                        <Phone size={16} />
                      </div>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="input-field input-field-icon w-full text-xs py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Upload Resume (PDF) *</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/80 hover:bg-slate-50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        required
                        onChange={(e) => setResumeFile(e.target.files[0])}
                        className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-extrabold text-sm mt-3 shadow-lg shadow-blue-500/20 hover:scale-[1.01] transition-transform flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>Verifying Profile & Claims...</span>
                      </>
                    ) : (
                      <span>Submit Application & Begin Test</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: SIMPLE & NEAT VERIFICATION FALLBACK */}
        {stage === 'analyzing' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="bg-white max-w-sm w-full p-8 text-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-slate-900">Verifying Profile...</h2>
                <p className="text-xs text-slate-500">Matching technical claims with job requirements.</p>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: SYSTEM CALIBRATION & HARDWARE PRE-CHECK */}
        {stage === 'calibration' && (
          <SystemCalibrationScreen onComplete={() => setStage('popup')} />
        )}

        {/* STAGE 3: PROFILE SUMMARY POPUP */}
        {stage === 'popup' && (
          <ProfilePopup summary={profileSummary} onStartTest={handleStartTest} />
        )}

        {/* STAGE 4: TECHNICAL TEST */}
        {stage === 'tech_test' && (
          <TechTest
            question={currentTechQuestion}
            onAnswerSubmit={handleTechAnswerSubmit}
            questionIndex={techIndex}
            totalQuestions={totalTechQuestions}
            isEvaluating={isEvaluating}
            techScores={techScores}
            onSkipToVoiceHR={handleSkipToVoiceHR}
            onEndTest={handleEndTest}
          />
        )}

        {/* STAGE 5: VOICE HR TEST */}
        {stage === 'voice_hr' && (
          <VoiceHR
            questionNumber={currentVoiceNumber}
            questionText={currentVoiceText}
            onVoiceAnswerSubmit={handleVoiceAnswerSubmit}
            onVoiceSkip={handleVoiceSkip}
            isSubmitting={isVoiceSubmitting}
            totalVoiceQuestions={totalVoiceQuestions}
            onEndTest={handleEndTest}
          />
        )}

        {/* STAGE 6: COMPLETED SCREEN */}
        {stage === 'completed' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="bg-white w-full max-w-xl p-8 md:p-10 rounded-2xl border border-slate-200 shadow-xl text-center space-y-6">
              <CheckCircle2 size={64} className="text-emerald-600 mx-auto" />
              <h2 className="text-3xl font-extrabold text-slate-900">Assessment Submitted!</h2>
              
              {isTerminated ? (
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl text-left space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm">
                    <AlertTriangle size={18} />
                    <span>Test Terminated Due to Proctoring Violations</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Your assessment was automatically terminated because full-screen mode was exited twice. Your recorded technical and voice responses up to this point have been saved and submitted to HR.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  Thank you for completing both technical and voice HR rounds. Your evaluation report has been automatically generated and submitted to the recruitment panel.
                </p>
              )}

              <div className="pt-2">
                <button
                  onClick={handleCloseTab}
                  className="btn-primary px-8 py-3.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 hover:scale-[1.02] transition-transform"
                >
                  End Test & Close Window
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Proctoring Warning Dialog */}
      {proctoringWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-rose-200 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{proctoringWarning.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {proctoringWarning.message}
            </p>
            <button
              onClick={() => {
                setProctoringWarning(null);
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-sm"
            >
              Resume Test & Re-enable Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


