import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import WorkforceJobOffer
from workforce_api.views import WorkforceJobListView
from workforce_api.services.automatic_dispatch import (
    dispatch_job,
    dispatch_pending_jobs,
    reconsider_jobs_for_employee,
    get_eligible_candidates,
)

User = get_user_model()
factory = APIRequestFactory()
view = WorkforceJobListView.as_view()

print("=" * 80)
print("CUSTOMER BOOKING DISCOVERY & RECONCILIATION REGRESSION TEST")
print("=" * 80)

# Setup test employee
emp = Employee.objects.select_related("user", "company").filter(id=2).first()
assert emp is not None, "Employee #2 not found"
user = emp.user
token = str(RefreshToken.for_user(user).access_token)

print(f"Target Employee: ID={emp.id}, user='{user.username}', company_id={emp.company_id}")

# Complete any previous active jobs for this employee to make them available
ServiceRequest.objects.filter(assigned_employee=emp, status__in=["assigned", "accepted", "on_the_way", "en_route", "arrived", "in_progress", "proof_submitted"]).update(status="completed")
# Clean up any previous test offers for this employee
WorkforceJobOffer.objects.filter(employee=emp, status="OFFERED").delete()

# Ensure employee has valid GPS
now = timezone.now()
user.last_known_location = {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "lat": 12.9716,
    "lng": 77.5946,
    "updated_at": now.isoformat(),
    "captured_at": now.isoformat(),
}
user.save(update_fields=["last_known_location"])

# Set employee available
emp.current_availability = "available"
emp.is_online = True
emp.save(update_fields=["current_availability", "is_online"])

# Ensure employee has approved service
bank_details = emp.bank_details or {}
onboarding = bank_details.get("onboarding", {})
onboarding["status"] = "approved"
onboarding["services"] = [
    {"id": 9999, "name": "AC Repair & Diagnostics", "category": "hvac", "status": "approved"}
]
bank_details["onboarding"] = onboarding
emp.bank_details = bank_details
emp.save(update_fields=["bank_details"])

# --- Test 1: Existing Confirmed Customer Booking Discovery ---
# Simulate Customer Application inserting directly into Supabase (bulk_create bypasses Django save() hooks)
print("\n--- Test 1: Existing Confirmed Customer Booking Discovery ---")
sr1_obj = ServiceRequest(
    company=emp.company,
    customer=User.objects.filter(is_active=True, role="customer").first(),
    customer_name="Customer App Booking",
    phone="9876543210",
    service_category="hvac",
    issue_title="AC Repair & Diagnostics",
    address="100 Discovery Boulevard",
    preferred_date=now.date(),
    latitude=12.9720,
    longitude=77.5950,
    status="confirmed",
    assigned_employee=None,
    otp_attempt_count=0,
    otp_hash="",
    request_id=f"SR-DISCOVERY-{int(now.timestamp())}",
)
ServiceRequest.objects.bulk_create([sr1_obj])
sr1 = ServiceRequest.objects.get(request_id=sr1_obj.request_id)

