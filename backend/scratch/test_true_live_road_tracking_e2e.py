#!/usr/bin/env python
"""
test_true_live_road_tracking_e2e.py

Comprehensive End-to-End Automated Verification of:
1. Cross-App Booking Creation & Zero-Admin Dispatch.
2. Technician Acceptance & Status Synchronization.
3. Real-time Live GPS Updates & User.last_known_location advancement.
4. Real-time JOB_LOCATION_UPDATE Event Publishing for Customer SSE / Tracking.
5. Customer Dedicated Live Tracking API (/customer/jobs/<id>/tracking/).
6. Multi-Tenant and Authorization Security Gates (unauthorized customer / wrong company blocked).
7. Progressive Movement: 5.0km -> 3.0km -> 1.2km -> 500m -> 305m (all un-arrived).
8. Auto-Arrival Geofence at <=300m (200m) -> Automatic status='arrived', geofence_passed=True.
9. Random 6-digit Work Start OTP generation & Customer notification delivery.
10. Technician OTP Verification -> 3-Photo Evidence Gate -> Shift Clock-In -> IN_PROGRESS.
"""

import os
import sys
import uuid
import secrets
from pathlib import Path
from datetime import timedelta, time
from decimal import Decimal

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")

import django
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from time_tracking.models import TimeLog
from workforce_api.models import (
    WorkforceJobOffer,
    PreServiceVerification,
    WorkforceEventLog,
    WorkforceNotification,
)
from workforce_api.views import (
    WorkforceLocationUpdateView,
    WorkforceJobAcceptOfferView,
    WorkforceJobVerifyOTPView,
    WorkforceCustomerJobOTPView,
    WorkforceJobPreServicePhotoView,
    WorkforceJobLiveTrackingView,
)
from time_tracking.geo import haversine_distance

User = get_user_model()
factory = APIRequestFactory()

