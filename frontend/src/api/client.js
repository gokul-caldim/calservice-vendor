/**
 * workforce-app/frontend/src/api/client.js
 * Universal fetch client sending httpOnly cookies and handling JSON errors.
 */

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  
  if (!options.isFormData) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const csrfToken = getCookie('csrftoken');
  if (csrfToken && !headers.has('X-CSRFToken')) {
    headers.set('X-CSRFToken', csrfToken);
  }

  // Attach tab-scoped or stored Bearer token
  const token = sessionStorage.getItem('wf_token') || localStorage.getItem('wf_token');
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

  let response = await fetch(url, config);

  // Auto-refresh token on 401
  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (!options._isRetry) {
      const refreshToken = sessionStorage.getItem('wf_refresh_token') || localStorage.getItem('wf_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.access_token || refreshData.token;
            if (newToken) {
              sessionStorage.setItem('wf_token', newToken);
              localStorage.setItem('wf_token', newToken);
              headers.set('Authorization', `Bearer ${newToken}`);
              const retryConfig = { ...config, headers, _isRetry: true };
              response = await fetch(url, retryConfig);
            }
          }
        } catch (_) {}
      }
    }

    // If still 401 after retry or refresh failure, clear stale tab credentials
    if (response.status === 401) {
      sessionStorage.removeItem('wf_token');
      sessionStorage.removeItem('wf_refresh_token');
      localStorage.removeItem('wf_token');
      localStorage.removeItem('wf_refresh_token');
    }
  }



  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(
      (data && data.error) ||
      (data && data.detail) ||
      (data && typeof data === 'object' ? JSON.stringify(data) : 'Request failed')
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
