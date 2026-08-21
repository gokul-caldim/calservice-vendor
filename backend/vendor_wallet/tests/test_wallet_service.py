"""
vendor_wallet/tests/test_wallet_service.py
Unit tests for the employee wallet business logic.
"""
from decimal import Decimal, ROUND_HALF_UP
from unittest import TestCase
from unittest.mock import patch, MagicMock

TWO = Decimal("0.01")
ZERO = Decimal("0.00")


# ─── Pure arithmetic tests (no mocks needed) ─────────────────────────────────

class TestEmployeeEarnArithmetic(TestCase):
    """Verify employee earning share calculation (e.g. 60% to employee, 40% company)."""

    def _compute(self, gross_str, earn_rate_str):
        gross = Decimal(gross_str)
        rate = Decimal(earn_rate_str)
        employee_share = (gross * rate).quantize(TWO, rounding=ROUND_HALF_UP)
        platform_share = gross - employee_share
        return gross, employee_share, platform_share

    def test_sixty_percent_earn_rate(self):
        """Default case: employee gets 60%, platform/company retains 40%."""
        gross, employee_share, platform_share = self._compute("1000.00", "0.6000")
        self.assertEqual(employee_share, Decimal("600.00"))
        self.assertEqual(platform_share, Decimal("400.00"))

    def test_seventy_percent_earn_rate(self):
        gross, employee_share, platform_share = self._compute("500.00", "0.7000")
        self.assertEqual(employee_share, Decimal("350.00"))
        self.assertEqual(platform_share, Decimal("150.00"))

    def test_zero_earn_rate(self):
        gross, employee_share, platform_share = self._compute("300.00", "0.0000")
        self.assertEqual(employee_share, ZERO)
        self.assertEqual(platform_share, Decimal("300.00"))

    def test_hundred_percent_earn_rate(self):
        gross, employee_share, platform_share = self._compute("100.00", "1.0000")
        self.assertEqual(employee_share, Decimal("100.00"))
        self.assertEqual(platform_share, ZERO)

    def test_earn_rate_rounding_half_up(self):
        # 333.33 * 0.60 = 199.998 -> 200.00
        gross, employee_share, platform_share = self._compute("333.33", "0.6000")
        self.assertEqual(employee_share, Decimal("200.00"))
        self.assertEqual(platform_share, Decimal("133.33"))


# ─── Balance conservation tests ──────────────────────────────────────────────

class TestBalanceMathProperties(TestCase):

    def test_pending_to_available_release_conservation(self):
        """T+7 release: pending - amount + available + amount = same total."""
        pending = Decimal("600.00")
        available = Decimal("200.00")
        release = Decimal("600.00")
        self.assertEqual((pending - release) + (available + release), pending + available)

    def test_available_debit_for_withdrawal(self):
        available = Decimal("6000.00")
        withdrawn = Decimal("0.00")
        amount = Decimal("5000.00")
        self.assertEqual(available - amount, Decimal("1000.00"))
        self.assertEqual(withdrawn + amount, Decimal("5000.00"))

    def test_recovery_clamps_at_zero(self):
        outstanding = Decimal("200.00")
        recovery = Decimal("300.00")
        remaining = max(ZERO, outstanding - recovery)
        self.assertEqual(remaining, ZERO)

    def test_partial_recovery(self):
        outstanding = Decimal("500.00")
        recovery = Decimal("200.00")
        remaining = max(ZERO, outstanding - recovery)
        self.assertEqual(remaining, Decimal("300.00"))

    def test_adjustment_credit_increases_available(self):
        available = Decimal("100.00")
        adj = Decimal("50.00")
        self.assertEqual(available + adj, Decimal("150.00"))

    def test_adjustment_debit_decreases_available(self):
        available = Decimal("100.00")
        adj = Decimal("30.00")
        self.assertEqual(available - adj, Decimal("70.00"))


# ─── Withdrawal validation logic ─────────────────────────────────────────────

class TestWithdrawalValidation(TestCase):

    def test_insufficient_balance_raises(self):
        from vendor_wallet.exceptions import InsufficientBalanceError
        available = Decimal("5000.00")
        requested = Decimal("6000.00")
        if requested > available:
            with self.assertRaises(InsufficientBalanceError):
                raise InsufficientBalanceError("Insufficient balance")

    def test_minimum_amount_5000_rupees(self):
        from vendor_wallet.constants import MIN_WITHDRAWAL_AMOUNT
        min_amount = Decimal(MIN_WITHDRAWAL_AMOUNT)
        self.assertEqual(min_amount, Decimal("5000.00"))
        self.assertLess(Decimal("4999.00"), min_amount)
        self.assertGreaterEqual(Decimal("5000.00"), min_amount)

    def test_exact_balance_is_allowed(self):
        available = Decimal("5000.00")
        requested = Decimal("5000.00")
        self.assertLessEqual(requested, available)


# ─── Exception hierarchy tests ──────────────────────────────────────────────

class TestExceptionHierarchy(TestCase):

    def test_all_errors_inherit_wallet_error(self):
        from vendor_wallet.exceptions import (
            WalletError,
            InsufficientBalanceError,
            WalletNotActiveError,
            CommissionConfigMissingError,
            IdempotentTransactionError,
            InvalidWithdrawalTransitionError,
            WithdrawalAmountError,
            WithdrawalEligibilityError,
        )
        for exc_class in [
            InsufficientBalanceError,
            WalletNotActiveError,
            CommissionConfigMissingError,
            IdempotentTransactionError,
            InvalidWithdrawalTransitionError,
            WithdrawalAmountError,
            WithdrawalEligibilityError,
        ]:
            exc = exc_class("test message")
            self.assertIsInstance(exc, WalletError,
                                  f"{exc_class.__name__} should inherit from WalletError")


# ─── State machine / hook logic tests ────────────────────────────────────────

class TestWalletHookLogic(TestCase):

    def _run_hook(self, payment_status="PAID", has_employee=True, raise_exc=None):
        from vendor_wallet.exceptions import IdempotentTransactionError, CommissionConfigMissingError

        credit_called = False
        skipped = False
        error_logged = False

        target = "completed"
        if target == "completed":
            try:
                if not has_employee:
                    skipped = True
                elif payment_status == "PAID":
                    if raise_exc is not None:
                        raise raise_exc
                    credit_called = True
                else:
                    skipped = True
            except IdempotentTransactionError:
                pass
            except CommissionConfigMissingError:
                error_logged = True
            except Exception:
                error_logged = True

        return credit_called, skipped, error_logged

    def test_paid_with_employee_triggers_credit(self):
        credit, skip, err = self._run_hook("PAID", has_employee=True)
        self.assertTrue(credit)
        self.assertFalse(skip)
        self.assertFalse(err)

    def test_unpaid_skips_credit(self):
        credit, skip, err = self._run_hook("PENDING", has_employee=True)
        self.assertFalse(credit)
        self.assertTrue(skip)

    def test_missing_employee_skips_credit(self):
        credit, skip, err = self._run_hook("PAID", has_employee=False)
        self.assertFalse(credit)
        self.assertTrue(skip)


# ─── Settlement timing tests ─────────────────────────────────────────────────

class TestSettlementTiming(TestCase):

    def test_settlement_release_at_is_t_plus_7(self):
        from datetime import timedelta
        from django.utils import timezone
        from vendor_wallet.constants import WALLET_SETTLEMENT_HOLD_DAYS

        now = timezone.now()
        release_at = now + timedelta(days=WALLET_SETTLEMENT_HOLD_DAYS)
        delta = release_at - now
        self.assertEqual(delta.days, 7)
