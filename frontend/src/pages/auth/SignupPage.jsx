import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { Wrench, Smartphone, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LegalComplianceModal } from '../../components/common/LegalComplianceModal.jsx';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legal Modal Popup
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('contact');

  const openLegalModal = (tab = 'contact') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.mobileNumber.trim() || !formData.email.trim() || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await signup({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        mobile_number: formData.mobileNumber.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      navigate('/workforce/onboarding/wizard');
    } catch (err) {
      setError(err.message || 'Failed to create workforce account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-900">
      {/* ── LEGAL & COMPLIANCE POPUP MODAL ── */}
      <LegalComplianceModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-10 h-10 rounded bg-blue-600 items-center justify-center text-white font-bold mb-2 shadow-sm">
          <Wrench className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Join the Workforce Platform
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Create your technician account to start onboarding
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 rounded p-6 shadow-sm space-y-4">
          {error && <ErrorState message={error} onDismiss={() => setError('')} />}

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Ramesh"
                    className="w-full pl-8 pr-2.5 py-1.5"
                    required
                  />
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Kumar"
                  className="w-full px-2.5 py-1.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className="w-full pl-8 pr-2.5 py-1.5"
                  required
                />
                <Smartphone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ramesh.technician@gmail.com"
                  className="w-full pl-8 pr-2.5 py-1.5"
                  required
                />
                <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-7 py-1.5"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-7 py-1.5"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account & Start Onboarding'}
            </button>
          </form>


          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/workforce/login" className="text-blue-600 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* ── FOOTER: PRIVACY, TERMS, SUPPORT & COMPLIANCE ── */}
        <footer className="w-full max-w-md mx-auto pt-6 pb-2 text-center">
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium">
            <button
              type="button"
              onClick={() => openLegalModal('privacy')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('terms')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('contact')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Support & Contact
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('refunds')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Cancellation & Refunds
            </button>
            <span className="text-slate-300">&bull;</span>
            <button
              type="button"
              onClick={() => openLegalModal('shipping')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
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

export default SignupPage;
