"""
vendor_wallet/services/wallet_service.py
Core financial operations for the Employee Wallet module.

Financial model:
  Job payment (gross) → employee gets employee_earn_rate% → company keeps remainder (GST + platform fee)

  Example: gross = ₹1000, employee_earn_rate = 0.6000
    EmployeeWallet pending_balance: +₹600
    Company share: ₹400 (not tracked here — company handles this separately)

Every function that modifies balances MUST:
  1. Open a database transaction (transaction.atomic())
  2. Acquire a SELECT FOR UPDATE lock on the EmployeeWallet row
  3. Perform an idempotency check before creating new ledger entries
  4. Create an immutable EmployeeWalletTransaction record
  5. Update EmployeeWallet cached balance fields
  6. Save with update_fields (never a full .save())

NEVER call wallet.save() outside of a transaction.atomic() block.
NEVER modify EmployeeWalletTransaction records after creation.
"""
import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

from django.db import transaction, IntegrityError
from django.utils import timezone

from vendor_wallet.constants import (
    WALLET_SETTLEMENT_HOLD_DAYS, MIN_WITHDRAWAL_AMOUNT,
    TXN_SERVICE_EARNING, TXN_PLATFORM_DEDUCTION, TXN_REFUND,
    TXN_RECOVERY_DEBIT, TXN_RECOVERY_CREDIT,
    TXN_WITHDRAWAL, TXN_WITHDRAWAL_REVERSAL,
    TXN_ADJUSTMENT_CREDIT, TXN_ADJUSTMENT_DEBIT, TXN_SETTLEMENT_RELEASE,
    REF_JOB_PAYMENT, REF_WITHDRAWAL, REF_SETTLEMENT,
    REF_REFUND, REF_RECOVERY, REF_ADJUSTMENT,
    BALANCE_PENDING, BALANCE_AVAILABLE,
    DIRECTION_CREDIT, DIRECTION_DEBIT,
    TXN_STATUS_COMPLETED, TXN_STATUS_PENDING_SETTLEMENT,
    WALLET_ACTIVE,
    WITHDRAWAL_REQUESTED, WITHDRAWAL_PROCESSING, WITHDRAWAL_COMPLETED,
    WITHDRAWAL_FAILED, WITHDRAWAL_CANCELLED,
    WITHDRAWAL_EMPLOYEE_CANCELLABLE, WITHDRAWAL_TERMINAL,
    PAYOUT_ACCOUNT_VERIFIED,
)
from vendor_wallet.exceptions import (
    WalletNotActiveError,
    InsufficientBalanceError,
    CommissionConfigMissingError,
    IdempotentTransactionError,
    InvalidWithdrawalTransitionError,
    WithdrawalAmountError,
    WithdrawalEligibilityError,
)
from vendor_wallet.services.commission import get_active_commission

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0.00")
MIN_WITHDRAWAL = Decimal(MIN_WITHDRAWAL_AMOUNT)


# ── Internal Helpers ──────────────────────────────────────────────────────────

def _get_or_create_wallet(employee):
    """
    Retrieves the EmployeeWallet for the given employee, creating it if it does not exist.
    Wallet creation uses get_or_create which is concurrency-safe due to the UNIQUE constraint.

    NOTE: Does NOT acquire SELECT FOR UPDATE — callers that modify balance fields must
    re-query with select_for_update() inside their own atomic block.
    """
    from vendor_wallet.models import EmployeeWallet
    wallet, created = EmployeeWallet.objects.get_or_create(
        employee=employee,
        defaults={
            "company": employee.company,
            "currency": "INR",
            "status": WALLET_ACTIVE,
        },
    )
    if created:
        logger.info("[WALLET_CREATED] employee_id=%s", employee.id)
    return wallet


def _round(value: Decimal) -> Decimal:
    """Standard financial rounding — ROUND_HALF_UP to 2 decimal places."""
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


# ── Phase W4: Service Earning Credit ─────────────────────────────────────────

