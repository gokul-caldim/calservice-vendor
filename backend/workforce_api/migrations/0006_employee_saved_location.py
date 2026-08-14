"""
Migration: 0006_employee_saved_location

Adds the EmployeeSavedLocation model table.

Additive-only — does not modify or remove any existing table or column.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("workforce_api", "0005_employee_platform_integration"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmployeeSavedLocation",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_locations",
                        to="employees.employee",
                    ),
                ),
                (
                    "label",
                    models.CharField(
                        choices=[("home", "Home"), ("work", "Work"), ("other", "Other")],
                        default="other",
                        max_length=50,
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("address", models.TextField(blank=True)),
                ("locality", models.CharField(blank=True, max_length=255)),
                ("city", models.CharField(blank=True, max_length=100)),
                ("state", models.CharField(blank=True, max_length=100)),
                ("pincode", models.CharField(blank=True, max_length=20)),
                ("landmark", models.CharField(blank=True, max_length=255)),
                ("latitude", models.DecimalField(decimal_places=7, max_digits=10)),
                ("longitude", models.DecimalField(decimal_places=7, max_digits=10)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "workforce_employee_saved_location",
                "ordering": ["-is_default", "-created_at"],
            },
        ),
    ]
