"""
workforce_api/services/workload.py

Authoritative Single-Active-Job Workload Isolation and Employee Availability Engine.
Enforces the core business rule: ONE EMPLOYEE = ONE ACTIVE JOB AT A TIME.

Active Workload Lifecycle:
    AVAILABLE -> OFFERED -> ACCEPTED -> BUSY -> ON_THE_WAY -> ARRIVED ->
    IN_PROGRESS -> PROOF_SUBMITTED -> (JobPayment PAID Gate) ->
    COMPLETED -> AVAILABLE
"""
import logging
from typing import Optional, List, Tuple
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("workforce.workload")

# Authoritative definition of all statuses visible in an employee's active jobs queue
ACTIVE_QUEUE_STATUSES: List[str] = [
    "assigned",
    "accepted",
    "on_the_way",
    "en_route",
    "arrived",
    "in_progress",
    "proof_submitted",
]

# Authoritative definition of all statuses where an employee is actively executing work
ACTIVE_WORKLOAD_STATUSES: List[str] = [
    "accepted",
    "on_the_way",
    "en_route",
    "arrived",
    "in_progress",
    "proof_submitted",
]

# Workload blocking statuses that prevent new exclusive offers (ONE EMPLOYEE = ONE ACTIVE JOB)
WORKLOAD_OCCUPIED_STATUSES: List[str] = [
    "assigned",
    "accepted",
    "on_the_way",
    "en_route",
    "arrived",
    "in_progress",
    "proof_submitted",
]

# Terminal statuses where an assignment has fully ended
TERMINAL_WORKLOAD_STATUSES: List[str] = [
    "completed",
    "cancelled",
    "unable_to_complete",
    "redispatching",
    "unassigned",
]


def get_employee_active_job(employee_or_id, for_update: bool = False, statuses: Optional[List[str]] = None):
    """
    Authoritative query returning the single active ServiceRequest for an employee,
    or None if the employee has no active workload.

    Used consistently across:
      - automatic dispatch & 9-gate eligibility
      - candidate ranking
      - offer creation
      - offer acceptance
      - employee job listing
      - availability reconciliation
      - realtime event handlers
      - payment and completion lifecycles
    """
    from employees.models import Employee
    from service_requests.models import ServiceRequest

    emp_id = employee_or_id.pk if hasattr(employee_or_id, "pk") else employee_or_id
    if not emp_id:
        return None

    target_statuses = statuses or WORKLOAD_OCCUPIED_STATUSES

    qs = ServiceRequest.objects.filter(
        assigned_employee_id=emp_id,
        status__in=target_statuses,
    )

    if for_update:
        qs = qs.select_for_update()

    active_job = qs.order_by("-updated_at", "-created_at").first()

    # Fallback check on EmployeeJob table
    if not active_job:
        try:
            from service_requests.models import EmployeeJob
            emp_job_qs = EmployeeJob.objects.filter(
                employee_id=emp_id,
                status__in=["ASSIGNED", "ACCEPTED", "ON_THE_WAY", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "PROOF_SUBMITTED"],
            )
            if for_update:
                emp_job_qs = emp_job_qs.select_for_update()
            active_emp_job = emp_job_qs.select_related("service_request").first()
            if active_emp_job and active_emp_job.service_request:
                sr = active_emp_job.service_request
                if sr.status in target_statuses:
                    active_job = sr
        except Exception as e:
            logger.debug(f"[WORKLOAD_FALLBACK_ERR] {e}")

    return active_job


def is_employee_busy(employee_or_id) -> bool:
    """
    Returns True if the employee currently has an active job.
    """
    return get_employee_active_job(employee_or_id) is not None


def reconcile_employee_availability(employee_or_id) -> str:
    """
    Authoritatively calculates and synchronizes Employee.current_availability based on active workload.
    Rules:
      - If active job exists -> 'busy'
      - If no active job exists and employee is online -> 'available'
      - If employee is offline -> 'offline'

    Logs structured event: [EMPLOYEE_WORKLOAD] employee=<id> active_job=<id/null> state=BUSY/AVAILABLE
    """
    from employees.models import Employee

    emp_id = employee_or_id.pk if hasattr(employee_or_id, "pk") else employee_or_id
    emp = Employee.objects.filter(pk=emp_id).first()
    if not emp:
        return "offline"

    active_job = get_employee_active_job(emp_id)

    update_fields = []
    if active_job:
        new_avail = "busy"
        if not emp.is_online:
            emp.is_online = True
            update_fields.append("is_online")
    elif not emp.is_online:
        new_avail = "offline"
    else:
        new_avail = "available"

    if emp.current_availability != new_avail:
        emp.current_availability = new_avail
        update_fields.append("current_availability")

    if update_fields:
        emp.save(update_fields=update_fields)

    logger.info(
        f"[EMPLOYEE_WORKLOAD] employee={emp.id} active_job={active_job.id if active_job else 'null'} "
        f"state={new_avail.upper()}"
    )

    return new_avail


def supersede_other_offers_for_employee(employee, accepted_job, reason: str = "EMPLOYEE_ALREADY_ACCEPTED_ANOTHER_JOB") -> int:
    """
    When an employee accepts a job, atomically transitions all other pending OFFERED offers
    for that employee to SUPERSEDED_BY_ACCEPTANCE.
    Emits JOB_OFFER_CLOSED event log for each closed offer so realtime / SSE removes them.
    Preserves audit history.
    """
    from workforce_api.models import WorkforceJobOffer, WorkforceEventLog

    emp_id = employee.pk if hasattr(employee, "pk") else employee
    accepted_job_id = accepted_job.pk if hasattr(accepted_job, "pk") else accepted_job

    other_offers = list(
        WorkforceJobOffer.objects.select_for_update().filter(
            employee_id=emp_id,
            status=WorkforceJobOffer.Status.OFFERED,
        ).exclude(job_id=accepted_job_id)
    )

    if not other_offers:
        return 0

    WorkforceJobOffer.objects.filter(
        id__in=[o.id for o in other_offers]
    ).update(
        status=WorkforceJobOffer.Status.SUPERSEDED_BY_ACCEPTANCE,
        rejection_reason=reason,
    )

    user_obj = getattr(employee, "user", None)
    if user_obj:
        evs = [
            WorkforceEventLog(
                user=user_obj,
                event_type="JOB_OFFER_CLOSED",
                payload={
                    "job_id": o.job_id,
                    "offer_id": o.id,
                    "reason": reason,
                    "active_job_id": accepted_job_id,
                    "message": "Offer closed automatically because you accepted another job.",
                }
            )
            for o in other_offers
        ]
        WorkforceEventLog.objects.bulk_create(evs)

    return len(other_offers)
