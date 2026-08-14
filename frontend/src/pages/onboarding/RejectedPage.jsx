import React, { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { apiGetOnboardingProfile } from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';

export function RejectedPage() {
  const [rejectionReason, setRejectionReason] = useState('');
  const [supportContact, setSupportContact] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGetOnboardingProfile();
        setRejectionReason(data?.onboarding_data?.rejection_reason || data?.rejection_reason || '');
        // Load support contact from profile/company data if available
        const contact = data?.company_support_contact || data?.support_contact || null;
        setSupportContact(contact);
      } catch (_) {}
    }
    load();
  }, []);

  return (
    <AppShell breadcrumbs={[{ label: 'Application Decision' }]}>
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="bg-white border border-slate-200 rounded p-6 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>

          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 uppercase tracking-wider">
              Application Declined
            </span>
            <h1 className="text-base font-bold text-slate-900 mt-2">
              Registration Not Approved
            </h1>
          </div>

          {rejectionReason ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-left text-xs">
              <span className="font-bold text-slate-700 block mb-1">Reason provided by Admin:</span>
              <p className="text-slate-600 leading-relaxed font-medium">
                "{rejectionReason}"
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-left text-xs">
              <p className="text-slate-500 italic">No specific reason was recorded. Please contact the operations desk for details.</p>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed">
            If you wish to dispute this evaluation or provide supplementary trade credentials, please contact your Workforce Operations desk directly.
          </p>

          {supportContact && (
            <div className="pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
              <p>Contact: <span className="text-blue-600">{supportContact}</span></p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default RejectedPage;
