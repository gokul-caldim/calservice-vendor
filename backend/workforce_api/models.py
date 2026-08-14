"""
workforce-app/backend/workforce_api/models.py
Relational database models for Workforce Scheduling, Skills, Compliance, Notifications, Events, Payroll, and Reports.
"""
from django.conf import settings
from django.db import models


class WorkforceEmployeeSchedule(models.Model):
    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="employee_schedules",
    )
    day_of_week = models.IntegerField(choices=DayOfWeek.choices, db_index=True)
    start_time = models.TimeField(default="09:00:00")
    end_time = models.TimeField(default="18:00:00")
    is_working_day = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_employee_schedule"
        unique_together = ("employee", "day_of_week")
        ordering = ["day_of_week"]

    def __str__(self):
        return f"{self.employee} - Day {self.day_of_week} ({self.start_time}-{self.end_time})"


class WorkforceSkill(models.Model):
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="skills",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=100, blank=True, default="General")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_skill"
        unique_together = ("company", "name")
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.category})"


class WorkforceServiceCatalog(models.Model):
    category = models.CharField(max_length=150, db_index=True)
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    duration_minutes = models.IntegerField(default=60)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_service_catalog"
        ordering = ["category", "name"]

    def __str__(self):
        return f"[{self.id}] {self.category} - {self.name} (${self.price})"


class WorkforceEmployeeSkill(models.Model):
    class ProficiencyLevel(models.TextChoices):
        BEGINNER = "BEGINNER", "Beginner"
        INTERMEDIATE = "INTERMEDIATE", "Intermediate"
        EXPERT = "EXPERT", "Expert"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="skills",
    )
    skill = models.ForeignKey(
        WorkforceSkill,
        on_delete=models.CASCADE,
        related_name="employee_skills",
    )
    proficiency_level = models.CharField(
        max_length=20,
        choices=ProficiencyLevel.choices,
        default=ProficiencyLevel.INTERMEDIATE,
    )
    is_verified = models.BooleanField(default=False, db_index=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_employee_skill"
        unique_together = ("employee", "skill")

    def __str__(self):
        return f"{self.employee} - {self.skill.name} ({self.proficiency_level})"


class WorkforceRequiredDocument(models.Model):
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="required_documents",
    )
    title = models.CharField(max_length=150)
    category = models.CharField(max_length=100, db_index=True)
    is_mandatory = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_required_document"
        unique_together = ("company", "category")
        ordering = ["category", "title"]

    def __str__(self):
        return f"{self.title} ({'Mandatory' if self.is_mandatory else 'Optional'})"


class WorkforceEmployeeDocument(models.Model):
    class DocumentStatus(models.TextChoices):
        MISSING = "MISSING", "Missing"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        EXPIRED = "EXPIRED", "Expired"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    requirement = models.ForeignKey(
        WorkforceRequiredDocument,
        on_delete=models.CASCADE,
        related_name="employee_documents",
    )
    document_number = models.CharField(max_length=100, blank=True, default="")
    file_url = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING_REVIEW,
        db_index=True,
    )
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    history_log = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_employee_document"
        unique_together = ("requirement", "employee")

    def __str__(self):
        return f"{self.employee} - {self.requirement.title} ({self.status})"

    def get_computed_status(self):
        if self.status == self.DocumentStatus.REJECTED:
            return self.DocumentStatus.REJECTED
        if self.status == self.DocumentStatus.PENDING_REVIEW:
            return self.DocumentStatus.PENDING_REVIEW
        if self.expiry_date:
            from django.utils import timezone
            today = timezone.now().date()
            if self.expiry_date < today:
                return self.DocumentStatus.EXPIRED
        return self.status


class WorkforceComplianceRequirement(models.Model):
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="compliance_requirements",
    )
    title = models.CharField(max_length=150)
    is_mandatory = models.BooleanField(default=True, db_index=True)
    validity_days = models.IntegerField(default=365)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_compliance_requirement"
        unique_together = ("company", "title")

    def __str__(self):
        return f"{self.title} (Mandatory: {self.is_mandatory})"


