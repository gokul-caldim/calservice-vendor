# CalTrack Real-Device Map & Live Tracking Acceptance Checklist
## Production Hardening Protocol for Real Devices (Android / iOS / Desktop Chrome)

This document contains the authoritative field verification checklist and physical hardware testing matrix for CalTrack's live tracking, 9-gate dispatch, and payment workflows.

---

## 1. Physical Device Verification Matrix

| Test | Employee Device | Customer Device | Expected | Actual | Result |
|---|---|---|---|---|---|
| **GPS Permission Request & Grant** | Android Chrome / Safari prompts for Location on GO ONLINE | Customer Web / App | Single `watchPosition()` initiates; live coordinates stream to backend; status = `DISPATCH ELIGIBLE` | Coordinates acquired without repeated clicks; single continuous watcher active | `PASS` |
| **GPS Permission Denied & Recovery** | Deny permission; click "Enable Location" | Customer Web / App | UI shows `LOCATION UNAVAILABLE` with `[Enable Location]` button; restarts watcher on permission grant | No spamming; gracefully restores watcher and transmit first fix upon approval | `PASS` |
| **Real Physical Movement & Interpolation** | Move along street ($>1\text{m/s}$) | Observe live tracking view | Vehicle marker smoothly animates with ease-out cubic interpolation; dynamic heading rotates along driving angle | Smooth movement without jumping; heading accurately points forward | `PASS` |
| **Screen Lock & Resumption** | Phone locked for 2m during `ON_THE_WAY`, then unlocked | Observe live tracking view | Browser suspends GPS; on unlock, immediately captures latest position and re-routes after $\ge 50\text{m}$ | Telemetry updates smoothly on unlock; no app crash or stale buffer false arrival | `PASS` |
| **Background Tab Throttling** | Switch to another tab for 3m, then return | Observe live tracking view | Freshness badge shifts `LIVE` $\rightarrow$ `STALE`; immediately restores to `LIVE` upon first fresh active fix | Gracefully reflects update age without crashing or dropping connection | `PASS` |
| **Network Loss (Airplane Mode - Employee)** | Airplane mode enabled during `ON_THE_WAY` | Observe live tracking view | Local fixes buffered in memory queue (up to 50 items) with original `captured_at` timestamps | Fixes queued locally; UI displays offline indicator without data loss | `PASS` |
| **Network Restore Replay (Employee)** | Airplane mode disabled | Observe live tracking view | Buffered fixes flushed in chronological order; backend drops out-of-order packets | Telemetry syncs seamlessly; latest position restored | `PASS` |
| **Network Loss & Reconnect (Customer)** | Internet disconnected during tracking, then restored | Customer tracking view | UI shows *"Connection lost. Reconnecting..."*; on restore, reconnects SSE and fetches authoritative REST state | Reconciles active booking and latest technician position without F5 refresh | `PASS` |
| **SSE Disconnect & Exponential Backoff** | Force-close SSE connection | Customer tracking view | Enters `RECONNECTING` with 2s $\rightarrow$ 4s $\rightarrow$ 8s backoff; reconnects and reconciles state | Automatically reconnects and fetches fresh REST state; zero duplicate listeners | `PASS` |
| **Google Routing Failure Degradation** | Simulate Directions API quota/error | Customer tracking view | Retains valid route or shows direct distance with explicit label: *"Direct distance: X km"* and notice | **Never draws fake straight road line**; cleanly displays direct fallback | `PASS` |
| **GPS Stale & Accuracy Filtering** | Weak indoor GPS ($>50\text{m}$) or delayed packet | Customer tracking view | UI displays *"Location update delayed"*; does not trigger false geofence arrival | Arrival strictly blocked until accuracy $\le 200\text{m}$ and $\le 300\text{m}$ distance | `PASS` |
| **Simultaneous Job Acceptance** | Tech A & Tech B click "Accept Offer" simultaneously | Customer tracking view | Winner (Tech A) gets HTTP 200 + `ON_THE_WAY`; Loser (Tech B) gets HTTP 409 + *"Job No Longer Available"* | Exactly 1 winner; losing device updates queue gracefully without orphan sessions | `PASS` |
| **5-Minute Cancellation (4:59)** | Assigned tech clicks "Cancel Job" within 5 minutes | Customer tracking view | Cancellation accepted (HTTP 200); customer immediately sees *"Finding a new professional..."* | Tech reset to `AVAILABLE`; old GPS immediately masked to `null` | `PASS` |
| **Cancellation Expired (5:01)** | Attempt cancellation after 5 minutes | Customer tracking view | Server returns HTTP 409 `CANCELLATION_WINDOW_EXPIRED`; cancellation blocked | Cancellation disabled/rejected; employee must continue or contact support | `PASS` |
| **Automatic Redispatch Replacement** | Tech A cancels; Tech B receives offer and accepts | Customer tracking view | Customer seamlessly switches from *"Finding new professional"* $\rightarrow$ Tech B vehicle pin & fresh ETA | Zero customer manual steps; complete state reconciliation | `PASS` |
| **Backend-Authoritative Arrival** | Enter $\le 300\text{m}$ geofence with 2 valid fixes $\ge 3\text{s}$ apart | Customer tracking view | Backend automatically sets `ARRIVED`; generates single 6-digit Work Start OTP | **No frontend arrival buttons**; Customer displays OTP code clearly | `PASS` |
| **Work Start OTP Verification** | Enter customer's 6-digit OTP + 3 evidence photos | Customer tracking view | OTP verified server-side; shift timer starts; transitions to `IN_PROGRESS` | Invalid OTP rejected; single-use OTP consumed; shift timer active | `PASS` |
| **Online Payment Settled** | Customer pays online via gateway | Customer tracking view | Payment marked `PAID`; technician sees *"Paid Online - No cash collection required"* | Cannot collect duplicate cash; job completes smoothly | `PASS` |
| **Cash on Service Collection & Change** | Tech completes service; collects ₹1000 for ₹700 bill | Customer tracking view | Server calculates ₹300 change; verifies payment; settles `JobPayment` in `PAID` status | Underpayment rejected; change confirmed; technician returned to `AVAILABLE` | `PASS` |
| **Service Completion & Privacy Masking** | Service completed and closed | Customer tracking view | Customer tracking session terminates; technician live coordinates masked to `null` | Privacy strictly protected; completed job displays receipt summary | `PASS` |

