"""
workforce-app/backend/workforce_api/views.py
Complete API views for Workforce Registration, Admin Approvals, Decoupled Availability, and Field Dispatch.
"""
import uuid
import os
from decimal import Decimal
from django.conf import settings

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.authentication import set_auth_cookies
from companies.models import Company, Region
from employees.models import Employee, PresenceLog
from employees.utils import generate_next_employee_id
from service_requests.models import ServiceRequest
from service_requests.state_machine import apply_transition
from time_tracking.models import Location, TimeLog
from time_tracking.geo import evaluate


from datetime import timedelta
import secrets
from accounts.permissions import is_admin_role
from .permissions import IsWorkforceAdmin, IsWorkforceEmployee, IsApprovedTechnician
from .serializers import (
    WorkforceSignupSerializer,
    WorkforceOnboardingDraftSerializer,
    WorkforceEmployeeProfileSerializer,
    WorkforceJobSerializer,
    WorkforceWorkExtensionSerializer,
    CustomerWorkforceExtensionSerializer,
    WorkforceSupplementalInvoiceSerializer,
    WorkforceJobRescheduleSerializer,
    WorkforceEmployeeChangeRequestSerializer,
    WorkforceUserPreferenceSerializer,
    WorkforceNotificationPreferenceSerializer,
    WorkforceJobFeedbackSerializer,
)
from .models import (
    WorkforceEmployeeSchedule,
    WorkforceSkill,
    WorkforceEmployeeSkill,
    WorkforceComplianceRequirement,
    WorkforceEmployeeCompliance,
    WorkforcePayPeriod,
    WorkforcePayslip,
    WorkforceJobOffer,
    PreServiceVerification,
    PostServiceProof,
    WorkforceWorkExtension,
    WorkforceSupplementalInvoice,
    WorkforceJobReschedule,
    WorkforceEmployeeChangeRequest,
    WorkforceUserPreference,
    WorkforceNotificationPreference,
    WorkforceJobFeedback,
    WorkforceEventLog,
    WorkforceNotification,
)
from time_tracking.models import TimeLog, Break
from time_tracking.serializers import TimeLogSerializer
import json
import time
from django.http import StreamingHttpResponse, JsonResponse, HttpResponse


User = get_user_model()

# Curated catalog categories and services for technician onboarding & dispatch
WORKFORCE_SERVICE_CATALOG = [
    {
        "id": 1,
        "name": "HVAC & Air Conditioning",
        "icon": "Wrench",
        "services": [
            {"id": 101, "name": "AC Regular Servicing & Jet Clean", "price": 599.00, "duration": 45},
            {"id": 102, "name": "AC Deep Cleaning & Anti-Bacterial Foam", "price": 899.00, "duration": 60},
            {"id": 103, "name": "AC Repair & Gas Refill", "price": 1499.00, "duration": 90},
            {"id": 104, "name": "AC Installation & Copper Piping", "price": 1299.00, "duration": 120},
        ],
    },
    {
        "id": 2,
        "name": "Electrical & Wiring",
        "icon": "Zap",
        "services": [
            {"id": 201, "name": "Switchboard Repair & Installation", "price": 199.00, "duration": 30},
            {"id": 202, "name": "Ceiling Fan Installation & Repair", "price": 249.00, "duration": 30},
            {"id": 203, "name": "Complete Home Wiring Inspection", "price": 799.00, "duration": 90},
            {"id": 204, "name": "Inverter & Battery Setup", "price": 499.00, "duration": 60},
        ],
    },
    {
        "id": 3,
        "name": "Plumbing & Sanitation",
        "icon": "Droplet",
        "services": [
            {"id": 301, "name": "Water Tap & Mixer Repair", "price": 149.00, "duration": 30},
            {"id": 302, "name": "Toilet Flush & Commode Installation", "price": 499.00, "duration": 60},
            {"id": 303, "name": "Drainage Pipe Blockage Removal", "price": 399.00, "duration": 45},
            {"id": 304, "name": "Water Tank Cleaning & Sanitization", "price": 999.00, "duration": 90},
        ],
    },
    {
        "id": 4,
        "name": "Home Appliance Repair",
        "icon": "Tv",
        "services": [
            {"id": 401, "name": "Washing Machine Diagnostic & Repair", "price": 499.00, "duration": 60},
            {"id": 402, "name": "Refrigerator Gas Charging & Repair", "price": 899.00, "duration": 75},
            {"id": 403, "name": "Microwave Oven Repair", "price": 399.00, "duration": 45},
            {"id": 404, "name": "Water Purifier / RO Service & Filter Change", "price": 449.00, "duration": 45},
        ],
    },
]


def get_request_company(request):
    """
    Strict Tenant Isolation Helper:
    Resolves authenticated user's company context explicitly.
    Fails safely with fallback if company context is missing or inaccessible.
    """
    if not request or not hasattr(request, "user") or not request.user or not request.user.is_authenticated:
        return Company.objects.first()
    if hasattr(request.user, "company") and request.user.company:
        return request.user.company
    if hasattr(request.user, "employee_profile") and request.user.employee_profile:
        return request.user.employee_profile.company
    return Company.objects.first()


# ─── 1. Lightweight Employee Signup (Step 1) ──────────────────────────────────

class WorkforceSignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = WorkforceSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            company = Company.objects.first()
            if not company:
                region, _ = Region.objects.get_or_create(
                    code="IN",
                    defaults={"name": "India", "currency": "INR", "currency_symbol": "₹"},
                )
                company = Company.objects.create(
                    company_name="CalServices Operations",
                    display_id="CALS",
                    slug="calservices",
                    primary_country="IN",
                    region=region,
                    is_active=True,
                )

            username_candidate = data["email"].split("@")[0].lower()
            username = username_candidate
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{username_candidate}_{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                email=data["email"],
                mobile_number=data["mobile_number"],
                phone=data["mobile_number"],
                first_name=data["first_name"],
                last_name=data.get("last_name", ""),
                role="employee",
                company=company,
                is_active=True,
                totp_secret="",
                bio="",
            )
            user.set_password(data["password"])
            user.save()

            employee_id = generate_next_employee_id(company)
            employee = Employee.objects.create(
                user=user,
                company=company,
                employee_id=employee_id,
                title="Technician Candidate",
                exempt_status="non_exempt",
                hourly_rate=0,
                is_online=False,
                current_availability="offline",
                is_active=True,
                bank_details={
                    "onboarding": {
                        "status": "not_started",
                        "step": 1,
                        "draft": {
                            "personal": {
                                "first_name": user.first_name,
                                "last_name": user.last_name,
                                "email": user.email,
                                "mobile_number": user.mobile_number,
                            }
                        },
                        "services": [],
                        "documents": {},
                        "correction_notes": "",
                        "rejection_reason": "",
                        "submitted_at": None,
                        "approved_at": None,
                    }
                },
            )

        refresh = RefreshToken.for_user(user)
        refresh["company_id"] = company.id
        refresh["role"] = user.role

        response = Response(
            {
                "message": "Workforce account created successfully.",
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "token": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "employee_id": employee.employee_id,
                    "registration_status": "not_started",
                },
            },
            status=status.HTTP_201_CREATED,
        )

        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


# ─── 2. Onboarding Status & Draft Persistence ─────────────────────────────────

class WorkforceOnboardingMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found for user."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkforceEmployeeProfileSerializer(emp)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforceOnboardingDraftView(APIView):
    permission_classes = [IsWorkforceEmployee]

    def patch(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkforceOnboardingDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        step = serializer.validated_data.get("step")
        draft_data = serializer.validated_data.get("draft_data", {})

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})

        current_status = onboarding.get("status", "not_started")
        if current_status == "not_started":
            onboarding["status"] = "in_progress"

        if step:
            onboarding["step"] = step

        existing_draft = onboarding.get("draft", {})
        existing_draft.update(draft_data)
        onboarding["draft"] = existing_draft

        # Sync core fields
        if "personal" in draft_data:
            p = draft_data["personal"]
            if p.get("dob"):
                emp.date_of_birth = p.get("dob")
        if "services" in draft_data:
            selected_services = draft_data["services"]
            current_services = onboarding.get("services", [])
            existing_statuses = {s.get("id"): s.get("status", "pending") for s in current_services}

            merged_services = []
            for svc in selected_services:
                s_id = svc.get("id")
                merged_services.append({
                    "id": s_id,
                    "name": svc.get("name", ""),
                    "category": svc.get("category", ""),
                    "status": existing_statuses.get(s_id, "pending"),
                    "rejection_reason": "",
                })
            onboarding["services"] = merged_services
            emp.service_roles = [s["name"] for s in merged_services]

        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": "Draft saved successfully.",
            "step": onboarding.get("step"),
            "status": onboarding.get("status"),
        }, status=status.HTTP_200_OK)


# ─── 3. Document Uploads ──────────────────────────────────────────────────────

class WorkforceOnboardingDocumentUploadView(APIView):
    permission_classes = [IsWorkforceEmployee]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get("file")
        category = request.data.get("category", "identification")
        title = request.data.get("title", category)
        document_number = request.data.get("document_number", "")

        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"workforce_docs/emp_{emp.id}_{category}_{uuid.uuid4().hex[:8]}_{file_obj.name}"
        saved_path = default_storage.save(filename, file_obj)
        file_url = default_storage.url(saved_path)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        documents = onboarding.get("documents", {})

        documents[category] = {
            "category": category,
            "title": title,
            "document_number": document_number,
            "file_url": file_url,
            "status": "uploaded",
            "uploaded_at": timezone.now().isoformat(),
            "rejection_reason": "",
        }

        onboarding["documents"] = documents
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": f"Document {title} uploaded successfully.",
            "document": documents[category],
        }, status=status.HTTP_201_CREATED)


# ─── 4. Final Application Submission (Step 7) ─────────────────────────────────

class WorkforceOnboardingSubmitView(APIView):
    permission_classes = [IsWorkforceEmployee]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})

        onboarding["status"] = "submitted"
        onboarding["submitted_at"] = timezone.now().isoformat()
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.is_online = False
        emp.current_availability = "offline"
        emp.save()

        return Response({
            "message": "Application submitted successfully for Workforce Admin verification.",
            "status": "submitted",
        }, status=status.HTTP_200_OK)


# ─── 5. Service Catalog ───────────────────────────────────────────────────────

class WorkforceCatalogListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            db_services = WorkforceServiceCatalog.objects.filter(is_active=True)
            if db_services.exists():
                categories_map = {}
                for item in db_services:
                    cat_name = item.category
                    if cat_name not in categories_map:
                        categories_map[cat_name] = {
                            "id": len(categories_map) + 1,
                            "name": cat_name,
                            "icon": "Wrench",
                            "services": []
                        }
                    categories_map[cat_name]["services"].append({
                        "id": item.id,
                        "name": item.name,
                        "price": float(item.price),
                        "duration": item.duration_minutes,
                    })
                return Response(list(categories_map.values()), status=status.HTTP_200_OK)
        except Exception:
            pass

        return Response(WORKFORCE_SERVICE_CATALOG, status=status.HTTP_200_OK)


# ─── 6. Admin Verification Queue & Dossier Review ─────────────────────────────

class WorkforceAdminApplicationsListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        status_filter = request.query_params.get("status", "").strip().lower()
        employees = Employee.objects.select_related("user", "company").order_by("-id")

        results = []
        for emp in employees:
            profile_data = WorkforceEmployeeProfileSerializer(emp).data
            reg_status = profile_data.get("registration_status", "not_started").lower()

            if status_filter:
                if status_filter == "pending" and reg_status in ["submitted", "under_review"]:
                    results.append(profile_data)
                elif reg_status == status_filter:
                    results.append(profile_data)
            else:
                results.append(profile_data)

        return Response(results, status=status.HTTP_200_OK)


class WorkforceAdminApplicationDetailView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request, pk):
        emp = Employee.objects.filter(pk=pk).select_related("user", "company").first()
        if not emp:
            return Response({"error": "Candidate dossier not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkforceEmployeeProfileSerializer(emp)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforceAdminDocumentVerifyView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk, category):
        emp = Employee.objects.filter(pk=pk).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action", "").lower()
        reason = request.data.get("reason", "")

        if action not in ["approve", "reject"]:
            return Response({"error": "Action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        documents = onboarding.get("documents", {})

        if category not in documents:
            return Response({"error": f"Document '{category}' not found in candidate dossier."}, status=status.HTTP_404_NOT_FOUND)

        documents[category]["status"] = "approved" if action == "approve" else "rejected"
        documents[category]["rejection_reason"] = reason if action == "reject" else ""
        documents[category]["verified_at"] = timezone.now().isoformat()
        documents[category]["verified_by"] = request.user.username

        onboarding["documents"] = documents
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": f"Document '{category}' marked as {action}d.",
            "document": documents[category],
        }, status=status.HTTP_200_OK)


class WorkforceEmployeeServiceRequestView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        service_id = request.data.get("service_id")
        service_name = request.data.get("name", "").strip()

        if not service_id:
            return Response({"error": "service_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate against catalog
        catalog_entry = None
        for cat in WORKFORCE_SERVICE_CATALOG:
            for s in cat.get("services", []):
                if str(s["id"]) == str(service_id):
                    catalog_entry = s
                    break
            if catalog_entry:
                break

        if not catalog_entry:
            db_entry = WorkforceServiceCatalog.objects.filter(pk=service_id).first()
            if db_entry:
                catalog_entry = {"id": db_entry.id, "name": db_entry.name}
            else:
                return Response({"error": f"Invalid service_id '{service_id}'. Not found in catalog."}, status=status.HTTP_400_BAD_REQUEST)

        final_name = catalog_entry.get("name") or service_name

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        services = onboarding.get("services", [])

        existing = next((s for s in services if str(s.get("id")) == str(service_id)), None)
        if existing:
            if existing.get("status") == "approved" and existing.get("request_type") != "remove":
                return Response({"error": f"Service '{final_name}' is already approved for dispatch."}, status=status.HTTP_400_BAD_REQUEST)
            if existing.get("status") == "pending":
                return Response({"error": f"Authorization request for '{final_name}' is already pending review."}, status=status.HTTP_400_BAD_REQUEST)
            existing["status"] = "pending"
            existing["request_type"] = "add"
            existing["name"] = final_name
            existing["requested_at"] = timezone.now().isoformat()
            existing["rejection_reason"] = ""
        else:
            services.append({
                "id": int(service_id),
                "name": final_name,
                "status": "pending",
                "request_type": "add",
                "requested_at": timezone.now().isoformat(),
                "rejection_reason": "",
            })

        onboarding["services"] = services
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": f"Service authorization request for '{final_name}' submitted to Admin for review.",
            "services": services,
        }, status=status.HTTP_201_CREATED)


class WorkforceEmployeeServiceRemoveView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        service_id = request.data.get("service_id")
        if not service_id:
            return Response({"error": "service_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        services = onboarding.get("services", [])

        existing = next((s for s in services if str(s.get("id")) == str(service_id)), None)
        if not existing or existing.get("status") != "approved":
            return Response({"error": "Only currently approved services can be requested for removal."}, status=status.HTTP_400_BAD_REQUEST)

        existing["request_type"] = "remove"
        existing["status"] = "pending"
        existing["removal_requested_at"] = timezone.now().isoformat()

        onboarding["services"] = services
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": f"Removal request for '{existing.get('name')}' submitted to Admin for review.",
            "services": services,
        }, status=status.HTTP_200_OK)


class WorkforceAdminPendingServicesListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        company_id = request.user.company_id if not getattr(request.user, "is_superuser", False) else None
        qs = Employee.objects.select_related("user", "company")
        if company_id:
            qs = qs.filter(company_id=company_id)

        pending_requests = []
        for emp in qs:
            bank_details = emp.bank_details or {}
            onboarding = bank_details.get("onboarding", {})
            services = onboarding.get("services", [])
            for s in services:
                if s.get("status") == "pending":
                    pending_requests.append({
                        "employee_id": emp.id,
                        "employee_code": emp.employee_id,
                        "employee_name": emp.user.get_full_name() or emp.user.username,
                        "service_id": s.get("id"),
                        "service_name": s.get("name"),
                        "request_type": s.get("request_type", "add"),
                        "requested_at": s.get("requested_at") or s.get("removal_requested_at") or timezone.now().isoformat(),
                    })

        return Response(pending_requests, status=status.HTTP_200_OK)


class WorkforceAdminServiceDecideView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk, service_id):
        emp = Employee.objects.filter(pk=pk).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Tenant isolation
        if not getattr(request.user, "is_superuser", False):
            if request.user.company_id and emp.company_id and request.user.company_id != emp.company_id:
                return Response({"error": "Unauthorized cross-company action."}, status=status.HTTP_403_FORBIDDEN)

        # Prevent employee from approving their own request
        if getattr(request.user, "employee_profile", None) and request.user.employee_profile.id == emp.id and not getattr(request.user, "is_superuser", False):
            return Response({"error": "Employees cannot approve or decide their own service authorizations."}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get("action", "").lower()
        reason = request.data.get("reason", "").strip()

        if action not in ["approve", "reject"]:
            return Response({"error": "Action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        services = onboarding.get("services", [])

        target_svc = next((s for s in services if str(s.get("id")) == str(service_id)), None)
        if not target_svc:
            return Response({"error": "Requested service not found on candidate."}, status=status.HTTP_404_NOT_FOUND)

        request_type = target_svc.get("request_type", "add")

        if action == "approve":
            if request_type == "remove":
                services = [s for s in services if str(s.get("id")) != str(service_id)]
                msg = f"Service '{target_svc.get('name')}' removed from authorized dispatch services."
            else:
                target_svc["status"] = "approved"
                target_svc["rejection_reason"] = ""
                target_svc.pop("request_type", None)
                target_svc["approved_at"] = timezone.now().isoformat()
                target_svc["approved_by"] = request.user.username
                msg = f"Service '{target_svc.get('name')}' authorized & approved."
        else:
            if request_type == "remove":
                target_svc["status"] = "approved"
                target_svc.pop("request_type", None)
                target_svc["rejection_reason"] = reason or "Removal request declined by admin."
                msg = f"Removal request for '{target_svc.get('name')}' rejected. Service remains approved."
            else:
                target_svc["status"] = "rejected"
                target_svc["rejection_reason"] = reason or "Qualifications do not meet minimum threshold."
                target_svc.pop("request_type", None)
                target_svc["rejected_at"] = timezone.now().isoformat()
                target_svc["rejected_by"] = request.user.username
                msg = f"Service authorization request for '{target_svc.get('name')}' rejected."

        onboarding["services"] = services
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": msg,
            "services": services,
        }, status=status.HTTP_200_OK)


class WorkforceAdminRequestCorrectionView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        emp = Employee.objects.filter(pk=pk).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get("notes", "").strip()
        if not notes:
            return Response({"error": "Correction notes are required."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})

        onboarding["status"] = "correction_required"
        onboarding["correction_notes"] = notes
        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": "Correction request sent to candidate.",
            "status": "correction_required",
            "notes": notes,
        }, status=status.HTTP_200_OK)


