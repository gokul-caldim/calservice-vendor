# Workforce Engineering Rules

> IMPORTANT: This file is the mandatory engineering baseline for the Workforce project.
>
> Every Antigravity agent MUST read and follow this file BEFORE any development, correction, refactor, debugging, optimization, migration, integration, or testing task.

---

# 1. CORE ENGINEERING RULE

Never consider a feature complete merely because:

- The page renders
- The API exists
- The code compiles
- Unit tests pass
- Mock data is displayed
- One manual test succeeds

A feature is complete only when:

Requirement
→ Database
→ Migration
→ Backend API
→ Authorization
→ Validation
→ Frontend
→ Real DB data
→ Integration
→ E2E test
→ Regression test
→ Performance check
→ Security check

Never claim "fixed", "complete", or "production ready" without verification.

---

# 2. BEFORE CODING

Before changing code:

1. Read the relevant requirement documents.
2. Read this file.
3. Inspect the existing implementation.
4. Identify existing models, APIs, services, hooks, and reusable components.
5. Check dependencies with other Workforce modules.
6. Check Marketplace dependencies.
7. Check database ownership.
8. Check existing state transitions.
9. Check existing tests.
10. Check existing performance behavior where relevant.
11. Do not rewrite working functionality unnecessarily.

If requirements conflict with the existing architecture, identify the conflict before making destructive changes.

Always prefer the smallest safe change that solves the confirmed problem.

---

# 3. ARCHITECTURE

The system uses separate applications:

Customer Frontend
        ↓
Customer Backend
        ↓
Supabase PostgreSQL
        ↑
Workforce Backend
        ↑
Workforce Frontend

Marketplace and Workforce share the same database.

DO NOT:

- Duplicate Customer records
- Duplicate ServiceRequest records
- Create a second service catalog
- Create duplicate Employee records
- Directly couple the two frontends

Use stable database IDs and documented ownership.

---

# 4. DATABASE RULES

Every new operational model must use proper relational design.

Use where appropriate:

- Primary keys
- Foreign keys
- NOT NULL constraints
- Unique constraints
- Check constraints
- Indexes
- Created/updated timestamps
- Company/tenant ownership

NEVER use:

    Model.objects.first()

to determine company, tenant, employee, or business ownership.

Do not use JSONB as a replacement for relational data when the data requires:

- Relationships
- Filtering
- Approval
- History
- Constraints
- Reporting

When migrating existing data:

Existing data
→ Migration
→ New structure
→ Verification

Never delete or silently lose existing data.

---

# 5. TENANT ISOLATION

Every Workforce request must resolve the authenticated user's company/tenant.

Never trust frontend values for:

- company_id
- employee_id
- role
- approval status
- permissions
- eligibility

The backend must determine these values.

Every business query must be tenant-scoped.

Missing tenant context must fail safely.

---

# 6. NO FAKE DATA

Never introduce:

- Fake employees
- Fake customers
- Fake jobs
- Fake services
- Fake locations
- Fake battery values
- Fake earnings
- Fake attendance
- Fake payroll
- Fake statistics
- Fake notifications
- Hardcoded business records

Do not use demo fallback records.

If the database is empty, return a proper empty state.

---

# 7. SERVICE CATALOG

The database service catalog is the source of truth.

Never create a hardcoded Workforce service catalog.

Services must use canonical database IDs.

Do not use service-name string matching as the primary relationship.

Use:

Service ID
→ Employee Service
→ ServiceRequest
→ Dispatch

---

# 8. MARKETPLACE INTEGRATION

ServiceRequest is the shared operational contract.

## Marketplace owns

- Customer
- Booking creation
- Customer information
- Booking information
- Payment/customer metadata

## Workforce owns

- Employee assignment
- Job offer
- Workforce operational state
- Job execution
- Proof of work
- Workforce operational extensions

Do not overwrite Marketplace-owned fields from Workforce.

Do not create duplicate booking/job records.

Any change affecting Marketplace must update the integration contract.

---

# 9. API RULES

Every new API must have:

- Authentication
- Authorization
- Tenant validation
- Input validation
- Business validation
- State validation
- Database persistence
- Consistent response
- Error handling

Use appropriate HTTP responses:

400 = Invalid input
401 = Unauthenticated
403 = Unauthorized
404 = Not found
409 = Invalid state/concurrency conflict
500 = Unexpected server error

Use consistent errors:

{
  "error": "Description",
  "code": "ERROR_CODE",
  "details": {}
}

Never expose:

- Stack traces
- SQL errors
- Secrets
- Internal filesystem paths
- Sensitive data

---

# 10. STATE MACHINES

Every workflow with statuses must have an explicit state machine.

Example:

PENDING
   ↓
APPROVED
   ↓
ACTIVE
   ↓
COMPLETED

