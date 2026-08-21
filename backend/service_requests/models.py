"""
workforce-app/backend/service_requests/models.py
ServiceRequest model pointing to shared Supabase table service_requests_servicerequest (managed=False).
"""
from django.conf import settings
from django.db import models
from common.models import CompanyScopedManager

SERVICE_CATEGORIES = [
    ("hvac", "HVAC & Air Conditioning"),
    ("electrical", "Electrical & Wiring"),
    ("plumbing", "Plumbing & Sanitation"),
    ("appliance_repair", "Home Appliance Repair"),
    ("cleaning", "Cleaning & Sanitization"),
    ("carpentry", "Carpentry & Furniture"),
    ("painting", "Painting & Waterproofing"),
    ("pest_control", "Pest Control"),
    ("security", "Security & CCTV"),
    ("general", "General Maintenance"),
]


def _generate_request_id():
    last = ServiceRequest.objects.order_by("-id").first()
    num = (last.id + 1) if last and last.id else 1
    candidate = f"SR-{str(num).zfill(4)}"
    while ServiceRequest.objects.filter(request_id=candidate).exists():
        num += 1
        candidate = f"SR-{str(num).zfill(4)}"
    return candidate


class CatalogCategory(models.Model):

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=100, blank=True, default="")
    image = models.CharField(max_length=500, blank=True, default="")
    jobs_count_str = models.CharField(max_length=50, blank=True, default="")
    rating = models.CharField(max_length=10, blank=True, default="4.8")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = "service_requests_catalogcategory"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.name


class Service(models.Model):
    category = models.ForeignKey(
        CatalogCategory,
        on_delete=models.CASCADE,
        related_name="services",
        db_column="category_id"
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=100, blank=True, default="")
    image = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        managed = False
        db_table = "service_requests_service"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} ({self.category.name if self.category else 'No Category'})"


