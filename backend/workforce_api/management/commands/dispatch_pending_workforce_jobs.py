"""
Django Management Command: dispatch_pending_workforce_jobs

Reconciles cross-application customer bookings with Workforce employees by:
1. Sweeping and falling back on expired job offers.
2. Discovering pending dispatchable customer jobs directly from the database.
3. Evaluating technician live GPS proximity and readiness.
4. Creating exclusive job offers for nearest qualified technicians.

Usage:
  Single pass:
    python manage.py dispatch_pending_workforce_jobs --once

  Continuous background reconciliation loop (5s interval):
    python manage.py dispatch_pending_workforce_jobs --loop --interval 5
"""
import time
import sys
from django.core.management.base import BaseCommand
from workforce_api.services.automatic_dispatch import dispatch_pending_jobs, expire_and_reassign_offers


class Command(BaseCommand):
    help = "Reconciles pending cross-application customer service requests and executes automatic geo-based dispatch."

    def add_arguments(self, parser):
        parser.add_argument(
            "--once",
            action="store_true",
            help="Run reconciliation once and exit immediately.",
        )
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Run continuous reconciliation loop in the background.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=5,
            help="Interval in seconds between reconciliation cycles (default: 5s).",
        )

    def handle(self, *args, **options):
        run_once = options.get("once")
        run_loop = options.get("loop")
        interval = max(1, options.get("interval") or 5)

        self.stdout.write(self.style.SUCCESS(f"[DISPATCH ENGINE] Starting Workforce Dispatch Reconciliation (interval: {interval}s)..."))

        if run_once or not run_loop:
            # Single pass reconciliation
            result = dispatch_pending_jobs()
            self.stdout.write(
                self.style.SUCCESS(
                    f"[DISPATCH ENGINE] Completed single pass: {result['pending_jobs_found']} pending found, "
                    f"{result['dispatched_count']} offered, {result['unassigned_count']} unassigned, "
                    f"{result['expired_offers_swept']} expired offers swept."
                )
            )
            for detail in result.get("details", []):
                self.stdout.write(f"  - Job #{detail['job_id']}: {detail['message']}")
            return

        # Continuous reconciliation loop
        self.stdout.write(self.style.WARNING(f"[DISPATCH ENGINE] Running in continuous daemon mode (Ctrl+C to stop)..."))
        try:
            while True:
                try:
                    result = dispatch_pending_jobs()
                    if result["pending_jobs_found"] > 0 or result["expired_offers_swept"] > 0:
                        self.stdout.write(
                            f"[DISPATCH] Swept {result['expired_offers_swept']} expired, "
                            f"Evaluated {result['pending_jobs_found']} pending -> {result['dispatched_count']} offered."
                        )
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"[DISPATCH ERROR] Error during reconciliation cycle: {exc}"))

                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS("[DISPATCH ENGINE] Stopped by user."))
            sys.exit(0)
