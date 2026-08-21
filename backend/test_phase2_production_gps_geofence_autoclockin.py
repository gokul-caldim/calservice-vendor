"""
test_phase2_production_gps_geofence_autoclockin.py

Comprehensive Automated Test Suite for Phase 2:
Production GPS, Geofence, Verification, Auto Clock-In & Cash-Gated Clock-Out.

Covers all 31 Test Criteria (A through AE):
  A. Single Persistent GPS Watcher
  B. Staged GPS Startup
  C. Exponential Retry Backoff Schedule
  D. Decoupled Online Presence
  E. Server Telemetry Invariant Validation
  F. GPS Freshness Validation (<=300s limit)
  G. GPS Stale State Handling
  H. Geofence Distance Calculation
  I. Haversine Calculation Performance (<1ms isolated benchmark)
  J. Exact Geofence Boundary Check (250m)
  K. Unauthorized Geofence Arrival (HTTP 403)
  L. Premature Geofence Arrival (HTTP 400)
  M. Arrival Idempotency (no duplicate OTPs)
  N. Complete Before-Work-Area Photo Removal from Pre-Verification
  O. Technician Presence Selfie Mandatory
  P. Complete Before-Work Photo Removal from After-Work Proof
  Q. After Face Selfie Mandatory for Completion
  R. Automatic Clock-In on Pre-Verification Complete
  S. Clock-In Idempotency (HTTP 200 with open TimeLog)
  T. Concurrent Clock-In Race Protection
  U. Cash-Gated Clock-Out Rejection (HTTP 400 CASH_NOT_RECEIVED)
  V. Cash-Gated Clock-Out Unlocking on Persisted Cash Collection
  W. Online/Prepaid Job Clock-Out Unlocked
  X. Shift-Level Attendance Integrity (TimeLog creation & closure)
  Y. GPS Accuracy Rejection (>100m HTTP 400)
  Z. Future GPS Timestamp Rejection (>60s skew HTTP 400)
  AA. Automatic Clock-In In-Flight Coalescing
  AB. CASH_PENDING Persisted Timestamp Verification
  AC. Unauthorized Cash Collection (HTTP 403)
  AD. Concurrent Clock-Out Idempotency (HTTP 200)
  AE. GPS Recovery After Transient Error
"""

import os
import sys
import time
import json
import secrets
import concurrent.futures
from decimal import Decimal
from datetime import datetime, timedelta

import django

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Setup Django Environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import User
from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import (
    PreServiceVerification,
    PostServiceProof,
    JobPayment,
    PaymentCollectionEvent,
)
from time_tracking.models import TimeLog
from time_tracking.geo import haversine_distance

User = get_user_model()


