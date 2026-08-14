import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(err.message || 'Invalid credentials. Please verify your email/password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-900 font-sans text-slate-900 antialiased">
      {/* ── LEFT: QUIET BRAND PANEL (Desktop Only) ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col justify-between bg-slate-900 text-white p-10 xl:p-14 border-r border-slate-800">
        <div>
          <div className="text-sm font-bold tracking-widest text-slate-200 uppercase">
            CAL SERVICES
          </div>
          <div className="text-xs text-blue-400 font-medium tracking-wide">
            Workforce
          </div>
        </div>

        <div>
          <h1 className="text-2xl xl:text-3xl font-bold text-white tracking-tight">
            Field Operations
          </h1>
        </div>


        <div className="text-[11px] text-slate-500 font-normal">
          &copy; CalServices. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT: LOGIN AREA ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 bg-white">
        <div className="w-full max-w-[380px] space-y-6">
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
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}

export default LoginPage;
