/**
 * apiErrors.js
 * Centralized API error classification and human-readable formatting.
 */

export const ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BUSINESS_CONFLICT: 'BUSINESS_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export const CONFLICT_CODES = {
  JOB_ALREADY_ACCEPTED: 'JOB_ALREADY_ACCEPTED',
  EMPLOYEE_ALREADY_BUSY: 'EMPLOYEE_ALREADY_BUSY',
  CANCELLATION_WINDOW_EXPIRED: 'CANCELLATION_WINDOW_EXPIRED',
  CANCELLATION_NOT_ALLOWED_IN_CURRENT_STATE: 'CANCELLATION_NOT_ALLOWED_IN_CURRENT_STATE',
  STALE_LOCATION: 'STALE_LOCATION',
  INVALID_STATE: 'INVALID_STATE',
};

/**
 * Classifies an HTTP error status code or network exception into a standardized category.
 */
export function classifyApiError(status, errorData = null) {
  if (!status || status === 0) return ERROR_CODES.NETWORK_ERROR;
  if (status === 401) return ERROR_CODES.AUTHENTICATION_REQUIRED;
  if (status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 409) return ERROR_CODES.BUSINESS_CONFLICT;
  if (status === 422 || status === 400) return ERROR_CODES.VALIDATION_ERROR;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status >= 500) return ERROR_CODES.SERVER_ERROR;
  return ERROR_CODES.UNKNOWN_ERROR;
}

/**
 * Returns a clean, user-facing error message without exposing backend stack traces.
 */
export function getFriendlyErrorMessage(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';

  if (typeof error === 'string') {
    return error;
  }

  const status = error.status || (error.response && error.response.status);
  const data = error.data || (error.response && error.response.data);

  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    if (data?.code === 'ACCOUNT_INACTIVE') return 'Your account is inactive. Please contact support.';
    if (data?.code === 'ONBOARDING_INCOMPLETE') return 'Please complete your onboarding profile first.';
    return data?.error || data?.detail || 'You do not have permission to perform this action.';
  }

  if (status === 409) {
    const code = data?.code;
    if (code === CONFLICT_CODES.JOB_ALREADY_ACCEPTED) {
      return 'This job has already been accepted by another technician.';
    }
    if (code === CONFLICT_CODES.EMPLOYEE_ALREADY_BUSY) {
      return 'You currently have an active job in progress.';
    }
    if (code === CONFLICT_CODES.CANCELLATION_WINDOW_EXPIRED) {
      return 'The cancellation window for this job has expired.';
    }
    if (code === CONFLICT_CODES.CANCELLATION_NOT_ALLOWED_IN_CURRENT_STATE) {
      return 'Cancellation is not permitted in the current job state.';
    }
    return data?.error || data?.detail || 'A business conflict occurred. Please refresh the page.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  if (status >= 500) {
    return 'The server encountered an issue. Please try again in a few moments.';
  }

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
  }

  if (error.message && !error.message.includes('fetch') && !error.message.includes('JSON')) {
    return error.message;
  }

  return 'Network request failed. Please check your internet connection.';
}
