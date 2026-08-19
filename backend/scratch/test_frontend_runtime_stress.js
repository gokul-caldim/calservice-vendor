/**
 * test_frontend_runtime_stress.js
 *
 * Comprehensive runtime simulation and stress test verifying:
 * 1. Notification Deduplication (Historical seeding, duplicate rejection, single new alert)
 * 2. Stale Response Protection (Generation counter / sequence ordering)
 * 3. API Failure Resilience (Transient 500/network error preserves cached jobs)
 * 4. Single-Flight Request Coalescing (Concurrent callers share 1 Promise)
 * 5. Realtime Debounce & Coalesced Sync
 * 6. Separate Presence & GPS State Transitions (OFFLINE -> CONNECTING -> ONLINE_LOCATION_PENDING -> ONLINE_GPS_LIVE)
 */

const assert = require('assert');

// Mock Notification API
let notificationCallCount = 0;
const notificationHistory = [];
global.Notification = class {
  static permission = 'granted';
  static requestPermission() {
    return Promise.resolve('granted');
  }
  constructor(title, options) {
    notificationCallCount++;
    notificationHistory.push({ title, options });
  }
};

class SimulatedEmployeeRuntime {
  constructor() {
    this.activeJobs = [];
    this.completedJobs = [];
    this.presenceState = 'OFFLINE'; // 'OFFLINE' | 'CONNECTING' | 'ONLINE_LOCATION_PENDING' | 'ONLINE_GPS_LIVE'
    this.knownOfferIds = new Set();
    this.isInitialOffersLoaded = false;
    this.fetchGeneration = 0;
    this.inFlightActiveJobsPromise = null;
    this.apiCallCount = 0;
    this.jobsError = null;
    this.debounceTimer = null;
  }

  get isOnline() {
    return this.presenceState !== 'OFFLINE' && this.presenceState !== 'CONNECTING';
  }

  get isGpsLive() {
    return this.presenceState === 'ONLINE_GPS_LIVE';
  }

  triggerOfferBrowserNotification(offeredJob) {
    if (!offeredJob) return;
    const offerId = offeredJob.active_offer?.id || offeredJob.offer_id || `job_${offeredJob.id}`;
    if (this.knownOfferIds.has(offerId)) {
      return;
    }
    this.knownOfferIds.add(offerId);

    if (global.Notification && global.Notification.permission === 'granted') {
      new global.Notification('⚡ New Exclusive Job Offer!', {
        body: `Job #${offeredJob.id}: ${offeredJob.service_title || 'Service Request'}.`,
        tag: `offer_${offerId}`,
      });
    }
  }

  async refreshActiveJobs(apiMockFn, options = {}) {
    const force = options?.force === true;

    // 1. Single-Flight Request Coalescing
    if (this.inFlightActiveJobsPromise && !force) {
      return this.inFlightActiveJobsPromise;
    }

    const currentGen = ++this.fetchGeneration;

    const fetchPromise = (async () => {
      this.apiCallCount++;
      try {
        const jobsData = await apiMockFn();

        // 2. Stale Response Protection
        if (currentGen < this.fetchGeneration) {
          return this.activeJobs;
        }

        if (Array.isArray(jobsData)) {
          this.activeJobs = jobsData;
          this.jobsError = null;

          // 3. Notification Deduplication & Initial Seeding
          const currentOffer = jobsData.find(
            (j) => (j.is_offer === true || j.active_offer?.status === 'OFFERED')
          );

          if (currentOffer) {
            const offerId = currentOffer.active_offer?.id || currentOffer.offer_id || `job_${currentOffer.id}`;
            if (!this.isInitialOffersLoaded) {
              this.knownOfferIds.add(offerId);
              this.isInitialOffersLoaded = true;
            } else {
              this.triggerOfferBrowserNotification(currentOffer);
            }
          } else {
            this.isInitialOffersLoaded = true;
          }
          return jobsData;
        }
        return this.activeJobs;
      } catch (err) {
        // 4. API Failure Resilience (Preserve cached data on error!)
        this.jobsError = err.message || 'API Error';
        return this.activeJobs;
      } finally {
        this.inFlightActiveJobsPromise = null;
      }
    })();

    this.inFlightActiveJobsPromise = fetchPromise;
    return fetchPromise;
  }

