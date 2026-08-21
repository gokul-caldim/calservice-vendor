"""
vendor_wallet/models.py  —  REVISED: Employee-owned wallet

Financial model:
  Job payment (gross) → Employee gets employee_earn_rate% → Company gets remainder (incl. GST)

  Example: gross = ₹1000, employee_earn_rate = 0.6000
    Employee wallet: +₹600  (pending → T+7 → available)
    Company share:    ₹400  (GST, platform fee — not tracked in this wallet)

Withdrawal rules (self-service, no admin approval):
  - Employee KYC must be complete
  - At least one VERIFIED bank account linked
  - Available balance ≥ INR 5,000 (MIN_WITHDRAWAL_AMOUNT constant)
"""
from decimal import Decimal

from django.db import models
from django.utils import timezone

from vendor_wallet.constants import (
    WALLET_ACTIVE, WALLET_SUSPENDED, WALLET_LOCKED, WALLET_CLOSED,
    TXN_STATUS_COMPLETED, TXN_STATUS_PENDING_SETTLEMENT, TXN_STATUS_REVERSED, TXN_STATUS_FAILED,
    DIRECTION_CREDIT, DIRECTION_DEBIT,
    BALANCE_PENDING, BALANCE_AVAILABLE,
    WITHDRAWAL_REQUESTED, WITHDRAWAL_PROCESSING, WITHDRAWAL_COMPLETED,
    WITHDRAWAL_FAILED, WITHDRAWAL_CANCELLED,
    PAYOUT_ACCOUNT_PENDING, PAYOUT_ACCOUNT_VERIFIED, PAYOUT_ACCOUNT_REJECTED,
)

ZERO = Decimal("0.00")


# ── 1. Employee Commission Configuration ──────────────────────────────────────