def credit_job_earning(employee, job, job_payment, actor=None):
    """
    Credits the employee's wallet with their earning share from a completed, paid service job.

    MUST be called after:
      - Job transitions to 'completed'
      - job_payment.payment_status == 'PAID'

    Financial flow:
      gross = job_payment.amount
      earn_rate = EmployeeCommissionConfig.employee_earn_rate (e.g. 0.6000 = 60%)
      employee_amount = gross × earn_rate   → credited to employee wallet (PENDING_SETTLEMENT)
      platform_amount = gross - employee_amount  → company retains (not tracked in this wallet)

    This function is IDEMPOTENT — safe to call multiple times for the same job_payment.
    Duplicate calls are silently skipped via the database UNIQUE constraint on reference_type + reference_id.

    Args:
        employee: employees.Employee instance — the assigned technician
        job: EmployeeJob or ServiceRequest instance (must have .id)
        job_payment: payment object with .id and .amount (Decimal)
        actor: User who triggered this (optional, for audit)

    Raises:
        CommissionConfigMissingError: No active earn rate config for the employee.
        WalletNotActiveError: Employee's wallet is suspended or locked.
        IdempotentTransactionError: Transaction already recorded for this job_payment.
    """
    from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction

    commission_config = get_active_commission(employee)
    if commission_config is None:
        raise CommissionConfigMissingError(
            f"No active commission config for employee_id={employee.id}. "
            f"Admin must create an EmployeeCommissionConfig record."
        )

    gross = _round(Decimal(str(job_payment.amount)))
    earn_rate = commission_config.employee_earn_rate
    employee_amount = _round(gross * earn_rate)
    platform_amount = _round(gross - employee_amount)

    reference_type = REF_JOB_PAYMENT
    reference_id = str(job_payment.id)

    with transaction.atomic():
        wallet = (
            EmployeeWallet.objects
            .select_for_update()
            .get(employee=employee)
        )

        if wallet.status != WALLET_ACTIVE:
            raise WalletNotActiveError(
                f"Wallet for employee_id={employee.id} is {wallet.status}. Cannot credit."
            )

        # Idempotency: check before creating
        if EmployeeWalletTransaction.objects.filter(
            reference_type=reference_type,
            reference_id=reference_id,
        ).exists():
            raise IdempotentTransactionError(
                f"Transaction already recorded for {reference_type}:{reference_id}"
            )

        release_at = timezone.now() + timedelta(days=WALLET_SETTLEMENT_HOLD_DAYS)

        # Service earning — credited to pending_balance (T+7 hold)
        balance_before = wallet.pending_balance
        wallet.pending_balance = _round(wallet.pending_balance + employee_amount)
        wallet.lifetime_earnings = _round(wallet.lifetime_earnings + employee_amount)

        try:
            EmployeeWalletTransaction.objects.create(
                wallet=wallet,
                reference_type=reference_type,
                reference_id=reference_id,
                transaction_type=TXN_SERVICE_EARNING,
                direction=DIRECTION_CREDIT,
                status=TXN_STATUS_PENDING_SETTLEMENT,
                amount=employee_amount,
                gross_amount=gross,
                earn_rate_snapshot=earn_rate,
                platform_deduction_amount=platform_amount,
                balance_before=balance_before,
                balance_after=wallet.pending_balance,
                balance_type=BALANCE_PENDING,
                settlement_release_at=release_at,
                description=f"Service earning for Job #{job.id} — ₹{employee_amount} ({int(earn_rate * 100)}% of ₹{gross})",
                service_request_id=getattr(job, "service_request_id", None) or job.id,
                job_payment_id=job_payment.id,
                created_by=actor,
                metadata={
                    "job_id": job.id,
                    "gross_amount": str(gross),
                    "earn_rate": str(earn_rate),
                    "platform_deduction": str(platform_amount),
                    "settlement_release_at": release_at.isoformat(),
                },
            )
        except IntegrityError:
            raise IdempotentTransactionError(
                f"Transaction already recorded for {reference_type}:{reference_id} (DB constraint)"
            )

        wallet.save(update_fields=["pending_balance", "lifetime_earnings", "updated_at"])

    logger.info(
        "[WALLET_CREDIT] employee_id=%s job_id=%s gross=%.2f earn_rate=%s employee=%.2f platform=%.2f settle_at=%s",
        employee.id, job.id, gross, earn_rate, employee_amount, platform_amount, release_at.isoformat(),
    )

    return {
        "employee_amount": employee_amount,
        "platform_amount": platform_amount,
        "gross": gross,
        "earn_rate": earn_rate,
        "settlement_release_at": release_at,
    }


# ── Phase W8: Settlement Release ─────────────────────────────────────────────

