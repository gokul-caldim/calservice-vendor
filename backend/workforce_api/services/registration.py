"""
workforce-app/backend/workforce_api/services/registration.py
Centralized, authoritative source of truth for Employee registration status & onboarding lifecycle.
"""
import logging
from typing import Any, Dict, Optional
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

# Canonical Lifecycle Status Constants
REGISTRATION_STATUS_NOT_STARTED = "not_started"
REGISTRATION_STATUS_IN_PROGRESS = "in_progress"
REGISTRATION_STATUS_SUBMITTED = "submitted"
REGISTRATION_STATUS_UNDER_REVIEW = "under_review"
REGISTRATION_STATUS_CORRECTION_REQUIRED = "correction_required"
REGISTRATION_STATUS_APPROVED = "approved"
REGISTRATION_STATUS_REJECTED = "rejected"

VALID_REGISTRATION_STATUSES = {
    REGISTRATION_STATUS_NOT_STARTED,
    REGISTRATION_STATUS_IN_PROGRESS,
    REGISTRATION_STATUS_SUBMITTED,
    REGISTRATION_STATUS_UNDER_REVIEW,
    REGISTRATION_STATUS_CORRECTION_REQUIRED,
    REGISTRATION_STATUS_APPROVED,
    REGISTRATION_STATUS_REJECTED,
}


def get_employee_onboarding_dict(emp: Any) -> Dict[str, Any]:
    """
    Returns the structured onboarding dictionary from the employee's bank_details JSON field.
    """
    if not emp:
        return {
            "status": REGISTRATION_STATUS_NOT_STARTED,
            "step": 1,
            "draft": {},
            "services": [],
            "documents": {},
            "correction_notes": "",
            "rejection_reason": "",
            "submitted_at": None,
            "approved_at": None,
        }

    bank_details = getattr(emp, "bank_details", None)
    if isinstance(bank_details, dict):
        ob = bank_details.get("onboarding")
        if isinstance(ob, dict):
            return ob

    return {
        "status": REGISTRATION_STATUS_NOT_STARTED,
        "step": 1,
        "draft": {},
        "services": [],
        "documents": {},
        "correction_notes": "",
        "rejection_reason": "",
        "submitted_at": None,
        "approved_at": None,
    }


def get_employee_registration_status(user_or_emp: Any) -> str:
    """
    Authoritative resolution of registration status for an Employee or User instance.
    - Admins/Managers/Superusers are always 'approved'.
    - Employees resolve status from their canonical onboarding metadata.
    """
    if not user_or_emp:
        return REGISTRATION_STATUS_NOT_STARTED

    from employees.models import Employee
    User = get_user_model()

    user = None
    emp = None

    if isinstance(user_or_emp, Employee):
        emp = user_or_emp
        user = getattr(emp, "user", None)
    elif isinstance(user_or_emp, User):
        user = user_or_emp
        emp = getattr(user, "employee_profile", None)
        if not emp:
            try:
                emp = Employee.objects.filter(user=user).first()
            except Exception:
                emp = None
    else:
        # Generic object duck-typing
        user = getattr(user_or_emp, "user", None)
        emp = user_or_emp if hasattr(user_or_emp, "bank_details") else None

    # Check if admin/manager/superuser
    if user:
        if getattr(user, "is_superuser", False):
            return REGISTRATION_STATUS_APPROVED
        role = str(getattr(user, "role", "")).lower()
        if role in ("admin", "manager"):
            return REGISTRATION_STATUS_APPROVED

    if not emp:
        return REGISTRATION_STATUS_NOT_STARTED

    ob = get_employee_onboarding_dict(emp)
    raw_status = str(ob.get("status", REGISTRATION_STATUS_NOT_STARTED)).strip().lower()

    if raw_status in VALID_REGISTRATION_STATUSES:
        return raw_status

    return REGISTRATION_STATUS_NOT_STARTED


def is_employee_approved(user_or_emp: Any) -> bool:
    """
    Returns True if the employee/user registration status is strictly 'approved'.
    """
    return get_employee_registration_status(user_or_emp) == REGISTRATION_STATUS_APPROVED
