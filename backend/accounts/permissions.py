"""
workforce-app/backend/accounts/permissions.py
Role-based permission helpers.
"""
from rest_framework.permissions import BasePermission

ADMIN_ROLES = frozenset({"admin", "manager"})


def is_admin_role(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    role = str(getattr(user, "role", "")).lower()
    return role in ADMIN_ROLES or getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)


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
