import os
import sys
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User
from employees.models import Employee
from companies.models import Company
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import WorkforceJobOffer
from workforce_api.views import (
    WorkforceJobListView,
    WorkforceJobAcceptOfferView,
    WorkforceJobRejectOfferView,
)
from workforce_api.services.automatic_dispatch import dispatch_job

def run_tests():
    print("=================================================================")
    print("RUNNING ACCEPT / DECLINE END-TO-END VERIFICATION TEST SUITE")
    print("=================================================================")

    # 1. Setup Test Company and Employee
    company, _ = Company.objects.get_or_create(company_name="Test Acceptance Company")
    user_tech, _ = User.objects.get_or_create(
        username="test_tech_acceptance_user",
        defaults={"role": "employee", "first_name": "Test", "last_name": "Technician"}
    )
    user_tech.role = "employee"
    user_tech.is_active = True
    user_tech.last_known_location = {
        "latitude": 12.7545,
        "longitude": 77.8340,
        "updated_at": timezone.now().isoformat()
    }
    user_tech.save()

    emp, _ = Employee.objects.get_or_create(
        user=user_tech,
        defaults={
            "company": company,
            "is_active": True,
            "is_online": True,
            "current_availability": "available",
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "documents": {"aadhaar": {"status": "approved"}},
                    "services": [{"name": "hvac", "status": "approved"}]
                }
            }
        }
    )
    emp.company = company
    emp.is_active = True
    emp.is_online = True
    emp.current_availability = "available"
    emp.bank_details = {
        "onboarding": {
            "status": "approved",
            "documents": {"aadhaar": {"status": "approved"}},
            "services": [{"name": "hvac", "status": "approved"}]
        }
    }
    emp.save()

    factory = APIRequestFactory()

    # Clean up any existing active jobs/offers for this test employee
    WorkforceJobOffer.objects.filter(employee=emp).delete()
    EmployeeJob.objects.filter(employee=emp).delete()
    ServiceRequest.objects.filter(assigned_employee=emp).update(assigned_employee=None, status="completed")

    print(f"[OK] Setup completed for Test Employee #{emp.id} ({user_tech.username})")

    # -------------------------------------------------------------
    # TEST 1: Job Offer Creation & Visibility in WorkforceJobListView
    # -------------------------------------------------------------
    print("\n--- TEST 1: Offer Creation & Visibility ---")
    job1 = ServiceRequest.objects.create(
        company=company,
        service_category="hvac",
        issue_title="AC Cooling Diagnostic",
        address="123 Test St",
        latitude=12.7545,
        longitude=77.8340,
        preferred_date=timezone.now().date(),
        status="unassigned",
        total_amount=499
    )

    success, msg = dispatch_job(job1)
    print(f"Dispatch status: success={success}, msg={msg}")
    assert success, f"Dispatch failed: {msg}"

    offer1 = WorkforceJobOffer.objects.filter(job=job1, employee=emp, status="OFFERED").first()
    assert offer1 is not None, "Expected active OFFERED record for job1 and emp"
    assert job1.assigned_employee is None or job1.assigned_employee == emp

    # Check WorkforceJobListView as emp
    req = factory.get('/api/workforce/jobs/?status=all')
    force_authenticate(req, user=user_tech)
    res = WorkforceJobListView.as_view()(req)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    offered_jobs = [j for j in res.data if j["id"] == job1.id]
    assert len(offered_jobs) == 1, "Expected job1 in technician jobs list"
    assert offered_jobs[0]["active_offer"] is not None
    assert offered_jobs[0]["active_offer"]["status"] == "OFFERED"
    print(f"[PASS] TEST 1 PASSED: Job #{job1.id} is offered and visible in technician job list with active_offer.")

    # -------------------------------------------------------------
    # TEST 2: Decline Job Offer -> Must NOT be accepted or in active queue
    # -------------------------------------------------------------
    print("\n--- TEST 2: Decline Job Offer Verification ---")
    req_decline = factory.post(f'/api/workforce/jobs/{job1.id}/reject-offer/', {"reason": "Too far away from current site"})
    force_authenticate(req_decline, user=user_tech)
    res_decline = WorkforceJobRejectOfferView.as_view()(req_decline, pk=job1.id)
    assert res_decline.status_code == 200, f"Expected 200 from decline, got {res_decline.status_code}: {res_decline.data}"

    # Verify DB state
    offer1.refresh_from_db()
    job1.refresh_from_db()
    assert offer1.status == "REJECTED", f"Expected offer1 status REJECTED, got {offer1.status}"
    assert offer1.rejection_reason == "Too far away from current site", f"Unexpected reason: {offer1.rejection_reason}"
    assert job1.assigned_employee is None, f"Expected assigned_employee is None, got {job1.assigned_employee}"
    assert job1.status == "unassigned", f"Expected job1 status unassigned, got {job1.status}"

    # Check WorkforceJobListView as emp -> job1 must NOT be returned in active queue
    req = factory.get('/api/workforce/jobs/?status=all')
    force_authenticate(req, user=user_tech)
    res = WorkforceJobListView.as_view()(req)
    declined_in_list = [j for j in res.data if j["id"] == job1.id]
    assert len(declined_in_list) == 0, f"Declined job #{job1.id} must NOT appear in technician job list!"
    print(f"[PASS] TEST 2 PASSED: Job #{job1.id} declined. Status is unassigned, assigned_employee is None, and it disappeared from technician list.")

    # -------------------------------------------------------------
    # TEST 3: Accept Job Offer -> Correct Acceptance Transition
    # -------------------------------------------------------------
    print("\n--- TEST 3: Accept Job Offer Verification ---")
    job2 = ServiceRequest.objects.create(
        company=company,
        service_category="hvac",
        issue_title="AC Gas Refill",
        address="456 Test Ave",
        latitude=12.7545,
        longitude=77.8340,
        preferred_date=timezone.now().date(),
        status="unassigned",
        total_amount=799
    )
    success, msg = dispatch_job(job2)
    assert success, f"Dispatch failed for job2: {msg}"

    offer2 = WorkforceJobOffer.objects.filter(job=job2, employee=emp, status="OFFERED").first()
    assert offer2 is not None, "Expected offer2 for emp"

    # Technician accepts offer
    req_accept = factory.post(f'/api/workforce/jobs/{job2.id}/accept-offer/')
    force_authenticate(req_accept, user=user_tech)
    res_accept = WorkforceJobAcceptOfferView.as_view()(req_accept, pk=job2.id)
    assert res_accept.status_code == 200, f"Expected 200 from accept, got {res_accept.status_code}: {res_accept.data}"

    # Verify DB state
    offer2.refresh_from_db()
    job2.refresh_from_db()
    emp_job2 = EmployeeJob.objects.filter(service_request=job2, employee=emp).first()

    assert offer2.status == "ACCEPTED", f"Expected offer2 status ACCEPTED, got {offer2.status}"
    assert job2.status == "on_the_way", f"Expected job2 status on_the_way, got {job2.status}"
    assert job2.assigned_employee == emp, f"Expected assigned_employee == emp, got {job2.assigned_employee}"
    assert emp_job2 is not None and emp_job2.status == "ON_THE_WAY", f"Expected EmployeeJob ON_THE_WAY, got {emp_job2}"

    # Check WorkforceJobListView as emp -> job2 MUST be present as active accepted job
    req = factory.get('/api/workforce/jobs/?status=all')
    force_authenticate(req, user=user_tech)
    res = WorkforceJobListView.as_view()(req)
    accepted_in_list = [j for j in res.data if j["id"] == job2.id]
    assert len(accepted_in_list) == 1, f"Accepted job #{job2.id} must appear in technician list!"
    assert accepted_in_list[0]["status"] == "on_the_way"
    print(f"[PASS] TEST 3 PASSED: Job #{job2.id} accepted. Status is on_the_way, assigned_employee is set, and it is in active queue.")

    # -------------------------------------------------------------
    # TEST 4: Expired Offer Exclusion in WorkforceJobListView
    # -------------------------------------------------------------
    print("\n--- TEST 4: Expired Offer Exclusion Verification ---")
    job3 = ServiceRequest.objects.create(
        company=company,
        service_category="hvac",
        issue_title="AC General Maintenance",
        address="789 Test Blvd",
        latitude=12.7545,
        longitude=77.8340,
        preferred_date=timezone.now().date(),
        status="assigned",
        total_amount=399
    )
    offer3 = WorkforceJobOffer.objects.create(
        job=job3,
        employee=emp,
        status="OFFERED",
        expires_at=timezone.now() - timedelta(minutes=10) # Expired in past
    )

    req = factory.get('/api/workforce/jobs/?status=all')
    force_authenticate(req, user=user_tech)
    res = WorkforceJobListView.as_view()(req)
    expired_in_list = [j for j in res.data if j["id"] == job3.id]
    assert len(expired_in_list) == 0, f"Expired offer for job #{job3.id} must NOT be returned in technician job list!"
    print(f"[PASS] TEST 4 PASSED: Expired offer for Job #{job3.id} is correctly excluded from technician list.")

    # Clean up test data
    ServiceRequest.objects.filter(company=company).delete()
    user_tech.delete()
    company.delete()

    print("\n=================================================================")
    print("ALL ACCEPT / DECLINE WORKFLOW TESTS PASSED PERFECTLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
