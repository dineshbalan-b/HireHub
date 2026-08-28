import React, { useState, useEffect } from 'react';
import { Plus, Users, Copy, Check, Eye, Trash2, AlertTriangle, FileText, X, CheckSquare, Square, ExternalLink } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Badge from '../components/common/Badge';
import CandidateDetailModal from '../components/hr/CandidateDetailModal';
import { getDrives, getDriveCandidates, getCandidateDecision, deleteDrive, deleteCandidate } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

export default function HRDashboard() {
  const [drives, setDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDecision, setCandidateDecision] = useState(null);
  const [copiedDriveId, setCopiedDriveId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'drive'|'candidate'|'bulk_candidates', id, name, ids }
  
  // Feature 1: Bulk Checkbox Selection State
  const [checkedCandidateIds, setCheckedCandidateIds] = useState([]);

  // Feature 2: Drive Details (JD) Modal State
  const [viewDriveDetails, setViewDriveDetails] = useState(null);

  useEffect(() => {
    fetchDrives();
  }, []);

  const fetchDrives = async () => {
    try {
      const data = await getDrives();
      setDrives(data || []);
      if (data && data.length > 0) {
        selectDrive(data[0]);
      } else {
        setSelectedDrive(null);
        setCandidates([]);
        setCheckedCandidateIds([]);
      }
    } catch (err) {
      console.error("Error fetching drives", err);
    }
  };

  const selectDrive = async (drive) => {
    setSelectedDrive(drive);
    setCheckedCandidateIds([]);
    try {
      const candData = await getDriveCandidates(drive.drive_id);
      setCandidates(candData || []);
    } catch (err) {
      console.error("Error fetching drive candidates", err);
      setCandidates([]);
    }
  };

  const handleCopyLink = async (driveId) => {
    const link = `${window.location.origin}/apply/${driveId}`;
    await copyToClipboard(link);
    setCopiedDriveId(driveId);
    setTimeout(() => setCopiedDriveId(null), 2000);
  };

  const handleViewCandidate = async (candidate) => {
    setSelectedCandidate(candidate);
    try {
      const dec = await getCandidateDecision(candidate.candidate_id);
      setCandidateDecision(dec);
    } catch (err) {
      setCandidateDecision(null);
    }
  };

  const handleDeleteDrive = async (driveId) => {
    try {
      await deleteDrive(driveId);
      setConfirmDelete(null);
      if (viewDriveDetails?.drive_id === driveId) {
        setViewDriveDetails(null);
      }
      fetchDrives();
    } catch (err) {
      console.error("Error deleting drive", err);
      alert(err.response?.data?.detail || "Failed to delete drive.");
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    if (!selectedDrive) return;
    try {
      await deleteCandidate(selectedDrive.drive_id, candidateId);
      setConfirmDelete(null);
      selectDrive(selectedDrive);
      const data = await getDrives();
      setDrives(data || []);
    } catch (err) {
      console.error("Error deleting candidate", err);
      alert(err.response?.data?.detail || "Failed to delete candidate.");
    }
  };

  const handleBulkDeleteCandidates = async () => {
    if (!selectedDrive || checkedCandidateIds.length === 0) return;
    try {
      await Promise.all(
        checkedCandidateIds.map((cId) => deleteCandidate(selectedDrive.drive_id, cId))
      );
      setConfirmDelete(null);
      setCheckedCandidateIds([]);
      selectDrive(selectedDrive);
      const data = await getDrives();
      setDrives(data || []);
    } catch (err) {
      console.error("Error bulk deleting candidates", err);
      alert("Failed to delete selected candidates.");
    }
  };

  // Checkbox helpers
  const handleToggleSelectAll = () => {
    if (checkedCandidateIds.length === candidates.length) {
      setCheckedCandidateIds([]);
    } else {
      setCheckedCandidateIds(candidates.map((c) => c.candidate_id));
    }
  };

  const handleToggleCheckCandidate = (cId) => {
    if (checkedCandidateIds.includes(cId)) {
      setCheckedCandidateIds(checkedCandidateIds.filter((id) => id !== cId));
    } else {
      setCheckedCandidateIds([...checkedCandidateIds, cId]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="w-full px-6 lg:px-10 py-8 space-y-8">
        {/* Header section */}
        <div className="flex justify-between items-center pb-2">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hiring Drives</h1>
          </div>
          <a
            href="/drives/new"
            className="btn-primary px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 shadow-md shadow-blue-500/20 hover:scale-[1.02] transition-transform"
          >
            <Plus size={16} />
            <span>Create Hiring Drive</span>
          </a>
        </div>

        {/* Drives List */}
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">Active Drives</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {drives.map((drive) => {
              const isSelected = selectedDrive?.drive_id === drive.drive_id;

              return (
                <div
                  key={drive.drive_id}
                  onClick={() => selectDrive(drive)}
                  className={`bg-white p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200/90 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  {/* Title & Action Icons */}
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 truncate">{drive.job_title}</h3>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewDriveDetails(drive);
                        }}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200/80 transition-colors"
                        title="View Full JD & Details"
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(drive.drive_id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors"
                        title="Copy Application Link"
                      >
                        {copiedDriveId === drive.drive_id ? <Check size={14} className="text-emerald-600 font-bold" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete({ type: 'drive', id: drive.drive_id, name: drive.job_title });
                        }}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                        title="Delete Drive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Company & Experience */}
                  <p className="text-xs text-slate-500 font-medium">{drive.company_name} • Min Exp: {drive.min_experience} yrs</p>

                  {/* Candidate Count Pill */}
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-[11px]">
                      <Users size={13} className="text-blue-600" />
                      <span>{drive.candidate_count || 0} Candidates</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {drives.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                <p className="text-base font-bold text-slate-800">No hiring drives created yet.</p>
                <p className="text-xs mt-1 text-slate-500">Click "Create Hiring Drive" above to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected Drive Candidate Pipeline */}
        {selectedDrive && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{selectedDrive.job_title} Candidates</h2>
              </div>

              {/* Bulk Delete Bar */}
              {checkedCandidateIds.length > 0 && (
                <button
                  onClick={() => setConfirmDelete({
                    type: 'bulk_candidates',
                    count: checkedCandidateIds.length,
                    ids: checkedCandidateIds
                  })}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2 shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <Trash2 size={14} />
                  <span>Delete Selected ({checkedCandidateIds.length})</span>
                </button>
              )}
            </div>


            {/* Candidate Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-10 text-center">
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-slate-500 hover:text-slate-900"
                        title="Select All Candidates"
                      >
                        {checkedCandidateIds.length > 0 && checkedCandidateIds.length === candidates.length ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Candidate Name</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">GitHub Score</th>
                    <th className="py-3.5 px-4">Tech Score</th>
                    <th className="py-3.5 px-4">Voice HR & Comm</th>
                    <th className="py-3.5 px-4">Overall Score</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {candidates.map((cand) => {
                    const isChecked = checkedCandidateIds.includes(cand.candidate_id);
                    const combinedVoiceScore = (cand.voice_score !== null && cand.voice_score !== undefined && cand.communication_score !== null && cand.communication_score !== undefined)
                      ? Math.round((cand.voice_score + cand.communication_score) / 2)
                      : (cand.voice_score || cand.communication_score || null);

                    return (
                      <tr 
                        key={cand.candidate_id} 
                        className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCheckCandidate(cand.candidate_id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {cand.full_name}
                          <div className="text-xs font-normal text-slate-500">{cand.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {cand.status === 'selected' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full border border-emerald-200">
                              SHORTLISTED
                            </span>
                          ) : cand.status === 'rejected' ? (
                            <span className="bg-rose-100 text-rose-800 text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full border border-rose-200">
                              REJECTED
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-slate-200">
                              EVALUATED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-purple-600 font-mono font-bold">
                          {cand.github_url && cand.github_score !== null && cand.github_score !== undefined && cand.github_score > 0 
                            ? `${Math.round(cand.github_score)}%` 
                            : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-600 font-mono font-bold">
                          {cand.tech_score ? `${cand.tech_score}%` : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-amber-600 font-mono font-bold">
                          {combinedVoiceScore ? `${combinedVoiceScore}%` : '--'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-blue-600">
                          {cand.overall_score ? `${cand.overall_score}%` : '--'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleViewCandidate(cand)}
                              className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 text-blue-600 hover:text-blue-700"
                            >
                              <Eye size={14} />
                              <span>View Report</span>
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ type: 'candidate', id: cand.candidate_id, name: cand.full_name })}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                              title="Delete Candidate"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500 text-sm">
                        No candidates have applied to this drive yet. Copy the application link to share!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Feature 2: Drive JD Details Modal */}
      {viewDriveDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full my-8 p-6 md:p-8 border border-slate-200 rounded-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <span className="badge badge-info text-xs font-bold px-2.5 py-1 rounded-full mb-2 inline-block">
                  Hiring Drive JD Details
                </span>
                <h2 className="text-2xl font-bold text-slate-900">{viewDriveDetails.job_title}</h2>
                <p className="text-slate-500 text-sm">{viewDriveDetails.company_name}</p>
              </div>
              <button 
                onClick={() => setViewDriveDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Min Experience</span>
                <span className="text-blue-600 font-bold text-base">{viewDriveDetails.min_experience} Years</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Min CGPA</span>
                <span className="text-emerald-600 font-bold text-base">{viewDriveDetails.min_cgpa || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Candidates</span>
                <span className="text-blue-500 font-bold text-base">{viewDriveDetails.candidate_count || 0}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Application Link</span>
                <button
                  onClick={() => handleCopyLink(viewDriveDetails.drive_id)}
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1 mt-1"
                >
                  <span>{copiedDriveId === viewDriveDetails.drive_id ? 'Copied Link!' : 'Copy Link'}</span>
                  <Copy size={12} />
                </button>
              </div>
            </div>

            {/* Required Skills */}
            {viewDriveDetails.required_skills && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(typeof viewDriveDetails.required_skills === 'string' ? JSON.parse(viewDriveDetails.required_skills) : viewDriveDetails.required_skills).map((skill, idx) => (
                    <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-lg border border-blue-200 font-mono font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Job Description Text */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Job Description (RAG Indexed)</h4>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-800 font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {viewDriveDetails.job_description}
              </div>
            </div>

            {/* Constraints */}
            {viewDriveDetails.constraints && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">Hiring Rules & Constraints</h4>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-mono">
                  {typeof viewDriveDetails.constraints === 'string' ? viewDriveDetails.constraints : JSON.stringify(viewDriveDetails.constraints)}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-3">
              <button 
                onClick={() => setConfirmDelete({ type: 'drive', id: viewDriveDetails.drive_id, name: viewDriveDetails.job_title })}
                className="btn-danger px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Trash2 size={14} />
                <span>Delete Hiring Drive</span>
              </button>
              <button 
                onClick={() => setViewDriveDetails(null)}
                className="btn-secondary px-6 py-2 rounded-xl text-xs font-bold"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          decision={candidateDecision}
          onClose={() => {
            setSelectedCandidate(null);
            setCandidateDecision(null);
          }}
          onCandidateStatusUpdate={() => {
            if (selectedDrive) selectDrive(selectedDrive);
          }}
        />
      )}


      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Confirm Delete</h3>
            <p className="text-sm text-slate-600">
              {confirmDelete.type === 'bulk_candidates' ? (
                <span>Are you sure you want to delete <span className="text-slate-900 font-bold">{confirmDelete.count} selected candidates</span>?</span>
              ) : (
                <span>Are you sure you want to delete <span className="text-slate-900 font-bold">"{confirmDelete.name}"</span>?</span>
              )}
              {confirmDelete.type === 'drive' && (
                <span className="block mt-1 text-rose-600 text-xs font-medium">This will also delete all candidates in this drive.</span>
              )}
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 btn-secondary py-2.5 rounded-xl text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'drive') {
                    handleDeleteDrive(confirmDelete.id);
                  } else if (confirmDelete.type === 'bulk_candidates') {
                    handleBulkDeleteCandidates();
                  } else {
                    handleDeleteCandidate(confirmDelete.id);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

