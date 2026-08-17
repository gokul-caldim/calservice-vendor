import React, { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import {
  Wrench,
  Search,
  HelpCircle,
  Bell,
  User,
  Power,
  LogOut,
  Menu,
  ChevronDown,
  ExternalLink,
  Shield,
  Settings,
  Crosshair,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';

import { Modal } from '../enterprise/Modal.jsx';
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiUpdateLocationFull,
} from '../../api/workforceService.js';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';

export function TopHeader({ onToggleSidebar = () => {} }) {
  const { user, logout, togglePresence, isAdmin, isEmployee, registrationStatus } = useAuth();
  const navigate = useNavigate();
  const [isToggling, setIsToggling] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');

  // Location Scan State
  const [locState, setLocState] = useState('idle'); // 'idle' | 'locating' | 'success' | 'error'
  const [locCoords, setLocCoords] = useState(() => {
    const loc = user?.last_known_location;
    if (loc?.latitude && loc?.longitude) {
      return { latitude: Number(loc.latitude), longitude: Number(loc.longitude), accuracy: loc.accuracy || null };
    }
    return null;
  });

  const handleScanCurrentLocation = async () => {
    if (locState === 'locating') return;
    setLocState('locating');
    try {
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      const captured_at = new Date(pos.timestamp || Date.now()).toISOString();
      await apiUpdateLocationFull(latitude, longitude, accuracy, speed, heading, captured_at);
      setLocCoords({
        latitude,
        longitude,
        accuracy,
        timestamp: pos.timestamp || Date.now(),
      });
      setLocState('success');
      window.dispatchEvent(
        new CustomEvent('workforce:location-updated', {
          detail: {
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            captured_at,
            timestamp: pos.timestamp || Date.now(),
            source: 'header_scan',
          },
        })
      );
      setTimeout(() => setLocState('idle'), 2500);
    } catch (_) {
      setLocState('error');
      setTimeout(() => setLocState('idle'), 3000);
    }
  };

  // 10s silent background notification polling
  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('wf_token') || localStorage.getItem('wf_token'))
      : null;
    if (!user || !token) return;
    let isCancelled = false;
    let pollInterval = null;

    const fetchNotifs = async () => {
      try {
        const res = await apiGetNotifications();
        if (!isCancelled && res) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unread_count || 0);
        }
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    };
    fetchNotifs();
    pollInterval = setInterval(fetchNotifs, 10000);
    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await apiMarkNotificationRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  const handleNotifClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await apiMarkNotificationRead(notif.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      }
      setShowNotifMenu(false);
      if (notif.notification_type === 'JOB_OFFER' || notif.notification_type === 'JOB_OFFERED') {
        navigate('/workforce/employee/dashboard');
      }
    } catch (_) {}
  };

  const handleLogout = async () => {

    await logout();
    navigate('/workforce/login');
  };

  const handlePresenceToggle = async () => {
    if (registrationStatus !== 'approved') return;
    try {
      setIsToggling(true);
      await togglePresence();
    } catch (err) {
      alert(err.message || 'Failed to toggle availability status');
    } finally {
      setIsToggling(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    if (isAdmin) {
      navigate(`/workforce/admin/applications?q=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  const isOnline = Boolean(user?.isOnline);

  return (
    <>
      <header className="bg-slate-900 text-slate-100 border-b border-slate-800 shrink-0 z-40 h-12 flex items-center px-3 sm:px-4">
        <div className="w-full flex items-center justify-between gap-3">
          {/* Left: Mobile Menu Toggle & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Toggle Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-white font-sans">
                  {user?.companyName || 'Workforce'}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Workforce
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Global Search Input */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <form onSubmit={handleSearchSubmit} className="w-full relative">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search employees, jobs, applications..."
                className="w-full pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400 pointer-events-none" />
            </form>
          </div>

          {/* Right: Actions, Help, Presence & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <>
                {/* Technician Online / Offline Toggle & Current Location Scan */}
                {isEmployee && registrationStatus === 'approved' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePresenceToggle}
                      disabled={isToggling}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                        isOnline
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                      title={isOnline ? 'You are ONLINE. Click to go OFFLINE' : 'You are OFFLINE. Click to go ONLINE'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
                      />
                      <span className="text-[11px] uppercase font-bold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                      <Power className="w-3 h-3 ml-0.5 opacity-70" />
                    </button>

                    {/* Compact Real-Time Current Location Scan Button */}
                    <button
                      type="button"
                      onClick={handleScanCurrentLocation}
                      disabled={locState === 'locating'}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                        locState === 'locating'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 cursor-wait'
                          : locState === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : locState === 'error'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={
                        locCoords
                          ? `Location: ${locCoords.latitude.toFixed(4)}, ${locCoords.longitude.toFixed(4)} (±${Math.round(locCoords.accuracy || 0)}m). Click to refresh.`
                          : 'Click to scan and update your current GPS location'
                      }
                    >
                      {locState === 'locating' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span className="text-[11px] font-bold">Locating...</span>
                        </>
                      ) : locState === 'success' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px] font-bold">Location Updated</span>
                        </>
                      ) : locState === 'error' ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[11px] font-bold">Location Unavailable</span>
                        </>
                      ) : (
                        <>
                          <Crosshair className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold">
                            {locCoords
                              ? `${locCoords.latitude.toFixed(3)}, ${locCoords.longitude.toFixed(3)}`
                              : 'Current Location'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Help button */}
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Help & Reference"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>

                {/* Notifications Bell & Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifMenu(!showNotifMenu);
                      setShowUserMenu(false);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div className="absolute right-0 mt-1.5 w-80 bg-white text-slate-900 rounded-lg border border-slate-200 shadow-xl py-1 z-50 text-xs">
                      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Bell className="w-3.5 h-3.5 text-blue-600" />
                          <span>Notifications</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isJobOffer = n.notification_type === 'JOB_OFFER' || n.notification_type === 'JOB_OFFERED';
                            return (
                              <div
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                                  !n.is_read ? (isJobOffer ? 'bg-amber-50/60 border-l-2 border-amber-500' : 'bg-blue-50/40 border-l-2 border-blue-500') : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className={`font-semibold ${isJobOffer ? 'text-amber-900' : 'text-slate-900'}`}>
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-2">
                                  {n.message}
                                </p>
                                {isJobOffer && (
                                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-700">
                                    <span>👉 Tap to view offer in dashboard</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>


                {/* User Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-slate-300 hover:text-white"
                  >
                    <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                      {user.firstName ? user.firstName[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                    </div>
                    <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
                      {user.firstName ? `${user.firstName} ${user.lastName}` : user.username}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-white text-slate-900 rounded border border-slate-200 shadow-lg py-1 z-50 text-xs">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900 truncate">
                          {user.firstName ? `${user.firstName} ${user.lastName}` : user.username}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                          Role: {user.role}
                        </p>
                      </div>

                      <div className="py-1 border-b border-slate-100">
                        <Link
                          to={isAdmin ? "/workforce/admin/settings" : "/workforce/employee/profile"}
                          onClick={() => setShowUserMenu(false)}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-colors font-medium"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>My Profile</span>
                        </Link>
                        <Link
                          to={isAdmin ? "/workforce/admin/settings" : "/workforce/employee/settings"}
                          onClick={() => setShowUserMenu(false)}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-colors font-medium"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          <span>Settings</span>
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 transition-colors font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/workforce/login"
                  className="px-2.5 py-1 rounded text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/workforce/signup"
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Workforce Operations Reference"
        icon={HelpCircle}
        maxWidth="max-w-md"
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Welcome to the <strong>{user?.companyName || 'Workforce'} Enterprise Operations Hub</strong>.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <h4 className="font-bold text-slate-800">Operational Guidelines:</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Admins verify onboarding dossiers, review trade certifications, and authorize services individually.</li>
              <li>Technicians must be marked ONLINE and CLOCKED IN to receive automatic job assignments.</li>
              <li>Job state transitions (Accept &rarr; Travel &rarr; Work &rarr; Proof &amp; Complete) must be executed in order.</li>
            </ul>
          </div>
          <p className="text-[11px] text-slate-500">
            For technical support, contact your Workforce Operations administrator.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default TopHeader;
