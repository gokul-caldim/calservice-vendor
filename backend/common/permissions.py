"""
workforce-app/backend/common/permissions.py
Reusable multi-tenant permission classes.
"""
from rest_framework import permissions


class HasCompany(permissions.BasePermission):
    message = "No company associated with this account."

    def has_permission(self, request, view):
        return bool(getattr(request, "company", None))


class IsCompanyMember(permissions.BasePermission):
    message = "This object does not belong to your company."

    def has_object_permission(self, request, view, obj):
        company = getattr(request, "company", None)
        if company is None:
            return False
        if hasattr(obj, "company"):
            return getattr(obj, "company_id", None) == company.pk
        return False
