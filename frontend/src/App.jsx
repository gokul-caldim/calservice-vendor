import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider.jsx';
import { AdminRoute, EmployeeRoute, AuthenticatedRoute } from './components/common/ProtectedRoute.jsx';

import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';

import { OnboardingWizardPage } from './pages/onboarding/OnboardingWizardPage.jsx';
import { PendingReviewPage } from './pages/onboarding/PendingReviewPage.jsx';
import { CorrectionRequiredPage } from './pages/onboarding/CorrectionRequiredPage.jsx';
import { RejectedPage } from './pages/onboarding/RejectedPage.jsx';

import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage.jsx';
import { EmployeeProfilePage } from './pages/employee/EmployeeProfilePage.jsx';
import { EmployeeSettingsPage } from './pages/employee/EmployeeSettingsPage.jsx';
import { EmployeePerformancePage } from './pages/employee/EmployeePerformancePage.jsx';
import { EmployeeLocationPage } from './pages/employee/EmployeeLocationPage.jsx';


import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { AdminApplicationsPage } from './pages/admin/AdminApplicationsPage.jsx';
import { AdminApplicationDetailPage } from './pages/admin/AdminApplicationDetailPage.jsx';
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage.jsx';
import { AdminJobsPage } from './pages/admin/AdminJobsPage.jsx';
import { AdminOperationsPage } from './pages/admin/AdminOperationsPage.jsx';

import { AdminPayrollPage } from './pages/admin/AdminPayrollPage.jsx';
import { AdminCompliancePage } from './pages/admin/AdminCompliancePage.jsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.jsx';
import { AdminSchedulingPage } from './pages/admin/AdminSchedulingPage.jsx';
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage.jsx';
import { AdminLeavePage } from './pages/admin/AdminLeavePage.jsx';
import { AdminSkillsPage } from './pages/admin/AdminSkillsPage.jsx';

function RootRedirect() {
  const { isReady, isAuthenticated, isAdmin, registrationStatus } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Loading workforce portal...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/workforce/login" replace />;

  if (isAdmin) {
    return <Navigate to="/workforce/admin" replace />;
  }

  if (registrationStatus === 'approved') {
    return <Navigate to="/workforce/employee/dashboard" replace />;
  } else if (registrationStatus === 'submitted' || registrationStatus === 'under_review') {
    return <Navigate to="/workforce/onboarding/pending-review" replace />;
  } else if (registrationStatus === 'correction_required') {
    return <Navigate to="/workforce/onboarding/corrections" replace />;
  } else if (registrationStatus === 'rejected') {
    return <Navigate to="/workforce/onboarding/rejected" replace />;
  } else {
    return <Navigate to="/workforce/onboarding/wizard" replace />;
  }
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Root */}
          <Route path="/" element={<RootRedirect />} />

          {/* Direct Role Route Aliases */}
          <Route path="/admin" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/admin/*" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/employee" element={<Navigate to="/workforce/employee/dashboard" replace />} />
          <Route path="/employee/*" element={<Navigate to="/workforce/employee/dashboard" replace />} />

          {/* Public Auth */}
          <Route path="/workforce/login" element={<LoginPage />} />
          <Route path="/workforce/signup" element={<SignupPage />} />

          {/* Technician Onboarding Lifecycle */}
          <Route
            path="/workforce/onboarding/wizard"
            element={
              <EmployeeRoute>
                <OnboardingWizardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/onboarding/pending-review"
            element={
              <EmployeeRoute>
                <PendingReviewPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/onboarding/corrections"
            element={
              <EmployeeRoute>
                <CorrectionRequiredPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/onboarding/rejected"
            element={
              <EmployeeRoute>
                <RejectedPage />
              </EmployeeRoute>
            }
          />

          {/* Approved Technician Workspace */}
          <Route
            path="/workforce/employee/dashboard"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/schedule"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/attendance"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/leave"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/earnings"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/documents"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/services"
            element={
              <EmployeeRoute>
                <EmployeeDashboardPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/profile"
            element={
              <EmployeeRoute>
                <EmployeeProfilePage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/settings"
            element={
              <EmployeeRoute>
                <EmployeeSettingsPage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/performance"
            element={
              <EmployeeRoute>
                <EmployeePerformancePage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/feedback"
            element={
              <EmployeeRoute>
                <EmployeePerformancePage />
              </EmployeeRoute>
            }
          />
          <Route
            path="/workforce/employee/location"
            element={
              <EmployeeRoute>
                <EmployeeLocationPage />
              </EmployeeRoute>
            }
          />


          {/* Workforce Admin Operations Workspace */}
          <Route
            path="/workforce/admin"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/applications"
            element={
              <AdminRoute>
                <AdminApplicationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/applications/:id"
            element={
              <AdminRoute>
                <AdminApplicationDetailPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/employees"
            element={
              <AdminRoute>
                <AdminEmployeesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/jobs"
            element={
              <AdminRoute>
                <AdminJobsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/dispatch"
            element={
              <AdminRoute>
                <AdminOperationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/operations"
            element={
              <AdminRoute>
                <AdminOperationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/services"
            element={
              <AdminRoute>
                <AdminApplicationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/skills"
            element={
              <AdminRoute>
                <AdminSkillsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/documents"
            element={
              <AdminRoute>
                <AdminCompliancePage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/scheduling"
            element={
              <AdminRoute>
                <AdminSchedulingPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/attendance"
            element={
              <AdminRoute>
                <AdminAttendancePage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/timesheets"
            element={
              <AdminRoute>
                <AdminAttendancePage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/leave"
            element={
              <AdminRoute>
                <AdminLeavePage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/payroll"
            element={
              <AdminRoute>
                <AdminPayrollPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/compliance"
            element={
              <AdminRoute>
                <AdminCompliancePage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/reports"
            element={
              <AdminRoute>
                <AdminReportsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/workforce/admin/settings"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/workforce/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
