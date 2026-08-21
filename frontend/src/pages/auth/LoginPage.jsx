import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { Lock, User, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LegalComplianceModal } from '../../components/common/LegalComplianceModal.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legal & Corporate Information Modal Popup
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('contact');

  const openLegalModal = (tab = 'contact') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const user = await login(identifier.trim(), password);

      if (!user) {
        throw new Error('Authentication failed. Please check credentials.');
      }

      if (user.isAdmin) {
        navigate('/workforce/admin');
      } else {
        const regStatus = user.registrationStatus || 'not_started';
        if (regStatus === 'approved') {
          navigate('/workforce/employee/dashboard');
        } else if (regStatus === 'submitted' || regStatus === 'under_review') {
          navigate('/workforce/onboarding/pending-review');
        } else if (regStatus === 'correction_required') {
          navigate('/workforce/onboarding/corrections');
        } else if (regStatus === 'rejected') {
          navigate('/workforce/onboarding/rejected');
        } else {
          navigate('/workforce/onboarding/wizard');
        }
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.info) {
        console.info('[AUTH CLIENT]', {
          status: err.status,
          code: err.code,
          message: err.message,
        });
      }
      const serverMsg = err.data?.error || err.message;
      if (err.status === 401) {
        setError(serverMsg || 'Invalid credentials. Please verify your email/username and password.');
      } else if (err.status === 403 || err.code === 'ACCOUNT_INACTIVE') {
        setError(serverMsg || 'Account is inactive or deactivated. Please contact your administrator.');
      } else if (err.status === 503 || err.code === 'DB_UNAVAILABLE') {
        setError(serverMsg || 'Database service temporarily unavailable. Please retry shortly.');
      } else if (err.code === 'CREDENTIALS_REQUIRED') {
        setError(serverMsg || 'Identifier and password required.');
      } else if (err.code === 'NETWORK_ERROR') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(serverMsg || 'Unable to complete sign-in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-900 font-sans text-slate-900 antialiased">
      {/* ── LEGAL & COMPLIANCE POPUP MODAL ── */}
      <LegalComplianceModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      {/* ── LEFT: QUIET BRAND PANEL (Desktop Only) ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col justify-between bg-slate-900 text-white p-10 xl:p-14 border-r border-slate-800">
        <div>
          <div className="text-sm font-bold tracking-widest text-slate-200 uppercase">
            CAL SERVICES
          </div>
          <div className="text-xs text-blue-400 font-medium tracking-wide">
            Workforce Operations
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl xl:text-3xl font-bold text-white tracking-tight">
            Field Operations & Engineering Network
          </h1>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Enterprise dispatching, real-time spatial telemetry, and verified precision service delivery.
          </p>
        </div>

        {/* Desktop Left Brand Footer */}
        <div className="space-y-2 pt-6 border-t border-slate-800/80">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => openLegalModal('terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms
            </button>
            <span className="text-slate-600">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <span className="text-slate-600">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('contact')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact & Support
            </button>
            <span className="text-slate-600">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('refunds')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Refunds
            </button>
            <span className="text-slate-600">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('shipping')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Fulfillment
            </button>
          </div>
          <div className="text-[10px] text-slate-500 font-normal">
            &copy; {new Date().getFullYear()} CALDIM ENGINEERING PRIVATE LIMITED. All rights reserved.
          </div>
        </div>
      </div>

      {/* ── RIGHT: LOGIN AREA WITH FOOTER ── */}
      <div className="flex-1 flex flex-col justify-between items-center p-6 sm:p-10 lg:p-12 bg-white min-h-screen overflow-y-auto">
        {/* Top Spacer / Mobile Brand Badge */}
        <div className="w-full flex justify-between items-center lg:justify-end">
          <div className="lg:hidden text-xs font-bold text-slate-800 uppercase tracking-wider">
            CAL SERVICES
          </div>
          <button
            type="button"
            onClick={() => openLegalModal('contact')}
            className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need Help? Contact Us</span>
          </button>
        </div>

        {/* Center Login Form Card */}
        <div className="w-full max-w-[380px] my-auto py-6 space-y-6">
          {/* Header */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              CAL SERVICES &bull; Workforce
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Employee Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to access your Workforce account.
            </p>
          </div>

          {/* Error Message */}
          {error && <ErrorState message={error} onDismiss={() => setError('')} />}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email, Username or Employee ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email, username, or ID"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                  required
                  autoComplete="username"
                />
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                  required
                  autoComplete="current-password"
                />
                <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Footer Registration Link */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              New technician?{' '}
              <Link
                to="/workforce/signup"
                className="text-blue-600 font-semibold hover:text-blue-700 hover:underline"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* ── FOOTER: PRIVACY, TERMS, SUPPORT & COMPLIANCE ── */}
        <footer className="w-full pt-6 pb-2 text-center">
          <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-500 font-medium">
            <button
              type="button"
              onClick={() => openLegalModal('privacy')}
              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300 select-none">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('terms')}
              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <span className="text-slate-300 select-none">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('contact')}
              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Support & Contact
            </button>
            <span className="text-slate-300 select-none">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('refunds')}
              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Cancellation & Refunds
            </button>
            <span className="text-slate-300 select-none">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('shipping')}
              className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Service Delivery
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            &copy; {new Date().getFullYear()} CALDIM ENGINEERING PRIVATE LIMITED. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default LoginPage;
