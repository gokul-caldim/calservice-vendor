import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { AlertTriangle, Upload, CheckCircle2, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import {
  apiGetOnboardingProfile,
  apiUploadDocument,
  apiSubmitOnboarding,
} from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';

export function CorrectionRequiredPage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchProfile = async () => {
    try {
      const data = await apiGetOnboardingProfile();
      setProfile(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onboarding = profile?.onboarding_data || {};
  const correctionNotes = onboarding.correction_notes || 'Please update the highlighted documents/details.';
  const docs = onboarding.documents || {};

  const handleDocumentReplace = async (category, file, title) => {
    try {
      setError('');
      await apiUploadDocument(category, file, title);
      setSuccessMsg(`Replacement for ${title || category} uploaded!`);
      await fetchProfile();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    }
  };

  const handleResubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      await apiSubmitOnboarding();
      await refreshProfile();
      navigate('/workforce/onboarding/pending-review');
    } catch (err) {
      setError(err.message || 'Resubmission failed. Please verify documents.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Correction Action Required' }]}>
      <div className="max-w-2xl mx-auto space-y-4 py-6">
        <div className="bg-white border border-slate-200 rounded p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                Action Required
              </span>
              <h1 className="text-base font-bold text-slate-900 mt-0.5">
                Application Correction Requested
              </h1>
            </div>
          </div>

          {/* Admin Feedback Box */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded text-xs">
            <p className="font-bold text-amber-900 uppercase tracking-wider text-[11px] mb-1">
              Admin Review Notes:
            </p>
            <p className="text-slate-800 leading-relaxed font-medium">
              "{correctionNotes}"
            </p>
          </div>

          {error && <ErrorState message={error} onDismiss={() => setError('')} />}
          {successMsg && (
            <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Document list */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Documents to Review
            </h3>

            <div className="border border-slate-200 rounded divide-y divide-slate-100">
              {Object.entries(docs).map(([key, doc]) => {
                const isRejected = doc.status === 'rejected';
                return (
                  <div
                    key={key}
                    className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isRejected ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-slate-900">{doc.title || key}</span>
                        <StatusBadge status={doc.status} size="xs" />
                      </div>
                      {doc.rejection_reason && (
                        <p className="text-rose-600 font-semibold text-[11px] mt-0.5">
                          Flag: {doc.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="cursor-pointer px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs inline-flex items-center gap-1 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Upload Replacement</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleDocumentReplace(key, e.target.files[0], doc.title);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <p className="text-[11px] text-slate-500">
              Once replacements are uploaded, resubmit for Admin re-evaluation.
            </p>
            <button
              type="button"
              onClick={handleResubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Resubmitting...' : 'Resubmit Application'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default CorrectionRequiredPage;
