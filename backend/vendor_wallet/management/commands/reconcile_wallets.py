"""
Django Management Command: reconcile_wallets

Compares EmployeeWallet cached balance fields against ledger-computed totals.
Reports discrepancies. Does NOT automatically correct balances.

Any corrective action must be explicit, admin-authorized, and audited via
the admin adjustment API (/api/workforce/admin/wallet/employees/{employee_id}/adjustment/).

Usage:
  python manage.py reconcile_wallets
  python manage.py reconcile_wallets --employee-id=42
"""
import sys

from django.core.management.base import BaseCommand
from django.db.models import Sum
from decimal import Decimal

ZERO = Decimal("0.00")
TWO = Decimal("0.01")


class Command(BaseCommand):
    help = (
        "Reconciles EmployeeWallet cached balances against the EmployeeWalletTransaction ledger. "
        "Reports discrepancies only — no automatic corrections are made."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--employee-id",
            type=int,
            default=None,
            help="Reconcile only the wallet for this employee ID.",
        )

    def handle(self, *args, **options):
        from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction
        from vendor_wallet.constants import (
            DIRECTION_CREDIT, DIRECTION_DEBIT,
            BALANCE_PENDING, BALANCE_AVAILABLE,
            TXN_STATUS_PENDING_SETTLEMENT, TXN_STATUS_COMPLETED,
        )

        employee_id = options.get("employee_id")

        wallets = EmployeeWallet.objects.all()
        if employee_id:
            wallets = wallets.filter(employee_id=employee_id)

        if not wallets.exists():
            self.stdout.write(self.style.WARNING("No employee wallets found."))
            return

        discrepancy_count = 0

        for wallet in wallets.select_related("employee", "employee__user"):
            emp_name = wallet.employee.user.get_full_name() if wallet.employee and wallet.employee.user else f"Employee #{wallet.employee_id}"
            self.stdout.write(f"\nWallet #{wallet.id} — Employee: {emp_name} (#{wallet.employee_id})")

            txns = EmployeeWalletTransaction.objects.filter(wallet=wallet)

            # Compute available balance from ledger
            avail_credits = txns.filter(
                direction=DIRECTION_CREDIT,
                balance_type=BALANCE_AVAILABLE,
                status__in=[TXN_STATUS_COMPLETED],
            ).aggregate(total=Sum("amount"))["total"] or ZERO

            avail_debits = txns.filter(
                direction=DIRECTION_DEBIT,
                balance_type=BALANCE_AVAILABLE,
                status__in=[TXN_STATUS_COMPLETED],
            ).aggregate(total=Sum("amount"))["total"] or ZERO

            computed_available = (avail_credits - avail_debits).quantize(TWO)

            # Compute pending balance from ledger
            pending_credits = txns.filter(
                direction=DIRECTION_CREDIT,
                balance_type=BALANCE_PENDING,
                status=TXN_STATUS_PENDING_SETTLEMENT,
                released_at__isnull=True,
            ).aggregate(total=Sum("amount"))["total"] or ZERO

            computed_pending = pending_credits.quantize(TWO)

            stored_available = wallet.available_balance.quantize(TWO)
            stored_pending = wallet.pending_balance.quantize(TWO)

            avail_ok = stored_available == computed_available
            pending_ok = stored_pending == computed_pending

            if avail_ok and pending_ok:
                self.stdout.write(self.style.SUCCESS(
                    f"  available_balance: ₹{stored_available} — OK\n"
                    f"  pending_balance:   ₹{stored_pending} — OK"
                ))
            else:
                discrepancy_count += 1
                if not avail_ok:
                    self.stderr.write(self.style.ERROR(
                        f"  MISMATCH available_balance: stored=₹{stored_available}, ledger=₹{computed_available} "
                        f"(diff: ₹{stored_available - computed_available})"
                    ))
                if not pending_ok:
                    self.stderr.write(self.style.ERROR(
                        f"  MISMATCH pending_balance: stored=₹{stored_pending}, ledger=₹{computed_pending} "
                        f"(diff: ₹{stored_pending - computed_pending})"
                    ))

        if discrepancy_count > 0:
            self.stderr.write(self.style.ERROR(
                f"\nReconciliation complete: {discrepancy_count} wallet(s) have discrepancies. "
                "Investigate and correct via admin adjustment API."
            ))
            sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS("\nReconciliation complete: all wallets match ledger exactly."))
