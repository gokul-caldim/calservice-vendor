import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import {
  Home,
  Users,
  ClipboardList,
  Wrench,
  Award,
  FileText,
  Briefcase,
  Send,
  Navigation,
  Calendar,
  Clock,
  FileSpreadsheet,
  CalendarDays,
  CreditCard,
  ShieldCheck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Activity,
  Layers,
  User,
  Star,
  MapPin,
} from 'lucide-react';


export function Sidebar({ onCloseMobile = () => {} }) {
  const { user, isAdmin, isEmployee, registrationStatus } = useAuth();
  const location = useLocation();

  // Collapsible sections state
  const [collapsed, setCollapsed] = useState({
    workforce: false,
    operations: false,
    time: false,
    myWork: false,
    profile: false,
  });

  const toggleSection = (section) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-bold border-l-2 border-blue-600'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  if (isAdmin) {
    return (
      <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col overflow-y-auto text-xs select-none">
        <div className="p-3 space-y-4">
          {/* Home */}
          <div>
            <NavLink
              to="/workforce/admin"
              end
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <Home className="w-4 h-4 text-slate-500" />
              <span>Home</span>
            </NavLink>
          </div>

          {/* Group 1: WORKFORCE */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('workforce')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
            >
              <span>Workforce</span>
              {collapsed.workforce ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {!collapsed.workforce && (
              <div className="mt-1 space-y-0.5 pl-1">
                <NavLink
                  to="/workforce/admin/employees"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Employees</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/applications"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                  <span>Applications</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/services"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  <span>Services</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/skills"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Award className="w-3.5 h-3.5 text-slate-400" />
                  <span>Skills</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/documents"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Documents</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 2: OPERATIONS */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('operations')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
            >
              <span>Operations</span>
              {collapsed.operations ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {!collapsed.operations && (
              <div className="mt-1 space-y-0.5 pl-1">
                <NavLink
                  to="/workforce/admin/jobs"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Jobs</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/dispatch"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Send className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Dispatch</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/operations"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Navigation className="w-3.5 h-3.5 text-slate-400" />
                  <span>Live Workforce</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/scheduling"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Scheduling</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 3: TIME */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('time')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
            >
              <span>Time</span>
              {collapsed.time ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {!collapsed.time && (
              <div className="mt-1 space-y-0.5 pl-1">
                <NavLink
                  to="/workforce/admin/attendance"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Attendance</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/timesheets"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                  <span>Timesheets</span>
                </NavLink>
                <NavLink
                  to="/workforce/admin/leave"
                  onClick={onCloseMobile}
                  className={navItemClass}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  <span>Leave</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Standalone Modules */}
          <div className="space-y-0.5 pt-2 border-t border-slate-100">
            <NavLink
              to="/workforce/admin/payroll"
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span>Payroll</span>
            </NavLink>
            <NavLink
              to="/workforce/admin/compliance"
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Compliance</span>
            </NavLink>
            <NavLink
              to="/workforce/admin/reports"
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Reports</span>
            </NavLink>
            <NavLink
              to="/workforce/admin/settings"
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Settings</span>
            </NavLink>
          </div>
        </div>
      </aside>
    );
  }

  // Employee Sidebar
  const isApproved = registrationStatus === 'approved';

  if (!isApproved) {
    let statusText = 'Registration Wizard';
    let statusBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    let statusRoute = '/workforce/onboarding/wizard';

    if (registrationStatus === 'submitted' || registrationStatus === 'under_review') {
      statusText = 'Under Review';
      statusBadgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
      statusRoute = '/workforce/onboarding/pending-review';
    } else if (registrationStatus === 'correction_required') {
      statusText = 'Action Required';
      statusBadgeColor = 'bg-orange-50 text-orange-800 border-orange-200';
      statusRoute = '/workforce/onboarding/corrections';
    } else if (registrationStatus === 'rejected') {
      statusText = 'Application Declined';
      statusBadgeColor = 'bg-red-50 text-red-800 border-red-200';
      statusRoute = '/workforce/onboarding/rejected';
    }

    return (
      <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col overflow-y-auto text-xs select-none">
        <div className="p-3 space-y-4">
          {/* Status Banner */}
          <div className={`p-2.5 rounded border text-[11px] font-medium space-y-1 ${statusBadgeColor}`}>
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{statusText}</span>
            </p>
            <p className="text-[10px] opacity-90 leading-tight">
              Operational modules unlock once Admin approves your application.
            </p>
          </div>

          {/* Onboarding Navigation */}
          <div>
            <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Registration
            </div>
            <div className="mt-1 space-y-0.5 pl-1">
              <NavLink
                to={statusRoute}
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Registration Wizard</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/profile"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </NavLink>
            </div>
          </div>

          {/* Settings */}
          <div className="pt-2 border-t border-slate-100">
            <NavLink
              to="/workforce/employee/settings"
              onClick={onCloseMobile}
              className={navItemClass}
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Settings</span>
            </NavLink>
          </div>
        </div>
      </aside>
    );
  }

  // Approved Employee Sidebar
  return (
    <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col overflow-y-auto text-xs select-none">
      <div className="p-3 space-y-4">
        {/* Home */}
        <div>
          <NavLink
            to="/workforce/employee/dashboard"
            end
            onClick={onCloseMobile}
            className={navItemClass}
          >
            <Home className="w-4 h-4 text-slate-500" />
            <span>Home</span>
          </NavLink>
        </div>

        {/* Group: MY WORK */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('myWork')}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <span>My Work</span>
            {collapsed.myWork ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {!collapsed.myWork && (
            <div className="mt-1 space-y-0.5 pl-1">
              <NavLink
                to="/workforce/employee/dashboard"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                <span>Jobs</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/schedule"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Schedule</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/performance"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span>Performance</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Group: TIME */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('time')}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <span>Time</span>
            {collapsed.time ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {!collapsed.time && (
            <div className="mt-1 space-y-0.5 pl-1">
              <NavLink
                to="/workforce/employee/attendance"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Attendance</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/leave"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span>Leave</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Standalone: Earnings */}
        <div>
          <NavLink
            to="/workforce/employee/earnings"
            onClick={onCloseMobile}
            className={navItemClass}
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span>Earnings</span>
          </NavLink>
        </div>

        {/* Group: PROFILE */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
          >
            <span>Profile</span>
            {collapsed.profile ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {!collapsed.profile && (
            <div className="mt-1 space-y-0.5 pl-1">
              <NavLink
                to="/workforce/employee/profile"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/documents"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Documents</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/services"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span>Services</span>
              </NavLink>
              <NavLink
                to="/workforce/employee/location"
                onClick={onCloseMobile}
                className={navItemClass}
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>My Locations</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="pt-2 border-t border-slate-100">
          <NavLink
            to="/workforce/employee/settings"
            onClick={onCloseMobile}
            className={navItemClass}
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Settings</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