class WorkforceAdminApproveApplicationView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        emp = Employee.objects.filter(pk=pk).select_related("user").first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        if not emp.is_active or not emp.user.is_active:
            return Response({"error": "Cannot approve candidate: User account is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        documents = onboarding.get("documents", {})
        services = onboarding.get("services", [])

        # Validate that ALL submitted documents are approved
        unapproved_docs = [
            cat for cat, doc in documents.items()
            if doc.get("status") != "approved"
        ]
        if unapproved_docs:
            return Response({
                "error": f"Cannot approve candidate: The following documents are not approved: {', '.join(unapproved_docs)}. All dossier documents must be reviewed and APPROVED."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate that at least ONE requested service is approved
        approved_services = [s for s in services if s.get("status") == "approved"]
        if not approved_services:
            return Response({
                "error": "Cannot approve candidate: At least ONE requested service must be marked as APPROVED."
            }, status=status.HTTP_400_BAD_REQUEST)

        onboarding["status"] = "approved"
        onboarding["approved_at"] = timezone.now().isoformat()
        onboarding["approved_by"] = request.user.username

        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.is_active = True
        emp.is_online = False
        emp.current_availability = "offline"
        emp.save()

        return Response({
            "message": "Candidate successfully approved! Operational status set to OFFLINE.",
            "status": "approved",
            "is_online": False,
            "availability": "offline",
        }, status=status.HTTP_200_OK)


class WorkforceAdminRejectApplicationView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        emp = Employee.objects.filter(pk=pk).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get("reason", "Qualifications or documents did not meet verification criteria.")

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})

        onboarding["status"] = "rejected"
        onboarding["rejection_reason"] = reason
        onboarding["rejected_at"] = timezone.now().isoformat()

        bank_details["onboarding"] = onboarding
        emp.bank_details = bank_details
        emp.is_online = False
        emp.current_availability = "offline"
        emp.save()

        return Response({
            "message": "Candidate application rejected.",
            "status": "rejected",
            "reason": reason,
        }, status=status.HTTP_200_OK)


# ─── 7. Decoupled Presence & Availability Toggle (Rule 3) ──────────────────────

class WorkforcePresenceToggleView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        desired_state = request.data.get("is_online")
        if desired_state is not None:
            emp.is_online = bool(desired_state)
        else:
            emp.is_online = not emp.is_online

        emp.current_availability = "available" if emp.is_online else "offline"
        emp.save()

        try:
            PresenceLog.objects.create(
                employee=emp,
                company=emp.company,
                availability=emp.current_availability,
            )
        except Exception:
            pass

        return Response({
            "message": f"Technician is now {'ONLINE (Available)' if emp.is_online else 'OFFLINE'}.",
            "is_online": emp.is_online,
            "availability": emp.current_availability,
        }, status=status.HTTP_200_OK)


class WorkforcePresenceStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"is_online": False, "availability": "offline"}, status=status.HTTP_200_OK)

        return Response({
            "is_online": emp.is_online,
            "availability": emp.current_availability,
            "registration_status": (emp.bank_details or {}).get("onboarding", {}).get("status", "not_started"),
        }, status=status.HTTP_200_OK)


# ─── 8. Field Jobs & State Machine Execution ─────────────────────────────────

class WorkforceJobListView(APIView):
    permission_classes = [IsApprovedTechnician]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)

        if is_admin_role(user):
            if company:
                jobs = ServiceRequest.objects.filter(company=company).order_by("-created_at")[:50]
            else:
                jobs = ServiceRequest.objects.all().order_by("-created_at")[:50]
        elif emp:
            offered_job_ids = WorkforceJobOffer.objects.filter(
                employee=emp,
                status="OFFERED"
            ).values_list("job_id", flat=True)

            try:
                from service_requests.models import EmployeeJob
                emp_job_sr_ids = EmployeeJob.objects.filter(employee=emp).values_list("service_request_id", flat=True)
            except Exception:
                emp_job_sr_ids = []

            qs = ServiceRequest.objects.filter(
                Q(assigned_employee=emp) | Q(id__in=offered_job_ids) | Q(id__in=emp_job_sr_ids)
            )
            if emp.company:
                qs = qs.filter(company=emp.company)

            jobs = qs.exclude(status__in=["completed", "cancelled"]).order_by("-created_at")
        else:
            jobs = ServiceRequest.objects.none()

        serializer = WorkforceJobSerializer(jobs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)



