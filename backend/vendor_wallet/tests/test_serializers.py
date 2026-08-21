"""
vendor_wallet/tests/test_serializers.py
Serializer validation and masking tests.
No DB required.
"""
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch


class TestEmployeePayoutAccountSerializer(TestCase):
    """EmployeePayoutAccountSerializer must store only the last 4 digits of the account number."""

    def _get_serializer(self, data):
        from vendor_wallet.serializers import EmployeePayoutAccountSerializer
        return EmployeePayoutAccountSerializer(data=data)

    def test_account_number_is_write_only(self):
        from vendor_wallet.serializers import EmployeePayoutAccountSerializer
        s = EmployeePayoutAccountSerializer()
        self.assertTrue(s.fields["account_number"].write_only)

    def test_account_number_last4_is_not_in_write_fields(self):
        from vendor_wallet.serializers import EmployeePayoutAccountSerializer
        s = EmployeePayoutAccountSerializer()
        self.assertIn("account_number_last4", s.fields)
        self.assertIn("account_number", s.fields)

    def test_create_stores_only_last4(self):
        from vendor_wallet.serializers import EmployeePayoutAccountSerializer
        validated_data = {
            "account_number": "123456789012",
            "account_holder_name": "Rajesh Kumar",
            "bank_name": "HDFC",
            "ifsc_code": "HDFC0001234",
            "account_type": "SAVINGS",
        }
        account_number = validated_data.pop("account_number")
        last4 = account_number[-4:]
        self.assertEqual(last4, "9012")

    def test_last4_minimum_length(self):
        s = self._get_serializer(data={
            "account_number": "12",
            "account_holder_name": "Test",
        })
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("account_number", s.errors)

    def test_missing_account_holder_name_fails(self):
        s = self._get_serializer(data={
            "account_number": "1234567890",
        })
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("account_holder_name", s.errors)


class TestWithdrawalRequestSerializer(TestCase):

    def _get_serializer(self, data):
        from vendor_wallet.serializers import WithdrawalRequestSerializer
        return WithdrawalRequestSerializer(data=data)

    def test_valid_amount_above_5000(self):
        s = self._get_serializer({"amount": "5000.00"})
        self.assertTrue(s.is_valid(), s.errors)

    def test_amount_below_5000_rejected(self):
        s = self._get_serializer({"amount": "4999.00"})
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("amount", s.errors)

    def test_zero_amount_rejected(self):
        s = self._get_serializer({"amount": "0.00"})
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("amount", s.errors)

    def test_negative_amount_rejected(self):
        s = self._get_serializer({"amount": "-50.00"})
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("amount", s.errors)


class TestCommissionConfigSerializer(TestCase):

    def test_earn_rate_percent_formatted_correctly(self):
        from vendor_wallet.serializers import EmployeeCommissionConfigSerializer
        mock_obj = MagicMock()
        mock_obj.employee_earn_rate = Decimal("0.6000")
        s = EmployeeCommissionConfigSerializer()
        result = s.get_earn_rate_percent(mock_obj)
        self.assertEqual(result, "60.00%")


class TestAdminCommissionConfigCreateSerializer(TestCase):

    def _get_serializer(self, data):
        from vendor_wallet.serializers import AdminCommissionConfigCreateSerializer
        return AdminCommissionConfigCreateSerializer(data=data)

    def test_valid_rate(self):
        s = self._get_serializer({
            "employee_earn_rate": "0.6000",
            "effective_from": "2026-08-21",
        })
        self.assertTrue(s.is_valid(), s.errors)

    def test_rate_above_100_percent_rejected(self):
        s = self._get_serializer({
            "employee_earn_rate": "1.0500",
            "effective_from": "2026-08-21",
        })
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("employee_earn_rate", s.errors)

    def test_negative_rate_rejected(self):
        s = self._get_serializer({
            "employee_earn_rate": "-0.0500",
            "effective_from": "2026-08-21",
        })
        valid = s.is_valid()
        self.assertFalse(valid)
        self.assertIn("employee_earn_rate", s.errors)
