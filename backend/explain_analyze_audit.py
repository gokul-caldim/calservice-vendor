"""
workforce-app/backend/explain_analyze_audit.py
Precise PostgreSQL EXPLAIN ANALYZE & Network Latency Deconstruction.
Measures:
1. Connection acquisition time
2. Per-query breakdown:
   - Total DB roundtrip time (ms)
   - PostgreSQL internal execution time (ms) via EXPLAIN ANALYZE
   - Network RTT latency (ms) = Total DB roundtrip time - PG internal execution time
3. Django/Python processing time
"""
import os
import sys
import time
import json
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.db import connection, reset_queries
from django.utils import timezone
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import (
    WorkforceEmployeeCompliance,
    WorkforceEmployeeSchedule,
    WorkforceEmployeeSkill,
)

def run_explain_analyze_audit():
    print("\n==================================================")
    print(" 1. MEASURING DATABASE CONNECTION ACQUISITION TIME")
    print("==================================================")
    
    t0 = time.perf_counter()
    connection.ensure_connection()
    t1 = time.perf_counter()
    conn_acquisition_ms = round((t1 - t0) * 1000, 2)
    print(f" -> Connection Acquisition Time: {conn_acquisition_ms} ms")

    candidates = list(Employee.objects.filter(is_active=True).values_list("id", flat=True)[:20])
    if not candidates:
        candidates = [1]
        
    today_dow = timezone.now().weekday()
    candidate_ids_str = ",".join(map(str, candidates))

    queries = [
        (
            "Query 1: Candidates SELECT with User/Company & Exists(Busy Job)",
            f"""
            SELECT employees_employee.id, employees_employee.employee_id, employees_employee.is_online, employees_employee.current_availability, employees_employee.bank_details,
                   accounts_user.id, accounts_user.username, accounts_user.first_name, accounts_user.last_name, accounts_user.mobile_number, accounts_user.phone,
                   companies_company.id, companies_company.company_name,
                   EXISTS (
                       SELECT 1 FROM service_requests_servicerequest
                       WHERE service_requests_servicerequest.assigned_employee_id = employees_employee.id
                       AND service_requests_servicerequest.status IN ('accepted', 'on_the_way', 'in_progress')
                   ) AS is_busy_job
            FROM employees_employee
            INNER JOIN accounts_user ON (employees_employee.user_id = accounts_user.id)
            LEFT OUTER JOIN companies_company ON (employees_employee.company_id = companies_company.id)
            WHERE employees_employee.is_active = TRUE;
            """
        ),
        (
            "Query 2: Prefetch Compliance Records",
            f"""
            SELECT workforce_employee_compliance.id, workforce_employee_compliance.employee_id, workforce_employee_compliance.requirement_id, workforce_employee_compliance.status
            FROM workforce_employee_compliance
            INNER JOIN workforce_compliance_requirement ON (workforce_employee_compliance.requirement_id = workforce_compliance_requirement.id)
            WHERE workforce_employee_compliance.employee_id IN ({candidate_ids_str})
            AND workforce_compliance_requirement.is_mandatory = TRUE
            AND workforce_employee_compliance.status IN ('EXPIRED', 'REJECTED');
            """
        ),
        (
            "Query 3: Prefetch Schedules",
            f"""
            SELECT workforce_employee_schedule.id, workforce_employee_schedule.employee_id, workforce_employee_schedule.day_of_week, workforce_employee_schedule.start_time, workforce_employee_schedule.end_time, workforce_employee_schedule.is_working_day
            FROM workforce_employee_schedule
            WHERE workforce_employee_schedule.employee_id IN ({candidate_ids_str})
            AND workforce_employee_schedule.day_of_week = {today_dow};
            """
        ),
        (
            "Query 4: Prefetch Verified Skills",
            f"""
            SELECT workforce_employee_skill.id, workforce_employee_skill.employee_id, workforce_employee_skill.skill_id, workforce_skill.name
            FROM workforce_employee_skill
            INNER JOIN workforce_skill ON (workforce_employee_skill.skill_id = workforce_skill.id)
            WHERE workforce_employee_skill.employee_id IN ({candidate_ids_str})
            AND workforce_employee_skill.is_verified = TRUE;
            """
        ),
    ]

    print("\n==================================================")
    print(" 2. EXPLAIN ANALYZE vs NETWORK LATENCY BREAKDOWN")
    print("==================================================")

    audit_summary = []
    
    with connection.cursor() as cursor:
        for title, raw_sql in queries:
            sql_clean = " ".join(raw_sql.split())
            
            # Step A: Measure Raw Roundtrip Time
            t_start = time.perf_counter()
            cursor.execute(sql_clean)
            cursor.fetchall()
            t_end = time.perf_counter()
            rtt_ms = round((t_end - t_start) * 1000, 2)
            
            # Step B: Run EXPLAIN (ANALYZE, FORMAT JSON)
            explain_sql = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql_clean}"
            cursor.execute(explain_sql)
            explain_result = cursor.fetchone()[0]
            
            # Extract PG internal planning + execution time
            plan_obj = explain_result[0] if isinstance(explain_result, list) else json.loads(explain_result)[0]
            planning_time_ms = float(plan_obj.get("Planning Time", 0.0))
            execution_time_ms = float(plan_obj.get("Execution Time", 0.0))
            pg_total_internal_ms = round(planning_time_ms + execution_time_ms, 3)
            
            # Step C: Compute pure Network WAN Latency
            network_wan_ms = round(rtt_ms - pg_total_internal_ms, 2)
            
            audit_summary.append({
                "title": title,
                "rtt_ms": rtt_ms,
                "pg_internal_ms": pg_total_internal_ms,
                "planning_ms": planning_time_ms,
                "execution_ms": execution_time_ms,
                "network_wan_ms": network_wan_ms,
            })
            
            print(f"\n [{title}]")
            print(f"   Total DB Roundtrip Time:        {rtt_ms:>7.2f} ms")
            print(f"   PG Internal Planning Time:      {planning_time_ms:>7.3f} ms")
            print(f"   PG Internal Execution Time:     {execution_time_ms:>7.3f} ms")
            print(f"   PG Total DB Cost (Internal):   {pg_total_internal_ms:>7.3f} ms")
            print(f"   Net Network WAN Latency:       {network_wan_ms:>7.2f} ms")

    print("\n==================================================")
    print(" 3. AGGREGATE TIME BREAKDOWN SUMMARY")
    print("==================================================")
    
    total_rtt = sum(item["rtt_ms"] for item in audit_summary)
    total_pg_internal = sum(item["pg_internal_ms"] for item in audit_summary)
    total_network_wan = sum(item["network_wan_ms"] for item in audit_summary)
    
    print(f" Connection Acquisition:         {conn_acquisition_ms:>7.2f} ms")
    print(f" Total Cumulative DB Roundtrips: {total_rtt:>7.2f} ms")
    print(f" Total PG Internal Cost:        {total_pg_internal:>7.3f} ms")
    print(f" Total Net Network WAN Latency: {total_network_wan:>7.2f} ms")
    print(f" Network Latency Percentage:     {round((total_network_wan / total_rtt) * 100, 1)} %")

    return {
        "conn_acquisition_ms": conn_acquisition_ms,
        "total_rtt_ms": total_rtt,
        "total_pg_internal_ms": total_pg_internal,
        "total_network_wan_ms": total_network_wan,
        "queries": audit_summary,
    }

if __name__ == "__main__":
    run_explain_analyze_audit()