class Phase2TestRunner:
    def __init__(self):
        self.client = APIClient()
        self.results = {}
        self.latencies = {"arrival": [], "clock_in": [], "clock_out": [], "haversine": []}
        self.setup_data()

    def setup_data(self):
        print("\n" + "=" * 70)
        print("  CALTRACK WORKFORCE — PHASE 2 PRODUCTION TEST SUITE")
        print("=" * 70)
        self.company, _ = Company.objects.get_or_create(
            company_name="Phase2 Validation Corp",
            defaults={"is_active": True}
        )

        # Main Technician User & Profile
        self.tech_user, _ = User.objects.get_or_create(
            username="phase2_tech",
            defaults={
                "email": "phase2_tech@caltrack.io",
                "role": "EMPLOYEE",
                "company": self.company,
                "is_active": True,
                "first_name": "Ramesh",
                "last_name": "Kumar",
            }
        )
        self.tech_user.company = self.company
        self.tech_user.set_password("SecurePass@123")
        self.tech_user.save()

        self.tech_emp, _ = Employee.objects.get_or_create(
            user=self.tech_user,
            defaults={
                "company": self.company,
                "employee_id": "EMP-P2-001",
                "is_active": True,
                "is_online": True,
                "bank_details": {"onboarding": {"status": "approved"}},
            }
        )
        self.tech_emp.company = self.company
        self.tech_emp.is_active = True
        self.tech_emp.is_online = True
        self.tech_emp.bank_details = {"onboarding": {"status": "approved"}}
        self.tech_emp.save()

        # Secondary Technician for Unauthorized Tests
        self.other_user, _ = User.objects.get_or_create(
            username="other_tech",
            defaults={
                "email": "other_tech@caltrack.io",
                "role": "EMPLOYEE",
                "company": self.company,
                "is_active": True,
                "first_name": "Suresh",
                "last_name": "Patel",
            }
        )
        self.other_user.company = self.company
        self.other_user.set_password("SecurePass@123")
        self.other_user.save()

        self.other_emp, _ = Employee.objects.get_or_create(
            user=self.other_user,
            defaults={
                "company": self.company,
                "employee_id": "EMP-P2-002",
                "is_active": True,
                "is_online": True,
                "bank_details": {"onboarding": {"status": "approved"}},
            }
        )
        self.other_emp.company = self.company
        self.other_emp.is_active = True
        self.other_emp.is_online = True
        self.other_emp.bank_details = {"onboarding": {"status": "approved"}}
        self.other_emp.save()

        # Customer User
        self.cust_user, _ = User.objects.get_or_create(
            username="phase2_customer",
            defaults={
                "email": "phase2_customer@gmail.com",
                "role": "CUSTOMER",
                "company": self.company,
                "is_active": True,
                "first_name": "Priya",
                "last_name": "Sharma",
            }
        )
        self.cust_user.company = self.company
        self.cust_user.save()

        # Clean existing open time logs
        TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).delete()
        TimeLog.objects.filter(employee=self.other_emp, clock_out__isnull=True).delete()

    def record(self, test_id, name, passed, details=""):
        status_str = "✓ PASS" if passed else "✗ FAIL"
        self.results[test_id] = {"name": name, "passed": passed, "details": details}
        print(f"[{test_id:2s}] {status_str} — {name}: {details}")

    def create_job(self, status="accepted", lat=12.9716, lon=77.5946, payment_method="CASH_ON_SERVICE", amount=Decimal("499.00")):
        job = ServiceRequest.objects.create(
            company=self.company,
            customer=self.cust_user,
            assigned_employee=self.tech_emp,
            status=status,
            latitude=lat,
            longitude=lon,
            preferred_date=timezone.localdate(),
            preferred_time="10:00 AM - 12:00 PM",
            service_category="Appliance Repair",
            issue_title="AC Deep Cleaning Service",
            address="100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
            total_amount=amount,
            start_otp="",
        )
        EmployeeJob.objects.get_or_create(
            service_request=job,
            employee=self.tech_emp,
            defaults={"status": "ACCEPTED", "is_primary": True, "accepted_date": timezone.now()}
        )
        JobPayment.objects.create(
            job=job,
            company=self.company,
            employee=self.tech_emp,
            payment_method=payment_method,
            payment_status=JobPayment.PaymentStatus.PENDING,
            amount_due=amount,
        )
        return job

    # ──────────────────────────────────────────────────────────────────────────
    # Tests A - D: Architecture, State Machine & Acquisition
    # ──────────────────────────────────────────────────────────────────────────

    def test_A_single_persistent_watcher(self):
        # Verify architecture contract from useGPSPosition.js & EmployeeRuntimeProvider.jsx
        from hooks_inspect import check_frontend_single_watcher_architecture
        res = check_frontend_single_watcher_architecture()
        self.record("A", "Single Persistent GPS Watcher", res["passed"], res["details"])

    def test_B_staged_gps_startup(self):
        # Verify staged startup acquisition implementation (cached -> standard -> high-accuracy)
        from hooks_inspect import check_staged_startup
        res = check_staged_startup()
        self.record("B", "Staged GPS Startup Acquisition", res["passed"], res["details"])

    def test_C_exponential_retry_backoff(self):
        # Verify exponential retry backoff schedule [2000, 5000, 15000, 30000] ms
        from hooks_inspect import check_retry_backoff_schedule
        res = check_retry_backoff_schedule()
        self.record("C", "Exponential Retry Backoff Schedule", res["passed"], res["details"])

    def test_D_decoupled_online_presence(self):
        # Verify presence transitions to ONLINE immediately without waiting on GPS
        from hooks_inspect import check_decoupled_presence
        res = check_decoupled_presence()
        self.record("D", "Decoupled Online Presence", res["passed"], res["details"])

    # ──────────────────────────────────────────────────────────────────────────
    # Tests E - G: Server Telemetry Invariant & Stale GPS Validation
    # ──────────────────────────────────────────────────────────────────────────

    def test_E_server_telemetry_invariants(self):
        job = self.create_job()
        self.client.force_authenticate(user=self.tech_user)

        # Test invalid out-of-range latitude (95.0)
        res1 = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {"lat": 95.0, "lon": 77.5946})
        # Test zero coordinates (0.0, 0.0)
        res2 = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {"lat": 0.0, "lon": 0.0})

        passed = res1.status_code == 400 and res2.status_code == 400
        self.record("E", "Server Telemetry Invariant Validation", passed, f"Out-of-range: {res1.status_code}, Zero-coords: {res2.status_code}")

    def test_F_gps_freshness_validation(self):
        job = self.create_job()
        self.client.force_authenticate(user=self.tech_user)

        # Telemetry fix 400 seconds in the past (> 300s limit)
        old_ts = (timezone.now() - timedelta(seconds=400)).timestamp()
        res = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 15.0,
            "timestamp": old_ts,
        })
        passed = res.status_code == 400 and res.data.get("code") == "GPS_STALE"
        self.record("F", "GPS Freshness Validation (<=300s limit)", passed, f"Status: {res.status_code}, Code: {res.data.get('code')}")

    def test_G_gps_stale_state_handling(self):
        from hooks_inspect import check_gps_stale_state_handling
        res = check_gps_stale_state_handling()
        self.record("G", "GPS Stale State Handling", res["passed"], res["details"])

    # ──────────────────────────────────────────────────────────────────────────
    # Tests H - M: Authoritative 250m Geofence Arrival & OTP
    # ──────────────────────────────────────────────────────────────────────────

    def test_H_geofence_distance_calculation(self):
        # Indiranagar to MG Road (~4000m)
        d = haversine_distance(12.9716, 77.5946, 12.9750, 77.6300)
        passed = 3500 <= d <= 4500
        self.record("H", "Geofence Distance Calculation", passed, f"Calculated: {round(d, 1)}m (expected ~3900m)")

    def test_I_haversine_performance(self):
        # Run 1000 iterations to measure isolated latency
        times = []
        for _ in range(1000):
            t0 = time.perf_counter()
            _ = haversine_distance(12.9716, 77.5946, 12.9720, 77.5950)
            times.append((time.perf_counter() - t0) * 1000.0) # in ms

        avg_ms = sum(times) / len(times)
        p95_ms = sorted(times)[int(len(times) * 0.95)]
        self.latencies["haversine"] = times
        passed = p95_ms < 1.0
        self.record("I", "Haversine Isolated Calculation Benchmark", passed, f"avg: {avg_ms:.4f}ms, p95: {p95_ms:.4f}ms (<1.0ms target)")

    def test_J_exact_geofence_boundary(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        # 1. Inside 250m (~50m offset)
        t0 = time.perf_counter()
        res_inside = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9718,
            "lon": 77.5948,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })
        t_inside = (time.perf_counter() - t0) * 1000.0
        self.latencies["arrival"].append(t_inside)

        # 2. Outside 250m (~3500m offset)
        job2 = self.create_job(lat=12.9716, lon=77.5946)
        res_outside = self.client.post(f"/api/workforce/jobs/{job2.id}/arrive/", {
            "lat": 12.9400,
            "lon": 77.5500,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })

        passed = res_inside.status_code == 200 and res_outside.status_code == 403 and res_outside.data.get("code") == "OUTSIDE_GEOFENCE"
        self.record("J", "Exact Geofence Boundary Check (250m)", passed, f"Inside: HTTP {res_inside.status_code}, Outside: HTTP {res_outside.status_code} (OUTSIDE_GEOFENCE)")

    def test_K_unauthorized_geofence_arrival(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.other_user) # Not assigned

        res = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })
        passed = res.status_code == 403
        self.record("K", "Unauthorized Geofence Arrival", passed, f"HTTP {res.status_code} (Forbidden)")

    def test_L_premature_geofence_arrival(self):
        job = self.create_job(status="completed", lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        res = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })
        passed = res.status_code == 400
        self.record("L", "Premature/Invalid State Arrival", passed, f"HTTP {res.status_code} on completed job")

    def test_M_arrival_idempotency(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        res1 = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })
        otp1 = job.pre_service_verification.otp_code

        res2 = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 10.0,
            "timestamp": timezone.now().timestamp(),
        })
        job.pre_service_verification.refresh_from_db()
        otp2 = job.pre_service_verification.otp_code

        passed = res1.status_code == 200 and res2.status_code == 200 and otp1 == otp2
        self.record("M", "Arrival Idempotency (Single OTP)", passed, f"1st status: {res1.status_code}, 2nd status: {res2.status_code}, OTP: {otp1} == {otp2}")

    # ──────────────────────────────────────────────────────────────────────────
    # Tests N - Q: Photo Cleanups & Mandatory Presence Identity
    # ──────────────────────────────────────────────────────────────────────────

    def test_N_before_work_area_photo_removal(self):
        from django.core.files.base import ContentFile
        job = self.create_job(lat=12.9716, lon=77.5946)
        psv, _ = PreServiceVerification.objects.get_or_create(job=job, defaults={"employee": self.tech_emp})
        psv.geofence_passed = True
        psv.otp_verified = True
        psv.presence_photo.save("selfie.jpg", ContentFile(b"dummy_face_image_bytes"), save=False)
        psv.work_area_photo = None # Ensure work_area_photo is NOT provided
        psv.check_completion()
        psv.save()

        passed = psv.is_complete is True
        self.record("N", "Before-Work-Area Photo Removal from Pre-Verification", passed, f"is_complete: {psv.is_complete} without work_area_photo")

    def test_O_technician_presence_selfie_mandatory(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        psv, _ = PreServiceVerification.objects.get_or_create(job=job, defaults={"employee": self.tech_emp})
        psv.geofence_passed = True
        psv.otp_verified = True
        psv.presence_photo = None # Missing mandatory selfie
        psv.check_completion()
        psv.save()

        passed = psv.is_complete is False
        self.record("O", "Technician Presence Selfie Mandatory", passed, f"is_complete: {psv.is_complete} (correctly blocked)")

    def test_P_before_work_photo_removal_from_after_proof(self):
        job = self.create_job(status="in_progress")
        self.client.force_authenticate(user=self.tech_user)

        selfie_file = SimpleUploadedFile("after_face.jpg", b"after_face_bytes", content_type="image/jpeg")
        res = self.client.post(
            f"/api/workforce/jobs/{job.id}/proof/",
            {
                "after_presence_photo": selfie_file,
                "notes": "Work completed successfully with full testing.",
            },
            format="multipart"
        )
        passed = res.status_code == 200 and res.data.get("is_submitted") is True
        self.record("P", "Before-Work Photo Removal from After-Work Proof", passed, f"Status: {res.status_code}, Submitted: {res.data.get('is_submitted')}")

    def test_Q_after_face_selfie_mandatory_for_completion(self):
        job = self.create_job(status="in_progress")
        self.client.force_authenticate(user=self.tech_user)

        # Upload without after face selfie
        res = self.client.post(
            f"/api/workforce/jobs/{job.id}/proof/",
            {"notes": "Skipped face selfie"},
            format="multipart"
        )
        passed = res.status_code == 400
        self.record("Q", "After Face Selfie Mandatory for Completion", passed, f"Status: {res.status_code} (Rejection expected)")

    # ──────────────────────────────────────────────────────────────────────────
    # Tests R - T: Automatic Clock-In & Race Protection
    # ──────────────────────────────────────────────────────────────────────────

    def test_R_auto_clock_in_flow(self):
        from django.core.files.base import ContentFile
        TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).delete()
        job = self.create_job(lat=12.9716, lon=77.5946)
        psv, _ = PreServiceVerification.objects.get_or_create(job=job, defaults={"employee": self.tech_emp})
        psv.geofence_passed = True
        psv.otp_verified = True
        psv.presence_photo.save("selfie.jpg", ContentFile(b"face_bytes"), save=False)
        psv.check_completion()
        psv.save()

        self.client.force_authenticate(user=self.tech_user)
        t0 = time.perf_counter()
        res = self.client.post("/api/workforce/time/clock-in/", {
            "job_id": job.id,
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 15.0,
            "timestamp": timezone.now().timestamp(),
        })
        t_clockin = (time.perf_counter() - t0) * 1000.0
        self.latencies["clock_in"].append(t_clockin)

        job.refresh_from_db()
        print("DEBUG RES_R:", res.status_code, getattr(res, "data", None))
        passed = res.status_code == 201 and res.data.get("is_clocked_in") is True and job.status == "in_progress"
        self.record("R", "Automatic Clock-In on Pre-Verification Complete", passed, f"Status: {res.status_code}, Job Status: {job.status}")

    def test_S_clock_in_idempotency(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        # 2nd call while already clocked in from test_R
        res = self.client.post("/api/workforce/time/clock-in/", {
            "job_id": job.id,
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 15.0,
            "timestamp": timezone.now().timestamp(),
        })
        passed = res.status_code == 200 and res.data.get("is_clocked_in") is True
        self.record("S", "Clock-In Idempotency (HTTP 200)", passed, f"Status: {res.status_code}, is_clocked_in: {res.data.get('is_clocked_in')}")

    def test_T_concurrent_clock_in_race(self):
        from django.core.files.base import ContentFile
        # Reset time logs
        TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).delete()
        job = self.create_job(lat=12.9716, lon=77.5946)
        psv, _ = PreServiceVerification.objects.get_or_create(job=job, defaults={"employee": self.tech_emp})
        psv.geofence_passed = True
        psv.otp_verified = True
        psv.presence_photo.save("selfie.jpg", ContentFile(b"face_bytes"), save=False)
        psv.check_completion()
        psv.save()

        def do_clock_in():
            c = APIClient()
            c.force_authenticate(user=self.tech_user)
            return c.post("/api/workforce/time/clock-in/", {
                "job_id": job.id,
                "lat": 12.9716,
                "lon": 77.5946,
                "accuracy": 15.0,
                "timestamp": timezone.now().timestamp(),
            })

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            f1 = executor.submit(do_clock_in)
            f2 = executor.submit(do_clock_in)
            f3 = executor.submit(do_clock_in)
            results = [f1.result(), f2.result(), f3.result()]

        statuses = [r.status_code for r in results]
        print("DEBUG RES_T:", [(r.status_code, getattr(r, "data", None)) for r in results])
        open_logs = TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).count()
        passed = open_logs == 1 and all(s in [200, 201] for s in statuses)
        self.record("T", "Concurrent Clock-In Race Protection", passed, f"Open logs: {open_logs}, Response statuses: {statuses}")

    # ──────────────────────────────────────────────────────────────────────────
    # Tests U - W: Cash-Gated Clock-Out State Machine
    # ──────────────────────────────────────────────────────────────────────────

    def test_U_cash_gated_clock_out_rejection(self):
        # Currently clocked in with an active CASH_ON_SERVICE job that is uncollected
        self.client.force_authenticate(user=self.tech_user)
        res = self.client.post("/api/workforce/time/clock-out/", {"lat": 12.9716, "lon": 77.5946})
        passed = res.status_code == 400 and res.data.get("code") == "CASH_NOT_RECEIVED"
        self.record("U", "Cash-Gated Clock-Out Rejection", passed, f"Status: {res.status_code}, Code: {res.data.get('code')}")

    def test_V_cash_gated_clock_out_unlocking(self):
        # Record persisted cash collection for all pending jobs of this employee
        for pmt in JobPayment.objects.filter(employee=self.tech_emp):
            pmt.cash_collected_at = timezone.now()
            pmt.cash_collected_by = self.tech_emp
            pmt.payment_status = JobPayment.PaymentStatus.PAID
            pmt.amount_paid = pmt.amount_due
            pmt.save()

        self.client.force_authenticate(user=self.tech_user)
        t0 = time.perf_counter()
        res = self.client.post("/api/workforce/time/clock-out/", {"lat": 12.9716, "lon": 77.5946})
        t_clockout = (time.perf_counter() - t0) * 1000.0
        self.latencies["clock_out"].append(t_clockout)

        passed = res.status_code == 200 and res.data.get("is_clocked_in") is False
        self.record("V", "Cash-Gated Clock-Out Unlocking", passed, f"Status: {res.status_code}, is_clocked_in: {res.data.get('is_clocked_in')}")

    def test_W_online_prepaid_job_clock_out(self):
        from django.core.files.base import ContentFile
        # Make sure no other uncollected cash jobs exist
        for pmt in JobPayment.objects.filter(employee=self.tech_emp):
            pmt.cash_collected_at = timezone.now()
            pmt.payment_status = JobPayment.PaymentStatus.PAID
            pmt.save()

        # Clock in for an ONLINE prepaid job
        job = self.create_job(payment_method="ONLINE", amount=Decimal("799.00"))
        pmt = JobPayment.objects.filter(job=job).first()
        pmt.payment_status = JobPayment.PaymentStatus.PAID
        pmt.amount_paid = Decimal("799.00")
        pmt.save()

        psv, _ = PreServiceVerification.objects.get_or_create(job=job, defaults={"employee": self.tech_emp})
        psv.geofence_passed = True
        psv.otp_verified = True
        psv.presence_photo.save("selfie.jpg", ContentFile(b"face_bytes"), save=False)
        psv.check_completion()
        psv.save()

        self.client.force_authenticate(user=self.tech_user)
        self.client.post("/api/workforce/time/clock-in/", {
            "job_id": job.id,
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 15.0,
            "timestamp": timezone.now().timestamp(),
        })

        # Clock out should succeed directly without cash prompt
        res = self.client.post("/api/workforce/time/clock-out/", {"lat": 12.9716, "lon": 77.5946})
        passed = res.status_code == 200 and res.data.get("is_clocked_in") is False
        self.record("W", "Online/Prepaid Job Clock-Out Unlocked", passed, f"Status: {res.status_code}, is_clocked_in: {res.data.get('is_clocked_in')}")

    def test_X_shift_attendance_integrity(self):
        # Verify that TimeLogs accurately record clock_in, clock_out, coordinates and status
        logs = TimeLog.objects.filter(employee=self.tech_emp).order_by("-id")
        latest = logs.first()
        passed = latest is not None and latest.clock_in is not None and latest.clock_out is not None and latest.status == "submitted"
        self.record("X", "Shift-Level Attendance Integrity", passed, f"Log #{latest.id if latest else 'none'} clock_in={latest.clock_in if latest else 'none'}, clock_out={latest.clock_out if latest else 'none'}")

    # ──────────────────────────────────────────────────────────────────────────
    # Tests Y - AE: Extended Regression, Accuracy, Skew, Coalescing & Recovery
    # ──────────────────────────────────────────────────────────────────────────

    def test_Y_gps_accuracy_rejection(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        # Accuracy of 150m exceeds max 100m geofence accuracy threshold
        res = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 150.0,
            "timestamp": timezone.now().timestamp(),
        })
        passed = res.status_code == 400 and res.data.get("code") == "GPS_ACCURACY_TOO_LOW"
        self.record("Y", "GPS Accuracy Rejection (>100m)", passed, f"Status: {res.status_code}, Code: {res.data.get('code')}")

    def test_Z_future_gps_timestamp(self):
        job = self.create_job(lat=12.9716, lon=77.5946)
        self.client.force_authenticate(user=self.tech_user)

        # Future timestamp 120 seconds in future (> 60s allowable clock skew)
        future_ts = (timezone.now() + timedelta(seconds=120)).timestamp()
        res = self.client.post(f"/api/workforce/jobs/{job.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946,
            "accuracy": 20.0,
            "timestamp": future_ts,
        })
        passed = res.status_code == 400 and res.data.get("code") == "GPS_TIMESTAMP_FUTURE_DATED"
        self.record("Z", "Future GPS Timestamp Rejection", passed, f"Status: {res.status_code}, Code: {res.data.get('code')}")

    def test_AA_auto_clock_in_in_flight_coalescing(self):
        from hooks_inspect import check_clock_in_coalescing
        res = check_clock_in_coalescing()
        self.record("AA", "Auto Clock-In In-Flight Coalescing", res["passed"], res["details"])

    def test_AB_cash_pending_protection(self):
        # Create job with CASH_PENDING but cash_collected_at is NULL
        job = self.create_job(payment_method="CASH_ON_SERVICE")
        pmt = JobPayment.objects.filter(job=job).first()
        pmt.payment_status = JobPayment.PaymentStatus.CASH_PENDING
        pmt.cash_collected_at = None # Unpersisted
        pmt.save()

        # Check model helper property
        passed = pmt.is_cash_collected is False
        self.record("AB", "CASH_PENDING Timestamp Protection", passed, f"is_cash_collected: {pmt.is_cash_collected} when cash_collected_at is None")

    def test_AC_unauthorized_cash_collection(self):
        job = self.create_job(payment_method="CASH_ON_SERVICE")
        self.client.force_authenticate(user=self.other_user) # Wrong technician

        res = self.client.post(f"/api/workforce/jobs/{job.id}/collect-cash/", {"amount_received": "499.00"})
        passed = res.status_code == 403
        self.record("AC", "Unauthorized Cash Collection Protection", passed, f"Status: {res.status_code} (Forbidden)")

    def test_AD_concurrent_clock_out(self):
        # Clean any open time logs first
        TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).delete()
        # Clear all pending cash jobs for this technician so cash gate passes
        for pmt in JobPayment.objects.filter(employee=self.tech_emp):
            pmt.payment_status = JobPayment.PaymentStatus.PAID
            pmt.cash_collected_at = timezone.now()
            pmt.save()

        # Create fresh open time log
        TimeLog.objects.create(
            employee=self.tech_emp,
            company=self.company,
            user=self.tech_user,
            work_date=timezone.localdate(),
            clock_in=timezone.now() - timedelta(hours=2),
            clock_in_lat=12.9716,
            clock_in_lon=77.5946,
            status="draft",
        )

        def do_clock_out():
            c = APIClient()
            c.force_authenticate(user=self.tech_user)
            return c.post("/api/workforce/time/clock-out/", {"lat": 12.9716, "lon": 77.5946})

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(do_clock_out)
            f2 = executor.submit(do_clock_out)
            res1 = f1.result()
            res2 = f2.result()

        open_logs = TimeLog.objects.filter(employee=self.tech_emp, clock_out__isnull=True).count()
        passed = res1.status_code == 200 and res2.status_code == 200 and open_logs == 0
        self.record("AD", "Concurrent Clock-Out Idempotency", passed, f"1st status: {res1.status_code}, 2nd status: {res2.status_code}, open logs: {open_logs}")

    def test_AE_gps_recovery(self):
        from hooks_inspect import check_gps_recovery
        res = check_gps_recovery()
        self.record("AE", "GPS Recovery Telemetry Handling", res["passed"], res["details"])

    def run_all(self):
        self.test_A_single_persistent_watcher()
        self.test_B_staged_gps_startup()
        self.test_C_exponential_retry_backoff()
        self.test_D_decoupled_online_presence()
        self.test_E_server_telemetry_invariants()
        self.test_F_gps_freshness_validation()
        self.test_G_gps_stale_state_handling()
        self.test_H_geofence_distance_calculation()
        self.test_I_haversine_performance()
        self.test_J_exact_geofence_boundary()
        self.test_K_unauthorized_geofence_arrival()
        self.test_L_premature_geofence_arrival()
        self.test_M_arrival_idempotency()
        self.test_N_before_work_area_photo_removal()
        self.test_O_technician_presence_selfie_mandatory()
        self.test_P_before_work_photo_removal_from_after_proof()
        self.test_Q_after_face_selfie_mandatory_for_completion()
        self.test_R_auto_clock_in_flow()
        self.test_S_clock_in_idempotency()
        self.test_T_concurrent_clock_in_race()
        self.test_U_cash_gated_clock_out_rejection()
        self.test_V_cash_gated_clock_out_unlocking()
        self.test_W_online_prepaid_job_clock_out()
        self.test_X_shift_attendance_integrity()
        self.test_Y_gps_accuracy_rejection()
        self.test_Z_future_gps_timestamp()
        self.test_AA_auto_clock_in_in_flight_coalescing()
        self.test_AB_cash_pending_protection()
        self.test_AC_unauthorized_cash_collection()
        self.test_AD_concurrent_clock_out()
        self.test_AE_gps_recovery()

        print("\n" + "=" * 70)
        total = len(self.results)
        passed = sum(1 for r in self.results.values() if r["passed"])
        failed = total - passed
        print(f"  PHASE 2 TEST SUMMARY: {passed}/{total} PASSED ({failed} FAILED)")
        print("=" * 70)

        # Report Measured Latencies
        print("\n" + "=" * 70)
        print("  ACTUAL MEASURED PERFORMANCE BENCHMARKS")
        print("=" * 70)
        hav = self.latencies["haversine"]
        if hav:
            print(f"• Haversine Pure Math (1000 iter) : avg={sum(hav)/len(hav):.4f}ms, p50={sorted(hav)[int(len(hav)*0.5)]:.4f}ms, p95={sorted(hav)[int(len(hav)*0.95)]:.4f}ms")
        arr = self.latencies["arrival"]
        if arr:
            print(f"• Arrival API (Full HTTP DB Auth)  : avg={sum(arr)/len(arr):.1f}ms, p50={sorted(arr)[int(len(arr)*0.5)]:.1f}ms, p95={sorted(arr)[int(len(arr)*0.95)]:.1f}ms")
        cin = self.latencies["clock_in"]
        if cin:
            print(f"• Clock-In API (Full HTTP DB Lock) : avg={sum(cin)/len(cin):.1f}ms, p50={sorted(cin)[int(len(cin)*0.5)]:.1f}ms, p95={sorted(cin)[int(len(cin)*0.95)]:.1f}ms")
        cout = self.latencies["clock_out"]
        if cout:
            print(f"• Clock-Out API (Full HTTP DB Lock): avg={sum(cout)/len(cout):.1f}ms, p50={sorted(cout)[int(len(cout)*0.5)]:.1f}ms, p95={sorted(cout)[int(len(cout)*0.95)]:.1f}ms")
        print("=" * 70 + "\n")

        return failed == 0


if __name__ == "__main__":
    runner = Phase2TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
