"""
Phase 1 Test Suite: True Cross-Application Geo-Based Dispatch Engine

Simulates external customer booking writes directly to shared database,
evaluates live GPS freshness (5-minute rule), proximity ranking, exclusive atomic offers,
automatic fallback, and live GPS update triggers.
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceEmployeeSkill,
    WorkforceSkill,
)
from workforce_api.services.automatic_dispatch import (
    dispatch_pending_jobs,
    dispatch_job,
    expire_and_reassign_offers,
    reconsider_jobs_for_employee,
    MAX_GPS_AGE_SECONDS,
)

User = get_user_model()


def run_phase1_test():
    print("=" * 70)
    print("  PHASE 1: AUTOMATIC CROSS-APPLICATION DISPATCH ENGINE TEST")
    print("=" * 70)

    now = timezone.now()

    # 1. Setup Tenant Company
    company, _ = Company.objects.get_or_create(
        company_name="Phase1 Test Enterprise Co",
        defaults={"is_active": True}
    )

    # Setup Skill
    skill_elec, _ = WorkforceSkill.objects.get_or_create(
        name="Electrical Maintenance",
        company=company,
        defaults={"category": "Electrical", "code": "ELEC-P1"}
    )

    # 2. Setup Test Technicians:
    # Customer job coordinates: Bangalore Indiranagar Hub (12.9716, 77.5946)
    # Emp A: 12.9750, 77.5980 (~0.5 km away, FRESH GPS: 30s ago)
    # Emp B: 13.0300, 77.5946 (~6.5 km away, FRESH GPS: 60s ago)
    # Emp C: 12.9720, 77.5950 (~0.07 km away, STALE GPS: 600s / 10m ago)

    def create_or_prep_technician(username, emp_id_str, lat, lon, age_seconds):
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@test.com", "role": "employee", "first_name": username}
        )
        user.set_password("Pass123!")
        user.is_active = True
        user.last_known_location = {
            "latitude": lat,
            "longitude": lon,
            "updated_at": (now - timedelta(seconds=age_seconds)).isoformat(),
            "accuracy": 10.0,
        }
        user.save()

        emp, _ = Employee.objects.get_or_create(
            user=user,
            defaults={
                "employee_id": emp_id_str,
                "company": company,
                "is_active": True,
                "is_online": True,
                "current_availability": "available",
            }
        )
        emp.company = company
        emp.is_active = True
        emp.is_online = True
        emp.current_availability = "available"
        emp.bank_details = {
            "onboarding": {
                "status": "approved",
                "documents": {"id_proof": {"status": "approved"}},
                "services": [{"name": "Electrical Maintenance", "status": "approved"}],
                "draft": {"personal": {"city": "Bengaluru"}},
            },
            "attendance": {"is_clocked_in": True},
            "leaves": [],
        }
        emp.save()

        WorkforceEmployeeSkill.objects.get_or_create(
            employee=emp,
            skill=skill_elec,
            defaults={"proficiency_level": "INTERMEDIATE", "is_verified": True}
        )
        return emp

    emp_a = create_or_prep_technician("tech_p1_alpha", "EMP_P1_A", 12.9750, 77.5980, age_seconds=30)
    emp_b = create_or_prep_technician("tech_p1_beta", "EMP_P1_B", 13.0300, 77.5946, age_seconds=60)
    emp_c = create_or_prep_technician("tech_p1_charlie", "EMP_P1_C", 12.9720, 77.5950, age_seconds=600)  # STALE (> 300s)

    print(f"[OK] Technicians prepared:")
    print(f"  - Employee A ({emp_a.user.username}): 0.5 km, GPS age: 30s (FRESH)")
    print(f"  - Employee B ({emp_b.user.username}): 6.5 km, GPS age: 60s (FRESH)")
    print(f"  - Employee C ({emp_c.user.username}): 0.07 km, GPS age: 600s (STALE > {MAX_GPS_AGE_SECONDS}s)")

    # 3. Simulate External Customer Booking creation (Direct DB insertion without save hook)
    cust_user, _ = User.objects.get_or_create(
        username="p1_customer_ext",
        defaults={"email": "cust_p1@test.com", "role": "customer", "first_name": "CustP1"}
    )
    cust_user.set_password("Pass123!")
    cust_user.save()

    import uuid
    test_run_id = uuid.uuid4().hex[:6].upper()
    req_id_1 = f"SR-P1-EXT-{test_run_id}-1"
    req_id_2 = f"SR-P1-EXT-{test_run_id}-2"

    # Clean up any lingering test jobs for this test customer
    ServiceRequest.objects.filter(customer=cust_user).delete()

    # Use bulk_create to guarantee Django save() is bypassed completely
    ServiceRequest.objects.bulk_create([
        ServiceRequest(
            customer=cust_user,
            company=company,
            request_id=req_id_1,
            issue_title="Electrical Maintenance",
            service_category="Electrical Maintenance",
            status="confirmed",
            latitude=12.9716,
            longitude=77.5946,
            address="Indiranagar 100ft Road, Bengaluru",
            preferred_date=now.date(),
            preferred_time="10:00 AM",
        )
    ])
    job1 = ServiceRequest.objects.get(request_id=req_id_1)
    print(f"\n[OK] Simulated External Customer Job created directly in DB: #{job1.id} ({job1.request_id}, status={job1.status})")

    # Confirm that no offers exist yet
    assert WorkforceJobOffer.objects.filter(job=job1).count() == 0, "Precondition failed: Offers already exist!"

    # 4. Run Automatic Reconciliation (Cross-App Detection Engine)
    print("\n--- Running dispatch_pending_jobs() Reconciliation ---")
    recon_result = dispatch_pending_jobs(company_id=company.id)
    print(f"Reconciliation Result: {recon_result}")

    assert recon_result["pending_jobs_found"] >= 1, "Dispatcher failed to discover pending customer job!"
    assert recon_result["dispatched_count"] >= 1, "Dispatcher failed to dispatch job!"

    # 5. Verify Employee Selection:
    # A must receive the offer. C must be rejected due to stale GPS. B must NOT get the first exclusive offer.
    active_offer = WorkforceJobOffer.objects.filter(job=job1, status="OFFERED").first()
    assert active_offer is not None, "No active job offer created!"
    print(f"[OK] Active Exclusive Offer created: Offer #{active_offer.id} for Employee #{active_offer.employee_id} ({active_offer.employee.user.username})")

    assert active_offer.employee_id == emp_a.id, f"Wrong employee selected! Expected Emp A ({emp_a.id}), got {active_offer.employee_id}"
    print(f"[OK] TEST PASSED: Nearest eligible technician Employee A selected (0.5km). Stale Emp C (0.07km) correctly skipped.")

    # Verify notification created
    notif = WorkforceNotification.objects.filter(recipient=emp_a.user, notification_type="JOB_OFFER").order_by("-created_at").first()
    assert notif is not None, "JOB_OFFER notification was not created for Employee A!"
    print(f"[OK] Notification verified: '{notif.title}' -> {notif.message}")

    # 6. Verify Idempotency: Running dispatch again must not duplicate offers
    recon_idempotent = dispatch_pending_jobs(company_id=company.id)
    offers_count = WorkforceJobOffer.objects.filter(job=job1, status="OFFERED").count()
    assert offers_count == 1, f"Idempotency failed! Found {offers_count} active offers instead of 1."
    print("[OK] TEST PASSED: Dispatch reconciliation is completely idempotent.")

    # 7. Verify Fallback on Offer Decline
    print("\n--- Simulating Employee A Declines Offer ---")
    active_offer.status = "REJECTED"
    active_offer.rejection_reason = "Technician unavailable"
    active_offer.save()

    # Trigger fallback / reconciliation
    recon_fallback = dispatch_pending_jobs(company_id=company.id)
    print(f"Fallback Reconciliation Result: {recon_fallback}")

    offer_fallback = WorkforceJobOffer.objects.filter(job=job1, status="OFFERED").first()
    assert offer_fallback is not None, "Fallback failed to create next offer!"
    assert offer_fallback.employee_id == emp_b.id, f"Fallback picked wrong employee! Expected Emp B ({emp_b.id}), got {offer_fallback.employee_id}"
    print(f"[OK] TEST PASSED: Automatic fallback offered job to next nearest technician Employee B (#{emp_b.id}, 6.5km).")

    # 8. Verify Live GPS Update Trigger
    print("\n--- Testing Live GPS Update Trigger for New Customer Job ---")
    ServiceRequest.objects.bulk_create([
        ServiceRequest(
            customer=cust_user,
            company=company,
            request_id=req_id_2,
            issue_title="Electrical Maintenance",
            service_category="Electrical Maintenance",
            status="new_request",
            latitude=12.9716,
            longitude=77.5946,
            address="MG Road, Bengaluru",
            preferred_date=now.date(),
            preferred_time="02:00 PM",
        )
    ])
    job2 = ServiceRequest.objects.get(request_id=req_id_2)
    print(f"Simulated new unassigned external job: #{job2.id} ({job2.request_id})")

    # Update Emp A's GPS to fresh telemetry and trigger reconsider_jobs_for_employee
    emp_a.user.last_known_location = {
        "latitude": 12.9740,
        "longitude": 77.5970,
        "updated_at": timezone.now().isoformat(),
        "accuracy": 5.0,
    }
    emp_a.user.save()

    reconsidered = reconsider_jobs_for_employee(emp_a)
    print(f"Reconsider jobs on GPS update returned: {reconsidered} jobs dispatched")
    assert reconsidered >= 1, "GPS trigger failed to reconsider pending job!"

    job2_offer = WorkforceJobOffer.objects.filter(job=job2, status="OFFERED").first()
    assert job2_offer is not None, "No offer created on GPS trigger!"
    assert job2_offer.employee_id == emp_a.id, f"Wrong employee offered on GPS trigger! Expected Emp A, got {job2_offer.employee_id}"
    print(f"[OK] TEST PASSED: Fresh GPS transmission immediately triggered automatic dispatch for Job #{job2.id}.")

    print("\n" + "=" * 70)
    print("  ALL PHASE 1 CROSS-APP AUTOMATIC DISPATCH TESTS PASSED 100%!")
    print("=" * 70)


if __name__ == "__main__":
    run_phase1_test()
