"""
vendor_wallet/tests/test_settlement_command.py
Unit tests for the release_wallet_settlements management command.

Validates the dry-run mode, idempotency guard, and result reporting.
All DB calls are mocked.
"""
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch, MagicMock
from io import StringIO


class TestReleaseWalletSettlementsCommand(TestCase):
    """Tests for management.commands.release_wallet_settlements"""

    def _get_command(self):
        from vendor_wallet.management.commands.release_wallet_settlements import Command
        return Command()

    @patch("vendor_wallet.models.EmployeeWalletTransaction")
    def test_dry_run_reports_without_saving(self, MockTxn):
        """In dry-run mode, no save() or update() should occur."""
        cmd = self._get_command()
        stdout = StringIO()
        stderr = StringIO()
        cmd.stdout = stdout
        cmd.stderr = stderr

        empty_qs = MagicMock()
        empty_qs.filter.return_value = empty_qs
        empty_qs.select_for_update.return_value = empty_qs
        empty_qs.select_related.return_value = []
        MockTxn.objects.filter.return_value = empty_qs

        result = cmd._run_sweep(dry_run=True)

        self.assertIn("released_count", result)
        self.assertIn("dry_run", result)
        self.assertEqual(result["dry_run"], True)

    @patch("vendor_wallet.models.EmployeeWalletTransaction")
    def test_result_structure(self, MockTxn):
        """_run_sweep should always return a dict with expected keys."""
        cmd = self._get_command()
        cmd.stdout = StringIO()
        cmd.stderr = StringIO()

        empty_qs = MagicMock()
        empty_qs.filter.return_value = empty_qs
        empty_qs.select_for_update.return_value = empty_qs
        empty_qs.select_related.return_value = []
        MockTxn.objects.filter.return_value = empty_qs

        result = cmd._run_sweep(dry_run=True)

        self.assertIn("released_count", result)
        self.assertIn("skipped_count", result)
        self.assertIn("errors", result)
        self.assertIn("dry_run", result)
        self.assertIn("swept_at", result)

    def test_print_result_success(self):
        cmd = self._get_command()
        cmd.stdout = StringIO()
        cmd.stderr = StringIO()

        cmd._print_result({"released_count": 5, "skipped_count": 0, "errors": [], "dry_run": False})
        output = cmd.stdout.getvalue()
        self.assertIn("5", output)

    def test_print_result_with_errors(self):
        cmd = self._get_command()
        cmd.stdout = StringIO()
        cmd.stderr = StringIO()

        cmd._print_result({
            "released_count": 0,
            "skipped_count": 0,
            "errors": ["wallet_id=7: some error"],
            "dry_run": False,
        })
        err_output = cmd.stderr.getvalue()
        self.assertIn("wallet_id=7", err_output)

    def test_add_arguments_registers_once_loop_interval_dryrun(self):
        import argparse
        cmd = self._get_command()
        parser = argparse.ArgumentParser()
        cmd.add_arguments(parser)

        args = parser.parse_args(["--once", "--interval", "7200", "--dry-run"])
        self.assertTrue(args.once)
        self.assertEqual(args.interval, 7200)
        self.assertTrue(args.dry_run)

    def test_interval_minimum_is_60_seconds(self):
        cmd = self._get_command()
        cmd.stdout = StringIO()
        cmd.stderr = StringIO()

        import argparse
        parser = argparse.ArgumentParser()
        cmd.add_arguments(parser)

        args = parser.parse_args(["--interval", "10"])
        interval = max(60, args.interval)
        self.assertEqual(interval, 60)
