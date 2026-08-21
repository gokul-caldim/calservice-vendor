/**
 * workforce-app/frontend/src/api/workforceService.js
 * Comprehensive API Client for all 21 CalServices Workforce Lifecycle Phases.
 */
import { apiRequest } from './client.js';

// ── Auth & Identity (Phases 1–4) ─────────────────────────────────────────────

export async function apiWorkforceSignup(payload) {
  return await apiRequest('/workforce/signup/', {
    method: 'POST',
    json: payload,
  });
}

export async function apiWorkforceLogin(identifier, password) {
  const trimmed = (identifier || '').trim();
  return await apiRequest('/auth/login/', {
    method: 'POST',
    json: {
      identifier: trimmed,
      email: trimmed,
      username: trimmed,
      password: password,
    },
  });
}


export async function apiFetchMe() {
  return await apiRequest('/auth/me/');
}

export async function apiWorkforceLogout() {
  return await apiRequest('/auth/logout/', {
    method: 'POST',
  });
}

export async function apiSubmitSupportInquiry(payload) {
  return await apiRequest('/workforce/support/inquiry/', {
    method: 'POST',
    json: payload,
  });
}

// ── Onboarding Wizard (Phases 5–7) ───────────────────────────────────────────

export async function apiGetOnboardingProfile() {
  return await apiRequest('/workforce/onboarding/me/');
}

export async function apiSaveOnboardingDraft(step, draftData) {
  return await apiRequest('/workforce/onboarding/draft/', {
    method: 'PATCH',
    json: {
      step,
      draft_data: draftData,
    },
  });
}

export async function apiUploadDocument(categoryOrFormData, file = null, title = '') {
  let body;
  if (categoryOrFormData instanceof FormData) {
    body = categoryOrFormData;
  } else {
    const formData = new FormData();
    formData.append('category', categoryOrFormData);
    if (file) {
      formData.append('file', file);
    }
    if (title) {
      formData.append('title', title);
    }
    body = formData;
  }
  return await apiRequest('/workforce/onboarding/documents/', {
    method: 'POST',
    body,
    isFormData: true,
  });
}

export const apiUploadOnboardingDocument = apiUploadDocument;

export async function apiSubmitOnboarding() {
  return await apiRequest('/workforce/onboarding/submit/', {
    method: 'POST',
  });
}

export const apiSubmitOnboardingApplication = apiSubmitOnboarding;

export async function apiGetCatalog() {
  return await apiRequest('/workforce/catalog/');
}

export const apiGetCatalogServices = apiGetCatalog;

// ── Presence & Heartbeat (Phase 13) ──────────────────────────────────────────

export async function apiTogglePresence(isOnline = null) {
  return await apiRequest('/workforce/presence/toggle-online/', {
    method: 'POST',
    json: isOnline !== null ? { is_online: isOnline } : {},
  });
}

export async function apiGetPresenceStatus() {
  return await apiRequest('/workforce/presence/status/');
}

export async function apiGetWorkforceJobs(status = 'active') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return await apiRequest(`/workforce/jobs/${query}`);
}

export async function apiTransitionJob(jobId, targetStatus) {
  return await apiRequest(`/workforce/jobs/${jobId}/transition/`, {
    method: 'POST',
    json: { status: targetStatus },
  });
}

