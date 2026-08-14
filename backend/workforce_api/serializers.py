"""
workforce-app/backend/workforce_api/serializers.py
DRF serializers for Workforce Signup, Onboarding Wizard, Verification Dossier, and Jobs.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from employees.models import Employee
from service_requests.models import ServiceRequest

User = get_user_model()


class WorkforceSignupSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    mobile_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_mobile_number(self, value):
        cleaned = value.strip().replace(" ", "").replace("-", "")
        if User.objects.filter(mobile_number=cleaned).exists():
            raise serializers.ValidationError("An account with this mobile number already exists.")
        return cleaned


class WorkforceOnboardingDraftSerializer(serializers.Serializer):
    step = serializers.IntegerField(min_value=1, max_value=7, required=False)
    draft_data = serializers.DictField(required=True)


class WorkforceEmployeeProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    mobile_number = serializers.CharField(source="user.mobile_number", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    bio = serializers.CharField(source="user.bio", read_only=True)
    timezone = serializers.CharField(source="user.timezone", read_only=True)
    language = serializers.CharField(source="user.language", read_only=True)
    two_fa_enabled = serializers.BooleanField(source="user.two_fa_enabled", read_only=True)
    avatar = serializers.SerializerMethodField()
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    registration_status = serializers.SerializerMethodField()
    live_availability = serializers.CharField(source="current_availability", read_only=True)
    onboarding_data = serializers.SerializerMethodField()
    approved_services = serializers.SerializerMethodField()
    all_requested_services = serializers.SerializerMethodField()
    documents_status = serializers.SerializerMethodField()
    controlled_fields = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "user_id",
            "employee_id",
            "username",
            "first_name",
            "last_name",
            "email",
            "mobile_number",
            "phone",
            "bio",
            "timezone",
            "language",
            "avatar",
            "two_fa_enabled",
            "company_id",
            "company_name",
            "title",
            "country",
            "state",
            "department",
            "hourly_rate",
            "hire_date",
            "date_of_birth",
            "is_online",
            "live_availability",
            "registration_status",
            "onboarding_data",
            "approved_services",
            "all_requested_services",
            "documents_status",
            "controlled_fields",
            "is_active",
        ]

    def get_avatar(self, obj):
        if obj.user and obj.user.avatar:
            try:
                return obj.user.avatar.url
            except Exception:
                return str(obj.user.avatar)
        return ""

    def get_onboarding_data(self, obj):
        return (obj.bank_details or {}).get("onboarding", {
            "status": "not_started",
            "step": 1,
            "draft": {},
            "services": [],
            "documents": {},
            "correction_notes": "",
            "rejection_reason": "",
        })

    def get_registration_status(self, obj):
        ob = (obj.bank_details or {}).get("onboarding", {})
        return ob.get("status", "not_started")

    def get_approved_services(self, obj):
        ob = (obj.bank_details or {}).get("onboarding", {})
        services = ob.get("services", [])
        return [s for s in services if s.get("status") == "approved"]

    def get_all_requested_services(self, obj):
        ob = (obj.bank_details or {}).get("onboarding", {})
        return ob.get("services", [])

    def get_documents_status(self, obj):
        ob = (obj.bank_details or {}).get("onboarding", {})
        return ob.get("documents", {})

    def get_controlled_fields(self, obj):
        # Fields that are locked once registration is submitted/approved
        reg_status = self.get_registration_status(obj)
        is_locked = reg_status in ["submitted", "under_review", "approved"]
        return {
            "is_locked": is_locked,
            "locked_fields": [
                "first_name",
                "last_name",
                "date_of_birth",
                "mobile_number",
                "employee_id",
                "country",
                "state",
                "department",
                "hourly_rate",
                "bank_account",
                "identity_documents",
            ] if is_locked else [],
        }



class WorkforceWorkExtensionSerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()
    technician_id = serializers.CharField(source="technician.employee_id", read_only=True)
    required_skill_name = serializers.CharField(source="required_skill.name", read_only=True)
    admin_reviewer_name = serializers.SerializerMethodField()
    specialist_technician_name = serializers.SerializerMethodField()

    class Meta:
        from .models import WorkforceWorkExtension
        model = WorkforceWorkExtension
        fields = [
            "id",
            "job",
            "technician",
            "technician_id",
            "technician_name",
            "company",
            "title",
            "description",
            "reason",
            "estimated_labor_cost",
            "estimated_materials_cost",
            "requested_amount",
            "approved_amount",
            "final_customer_amount",
            "requires_specialist",
            "required_skill",
            "required_skill_name",
            "specialist_technician",
            "specialist_technician_name",
            "specialist_job",
            "is_critical",
            "decision_token",
            "decision_expires_at",
            "supporting_notes",
            "supporting_photo",
            "status",
            "admin_reviewed_by",
            "admin_reviewer_name",
            "admin_review_reason",
            "admin_reviewed_at",
            "customer_decided_at",
            "customer_decline_reason",
            "completed_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "technician", "company", "approved_amount", "final_customer_amount",
            "status", "decision_token", "decision_expires_at", "admin_reviewed_by",
            "admin_reviewed_at", "customer_decided_at", "completed_at", "resolved_at",
            "created_at", "updated_at",
        ]

    def get_technician_name(self, obj):
        if obj.technician and obj.technician.user:
            return obj.technician.user.get_full_name() or obj.technician.user.username
        return "Technician"

    def get_admin_reviewer_name(self, obj):
        if obj.admin_reviewed_by:
            return obj.admin_reviewed_by.get_full_name() or obj.admin_reviewed_by.username
        return None

    def get_specialist_technician_name(self, obj):
        if obj.specialist_technician and obj.specialist_technician.user:
            return obj.specialist_technician.user.get_full_name() or obj.specialist_technician.user.username
        return None


class CustomerWorkforceExtensionSerializer(serializers.ModelSerializer):
    """
    Sanitized, customer-facing serialization for Additional Work decisions.
    Hides internal technician labor margins, notes, and staff details.
    """
    extension_id = serializers.IntegerField(source="id", read_only=True)
    job_id = serializers.IntegerField(source="job.id", read_only=True)
    request_id = serializers.CharField(source="job.request_id", read_only=True)
    original_service = serializers.SerializerMethodField()
    admin_approved_amount = serializers.DecimalField(source="approved_amount", max_digits=10, decimal_places=2, read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        from .models import WorkforceWorkExtension
        model = WorkforceWorkExtension
        fields = [
            "extension_id",
            "job_id",
            "request_id",
            "original_service",
            "title",
            "description",
            "reason",
            "estimated_labor_cost",
            "estimated_materials_cost",
            "requested_amount",
            "admin_approved_amount",
            "final_customer_amount",
            "is_critical",
            "requires_specialist",
            "status",
            "decision_expires_at",
            "is_expired",
            "customer_decided_at",
            "customer_decline_reason",
            "created_at",
        ]

    def get_original_service(self, obj):
        return obj.job.issue_title or obj.job.service_category if obj.job else "Service"

    def get_is_expired(self, obj):
        from django.utils import timezone
        if not obj.decision_expires_at:
            return False
        return timezone.now() > obj.decision_expires_at


class WorkforceSupplementalInvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()

    class Meta:
        from .models import WorkforceSupplementalInvoice
        model = WorkforceSupplementalInvoice
        fields = [
            "id",
            "invoice_number",
            "job",
            "extension",
            "customer",
            "customer_name",
            "company",
            "amount",
            "actual_cost",
            "status",
            "payment_method",
            "transaction_id",
            "paid_at",
            "metadata",
            "audit_trail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "invoice_number", "created_at", "updated_at"]

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.username
        return "Customer"


class WorkforceJobRescheduleSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import WorkforceJobReschedule
        model = WorkforceJobReschedule
        fields = [
            "id",
            "job",
            "delay_count",
            "delay_type",
            "original_date",
            "rescheduled_date",
            "reason",
            "customer_notified",
            "escalated_to_support",
            "escalation_notes",
            "customer_response",
            "customer_notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class WorkforceJobSerializer(serializers.ModelSerializer):
    customer_display_name = serializers.SerializerMethodField()
    service_title = serializers.SerializerMethodField()
    active_offer = serializers.SerializerMethodField()
    extensions = serializers.SerializerMethodField()
    active_extension = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "request_id",
            "customer_name",
            "phone",
            "email",
            "service_category",
            "issue_title",
            "service_title",
            "description",
            "cart_data",
            "status",
            "priority",
            "address",
            "latitude",
            "longitude",
            "preferred_date",
            "preferred_time",
            "total_amount",
            "payment_status",
            "payment_method",
            "customer_display_name",
            "active_offer",
            "extensions",
            "active_extension",
            "created_at",
            "updated_at",
        ]

    def get_customer_display_name(self, obj):
        if obj.customer_name:
            return obj.customer_name
        if obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.username
        return "Valued Customer"

    def get_service_title(self, obj):
        return obj.issue_title or obj.service_category

    def get_active_offer(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return None
        from .models import WorkforceJobOffer
        from django.utils import timezone
        offer = WorkforceJobOffer.objects.filter(job=obj, employee=emp, status="OFFERED").first()
        if not offer:
            return None
        is_expired = offer.expires_at < timezone.now()
        return {
            "id": offer.id,
            "status": "EXPIRED" if is_expired else offer.status,
            "offered_at": offer.offered_at.isoformat(),
            "expires_at": offer.expires_at.isoformat(),
            "is_expired": is_expired,
        }

    def get_extensions(self, obj):
        from .models import WorkforceWorkExtension
        exts = WorkforceWorkExtension.objects.filter(job=obj).order_by("-created_at")
        return WorkforceWorkExtensionSerializer(exts, many=True).data

    def get_active_extension(self, obj):
        from .models import WorkforceWorkExtension
        active = WorkforceWorkExtension.objects.filter(
            job=obj,
            status__in=["REQUESTED", "ADMIN_APPROVED", "CUSTOMER_ACCEPTED", "IN_PROGRESS"]
        ).first()
        if active:
            return WorkforceWorkExtensionSerializer(active).data
        return None


class WorkforceEmployeeChangeRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        from .models import WorkforceEmployeeChangeRequest
        model = WorkforceEmployeeChangeRequest
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "field_name",
            "field_label",
            "old_value",
            "new_value",
            "reason",
            "status",
            "admin_notes",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "status",
            "admin_notes",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name()
        return "Technician"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return ""


class WorkforceUserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import WorkforceUserPreference
        model = WorkforceUserPreference
        fields = [
            "id",
            "theme",
            "accent_color",
            "layout_density",
            "font_size",
            "high_contrast",
            "reduced_motion",
            "updated_at",
        ]


class WorkforceNotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import WorkforceNotificationPreference
        model = WorkforceNotificationPreference
        fields = [
            "id",
            "security_alerts",
            "login_alerts",
            "leave_updates",
            "job_assignments",
            "shift_reminders",
            "payroll_notifications",
            "weekly_digest",
            "product_updates",
            "workspace_announcements",
            "channel_email",
            "channel_in_app",
            "channel_sms",
            "updated_at",
        ]


class WorkforceJobFeedbackSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="job.issue_title", read_only=True)
    request_id = serializers.CharField(source="job.request_id", read_only=True)

    class Meta:
        from .models import WorkforceJobFeedback
        model = WorkforceJobFeedback
        fields = [
            "id",
            "job",
            "request_id",
            "service_title",
            "rating",
            "review",
            "csat_score",
            "resolution_ontime",
            "customer_name",
            "created_at",
        ]


class EmployeeSavedLocationSerializer(serializers.ModelSerializer):
    """Serializer for employee-owned personal saved locations."""
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate_latitude(self, value):
        from decimal import Decimal
        try:
            val = float(value)
            if not (-90.0 <= val <= 90.0):
                raise serializers.ValidationError("Latitude must be between -90 and 90.")
            return Decimal(str(round(val, 7)))
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid latitude.")

    def validate_longitude(self, value):
        from decimal import Decimal
        try:
            val = float(value)
            if not (-180.0 <= val <= 180.0):
                raise serializers.ValidationError("Longitude must be between -180 and 180.")
            return Decimal(str(round(val, 7)))
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid longitude.")

    class Meta:
        from .models import EmployeeSavedLocation
        model = EmployeeSavedLocation
        fields = [
            "id",
            "label",
            "name",
            "address",
            "locality",
            "city",
            "state",
            "pincode",
            "landmark",
            "latitude",
            "longitude",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]



