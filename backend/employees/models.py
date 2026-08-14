"""
workforce-app/backend/employees/models.py
Employee model pointing to existing Supabase table (managed=False).
"""
from django.conf import settings
from django.db import models
from common.models import CompanyScopedManager


class Employee(models.Model):
    objects = CompanyScopedManager()

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invited_employees",
    )
    employee_id = models.CharField(max_length=50)
    phone = models.CharField(max_length=30, blank=True)
    title = models.CharField(max_length=100, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hire_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    assigned_job_site_id = models.IntegerField(null=True, blank=True, db_column="assigned_job_site_id")
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="employees")
    country = models.CharField(max_length=2, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    currency = models.CharField(max_length=10, blank=True, null=True)
    payroll_group_id = models.IntegerField(null=True, blank=True, db_column="payroll_group_id")
    tax_category = models.CharField(max_length=100, blank=True, null=True)
    bank_details = models.JSONField(default=dict, blank=True)
    service_roles = models.JSONField(default=list, blank=True)
    allow_all_locations = models.BooleanField(default=False)

    # ── US FLSA Exempt Status ─────────────────────────────────────────────
    class ExemptStatus(models.TextChoices):
        NON_EXEMPT = "non_exempt", "Non-Exempt (eligible for OT)"
        EXEMPT = "exempt", "Exempt (not eligible for OT)"
        PENDING = "pending", "Pending Classification"

    exempt_status = models.CharField(
        max_length=20,
        choices=ExemptStatus.choices,
        default=ExemptStatus.NON_EXEMPT,
    )
    exempt_history = models.JSONField(default=list, blank=True)
    flsa_duties_category = models.CharField(max_length=30, blank=True, null=True)
    weekly_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # ── UK Payroll Fields ─────────────────────────────────────────────────
    uk_tax_code = models.CharField(max_length=20, blank=True, null=True, default="1257L")
    uk_ni_category = models.CharField(max_length=1, blank=True, null=True, default="A")
    rolled_up_holiday_pay = models.BooleanField(default=False)
    wtr_opt_out_active = models.BooleanField(default=False)

    # Presence status
    is_online = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_logout_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    current_availability = models.CharField(max_length=50, default="offline")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "employees_employee"

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.employee_id or 'No ID'})"


class PresenceLog(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="presence_logs")
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="presence_logs")
    is_online = models.BooleanField(default=False)
    availability = models.CharField(max_length=50, default="offline")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CompanyScopedManager()

    class Meta:
        managed = False
        db_table = "employees_presencelog"
