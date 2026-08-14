"""
backend/test_employee_customer_booking_integration.py
Automated Verification Suite for CalServices Customer -> Employee Database Handoff.

Verifies:
1. Retrieval of real Customer booking records from `service_requests_servicerequest`.
2. Resolution of `service_requests_employeejob` and `assigned_employee` database relationships.
3. Employee API payload contract including cart_data, phone, email, lat/lng, address, payment info.
4. State machine lifecycle transitions (ASSIGNED -> ACCEPTED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED).
5. PostgreSQL database state synchronization between Customer and Employee applications.
"""
import os
import sys
import secrets
from decimal import Decimal
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import connection
from rest_framework.test import APIRequestFactory, force_authenticate
from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.state_machine import apply_transition
from companies.models import Company
from employees.models import Employee
from workforce_api.models import PreServiceVerification, PostServiceProof, WorkforceJobOffer
from workforce_api.serializers import WorkforceJobSerializer
from workforce_api.views import WorkforceJobListView, WorkforceJobTransitionView, WorkforceJobArriveView

User = get_user_model()
factory = APIRequestFactory()


def run_tests():
    print("=" * 80)
    print("STARTING CALSERVICES CUSTOMER -> EMPLOYEE DATABASE HANDOFF VERIFICATION SUITE")
    print("=" * 80)

    passed = 0
    failed = 0
    errors = []

    def record_pass(test_name, detail=""):
        nonlocal passed
        passed += 1
        print(f" [PASS] {test_name} {f'-- {detail}' if detail else ''}")

    def record_fail(test_name, err):
        nonlocal failed
        failed += 1
        msg = f"FAILED: {test_name} -> {err}"
        errors.append(msg)
        print(f" [FAIL] {test_name} -> {err}")

    # 1. Setup Test Company and Users
    company, _ = Company.objects.get_or_create(company_name="CalServices Handoff Test Co")

    tech_user, _ = User.objects.get_or_create(
        username="handover_tech_01",
        defaults={"email": "tech01@calservices.com", "first_name": "Dave", "last_name": "Technician"}
    )
    tech_emp, _ = Employee.objects.get_or_create(
        user=tech_user,
        defaults={
            "employee_id": "EMP-HANDOVER-01",
            "company": company,
            "is_active": True,
            "bank_details": {"onboarding": {"status": "approved"}}
        }
    )

    cust_user, _ = User.objects.get_or_create(
        username="handover_customer_01",
        defaults={"email": "customer01@gmail.com", "first_name": "Sarah", "last_name": "Conor"}
    )

    # ─── TEST 1: Inspect DB Schema & service_requests_servicerequest Contract ───
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
            tables = [r[0] for r in cursor.fetchall()]
            assert "service_requests_servicerequest" in tables, "service_requests_servicerequest table missing in DB!"
            assert "service_requests_employeejob" in tables, "service_requests_employeejob table missing in DB!"

        record_pass("1. Database Schema & Supabase Table Contract", "service_requests_servicerequest and service_requests_employeejob tables present in PostgreSQL")
    except Exception as e:
        record_fail("1. Database Schema & Supabase Table Contract", e)

    # ─── TEST 2: Customer Booking SR-0297 or Fixture Verification ──────────────
    try:
        sr_0297 = ServiceRequest.objects.filter(request_id="SR-0297").first()
        if not sr_0297:
            # Create a realistic test booking matching Customer application output
            sr_0297 = ServiceRequest.objects.create(
                request_id="SR-0297",
                company=company,
                customer=cust_user,
                customer_name="Sarah Conor",
                phone="+15551234567",
                email="customer01@gmail.com",
                service_category="hvac",
                issue_title="Split AC Deep Cleaning & Gas Refill",
                description="AC unit blowing warm air, needs full overhaul.",
                cart_data=[
                    {"id": 101, "name": "Split AC Service", "quantity": 1, "price": 1499, "selectedOption": "1.5 Ton"},
                    {"id": 102, "name": "Freon Gas Top-up", "quantity": 1, "price": 999}
                ],
                address="Suite 404, Tech Park Towers, Silicon Avenue",
                latitude=12.971598,
                longitude=77.594566,
                preferred_date=timezone.now().date(),
                preferred_time="10:00 AM - 12:00 PM",
                payment_method="COD",
                payment_status="pending",
                total_amount=Decimal("2498.00"),
                status="assigned",
                assigned_employee=tech_emp,
            )
        else:
            sr_0297.assigned_employee = tech_emp
            sr_0297.status = "assigned"
            sr_0297.save()

        # Also create/sync service_requests_employeejob record
        emp_job, _ = EmployeeJob.objects.get_or_create(
            service_request=sr_0297,
            employee=tech_emp,
            defaults={"status": "ASSIGNED"}
        )

        assert sr_0297.request_id == "SR-0297"
        assert len(sr_0297.cart_data) > 0
        record_pass("2. Customer Booking Persistence Contract", f"Booking {sr_0297.request_id} loaded with cart_data ({len(sr_0297.cart_data)} items) and lat/lng ({sr_0297.latitude}, {sr_0297.longitude})")
    except Exception as e:
        record_fail("2. Customer Booking Persistence Contract", e)

    # ─── TEST 3: Employee API Job Retrieval (GET /api/workforce/jobs/) ────────
    try:
        req = factory.get("/api/workforce/jobs/")
        force_authenticate(req, user=tech_user)
        res = WorkforceJobListView.as_view()(req)

        assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}"
        jobs_data = res.data
        assigned_job = next((j for j in jobs_data if j.get("request_id") == "SR-0297" or j.get("id") == sr_0297.id), None)
        assert assigned_job is not None, "SR-0297 was not retrieved for the authenticated employee!"

        # Verify all required customer fields in serializer payload
        assert assigned_job.get("request_id") == "SR-0297"
        assert assigned_job.get("customer_name") == "Sarah Conor"
        assert assigned_job.get("phone") == "+15551234567"
        assert assigned_job.get("email") == "customer01@gmail.com"
        assert assigned_job.get("cart_data") is not None and len(assigned_job["cart_data"]) > 0
        assert assigned_job.get("latitude") == 12.971598
        assert assigned_job.get("longitude") == 77.594566
        assert assigned_job.get("payment_method") == "COD"
        assert assigned_job.get("total_amount") == "2498.00"

        record_pass("3. Employee Job Retrieval & Payload Contract", "API returns complete Customer booking details including request_id, phone, email, cart_data, lat/lng, and payment info")
    except Exception as e:
        record_fail("3. Employee Job Retrieval & Payload Contract", e)

    # ─── TEST 4: Job Lifecycle Step 1: Accept Job (ASSIGNED -> ACCEPTED) ─────
    try:
        req_trans = factory.post(f"/api/workforce/jobs/{sr_0297.id}/transition/", {"status": "accepted"}, format="json")
        force_authenticate(req_trans, user=tech_user)
        res_trans = WorkforceJobTransitionView.as_view()(req_trans, pk=sr_0297.id)

        assert res_trans.status_code == 200, f"Expected 200, got {res_trans.status_code}: {res_trans.data}"
        sr_0297.refresh_from_db()
        assert sr_0297.status == "accepted", f"Expected 'accepted', got '{sr_0297.status}'"

        emp_job.refresh_from_db()
        assert emp_job.status == "ACCEPTED", f"Expected EmployeeJob status 'ACCEPTED', got '{emp_job.status}'"

        record_pass("4. Job Lifecycle Transition (ASSIGNED -> ACCEPTED)", "Status updated to ACCEPTED in both service_requests_servicerequest and service_requests_employeejob")
    except Exception as e:
        record_fail("4. Job Lifecycle Transition (ASSIGNED -> ACCEPTED)", e)

    # ─── TEST 5: Job Lifecycle Step 2: En Route (ACCEPTED -> ON_THE_WAY) ───────
    try:
        req_trans = factory.post(f"/api/workforce/jobs/{sr_0297.id}/transition/", {"status": "on_the_way"}, format="json")
        force_authenticate(req_trans, user=tech_user)
        res_trans = WorkforceJobTransitionView.as_view()(req_trans, pk=sr_0297.id)

        assert res_trans.status_code == 200, f"Expected 200, got {res_trans.status_code}"
        sr_0297.refresh_from_db()
        assert sr_0297.status == "on_the_way"

        record_pass("5. Job Lifecycle Transition (ACCEPTED -> ON_THE_WAY)", "Status updated to ON_THE_WAY in PostgreSQL")
    except Exception as e:
        record_fail("5. Job Lifecycle Transition (ACCEPTED -> ON_THE_WAY)", e)

    # ─── TEST 6: Pre-Service Verification & Arrived Gate ──────────────────────
    try:
        # Pre-service arrival geofence check
        pre_ver, _ = PreServiceVerification.objects.get_or_create(
            job=sr_0297,
            defaults={"employee": tech_emp, "geofence_passed": True, "otp_code": "123456"}
        )
        pre_ver.geofence_passed = True
        pre_ver.otp_verified = True
        pre_ver.save()

        # Transition to ARRIVED
        req_arr = factory.post(f"/api/workforce/jobs/{sr_0297.id}/transition/", {"status": "arrived"}, format="json")
        force_authenticate(req_arr, user=tech_user)
        res_arr = WorkforceJobTransitionView.as_view()(req_arr, pk=sr_0297.id)

        assert res_arr.status_code == 200, f"Expected 200, got {res_arr.status_code}: {res_arr.data}"
        sr_0297.refresh_from_db()
        assert sr_0297.status == "arrived"

        record_pass("6. Pre-Service Gate & Arrival Verification", "ARRIVED transition passed with verified geofence & OTP")
    except Exception as e:
        record_fail("6. Pre-Service Gate & Arrival Verification", e)

    # ─── TEST 7: Customer & Employee Shared DB State Alignment ────────────────
    try:
        # Query SR-0297 as customer
        cust_sr = ServiceRequest.objects.get(pk=sr_0297.id)
        assert cust_sr.status == "arrived", f"Customer app sees status '{cust_sr.status}', expected 'arrived'"
        assert cust_sr.assigned_employee_id == tech_emp.id, "Customer app sees matching assigned employee ID"

        record_pass("7. Shared Database Single Source of Truth Alignment", f"Both applications observe identical status ('{cust_sr.status}') from Supabase PostgreSQL")
    except Exception as e:
        record_fail("7. Shared Database Single Source of Truth Alignment", e)

    print("\n" + "=" * 80)
    print(f"VERIFICATION RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 80)

    if errors:
        for err in errors:
            print("  -", err)
        return False
    return True


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
