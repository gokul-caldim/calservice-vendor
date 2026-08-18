/**
 * workforce-app/frontend/src/api/client.js
 * Universal fetch client handling Bearer tokens, CSRF tokens, silent refresh deduplication, and JSON errors.
 */

import {
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
} from '../utils/authTokens.js';
import { classifyApiError } from '../utils/apiErrors.js';

let inFlightRefreshPromise = null;

function getCookie(name) {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.substring(0, name.length + 1) === name + '=') {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

/**
 * Performs a silent token refresh using the existing /api/auth/refresh/ endpoint.
 * Deduplicates multiple concurrent refresh requests.
 */
export async function apiRefreshToken() {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return null;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.access_token || data.token;
        if (newToken) {
          setAuthTokens(newToken, refreshToken);
          return newToken;
        }
      }

      // Refresh failed (invalid/expired refresh token)
      clearAuthTokens();
      return null;
    } catch (_) {
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!options.isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const csrfToken = getCookie('csrftoken');
  if (csrfToken && !headers.has('X-CSRFToken')) {
    headers.set('X-CSRFToken', csrfToken);
  }

  // Attach tab-scoped or stored Bearer token
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const config = {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    ...options,
  };

  if (options.json) {
    config.body = JSON.stringify(options.json);
  }

  const url = path.startsWith('http') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    const error = new Error('Network error. Please check your connection.');
    error.status = 0;
    error.code = 'NETWORK_ERROR';
    error.originalError = netErr;
    throw error;
  }

  // Auto-refresh token on 401 for authenticated endpoints (excluding login/refresh)
  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (!options._isRetry) {
      const newToken = await apiRefreshToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryConfig = { ...config, headers, _isRetry: true };
        try {
          response = await fetch(url, retryConfig);
        } catch (retryNetErr) {
          const error = new Error('Network error during retry.');
          error.status = 0;
          error.code = 'NETWORK_ERROR';
          error.originalError = retryNetErr;
          throw error;
        }
      }
    }

    if (response.status === 401) {
      clearAuthTokens();
    }
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg =
      (data && data.error) ||
      (data && data.detail) ||
      (data && typeof data === 'object' ? JSON.stringify(data) : 'Request failed');

    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = (data && data.code) || classifyApiError(response.status, data);
    error.data = data;
    throw error;
  }

  return data;
}