class WorkforceJobTransitionView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        target_status = request.data.get("status")
        if not target_status:
            return Response({"error": "Target status required."}, status=status.HTTP_400_BAD_REQUEST)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            try:
                from service_requests.models import EmployeeJob
                has_emp_job = EmployeeJob.objects.filter(service_request=job, employee=emp).exists()
            except Exception:
                has_emp_job = False
            if not emp or (job.assigned_employee != emp and not has_emp_job):
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)

        try:
            new_status = apply_transition(job, target_status, actor=request.user)
            try:
                from service_requests.models import EmployeeJob
                EmployeeJob.objects.filter(service_request=job, employee=emp).update(status=new_status.upper())
            except Exception:
                pass

            return Response({
                "message": f"Job transitioned to {new_status.upper()}.",
                "job_id": job.id,
                "status": new_status,
            }, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"error": str(e.detail if hasattr(e, 'detail') else e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── 9. Proof of Work & Cash Collection (Phase 16) ───────────────────────────

class WorkforceJobProofView(APIView):
    permission_classes = [IsApprovedTechnician]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or job.assigned_employee != emp:
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)
            if emp.company_id and job.company_id and emp.company_id != job.company_id:
                return Response({"error": "Unauthorized access to job belonging to another company."}, status=status.HTTP_403_FORBIDDEN)

        if job.status not in ["in_progress", "proof_submitted"]:
            return Response({"error": f"Cannot submit completion proof for job in status '{job.status}'. Expected 'in_progress'."}, status=status.HTTP_400_BAD_REQUEST)

        completion_notes = request.data.get("notes", "").strip() or request.data.get("completion_notes", "").strip()
        after_appliance = request.FILES.get("after_appliance_photo") or request.FILES.get("after_photo")
        after_work_area = request.FILES.get("after_work_area_photo") or request.FILES.get("during_photo")
        parts_used = request.data.get("parts_used", [])

        if not after_appliance or not after_work_area or not completion_notes:
            return Response({"error": "After-service proof requires: After Appliance Photo, After Work-Area Photo, and Completion Notes."}, status=status.HTTP_400_BAD_REQUEST)

        proof, _ = PostServiceProof.objects.get_or_create(
            job=job,
            defaults={"employee": emp or job.assigned_employee}
        )
        if after_appliance:
            proof.after_appliance_photo = after_appliance
        if after_work_area:
            proof.after_work_area_photo = after_work_area
        if completion_notes:
            proof.completion_notes = completion_notes
        if parts_used:
            proof.parts_used = parts_used

        proof.check_submission()
        proof.save()

        # Execute logical transitions: in_progress -> proof_submitted -> completed
        apply_transition(job, "proof_submitted", actor=request.user)
        apply_transition(job, "completed", actor=request.user)

        return Response({
            "message": "After-service proof submitted successfully! Job is COMPLETED.",
            "job_id": job.id,
            "status": job.status,
            "is_submitted": proof.is_submitted,
        }, status=status.HTTP_200_OK)


class WorkforceJobCashCollectView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or job.assigned_employee != emp:
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)

        if job.payment_status == "collected":
            return Response({"error": "Cash collection has already been recorded for this job."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_collected = float(request.data.get("amount", job.total_amount))
        except (ValueError, TypeError):
            return Response({"error": "Invalid collection amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount_collected <= 0:
            return Response({"error": "Collection amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        job.payment_status = "collected"
        job.payment_method = "COD"

        cart_data = job.cart_data or []
        cart_data.append({
            "type": "cash_collection",
            "amount": amount_collected,
            "collected_at": timezone.now().isoformat(),
            "collected_by": request.user.username,
        })
        job.cart_data = cart_data
        job.save()

        return Response({
            "message": f"Cash of ₹{amount_collected} successfully recorded as COLLECTED for Job #{job.id}.",
            "payment_status": job.payment_status,
            "total_amount": str(job.total_amount),
        }, status=status.HTTP_200_OK)


# ─── 10. Dynamic Job Dispatch & Eligibility Matching (Phase 14) ───────────────

def check_technician_eligibility(emp, service_name=None):
    """
    Enforces all 7 dispatch eligibility criteria server-side:
    1. Account active (user & emp)
    2. Registration approved
    3. Required dossier documents approved
    4. Requested service approved on technician record
    5. Availability = AVAILABLE (is_online == True)
    6. Shift attendance = Clocked In (decoupled from is_online)
    7. Not on leave & not currently busy on active job
    """
def check_technician_eligibility(emp, service_name=None, prefetched_data=None):
    """
    Evaluates 7-step readiness rules for dynamic dispatch eligibility.
    Supports ORM prefetched attributes to eliminate query roundtrips.
    """
    if not emp or not emp.is_active or not getattr(emp.user, "is_active", True):
        return False, "Technician account is inactive."

    bank_details = emp.bank_details or {}
    onboarding = bank_details.get("onboarding", {})
    reg_status = onboarding.get("status", "not_started")
    if reg_status != "approved":
        return False, "Technician registration onboarding is not approved."

    # Check all dossier documents approved
    documents = onboarding.get("documents", {})
    if any(doc.get("status") != "approved" for doc in documents.values()):
        return False, "Technician has unapproved dossier documents."

    # Check mandatory compliance records
    if hasattr(emp, "prefetched_invalid_compliance"):
        if emp.prefetched_invalid_compliance:
            return False, "Technician has expired or rejected mandatory compliance document."
    elif prefetched_data and "expired_comp_ids" in prefetched_data:
        if emp.id in prefetched_data["expired_comp_ids"]:
            return False, "Technician has expired or rejected mandatory compliance document."
    else:
        mandatory_comp = WorkforceEmployeeCompliance.objects.filter(
            employee=emp,
            requirement__is_mandatory=True,
            status__in=["EXPIRED", "REJECTED"]
        ).first()
        if mandatory_comp:
            return False, f"Technician has expired or rejected mandatory compliance document: '{mandatory_comp.requirement.title}'."

    # Check work schedule
    today_dow = timezone.now().weekday()
    if hasattr(emp, "prefetched_today_schedules"):
        sched = emp.prefetched_today_schedules[0] if emp.prefetched_today_schedules else None
    elif prefetched_data and "schedules" in prefetched_data:
        sched = prefetched_data["schedules"].get(emp.id)
    else:
        sched = WorkforceEmployeeSchedule.objects.filter(employee=emp, day_of_week=today_dow).first()

    if sched:
        if not sched.is_working_day:
            return False, "Technician is scheduled off today."
        now_time = timezone.now().time()
        if not (sched.start_time <= now_time <= sched.end_time):
            return False, f"Technician is outside scheduled working hours ({sched.start_time.strftime('%H:%M')}-{sched.end_time.strftime('%H:%M')})."

    # Check service qualification & verified skills
    approved_svcs = [s.get("name", "") for s in onboarding.get("services", []) if s.get("status") == "approved"]
    if hasattr(emp, "prefetched_verified_skills"):
        verified_skills = [es.skill.name for es in emp.prefetched_verified_skills]
    elif prefetched_data and "skills" in prefetched_data:
        verified_skills = prefetched_data["skills"].get(emp.id, [])
    else:
        verified_skills = list(WorkforceEmployeeSkill.objects.filter(employee=emp, is_verified=True).values_list("skill__name", flat=True))

    if service_name:
        matches_catalog = any(service_name.lower() in s.lower() or s.lower() in service_name.lower() for s in approved_svcs) if approved_svcs else False
        matches_skill = any(service_name.lower() in s.lower() or s.lower() in service_name.lower() for s in verified_skills) if verified_skills else False
        if not matches_catalog and not matches_skill:
            return False, f"Technician is not authorized or verified for requested service '{service_name}'."

    # Check live presence availability
    if not emp.is_online or emp.current_availability != "available":
        return False, "Technician is currently OFFLINE or unavailable."

    # Check leave status (active approved leave spanning current date)
    today_str = timezone.now().date().isoformat()
    leaves = bank_details.get("leaves", [])
    for l in leaves:
        if l.get("status") == "approved":
            start_date = l.get("start_date", "")
            end_date = l.get("end_date", "")
            if start_date <= today_str <= end_date:
                return False, f"Technician is on approved leave from {start_date} to {end_date}."

    # Check active job assignment
    if hasattr(emp, "is_busy_job"):
        if emp.is_busy_job:
            return False, "Technician is busy on active job assignment."
    elif prefetched_data and "busy_ids" in prefetched_data:
        if emp.id in prefetched_data["busy_ids"]:
            return False, "Technician is busy on active job assignment."
    else:
        active_job = ServiceRequest.objects.filter(
            assigned_employee=emp,
            status__in=["accepted", "on_the_way", "in_progress"]
        ).first()
        if active_job:
            return False, f"Technician is busy on active Job #{active_job.id} ({active_job.request_id})."

    return True, "Eligible"


class WorkforceDispatchEligibleListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        from django.db.models import Exists, OuterRef, Prefetch
        service_name = request.query_params.get("service", "").strip()
        job_id = request.query_params.get("job_id")

        if job_id:
            job = ServiceRequest.objects.filter(pk=job_id).first()
            if job:
                service_name = service_name or job.issue_title or job.service_category

        today_dow = timezone.now().weekday()
        busy_subquery = ServiceRequest.objects.filter(
            assigned_employee_id=OuterRef("pk"),
            status__in=["accepted", "on_the_way", "in_progress"]
        )

        candidates = list(
            Employee.objects.filter(is_active=True)
            .select_related("user", "company")
            .annotate(is_busy_job=Exists(busy_subquery))
            .prefetch_related(
                Prefetch(
                    "compliance_records",
                    queryset=WorkforceEmployeeCompliance.objects.filter(
                        requirement__is_mandatory=True,
                        status__in=["EXPIRED", "REJECTED"]
                    ),
                    to_attr="prefetched_invalid_compliance"
                ),
                Prefetch(
                    "schedules",
                    queryset=WorkforceEmployeeSchedule.objects.filter(day_of_week=today_dow),
                    to_attr="prefetched_today_schedules"
                ),
                Prefetch(
                    "employee_skills",
                    queryset=WorkforceEmployeeSkill.objects.filter(is_verified=True).select_related("skill"),
                    to_attr="prefetched_verified_skills"
                )
            )
        )

        eligible = []
        for emp in candidates:
            onboarding = (emp.bank_details or {}).get("onboarding", {})
            reg_status = onboarding.get("status", "not_started")
            approved_svcs = [s.get("name", "") for s in onboarding.get("services", []) if s.get("status") == "approved"]

            is_eligible, reason = check_technician_eligibility(emp, service_name)

            eligible.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "name": emp.user.get_full_name() or emp.user.username,
                "phone": emp.user.mobile_number or emp.user.phone,
                "is_online": emp.is_online,
                "current_availability": emp.current_availability,
                "registration_status": reg_status,
                "approved_services": approved_svcs,
                "is_dispatch_ready": is_eligible,
                "ineligibility_reason": reason if not is_eligible else "",
            })

        return Response(eligible, status=status.HTTP_200_OK)


class WorkforceDispatchAssignView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request):
        job_id = request.data.get("job_id")
        employee_id = request.data.get("employee_id")

        if not job_id or not employee_id:
            return Response({"error": "job_id and employee_id required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            job = ServiceRequest.objects.select_for_update().filter(pk=job_id).first()
            if not job:
                return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

            if job.status in ["completed", "cancelled"]:
                return Response({"error": f"Job #{job.id} is already {job.status}."}, status=status.HTTP_400_BAD_REQUEST)

            emp = Employee.objects.select_for_update().select_related("user").filter(pk=employee_id).first()
            if not emp:
                return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

            # Perform strict server-side eligibility check
            service_name = job.issue_title or job.service_category
            is_eligible, ineligibility_reason = check_technician_eligibility(emp, service_name)
            if not is_eligible:
                return Response({"error": f"Cannot assign technician: {ineligibility_reason}"}, status=status.HTTP_400_BAD_REQUEST)

            job.assigned_employee = emp
            job.status = "assigned"
            job.save()

            return Response({
                "message": f"Job #{job.id} assigned to {emp.user.get_full_name()} ({emp.employee_id}).",
                "job_id": job.id,
                "assigned_employee": emp.employee_id,
                "status": job.status,
            }, status=status.HTTP_200_OK)


# ─── Automatic Dispatch Engine ────────────────────────────────────────────────

def run_automatic_dispatch(job):
    """
    Executes Automatic Dispatch Engine for a ServiceRequest:
    1. Locks ServiceRequest row with select_for_update inside transaction.atomic()
    2. Validates customer latitude & longitude coordinates exist on ServiceRequest.
    3. Filters candidate employees strictly scoped to the same Company tenant.
    4. Evaluates candidate eligibility using check_technician_eligibility()
    5. Retrieves real live GPS coordinates from candidate's User.last_known_location.
    6. Calculates Haversine proximity distance in kilometers between customer and candidate.
    7. Computes combined rank score:
       - Proximity score (higher for closer, max 100.0)
       - Verified skill proficiency (+30 EXPERT, +20 INTERMEDIATE, +10 BEGINNER)
       - Workload penalty (-15 points per active assigned job)
       - Live shift clock-in (+10 points)
    8. Ranks candidates primarily by nearest distance (ascending), with highest score as tiebreaker.
    9. Filters out candidates who have already rejected or been offered this job.
    10. If no candidates remain:
       - Set job.status = "unassigned"
       - Create notification for Admin & log event.
    11. If eligible candidate found:
       - Create WorkforceJobOffer(job=job, employee=candidate, status="OFFERED", expires_at=now+5min, rank_score=score)
       - Keep job.status = "assigned" (or dispatchable)
       - Trigger create_notification() for candidate user & broadcast event.
    """
    with transaction.atomic():
        job_obj = ServiceRequest.objects.select_for_update().filter(pk=job.pk).first()
        if not job_obj or job_obj.status in ["completed", "cancelled"]:
            return False, "Job is not in a dispatchable state."

        # Validate customer booking coordinates
        if job_obj.latitude is None or job_obj.longitude is None:
            job_obj.status = "unassigned"
            job_obj.save()
            return False, "Customer booking is missing valid GPS coordinates (latitude/longitude) for geographic dispatch."

        service_name = job_obj.issue_title or job_obj.service_category
        candidates = Employee.objects.filter(is_active=True).select_related("user", "company")
        if job_obj.company_id:
            candidates = candidates.filter(company_id=job_obj.company_id)

        # Exclude candidates who rejected or currently have an active offer for this job
        previous_offers = list(WorkforceJobOffer.objects.filter(job=job_obj).values_list("employee_id", flat=True))

        from time_tracking.geo import haversine_distance

        ranked_candidates = []

        for emp in candidates:
            if emp.id in previous_offers:
                continue

            # Check eligibility against service_category, then issue_title
            is_eligible, reason = check_technician_eligibility(emp, job_obj.service_category)
            if not is_eligible and job_obj.issue_title:
                is_eligible, reason = check_technician_eligibility(emp, job_obj.issue_title)

            if not is_eligible:
                continue

            # Real live GPS from User.last_known_location
            last_loc = getattr(emp.user, "last_known_location", None) or {}
            emp_lat = last_loc.get("latitude") if last_loc.get("latitude") is not None else last_loc.get("lat")
            emp_lon = last_loc.get("longitude") if last_loc.get("longitude") is not None else (last_loc.get("lng") or last_loc.get("lon"))

            if emp_lat is None or emp_lon is None:
                # No live GPS telemetry available
                continue

            try:
                emp_lat_f = float(emp_lat)
                emp_lon_f = float(emp_lon)
            except (ValueError, TypeError):
                continue

            # Location Freshness Gate: Candidate must have transmitted GPS within the last 30 minutes
            updated_at_str = last_loc.get("updated_at")
            if not updated_at_str:
                # Missing timestamp -> Stale GPS
                continue

            try:
                from django.utils.dateparse import parse_datetime
                loc_dt = parse_datetime(str(updated_at_str))
                if not loc_dt:
                    continue
                if timezone.is_naive(loc_dt):
                    loc_dt = timezone.make_aware(loc_dt)
                gps_age_seconds = (timezone.now() - loc_dt).total_seconds()
                MAX_GPS_AGE_SECONDS = 1800  # 30 minutes maximum age for live dispatch
                if gps_age_seconds > MAX_GPS_AGE_SECONDS or gps_age_seconds < -60:
                    # GPS is stale (> 30 minutes old) -> Skip candidate
                    continue
            except Exception:
                continue

            # Real distance calculation in km
            dist_m = haversine_distance(float(job_obj.latitude), float(job_obj.longitude), emp_lat_f, emp_lon_f)
            dist_km = dist_m / 1000.0


            # Proximity score (closer = higher score, max 100)
            proximity_score = max(0.0, 100.0 - (dist_km * 2.0))

            # 1. Skill proficiency score
            skills = WorkforceEmployeeSkill.objects.filter(employee=emp, is_verified=True).select_related("skill")
            max_prof = 0
            for sk in skills:
                sk_name = sk.skill.name.lower()
                matches = False
                for term in [job_obj.service_category, job_obj.issue_title]:
                    if term and (term.lower() in sk_name or sk_name in term.lower()):
                        matches = True
                        break
                if matches:
                    if sk.proficiency_level == "EXPERT":
                        max_prof = max(max_prof, 30)
                    elif sk.proficiency_level == "INTERMEDIATE":
                        max_prof = max(max_prof, 20)
                    else:
                        max_prof = max(max_prof, 10)


            # 2. Active workload penalty
            active_jobs_count = ServiceRequest.objects.filter(
                assigned_employee=emp,
                status__in=["assigned", "accepted", "on_the_way", "in_progress"]
            ).count()
            workload_penalty = active_jobs_count * 15.0

            # 3. Territory match
            city = (emp.bank_details or {}).get("onboarding", {}).get("draft", {}).get("personal", {}).get("city", "")
            territory_bonus = 15.0 if (job_obj.address and city and city.lower() in job_obj.address.lower()) else 0.0

            # 4. Shift clock-in active
            bank_details = emp.bank_details or {}
            is_clocked_in = bank_details.get("attendance", {}).get("is_clocked_in", False)
            clock_in_bonus = 10.0 if is_clocked_in else 0.0

            total_score = proximity_score + max_prof + territory_bonus - workload_penalty + clock_in_bonus

            ranked_candidates.append({
                "score": total_score,
                "distance_km": dist_km,
                "employee": emp,
            })

        if not ranked_candidates:
            job_obj.status = "unassigned"
            job_obj.save()
            admin_user = get_user_model().objects.filter(role="admin").first()
            if admin_user:
                create_notification(
                    recipient=admin_user,
                    title="Automatic Dispatch: Awaiting Technician",
                    message=f"No eligible nearby technician available for Job #{job_obj.id} ({service_name}). Job remains unassigned.",
                    notification_type="DISPATCH_UNASSIGNED",
                    company=job_obj.company,
                    related_object_id=job_obj.id,
                )
            return False, "No eligible technicians available for automatic dispatch."

        # Rank primarily by nearest distance (ascending), then by highest score (descending)
        ranked_candidates.sort(key=lambda x: (x["distance_km"], -x["score"]))
        top_candidate = ranked_candidates[0]
        top_score = top_candidate["score"]
        top_dist_km = top_candidate["distance_km"]
        top_emp = top_candidate["employee"]

        # Expire any previous pending offers for this job
        WorkforceJobOffer.objects.filter(job=job_obj, status="OFFERED").update(status="EXPIRED")

        # Create new offer valid for 5 minutes
        expires_at = timezone.now() + timezone.timedelta(minutes=5)
        offer = WorkforceJobOffer.objects.create(
            job=job_obj,
            employee=top_emp,
            status="OFFERED",
            rank_score=top_score,
            expires_at=expires_at,
        )

        if job_obj.status in ["draft", "new_request", "confirmed", "unassigned"]:
            job_obj.status = "assigned"
            job_obj.save()

        loc_str = f" at {job_obj.address}" if job_obj.address else ""
        req_id_str = f" ({job_obj.request_id})" if job_obj.request_id else f" #{job_obj.id}"
        service_label = job_obj.issue_title or job_obj.service_category or "Service Request"
        expiry_str = expires_at.strftime("%H:%M:%S UTC")

        create_notification(
            recipient=top_emp.user,
            title="New Job Offer Available!",
            message=f"You have a new exclusive job offer for '{service_label}'{req_id_str}{loc_str} ({top_dist_km:.1f} km away). Expiry: {expiry_str}. Open your dashboard to Accept or Decline.",
            notification_type="JOB_OFFER",
            company=job_obj.company,
            related_object_id=str(job_obj.id),
        )

        return True, f"Job #{job_obj.id} offered to {top_emp.user.get_full_name() or top_emp.user.username} ({top_dist_km:.1f}km away, Score: {top_score:.1f})."




class WorkforceJobAcceptOfferView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # Cross-company tenant isolation check
        if emp.company_id and job.company_id and emp.company_id != job.company_id:
            return Response({"error": "Unauthorized access to job belonging to another company."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            job_obj = ServiceRequest.objects.select_for_update().filter(pk=pk).first()
            if not job_obj:
                return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

            # Prevent duplicate acceptance by the same employee
            if job_obj.assigned_employee == emp and job_obj.status in ["accepted", "on_the_way", "arrived", "in_progress"]:
                return Response({
                    "message": f"Job #{job_obj.id} is already accepted by you.",
                    "job_id": job_obj.id,
                    "status": job_obj.status,
                }, status=status.HTTP_200_OK)

            # Reject acceptance if assigned to another employee
            if job_obj.assigned_employee and job_obj.assigned_employee != emp and job_obj.status in ["accepted", "on_the_way", "arrived", "in_progress", "completed"]:
                return Response({
                    "error": "Cannot accept job: Job has already been assigned and accepted by another technician.",
                    "code": "ALREADY_ACCEPTED_BY_ANOTHER"
                }, status=status.HTTP_403_FORBIDDEN)

            from service_requests.models import EmployeeJob

            offer = WorkforceJobOffer.objects.select_for_update().filter(
                job=job_obj,
                employee=emp,
                status="OFFERED"
            ).first()

            has_employee_job = EmployeeJob.objects.filter(service_request=job_obj, employee=emp).exists()
            is_direct_assigned = (job_obj.assigned_employee == emp)

            if not offer and not has_employee_job and not is_direct_assigned:
                return Response({
                    "error": "No active job offer or assignment found for this technician.",
                    "code": "NO_ACTIVE_OFFER"
                }, status=status.HTTP_400_BAD_REQUEST)

            if offer:
                if offer.expires_at < timezone.now():
                    offer.status = "EXPIRED"
                    offer.save()
                    run_automatic_dispatch(job_obj)
                    return Response({"error": "Job offer has expired."}, status=status.HTTP_400_BAD_REQUEST)
                offer.status = "ACCEPTED"
                offer.save()

            # Check if employee has a conflicting active job
            conflicting = ServiceRequest.objects.filter(
                assigned_employee=emp,
                status__in=["accepted", "on_the_way", "in_progress"]
            ).exclude(pk=job_obj.pk).first()
            if conflicting:
                return Response({"error": f"Cannot accept job: Technician already has an active assigned Job #{conflicting.id}."}, status=status.HTTP_400_BAD_REQUEST)

            # Verify technician eligibility
            is_eligible, reason = check_technician_eligibility(emp, job_obj.service_category)
            if not is_eligible and job_obj.issue_title:
                is_eligible, reason = check_technician_eligibility(emp, job_obj.issue_title)
            if not is_eligible:
                return Response({"error": f"Cannot accept offer: {reason}"}, status=status.HTTP_400_BAD_REQUEST)


            job_obj.assigned_employee = emp
            job_obj.status = "accepted"
            job_obj.save()

            EmployeeJob.objects.update_or_create(
                service_request=job_obj,
                employee=emp,
                defaults={
                    "status": "ACCEPTED",
                    "is_primary": True,
                    "accepted_date": timezone.now(),
                }
            )


            create_notification(
                recipient=emp.user,
                title="Job Offer Accepted",
                message=f"You have accepted Job #{job_obj.id}. Proceed to customer location at {job_obj.address or 'scheduled site'}.",
                notification_type="JOB_ASSIGNMENT",
                company=job_obj.company,
                related_object_id=job_obj.id,
            )

            return Response({
                "message": f"Job #{job_obj.id} accepted successfully.",
                "job_id": job_obj.id,
                "status": job_obj.status,
            }, status=status.HTTP_200_OK)



class WorkforceJobRejectOfferView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        if emp.company_id and job.company_id and emp.company_id != job.company_id:
            return Response({"error": "Unauthorized access to job belonging to another company."}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get("reason", "Technician declined offer.").strip()

        with transaction.atomic():
            job_obj = ServiceRequest.objects.select_for_update().filter(pk=pk).first()
            offer = WorkforceJobOffer.objects.select_for_update().filter(
                job=job_obj,
                employee=emp,
                status="OFFERED"
            ).first()

            if offer:
                offer.status = "REJECTED"
                offer.rejection_reason = reason
                offer.save()

            if job_obj.assigned_employee == emp:
                job_obj.assigned_employee = None
                job_obj.save()

            # Trigger immediate dispatch to next ranked technician
            success, msg = run_automatic_dispatch(job_obj)

            return Response({
                "message": f"Job offer declined. Next candidate dispatch status: {msg}",
                "job_id": job_obj.id,
                "status": job_obj.status,
            }, status=status.HTTP_200_OK)


class WorkforceAutoDispatchTriggerView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        success, msg = run_automatic_dispatch(job)
        return Response({"message": msg, "success": success, "status": job.status}, status=status.HTTP_200_OK)


# ─── 11. Work Extensions & Scope Approvals ────────────────────────────────────

class WorkforceJobExtensionView(APIView):
    permission_classes = [IsApprovedTechnician]

    def get(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or job.assigned_employee != emp:
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)

        extensions = WorkforceWorkExtension.objects.filter(job=job).order_by("-created_at")
        serializer = WorkforceWorkExtensionSerializer(extensions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or job.assigned_employee != emp:
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)

        if job.status not in ["in_progress", "proof_submitted"]:
            return Response({
                "error": f"Cannot request work extension for job in status '{job.status}'. Job must be 'in_progress'."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate active extension requests
        active_ext = WorkforceWorkExtension.objects.filter(
            job=job,
            status__in=[
                WorkforceWorkExtension.Status.REQUESTED,
                WorkforceWorkExtension.Status.ADMIN_APPROVED,
                WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED,
                WorkforceWorkExtension.Status.IN_PROGRESS,
            ]
        ).first()
        if active_ext:
            return Response({
                "error": f"An active work extension request (#{active_ext.id}) is already in progress with status '{active_ext.status}'."
            }, status=status.HTTP_400_BAD_REQUEST)

        title = str(request.data.get("title", "Scope Extension")).strip() or "Scope Extension"
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            return Response({"error": "Extension reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        description = str(request.data.get("description", "")).strip()

        try:
            labor_cost = float(request.data.get("estimated_labor_cost", request.data.get("labor_cost", 0)) or 0)
            materials_cost = float(request.data.get("estimated_materials_cost", request.data.get("materials_cost", 0)) or 0)
            amount_val = request.data.get("requested_amount", request.data.get("amount"))
            if amount_val is not None:
                requested_amount = float(amount_val)
            else:
                requested_amount = labor_cost + materials_cost
        except (ValueError, TypeError):
            return Response({"error": "Invalid cost estimates provided."}, status=status.HTTP_400_BAD_REQUEST)

        if requested_amount <= 0:
            return Response({"error": "Extension requested amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        raw_spec = request.data.get("requires_specialist", False)
        requires_specialist = raw_spec is True or str(raw_spec).lower() in ["true", "1"]
        raw_crit = request.data.get("is_critical", False)
        is_critical = raw_crit is True or str(raw_crit).lower() in ["true", "1"]
        supporting_notes = str(request.data.get("supporting_notes", "")).strip()
        supporting_photo = request.FILES.get("supporting_photo") or request.FILES.get("photo")


        required_skill = None
        skill_id = request.data.get("required_skill")
        if skill_id:
            try:
                required_skill = WorkforceSkill.objects.filter(pk=int(skill_id)).first()
            except (ValueError, TypeError):
                pass

        extension = WorkforceWorkExtension.objects.create(
            job=job,
            technician=emp or job.assigned_employee,
            company=job.company,
            title=title,
            description=description,
            reason=reason,
            estimated_labor_cost=labor_cost,
            estimated_materials_cost=materials_cost,
            requested_amount=requested_amount,
            requires_specialist=requires_specialist,
            required_skill=required_skill,
            is_critical=is_critical,
            supporting_notes=supporting_notes,
            supporting_photo=supporting_photo,
            status=WorkforceWorkExtension.Status.REQUESTED,
        )

        # Mirror entry to cart_data for shared marketplace backward compatibility
        cart_data = list(job.cart_data or [])
        cart_data.append({
            "id": extension.id,
            "type": "work_extension",
            "title": title,
            "additional_amount": requested_amount,
            "reason": reason,
            "is_critical": is_critical,
            "requires_specialist": requires_specialist,
            "status": WorkforceWorkExtension.Status.REQUESTED,
            "requested_at": extension.created_at.isoformat(),
        })
        job.cart_data = cart_data
        job.save()

        # Dispatch notification to admin
        create_notification(
            recipient=job.assigned_employee.user if job.assigned_employee else request.user,
            title="Work Extension Requested",
            message=f"Work extension #{extension.id} ({title} - ₹{requested_amount}) submitted for admin review.",
            notification_type="WORK_EXTENSION_REQUEST",
            company=job.company,
            related_object_id=str(extension.id),
        )

        return Response({
            "message": "Work extension request submitted successfully for Admin review.",
            "extension": WorkforceWorkExtensionSerializer(extension).data,
        }, status=status.HTTP_201_CREATED)


class WorkforceAdminExtensionDecideView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk, ext_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        action = str(request.data.get("action", "")).upper()
        reason = str(request.data.get("reason", "")).strip()

        if action not in ["APPROVED", "REJECTED"]:
            return Response({"error": "Action must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            extension = (
                WorkforceWorkExtension.objects
                .select_for_update()
                .filter(pk=ext_id, job=job)
                .first()
            )
            if not extension:
                return Response({"error": "Work extension request not found."}, status=status.HTTP_404_NOT_FOUND)

            if extension.status != WorkforceWorkExtension.Status.REQUESTED:
                return Response({
                    "error": f"Cannot review extension in status '{extension.status}'. Expected 'REQUESTED'."
                }, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            if action == "APPROVED":
                extension.status = WorkforceWorkExtension.Status.ADMIN_APPROVED
                approved_amt = request.data.get("approved_amount")
                if approved_amt is not None:
                    try:
                        extension.approved_amount = float(approved_amt)
                    except (ValueError, TypeError):
                        extension.approved_amount = extension.requested_amount
                else:
                    extension.approved_amount = extension.requested_amount

                extension.final_customer_amount = extension.approved_amount
                extension.decision_token = secrets.token_urlsafe(32)
                extension.decision_expires_at = now + timedelta(hours=24)
            else:
                extension.status = WorkforceWorkExtension.Status.ADMIN_REJECTED

            extension.admin_reviewed_by = request.user
            extension.admin_review_reason = reason
            extension.admin_reviewed_at = now
            extension.save()

            # Mirror decision to cart_data
            cart_data = list(job.cart_data or [])
            for c in cart_data:
                if str(c.get("id")) == str(extension.id) and c.get("type") == "work_extension":
                    c["status"] = extension.status
                    c["approved_amount"] = float(extension.approved_amount) if extension.approved_amount is not None else 0
                    c["final_customer_amount"] = float(extension.final_customer_amount) if extension.final_customer_amount is not None else 0
                    c["admin_review_reason"] = reason
                    c["reviewed_at"] = extension.admin_reviewed_at.isoformat()
                    if extension.decision_token:
                        c["decision_token"] = extension.decision_token
                        c["decision_expires_at"] = extension.decision_expires_at.isoformat()
            job.cart_data = cart_data
            job.save()

            if extension.technician and extension.technician.user:
                create_notification(
                    recipient=extension.technician.user,
                    title=f"Work Extension {extension.status.replace('_', ' ').title()}",
                    message=f"Extension #{extension.id} has been {extension.status.lower()} by Admin.",
                    notification_type="WORK_EXTENSION_DECISION",
                    company=job.company,
                    related_object_id=str(extension.id),
                )

            return Response({
                "message": f"Work extension #{extension.id} marked as {extension.status}.",
                "extension": WorkforceWorkExtensionSerializer(extension).data,
            }, status=status.HTTP_200_OK)


class WorkforceAdminPendingExtensionsListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        emp = getattr(request.user, "employee_profile", None)
        company = emp.company if emp else getattr(request.user, "company", None)

        qs = WorkforceWorkExtension.objects.filter(
            status__in=[
                WorkforceWorkExtension.Status.REQUESTED,
                WorkforceWorkExtension.Status.PENDING_ASSIGNMENT,
            ]
        ).select_related("job", "technician__user", "required_skill", "specialist_technician__user").order_by("-created_at")

        if company:
            qs = qs.filter(Q(company=company) | Q(job__company=company))

        serializer = WorkforceWorkExtensionSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforceCustomerExtensionDetailView(APIView):
    """
    Endpoint for Customer to view Additional Work breakdown and financial details.
    Accessible either by authenticated customer session OR query token ?token=<decision_token>.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk, ext_id=None):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        token = request.query_params.get("token") or request.headers.get("X-Decision-Token")

        if ext_id:
            extension = WorkforceWorkExtension.objects.filter(pk=ext_id, job=job).first()
        else:
            extension = WorkforceWorkExtension.objects.filter(job=job, decision_token=token).first()

        if not extension:
            return Response({"error": "Work extension not found."}, status=status.HTTP_404_NOT_FOUND)

        # Authorization: Must be authenticated customer/admin OR match decision_token
        is_auth_customer = (
            request.user.is_authenticated
            and (
                job.customer == request.user
                or str(getattr(job, "customer_name", "")).lower() == request.user.username.lower()
                or getattr(job, "phone", "") == getattr(request.user, "username", "")
                or is_admin_role(request.user)
            )
        )
        is_valid_token = bool(token and extension.decision_token and token == extension.decision_token)

        if not (is_auth_customer or is_valid_token):
            return Response({
                "error": "Unauthorized: Valid customer authentication or decision token is required."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = CustomerWorkforceExtensionSerializer(extension)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforceCustomerExtensionDecideView(APIView):
    """
    Idempotent, one-time customer decision endpoint for Additional Work / Scope Expansion.
    Enforces atomic row locking, expiration check, and duplicate rejection.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk, ext_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        token = request.data.get("token") or request.query_params.get("token") or request.headers.get("X-Decision-Token")

        action = str(request.data.get("action", "")).upper()
        reason = str(request.data.get("reason", "")).strip()

        if action not in ["ACCEPT", "ACCEPTED", "DECLINE", "DECLINED"]:
            return Response({"error": "Action must be ACCEPT or DECLINE."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            extension = (
                WorkforceWorkExtension.objects
                .select_for_update()
                .filter(pk=ext_id, job=job)
                .first()
            )
            if not extension:
                return Response({"error": "Work extension not found."}, status=status.HTTP_404_NOT_FOUND)

            # Security Authorization: authenticated customer or decision token
            is_auth_customer = (
                request.user.is_authenticated
                and (
                    job.customer == request.user
                    or str(getattr(job, "customer_name", "")).lower() == request.user.username.lower()
                    or getattr(job, "phone", "") == getattr(request.user, "username", "")
                    or is_admin_role(request.user)
                )
            )
            is_valid_token = bool(token and extension.decision_token and token == extension.decision_token)

            if not (is_auth_customer or is_valid_token):
                return Response({
                    "error": "Unauthorized: Valid customer authentication or decision token is required."
                }, status=status.HTTP_403_FORBIDDEN)

            # Idempotency & One-Time Rule
            if extension.status in [
                WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED,
                WorkforceWorkExtension.Status.CUSTOMER_DECLINED,
                WorkforceWorkExtension.Status.PENDING_ASSIGNMENT,
                WorkforceWorkExtension.Status.IN_PROGRESS,
                WorkforceWorkExtension.Status.COMPLETED,
                WorkforceWorkExtension.Status.RESOLVED,
            ]:
                return Response({
                    "error": f"Decision already recorded for extension #{extension.id}. Status is '{extension.status}'. Further decisions are rejected.",
                    "code": "DECISION_ALREADY_RECORDED",
                    "status": extension.status,
                }, status=status.HTTP_409_CONFLICT)

            if extension.status != WorkforceWorkExtension.Status.ADMIN_APPROVED:
                return Response({
                    "error": f"Cannot record customer decision for extension in status '{extension.status}'. Expected 'ADMIN_APPROVED'.",
                    "code": "INVALID_EXTENSION_STATE"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Expiry validation
            now = timezone.now()
            if extension.decision_expires_at and now > extension.decision_expires_at:
                return Response({
                    "error": "Decision window has expired for this work extension. Please request an updated estimate.",
                    "code": "DECISION_EXPIRED",
                    "expired_at": extension.decision_expires_at.isoformat(),
                }, status=status.HTTP_400_BAD_REQUEST)

            if action in ["ACCEPT", "ACCEPTED"]:
                add_amt = Decimal(str(extension.approved_amount if extension.approved_amount is not None else extension.requested_amount))


                if extension.requires_specialist:
                    # Specialist workflow: PENDING_ASSIGNMENT & FOLLOW_UP_REQUIRED
                    extension.status = WorkforceWorkExtension.Status.PENDING_ASSIGNMENT
                    extension.customer_decided_at = now
                    extension.save()

                    job.status = "follow_up_required"
                    job.save()

                    msg = f"Work extension #{extension.id} accepted. Job marked FOLLOW_UP_REQUIRED for specialist technician assignment."
                else:
                    # Same-technician continuation
                    extension.status = WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED
                    extension.customer_decided_at = now
                    extension.save()

                    job.total_amount += add_amt
                    job.save()

                    msg = f"Work extension #{extension.id} accepted by customer. ₹{add_amt} added to job total."

                # Mirror update to cart_data
                cart_data = list(job.cart_data or [])
                for c in cart_data:
                    if str(c.get("id")) == str(extension.id) and c.get("type") == "work_extension":
                        c["status"] = extension.status
                        c["customer_decided_at"] = extension.customer_decided_at.isoformat()
                job.cart_data = cart_data
                job.save()

                return Response({
                    "message": msg,
                    "extension": CustomerWorkforceExtensionSerializer(extension).data,
                    "job_status": job.status,
                    "job_total": str(job.total_amount),
                }, status=status.HTTP_200_OK)

            else:  # DECLINE
                extension.status = WorkforceWorkExtension.Status.CUSTOMER_DECLINED
                extension.customer_decided_at = now
                extension.customer_decline_reason = reason or "Customer declined additional work."
                extension.save()

                # Mirror update to cart_data
                cart_data = list(job.cart_data or [])
                for c in cart_data:
                    if str(c.get("id")) == str(extension.id) and c.get("type") == "work_extension":
                        c["status"] = extension.status
                        c["customer_decline_reason"] = extension.customer_decline_reason
                        c["customer_decided_at"] = extension.customer_decided_at.isoformat()
                job.cart_data = cart_data
                job.save()

                if extension.is_critical:
                    # Critical scope rejected -> work cannot safely continue -> UNABLE_TO_COMPLETE
                    job.status = "unable_to_complete"
                    uncompletion_note = f"Critical scope extension #{extension.id} ('{extension.title}') declined by customer. Work cannot safely continue. Reason: {extension.customer_decline_reason}"
                    if job.description:
                        job.description = f"{job.description}\n[UNABLE_TO_COMPLETE]: {uncompletion_note}"
                    else:
                        job.description = f"[UNABLE_TO_COMPLETE]: {uncompletion_note}"
                    job.save()

                    return Response({
                        "message": f"Critical extension declined. Job #{job.id} transitioned to UNABLE_TO_COMPLETE.",
                        "extension": CustomerWorkforceExtensionSerializer(extension).data,
                        "job_status": job.status,
                        "uncompletion_reason": uncompletion_note,
                    }, status=status.HTTP_200_OK)
                else:
                    # Optional scope rejected -> original job continues in in_progress
                    return Response({
                        "message": f"Optional extension declined. Original Job #{job.id} continues IN_PROGRESS.",
                        "extension": CustomerWorkforceExtensionSerializer(extension).data,
                        "job_status": job.status,
                    }, status=status.HTTP_200_OK)


class WorkforceTokenExtensionDecideView(APIView):
    """
    Direct decision endpoint by decision token.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        extension = WorkforceWorkExtension.objects.filter(decision_token=token).first()
        if not extension:
            return Response({"error": "Invalid or expired decision token."}, status=status.HTTP_404_NOT_FOUND)

        view = WorkforceCustomerExtensionDecideView()
        request.data["token"] = token
        return view.post(request, pk=extension.job_id, ext_id=extension.id)


class WorkforceAdminAssignSpecialistView(APIView):
    """
    Admin assigns Specialist Technician B to an extension in PENDING_ASSIGNMENT.
    Creates a sanitized secondary ServiceRequest for Specialist Technician B.
    """
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk, ext_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        specialist_emp_id = request.data.get("specialist_employee_id") or request.data.get("employee_id")
        if not specialist_emp_id:
            return Response({"error": "specialist_employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        specialist_emp = Employee.objects.filter(pk=specialist_emp_id).first()
        if not specialist_emp:
            return Response({"error": "Specialist technician not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            extension = (
                WorkforceWorkExtension.objects
                .select_for_update()
                .filter(pk=ext_id, job=job)
                .first()
            )
            if not extension:
                return Response({"error": "Work extension not found."}, status=status.HTTP_404_NOT_FOUND)

            if extension.status != WorkforceWorkExtension.Status.PENDING_ASSIGNMENT:
                return Response({
                    "error": f"Cannot assign specialist for extension in status '{extension.status}'. Expected 'PENDING_ASSIGNMENT'."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create secondary Job for Technician B (is_primary = False)
            secondary_req_id = f"SR-SPEC-{job.id}-{extension.id}"
            secondary_job = ServiceRequest.objects.create(
                request_id=secondary_req_id,
                company=job.company,
                customer=job.customer,
                customer_name=job.customer_name,
                phone=job.phone,
                email=job.email,
                address=job.address,
                service_category=job.service_category,
                issue_title=f"[Specialist Task] {extension.title}",
                description=f"Specialist Task Assignment for Case #{job.request_id}.\nTask: {extension.description or extension.title}\nJustification: {extension.reason}",
                preferred_date=job.preferred_date or timezone.now().date(),
                total_amount=extension.approved_amount or extension.requested_amount,


                assigned_employee=specialist_emp,
                status="assigned",
                cart_data=[{
                    "type": "specialist_job",
                    "parent_job_id": job.id,
                    "parent_request_id": job.request_id,
                    "extension_id": extension.id,
                    "is_primary": False,
                }],
            )

            from service_requests.models import EmployeeJob
            EmployeeJob.objects.create(
                service_request=secondary_job,
                employee=specialist_emp,
                status="ASSIGNED",
                is_primary=False,
                notes=f"Specialist assignment for Extension #{extension.id}",
                assigned_by=request.user,
            )


            # Link secondary job to extension
            extension.specialist_technician = specialist_emp
            extension.specialist_job = secondary_job
            extension.status = WorkforceWorkExtension.Status.IN_PROGRESS
            extension.save()


            # Record secondary job link on parent job's cart_data
            cart_data = list(job.cart_data or [])
            cart_data.append({
                "type": "specialist_job",
                "job_id": secondary_job.id,
                "request_id": secondary_job.request_id,
                "extension_id": extension.id,
                "specialist_employee_id": specialist_emp.id,
                "assigned_at": timezone.now().isoformat(),
            })
            job.cart_data = cart_data
            job.save()

            # Notify Technician B
            if specialist_emp.user:
                create_notification(
                    recipient=specialist_emp.user,
                    title="Specialist Job Assigned",
                    message=f"You have been assigned as Specialist for task '{extension.title}' (Job #{secondary_job.id}).",
                    notification_type="SPECIALIST_JOB_ASSIGNED",
                    company=job.company,
                    related_object_id=str(secondary_job.id),
                )

            return Response({
                "message": f"Specialist technician {specialist_emp.user.get_full_name()} assigned successfully. Secondary Job #{secondary_job.id} created.",
                "secondary_job_id": secondary_job.id,
                "extension": WorkforceWorkExtensionSerializer(extension).data,
            }, status=status.HTTP_200_OK)


class WorkforceExtensionProgressView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk, ext_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or (job.assigned_employee != emp and getattr(job, "specialist_technician", None) != emp):
                # Check if user is the assigned specialist technician
                ext_check = WorkforceWorkExtension.objects.filter(pk=ext_id, specialist_technician=emp).first()
                if not ext_check and job.assigned_employee != emp:
                    return Response({"error": "Unauthorized: You are not assigned to this job or extension."}, status=status.HTTP_403_FORBIDDEN)

        action = str(request.data.get("action", "")).lower()

        with transaction.atomic():
            extension = (
                WorkforceWorkExtension.objects
                .select_for_update()
                .filter(pk=ext_id, job=job)
                .first()
            )
            if not extension:
                return Response({"error": "Work extension not found."}, status=status.HTTP_404_NOT_FOUND)

            now = timezone.now()
            if action == "start":
                if extension.status not in [WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED, WorkforceWorkExtension.Status.PENDING_ASSIGNMENT]:
                    return Response({
                        "error": f"Cannot start extension in status '{extension.status}'. Expected 'CUSTOMER_ACCEPTED'."
                    }, status=status.HTTP_400_BAD_REQUEST)
                extension.status = WorkforceWorkExtension.Status.IN_PROGRESS
                extension.save()

            elif action == "complete":
                if extension.status != WorkforceWorkExtension.Status.IN_PROGRESS:
                    return Response({
                        "error": f"Cannot complete extension in status '{extension.status}'. Expected 'IN_PROGRESS'."
                    }, status=status.HTTP_400_BAD_REQUEST)
                extension.status = WorkforceWorkExtension.Status.COMPLETED
                extension.completed_at = now
                extension.save()

            elif action == "resolve":
                if extension.status not in [WorkforceWorkExtension.Status.COMPLETED, WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED]:
                    return Response({
                        "error": f"Cannot resolve extension in status '{extension.status}'. Expected 'COMPLETED'."
                    }, status=status.HTTP_400_BAD_REQUEST)
                extension.status = WorkforceWorkExtension.Status.RESOLVED
                extension.resolved_at = now
                extension.save()

                # Automatically create supplemental invoice idempotently
                inv_num = f"SUP-INV-{job.id}-{extension.id}"
                WorkforceSupplementalInvoice.objects.get_or_create(
                    extension=extension,
                    defaults={
                        "invoice_number": inv_num,
                        "job": job,
                        "customer": job.customer,
                        "company": job.company,
                        "amount": extension.approved_amount or extension.requested_amount,
                        "actual_cost": extension.estimated_labor_cost + extension.estimated_materials_cost,
                        "status": WorkforceSupplementalInvoice.Status.ISSUED,
                        "metadata": {
                            "extension_title": extension.title,
                            "reason": extension.reason,
                        },
                        "audit_trail": [{
                            "action": "INVOICE_GENERATED",
                            "timestamp": now.isoformat(),
                            "amount": float(extension.approved_amount or extension.requested_amount),
                        }],
                    }
                )

            else:
                return Response({"error": "Action must be 'start', 'complete', or 'resolve'."}, status=status.HTTP_400_BAD_REQUEST)

            # Mirror to cart_data
            cart_data = list(job.cart_data or [])
            for c in cart_data:
                if str(c.get("id")) == str(extension.id) and c.get("type") == "work_extension":
                    c["status"] = extension.status
                    if extension.completed_at:
                        c["completed_at"] = extension.completed_at.isoformat()
                    if extension.resolved_at:
                        c["resolved_at"] = extension.resolved_at.isoformat()
            job.cart_data = cart_data
            job.save()

            return Response({
                "message": f"Work extension #{extension.id} updated to {extension.status}.",
                "extension": WorkforceWorkExtensionSerializer(extension).data,
            }, status=status.HTTP_200_OK)


# ─── Supplemental Billing & Invoicing (Requirement 7) ─────────────────────────

class WorkforceCreateSupplementalInvoiceView(APIView):
    """
    Idempotent supplemental invoice creation for resolved/accepted work extensions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, ext_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        extension = WorkforceWorkExtension.objects.filter(pk=ext_id, job=job).first()
        if not extension:
            return Response({"error": "Work extension not found."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        inv_num = f"SUP-INV-{job.id}-{extension.id}"

        with transaction.atomic():
            invoice, created = WorkforceSupplementalInvoice.objects.select_for_update().get_or_create(
                extension=extension,
                defaults={
                    "invoice_number": inv_num,
                    "job": job,
                    "customer": job.customer,
                    "company": job.company,
                    "amount": extension.approved_amount or extension.requested_amount,
                    "actual_cost": extension.estimated_labor_cost + extension.estimated_materials_cost,
                    "status": WorkforceSupplementalInvoice.Status.ISSUED,
                    "metadata": {
                        "extension_title": extension.title,
                        "reason": extension.reason,
                    },
                    "audit_trail": [{
                        "action": "INVOICE_GENERATED",
                        "timestamp": now.isoformat(),
                        "amount": float(extension.approved_amount or extension.requested_amount),
                    }],
                }
            )

        serializer = WorkforceSupplementalInvoiceSerializer(invoice)
        return Response({
            "message": "Supplemental invoice retrieved / created successfully.",
            "created": created,
            "invoice": serializer.data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WorkforceCustomerSupplementalInvoiceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        is_customer = (
            job.customer == request.user
            or str(getattr(job, "customer_name", "")).lower() == request.user.username.lower()
            or getattr(job, "phone", "") == getattr(request.user, "username", "")
        )
        if not (is_customer or is_admin_role(request.user)):
            return Response({"error": "Unauthorized: Not your booking."}, status=status.HTTP_403_FORBIDDEN)

        invoices = WorkforceSupplementalInvoice.objects.filter(job=job).order_by("-created_at")
        serializer = WorkforceSupplementalInvoiceSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforcePaySupplementalInvoiceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, invoice_id):
        invoice = WorkforceSupplementalInvoice.objects.filter(pk=invoice_id).first()
        if not invoice:
            return Response({"error": "Supplemental invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        is_customer = (
            invoice.customer == request.user
            or invoice.job.customer == request.user
            or is_admin_role(request.user)
        )
        if not is_customer:
            return Response({"error": "Unauthorized: Not your invoice."}, status=status.HTTP_403_FORBIDDEN)

        if invoice.status == WorkforceSupplementalInvoice.Status.PAID:
            return Response({
                "message": "Invoice is already paid.",
                "invoice": WorkforceSupplementalInvoiceSerializer(invoice).data,
            }, status=status.HTTP_200_OK)

        payment_method = str(request.data.get("payment_method", "ONLINE")).upper()
        transaction_id = str(request.data.get("transaction_id", f"TXN-{secrets.token_hex(8).upper()}"))

        now = timezone.now()
        with transaction.atomic():
            invoice.status = WorkforceSupplementalInvoice.Status.PAID
            invoice.payment_method = payment_method
            invoice.transaction_id = transaction_id
            invoice.paid_at = now

            audit = list(invoice.audit_trail or [])
            audit.append({
                "action": "PAYMENT_RECEIVED",
                "timestamp": now.isoformat(),
                "payment_method": payment_method,
                "transaction_id": transaction_id,
            })
            invoice.audit_trail = audit
            invoice.save()

        return Response({
            "message": f"Supplemental invoice #{invoice.invoice_number} paid successfully.",
            "invoice": WorkforceSupplementalInvoiceSerializer(invoice).data,
        }, status=status.HTTP_200_OK)


# ─── Rescheduling & Delays Subsystem (Requirement 6) ──────────────────────────

class WorkforceJobRescheduleView(APIView):
    """
    Handles rescheduling rules:
    - 1st delay: Updates proposed date, notifies customer, records audit entry.
    - 2nd delay: Freezes proposed schedule, creates support/callback escalation, records audit entry.
    - Commercial amounts are strictly preserved.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        new_date = request.data.get("rescheduled_date") or request.data.get("date")
        reason = str(request.data.get("reason", "")).strip()
        delay_type = str(request.data.get("delay_type", "PARTS_DELAY")).upper()

        if not reason:
            return Response({"error": "Reschedule reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            current_delay_count = WorkforceJobReschedule.objects.filter(job=job).count() + 1

            if current_delay_count == 1:
                # 1st delay: update schedule
                original_date = job.preferred_date
                if new_date:
                    job.preferred_date = new_date
                    job.save()

                reschedule = WorkforceJobReschedule.objects.create(
                    job=job,
                    delay_count=current_delay_count,
                    delay_type=delay_type,
                    original_date=original_date,
                    rescheduled_date=job.preferred_date,
                    reason=reason,
                    customer_notified=True,
                    escalated_to_support=False,
                )
                msg = f"Job #{job.id} rescheduled (1st delay). Customer notified."

            else:
                # 2nd delay: freeze schedule, escalate to support
                reschedule = WorkforceJobReschedule.objects.create(
                    job=job,
                    delay_count=current_delay_count,
                    delay_type=delay_type,
                    original_date=job.preferred_date,
                    rescheduled_date=job.preferred_date,  # Frozen
                    reason=reason,
                    customer_notified=True,
                    escalated_to_support=True,
                    escalation_notes=f"Second delay reported ({reason}). Proposed schedule frozen. Support team callback dispatched.",
                )
                msg = f"Multiple delays detected on Job #{job.id}. Schedule frozen and escalated to Customer Support team."

            # Notify customer
            if job.customer:
                create_notification(
                    recipient=job.customer,
                    title="Service Schedule Update" if current_delay_count == 1 else "Service Delay Escalation",
                    message=msg,
                    notification_type="SCHEDULE_DELAY",
                    company=job.company,
                    related_object_id=str(job.id),
                )

        return Response({
            "message": msg,
            "reschedule": WorkforceJobRescheduleSerializer(reschedule).data,
            "delay_count": current_delay_count,
            "escalated_to_support": reschedule.escalated_to_support,
            "job_preferred_date": str(job.preferred_date),
            "job_total": str(job.total_amount),  # Commercial amounts untouched
        }, status=status.HTTP_200_OK)


class WorkforceCustomerRescheduleResponseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        is_customer = (
            job.customer == request.user
            or str(getattr(job, "customer_name", "")).lower() == request.user.username.lower()
            or getattr(job, "phone", "") == getattr(request.user, "username", "")
        )
        if not (is_customer or is_admin_role(request.user)):
            return Response({"error": "Unauthorized: Not your booking."}, status=status.HTTP_403_FORBIDDEN)

        response_choice = str(request.data.get("response", "")).upper()  # ACCEPTED, OBJECTED, CALLBACK_REQUESTED
        notes = str(request.data.get("notes", "")).strip()

        latest_reschedule = WorkforceJobReschedule.objects.filter(job=job).order_by("-created_at").first()
        if not latest_reschedule:
            return Response({"error": "No reschedule found for this job."}, status=status.HTTP_404_NOT_FOUND)

        latest_reschedule.customer_response = response_choice
        latest_reschedule.customer_notes = notes
        if response_choice in ["OBJECTED", "CALLBACK_REQUESTED"]:
            latest_reschedule.escalated_to_support = True
            latest_reschedule.escalation_notes = f"Customer responded with {response_choice}: {notes}"
        latest_reschedule.save()

        return Response({
            "message": f"Customer response '{response_choice}' recorded.",
            "reschedule": WorkforceJobRescheduleSerializer(latest_reschedule).data,
        }, status=status.HTTP_200_OK)


class WorkforceJobPurchaseRequestView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not is_admin_role(request.user):
            if not emp or job.assigned_employee != emp:
                return Response({"error": "Unauthorized: You are not assigned to this job."}, status=status.HTTP_403_FORBIDDEN)

        item_name = request.data.get("item_name", "Spare Part").strip()
        quantity = int(request.data.get("quantity", 1))
        try:
            estimated_cost = float(request.data.get("estimated_cost", 0))
        except (ValueError, TypeError):
            return Response({"error": "Invalid part cost."}, status=status.HTTP_400_BAD_REQUEST)

        vendor_name = request.data.get("vendor_name", "").strip()
        reason = request.data.get("reason", "").strip()

        cart_data = job.cart_data or []
        req_id = len([c for c in cart_data if c.get("type") == "parts_purchase_request"]) + 1

        purchase_entry = {
            "id": req_id,
            "type": "parts_purchase_request",
            "item_name": item_name,
            "quantity": quantity,
            "estimated_cost": estimated_cost,
            "vendor_name": vendor_name,
            "reason": reason,
            "status": "PENDING",  # Requires Admin review
            "requested_at": timezone.now().isoformat(),
            "requested_by": request.user.username,
            "reviewed_by": None,
            "review_reason": "",
        }
        cart_data.append(purchase_entry)
        job.cart_data = cart_data
        job.save()

        return Response({
            "message": f"Purchase request for {item_name} (₹{estimated_cost}) submitted for Admin review.",
            "purchase_request": purchase_entry,
        }, status=status.HTTP_201_CREATED)


class WorkforceAdminPurchaseDecideView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk, req_id):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action", "").upper()
        reason = request.data.get("reason", "")

        if action not in ["APPROVED", "REJECTED"]:
            return Response({"error": "Action must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        cart_data = job.cart_data or []
        found = False
        for item in cart_data:
            if item.get("type") == "parts_purchase_request" and str(item.get("id")) == str(req_id):
                item["status"] = action
                item["reviewed_by"] = request.user.username
                item["review_reason"] = reason
                item["reviewed_at"] = timezone.now().isoformat()
                found = True
                break

        if not found:
            return Response({"error": "Parts purchase request not found."}, status=status.HTTP_404_NOT_FOUND)

        job.cart_data = cart_data
        job.save()

        return Response({
            "message": f"Parts purchase request marked as {action}.",
        }, status=status.HTTP_200_OK)


# ─── 12. Attendance & Shift Time Tracking (Decoupled from Availability) ───────

class WorkforceTimeTrackingView(APIView):
    permission_classes = [IsApprovedTechnician]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)

        open_log = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).prefetch_related("breaks").first()
        if open_log:
            active_break = open_log.breaks.filter(break_end__isnull=True).first()
            shift_status = "on_break" if active_break else "clocked_in"
            return Response({
                "is_clocked_in": True,
                "shift_status": shift_status,
                "clock_in_time": open_log.clock_in.isoformat(),
                "clock_out_time": None,
                "active_break": {
                    "id": active_break.id,
                    "break_type": active_break.break_type,
                    "break_start": active_break.break_start.isoformat(),
                } if active_break else None,
                "time_log": TimeLogSerializer(open_log).data,
                "logs": [
                    {
                        "id": b.id,
                        "action": f"break_{b.break_type}",
                        "shift_status": "on_break",
                        "timestamp": b.break_start.isoformat(),
                    } for b in open_log.breaks.all()
                ]
            }, status=status.HTTP_200_OK)

        latest_log = TimeLog.objects.filter(employee=emp, clock_out__isnull=False).order_by("-clock_out").first()
        return Response({
            "is_clocked_in": False,
            "shift_status": "clocked_out",
            "clock_in_time": latest_log.clock_in.isoformat() if latest_log else None,
            "clock_out_time": latest_log.clock_out.isoformat() if latest_log else None,
            "active_break": None,
            "time_log": TimeLogSerializer(latest_log).data if latest_log else None,
            "logs": [],
        }, status=status.HTTP_200_OK)

    def post(self, request):
        action = request.data.get("action", "clock_in").lower()
        if action == "clock_in":
            from time_tracking.views import ClockInView
            return ClockInView().post(request)
        elif action == "clock_out":
            from time_tracking.views import ClockOutView
            return ClockOutView().post(request)
        elif action == "break_start":
            from time_tracking.views import BreakStartView
            return BreakStartView().post(request)
        elif action == "break_end":
            from time_tracking.views import BreakEndView
            return BreakEndView().post(request)
        else:
            return Response({"error": f"Unknown time tracking action '{action}'.", "code": "INVALID_ACTION"}, status=status.HTTP_400_BAD_REQUEST)


# ─── 13. Leave Management ─────────────────────────────────────────────────────

class WorkforceLeaveListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)

        if is_admin_role(user):
            # Admin sees ALL leave applications across the workforce
            all_employees = Employee.objects.filter(is_active=True).select_related("user")
            all_leaves = []
            for e in all_employees:
                e_leaves = (e.bank_details or {}).get("leaves", [])
                for l in e_leaves:
                    all_leaves.append({
                        **l,
                        "employee_pk": e.id,
                        "employee_id": e.employee_id,
                        "employee_name": e.user.get_full_name() or e.user.username,
                    })
            all_leaves.sort(key=lambda x: x.get("applied_at", ""), reverse=True)
            return Response(all_leaves, status=status.HTTP_200_OK)

        if not emp:
            return Response([], status=status.HTTP_200_OK)

        bank_details = emp.bank_details or {}
        leaves = bank_details.get("leaves", [])
        sorted_leaves = sorted(leaves, key=lambda x: str(x.get("applied_at") or ""), reverse=True)
        return Response(sorted_leaves, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        leave_type = request.data.get("leave_type", "Casual Leave").strip()
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        reason = request.data.get("reason", "").strip()

        if not start_date or not end_date:
            return Response({"error": "start_date and end_date required."}, status=status.HTTP_400_BAD_REQUEST)

        if start_date > end_date:
            return Response({"error": "start_date cannot be after end_date."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        leaves = bank_details.get("leaves", [])

        # Check for overlapping pending/approved leave requests
        for existing in leaves:
            if existing.get("status") in ["submitted", "approved"]:
                e_start = existing.get("start_date")
                e_end = existing.get("end_date")
                if e_start and e_end:
                    if not (end_date < e_start or start_date > e_end):
                        return Response({
                            "error": f"An active or pending leave application already exists for the range {e_start} to {e_end}."
                        }, status=status.HTTP_400_BAD_REQUEST)

        new_leave = {
            "id": len(leaves) + 1,
            "employee_id": emp.employee_id,
            "employee_name": user.get_full_name() or user.username,
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason,
            "status": "submitted",
            "applied_at": timezone.now().isoformat(),
            "reviewer": None,
            "review_reason": "",
        }
        leaves.append(new_leave)
        bank_details["leaves"] = leaves
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": "Leave application submitted successfully for Admin approval.",
            "leave": new_leave,
        }, status=status.HTTP_201_CREATED)


class WorkforceLeaveCancelView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, leave_id):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        bank_details = emp.bank_details or {}
        leaves = bank_details.get("leaves", [])
        found = False

        for l in leaves:
            if str(l.get("id")) == str(leave_id):
                if l.get("status") != "submitted":
                    return Response({"error": f"Cannot cancel leave: Status is '{l.get('status')}'."}, status=status.HTTP_400_BAD_REQUEST)
                l["status"] = "cancelled"
                l["cancelled_at"] = timezone.now().isoformat()
                found = True
                break

        if not found:
            return Response({"error": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        bank_details["leaves"] = leaves
        emp.bank_details = bank_details
        emp.save()

        return Response({"message": "Leave application cancelled successfully."}, status=status.HTTP_200_OK)


class WorkforceAdminLeaveDecideView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, emp_id, leave_id):
        emp = Employee.objects.filter(pk=emp_id).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action", "").lower()  # approve, reject
        reason = request.data.get("reason", "").strip()

        if action not in ["approve", "reject"]:
            return Response({"error": "Action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        if action == "reject" and not reason:
            return Response({"error": "Rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        bank_details = emp.bank_details or {}
        leaves = bank_details.get("leaves", [])
        found = False

        for l in leaves:
            if str(l.get("id")) == str(leave_id):
                l["status"] = "approved" if action == "approve" else "rejected"
                l["reviewer"] = request.user.username
                l["review_reason"] = reason
                l["reviewed_at"] = timezone.now().isoformat()
                found = True
                break

        if not found:
            return Response({"error": "Leave application not found."}, status=status.HTTP_404_NOT_FOUND)

        bank_details["leaves"] = leaves
        emp.bank_details = bank_details
        emp.save()

        return Response({
            "message": f"Leave application marked as {l['status'].upper()}.",
            "leave": l,
        }, status=status.HTTP_200_OK)


# ─── 14. Real-Time Fleet Map & Live Location ──────────────────────────────────

class WorkforceFleetMapView(APIView):
    """
    Returns live fleet telemetry for technicians belonging strictly to the
    authenticated admin's company. Cross-tenant access is rejected.
    """
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        if not company:
            return Response(
                {"error": "Company context required.", "code": "NO_COMPANY"},
                status=status.HTTP_403_FORBIDDEN,
            )

        technicians = list(
            Employee.objects.filter(is_active=True, company=company).select_related("user")
        )
        tech_ids = [e.id for e in technicians]

        active_jobs_map = {}
        if tech_ids:
            active_jobs = ServiceRequest.objects.filter(
                assigned_employee_id__in=tech_ids,
                status__in=["accepted", "on_the_way", "in_progress"],
            )
            for j in active_jobs:
                if j.assigned_employee_id not in active_jobs_map:
                    active_jobs_map[j.assigned_employee_id] = j.request_id

        fleet = []
        for emp_item in technicians:
            onboarding = (emp_item.bank_details or {}).get("onboarding", {})
            reg_status = onboarding.get("status", "not_started")
            loc = emp_item.user.last_known_location or {}

            has_location = bool(
                loc.get("latitude") is not None and loc.get("longitude") is not None
            )
            lat = float(loc["latitude"]) if has_location else None
            lng = float(loc["longitude"]) if has_location else None
            active_job_id = active_jobs_map.get(emp_item.id)

            fleet.append({
                "id": emp_item.id,
                "employee_id": emp_item.employee_id,
                "name": emp_item.user.get_full_name() or emp_item.user.username,
                "phone": emp_item.user.mobile_number or emp_item.user.phone,
                "is_online": emp_item.is_online,
                "current_availability": emp_item.current_availability,
                "registration_status": reg_status,
                "has_location": has_location,
                "latitude": lat,
                "longitude": lng,
                "accuracy": float(loc["accuracy"]) if has_location and loc.get("accuracy") is not None else None,
                "last_update": loc.get("updated_at") if has_location else None,
                "location_status": "Available" if has_location else "Location unavailable",
                "active_job": active_job_id,
            })

        return Response(fleet, status=status.HTTP_200_OK)


class WorkforceLocationUpdateView(APIView):
    """
    Receives real device GPS coordinates from an online employee.
    Stores latitude, longitude, accuracy, and timestamp in User.last_known_location.
    Only the authenticated user's own location is updated — no frontend-supplied IDs accepted.
    Automatically evaluates GPS geofence against active accepted customer jobs and confirms arrival with ZERO Admin intervention.
    """
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp or not emp.is_active:
            return Response(
                {"error": "Active employee profile required.", "code": "EMPLOYEE_INACTIVE"},
                status=status.HTTP_403_FORBIDDEN,
            )

        lat = request.data.get("latitude") if request.data.get("latitude") is not None else request.data.get("lat")
        lng = request.data.get("longitude") if request.data.get("longitude") is not None else (request.data.get("lon") or request.data.get("lng"))
        accuracy = request.data.get("accuracy")  # metres, from browser Geolocation API

        if lat is None or lng is None:
            return Response(
                {"error": "latitude and longitude are required.", "code": "GPS_REQUIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid coordinate format.", "code": "INVALID_GPS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Strict coordinate range validation
        if not (-90.0 <= lat_f <= 90.0) or not (-180.0 <= lng_f <= 180.0):
            return Response(
                {"error": "Coordinates out of range (-90..90, -180..180).", "code": "COORDINATES_OUT_OF_RANGE"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        location_data = {
            "latitude": round(lat_f, 7),
            "longitude": round(lng_f, 7),
            "updated_at": now.isoformat(),
        }
        if accuracy is not None:
            try:
                acc_f = float(accuracy)
                if acc_f >= 0:
                    location_data["accuracy"] = round(acc_f, 2)
            except (ValueError, TypeError):
                pass

        user.last_known_location = location_data
        user.save(update_fields=["last_known_location"])

        # ── Automatic Real GPS Arrival & Geofence Evaluation (Zero-Admin Intervention) ──
        from service_requests.models import ServiceRequest, EmployeeJob
        from workforce_api.models import PreServiceVerification
        from time_tracking.geo import haversine_distance
        from django.db.models import Q
        import secrets
        from datetime import timedelta

        ARRIVAL_RADIUS_METERS = 300.0
        arrived_events = []

        # Find active accepted / en-route jobs owned by this technician
        emp_job_sr_ids = list(EmployeeJob.objects.filter(employee=emp).values_list("service_request_id", flat=True))
        active_jobs = ServiceRequest.objects.filter(
            Q(assigned_employee=emp) | Q(id__in=emp_job_sr_ids),
            company=emp.company,
            status__in=["accepted", "on_the_way", "en_route"],
            latitude__isnull=False,
            longitude__isnull=False,
        )

        for job in active_jobs:
            try:
                cust_lat = float(job.latitude)
                cust_lon = float(job.longitude)
                dist_m = haversine_distance(lat_f, lng_f, cust_lat, cust_lon)

                if dist_m <= ARRIVAL_RADIUS_METERS:
                    verification, _ = PreServiceVerification.objects.get_or_create(
                        job=job,
                        defaults={"employee": emp}
                    )
                    verification.employee = emp
                    verification.geofence_passed = True
                    verification.arrival_lat = lat_f
                    verification.arrival_lon = lng_f
                    if not verification.arrived_at:
                        verification.arrived_at = now

                    # Generate random 6-digit OTP if not already generated or expired
                    if not verification.otp_code or (verification.otp_expires_at and verification.otp_expires_at < now):
                        new_otp = f"{secrets.randbelow(900000) + 100000}"
                        verification.otp_code = new_otp
                        verification.otp_generated_at = now
                        verification.otp_expires_at = now + timedelta(minutes=15)
                        verification.otp_attempts = 0
                        verification.otp_verified = False

                        if job.customer:
                            create_notification(
                                recipient=job.customer,
                                title="Technician Arrived — Work Start OTP",
                                message=f"Technician {user.get_full_name() or user.username} has arrived. Share OTP {new_otp} to start service.",
                                notification_type="WORK_START_OTP",
                                company=job.company,
                                related_object_id=str(job.id),
                            )

                    verification.check_completion()
                    verification.save()

                    # Transition status to arrived
                    job.status = "arrived"
                    job.save(update_fields=["status"])
                    EmployeeJob.objects.filter(service_request=job, employee=emp).update(status="ARRIVED")

                    create_notification(
                        recipient=user,
                        title="Arrival Verified Automatically!",
                        message=f"You have arrived at Job #{job.id} ({int(dist_m)}m away). Work Start OTP is ready for verification.",
                        notification_type="AUTOMATIC_ARRIVAL",
                        company=job.company,
                        related_object_id=str(job.id),
                    )

                    arrived_events.append({
                        "job_id": job.id,
                        "distance_m": round(dist_m, 1),
                        "geofence_passed": True,
                        "status": "arrived",
                    })
            except Exception:
                pass

        return Response({
            "message": "Live GPS coordinates updated.",
            "location": user.last_known_location,
            "arrived_events": arrived_events,
        }, status=status.HTTP_200_OK)




# ─── 21. Notification Engine & Event Triggers ────────────────────────────────

def create_notification(recipient, title, message, notification_type, company=None, related_object_id=""):
    if not recipient:
        return None
    notif = WorkforceNotification.objects.create(
        recipient=recipient,
        company=company or getattr(recipient, "company", None),
        title=title,
        message=message,
        notification_type=notification_type,
        related_object_id=str(related_object_id or ""),
    )
    WorkforceEventLog.objects.create(
        event_type=f"NOTIFICATION_{notification_type}",
        user=recipient,
        payload={"notification_id": notif.id, "title": title, "message": message}
    )
    return notif


class WorkforceNotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        notifs = WorkforceNotification.objects.filter(recipient=user)[:50]
        unread_count = WorkforceNotification.objects.filter(recipient=user, is_read=False).count()

        data = [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "notification_type": n.notification_type,
                "related_object_id": n.related_object_id,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ]

        return Response({
            "unread_count": unread_count,
            "notifications": data,
        }, status=status.HTTP_200_OK)


class WorkforceNotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None):
        user = request.user
        if pk:
            WorkforceNotification.objects.filter(pk=pk, recipient=user).update(is_read=True, read_at=timezone.now())
        else:
            WorkforceNotification.objects.filter(recipient=user, is_read=False).update(is_read=True, read_at=timezone.now())

        return Response({"message": "Notifications marked as read."}, status=status.HTTP_200_OK)


# ─── 22. Workforce Scheduling Module ──────────────────────────────────────────

class WorkforceScheduleManageView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request, emp_id=None):
        if emp_id:
            schedules = WorkforceEmployeeSchedule.objects.filter(employee_id=emp_id)
        else:
            schedules = WorkforceEmployeeSchedule.objects.all().select_related("employee__user")

        data = [
            {
                "id": s.id,
                "employee_id": s.employee.employee_id,
                "employee_name": s.employee.user.get_full_name() or s.employee.user.username,
                "day_of_week": s.day_of_week,
                "day_name": s.get_day_of_week_display(),
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M"),
                "is_working_day": s.is_working_day,
            }
            for s in schedules
        ]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, emp_id):
        emp = Employee.objects.filter(pk=emp_id).first()
        if not emp:
            return Response({"error": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        schedule_items = request.data.get("schedules", [])
        if not isinstance(schedule_items, list):
            return Response({"error": "schedules must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        updated_schedules = []
        with transaction.atomic():
            for item in schedule_items:
                day_of_week = int(item.get("day_of_week", 0))
                start_time = item.get("start_time", "09:00")
                end_time = item.get("end_time", "18:00")
                is_working_day = bool(item.get("is_working_day", True))

                sched, _ = WorkforceEmployeeSchedule.objects.update_or_create(
                    employee=emp,
                    day_of_week=day_of_week,
                    defaults={
                        "company": emp.company,
                        "start_time": start_time,
                        "end_time": end_time,
                        "is_working_day": is_working_day,
                    }
                )
                updated_schedules.append({
                    "id": sched.id,
                    "day_of_week": sched.day_of_week,
                    "day_name": sched.get_day_of_week_display(),
                    "start_time": sched.start_time.strftime("%H:%M"),
                    "end_time": sched.end_time.strftime("%H:%M"),
                    "is_working_day": sched.is_working_day,
                })

        return Response({
            "message": f"Work schedule updated for {emp.user.get_full_name()}.",
            "schedules": updated_schedules,
        }, status=status.HTTP_200_OK)


class WorkforceMyScheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response([], status=status.HTTP_200_OK)

        schedules = WorkforceEmployeeSchedule.objects.filter(employee=emp).order_by("day_of_week")
        data = [
            {
                "id": s.id,
                "day_of_week": s.day_of_week,
                "day_name": s.get_day_of_week_display(),
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M"),
                "is_working_day": s.is_working_day,
            }
            for s in schedules
        ]
        return Response(data, status=status.HTTP_200_OK)


# ─── 23. Skills Management Module ──────────────────────────────────────────────

class WorkforceSkillManageView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        company = get_request_company(request)
        if not company:
            return Response({"error": "Tenant company context missing.", "code": "TENANT_MISSING", "details": {}}, status=status.HTTP_403_FORBIDDEN)
        skills = WorkforceSkill.objects.filter(company=company)
        data = [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "category": s.category,
                "description": s.description,
                "is_active": s.is_active,
            }
            for s in skills
        ]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        company = get_request_company(request)
        if not company:
            return Response({"error": "Tenant company context missing.", "code": "TENANT_MISSING", "details": {}}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get("name", "").strip()
        code = request.data.get("code", "").strip()
        category = request.data.get("category", "General").strip()
        description = request.data.get("description", "").strip()

        if not name:
            return Response({"error": "Skill name is required.", "code": "INVALID_INPUT", "details": {}}, status=status.HTTP_400_BAD_REQUEST)

        skill, created = WorkforceSkill.objects.get_or_create(
            company=company,
            name=name,
            defaults={
                "code": code,
                "category": category,
                "description": description,
                "is_active": True,
            }
        )
        if not created:
            skill.code = code or skill.code
            skill.category = category or skill.category
            skill.description = description or skill.description
            skill.is_active = True
            skill.save()

        return Response({
            "message": f"Skill '{skill.name}' created/updated.",
            "skill": {
                "id": skill.id,
                "name": skill.name,
                "code": skill.code,
                "category": skill.category,
                "is_active": skill.is_active,
            }
        }, status=status.HTTP_201_CREATED)


class WorkforceEmployeeSkillAssignView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, emp_id):
        emp = Employee.objects.filter(pk=emp_id).first()
        if not emp:
            return Response({"error": "Employee not found.", "code": "NOT_FOUND", "details": {}}, status=status.HTTP_404_NOT_FOUND)

        skill_id = request.data.get("skill_id")
        proficiency = request.data.get("proficiency_level", "INTERMEDIATE")
        action = request.data.get("action", "assign").lower()

        skill = WorkforceSkill.objects.filter(pk=skill_id).first()
        if not skill:
            return Response({"error": "Skill not found.", "code": "NOT_FOUND", "details": {}}, status=status.HTTP_404_NOT_FOUND)

        if action == "remove":
            WorkforceEmployeeSkill.objects.filter(employee=emp, skill=skill).delete()
            return Response({"message": f"Skill '{skill.name}' removed from technician."}, status=status.HTTP_200_OK)

        emp_skill, _ = WorkforceEmployeeSkill.objects.update_or_create(
            employee=emp,
            skill=skill,
            defaults={
                "proficiency_level": proficiency,
                "is_verified": True,
                "verified_by": request.user,
                "verified_at": timezone.now(),
            }
        )

        return Response({
            "message": f"Skill '{skill.name}' assigned to {emp.user.get_full_name()}.",
            "skill": {
                "id": emp_skill.id,
                "skill_name": skill.name,
                "proficiency_level": emp_skill.proficiency_level,
                "is_verified": emp_skill.is_verified,
            }
        }, status=status.HTTP_200_OK)


class WorkforceMySkillsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response([], status=status.HTTP_200_OK)

        emp_skills = WorkforceEmployeeSkill.objects.filter(employee=emp).select_related("skill")
        data = [
            {
                "id": es.id,
                "skill_id": es.skill.id,
                "skill_name": es.skill.name,
                "category": es.skill.category,
                "proficiency_level": es.proficiency_level,
                "is_verified": es.is_verified,
            }
            for es in emp_skills
        ]
        return Response(data, status=status.HTTP_200_OK)


# ─── 24. Compliance Management Module ─────────────────────────────────────────

class WorkforceComplianceRequirementView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        company = get_request_company(request)
        if not company:
            return Response({"error": "Tenant company context missing.", "code": "TENANT_MISSING", "details": {}}, status=status.HTTP_403_FORBIDDEN)
        reqs = WorkforceComplianceRequirement.objects.filter(company=company)
        data = [
            {
                "id": r.id,
                "title": r.title,
                "is_mandatory": r.is_mandatory,
                "validity_days": r.validity_days,
                "description": r.description,
            }
            for r in reqs
        ]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        company = get_request_company(request)
        if not company:
            return Response({"error": "Tenant company context missing.", "code": "TENANT_MISSING", "details": {}}, status=status.HTTP_403_FORBIDDEN)
        title = request.data.get("title", "").strip()
        is_mandatory = bool(request.data.get("is_mandatory", True))
        validity_days = int(request.data.get("validity_days", 365))
        description = request.data.get("description", "").strip()

        if not title:
            return Response({"error": "Requirement title required."}, status=status.HTTP_400_BAD_REQUEST)

        req, created = WorkforceComplianceRequirement.objects.get_or_create(
            company=company,
            title=title,
            defaults={
                "is_mandatory": is_mandatory,
                "validity_days": validity_days,
                "description": description,
            }
        )
        return Response({
            "message": f"Compliance requirement '{req.title}' created.",
            "requirement": {
                "id": req.id,
                "title": req.title,
                "is_mandatory": req.is_mandatory,
                "validity_days": req.validity_days,
            }
        }, status=status.HTTP_201_CREATED)


class WorkforceEmployeeComplianceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, emp_id=None):
        user = request.user
        emp = getattr(user, "employee_profile", None)

        if is_admin_role(user):
            if emp_id:
                records = WorkforceEmployeeCompliance.objects.filter(employee_id=emp_id).select_related("requirement", "employee__user")
            else:
                records = WorkforceEmployeeCompliance.objects.all().select_related("requirement", "employee__user")
        else:
            if not emp:
                return Response([], status=status.HTTP_200_OK)
            records = WorkforceEmployeeCompliance.objects.filter(employee=emp).select_related("requirement")

        today = timezone.now().date()
        data = []
        for r in records:
            comp_status = r.status
            if r.expiry_date:
                if r.expiry_date < today:
                    comp_status = "EXPIRED"
                elif (r.expiry_date - today).days <= 30 and comp_status == "VALID":
                    comp_status = "EXPIRING"

            data.append({
                "id": r.id,
                "employee_id": r.employee.employee_id,
                "employee_name": r.employee.user.get_full_name() or r.employee.user.username,
                "requirement_id": r.requirement.id,
                "requirement_title": r.requirement.title,
                "is_mandatory": r.requirement.is_mandatory,
                "document_number": r.document_number,
                "issue_date": r.issue_date.isoformat() if r.issue_date else None,
                "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
                "status": comp_status,
                "file_url": r.file_url,
                "rejection_reason": r.rejection_reason,
            })
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        requirement_id = request.data.get("requirement_id")
        doc_num = request.data.get("document_number", "").strip()
        issue_date = request.data.get("issue_date")
        expiry_date = request.data.get("expiry_date")
        file_url = request.data.get("file_url", "").strip()

        req = WorkforceComplianceRequirement.objects.filter(pk=requirement_id).first()
        if not req:
            return Response({"error": "Compliance requirement not found."}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()
        status_val = "VALID"
        if expiry_date:
            exp_d = timezone.datetime.strptime(expiry_date, "%Y-%m-%d").date()
            if exp_d < today:
                status_val = "EXPIRED"
            elif (exp_d - today).days <= 30:
                status_val = "EXPIRING"

        record, _ = WorkforceEmployeeCompliance.objects.update_or_create(
            requirement=req,
            employee=emp,
            defaults={
                "document_number": doc_num,
                "issue_date": issue_date,
                "expiry_date": expiry_date,
                "status": status_val,
                "file_url": file_url,
            }
        )
        return Response({
            "message": f"Compliance document for '{req.title}' submitted.",
            "record": {
                "id": record.id,
                "requirement_title": req.title,
                "status": record.status,
            }
        }, status=status.HTTP_201_CREATED)


# ─── 25. Workforce Realtime Stream (SSE) ──────────────────────────────────────

class WorkforceRealtimeStreamView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        def event_stream():
            last_id = 0
            yield f"event: ping\ndata: {json.dumps({'status': 'connected', 'timestamp': timezone.now().isoformat()})}\n\n"

            for _ in range(15):
                events = WorkforceEventLog.objects.filter(id__gt=last_id).order_by("id")[:10]
                for ev in events:
                    last_id = ev.id
                    if ev.user is None or ev.user == user or is_admin_role(user):
                        event_data = {
                            "id": ev.id,
                            "event_type": ev.event_type,
                            "payload": ev.payload,
                            "timestamp": ev.created_at.isoformat(),
                        }
                        yield f"event: workforce_event\ndata: {json.dumps(event_data)}\n\n"
                time.sleep(1)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


# ─── 26. Payroll Management Module ─────────────────────────────────────────────

class WorkforceAdminPayrollListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        company = getattr(request.user, "company", None) or Company.objects.first()
        periods = WorkforcePayPeriod.objects.filter(company=company)
        data = [
            {
                "id": p.id,
                "name": p.name,
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "status": p.status,
                "payslip_count": p.payslips.count(),
                "total_net_pay": str(sum(ps.net_pay for ps in p.payslips.all())),
            }
            for p in periods
        ]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        company = getattr(request.user, "company", None) or Company.objects.first()
        name = request.data.get("name", "").strip()
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")

        if not name or not start_date or not end_date:
            return Response({"error": "name, start_date, and end_date required."}, status=status.HTTP_400_BAD_REQUEST)

        period = WorkforcePayPeriod.objects.create(
            company=company,
            name=name,
            start_date=start_date,
            end_date=end_date,
            status="DRAFT",
            processed_by=request.user,
        )
        return Response({
            "message": f"Pay period '{period.name}' created.",
            "pay_period": {
                "id": period.id,
                "name": period.name,
                "status": period.status,
            }
        }, status=status.HTTP_201_CREATED)


class WorkforceAdminPayrollProcessView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, period_id):
        period = WorkforcePayPeriod.objects.filter(pk=period_id).first()
        if not period:
            return Response({"error": "Pay period not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action", "process").lower()

        if action == "advance_status":
            target_status = request.data.get("status")
            if target_status in ["PROCESSING", "REVIEW", "APPROVED", "PAID"]:
                period.status = target_status
                period.save()
                WorkforcePayslip.objects.filter(pay_period=period).update(status=target_status)

                if target_status == "PAID":
                    for ps in period.payslips.all():
                        create_notification(
                            recipient=ps.employee.user,
                            title="Payslip Published",
                            message=f"Your payslip for period '{period.name}' (Net: ${ps.net_pay}) has been paid.",
                            notification_type="PAYROLL_AVAILABILITY"
                        )
                return Response({"message": f"Pay period status advanced to {target_status}."}, status=status.HTTP_200_OK)

        employees = Employee.objects.filter(company=period.company, is_active=True).select_related("user")
        created_payslips = []

        with transaction.atomic():
            period.status = "PROCESSING"
            period.save()

            for emp in employees:
                hourly_rate = float(emp.hourly_rate or 0)
                time_logs = TimeLog.objects.filter(
                    employee=emp,
                    work_date__gte=period.start_date,
                    work_date__lte=period.end_date,
                    clock_out__isnull=False
                ).prefetch_related("breaks")
                total_worked_seconds = sum(log.worked_seconds() for log in time_logs)
                total_worked_hours = total_worked_seconds / 3600.0
                base_earnings = hourly_rate * total_worked_hours

                completed_jobs = ServiceRequest.objects.filter(
                    assigned_employee=emp,
                    status="completed",
                    updated_at__date__gte=period.start_date,
                    updated_at__date__lte=period.end_date
                )
                job_total = sum(float(j.total_amount) for j in completed_jobs)
                job_earnings = job_total * 0.20

                adjustments = 0.0
                deductions = (base_earnings + job_earnings) * 0.10
                net_pay = (base_earnings + job_earnings + adjustments) - deductions

                ps, _ = WorkforcePayslip.objects.update_or_create(
                    pay_period=period,
                    employee=emp,
                    defaults={
                        "base_earnings": round(base_earnings, 2),
                        "job_earnings": round(job_earnings, 2),
                        "adjustments": round(adjustments, 2),
                        "deductions": round(deductions, 2),
                        "net_pay": round(net_pay, 2),
                        "status": "PROCESSING",
                    }
                )
                created_payslips.append({
                    "id": ps.id,
                    "employee_name": emp.user.get_full_name(),
                    "net_pay": str(ps.net_pay),
                })

        return Response({
            "message": f"Processed payroll for {len(created_payslips)} employees.",
            "payslips": created_payslips,
        }, status=status.HTTP_200_OK)


class WorkforceMyPayslipsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response([], status=status.HTTP_200_OK)

        payslips = WorkforcePayslip.objects.filter(employee=emp).select_related("pay_period")
        data = [
            {
                "id": ps.id,
                "pay_period_name": ps.pay_period.name,
                "start_date": ps.pay_period.start_date.isoformat(),
                "end_date": ps.pay_period.end_date.isoformat(),
                "base_earnings": str(ps.base_earnings),
                "job_earnings": str(ps.job_earnings),
                "adjustments": str(ps.adjustments),
                "deductions": str(ps.deductions),
                "net_pay": str(ps.net_pay),
                "status": ps.status,
                "created_at": ps.created_at.isoformat(),
            }
            for ps in payslips
        ]
        return Response(data, status=status.HTTP_200_OK)


# ─── 27. Reports & Analytics Engine ──────────────────────────────────────────

class WorkforceReportsView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        report_type = request.query_params.get("type", "employee").lower()
        service_filter = request.query_params.get("service")
        emp_filter = request.query_params.get("employee_id")
        status_filter = request.query_params.get("status")

        if report_type == "employee":
            qs = Employee.objects.all().select_related("user")
            if emp_filter:
                qs = qs.filter(pk=emp_filter)
            if status_filter:
                qs = qs.filter(is_active=(status_filter.lower() == "active"))
            rows = [
                {
                    "employee_id": e.employee_id,
                    "name": e.user.get_full_name() or e.user.username,
                    "email": e.user.email,
                    "title": e.title,
                    "is_active": e.is_active,
                    "is_online": e.is_online,
                    "hourly_rate": str(e.hourly_rate),
                }
                for e in qs
            ]
            return Response({"report_type": "employee", "total_records": len(rows), "rows": rows}, status=status.HTTP_200_OK)

        elif report_type == "job":
            qs = ServiceRequest.objects.all()
            if service_filter:
                qs = qs.filter(service_category__icontains=service_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if emp_filter:
                qs = qs.filter(assigned_employee_id=emp_filter)
            rows = [
                {
                    "request_id": j.request_id,
                    "customer_name": j.customer_name,
                    "service_category": j.service_category,
                    "issue_title": j.issue_title,
                    "status": j.status,
                    "total_amount": str(j.total_amount),
                    "created_at": j.created_at.isoformat(),
                }
                for j in qs
            ]
            return Response({"report_type": "job", "total_records": len(rows), "rows": rows}, status=status.HTTP_200_OK)

        elif report_type == "payroll":
            qs = WorkforcePayslip.objects.all().select_related("employee__user", "pay_period")
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            rows = [
                {
                    "pay_period": ps.pay_period.name,
                    "employee_id": ps.employee.employee_id,
                    "employee_name": ps.employee.user.get_full_name(),
                    "base_earnings": str(ps.base_earnings),
                    "job_earnings": str(ps.job_earnings),
                    "net_pay": str(ps.net_pay),
                    "status": ps.status,
                }
                for ps in qs
            ]
            return Response({"report_type": "payroll", "total_records": len(rows), "rows": rows}, status=status.HTTP_200_OK)

        elif report_type == "compliance":
            qs = WorkforceEmployeeCompliance.objects.all().select_related("employee__user", "requirement")
            if emp_filter:
                qs = qs.filter(employee_id=emp_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            rows = [
                {
                    "employee_id": c.employee.employee_id,
                    "employee_name": c.employee.user.get_full_name(),
                    "requirement": c.requirement.title,
                    "document_number": c.document_number,
                    "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
                    "status": c.status,
                }
                for c in qs
            ]
            return Response({"report_type": "compliance", "total_records": len(rows), "rows": rows}, status=status.HTTP_200_OK)

        return Response({"error": f"Unknown report_type '{report_type}'."}, status=status.HTTP_400_BAD_REQUEST)


class WorkforceLatencyAuditView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            from measure_fleet_map_backend_time import measure_fleet_map
            fleet_map_data = measure_fleet_map()
            
            return Response({
                "fleet_map_backend_measurement": fleet_map_data,
            }, status=status.HTTP_200_OK)
        except Exception as err:
            return Response({
                "error": str(err)
            }, status=status.HTTP_200_OK)



class WorkforceVerificationSuiteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            suite_name = request.query_params.get("suite", "master")
            if suite_name == "employee_platform":
                file_path = os.path.join(settings.BASE_DIR, "test_employee_platform_integration.py")
                glob = {"__file__": file_path, "__name__": "test_suite"}
                with open(file_path, "r", encoding="utf-8") as f:
                    code = compile(f.read(), file_path, "exec")
                    exec(code, glob)
                if "run_tests" in glob:
                    results = glob["run_tests"]()
                else:
                    results = {"passed": 0, "failed": 1, "errors": ["run_tests function not found"]}
                name = "Employee Platform Integration Verification Suite"
                is_ok = results.get("failed", 0) == 0






            elif suite_name == "phase4":
                file_path = os.path.join(settings.BASE_DIR, "test_phase4_completed_features.py")
                glob = {"__file__": file_path, "__name__": "__main__"}
                with open(file_path, "r", encoding="utf-8") as f:
                    exec(compile(f.read(), file_path, "exec"), glob)
                results = glob["run_tests"]() if "run_tests" in glob else {"passed": 0, "failed": 1}
                name = "Phase 4 Verification Suite"
                is_ok = results.get("failed", 0) == 0

            elif suite_name == "phase5":
                from test_phase5_customer_and_extension_handover import run_tests
                results = run_tests()
                name = "Phase 5 Customer & Extension Handover Verification Suite"
                is_ok = results.get("failed", 0) == 0
            else:
                from run_master_customer_marketplace_handover_verification import run_master_handover_audit
                results = run_master_handover_audit()
                name = "Master Customer/Marketplace Handover Audit Suite"
                is_ok = results.get("is_handover_ready", False)


            return Response({
                "suite": name,
                "is_ok": is_ok,
                "results": results,
            }, status=status.HTTP_200_OK)

        except Exception as err:
            import traceback
            return Response({
                "error": str(err),
                "traceback": traceback.format_exc(),
            }, status=status.HTTP_200_OK)



# ─── Phase 2: Arrival, Pre-Service Verification & Service Gate ───────────────

class WorkforceJobArriveView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp or job.assigned_employee != emp:
            return Response({"error": "Unauthorized: Job is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        if job.status not in ["accepted", "on_the_way", "arrived"]:
            return Response({
                "error": f"Job #{job.id} is in status '{job.status}'. Expected 'accepted' or 'on_the_way'."
            }, status=status.HTTP_400_BAD_REQUEST)

        lat = request.data.get("lat") if request.data.get("lat") is not None else request.data.get("latitude")
        lon = request.data.get("lon") if request.data.get("lon") is not None else (request.data.get("longitude") or request.data.get("lng"))


        try:
            lat_val = float(lat)
            lon_val = float(lon)
        except (ValueError, TypeError):
            return Response({
                "error": "Real browser GPS coordinates (lat and lon) are required for arrival verification."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not (-90.0 <= lat_val <= 90.0 and -180.0 <= lon_val <= 180.0):
            return Response({
                "error": "GPS coordinates out of valid range (-90 to 90 lat, -180 to 180 lon)."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Real GPS Arrival Geofencing: Compare Employee GPS against Customer Job Location
        from time_tracking.geo import haversine_distance, evaluate
        ARRIVAL_RADIUS_METERS = 300.0

        if job.latitude is not None and job.longitude is not None:
            distance_m = haversine_distance(lat_val, lon_val, float(job.latitude), float(job.longitude))
            if distance_m > ARRIVAL_RADIUS_METERS:
                return Response({
                    "error": f"Arrival failed: You are {int(distance_m)}m away from the customer address. You must be within 300m to confirm arrival.",
                    "geofence_passed": False,
                    "code": "OUTSIDE_GEOFENCE",
                    "details": {
                        "distance_m": round(distance_m, 1),
                        "threshold_m": ARRIVAL_RADIUS_METERS,
                        "customer_lat": job.latitude,
                        "customer_lng": job.longitude,
                    }
                }, status=status.HTTP_403_FORBIDDEN)
            matched_location = f"Customer Destination ({job.address[:40]}...)" if job.address else "Customer Job Location"
        else:
            # Fallback to company locations if customer booking coordinates were not populated
            permitted_locs = list(Location.objects.filter(company=emp.company, is_active=True))
            decision = evaluate(
                lat=lat_val,
                lng=lon_val,
                permitted_locations=permitted_locs,
                is_admin=getattr(request.user, "is_staff", False),
                allow_all_locations=getattr(emp, "allow_all_locations", False) or not getattr(emp.company, "geofence_enabled", True)
            )
            if not decision.allowed:
                return Response({
                    "error": f"Arrival failed: {decision.reason}",
                    "geofence_passed": False,
                    "code": "OUTSIDE_GEOFENCE",
                    "details": {"distance_m": decision.distance_m}
                }, status=status.HTTP_403_FORBIDDEN)
            distance_m = decision.distance_m
            matched_location = decision.matched_location.name if decision.matched_location else "Job Site"

        now = timezone.now()
        # Production random 6-digit OTP (100000 - 999999)
        new_otp = f"{secrets.randbelow(900000) + 100000}"

        verification, _ = PreServiceVerification.objects.get_or_create(
            job=job,
            defaults={"employee": emp}
        )

        # Fresh arrival generates new OTP, invalidates previous OTP and resets attempt counter
        verification.employee = emp
        verification.geofence_passed = True
        verification.arrival_lat = lat_val
        verification.arrival_lon = lon_val
        verification.arrived_at = now
        verification.otp_code = new_otp
        verification.otp_generated_at = now
        verification.otp_expires_at = now + timedelta(minutes=15)
        verification.otp_attempts = 0
        verification.otp_verified = False
        verification.otp_verified_at = None
        verification.check_completion()
        verification.save()

        job.status = "arrived"
        job.save()

        try:
            from service_requests.models import EmployeeJob
            EmployeeJob.objects.filter(service_request=job, employee=emp).update(status="ARRIVED")
        except Exception:
            pass

        # Send notification to customer with Work Start OTP
        if job.customer:
            create_notification(
                recipient=job.customer,
                title="Technician Arrived — Work Start OTP",
                message=f"Technician {emp.user.get_full_name()} has arrived. Share OTP {new_otp} to start service.",
                notification_type="WORK_START_OTP",
                company=job.company,
                related_object_id=str(job.id),
            )

        return Response({
            "message": "Arrival verified! Fresh Customer Work Start OTP generated and sent to customer.",
            "geofence_passed": True,
            "matched_location": matched_location,
            "distance_m": round(distance_m, 1),
            "status": job.status,
            "otp_generated": True,
            "otp_expires_in_minutes": 15,
        }, status=status.HTTP_200_OK)



class WorkforceJobVerifyOTPView(APIView):
    permission_classes = [IsApprovedTechnician]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp or job.assigned_employee != emp:
            return Response({"error": "Unauthorized: Job is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        otp_input = str(request.data.get("otp") or request.data.get("otp_code") or "").strip()
        if not otp_input:
            return Response({"error": "Customer OTP code required."}, status=status.HTTP_400_BAD_REQUEST)


        verification = PreServiceVerification.objects.filter(job=job).first()
        if not verification or not verification.otp_code:
            return Response({
                "error": "No OTP generated for this job. Technician must arrive at the job location first."
            }, status=status.HTTP_400_BAD_REQUEST)

        if verification.otp_verified:
            return Response({
                "message": "Customer OTP already verified.",
                "otp_verified": True,
                "is_complete": verification.is_complete,
            }, status=status.HTTP_200_OK)

        # Max 5 attempts enforced
        if verification.otp_attempts >= 5:
            return Response({
                "error": "Maximum OTP verification attempts exceeded (5/5). Please re-arrive at the site to generate a fresh OTP.",
                "code": "MAX_OTP_ATTEMPTS_EXCEEDED",
            }, status=status.HTTP_400_BAD_REQUEST)

        # Expiry check (15 minutes)
        if verification.otp_expires_at and timezone.now() > verification.otp_expires_at:
            return Response({
                "error": "Customer OTP has expired. Please re-arrive at the site to generate a fresh OTP.",
                "code": "OTP_EXPIRED",
            }, status=status.HTTP_400_BAD_REQUEST)

        if verification.otp_code != otp_input:
            verification.otp_attempts += 1
            verification.save()
            remaining = max(0, 5 - verification.otp_attempts)
            return Response({
                "error": f"Invalid Customer OTP code. {remaining} attempt(s) remaining.",
                "code": "INVALID_OTP",
                "attempts_remaining": remaining,
            }, status=status.HTTP_400_BAD_REQUEST)

        verification.otp_verified = True
        verification.otp_verified_at = timezone.now()
        is_complete = verification.check_completion()
        verification.save()

        return Response({
            "message": "Customer OTP verified successfully.",
            "otp_verified": True,
            "is_complete": is_complete,
        }, status=status.HTTP_200_OK)


class WorkforceCustomerJobOTPView(APIView):
    """
    Endpoint for customer or admin to securely display/retrieve the Work Start OTP for the job.
    Technicians are strictly blocked from this endpoint.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        is_customer = (
            job.customer == request.user
            or str(getattr(job, "customer_name", "")).lower() == request.user.username.lower()
            or getattr(job, "phone", "") == getattr(request.user, "username", "")
        )
        is_admin = is_admin_role(request.user)

        if not (is_customer or is_admin):
            return Response({
                "error": "Unauthorized: Only the booking customer or admin may view the Customer Work Start OTP."
            }, status=status.HTTP_403_FORBIDDEN)

        verification = PreServiceVerification.objects.filter(job=job).first()
        if not verification or not verification.otp_code:
            return Response({
                "error": "Work Start OTP has not been generated yet. Technician must arrive at the job location first."
            }, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        is_expired = bool(verification.otp_expires_at and now > verification.otp_expires_at)

        if verification.otp_verified:
            otp_state = "VERIFIED"
        elif is_expired:
            otp_state = "EXPIRED"
        else:
            otp_state = "ACTIVE"

        return Response({
            "job_id": job.id,
            "request_id": job.request_id,
            "otp_code": verification.otp_code,
            "otp": verification.otp_code,  # backward compatibility alias
            "otp_state": otp_state,
            "expires_at": verification.otp_expires_at.isoformat() if verification.otp_expires_at else None,
            "is_verified": verification.otp_verified,
            "otp_attempts": verification.otp_attempts,
            "customer_message": f"Your Work Start Verification Code: {verification.otp_code}. Share this code with your technician upon arrival.",
            "authorized_action": "START_WORK_AND_CLOCK_IN",
        }, status=status.HTTP_200_OK)


class WorkforceJobPreServicePhotoView(APIView):
    permission_classes = [IsApprovedTechnician]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp or job.assigned_employee != emp:
            return Response({"error": "Unauthorized: Job is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        photo_type = request.data.get("photo_type")
        photo_file = request.FILES.get("file") or request.FILES.get("photo")

        if photo_type not in ["presence", "appliance", "work_area"]:
            return Response({
                "error": "photo_type must be one of: presence, appliance, work_area."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not photo_file:
            return Response({"error": "Photo file required."}, status=status.HTTP_400_BAD_REQUEST)

        verification, _ = PreServiceVerification.objects.get_or_create(
            job=job,
            defaults={"employee": emp}
        )

        if photo_type == "presence":
            verification.presence_photo = photo_file
        elif photo_type == "appliance":
            verification.appliance_photo = photo_file
        elif photo_type == "work_area":
            verification.work_area_photo = photo_file

        is_complete = verification.check_completion()
        verification.save()

        return Response({
            "message": f"Pre-service photo '{photo_type}' uploaded successfully.",
            "photo_type": photo_type,
            "is_complete": is_complete,
        }, status=status.HTTP_201_CREATED)


class WorkforceJobPreServiceStatusView(APIView):
    permission_classes = [IsApprovedTechnician]

    def get(self, request, pk):
        job = ServiceRequest.objects.filter(pk=pk).first()
        if not job:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        emp = getattr(request.user, "employee_profile", None)
        if not emp or job.assigned_employee != emp:
            return Response({"error": "Unauthorized: Job is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        verification = PreServiceVerification.objects.filter(job=job).first()
        if not verification:
            return Response({
                "geofence_passed": False,
                "otp_verified": False,
                "presence_photo": False,
                "appliance_photo": False,
                "work_area_photo": False,
                "is_complete": False,
            }, status=status.HTTP_200_OK)

        return Response({
            "geofence_passed": verification.geofence_passed,
            "otp_verified": verification.otp_verified,
            "presence_photo": bool(verification.presence_photo),
            "appliance_photo": bool(verification.appliance_photo),
            "work_area_photo": bool(verification.work_area_photo),
            "is_complete": verification.is_complete,
        }, status=status.HTTP_200_OK)


# ─── 28. Employee Profile & Controlled Change Requests ─────────────────────────

class WorkforceEmployeeProfileMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found for user."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkforceEmployeeProfileSerializer(emp)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found for user."}, status=status.HTTP_404_NOT_FOUND)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        reg_status = onboarding.get("status", "not_started")
        is_locked = reg_status in ["submitted", "under_review", "approved"]

        # Check if user is attempting to modify controlled fields directly
        controlled_fields_map = {
            "first_name": "First Name",
            "last_name": "Last Name",
            "date_of_birth": "Date of Birth",
            "dob": "Date of Birth",
            "employee_id": "Employee ID",
            "country": "Country",
            "state": "State",
            "department": "Department",
            "hourly_rate": "Hourly Rate",
        }

        if is_locked:
            for field, label in controlled_fields_map.items():
                if field in request.data:
                    return Response({
                        "error": f"'{label}' is a controlled registration/employment field and cannot be edited directly. Please submit an Employee Change Request for Admin review.",
                        "field": field,
                        "requires_change_request": True,
                    }, status=status.HTTP_400_BAD_REQUEST)

        # Update freely editable personal preferences
        user_changed = False
        emp_changed = False

        if "phone" in request.data:
            user.phone = request.data["phone"]
            emp.phone = request.data["phone"]
            user_changed = True
            emp_changed = True

        if "bio" in request.data:
            user.bio = request.data["bio"]
            user_changed = True

        if "timezone" in request.data:
            user.timezone = request.data["timezone"]
            user_changed = True

        if "language" in request.data:
            user.language = request.data["language"]
            user_changed = True

        if user_changed:
            user.save()
        if emp_changed:
            emp.save()

        serializer = WorkforceEmployeeProfileSerializer(emp)
        return Response({
            "message": "Profile preferences updated successfully.",
            "profile": serializer.data,
        }, status=status.HTTP_200_OK)


class WorkforceProfileAvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        avatar_file = request.FILES.get("avatar") or request.FILES.get("file")
        if not avatar_file:
            return Response({"error": "No avatar file provided."}, status=status.HTTP_400_BAD_REQUEST)

        user.avatar = avatar_file
        user.save()

        avatar_url = ""
        try:
            avatar_url = user.avatar.url
        except Exception:
            avatar_url = str(user.avatar)

        return Response({
            "message": "Profile avatar updated successfully.",
            "avatar_url": avatar_url,
        }, status=status.HTTP_200_OK)


class WorkforceEmployeeChangeRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found."}, status=status.HTTP_404_NOT_FOUND)

        requests = WorkforceEmployeeChangeRequest.objects.filter(employee=emp).order_by("-created_at")
        serializer = WorkforceEmployeeChangeRequestSerializer(requests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found."}, status=status.HTTP_404_NOT_FOUND)

        field_name = request.data.get("field_name", "").strip()
        field_label = request.data.get("field_label", "").strip() or field_name.replace("_", " ").title()
        new_value = request.data.get("new_value", "").strip()
        reason = request.data.get("reason", "").strip()

        if not field_name or not new_value or not reason:
            return Response({
                "error": "field_name, new_value, and reason are required for a Change Request."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Determine old_value from current record
        old_value = ""
        if field_name == "first_name":
            old_value = user.first_name
        elif field_name == "last_name":
            old_value = user.last_name
        elif field_name in ["date_of_birth", "dob"]:
            old_value = str(emp.date_of_birth or "")
        elif field_name in ["phone", "mobile_number"]:
            old_value = user.mobile_number or user.phone or emp.phone or ""
        elif field_name == "department":
            old_value = emp.department or ""
        elif field_name == "state":
            old_value = emp.state or ""
        elif field_name == "country":
            old_value = emp.country or ""
        elif field_name == "bank_account":
            bank_info = (emp.bank_details or {}).get("onboarding", {}).get("draft", {}).get("bank", {})
            old_value = f"{bank_info.get('bankName', '')} - {bank_info.get('accountNumber', '')}"

        change_req = WorkforceEmployeeChangeRequest.objects.create(
            employee=emp,
            company=emp.company,
            field_name=field_name,
            field_label=field_label,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            status=WorkforceEmployeeChangeRequest.Status.PENDING,
        )

        return Response({
            "message": "Change Request submitted successfully for Workforce Admin review.",
            "change_request": WorkforceEmployeeChangeRequestSerializer(change_req).data,
        }, status=status.HTTP_201_CREATED)


class WorkforceAdminChangeRequestsListView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        status_filter = request.query_params.get("status", "").strip().upper()
        reqs = WorkforceEmployeeChangeRequest.objects.select_related("employee__user", "reviewed_by").order_by("-created_at")
        if status_filter:
            reqs = reqs.filter(status=status_filter)

        serializer = WorkforceEmployeeChangeRequestSerializer(reqs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkforceAdminChangeRequestDecideView(APIView):
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        change_req = WorkforceEmployeeChangeRequest.objects.select_related("employee__user").filter(pk=pk).first()
        if not change_req:
            return Response({"error": "Change Request not found."}, status=status.HTTP_404_NOT_FOUND)

        action = (request.data.get("action") or "").strip().upper()
        admin_notes = request.data.get("admin_notes", "").strip()

        if action not in ["APPROVE", "REJECT"]:
            return Response({"error": "action must be APPROVE or REJECT."}, status=status.HTTP_400_BAD_REQUEST)

        emp = change_req.employee
        user = emp.user

        if action == "APPROVE":
            change_req.status = WorkforceEmployeeChangeRequest.Status.APPROVED
            change_req.reviewed_by = request.user
            change_req.reviewed_at = timezone.now()
            change_req.admin_notes = admin_notes
            change_req.save()

            # Atomically update target PostgreSQL field
            field = change_req.field_name
            new_val = change_req.new_value

            if field == "first_name":
                user.first_name = new_val
                user.save()
            elif field == "last_name":
                user.last_name = new_val
                user.save()
            elif field in ["date_of_birth", "dob"]:
                emp.date_of_birth = new_val
                emp.save()
            elif field in ["phone", "mobile_number"]:
                user.mobile_number = new_val
                user.phone = new_val
                emp.phone = new_val
                user.save()
                emp.save()
            elif field == "department":
                emp.department = new_val
                emp.save()
            elif field == "state":
                emp.state = new_val
                emp.save()
            elif field == "country":
                emp.country = new_val
                emp.save()

            # Also update onboarding draft data for consistency
            bank_details = emp.bank_details or {}
            onboarding = bank_details.get("onboarding", {})
            draft = onboarding.get("draft", {})
            if "personal" in draft:
                if field == "first_name":
                    draft["personal"]["first_name"] = new_val
                elif field == "last_name":
                    draft["personal"]["last_name"] = new_val
                elif field in ["date_of_birth", "dob"]:
                    draft["personal"]["dob"] = new_val
            bank_details["onboarding"] = onboarding
            emp.bank_details = bank_details
            emp.save()

            return Response({
                "message": f"Change Request #{change_req.id} APPROVED and profile fields updated.",
                "status": "APPROVED",
                "change_request": WorkforceEmployeeChangeRequestSerializer(change_req).data,
            }, status=status.HTTP_200_OK)

        else:
            change_req.status = WorkforceEmployeeChangeRequest.Status.REJECTED
            change_req.reviewed_by = request.user
            change_req.reviewed_at = timezone.now()
            change_req.admin_notes = admin_notes or "Request does not meet operational verification standards."
            change_req.save()

            return Response({
                "message": f"Change Request #{change_req.id} REJECTED.",
                "status": "REJECTED",
                "change_request": WorkforceEmployeeChangeRequestSerializer(change_req).data,
            }, status=status.HTTP_200_OK)


# ─── 29. Account & Security ───────────────────────────────────────────────────

class WorkforceChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password", "").strip()
        new_password = request.data.get("new_password", "").strip()
        confirm_password = request.data.get("confirm_password", "").strip()

        if not current_password or not new_password:
            return Response({"error": "Current password and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"error": "Incorrect current password."}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({"error": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_password and new_password != confirm_password:
            return Response({"error": "New password and confirmation password do not match."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        # Log security event
        WorkforceEventLog.objects.create(
            event_type="PASSWORD_CHANGED",
            user=user,
            payload={"ip": request.META.get("REMOTE_ADDR", "")}
        )

        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)


class WorkforceChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password", "").strip()
        new_email = request.data.get("new_email", "").strip().lower()

        if not current_password or not new_email:
            return Response({"error": "Current password and new email are required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"error": "Incorrect password verification."}, status=status.HTTP_400_BAD_REQUEST)

        if "@" not in new_email or "." not in new_email:
            return Response({"error": "Invalid email address format."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return Response({"error": "An account with this email address already exists."}, status=status.HTTP_400_BAD_REQUEST)

        old_email = user.email
        user.email = new_email
        user.save()

        WorkforceEventLog.objects.create(
            event_type="EMAIL_CHANGED",
            user=user,
            payload={"old_email": old_email, "new_email": new_email}
        )

        return Response({
            "message": "Email address updated successfully.",
            "email": user.email,
        }, status=status.HTTP_200_OK)


class WorkforceTwoFactorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "two_fa_enabled": getattr(user, "two_fa_enabled", False),
            "phone_configured": bool(user.mobile_number or user.phone),
            "email": user.email,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        # Toggle 2FA status
        user.two_fa_enabled = not user.two_fa_enabled
        user.save()

        action = "enabled" if user.two_fa_enabled else "disabled"
        WorkforceEventLog.objects.create(
            event_type="TWO_FACTOR_TOGGLED",
            user=user,
            payload={"enabled": user.two_fa_enabled}
        )

        return Response({
            "message": f"Two-Factor Authentication {action} successfully.",
            "two_fa_enabled": user.two_fa_enabled,
        }, status=status.HTTP_200_OK)


class WorkforceActiveSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        user_agent = request.META.get("HTTP_USER_AGENT", "Web Browser")
        ip = request.META.get("REMOTE_ADDR", "127.0.0.1")

        # Construct authoritative active session representation
        current_session = {
            "id": f"sess-{user.id}-{int(time.time() // 86400)}",
            "device": "Current Web Session",
            "browser": user_agent[:60],
            "ip_address": ip,
            "is_current": True,
            "last_active": timezone.now().isoformat(),
            "status": "active",
        }

        return Response([current_session], status=status.HTTP_200_OK)


class WorkforceLoginHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)

        history = []
        try:
            if emp:
                presences = PresenceLog.objects.filter(employee=emp).order_by("-created_at")[:15]
                for p in presences:
                    history.append({
                        "id": f"pres-{p.id}",
                        "timestamp": p.created_at.isoformat() if p.created_at else timezone.now().isoformat(),
                        "event": "Presence Online" if p.is_online else f"Status: {p.availability}",
                        "ip": request.META.get("REMOTE_ADDR", "—"),
                        "status": "SUCCESS",
                    })
        except Exception:
            pass

        try:
            events = WorkforceEventLog.objects.filter(user=user).order_by("-created_at")[:10]
            for ev in events:
                history.append({
                    "id": f"ev-{ev.id}",
                    "timestamp": ev.created_at.isoformat() if ev.created_at else timezone.now().isoformat(),
                    "event": ev.event_type.replace("_", " ").title(),
                    "ip": (ev.payload or {}).get("ip", "—"),
                    "status": "RECORDED",
                })
        except Exception:
            pass

        # Sort combined history chronologically descending
        history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return Response(history[:20], status=status.HTTP_200_OK)



# ─── 30. Appearance & User Preferences ─────────────────────────────────────────

class WorkforceUserPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        pref, _ = WorkforceUserPreference.objects.get_or_create(
            user=user,
            defaults={"company": getattr(user, "company", None)}
        )
        serializer = WorkforceUserPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        pref, _ = WorkforceUserPreference.objects.get_or_create(
            user=user,
            defaults={"company": getattr(user, "company", None)}
        )
        serializer = WorkforceUserPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Preferences saved successfully.",
            "preferences": serializer.data,
        }, status=status.HTTP_200_OK)


# ─── 31. Notification Preferences ─────────────────────────────────────────────

class WorkforceNotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        pref, _ = WorkforceNotificationPreference.objects.get_or_create(
            user=user,
            defaults={"company": getattr(user, "company", None)}
        )
        serializer = WorkforceNotificationPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        pref, _ = WorkforceNotificationPreference.objects.get_or_create(
            user=user,
            defaults={"company": getattr(user, "company", None)}
        )

        data = request.data.copy()
        # If user enables SMS channel, verify mobile number is configured
        if data.get("channel_sms") is True and not (user.mobile_number or user.phone):
            return Response({
                "error": "Cannot enable SMS notifications: No registered mobile number found on your profile. Please add your mobile number first."
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = WorkforceNotificationPreferenceSerializer(pref, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Notification preferences saved successfully.",
            "preferences": serializer.data,
        }, status=status.HTTP_200_OK)


# ─── 32. Privacy & Data ───────────────────────────────────────────────────────

class WorkforcePrivacyExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found."}, status=status.HTTP_404_NOT_FOUND)

        # Collect complete dossier from PostgreSQL
        export_data = {
            "export_generated_at": timezone.now().isoformat(),
            "user_identity": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "mobile_number": user.mobile_number,
                "phone": user.phone,
                "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                "timezone": user.timezone,
                "language": user.language,
            },
            "employment_record": {
                "employee_id": emp.employee_id,
                "title": emp.title,
                "company": emp.company.company_name if emp.company else "CalServices",
                "hire_date": str(emp.hire_date) if emp.hire_date else None,
                "date_of_birth": str(emp.date_of_birth) if emp.date_of_birth else None,
                "exempt_status": emp.exempt_status,
                "department": emp.department,
                "hourly_rate": str(emp.hourly_rate),
            },
            "onboarding_dossier": (emp.bank_details or {}).get("onboarding", {}),
            "attendance_logs_count": TimeLog.objects.filter(employee=emp).count(),
            "leave_applications_count": (emp.bank_details or {}).get("leaves", []),
            "completed_jobs_count": ServiceRequest.objects.filter(assigned_employee=emp, status="completed").count(),
            "payslips_count": WorkforcePayslip.objects.filter(employee=emp).count(),
        }

        return Response(export_data, status=status.HTTP_200_OK)


class WorkforceAccountDeactivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get("password", "").strip()

        if not password or not user.check_password(password):
            return Response({"error": "Password verification failed. Please enter your correct password."}, status=status.HTTP_400_BAD_REQUEST)

        emp = getattr(user, "employee_profile", None)
        if emp:
            # Prevent deactivation if active field work exists
            active_jobs = ServiceRequest.objects.filter(
                assigned_employee=emp,
                status__in=["assigned", "accepted", "on_the_way", "in_progress"]
            ).exists()
            if active_jobs:
                return Response({
                    "error": "Cannot deactivate account while you have active jobs in progress. Please complete or unassign open service requests first."
                }, status=status.HTTP_400_BAD_REQUEST)

            emp.is_active = False
            emp.is_online = False
            emp.current_availability = "offline"
            emp.save()

        user.is_active = False
        user.save()

        WorkforceEventLog.objects.create(
            event_type="ACCOUNT_DEACTIVATED",
            user=user,
            payload={"reason": request.data.get("reason", "Employee self-deactivation request")}
        )

        return Response({
            "message": "Your Workforce account has been safely deactivated in accordance with platform retention rules."
        }, status=status.HTTP_200_OK)


# ─── 33. My Feedback & Performance ─────────────────────────────────────────────

class WorkforcePerformanceMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Authoritative Job Metrics
        all_assigned_jobs = ServiceRequest.objects.filter(assigned_employee=emp)
        total_assigned_count = all_assigned_jobs.count()
        completed_jobs = all_assigned_jobs.filter(status="completed")
        completed_count = completed_jobs.count()

        completion_rate = round((completed_count / total_assigned_count * 100), 1) if total_assigned_count > 0 else 0.0

        # 2. Customer Ratings & Reviews from PostgreSQL
        feedbacks = WorkforceJobFeedback.objects.filter(employee=emp).select_related("job").order_by("-created_at")
        feedback_list = WorkforceJobFeedbackSerializer(feedbacks, many=True).data

        rating_counts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        total_rating_sum = 0
        csat_eligible_count = 0

        for fb in feedbacks:
            r = max(1, min(5, fb.rating))
            rating_counts[r] += 1
            total_rating_sum += r
            if r >= 4:
                csat_eligible_count += 1

        total_feedbacks = feedbacks.count()
        average_rating = round(total_rating_sum / total_feedbacks, 1) if total_feedbacks > 0 else 0.0
        csat_score = round((csat_eligible_count / total_feedbacks * 100), 1) if total_feedbacks > 0 else 0.0

        # Ontime resolution rate
        ontime_count = feedbacks.filter(resolution_ontime=True).count()
        resolution_rate = round((ontime_count / total_feedbacks * 100), 1) if total_feedbacks > 0 else (100.0 if completed_count > 0 else 0.0)

        return Response({
            "metrics": {
                "jobs_completed": completed_count,
                "total_jobs_assigned": total_assigned_count,
                "completion_rate": completion_rate,
                "average_rating": average_rating,
                "csat_score": csat_score,
                "work_orders_completed": completed_count,
                "feedback_submissions_count": total_feedbacks,
                "average_customer_rating": average_rating,
                "feedback_received_count": total_feedbacks,
                "issue_resolution_rate": resolution_rate,
            },
            "rating_distribution": rating_counts,
            "feedbacks": feedback_list,
            "has_data": completed_count > 0 or total_feedbacks > 0,
        }, status=status.HTTP_200_OK)


# ─── 34. Employee Services Self-Service ───────────────────────────────────────

class WorkforceMyServicesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"error": "No employee profile found."}, status=status.HTTP_404_NOT_FOUND)

        bank_details = emp.bank_details or {}
        onboarding = bank_details.get("onboarding", {})
        services = onboarding.get("services", [])

        approved = [s for s in services if s.get("status") == "approved"]
        pending = [s for s in services if s.get("status") == "pending"]
        rejected = [s for s in services if s.get("status") == "rejected"]

        return Response({
            "all_services": services,
            "approved_services": approved,
            "pending_services": pending,
            "rejected_services": rejected,
        }, status=status.HTTP_200_OK)


class WorkforceJobFeedbackSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id=None):
        target_job_id = job_id or request.data.get("job_id") or request.data.get("job")
        if not target_job_id:
            return Response({"error": "job_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        job = ServiceRequest.objects.filter(pk=target_job_id).first()
        if not job:
            return Response({"error": "ServiceRequest not found."}, status=status.HTTP_404_NOT_FOUND)

        if not job.assigned_employee:
            return Response({"error": "ServiceRequest has no assigned employee."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rating = int(request.data.get("rating", 5))
        except (ValueError, TypeError):
            rating = 5
        rating = max(1, min(5, rating))

        review = str(request.data.get("review", "")).strip()

        try:
            csat_score = int(request.data.get("csat_score", rating))
        except (ValueError, TypeError):
            csat_score = rating
        csat_score = max(1, min(5, csat_score))

        resolution_ontime = bool(request.data.get("resolution_ontime", True))
        customer_name = request.data.get("customer_name") or request.user.get_full_name() or request.user.username

        feedback, created = WorkforceJobFeedback.objects.update_or_create(
            job=job,
            defaults={
                "employee": job.assigned_employee,
                "customer": request.user if request.user.is_authenticated else None,
                "rating": rating,
                "review": review,
                "csat_score": csat_score,
                "resolution_ontime": resolution_ontime,
                "customer_name": customer_name,
            }
        )

        return Response({
            "message": "Feedback submitted successfully.",
            "feedback": WorkforceJobFeedbackSerializer(feedback).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# ─── Location: Employee Saved Locations ───────────────────────────────────────

class WorkforceEmployeeSavedLocationsView(APIView):
    """
    GET  /workforce/locations/saved/    — list employee's own saved locations
    POST /workforce/locations/saved/    — create a new saved location

    Identity is resolved from request.user only. Frontend-supplied employee IDs
    are never trusted.
    """
    permission_classes = [IsApprovedTechnician]

    def _get_employee(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp or not emp.is_active:
            return None
        return emp

    def get(self, request):
        from .models import EmployeeSavedLocation
        from .serializers import EmployeeSavedLocationSerializer
        emp = self._get_employee(request)
        if not emp:
            return Response(
                {"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"},
                status=status.HTTP_403_FORBIDDEN,
            )
        locations = EmployeeSavedLocation.objects.filter(employee=emp)
        data = EmployeeSavedLocationSerializer(locations, many=True).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        from .models import EmployeeSavedLocation
        from .serializers import EmployeeSavedLocationSerializer
        emp = self._get_employee(request)
        if not emp:
            return Response(
                {"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = EmployeeSavedLocationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid data.", "details": serializer.errors, "code": "VALIDATION_ERROR"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If this is set as default, clear previous defaults for this employee
        if serializer.validated_data.get("is_default"):
            EmployeeSavedLocation.objects.filter(employee=emp, is_default=True).update(is_default=False)

        loc = serializer.save(employee=emp)
        return Response(EmployeeSavedLocationSerializer(loc).data, status=status.HTTP_201_CREATED)


class WorkforceEmployeeSavedLocationDetailView(APIView):
    """
    GET    /workforce/locations/saved/<pk>/  — retrieve
    PUT    /workforce/locations/saved/<pk>/  — full update
    PATCH  /workforce/locations/saved/<pk>/  — partial update
    DELETE /workforce/locations/saved/<pk>/  — delete

    The employee may only access their own records (tenant + ownership enforced).
    """
    permission_classes = [IsApprovedTechnician]

    def _get_location(self, request, pk):
        from .models import EmployeeSavedLocation
        emp = getattr(request.user, "employee_profile", None)
        if not emp or not emp.is_active:
            return None, Response(
                {"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            loc = EmployeeSavedLocation.objects.get(pk=pk, employee=emp)
            return loc, None
        except EmployeeSavedLocation.DoesNotExist:
            return None, Response(
                {"error": "Location not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, pk):
        from .serializers import EmployeeSavedLocationSerializer
        loc, err = self._get_location(request, pk)
        if err:
            return err
        return Response(EmployeeSavedLocationSerializer(loc).data)

    def put(self, request, pk):
        from .models import EmployeeSavedLocation
        from .serializers import EmployeeSavedLocationSerializer
        loc, err = self._get_location(request, pk)
        if err:
            return err
        serializer = EmployeeSavedLocationSerializer(loc, data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid data.", "details": serializer.errors, "code": "VALIDATION_ERROR"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        emp = loc.employee
        if serializer.validated_data.get("is_default"):
            EmployeeSavedLocation.objects.filter(employee=emp, is_default=True).exclude(pk=pk).update(is_default=False)
        updated = serializer.save()
        return Response(EmployeeSavedLocationSerializer(updated).data)

    def patch(self, request, pk):
        from .models import EmployeeSavedLocation
        from .serializers import EmployeeSavedLocationSerializer
        loc, err = self._get_location(request, pk)
        if err:
            return err
        serializer = EmployeeSavedLocationSerializer(loc, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid data.", "details": serializer.errors, "code": "VALIDATION_ERROR"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        emp = loc.employee
        if serializer.validated_data.get("is_default"):
            EmployeeSavedLocation.objects.filter(employee=emp, is_default=True).exclude(pk=pk).update(is_default=False)
        updated = serializer.save()
        return Response(EmployeeSavedLocationSerializer(updated).data)

    def delete(self, request, pk):
        loc, err = self._get_location(request, pk)
        if err:
            return err
        loc.delete()
        return Response({"message": "Location deleted."}, status=status.HTTP_204_NO_CONTENT)


# ─── Location: Admin Authorized Location Activate/Deactivate ─────────────────

class WorkforceAdminLocationToggleView(APIView):
    """
    PATCH /workforce/admin/locations/<pk>/toggle/
    Admin-only. Toggles is_active on a company Location record.
    Employees cannot call this endpoint.
    """
    permission_classes = [IsWorkforceAdmin]

    def patch(self, request, pk):
        from time_tracking.models import Location
        user = request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        if not company:
            return Response(
                {"error": "Company context required.", "code": "NO_COMPANY"},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            loc = Location.objects.get(pk=pk, company=company)
        except Location.DoesNotExist:
            return Response(
                {"error": "Location not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )
        is_active = request.data.get("is_active")
        if is_active is None:
            loc.is_active = not loc.is_active
        else:
            loc.is_active = bool(is_active)
        loc.save(update_fields=["is_active", "updated_at"])
        from time_tracking.serializers import LocationSerializer
        return Response(LocationSerializer(loc).data)


class WorkforceAdminLocationAssignEmployeeView(APIView):
    """
    POST   /workforce/admin/locations/<pk>/assign/   — assign employee to location
    DELETE /workforce/admin/locations/<pk>/assign/   — remove employee from location

    Uses existing EmployeeLocation model. Admin-only.
    """
    permission_classes = [IsWorkforceAdmin]

    def _get_location(self, request, pk):
        from time_tracking.models import Location
        user = request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        if not company:
            return None, Response(
                {"error": "Company context required.", "code": "NO_COMPANY"},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            return Location.objects.get(pk=pk, company=company), None
        except Location.DoesNotExist:
            return None, Response(
                {"error": "Location not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def post(self, request, pk):
        from time_tracking.models import EmployeeLocation
        loc, err = self._get_location(request, pk)
        if err:
            return err
        employee_id = request.data.get("employee_id")
        if not employee_id:
            return Response(
                {"error": "employee_id is required.", "code": "MISSING_EMPLOYEE"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_emp = Employee.objects.get(pk=employee_id, company=loc.company)
        except Employee.DoesNotExist:
            return Response(
                {"error": "Employee not found in this company.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )
        is_primary = bool(request.data.get("is_primary", False))
        emp_loc, created = EmployeeLocation.objects.get_or_create(
            employee=target_emp,
            location=loc,
            defaults={"is_primary": is_primary},
        )
        if not created and emp_loc.is_primary != is_primary:
            emp_loc.is_primary = is_primary
            emp_loc.save(update_fields=["is_primary"])
        return Response(
            {"message": "Employee assigned to location.", "is_primary": emp_loc.is_primary},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        from time_tracking.models import EmployeeLocation
        loc, err = self._get_location(request, pk)
        if err:
            return err
        employee_id = request.data.get("employee_id")
        if not employee_id:
            return Response(
                {"error": "employee_id is required.", "code": "MISSING_EMPLOYEE"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = EmployeeLocation.objects.filter(
            employee_id=employee_id,
            location=loc,
        ).delete()
        if not deleted:
            return Response(
                {"error": "Assignment not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"message": "Employee removed from location."}, status=status.HTTP_200_OK)