Invalid transitions must be rejected by the backend.

Never rely on frontend buttons to enforce business state.

Examples:

COMPLETED → PENDING       ❌
CANCELLED → ACCEPTED      ❌
REJECTED → COMPLETED      ❌
EXPIRED → ACCEPTED        ❌

Use transactions and row locking for critical state changes.

---

# 11. DOCUMENT VERIFICATION

Mandatory documents must be database-defined.

RequiredDocument
       ↓
EmployeeDocument

Approval requires:

- Every mandatory document exists
- Current document is APPROVED
- Document is not expired

Optional documents must not block approval.

Rejected documents must support correction/re-upload.

Document history must be preserved.

---

# 12. COMPLIANCE

Compliance states:

MISSING
PENDING_REVIEW
VALID
EXPIRING
EXPIRED
REJECTED

Mandatory compliance must be valid before operational eligibility.

Missing, expired, and rejected mandatory compliance must block dispatch where applicable.

Calculate expiry from actual dates.

Do not trust stale frontend compliance status.

---

# 13. EMPLOYEE ELIGIBILITY

An employee must not receive operational work unless required eligibility checks pass.

Typical checks:

- Account active
- Registration approved
- Mandatory documents approved
- Mandatory compliance valid
- Required service approved
- Required skills verified
- Within working schedule
- Clocked in
- Online
- Not on leave
- Not busy

Eligibility must be calculated server-side.

---

# 14. DISPATCH

Normal flow:

Marketplace Booking
        ↓
ServiceRequest
        ↓
Dispatchable
        ↓
Eligibility
        ↓
Candidate Ranking
        ↓
Job Offer
        ↓
Employee Accepts
        ↓
Assigned

Automatic dispatch must not require Admin action.

Admin dispatch is only for:

- Retry
- Override
- Exception handling

Use transactions and row locking to prevent double assignment.

Test concurrent assignment.

---

# 15. ATTENDANCE VS AVAILABILITY

These are different concepts.

## Attendance

- Clock In
- Clock Out
- Break

## Availability

- Online
- Offline
- Busy
- Leave

Do not merge these concepts.

---

# 16. DATABASE QUERY QUALITY

For important endpoints measure:

- SQL query count
- Response time
- Database execution time
- Python/application processing time
- Rows returned
- Payload size

Prevent:

- N+1 queries
- Queries inside loops
- Full-table reads
- Unpaginated large lists
- Python-side aggregation when DB aggregation is appropriate
- Repeated database queries
- Sequential queries that can safely be combined

Use appropriately:

- select_related
- prefetch_related
- Prefetch
- Exists
- Count
- Sum
- Avg
- annotate
- values
- Pagination
- Indexes

Do not add eager loading blindly.

Measure before and after optimization.

Never claim PostgreSQL is slow without measuring PostgreSQL execution time separately from network/request latency.

---

# 17. REMOTE DATABASE LATENCY

Workforce uses Supabase PostgreSQL while the local backend may run on a developer machine.

Therefore:

Local Backend
      ↓
Internet/WAN
      ↓
Supabase PostgreSQL

A database query can have very low PostgreSQL execution time while still having high total request latency due to network roundtrips.

When investigating latency, distinguish:

Total API Time
=
Network/DB Roundtrip Time
+
PostgreSQL Execution Time
+
Python/Backend Processing
+
Frontend/Browser Waiting

Do not optimize PostgreSQL queries when PostgreSQL execution is already fast and network roundtrips are the actual bottleneck.

When several sequential queries exist, reduce unnecessary roundtrips using safe:

- Bulk queries
- Prefetching
- Exists
- Annotations
- Database-side aggregation

Preserve business behavior while reducing roundtrips.

---

# 18. FRONTEND API REQUEST DISCIPLINE

Frontend performance is part of application correctness.

Every page must avoid unnecessary API calls.

Prevent:

- Duplicate API requests
- Same endpoint called by multiple components unnecessarily
- API calls for data not displayed on the page
- Sequential API waterfalls when requests can safely run in parallel
- Unnecessary polling
- Background requests that block initial rendering
- Requests triggered by unrelated shared components
- Development-only duplicate effects becoming production request duplication

Before adding a new API call:

1. Search whether the data already exists in context/state.
2. Search whether another component already fetches it.
3. Confirm the page actually needs the data.
4. Determine whether it can run in parallel with other independent requests.
5. Determine whether it should be loaded after the initial UI becomes usable.

Do not fetch data merely because it exists.

---

# 19. FRONTEND REQUEST WATERFALLS

Avoid:

API A
  ↓
API B
  ↓
API C
  ↓
API D

when the requests are independent.

Prefer:

API A ─┐
API B ─┼→ Page
API C ─┤
API D ─┘

Use Promise.all or equivalent parallel execution where requests are independent.