  scheduleCoalescedRefresh(apiMockFn, delayMs = 50) {
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(async () => {
        const res = await this.refreshActiveJobs(apiMockFn, { silent: true });
        resolve(res);
      }, delayMs);
    });
  }

  async togglePresence(desiredState, apiToggleFn, getGpsFn) {
    this.presenceState = 'CONNECTING';
    const res = await apiToggleFn(desiredState);
    if (res.is_online) {
      this.presenceState = 'ONLINE_LOCATION_PENDING';
      // Asynchronous background GPS acquisition
      getGpsFn().then((pos) => {
        this.presenceState = 'ONLINE_GPS_LIVE';
      }).catch(() => {});
    } else {
      this.presenceState = 'OFFLINE';
    }
    return res;
  }
}

async function runFrontendStressVerification() {
  console.log('='.repeat(80));
  console.log('CALTRACK WORKFORCE - FRONTEND RUNTIME STRESS & LOGIC VERIFICATION');
  console.log('='.repeat(80));

  const runtime = new SimulatedEmployeeRuntime();

  // ── TEST 1: Notification Deduplication & Historical Seeding ──────────────
  console.log('\n--- Test 1: Notification Deduplication & Historical Seeding ---');
  notificationCallCount = 0;
  notificationHistory.length = 0;

  // Step 1: Initial mount with existing historical offer #501
  await runtime.refreshActiveJobs(async () => [
    { id: 101, is_offer: true, active_offer: { id: 501, status: 'OFFERED' } }
  ]);
  assert.strictEqual(notificationCallCount, 0, 'Historical offer should NOT trigger notification on initial mount!');
  console.log('  [PASS] Initial mount seeded historical offer #501 (0 browser alerts fired).');

  // Step 2: Re-fetch same offer 5 times (simulating polling/navigation)
  for (let i = 0; i < 5; i++) {
    await runtime.refreshActiveJobs(async () => [
      { id: 101, is_offer: true, active_offer: { id: 501, status: 'OFFERED' } }
    ], { force: true });
  }
  assert.strictEqual(notificationCallCount, 0, 'Repeated syncs of same offer should NOT trigger duplicate notifications!');
  console.log('  [PASS] 5 repeated syncs of same offer #501 produced 0 duplicate alerts.');

  // Step 3: Genuinely new offer #502 arrives
  await runtime.refreshActiveJobs(async () => [
    { id: 102, is_offer: true, active_offer: { id: 502, status: 'OFFERED' } }
  ], { force: true });
  assert.strictEqual(notificationCallCount, 1, 'New offer should trigger exactly 1 browser notification!');
  console.log('  [PASS] Genuinely new offer #502 triggered exactly 1 browser notification.');

  // Step 4: Duplicate realtime event for offer #502
  runtime.triggerOfferBrowserNotification({ id: 102, active_offer: { id: 502, status: 'OFFERED' } });
  assert.strictEqual(notificationCallCount, 1, 'Duplicate realtime event must not trigger second alert!');
  console.log('  [PASS] Duplicate realtime trigger for #502 rejected (notification count remains 1).');

  // ── TEST 2: Single-Flight Request Coalescing ─────────────────────────────
  console.log('\n--- Test 2: Single-Flight Request Coalescing ---');
  const startCalls = runtime.apiCallCount;
  const mockApiDelayed = () => new Promise((resolve) => setTimeout(() => resolve([{ id: 1, status: 'assigned' }]), 40));

  // Launch 5 concurrent calls simultaneously
  const results = await Promise.all([
    runtime.refreshActiveJobs(mockApiDelayed),
    runtime.refreshActiveJobs(mockApiDelayed),
    runtime.refreshActiveJobs(mockApiDelayed),
    runtime.refreshActiveJobs(mockApiDelayed),
    runtime.refreshActiveJobs(mockApiDelayed),
  ]);

  const callsMade = runtime.apiCallCount - startCalls;
  assert.strictEqual(callsMade, 1, `Expected 1 HTTP call for 5 concurrent triggers, but got ${callsMade}!`);
  assert.strictEqual(results.length, 5);
  console.log(`  [PASS] 5 concurrent refresh triggers coalesced into exactly ${callsMade} API request.`);

  // ── TEST 3: Stale Response Protection (Out-of-Order Handling) ─────────────
  console.log('\n--- Test 3: Stale Response Protection (Out-of-Order Sequence) ---');
  runtime.activeJobs = [{ id: 99, status: 'initial' }];

  // Request A (starts first, resolves late with old data)
  const reqA = runtime.refreshActiveJobs(
    () => new Promise((resolve) => setTimeout(() => resolve([{ id: 99, status: 'stale_response_A' }]), 80)),
    { force: true }
  );

  // Request B (starts second, resolves fast with new authoritative data)
  const reqB = runtime.refreshActiveJobs(
    () => new Promise((resolve) => setTimeout(() => resolve([{ id: 99, status: 'authoritative_response_B' }]), 20)),
    { force: true }
  );

  await Promise.all([reqA, reqB]);
  assert.strictEqual(runtime.activeJobs[0].status, 'authoritative_response_B', 'Stale Request A overwrote newer Request B!');
  console.log('  [PASS] Request A (slow) discarded; Request B (authoritative) preserved in cache.');

  // ── TEST 4: API Failure Resilience (Stale-While-Revalidate Error Fallback) ─
  console.log('\n--- Test 4: API Failure Resilience (Preserve Last Known State) ---');
  runtime.activeJobs = [{ id: 101, status: 'in_progress', service_title: 'AC Servicing' }];

  // Simulate network 500 error
  await runtime.refreshActiveJobs(async () => {
    throw new Error('500 Internal Server Error / Network Timeout');
  }, { force: true });

  assert.strictEqual(runtime.activeJobs.length, 1, 'Active jobs wiped on error!');
  assert.strictEqual(runtime.activeJobs[0].id, 101, 'Active job corrupted on error!');
  assert.strictEqual(runtime.jobsError, '500 Internal Server Error / Network Timeout');
  console.log('  [PASS] Transient 500 error preserved last valid active jobs cache without empty flash.');

  // ── TEST 5: Realtime Debounce & Event Coalescing ──────────────────────────
  console.log('\n--- Test 5: Realtime Debounce & Event Coalescing ---');
  const preDebounceCalls = runtime.apiCallCount;
  const mockApiFast = () => Promise.resolve([{ id: 1, status: 'assigned' }]);

  // Simulate 5 rapid realtime events within 10ms
  runtime.scheduleCoalescedRefresh(mockApiFast, 30);
  runtime.scheduleCoalescedRefresh(mockApiFast, 30);
  runtime.scheduleCoalescedRefresh(mockApiFast, 30);
  runtime.scheduleCoalescedRefresh(mockApiFast, 30);
  await runtime.scheduleCoalescedRefresh(mockApiFast, 30);

  const debounceCallsMade = runtime.apiCallCount - preDebounceCalls;
  assert.strictEqual(debounceCallsMade, 1, `Expected 1 debounced call, got ${debounceCallsMade}!`);
  console.log(`  [PASS] 5 rapid realtime events coalesced into exactly ${debounceCallsMade} API reconciliation.`);

  // ── TEST 6: Presence & Staged Fast GPS State Machine ─────────────────────
  console.log('\n--- Test 6: Separate Presence & GPS State Transitions ---');
  runtime.presenceState = 'OFFLINE';

  const mockApiToggle = async (desired) => ({ is_online: desired });
  let gpsResolved = false;
  const mockGetGps = () => new Promise((resolve) => {
    setTimeout(() => {
      gpsResolved = true;
      resolve({ coords: { latitude: 12.9716, longitude: 77.5946 } });
    }, 40);
  });

  const togglePromise = runtime.togglePresence(true, mockApiToggle, mockGetGps);
  await togglePromise;

  // Immediately after presence API returns:
  assert.strictEqual(runtime.presenceState, 'ONLINE_LOCATION_PENDING', 'Presence must transition to ONLINE_LOCATION_PENDING immediately without waiting for GPS!');
  assert.strictEqual(runtime.isOnline, true);
  assert.strictEqual(runtime.isGpsLive, false);
  console.log('  [PASS] Online presence established immediately (ONLINE_LOCATION_PENDING).');

  // Wait for GPS fix to arrive
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(runtime.presenceState, 'ONLINE_GPS_LIVE', 'State must transition to ONLINE_GPS_LIVE once GPS fix arrives!');
  assert.strictEqual(runtime.isGpsLive, true);
  console.log('  [PASS] GPS fix resolved asynchronously (ONLINE_GPS_LIVE).');

  console.log('\n' + '='.repeat(80));
  console.log('ALL FRONTEND RUNTIME STRESS TESTS PASSED (100%)!');
  console.log('='.repeat(80));
}

runFrontendStressVerification().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
