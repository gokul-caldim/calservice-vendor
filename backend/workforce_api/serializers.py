"""
workforce-app/backend/workforce_api/serializers.py
DRF serializers for Workforce Signup, Onboarding Wizard, Verification Dossier, and Jobs.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.services.registration import (
    get_employee_registration_status,
    get_employee_onboarding_dict,
    REGISTRATION_STATUS_NOT_STARTED,
)

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
        return get_employee_onboarding_dict(obj)

    def get_registration_status(self, obj):
        return get_employee_registration_status(obj)

    def get_approved_services(self, obj):
        ob = get_employee_onboarding_dict(obj)
        services = ob.get("services", [])
        return [s for s in services if s.get("status") == "approved"]

    def get_all_requested_services(self, obj):
        ob = get_employee_onboarding_dict(obj)
        return ob.get("services", [])

    def get_documents_status(self, obj):
        ob = (obj.bank_details or {}).get("onboarding", {})
        docs_dict = dict(ob.get("documents", {}))

        # Include relational WorkforceEmployeeDocument models if present
        try:
            from workforce_api.models import WorkforceEmployeeDocument
            emp_docs = WorkforceEmployeeDocument.objects.filter(employee=obj).select_related("requirement")
            for ed in emp_docs:
                cat = ed.requirement.category or ed.requirement.title.lower().replace(" ", "_")
                existing = docs_dict.get(cat, {})
                docs_dict[cat] = {
                    "category": cat,
                    "title": ed.requirement.title or existing.get("title", cat.replace("_", " ").title()),
                    "document_number": ed.document_number or existing.get("document_number", ""),
                    "file_url": ed.file_url or existing.get("file_url", ""),
                    "status": ed.status.lower() if ed.status else existing.get("status", "approved"),
                    "issue_date": str(ed.issue_date) if ed.issue_date else existing.get("issue_date"),
                    "expiry_date": str(ed.expiry_date) if ed.expiry_date else existing.get("expiry_date"),
                    "uploaded_at": ed.created_at.isoformat() if ed.created_at else existing.get("uploaded_at"),
                    "rejection_reason": ed.rejection_reason or existing.get("rejection_reason", ""),
                }
        except Exception:
            pass

        return docs_dict

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


class JobPaymentSerializer(serializers.ModelSerializer):
    """
    Public/Employee-safe payment details serializer.
    NEVER exposes payment_confirmation_otp_hash, otp_attempts, or internal secrets.
    """
    class Meta:
        from .models import JobPayment
        model = JobPayment
        fields = [
            "id",
            "job",
            "payment_method",
            "payment_status",
            "amount_due",
            "amount_paid",
            "amount_received",
            "change_returned",
            "currency",
            "gateway_transaction_id",
            "cash_collected_at",
            "customer_confirmed_at",
            "customer_confirmation_method",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PaymentCollectionEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        from .models import PaymentCollectionEvent
        model = PaymentCollectionEvent
        fields = [
            "id",
            "job_payment",
            "event_type",
            "amount",
            "metadata",
            "actor_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_user:
            return obj.actor_user.get_full_name() or obj.actor_user.username
        return "System"


class WorkforceJobSerializer(serializers.ModelSerializer):
    customer_display_name = serializers.SerializerMethodField()
    service_title = serializers.SerializerMethodField()
    active_offer = serializers.SerializerMethodField()
    extensions = serializers.SerializerMethodField()
    active_extension = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    cancellation_info = serializers.SerializerMethodField()
    job_status = serializers.SerializerMethodField()
    offer_status = serializers.SerializerMethodField()
    is_offer = serializers.SerializerMethodField()
    is_accepted_by_current_employee = serializers.SerializerMethodField()
    is_assigned_to_current_employee = serializers.SerializerMethodField()
    accepted_at = serializers.SerializerMethodField()
    cancellation_deadline = serializers.SerializerMethodField()
    offer_expires_at = serializers.SerializerMethodField()
    server_time = serializers.SerializerMethodField()
    offer_id = serializers.SerializerMethodField()
    offered_at = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    wave_id = serializers.SerializerMethodField()
    wave_number = serializers.SerializerMethodField()

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
            "distance_km",
            "preferred_date",
            "preferred_time",
            "total_amount",
            "payment_status",
            "payment_method",
            "payment",
            "customer_display_name",
            "active_offer",
            "cancellation_info",
            "extensions",
            "active_extension",
            "created_at",
            "updated_at",
            # Authoritative fields
            "job_status",
            "offer_status",
            "is_offer",
            "is_accepted_by_current_employee",
            "is_assigned_to_current_employee",
            "accepted_at",
            "cancellation_deadline",
            "offer_expires_at",
            "server_time",
            "offer_id",
            "offered_at",
            "wave_id",
            "wave_number",
            "can_cancel",
        ]

    def _get_context_emp(self):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        return getattr(request.user, "employee_profile", None)

    def _get_emp_offer(self, obj, emp):
        if not emp:
            return None
        emp_offers_map = self.context.get("emp_offers_map")
        if emp_offers_map is not None:
            return emp_offers_map.get(obj.id)
        from .models import WorkforceJobOffer
        return WorkforceJobOffer.objects.filter(job=obj, employee=emp).order_by("-offered_at").first()

    def get_job_status(self, obj):
        return obj.status

    def get_is_accepted_by_current_employee(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return False
        from workforce_api.services.workload import ACTIVE_WORKLOAD_STATUSES
        is_assigned = (obj.assigned_employee_id == emp.id)
        is_active = str(obj.status).lower() in ACTIVE_WORKLOAD_STATUSES
        return bool(is_assigned and is_active)

    def get_is_assigned_to_current_employee(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return False
        return bool(obj.assigned_employee_id == emp.id)

    def get_is_offer(self, obj):
        if self.get_is_accepted_by_current_employee(obj) or self.get_is_assigned_to_current_employee(obj):
            return False
        emp = self._get_context_emp()
        if not emp:
            return False
        offer = self._get_emp_offer(obj, emp)
        from django.utils import timezone
        if offer and offer.status == "OFFERED" and offer.expires_at > timezone.now():
            return True
        return False

    def get_offer_status(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return None
        if self.get_is_accepted_by_current_employee(obj):
            return "ACCEPTED"
        offer = self._get_emp_offer(obj, emp)
        if not offer:
            return None
        from django.utils import timezone
        if offer.status == "OFFERED" and offer.expires_at <= timezone.now():
            return "EXPIRED"
        return offer.status

    def get_offer_expires_at(self, obj):
        if not self.get_is_offer(obj):
            return None
        emp = self._get_context_emp()
        offer = self._get_emp_offer(obj, emp)
        from django.utils import timezone
        if offer and offer.status == "OFFERED" and offer.expires_at > timezone.now():
            return offer.expires_at.isoformat()
        return None

    def get_accepted_at(self, obj):
        if not self.get_is_accepted_by_current_employee(obj):
            return None
        emp = self._get_context_emp()
        lifecycle_events_map = self.context.get("lifecycle_events_map")
        if lifecycle_events_map is not None:
            accept_event = lifecycle_events_map.get(obj.id)
        else:
            from .models import WorkforceJobLifecycleEvent
            accept_event = WorkforceJobLifecycleEvent.objects.filter(
                job=obj,
                employee=emp,
                event_type=WorkforceJobLifecycleEvent.EventType.EMPLOYEE_JOB_ACCEPTED,
            ).order_by("-created_at").first()
        if accept_event and accept_event.accepted_at:
            return accept_event.accepted_at.isoformat()
        return (obj.updated_at or obj.created_at).isoformat() if (obj.updated_at or obj.created_at) else None

    def get_cancellation_deadline(self, obj):
        return None

    def get_distance_km(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        last_loc = getattr(request.user, "last_known_location", None) or {}
        emp_lat = last_loc.get("latitude") if last_loc.get("latitude") is not None else last_loc.get("lat")
        emp_lon = last_loc.get("longitude") if last_loc.get("longitude") is not None else (last_loc.get("lng") or last_loc.get("lon"))
        if emp_lat is None or emp_lon is None or obj.latitude is None or obj.longitude is None:
            return None
        try:
            from workforce_api.services.geo_spatial import calculate_distance_km
            return calculate_distance_km(float(emp_lat), float(emp_lon), float(obj.latitude), float(obj.longitude))
        except Exception:
            return None

    def get_customer_display_name(self, obj):
        if obj.customer_name:
            return obj.customer_name
        if obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.username
        return "Valued Customer"

    def get_service_title(self, obj):
        return obj.issue_title or obj.service_category

    def get_server_time(self, obj):
        from django.utils import timezone
        return timezone.now().isoformat()

    def get_offer_id(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return None
        offer = self._get_emp_offer(obj, emp)
        return offer.id if offer else None

    def get_wave_id(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return None
        offer = self._get_emp_offer(obj, emp)
        return str(offer.wave_id) if (offer and getattr(offer, "wave_id", None)) else None

    def get_wave_number(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return None
        offer = self._get_emp_offer(obj, emp)
        return getattr(offer, "wave_number", None) if offer else None

    def get_offered_at(self, obj):
        emp = self._get_context_emp()
        if not emp:
            return None
        offer = self._get_emp_offer(obj, emp)
        return offer.offered_at.isoformat() if offer and offer.offered_at else None

    def get_can_cancel(self, obj):
        emp = self._get_context_emp()
        if not emp or obj.assigned_employee_id != emp.id:
            return False
        if obj.status not in ["accepted", "on_the_way", "en_route", "arrived"]:
            return False
        from .models import PreServiceVerification
        verification = getattr(obj, "pre_service_verification", None)
        if not verification:
            verification = PreServiceVerification.objects.filter(job=obj).first()
        if verification and verification.otp_verified:
            return False
        return True

    def get_active_offer(self, obj):
        if self.get_is_accepted_by_current_employee(obj):
            return None
        emp = self._get_context_emp()
        if not emp:
            return None
        active_offers_map = self.context.get("active_offers_map")
        if active_offers_map is not None:
            offer = active_offers_map.get(obj.id)
        else:
            from .models import WorkforceJobOffer
            from django.utils import timezone
            offer = WorkforceJobOffer.objects.filter(job=obj, employee=emp, status="OFFERED").first()
            if offer and offer.expires_at <= timezone.now():
                offer = None
        if not offer:
            return None
        from django.utils import timezone
        return {
            "id": offer.id,
            "job_id": offer.job_id,
            "employee_id": offer.employee_id,
            "status": "OFFERED",
            "wave_id": str(offer.wave_id) if getattr(offer, "wave_id", None) else "",
            "wave_number": getattr(offer, "wave_number", 1),
            "offered_at": offer.offered_at.isoformat() if offer.offered_at else "",
            "expires_at": offer.expires_at.isoformat() if offer.expires_at else "",
            "server_time": timezone.now().isoformat(),
            "is_expired": False,
        }

    def get_extensions(self, obj):
        extensions_map = self.context.get("extensions_map")
        if extensions_map is not None:
            exts = extensions_map.get(obj.id, [])
            return [
                {
                    "id": ext.id,
                    "job": ext.job_id,
                    "technician": ext.technician_id,
                    "technician_id": getattr(ext.technician, "employee_id", str(ext.technician_id)),
                    "technician_name": (f"{ext.technician.user.first_name} {ext.technician.user.last_name}".strip() or ext.technician.user.username) if ext.technician and ext.technician.user else "Technician",
                    "company": ext.company_id,
                    "title": ext.title,
                    "description": ext.description,
                    "reason": ext.reason,
                    "estimated_labor_cost": str(ext.estimated_labor_cost or "0.00"),
                    "estimated_materials_cost": str(ext.estimated_materials_cost or "0.00"),
                    "total_extension_cost": str(getattr(ext, "requested_amount", None) or getattr(ext, "approved_amount", None) or ((ext.estimated_labor_cost or 0) + (ext.estimated_materials_cost or 0)) or "0.00"),
                    "status": ext.status,
                    "requires_specialist": ext.requires_specialist,
                    "is_critical": ext.is_critical,
                    "created_at": ext.created_at.isoformat() if ext.created_at else None,
                }
                for ext in exts
            ]
        from .models import WorkforceWorkExtension
        exts = WorkforceWorkExtension.objects.filter(job=obj).order_by("-created_at")
        return WorkforceWorkExtensionSerializer(exts, many=True).data

    def get_active_extension(self, obj):
        active_extensions_map = self.context.get("active_extensions_map")
        if active_extensions_map is not None:
            active = active_extensions_map.get(obj.id)
            if active:
                return {
                    "id": active.id,
                    "job": active.job_id,
                    "technician": active.technician_id,
                    "technician_id": getattr(active.technician, "employee_id", str(active.technician_id)),
                    "technician_name": (f"{active.technician.user.first_name} {active.technician.user.last_name}".strip() or active.technician.user.username) if active.technician and active.technician.user else "Technician",
                    "company": active.company_id,
                    "title": active.title,
                    "description": active.description,
                    "reason": active.reason,
                    "estimated_labor_cost": str(active.estimated_labor_cost or "0.00"),
                    "estimated_materials_cost": str(active.estimated_materials_cost or "0.00"),
                    "total_extension_cost": str(getattr(active, "requested_amount", None) or getattr(active, "approved_amount", None) or ((active.estimated_labor_cost or 0) + (active.estimated_materials_cost or 0)) or "0.00"),
                    "status": active.status,
                    "requires_specialist": active.requires_specialist,
                    "is_critical": active.is_critical,
                    "created_at": active.created_at.isoformat() if active.created_at else None,
                }
            return None
        from .models import WorkforceWorkExtension
        active = WorkforceWorkExtension.objects.filter(
            job=obj,
            status__in=["REQUESTED", "ADMIN_APPROVED", "CUSTOMER_ACCEPTED", "IN_PROGRESS"]
        ).first()
        if active:
            return WorkforceWorkExtensionSerializer(active).data
        return None

    def get_payment(self, obj):
        payments_map = self.context.get("payments_map")
        if payments_map is not None:
            pmt = payments_map.get(obj.id)
        else:
            from .models import JobPayment
            pmt = getattr(obj, "payment_record", None)
            if not pmt:
                pmt = JobPayment.objects.filter(job=obj).first()
        if not pmt:
            is_online = (obj.payment_method or "").upper() in ["ONLINE", "PREPAID"]
            is_paid = obj.payment_status in ["paid", "collected"]
            return {
                "id": None,
                "job": obj.id,
                "payment_method": "ONLINE" if is_online else "CASH_ON_SERVICE",
                "payment_status": "PAID" if is_paid else "PENDING",
                "amount_due": str(obj.total_amount or "0.00"),
                "amount_paid": str(obj.total_amount if is_paid else "0.00"),
                "amount_received": None,
                "change_returned": None,
                "currency": "INR",
                "cash_collected_at": None,
                "customer_confirmed_at": None,
                "customer_confirmation_method": "",
            }
        return JobPaymentSerializer(pmt).data

    def get_cancellation_info(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        emp = getattr(request.user, "employee_profile", None)
        if not emp or obj.assigned_employee_id != emp.id:
            return None

        # Cancellation allowed in accepted, on_the_way, en_route, arrived states BEFORE customer OTP verification
        if obj.status not in ["accepted", "on_the_way", "en_route", "arrived"]:
            return {
                "can_cancel": False,
                "cancellation_available": False,
                "reason": "Not in cancellable state",
            }

        # Check if customer OTP is already verified
        from workforce_api.models import PreServiceVerification
        verification = PreServiceVerification.objects.filter(job=obj).first()
        if verification and verification.otp_verified:
            return {
                "can_cancel": False,
                "cancellation_available": False,
                "reason": "Cancellation locked after customer OTP verification",
            }

        from service_requests.models import EmployeeJob
        emp_job = EmployeeJob.objects.filter(service_request=obj, employee=emp).first()
        accepted_at = (emp_job.accepted_date if emp_job and emp_job.accepted_date else None) or obj.updated_at

        return {
            "can_cancel": True,
            "cancellation_available": True,
            "accepted_at": accepted_at.isoformat() if accepted_at else None,
            "cancellation_deadline": None,
            "remaining_seconds": None,
        }


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



