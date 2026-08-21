/**
 * frontend/src/api/walletService.js
 * API client for the Employee Wallet module.
 * Uses the same `apiRequest` helper as workforceService.js.
 */
import { apiRequest } from './client.js';

// ── Employee Self-Service Wallet API ──────────────────────────────────────────

export async function apiGetWalletSummary() {
  return await apiRequest('/workforce/wallet/');
}

export async function apiGetWalletTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return await apiRequest(`/workforce/wallet/transactions/${query ? '?' + query : ''}`);
}

export async function apiGetWalletTransactionDetail(id) {
  return await apiRequest(`/workforce/wallet/transactions/${id}/`);
}

// Withdrawals (Employee self-service)
export async function apiGetWalletWithdrawals(params = {}) {
  const query = new URLSearchParams(params).toString();
  return await apiRequest(`/workforce/wallet/withdrawals/${query ? '?' + query : ''}`);
}

export async function apiRequestWithdrawal(data) {
  return await apiRequest('/workforce/wallet/withdrawals/', { method: 'POST', json: data });
}

export async function apiCancelWithdrawal(id) {
  return await apiRequest(`/workforce/wallet/withdrawals/${id}/cancel/`, { method: 'POST' });
}

// Payout Accounts (Employee Bank Accounts)
export async function apiGetPayoutAccounts() {
  return await apiRequest('/workforce/wallet/payout-accounts/');
}

export async function apiCreatePayoutAccount(data) {
  return await apiRequest('/workforce/wallet/payout-accounts/', { method: 'POST', json: data });
}

export async function apiDeletePayoutAccount(id) {
  return await apiRequest(`/workforce/wallet/payout-accounts/${id}/`, { method: 'DELETE' });
}

// ── Platform Admin Wallet API ─────────────────────────────────────────────────

export async function apiAdminGetAllWallets() {
  return await apiRequest('/workforce/admin/wallet/employees/');
}

export async function apiAdminGetEmployeeWalletSummary(employeeId) {
  return await apiRequest(`/workforce/admin/wallet/employees/${employeeId}/`);
}

export async function apiAdminGetEmployeeTransactions(employeeId, params = {}) {
  const query = new URLSearchParams(params).toString();
  return await apiRequest(`/workforce/admin/wallet/employees/${employeeId}/transactions/${query ? '?' + query : ''}`);
}

export async function apiAdminGetAllWithdrawals(params = {}) {
  const query = new URLSearchParams(params).toString();
  return await apiRequest(`/workforce/admin/wallet/withdrawals/${query ? '?' + query : ''}`);
}

export async function apiAdminProcessWithdrawal(id) {
  return await apiRequest(`/workforce/admin/wallet/withdrawals/${id}/process/`, { method: 'POST' });
}

export async function apiAdminCompleteWithdrawal(id, data) {
  return await apiRequest(`/workforce/admin/wallet/withdrawals/${id}/complete/`, { method: 'POST', json: data });
}

export async function apiAdminFailWithdrawal(id, failure_reason) {
  return await apiRequest(`/workforce/admin/wallet/withdrawals/${id}/fail/`, { method: 'POST', json: { failure_reason } });
}

export async function apiAdminVerifyPayoutAccount(id, verification_status) {
  return await apiRequest(`/workforce/admin/wallet/payout-accounts/${id}/verify/`, { method: 'POST', json: { verification_status } });
}

export async function apiAdminPostAdjustment(employeeId, data) {
  return await apiRequest(`/workforce/admin/wallet/employees/${employeeId}/adjustment/`, { method: 'POST', json: data });
}

export async function apiAdminFreezeWallet(employeeId, status, reason) {
  return await apiRequest(`/workforce/admin/wallet/employees/${employeeId}/freeze/`, { method: 'POST', json: { status, reason } });
}

export async function apiAdminGetCommissionConfigs(employeeId) {
  return await apiRequest(`/workforce/admin/commission/employees/${employeeId}/`);
}

export async function apiAdminCreateCommissionConfig(employeeId, data) {
  return await apiRequest(`/workforce/admin/commission/employees/${employeeId}/`, { method: 'POST', json: data });
}