export async function apiAcceptJobOffer(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/accept-offer/`, {
    method: 'POST',
  });
}

export async function apiCancelJobAssignment(jobId, reasonCode, reasonText = '') {
  return await apiRequest(`/workforce/jobs/${jobId}/cancel-assignment/`, {
    method: 'POST',
    json: { reason_code: reasonCode, reason_text: reasonText },
  });
}

export async function apiRejectJobOffer(jobId, reason = '') {
  return await apiRequest(`/workforce/jobs/${jobId}/reject-offer/`, {
    method: 'POST',
    json: { reason },
  });
}

export async function apiCancelJob(jobId, reasonCode, reasonDetail = '') {
  return await apiRequest(`/workforce/jobs/${jobId}/cancel/`, {
    method: 'POST',
    json: {
      reason_code: reasonCode,
      reason_detail: reasonDetail,
    },
  });
}

export async function apiVerifyArrival(jobId, lat, lon, accuracy = null, timestamp = null) {
  return await apiRequest(`/workforce/jobs/${jobId}/arrive/`, {
    method: 'POST',
    json: {
      lat,
      lon,
      latitude: lat,
      longitude: lon,
      accuracy,
      timestamp: timestamp || Date.now(),
    },
  });
}


export async function apiVerifyOTP(jobId, otp) {
  return await apiRequest(`/workforce/jobs/${jobId}/verify-otp/`, {
    method: 'POST',
    json: { otp },
  });
}

export async function apiResendOTP(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/resend-otp/`, {
    method: 'POST',
  });
}

export async function apiUploadPreServicePhoto(jobId, photoType, file) {
  const formData = new FormData();
  formData.append('photo_type', photoType);
  formData.append('file', file);
  return await apiRequest(`/workforce/jobs/${jobId}/pre-service-photo/`, {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
}

export async function apiGetPreServiceStatus(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/pre-service-status/`);
}

export async function apiUploadJobProof(jobId, formData) {
  return await apiRequest(`/workforce/jobs/${jobId}/proof/`, {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
}

export async function apiGetJobPayment(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/payment/`);
}

export async function apiCollectJobCash(jobId, amountReceived) {
  return await apiRequest(`/workforce/jobs/${jobId}/payment/collect/`, {
    method: 'POST',
    json: { amount_received: amountReceived },
  });
}

export async function apiGetCustomerJobPayment(jobId) {
  return await apiRequest(`/workforce/customer/jobs/${jobId}/payment/`);
}

export async function apiCustomerConfirmPayment(jobId, payload) {
  return await apiRequest(`/workforce/customer/jobs/${jobId}/payment/confirm/`, {
    method: 'POST',
    json: payload,
  });
}

export async function apiTriggerAutoDispatch(jobId) {
  return await apiRequest(`/workforce/dispatch/auto-dispatch/${jobId}/`, {
    method: 'POST',
  });
}

// ── Work Extensions & Scope Approvals ─────────────────────────────────────────

export async function apiGetCustomerOTP(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/customer-otp/`);
}

export async function apiGetJobExtensions(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/extensions/`);
}

export async function apiRequestWorkExtension(jobId, payload) {
  return await apiRequest(`/workforce/jobs/${jobId}/extension/`, {
    method: 'POST',
    json: payload,
  });
}

export async function apiGetAdminPendingExtensions() {
  return await apiRequest('/workforce/admin/extensions/pending/');
}

export async function apiAdminDecideExtension(jobId, extId, action, reason = '', approvedAmount = null) {
  const json = { action, reason };
  if (approvedAmount !== null && approvedAmount !== undefined) {
    json.approved_amount = approvedAmount;
  }
  return await apiRequest(`/workforce/admin/jobs/${jobId}/extension/${extId}/decide/`, {
    method: 'POST',
    json,
  });
}

export async function apiCustomerDecideExtension(jobId, extId, action, reason = '') {
  return await apiRequest(`/workforce/jobs/${jobId}/extension/${extId}/customer-decide/`, {
    method: 'POST',
    json: { action, reason },
  });
}

export async function apiProgressExtension(jobId, extId, action) {
  return await apiRequest(`/workforce/jobs/${jobId}/extension/${extId}/progress/`, {
    method: 'POST',
    json: { action },
  });
}

export async function apiRequestPartsPurchase(jobId, payload) {
  return await apiRequest(`/workforce/jobs/${jobId}/purchase-request/`, {
    method: 'POST',
    json: payload,
  });
}