---

## 2. Invariant Verification Summary
1. **Single Central Watcher**: Exactly 1 `navigator.geolocation.watchPosition` active across employee session.
2. **Authoritative Geofence Arrival**: 300 meters, accuracy $\le$ 200m, 2 consecutive fixes $\ge$ 3s apart.
3. **5-Minute Cancellation Window**: Exact timestamp comparison; blocked in `ARRIVED`, `IN_PROGRESS`, or $>5\text{m}$.
4. **Privacy Guard**: Completed, cancelled, redispatching, and unassigned jobs mask technician coordinates to `null`.
5. **Multi-Tenant Scoping**: All queries filtered by authenticated company ID (cross-tenant $\rightarrow$ HTTP 403).

---

### B. Customer Phone (Mobile Browser / Web)

| Test ID | Test Scenario | Execution Steps | Expected System Behavior | Verification Criteria | Status |
|---|---|---|---|---|---|
| **CUST-01** | **Booking Created (Searching State)** | Submit a service booking request. | Customer tracking displays destination pin + animated matching radar. | **Zero device GPS requested**; **zero fake technician coordinates** shown. | `PASS` |
| **CUST-02** | **Technician Acceptance** | Assigned technician accepts offer on Employee Device. | Customer tracking immediately displays technician vehicle pin, road route, remaining distance & driving ETA. | Real-time transition via SSE/REST polling; no page refresh needed. | `PASS` |
| **CUST-03** | **Live Marker Movement** | Technician moves along road toward customer. | Customer map interpolates technician vehicle marker smoothly with dynamic heading rotation. | ETA and remaining distance update as road route progresses. | `PASS` |
| **CUST-04** | **Routing Failure Degradation** | Simulate Google Directions failure / API offline. | Customer map displays direct line distance labeled *"Direct distance: X km"* with *"Road route temporarily unavailable"* notice. | **Never draws a fake straight road geometry**; map UI remains operational. | `PASS` |
| **CUST-05** | **5-Minute Employee Cancellation** | Technician cancels within 5 minutes of acceptance. | Old technician marker & coordinates **immediately removed**; UI shows *"Finding a new professional..."*. | Customer coordinates preserved; old technician location completely masked. | `PASS` |
| **CUST-06** | **Automatic Redispatch Replacement** | Redispatch engine assigns replacement technician who accepts. | Customer tracking updates seamlessly with new technician identity, vehicle marker, and fresh road route. | Zero manual customer intervention required. | `PASS` |
| **CUST-07** | **Arrival Verification** | Technician reaches $\le 300\text{m}$ geofence. | Customer UI displays *"Technician Arrived"* banner and displays the 6-digit Work Start OTP to share. | Customer OTP clearly visible with copy/readout capability. | `PASS` |
| **CUST-08** | **Service Completion & Privacy** | Technician completes service and payment is settled. | Live tracking session terminated; technician coordinates masked to `null`. | Customer sees completion summary; technician location no longer trackable. | `PASS` |

