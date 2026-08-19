import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext.jsx';
import {
  apiFetchMe,
  apiWorkforceLogin,
  apiWorkforceSignup,
  apiWorkforceLogout,
  apiGetOnboardingProfile,
  apiTogglePresence,
} from '../api/workforceService.js';
import {
  getAccessToken,
  setAuthTokens,
  clearAuthTokens,
} from '../utils/authTokens.js';

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const inFlightRefreshRef = React.useRef(null);

  const refreshProfile = useCallback(async (force = false) => {
    if (inFlightRefreshRef.current && !force) {
      return inFlightRefreshRef.current;
    }

    inFlightRefreshRef.current = (async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setUser(null);
          setEmployee(null);
          return null;
        }

        const me = await apiFetchMe();

        if (me && me.username) {
          const isAdmin = ['admin', 'manager'].includes((me.role || '').toLowerCase()) || Boolean(me.is_superuser);
          let empData = null;

          if (!isAdmin) {
            try {
              empData = await apiGetOnboardingProfile();
            } catch (_) {
              // Non-admin user without onboarding record
            }
          }

          const isEmployee = Boolean(empData) || (me.role || '').toLowerCase() === 'employee';
          const computedRole = isAdmin ? (me.role || 'admin').toLowerCase() : (isEmployee ? 'employee' : (me.role || 'employee').toLowerCase());

          const u = {
            id: me.id,
            username: me.username,
            email: me.email || '',
            firstName: me.first_name || '',
            lastName: me.last_name || '',
            role: computedRole,
            companyId: me.company,
            companyName: me.company_name || '',
            isAdmin: isAdmin,
            isEmployee: isEmployee,
            registrationStatus: empData ? (empData.registration_status || 'not_started') : (isAdmin ? 'approved' : 'not_started'),
            isOnline: empData ? Boolean(empData.is_online) : false,
            availability: empData ? (empData.live_availability || 'offline') : 'offline',
          };

          setUser(u);
          setEmployee(empData);
          return u;
        } else {
          clearAuthTokens();
          setUser(null);
          setEmployee(null);
          return null;
        }
      } catch (e) {
        // Only wipe auth tokens if server explicitly rejected with 401
        if (e && e.status === 401) {
          clearAuthTokens();
          setUser(null);
          setEmployee(null);
        }
        return null;
      } finally {
        inFlightRefreshRef.current = null;
      }
    })();

    return inFlightRefreshRef.current;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await apiWorkforceLogin(identifier, password);
    if (!res) {
      throw new Error('Authentication failed. Please try again.');
    }

    const token = res.access_token || res.token;
    const refresh = res.refresh_token;
    if (token) {
      setAuthTokens(token, refresh);
    }

    if (res.user) {
      const isAdmin = ['admin', 'manager'].includes((res.user.role || '').toLowerCase()) || Boolean(res.user.is_superuser);
      const initialUser = {
        id: res.user.id,
        username: res.user.username,
        email: res.user.email || '',
        firstName: res.user.first_name || '',
        lastName: res.user.last_name || '',
        role: res.user.role || 'employee',
        companyId: res.user.company,
        companyName: res.user.company_name || '',
        isAdmin: isAdmin,
        isEmployee: !isAdmin,
        registrationStatus: isAdmin ? 'approved' : 'not_started',
        isOnline: false,
        availability: 'offline',
      };
      setUser(initialUser);

      // Trigger background profile refresh for non-blocking extended details
      refreshProfile(true).catch(() => {});
      return initialUser;
    }

    return await refreshProfile(true);
  }, [refreshProfile]);

  const signup = useCallback(async (payload) => {
    const res = await apiWorkforceSignup(payload);
    if (res) {
      const token = res.access_token || res.token;
      const refresh = res.refresh_token;
      setAuthTokens(token, refresh);
    }
    await refreshProfile(true);
    return res;
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    clearAuthTokens();
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('wf_tab_channel');
        channel.postMessage({ type: 'LOGOUT_SYNC' });
        channel.close();
      } catch (_) {}
    }
    try {
      await apiWorkforceLogout();
    } catch (_) {}
    setUser(null);
    setEmployee(null);
  }, []);

  const togglePresence = useCallback(async (desiredOnlineState = null) => {
    try {
      const res = await apiTogglePresence(desiredOnlineState);
      if (user) {
        setUser(prev => ({
          ...prev,
          isOnline: res.is_online,
          availability: res.availability,
        }));
      }
      if (employee) {
        setEmployee(prev => ({
          ...prev,
          is_online: res.is_online,
          live_availability: res.availability,
        }));
      }
      return res;
    } catch (e) {
      throw e;
    }
  }, [user, employee]);

  // Cross-tab Session Sync using BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('wf_tab_channel');

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'LOGOUT_SYNC') {
        clearAuthTokens();
        setUser(null);
        setEmployee(null);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Handle unauthenticated event triggered from client.js on 401
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setEmployee(null);
    };
    window.addEventListener('workforce:auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('workforce:auth-unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 4000);
    refreshProfile()
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        setIsReady(true);
      });
  }, [refreshProfile]);

  const value = useMemo(() => ({
    isReady,
    user,
    employee,
    login,
    signup,
    logout,
    refreshProfile,
    togglePresence,
    isAuthenticated: Boolean(user),
    isAdmin: user?.isAdmin || false,
    isEmployee: user?.isEmployee || false,
    registrationStatus: user?.registrationStatus || 'not_started',
  }), [isReady, user, employee, login, signup, logout, refreshProfile, togglePresence]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
