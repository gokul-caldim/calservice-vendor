"""
vendor_wallet/constants.py
Configuration constants for the Employee Wallet module.

Financial model:
  Job payment (gross) → employee gets employee_earn_rate% → company keeps remainder (GST + platform fee)

  Default employee earn rate: 60% (0.6000) — admin configures per employee via EmployeeCommissionConfig.
  Minimum withdrawal: ₹5,000 INR (self-service, no admin approval needed when KYC + bank account verified).
"""

# ── Settlement ────────────────────────────────────────────────────────────────
WALLET_SETTLEMENT_HOLD_DAYS: int = 7   # T+7 — earned amount moves from pending → available

# ── Withdrawal ────────────────────────────────────────────────────────────────
MIN_WITHDRAWAL_AMOUNT = "5000.00"   # INR — minimum balance required for self-service withdrawal

# ── Transaction Types ─────────────────────────────────────────────────────────
TXN_SERVICE_EARNING = "SERVICE_EARNING"
TXN_PLATFORM_DEDUCTION = "PLATFORM_DEDUCTION"   # company's share (shown in ledger for transparency)
TXN_REFUND = "REFUND"
TXN_RECOVERY_DEBIT = "RECOVERY_DEBIT"
TXN_RECOVERY_CREDIT = "RECOVERY_CREDIT"
TXN_WITHDRAWAL = "WITHDRAWAL"
TXN_WITHDRAWAL_REVERSAL = "WITHDRAWAL_REVERSAL"
TXN_ADJUSTMENT_CREDIT = "ADJUSTMENT_CREDIT"
TXN_ADJUSTMENT_DEBIT = "ADJUSTMENT_DEBIT"
TXN_SETTLEMENT_RELEASE = "SETTLEMENT_RELEASE"
TXN_REVERSAL = "REVERSAL"

# ── Reference Types ───────────────────────────────────────────────────────────
REF_JOB_PAYMENT = "JOB_PAYMENT"
REF_WITHDRAWAL = "WITHDRAWAL"
REF_SETTLEMENT = "SETTLEMENT_RELEASE"
REF_REFUND = "REFUND"
REF_RECOVERY = "RECOVERY"
REF_ADJUSTMENT = "ADJUSTMENT"
REF_REVERSAL = "REVERSAL"

# ── Balance Types ─────────────────────────────────────────────────────────────
BALANCE_PENDING = "PENDING"
BALANCE_AVAILABLE = "AVAILABLE"

# ── Wallet Statuses ───────────────────────────────────────────────────────────
WALLET_ACTIVE = "ACTIVE"
WALLET_SUSPENDED = "SUSPENDED"
WALLET_LOCKED = "LOCKED"
WALLET_CLOSED = "CLOSED"

# ── Withdrawal Statuses (simplified — self-service, no admin approval step) ───
WITHDRAWAL_REQUESTED = "REQUESTED"
WITHDRAWAL_PROCESSING = "PROCESSING"
WITHDRAWAL_COMPLETED = "COMPLETED"
WITHDRAWAL_FAILED = "FAILED"
WITHDRAWAL_CANCELLED = "CANCELLED"

# Employee can cancel only while in REQUESTED status
WITHDRAWAL_EMPLOYEE_CANCELLABLE = {WITHDRAWAL_REQUESTED}

# Terminal statuses — no further transitions
WITHDRAWAL_TERMINAL = {
    WITHDRAWAL_COMPLETED,
    WITHDRAWAL_FAILED,
    WITHDRAWAL_CANCELLED,
}

# ── Transaction Statuses ──────────────────────────────────────────────────────
TXN_STATUS_COMPLETED = "COMPLETED"
TXN_STATUS_PENDING_SETTLEMENT = "PENDING_SETTLEMENT"
TXN_STATUS_REVERSED = "REVERSED"
TXN_STATUS_FAILED = "FAILED"

# ── Directions ────────────────────────────────────────────────────────────────
DIRECTION_CREDIT = "CREDIT"
DIRECTION_DEBIT = "DEBIT"

# ── Payout Account ────────────────────────────────────────────────────────────
PAYOUT_ACCOUNT_PENDING = "PENDING"
PAYOUT_ACCOUNT_VERIFIED = "VERIFIED"
PAYOUT_ACCOUNT_REJECTED = "REJECTED"
