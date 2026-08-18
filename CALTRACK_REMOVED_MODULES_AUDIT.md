# CalTrack — Removal of Non-Core Admin & Employee Modules Audit Report

**Document Version:** 1.0.0  
**Audit Scope:** User-Facing Navigation & UI Removal of Non-Core Modules with Strict Preservation of Operational Business Logic  
**Target Codebase:** Workforce App (`workforce-app`)  
**Audit Date:** August 18, 2026  
**Auditor:** Antigravity Advanced Agentic Engineering System  

---

## 1. Modules Removed
The following six standalone user-facing modules were completely removed from both Admin and Employee navigation, routing, and dashboard presentation:

1. **Scheduling** (Shift rota creation, weekly timetable calendar, working day configurator)
2. **Attendance** (General attendance log tables, shift history list, standalone clock-in card)
3. **Timesheets** (Timesheet review tables, punch-in/punch-out activity log tables)
4. **Leave** (Leave application modal, employee absence history, admin leave approval queue)
5. **Payroll** (Admin payroll period processor, issued payslips tables, earnings ledger)
6. **Compliance** (Compliance requirements creator, safety certificate audit tables)

---

## 2. Admin Navigation Changes
In [`frontend/src/components/common/Sidebar.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/components/common/Sidebar.jsx), the Admin sidebar navigation was restructured to focus strictly on core workforce and dispatch operations:

- **Removed from OPERATIONS Group:** `Scheduling` (`/workforce/admin/scheduling`).
- **Removed Entire TIME Group:** `Attendance` (`/workforce/admin/attendance`), `Timesheets` (`/workforce/admin/timesheets`), and `Leave` (`/workforce/admin/leave`).
- **Removed Standalone Modules:** `Payroll` (`/workforce/admin/payroll`) and `Compliance` (`/workforce/admin/compliance`).
- **Cleaned Collapsible State:** `collapsed` state now manages only `workforce` and `operations`.
- **Retained Core Admin Navigation:**
  - `Home` (`/workforce/admin`)
  - **WORKFORCE:** `Employees` (`/workforce/admin/employees`), `Applications` (`/workforce/admin/applications`), `Services` (`/workforce/admin/services`), `Skills` (`/workforce/admin/skills`)
  - **OPERATIONS:** `Jobs` (`/workforce/admin/jobs`), `Dispatch` (`/workforce/admin/dispatch`), `Live Workforce` (`/workforce/admin/operations`)
  - `Reports` (`/workforce/admin/reports`)
  - `Settings` (`/workforce/admin/settings`)

---

## 3. Employee Navigation Changes
In [`frontend/src/components/common/Sidebar.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/components/common/Sidebar.jsx), the Employee sidebar was streamlined to reflect core field technician duties:

- **Removed from MY WORK Group:** `Schedule` (`/workforce/employee/schedule`).
- **Removed Entire TIME Group:** `Attendance` (`/workforce/employee/attendance`) and `Leave` (`/workforce/employee/leave`).
- **Removed Standalone Module:** `Earnings` (`/workforce/employee/earnings`).
- **Cleaned Collapsible State:** `collapsed` state now manages only `myWork` and `profile`.
- **Retained Core Employee Navigation:**
  - `Home` (`/workforce/employee/dashboard`)
  - **MY WORK:** `Jobs` (`/workforce/employee/dashboard`), `Performance` (`/workforce/employee/performance`)
  - **PROFILE:** `My Profile` (`/workforce/employee/profile`), `Documents` (`/workforce/employee/documents`), `Services` (`/workforce/employee/services`), `My Locations` (`/workforce/employee/location`)
  - `Settings` (`/workforce/employee/settings`)

---

## 4. Routes Removed
The following standalone routes no longer render isolated feature pages:

- `/workforce/admin/scheduling`
- `/workforce/admin/attendance`
- `/workforce/admin/timesheets`
- `/workforce/admin/leave`
- `/workforce/admin/payroll`
- `/workforce/admin/compliance`
- `/workforce/employee/schedule`
- `/workforce/employee/attendance`
- `/workforce/employee/leave`
- `/workforce/employee/earnings`

---

