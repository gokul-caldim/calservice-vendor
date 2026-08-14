import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';

export function AdminRoute({ children }) {
  const { isReady, isAuthenticated, isAdmin } = useAuth();
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

  if (!isAdmin) {
    // If an employee user attempts to open /admin/*, redirect to employee dashboard
    return <Navigate to="/workforce/employee/dashboard" replace />;
  }

  return children;
}

export default AdminRoute;
