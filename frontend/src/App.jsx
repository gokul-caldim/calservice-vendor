import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider.jsx';
import { EmployeeRuntimeProvider } from './context/EmployeeRuntimeProvider.jsx';
import { AdminRoute, EmployeeRoute, AuthenticatedRoute } from './components/common/ProtectedRoute.jsx';

import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';

import { TermsAndConditionsPage } from './pages/public/TermsAndConditionsPage.jsx';
import { PrivacyPolicyPage } from './pages/public/PrivacyPolicyPage.jsx';
import { SupportAndContactPage } from './pages/public/SupportAndContactPage.jsx';
import { CancellationRefundsPage } from './pages/public/CancellationRefundsPage.jsx';
import { ShippingPolicyPage } from './pages/public/ShippingPolicyPage.jsx';

import { OnboardingWizardPage } from './pages/onboarding/OnboardingWizardPage.jsx';
import { PendingReviewPage } from './pages/onboarding/PendingReviewPage.jsx';
import { CorrectionRequiredPage } from './pages/onboarding/CorrectionRequiredPage.jsx';
import { RejectedPage } from './pages/onboarding/RejectedPage.jsx';

import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage.jsx';
import { EmployeeProfilePage } from './pages/employee/EmployeeProfilePage.jsx';
import { EmployeeSettingsPage } from './pages/employee/EmployeeSettingsPage.jsx';
import { EmployeePerformancePage } from './pages/employee/EmployeePerformancePage.jsx';
import { EmployeeLocationPage } from './pages/employee/EmployeeLocationPage.jsx';

function EmployeeWorkspaceLayout() {
  return (
    <EmployeeRoute>
      <EmployeeRuntimeProvider>
        <Outlet />
      </EmployeeRuntimeProvider>
    </EmployeeRoute>
  );
}


import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { AdminApplicationsPage } from './pages/admin/AdminApplicationsPage.jsx';
import { AdminApplicationDetailPage } from './pages/admin/AdminApplicationDetailPage.jsx';
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage.jsx';
import { AdminJobsPage } from './pages/admin/AdminJobsPage.jsx';
import { AdminOperationsPage } from './pages/admin/AdminOperationsPage.jsx';
import { AdminReportsPage } from './pages/admin/AdminReportsPage.jsx';
import { AdminSkillsPage } from './pages/admin/AdminSkillsPage.jsx';
import { CustomerTrackingPage } from './pages/customer/CustomerTrackingPage.jsx';

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

          {/* Public Legal, Compliance & Support Hub */}
          <Route path="/terms" element={<TermsAndConditionsPage />} />
          <Route path="/workforce/terms" element={<TermsAndConditionsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/workforce/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/support" element={<SupportAndContactPage />} />
          <Route path="/contact" element={<SupportAndContactPage />} />
          <Route path="/workforce/support" element={<SupportAndContactPage />} />
          <Route path="/cancellation-refunds" element={<CancellationRefundsPage />} />
          <Route path="/refunds" element={<CancellationRefundsPage />} />
          <Route path="/workforce/cancellation-refunds" element={<CancellationRefundsPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/workforce/shipping-policy" element={<ShippingPolicyPage />} />

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

          {/* Approved Technician Workspace with Persistent Session Runtime */}
          <Route path="/workforce/employee" element={<EmployeeWorkspaceLayout />}>
            <Route index element={<Navigate to="/workforce/employee/dashboard" replace />} />
            <Route path="dashboard" element={<EmployeeDashboardPage />} />
            <Route path="jobs" element={<EmployeeDashboardPage />} />
            <Route path="schedule" element={<Navigate to="/workforce/employee/dashboard" replace />} />
            <Route path="attendance" element={<Navigate to="/workforce/employee/dashboard" replace />} />
            <Route path="leave" element={<Navigate to="/workforce/employee/dashboard" replace />} />
            <Route path="earnings" element={<Navigate to="/workforce/employee/dashboard" replace />} />
            <Route path="documents" element={<EmployeeDashboardPage />} />
            <Route path="services" element={<EmployeeDashboardPage />} />
            <Route path="profile" element={<EmployeeProfilePage />} />
            <Route path="settings" element={<EmployeeSettingsPage />} />
            <Route path="performance" element={<EmployeePerformancePage />} />
            <Route path="feedback" element={<EmployeePerformancePage />} />
            <Route path="location" element={<EmployeeLocationPage />} />
          </Route>


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

          {/* Removed Admin Routes Redirects */}
          <Route path="/workforce/admin/documents" element={<Navigate to="/workforce/admin/applications" replace />} />
          <Route path="/workforce/admin/scheduling" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/workforce/admin/attendance" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/workforce/admin/timesheets" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/workforce/admin/leave" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/workforce/admin/payroll" element={<Navigate to="/workforce/admin" replace />} />
          <Route path="/workforce/admin/compliance" element={<Navigate to="/workforce/admin" replace />} />

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

          {/* Customer Live Tracking Routes */}
          <Route path="/track/:jobId" element={<CustomerTrackingPage />} />
          <Route path="/customer/track/:jobId" element={<CustomerTrackingPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/workforce/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
