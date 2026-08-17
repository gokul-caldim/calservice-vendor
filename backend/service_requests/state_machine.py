"""
workforce-app/backend/service_requests/state_machine.py
State machine logic for Service Request status transitions.
"""
from rest_framework.exceptions import ValidationError

ALLOWED_TRANSITIONS = {
    "unassigned": ["offering", "assigned", "accepted", "redispatching", "cancelled"],
    "offering": ["accepted", "unassigned", "redispatching", "cancelled"],
    "redispatching": ["offering", "unassigned", "accepted", "cancelled"],
    "new_request": ["confirmed", "cancelled"],
    "confirmed": ["assigned", "cancelled"],
    "assigned": ["received", "accepted", "reassigned", "cancelled"],
    "received": ["accepted", "reassigned", "cancelled"],
    "accepted": ["on_the_way", "en_route", "arrived", "cancelled", "unable_to_complete"],
    "on_the_way": ["arrived", "cancelled", "unable_to_complete"],
    "en_route": ["arrived", "cancelled", "unable_to_complete"],
    "arrived": ["service_started", "in_progress", "cancelled", "unable_to_complete"],
    "service_started": ["in_progress", "cancelled", "unable_to_complete"],
    "in_progress": ["proof_submitted", "cancelled", "unable_to_complete", "follow_up_required"],
    "proof_submitted": ["completed", "cancelled", "unable_to_complete", "follow_up_required"],
    "follow_up_required": ["in_progress", "completed", "cancelled", "unable_to_complete"],
    "completed": [],
    "cancelled": [],
    "reassigned": ["assigned", "cancelled"],
    "unable_to_complete": [],
}


def can_transition(current_status: str, target_status: str) -> bool:
    current = str(current_status).lower()
    target = str(target_status).lower()
    if current == target:
        return True
    allowed = ALLOWED_TRANSITIONS.get(current, [])
    return target in allowed


def apply_transition(service_request, target_status: str, actor=None) -> str:

    current = str(service_request.status).lower()
    target = str(target_status).lower()

    if current == target:
        return current

    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if target not in allowed and not getattr(actor, "is_superuser", False):
        raise ValidationError(f"Invalid transition from '{current.upper()}' to '{target.upper()}'. Next valid state: {allowed}.")

    emp = getattr(actor, "employee_profile", None) if actor else None
    if not getattr(actor, "is_superuser", False):
        # 1. Gate: ARRIVED / SERVICE_STARTED requires Geofence Passed
        if target in ["arrived", "service_started"]:
            from workforce_api.models import PreServiceVerification
            verification = PreServiceVerification.objects.filter(job=service_request).first()
            if not verification or not verification.geofence_passed:
                raise ValidationError("Transition rejected: Real GPS Arrival geofence check has not passed.")

        # 2. Gate: IN_PROGRESS requires active TimeLog clock-in
        if target == "in_progress":
            from time_tracking.models import TimeLog
            if not emp:
                raise ValidationError("Transition rejected: Authenticated employee profile required.")
            is_clocked_in = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).exists()
            if not is_clocked_in:
                raise ValidationError("Transition rejected: Active shift TimeLog clock-in is required before IN_PROGRESS.")

        # 3. Gate: COMPLETED requires Authoritative Completion Aggregation check
        if target == "completed":
            is_ready, reason, _ = service_request.is_ready_to_complete()
            if not is_ready:
                raise ValidationError(f"Transition rejected: {reason}")
        elif target == "proof_submitted":
            from workforce_api.models import PostServiceProof
            proof = PostServiceProof.objects.filter(job=service_request).first()
            if not proof or not proof.is_submitted:
                raise ValidationError("Transition rejected: After-service proof (photos and notes) required before PROOF_SUBMITTED.")

    service_request.status = target
    service_request.save()

    # Sync EmployeeJob status and timestamps
    try:
        from service_requests.models import EmployeeJob, ServiceRequest as SR
        from django.utils import timezone
        emp_job_updates = {"status": target.upper()}
        if target == "completed":
            emp_job_updates["completed_date"] = timezone.now()
        elif target == "in_progress":
            emp_job_updates["started_date"] = timezone.now()
        EmployeeJob.objects.filter(service_request=service_request).update(**emp_job_updates)

        if target in ["completed", "cancelled"]:
            from workforce_api.models import JobTrackingSession
            closing_status = (
                JobTrackingSession.SessionStatus.COMPLETED
                if target == "completed"
                else JobTrackingSession.SessionStatus.CANCELLED
            )
            JobTrackingSession.objects.filter(
                job=service_request,
                status=JobTrackingSession.SessionStatus.ACTIVE,
            ).update(
                status=closing_status,
                ended_at=timezone.now(),
            )
            if service_request.assigned_employee:
                from workforce_api.services.workload import reconcile_employee_availability
                reconcile_employee_availability(service_request.assigned_employee)
                import logging as _logging
                _logging.getLogger("workforce.state_machine").info(
                    f"[EMPLOYEE_RELEASED] employee={service_request.assigned_employee.id} "
                    f"completed_job={service_request.id} state=AVAILABLE"
                )
    except Exception as _sm_err:
        import logging as _logging
        _logging.getLogger("workforce.state_machine").exception(
            "Non-fatal error in post-transition side-effects for %s -> %s: %s",
            service_request.pk, target, _sm_err
        )

    return target


transition = apply_transition


