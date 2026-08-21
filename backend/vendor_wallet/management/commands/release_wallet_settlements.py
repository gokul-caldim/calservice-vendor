"""
Django Management Command: release_wallet_settlements

Releases employee wallet pending earnings to available balance after the T+7
settlement hold period has elapsed.

Run it via cron, supervisor, or as a background daemon process:

  Single pass (suitable for cron every hour):
    python manage.py release_wallet_settlements --once

  Continuous daemon loop (runs every hour):
    python manage.py release_wallet_settlements --loop --interval 3600
"""
import sys
import time
import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Releases employee wallet pending earnings to available balance after "
        "the T+7 settlement hold period has elapsed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--once",
            action="store_true",
            help="Run a single settlement sweep and exit.",
        )
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Run as a continuous daemon loop.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=3600,
            help="Interval in seconds between sweeps when running in loop mode (default: 3600s = 1 hour).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be released without making any changes.",
        )

    def handle(self, *args, **options):
        run_once = options.get("once")
        run_loop = options.get("loop")
        interval = max(60, options.get("interval") or 3600)
        dry_run = options.get("dry_run", False)

        if dry_run:
            self.stdout.write(self.style.WARNING("[WALLET SETTLEMENT] Running in DRY-RUN mode — no changes will be made."))

        self.stdout.write(self.style.SUCCESS(
            f"[WALLET SETTLEMENT] Starting settlement release engine "
            f"(interval: {interval}s, dry_run={dry_run})..."
        ))

        if run_once or not run_loop:
            result = self._run_sweep(dry_run=dry_run)
            self._print_result(result)
            return

        self.stdout.write(self.style.WARNING(
            "[WALLET SETTLEMENT] Running in continuous daemon mode (Ctrl+C to stop)..."
        ))
        try:
            while True:
                try:
                    result = self._run_sweep(dry_run=dry_run)
                    if result["released_count"] > 0 or result["errors"]:
                        self._print_result(result)
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"[WALLET SETTLEMENT ERROR] {exc}"))
                    logger.exception("[WALLET_SETTLEMENT_ERROR] Sweep failed: %s", exc)
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("[WALLET SETTLEMENT] Stopped by user."))
            sys.exit(0)

    def _run_sweep(self, dry_run=False):
        """
        Core sweep: finds all PENDING_SETTLEMENT transactions past their release date
        and releases them to available balance.

        Returns a summary dict.
        """
        from vendor_wallet.models import EmployeeWalletTransaction, EmployeeWallet
        from vendor_wallet.constants import (
            TXN_STATUS_PENDING_SETTLEMENT, TXN_STATUS_COMPLETED,
            TXN_SETTLEMENT_RELEASE, REF_SETTLEMENT,
            DIRECTION_CREDIT, BALANCE_AVAILABLE,
        )
        from decimal import Decimal

        now = timezone.now()
        released_count = 0
        skipped_count = 0
        errors = []

        due_transactions = EmployeeWalletTransaction.objects.filter(
            status=TXN_STATUS_PENDING_SETTLEMENT,
            settlement_release_at__lte=now,
            released_at__isnull=True,
        ).select_for_update(skip_locked=True).select_related("wallet")

        wallet_ids_seen = set()

        for txn in due_transactions:
            if txn.wallet_id in wallet_ids_seen:
                continue

            wallet_id = txn.wallet_id
            wallet_due = EmployeeWalletTransaction.objects.filter(
                wallet_id=wallet_id,
                status=TXN_STATUS_PENDING_SETTLEMENT,
                settlement_release_at__lte=now,
                released_at__isnull=True,
            )

            wallet_ids_seen.add(wallet_id)

            try:
                with transaction.atomic():
                    wallet = EmployeeWallet.objects.select_for_update().get(id=wallet_id)

                    for pending_txn in wallet_due.select_for_update(skip_locked=True):
                        if pending_txn.released_at is not None:
                            skipped_count += 1
                            continue

                        amount = pending_txn.amount
                        avail_before = wallet.available_balance

                        if not dry_run:
                            EmployeeWalletTransaction.objects.create(
                                wallet=wallet,
                                reference_type=REF_SETTLEMENT,
                                reference_id=f"SETTLE:{pending_txn.id}",
                                transaction_type=TXN_SETTLEMENT_RELEASE,
                                direction=DIRECTION_CREDIT,
                                amount=amount,
                                balance_before=avail_before,
                                balance_after=avail_before + amount,
                                balance_type=BALANCE_AVAILABLE,
                                status=TXN_STATUS_COMPLETED,
                                description=f"T+7 Settlement release for transaction #{pending_txn.id}",
                                metadata={"source_transaction_id": pending_txn.id},
                            )

                            wallet.pending_balance -= amount
                            wallet.available_balance += amount

                            pending_txn.status = TXN_STATUS_COMPLETED
                            pending_txn.released_at = now
                            pending_txn.save(update_fields=["status", "released_at"])

                            wallet.save(update_fields=["available_balance", "pending_balance", "updated_at"])

                        released_count += 1
                        logger.info(
                            "[SETTLEMENT_RELEASED] txn_id=%s wallet_id=%s employee_id=%s amount=%.2f dry_run=%s",
                            pending_txn.id, wallet_id, wallet.employee_id, amount, dry_run,
                        )

            except Exception as exc:
                err_msg = f"Failed to release settlements for wallet #{wallet_id}: {exc}"
                errors.append(err_msg)
                logger.exception("[SETTLEMENT_WALLET_ERROR] %s", err_msg)

        return {
            "released_count": released_count,
            "skipped_count": skipped_count,
            "errors": errors,
            "dry_run": dry_run,
            "swept_at": now.isoformat(),
        }

    def _print_result(self, result):
        now_str = result.get("swept_at", timezone.now().isoformat())
        dry_str = " [DRY RUN]" if result.get("dry_run") else ""
        self.stdout.write(
            f"[{now_str}]{dry_str} Settlement sweep complete: "
            f"{result['released_count']} released, {result['skipped_count']} skipped, "
            f"{len(result['errors'])} errors."
        )
        for err in result.get("errors", []):
            self.stderr.write(self.style.ERROR(f"  Error: {err}"))
