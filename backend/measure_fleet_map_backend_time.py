"""
workforce-app/backend/measure_fleet_map_backend_time.py
Measures actual backend response time, SQL query count, and DB execution time for GET /api/workforce/presence/fleet-map/.
"""
import os
import sys
import time
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.db import connection, reset_queries
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from workforce_api.views import WorkforceFleetMapView

User = get_user_model()
factory = APIRequestFactory()

def measure_fleet_map():
    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(role="admin").first() or User.objects.first()
    request = factory.get("/api/workforce/presence/fleet-map/")
    force_authenticate(request, user=admin_user)
    
    reset_queries()
    view = WorkforceFleetMapView.as_view()
    
    t0 = time.perf_counter()
    response = view(request)
    t1 = time.perf_counter()
    
    total_ms = round((t1 - t0) * 1000, 2)
    queries = list(connection.queries)
    db_time_ms = round(sum(float(q.get("time", 0)) for q in queries) * 1000, 2)
    py_time_ms = round(total_ms - db_time_ms, 2)
    
    print("\n==================================================")
    print(" FLEET-MAP BACKEND PERFORMANCE MEASUREMENT")
    print("==================================================")
    print(f" -> HTTP Status Code:          {response.status_code}")
    print(f" -> Total Backend Response Time: {total_ms} ms")
    print(f" -> SQL Query Count:            {len(queries)}")
    print(f" -> Total Database Execution Time: {db_time_ms} ms")
    print(f" -> Python View Processing Time:   {py_time_ms} ms")
    print("==================================================\n")
    return {
        "status": response.status_code,
        "total_ms": total_ms,
        "query_count": len(queries),
        "db_time_ms": db_time_ms,
        "py_time_ms": py_time_ms,
    }

if __name__ == "__main__":
    measure_fleet_map()
