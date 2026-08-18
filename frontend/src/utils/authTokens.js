/**
 * authTokens.js
 * Single authoritative source of truth for Workforce JWT access and refresh tokens.
 * Storage strategy: sessionStorage (primary tab-scoped isolation) with localStorage fallback.
 */

const ACCESS_TOKEN_KEY = 'wf_token';
const REFRESH_TOKEN_KEY = 'wf_refresh_token';
const TAB_ID_KEY = 'wf_tab_id';

/**
 * Retrieves the active access token.
 * Returns null if unauthenticated or not running in a browser environment.
 */
export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || null;
}

/**
 * Retrieves the active refresh token.
 */
export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY) || null;
}

/**
 * Atomically stores both access and refresh tokens across session and local stores.
 */
export function setAuthTokens(accessToken, refreshToken) {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (!sessionStorage.getItem(TAB_ID_KEY)) {
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
}

/**
 * Clears all stored auth credentials and tab identifiers.
 */
export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TAB_ID_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Checks if a non-empty access token is currently present.
 */
export function hasAuthToken() {
  return Boolean(getAccessToken());
}