def release_pending_settlement(txn, dry_run=False):
    """
    Releases a single PENDING_SETTLEMENT transaction to AVAILABLE.
    Moves the amount from pending_balance → available_balance on the wallet.

    Called by the release_wallet_settlements management command.

    Args:
        txn: EmployeeWalletTransaction in PENDING_SETTLEMENT status
        dry_run: If True, calculate but do not save

    Returns:
        dict with release details
    """
    from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction

    if dry_run:
        return {
            "txn_id": txn.id,
            "employee_id": txn.wallet.employee_id,
            "amount": txn.amount,
            "dry_run": True,
        }

    with transaction.atomic():
        wallet = (
            EmployeeWallet.objects
            .select_for_update()
            .get(pk=txn.wallet_id)
        )

        release_ref = f"SETTLE_{txn.id}"
        if EmployeeWalletTransaction.objects.filter(
            reference_type=REF_SETTLEMENT,
            reference_id=release_ref,
        ).exists():
            return {"txn_id": txn.id, "skipped": True, "reason": "already_released"}

        amount = txn.amount
        balance_before_available = wallet.available_balance
        wallet.available_balance = _round(wallet.available_balance + amount)
        wallet.pending_balance = _round(max(ZERO, wallet.pending_balance - amount))

        EmployeeWalletTransaction.objects.create(
            wallet=wallet,
            reference_type=REF_SETTLEMENT,
            reference_id=release_ref,
            transaction_type=TXN_SETTLEMENT_RELEASE,
            direction=DIRECTION_CREDIT,
            status=TXN_STATUS_COMPLETED,
            amount=amount,
            balance_before=balance_before_available,
            balance_after=wallet.available_balance,
            balance_type=BALANCE_AVAILABLE,
            released_at=timezone.now(),
            description=f"T+7 settlement release for txn #{txn.id}",
            service_request_id=txn.service_request_id,
        )

        txn.status = TXN_STATUS_COMPLETED
        txn.released_at = timezone.now()
        txn.save(update_fields=["status", "released_at"])

        wallet.save(update_fields=["available_balance", "pending_balance", "updated_at"])

    return {
        "txn_id": txn.id,
        "employee_id": wallet.employee_id,
        "amount": amount,
        "released": True,
    }


# ── Phase W9: Withdrawal ──────────────────────────────────────────────────────

def request_withdrawal(employee, amount, payout_account_id, actor=None):
    """
    Employee self-service withdrawal request.

    Eligibility checks (all must pass):
      1. Wallet status == ACTIVE
      2. Employee registration_status == 'approved' (KYC complete)
      3. At least one VERIFIED payout account linked
      4. amount >= MIN_WITHDRAWAL_AMOUNT (₹5,000)
      5. available_balance >= amount

    On success:
      - Debits available_balance immediately
      - Creates WITHDRAWAL ledger entry
      - Creates EmployeeWalletWithdrawal record in REQUESTED status

    Raises:
        WithdrawalEligibilityError: KYC not approved, no verified account, or below minimum
        InsufficientBalanceError: available_balance < amount
        WalletNotActiveError: wallet is not ACTIVE
        WithdrawalAmountError: amount < MIN_WITHDRAWAL_AMOUNT
    """
    from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction, EmployeeWalletWithdrawal, EmployeePayoutAccount

    amount = _round(Decimal(str(amount)))

    # 1. Minimum amount check
    if amount < MIN_WITHDRAWAL:
        raise WithdrawalAmountError(
            f"Minimum withdrawal amount is ₹{MIN_WITHDRAWAL}. Requested: ₹{amount}"
        )

    # 2. KYC check — employee registration must be 'approved'
    # registration_status is stored in bank_details JSON or employee profile
    registration_status = None
    try:
        bd = getattr(employee, "bank_details", {}) or {}
        registration_status = bd.get("onboarding", {}).get("registration_status") or bd.get("registration_status")
    except Exception:
        pass
    # Also check via workforce_api profile if available
    if not registration_status:
        try:
            from workforce_api.models import WorkforceProfile
            profile = WorkforceProfile.objects.filter(user=employee.user).first()
            if profile:
                registration_status = profile.registration_status
        except Exception:
            pass

    if registration_status != "approved":
        raise WithdrawalEligibilityError(
            "KYC verification is not complete. Your registration must be approved before you can withdraw."
        )

    # 3. Verified payout account check
    verified_account = EmployeePayoutAccount.objects.filter(
        employee=employee,
        verification_status=PAYOUT_ACCOUNT_VERIFIED,
        is_active=True,
    ).first()
    if not verified_account:
        raise WithdrawalEligibilityError(
            "No verified bank account found. Please add and verify a bank account before withdrawing."
        )

    # 4. Resolve payout account
    if payout_account_id:
        try:
            payout_account = EmployeePayoutAccount.objects.get(
                pk=payout_account_id,
                employee=employee,
                verification_status=PAYOUT_ACCOUNT_VERIFIED,
                is_active=True,
            )
        except EmployeePayoutAccount.DoesNotExist:
            raise WithdrawalEligibilityError("Specified payout account is not verified or does not belong to you.")
    else:
        payout_account = verified_account

    reference_id = str(uuid.uuid4())

    with transaction.atomic():
        wallet = (
            EmployeeWallet.objects
            .select_for_update()
            .get(employee=employee)
        )

        if wallet.status != WALLET_ACTIVE:
            raise WalletNotActiveError(f"Your wallet is {wallet.status}. Withdrawals are not allowed.")

        if wallet.available_balance < amount:
            raise InsufficientBalanceError(
                f"Available balance ₹{wallet.available_balance} is less than requested ₹{amount}."
            )

        balance_before = wallet.available_balance
        wallet.available_balance = _round(wallet.available_balance - amount)
        wallet.total_withdrawn = _round(wallet.total_withdrawn + amount)

        withdrawal = EmployeeWalletWithdrawal.objects.create(
            wallet=wallet,
            employee=employee,
            payout_account=payout_account,
            amount=amount,
            status=WITHDRAWAL_REQUESTED,
            requested_by=actor,
        )

        EmployeeWalletTransaction.objects.create(
            wallet=wallet,
            reference_type=REF_WITHDRAWAL,
            reference_id=reference_id,
            transaction_type=TXN_WITHDRAWAL,
            direction=DIRECTION_DEBIT,
            status=TXN_STATUS_COMPLETED,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.available_balance,
            balance_type=BALANCE_AVAILABLE,
            withdrawal=withdrawal,
            description=f"Withdrawal request #{withdrawal.id} — ₹{amount} to {payout_account.bank_name} ****{payout_account.account_number_last4}",
            created_by=actor,
        )

        wallet.save(update_fields=["available_balance", "total_withdrawn", "updated_at"])

    logger.info(
        "[WITHDRAWAL_REQUESTED] employee_id=%s withdrawal_id=%s amount=%.2f account=****%s",
        employee.id, withdrawal.id, amount, payout_account.account_number_last4,
    )

    return withdrawal


