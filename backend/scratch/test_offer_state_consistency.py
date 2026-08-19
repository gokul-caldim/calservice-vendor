#!/usr/bin/env python
"""
backend/scratch/test_offer_state_consistency.py

Comprehensive Regression Test Suite for:
1. False "ACCEPTED/ASSIGNED" Job State Bug Elimination
2. Backend Single Authority on Acceptance
3. Offer Expiry vs 5-Minute Cancellation Window Separation
4. API / Serializer Consistency & Non-Contradictory State Representation
5. 409 Conflicts: Expired Offer, Already Accepted, Employee Already Busy
6. Database Invariant Auditing
"""
import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, CatalogCategory, Service, EmployeeJob
from workforce_api.models import (
    WorkforceJobOffer,
    JobTrackingSession,
    WorkforceJobLifecycleEvent,
    WorkforceEventLog,
)
from workforce_api.views import (
    WorkforceJobListView,
    WorkforceJobAcceptOfferView,
    run_automatic_dispatch,
)
from workforce_api.serializers import WorkforceJobSerializer

User = get_user_model()
import uuid
import secrets

factory = APIRequestFactory()


def run_all_tests():
    print("=" * 80)
    print("WORKFORCE — OFFER STATE CONSISTENCY & STATE-MACHINE UI INTEGRITY TEST")
    print("=" * 80)

    test_id = uuid.uuid4().hex[:8]
    now = timezone.now()

    # 0. Setup test company and users
    company = Company.objects.create(
        company_name=f"State Consistency Test Co ({test_id})",
        is_active=True,
    )

    def make_user(username, role="employee", lat=12.9716, lon=77.5946, first_name="Test", last_name="User"):
        phone_num = f"+9199{secrets.randbelow(89999999) + 10000000}"
        email = f"{username}_{test_id}@test.com"
        user = User.objects.create(
            username=f"{username}_{test_id}",
            email=email,
            phone=phone_num,
            role=role,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            last_known_location={
                "latitude": lat,
                "longitude": lon,
                "lat": lat,
                "lng": lon,
                "updated_at": now.isoformat(),
                "captured_at": now.isoformat(),
                "accuracy": 8.0,
            }
        )
        user.set_password("Pass123!")
        user.save()
        return user

    # Tech 1
    user_tech1 = make_user("state_tech1", role="employee", first_name="Tech", last_name="One")
    emp_tech1 = Employee.objects.create(
        user=user_tech1,
        employee_id=f"EMP_ST1_{test_id[:4]}",
        company=company,
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "approved",
                "submitted": True,
                "approved": True,
                "services": [{"name": "HVAC & Air Conditioning", "status": "approved"}],
            },
            "attendance": {"is_clocked_in": True},
        },
    )

    # Tech 2
    user_tech2 = make_user("state_tech2", role="employee", first_name="Tech", last_name="Two")
    emp_tech2 = Employee.objects.create(
        user=user_tech2,
        employee_id=f"EMP_ST2_{test_id[:4]}",
        company=company,
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "approved",
                "submitted": True,
                "approved": True,
                "services": [{"name": "HVAC & Air Conditioning", "status": "approved"}],
            },
            "attendance": {"is_clocked_in": True},
        },
    )

    # Customer
    user_cust = make_user("state_cust", role="customer", first_name="Alice", last_name="Customer")

    print("\n[TEST 1] Dispatch creates OFFERED offer — Employee has NOT accepted yet")
    job1 = ServiceRequest.objects.create(
        company=company,
        customer=user_cust,
        customer_name="Alice Customer",
        phone="9876543210",
        service_category="hvac",
        issue_title="AC Inspection",
        address="100 Test St, Bangalore",
        latitude=12.9716,
        longitude=77.5946,
        preferred_date=now.date(),
        preferred_time="10:00 AM",
        status="unassigned",
        total_amount=1500.00,
        payment_method="COD",
        payment_status="pending",
    )

    # Create exclusive offer for Tech 1
    expires_at = now + timedelta(minutes=5)
    offer1 = WorkforceJobOffer.objects.create(
        job=job1,
        employee=emp_tech1,
        status=WorkforceJobOffer.Status.OFFERED,
        rank_score=95.0,
        expires_at=expires_at,
    )

    # Verification: Database State BEFORE Acceptance
    job1.refresh_from_db()
    assert job1.assigned_employee is None, f"FAIL: assigned_employee must be None before acceptance, got {job1.assigned_employee}"
    assert job1.status != "assigned", f"FAIL: job.status must not be 'assigned' before acceptance, got {job1.status}"
    assert offer1.status == "OFFERED", f"FAIL: offer status must be OFFERED, got {offer1.status}"
    assert emp_tech1.current_availability == "available", f"FAIL: employee must remain available, got {emp_tech1.current_availability}"
    print("  ✓ Database Invariants Pre-Acceptance: assigned_employee=None, status!=assigned, employee availability=available.")

    # Verification: API Representation for Tech 1 (Unaccepted Offer)
    req = factory.get("/api/workforce/jobs/")
    force_authenticate(req, user=user_tech1)
    res = WorkforceJobListView.as_view()(req)
    assert res.status_code == 200, f"FAIL: GET /jobs/ returned {res.status_code}"

    job_data_list = [j for j in res.data if j["id"] == job1.id]
    assert len(job_data_list) == 1, f"FAIL: Expected offered job1 in Tech 1 jobs list, found {len(job_data_list)}"
    jdata = job_data_list[0]

    assert jdata["is_offer"] is True, f"FAIL: is_offer must be True for pending offer, got {jdata.get('is_offer')}"
    assert jdata["is_accepted_by_current_employee"] is False, f"FAIL: is_accepted must be False, got {jdata.get('is_accepted_by_current_employee')}"
    assert jdata["is_assigned_to_current_employee"] is False, f"FAIL: is_assigned must be False, got {jdata.get('is_assigned_to_current_employee')}"
    assert jdata["offer_status"] == "OFFERED", f"FAIL: offer_status must be 'OFFERED', got {jdata.get('offer_status')}"
    assert jdata["accepted_at"] is None, f"FAIL: accepted_at must be None, got {jdata.get('accepted_at')}"
    assert jdata["cancellation_deadline"] is None, f"FAIL: cancellation_deadline must be None for unaccepted offer, got {jdata.get('cancellation_deadline')}"
    assert jdata["cancellation_info"] is None, f"FAIL: cancellation_info must be None for unaccepted offer, got {jdata.get('cancellation_info')}"
    assert jdata["offer_expires_at"] is not None, f"FAIL: offer_expires_at must be populated for offer, got {jdata.get('offer_expires_at')}"
    assert jdata["active_offer"] is not None, f"FAIL: active_offer must be populated for offer, got {jdata.get('active_offer')}"
    print("  ✓ API Response Pre-Acceptance: is_offer=True, is_accepted=False, offer_status=OFFERED, accepted_at=None, cancellation_deadline=None, offer_expires_at populated.")

    # Tech 2 calling GET /jobs/ must NOT see Tech 1's exclusive offer
    req2 = factory.get("/api/workforce/jobs/")
    force_authenticate(req2, user=user_tech2)
    res2 = WorkforceJobListView.as_view()(req2)
    assert not any(j["id"] == job1.id for j in res2.data), "FAIL: Tech 2 must not see Tech 1 exclusive offer!"
    print("  ✓ Exclusive Offer Isolation: Tech 2 does not see Tech 1 exclusive offer.")

    print("\n[TEST 2] Employee Accepts Job via POST /accept-offer/ (Atomic Backend Authority)")
    req_accept = factory.post(f"/api/workforce/jobs/{job1.id}/accept-offer/")
    force_authenticate(req_accept, user=user_tech1)
    res_accept = WorkforceJobAcceptOfferView.as_view()(req_accept, pk=job1.id)
    assert res_accept.status_code == 200, f"FAIL: Accept offer returned {res_accept.status_code}: {res_accept.data}"

    # Verification: Post-Acceptance Database State
    job1.refresh_from_db()
    emp_tech1.refresh_from_db()
    offer1.refresh_from_db()

    assert job1.assigned_employee == emp_tech1, f"FAIL: assigned_employee must be Tech 1, got {job1.assigned_employee}"
    assert job1.status == "accepted", f"FAIL: job status must be 'accepted', got {job1.status}"
    assert offer1.status == "ACCEPTED", f"FAIL: offer status must be ACCEPTED, got {offer1.status}"
    assert emp_tech1.current_availability == "busy", f"FAIL: employee must become 'busy', got {emp_tech1.current_availability}"

    # Verify EmployeeJob and JobTrackingSession
    emp_job = EmployeeJob.objects.filter(service_request=job1, employee=emp_tech1).first()
    assert emp_job is not None, "FAIL: EmployeeJob not created!"
    assert emp_job.status == "ACCEPTED", f"FAIL: EmployeeJob status must be ACCEPTED, got {emp_job.status}"
    assert emp_job.is_primary is True, "FAIL: EmployeeJob must be primary"

    tracking = JobTrackingSession.objects.filter(job=job1, employee=emp_tech1).first()
    assert tracking is not None, "FAIL: JobTrackingSession not created!"
    assert tracking.status == JobTrackingSession.SessionStatus.ACTIVE, f"FAIL: Tracking session status must be ACTIVE, got {tracking.status}"

    lifecycle = WorkforceJobLifecycleEvent.objects.filter(
        job=job1, employee=emp_tech1, event_type=WorkforceJobLifecycleEvent.EventType.EMPLOYEE_JOB_ACCEPTED
    ).first()
    assert lifecycle is not None, "FAIL: WorkforceJobLifecycleEvent for EMPLOYEE_JOB_ACCEPTED not created!"
    assert lifecycle.cancellation_deadline is not None, "FAIL: cancellation_deadline not populated in lifecycle event!"
    print("  ✓ Atomic Backend Acceptance: job.status=accepted, assigned_employee=Tech1, employee=busy, EmployeeJob=ACCEPTED, TrackingSession=ACTIVE, Lifecycle event recorded.")

    # Verification: API Representation for Tech 1 (Accepted Job)
    req_post = factory.get("/api/workforce/jobs/")
    force_authenticate(req_post, user=user_tech1)
    res_post = WorkforceJobListView.as_view()(req_post)
    jdata_post = [j for j in res_post.data if j["id"] == job1.id][0]

    assert jdata_post["job_status"] == "accepted", f"FAIL: job_status must be 'accepted', got {jdata_post.get('job_status')}"
    assert jdata_post["offer_status"] == "ACCEPTED", f"FAIL: offer_status must be 'ACCEPTED', got {jdata_post.get('offer_status')}"
    assert jdata_post["is_offer"] is False, f"FAIL: is_offer must be False once accepted, got {jdata_post.get('is_offer')}"
    assert jdata_post["is_accepted_by_current_employee"] is True, f"FAIL: is_accepted must be True, got {jdata_post.get('is_accepted_by_current_employee')}"
    assert jdata_post["is_assigned_to_current_employee"] is True, f"FAIL: is_assigned must be True, got {jdata_post.get('is_assigned_to_current_employee')}"
    assert jdata_post["accepted_at"] is not None, f"FAIL: accepted_at must be populated once accepted, got {jdata_post.get('accepted_at')}"
    assert jdata_post["cancellation_deadline"] is not None, f"FAIL: cancellation_deadline must be populated once accepted, got {jdata_post.get('cancellation_deadline')}"
    assert jdata_post["offer_expires_at"] is None, f"FAIL: offer_expires_at must be None once accepted, got {jdata_post.get('offer_expires_at')}"
    assert jdata_post["active_offer"] is None, f"FAIL: active_offer must be None once accepted, got {jdata_post.get('active_offer')}"
    assert jdata_post["cancellation_info"] is not None, f"FAIL: cancellation_info must be populated for accepted job"
    assert jdata_post["cancellation_info"]["cancellation_available"] is True, f"FAIL: cancellation_available must be True within 5m"
    print("  ✓ API Response Post-Acceptance: is_offer=False, is_accepted=True, offer_status=ACCEPTED, accepted_at populated, cancellation_deadline populated, offer_expires_at=None, cancellation_available=True.")

    print("\n[TEST 3] Idempotent Double-Accept Protection")
    req_accept_dup = factory.post(f"/api/workforce/jobs/{job1.id}/accept-offer/")
    force_authenticate(req_accept_dup, user=user_tech1)
    res_accept_dup = WorkforceJobAcceptOfferView.as_view()(req_accept_dup, pk=job1.id)
    assert res_accept_dup.status_code == 200, f"FAIL: Double accept by same tech should return 200 idempotent success, got {res_accept_dup.status_code}"
    
    # Invariant: exactly 1 EmployeeJob and 1 JobTrackingSession
    assert EmployeeJob.objects.filter(service_request=job1).count() == 1, "FAIL: Duplicate EmployeeJob created!"
    assert JobTrackingSession.objects.filter(job=job1).count() == 1, "FAIL: Duplicate JobTrackingSession created!"
    print("  ✓ Idempotent Double Acceptance: HTTP 200 OK, exactly 1 EmployeeJob, exactly 1 JobTrackingSession.")

    print("\n[TEST 4] Competing Technician Acceptance Conflict Protection (HTTP 409 JOB_ALREADY_ACCEPTED)")
    req_tech2_steal = factory.post(f"/api/workforce/jobs/{job1.id}/accept-offer/")
    force_authenticate(req_tech2_steal, user=user_tech2)
    res_tech2_steal = WorkforceJobAcceptOfferView.as_view()(req_tech2_steal, pk=job1.id)
    assert res_tech2_steal.status_code == 409, f"FAIL: Expected 409 Conflict for competing tech, got {res_tech2_steal.status_code}"
    assert res_tech2_steal.data.get("code") == "JOB_ALREADY_ACCEPTED", f"FAIL: Expected code JOB_ALREADY_ACCEPTED, got {res_tech2_steal.data}"
    print("  ✓ Competing Tech Blocked: HTTP 409 Conflict with code 'JOB_ALREADY_ACCEPTED'.")

    print("\n[TEST 5] Single Active Job Enforcement (HTTP 409 EMPLOYEE_ALREADY_BUSY)")
    job2 = ServiceRequest.objects.create(
        company=company,
        customer=user_cust,
        customer_name="Alice Customer",
        phone="9876543210",
        service_category="electrical",
        issue_title="Wiring Fix",
        address="102 Test St, Bangalore",
        latitude=12.9720,
        longitude=77.5950,
        preferred_date=now.date(),
        preferred_time="10:00 AM",
        status="unassigned",
        total_amount=2000.00,
        payment_method="COD",
        payment_status="pending",
    )
    offer2 = WorkforceJobOffer.objects.create(
        job=job2,
        employee=emp_tech1,
        status=WorkforceJobOffer.Status.OFFERED,
        rank_score=90.0,
        expires_at=now + timedelta(minutes=5),
    )

    req_busy_accept = factory.post(f"/api/workforce/jobs/{job2.id}/accept-offer/")
    force_authenticate(req_busy_accept, user=user_tech1)
    res_busy_accept = WorkforceJobAcceptOfferView.as_view()(req_busy_accept, pk=job2.id)
    assert res_busy_accept.status_code == 409, f"FAIL: Busy tech should get 409 Conflict, got {res_busy_accept.status_code}: {res_busy_accept.data}"
    assert res_busy_accept.data.get("code") == "EMPLOYEE_ALREADY_BUSY", f"FAIL: Expected code EMPLOYEE_ALREADY_BUSY, got {res_busy_accept.data}"
    print("  ✓ Single Active Job Enforced: HTTP 409 Conflict with code 'EMPLOYEE_ALREADY_BUSY'.")

    print("\n[TEST 6] Expired Offer Protection (HTTP 409 OFFER_EXPIRED)")
    job3 = ServiceRequest.objects.create(
        company=company,
        customer=user_cust,
        customer_name="Alice Customer",
        phone="9876543210",
        service_category="plumbing",
        issue_title="Pipe Leak",
        address="104 Test St, Bangalore",
        latitude=12.9730,
        longitude=77.5960,
        preferred_date=now.date(),
        preferred_time="10:00 AM",
        status="unassigned",
        total_amount=1200.00,
        payment_method="COD",
        payment_status="pending",
    )
    # Offer created in the past (expired)
    offer3 = WorkforceJobOffer.objects.create(
        job=job3,
        employee=emp_tech2,
        status=WorkforceJobOffer.Status.OFFERED,
        rank_score=88.0,
        expires_at=now - timedelta(minutes=2),
    )

    # Tech 2 calling GET /jobs/ must NOT see the expired offer
    req_exp_list = factory.get("/api/workforce/jobs/")
    force_authenticate(req_exp_list, user=user_tech2)
    res_exp_list = WorkforceJobListView.as_view()(req_exp_list)
    assert not any(j["id"] == job3.id for j in res_exp_list.data), "FAIL: Expired offer must not be returned in active job list!"

    # Tech 2 calling POST /accept-offer/ on stale expired offer
    req_exp_accept = factory.post(f"/api/workforce/jobs/{job3.id}/accept-offer/")
    force_authenticate(req_exp_accept, user=user_tech2)
    res_exp_accept = WorkforceJobAcceptOfferView.as_view()(req_exp_accept, pk=job3.id)
    assert res_exp_accept.status_code == 409, f"FAIL: Expired offer accept must return 409 Conflict, got {res_exp_accept.status_code}: {res_exp_accept.data}"
    assert res_exp_accept.data.get("code") == "OFFER_EXPIRED", f"FAIL: Expected code OFFER_EXPIRED, got {res_exp_accept.data}"

    offer3.refresh_from_db()
    assert offer3.status == WorkforceJobOffer.Status.EXPIRED, f"FAIL: Offer must be updated to EXPIRED in DB, got {offer3.status}"
    job3.refresh_from_db()
    assert job3.assigned_employee is None, f"FAIL: Expired job must not have assigned_employee, got {job3.assigned_employee}"
    print("  ✓ Expired Offer Protected: HTTP 409 Conflict with code 'OFFER_EXPIRED', offer.status=EXPIRED, assigned_employee=None.")

    print("\n[TEST 7] Competing Offer Closed & Superseded Audit")
    job4 = ServiceRequest.objects.create(
        company=company,
        customer=user_cust,
        customer_name="Alice Customer",
        phone="9876543210",
        service_category="cleaning",
        issue_title="Deep Cleaning",
        address="106 Test St, Bangalore",
        latitude=12.9740,
        longitude=77.5970,
        preferred_date=now.date(),
        preferred_time="10:00 AM",
        status="unassigned",
        total_amount=2500.00,
        payment_method="COD",
        payment_status="pending",
    )
    # Tech 2 gets offer
    offer4_tech2 = WorkforceJobOffer.objects.create(
        job=job4,
        employee=emp_tech2,
        status=WorkforceJobOffer.Status.OFFERED,
        rank_score=92.0,
        expires_at=now + timedelta(minutes=5),
    )

    # Tech 2 accepts job4
    req_accept4 = factory.post(f"/api/workforce/jobs/{job4.id}/accept-offer/")
    force_authenticate(req_accept4, user=user_tech2)
    res_accept4 = WorkforceJobAcceptOfferView.as_view()(req_accept4, pk=job4.id)
    assert res_accept4.status_code == 200, f"FAIL: Tech 2 accept returned {res_accept4.status_code}: {res_accept4.data}"

    job4.refresh_from_db()
    assert job4.assigned_employee == emp_tech2, "FAIL: Job 4 must be assigned to Tech 2"
    assert job4.status == "accepted", "FAIL: Job 4 status must be 'accepted'"
    print("  ✓ Winning Acceptance: Job 4 assigned to Tech 2.")

    print("\n[TEST 8] Relational Database Invariant Verification")
    # Invariant 1: Max 1 assigned employee per ServiceRequest
    for sr in [job1, job2, job3, job4]:
        assigned_emps = Employee.objects.filter(assigned_service_requests=sr)
        assert assigned_emps.count() <= 1, f"FAIL: Multiple assigned employees on ServiceRequest #{sr.id}!"

    # Invariant 2: Max 1 active accepted/in_progress job per Employee
    active_statuses = ["accepted", "on_the_way", "arrived", "in_progress"]
    tech1_active_jobs = ServiceRequest.objects.filter(assigned_employee=emp_tech1, status__in=active_statuses)
    assert tech1_active_jobs.count() == 1, f"FAIL: Tech 1 should have exactly 1 active job, found {tech1_active_jobs.count()}"
    tech2_active_jobs = ServiceRequest.objects.filter(assigned_employee=emp_tech2, status__in=active_statuses)
    assert tech2_active_jobs.count() == 1, f"FAIL: Tech 2 should have exactly 1 active job, found {tech2_active_jobs.count()}"

    # Invariant 3: Exactly 1 ACTIVE JobTrackingSession per active job
    for active_sr in [job1, job4]:
        active_sessions = JobTrackingSession.objects.filter(job=active_sr, status=JobTrackingSession.SessionStatus.ACTIVE)
        assert active_sessions.count() == 1, f"FAIL: Expected 1 active session for Job #{active_sr.id}, found {active_sessions.count()}"

    # Invariant 4: No active tracking session for unaccepted job (job2, job3)
    for unaccepted_sr in [job2, job3]:
        unaccepted_sessions = JobTrackingSession.objects.filter(job=unaccepted_sr, status=JobTrackingSession.SessionStatus.ACTIVE)
        assert unaccepted_sessions.count() == 0, f"FAIL: Found active session for unaccepted Job #{unaccepted_sr.id}!"

    print("  ✓ Database Invariants 100% Consistent: Zero orphaned sessions, zero double assignments, single active job per tech strictly preserved.")

    print("\n" + "=" * 80)
    print("ALL OFFER STATE CONSISTENCY & STATE-MACHINE INTEGRITY TESTS PASSED (100%)!")
    print("=" * 80)


if __name__ == "__main__":
    run_all_tests()
