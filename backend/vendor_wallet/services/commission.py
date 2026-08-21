"""
vendor_wallet/services/commission.py
Per-employee earn rate lookup.

get_active_commission(employee) returns the EmployeeCommissionConfig record
that is currently active for the given employee, or None if no config exists.

The caller (credit_job_earning) is responsible for raising CommissionConfigMissingError
when None is returned.
"""
import logging
from datetime import date

logger = logging.getLogger(__name__)


def get_active_commission(employee):
    """
    Returns the active EmployeeCommissionConfig for `employee` as of today, or None.

    Active means:
      - is_active = True
      - effective_from <= today
      - effective_until IS NULL or effective_until >= today

    When multiple configs satisfy these conditions, the most recently effective one
    (highest effective_from) is returned.
    """
    from vendor_wallet.models import EmployeeCommissionConfig

    today = date.today()
    config = (
        EmployeeCommissionConfig.objects
        .filter(
            employee=employee,
            is_active=True,
            effective_from__lte=today,
        )
        .filter(
            models_q_effective_until_ok(today)
        )
        .order_by("-effective_from")
        .first()
    )

    if config is None:
        logger.warning(
            "[COMMISSION_CONFIG_MISSING] employee_id=%s has no active earn rate config for %s",
            employee.id,
            today,
        )
    return config


def models_q_effective_until_ok(today):
    """Returns a Q object: effective_until IS NULL OR effective_until >= today."""
    from django.db.models import Q
    return Q(effective_until__isnull=True) | Q(effective_until__gte=today)
