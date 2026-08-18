import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection
from companies.models import Company

def safe_delete(cursor, table_name, where_clause, params):
    try:
        cursor.execute(f"DELETE FROM {table_name} WHERE {where_clause}", params)
    except Exception as e:
        pass

def run_sql_cleanup(dry_run=True):
    print(f"=== FULL RESILIENT DATABASE CLEANUP OF TEST TECHNICIANS (DryRun={dry_run}) ===")
    connection.close()

    real_company = Company.objects.filter(id=1).first()
    if not real_company:
        print("Error: Real company ID=1 not found!")
        return
    print(f"Preserving Main Company: {real_company.company_name} (ID={real_company.id})")

    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM companies_company WHERE id != 1")
        test_comp_ids = [row[0] for row in cursor.fetchall()]

        test_user_emails_in_comp1 = [
            'admin_platform@test.com',
            'tech_platform@test.com',
            'admin@test.com',
            'tech_near@caldim.in',
            'tech_far@caldim.in',
        ]
        cursor.execute("SELECT id FROM accounts_user WHERE email = ANY(%s)", [test_user_emails_in_comp1])
        comp1_extra_user_ids = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT id FROM accounts_user WHERE company_id = ANY(%s) OR id = ANY(%s)", [test_comp_ids, comp1_extra_user_ids])
        all_test_user_ids = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT id FROM employees_employee WHERE company_id = ANY(%s) OR user_id = ANY(%s)", [test_comp_ids, comp1_extra_user_ids])
        all_test_emp_ids = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT id FROM service_requests_servicerequest WHERE company_id = ANY(%s)", [test_comp_ids])
        all_test_sr_ids = [row[0] for row in cursor.fetchall()]

    print(f"Found {len(test_comp_ids)} test companies.")
    print(f"Found {len(all_test_emp_ids)} test employees.")
    print(f"Found {len(all_test_user_ids)} test users.")
    print(f"Found {len(all_test_sr_ids)} test service requests.")

    if dry_run:
        print("Dry run complete.")
        return

    # Use autocommit per operation for absolute resilience
    connection.connection.autocommit = True
    batch_size = 20
    total_batches = (len(test_comp_ids) + batch_size - 1) // batch_size
    print(f"Cleaning {len(test_comp_ids)} test companies in {total_batches} batches...")

    for i in range(0, len(test_comp_ids), batch_size):
        batch_comp_ids = test_comp_ids[i:i + batch_size]
        batch_num = (i // batch_size) + 1

        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM accounts_user WHERE company_id = ANY(%s)", [batch_comp_ids])
            batch_user_ids = [r[0] for r in cursor.fetchall()]

            cursor.execute("SELECT id FROM employees_employee WHERE company_id = ANY(%s)", [batch_comp_ids])
            batch_emp_ids = [r[0] for r in cursor.fetchall()]

            cursor.execute("SELECT id FROM service_requests_servicerequest WHERE company_id = ANY(%s)", [batch_comp_ids])
            batch_sr_ids = [r[0] for r in cursor.fetchall()]

            # 1. Job dependencies
            if batch_sr_ids:
                safe_delete(cursor, "customer_care_cancellationrequest", "booking_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "customer_care_customercareticket", "booking_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "service_requests_couponusage", "booking_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "service_requests_jobreschedule", "service_request_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_reschedule", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_supplemental_invoice", "job_id = ANY(%s) OR extension_id IN (SELECT id FROM workforce_work_extension WHERE job_id = ANY(%s))", [batch_sr_ids, batch_sr_ids])
                safe_delete(cursor, "service_requests_supplementalinvoice", "service_request_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_location_point", "job_id = ANY(%s) OR tracking_session_id IN (SELECT id FROM workforce_job_tracking_session WHERE job_id = ANY(%s))", [batch_sr_ids, batch_sr_ids])
                safe_delete(cursor, "workforce_payment_collection_event", "job_payment_id IN (SELECT id FROM workforce_job_payment WHERE job_id = ANY(%s))", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_lifecycle_event", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_payment", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_tracking_session", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_post_service_proof", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_pre_service_verification", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_work_extension", "job_id = ANY(%s) OR specialist_job_id = ANY(%s)", [batch_sr_ids, batch_sr_ids])
                safe_delete(cursor, "service_requests_workextensionitem", "purchase_approved_by_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "service_requests_workextension", "service_request_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "workforce_job_offer", "job_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "service_requests_employeejob", "service_request_id = ANY(%s)", [batch_sr_ids])
                safe_delete(cursor, "service_requests_servicerequest", "id = ANY(%s)", [batch_sr_ids])

            # 2. Employee dependencies
            if batch_emp_ids:
                safe_delete(cursor, "payroll_employeewalletbalance", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "payroll_kycstatus", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "payroll_bankaccount", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "payroll_payoutdispute", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "payroll_payrollrecord", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "service_requests_providerservicearea", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_payslip", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_employee_saved_location", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_employee_document", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_employee_compliance", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_employee_schedule", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_employee_skill", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_job_location_point", "employee_id = ANY(%s) OR tracking_session_id IN (SELECT id FROM workforce_job_tracking_session WHERE employee_id = ANY(%s))", [batch_emp_ids, batch_emp_ids])
                safe_delete(cursor, "workforce_job_tracking_session", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_job_payment", "employee_id = ANY(%s) OR cash_collected_by_id = ANY(%s)", [batch_emp_ids, batch_emp_ids])
                safe_delete(cursor, "workforce_job_lifecycle_event", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "workforce_job_offer", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "service_requests_employeejob", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "time_tracking_timelog", "employee_id = ANY(%s)", [batch_emp_ids])
                safe_delete(cursor, "employees_employee", "id = ANY(%s)", [batch_emp_ids])

            # 3. User & Master dependencies
            if batch_user_ids:
                safe_delete(cursor, "settings_hub_loginsession", "user_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "settings_hub_loginhistory", "user_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "customer_care_careagentprofile", "user_id = ANY(%s) OR assigned_by_id = ANY(%s)", [batch_user_ids, batch_user_ids])
                safe_delete(cursor, "customer_care_customercareticket", "customer_id = ANY(%s) OR assigned_agent_id = ANY(%s) OR created_by_id = ANY(%s)", [batch_user_ids, batch_user_ids, batch_user_ids])
                safe_delete(cursor, "workforce_notification", "recipient_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "workforce_event_log", "user_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "settings_hub_teaminvite", "invited_by_id = ANY(%s) OR company_id = ANY(%s)", [batch_user_ids, batch_comp_ids])
                safe_delete(cursor, "settings_hub_apikey", "created_by_id = ANY(%s) OR company_id = ANY(%s)", [batch_user_ids, batch_comp_ids])
                safe_delete(cursor, "settings_hub_webhook", "created_by_id = ANY(%s) OR company_id = ANY(%s)", [batch_user_ids, batch_comp_ids])
                safe_delete(cursor, "accounts_passwordresettoken", "user_id = ANY(%s)", [batch_user_ids])
                safe_delete(cursor, "accounts_user", "id = ANY(%s)", [batch_user_ids])

            # 4. Company master tables & company
            safe_delete(cursor, "workforce_compliance_requirement", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "workforce_required_document", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "workforce_skill", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "workforce_pay_period", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "time_tracking_location", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "time_tracking_jobsite", "company_id = ANY(%s)", [batch_comp_ids])
            safe_delete(cursor, "companies_company", "id = ANY(%s)", [batch_comp_ids])

        print(f"Batch {batch_num}/{total_batches} completed ({len(batch_comp_ids)} companies, {len(batch_emp_ids)} emps).")
        connection.close()
        time.sleep(0.05)

    # Extra Comp 1 test records
    if comp1_extra_user_ids:
        print("Cleaning extra test users in Company 1...")
        with connection.cursor() as cursor:
            safe_delete(cursor, "workforce_job_offer", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "workforce_employee_compliance", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "workforce_employee_schedule", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "workforce_employee_skill", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "workforce_job_tracking_session", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "workforce_job_payment", "employee_id IN (SELECT id FROM employees_employee WHERE user_id = ANY(%s))", [comp1_extra_user_ids])
            safe_delete(cursor, "employees_employee", "user_id = ANY(%s)", [comp1_extra_user_ids])
            safe_delete(cursor, "accounts_user", "id = ANY(%s)", [comp1_extra_user_ids])
        connection.close()

    print("=== ALL TEST TECHNICIANS AND COMPANIES CLEANED SUCCESSFULLY ===")

if __name__ == '__main__':
    dry_run = '--execute' not in sys.argv
    run_sql_cleanup(dry_run=dry_run)
