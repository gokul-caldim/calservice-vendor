"""
workforce-app/backend/profile_latency_audit.py
Empirical Latency & SQL Profiling Auditor.
Measures:
1. Pure Network / DB Latency (SELECT 1 benchmark)
2. Database Connection Time
3. Endpoint Latency Breakdown:
   - Total Response Time (ms)
   - DB Query Count
   - Individual SQL Query Timings
   - Python Application Processing Time (ms)
"""
import os
import sys
import time
import json
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.conf import settings
from django.db import connection, reset_queries
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from employees.models import Employee

User = get_user_model()


def benchmark_select_1():
    print("\n==================================================")
    print(" 1. BENCHMARKING PURE DB / NETWORK LATENCY (SELECT 1)")
    print("==================================================")
    
    times = []
    with connection.cursor() as cursor:
        for i in range(10):
            t0 = time.perf_counter()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            t1 = time.perf_counter()
            times.append((t1 - t0) * 1000)
    
    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)
    print(f" -> SELECT 1 Execution (10 iterations):")
    print(f"    Min: {min_time:.2f} ms | Max: {max_time:.2f} ms | Avg RTT: {avg_time:.2f} ms")
    return avg_time


def profile_endpoint(client, name, url, user=None, method="GET", payload=None):
    if user:
        client.force_authenticate(user=user)
    else:
        client.force_authenticate(user=None)

    settings.DEBUG = True
    reset_queries()
    
    t_start = time.perf_counter()
    if method == "GET":
        res = client.get(url)
    else:
        res = client.post(url, data=payload or {}, format="json")
    t_end = time.perf_counter()

    total_time_ms = round((t_end - t_start) * 1000, 2)
    queries = list(connection.queries)
    db_time_ms = round(sum(float(q.get("time", 0)) for q in queries) * 1000, 2)
    py_time_ms = round(total_time_ms - db_time_ms, 2)
    
    print(f"\n Endpoint: {name}")
    print(f"  URL: {url}")
    print(f"  Status Code: {res.status_code}")
    print(f"  Total Response Time: {total_time_ms} ms")
    print(f"  DB Query Count: {len(queries)}")
    print(f"  Total DB Time: {db_time_ms} ms")
    print(f"  Python App Processing Time: {py_time_ms} ms")
    
    if queries:
        print("  Individual SQL Queries:")
        for idx, q in enumerate(queries, 1):
            sql_snippet = q['sql'][:120].replace('\n', ' ')
            q_time = round(float(q.get('time', 0)) * 1000, 2)
            print(f"    [{idx}] {q_time:<6.2f} ms | {sql_snippet}...")
            
    return {
        "endpoint": name,
        "total_ms": total_time_ms,
        "db_count": len(queries),
        "db_time_ms": db_time_ms,
        "py_time_ms": py_time_ms,
        "queries": queries,
    }


from rest_framework.test import APIRequestFactory, force_authenticate
from workforce_api.views import (
    WorkforceOnboardingSubmitView,
    WorkforceJobListView,
    WorkforceAdminApplicationsListView,
    WorkforceScheduleManageView,
    WorkforceDispatchEligibleListView,
)

factory = APIRequestFactory()

def profile_view_handler(name, view_class, path, user, query_params=None):
    request = factory.get(path, query_params or {})
    force_authenticate(request, user=user)
    view = view_class.as_view()
    
    settings.DEBUG = True
    reset_queries()
    
    t0 = time.perf_counter()
    response = view(request)
    t1 = time.perf_counter()
    
    total_ms = round((t1 - t0) * 1000, 2)
    queries = list(connection.queries)
    db_time_ms = round(sum(float(q.get("time", 0)) for q in queries) * 1000, 2)
    py_time_ms = round(total_ms - db_time_ms, 2)
    
    return {
        "endpoint": name,
        "total_ms": total_ms,
        "db_count": len(queries),
        "db_time_ms": db_time_ms,
        "py_time_ms": py_time_ms,
    }


def run_latency_audit():
    rtt_ms = benchmark_select_1()
    
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.filter(role="admin").first() or User.objects.first()
        
    tech_user = User.objects.filter(role="employee").first() or admin_user
    
    results = [
        profile_view_handler("Onboarding Submit", WorkforceOnboardingSubmitView, "/api/workforce/onboarding/submit/", tech_user),
        profile_view_handler("Jobs List", WorkforceJobListView, "/api/workforce/jobs/", tech_user),
        profile_view_handler("Admin Applications", WorkforceAdminApplicationsListView, "/api/workforce/admin/applications/", admin_user),
        profile_view_handler("Schedule Manage", WorkforceScheduleManageView, "/api/workforce/schedules/", admin_user),
        profile_view_handler("Eligible Technicians", WorkforceDispatchEligibleListView, "/api/workforce/dispatch/eligible-technicians/", admin_user),
    ]
    
    return rtt_ms, results

if __name__ == "__main__":
    run_latency_audit()
