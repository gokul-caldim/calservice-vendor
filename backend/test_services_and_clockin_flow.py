import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from companies.models import Company, Region
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import WorkforceServiceCatalog
from workforce_api.views import check_technician_eligibility

User = get_user_model()


def run_services_verification():
    print("=========================================================================")
    print("       WORKFORCE PLATFORM — EMPLOYEE SERVICES & APPROVAL VERIFICATION    ")
    print("=========================================================================")

    # Setup Environment
    region, _ = Region.objects.get_or_create(code="IN", defaults={"name": "India", "currency": "INR"})
    comp_a, _ = Company.objects.get_or_create(display_id="SVC-COMP-A", defaults={"company_name": "Services Test Comp A", "region": region})
    comp_b, _ = Company.objects.get_or_create(display_id="SVC-COMP-B", defaults={"company_name": "Services Test Comp B", "region": region})

    admin_user, _ = User.objects.get_or_create(
        username="admin_svc_test",
        defaults={"email": "admin_svc@example.com", "role": "admin", "company": comp_a}
    )
    admin_user.company = comp_a
    admin_user.role = "admin"
    admin_user.set_password("Password123!")
    admin_user.save()

    cross_admin, _ = User.objects.get_or_create(
        username="admin_cross_svc",
        defaults={"email": "cross_admin@example.com", "role": "admin", "company": comp_b}
    )
    cross_admin.company = comp_b
    cross_admin.role = "admin"
    cross_admin.set_password("Password123!")
    cross_admin.save()

    tech_user, _ = User.objects.get_or_create(
        username="tech_svc_test",
        defaults={"email": "tech_svc@example.com", "role": "employee", "company": comp_a}
    )
    tech_user.company = comp_a
    tech_user.set_password("Password123!")
    tech_user.save()

    emp, _ = Employee.objects.get_or_create(
        user=tech_user,
        defaults={
            "company": comp_a,
            "employee_id": "EMP-SVC-01",
            "is_active": True,
            "is_online": True,
            "current_availability": "available",
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "services": [{"id": 101, "name": "AC Regular Servicing & Jet Clean", "status": "approved"}]
                }
            }
        }
    )
    emp.company = comp_a
    emp.is_active = True
    emp.bank_details = {
        "onboarding": {
            "status": "approved",
            "services": [{"id": 101, "name": "AC Regular Servicing & Jet Clean", "status": "approved"}]
        }
    }
    emp.save()

    client_tech = APIClient()
    client_tech.force_authenticate(user=tech_user)

    client_admin = APIClient()
    client_admin.force_authenticate(user=admin_user)

    client_cross = APIClient()
    client_cross.force_authenticate(user=cross_admin)

    # 1. View Catalog
    cat_resp = client_tech.get("/api/workforce/catalog/")
    assert cat_resp.status_code == 200
    print("  [1] GET /api/workforce/catalog/ operational.")

    # 2. Prevent invalid service ID
    bad_req = client_tech.post("/api/workforce/services/request/", {"service_id": 999999}, format="json")
    assert bad_req.status_code == 400
    print("  [2] Invalid service_id rejected (HTTP 400).")

    # 3. Prevent duplicate request for already approved service
    dup_req = client_tech.post("/api/workforce/services/request/", {"service_id": 101}, format="json")
    assert dup_req.status_code == 400
    print("  [3] Already approved service request rejected (HTTP 400).")

    # 4. Request new service authorization (201: Switchboard Repair)
    req_res = client_tech.post("/api/workforce/services/request/", {"service_id": 201, "name": "Switchboard Repair & Installation"}, format="json")
    assert req_res.status_code == 201
    emp.refresh_from_db()
    svcs = emp.bank_details["onboarding"]["services"]
    s201 = next((s for s in svcs if s["id"] == 201), None)
    assert s201 is not None and s201["status"] == "pending"
    print("  [4] POST /services/request/ submitted -> PENDING.")

    # 5. Prevent duplicate pending request
    dup_pend = client_tech.post("/api/workforce/services/request/", {"service_id": 201}, format="json")
    assert dup_pend.status_code == 400
    print("  [5] Duplicate pending request rejected (HTTP 400).")

    # 6. Verify Dispatch Eligibility when PENDING -> NOT ELIGIBLE
    sr_elec = ServiceRequest.objects.create(company=comp_a, service_category="Electrical", issue_title="Switchboard Issue", status="confirmed")
    eligible_pending = check_technician_eligibility(emp, sr_elec)
    # Since Switchboard Repair is pending, emp must NOT be eligible for Electrical
    # Note: 101 was AC (HVAC), so 201 is Electrical
    assert eligible_pending is False
    print("  [6] Dispatch Eligibility check: PENDING service is NOT eligible.")

    # 7. Employee cannot approve own request
    self_app = client_tech.post(f"/api/workforce/admin/applications/{emp.id}/service/201/decide/", {"action": "approve"}, format="json")
    assert self_app.status_code == 403
    print("  [7] Employee cannot decide own service authorization (HTTP 403).")

    # 8. Cross-company admin cannot decide service request
    cross_app = client_cross.post(f"/api/workforce/admin/applications/{emp.id}/service/201/decide/", {"action": "approve"}, format="json")
    assert cross_app.status_code == 403
    print("  [8] Cross-company admin rejected (HTTP 403).")

    # 9. Admin view pending requests queue
    pending_list = client_admin.get("/api/workforce/admin/services/pending-requests/")
    assert pending_list.status_code == 200
    p_item = next((p for p in pending_list.data if p["service_id"] == 201 and p["employee_id"] == emp.id), None)
    assert p_item is not None
    print("  [9] GET /admin/services/pending-requests/ lists pending request.")

    # 10. Admin Approves Service Request
    app_res = client_admin.post(f"/api/workforce/admin/applications/{emp.id}/service/201/decide/", {"action": "approve"}, format="json")
    assert app_res.status_code == 200
    emp.refresh_from_db()
    s201_app = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 201), None)
    assert s201_app is not None and s201_app["status"] == "approved"
    print(" [10] Admin APPROVED service request -> status: APPROVED.")

    # 11. Verify Dispatch Eligibility when APPROVED -> ELIGIBLE
    eligible_approved = check_technician_eligibility(emp, sr_elec)
    assert eligible_approved is True
    print(" [11] Dispatch Eligibility check: APPROVED service is ELIGIBLE.")

    # 12. Request service removal
    rem_req = client_tech.post("/api/workforce/services/remove/", {"service_id": 101}, format="json")
    assert rem_req.status_code == 200
    emp.refresh_from_db()
    s101 = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 101), None)
    assert s101 is not None and s101.get("request_type") == "remove"
    print(" [12] POST /services/remove/ submitted removal request -> PENDING.")

    # 13. Admin Rejects removal request -> service remains APPROVED
    rej_rem = client_admin.post(f"/api/workforce/admin/applications/{emp.id}/service/101/decide/", {"action": "reject", "reason": "Staffing quota requirement"}, format="json")
    assert rej_rem.status_code == 200
    emp.refresh_from_db()
    s101_rem_rej = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 101), None)
    assert s101_rem_rej is not None and s101_rem_rej["status"] == "approved"
    print(" [13] Admin REJECTED removal request -> service remains APPROVED.")

    # 14. Request removal again and Admin Approves -> Service removed
    client_tech.post("/api/workforce/services/remove/", {"service_id": 101}, format="json")
    app_rem = client_admin.post(f"/api/workforce/admin/applications/{emp.id}/service/101/decide/", {"action": "approve"}, format="json")
    assert app_rem.status_code == 200
    emp.refresh_from_db()
    s101_gone = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 101), None)
    assert s101_gone is None
    print(" [14] Admin APPROVED removal request -> service REMOVED.")

    # 15. Admin rejects a new service request -> existing approved services remain unchanged
    client_tech.post("/api/workforce/services/request/", {"service_id": 102, "name": "AC Deep Cleaning"}, format="json")
    client_admin.post(f"/api/workforce/admin/applications/{emp.id}/service/102/decide/", {"action": "reject", "reason": "Lacks certificate"}, format="json")
    emp.refresh_from_db()
    # 201 must still be approved
    s201_still = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 201), None)
    assert s201_still is not None and s201_still["status"] == "approved"
    s102_rej = next((s for s in emp.bank_details["onboarding"]["services"] if s["id"] == 102), None)
    assert s102_rej is not None and s102_rej["status"] == "rejected" and s102_rej["rejection_reason"] == "Lacks certificate"
    print(" [15] Admin REJECTED new service request -> status: REJECTED with reason, existing approved services UNTOUCHED.")

    print("\n[PASS] ALL EMPLOYEE SERVICES & ADMIN APPROVAL TESTS PASSED CLEANLY.")


if __name__ == "__main__":
    run_services_verification()
