import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { Wrench, Lock, User } from 'lucide-react';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-10 h-10 rounded bg-blue-600 items-center justify-center text-white font-bold mb-2 shadow-sm">
          <Wrench className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Workforce Portal
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Operations sign-in for Administrators &amp; Field Personnel
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 rounded p-6 shadow-sm space-y-4">
          {error && <ErrorState message={error} onDismiss={() => setError('')} />}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Email Address or Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or username"
                  className="w-full pl-8 pr-3 py-2 text-xs"
                  required
                  autoComplete="username"
                />
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-8 pr-3 py-2 text-xs"
                  required
                  autoComplete="current-password"
                />
                <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              New technician?{' '}
              <Link to="/workforce/signup" className="text-blue-600 font-semibold hover:underline">
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
