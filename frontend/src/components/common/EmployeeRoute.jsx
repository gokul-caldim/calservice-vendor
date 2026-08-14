import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';

export function EmployeeRoute({ children }) {
  const { isReady, isAuthenticated, isAdmin, registrationStatus } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/workforce/login" state={{ from: location }} replace />;
  }

  if (isAdmin) {
    // If an admin user attempts to access employee routes, redirect to admin dashboard
    return <Navigate to="/workforce/admin" replace />;
  }

  // Employee Lifecycle Guard
  const currentPath = location.pathname;

  if (registrationStatus === 'not_started' || registrationStatus === 'in_progress') {
    if (!currentPath.includes('/workforce/onboarding/wizard')) {
      return <Navigate to="/workforce/onboarding/wizard" replace />;
    }
  } else if (registrationStatus === 'submitted' || registrationStatus === 'under_review') {
    if (!currentPath.includes('/workforce/onboarding/pending-review') && !currentPath.includes('/workforce/onboarding/wizard')) {
      return <Navigate to="/workforce/onboarding/pending-review" replace />;
    }
  } else if (registrationStatus === 'correction_required') {
    if (!currentPath.includes('/workforce/onboarding/corrections') && !currentPath.includes('/workforce/onboarding/wizard')) {
      return <Navigate to="/workforce/onboarding/corrections" replace />;
    }
  } else if (registrationStatus === 'rejected') {
    if (!currentPath.includes('/workforce/onboarding/rejected') && !currentPath.includes('/workforce/onboarding/wizard')) {
      return <Navigate to="/workforce/onboarding/rejected" replace />;
    }
  }


  return children;
}

export default EmployeeRoute;
