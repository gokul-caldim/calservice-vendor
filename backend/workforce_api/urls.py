"""
workforce-app/backend/workforce_api/urls.py
Route registrations for Workforce API (/api/workforce/*).
"""
from django.urls import include, path
from .views import (
    WorkforceSignupView,
    WorkforceOnboardingMeView,
    WorkforceOnboardingDraftView,
    WorkforceOnboardingDocumentUploadView,
    WorkforceOnboardingSubmitView,
    WorkforceCatalogListView,
    WorkforceAdminApplicationsListView,
    WorkforceAdminApplicationDetailView,
    WorkforceAdminDocumentVerifyView,
    WorkforceAdminBulkDocumentVerifyView,
    WorkforceAdminServiceDecideView,
    WorkforceAdminBulkServiceDecideView,
    WorkforceEmployeeServiceRequestView,
    WorkforceEmployeeServiceRemoveView,
    WorkforceAdminPendingServicesListView,
    WorkforceAdminRequestCorrectionView,
    WorkforceAdminApproveApplicationView,
    WorkforceAdminRejectApplicationView,
    WorkforcePresenceToggleView,
    WorkforcePresenceStatusView,
    WorkforceJobListView,
    WorkforceJobTransitionView,
    WorkforceJobProofView,
    WorkforceJobPaymentDetailView,
    WorkforceJobCashCollectView,
    WorkforceJobPaymentVerifyOTPView,
    WorkforceCustomerJobPaymentView,
    WorkforceCustomerPaymentConfirmView,
    WorkforceDispatchEligibleListView,
    WorkforceDispatchAssignView,
    WorkforceJobExtensionView,
    WorkforceAdminExtensionDecideView,
    WorkforceAdminPendingExtensionsListView,
    WorkforceCustomerExtensionDetailView,
    WorkforceCustomerExtensionDecideView,
    WorkforceTokenExtensionDecideView,
    WorkforceAdminAssignSpecialistView,
    WorkforceExtensionProgressView,
    WorkforceCreateSupplementalInvoiceView,
    WorkforceCustomerSupplementalInvoiceListView,
    WorkforcePaySupplementalInvoiceView,
    WorkforceJobRescheduleView,
    WorkforceCustomerRescheduleResponseView,
    WorkforceJobPurchaseRequestView,
    WorkforceAdminPurchaseDecideView,
    WorkforceTimeTrackingView,
    WorkforceLeaveListView,
    WorkforceLeaveCancelView,
    WorkforceAdminLeaveDecideView,
    WorkforceFleetMapView,
    WorkforceLocationUpdateView,
    WorkforceNotificationListView,
    WorkforceNotificationMarkReadView,
    WorkforceNotificationClearView,
    WorkforceScheduleManageView,
    WorkforceMyScheduleView,
    WorkforceSkillManageView,
    WorkforceEmployeeSkillAssignView,
    WorkforceMySkillsView,
    WorkforceComplianceRequirementView,
    WorkforceEmployeeComplianceView,
    WorkforceRealtimeStreamView,
    WorkforceAdminPayrollListView,
    WorkforceAdminPayrollProcessView,
    WorkforceMyPayslipsView,
    WorkforceJobAcceptOfferView,
    WorkforceJobCancelAssignmentView,
    WorkforceJobRejectOfferView,
    WorkforceJobTechnicianCancelView,
    WorkforceAutoDispatchTriggerView,
    WorkforceJobArriveView,
    WorkforceJobVerifyOTPView,
    WorkforceJobResendOTPView,
    WorkforceCustomerJobOTPView,
    WorkforceJobPreServicePhotoView,
    WorkforceJobPreServiceStatusView,
    WorkforceJobLiveTrackingView,
    WorkforceJobTimelineView,
    WorkforceReportsView,
    WorkforceLatencyAuditView,
    WorkforceVerificationSuiteView,
    WorkforceEmployeeProfileMeView,
    WorkforceProfileAvatarUploadView,
    WorkforceEmployeeChangeRequestView,
    WorkforceAdminChangeRequestsListView,
    WorkforceAdminChangeRequestDecideView,
    WorkforceChangePasswordView,
    WorkforceChangeEmailView,
    WorkforceTwoFactorView,
    WorkforceActiveSessionsView,
    WorkforceLoginHistoryView,
    WorkforceUserPreferenceView,
    WorkforceNotificationPreferenceView,
    WorkforcePrivacyExportView,
    WorkforceAccountDeactivateView,
    WorkforcePerformanceMeView,
    WorkforceJobFeedbackSubmitView,
    WorkforceMyServicesView,
    WorkforceEmployeeSavedLocationsView,
    WorkforceEmployeeSavedLocationDetailView,
    WorkforceAdminLocationToggleView,
    WorkforceAdminLocationAssignEmployeeView,
    WorkforcePublicSupportInquiryView,
)