def cancel_withdrawal(employee, withdrawal_id, actor=None):
    """
    Employee cancels their own REQUESTED withdrawal.
    Reverses the balance debit — amount returned to available_balance.

    Only allowed when withdrawal.status == REQUESTED.
    """
    from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction, EmployeeWalletWithdrawal

    with transaction.atomic():
        try:
            withdrawal = EmployeeWalletWithdrawal.objects.select_for_update().get(
                pk=withdrawal_id,
                employee=employee,
            )
        except EmployeeWalletWithdrawal.DoesNotExist:
            raise InvalidWithdrawalTransitionError("Withdrawal not found or does not belong to you.")

        if withdrawal.status not in WITHDRAWAL_EMPLOYEE_CANCELLABLE:
            raise InvalidWithdrawalTransitionError(
                f"Cannot cancel withdrawal in {withdrawal.status} status. "
                f"Only {WITHDRAWAL_EMPLOYEE_CANCELLABLE} can be cancelled."
            )

        wallet = EmployeeWallet.objects.select_for_update().get(pk=withdrawal.wallet_id)
        amount = withdrawal.amount
        balance_before = wallet.available_balance
        wallet.available_balance = _round(wallet.available_balance + amount)
        wallet.total_withdrawn = _round(max(ZERO, wallet.total_withdrawn - amount))

        withdrawal.status = WITHDRAWAL_CANCELLED
        withdrawal.cancelled_at = timezone.now()

        EmployeeWalletTransaction.objects.create(
            wallet=wallet,
            reference_type=REF_WITHDRAWAL,
            reference_id=f"CANCEL_{withdrawal.id}",
            transaction_type=TXN_WITHDRAWAL_REVERSAL,
            direction=DIRECTION_CREDIT,
            status=TXN_STATUS_COMPLETED,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.available_balance,
            balance_type=BALANCE_AVAILABLE,
            withdrawal=withdrawal,
            description=f"Cancellation of withdrawal #{withdrawal.id} — ₹{amount} returned",
            created_by=actor,
        )

        withdrawal.save(update_fields=["status", "cancelled_at"])
        wallet.save(update_fields=["available_balance", "total_withdrawn", "updated_at"])

    logger.info(
        "[WITHDRAWAL_CANCELLED] employee_id=%s withdrawal_id=%s amount=%.2f",
        employee.id, withdrawal.id, amount,
    )
    return withdrawal