class ServiceRequest(models.Model):

    class Status(models.TextChoices):
        DRAFT                 = "draft",                 "Draft"
        NEW_REQUEST           = "new_request",           "New Request"
        PENDING_PAYMENT       = "pending_payment",       "Pending Payment"
        CONFIRMED             = "confirmed",             "Confirmed"
        ASSIGNED              = "assigned",              "Assigned"
        RECEIVED              = "received",              "Received"
        ACCEPTED              = "accepted",              "Accepted"
        ON_THE_WAY            = "on_the_way",            "On The Way"
        EN_ROUTE              = "en_route",              "En Route"
        ARRIVED               = "arrived",               "Arrived"
        IN_PROGRESS           = "in_progress",           "In Progress"
        REDISPATCHING         = "redispatching",         "Redispatching"
        COMPLETED             = "completed",             "Completed"
        CANCELLED             = "cancelled",             "Cancelled"
        UNABLE_TO_COMPLETE    = "unable_to_complete",    "Unable To Complete"
        FOLLOW_UP_REQUIRED    = "follow_up_required",    "Follow Up Required"

    class Priority(models.TextChoices):
        LOW    = "low",    "Low"
        NORMAL = "normal", "Normal"
        HIGH   = "high",   "High"
        URGENT = "urgent", "Urgent"

    class PaymentMethod(models.TextChoices):
        COD    = "COD",    "Cash on Service"
        ONLINE = "ONLINE", "Online Payment"

    class PaymentStatus(models.TextChoices):
        PENDING   = "pending",   "Pending"
        COLLECTED = "collected", "Collected"
        PAID      = "paid",      "Paid"
        FAILED    = "failed",    "Failed"
        CANCELLED = "cancelled", "Cancelled"

    request_id = models.CharField(max_length=20, unique=True, blank=True)
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="service_requests",
        null=True, blank=True,
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="service_requests_as_customer",
        null=True, blank=True,
    )
    customer_name = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, null=True)

    service_category = models.CharField(max_length=150)
    issue_title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    address = models.TextField()
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    preferred_date = models.DateField(null=True, blank=True)
    preferred_time = models.CharField(max_length=50, blank=True, null=True)
    photo = models.ImageField(upload_to="service_requests/photos/", null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cart_data = models.JSONField(default=list, blank=True)

    drop_address = models.TextField(blank=True, default="")
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.COD,
        blank=True,
    )
    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        blank=True,
    )
    transaction_id = models.CharField(max_length=200, blank=True, null=True)
    payment_gateway = models.CharField(max_length=50, blank=True, null=True)
    invoice_id = models.CharField(max_length=50, blank=True, null=True)

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.NEW_REQUEST)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)

    assigned_employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_service_requests",
    )
    technician_name = models.CharField(max_length=200, blank=True, default="")
    technician_phone = models.CharField(max_length=50, blank=True, default="")
    technician_photo = models.CharField(max_length=500, blank=True, default="")
    technician_location_name = models.CharField(max_length=200, blank=True, default="")
    start_otp = models.CharField(max_length=10, blank=True, default="")
    otp_verified = models.BooleanField(default=False)
    otp_attempt_count = models.IntegerField(default=0, blank=True)
    otp_hash = models.CharField(max_length=255, blank=True, default="")
    payment_collected_by_name = models.CharField(max_length=200, blank=True, default="")
    collection_method = models.CharField(max_length=50, blank=True, default="")
    collection_reference = models.CharField(max_length=100, blank=True, default="")

    workforce_job_id = models.CharField(max_length=100, blank=True, default="")
    external_assignment_id = models.CharField(max_length=100, blank=True, default="")
    technician_name = models.CharField(max_length=200, blank=True, default="")
    technician_phone = models.CharField(max_length=50, blank=True, default="")
    technician_photo = models.TextField(blank=True, default="")
    technician_rating = models.FloatField(null=True, blank=True)
    payment_collected_by_name = models.CharField(max_length=200, blank=True, default="")
    collection_method = models.CharField(max_length=50, blank=True, default="")
    collection_reference = models.CharField(max_length=100, blank=True, default="")
    service_zone_name_snapshot = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CompanyScopedManager()

    class Meta:
        managed = False
        db_table = "service_requests_servicerequest"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.request_id or f'SR #{self.pk}'} - {self.issue_title} ({self.status})"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not self.request_id:
            self.request_id = _generate_request_id()
        super().save(*args, **kwargs)

        if is_new and self.status in ["new_request", "confirmed", "draft"]:
            try:
                from workforce_api.services.automatic_dispatch import dispatch_job
                dispatch_job(self)
            except Exception as e:
                import logging
                logging.getLogger("workforce.dispatch").exception(
                    f"[AUTO_DISPATCH_TRIGGER_FAILED] Failed to trigger automatic dispatch for Job #{self.id}: {e}"
                )



    def is_ready_to_complete(self):
        """
        Authoritative completion aggregation check for a ServiceRequest.
        A ServiceRequest can become COMPLETED only when:
        1. Required proof of work is submitted.
        2. All accepted work extensions for this job are COMPLETED or RESOLVED.
        3. All specialist secondary jobs linked to this request are COMPLETED.
        4. No unresolved operational dependencies remain.
        Returns:
            (is_ready: bool, reason: str, pending_dependencies: list)
        """
        pending_dependencies = []

        # 1. Check post-service proof
        proof = getattr(self, "post_service_proof", None)
        if not proof:
            from workforce_api.models import PostServiceProof
            proof = PostServiceProof.objects.filter(job=self).first()

        if not proof or not proof.is_submitted:
            pending_dependencies.append("Post-service proof (photos and completion notes) has not been submitted.")

        # 2. Check accepted work extensions
        from workforce_api.models import WorkforceWorkExtension
        open_extensions = WorkforceWorkExtension.objects.filter(
            job=self,
            status__in=[
                WorkforceWorkExtension.Status.REQUESTED,
                WorkforceWorkExtension.Status.ADMIN_APPROVED,
                WorkforceWorkExtension.Status.PENDING_ASSIGNMENT,
                WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED,
                WorkforceWorkExtension.Status.IN_PROGRESS,
            ]
        )
        for ext in open_extensions:
            pending_dependencies.append(
                f"Work extension #{ext.id} ('{ext.title}') is still in '{ext.status}' state."
            )

        # 3. Check specialist secondary jobs linked via cart_data or extension foreign keys
        cart_data = self.cart_data or []
        for item in cart_data:
            if item.get("type") == "specialist_job" and item.get("job_id"):
                s_job = ServiceRequest.objects.filter(pk=item["job_id"]).first()
                if s_job and s_job.status not in ["completed", "cancelled"]:
                    pending_dependencies.append(
                        f"Secondary specialist job #{s_job.id} is still in '{s_job.status}' state."
                    )

        for ext in WorkforceWorkExtension.objects.filter(job=self, specialist_job__isnull=False):
            if ext.specialist_job and ext.specialist_job.status not in ["completed", "cancelled"]:
                msg = f"Secondary specialist job #{ext.specialist_job.id} (Extension #{ext.id}) is still in '{ext.specialist_job.status}' state."
                if msg not in pending_dependencies:
                    pending_dependencies.append(msg)

        # 4. Check payment state machine: Payment must be verified as PAID before closing job
        try:
            from workforce_api.models import JobPayment
            pmt = getattr(self, "payment_record", None) or JobPayment.objects.filter(job=self).first()
            if pmt:
                if pmt.payment_status == JobPayment.PaymentStatus.PENDING and pmt.payment_method == JobPayment.PaymentMethod.CASH_ON_SERVICE:
                    pending_dependencies.append("Cash on service payment collection is required before closing job.")
                elif pmt.payment_status not in [JobPayment.PaymentStatus.PAID, "PAID", "paid", JobPayment.PaymentStatus.CASH_PENDING]:
                    pending_dependencies.append(f"Payment is in '{pmt.payment_status}' state (must be PAID before closing job).")
            else:
                if str(self.payment_status).lower() not in ["paid", "collected"]:
                    pending_dependencies.append(f"Payment status is '{self.payment_status}' (must be PAID before closing job).")
        except Exception as e:
            pending_dependencies.append(f"Payment verification failed: {str(e)}")

        is_ready = len(pending_dependencies) == 0
        reason = "Ready for completion." if is_ready else f"Cannot complete ServiceRequest: {'; '.join(pending_dependencies)}"
        return is_ready, reason, pending_dependencies



class EmployeeJob(models.Model):
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="employee_jobs",
        db_column="service_request_id"
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="employee_jobs",
        db_column="employee_id"
    )
    status = models.CharField(max_length=50, default="ASSIGNED")
    notes = models.TextField(blank=True, default="")
    assigned_date = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    accepted_date = models.DateTimeField(null=True, blank=True)
    started_date = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)
    is_primary = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_employee_jobs",
        db_column="assigned_by_id"
    )

    uncompletion_reason = models.TextField(blank=True, default="")
    source_work_extension_id = models.BigIntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "service_requests_employeejob"

    def __str__(self):
        return f"EmployeeJob SR-{self.service_request_id} -> Emp {self.employee_id} ({self.status})"


