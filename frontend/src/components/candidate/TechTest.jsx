import React, { useState, useEffect, useRef } from 'react';
import { Code, CheckCircle, ArrowRight, BrainCircuit, ShieldCheck, Sparkles, Clock, SkipForward, HelpCircle, CheckCircle2, CornerDownLeft, Radio, LogOut, Code2 } from 'lucide-react';

function FormattedQuestion({ rawText }) {
  if (!rawText) return null;

  // Strip any hallucinated option choices A) ... B) ... from question field
  let cleaned = rawText.replace(/\s*A\)\s+.*$/is, '').trim();

  // 1. Check for markdown code blocks (```language ... ```)
  const codeBlockRegex = /```(?:([a-zA-Z0-9_+#\-]+)\n)?([\s\S]*?)```/g;
  const matches = [...cleaned.matchAll(codeBlockRegex)];

  if (matches.length > 0) {
    const elements = [];
    let lastIndex = 0;

    matches.forEach((match, idx) => {
      const textBefore = cleaned.substring(lastIndex, match.index).trim();
      const lang = match[1] || 'code';
      const codeContent = match[2].trim();
      lastIndex = match.index + match[0].length;

      if (textBefore) {
        elements.push(
          <h1 key={`tb-${idx}`} className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 leading-snug tracking-tight my-1">
            {textBefore}
          </h1>
        );
      }

      elements.push(
        <div key={`code-${idx}`} className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md font-mono text-left my-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
            <span className="flex items-center space-x-1.5">
              <Code2 size={14} />
              <span>{lang.toUpperCase()} CODE SNIPPET</span>
            </span>
          </div>
          <pre className="text-slate-100 text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto pt-1">
            <code>{codeContent}</code>
          </pre>
        </div>
      );
    });

    const remainingText = cleaned.substring(lastIndex).trim();
    if (remainingText) {
      elements.push(
        <p key="rem" className="text-sm font-semibold text-slate-800 my-1">
          {remainingText}
        </p>
      );
    }

    return <div className="space-y-2">{elements}</div>;
  }

  // Clean prose question text
  return (
    <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 leading-snug tracking-tight">
      {cleaned}
    </h1>
  );
}

