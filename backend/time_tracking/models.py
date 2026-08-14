from django.db import models
from django.conf import settings
from django.utils import timezone
from common.models import CompanyScopedManager


class Location(models.Model):
    """Org location — office, job site, client site, warehouse."""

    LOCATION_TYPES = [
        ("office", "Office"),
        ("job_site", "Job Site"),
        ("client_site", "Client Site"),
        ("warehouse", "Warehouse"),
        ("other", "Other"),
    ]

    GEOFENCE_TYPES = [
        ("circle", "Circle (radius)"),
        ("polygon", "Polygon (GeoJSON)"),
        ("hybrid", "Hybrid (circle OR polygon)"),
    ]

    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="locations", null=True, blank=True)
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    lat = models.FloatField()
    lng = models.FloatField()

    geofence_radius = models.PositiveIntegerField(default=300)
    geofence_polygon = models.JSONField(null=True, blank=True)
    geofence_type = models.CharField(max_length=10, choices=GEOFENCE_TYPES, default="circle")

    location_type = models.CharField(max_length=20, choices=LOCATION_TYPES, default="office")
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CompanyScopedManager()

    def __str__(self):
        return self.name


class JobSite(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="job_sites", null=True, blank=True)
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    geofence_radius = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CompanyScopedManager()

    def __str__(self):
        return self.name


class LocationZone(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="location_zones", null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#4F46E5")
    locations = models.ManyToManyField(Location, related_name="zones", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CompanyScopedManager()

    def __str__(self):
        return self.name


class EmployeeLocation(models.Model):
    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="permitted_locations")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="permitted_employees")
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ("employee", "location")

    def __str__(self):
        return f"Employee {self.employee_id} @ {self.location}"


class TimeLog(models.Model):
    """Core Attendance Record."""

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="time_logs")
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="time_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_logs")
    work_date = models.DateField(db_index=True)

    clock_in = models.DateTimeField()
    clock_in_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_in_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_in_address = models.TextField(blank=True)
    clock_in_notes = models.TextField(blank=True)
    clock_in_photo = models.ImageField(upload_to="time_logs/photos/", null=True, blank=True)

    clock_out = models.DateTimeField(null=True, blank=True)
    clock_out_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_address = models.TextField(blank=True)
    clock_out_notes = models.TextField(blank=True)
    clock_out_photo = models.ImageField(upload_to="time_logs/photos/", null=True, blank=True)

    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="time_logs")

    distance_from_site_meters = models.IntegerField(null=True, blank=True)
    geofence_passed = models.BooleanField(default=False)
    admin_override_used = models.BooleanField(default=False)

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_time_logs")
    admin_notes = models.TextField(blank=True)

    FACE_MATCH_CHOICES = [
        ("pending", "Pending"),
        ("matched", "Matched"),
        ("mismatch", "Mismatch"),
        ("skipped", "Skipped"),
    ]
    face_match_status = models.CharField(max_length=20, choices=FACE_MATCH_CHOICES, default="pending")
    face_match_score = models.FloatField(null=True, blank=True)

    manual_hours_correction = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CompanyScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["employee", "work_date"], name="time_tracki_employe_059714_idx"),
            models.Index(fields=["employee", "clock_out"], name="time_tracki_employe_0b691d_idx"),
            models.Index(fields=["company", "work_date"], name="time_tracki_company_e3d368_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["employee"],
                condition=models.Q(clock_out__isnull=True),
                name="unique_open_timelog_per_employee",
            )
        ]

    @property
    def is_open(self) -> bool:
        return self.clock_out is None

    def break_seconds(self) -> int:
        total = 0
        for b in self.breaks.all():
            if b.break_end:
                total += int((b.break_end - b.break_start).total_seconds())
        return total

    def worked_seconds(self) -> int:
        if not self.clock_out:
            return 0
        raw = int((self.clock_out - self.clock_in).total_seconds())
        return max(0, raw - self.break_seconds())


class Break(models.Model):
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name="breaks")
    break_start = models.DateTimeField()
    break_end = models.DateTimeField(null=True, blank=True)

    BREAK_TYPES = [
        ("tea", "Tea Break"),
        ("lunch", "Lunch Break"),
        ("personal", "Personal Break"),
    ]
    break_type = models.CharField(max_length=20, choices=BREAK_TYPES, default="tea")
    duration_minutes = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.break_start and self.break_end:
            delta = self.break_end - self.break_start
            self.duration_minutes = int(delta.total_seconds() / 60)
        super().save(*args, **kwargs)

    @property
    def is_open(self) -> bool:
        return self.break_end is None


class TimeLogPhoto(models.Model):
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name="photos")
    photo = models.ImageField(upload_to="time_logs/photos/")
    photo_type = models.CharField(max_length=20, choices=[
        ("before", "Before"),
        ("after", "After"),
        ("progress", "Progress"),
    ])
    caption = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