class WorkforceEmployeeCompliance(models.Model):
    class ComplianceStatus(models.TextChoices):
        MISSING = "MISSING", "Missing"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending Review"
        VALID = "VALID", "Valid"
        EXPIRING = "EXPIRING", "Expiring Soon"
        EXPIRED = "EXPIRED", "Expired"
        REJECTED = "REJECTED", "Rejected"

    requirement = models.ForeignKey(
        WorkforceComplianceRequirement,
        on_delete=models.CASCADE,
        related_name="employee_records",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="compliance_records",
    )
    document_number = models.CharField(max_length=100, blank=True, default="")
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=ComplianceStatus.choices,
        default=ComplianceStatus.VALID,
        db_index=True,
    )
    file_url = models.CharField(max_length=500, blank=True, default="")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    rejection_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_employee_compliance"
        unique_together = ("requirement", "employee")

    def __str__(self):
        return f"{self.employee} - {self.requirement.title} ({self.status})"

    def get_computed_status(self):
        if self.status == self.ComplianceStatus.REJECTED:
            return self.ComplianceStatus.REJECTED
        if self.status == self.ComplianceStatus.PENDING_REVIEW:
            return self.ComplianceStatus.PENDING_REVIEW
        if self.expiry_date:
            from django.utils import timezone
            today = timezone.now().date()
            if self.expiry_date < today:
                return self.ComplianceStatus.EXPIRED
            elif (self.expiry_date - today).days <= 30:
                return self.ComplianceStatus.EXPIRING
        return self.ComplianceStatus.VALID


class WorkforceNotification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=100, db_index=True)
    related_object_id = models.CharField(max_length=100, blank=True, default="")
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "workforce_notification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"To {self.recipient.username}: {self.title}"


class WorkforceEventLog(models.Model):
    event_type = models.CharField(max_length=100, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "workforce_event_log"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Event {self.event_type} at {self.created_at}"


class WorkforcePayPeriod(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PROCESSING = "PROCESSING", "Processing"
        REVIEW = "REVIEW", "In Review"
        APPROVED = "APPROVED", "Approved"
        PAID = "PAID", "Paid"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="pay_periods",
    )
    name = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_pay_period"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.status})"


class WorkforcePayslip(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PROCESSING = "PROCESSING", "Processing"
        REVIEW = "REVIEW", "In Review"
        APPROVED = "APPROVED", "Approved"
        PAID = "PAID", "Paid"

    pay_period = models.ForeignKey(
        WorkforcePayPeriod,
        on_delete=models.CASCADE,
        related_name="payslips",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="payslips",
    )
    base_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    job_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    adjustments = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_payslip"
        unique_together = ("pay_period", "employee")

    def __str__(self):
        return f"Payslip {self.employee} - {self.pay_period.name} (${self.net_pay})"


class WorkforceJobOffer(models.Model):
    class Status(models.TextChoices):
        OFFERED = "OFFERED", "Offered"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        EXPIRED = "EXPIRED", "Expired"

    job = models.ForeignKey(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="job_offers",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="job_offers",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OFFERED,
        db_index=True,
    )
    rank_score = models.FloatField(default=0.0)
    offered_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    rejection_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "workforce_job_offer"
        ordering = ["-offered_at"]

    def __str__(self):
        return f"Offer Job #{self.job_id} to {self.employee} ({self.status})"


class PreServiceVerification(models.Model):
    job = models.OneToOneField(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="pre_service_verification",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="pre_service_verifications",
    )
    geofence_passed = models.BooleanField(default=False)
    arrival_lat = models.FloatField(null=True, blank=True)
    arrival_lon = models.FloatField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)

    presence_photo = models.FileField(upload_to="pre_service/presence/", null=True, blank=True)
    appliance_photo = models.FileField(upload_to="pre_service/appliance/", null=True, blank=True)
    work_area_photo = models.FileField(upload_to="pre_service/work_area/", null=True, blank=True)

    otp_code = models.CharField(max_length=6, default="")
    otp_generated_at = models.DateTimeField(null=True, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.IntegerField(default=0)
    otp_verified = models.BooleanField(default=False)
    otp_verified_at = models.DateTimeField(null=True, blank=True)

    is_complete = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_pre_service_verification"

    def check_completion(self):
        ready = bool(
            self.geofence_passed
            and self.otp_verified
            and self.presence_photo
            and self.appliance_photo
            and self.work_area_photo
        )
        self.is_complete = ready
        if ready and not self.completed_at:
            from django.utils import timezone
            self.completed_at = timezone.now()
        return self.is_complete


    def __str__(self):
        return f"PreService Verification Job #{self.job_id} (Complete: {self.is_complete})"


class WorkforceWorkExtension(models.Model):
    class Status(models.TextChoices):
        REQUESTED          = "REQUESTED",          "Requested"
        ADMIN_APPROVED     = "ADMIN_APPROVED",     "Admin Approved"
        ADMIN_REJECTED     = "ADMIN_REJECTED",     "Admin Rejected"
        PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT", "Pending Assignment"
        CUSTOMER_ACCEPTED  = "CUSTOMER_ACCEPTED",  "Customer Accepted"
        CUSTOMER_DECLINED  = "CUSTOMER_DECLINED",  "Customer Declined"
        IN_PROGRESS        = "IN_PROGRESS",        "In Progress"
        COMPLETED          = "COMPLETED",          "Completed"
        RESOLVED           = "RESOLVED",           "Resolved"

    job = models.ForeignKey(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="work_extensions",
    )
    technician = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="work_extensions",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="work_extensions",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200, default="Scope Extension")
    description = models.TextField(blank=True, default="")
    reason = models.TextField()

    estimated_labor_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_materials_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    requested_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    approved_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    final_customer_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    requires_specialist = models.BooleanField(default=False)
    required_skill = models.ForeignKey(
        WorkforceSkill,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="extensions",
    )
    specialist_technician = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="specialist_assigned_extensions",
    )
    specialist_job = models.ForeignKey(
        "service_requests.ServiceRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="specialist_parent_extension",
    )
    is_critical = models.BooleanField(default=False)

    decision_token = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    decision_expires_at = models.DateTimeField(null=True, blank=True)

    supporting_notes = models.TextField(blank=True, default="")
    supporting_photo = models.FileField(upload_to="work_extensions/photos/", null=True, blank=True)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )

    admin_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_extensions",
    )
    admin_review_reason = models.TextField(blank=True, default="")
    admin_reviewed_at = models.DateTimeField(null=True, blank=True)

    customer_decided_at = models.DateTimeField(null=True, blank=True)
    customer_decline_reason = models.TextField(blank=True, default="")

    completed_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_work_extension"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Extension #{self.id} for Job #{self.job_id}: {self.title} ({self.status})"