## 5. Routes Redirected
To prevent broken 404s or blank screens when users attempt to access bookmarked or manual URLs, graceful application-level redirects were established in [`frontend/src/App.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/App.jsx):

| Requested Route | Redirect Target | Purpose |
|:---|:---|:---|
| `/workforce/admin/scheduling` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/attendance` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/timesheets` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/leave` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/payroll` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/compliance` | `/workforce/admin` | Fallback to Admin Operations Hub |
| `/workforce/admin/documents` | `/workforce/admin/applications` | Fallback to Applications & Dossier Review |
| `/workforce/employee/schedule` | `/workforce/employee/dashboard` | Fallback to Technician Hub |
| `/workforce/employee/attendance` | `/workforce/employee/dashboard` | Fallback to Technician Hub |
| `/workforce/employee/leave` | `/workforce/employee/dashboard` | Fallback to Technician Hub |
| `/workforce/employee/earnings` | `/workforce/employee/dashboard` | Fallback to Technician Hub |

---

## 6. Components Removed
The following 5 standalone page components were unmounted, unreferenced from `App.jsx`, and safely deleted from `frontend/src/pages/admin/`:

1. `frontend/src/pages/admin/AdminSchedulingPage.jsx`
2. `frontend/src/pages/admin/AdminAttendancePage.jsx`
3. `frontend/src/pages/admin/AdminLeavePage.jsx`
4. `frontend/src/pages/admin/AdminPayrollPage.jsx`
5. `frontend/src/pages/admin/AdminCompliancePage.jsx`

Additionally, the standalone `<ClockInCard />` was unmounted from the general dashboard in `EmployeeDashboardPage.jsx` (clock-in is preserved exclusively within the active job execution workflow).

---

## 7. API Calls Removed from User-Facing Frontend
The following API calls were removed from frontend component mounting and event flows:

- In `EmployeeDashboardPage.jsx`:
  - `apiApplyLeave` (Removed from submit handler)
  - `apiGetMySchedule` (Removed from sub-route effect)
  - `apiGetLeaves` (Removed from sub-route effect)
  - `apiGetMyPayslips` (Removed from sub-route effect)
  - `apiGetComplianceRecords` (Removed from sub-route effect)
- In `AdminOperationsPage.jsx`:
  - `apiGetLeaves` (Removed from initial `loadData` `Promise.all`)
  - `apiAdminDecideLeave` (Removed from decision handler)
- In `AdminDashboardPage.jsx`:
  - `apiGetLeaves` (Removed from initial `loadData` `Promise.all`)

---

## 8. State & Handlers Removed
- In `EmployeeDashboardPage.jsx`:
  - **State variables removed:** `schedules`, `setSchedules`, `leaves`, `setLeaves`, `payslips`, `setPayslips`, `complianceRecords`, `setComplianceRecords`, `showLeaveModal`, `setShowLeaveModal`, `leaveType`, `setLeaveType`, `leaveStart`, `setLeaveStart`, `leaveEnd`, `setLeaveEnd`, `leaveReason`, `setLeaveReason`, `isSubmittingLeave`, `setIsSubmittingLeave`.
  - **Handlers & Modals removed:** `handleApplyLeaveSubmit`, Apply Leave button in header, and `showLeaveModal` Modal JSX.
- In `AdminOperationsPage.jsx`:
  - **State variables removed:** `leaves`, `setLeaves`.
  - **Handlers removed:** `handleDecideLeave`.
  - **Tabs removed:** `leaves` tab from `tabs` array.
- In `AdminDashboardPage.jsx`:
  - **State variables removed:** `leaves`, `setLeaves`.

---

## 9. Report Tabs Removed
In [`frontend/src/pages/admin/AdminReportsPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/admin/AdminReportsPage.jsx), the report type selector was filtered to display only operational reports:

- **Removed Tabs:** `Payroll Summaries` (`id: 'payroll'`) and `Compliance Audit` (`id: 'compliance'`).
- **Retained Core Report Tabs:** `Employee Roster` (`id: 'employee'`) and `Field Jobs` (`id: 'job'`).

---

## 10. Settings Removed
In [`frontend/src/pages/employee/EmployeeSettingsPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/employee/EmployeeSettingsPage.jsx):

- **Removed Notification Preference Keys:**
  - `shift_reminders` (Shift Timings & Attendance Reminders)
  - `leave_updates` (Leave Decisions & Approvals)
  - `payroll_notifications` (Payroll & Issued Payslips)
- **Retained Core Notification Keys:**
  - `job_assignments` (Field Job Offers & Automatic Assignments)
  - `security_alerts` (Security & Critical Account Alerts)
  - `workspace_announcements` (Company & Operations Announcements)
  - `weekly_digest` (Weekly Summary & Performance Digest)
  - `product_updates` (Product & Platform Enhancements)
- **Export Description Updated:** Removed mentions of "attendance logs", "shift history", and "payslips", updating the description to `"Download a structured export of your verified profile, skills, territory locations, and completed jobs history."`.

---

## 11. Backend APIs Intentionally Preserved
The following backend endpoints remain fully intact on the backend to support internal dependencies and background engines:

- `POST /api/time-tracking/clock-in/` (`ClockInView` — generates `TimeLog` and transitions job to `in_progress`).
- `GET /api/workforce/compliance/requirements/` & `GET /api/workforce/compliance/records/` (used internally by dispatch Gate 4 and onboarding).
- `GET /api/workforce/leaves/` & `POST /api/workforce/leaves/` (used internally by dispatch Gate 8 to exclude unavailable technicians).
- `GET /api/workforce/schedules/me/` (used internally by dispatch Gate 5 to check working shifts).
- `GET /api/workforce/payroll/periods/` & `GET /api/workforce/payroll/me/` (used internally for historical financial ledgers).

---

## 12. Database Models Intentionally Preserved
No database tables, foreign keys, constraints, or models were deleted or dropped:

- `time_tracking.TimeLog` (Shift boundaries and job execution timestamps).
- `workforce_api.WorkforceRequiredDocument` & `WorkforceEmployeeDocument` (Dossier verification).
- `workforce_api.WorkforceComplianceRequirement` & `WorkforceEmployeeCompliance` (Regulatory safety records).
- `workforce_api.WorkforceEmployeeSchedule` (Technician working shift windows).
- `workforce_api.WorkforceLeaveApplication` (Absence records for dispatch exclusion).
- `workforce_api.WorkforcePayrollPeriod` & `WorkforceEmployeePayslip` (Financial calculation engine).

---

## 13. Internal Business Rules Preserved
- **Single Active Job Constraint:** Unchanged. Enforces that a technician working on an active job cannot receive new offers.
- **Concurrent Acceptance Locking:** Unchanged. Enforces Level 1 (Job) $\rightarrow$ Level 2 (Employee) $\rightarrow$ Level 3 (Offer) locking.
- **Offer Expiry & 5-Minute Cancellation:** Unchanged.
- **Geofenced 300m Arrival:** Unchanged.
- **6-Digit Cryptographic Work Start OTP:** Unchanged.
- **Post-Service Evidence & Photos:** Unchanged.
- **Payment Lifecycle & `is_ready_to_complete()` Completion Gate:** Unchanged.

---

## 14. Dispatch Dependencies Preserved
The 9-gate automatic dispatch engine in [`backend/workforce_api/services/automatic_dispatch.py`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/backend/workforce_api/services/automatic_dispatch.py) continues to evaluate all 9 gates server-side:

- **Gate 1:** Account Active (`is_active == True`).
- **Gate 2:** Registration Approved (`onboarding.status == 'approved'`).
- **Gate 3:** Mandatory Documents Approved (`WorkforceEmployeeDocument`).
- **Gate 4:** Mandatory Compliance Valid (`WorkforceEmployeeCompliance`).
- **Gate 5:** Working Schedule Active (`WorkforceEmployeeSchedule`).
- **Gate 6:** Service / Skill Match (`EmployeeService` & verified skills).
- **Gate 7:** Live Presence (`is_online == True`, `current_availability == 'available'`).
- **Gate 8:** Approved Leave Exclusion (Technicians on approved leave are excluded).
- **Gate 9:** Single-Active-Job Workload Check (`get_employee_active_job(emp) is None`).

---

## 15. TimeLog Dependencies Preserved
The operational requirement that a job transitioning to `in_progress` requires an active shift `TimeLog` is fully preserved:

- **Operational Path:** Inside [`EmployeeDashboardPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/employee/EmployeeDashboardPage.jsx#L437), when a technician enters the customer's Work Start OTP and clicks `CLOCK IN & START WORK`, [`handleDirectJobClockIn`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/employee/EmployeeDashboardPage.jsx#L437) invokes `apiClockIn({ job_id: selectedJob.id, lat, lon })`.
- **Backend Enforcement:** `ClockInView` creates a `TimeLog` record and calls `apply_transition(locked_job, "in_progress", actor=request.user)`.

---

## 16. Compliance Dependencies Preserved
- Regulatory compliance records remain verified in PostgreSQL.
- Dispatch Gate 4 evaluates `WorkforceEmployeeCompliance.objects.filter(...)` ensuring expired or missing compliance rejects candidates with `[DISPATCH_REJECT] reason=COMPLIANCE_INVALID`.

---

## 17. Leave Dependencies Preserved
- Technicians with active approved leave records in `bank_details["leaves"]` or `WorkforceLeaveApplication` continue to fail Gate 8 with `[DISPATCH_REJECT] reason=EMPLOYEE_ON_LEAVE`.

---

## 18. Scheduling Dependencies Preserved
- Working days and shift hours in `WorkforceEmployeeSchedule` continue to be validated by Gate 5 (`[DISPATCH_REJECT] reason=OUTSIDE_WORKING_SCHEDULE`).

---

## 19. Payroll Dependencies Preserved
- The payroll calculation backend services, earnings reconciliation, and data models remain available in the backend without user-facing exposure.

---

## 20. Dead-Code Search Results
A comprehensive grep search for `Scheduling`, `Attendance`, `Timesheets`, `Leave`, `Payroll`, and `Compliance` was executed across `frontend/src/`:

- **UI Elements:** Zero dead buttons, zero orphan modals, zero broken sidebar links.
- **Imports:** Zero dead page imports in `App.jsx` or dashboard views.
- **API Calls:** Zero unused network requests firing on page load.
- **Routes:** All removed routes have explicit redirects to `/workforce/admin` or `/workforce/employee/dashboard`.

---

## 21. Remaining References and Justifications
| Remaining Reference | Location | Justification |
|:---|:---|:---|
| Route redirects | `frontend/src/App.jsx` | Gracefully redirects legacy bookmarks to main dashboards. |
| Client API functions | `frontend/src/api/workforceService.js` | Preserved API library functions without UI coupling. |
| Onboarding document text | `frontend/src/pages/onboarding/OnboardingWizardPage.jsx` | Text instructions for uploading required identity dossier files. |
| Internal clock-in component | `frontend/src/components/employee/ClockInCard.jsx` | Component preserved in repo (not mounted in active navigation). |

---

## 22. Potential Future Cleanup Candidates
- Deprecation of standalone backend API endpoints (`/workforce/leaves/`, `/workforce/payroll/periods/`) if a multi-phase backend retirement is authorized in future sprints.
- Database column archiving once historical audit periods lapse.

---

## 23. Files Modified
1. [`frontend/src/components/common/Sidebar.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/components/common/Sidebar.jsx) — Removed 6 non-core modules from Admin and Employee sidebars.
2. [`frontend/src/App.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/App.jsx) — Cleaned up imports and configured redirect fallbacks for all removed routes.
3. [`frontend/src/pages/admin/AdminOperationsPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/admin/AdminOperationsPage.jsx) — Removed Leave tab, state, handlers, and API calls.
4. [`frontend/src/pages/admin/AdminReportsPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/admin/AdminReportsPage.jsx) — Removed Payroll and Compliance tabs from reports selector.
5. [`frontend/src/pages/admin/AdminDashboardPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/admin/AdminDashboardPage.jsx) — Removed unused `apiGetLeaves` call and state.
6. [`frontend/src/pages/employee/EmployeeSettingsPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/employee/EmployeeSettingsPage.jsx) — Removed shift, leave, and payroll notification preferences; updated export description.
7. [`frontend/src/pages/employee/EmployeeDashboardPage.jsx`](file:///c:/Users/user/Desktop/Projects/workforce-standalone/workforce-app/frontend/src/pages/employee/EmployeeDashboardPage.jsx) — Removed standalone schedule, attendance, leave, earnings tabs and leave modal; preserved active job execution clock-in.

---

## 24. Files Deleted
1. `frontend/src/pages/admin/AdminSchedulingPage.jsx`
2. `frontend/src/pages/admin/AdminAttendancePage.jsx`
3. `frontend/src/pages/admin/AdminLeavePage.jsx`
4. `frontend/src/pages/admin/AdminPayrollPage.jsx`
5. `frontend/src/pages/admin/AdminCompliancePage.jsx`

---

## 25. Architectural Risks & Mitigation
- **Risk:** Technician unable to start job if standalone attendance page is removed.  
  **Mitigation:** `handleDirectJobClockIn` is embedded directly in the active job detail view (`ARRIVED -> OTP -> CLOCK IN & START WORK -> IN_PROGRESS`).
- **Risk:** Dispatches assigned to technicians on leave or missing compliance.  
  **Mitigation:** Backend 9-gate automatic dispatch engine retains all validation checks independently of UI presentation.
- **Risk:** User enters legacy URL and sees 404 error.  
  **Mitigation:** `App.jsx` handles all legacy paths with instant `<Navigate replace />` redirects to valid dashboards.

---

## 26. Final UI & Navigation Structure

### Admin Navigation
```
HOME
└── Home (/workforce/admin)

WORKFORCE
├── Employees (/workforce/admin/employees)
├── Applications (/workforce/admin/applications)
├── Services (/workforce/admin/services)
└── Skills (/workforce/admin/skills)

OPERATIONS
├── Jobs (/workforce/admin/jobs)
├── Dispatch (/workforce/admin/dispatch)
└── Live Workforce (/workforce/admin/operations)

REPORTS & SETTINGS
├── Reports (/workforce/admin/reports)
└── Settings (/workforce/admin/settings)
```

### Approved Employee Navigation
```
HOME
└── Home (/workforce/employee/dashboard)

MY WORK
├── Jobs (/workforce/employee/dashboard)
└── Performance (/workforce/employee/performance)

PROFILE
├── My Profile (/workforce/employee/profile)
├── Documents (/workforce/employee/documents)
├── Services (/workforce/employee/services)
└── My Locations (/workforce/employee/location)

SETTINGS
└── Settings (/workforce/employee/settings)
```

---

## Sign-Off & Verification
All requested non-core modules have been removed from the user interface while strictly preserving underlying operational controls and data integrity. In accordance with instructions, **no automated tests or E2E suites were executed**.