export async function apiAdminDecidePurchase(jobId, reqId, action, reason = '') {
  return await apiRequest(`/workforce/admin/jobs/${jobId}/purchase-request/${reqId}/decide/`, {
    method: 'POST',
    json: { action, reason },
  });
}

// ── Real-Time Fleet Map & Location (Phase 20) ─────────────────────────────────

export async function apiGetFleetMap() {
  return await apiRequest('/workforce/presence/fleet-map/');
}

export async function apiUpdateLocation(latitude, longitude) {
  return await apiRequest('/workforce/presence/location/', {
    method: 'POST',
    json: { latitude, longitude },
  });
}

// ── Admin Verification Workspace (Phases 9–12) ───────────────────────────────

export async function apiGetAdminApplications(statusFilter = '') {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
  return await apiRequest(`/workforce/admin/applications/${query}`);
}

export async function apiGetAdminApplicationDetail(applicationId) {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/`);
}

export async function apiVerifyDocument(applicationId, docCategory, action, reason = '') {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/document/${docCategory}/verify/`, {
    method: 'POST',
    json: { action, reason },
  });
}

export async function apiBulkVerifyDocuments(applicationId, categories, action, reason = '', allPending = false) {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/documents/bulk-verify/`, {
    method: 'POST',
    json: {
      categories,
      action,
      reason,
      all_pending: allPending,
    },
  });
}

export async function apiRequestService(serviceId, name = '') {
  return await apiRequest('/workforce/services/request/', {
    method: 'POST',
    json: { service_id: serviceId, name },
  });
}

export async function apiBulkRequestServices(serviceIds) {
  return await apiRequest('/workforce/services/request/', {
    method: 'POST',
    json: { service_ids: serviceIds },
  });
}

export async function apiRemoveService(serviceId) {
  return await apiRequest('/workforce/services/remove/', {
    method: 'POST',
    json: { service_id: serviceId },
  });
}

export async function apiGetAdminPendingServices() {
  return await apiRequest('/workforce/admin/services/pending-requests/');
}

export async function apiDecideService(applicationId, serviceId, action, reason = '') {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/service/${serviceId}/decide/`, {
    method: 'POST',
    json: { action, reason },
  });
}

export async function apiBulkDecideServices(applicationId, serviceIds, action, reason = '', allPending = false) {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/services/bulk-decide/`, {
    method: 'POST',
    json: {
      service_ids: serviceIds,
      action,
      reason,
      all_pending: allPending,
    },
  });
}

export async function apiRequestCorrection(applicationId, notes) {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/request-correction/`, {
    method: 'POST',
    json: { notes },
  });
}

