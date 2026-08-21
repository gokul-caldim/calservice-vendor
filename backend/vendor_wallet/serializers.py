"""
vendor_wallet/serializers.py
DRF serializers for the Employee Wallet module.
"""
from decimal import Decimal
from rest_framework import serializers

from vendor_wallet.models import (
    EmployeeWallet, EmployeeWalletTransaction,
    EmployeeWalletWithdrawal, EmployeePayoutAccount,
    EmployeeCommissionConfig,
)
from vendor_wallet.constants import MIN_WITHDRAWAL_AMOUNT


class EmployeeWalletSummarySerializer(serializers.ModelSerializer):
    """Read-only wallet summary for the employee dashboard."""
    employee_name = serializers.SerializerMethodField()
    next_settlement_date = serializers.DateTimeField(read_only=True)

    class Meta:
        model = EmployeeWallet
        fields = [
            "id",
            "employee_id",
            "employee_name",
            "currency",
            "status",
            "available_balance",
            "pending_balance",
            "lifetime_earnings",
            "total_withdrawn",
            "outstanding_recovery",
            "next_settlement_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        try:
            return obj.employee.user.get_full_name() or obj.employee.user.email
        except Exception:
            return None


class EmployeeWalletTransactionSerializer(serializers.ModelSerializer):
    """Ledger transaction detail serializer."""
    class Meta:
        model = EmployeeWalletTransaction
        fields = [
            "id",
            "reference_type",
            "reference_id",
            "transaction_type",
            "direction",
            "status",
            "amount",
            "gross_amount",
            "earn_rate_snapshot",
            "platform_deduction_amount",
            "balance_before",
            "balance_after",
            "balance_type",
            "settlement_release_at",
            "released_at",
            "description",
            "service_request_id",
            "job_payment_id",
            "withdrawal_id",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields


class EmployeePayoutAccountSerializer(serializers.ModelSerializer):
    """Payout account — write: accepts full account number, stores only last 4 digits."""
    account_number = serializers.CharField(
        write_only=True,
        required=True,
        min_length=4,
        max_length=50,
        help_text="Full account number — only the last 4 digits are stored.",
    )

    class Meta:
        model = EmployeePayoutAccount
        fields = [
            "id",
            "account_holder_name",
            "bank_name",
            "account_number",          # write-only input
            "account_number_last4",    # read-only masked display
            "ifsc_code",
            "account_type",
            "verification_status",
            "is_primary",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "account_number_last4", "verification_status", "is_active", "created_at"]

    def create(self, validated_data):
        account_number = validated_data.pop("account_number")
        validated_data["account_number_last4"] = account_number[-4:]
        return super().create(validated_data)


class EmployeeWalletWithdrawalSerializer(serializers.ModelSerializer):
    payout_account_display = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeWalletWithdrawal
        fields = [
            "id",
            "amount",
            "currency",
            "status",
            "payment_method",
            "payout_account_id",
            "payout_account_display",
            "requested_at",
            "processing_started_at",
            "completed_at",
            "failed_at",
            "cancelled_at",
            "bank_transaction_id",
            "failure_reason",
            "remarks",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_payout_account_display(self, obj):
        if obj.payout_account:
            return {
                "id": obj.payout_account.id,
                "bank_name": obj.payout_account.bank_name,
                "account_number_last4": obj.payout_account.account_number_last4,
                "account_holder_name": obj.payout_account.account_holder_name,
            }
        return None


class WithdrawalRequestSerializer(serializers.Serializer):
    """Input for POST /wallet/withdrawals/"""
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal(MIN_WITHDRAWAL_AMOUNT),
        help_text=f"Minimum withdrawal amount: ₹{MIN_WITHDRAWAL_AMOUNT}",
    )
    payout_account_id = serializers.IntegerField(required=False, allow_null=True)


class AdminAdjustmentSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["CREDIT", "DEBIT"])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(min_length=3, max_length=1000)


class AdminWalletFreezeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ACTIVE", "SUSPENDED", "LOCKED", "CLOSED"])
    reason = serializers.CharField(min_length=3, max_length=500, required=False, default="")


class EmployeeCommissionConfigSerializer(serializers.ModelSerializer):
    earn_rate_percent = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeCommissionConfig
        fields = [
            "id",
            "employee_id",
            "employee_earn_rate",
            "earn_rate_percent",
            "effective_from",
            "effective_until",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "employee_id", "created_at", "updated_at", "earn_rate_percent"]

    def get_earn_rate_percent(self, obj):
        """Convenience field: employee_earn_rate as a percentage string."""
        return f"{obj.employee_earn_rate * 100:.2f}%"


class AdminCommissionConfigCreateSerializer(serializers.Serializer):
    employee_earn_rate = serializers.DecimalField(max_digits=5, decimal_places=4, min_value=Decimal("0.0000"), max_value=Decimal("1.0000"))
    effective_from = serializers.DateField()
    effective_until = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)

    def validate_employee_earn_rate(self, value):
        if value < Decimal("0.0000") or value > Decimal("1.0000"):
            raise serializers.ValidationError("employee_earn_rate must be between 0.0000 and 1.0000.")
        return value