Do not parallelize requests that have real data dependencies.

---

# 20. AUTHENTICATION REQUESTS

Authentication initialization must be minimal.

Do not automatically fetch every profile or onboarding resource for every user type.

Example:

/auth/me/
     ↓
Determine role
     ↓
Admin     → Skip employee onboarding API
Employee  → Fetch required onboarding state

Never request employee-specific resources for admin users unless explicitly required.

Shared authentication code must not create unnecessary API calls.

---

# 21. REACT STRICTMODE

Do NOT remove React.StrictMode merely to hide duplicate development requests.

Instead:

- Make effects safe
- Prevent unintended duplicate network calls
- Use correct lifecycle handling
- Deduplicate legitimate in-flight operations where appropriate
- Ensure production behavior remains correct

Any useEffect that performs network operations must be reviewed for:

- StrictMode behavior
- Dependency correctness
- Unmount behavior
- Duplicate execution
- Race conditions
- Stale responses

A useRef guard may be used only when it does not break legitimate re-fetch behavior.

Do not use guards as a blind solution.

---

# 22. POLLING AND REALTIME REQUESTS

Never add automatic polling without proving it is required.

Before adding polling:

- Define the required interval.
- Confirm the endpoint is lightweight.
- Confirm overlapping requests cannot occur.
- Stop polling when the component is unmounted.
- Avoid polling when the page is not visible where appropriate.
- Prefer event/realtime mechanisms when already supported by the architecture.

Never create aggressive polling that floods the backend.

A polling request must not overlap with an existing request to the same resource.

---

# 23. PAGE PERFORMANCE

Every important production page must be evaluated from the user's browser, not only from backend scripts.

Use Chrome DevTools Network:

Network
→ Fetch/XHR
→ Disable cache
→ No throttling
→ Clear
→ Navigate to page
→ Wait for completion
→ Sort by Time

Measure:

- Total requests
- Fetch/XHR count
- Duplicate requests
- Slowest requests
- Request duration
- Queueing/stalled time
- DOMContentLoaded
- Load time
- Payload size

For a page that feels slow, do not guess the cause.

Find the actual slow request first.

---

# 24. PERFORMANCE DIAGNOSIS

When a page is slow, investigate in this order:

1. Browser request count
2. Duplicate requests
3. Request waterfalls
4. Browser queueing/stalled time
5. Slow individual APIs
6. Backend query count
7. Database/network latency
8. Python/application processing
9. Payload size
10. Rendering cost

Do not immediately rewrite backend queries.

Do not immediately add caching.

Do not immediately add infrastructure.

Measure first.

---

# 25. PERFORMANCE OPTIMIZATION WORKFLOW

Every performance correction must follow:

Measure
   ↓
Identify bottleneck
   ↓
Make smallest safe change
   ↓
Measure again
   ↓
Compare before/after
   ↓
Regression test

A performance fix must provide measured evidence.

Example:

Before:
14 SQL queries
4.1 seconds

After:
2 SQL queries
0.8 seconds

Do not report theoretical improvements as measured results.

Clearly separate:

- Measured
- Estimated
- Expected

---

# 26. PAGINATION

Potentially large lists must be paginated.

Examples:

- Employees
- Jobs
- Attendance
- Leave
- Compliance
- Notifications
- Payroll
- Reports
- Dispatch candidates

Never assume production datasets will remain small.

---

# 27. MONEY AND PAYROLL

Never hardcode business calculations.

Do not use arbitrary:

- 20%
- 10%
- ×4
- Fake minimum hours

unless explicitly defined by a real business rule.

Payroll must use:

- Actual employee configuration
- Actual attendance
- Actual completed jobs
- Actual pay period

Validate:

- Duplicate payroll
- Duplicate payslips
- Date ranges
- Negative values
- Precision
- State transitions

---

# 28. NOTIFICATIONS

Notifications must originate from real events.

Examples:

- Job Offered
- Job Assigned
- Leave Decision
- Document Decision
- Service Decision
- Compliance Warning
- Extension Decision
- Parts Decision
- Payroll Published

Do not create fake notification records.

Users may only access their own notifications unless explicitly authorized.

---

# 29. REALTIME

Realtime is supplementary.

REST/database state remains authoritative.

Realtime must handle:

- Reconnection
- Missed events
- Duplicate events
- Connection failure

Do not introduce:

- Redis
- Celery
- Kafka
- RabbitMQ

unless the architecture is explicitly approved for change.

---

# 30. FRONTEND PRODUCTION STATES

Every production screen must handle:

- Loading
- Success
- Empty state
- Validation error
- Server error
- Permission error
- Retry

Do not use mock data.

Frontend must consume real APIs.

Backend remains authoritative.

---

# 31. ENDPOINT TESTING

Every new endpoint must test:

