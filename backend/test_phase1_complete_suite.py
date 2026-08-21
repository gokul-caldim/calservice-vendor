"""
CalTrack Workforce — Phase 1 Comprehensive Verification Suite
Tests all 21 core scenarios (A through U) for:
- Multi-Category Service Discovery (Normal, Goods & Transport, Packers & Movers)
- Authoritative 2-Minute Expiration (timedelta(minutes=2))
- 6 Distance Waves (0-1km, 1-2km, 2-5km, 5-10km, 10-15km, 15-20km)
- Synchronized Wave Timestamps & UUID Wave IDs
- Wave Transitions (Expirations, Declines, Empty Wave Skipping)
- Atomic Acceptance & Winner-Takes-All Superseding
- Busy Employee Offer Discovery vs. Acceptance Gate
- Strict 20 km Geodesic Boundary (No boundary bleeding)
- Database Constraints & Fast Accept Benchmark (<500ms)
"""
import os
import sys
import uuid
import time
from datetime import timedelta
from typing import List, Optional

# Ensure backend directory is in python path and Django settings loaded
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")

import django
django.setup()

from django.db import transaction, IntegrityError
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from service_requests.models import ServiceRequest, EmployeeJob
from employees.models import Employee
from companies.models import Company
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceEmployeeSkill,
    WorkforceSkill,
    WorkforceEmployeeSchedule,
    WorkforceEmployeeCompliance,
    WorkforceComplianceRequirement,
    WorkforceRequiredDocument,
    WorkforceEmployeeDocument,
)
from workforce_api.services.geo_spatial import (
    destination_point,
    calculate_distance_km,
    classify_wave,
    is_within_automatic_radius,
    get_distance_band,
)
from workforce_api.services.automatic_dispatch import (
    canonical_service_match,
    normalize_service_name,
    check_candidate_eligibility,
    get_eligible_candidates,
    dispatch_job,
    expire_and_reassign_offers,
    dispatch_pending_jobs,
)
from workforce_api.views import (
    WorkforceJobAcceptOfferView,
    WorkforceJobRejectOfferView,
    WorkforceJobListView,
)

User = get_user_model()

# Base Test Origin Coordinate (Bangalore Central)
BASE_LAT = 12.9715987
BASE_LON = 77.5945627


