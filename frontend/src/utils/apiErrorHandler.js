/**
 * apiErrorHandler.js
 *
 * Centralized API Error Classification & Ergonomics Utility for Workforce.
 * Classifies HTTP status codes, network errors, and domain conflicts into a consistent schema:
 * {
 *   category: string,
 *   code: string,
 *   title: string,
 *   message: string,
 *   action: string,
 *   isOfferLost: boolean,
 *   canRetry: boolean,
 *   redirectToLogin?: boolean
 * }
 */

export const ErrorCategory = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Classifies an error into a structured, user-friendly payload.
 *
 * @param {Error|Object} err - Caught error object from apiRequest or fetch
 * @returns {Object} Structured error payload
 */
export function classifyApiError(err) {
  if (!err) {
    return {
      category: ErrorCategory.UNKNOWN,
      status: 0,
      code: 'UNKNOWN_ERROR',
      title: 'Unexpected Error',
      message: 'An unexpected issue occurred. Please try again.',
      action: 'Retry',
      isOfferLost: false,
      canRetry: true,
    };
  }

  const status = err.status || (err.response && err.response.status) || 0;
  const rawCode = err.code || (err.data && err.data.code) || '';
  const rawMsg = err.message || (err.data && err.data.error) || (err.data && err.data.message) || '';

  // Network / Disconnection error
  if (
    err.name === 'TypeError' ||
    rawMsg.toLowerCase().includes('failed to fetch') ||
    rawMsg.toLowerCase().includes('network') ||
    status === 0
  ) {
    return {
      category: ErrorCategory.NETWORK_ERROR,
      status: 0,
      code: 'NETWORK_DISCONNECTED',
      title: 'Connection Lost',
      message: 'Unable to reach the server. Please check your internet connection.',
      action: 'Retry Connection',
      isOfferLost: false,
      canRetry: true,
    };
  }

  // 401: Unauthorized / Session Expired
  if (status === 401) {
    return {
      category: ErrorCategory.AUTHENTICATION,
      status: 401,
      code: rawCode || 'SESSION_EXPIRED',
      title: 'Session Expired',
      message: 'Your login session has expired. Please log in again to continue.',
      action: 'Log In Again',
      redirectToLogin: true,
      isOfferLost: false,
      canRetry: false,
    };
  }

  // 403: Forbidden / Access Denied
  if (status === 403) {
    let title = 'Access Restricted';
    let msg = 'You do not have permission to access this resource or perform this action.';
    let action = 'Go Back';

    if (rawCode === 'PRE_SERVICE_ACCESS_DENIED' || rawMsg.toLowerCase().includes('pre-service')) {
      title = 'Pre-Service Access Denied';
      msg = 'Pre-service verification is only accessible by the currently assigned professional.';
    } else if (rawCode === 'CROSS_TENANT_FORBIDDEN' || rawMsg.toLowerCase().includes('cross-tenant') || rawMsg.toLowerCase().includes('company')) {
      title = 'Security Isolation';
      msg = 'Access to cross-company records is strictly prohibited.';
    } else if (rawMsg) {
      msg = rawMsg;
    }

    return {
      category: ErrorCategory.AUTHORIZATION,
      status: 403,
      code: rawCode || 'ACCESS_DENIED',
      title,
      message: msg,
      action,
      isOfferLost: false,
      canRetry: false,
    };
  }

  // 404: Not Found
  if (status === 404) {
    return {
      category: ErrorCategory.NOT_FOUND,
      status: 404,
      code: rawCode || 'NOT_FOUND',
      title: 'Item Not Found',
      message: rawMsg || 'The requested job or record could not be found or may have been removed.',
      action: 'Refresh Job Status',
      isOfferLost: false,
      canRetry: true,
    };
  }

  // 409: Conflict (Concurrent acceptance, busy state, window expired)
  if (status === 409) {
    let title = 'Job Conflict';
    let msg = rawMsg || 'The job status has changed.';
    let action = 'Refresh Job Status';
    let isOfferLost = false;

    if (
      rawCode === 'JOB_ALREADY_ACCEPTED' ||
      rawCode === 'ALREADY_ACCEPTED_BY_ANOTHER' ||
      rawMsg.toLowerCase().includes('already been accepted')
    ) {
      title = 'Job No Longer Available';
      msg = 'Another professional accepted this request.';
      action = 'Refresh Job Status';
      isOfferLost = true;
    } else if (
      rawCode === 'OFFER_EXPIRED' ||
      rawMsg.toLowerCase().includes('offer has expired') ||
      rawMsg.toLowerCase().includes('offer expired')
    ) {
      title = 'Offer Expired';
      msg = 'This offer has expired.';
      action = 'Refresh Job Status';
      isOfferLost = true;
    } else if (
      rawCode === 'EMPLOYEE_ALREADY_BUSY' ||
      rawMsg.toLowerCase().includes('already has an active job') ||
      rawMsg.toLowerCase().includes('you already have an active job') ||
      rawMsg.toLowerCase().includes('busy')
    ) {
      title = 'Active Job In Progress';
      msg = 'You already have an active job. Complete it before accepting another job.';
      action = 'View Current Job';
    } else if (
      rawCode === 'CANCELLATION_LOCKED_AFTER_OTP' ||
      rawMsg.toLowerCase().includes('otp')
    ) {
      title = 'Cancellation Locked';
      msg = 'Cancellation is not permitted once customer Work Start OTP is verified.';
      action = 'Dismiss';
    } else if (
      rawCode === 'CANCELLATION_NOT_ALLOWED_IN_CURRENT_STATE' ||
      rawMsg.toLowerCase().includes('cannot cancel')
    ) {
      title = 'Cancellation Not Allowed';
      msg = 'Jobs cannot be cancelled once arrived on-site or service has started.';
      action = 'Dismiss';
    }

    return {
      category: ErrorCategory.CONFLICT,
      status: 409,
      code: rawCode || 'STATE_CONFLICT',
      title,
      message: msg,
      action,
      isOfferLost,
      canRetry: false,
    };
  }

  // 422 / 400: Validation Error
  if (status === 400 || status === 422) {
    return {
      category: ErrorCategory.VALIDATION,
      status,
      code: rawCode || 'INVALID_INPUT',
      title: 'Validation Error',
      message: rawMsg || 'Please verify the submitted details and try again.',
      action: 'Correct Input',
      isOfferLost: false,
      canRetry: true,
    };
  }

  // 429: Rate Limit
  if (status === 429) {
    return {
      category: ErrorCategory.RATE_LIMIT,
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      title: 'Too Many Requests',
      message: 'You have made too many requests in a short period. Please wait a moment before trying again.',
      action: 'Wait & Retry',
      isOfferLost: false,
      canRetry: true,
    };
  }

  // 500 / 502 / 503 / 504: Server Errors
  if (status >= 500) {
    // Log unexpected server error for internal observability without leaking raw SQL/Python traces to user
    console.error(`[WORKFORCE_API_ERROR_500] Status: ${status} | Code: ${rawCode} | Details:`, err);
    return {
      category: ErrorCategory.SERVER_ERROR,
      status,
      code: rawCode || 'SERVER_ERROR',
      title: 'Server Issue',
      message: 'The server encountered an unexpected condition. Our team has been notified.',
      action: 'Retry Action',
      isOfferLost: false,
      canRetry: true,
    };
  }

  return {
    category: ErrorCategory.UNKNOWN,
    status,
    code: rawCode || 'UNKNOWN_ERROR',
    title: 'Notice',
    message: rawMsg || 'An error occurred while processing your request.',
    action: 'Dismiss',
    isOfferLost: false,
    canRetry: true,
  };
}
