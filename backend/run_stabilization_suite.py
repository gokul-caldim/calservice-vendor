"""
workforce-app/backend/run_stabilization_suite.py
Master execution runner: Runs migrations, document data preservation mapping, and the production readiness test suite.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.core.management import call_command
from test_production_readiness import run_all_tests

if __name__ == "__main__":
    print("==================================================")
    print(" 1. RUNNING DJANGO DATABASE MIGRATIONS")
    print("==================================================")
    call_command("migrate", interactive=False)

    print("\n==================================================")
    print(" 2. RUNNING DOCUMENT DATA PRESERVATION MIGRATION")
    print("==================================================")
    call_command("migrate_legacy_documents")

    print("\n==================================================")
    print(" 3. EXECUTING PRODUCTION READINESS TEST SUITE")
    print("==================================================")
    run_all_tests()
