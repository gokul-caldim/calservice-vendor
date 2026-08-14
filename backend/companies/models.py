"""
workforce-app/backend/companies/models.py
Company and Region models pointing to existing Supabase tables (managed=False).
"""
from django.db import models


class Region(models.Model):
    class Code(models.TextChoices):
        US = "US", "United States"
        UK = "UK", "United Kingdom"
        IN = "IN", "India"

    code = models.CharField(max_length=2, unique=True, choices=Code.choices)
    name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, default="USD")
    currency_symbol = models.CharField(max_length=5, default="$")
    date_format = models.CharField(max_length=20, default="MM/DD/YYYY")
    week_start = models.IntegerField(default=0)
    overtime_weekly_hours = models.PositiveIntegerField(default=40)
    max_weekly_hours = models.PositiveIntegerField(default=40)
    statutory_leave_days = models.PositiveIntegerField(default=0)
    tax_year_start_month = models.IntegerField(default=1)
    tax_year_start_day = models.IntegerField(default=1)
    payroll_frequency = models.CharField(max_length=20, default="biweekly")
    min_wage = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    national_insurance_enabled = models.BooleanField(default=False)
    paye_enabled = models.BooleanField(default=False)
    flsa_enabled = models.BooleanField(default=False)
    state_tax_enabled = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = "companies_region"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Company(models.Model):
    company_name = models.CharField(max_length=255)
    display_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    slug = models.SlugField(max_length=255, unique=True, null=True, blank=True)
    primary_country = models.CharField(max_length=2, default="US")
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True, related_name="companies")
    default_state = models.CharField(max_length=100, blank=True, null=True)
    industry = models.CharField(max_length=100, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    timezone = models.CharField(max_length=50, default="UTC")
    data_region = models.CharField(max_length=50, default="us-east")
    address = models.TextField(blank=True, null=True)
    geofence_enabled = models.BooleanField(default=True)
    geofence_radius_meters = models.PositiveIntegerField(default=200)
    geofence_strict_mode = models.BooleanField(default=True)
    geofence_admin_override = models.BooleanField(default=True)
    compliance_mode = models.CharField(max_length=20, default="strict")
    shift_enforcement_mode = models.CharField(max_length=10, default="warn")
    reschedule_rejection_strategy = models.CharField(max_length=30, default="auto_reassign")
    allowed_countries = models.JSONField(default=list, blank=True)
    team_size = models.CharField(max_length=100, blank=True, null=True)
    selected_modules = models.JSONField(default=list, blank=True)
    module_permissions = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)


    class Meta:
        managed = False
        db_table = "companies_company"

    def __str__(self):
        return self.company_name or f"Company #{self.pk}"
