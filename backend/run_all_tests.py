import sys
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from test_phase1_flow import run_phase1_test
from test_phase2_flow import run_phase2_test
from test_phase3_flow import run_phase3_test
from test_services_and_clockin_flow import run_services_verification
from run_final_e2e_concurrency_and_regression import run_full_verification

print("==================================================================")
print("              RUNNING ALL WORKFORCE PHASE SUITES                  ")
print("==================================================================")

run_phase1_test()
print("")
run_phase2_test()
print("")
run_phase3_test()
print("")
run_services_verification()
print("")
run_full_verification()

print("\n==================================================================")
print("            ALL WORKFORCE SUITES VERIFIED SUCCESSFULLY!           ")
print("==================================================================")
