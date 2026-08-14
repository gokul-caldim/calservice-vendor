"""
workforce-app/backend/workforce_api/management/commands/audit_latency.py
Django Management Command for Empirical Latency & SQL Query Profiling.
Measures:
1. Pure Network / DB Latency (SELECT 1 benchmark)
2. Database Connection Overhead
3. Per-endpoint metrics:
   - Total Response Time (ms)
   - DB Query Count
   - Individual SQL Query Timings
   - Python Application Processing Time (ms)
"""
from django.core.management.base import BaseCommand
from profile_latency_audit import run_latency_audit

class Command(BaseCommand):
    help = "Profile DB query counts, SQL timing, network RTT, and application latency"

    def handle(self, *args, **options):
        run_latency_audit()
