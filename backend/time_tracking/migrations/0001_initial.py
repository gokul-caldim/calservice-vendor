import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Location",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("address", models.TextField(blank=True)),
                ("lat", models.FloatField()),
                ("lng", models.FloatField()),
                ("geofence_radius", models.PositiveIntegerField(default=300)),
                ("geofence_polygon", models.JSONField(blank=True, null=True)),
                ("geofence_type", models.CharField(choices=[("circle", "Circle (radius)"), ("polygon", "Polygon (GeoJSON)"), ("hybrid", "Hybrid (circle OR polygon)")], default="circle", max_length=10)),
                ("location_type", models.CharField(choices=[("office", "Office"), ("job_site", "Job Site"), ("client_site", "Client Site"), ("warehouse", "Warehouse"), ("other", "Other")], default="office", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("is_archived", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="locations", to="companies.company")),
            ],
        ),
        migrations.CreateModel(
            name="JobSite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("address", models.TextField(blank=True)),
                ("lat", models.DecimalField(decimal_places=6, max_digits=9)),
                ("lng", models.DecimalField(decimal_places=6, max_digits=9)),
                ("geofence_radius", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="job_sites", to="companies.company")),
            ],
        ),
        migrations.CreateModel(
            name="LocationZone",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("color", models.CharField(default="#4F46E5", max_length=7)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="location_zones", to="companies.company")),
                ("locations", models.ManyToManyField(blank=True, related_name="zones", to="time_tracking.location")),
            ],
        ),
        migrations.CreateModel(
            name="EmployeeLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_primary", models.BooleanField(default=False)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="permitted_locations", to="employees.employee")),
                ("location", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="permitted_employees", to="time_tracking.location")),
            ],
            options={
                "unique_together": {("employee", "location")},
            },
        ),
        migrations.CreateModel(
            name="TimeLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField(db_index=True)),
                ("clock_in", models.DateTimeField()),
                ("clock_in_lat", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("clock_in_lon", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("clock_in_address", models.TextField(blank=True)),
                ("clock_in_notes", models.TextField(blank=True)),
                ("clock_in_photo", models.ImageField(blank=True, null=True, upload_to="time_logs/photos/")),
                ("clock_out", models.DateTimeField(blank=True, null=True)),
                ("clock_out_lat", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("clock_out_lon", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("clock_out_address", models.TextField(blank=True)),
                ("clock_out_notes", models.TextField(blank=True)),
                ("clock_out_photo", models.ImageField(blank=True, null=True, upload_to="time_logs/photos/")),
                ("distance_from_site_meters", models.IntegerField(blank=True, null=True)),
                ("geofence_passed", models.BooleanField(default=False)),
                ("admin_override_used", models.BooleanField(default=False)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("submitted", "Submitted"), ("approved", "Approved"), ("rejected", "Rejected")], default="draft", max_length=20)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("admin_notes", models.TextField(blank=True)),
                ("face_match_status", models.CharField(choices=[("pending", "Pending"), ("matched", "Matched"), ("mismatch", "Mismatch"), ("skipped", "Skipped")], default="pending", max_length=20)),
                ("face_match_score", models.FloatField(blank=True, null=True)),
                ("manual_hours_correction", models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_time_logs", to=settings.AUTH_USER_MODEL)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="time_logs", to="companies.company")),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="time_logs", to="employees.employee")),
                ("location", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="time_logs", to="time_tracking.location")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="time_logs", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Break",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("break_start", models.DateTimeField()),
                ("break_end", models.DateTimeField(blank=True, null=True)),
                ("break_type", models.CharField(choices=[("tea", "Tea Break"), ("lunch", "Lunch Break"), ("personal", "Personal Break")], default="tea", max_length=20)),
                ("duration_minutes", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("time_log", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="breaks", to="time_tracking.timelog")),
            ],
        ),
        migrations.CreateModel(
            name="TimeLogPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("photo", models.ImageField(upload_to="time_logs/photos/")),
                ("photo_type", models.CharField(choices=[("before", "Before"), ("after", "After"), ("progress", "Progress")], max_length=20)),
                ("caption", models.TextField(blank=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("time_log", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="time_tracking.timelog")),
            ],
        ),
        migrations.AddIndex(
            model_name="timelog",
            index=models.Index(fields=["employee", "work_date"], name="time_tracki_employe_059714_idx"),
        ),
        migrations.AddIndex(
            model_name="timelog",
            index=models.Index(fields=["employee", "clock_out"], name="time_tracki_employe_0b691d_idx"),
        ),
        migrations.AddIndex(
            model_name="timelog",
            index=models.Index(fields=["company", "work_date"], name="time_tracki_company_e3d368_idx"),
        ),
        migrations.AddConstraint(
            model_name="timelog",
            constraint=models.UniqueConstraint(condition=models.Q(("clock_out__isnull", True)), fields=("employee",), name="unique_open_timelog_per_employee"),
        ),
    ]