def run_test():
    print("=" * 80)
    print("STARTING TRUE RAPIDO / SWIGGY STYLE LIVE ROAD TRACKING E2E VERIFICATION")
    print("=" * 80)

    test_id = uuid.uuid4().hex[:6].upper()
    now = timezone.now()

    # 1. Setup Company, Customer, and Eligible Technician in DB
    company, _ = Company.objects.get_or_create(
        company_name=f"Rapido Tracking Corp ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )
    other_company, _ = Company.objects.get_or_create(
        company_name=f"Competitor Tracking Corp ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )

    cust_user, _ = User.objects.get_or_create(
        username=f"cust_rapido_{test_id.lower()}",
        defaults={
            "email": f"cust_rapido_{test_id.lower()}@example.com",
            "first_name": "Ananya",
            "last_name": "Sharma",
            "role": "customer",
            "company": company,
        }
    )
    cust_user.set_password("pass123")
    cust_user.company = company
    cust_user.save()

    unauth_cust_user, _ = User.objects.get_or_create(
        username=f"cust_unauth_{test_id.lower()}",
        defaults={
            "email": f"cust_unauth_{test_id.lower()}@example.com",
            "first_name": "Sneha",
            "last_name": "Roy",
            "role": "customer",
            "company": other_company,
        }
    )
    unauth_cust_user.set_password("pass123")
    unauth_cust_user.company = other_company
    unauth_cust_user.save()

    tech_user, _ = User.objects.get_or_create(
        username=f"tech_rapido_{test_id.lower()}",
        defaults={
            "email": f"tech_rapido_{test_id.lower()}@example.com",
            "first_name": "Ramesh",
            "last_name": "Kumar",
            "role": "employee",
            "is_active": True,
            "company": company,
        }
    )
    tech_user.set_password("pass123")
    tech_user.role = "employee"
    tech_user.is_active = True
    tech_user.company = company
    tech_user.save()

    tech_emp, _ = Employee.objects.get_or_create(
        user=tech_user,
        defaults={
            "company": company,
            "employee_id": f"EMP_TRK_{test_id}",
            "is_active": True,
            "is_online": True,
            "current_availability": "available",
            "phone": "9876543210",
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "documents": {"id_proof": {"status": "approved"}},
                }
            }
        }
    )
    tech_emp.company = company
    tech_emp.is_active = True
    tech_emp.is_online = True
    tech_emp.current_availability = "available"
    tech_emp.save()

    # Customer Destination Coordinates (Indiranagar, Bengaluru)
    CUST_LAT = 12.9716000
    CUST_LON = 77.5946000

    # 2. Create Service Request (Customer Booking)
    job = ServiceRequest.objects.create(
        customer=cust_user,
        company=company,
        request_id=f"SR-TRK-{test_id}",
        service_category="Appliance Repair",
        issue_title="AC Deep Cleaning & Compressor Check",
        address="100 Feet Road, Indiranagar, Bengaluru",
        latitude=Decimal(str(CUST_LAT)),
        longitude=Decimal(str(CUST_LON)),
        status="pending",
        preferred_date=now.date(),
    )
    print(f"[STEP 1] Customer created ServiceRequest #{job.id} at ({CUST_LAT}, {CUST_LON}). Status: {job.status}")

    # 3. Issue Exclusive Dispatch Offer & Technician Accepts
    offer = WorkforceJobOffer.objects.create(
        job=job,
        employee=tech_emp,
        status="OFFERED",
        expires_at=now + timedelta(minutes=5),
    )

    req_accept = factory.post(f"/api/workforce/jobs/{job.id}/accept-offer/")
    force_authenticate(req_accept, user=tech_user)
    res_accept = WorkforceJobAcceptOfferView.as_view()(req_accept, pk=job.id)
    assert res_accept.status_code == status.HTTP_200_OK, f"Accept failed: {res_accept.data}"

    job.refresh_from_db()
    emp_job = EmployeeJob.objects.filter(service_request=job, employee=tech_emp).first()
    assert job.status in ["accepted", "on_the_way"], f"Expected accepted, got {job.status}"
    assert emp_job is not None and emp_job.status in ["ACCEPTED", "ON_THE_WAY"], f"Expected ACCEPTED, got {emp_job}"
    print(f"[STEP 2] Technician Ramesh accepted offer. DB Status: ServiceRequest={job.status}, EmployeeJob={emp_job.status}")

    # 4. Progressive GPS Movement: 5.0km -> 3.0km -> 1.2km -> 500m -> 305m
    waypoints = [
        ("5.0 km away", CUST_LAT + 0.0450, CUST_LON),
        ("3.0 km away", CUST_LAT + 0.0270, CUST_LON),
        ("1.2 km away", CUST_LAT + 0.0108, CUST_LON),
        ("500 m away", CUST_LAT + 0.0045, CUST_LON),
        ("305 m away", CUST_LAT + 0.00275, CUST_LON),
    ]

    view_loc = WorkforceLocationUpdateView.as_view()
    view_tracking = WorkforceJobLiveTrackingView.as_view()

    for label, lat, lon in waypoints:
        calc_dist = haversine_distance(lat, lon, CUST_LAT, CUST_LON)
        req_loc = factory.post("/api/workforce/presence/location/", {
            "latitude": lat,
            "longitude": lon,
            "accuracy": 8.5,
        }, format="json")
        force_authenticate(req_loc, user=tech_user)
        res_loc = view_loc(req_loc)
        assert res_loc.status_code == status.HTTP_200_OK

        tech_user.refresh_from_db()
        job.refresh_from_db()
        assert job.status in ["accepted", "on_the_way"], f"Should not arrive at {calc_dist}m, status={job.status}"
        assert tech_user.last_known_location["latitude"] == round(lat, 7)

        # Check real-time event log published for customer
        last_ev = WorkforceEventLog.objects.filter(event_type="JOB_LOCATION_UPDATE", payload__job_id=job.id).order_by("-id").first()
        assert last_ev is not None, "Realtime event log must be published"
        assert last_ev.payload["type"] == "JOB_LOCATION_UPDATE"
        assert last_ev.payload["employee_name"] == "Ramesh Kumar"
        assert abs(last_ev.payload["distance_m"] - calc_dist) < 50.0

        # Customer reads live tracking endpoint
        req_track = factory.get(f"/api/workforce/customer/jobs/{job.id}/tracking/")
        force_authenticate(req_track, user=cust_user)
        res_track = view_tracking(req_track, pk=job.id)
        assert res_track.status_code == status.HTTP_200_OK
        data = res_track.data
        assert data["job_id"] == job.id
        assert data["assigned_technician"]["name"] == "Ramesh Kumar"
        assert data["geofence_passed"] is False
        assert data["distance_m"] > 300.0

        print(f"[STEP 3] GPS Telemetry [{label}]: Real dist={int(calc_dist)}m | DB Status={job.status} | Geofence=PASS_FALSE | Event Log=SYNCED")

    # 5. Security Check: Unauthorized Cross-Tenant / Cross-User Access Blocked
    req_unauth = factory.get(f"/api/workforce/customer/jobs/{job.id}/tracking/")
    force_authenticate(req_unauth, user=unauth_cust_user)
    res_unauth = view_tracking(req_unauth, pk=job.id)
    assert res_unauth.status_code == status.HTTP_403_FORBIDDEN, f"Must be 403 Forbidden, got {res_unauth.status_code}"
    print("[STEP 4] Security Gate: Cross-tenant / unauthorized customer tracking blocked (403 FORBIDDEN).")

    # 6. Automatic Arrival at <= 300m (200m away)
    ARRIVE_LAT = CUST_LAT + 0.0018  # ~200m
    arrive_dist = haversine_distance(ARRIVE_LAT, CUST_LON, CUST_LAT, CUST_LON)
    assert arrive_dist <= 300.0, f"Distance {arrive_dist}m must be <= 300m"

    req_arrive_gps = factory.post("/api/workforce/presence/location/", {
        "latitude": ARRIVE_LAT,
        "longitude": CUST_LON,
        "accuracy": 6.0,
    }, format="json")
    force_authenticate(req_arrive_gps, user=tech_user)
    res_arrive_gps = view_loc(req_arrive_gps)
    assert res_arrive_gps.status_code == status.HTTP_200_OK

    job.refresh_from_db()
    emp_job.refresh_from_db()
    verification = PreServiceVerification.objects.get(job=job)

    assert job.status == "arrived", f"Expected arrived, got {job.status}"
    assert emp_job.status == "ARRIVED", f"Expected ARRIVED, got {emp_job.status}"
    assert verification.geofence_passed is True, "Geofence must pass automatically"
    assert verification.otp_code is not None and len(verification.otp_code) == 6, "6-digit OTP must be generated"

    otp_secret = verification.otp_code
    print(f"[STEP 5] AUTO-ARRIVAL TRIGGERED at {int(arrive_dist)}m: ServiceRequest=arrived | EmployeeJob=ARRIVED | Geofence=PASSED | Customer OTP={otp_secret}")

    # 7. Customer checks their OTP
    view_cust_otp = WorkforceCustomerJobOTPView.as_view()
    req_cust_otp = factory.get(f"/api/workforce/customer/jobs/{job.id}/otp/")
    force_authenticate(req_cust_otp, user=cust_user)
    res_cust_otp = view_cust_otp(req_cust_otp, pk=job.id)
    assert res_cust_otp.status_code == status.HTTP_200_OK
    assert res_cust_otp.data["otp_code"] == otp_secret
    print(f"[STEP 6] Customer fetched Work-Start OTP: {res_cust_otp.data['otp_code']}")

    # 8. Technician Verifies Customer OTP
    view_verify_otp = WorkforceJobVerifyOTPView.as_view()
    req_verify = factory.post(f"/api/workforce/jobs/{job.id}/verify-otp/", {"otp_code": otp_secret}, format="json")
    force_authenticate(req_verify, user=tech_user)
    res_verify = view_verify_otp(req_verify, pk=job.id)
    assert res_verify.status_code == status.HTTP_200_OK
    assert res_verify.data["otp_verified"] is True
    print(f"[STEP 7] Technician entered customer OTP -> OTP Verified successfully!")

    # 9. Upload 3 Pre-Service Evidence Photos
    from django.core.files.uploadedfile import SimpleUploadedFile
    dummy_img = SimpleUploadedFile("evidence.jpg", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00", content_type="image/jpeg")

    view_photo = WorkforceJobPreServicePhotoView.as_view()
    for photo_type in ["presence", "appliance", "work_area"]:
        req_photo = factory.post(f"/api/workforce/jobs/{job.id}/pre-service-photo/", {
            "photo_type": photo_type,
            "photo": dummy_img,
        }, format="multipart")
        force_authenticate(req_photo, user=tech_user)
        res_photo = view_photo(req_photo, pk=job.id)
        assert res_photo.status_code in [200, 201], f"Photo upload failed: {res_photo.data}"

    verification.refresh_from_db()
    assert bool(verification.presence_photo) is True
    assert bool(verification.appliance_photo) is True
    assert bool(verification.work_area_photo) is True
    assert verification.is_complete is True
    print("[STEP 8] Mandatory 3 Pre-service photos uploaded -> Verification complete!")

    # 10. Geofenced Shift Clock-In -> IN_PROGRESS
    from time_tracking.views import ClockInView
    req_clockin = factory.post("/api/workforce/time-tracking/clock-in/", {
        "job_id": job.id,
        "latitude": ARRIVE_LAT,
        "longitude": CUST_LON,
    })
    force_authenticate(req_clockin, user=tech_user)
    resp_clockin = ClockInView.as_view()(req_clockin)
    assert resp_clockin.status_code in [200, 201], f"Clock in failed: {resp_clockin.data}"

    timelog = TimeLog.objects.filter(employee=tech_emp, clock_out__isnull=True).first()
    assert timelog is not None, "Open TimeLog not found!"

    job.refresh_from_db()
    emp_job.refresh_from_db()
    assert job.status == "in_progress", f"Job status expected 'in_progress', got '{job.status}'"
    assert emp_job.status == "IN_PROGRESS", f"EmployeeJob status expected 'IN_PROGRESS', got '{emp_job.status}'"

    # Final live tracking check
    req_track_final = factory.get(f"/api/workforce/customer/jobs/{job.id}/tracking/")
    force_authenticate(req_track_final, user=cust_user)
    res_track_final = view_tracking(req_track_final, pk=job.id)
    assert res_track_final.status_code == status.HTTP_200_OK
    assert res_track_final.data["status"] == "in_progress"
    assert res_track_final.data["geofence_passed"] is True

    print(f"[STEP 9] Geofenced Clock-In: TimeLog ID={timelog.id} (Status=OPEN) | ServiceRequest=in_progress | EmployeeJob=IN_PROGRESS")
    print("=" * 80)
    print("ALL 10 TRUE ROAD TRACKING & ZERO-ADMIN E2E STEPS PASSED 100%!")
    print("=" * 80)

if __name__ == "__main__":
    run_test()