export default function TechTest({ 
  question, 
  onAnswerSubmit, 
  questionIndex, 
  totalQuestions = 20, 
  isEvaluating,
  techScores = [],
  onSkipToVoiceHR,
  onEndTest
}) {
  const [selectedOption, setSelectedOption] = useState('');
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(60); 
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  const diffBadgeClass = question?.difficulty === 'Easy'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : question?.difficulty === 'Hard'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  const handleSkip = () => {
    onAnswerSubmit("[SKIPPED]");
    setSelectedOption('');
    setWrittenAnswer('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const answer = isMCQ ? selectedOption : writtenAnswer;
    if (!answer && !selectedOption) return;
    onAnswerSubmit(answer);
    setSelectedOption('');
    setWrittenAnswer('');
  };

  useEffect(() => {
    setSelectedOption('');
    setWrittenAnswer('');
    setTimeLeft(60);
  }, [questionIndex]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSkip();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const options = Array.isArray(question?.options) ? question.options : [];
  const isMCQ = question?.question_type === 'mcq' && options.length > 0;
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-50 text-slate-800 font-sans select-none overflow-hidden">
      
      {/* SIDEBAR: Full Technical Round Navigator & Assessment Status */}
      <aside className="w-full lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r border-slate-200/90 bg-white flex flex-col justify-between shrink-0 p-4 sm:p-5 overflow-y-auto space-y-4 shadow-xs">
        <div className="space-y-4">
          
          {/* Section Header */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-blue-600 font-mono text-[11px] font-bold uppercase tracking-wider">
              <BrainCircuit size={14} className="animate-pulse" />
              <span>Technical Round</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Skill Assessment</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Complete technical evaluation to advance to Round 2.
            </p>
          </div>

          {/* Question Matrix Map (1 to 20 Grid) */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[11px] font-extrabold text-slate-800 tracking-wider uppercase">
              <span>Question Map</span>
              <span className="text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                {questionIndex + 1} / {totalQuestions}
              </span>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {Array.from({ length: totalQuestions }).map((_, idx) => {
                const isCurrent = idx === questionIndex;
                const isAnswered = idx < techScores.length;

                return (
                  <div
                    key={idx}
                    className={`h-8 sm:h-9 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-500/30 shadow-xs scale-105 border-blue-600'
                        : isAnswered
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keyboard Shortcuts Card */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Sparkles size={13} className="text-amber-500" />
              <span>Keyboard Shortcuts</span>
            </div>

            <div className="space-y-1.5 pt-0.5 text-[11px] font-medium text-slate-700">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1 font-mono">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold shadow-xs text-slate-800">A</kbd>
                  <span className="text-slate-400">–</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold shadow-xs text-slate-800">D</kbd>
                </span>
                <span className="text-slate-600 font-semibold">Select Option</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                <span className="font-mono flex items-center space-x-1">
                  <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold shadow-xs text-slate-800 flex items-center space-x-1">
                    <span>Enter</span>
                    <CornerDownLeft size={10} className="text-slate-500" />
                  </kbd>
                </span>
                <span className="text-slate-600 font-semibold">Submit & Next</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Test Navigation Actions (Left Sidebar Bottom) */}
        <div className="pt-3 border-t border-slate-200/80 space-y-2 shrink-0">
          <div className="space-y-1.5">
            {onSkipToVoiceHR && (
              <button
                type="button"
                onClick={() => setShowMoveModal(true)}
                className="w-full py-2 rounded-lg font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 transition-all flex items-center justify-center space-x-1.5 text-xs shadow-xs cursor-pointer"
              >
                <Radio size={14} />
                <span>Move to Voice HR</span>
              </button>
            )}

            {onEndTest && (
              <button
                type="button"
                onClick={() => setShowEndModal(true)}
                className="w-full py-2 rounded-lg font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center space-x-1.5 text-xs cursor-pointer"
              >
                <LogOut size={14} />
                <span>End Test</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
            <div className="flex items-center space-x-1 text-emerald-700 font-bold font-mono">
              <ShieldCheck size={14} />
              <span>AI Monitored</span>
            </div>
            <div className={`flex items-center space-x-1 font-mono font-bold px-2 py-0.5 rounded ${
              timeLeft <= 10 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-700'
            }`}>
              <Clock size={12} className={timeLeft <= 10 ? 'text-rose-600' : 'text-blue-600'} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE: Clean Question & Answers Canvas */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-5">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-5">
          
          {/* Top Progress Bar & Question Stats */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100/80 text-blue-800 text-[11px] font-extrabold px-2.5 py-1 rounded-full border border-blue-200/60">
                  Question {questionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs text-slate-500 font-mono hidden sm:inline-block">
                  Timer: <strong className={timeLeft <= 10 ? 'text-rose-600 font-extrabold animate-pulse' : 'text-slate-800 font-bold'}>{formatTime(timeLeft)}</strong>
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 h-full transition-all duration-500" 
                style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card Canvas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 lg:p-8 shadow-sm space-y-6 flex flex-col justify-start">
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider font-mono bg-blue-50/80 px-2.5 py-0.5 rounded border border-blue-200/60">
                  {isMCQ ? 'Multiple Choice Question' : 'Code Fill-In Question'}
                </span>
              </div>

              {/* Question Stem */}
              <FormattedQuestion rawText={question.question} />
            </div>

            {/* Options / Text Input Form */}
            <form onSubmit={handleSubmit} className="space-y-5 pt-1">
              {isMCQ ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {options.map((opt, idx) => {
                    const letter = optionLetters[idx] || (idx + 1);
                    const isSelected = selectedOption === opt;
                    const cleanOptText = opt.replace(/^[A-Da-d][\)\.\:\-]\s*/, '').trim();

                    return (
                      <label 
                        key={idx}
                        className={`group relative flex items-center p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                          isSelected 
                            ? 'bg-blue-50/90 border-blue-600 text-slate-900 shadow-xs ring-1 ring-blue-600/30' 
                            : 'bg-white border-slate-200/90 text-slate-700 hover:border-blue-400 hover:bg-blue-50/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mcq-option"
                          value={opt}
                          checked={isSelected}
                          onChange={(e) => setSelectedOption(e.target.value)}
                          className="hidden"
                        />
                        
                        {/* Option Letter Badge */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-sm mr-3 transition-colors shrink-0 ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
                        }`}>
                          {letter}
                        </div>

                        {/* Option Text */}
                        <span className="text-sm sm:text-base font-semibold flex-1 leading-normal">
                          {cleanOptText}
                        </span>

                        {/* Checkmark icon if selected */}
                        {isSelected && (
                          <CheckCircle2 size={20} className="text-blue-600 ml-3 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">
                      <Code size={14} className="text-blue-600" />
                      <span>Type Written / Code Solution:</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">Press Enter ↵ to Submit</span>
                  </div>
                  <input
                    type="text"
                    value={writtenAnswer}
                    onChange={(e) => setWrittenAnswer(e.target.value)}
                    placeholder="Type missing keyword, code solution, or output here..."
                    autoFocus
                    className="w-full bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl p-3.5 sm:p-4 text-slate-900 text-base sm:text-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-mono transition-all shadow-xs"
                  />
                </div>
              )}

              {/* Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/90 border border-slate-300/80 transition-colors flex items-center justify-center space-x-1.5 text-xs"
                >
                  <SkipForward size={16} />
                  <span>Skip Question</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={isEvaluating || (isMCQ ? !selectedOption.trim() : !writtenAnswer.trim())}
                    className="w-full sm:w-auto btn-primary px-7 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 hover:scale-[1.01] transition-all"
                  >
                    <span>{isEvaluating ? 'Evaluating...' : 'Submit Answer & Next'}</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>

      </main>

      {/* Custom React Confirmation Modals (In-DOM, No Window Blur or Fullscreen Exit) */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xl space-y-5 text-center text-slate-900">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Radio size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">Advance to Voice HR Round?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                You are about to skip the remaining technical questions and proceed directly to the Round 2 Voice HR Interview.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMoveModal(false);
                  if (onSkipToVoiceHR) onSkipToVoiceHR();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-transform hover:scale-[1.02]"
              >
                Yes, Move to Voice HR
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xl space-y-5 text-center text-slate-900">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <LogOut size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">End Assessment Now?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This will finalize your evaluation, submit all completed technical responses, and close your test session.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndModal(false);
                  if (onEndTest) onEndTest();
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md shadow-rose-600/20 transition-transform hover:scale-[1.02]"
              >
                Yes, End Test
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



