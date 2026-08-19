import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from service_requests.models import ServiceRequest
from employees.models import Employee
from workforce_api.services.automatic_dispatch import (
    dispatch_job,
    get_eligible_candidates,
    check_candidate_eligibility,
)

print("=" * 80)
print("ELIGIBILITY EVALUATION FOR PENDING JOBS")
print("=" * 80)

for srid in [2262, 2258, 2255, 2254, 2252]:
    sr = ServiceRequest.objects.filter(id=srid).first()
    if not sr:
        continue
    print(f"\n--- ServiceRequest #{sr.id} ({sr.request_id}) ---")
    print(f"Status: '{sr.status}', Category: '{sr.service_category}', Title: '{sr.issue_title}', Company: {sr.company_id}, Lat: {sr.latitude}, Lon: {sr.longitude}")
    
    # 1. Test get_eligible_candidates with default 120s GPS age
    cands_120 = get_eligible_candidates(sr, max_gps_age_seconds=120)
    print(f"Candidates with 120s GPS age: {len(cands_120)}")
    
    # 2. Test get_eligible_candidates with 24h GPS age
    cands_24h = get_eligible_candidates(sr, max_gps_age_seconds=86400)
    print(f"Candidates with 24h GPS age: {len(cands_24h)}")
    for c in cands_24h:
        print(f"   -> Emp #{c['employee'].id} ({c['employee'].user.username}): distance={c['distance_km']:.2f}km, score={c['score']:.1f}")

    # 3. Check each active employee specifically with check_candidate_eligibility
    for emp in Employee.objects.select_related("user", "company").filter(is_active=True, is_online=True):
        service_target = sr.service_category or sr.issue_title
        passed, reason, gate_results = check_candidate_eligibility(emp, service_name=service_target)
        if not passed:
            print(f"   Emp #{emp.id} ({emp.user.username}) failed: {reason}")
        else:
            print(f"   Emp #{emp.id} ({emp.user.username}) PASSED all 9 gates for service '{service_target}'!")

print("=" * 80)