class EmployeeCommissionConfig(models.Model):
    """
    Per-employee earning rate configuration.

    employee_earn_rate is stored as a decimal fraction: 0.6000 = 60.00%.
    This is the fraction of the gross job payment credited to the employee's wallet.
    The company retains (1 - employee_earn_rate) of the gross, covering GST and platform margin.

    Multiple records can exist per employee to represent rate history.
    The currently active rate is the record with:
      effective_from <= today AND (effective_until IS NULL OR effective_until >= today) AND is_active=True

    Transactions snapshot the rate at the time they are created in commission_rate_snapshot.
    Historical transactions are NEVER recalculated when this config changes.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="commission_configs",
        db_index=True,
    )
    # Employee's earning share: 0.6000 = employee gets 60% of gross job payment
    employee_earn_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        help_text="Decimal fraction: 0.6000 = 60.00% goes to employee. Range: 0.0000–1.0000.",
    )
    effective_from = models.DateField()
    effective_until = models.DateField(
        null=True,
        blank=True,
        help_text="NULL means this rate is currently active with no expiry.",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="commission_configs_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_commission_config"
        ordering = ["-effective_from"]
        indexes = [
            models.Index(fields=["employee", "is_active", "effective_from"], name="ecc_employee_active_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(employee_earn_rate__gte=Decimal("0.0000"))
                    & models.Q(employee_earn_rate__lte=Decimal("1.0000")),
                name="ecc_valid_earn_rate",
            ),
        ]

    def __str__(self):
        return f"CommissionConfig[employee={self.employee_id} rate={self.employee_earn_rate} from={self.effective_from}]"


# ── 2. Employee Wallet ─────────────────────────────────────────────────────────

class EmployeeWallet(models.Model):
    """
    Individual employee financial wallet. One wallet per Employee (UNIQUE constraint).

    available_balance: funds the employee can withdraw right now.
    pending_balance:   funds in T+7 settlement hold — not yet withdrawable.

    Balance fields are CACHED AGGREGATES. The authoritative source of truth is
    EmployeeWalletTransaction. Use `reconcile_wallets` management command to verify.

    Withdrawal eligibility (enforced by wallet_service.request_withdrawal):
      - status == ACTIVE
      - KYC approved (employee.registration_status == 'approved')
      - At least one VERIFIED payout account linked
      - available_balance >= MIN_WITHDRAWAL_AMOUNT (₹5,000)
    """
    WALLET_STATUS_CHOICES = [
        (WALLET_ACTIVE, "Active"),
        (WALLET_SUSPENDED, "Suspended"),
        (WALLET_LOCKED, "Locked"),
        (WALLET_CLOSED, "Closed"),
    ]

    employee = models.OneToOneField(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="wallet",
        unique=True,
    )
    # company is retained for tenant isolation in admin queries
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="employee_wallets",
        db_index=True,
    )
    currency = models.CharField(max_length=10, default="INR")
    status = models.CharField(max_length=20, choices=WALLET_STATUS_CHOICES, default=WALLET_ACTIVE, db_index=True)

    # Cached balance aggregates (reconcilable from ledger)
    available_balance = models.DecimalField(max_digits=15, decimal_places=2, default=ZERO)
    pending_balance = models.DecimalField(max_digits=15, decimal_places=2, default=ZERO)
    lifetime_earnings = models.DecimalField(max_digits=15, decimal_places=2, default=ZERO)
    total_withdrawn = models.DecimalField(max_digits=15, decimal_places=2, default=ZERO)
    outstanding_recovery = models.DecimalField(max_digits=15, decimal_places=2, default=ZERO)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_wallet"

    def __str__(self):
        return f"Wallet[employee={self.employee_id} avail={self.available_balance} pending={self.pending_balance}]"

    @property
    def is_active(self):
        return self.status == WALLET_ACTIVE

    @property
    def next_settlement_date(self):
        """Returns the earliest settlement_release_at among PENDING_SETTLEMENT transactions, or None."""
        txn = self.transactions.filter(
            status=TXN_STATUS_PENDING_SETTLEMENT,
        ).order_by("settlement_release_at").first()
        return txn.settlement_release_at if txn else None


# ── 3. Employee Wallet Transaction (Immutable Ledger) ─────────────────────────

class EmployeeWalletTransaction(models.Model):
    """
    Immutable ledger entry. Every balance change produces at least one record here.

    KEY INVARIANT: Records are NEVER deleted or modified after creation.
    To reverse a transaction, create a compensating entry.

    Idempotency enforced via UNIQUE (reference_type, reference_id).
    """
    TXN_TYPE_CHOICES = [
        ("SERVICE_EARNING", "Service Earning"),
        ("PLATFORM_DEDUCTION", "Platform Deduction"),   # company's share — shown for transparency
        ("REFUND", "Refund Debit"),
        ("RECOVERY_DEBIT", "Recovery Debit"),
        ("RECOVERY_CREDIT", "Recovery Credit"),
        ("WITHDRAWAL", "Withdrawal"),
        ("WITHDRAWAL_REVERSAL", "Withdrawal Reversal"),
        ("ADJUSTMENT_CREDIT", "Admin Adjustment Credit"),
        ("ADJUSTMENT_DEBIT", "Admin Adjustment Debit"),
        ("SETTLEMENT_RELEASE", "Settlement Release"),
        ("REVERSAL", "Reversal"),
    ]
    STATUS_CHOICES = [
        (TXN_STATUS_COMPLETED, "Completed"),
        (TXN_STATUS_PENDING_SETTLEMENT, "Pending Settlement"),
        (TXN_STATUS_REVERSED, "Reversed"),
        (TXN_STATUS_FAILED, "Failed"),
    ]
    DIRECTION_CHOICES = [
        (DIRECTION_CREDIT, "Credit"),
        (DIRECTION_DEBIT, "Debit"),
    ]
    BALANCE_TYPE_CHOICES = [
        (BALANCE_PENDING, "Pending"),
        (BALANCE_AVAILABLE, "Available"),
    ]

    wallet = models.ForeignKey(EmployeeWallet, on_delete=models.CASCADE, related_name="transactions", db_index=True)

    # Idempotency — unique per reference pair
    reference_type = models.CharField(max_length=50, db_index=True)
    reference_id = models.CharField(max_length=100, db_index=True)

    transaction_type = models.CharField(max_length=50, choices=TXN_TYPE_CHOICES, db_index=True)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=TXN_STATUS_COMPLETED, db_index=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    # Financial breakdown snapshot for SERVICE_EARNING transactions
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    earn_rate_snapshot = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True,
        help_text="Employee earn rate at time of transaction. Never recalculated.",
    )
    platform_deduction_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Amount retained by platform/company (gross - employee_amount).",
    )

    # Balance audit trail
    balance_before = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2)
    balance_type = models.CharField(max_length=20, choices=BALANCE_TYPE_CHOICES, default=BALANCE_AVAILABLE)

    # Settlement fields
    settlement_release_at = models.DateTimeField(null=True, blank=True, db_index=True)
    released_at = models.DateTimeField(null=True, blank=True)

    description = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    # Cross-reference
    service_request_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    job_payment_id = models.BigIntegerField(null=True, blank=True)
    withdrawal = models.ForeignKey(
        "EmployeeWalletWithdrawal",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_transactions_created",
    )

    class Meta:
        db_table = "employee_wallet_transaction"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["reference_type", "reference_id"],
                name="ewt_idempotency_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["wallet", "-created_at"], name="ewt_wallet_created_idx"),
            models.Index(fields=["transaction_type", "status"], name="ewt_type_status_idx"),
            models.Index(
                fields=["status", "settlement_release_at"],
                name="ewt_settlement_idx",
                condition=models.Q(status="PENDING_SETTLEMENT"),
            ),
        ]

    def __str__(self):
        return (
            f"WalletTxn[{self.transaction_type} {self.direction} {self.amount} "
            f"ref={self.reference_type}:{self.reference_id}]"
        )


# ── 4. Employee Payout Account ────────────────────────────────────────────────

class EmployeePayoutAccount(models.Model):
    """
    Employee's bank account for withdrawal disbursement.

    SECURITY: Full account numbers are NEVER stored — only last 4 digits.

    Withdrawal eligibility requires at least one VERIFIED account.
    KYC approval and account verification are prerequisites for self-service withdrawal.
    """
    ACCOUNT_TYPE_CHOICES = [
        ("SAVINGS", "Savings"),
        ("CURRENT", "Current"),
    ]
    VERIFICATION_STATUS_CHOICES = [
        (PAYOUT_ACCOUNT_PENDING, "Pending Verification"),
        (PAYOUT_ACCOUNT_VERIFIED, "Verified"),
        (PAYOUT_ACCOUNT_REJECTED, "Rejected"),
    ]

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="payout_accounts",
        db_index=True,
    )
    account_holder_name = models.CharField(max_length=200)
    bank_name = models.CharField(max_length=200, blank=True, default="")
    account_number_last4 = models.CharField(max_length=4, blank=True, default="")
    ifsc_code = models.CharField(max_length=20, blank=True, default="")
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, default="SAVINGS")

    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default=PAYOUT_ACCOUNT_PENDING,
    )
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payout_accounts_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_payout_account"
        ordering = ["-is_primary", "-created_at"]

    def __str__(self):
        return f"PayoutAccount[employee={self.employee_id} bank={self.bank_name} ****{self.account_number_last4}]"


# ── 5. Employee Wallet Withdrawal ─────────────────────────────────────────────

class EmployeeWalletWithdrawal(models.Model):
    """
    Self-service withdrawal by an Employee.

    State Machine:
      REQUESTED → PROCESSING → COMPLETED
                → FAILED
                → CANCELLED  (employee-initiated, only from REQUESTED)

    Eligibility enforced at request time:
      - Wallet status == ACTIVE
      - Employee registration_status == 'approved' (KYC complete)
      - At least one VERIFIED payout account
      - available_balance >= MIN_WITHDRAWAL_AMOUNT (₹5,000)

    Balance is debited immediately on REQUESTED (held in pending withdrawal).
    Returned to available on CANCELLED or FAILED.
    """
    STATUS_CHOICES = [
        (WITHDRAWAL_REQUESTED, "Requested"),
        (WITHDRAWAL_PROCESSING, "Processing"),
        (WITHDRAWAL_COMPLETED, "Completed"),
        (WITHDRAWAL_FAILED, "Failed"),
        (WITHDRAWAL_CANCELLED, "Cancelled"),
    ]

    wallet = models.ForeignKey(EmployeeWallet, on_delete=models.CASCADE, related_name="withdrawals")
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="withdrawals",
        db_index=True,
    )
    payout_account = models.ForeignKey(
        EmployeePayoutAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="withdrawals",
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="INR")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=WITHDRAWAL_REQUESTED, db_index=True)
    payment_method = models.CharField(max_length=50, default="BANK_TRANSFER")

    # Timeline
    requested_at = models.DateTimeField(auto_now_add=True)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Processing details
    bank_transaction_id = models.CharField(max_length=200, blank=True, null=True)
    failure_reason = models.TextField(blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    # Actor audit
    requested_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="withdrawals_requested",
    )
    processed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="withdrawals_processed",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_wallet_withdrawal"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["employee", "status"], name="eww_employee_status_idx"),
            models.Index(fields=["wallet", "-created_at"], name="eww_wallet_created_idx"),
        ]

    def __str__(self):
        return f"Withdrawal[#{self.id} employee={self.employee_id} amount={self.amount} status={self.status}]"
