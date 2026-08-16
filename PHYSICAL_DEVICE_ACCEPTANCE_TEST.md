# WORKFORCE — PHYSICAL MOBILE DEVICE GPS FIELD VERIFICATION PROTOCOL

> **Target Environment**: Physical Mobile Device (Android Chrome / iOS Safari / Capacitor Mobile Wrapper)  
> **Backend Authority**: Shared PostgreSQL via Django Workforce API  
> **Rule Baseline**: Zero Admin Intervention · Zero Manual Arrival Button · Single GPS Stream

---

## 1. ARCHITECTURAL SINGLETON GPS STREAM VERIFICATION

Before heading into the field, verify that the application maintains **exactly ONE** active GPS stream per session:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EMPLOYEE MOBILE DEVICE                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [ ONLINE ] ──────────────────► useLocationTracker()                  │
│                                       │ (SINGLE watchPosition)         │
│   [ Current Location Button ] ────────┼──► ONE getGPSPosition(true)    │
│                                       │    (0 new watchers)            │
│   [ JobTrackingMap Component ] ───────┴──► Consumes Event Bus / Props  │
│                                            (0 new watchers)            │
│                                       │                                │
│                                       ▼                                │
│                          POST /presence/location/                      │
│                                       │                                │
│                                       ▼                                │
│                           User.last_known_location                     │
│                                       │                                │
│                 ┌─────────────────────┴─────────────────────┐          │
│                 ▼                                           ▼          │
│         Distance > 300m                             Distance ≤ 300m    │
│       [ Status: EN ROUTE ]                        [ AUTO-ARRIVAL ]     │
│   (Approaching Telemetry)                                   │          │
│                                                             ▼          │
│                                                    1. Status: ARRIVED  │
│                                                    2. Generate OTP     │
│                                                    3. Notify Customer  │
│                                                             │          │
│                                                             ▼          │
│                                                     Customer Provides  │
│                                                          6-Digit OTP   │
│                                                             │          │
│                                                             ▼          │
│                                                      Upload 3 Photos   │
│                                                             │          │
│                                                             ▼          │
│                                                      Shift Clock-In    │
│                                                    (TimeLog: OPEN)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STEP-BY-STEP TWO-DEVICE FIELD EXECUTION CHECKLIST

### Device Setup
- **Device A (Customer)**: Laptop, Tablet, or Secondary Phone running Customer App (`http://<server-ip>:5173`).
- **Device B (Technician)**: Physical Smartphone with Hardware GPS & Cellular Data running Workforce App (`http://<server-ip>:5176` or Capacitor App).

---

### Step 1: Employee Registration & Online Status
1. On **Device B**, log into the Employee Dashboard.
2. Ensure toggle is set to **`[ 🟢 ONLINE ]`**.
3. Accept browser/app permission prompt: `"Allow Workforce to access this device's location"`.
4. Tap **`[ ◎ Current Location ]`** in header $\rightarrow$ Coordinates and accuracy appear (e.g. `📍 12.9716, 77.5946 (±4m)`).
5. Verify in browser console / network log: Only **1** `watchPosition` is active.

---

### Step 2: Customer Creates Booking
1. On **Device A**, customer books a service at a specific address (e.g. `Indiranagar 100ft Road`).
2. Booking is written directly to shared PostgreSQL as `unassigned`.
3. **ZERO ADMIN INTERVENTION**: Do not touch the Admin portal.

---

### Step 3: Automatic Discovery & Exclusive Job Offer
1. Within 5 seconds, the backend engine reconciles the job against nearest eligible online technicians.
2. On **Device B**, technician hears/receives a notification:  
   `"New Job Offer Available! Indiranagar 100ft Road (1.2 km away)"`.
3. Job card appears at top of queue with a 5-minute acceptance countdown.

---