export async function apiApproveApplication(applicationId) {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/approve/`, {
    method: 'POST',
  });
}

export async function apiRejectApplication(applicationId, reason = '') {
  return await apiRequest(`/workforce/admin/applications/${applicationId}/reject/`, {
    method: 'POST',
    json: { reason },
  });
}

// ── Admin Dynamic Dispatch & Matching (Phase 14) ──────────────────────────────

export async function apiGetEligibleTechnicians(jobId = '', serviceName = '', radiusKm = 20.0) {
  const params = new URLSearchParams();
  if (jobId) params.set('job_id', jobId);
  if (serviceName) params.set('service', serviceName);
  if (radiusKm) params.set('radius_km', radiusKm);
  return await apiRequest(`/workforce/dispatch/eligible-technicians/?${params.toString()}`);
}

export async function apiDispatchAssign(jobId, employeeId) {
  return await apiRequest('/workforce/dispatch/assign/', {
    method: 'POST',
    json: { job_id: jobId, employee_id: employeeId },
  });
}

// ── Notifications (Phase 21) ──────────────────────────────────────────────────

export async function apiGetNotifications() {
  return await apiRequest('/workforce/notifications/');
}

export async function apiMarkNotificationRead(id = null, ids = null) {
  if (id) {
    return await apiRequest(`/workforce/notifications/${id}/mark-read/`, { method: 'POST' });
  }
  if (ids && ids.length > 0) {
    return await apiRequest('/workforce/notifications/mark-read/', {
      method: 'POST',
      json: { ids },
    });
  }
  return await apiRequest('/workforce/notifications/mark-read/', { method: 'POST' });
}

export async function apiClearNotifications(id = null, ids = null, clearAll = false) {
  if (id) {
    return await apiRequest(`/workforce/notifications/${id}/clear/`, { method: 'POST' });
  }
  if (ids && ids.length > 0) {
    return await apiRequest('/workforce/notifications/clear/', {
      method: 'POST',
      json: { ids },
    });
  }
  return await apiRequest('/workforce/notifications/clear/', {
    method: 'POST',
    json: { all: true },
  });
}

// ── Scheduling (Phase 22) ────────────────────────────────────────────────────

export async function apiGetSchedules(empId = null) {
  const path = empId ? `/workforce/schedules/manage/${empId}/` : '/workforce/schedules/manage/';
  return await apiRequest(path);
}

export async function apiSaveSchedules(empId, schedules) {
  return await apiRequest(`/workforce/schedules/manage/${empId}/`, {
    method: 'POST',
    json: { schedules },
  });
}

export async function apiGetMySchedule() {
  return await apiRequest('/workforce/schedules/me/');
}

// ── Skills Management (Phase 23) ─────────────────────────────────────────────

export async function apiGetSkills() {
  return await apiRequest('/workforce/skills/');
}

export async function apiCreateSkill(data) {
  return await apiRequest('/workforce/skills/', {
    method: 'POST',
    json: data,
  });
}

export async function apiAssignSkill(empId, skillId, proficiencyLevel = 'INTERMEDIATE', action = 'assign') {
  return await apiRequest(`/workforce/skills/employee/${empId}/`, {
    method: 'POST',
    json: { skill_id: skillId, proficiency_level: proficiencyLevel, action },
  });
}

export async function apiGetMySkills() {
  return await apiRequest('/workforce/skills/me/');
}

// ── Compliance Management (Phase 24) ──────────────────────────────────────────

export async function apiGetComplianceRequirements() {
  return await apiRequest('/workforce/compliance/requirements/');
}

export async function apiCreateComplianceRequirement(data) {
  return await apiRequest('/workforce/compliance/requirements/', {
    method: 'POST',
    json: data,
  });
}

export async function apiGetComplianceRecords(empId = null) {
  const path = empId ? `/workforce/compliance/records/${empId}/` : '/workforce/compliance/records/';
  return await apiRequest(path);
}

export async function apiSubmitComplianceRecord(data) {
  return await apiRequest('/workforce/compliance/records/', {
    method: 'POST',
    json: data,
  });
}

// ── Payroll Management (Phase 26) ─────────────────────────────────────────────

export async function apiGetPayPeriods() {
  return await apiRequest('/workforce/payroll/periods/');
}

export async function apiCreatePayPeriod(data) {
  return await apiRequest('/workforce/payroll/periods/', {
    method: 'POST',
    json: data,
  });
}

export async function apiProcessPayroll(periodId, action = 'process', targetStatus = '') {
  return await apiRequest(`/workforce/payroll/periods/${periodId}/process/`, {
    method: 'POST',
    json: { action, status: targetStatus },
  });
}

export async function apiGetMyPayslips() {
  return await apiRequest('/workforce/payroll/me/');
}

// ── Reports Suite (Phase 27) ──────────────────────────────────────────────────

export async function apiGetReport(reportType = 'employee', filters = {}) {
  const params = new URLSearchParams({ type: reportType, ...filters });
  return await apiRequest(`/workforce/reports/?${params.toString()}`);
}

// ── Leave Management (Phase 19) ────────────────────────────────────────────────

export async function apiGetLeaves() {
  return await apiRequest('/workforce/leaves/');
}

export async function apiApplyLeave(data) {
  return await apiRequest('/workforce/leaves/', {
    method: 'POST',
    json: data,
  });
}

export async function apiCancelLeave(leaveId) {
  return await apiRequest(`/workforce/leaves/${leaveId}/cancel/`, {
    method: 'POST',
  });
}

export async function apiAdminDecideLeave(empId, leaveId, action, reason = '') {
  return await apiRequest(`/workforce/admin/leaves/${empId}/${leaveId}/decide/`, {
    method: 'POST',
    json: { action, reason },
  });
}

// ── Time Tracking & Shifts ────────────────────────────────────────────────────

export async function apiGetTimeTracking() {
  return await apiRequest('/workforce/time-tracking/');
}

export async function apiTimeTrackingAction(action, payload = {}) {
  const endpointMap = {
    'clock_in': '/workforce/time-tracking/clock-in/',
    'clock_out': '/workforce/time-tracking/clock-out/',
    'break_start': '/workforce/time-tracking/break/start/',
    'break_end': '/workforce/time-tracking/break/end/',
  };
  const path = endpointMap[action] || `/workforce/time-tracking/${action}/`;
  return await apiRequest(path, {
    method: 'POST',
    json: payload,
  });
}

export async function apiGetDocumentMasterList() {
  return await apiRequest('/workforce/onboarding/documents/master/');
}

// ── Complete Employee Platform Integration APIs ──────────────────────────────

// Profile & Change Requests
export async function apiGetMyProfile() {
  return await apiRequest('/workforce/profile/me/');
}

export async function apiUpdateMyProfile(payload) {
  return await apiRequest('/workforce/profile/me/', {
    method: 'PATCH',
    json: payload,
  });
}

export async function apiUploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  return await apiRequest('/workforce/profile/avatar/', {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
}

export async function apiGetChangeRequests() {
  return await apiRequest('/workforce/profile/change-requests/');
}

export async function apiSubmitChangeRequest(payload) {
  return await apiRequest('/workforce/profile/change-requests/', {
    method: 'POST',
    json: payload,
  });
}

export async function apiGetAdminChangeRequests(statusFilter = '') {
  const query = statusFilter ? `?status=${statusFilter}` : '';
  return await apiRequest(`/workforce/admin/change-requests/${query}`);
}

export async function apiAdminDecideChangeRequest(reqId, action, adminNotes = '') {
  return await apiRequest(`/workforce/admin/change-requests/${reqId}/decide/`, {
    method: 'POST',
    json: { action, admin_notes: adminNotes },
  });
}

// Account & Security
export async function apiChangePassword(currentPassword, newPassword, confirmPassword) {
  return await apiRequest('/workforce/security/change-password/', {
    method: 'POST',
    json: {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
  });
}

export async function apiChangeEmail(currentPassword, newEmail) {
  return await apiRequest('/workforce/security/change-email/', {
    method: 'POST',
    json: {
      current_password: currentPassword,
      new_email: newEmail,
    },
  });
}

export async function apiGet2FAStatus() {
  return await apiRequest('/workforce/security/2fa/');
}

export async function apiToggle2FA() {
  return await apiRequest('/workforce/security/2fa/toggle/', {
    method: 'POST',
  });
}

export async function apiGetActiveSessions() {
  return await apiRequest('/workforce/security/sessions/');
}

export async function apiGetLoginHistory() {
  return await apiRequest('/workforce/security/login-history/');
}

// Appearance & User Preferences
export async function apiGetPreferences() {
  return await apiRequest('/workforce/preferences/');
}

export async function apiSavePreferences(payload) {
  return await apiRequest('/workforce/preferences/', {
    method: 'PATCH',
    json: payload,
  });
}

// Notification Preferences
export async function apiGetNotificationPreferences() {
  return await apiRequest('/workforce/notifications/preferences/');
}

export async function apiSaveNotificationPreferences(payload) {
  return await apiRequest('/workforce/notifications/preferences/', {
    method: 'PATCH',
    json: payload,
  });
}

// Privacy & Data
export async function apiExportMyData() {
  return await apiRequest('/workforce/privacy/export/');
}

export async function apiDeactivateAccount(password, reason = '') {
  return await apiRequest('/workforce/privacy/deactivate/', {
    method: 'POST',
    json: { password, reason },
  });
}

// My Feedback & Performance
export async function apiGetMyPerformance() {
  return await apiRequest('/workforce/performance/me/');
}

// Employee Services Self-Service
export async function apiGetMyServices() {
  return await apiRequest('/workforce/services/my-services/');
}

// ── Aliases & Technicians List Helper ─────────────────────────────────────────

export async function apiGetEmployees() {
  return await apiGetAdminApplications('approved');
}

export const apiGetSchedule = apiGetSchedules;
export const apiSetSchedule = apiSaveSchedules;
export const apiLogin = apiWorkforceLogin;
export const apiRegister = apiWorkforceSignup;
export const apiGetMe = apiFetchMe;
export const apiLogout = apiWorkforceLogout;
export const apiGetApplicationDetail = apiGetAdminApplicationDetail;
export const apiUploadOnboardingDoc = apiUploadDocument;

// ── Employee Saved Locations ───────────────────────────────────────────────────

export async function apiGetSavedLocations() {
  return await apiRequest('/workforce/locations/saved/');
}

export async function apiCreateSavedLocation(payload) {
  return await apiRequest('/workforce/locations/saved/', {
    method: 'POST',
    json: payload,
  });
}

export async function apiUpdateSavedLocation(id, payload) {
  return await apiRequest(`/workforce/locations/saved/${id}/`, {
    method: 'PUT',
    json: payload,
  });
}

export async function apiPatchSavedLocation(id, payload) {
  return await apiRequest(`/workforce/locations/saved/${id}/`, {
    method: 'PATCH',
    json: payload,
  });
}

export async function apiDeleteSavedLocation(id) {
  return await apiRequest(`/workforce/locations/saved/${id}/`, {
    method: 'DELETE',
  });
}

// ── Live GPS Location Update (enhanced with accuracy) ─────────────────────────

export async function apiUpdateLocationFull(latitude, longitude, accuracy = null, speed = null, heading = null, captured_at = null) {
  const payload = {
    latitude,
    longitude,
    captured_at: captured_at || new Date().toISOString(),
  };
  if (accuracy != null) payload.accuracy = accuracy;
  if (speed != null) payload.speed = speed;
  if (heading != null) payload.heading = heading;
  return await apiRequest('/workforce/presence/location/', {
    method: 'POST',
    json: payload,
  });
}

// ── Admin: Authorized Location Management Extensions ──────────────────────────

export async function apiToggleLocationActive(id, isActive) {
  return await apiRequest(`/workforce/admin/locations/${id}/toggle/`, {
    method: 'PATCH',
    json: { is_active: isActive },
  });
}

export async function apiAssignEmployeeToLocation(locationId, employeeId, isPrimary = false) {
  return await apiRequest(`/workforce/admin/locations/${locationId}/assign/`, {
    method: 'POST',
    json: { employee_id: employeeId, is_primary: isPrimary },
  });
}

export async function apiRemoveEmployeeFromLocation(locationId, employeeId) {
  return await apiRequest(`/workforce/admin/locations/${locationId}/assign/`, {
    method: 'DELETE',
    json: { employee_id: employeeId },
  });
}

// ── Job Lifecycle Timeline Observability (Phase 2) ───────────────────────────

export async function apiGetJobTimeline(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/timeline/`);
}

// ── Live Road Tracking & Telemetry (CalTrack Live Tracking) ───────────────────

export async function apiGetJobLiveTracking(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/live-tracking/`);
}

export async function apiGetCustomerJobTracking(jobId) {
  return await apiRequest(`/workforce/customer/jobs/${jobId}/tracking/`);
}