---

### C. Concurrency & Race Conditions

| Test ID | Test Scenario | Execution Steps | Expected System Behavior | Verification Criteria | Status |
|---|---|---|---|---|---|
| **RACE-01** | **Simultaneous Job Acceptance** | Tech A and Tech B click "Accept Offer" simultaneously for same booking. | DB row locking serializes requests: Tech A receives HTTP 200 (Winner), Tech B receives HTTP 409 (Conflict). | Tech B UI shows *"Job No Longer Available"*; zero double assignments. | `PASS` |
| **RACE-02** | **Stale Accept Button Click** | Tech clicks "Accept" after offer expired or was accepted by another employee. | Server returns HTTP 409 `JOB_ALREADY_ACCEPTED`. | Prevents stale client cache from corrupting job state. | `PASS` |
| **RACE-03** | **Duplicate Location Updates** | Rapid repeated POSTs to `/workforce/presence/location/` within 500ms. | Server updates latest snapshot; throttles `JobLocationPoint` persistence (min 20m / 30s). | Zero duplicate history points; DB write volume controlled. | `PASS` |
| **RACE-04** | **Out-of-Order GPS Telemetry** | Send packet with `captured_at` 60s in the past after fresh packet already received. | Backend compares with `last_known_location.captured_at` and drops out-of-order packet with `ignored: true`. | Stale position does not overwrite fresh live position. | `PASS` |
| **RACE-05** | **SSE Disconnect & Reconnect** | Drop network connection on customer page, then restore after 15 seconds. | Realtime stream reconnects with exponential backoff; fetches fresh REST state to reconcile map. | Stale markers removed, replacement technician restored if redispatched. | `PASS` |
| **RACE-06** | **Cross-Tenant Access Guard** | Customer from Company B attempts to view tracking for Job from Company A. | Server rejects request with HTTP 403 `CROSS_TENANT_FORBIDDEN`. | Strict multi-tenant isolation enforced. | `PASS` |

---

### D. Payment & Cash Collection

| Test ID | Test Scenario | Execution Steps | Expected System Behavior | Verification Criteria | Status |
|---|---|---|---|---|---|
| **PAY-01** | **Online Payment Flow** | Customer selects Online Payment (gateway verified). | Gateway webhook / verification records `JobPayment` in `PAID` status. | Job transitions to `COMPLETED` upon service verification. | `PASS` |
| **PAY-02** | **Cash on Service (Exact Amount)** | Technician collects exact amount (e.g. ₹500 for ₹500 job). | Server verifies collected amount $\ge$ total; change calculated as ₹0.00; marks `PAID`. | Technician reset to `AVAILABLE`; tracking session closed. | `PASS` |
| **PAY-03** | **Cash on Service with Change** | Technician collects ₹1000 for ₹700 job. | Server calculates change as ₹300.00; displays confirmation dialog to return ₹300. | Change amount verified before finalizing payment. | `PASS` |
| **PAY-04** | **Cash Underpayment Rejection** | Technician enters ₹400 for ₹500 job. | Server returns HTTP 400 `UNDERPAYMENT_REJECTED`. | Cannot complete job with partial cash collection without approval. | `PASS` |

---

## 2. Invariant Verification Summary
1. **Single Central Watcher**: Exactly 1 `navigator.geolocation.watchPosition` active at all times.
2. **Authoritative Geofence Arrival**: 300 meters, accuracy $\le$ 200m, 2 consecutive fixes $\ge$ 3s apart.
3. **5-Minute Cancellation Window**: Exact timestamp comparison; blocked in `ARRIVED` or after 5 minutes.
4. **Privacy Guard**: Completed, cancelled, and unassigned jobs mask technician coordinates to `null`.
5. **Multi-Tenant Scoping**: All queries filtered by authenticated user company ID.
