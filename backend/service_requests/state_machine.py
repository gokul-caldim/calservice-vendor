"""
workforce-app/backend/service_requests/state_machine.py
State machine logic for Service Request status transitions.
"""
import logging
from rest_framework.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger("workforce.state_machine")

ALLOWED_TRANSITIONS = {
    "draft": ["new_request", "confirmed", "offering", "dispatching", "assigned", "unassigned", "cancelled"],
    "new_request": ["confirmed", "offering", "dispatching", "assigned", "unassigned", "cancelled"],
    "unassigned": ["offering", "dispatching", "assigned", "accepted", "redispatching", "cancelled"],
    "offering": ["accepted", "unassigned", "redispatching", "cancelled"],
    "dispatching": ["offering", "accepted", "unassigned", "redispatching", "cancelled"],
    "redispatching": ["offering", "dispatching", "unassigned", "accepted", "cancelled"],
    "confirmed": ["offering", "dispatching", "assigned", "unassigned", "accepted", "cancelled"],
    "assigned": ["received", "accepted", "reassigned", "redispatching", "cancelled"],
    "received": ["accepted", "reassigned", "redispatching", "cancelled"],
    "accepted": ["on_the_way", "en_route", "arrived", "redispatching", "cancelled", "unable_to_complete"],
    "on_the_way": ["arrived", "redispatching", "cancelled", "unable_to_complete"],
    "en_route": ["arrived", "redispatching", "cancelled", "unable_to_complete"],
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
    """
    Authoritative state machine transition executor for ServiceRequest.
    Validates state transitions, enforces business invariants/gates, persists changes,
    and coordinates downstream side effects (EmployeeJob, JobTrackingSession, Availability).
    """
    current = str(service_request.status).lower()
    target = str(target_status).lower()

    if current == target:
        return current

    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if target not in allowed and not getattr(actor, "is_superuser", False):
        raise ValidationError(
            f"Invalid transition from '{current.upper()}' to '{target.upper()}'. Valid next states: {allowed}."
        )

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
            eval_emp = emp or service_request.assigned_employee
            if eval_emp:
                is_clocked_in = TimeLog.objects.filter(employee=eval_emp, clock_out__isnull=True).exists()
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
    service_request.save(update_fields=["status"])

    # ── Employee Wallet Credit ──────────────────────────────────────────────
    # Triggered only on COMPLETED transition. Non-blocking: a wallet error must
    # never roll back a successfully completed job. Failures are logged for
    # admin reconciliation via `python manage.py reconcile_wallets`.
    if target == "completed":
        try:
            from workforce_api.models import JobPayment
            from vendor_wallet.services.wallet_service import credit_job_earning
            from vendor_wallet.exceptions import IdempotentTransactionError, CommissionConfigMissingError

            job_payment = JobPayment.objects.filter(job=service_request).first()
            employee = service_request.assigned_employee
            if not employee:
                logger.warning(
                    "[WALLET_SKIP] Job #%s: assigned_employee is null. Employee wallet credit skipped.",
                    service_request.pk,
                )
            elif job_payment and job_payment.payment_status == "PAID":
                credit_job_earning(
                    employee=employee,
                    job=service_request,
                    job_payment=job_payment,
                    actor=actor,
                )
            else:
                logger.info(
                    "[WALLET_SKIP] Job #%s: payment not PAID (status=%s). Wallet credit deferred.",
                    service_request.pk,
                    getattr(job_payment, "payment_status", "NO_PAYMENT"),
                )
        except IdempotentTransactionError:
            # Already credited — safe to ignore on retries
            logger.info("[WALLET_IDEMPOTENT] Job #%s already credited.", service_request.pk)
        except CommissionConfigMissingError as _wce:
            logger.error(
                "[WALLET_CREDIT_FAILED] Job #%s — COMMISSION_CONFIG_MISSING: %s. "
                "Admin must create an EmployeeCommissionConfig and run reconcile_wallets.",
                service_request.pk, _wce,
            )
        except Exception as _wce:
            logger.error(
                "[WALLET_CREDIT_FAILED] Job #%s: %s. Run `reconcile_wallets` to detect and correct.",
                service_request.pk, _wce,
                exc_info=True,
            )
    # ── End Wallet Credit ───────────────────────────────────────────────────

    # Sync EmployeeJob status and timestamps
    try:
        from service_requests.models import EmployeeJob
        now = timezone.now()
        emp_job_updates = {"status": target.upper()}
        if target == "completed":
            emp_job_updates["completed_date"] = now
        elif target == "in_progress":
            emp_job_updates["started_date"] = now
        elif target == "accepted":
            emp_job_updates["accepted_date"] = now
        elif target == "redispatching":
            emp_job_updates["status"] = "EMPLOYEE_CANCELLED"
            emp_job_updates["is_primary"] = False

        EmployeeJob.objects.filter(service_request=service_request).update(**emp_job_updates)

        if target in ["completed", "cancelled", "redispatching", "unable_to_complete"]:
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
                ended_at=now,
            )
            if service_request.assigned_employee:
                from workforce_api.services.workload import reconcile_employee_availability
                reconcile_employee_availability(service_request.assigned_employee)
                logger.info(
                    f"[EMPLOYEE_RELEASED] employee={service_request.assigned_employee.id} "
                    f"job={service_request.id} target_state={target.upper()}"
                )
    except Exception as _sm_err:
        logger.exception(
            "Non-fatal error in post-transition side-effects for Job #%s -> %s: %s",
            service_request.pk, target, _sm_err
        )

    return target


transition = apply_transition


