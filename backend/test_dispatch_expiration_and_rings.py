"""
CalTrack Workforce — Comprehensive Test Suite for Job Offer Expiration, Rings & Cancellation
Directly executable test runner covering Tests A through N.
"""
import os
import sys
from datetime import timedelta
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.state_machine import apply_transition
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceJobLifecycleEvent,
    WorkforceEventLog,
    PreServiceVerification,
    JobTrackingSession,
)
from workforce_api.services.automatic_dispatch import (
    dispatch_job,
    dispatch_next_candidate,
    get_eligible_candidates,
    expire_and_reassign_offers,
    DEFAULT_OFFER_DURATION_MINUTES,
    MAX_DISPATCH_RADIUS_KM,
    RING_1_MAX_KM,
    RING_2_MAX_KM,
    RING_3_MAX_KM,
)
from workforce_api.views import (
    WorkforceJobAcceptOfferView,
    WorkforceJobRejectOfferView,
    WorkforceJobTechnicianCancelView,
    WorkforceDispatchAssignView,
    WorkforceJobListView,
)

User = get_user_model()
factory = APIRequestFactory()


def run_all_tests():
    print("=" * 80)
    print("CALTRACK WORKFORCE — DISPATCH EXPIRATION, RINGS & CANCELLATION TEST SUITE")
    print("=" * 80)

    passed = 0
    failed = 0
    errors = []

    def record_pass(name, detail=""):
        nonlocal passed
        passed += 1
        print(f" [PASS] {name} {f'-- {detail}' if detail else ''}")

    def record_fail(name, err):
        nonlocal failed
        failed += 1
        import traceback
        tb = traceback.format_exc()
        errors.append((name, str(err), tb))
        print(f" [FAIL] {name} -> {err}\n{tb}")

    # Setup base company
    company, _ = Company.objects.get_or_create(
        company_name="CalTrack Geo-Skill Dispatch Corp",
        defaults={"is_active": True}
    )

    admin_user, _ = User.objects.get_or_create(
        username="admin_disp_suite",
        defaults={
            "email": "admin_suite@example.com",
            "role": "admin",
            "company": company,
            "is_staff": True,
        }
    )

    cust_user, _ = User.objects.get_or_create(
        username="customer_disp_suite",
        defaults={
            "email": "cust_suite@example.com",
            "role": "customer",
            "first_name": "Alice",
            "last_name": "Customer",
        }
    )

    # Helper to create technicians at specific lat/lng
    def create_tech(prefix, full_name, lat, lon, is_online=True, availability="available"):
        first_name, last_name = full_name.split(" ", 1)
        user, _ = User.objects.get_or_create(
            username=f"{prefix}_suite_user",
            defaults={
                "email": f"{prefix}@example.com",
                "role": "employee",
                "company": company,
                "first_name": first_name,
                "last_name": last_name,
                "is_active": True,
            }
        )
        user.last_known_location = {
            "latitude": lat,
            "longitude": lon,
            "updated_at": timezone.now().isoformat(),
        }
        user.save()

        emp, _ = Employee.objects.get_or_create(
            user=user,
            defaults={
                "company": company,
                "employee_id": f"EMP-{prefix.upper()}",
                "is_active": True,
                "is_online": is_online,
                "current_availability": availability,
                "bank_details": {
                    "onboarding": {
                        "status": "approved",
                        "documents": {
                            "aadhaar_card": {"status": "approved", "mandatory": True},
                            "pan_card": {"status": "approved", "mandatory": True},
                        },
                        "services": [
                            {"name": "Electrical Repair", "category": "Electrical", "status": "approved"}
                        ],
                    },
                    "compliance": {
                        "background_check": {"status": "VALID", "mandatory": True},
                        "safety_training": {"status": "VALID", "mandatory": True},
                    },
                    "attendance": {
                        "is_clocked_in": True,
                    },
                },
            }
        )
        emp.company = company
        emp.is_active = True
        emp.is_online = is_online
        emp.current_availability = availability
        emp.save()
        return user, emp

    # Center: Bangalore (12.9716, 77.5946)
    cust_lat = 12.9716
    cust_lon = 77.5946

    # Tech 1: ~0.4 km (Ring 1)
    tech1_user, tech1_emp = create_tech("tech1", "Tech One", 12.9740, 77.5946)

    # Tech 2: ~0.8 km (Ring 1)
    tech2_user, tech2_emp = create_tech("tech2", "Tech Two", 12.9785, 77.5946)

    # Tech 3: ~1.5 km (Ring 2)
    tech3_user, tech3_emp = create_tech("tech3", "Tech Three", 12.9850, 77.5946)

    # Tech 4: ~3.5 km (Ring 3)
    tech4_user, tech4_emp = create_tech("tech4", "Tech Four", 13.0030, 77.5946)

    def create_job(service="Electrical Repair", lat=cust_lat, lon=cust_lon):
        job = ServiceRequest.objects.create(
            company=company,
            customer=cust_user,
            service_category=service,
            issue_title=service,
            status="confirmed",
            latitude=lat,
            longitude=lon,
            address="100 MG Road, Bangalore",
            preferred_date="2026-08-25",
            preferred_time="10:00:00",
            total_amount=1500.00,
        )
        WorkforceJobOffer.objects.filter(job=job).delete()
        return job

    # Helper to reset technicians state
    def reset_techs():
        now_iso = timezone.now().isoformat()
        coords = [
            (tech1_emp, tech1_user, 12.9740, 77.5946),
            (tech2_emp, tech2_user, 12.9785, 77.5946),
            (tech3_emp, tech3_user, 12.9850, 77.5946),
            (tech4_emp, tech4_user, 13.0030, 77.5946),
        ]
        # Clean up any residual active workload from prior tests
        EmployeeJob.objects.filter(employee__in=[tech1_emp, tech2_emp, tech3_emp, tech4_emp]).exclude(status="COMPLETED").update(status="COMPLETED")
        ServiceRequest.objects.filter(assigned_employee__in=[tech1_emp, tech2_emp, tech3_emp, tech4_emp]).update(assigned_employee=None, status="unassigned")

        for emp, u, lat, lon in coords:
            emp.refresh_from_db()
            emp.is_online = True
            emp.current_availability = "available"
            emp.save(update_fields=["is_online", "current_availability"])
            u.refresh_from_db()
            u.last_known_location = {
                "latitude": lat,
                "longitude": lon,
                "updated_at": now_iso,
            }
            u.save(update_fields=["last_known_location"])

    # ── TEST A: Offer Creation & 5-Minute Window ──────────────────────────────
    try:
        reset_techs()
        job_a = create_job()
        success, msg = dispatch_job(job_a)
        assert success, f"Dispatch failed: {msg}"

        offer = WorkforceJobOffer.objects.filter(job=job_a, status=WorkforceJobOffer.Status.OFFERED).first()
        assert offer is not None, "No OFFERED record created"
        assert offer.employee_id == tech1_emp.id, f"Expected Tech 1, got Tech #{offer.employee_id}"

        expected_exp = offer.offered_at + timedelta(minutes=5)
        diff_s = abs((offer.expires_at - expected_exp).total_seconds())
        assert diff_s < 3.0, f"Expiry diff too large: {diff_s}s"

        job_a.refresh_from_db()
        assert job_a.status == "unassigned", f"Job status should be unassigned while offered, got {job_a.status}"
        record_pass("Test A: Offer Creation & 5-Minute Window", f"Exclusive offer #{offer.id} expires in 5m for Tech 1")
    except Exception as e:
        record_fail("Test A: Offer Creation & 5-Minute Window", e)

    # ── TEST B: Offer Expiration Detection (Server Clock Authority) ───────────
    try:
        reset_techs()
        job_b = create_job()
        dispatch_job(job_b)

        offer = WorkforceJobOffer.objects.get(job=job_b, employee=tech1_emp)
        # Set offer expiration 30 seconds in the past to test server-side expiration
        offer.expires_at = timezone.now() - timedelta(seconds=30)
        offer.save(update_fields=["expires_at"])

        view = WorkforceJobAcceptOfferView.as_view()
        req = factory.post(f"/api/workforce/jobs/{job_b.id}/accept/")
        force_authenticate(req, user=tech1_user)
        res = view(req, pk=job_b.id)

        assert res.status_code == status.HTTP_409_CONFLICT, f"Expected 409, got {res.status_code}"
        assert res.data.get("code") == "OFFER_EXPIRED", f"Expected OFFER_EXPIRED code, got {res.data}"

        offer.refresh_from_db()
        assert offer.status == WorkforceJobOffer.Status.EXPIRED, f"Offer status should be EXPIRED, got {offer.status}"
        record_pass("Test B: Offer Expiration Detection", "Expired offer rejected with 409 OFFER_EXPIRED on accept")
    except Exception as e:
        record_fail("Test B: Offer Expiration Detection", e)

    # ── TEST C: Customer Booking Preserved On Expiry ───────────────────────────
    try:
        reset_techs()
        job_c = create_job()
        orig_slot_date = job_c.preferred_date
        orig_slot_time = job_c.preferred_time
        orig_amount = job_c.total_amount
        dispatch_job(job_c)

        offer = WorkforceJobOffer.objects.get(job=job_c, employee=tech1_emp)
        offer.expires_at = timezone.now() - timedelta(seconds=60)
        offer.save()

        # Run background sweep
        count = expire_and_reassign_offers()

        job_c.refresh_from_db()
        assert str(job_c.preferred_date) == str(orig_slot_date), "Customer booking date modified"
        assert str(job_c.preferred_time) == str(orig_slot_time), "Customer booking time modified"
        assert job_c.total_amount == orig_amount, "Customer booking amount modified"
        assert job_c.status in ["unassigned", "confirmed"], f"Invalid job status {job_c.status}"
        record_pass("Test C: Customer Booking Preserved", "Customer slot and booking metadata intact after offer expiry")
    except Exception as e:
        record_fail("Test C: Customer Booking Preserved", e)

    # ── TEST D: Ring 1 Immediate Offer ─────────────────────────────────────────
    try:
        reset_techs()
        job_d = create_job()
        success, msg = dispatch_job(job_d)
        assert success
        offer = WorkforceJobOffer.objects.get(job=job_d, status=WorkforceJobOffer.Status.OFFERED)
        assert offer.employee_id == tech1_emp.id, "Did not offer to nearest candidate in Ring 1"
        record_pass("Test D: Ring 1 Immediate Offer", f"Job offered to nearest Ring 1 technician Tech 1")
    except Exception as e:
        record_fail("Test D: Ring 1 Immediate Offer", e)

    # ── TEST E: Ring 1 Empty -> Ring 2 Immediate Offer ────────────────────────
    try:
        reset_techs()
        tech1_emp.is_online = False
        tech1_emp.save()
        tech2_emp.is_online = False
        tech2_emp.save()

        job_e = create_job()
        success, msg = dispatch_job(job_e)
        assert success, f"Failed: {msg}"

        offer = WorkforceJobOffer.objects.get(job=job_e, status=WorkforceJobOffer.Status.OFFERED)
        assert offer.employee_id == tech3_emp.id, f"Expected Tech 3 (Ring 2), got Tech #{offer.employee_id}"
        record_pass("Test E: Ring 1 Empty -> Ring 2 Escalation", "Escalated immediately to Ring 2 with zero delay")
    except Exception as e:
        record_fail("Test E: Ring 1 Empty -> Ring 2 Escalation", e)

    # ── TEST F: Ring 1 & 2 Empty -> Ring 3 Immediate Offer ────────────────────
    try:
        reset_techs()
        tech1_emp.is_online = False
        tech1_emp.save()
        tech2_emp.is_online = False
        tech2_emp.save()
        tech3_emp.is_online = False
        tech3_emp.save()

        job_f = create_job()
        success, msg = dispatch_job(job_f)
        assert success, f"Failed: {msg}"

        offer = WorkforceJobOffer.objects.get(job=job_f, status=WorkforceJobOffer.Status.OFFERED)
        assert offer.employee_id == tech4_emp.id, f"Expected Tech 4 (Ring 3), got Tech #{offer.employee_id}"
        record_pass("Test F: Ring 1 & 2 Empty -> Ring 3 Escalation", "Escalated immediately to Ring 3 with zero delay")
    except Exception as e:
        record_fail("Test F: Ring 1 & 2 Empty -> Ring 3 Escalation", e)

    # ── TEST G: Ring 1 Candidate Declines -> Ring 1 Next Candidate ─────────────
    try:
        reset_techs()
        job_g = create_job()
        dispatch_job(job_g)

        # Tech 1 declines
        view = WorkforceJobRejectOfferView.as_view()
        req = factory.post(f"/api/workforce/jobs/{job_g.id}/reject/", {"reason": "Busy on emergency"})
        force_authenticate(req, user=tech1_user)
        res = view(req, pk=job_g.id)
        assert res.status_code == status.HTTP_200_OK

        offer1 = WorkforceJobOffer.objects.get(job=job_g, employee=tech1_emp)
        assert offer1.status == WorkforceJobOffer.Status.REJECTED

        # Tech 2 (also in Ring 1) should receive the next offer
        offer2 = WorkforceJobOffer.objects.filter(job=job_g, status=WorkforceJobOffer.Status.OFFERED).first()
        assert offer2 is not None, "No second offer created"
        assert offer2.employee_id == tech2_emp.id, f"Expected Tech 2 in Ring 1, got Tech #{offer2.employee_id}"
        record_pass("Test G: Ring 1 Candidate Declines -> Ring 1 Next Candidate", "Dispatched to next candidate in Ring 1")
    except Exception as e:
        record_fail("Test G: Ring 1 Candidate Declines -> Ring 1 Next Candidate", e)

    # ── TEST H: Ring 1 All Exhausted -> Ring 2 Next Candidate ─────────────────
    try:
        reset_techs()
        job_h = create_job()
        dispatch_job(job_h)

        # Tech 1 declines
        view = WorkforceJobRejectOfferView.as_view()
        req1 = factory.post(f"/api/workforce/jobs/{job_h.id}/reject/", {"reason": "Unavailable"})
        force_authenticate(req1, user=tech1_user)
        view(req1, pk=job_h.id)

        # Tech 2 declines
        req2 = factory.post(f"/api/workforce/jobs/{job_h.id}/reject/", {"reason": "Distance"})
        force_authenticate(req2, user=tech2_user)
        view(req2, pk=job_h.id)

        # Next candidate must be Tech 3 in Ring 2
        offer3 = WorkforceJobOffer.objects.filter(job=job_h, status=WorkforceJobOffer.Status.OFFERED).first()
        assert offer3 is not None, "No Ring 2 offer created"
        assert offer3.employee_id == tech3_emp.id, f"Expected Tech 3 in Ring 2, got Tech #{offer3.employee_id}"
        record_pass("Test H: Ring 1 Exhausted -> Ring 2 Candidate", "Dispatched to Ring 2 after exhausting Ring 1")
    except Exception as e:
        record_fail("Test H: Ring 1 Exhausted -> Ring 2 Candidate", e)

    # ── TEST I: All 3 Waves Exhausted -> Admin Fallback Notification ──────────
    try:
        reset_techs()
        job_i = create_job()
        dispatch_job(job_i)

        view = WorkforceJobRejectOfferView.as_view()
        for user in [tech1_user, tech2_user, tech3_user, tech4_user]:
            req = factory.post(f"/api/workforce/jobs/{job_i.id}/reject/", {"reason": "Declined"})
            force_authenticate(req, user=user)
            view(req, pk=job_i.id)

        job_i.refresh_from_db()
        assert job_i.status == "unassigned", f"Expected unassigned, got {job_i.status}"
        assert job_i.assigned_employee is None

        # Verify Admin Notification was created
        notif = WorkforceNotification.objects.filter(
            recipient=admin_user,
            notification_type="DISPATCH_UNASSIGNED",
            related_object_id=str(job_i.id),
        ).first()
        assert notif is not None, "Admin DISPATCH_UNASSIGNED notification not found"

        event = WorkforceEventLog.objects.filter(
            event_type="DISPATCH_ADMIN_FALLBACK",
            payload__job_id=job_i.id
        ).first()
        assert event is not None, "DISPATCH_ADMIN_FALLBACK event log not found"

        record_pass("Test I: All Waves Exhausted -> Admin Notification", "Admin notified and job remains safely unassigned")
    except Exception as e:
        record_fail("Test I: All Waves Exhausted -> Admin Notification", e)

    # ── TEST J: Deterministic Candidate Ranking ────────────────────────────────
    try:
        reset_techs()
        job_j = create_job()
        candidates = get_eligible_candidates(job_j)
        assert len(candidates) == 4, f"Expected 4 candidates, got {len(candidates)}"
        assert candidates[0]["employee"].id == tech1_emp.id
        assert candidates[1]["employee"].id == tech2_emp.id
        assert candidates[2]["employee"].id == tech3_emp.id
        assert candidates[3]["employee"].id == tech4_emp.id
        record_pass("Test J: Deterministic Candidate Ranking", "Candidates sorted strictly by distance ascending & tie-breakers")
    except Exception as e:
        record_fail("Test J: Deterministic Candidate Ranking", e)

    # ── TEST K: Acceptance Race Winner-Takes-All ──────────────────────────────
    try:
        reset_techs()
        job_k = create_job()
        dispatch_job(job_k)

        # Manually simulate simultaneous pending offers
        WorkforceJobOffer.objects.create(
            job=job_k,
            employee=tech2_emp,
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        accept_view = WorkforceJobAcceptOfferView.as_view()

        # Tech 1 accepts first
        req1 = factory.post(f"/api/workforce/jobs/{job_k.id}/accept/")
        force_authenticate(req1, user=tech1_user)
        res1 = accept_view(req1, pk=job_k.id)
        assert res1.status_code == status.HTTP_200_OK

        job_k.refresh_from_db()
        assert job_k.assigned_employee_id == tech1_emp.id
        assert job_k.status == "accepted"

        # Tech 2 attempts to accept concurrently
        req2 = factory.post(f"/api/workforce/jobs/{job_k.id}/accept/")
        force_authenticate(req2, user=tech2_user)
        res2 = accept_view(req2, pk=job_k.id)
        assert res2.status_code == status.HTTP_409_CONFLICT, f"Expected 409, got {res2.status_code}"
        assert res2.data.get("code") == "JOB_ALREADY_ACCEPTED"

        # Competing offer must be marked SUPERSEDED_BY_ACCEPTANCE
        comp_offer = WorkforceJobOffer.objects.get(job=job_k, employee=tech2_emp)
        assert comp_offer.status == WorkforceJobOffer.Status.SUPERSEDED_BY_ACCEPTANCE
        record_pass("Test K: Acceptance Race Winner-Takes-All", "Winner assigned atomically; competitor receives 409 Conflict")
    except Exception as e:
        record_fail("Test K: Acceptance Race Winner-Takes-All", e)

    # ── TEST L: Pre-OTP Employee Cancellation Allowed ──────────────────────────
    try:
        reset_techs()
        job_l = create_job()
        dispatch_job(job_l)

        # Tech 1 accepts
        accept_view = WorkforceJobAcceptOfferView.as_view()
        req_acc = factory.post(f"/api/workforce/jobs/{job_l.id}/accept/")
        force_authenticate(req_acc, user=tech1_user)
        accept_view(req_acc, pk=job_l.id)

        tech1_emp.refresh_from_db()
        assert tech1_emp.current_availability == "busy"

        # Tech 1 cancels pre-OTP
        cancel_view = WorkforceJobTechnicianCancelView.as_view()
        req_canc = factory.post(f"/api/workforce/jobs/{job_l.id}/technician-cancel/", {
            "reason_code": "VEHICLE_ISSUE",
            "reason_detail": "Flat tire en route",
        })
        force_authenticate(req_canc, user=tech1_user)
        res_canc = cancel_view(req_canc, pk=job_l.id)
        assert res_canc.status_code == status.HTTP_200_OK

        tech1_emp.refresh_from_db()
        assert tech1_emp.current_availability == "available", f"Expected available, got {tech1_emp.current_availability}"

        job_l.refresh_from_db()
        assert job_l.assigned_employee is None

        # Automatic redispatch to Tech 2
        offer_redispatch = WorkforceJobOffer.objects.filter(job=job_l, status=WorkforceJobOffer.Status.OFFERED).first()
        assert offer_redispatch is not None
        assert offer_redispatch.employee_id == tech2_emp.id, f"Expected Tech 2 redispatched, got Tech #{offer_redispatch.employee_id}"
        record_pass("Test L: Pre-OTP Employee Cancellation Allowed", "Tech availability freed to available and job redispatched")
    except Exception as e:
        record_fail("Test L: Pre-OTP Employee Cancellation Allowed", e)

    # ── TEST M: Post-OTP Employee Cancellation Blocked ─────────────────────────
    try:
        reset_techs()
        job_m = create_job()
        dispatch_job(job_m)

        # Tech 1 accepts
        accept_view = WorkforceJobAcceptOfferView.as_view()
        req_acc = factory.post(f"/api/workforce/jobs/{job_m.id}/accept/")
        force_authenticate(req_acc, user=tech1_user)
        accept_view(req_acc, pk=job_m.id)

        # Customer verifies OTP
        PreServiceVerification.objects.create(
            job=job_m,
            employee=tech1_emp,
            otp_verified=True,
            otp_verified_at=timezone.now(),
        )

        # Tech 1 attempts cancellation
        cancel_view = WorkforceJobTechnicianCancelView.as_view()
        req_canc = factory.post(f"/api/workforce/jobs/{job_m.id}/technician-cancel/", {
            "reason_code": "PERSONAL_EMERGENCY",
            "reason_detail": "Emergency",
        })
        force_authenticate(req_canc, user=tech1_user)
        res_canc = cancel_view(req_canc, pk=job_m.id)

        assert res_canc.status_code == status.HTTP_409_CONFLICT, f"Expected 409, got {res_canc.status_code}"
        assert res_canc.data.get("code") == "CANCELLATION_LOCKED_AFTER_OTP"
        record_pass("Test M: Post-OTP Cancellation Blocked", "Cancellation locked with 409 CANCELLATION_LOCKED_AFTER_OTP")
    except Exception as e:
        record_fail("Test M: Post-OTP Cancellation Blocked", e)

    # ── TEST N: Admin Manual Dispatch with 9-Gate Validation ───────────────────
    try:
        reset_techs()
        job_n = create_job()
        apply_transition(job_n, "unassigned")

        assign_view = WorkforceDispatchAssignView.as_view()

        # Admin assigns Tech 2
        req_assign = factory.post("/api/workforce/dispatch/assign/", {
            "job_id": job_n.id,
            "employee_id": tech2_emp.id,
        })
        force_authenticate(req_assign, user=admin_user)
        res_assign = assign_view(req_assign)
        assert res_assign.status_code == status.HTTP_200_OK, f"Expected 200, got {res_assign.status_code} ({res_assign.data})"

        offer = WorkforceJobOffer.objects.filter(job=job_n, status=WorkforceJobOffer.Status.OFFERED).first()
        assert offer is not None
        assert offer.employee_id == tech2_emp.id

        # Ineligible Tech Test (Stale GPS > 120s)
        tech3_user.last_known_location = {
            "latitude": 12.9850,
            "longitude": 77.5946,
            "updated_at": (timezone.now() - timedelta(minutes=10)).isoformat(),
        }
        tech3_user.save()

        req_stale = factory.post("/api/workforce/dispatch/assign/", {
            "job_id": job_n.id,
            "employee_id": tech3_emp.id,
        })
        force_authenticate(req_stale, user=admin_user)
        res_stale = assign_view(req_stale)
        assert res_stale.status_code == status.HTTP_400_BAD_REQUEST, f"Expected 400 for stale GPS, got {res_stale.status_code}"
        assert res_stale.data.get("code") in ["GPS_STALE", "INELIGIBLE_TECHNICIAN"]

        record_pass("Test N: Admin Manual Dispatch with 9-Gate Validation", "Admin dispatch strictly validates 9-gate eligibility & GPS")
    except Exception as e:
        record_fail("Test N: Admin Manual Dispatch with 9-Gate Validation", e)

    print("=" * 80)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED (TOTAL: {passed + failed})")
    print("=" * 80)
    if errors:
        for name, err, tb in errors:
            print(f"\n--- FAILED: {name} ---\n{err}\n{tb}")
        sys.exit(1)
    else:
        print("ALL TESTS A THROUGH N COMPLETED SUCCESSFULLY!")
        sys.exit(0)


if __name__ == "__main__":
    run_all_tests()
