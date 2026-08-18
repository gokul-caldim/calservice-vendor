"""
workforce-app/backend/workforce_api/permissions.py
Role and lifecycle state based authorization guards for Workforce API.
"""
from rest_framework.permissions import BasePermission
from accounts.permissions import is_admin_role


class IsWorkforceAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin_role(getattr(request, "user", None))


class IsWorkforceEmployee(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        role = str(getattr(user, "role", "")).lower()
        return role == "employee" or is_admin_role(user)


class IsPlatformSuperAdmin(BasePermission):
    """
    Authorizes Platform Superadmin actors (cross-tenant platform operators).
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "is_superuser", False))


class IsVendorAdmin(BasePermission):
    """
    Authorizes a Vendor Admin/Manager.
    Requires user to have an admin role AND an assigned company tenant.
    Platform superusers are also permitted.
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True
        role = str(getattr(user, "role", "")).lower()
        has_admin_role = is_admin_role(user)
        has_company = getattr(user, "company_id", None) is not None or getattr(getattr(user, "employee_profile", None), "company_id", None) is not None
        return has_admin_role and has_company


class IsApprovedTechnician(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if is_admin_role(user):
            return True

        emp = getattr(user, "employee_profile", None)
        if not emp or not emp.is_active:
            return False

        ob_data = (emp.bank_details or {}).get("onboarding", {})
        ob_status = ob_data.get("status", "").lower()
        return ob_status == "approved"