# ── Phase W10: Admin Adjustment ───────────────────────────────────────────────

def admin_adjustment(employee, amount, direction, reason, actor=None):
    """
    Admin posts a manual credit or debit adjustment to an employee's wallet.

    Args:
        employee: target Employee
        amount: Decimal amount (positive)
        direction: DIRECTION_CREDIT or DIRECTION_DEBIT
        reason: human-readable reason for audit
        actor: admin User performing the action
    """
    from vendor_wallet.models import EmployeeWallet, EmployeeWalletTransaction

    amount = _round(Decimal(str(amount)))
    if amount <= ZERO:
        raise WithdrawalAmountError("Adjustment amount must be positive.")

    reference_id = str(uuid.uuid4())
    txn_type = TXN_ADJUSTMENT_CREDIT if direction == DIRECTION_CREDIT else TXN_ADJUSTMENT_DEBIT

    with transaction.atomic():
        wallet = EmployeeWallet.objects.select_for_update().get(employee=employee)

        if direction == DIRECTION_DEBIT and wallet.available_balance < amount:
            raise InsufficientBalanceError(
                f"Cannot debit ₹{amount} — available balance is ₹{wallet.available_balance}."
            )

        balance_before = wallet.available_balance
        if direction == DIRECTION_CREDIT:
            wallet.available_balance = _round(wallet.available_balance + amount)
            wallet.lifetime_earnings = _round(wallet.lifetime_earnings + amount)
        else:
            wallet.available_balance = _round(wallet.available_balance - amount)

        EmployeeWalletTransaction.objects.create(
            wallet=wallet,
            reference_type=REF_ADJUSTMENT,
            reference_id=reference_id,
            transaction_type=txn_type,
            direction=direction,
            status=TXN_STATUS_COMPLETED,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.available_balance,
            balance_type=BALANCE_AVAILABLE,
            description=f"Admin adjustment ({direction}): {reason}",
            created_by=actor,
        )

        update_fields = ["available_balance", "updated_at"]
        if direction == DIRECTION_CREDIT:
            update_fields.append("lifetime_earnings")
        wallet.save(update_fields=update_fields)

    logger.info(
        "[ADMIN_ADJUSTMENT] employee_id=%s direction=%s amount=%.2f reason=%s actor=%s",
        employee.id, direction, amount, reason, getattr(actor, "id", None),
    )


# ── Phase W11: Wallet Freeze ──────────────────────────────────────────────────

def set_wallet_status(employee, new_status, actor=None):
    """
    Admin changes the wallet status (ACTIVE / SUSPENDED / LOCKED / CLOSED).
    Does not create a ledger entry — status changes are management actions, not financial events.
    """
    from vendor_wallet.models import EmployeeWallet

    allowed = {WALLET_ACTIVE, WALLET_SUSPENDED, WALLET_LOCKED, WALLET_CLOSED}
    if new_status not in allowed:
        raise ValueError(f"Invalid wallet status: {new_status}. Must be one of {allowed}.")

    with transaction.atomic():
        wallet = EmployeeWallet.objects.select_for_update().get(employee=employee)
        old_status = wallet.status
        wallet.status = new_status
        wallet.save(update_fields=["status", "updated_at"])

    logger.info(
        "[WALLET_STATUS_CHANGE] employee_id=%s %s → %s by actor=%s",
        employee.id, old_status, new_status, getattr(actor, "id", None),
    )
    return wallet


# ── Phase W12: Payout Account Management ─────────────────────────────────────

def add_payout_account(employee, account_data, actor=None):
    """
    Adds a new payout bank account for the employee.
    Full account number is accepted but only the last 4 digits are stored.
    """
    from vendor_wallet.models import EmployeePayoutAccount

    raw_number = str(account_data.get("account_number", ""))
    last4 = raw_number[-4:] if len(raw_number) >= 4 else raw_number

    account = EmployeePayoutAccount.objects.create(
        employee=employee,
        account_holder_name=account_data.get("account_holder_name", ""),
        bank_name=account_data.get("bank_name", ""),
        account_number_last4=last4,
        ifsc_code=account_data.get("ifsc_code", ""),
        account_type=account_data.get("account_type", "SAVINGS"),
        is_primary=account_data.get("is_primary", False),
        created_by=actor,
    )
    logger.info(
        "[PAYOUT_ACCOUNT_ADDED] employee_id=%s account_id=%s bank=%s ****%s",
        employee.id, account.id, account.bank_name, account.account_number_last4,
    )
    return account
