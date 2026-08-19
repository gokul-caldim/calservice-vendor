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
    get_eligible_candidates,
    check_candidate_eligibility,
    canonical_service_match,
)

print("=" * 80)
print("INSPECTING ELIGIBILITY OF EMPLOYEE 2 (Swathi)")
print("=" * 80)

emp = Employee.objects.select_related("user", "company").filter(id=2).first()
print(f"Employee #{emp.id}: user='{emp.user.username}', is_online={emp.is_online}, avail={emp.current_availability}, bank_details={emp.bank_details}")

passed, reason, gate_results = check_candidate_eligibility(emp, service_name="hvac")
print(f"\ncheck_candidate_eligibility('hvac'): passed={passed}, reason='{reason}'")
for g, r in gate_results.items():
    print(f"  Gate {g}: {r}")

passed2, reason2, gate_results2 = check_candidate_eligibility(emp, service_name="AC Repair & Diagnostics")
print(f"\ncheck_candidate_eligibility('AC Repair & Diagnostics'): passed={passed2}, reason='{reason2}'")
for g, r in gate_results2.items():
    print(f"  Gate {g}: {r}")

print("=" * 80)