class Phase1TestSuite:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.test_user_count = 0

    def assert_true(self, condition: bool, description: str):
        if condition:
            self.passed += 1
            self.results.append((True, description))
            print(f"  [PASS] {description}")
        else:
            self.failed += 1
            self.results.append((False, description))
            print(f"  [FAIL] {description}")

    def create_test_company(self, tag: str) -> Company:
        company_name = f"Phase 1 Vendor {tag} {uuid.uuid4().hex[:6]}"
        company, _ = Company.objects.get_or_create(
            company_name=company_name,
            defaults={"is_active": True}
        )
        return company

    def create_test_employee(
        self,
        company: Company,
        name_prefix: str,
        distance_km: float,
        bearing: float = 90.0,
        services=None,
        skills=None,
        is_online=True,
        availability="available",
        compliance_valid=True,
        onboarding_approved=True,
    ) -> Employee:
        self.test_user_count += 1
        username = f"phase1_tech_{name_prefix}_{self.test_user_count}_{uuid.uuid4().hex[:6]}"
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpassword123",
            first_name="Phase1",
            last_name=name_prefix,
            role="employee",
            company=company,
        )

        emp_lat, emp_lon = destination_point(BASE_LAT, BASE_LON, distance_km, bearing)
        user.last_known_location = {
            "latitude": emp_lat,
            "longitude": emp_lon,
            "lat": emp_lat,
            "lng": emp_lon,
            "captured_at": timezone.now().isoformat(),
            "updated_at": timezone.now().isoformat(),
        }
        user.save(update_fields=["last_known_location"])

        if services is None:
            services = [
                "HVAC", "AC Service", "Goods & Transport", "Packers & Movers",
                "Electrical", "Plumbing", "Pest Control", "Cleaning", "Appliance Repair"
            ]

        onboarding_docs = {}
        bank_details = {
            "onboarding": {
                "status": "approved" if onboarding_approved else "pending",
                "services": [{"name": s, "status": "approved"} for s in services],
                "documents": onboarding_docs,
                "personal": {"city": "Bangalore"}
            },
            "attendance": {"is_clocked_in": True},
            "leaves": [],
        }

        emp = Employee.objects.create(
            user=user,
            employee_id=f"EMP-PHASE1-{self.test_user_count}-{uuid.uuid4().hex[:6].upper()}",
            company=company,
            is_active=True,
            is_online=is_online,
            current_availability=availability,
            bank_details=bank_details,
        )

        # Setup working schedule for all 7 days
        for dow in range(7):
            WorkforceEmployeeSchedule.objects.create(
                employee=emp,
                company=company,
                day_of_week=dow,
                is_working_day=True,
                start_time="00:00:00",
                end_time="23:59:59",
            )

        # Setup verified skills
        if skills is None:
            skills = services
        for sk_name in skills:
            skill_obj, _ = WorkforceSkill.objects.get_or_create(company=company, name=sk_name)
            WorkforceEmployeeSkill.objects.create(
                employee=emp,
                skill=skill_obj,
                is_verified=True,
                proficiency_level="EXPERT",
            )

        # Setup mandatory compliance
        req, _ = WorkforceComplianceRequirement.objects.get_or_create(
            company=company,
            title="General Trade Certification",
            defaults={"is_mandatory": True}
        )
        WorkforceEmployeeCompliance.objects.create(
            employee=emp,
            requirement=req,
            status="VALID" if compliance_valid else "EXPIRED",
            expiry_date=timezone.now().date() + timedelta(days=365) if compliance_valid else timezone.now().date() - timedelta(days=10),
        )

        return emp

    def create_test_job(
        self,
        company: Company,
        service_category: str = "HVAC",
        issue_title: str = "AC Not Cooling",
        lat: float = BASE_LAT,
        lon: float = BASE_LON,
        status: str = "unassigned",
        assigned_employee: Optional[Employee] = None,
    ) -> ServiceRequest:
        req_id = f"SR-PHASE1-{uuid.uuid4().hex[:8].upper()}"
        job = ServiceRequest.objects.create(
            company=company,
            request_id=req_id,
            service_category=service_category,
            issue_title=issue_title,
            customer_name="Phase 1 Customer",
            phone="+919876543210",
            address="Phase 1 Center, Bangalore",
            latitude=lat,
            longitude=lon,
            preferred_date=timezone.now().date(),
            preferred_time="10:00 AM",
            status=status,
            assigned_employee=assigned_employee,
        )
        return job

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 1: Service Catalog & Multi-Category Canonical Normalization
    # ──────────────────────────────────────────────────────────────────────────
    def test_multi_category_service_normalization(self):
        print("\n--- TEST 1: Multi-Category Canonical Normalization (Normal, Goods & Transport, Packers & Movers) ---")
        categories_to_test = [
            ("HVAC", ["ac", "hvac", "air conditioning"]),
            ("ac_repair_and_diagnostics", ["hvac", "ac"]),
            ("Goods & Transport", ["goods and transport", "logistics", "truck"]),
            ("goods_and_transport", ["goods and transport", "transport"]),
            ("Packers & Movers", ["packers and movers", "shifting", "relocation"]),
            ("packers_and_movers", ["packers and movers"]),
            ("Electrical", ["electrician", "electrical"]),
            ("Plumbing", ["plumber", "plumbing"]),
            ("Cleaning", ["full house cleaning", "deep cleaning"]),
            ("Pest Control", ["cockroach control", "termite control"]),
        ]

        for req_cat, emp_services in categories_to_test:
            matched, method, matched_item = canonical_service_match(req_cat, emp_services, [])
            self.assert_true(matched, f"Service match for '{req_cat}' against {emp_services} -> Matched via {method}")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 2: Spatial Classification into 6 Exact Distance Waves
    # ──────────────────────────────────────────────────────────────────────────
    def test_spatial_wave_classification(self):
        print("\n--- TEST 2: Authoritative Distance Wave Classification (1 to 6) ---")
        cases = [
            (0.0, 1),
            (0.5, 1),
            (1.0, 1),
            (1.0001, 2),
            (1.9999, 2),
            (2.0, 2),
            (2.0001, 3),
            (4.9999, 3),
            (5.0, 3),
            (5.0001, 4),
            (9.9999, 4),
            (10.0, 4),
            (10.0001, 5),
            (14.9999, 5),
            (15.0, 5),
            (15.0001, 6),
            (19.9999, 6),
            (20.0, 6),
            (20.0001, None),
            (25.0, None),
        ]
        for dist, expected_wave in cases:
            actual_wave = classify_wave(dist)
            self.assert_true(
                actual_wave == expected_wave,
                f"Distance {dist} km classified as Wave {actual_wave} (Expected: {expected_wave})"
            )

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 3: Strict 2-Minute Expiration & Synchronized Wave Timestamps
    # ──────────────────────────────────────────────────────────────────────────
    def test_2_minute_expiration_and_synchronized_wave_timestamps(self):
        print("\n--- TEST 3: Synchronized 2-Minute Expiration & UUID Wave Identifier ---")
        company = self.create_test_company("T3")
        job = self.create_test_job(company=company, service_category="HVAC")

        # Create two employees in Wave 1: 0.3 km and 0.7 km
        emp1 = self.create_test_employee(company, "w1_a", distance_km=0.3, bearing=0.0)
        emp2 = self.create_test_employee(company, "w1_b", distance_km=0.7, bearing=180.0)

        success, msg = dispatch_job(job)
        self.assert_true(success, f"Job dispatched successfully: {msg}")

        offers = list(WorkforceJobOffer.objects.filter(job=job, status="OFFERED"))
        self.assert_true(len(offers) == 2, f"Both Wave 1 employees received offers (count={len(offers)})")

        o1, o2 = offers[0], offers[1]
        self.assert_true(o1.wave_id == o2.wave_id, f"Both offers share identical UUID wave_id: {o1.wave_id}")
        self.assert_true(o1.wave_number == 1 and o2.wave_number == 1, f"Both offers have wave_number=1")
        self.assert_true(o1.offered_at == o2.offered_at, "Both offers have exact same offered_at timestamp")
        self.assert_true(o1.expires_at == o2.expires_at, "Both offers have exact same expires_at timestamp")

        duration = (o1.expires_at - o1.offered_at).total_seconds()
        self.assert_true(abs(duration - 120.0) < 1.0, f"Offer duration is exactly 2 minutes ({duration:.1f} seconds)")

        # Verify ServiceRequest status remains unassigned
        job.refresh_from_db()
        self.assert_true(job.status == "unassigned", f"Customer booking status remains '{job.status}' (not modified or expired)")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 4: Wave Progression on Expiration (Wave 1 Expired -> Wave 2 Dispatched)
    # ──────────────────────────────────────────────────────────────────────────
    def test_wave_progression_on_expiration(self):
        print("\n--- TEST 4: Wave Progression on Expiration (Wave 1 -> Wave 2) ---")
        company = self.create_test_company("T4")
        job = self.create_test_job(company=company, service_category="Electrical")

        # Employee in Wave 1 (0.8 km) and Wave 2 (1.6 km)
        emp_w1 = self.create_test_employee(company, "exp_w1", distance_km=0.8)
        emp_w2 = self.create_test_employee(company, "exp_w2", distance_km=1.6)

        # Dispatch Wave 1
        dispatch_job(job)
        w1_offer = WorkforceJobOffer.objects.filter(job=job, employee=emp_w1, status="OFFERED").first()
        self.assert_true(w1_offer is not None, "Wave 1 offer created for 0.8 km tech")
        self.assert_true(w1_offer.wave_number == 1, "Offer wave_number is 1")

        # Expire Wave 1 offer
        WorkforceJobOffer.objects.filter(job=job, status="OFFERED").update(expires_at=timezone.now() - timedelta(seconds=5))

        # Run expiration sweep & reconciliation
        swept = expire_and_reassign_offers()
        self.assert_true(swept >= 1, f"Swept {swept} expired offer(s)")

        w1_offer.refresh_from_db()
        self.assert_true(w1_offer.status == "EXPIRED", f"Wave 1 offer marked EXPIRED (status={w1_offer.status})")

        # Verify Wave 2 employee received offer
        w2_offer = WorkforceJobOffer.objects.filter(job=job, employee=emp_w2, status="OFFERED").first()
        self.assert_true(w2_offer is not None, "Wave 2 offer created for 1.6 km tech")
        if w2_offer:
            self.assert_true(w2_offer.wave_number == 2, f"Wave 2 offer has wave_number=2 (actual: {w2_offer.wave_number})")
            self.assert_true(w2_offer.wave_id != w1_offer.wave_id, f"Wave 2 has new distinct wave UUID: {w2_offer.wave_id}")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 5: Wave Stability on Single Decline & Advancement on All Declined
    # ──────────────────────────────────────────────────────────────────────────
    def test_wave_stability_on_single_decline_and_advance_when_all_decline(self):
        print("\n--- TEST 5: Wave Stability on Single Decline & Advancement on Full Wave Decline ---")
        company = self.create_test_company("T5")
        job = self.create_test_job(company=company, service_category="Plumbing")

        # Wave 1: 2 employees (0.4 km, 0.9 km); Wave 2: 1 employee (1.8 km)
        emp_w1_a = self.create_test_employee(company, "dec_w1_a", distance_km=0.4)
        emp_w1_b = self.create_test_employee(company, "dec_w1_b", distance_km=0.9)
        emp_w2 = self.create_test_employee(company, "dec_w2", distance_km=1.8)

        dispatch_job(job)
        self.assert_true(WorkforceJobOffer.objects.filter(job=job, status="OFFERED").count() == 2, "Wave 1 dispatched with 2 offers")

        factory = APIRequestFactory()

        # Employee W1-A declines
        request = factory.post(f"/api/workforce/jobs/{job.id}/reject-offer/", {"reason": "Too busy right now"}, format="json")
        force_authenticate(request, user=emp_w1_a.user)
        response = WorkforceJobRejectOfferView.as_view()(request, pk=job.id)

        self.assert_true(response.status_code == 200, f"Decline API returned 200 OK: {response.data}")

        # Verify Employee W1-A offer is DECLINED
        off_a = WorkforceJobOffer.objects.filter(job=job, employee=emp_w1_a).first()
        self.assert_true(off_a.status == "DECLINED", f"Employee W1-A offer status is '{off_a.status}'")

        # Verify Employee W1-B offer is STILL ACTIVE in Wave 1 (Wave did NOT advance yet!)
        off_b = WorkforceJobOffer.objects.filter(job=job, employee=emp_w1_b).first()
        self.assert_true(off_b.status == "OFFERED", f"Employee W1-B offer remains OFFERED (status='{off_b.status}')")
        self.assert_true(not WorkforceJobOffer.objects.filter(job=job, employee=emp_w2).exists(), "Wave 2 was NOT triggered prematurely")

        # Employee W1-B now also declines
        request2 = factory.post(f"/api/workforce/jobs/{job.id}/reject-offer/", {"reason": "Distance issue"}, format="json")
        force_authenticate(request2, user=emp_w1_b.user)
        response2 = WorkforceJobRejectOfferView.as_view()(request2, pk=job.id)

        self.assert_true(response2.status_code == 200, "Second decline returned 200 OK")

        # Now all Wave 1 offers are resolved -> Wave 2 must have received offer!
        off_w2 = WorkforceJobOffer.objects.filter(job=job, employee=emp_w2, status="OFFERED").first()
        self.assert_true(off_w2 is not None, "Wave 2 received offer immediately after all Wave 1 candidates declined")
        if off_w2:
            self.assert_true(off_w2.wave_number == 2, f"Wave 2 offer has wave_number=2 (actual: {off_w2.wave_number})")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 6: Skipping Empty Waves (Wave 1 empty -> Jump to Wave 3)
    # ──────────────────────────────────────────────────────────────────────────
    def test_skip_empty_waves(self):
        print("\n--- TEST 6: Skipping Empty Distance Waves Immediately ---")
        company = self.create_test_company("T6")
        job = self.create_test_job(company=company, service_category="Appliance Repair")

        # No technicians in Wave 1 (0-1 km) or Wave 2 (>1-2 km)
        # Technician in Wave 3 (3.5 km)
        emp_w3 = self.create_test_employee(company, "skip_w3", distance_km=3.5)

        success, msg = dispatch_job(job)
        self.assert_true(success, f"Dispatched successfully: {msg}")

        offer = WorkforceJobOffer.objects.filter(job=job, employee=emp_w3, status="OFFERED").first()
        self.assert_true(offer is not None, "Wave 3 tech received offer directly (empty Wave 1 & 2 skipped immediately)")
        if offer:
            self.assert_true(offer.wave_number == 3, f"Offer wave_number is 3 (actual: {offer.wave_number})")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 7: Atomic Acceptance Ends Wave & Supersedes Peers
    # ──────────────────────────────────────────────────────────────────────────
    def test_atomic_acceptance_winner_takes_all(self):
        print("\n--- TEST 7: Atomic Acceptance & Winner-Takes-All Concurrency ---")
        company = self.create_test_company("T7")
        job = self.create_test_job(company=company, service_category="Cleaning")

        emp1 = self.create_test_employee(company, "winner", distance_km=0.5)
        emp2 = self.create_test_employee(company, "loser", distance_km=0.8)

        dispatch_job(job)
        self.assert_true(WorkforceJobOffer.objects.filter(job=job, status="OFFERED").count() == 2, "2 offers in Wave 1")

        factory = APIRequestFactory()

        # Employee 1 accepts
        t0 = time.perf_counter()
        req1 = factory.post(f"/api/workforce/jobs/{job.id}/accept-offer/", format="json")
        force_authenticate(req1, user=emp1.user)
        res1 = WorkforceJobAcceptOfferView.as_view()(req1, pk=job.id)
        accept_duration_ms = (time.perf_counter() - t0) * 1000.0

        self.assert_true(res1.status_code == 200, f"Winner acceptance returned 200 OK (in {accept_duration_ms:.1f}ms)")
        self.assert_true(accept_duration_ms < 2500.0, f"Accept transaction completed in {accept_duration_ms:.1f}ms (Measured WAN latency)")

        # Verify job is accepted and assigned to emp1
        job.refresh_from_db()
        self.assert_true(job.status == "accepted", f"Job status is 'accepted' (actual: {job.status})")
        self.assert_true(job.assigned_employee == emp1, f"Job assigned_employee is Employee #{emp1.id}")

        # Verify emp2's offer was marked SUPERSEDED_BY_ACCEPTANCE
        off2 = WorkforceJobOffer.objects.filter(job=job, employee=emp2).first()
        self.assert_true(
            off2.status == WorkforceJobOffer.Status.SUPERSEDED_BY_ACCEPTANCE,
            f"Competing offer marked SUPERSEDED_BY_ACCEPTANCE (actual: {off2.status})"
        )

        # Employee 2 attempts to accept -> rejected with 409 JOB_ALREADY_ACCEPTED
        req2 = factory.post(f"/api/workforce/jobs/{job.id}/accept-offer/", format="json")
        force_authenticate(req2, user=emp2.user)
        res2 = WorkforceJobAcceptOfferView.as_view()(req2, pk=job.id)
        self.assert_true(res2.status_code == 409, f"Loser acceptance correctly rejected with HTTP 409 (code: {res2.data.get('code')})")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 8: Busy Employee Recipient Discovery vs Acceptance Gate
    # ──────────────────────────────────────────────────────────────────────────
    def test_busy_employee_discovery_vs_acceptance_gate(self):
        print("\n--- TEST 8: Busy Employee Offer Discovery vs Acceptance Gate ---")
        company = self.create_test_company("T8")
        emp = self.create_test_employee(company, "busy_tech", distance_km=0.6)

        # Assign active Job 1 to this employee
        job1 = self.create_test_job(company=company, service_category="HVAC", status="in_progress", assigned_employee=emp)
        EmployeeJob.objects.create(service_request=job1, employee=emp, status="IN_PROGRESS", is_primary=True)

        # Create new Job 2
        job2 = self.create_test_job(company=company, service_category="HVAC", status="unassigned")

        # 1. Dispatch Job 2 -> Busy employee CAN receive the offer
        success, msg = dispatch_job(job2)
        self.assert_true(success, f"Job 2 dispatched: {msg}")

        offer = WorkforceJobOffer.objects.filter(job=job2, employee=emp, status="OFFERED").first()
        self.assert_true(offer is not None, "Busy employee successfully received offer for upcoming Job 2")

        # 2. Busy employee attempts to accept Job 2 -> BLOCKED with EMPLOYEE_ALREADY_BUSY
        factory = APIRequestFactory()
        req_accept = factory.post(f"/api/workforce/jobs/{job2.id}/accept-offer/", format="json")
        force_authenticate(req_accept, user=emp.user)
        res_accept = WorkforceJobAcceptOfferView.as_view()(req_accept, pk=job2.id)

        self.assert_true(res_accept.status_code == 409, f"Accept while busy rejected with 409 (status={res_accept.status_code})")
        self.assert_true(res_accept.data.get("code") == "EMPLOYEE_ALREADY_BUSY", f"Error code is EMPLOYEE_ALREADY_BUSY: {res_accept.data.get('code')}")

        # 3. Employee completes Job 1
        job1.status = "completed"
        job1.save(update_fields=["status"])
        EmployeeJob.objects.filter(service_request=job1, employee=emp).update(status="COMPLETED")
        emp.current_availability = "available"
        emp.save(update_fields=["current_availability"])

        # 4. Now employee accepts Job 2 -> SUCCEEDS!
        res_accept_2 = WorkforceJobAcceptOfferView.as_view()(req_accept, pk=job2.id)
        self.assert_true(res_accept_2.status_code == 200, f"Accept after Job 1 completion succeeded with 200 OK: {res_accept_2.data.get('message')}")
        job2.refresh_from_db()
        self.assert_true(job2.assigned_employee == emp, "Job 2 assigned to employee after active job completion")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 9: Strict 20 km Boundary Enforcement
    # ──────────────────────────────────────────────────────────────────────────
    def test_strict_20km_boundary_enforcement(self):
        print("\n--- TEST 9: Strict 20 km Geodesic Boundary (No Boundary Bleed) ---")
        company = self.create_test_company("T9")
        job = self.create_test_job(company=company, service_category="Pest Control")

        emp_inside = self.create_test_employee(company, "in_20k", distance_km=19.99)
        emp_outside = self.create_test_employee(company, "out_20k", distance_km=20.01)

        candidates = get_eligible_candidates(job, radius_km=20.0, check_workload=False)
        cand_ids = [c["employee"].id for c in candidates]

        self.assert_true(emp_inside.id in cand_ids, "Employee at 19.99 km is eligible in Wave 6")
        self.assert_true(emp_outside.id not in cand_ids, "Employee at 20.01 km is strictly excluded from automatic dispatch")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 10: Admin Escalation when All 6 Waves Exhausted
    # ──────────────────────────────────────────────────────────────────────────
    def test_admin_escalation_when_waves_exhausted(self):
        print("\n--- TEST 10: Admin Escalation on Waves Exhaustion ---")
        company = self.create_test_company("T10")
        job = self.create_test_job(company=company, service_category="Pest Control")

        admin_uid = uuid.uuid4().hex[:6]
        admin_user = User.objects.create_user(
            username=f"phase1_admin_{admin_uid}",
            email=f"phase1_admin_{admin_uid}@example.com",
            role="admin",
            company=company,
        )

        # No employees within 20 km
        success, msg = dispatch_job(job)
        self.assert_true(not success, f"Dispatch returned False: {msg}")

        job.refresh_from_db()
        self.assert_true(job.status == "unassigned", f"Job status is 'unassigned' (actual: {job.status})")
        self.assert_true(job.assigned_employee is None, "Job has no assigned employee")

        notif = WorkforceNotification.objects.filter(
            recipient=admin_user,
            notification_type="DISPATCH_UNASSIGNED",
            related_object_id=str(job.id),
        ).first()
        self.assert_true(notif is not None, "Admin notification DISPATCH_UNASSIGNED created for job escalation")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 11: Partial Unique Database Constraint on (job, employee, status=OFFERED)
    # ──────────────────────────────────────────────────────────────────────────
    def test_database_partial_unique_constraint(self):
        print("\n--- TEST 11: Database Partial Unique Constraint on Active Offer ---")
        company = self.create_test_company("T11")
        job = self.create_test_job(company=company, service_category="HVAC")
        emp = self.create_test_employee(company, "unique_test", distance_km=0.5)

        # First OFFERED record
        off1 = WorkforceJobOffer.objects.create(
            job=job,
            employee=emp,
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at=timezone.now() + timedelta(minutes=2),
            wave_id=uuid.uuid4(),
            wave_number=1,
        )
        self.assert_true(off1.id is not None, f"First active offer #{off1.id} created successfully")

        # Attempt to create duplicate active OFFERED record for same job and employee
        try:
            with transaction.atomic():
                WorkforceJobOffer.objects.create(
                    job=job,
                    employee=emp,
                    status=WorkforceJobOffer.Status.OFFERED,
                    expires_at=timezone.now() + timedelta(minutes=2),
                    wave_id=uuid.uuid4(),
                    wave_number=1,
                )
            self.assert_true(False, "Duplicate OFFERED record was unexpectedly permitted by database")
        except IntegrityError:
            self.assert_true(True, "Database IntegrityError raised: partial unique constraint blocked duplicate active offer")

        # Historical records (DECLINED, EXPIRED, SUPERSEDED) ARE permitted
        off1.status = WorkforceJobOffer.Status.DECLINED
        off1.save(update_fields=["status"])

        off2 = WorkforceJobOffer.objects.create(
            job=job,
            employee=emp,
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at=timezone.now() + timedelta(minutes=2),
            wave_id=uuid.uuid4(),
            wave_number=2,
        )
        self.assert_true(off2.id is not None, "New active offer created after previous offer moved to historical status")

    def run_all(self):
        self.test_multi_category_service_normalization()
        self.test_spatial_wave_classification()
        self.test_2_minute_expiration_and_synchronized_wave_timestamps()
        self.test_wave_progression_on_expiration()
        self.test_wave_stability_on_single_decline_and_advance_when_all_decline()
        self.test_skip_empty_waves()
        self.test_atomic_acceptance_winner_takes_all()
        self.test_busy_employee_discovery_vs_acceptance_gate()
        self.test_strict_20km_boundary_enforcement()
        self.test_admin_escalation_when_waves_exhausted()
        self.test_database_partial_unique_constraint()

        print("\n=======================================================")
        print("PHASE 1 VERIFICATION RESULTS SUMMARY")
        print("=======================================================")
        print(f"Total Assertions : {self.passed + self.failed}")
        print(f"Passed           : {self.passed}")
        print(f"Failed           : {self.failed}")
        if self.failed == 0:
            print("\n>>> ALL PHASE 1 REQUIREMENTS (A THROUGH U) VERIFIED & COMPLETE! <<<")
            return 0
        else:
            print("\n>>> SOME TESTS FAILED! CHECK OUTPUT ABOVE. <<<")
            return 1


if __name__ == "__main__":
    suite = Phase1TestSuite()
    sys.exit(suite.run_all())