- Happy path
- Unauthenticated
- Wrong role
- Wrong employee
- Wrong company
- Invalid input
- Missing input
- Duplicate request
- Invalid state
- Empty result
- Database persistence

Critical operations must additionally test:

- Concurrent requests
- Retry
- Timeout
- Rollback
- Partial failure

---

# 32. END-TO-END TESTING

A feature is not complete until the real HTTP workflow works:

Frontend
→ API
→ Backend
→ Database
→ Backend
→ API
→ Frontend

For Marketplace integration:

Marketplace
→ Shared Supabase
→ Workforce
→ Shared Supabase
→ Marketplace

Do not claim E2E success from unit tests alone.

---

# 33. REGRESSION TESTING

Every new module must verify existing critical workflows:

- Signup
- Login
- Onboarding
- Document approval
- Service approval
- Employee approval
- Attendance
- Leave
- Availability
- Dispatch
- Job execution
- Proof of work
- Payment
- Payroll
- Marketplace synchronization

New development must not break existing workflows.

---

# 34. CONCURRENCY

Use transactions and row locking for:

- Dispatch
- Job acceptance
- Payments
- Payroll
- Approval
- Inventory/parts

Test:

- Double click
- Duplicate POST
- Concurrent requests
- Accept after expiry
- Cancel during dispatch
- Two employees accepting the same job

Only one valid operation may succeed.

---

# 35. MIGRATION SAFETY

Before changing the database:

Inspect existing data
        ↓
Design migration
        ↓
Preserve existing records
        ↓
Run migration
        ↓
Verify row counts
        ↓
Verify relationships
        ↓
Run regression tests

Never silently discard data.

Never modify schema without a migration.

---

# 36. SECURITY

Never commit or expose:

- JWT secrets
- API keys
- Database passwords
- Service-role keys
- Private credentials
- Production tokens

Use sufficiently strong secrets.

Security warnings must not be ignored.

For example, if JWT/HMAC reports an insecure key length, replace the weak secret with an appropriately strong secret rather than suppressing the warning.

Never expose secrets in:

- Frontend code
- Logs
- API responses
- Error messages
- Git history

---

# 37. FUTURE MODULE PROCESS

For every new module:

## Step 1

Read requirements.

## Step 2

Audit existing implementation.

## Step 3

Define:

- DB
- API
- Permissions
- States
- Validation
- Dependencies
- Marketplace impact
- Performance expectations

## Step 4

Implement backend.

## Step 5

Implement frontend.

## Step 6

Connect real database data.

## Step 7

Test APIs.

## Step 8

Test E2E.

## Step 9

Test concurrency where applicable.

## Step 10

Test query performance.

## Step 11

Test browser request behavior.

## Step 12

Run regression tests.

## Step 13

Document completion and limitations.

Only then mark the module complete.

---

# 38. DEFINITION OF DONE

Use separate statuses:

IMPLEMENTED
TESTED
INTEGRATED
PERFORMANCE VERIFIED
REGRESSION VERIFIED
SECURITY VERIFIED
PRODUCTION READY

Do not report:

"Implemented"

as equivalent to:

"Production Ready"

A module can only be marked Production Ready when all required gates pass.

---

# 39. AGENT BEHAVIOR

Before every correction or development task:

1. Read this file.
2. Read the relevant requirement document.
3. Inspect existing code.
4. Identify dependencies.
5. Identify the actual problem before changing code.
6. Make the smallest safe change.
7. Test the change.
8. Run relevant regression tests.
9. Verify performance when relevant.
10. Verify security when relevant.
11. Report failures honestly.
12. Report measured before/after results when optimization was performed.

DO NOT:

- Invent requirements.
- Assume a bottleneck without measurement.
- Rewrite working architecture unnecessarily.
- Add infrastructure without approval.
- Add caching without proving it is needed.
- Remove StrictMode merely to hide development behavior.
- Add fake data.
- Add unnecessary API requests.
- Claim success without verification.

---

# 40. CORRECTION RULE

When fixing an existing problem:

DO NOT:

Change many unrelated things
        ↓
Hope the problem disappears

Instead:

Reproduce
   ↓
Measure
   ↓
Trace root cause
   ↓
Fix root cause
   ↓
Test
   ↓
Regression test
   ↓
Measure again

If the reported problem cannot be reproduced, do not invent a fix.

---

# 41. FINAL PRINCIPLE

The Workforce platform must always be developed with this mindset:

PRODUCTION BEHAVIOR FIRST.
CORRECTNESS FIRST.
MEASURE BEFORE OPTIMIZING.

The system must remain:

- Correct
- Secure
- Consistent
- Database-driven
- Tenant-safe
- Performant
- Recoverable
- Testable
- Marketplace-compatible
- Scalable

Every future feature, correction, refactor, and optimization must follow these rules.