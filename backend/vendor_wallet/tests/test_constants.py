"""
vendor_wallet/tests/test_constants.py
Tests that constants and exception definitions are correct and consistent.
"""
from decimal import Decimal
from unittest import TestCase


class TestConstants(TestCase):
    """Validates that all constant values are self-consistent and correctly typed."""

    def test_wallet_status_constants(self):
        from vendor_wallet.constants import (
            WALLET_ACTIVE, WALLET_SUSPENDED, WALLET_LOCKED, WALLET_CLOSED,
        )
        self.assertEqual(WALLET_ACTIVE, "ACTIVE")
        self.assertEqual(WALLET_SUSPENDED, "SUSPENDED")
        self.assertEqual(WALLET_LOCKED, "LOCKED")
        self.assertEqual(WALLET_CLOSED, "CLOSED")

    def test_transaction_type_constants(self):
        from vendor_wallet.constants import (
            TXN_SERVICE_EARNING, TXN_PLATFORM_DEDUCTION, TXN_REFUND,
            TXN_RECOVERY_DEBIT, TXN_WITHDRAWAL, TXN_ADJUSTMENT_CREDIT,
            TXN_ADJUSTMENT_DEBIT, TXN_SETTLEMENT_RELEASE,
        )
        for const in [TXN_SERVICE_EARNING, TXN_PLATFORM_DEDUCTION, TXN_REFUND,
                      TXN_RECOVERY_DEBIT, TXN_WITHDRAWAL, TXN_ADJUSTMENT_CREDIT,
                      TXN_ADJUSTMENT_DEBIT, TXN_SETTLEMENT_RELEASE]:
            self.assertIsInstance(const, str)
            self.assertTrue(len(const) > 0)

    def test_direction_constants(self):
        from vendor_wallet.constants import DIRECTION_CREDIT, DIRECTION_DEBIT
        self.assertEqual(DIRECTION_CREDIT, "CREDIT")
        self.assertEqual(DIRECTION_DEBIT, "DEBIT")

    def test_balance_type_constants(self):
        from vendor_wallet.constants import BALANCE_AVAILABLE, BALANCE_PENDING
        self.assertEqual(BALANCE_AVAILABLE, "AVAILABLE")
        self.assertEqual(BALANCE_PENDING, "PENDING")

    def test_status_constants(self):
        from vendor_wallet.constants import (
            TXN_STATUS_COMPLETED, TXN_STATUS_PENDING_SETTLEMENT,
            TXN_STATUS_REVERSED, TXN_STATUS_FAILED,
        )
        for const in [TXN_STATUS_COMPLETED, TXN_STATUS_PENDING_SETTLEMENT,
                      TXN_STATUS_REVERSED, TXN_STATUS_FAILED]:
            self.assertIsInstance(const, str)

    def test_withdrawal_status_machine_completeness(self):
        from vendor_wallet.constants import (
            WITHDRAWAL_REQUESTED, WITHDRAWAL_PROCESSING,
            WITHDRAWAL_COMPLETED, WITHDRAWAL_FAILED, WITHDRAWAL_CANCELLED,
        )
        all_statuses = [
            WITHDRAWAL_REQUESTED, WITHDRAWAL_PROCESSING,
            WITHDRAWAL_COMPLETED, WITHDRAWAL_FAILED, WITHDRAWAL_CANCELLED,
        ]
        for s in all_statuses:
            self.assertIsInstance(s, str)
            self.assertTrue(len(s) > 0)

    def test_employee_cancellable_statuses_subset(self):
        from vendor_wallet.constants import WITHDRAWAL_EMPLOYEE_CANCELLABLE, WITHDRAWAL_REQUESTED
        self.assertIn(WITHDRAWAL_REQUESTED, WITHDRAWAL_EMPLOYEE_CANCELLABLE)

    def test_min_withdrawal_amount(self):
        from vendor_wallet.constants import MIN_WITHDRAWAL_AMOUNT
        self.assertEqual(MIN_WITHDRAWAL_AMOUNT, "5000.00")

    def test_settlement_days_positive(self):
        from vendor_wallet.constants import WALLET_SETTLEMENT_HOLD_DAYS
        self.assertGreater(WALLET_SETTLEMENT_HOLD_DAYS, 0)
        self.assertEqual(WALLET_SETTLEMENT_HOLD_DAYS, 7)  # T+7 as per spec

    def test_ref_type_constants(self):
        from vendor_wallet.constants import (
            REF_JOB_PAYMENT, REF_REFUND, REF_WITHDRAWAL, REF_ADJUSTMENT, REF_RECOVERY, REF_SETTLEMENT,
        )
        for const in [REF_JOB_PAYMENT, REF_REFUND, REF_WITHDRAWAL, REF_ADJUSTMENT, REF_RECOVERY, REF_SETTLEMENT]:
            self.assertIsInstance(const, str)


class TestExceptions(TestCase):
    """Tests that all exception classes are defined and have correct names."""

    def test_wallet_error_base(self):
        from vendor_wallet.exceptions import WalletError
        exc = WalletError("test")
        self.assertIsInstance(exc, Exception)
        self.assertEqual(str(exc), "test")

    def test_insufficient_balance_error_is_wallet_error(self):
        from vendor_wallet.exceptions import InsufficientBalanceError, WalletError
        exc = InsufficientBalanceError("low")
        self.assertIsInstance(exc, WalletError)

    def test_withdrawal_eligibility_error(self):
        from vendor_wallet.exceptions import WithdrawalEligibilityError, WalletError
        exc = WithdrawalEligibilityError("not eligible")
        self.assertIsInstance(exc, WalletError)
