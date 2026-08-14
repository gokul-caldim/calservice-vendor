from datetime import datetime
from django.utils import timezone
from django.db import transaction as db_transaction
from django.http import HttpResponse
from rest_framework import permissions, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from workforce_api.permissions import IsApprovedTechnician, IsWorkforceAdmin
from .models import TimeLog, Break, Location, JobSite, LocationZone, EmployeeLocation, TimeLogPhoto
from .serializers import (
    TimeLogSerializer, LocationSerializer, JobSiteSerializer,
    LocationZoneSerializer, EmployeeLocationSerializer, TimeLogPhotoSerializer
)
from .geo import evaluate
from .utils import generate_shift_summary_pdf


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Location.objects.all()
        if hasattr(self.request.user, "company") and self.request.user.company:
            qs = qs.filter(company=self.request.user.company)
        return qs


class JobSiteViewSet(viewsets.ModelViewSet):
    queryset = JobSite.objects.all()
    serializer_class = JobSiteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = JobSite.objects.all()
        if hasattr(self.request.user, "company") and self.request.user.company:
            qs = qs.filter(company=self.request.user.company)
        return qs


class TimeLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TimeLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        emp = getattr(self.request.user, "employee_profile", None)
        if not emp:
            if getattr(self.request.user, "is_staff", False):
                return TimeLog.objects.all().prefetch_related("breaks", "photos").order_by("-clock_in")
            return TimeLog.objects.none()

        qs = TimeLog.objects.filter(employee=emp).prefetch_related("breaks", "photos")
        return qs.order_by("-clock_in")

    @action(detail=True, methods=["get"])
    def download_pdf(self, request, pk=None):
        time_log = self.get_object()
        pdf_bytes = generate_shift_summary_pdf(time_log)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="shift_{time_log.work_date}_{time_log.employee_id}.pdf"'
        return response


