# PHYSICAL RAPIDO / SWIGGY LIVE TRACKING ACCEPTANCE PROTOCOL
## Real-Device Field Verification Checklist

> **IMPORTANT**: Automated test suites confirm backend state machine correctness, atomic transactions, row locking, and database integrity. Full production readiness requires performing this physical two-device field verification.

---

### Hardware Requirements
- **Device A (Technician)**: Android smartphone with Google Chrome / Android PWA, high-accuracy GPS hardware, active SIM data connectivity.
- **Device B (Customer)**: Android or iPhone with mobile browser, active network connection.

---

### Test Scenario: Full Lifecycle Field Execution

#### Step 1: Customer Booking Creation
1. Open Customer App on **Device B**.
2. Create a service booking (e.g. "AC Repair & Maintenance") with destination at actual physical location.
3. Observe booking status: `FINDING PROFESSIONAL`.

#### Step 2: Automatic Geo-Dispatch & Exclusive Offer
1. On **Device A**, technician logs into Workforce App and ensures status is `Online` and `Available`.
2. Technician transmits fresh GPS within 120 seconds.
3. Verify **Device A** receives incoming exclusive modal/banner offer:
   - Job ID, Customer Area, Distance (km), Expiry Countdown (90s).
   - Verify zero admin intervention was needed.

#### Step 3: Job Acceptance & Trip Mode Switch
1. Technician on **Device A** taps **Accept Job**.
2. Verify **Device A** automatically transitions to active **Trip Mode**:
   - `ON THE WAY` banner.
   - Customer destination address.
   - Live Road Map with Google Directions road route (Electric Blue polyline).
   - Driving ETA (e.g. "12 min") and Road Distance (e.g. "3.8 km").
   - Live GPS Accuracy badge (`GPS ±8m`) and Freshness indicator (`● LIVE`).
   - "Navigate ↗" button opening Google Maps turn-by-turn navigation.

#### Step 4: Real-Time Customer Live Tracking (Zero F5)
1. On **Device B**, customer opens the live tracking screen for the booking.
2. Verify **Device B** displays:
   - "Professional is on the way".
   - Electric Blue Vehicle marker moving smoothly along the road.
   - Real road driving route to customer site marker (Red pin).
   - Driving ETA and remaining distance matching backend telemetry.
   - Freshness badge (`● LIVE`).
3. As technician on **Device A** physically travels on the road:
   - Verify vehicle marker on **Device B** animates smoothly without teleporting or jumping.
   - Verify customer map does NOT reload or flash.
   - Verify directions route recalculates gracefully when technician moves >30m.

#### Step 5: Network Interruption Resilience
1. On **Device A**, temporarily enable Airplane mode for 30 seconds, then disable it.
   - Verify **Device B** transitions freshness badge from `● LIVE` $\rightarrow$ `⚠ DELAYED` $\rightarrow$ `⚠ STALE` $\rightarrow$ `✕ LOCATION LOST` ("Location temporarily unavailable").
   - When network resumes on **Device A**, verify latest telemetry streams seamlessly and tracking resumes without refreshing **Device B**.
2. On **Device B**, refresh the browser tab:
   - Verify page reload restores authoritative trip state and resumes live tracking.

#### Step 6: Automatic Consecutive-Fix Arrival (Zero Manual Clicks)
1. Technician on **Device A** arrives within 300m of the customer destination.
2. Device sends Fix #1 inside 300m perimeter $\rightarrow$ records 1/2 arrival fixes.
3. After $\ge 3$ seconds, Device sends Fix #2 inside 300m perimeter $\rightarrow$ confirms arrival.
4. Verify:
   - **Device A** automatically displays: `🟢 ARRIVAL VERIFIED — Enter Customer Work Start OTP`.
   - **Device B** receives customer notification: `Technician Arrived — Work Start OTP: [XXXXXX]`.
   - Verify NO manual arrival button exists on either device.

#### Step 7: Work Start OTP Verification
1. Customer on **Device B** shares 6-digit OTP code with Technician on **Device A**.
2. Technician enters OTP into the Work Start modal.
3. Verify invalid OTP is rejected with remaining attempts counter.
4. Verify correct OTP unlocks Pre-Service Evidence stage.

#### Step 8: Pre-Service Evidence & Geofenced Clock-In
1. Technician on **Device A** captures 3 mandatory pre-service photos:
   - Technician Presence Photo.
   - Appliance Before Photo.
   - Work Area Photo.
2. Technician taps **Clock In & Start Work**.
3. Backend validates GPS coordinates are within 300m of customer site.
4. Shift timer starts; job status transitions to `IN_PROGRESS`.
5. Verify **Device B** updates customer status to: `SERVICE IN PROGRESS`.

#### Step 9: Job Completion & Privacy Masking
1. Technician completes service and submits clock-out.
2. Job transitions to `COMPLETED`.
3. Verify on **Device B**:
   - Customer status updates to: `SERVICE COMPLETED`.
   - Live technician GPS coordinates immediately return `null` (live location exposure ceases).

---

### Field Acceptance Sign-Off Matrix

| Checkpoint | Expected Behavior | Field Verification (Yes/No) |
|---|---|---|
| Automatic Dispatch | Dispatches nearest technician within 50km without admin action | [ ] |
| Centralized GPS | Single `watchPosition` watcher active on Device A | [ ] |
| Smooth Vehicle Marker | Marker interpolates smoothly without teleporting | [ ] |
| Road Routing & ETA | Real Google Directions route and driving ETA rendered | [ ] |
| Freshness UX | Accurately indicates LIVE / UPDATING / DELAYED / STALE | [ ] |
| Automatic Arrival | 2 valid fixes $\le 300\text{m}$ trigger arrival automatically | [ ] |
| Zero Manual Arrival | Zero manual arrival buttons found across UI | [ ] |
| Single-Use OTP | 6-digit random code generated once and verified securely | [ ] |
| Evidence Gate | 3 pre-service photos required before clock-in | [ ] |
| Post-Completion Privacy | Live GPS masked to null upon job completion | [ ] |