urlpatterns = [
    # Public Operations & Support Inquiries
    path("support/inquiry/", WorkforcePublicSupportInquiryView.as_view(), name="workforce-support-inquiry"),

    # Technician Auth & Onboarding Lifecycle (Phases 4–8)
    path("signup/", WorkforceSignupView.as_view(), name="workforce-signup"),
    path("onboarding/me/", WorkforceOnboardingMeView.as_view(), name="workforce-onboarding-me"),
    path("onboarding/draft/", WorkforceOnboardingDraftView.as_view(), name="workforce-onboarding-draft"),
    path("onboarding/documents/", WorkforceOnboardingDocumentUploadView.as_view(), name="workforce-onboarding-documents"),
    path("onboarding/submit/", WorkforceOnboardingSubmitView.as_view(), name="workforce-onboarding-submit"),
    path("catalog/", WorkforceCatalogListView.as_view(), name="workforce-catalog"),

    # Employee Services Self-Service Request & Removal
    path("services/request/", WorkforceEmployeeServiceRequestView.as_view(), name="workforce-service-request"),
    path("services/remove/", WorkforceEmployeeServiceRemoveView.as_view(), name="workforce-service-remove"),

    # Workforce Admin Operations & Verification Queue (Phases 9–12)
    path("admin/applications/", WorkforceAdminApplicationsListView.as_view(), name="workforce-admin-applications"),
    path("admin/applications/<int:pk>/", WorkforceAdminApplicationDetailView.as_view(), name="workforce-admin-application-detail"),
    path("admin/applications/<int:pk>/document/<str:category>/verify/", WorkforceAdminDocumentVerifyView.as_view(), name="workforce-admin-doc-verify"),
    path("admin/applications/<int:pk>/documents/bulk-verify/", WorkforceAdminBulkDocumentVerifyView.as_view(), name="workforce-admin-docs-bulk-verify"),
    path("admin/applications/<int:pk>/service/<int:service_id>/decide/", WorkforceAdminServiceDecideView.as_view(), name="workforce-admin-service-decide"),
    path("admin/applications/<int:pk>/services/bulk-decide/", WorkforceAdminBulkServiceDecideView.as_view(), name="workforce-admin-services-bulk-decide"),
    path("admin/services/pending-requests/", WorkforceAdminPendingServicesListView.as_view(), name="workforce-admin-pending-services"),
    path("admin/applications/<int:pk>/request-correction/", WorkforceAdminRequestCorrectionView.as_view(), name="workforce-admin-request-correction"),
    path("admin/applications/<int:pk>/approve/", WorkforceAdminApproveApplicationView.as_view(), name="workforce-admin-approve"),
    path("admin/applications/<int:pk>/reject/", WorkforceAdminRejectApplicationView.as_view(), name="workforce-admin-reject"),

    # Technician Live Presence & Availability (Phase 13)
    path("presence/toggle-online/", WorkforcePresenceToggleView.as_view(), name="workforce-presence-toggle"),
    path("presence/status/", WorkforcePresenceStatusView.as_view(), name="workforce-presence-status"),

    # Field Jobs & State Machine Execution (Phases 15–16)
    path("jobs/", WorkforceJobListView.as_view(), name="workforce-jobs"),
    path("jobs/<int:pk>/transition/", WorkforceJobTransitionView.as_view(), name="workforce-job-transition"),
    path("jobs/<int:pk>/proof/", WorkforceJobProofView.as_view(), name="workforce-job-proof"),
    path("jobs/<int:pk>/collect-cash/", WorkforceJobCashCollectView.as_view(), name="workforce-job-cash-collect"),
    path("jobs/<int:pk>/payment/", WorkforceJobPaymentDetailView.as_view(), name="workforce-job-payment-detail"),
    path("jobs/<int:pk>/payment/collect/", WorkforceJobCashCollectView.as_view(), name="workforce-job-payment-collect-dedicated"),
    path("jobs/<int:pk>/payment/verify-otp/", WorkforceJobPaymentVerifyOTPView.as_view(), name="workforce-job-payment-verify-otp"),
    path("customer/jobs/<int:pk>/payment/", WorkforceCustomerJobPaymentView.as_view(), name="workforce-customer-job-payment"),
    path("customer/jobs/<int:pk>/payment/confirm/", WorkforceCustomerPaymentConfirmView.as_view(), name="workforce-customer-payment-confirm"),

    # Dynamic Dispatch & Skill Matching (Phase 14)
    path("dispatch/eligible-technicians/", WorkforceDispatchEligibleListView.as_view(), name="workforce-dispatch-eligible"),
    path("dispatch/assign/", WorkforceDispatchAssignView.as_view(), name="workforce-dispatch-assign"),
    path("dispatch/auto-dispatch/<int:pk>/", WorkforceAutoDispatchTriggerView.as_view(), name="workforce-auto-dispatch-trigger"),
    path("jobs/<int:pk>/accept-offer/", WorkforceJobAcceptOfferView.as_view(), name="workforce-job-accept-offer"),
    path("jobs/<int:pk>/cancel-assignment/", WorkforceJobCancelAssignmentView.as_view(), name="workforce-job-cancel-assignment"),
    path("jobs/<int:pk>/reject-offer/", WorkforceJobRejectOfferView.as_view(), name="workforce-job-reject-offer"),
    path("jobs/<int:pk>/cancel/", WorkforceJobTechnicianCancelView.as_view(), name="workforce-job-technician-cancel"),
    path("jobs/<int:pk>/arrive/", WorkforceJobArriveView.as_view(), name="workforce-job-arrive"),
    path("jobs/<int:pk>/verify-otp/", WorkforceJobVerifyOTPView.as_view(), name="workforce-job-verify-otp"),
    path("jobs/<int:pk>/resend-otp/", WorkforceJobResendOTPView.as_view(), name="workforce-job-resend-otp"),
    path("jobs/<int:pk>/customer-otp/", WorkforceCustomerJobOTPView.as_view(), name="workforce-job-customer-otp"),
    path("jobs/<int:pk>/pre-service-photo/", WorkforceJobPreServicePhotoView.as_view(), name="workforce-job-pre-service-photo"),
    path("jobs/<int:pk>/pre-service-status/", WorkforceJobPreServiceStatusView.as_view(), name="workforce-job-pre-service-status"),
    path("jobs/<int:pk>/live-tracking/", WorkforceJobLiveTrackingView.as_view(), name="workforce-job-live-tracking"),
    path("jobs/<int:pk>/timeline/", WorkforceJobTimelineView.as_view(), name="workforce-job-timeline"),
    path("customer/jobs/<int:pk>/tracking/", WorkforceJobLiveTrackingView.as_view(), name="workforce-customer-job-tracking"),

    # Work Extensions & Scope Approvals
    path("jobs/<int:pk>/extension/", WorkforceJobExtensionView.as_view(), name="workforce-job-extension"),
    path("jobs/<int:pk>/extensions/", WorkforceJobExtensionView.as_view(), name="workforce-job-extensions-list"),
    path("jobs/<int:pk>/extension/<int:ext_id>/customer-decide/", WorkforceCustomerExtensionDecideView.as_view(), name="workforce-customer-extension-decide"),
    path("jobs/<int:pk>/extension/<int:ext_id>/progress/", WorkforceExtensionProgressView.as_view(), name="workforce-extension-progress"),
    path("admin/extensions/pending/", WorkforceAdminPendingExtensionsListView.as_view(), name="workforce-admin-pending-extensions"),
    path("admin/jobs/<int:pk>/extension/<int:ext_id>/decide/", WorkforceAdminExtensionDecideView.as_view(), name="workforce-admin-extension-decide"),
    path("admin/jobs/<int:pk>/extension/<int:ext_id>/assign-specialist/", WorkforceAdminAssignSpecialistView.as_view(), name="workforce-admin-assign-specialist"),
    path("jobs/<int:pk>/purchase-request/", WorkforceJobPurchaseRequestView.as_view(), name="workforce-job-purchase-request"),
    path("admin/jobs/<int:pk>/purchase-request/<int:req_id>/decide/", WorkforceAdminPurchaseDecideView.as_view(), name="workforce-admin-purchase-decide"),

    # Customer Handover Endpoints (Work Start OTP, Additional Work Decision, Supplemental Invoices)
    path("customer/jobs/<int:pk>/otp/", WorkforceCustomerJobOTPView.as_view(), name="workforce-customer-job-otp-dedicated"),
    path("customer/jobs/<int:pk>/extension/<int:ext_id>/", WorkforceCustomerExtensionDetailView.as_view(), name="workforce-customer-extension-detail"),
    path("customer/jobs/<int:pk>/extension/<int:ext_id>/decide/", WorkforceCustomerExtensionDecideView.as_view(), name="workforce-customer-extension-decide-dedicated"),
    path("customer/extension-token/<str:token>/", WorkforceCustomerExtensionDetailView.as_view(), name="workforce-customer-token-extension-detail"),
    path("customer/extension-token/<str:token>/decide/", WorkforceTokenExtensionDecideView.as_view(), name="workforce-customer-token-extension-decide"),

    # Supplemental Billing & Invoices
    path("jobs/<int:pk>/extension/<int:ext_id>/create-supplemental-invoice/", WorkforceCreateSupplementalInvoiceView.as_view(), name="workforce-create-supplemental-invoice"),
    path("customer/jobs/<int:pk>/supplemental-invoices/", WorkforceCustomerSupplementalInvoiceListView.as_view(), name="workforce-customer-supplemental-invoices"),
    path("customer/supplemental-invoice/<int:invoice_id>/pay/", WorkforcePaySupplementalInvoiceView.as_view(), name="workforce-pay-supplemental-invoice"),

    # Rescheduling & Delay Escalation
    path("jobs/<int:pk>/reschedule/", WorkforceJobRescheduleView.as_view(), name="workforce-job-reschedule"),
    path("customer/jobs/<int:pk>/reschedule-response/", WorkforceCustomerRescheduleResponseView.as_view(), name="workforce-customer-reschedule-response"),

    # Shift Attendance & Geofenced Time Tracking (Phase 18)
    path("time-tracking/", include("time_tracking.urls")),
    path("time/", include("time_tracking.urls")),


    # Leave Management (Phase 19)
    path("leaves/", WorkforceLeaveListView.as_view(), name="workforce-leaves"),
    path("leaves/<int:leave_id>/cancel/", WorkforceLeaveCancelView.as_view(), name="workforce-leave-cancel"),
    path("admin/leaves/<int:emp_id>/<int:leave_id>/decide/", WorkforceAdminLeaveDecideView.as_view(), name="workforce-admin-leave-decide"),

    # Real-Time Fleet Map & GPS Streaming (Phase 20)
    path("presence/fleet-map/", WorkforceFleetMapView.as_view(), name="workforce-fleet-map"),
    path("presence/location/", WorkforceLocationUpdateView.as_view(), name="workforce-location-update"),

    # Notifications Engine (Phase 21)
    path("notifications/", WorkforceNotificationListView.as_view(), name="workforce-notifications"),
    path("notifications/mark-read/", WorkforceNotificationMarkReadView.as_view(), name="workforce-notifications-mark-read-all"),
    path("notifications/<int:pk>/mark-read/", WorkforceNotificationMarkReadView.as_view(), name="workforce-notifications-mark-read"),
    path("notifications/clear/", WorkforceNotificationClearView.as_view(), name="workforce-notifications-clear-all"),
    path("notifications/<int:pk>/clear/", WorkforceNotificationClearView.as_view(), name="workforce-notifications-clear"),

    # Workforce Scheduling (Phase 22)
    path("schedules/manage/", WorkforceScheduleManageView.as_view(), name="workforce-schedules-manage-all"),
    path("schedules/manage/<int:emp_id>/", WorkforceScheduleManageView.as_view(), name="workforce-schedules-manage"),
    path("schedules/me/", WorkforceMyScheduleView.as_view(), name="workforce-schedules-me"),

    # Skills Management (Phase 23)
    path("skills/", WorkforceSkillManageView.as_view(), name="workforce-skills"),
    path("skills/employee/<int:emp_id>/", WorkforceEmployeeSkillAssignView.as_view(), name="workforce-skills-assign"),
    path("skills/me/", WorkforceMySkillsView.as_view(), name="workforce-skills-me"),

    # Compliance Management (Phase 24)
    path("compliance/requirements/", WorkforceComplianceRequirementView.as_view(), name="workforce-compliance-requirements"),
    path("compliance/records/", WorkforceEmployeeComplianceView.as_view(), name="workforce-compliance-records-all"),
    path("compliance/records/<int:emp_id>/", WorkforceEmployeeComplianceView.as_view(), name="workforce-compliance-records-emp"),

    # Workforce Realtime Stream (Phase 25)
    path("realtime/stream/", WorkforceRealtimeStreamView.as_view(), name="workforce-realtime-stream"),

    # Payroll Management (Phase 26)
    path("payroll/periods/", WorkforceAdminPayrollListView.as_view(), name="workforce-payroll-periods"),
    path("payroll/periods/<int:period_id>/process/", WorkforceAdminPayrollProcessView.as_view(), name="workforce-payroll-process"),
    path("payroll/me/", WorkforceMyPayslipsView.as_view(), name="workforce-payroll-me"),

    # Reports Engine (Phase 27)
    path("reports/", WorkforceReportsView.as_view(), name="workforce-reports"),

    # Performance & Latency Audit
    path("audit-latency/", WorkforceLatencyAuditView.as_view(), name="workforce-audit-latency"),

    # Automated Test Verification Suite
    path("test-verification-suite/", WorkforceVerificationSuiteView.as_view(), name="workforce-test-verification-suite"),

    # ── Complete Employee Platform Integration Routes ─────────────────────────
    # Profile & Change Requests
    path("profile/me/", WorkforceEmployeeProfileMeView.as_view(), name="workforce-profile-me"),
    path("profile/avatar/", WorkforceProfileAvatarUploadView.as_view(), name="workforce-profile-avatar"),
    path("profile/change-requests/", WorkforceEmployeeChangeRequestView.as_view(), name="workforce-profile-change-requests"),
    path("admin/change-requests/", WorkforceAdminChangeRequestsListView.as_view(), name="workforce-admin-change-requests"),
    path("admin/change-requests/<int:pk>/decide/", WorkforceAdminChangeRequestDecideView.as_view(), name="workforce-admin-change-request-decide"),

    # Account & Security
    path("security/change-password/", WorkforceChangePasswordView.as_view(), name="workforce-security-change-password"),
    path("security/change-email/", WorkforceChangeEmailView.as_view(), name="workforce-security-change-email"),
    path("security/2fa/", WorkforceTwoFactorView.as_view(), name="workforce-security-2fa"),
    path("security/2fa/toggle/", WorkforceTwoFactorView.as_view(), name="workforce-security-2fa-toggle"),
    path("security/sessions/", WorkforceActiveSessionsView.as_view(), name="workforce-security-sessions"),
    path("security/login-history/", WorkforceLoginHistoryView.as_view(), name="workforce-security-login-history"),

    # Appearance & Preferences
    path("preferences/", WorkforceUserPreferenceView.as_view(), name="workforce-preferences"),

    # Notifications Preferences
    path("notifications/preferences/", WorkforceNotificationPreferenceView.as_view(), name="workforce-notification-preferences"),

    # Privacy & Data
    path("privacy/export/", WorkforcePrivacyExportView.as_view(), name="workforce-privacy-export"),
    path("privacy/deactivate/", WorkforceAccountDeactivateView.as_view(), name="workforce-privacy-deactivate"),

    # My Feedback & Performance
    path("performance/me/", WorkforcePerformanceMeView.as_view(), name="workforce-performance-me"),
    path("jobs/<int:job_id>/feedback/", WorkforceJobFeedbackSubmitView.as_view(), name="workforce-job-feedback-submit"),
    path("feedback/submit/", WorkforceJobFeedbackSubmitView.as_view(), name="workforce-feedback-submit"),

    # Employee Services Self-Service
    path("services/my-services/", WorkforceMyServicesView.as_view(), name="workforce-my-services"),

    # Employee Saved Locations (personal, not company geofence)
    path("locations/saved/", WorkforceEmployeeSavedLocationsView.as_view(), name="workforce-saved-locations"),
    path("locations/saved/<int:pk>/", WorkforceEmployeeSavedLocationDetailView.as_view(), name="workforce-saved-location-detail"),

    # Admin: Authorized Location management extensions
    path("admin/locations/<int:pk>/toggle/", WorkforceAdminLocationToggleView.as_view(), name="workforce-admin-location-toggle"),
    path("admin/locations/<int:pk>/assign/", WorkforceAdminLocationAssignEmployeeView.as_view(), name="workforce-admin-location-assign"),
]