class WorkforceSupplementalInvoice(models.Model):
    class Status(models.TextChoices):
        ISSUED    = "ISSUED",    "Issued"
        PAID      = "PAID",      "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    job = models.ForeignKey(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="supplemental_invoices",
    )
    extension = models.OneToOneField(
        WorkforceWorkExtension,
        on_delete=models.CASCADE,
        related_name="supplemental_invoice",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supplemental_invoices",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="supplemental_invoices",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ISSUED,
        db_index=True,
    )
    payment_method = models.CharField(max_length=20, default="COD")
    transaction_id = models.CharField(max_length=200, blank=True, null=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    audit_trail = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_supplemental_invoice"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Supplemental Invoice {self.invoice_number} (₹{self.amount} - {self.status})"


class WorkforceJobReschedule(models.Model):
    class DelayType(models.TextChoices):
        PARTS_DELAY      = "PARTS_DELAY",      "Parts Delay"
        SPECIALIST_DELAY = "SPECIALIST_DELAY", "Specialist Delay"
        CUSTOMER_REQUEST = "CUSTOMER_REQUEST", "Customer Request"
        WEATHER_ACCESS   = "WEATHER_ACCESS",   "Weather/Access Issue"
        OTHER            = "OTHER",            "Other"

    class CustomerResponse(models.TextChoices):
        PENDING            = "PENDING",            "Pending"
        ACCEPTED           = "ACCEPTED",           "Accepted"
        OBJECTED           = "OBJECTED",           "Objected"
        CALLBACK_REQUESTED = "CALLBACK_REQUESTED", "Callback Requested"

    job = models.ForeignKey(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="reschedules",
    )
    delay_count = models.IntegerField(default=1)
    delay_type = models.CharField(max_length=30, choices=DelayType.choices, default=DelayType.PARTS_DELAY)
    original_date = models.DateField(null=True, blank=True)
    rescheduled_date = models.DateField(null=True, blank=True)
    reason = models.TextField()
    customer_notified = models.BooleanField(default=True)
    escalated_to_support = models.BooleanField(default=False)
    escalation_notes = models.TextField(blank=True, default="")
    customer_response = models.CharField(max_length=30, choices=CustomerResponse.choices, default=CustomerResponse.PENDING)
    customer_notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workforce_job_reschedule"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reschedule #{self.id} for Job #{self.job_id} (Delay #{self.delay_count} - Escalated: {self.escalated_to_support})"


class PostServiceProof(models.Model):
    job = models.OneToOneField(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="post_service_proof",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="post_service_proofs",
    )
    after_appliance_photo = models.FileField(upload_to="post_service/appliance/", null=True, blank=True)
    after_work_area_photo = models.FileField(upload_to="post_service/work_area/", null=True, blank=True)
    completion_notes = models.TextField(blank=True, default="")
    parts_used = models.JSONField(default=list, blank=True)

    is_submitted = models.BooleanField(default=False, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_post_service_proof"

    def check_submission(self):
        ready = bool(
            self.after_appliance_photo
            and self.after_work_area_photo
            and self.completion_notes
        )
        if ready and not self.is_submitted:
            from django.utils import timezone
            self.is_submitted = True
            self.submitted_at = timezone.now()
        return self.is_submitted

    def __str__(self):
        return f"PostService Proof Job #{self.job_id} (Submitted: {self.is_submitted})"


class WorkforceEmployeeChangeRequest(models.Model):
    class Status(models.TextChoices):
        PENDING  = "PENDING",  "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="change_requests",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="employee_change_requests",
        null=True,
        blank=True,
    )
    field_name = models.CharField(max_length=100, db_index=True)
    field_label = models.CharField(max_length=150, default="")
    old_value = models.TextField(blank=True, default="")
    new_value = models.TextField()
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    admin_notes = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_change_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_employee_change_request"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ChangeRequest #{self.id} for {self.employee}: {self.field_label} ({self.status})"


class WorkforceUserPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workforce_preference",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_preferences",
    )
    theme = models.CharField(max_length=20, default="light")
    accent_color = models.CharField(max_length=30, default="blue")
    layout_density = models.CharField(max_length=20, default="comfortable")
    font_size = models.CharField(max_length=20, default="medium")
    high_contrast = models.BooleanField(default=False)
    reduced_motion = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_user_preference"

    def __str__(self):
        return f"Preferences for {self.user.username} ({self.theme}/{self.accent_color})"


class WorkforceNotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workforce_notification_preference",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_notification_preferences",
    )
    security_alerts = models.BooleanField(default=True)
    login_alerts = models.BooleanField(default=True)
    leave_updates = models.BooleanField(default=True)
    job_assignments = models.BooleanField(default=True)
    shift_reminders = models.BooleanField(default=True)
    payroll_notifications = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    product_updates = models.BooleanField(default=False)
    workspace_announcements = models.BooleanField(default=True)
    channel_email = models.BooleanField(default=True)
    channel_in_app = models.BooleanField(default=True)
    channel_sms = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_notification_preference"

    def __str__(self):
        return f"Notification Preferences for {self.user.username}"


class WorkforceJobFeedback(models.Model):
    job = models.OneToOneField(
        "service_requests.ServiceRequest",
        on_delete=models.CASCADE,
        related_name="feedback_review",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="customer_feedbacks",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workforce_feedbacks_given",
    )
    rating = models.IntegerField(default=5)
    review = models.TextField(blank=True, default="")
    csat_score = models.IntegerField(default=5)
    resolution_ontime = models.BooleanField(default=True)
    customer_name = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "workforce_job_feedback"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Feedback for Job #{self.job_id} - {self.rating} Stars ({self.employee})"


class WorkforceEventLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workforce_event_logs",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "workforce_event_log"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} at {self.created_at}"


class EmployeeSavedLocation(models.Model):
    """Employee-owned personal saved locations (home, work, favourite spot, etc.).

    Strictly separate from:
      - time_tracking.Location  (company-controlled authorized geofence)
      - User.last_known_location  (live device GPS, updated automatically)
      - ServiceRequest.latitude/longitude  (customer job coordinates, read-only later)
    """

    LABEL_CHOICES = [
        ("home", "Home"),
        ("work", "Work"),
        ("other", "Other"),
    ]

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="saved_locations",
    )
    label = models.CharField(max_length=50, choices=LABEL_CHOICES, default="other")
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    locality = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=20, blank=True)
    landmark = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workforce_employee_saved_location"
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        return f"{self.employee_id} — {self.name} ({self.label})"




