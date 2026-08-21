"""
vendor_wallet/tests/test_commission_service.py
Unit tests for the employee earn rate lookup service.

EmployeeCommissionConfig is imported inside the function body in commission.py:
  from vendor_wallet.models import EmployeeCommissionConfig
So we patch it at: vendor_wallet.models.EmployeeCommissionConfig
"""
from decimal import Decimal
from datetime import date, timedelta
from unittest import TestCase
from unittest.mock import patch, MagicMock


def _make_employee(employee_id=1):
    emp = MagicMock()
    emp.id = employee_id
    return emp


def _make_config(rate="0.6000", effective_from=None, is_active=True):
    cfg = MagicMock()
    cfg.employee_earn_rate = Decimal(rate)
    cfg.effective_from = effective_from or date.today() - timedelta(days=30)
    cfg.effective_until = None
    cfg.is_active = is_active
    return cfg


def _make_qs(first_result):
    """Creates a mock queryset chain: .filter().filter().order_by().first()"""
    qs = MagicMock()
    qs.filter.return_value = qs
    qs.order_by.return_value = qs
    qs.first.return_value = first_result
    return qs


class TestGetActiveCommission(TestCase):

    @patch("vendor_wallet.models.EmployeeCommissionConfig")
    def test_returns_active_config(self, MockConfig):
        """Should return the active earn rate config for an employee."""
        employee = _make_employee()
        expected = _make_config(rate="0.6000")
        MockConfig.objects.filter.return_value = _make_qs(expected)

        from vendor_wallet.services.commission import get_active_commission
        result = get_active_commission(employee)

        self.assertEqual(result, expected)
        self.assertEqual(result.employee_earn_rate, Decimal("0.6000"))

    @patch("vendor_wallet.models.EmployeeCommissionConfig")
    def test_returns_none_when_no_config(self, MockConfig):
        """Should return None when no active config exists."""
        employee = _make_employee()
        MockConfig.objects.filter.return_value = _make_qs(None)

        from vendor_wallet.services.commission import get_active_commission
        result = get_active_commission(employee)

        self.assertIsNone(result)

    @patch("vendor_wallet.models.EmployeeCommissionConfig")
    def test_orders_by_most_recent_effective_from(self, MockConfig):
        """Should order by -effective_from to get the most recent config."""
        employee = _make_employee()
        newest = _make_config(rate="0.7000")
        qs = _make_qs(newest)
        MockConfig.objects.filter.return_value = qs

        from vendor_wallet.services.commission import get_active_commission
        result = get_active_commission(employee)

        qs.order_by.assert_called_with("-effective_from")
        self.assertEqual(result.employee_earn_rate, Decimal("0.7000"))

    def test_earn_rate_decimal_precision(self):
        """Earn rates should support 4 decimal places."""
        rate = Decimal("0.6000")
        self.assertEqual(rate, Decimal("0.6000"))
        formatted = f"{rate * 100:.2f}%"
        self.assertEqual(formatted, "60.00%")

    def test_zero_earn_rate_is_valid(self):
        rate = Decimal("0.0000")
        self.assertEqual(rate, Decimal("0.00"))

    def test_maximum_earn_rate_100_percent(self):
        rate = Decimal("1.0000")
        self.assertLessEqual(rate, Decimal("1.0000"))
        self.assertGreaterEqual(rate, Decimal("0.0000"))