try:
    # Verify no offer exists initially (as Customer App wrote directly to Supabase)
    assert WorkforceJobOffer.objects.filter(job=sr1).count() == 0, "Offer should not exist before discovery runs!"

    # Run discovery / reconsideration on Workforce backend
    res_recon = reconsider_jobs_for_employee(emp)
    print(f"  Reconsideration result: {res_recon} jobs dispatched")
    assert res_recon >= 1, "Failed to dispatch pending customer booking!"

    # Verify offer was created
    offer1 = WorkforceJobOffer.objects.filter(job=sr1, employee=emp, status="OFFERED").first()
    assert offer1 is not None, "WorkforceJobOffer was not created for employee!"
    print(f"  [PASS] Offer #{offer1.id} created for Job #{sr1.id} -> Employee #{emp.id}")

    # Verify Workforce jobs API returns the job as an offer
    req = factory.get("/api/workforce/jobs/?status=all", HTTP_AUTHORIZATION=f"Bearer {token}")
    res = view(req)
    assert res.status_code == 200
    found_job = next((j for j in res.data if j["id"] == sr1.id), None)
    assert found_job is not None, "Offered job was not returned in Workforce jobs API!"
    assert found_job["is_offer"] is True
    print(f"  [PASS] Workforce Jobs API returned offered Job #{sr1.id} (is_offer=True).")

    # --- Test 3: Reconciliation Idempotency ---
    print("\n--- Test 3: Reconciliation Idempotency ---")
    res_recon_again = reconsider_jobs_for_employee(emp)
    print(f"  Second reconsideration result: {res_recon_again}")
    offer_count = WorkforceJobOffer.objects.filter(job=sr1, status="OFFERED").count()
    assert offer_count == 1, f"Duplicate offers created! Count={offer_count}"
    print(f"  [PASS] Idempotency verified: exactly 1 active offer exists.")

    # --- Test 5: Authorization & Tenant Isolation ---
    print("\n--- Test 5: Authorization & Tenant Isolation ---")
    # Query with another employee
    other_emp = Employee.objects.select_related("user").filter(is_active=True, user__is_active=True).exclude(id=emp.id).first()
    if other_emp:
        other_token = str(RefreshToken.for_user(other_emp.user).access_token)
        req_other = factory.get("/api/workforce/jobs/?status=all", HTTP_AUTHORIZATION=f"Bearer {other_token}")
        res_other = view(req_other)
        assert res_other.status_code == 200
        found_by_other = next((j for j in res_other.data if j["id"] == sr1.id), None)
        assert found_by_other is None, "Unauthorized employee was able to see the job offer!"
        print(f"  [PASS] Tenant & employee isolation verified: Other Employee #{other_emp.id} cannot see Job #{sr1.id}.")

finally:
    WorkforceJobOffer.objects.filter(job=sr1).delete()
    sr1.delete()

# --- Test 2: Booking Initially Stranded (No Eligible Tech) -> Recovered Later ---
print("\n--- Test 2: Booking Initially Stranded (No Eligible Tech) -> Recovered on Eligibility ---")
sr2_obj = ServiceRequest(
    company=emp.company,
    customer=User.objects.filter(is_active=True, role="customer").first(),
    customer_name="Stranded Customer",
    phone="9876543210",
    service_category="hvac",
    issue_title="AC Repair & Diagnostics",
    address="200 Recovery Boulevard",
    preferred_date=now.date(),
    latitude=12.9720,
    longitude=77.5950,
    status="confirmed",
    assigned_employee=None,
    otp_attempt_count=0,
    otp_hash="",
    request_id=f"SR-STRANDED-{int(now.timestamp())}",
)
ServiceRequest.objects.bulk_create([sr2_obj])
sr2 = ServiceRequest.objects.get(request_id=sr2_obj.request_id)

try:
    # 1. Employee is OFFLINE
    emp.is_online = False
    emp.current_availability = "offline"
    emp.save(update_fields=["is_online", "current_availability"])

    # Run discovery -> Should not dispatch
    res_off = reconsider_jobs_for_employee(emp)
    print(f"  Discovery with tech offline: {res_off}")
    assert WorkforceJobOffer.objects.filter(job=sr2).count() == 0
    sr2.refresh_from_db()
    assert sr2.assigned_employee is None
    print(f"  [PASS] Booking remains safely unassigned while no tech is eligible.")

    # 2. Employee comes ONLINE & AVAILABLE
    emp.is_online = True
    emp.current_availability = "available"
    emp.save(update_fields=["is_online", "current_availability"])

    # Trigger reconsideration (e.g. via dashboard load or presence toggle)
    reconsidered_count = reconsider_jobs_for_employee(emp)
    print(f"  Reconsideration when tech comes online: {reconsidered_count}")
    assert reconsidered_count >= 1, "Failed to recover and dispatch stranded booking!"

    offer2 = WorkforceJobOffer.objects.filter(job=sr2, employee=emp, status="OFFERED").first()
    assert offer2 is not None, "Offer was not created after technician became eligible!"
    print(f"  [PASS] Stranded booking successfully recovered and offered: Offer #{offer2.id} for Job #{sr2.id}.")

finally:
    WorkforceJobOffer.objects.filter(job=sr2).delete()
    sr2.delete()

print("\n" + "=" * 80)
print("ALL DISCOVERY & RECONCILIATION REGRESSION TESTS PASSED (100%)!")
print("=" * 80)
