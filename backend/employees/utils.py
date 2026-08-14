"""
workforce-app/backend/employees/utils.py
Helper for generating sequential employee ID.
"""
from django.db.models import Max


def generate_next_employee_id(company) -> str:
    from .models import Employee

    company_prefix = (
        getattr(company, "display_id", None)
        or getattr(company, "slug", None)
        or "EMP"
    ).upper()[:4]

    existing = (
        Employee.objects.filter(company=company)
        .exclude(employee_id__isnull=True)
        .exclude(employee_id="")
        .values_list("employee_id", flat=True)
    )

    max_num = 0
    for emp_id in existing:
        if emp_id and "-" in emp_id:
            try:
                num_part = int(emp_id.split("-")[-1])
                if num_part > max_num:
                    max_num = num_part
            except (ValueError, IndexError):
                pass
        elif emp_id and emp_id.startswith("EMP"):
            try:
                num_part = int(emp_id[3:])
                if num_part > max_num:
                    max_num = num_part
            except (ValueError, IndexError):
                pass

    return f"{company_prefix}-{max_num + 1:04d}"