class ClockInView(APIView):
    """
    Authoritative Clock-In API with atomic DB Row Locks and real GPS Geofencing.
    Identity (employee & company) is resolved strictly from request.user.
    """
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp or not emp.is_active:
            return Response({
                "error": "Employee record not found or account is inactive.",
                "code": "EMPLOYEE_INACTIVE"
            }, status=status.HTTP_403_FORBIDDEN)

        company = emp.company

        # Phase 2 Gate: Verify active accepted job assignment and complete pre-service verification
        from service_requests.models import ServiceRequest
        from workforce_api.models import PreServiceVerification

        active_job = ServiceRequest.objects.filter(
            assigned_employee=emp,
            status__in=["accepted", "on_the_way", "arrived"]
        ).first()

        if not active_job:
            return Response({
                "error": "Clock-In rejected: You do not have an active accepted job assignment.",
                "code": "NO_ACCEPTED_JOB"
            }, status=status.HTTP_400_BAD_REQUEST)

        verification = PreServiceVerification.objects.filter(job=active_job).first()
        if not verification or not verification.is_complete:
            missing_items = []
            if not verification:
                missing_items = ["GPS Arrival Geofence", "Presence Photo", "Customer OTP", "Appliance Photo", "Work Area Photo"]
            else:
                if not verification.geofence_passed:
                    missing_items.append("GPS Arrival Geofence")
                if not verification.presence_photo:
                    missing_items.append("Presence Photo")
                if not verification.otp_verified:
                    missing_items.append("Customer OTP")
                if not verification.appliance_photo:
                    missing_items.append("Before Appliance Photo")
                if not verification.work_area_photo:
                    missing_items.append("Before Work Area Photo")

            return Response({
                "error": f"Clock-In rejected: Pre-service verification incomplete. Missing: {', '.join(missing_items)}.",
                "code": "PRE_SERVICE_INCOMPLETE",
                "details": {"missing_items": missing_items}
            }, status=status.HTTP_400_BAD_REQUEST)

        # Concurrency & Active Shift Lock
        with db_transaction.atomic():
            open_log = (
                TimeLog.objects
                .select_for_update()
                .filter(employee=emp, clock_out__isnull=True)
                .first()
            )
            if open_log:
                return Response({
                    "error": "Technician is already clocked in.",
                    "code": "ALREADY_CLOCKED_IN",
                    "details": {"time_log": TimeLogSerializer(open_log).data}
                }, status=status.HTTP_409_CONFLICT)

        lat = request.data.get("lat")
        lon = request.data.get("lon")
        address = request.data.get("address", "")
        notes = request.data.get("notes", "")
        photo = request.FILES.get("photo")

        # Real Browser GPS enforcement (No fake / fallback coordinates allowed)
        if lat in (None, "") or lon in (None, ""):
            return Response({
                "error": "GPS coordinates (lat and lon) are required for clock-in.",
                "code": "GPS_REQUIRED"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat_val = float(lat)
            lon_val = float(lon)
        except (ValueError, TypeError):
            return Response({
                "error": "Invalid GPS coordinate format.",
                "code": "INVALID_GPS"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Fetch permitted locations for employee or company active locations
        permitted_loc_rels = EmployeeLocation.objects.filter(employee=emp).select_related("location")
        permitted_locs = [rel.location for rel in permitted_loc_rels]
        if not permitted_locs:
            permitted_locs = list(Location.objects.filter(company=company, is_active=True))

        geofence_enabled = getattr(company, "geofence_enabled", True) if company else True
        allow_all_locs = getattr(emp, "allow_all_locations", False) or not geofence_enabled

        if not permitted_locs and not allow_all_locs:
            return Response({
                "error": "Your company has not configured an authorized clock-in location. Please contact your administrator.",
                "code": "NO_GEOFENCE_LOCATION",
                "details": {"geofence_passed": False}
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = evaluate(
            lat=lat_val,
            lng=lon_val,
            permitted_locations=permitted_locs,
            is_admin=getattr(request.user, "is_staff", False),
            request_admin_override=request.data.get("admin_override", False),
            allow_all_locations=allow_all_locs,
        )

        if not decision.allowed:
            return Response(decision.to_block_response(), status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        time_log = TimeLog.objects.create(
            employee=emp,
            company=company,
            user=request.user,
            work_date=timezone.localdate(),
            clock_in=now,
            clock_in_lat=lat_val,
            clock_in_lon=lon_val,
            clock_in_address=address,
            clock_in_notes=notes,
            clock_in_photo=photo,
            distance_from_site_meters=decision.distance_m,
            geofence_passed=decision.geofence_passed,
            admin_override_used=decision.admin_override_used,
            location=decision.matched_location,
        )

        # Transition job state to in_progress
        active_job.status = "in_progress"
        active_job.save()

        return Response({
            "message": "Clock-in successful. Job is now IN PROGRESS.",
            "is_clocked_in": True,
            "shift_status": "clocked_in",
            "time_log": TimeLogSerializer(time_log).data
        }, status=status.HTTP_201_CREATED)


class ClockOutView(APIView):
    """
    Authoritative Clock-Out API View.
    """
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({
                "error": "Employee record not found.",
                "code": "EMPLOYEE_NOT_FOUND"
            }, status=status.HTTP_404_NOT_FOUND)

        with db_transaction.atomic():
            open_log = (
                TimeLog.objects
                .select_for_update()
                .filter(employee=emp, clock_out__isnull=True)
                .first()
            )
            if not open_log:
                return Response({
                    "error": "Cannot clock out: No active clocked-in session found.",
                    "code": "NOT_CLOCKED_IN"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Close any open breaks
            open_breaks = open_log.breaks.filter(break_end__isnull=True)
            for b in open_breaks:
                b.break_end = timezone.now()
                b.save()

            now = timezone.now()
            open_log.clock_out = now
            if request.data.get("lat") not in (None, ""):
                try:
                    open_log.clock_out_lat = float(request.data["lat"])
                except (ValueError, TypeError):
                    pass
            if request.data.get("lon") not in (None, ""):
                try:
                    open_log.clock_out_lon = float(request.data["lon"])
                except (ValueError, TypeError):
                    pass
            open_log.clock_out_address = request.data.get("address", "")
            open_log.clock_out_notes = request.data.get("notes", "")
            if request.FILES.get("photo"):
                open_log.clock_out_photo = request.FILES.get("photo")

            open_log.status = "submitted"
            open_log.submitted_at = now
            open_log.save()

        return Response({
            "message": "Clock-out successful.",
            "is_clocked_in": False,
            "shift_status": "clocked_out",
            "time_log": TimeLogSerializer(open_log).data
        }, status=status.HTTP_200_OK)


class BreakStartView(APIView):
    """Starts a break (tea, lunch, personal)."""
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)

        open_log = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).first()
        if not open_log:
            return Response({"error": "You must be clocked in to start a break.", "code": "NOT_CLOCKED_IN"}, status=status.HTTP_400_BAD_REQUEST)

        existing_break = open_log.breaks.filter(break_end__isnull=True).first()
        if existing_break:
            return Response({"error": "A break is already active.", "code": "BREAK_ALREADY_ACTIVE"}, status=status.HTTP_400_BAD_REQUEST)

        b_type = request.data.get("break_type", "tea")
        if b_type not in ["tea", "lunch", "personal"]:
            return Response({"error": f"Invalid break type '{b_type}'. Allowed: tea, lunch, personal.", "code": "INVALID_BREAK_TYPE"}, status=status.HTTP_400_BAD_REQUEST)

        new_break = Break.objects.create(
            time_log=open_log,
            break_start=timezone.now(),
            break_type=b_type
        )
        return Response({
            "message": f"{b_type.title()} break started.",
            "shift_status": "on_break",
            "break_id": new_break.id,
            "break_type": b_type,
            "break_start": new_break.break_start.isoformat(),
        }, status=status.HTTP_201_CREATED)


class BreakEndView(APIView):
    """Ends the currently active break."""
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)

        open_log = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).first()
        if not open_log:
            return Response({"error": "No active clock-in session found.", "code": "NOT_CLOCKED_IN"}, status=status.HTTP_400_BAD_REQUEST)

        active_break = open_log.breaks.filter(break_end__isnull=True).first()
        if not active_break:
            return Response({"error": "No active break found to resume from.", "code": "NO_ACTIVE_BREAK"}, status=status.HTTP_400_BAD_REQUEST)

        active_break.break_end = timezone.now()
        active_break.save()
        return Response({
            "message": "Break ended. Resumed work shift.",
            "shift_status": "clocked_in",
            "duration_minutes": active_break.duration_minutes
        }, status=status.HTTP_200_OK)


class GeofenceCheckView(APIView):
    """Pre-flight endpoint to test real browser GPS coordinates against permitted locations."""
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({"error": "Employee record not found.", "code": "EMPLOYEE_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)

        lat = request.data.get("lat")
        lon = request.data.get("lon")

        lat_val = float(lat) if lat not in (None, "") else None
        lon_val = float(lon) if lon not in (None, "") else None

        permitted_loc_rels = EmployeeLocation.objects.filter(employee=emp).select_related("location")
        permitted_locs = [rel.location for rel in permitted_loc_rels]
        if not permitted_locs:
            permitted_locs = list(Location.objects.filter(company=emp.company, is_active=True))

        company = emp.company
        geofence_enabled = getattr(company, "geofence_enabled", True) if company else True
        allow_all_locs = getattr(emp, "allow_all_locations", False) or not geofence_enabled

        if not permitted_locs and not allow_all_locs:
            return Response({
                "allowed": False,
                "reason": "Your company has not configured an authorized clock-in location. Please contact your administrator.",
                "code": "NO_GEOFENCE_LOCATION",
                "distance_m": None,
                "matched_location": None
            }, status=status.HTTP_200_OK)

        decision = evaluate(
            lat=lat_val,
            lng=lon_val,
            permitted_locations=permitted_locs,
            is_admin=getattr(request.user, "is_staff", False),
            allow_all_locations=allow_all_locs,
        )

        return Response({
            "allowed": decision.allowed,
            "reason": decision.reason,
            "geofence_passed": decision.geofence_passed,
            "distance_m": decision.distance_m,
            "matched_location": decision.matched_location.name if decision.matched_location else None
        }, status=status.HTTP_200_OK)


class LocationViewSet(viewsets.ModelViewSet):
    """Admin & Manager CRUD endpoint for company geofenced locations."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LocationSerializer

    def get_queryset(self):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        if not company:
            return Location.objects.none()
        return Location.objects.filter(company=company)

    def perform_create(self, serializer):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        serializer.save(company=company)


class JobSiteViewSet(viewsets.ModelViewSet):
    """Admin & Manager endpoint for JobSite location overrides."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        company = emp.company if emp else getattr(user, "company", None)
        if not company:
            return JobSite.objects.none()
        return JobSite.objects.filter(company=company)


class TimeLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for shift time log history."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TimeLogSerializer

    def get_queryset(self):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        if getattr(user, "is_staff", False):
            company = getattr(user, "company", None)
            return TimeLog.objects.filter(company=company).prefetch_related("breaks", "photos")
        if emp:
            return TimeLog.objects.filter(employee=emp).prefetch_related("breaks", "photos")
        return TimeLog.objects.none()
