from datetime import datetime
from django.utils import timezone
from django.db import transaction as db_transaction
from django.http import HttpResponse
from rest_framework import permissions, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from accounts.permissions import is_admin_role
from workforce_api.permissions import IsApprovedTechnician, IsWorkforceAdmin
from .models import TimeLog, Break, Location, JobSite, LocationZone, EmployeeLocation, TimeLogPhoto
from .serializers import (
    TimeLogSerializer, LocationSerializer, JobSiteSerializer,
    LocationZoneSerializer, EmployeeLocationSerializer, TimeLogPhotoSerializer
)
from .geo import evaluate
from .utils import generate_shift_summary_pdf


class IsWorkforceAdminOrReadOnly(permissions.BasePermission):
    """
    Allows authenticated users read-only access to company locations.
    Write operations (create, update, delete) strictly require Admin authorization.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_admin_role(request.user)





def _get_request_company(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "company", None):
        return user.company
    emp = getattr(user, "employee_profile", None)
    if emp and getattr(emp, "company", None):
        return emp.company
    return None


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsWorkforceAdminOrReadOnly]

    def _get_company(self):
        return _get_request_company(self.request)

    def get_queryset(self):
        if getattr(self.request.user, "is_superuser", False):
            company_id = self.request.query_params.get("company_id")
            if company_id:
                return Location.objects.filter(company_id=company_id)
            return Location.objects.all()
        company = self._get_company()
        if not company:
            return Location.objects.none()
        return Location.objects.filter(company=company)

    def perform_create(self, serializer):
        company = self._get_company()
        serializer.save(company=company)


class JobSiteViewSet(viewsets.ModelViewSet):
    queryset = JobSite.objects.all()
    serializer_class = JobSiteSerializer
    permission_classes = [IsWorkforceAdminOrReadOnly]

    def _get_company(self):
        return _get_request_company(self.request)

    def get_queryset(self):
        if getattr(self.request.user, "is_superuser", False):
            company_id = self.request.query_params.get("company_id")
            if company_id:
                return JobSite.objects.filter(company_id=company_id)
            return JobSite.objects.all()
        company = self._get_company()
        if not company:
            return JobSite.objects.none()
        return JobSite.objects.filter(company=company)

    def perform_create(self, serializer):
        company = self._get_company()
        serializer.save(company=company)



class TimeLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TimeLogSerializer

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            if getattr(user, "is_superuser", False):
                company_id = self.request.query_params.get("company_id")
                if company_id:
                    return TimeLog.objects.filter(employee__company_id=company_id).prefetch_related("breaks", "photos").order_by("-clock_in")
                return TimeLog.objects.all().prefetch_related("breaks", "photos").order_by("-clock_in")
            elif is_admin_role(user):
                company = _get_request_company(self.request)
                if company:
                    return TimeLog.objects.filter(employee__company=company).prefetch_related("breaks", "photos").order_by("-clock_in")
                return TimeLog.objects.none()
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
        # 1. Authenticated employee is valid and active
        emp = getattr(request.user, "employee_profile", None)
        if not emp or not emp.is_active or not getattr(request.user, "is_active", True):
            return Response({
                "error": "Employee record not found or account is inactive.",
                "code": "EMPLOYEE_INACTIVE"
            }, status=status.HTTP_403_FORBIDDEN)

        company = emp.company
        if not company:
            return Response({
                "error": "Company context missing.",
                "code": "NO_COMPANY"
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if technician already has an open TimeLog / active shift (Idempotent 200 OK)
        open_log = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).first()
        if open_log:
            return Response({
                "message": "Technician is already clocked in.",
                "is_clocked_in": True,
                "shift_status": "clocked_in",
                "time_log": TimeLogSerializer(open_log).data
            }, status=status.HTTP_200_OK)

        from service_requests.models import ServiceRequest, EmployeeJob
        from workforce_api.models import PreServiceVerification
        from django.db.models import Q
        from .geo import haversine_distance, GeofenceDecision, evaluate

        # 2 & 3 & 4. Verify active accepted primary job assignment owned by this employee
        job_id = request.data.get("job_id") or request.data.get("service_request_id")
        if job_id:
            active_job = ServiceRequest.objects.filter(
                id=job_id,
                company=company,
                status__in=["accepted", "on_the_way", "arrived", "in_progress"]
            ).first()
        else:
            emp_job_sr_ids = list(EmployeeJob.objects.filter(employee=emp).values_list("service_request_id", flat=True))
            active_job = ServiceRequest.objects.filter(
                Q(assigned_employee=emp) | Q(id__in=emp_job_sr_ids),
                company=company,
                status__in=["accepted", "on_the_way", "arrived", "in_progress"]
            ).first()

        if not active_job:
            return Response({
                "error": "Clock-In rejected: You do not have an active accepted job assignment.",
                "code": "NO_ACCEPTED_JOB"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Customer destination coordinates must exist
        if active_job.latitude is None or active_job.longitude is None:
            return Response({
                "error": "Clock-In rejected: Customer job destination coordinates are missing.",
                "code": "CUSTOMER_COORDINATES_MISSING"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6, 7, 8. Pre-Service Verification Gate (Arrival, OTP, and Live Face Selfie)
        verification = PreServiceVerification.objects.filter(job=active_job).first()
        if verification:
            verification.check_completion()
            verification.save()

        if not verification or not verification.is_complete:
            missing_items = []
            if not verification:
                missing_items = ["GPS Arrival Geofence", "Customer Work Start OTP", "Technician Presence Selfie"]
                return Response({
                    "error": "Clock-In rejected: Pre-service verification incomplete. Arrival, OTP and presence selfie required.",
                    "code": "ARRIVAL_REQUIRED",
                    "details": {"missing_items": missing_items}
                }, status=status.HTTP_400_BAD_REQUEST)

            if not verification.geofence_passed:
                return Response({
                    "error": "Clock-In rejected: Real GPS arrival verification at customer destination is required first.",
                    "code": "ARRIVAL_REQUIRED",
                    "details": {"missing_items": ["GPS Arrival Geofence"]}
                }, status=status.HTTP_400_BAD_REQUEST)

            if not verification.otp_verified:
                return Response({
                    "error": "Clock-In rejected: Customer Work Start OTP verification is required first.",
                    "code": "OTP_REQUIRED",
                    "details": {"missing_items": ["Customer OTP"]}
                }, status=status.HTTP_400_BAD_REQUEST)

            if not verification.presence_photo:
                missing_items.append("Technician Presence Selfie")

            return Response({
                "error": f"Clock-In rejected: Pre-service evidence incomplete. Missing: {', '.join(missing_items)}.",
                "code": "PRE_SERVICE_VERIFICATION_REQUIRED",
                "details": {"missing_items": missing_items}
            }, status=status.HTTP_400_BAD_REQUEST)

        # 9. Extract and validate device GPS coordinates
        lat = request.data.get("lat") if request.data.get("lat") is not None else request.data.get("latitude")
        lon = request.data.get("lon") if request.data.get("lon") is not None else (request.data.get("longitude") or request.data.get("lng"))
        accuracy = request.data.get("accuracy")
        gps_timestamp = request.data.get("timestamp") or request.data.get("gps_timestamp")
        address = request.data.get("address", "")
        notes = request.data.get("notes", "")
        photo = request.FILES.get("photo")

        # Real Browser GPS enforcement (No fake / fallback coordinates allowed)
        if lat in (None, "") or lon in (None, ""):
            return Response({
                "error": "Real device GPS coordinates (latitude and longitude) are required for clock-in.",
                "code": "GPS_REQUIRED"
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat_val = float(lat)
            lon_val = float(lon)
        except (ValueError, TypeError):
            return Response({
                "error": "Invalid GPS coordinate format.",
                "code": "INVALID_COORDINATES"
            }, status=status.HTTP_400_BAD_REQUEST)

        if not (-90.0 <= lat_val <= 90.0 and -180.0 <= lon_val <= 180.0):
            return Response({
                "error": "GPS coordinates out of valid range (-90..90, -180..180).",
                "code": "INVALID_COORDINATES"
            }, status=status.HTTP_400_BAD_REQUEST)

        if lat_val == 0.0 and lon_val == 0.0:
            return Response({
                "error": "Invalid zero GPS coordinates (0.0, 0.0).",
                "code": "INVALID_COORDINATES",
            }, status=status.HTTP_400_BAD_REQUEST)

        # Accuracy enforcement for geofence operations
        if accuracy is not None:
            try:
                acc_val = float(accuracy)
                if acc_val > 100.0:
                    return Response({
                        "error": f"Clock-in rejected: GPS accuracy too low ({int(acc_val)}m > 100m required for geofence verification).",
                        "code": "GPS_ACCURACY_TOO_LOW",
                        "details": {"accuracy": acc_val, "required_max": 100.0}
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                pass

        now = timezone.now()

        # 10. Validate GPS Freshness and Future-dated Clock Skew if timestamp is provided
        if gps_timestamp:
            try:
                from django.utils.dateparse import parse_datetime
                if isinstance(gps_timestamp, (int, float)) or (isinstance(gps_timestamp, str) and str(gps_timestamp).replace('.', '', 1).isdigit()):
                    ts_num = float(gps_timestamp)
                    if ts_num > 1e11:  # milliseconds
                        ts_num /= 1000.0
                    from datetime import datetime, timezone as dt_tz
                    gps_dt = datetime.fromtimestamp(ts_num, tz=dt_tz.utc)
                else:
                    gps_dt = parse_datetime(str(gps_timestamp))
                    if gps_dt and timezone.is_naive(gps_dt):
                        gps_dt = timezone.make_aware(gps_dt)

                if gps_dt:
                    age_seconds = (now - gps_dt).total_seconds()
                    if age_seconds < -60:
                        return Response({
                            "error": "Clock-In rejected: GPS timestamp is future-dated beyond allowable clock skew.",
                            "code": "GPS_TIMESTAMP_FUTURE_DATED",
                            "details": {"gps_age_seconds": round(age_seconds, 1)}
                        }, status=status.HTTP_400_BAD_REQUEST)
                    if age_seconds > 300:
                        return Response({
                            "error": f"Clock-In rejected: Device GPS fix is stale ({int(age_seconds)}s old). Please capture a fresh GPS fix.",
                            "code": "GPS_STALE",
                            "details": {"gps_age_seconds": round(age_seconds, 1)}
                        }, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

        # 11. Customer Job Geofence (Haversine distance <= 250m)
        dist_to_job = haversine_distance(lat_val, lon_val, float(active_job.latitude), float(active_job.longitude))
        ARRIVAL_RADIUS_METERS = 250.0

        if dist_to_job > ARRIVAL_RADIUS_METERS and not (verification and verification.geofence_passed):
            return Response({
                "error": f"Clock-In failed: You are {int(dist_to_job)}m away from customer destination. You must be within {int(ARRIVAL_RADIUS_METERS)}m to clock in.",
                "code": "OUTSIDE_GEOFENCE",
                "details": {
                    "distance_m": round(dist_to_job, 1),
                    "threshold_m": ARRIVAL_RADIUS_METERS,
                    "customer_lat": float(active_job.latitude),
                    "customer_lng": float(active_job.longitude),
                }
            }, status=status.HTTP_403_FORBIDDEN)

        # 12 & 13. Concurrency Protection & Atomic Clock-In Transaction
        from employees.models import Employee
        with db_transaction.atomic():
            # Exclusively lock the Employee row to serialize concurrent clock-in requests
            Employee.objects.select_for_update().filter(pk=emp.pk).first()

            open_log = (
                TimeLog.objects
                .select_for_update()
                .filter(employee=emp, clock_out__isnull=True)
                .first()
            )
            if open_log:
                return Response({
                    "message": "Technician is already clocked in.",
                    "is_clocked_in": True,
                    "shift_status": "clocked_in",
                    "time_log": TimeLogSerializer(open_log).data
                }, status=status.HTTP_200_OK)

            # Re-lock active job
            locked_job = ServiceRequest.objects.select_for_update().filter(pk=active_job.pk).first()
            if not locked_job or locked_job.status not in ["accepted", "on_the_way", "arrived"]:
                return Response({
                    "error": f"Job #{active_job.id} is in status '{locked_job.status if locked_job else 'unknown'}' and cannot be clocked in.",
                    "code": "INVALID_JOB_STATE"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create TimeLog
            time_log = TimeLog.objects.create(
                employee=emp,
                company=company,
                user=request.user,
                work_date=timezone.localdate(),
                clock_in=now,
                clock_in_lat=lat_val,
                clock_in_lon=lon_val,
                clock_in_address=address or locked_job.address or "",
                clock_in_notes=notes,
                clock_in_photo=photo,
                distance_from_site_meters=int(dist_to_job),
                geofence_passed=True,
                admin_override_used=False,
                location=None,
                status="draft",
            )

            # Transition or create EmployeeJob to ensure assignment record exists
            emp_job = EmployeeJob.objects.select_for_update().filter(service_request=locked_job, employee=emp).first()
            if not emp_job:
                EmployeeJob.objects.create(
                    service_request=locked_job,
                    employee=emp,
                    status="ARRIVED",
                    is_primary=True,
                    accepted_date=now,
                )

            # Transition ServiceRequest to IN_PROGRESS through authoritative state machine
            locked_job.assigned_employee = emp
            locked_job.save(update_fields=["assigned_employee"])
            from service_requests.state_machine import apply_transition
            if locked_job.status in ["accepted", "on_the_way"]:
                apply_transition(locked_job, "arrived", actor=request.user)
            apply_transition(locked_job, "in_progress", actor=request.user)

            # Update User.last_known_location
            user_loc = {
                "latitude": round(lat_val, 7),
                "longitude": round(lon_val, 7),
                "updated_at": now.isoformat(),
            }
            if accuracy is not None:
                try:
                    acc_f = float(accuracy)
                    if acc_f >= 0:
                        user_loc["accuracy"] = round(acc_f, 2)
                except (ValueError, TypeError):
                    pass
            request.user.last_known_location = user_loc
            request.user.save(update_fields=["last_known_location"])

        return Response({
            "message": "Clock-in successful. Job is now IN PROGRESS.",
            "is_clocked_in": True,
            "shift_status": "clocked_in",
            "time_log": TimeLogSerializer(time_log).data
        }, status=status.HTTP_201_CREATED)




class ClockOutView(APIView):
    """
    Authoritative Clock-Out API View with Cash Collection Guard and Idempotency.
    """
    permission_classes = [IsApprovedTechnician]

    def post(self, request):
        emp = getattr(request.user, "employee_profile", None)
        if not emp:
            return Response({
                "error": "Employee record not found.",
                "code": "EMPLOYEE_NOT_FOUND"
            }, status=status.HTTP_404_NOT_FOUND)

        from workforce_api.models import JobPayment
        from service_requests.models import ServiceRequest

        with db_transaction.atomic():
            open_log = (
                TimeLog.objects
                .select_for_update()
                .filter(employee=emp, clock_out__isnull=True)
                .first()
            )
            if not open_log:
                last_log = TimeLog.objects.filter(employee=emp).order_by("-clock_out").first()
                return Response({
                    "message": "Technician is already clocked out.",
                    "is_clocked_in": False,
                    "shift_status": "clocked_out",
                    "time_log": TimeLogSerializer(last_log).data if last_log else None
                }, status=status.HTTP_200_OK)

            # Cash-Gated Clock-Out: Verify that all CASH_ON_SERVICE jobs completed by this technician
            # have recorded and persisted cash collection in the database.
            recent_jobs = ServiceRequest.objects.filter(
                assigned_employee=emp,
                status__in=["in_progress", "proof_submitted", "completed"]
            ).order_by("-updated_at")[:10]

            for job in recent_jobs:
                payment = JobPayment.objects.filter(job=job).first()
                if payment and payment.payment_method == JobPayment.PaymentMethod.CASH_ON_SERVICE:
                    if not payment.is_cash_collected:
                        return Response({
                            "error": f"Clock-Out locked: Cash payment of ₹{payment.amount_due} for Job #{job.id} has not been collected and recorded in the system.",
                            "code": "CASH_NOT_RECEIVED",
                            "details": {
                                "job_id": job.id,
                                "amount_due": str(payment.amount_due),
                                "payment_status": payment.payment_status,
                                "cash_collected_at": payment.cash_collected_at.isoformat() if payment.cash_collected_at else None,
                            }
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

