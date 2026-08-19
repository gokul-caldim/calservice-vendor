import React, { useState, useEffect, useRef, useContext } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { EmployeeRuntimeContext } from '../../context/EmployeeRuntimeContext.jsx';
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
  Trash2,
  CheckSquare,
  Square,
  X,
  CheckCheck,
} from 'lucide-react';

import { Modal } from '../enterprise/Modal.jsx';
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiClearNotifications,
  apiUpdateLocationFull,
} from '../../api/workforceService.js';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';

export function TopHeader({ onToggleSidebar = () => {} }) {
  const { user, logout, togglePresence, isAdmin, isEmployee, registrationStatus } = useAuth();
  const employeeRuntime = useContext(EmployeeRuntimeContext);
  const navigate = useNavigate();
  const [isToggling, setIsToggling] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const notifRef = useRef(null);

  const notifications = employeeRuntime ? employeeRuntime.notifications : localNotifications;
  const unreadCount = employeeRuntime ? employeeRuntime.unreadCount : localUnreadCount;

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
        setIsSelectMode(false);
        setSelectedNotifIds(new Set());
      }
    };
    if (showNotifMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showNotifMenu]);

  // Location Scan State
  const [localLocState, setLocalLocState] = useState('idle'); // 'idle' | 'locating' | 'success' | 'error'
  const [localLocCoords, setLocalLocCoords] = useState(() => {
    const loc = user?.last_known_location;
    if (loc?.latitude && loc?.longitude) {
      return { latitude: Number(loc.latitude), longitude: Number(loc.longitude), accuracy: loc.accuracy || null };
    }
    return null;
  });

  const localHandleScanCurrentLocation = async () => {
    if (localLocState === 'locating') return;
    setLocalLocState('locating');
    try {
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      const captured_at = new Date(pos.timestamp || Date.now()).toISOString();
      await apiUpdateLocationFull(latitude, longitude, accuracy, speed, heading, captured_at);
      setLocalLocCoords({
        latitude,
        longitude,
        accuracy,
        timestamp: pos.timestamp || Date.now(),
      });
      setLocalLocState('success');
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
      setTimeout(() => setLocalLocState('idle'), 2500);
    } catch (_) {
      setLocalLocState('error');
      setTimeout(() => setLocalLocState('idle'), 3000);
    }
  };

  const locCoords = employeeRuntime?.liveLocation || localLocCoords;
  const locState = employeeRuntime?.locationState || localLocState;
  const handleScanCurrentLocation = employeeRuntime ? employeeRuntime.scanCurrentLocation : localHandleScanCurrentLocation;

  // Background notification polling for Admin users ONLY (Employee notifications are centralized in EmployeeRuntimeProvider)
  useEffect(() => {
    if (employeeRuntime) return;
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
          setLocalNotifications(res.notifications || []);
          setLocalUnreadCount(res.unread_count || 0);
        }
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    };
    fetchNotifs();
    pollInterval = setInterval(fetchNotifs, 15000);
    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user, employeeRuntime]);

  const handleMarkAllRead = async () => {
    if (employeeRuntime) {
      await employeeRuntime.markNotificationAsRead();
      return;
    }
    try {
      await apiMarkNotificationRead();
      setLocalUnreadCount(0);
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedNotifIds(new Set());
      }
      return !prev;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedNotifIds.size === notifications.length && notifications.length > 0) {
      setSelectedNotifIds(new Set());
    } else {
      setSelectedNotifIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleToggleSelectOne = (id, e) => {
    e?.stopPropagation?.();
    setSelectedNotifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearAll = async (e) => {
    e?.stopPropagation?.();
    if (notifications.length === 0) return;
    try {
      setIsClearing(true);
      if (employeeRuntime) {
        await employeeRuntime.clearAllNotifications([]);
      } else {
        await apiClearNotifications(null, null, true);
        setLocalNotifications([]);
        setLocalUnreadCount(0);
      }
      setSelectedNotifIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearSelected = async (e) => {
    e?.stopPropagation?.();
    if (selectedNotifIds.size === 0) return;
    const ids = Array.from(selectedNotifIds);
    try {
      setIsClearing(true);
      if (employeeRuntime) {
        await employeeRuntime.clearAllNotifications(ids);
      } else {
        await apiClearNotifications(null, ids);
        const unreadCleared = localNotifications.filter(
          (n) => selectedNotifIds.has(n.id) && !n.is_read
        ).length;
        setLocalNotifications((prev) => prev.filter((n) => !selectedNotifIds.has(n.id)));
        setLocalUnreadCount((prev) => Math.max(0, prev - unreadCleared));
      }
      setSelectedNotifIds(new Set());
      if (notifications.length <= ids.length) {
        setIsSelectMode(false);
      }
    } catch (err) {
      console.error('Failed to clear selected notifications:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearSingle = async (notifId, e) => {
    e?.stopPropagation?.();
    try {
      setIsClearing(true);
      if (employeeRuntime) {
        await employeeRuntime.clearAllNotifications([notifId]);
      } else {
        await apiClearNotifications(notifId);
        const notif = localNotifications.find((n) => n.id === notifId);
        const wasUnread = notif && !notif.is_read;
        setLocalNotifications((prev) => prev.filter((n) => n.id !== notifId));
        if (wasUnread) {
          setLocalUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      setSelectedNotifIds((prev) => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    } catch (err) {
      console.error('Failed to clear notification:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleMarkSelectedRead = async (e) => {
    e?.stopPropagation?.();
    if (selectedNotifIds.size === 0) return;
    const ids = Array.from(selectedNotifIds);
    try {
      if (employeeRuntime) {
        await apiMarkNotificationRead(null, ids);
        await employeeRuntime.syncNotifications();
      } else {
        await apiMarkNotificationRead(null, ids);
        const countUnreadInSelected = localNotifications.filter(
          (n) => selectedNotifIds.has(n.id) && !n.is_read
        ).length;
        setLocalNotifications((prev) =>
          prev.map((n) => (selectedNotifIds.has(n.id) ? { ...n, is_read: true } : n))
        );
        setLocalUnreadCount((prev) => Math.max(0, prev - countUnreadInSelected));
      }
    } catch (err) {
      console.error('Failed to mark selected as read:', err);
    }
  };

  const handleNotifClick = async (notif) => {
    try {
      if (!notif.is_read) {
        if (employeeRuntime) {
          await employeeRuntime.markNotificationAsRead(notif.id);
        } else {
          await apiMarkNotificationRead(notif.id);
          setLocalUnreadCount((prev) => Math.max(0, prev - 1));
          setLocalNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
          );
        }
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
    if (user?.availability === 'busy') {
      alert('Cannot change availability or go offline while actively working on an assigned job.');
      return;
    }
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
  const isBusy = user?.availability === 'busy';

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
                      disabled={isToggling || isBusy}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                        isBusy
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 cursor-not-allowed'
                          : isOnline
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                      title={
                        isBusy
                          ? 'Locked Online: You are actively working on an assigned job (BUSY).'
                          : isOnline
                            ? 'You are ONLINE. Click to go OFFLINE'
                            : 'You are OFFLINE. Click to go ONLINE'
                      }
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBusy
                            ? 'bg-blue-400 animate-pulse'
                            : isOnline
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-slate-500'
                        }`}
                      />
                      <span className="text-[11px] uppercase font-bold">
                        {isBusy ? 'ON JOB (BUSY)' : isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <Power className="w-3 h-3 ml-0.5 opacity-70" />
                    </button>

                    {/* Compact Real-Time Automatic GPS Telemetry Indicator */}
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border bg-slate-800/90 text-slate-300 border-slate-700 select-none shadow-xs"
                      title={
                        locCoords
                          ? `Automatic Real-Time GPS: ${locCoords.latitude.toFixed(4)}, ${locCoords.longitude.toFixed(4)} (±${Math.round(locCoords.accuracy || 0)}m)`
                          : 'Automatic GPS Telemetry Active'
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-mono font-medium">
                        {locCoords
                          ? `${locCoords.latitude.toFixed(3)}, ${locCoords.longitude.toFixed(3)}`
                          : 'GPS Live'}
                      </span>
                    </div>
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
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifMenu(!showNotifMenu);
                      setShowUserMenu(false);
                      if (showNotifMenu) {
                        setIsSelectMode(false);
                        setSelectedNotifIds(new Set());
                      }
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
                    <div className="absolute right-0 mt-2 w-[390px] sm:w-[420px] max-w-[calc(100vw-20px)] bg-white text-slate-900 rounded-xl border border-slate-200/90 shadow-2xl z-50 text-xs overflow-hidden">
                      {/* Dropdown Header */}
                      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white gap-2">
                        <div className="flex items-center gap-2 font-bold text-slate-900 shrink-0">
                          <Bell className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-bold text-slate-900">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60 whitespace-nowrap">
                              {unreadCount} new
                            </span>
                          )}
                        </div>

                        {notifications.length > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isSelectMode ? (
                              <>
                                {unreadCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleMarkAllRead}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                                  >
                                    Mark all read
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={handleToggleSelectMode}
                                  className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-1"
                                >
                                  <CheckSquare className="w-3 h-3 text-slate-500" />
                                  <span>Select</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={handleToggleSelectMode}
                                className="text-[11px] text-slate-700 hover:text-slate-900 font-semibold px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selection Toolbar (visible when select mode is active) */}
                      {isSelectMode && notifications.length > 0 && (
                        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors whitespace-nowrap"
                          >
                            {selectedNotifIds.size === notifications.length ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span>
                              {selectedNotifIds.size === notifications.length
                                ? 'Deselect all'
                                : 'Select all'}{' '}
                              ({selectedNotifIds.size}/{notifications.length})
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {selectedNotifIds.size > 0 ? (
                              <>
                                {notifications.some(
                                  (n) => selectedNotifIds.has(n.id) && !n.is_read
                                ) && (
                                  <button
                                    type="button"
                                    onClick={handleMarkSelectedRead}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                                  >
                                    Mark read
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={handleClearSelected}
                                  disabled={isClearing}
                                  className="text-[11px] text-white bg-red-600 hover:bg-red-700 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                                >
                                  {isClearing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Clear ({selectedNotifIds.size})</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic whitespace-nowrap">
                                Select items to clear
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Notifications List */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
                            <Bell className="w-7 h-7 text-slate-300 stroke-1" />
                            <p className="font-medium text-slate-600 text-xs">No notifications yet</p>
                            <p className="text-[11px] text-slate-400">You are all caught up!</p>
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isJobOffer =
                              n.notification_type === 'JOB_OFFER' ||
                              n.notification_type === 'JOB_OFFERED';
                            const isSelected = selectedNotifIds.has(n.id);

                            return (
                              <div
                                key={n.id}
                                onClick={(e) => {
                                  if (isSelectMode) {
                                    handleToggleSelectOne(n.id, e);
                                  } else {
                                    handleNotifClick(n);
                                  }
                                }}
                                className={`px-3.5 py-2.5 transition-colors cursor-pointer group relative flex items-start gap-3 ${
                                  isSelected
                                    ? 'bg-blue-50/80 border-l-2 border-blue-600'
                                    : !n.is_read
                                    ? isJobOffer
                                      ? 'bg-amber-50/60 border-l-2 border-amber-500 hover:bg-amber-50'
                                      : 'bg-blue-50/40 border-l-2 border-blue-500 hover:bg-blue-50/70'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                {isSelectMode && (
                                  <div className="pt-0.5 shrink-0">
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-blue-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                                    )}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p
                                      className={`font-semibold text-xs truncate ${
                                        isJobOffer ? 'text-amber-900' : 'text-slate-900'
                                      }`}
                                    >
                                      {n.title}
                                    </p>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                        {new Date(n.created_at).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      {!isSelectMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleClearSingle(n.id, e)}
                                          title="Delete notification"
                                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-all"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                                    {n.message}
                                  </p>
                                  {isJobOffer && !isSelectMode && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-700">
                                      <span>👉 Tap to view offer in dashboard</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Dropdown Footer */}
                      {notifications.length > 0 && !isSelectMode && (
                        <div className="px-3.5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={isClearing}
                            className="text-[11px] text-slate-500 hover:text-red-600 font-medium hover:underline flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                            <span>Clear all notifications</span>
                          </button>
                        </div>
                      )}
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
                          Role: {user.isAdmin ? 'Admin' : (user.isEmployee ? 'Technician' : (user.role || 'Employee'))}
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
