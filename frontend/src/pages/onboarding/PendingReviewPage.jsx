import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthProvider.jsx';
import { Clock, RefreshCw, FileText, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiGetOnboardingProfile } from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';

export function PendingReviewPage() {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsRefreshing(true);
      const updatedUser = await refreshProfile();
      if (updatedUser) {
        setProfile(updatedUser);
      }
    } catch (_) {
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const onboarding = profile?.onboarding_data || {};
  const services = onboarding.services || [];
  const docs = onboarding.documents || {};

  return (
    <AppShell breadcrumbs={[{ label: 'Application Status' }]}>
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white border border-slate-200 rounded p-6 sm:p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>

          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
              Verification In Progress
            </span>
            <h1 className="text-lg font-bold text-slate-900 mt-2">
              Your Application is Under Review
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Our Operations & Verification desk is inspecting your identification files and trade qualifications.
            </p>
          </div>

          {/* Dossier status summary */}
          <div className="grid grid-cols-2 gap-3 text-left pt-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs">
              <span className="text-slate-500 block text-[11px]">Requested Services:</span>
              <strong className="text-slate-900 text-xs">{services.length} Services</strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs">
              <span className="text-slate-500 block text-[11px]">Documents Lodged:</span>
              <strong className="text-slate-900 text-xs">{Object.keys(docs).length} Files</strong>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-left text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              You will be notified once verification is completed. You cannot receive job dispatches until your application is approved.
            </span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={isRefreshing}
              className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking Status...' : 'Refresh Status'}</span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default PendingReviewPage;