### Step 4: Technician Accepts Job
1. On **Device B**, tap **`[ ACCEPT JOB ]`**.
2. ServiceRequest atomically transitions to `accepted`.
3. The interactive **`Customer Location & Live Tracking`** map renders:
   - **Blue Pin**: Technician's real-time mobile GPS location.
   - **Red Pin**: Customer destination address.
   - **Green Circle**: 300m Geofence arrival zone.
   - **Proximity Line**: Live distance counter (e.g., `1.2 km away`).
   - **`[ 🧭 Navigate ↗ ]`**: Ready to launch Google Maps turn-by-turn navigation.

---

### Step 5: Field Transit & Dynamic GPS Telemetry
1. Technician starts moving physically toward the customer site:
   - At **> 1 km**: Map telemetry displays `En route (1.2 km away)`.
   - At **500 m**: Map telemetry displays `Approaching customer (500 m away)`.
   - At **301 m**: Map telemetry displays `Approaching customer (301 m away)`.
2. Observe:
   - Status remains `accepted` / `en_route`.
   - Pre-service checklist indicates `GPS PENDING (≤300m)`.
   - **NO ARRIVAL BUTTON EXISTS** on the screen.

---

### Step 6: Crossing the 300m Geofence Boundary (299m)
1. As the technician crosses within **$\le 300$ meters** (e.g., 280m or 150m at customer doorstep):
2. Mobile GPS sends `POST /presence/location/`.
3. **Backend Automatically Executes**:
   - `ServiceRequest.status` $\rightarrow$ `arrived`
   - `EmployeeJob.status` $\rightarrow$ `ARRIVED`
   - `PreServiceVerification.geofence_passed` $\rightarrow$ `True`
   - Random 6-digit Work-Start OTP generated (e.g., `582914`).
   - Customer notification created with the OTP.
4. **On Device B (Technician)** without pressing any button or refreshing:
   - Map header switches to **`🟢 ARRIVAL VERIFIED`**.
   - Step 1 shows **`✓ ARRIVAL VERIFIED`**.
   - Step 2 automatically unlocks: **`Work Start OTP Required`** with `[ _ _ _ _ _ _ ]` input.

---

### Step 7: Customer Provides OTP & Technician Verifies
1. On **Device A (Customer)**, view the customer notification/booking view containing the OTP (e.g., `582914`).
2. Technician on **Device B** asks the customer for the code and types `582914` into the input.
3. Tap **`[ Verify OTP ]`**.
4. OTP verified indicator displays: `Verified ✓`.

---

### Step 8: Pre-Service Evidence Photos Gate
1. Step 3 prompts for 3 mandatory photos:
   - **Presence Photo**: Technician at site / door.
   - **Appliance Photo**: Equipment condition prior to service.
   - **Work Area Photo**: Site surroundings.
2. Tap each camera button to take/upload photos.
3. Status changes to: **`PRE-SERVICE VERIFIED ✓`**.

---

### Step 9: Clock-In & Work Start
1. The **`[ START WORK (CLOCK IN) ]`** button is now active.
2. Tap **`[ START WORK ]`**.
3. Backend validates all 4 conditions (Geofence + OTP + 3 Photos + Fresh GPS).
4. Results:
   - `TimeLog` status: `OPEN` (`draft`).
   - `ServiceRequest.status`: `in_progress`.
   - `EmployeeJob.status`: `IN_PROGRESS`.
   - Map switches to **`⚡ WORK IN PROGRESS`**.

---

## 3. AUDIT & LOG VERIFICATION MATRIX

| Metric | Verification Method | Expected Value |
|---|---|---|
| Active Watchers | `console.log(window._activeGpsWatchers)` | Exactly **1** |
| Location Freshness | Check `updated_at` on DB `User.last_known_location` | $\le 60$ seconds |
| Geofence Radius | Visual circle on Google Map & Backend `haversine_distance` | $\le 300.0$ meters |
| Premature Clock-In | Attempt Clock-In at $>300$m or without OTP | Rejected with `HTTP 400` |
| Manual Arrival Action | Inspect UI elements & network requests | Zero manual arrival buttons |
| Admin Actions | Audit database `log_entry` table | Zero manual Admin dispatch/arrival entries |
