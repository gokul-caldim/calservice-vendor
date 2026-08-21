"""
vendor_wallet/views.py
API views for the Employee Wallet module.

Authorization:
  Employee endpoints: IsAuthenticated — wallet scoped to request.user.employee_profile
  Admin endpoints: IsWorkforceAdmin — can view/manage any employee's wallet within the company

Tenant isolation:
  - Employee views: employee resolved from request.user, wallet owned by that employee
  - Admin views: employee_id from URL path, must belong to same company as admin
"""
import logging
from decimal import Decimal

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from employees.models import Employee
from workforce_api.permissions import IsWorkforceAdmin
from vendor_wallet.models import (
    EmployeeWallet, EmployeeWalletTransaction,
    EmployeeWalletWithdrawal, EmployeePayoutAccount,
    EmployeeCommissionConfig,
)
from vendor_wallet.serializers import (
    EmployeeWalletSummarySerializer,
    EmployeeWalletTransactionSerializer,
    EmployeeWalletWithdrawalSerializer,
    EmployeePayoutAccountSerializer,
    WithdrawalRequestSerializer,
    AdminAdjustmentSerializer,
    AdminWalletFreezeSerializer,
    EmployeeCommissionConfigSerializer,
    AdminCommissionConfigCreateSerializer,
)
from vendor_wallet.services import wallet_service
from vendor_wallet.exceptions import (
    WalletError, InsufficientBalanceError, WalletNotActiveError,
    CommissionConfigMissingError, InvalidWithdrawalTransitionError,
    WithdrawalAmountError, WithdrawalEligibilityError,
)
from vendor_wallet.constants import (
    WALLET_ACTIVE, WALLET_SUSPENDED, WALLET_LOCKED, WALLET_CLOSED,
    DIRECTION_CREDIT, DIRECTION_DEBIT,
)

logger = logging.getLogger(__name__)

PAGE_SIZE = 25


def _wallet_error_response(exc, default_status=status.HTTP_400_BAD_REQUEST):
    """Convert WalletError domain exceptions to DRF Response."""
    if isinstance(exc, InsufficientBalanceError):
        http_status = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, WalletNotActiveError):
        http_status = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, (WithdrawalEligibilityError, WithdrawalAmountError)):
        http_status = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, InvalidWithdrawalTransitionError):
        http_status = status.HTTP_409_CONFLICT
    else:
        http_status = default_status
    return Response(
        {"error": exc.message, "code": exc.code},
        status=http_status,
    )


def _get_employee(request):
    """Resolve the authenticated user's Employee profile. Returns 404 if not an employee."""
    try:
        return request.user.employee_profile
    except Employee.DoesNotExist:
        return None


def _get_or_init_wallet(employee):
    """Get or lazily create the wallet for this employee."""
    from vendor_wallet.models import EmployeeWallet
    from vendor_wallet.constants import WALLET_ACTIVE
    wallet, _ = EmployeeWallet.objects.get_or_create(
        employee=employee,
        defaults={"company": employee.company, "currency": "INR", "status": WALLET_ACTIVE},
    )
    return wallet


# ─────────────────────────────────────────────────────────────────────────────
# EMPLOYEE-FACING VIEWS
# ─────────────────────────────────────────────────────────────────────────────

class WalletSummaryView(APIView):
    """GET /wallet/ — Employee's own wallet balance summary."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        wallet = _get_or_init_wallet(employee)
        serializer = EmployeeWalletSummarySerializer(wallet)
        return Response(serializer.data)


class WalletTransactionListView(APIView):
    """GET /wallet/transactions/ — Employee's own transaction ledger (paginated)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        wallet = _get_or_init_wallet(employee)

        qs = wallet.transactions.all()

        txn_type = request.query_params.get("type")
        if txn_type:
            qs = qs.filter(transaction_type=txn_type)
        txn_status = request.query_params.get("status")
        if txn_status:
            qs = qs.filter(status=txn_status)

        # Pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        offset = (page - 1) * PAGE_SIZE
        total = qs.count()
        transactions = qs[offset: offset + PAGE_SIZE]

        return Response({
            "count": total,
            "page": page,
            "page_size": PAGE_SIZE,
            "total_pages": max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE),
            "results": EmployeeWalletTransactionSerializer(transactions, many=True).data,
        })


class WalletTransactionDetailView(APIView):
    """GET /wallet/transactions/<pk>/ — Single transaction detail."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        wallet = _get_or_init_wallet(employee)
        txn = get_object_or_404(EmployeeWalletTransaction, pk=pk, wallet=wallet)
        return Response(EmployeeWalletTransactionSerializer(txn).data)


class WalletWithdrawalListCreateView(APIView):
    """
    GET  /wallet/withdrawals/ — Employee's withdrawal history
    POST /wallet/withdrawals/ — Request a new withdrawal (self-service)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        wallet = _get_or_init_wallet(employee)
        withdrawals = wallet.withdrawals.all().order_by("-created_at")
        return Response(EmployeeWalletWithdrawalSerializer(withdrawals, many=True).data)

    def post(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WithdrawalRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data["amount"]
        payout_account_id = serializer.validated_data.get("payout_account_id")

        # Ensure wallet exists
        _get_or_init_wallet(employee)

        try:
            withdrawal = wallet_service.request_withdrawal(
                employee=employee,
                amount=amount,
                payout_account_id=payout_account_id,
                actor=request.user,
            )
        except WalletError as exc:
            return _wallet_error_response(exc)

        return Response(
            EmployeeWalletWithdrawalSerializer(withdrawal).data,
            status=status.HTTP_201_CREATED,
        )


class WalletWithdrawalCancelView(APIView):
    """POST /wallet/withdrawals/<pk>/cancel/ — Employee cancels their own REQUESTED withdrawal."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            withdrawal = wallet_service.cancel_withdrawal(
                employee=employee,
                withdrawal_id=pk,
                actor=request.user,
            )
        except WalletError as exc:
            return _wallet_error_response(exc)
        return Response(EmployeeWalletWithdrawalSerializer(withdrawal).data)


class WalletPayoutAccountListCreateView(APIView):
    """
    GET  /wallet/payout-accounts/ — List employee's bank accounts
    POST /wallet/payout-accounts/ — Add a new bank account
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        accounts = EmployeePayoutAccount.objects.filter(employee=employee, is_active=True)
        return Response(EmployeePayoutAccountSerializer(accounts, many=True).data)

    def post(self, request):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeePayoutAccountSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = wallet_service.add_payout_account(
                employee=employee,
                account_data={
                    **serializer.validated_data,
                    "account_number": request.data.get("account_number", ""),
                },
                actor=request.user,
            )
        except Exception as exc:
            logger.error("[PAYOUT_ACCOUNT_CREATE_ERROR] employee_id=%s error=%s", employee.id, exc)
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(EmployeePayoutAccountSerializer(account).data, status=status.HTTP_201_CREATED)


class WalletPayoutAccountDetailView(APIView):
    """DELETE /wallet/payout-accounts/<pk>/ — Deactivate a bank account."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        employee = _get_employee(request)
        if not employee:
            return Response({"error": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
        account = get_object_or_404(EmployeePayoutAccount, pk=pk, employee=employee)
        account.is_active = False
        account.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN VIEWS
# ─────────────────────────────────────────────────────────────────────────────

def _get_employee_for_admin(request, employee_id):
    """
    Resolves an Employee by ID, ensuring they belong to the same company as the admin.
    Returns (employee, error_response) — one of them will be None.
    """
    try:
        admin_company = request.user.employee_profile.company
    except Exception:
        return None, Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

    employee = get_object_or_404(Employee, pk=employee_id, company=admin_company)
    return employee, None


class AdminWalletListView(APIView):
    """GET /admin/wallet/employees/ — List all employee wallets in the admin's company."""
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        wallets = EmployeeWallet.objects.filter(company=admin_company).select_related("employee", "employee__user")
        return Response(EmployeeWalletSummarySerializer(wallets, many=True).data)


class AdminWalletSummaryView(APIView):
    """GET /admin/wallet/employees/<employee_id>/ — View a specific employee's wallet."""
    permission_classes = [IsWorkforceAdmin]

    def get(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err
        wallet = _get_or_init_wallet(employee)
        return Response(EmployeeWalletSummarySerializer(wallet).data)


class AdminWalletTransactionListView(APIView):
    """GET /admin/wallet/employees/<employee_id>/transactions/ — View employee's ledger."""
    permission_classes = [IsWorkforceAdmin]

    def get(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err
        wallet = _get_or_init_wallet(employee)
        qs = wallet.transactions.all()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1
        offset = (page - 1) * PAGE_SIZE
        total = qs.count()
        return Response({
            "count": total,
            "page": page,
            "page_size": PAGE_SIZE,
            "total_pages": max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE),
            "results": EmployeeWalletTransactionSerializer(qs[offset: offset + PAGE_SIZE], many=True).data,
        })


class AdminWalletAdjustmentView(APIView):
    """POST /admin/wallet/employees/<employee_id>/adjustment/ — Post credit/debit adjustment."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err

        serializer = AdminAdjustmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        _get_or_init_wallet(employee)

        try:
            wallet_service.admin_adjustment(
                employee=employee,
                amount=serializer.validated_data["amount"],
                direction=serializer.validated_data["direction"],
                reason=serializer.validated_data["reason"],
                actor=request.user,
            )
        except WalletError as exc:
            return _wallet_error_response(exc)

        wallet = _get_or_init_wallet(employee)
        return Response(EmployeeWalletSummarySerializer(wallet).data)


class AdminWalletFreezeView(APIView):
    """POST /admin/wallet/employees/<employee_id>/freeze/ — Change wallet status."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err

        serializer = AdminWalletFreezeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            wallet = wallet_service.set_wallet_status(
                employee=employee,
                new_status=serializer.validated_data["status"],
                actor=request.user,
            )
        except (WalletError, ValueError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(EmployeeWalletSummarySerializer(wallet).data)


class AdminWithdrawalListView(APIView):
    """GET /admin/wallet/withdrawals/ — All withdrawal requests in the admin's company."""
    permission_classes = [IsWorkforceAdmin]

    def get(self, request):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        qs = EmployeeWalletWithdrawal.objects.filter(
            employee__company=admin_company
        ).select_related("employee", "employee__user", "payout_account").order_by("-created_at")

        withdrawal_status = request.query_params.get("status")
        if withdrawal_status:
            qs = qs.filter(status=withdrawal_status)

        return Response(EmployeeWalletWithdrawalSerializer(qs, many=True).data)


class AdminWithdrawalProcessView(APIView):
    """POST /admin/wallet/withdrawals/<pk>/process/ — Mark withdrawal as processing."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        withdrawal = get_object_or_404(
            EmployeeWalletWithdrawal,
            pk=pk,
            employee__company=admin_company,
        )
        from vendor_wallet.constants import WITHDRAWAL_REQUESTED, WITHDRAWAL_PROCESSING
        from django.utils import timezone

        if withdrawal.status != WITHDRAWAL_REQUESTED:
            return Response(
                {"error": f"Cannot process withdrawal in {withdrawal.status} status."},
                status=status.HTTP_409_CONFLICT,
            )
        withdrawal.status = WITHDRAWAL_PROCESSING
        withdrawal.processing_started_at = timezone.now()
        withdrawal.processed_by = request.user
        withdrawal.save(update_fields=["status", "processing_started_at", "processed_by", "updated_at"])
        return Response(EmployeeWalletWithdrawalSerializer(withdrawal).data)


class AdminWithdrawalCompleteView(APIView):
    """POST /admin/wallet/withdrawals/<pk>/complete/ — Mark withdrawal completed."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        withdrawal = get_object_or_404(
            EmployeeWalletWithdrawal,
            pk=pk,
            employee__company=admin_company,
        )
        from vendor_wallet.constants import WITHDRAWAL_PROCESSING, WITHDRAWAL_COMPLETED
        from django.utils import timezone

        if withdrawal.status != WITHDRAWAL_PROCESSING:
            return Response(
                {"error": f"Cannot complete withdrawal in {withdrawal.status} status."},
                status=status.HTTP_409_CONFLICT,
            )
        bank_txn_id = request.data.get("bank_transaction_id", "")
        withdrawal.status = WITHDRAWAL_COMPLETED
        withdrawal.completed_at = timezone.now()
        withdrawal.bank_transaction_id = bank_txn_id
        withdrawal.processed_by = request.user
        withdrawal.save(update_fields=["status", "completed_at", "bank_transaction_id", "processed_by", "updated_at"])
        logger.info(
            "[WITHDRAWAL_COMPLETED] withdrawal_id=%s employee_id=%s bank_txn=%s",
            withdrawal.id, withdrawal.employee_id, bank_txn_id,
        )
        return Response(EmployeeWalletWithdrawalSerializer(withdrawal).data)


class AdminWithdrawalFailView(APIView):
    """POST /admin/wallet/withdrawals/<pk>/fail/ — Mark withdrawal failed (reverses balance)."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        withdrawal = get_object_or_404(
            EmployeeWalletWithdrawal,
            pk=pk,
            employee__company=admin_company,
        )
        from vendor_wallet.constants import WITHDRAWAL_FAILED
        from django.utils import timezone
        from django.db import transaction as db_transaction

        allowed_from = {"REQUESTED", "PROCESSING"}
        if withdrawal.status not in allowed_from:
            return Response(
                {"error": f"Cannot fail withdrawal in {withdrawal.status} status."},
                status=status.HTTP_409_CONFLICT,
            )

        failure_reason = request.data.get("failure_reason", "")
        amount = withdrawal.amount

        with db_transaction.atomic():
            wallet = EmployeeWallet.objects.select_for_update().get(pk=withdrawal.wallet_id)
            from vendor_wallet.constants import TXN_WITHDRAWAL_REVERSAL, REF_WITHDRAWAL, DIRECTION_CREDIT, TXN_STATUS_COMPLETED, BALANCE_AVAILABLE
            from decimal import Decimal, ROUND_HALF_UP
            balance_before = wallet.available_balance
            wallet.available_balance = (wallet.available_balance + amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            wallet.total_withdrawn = max(Decimal("0.00"), wallet.total_withdrawn - amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            EmployeeWalletTransaction.objects.create(
                wallet=wallet,
                reference_type=REF_WITHDRAWAL,
                reference_id=f"FAIL_{withdrawal.id}",
                transaction_type=TXN_WITHDRAWAL_REVERSAL,
                direction=DIRECTION_CREDIT,
                status=TXN_STATUS_COMPLETED,
                amount=amount,
                balance_before=balance_before,
                balance_after=wallet.available_balance,
                balance_type=BALANCE_AVAILABLE,
                withdrawal=withdrawal,
                description=f"Withdrawal #{withdrawal.id} failed — ₹{amount} returned",
                created_by=request.user,
            )

            withdrawal.status = WITHDRAWAL_FAILED
            withdrawal.failed_at = timezone.now()
            withdrawal.failure_reason = failure_reason
            withdrawal.processed_by = request.user
            withdrawal.save(update_fields=["status", "failed_at", "failure_reason", "processed_by", "updated_at"])
            wallet.save(update_fields=["available_balance", "total_withdrawn", "updated_at"])

        return Response(EmployeeWalletWithdrawalSerializer(withdrawal).data)


# ── Commission Config ─────────────────────────────────────────────────────────

class AdminCommissionConfigView(APIView):
    """
    GET  /admin/commission/employees/<employee_id>/ — List commission rate history
    POST /admin/commission/employees/<employee_id>/ — Create new rate config
    """
    permission_classes = [IsWorkforceAdmin]

    def get(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err
        configs = EmployeeCommissionConfig.objects.filter(employee=employee).order_by("-effective_from")
        return Response(EmployeeCommissionConfigSerializer(configs, many=True).data)

    def post(self, request, employee_id):
        employee, err = _get_employee_for_admin(request, employee_id)
        if err:
            return err

        serializer = AdminCommissionConfigCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        config = EmployeeCommissionConfig.objects.create(
            employee=employee,
            employee_earn_rate=serializer.validated_data["employee_earn_rate"],
            effective_from=serializer.validated_data["effective_from"],
            effective_until=serializer.validated_data.get("effective_until"),
            notes=serializer.validated_data.get("notes", ""),
            created_by=request.user,
        )
        logger.info(
            "[COMMISSION_CONFIG_CREATED] employee_id=%s rate=%s from=%s by=%s",
            employee.id, config.employee_earn_rate, config.effective_from, request.user.id,
        )
        return Response(EmployeeCommissionConfigSerializer(config).data, status=status.HTTP_201_CREATED)


# ── Payout Account Admin Verification ────────────────────────────────────────

class AdminPayoutAccountVerifyView(APIView):
    """POST /admin/wallet/payout-accounts/<pk>/verify/ — Admin verifies a bank account."""
    permission_classes = [IsWorkforceAdmin]

    def post(self, request, pk):
        try:
            admin_company = request.user.employee_profile.company
        except Exception:
            return Response({"error": "Admin company not found."}, status=status.HTTP_403_FORBIDDEN)

        account = get_object_or_404(EmployeePayoutAccount, pk=pk, employee__company=admin_company)
        new_status = request.data.get("verification_status")
        from vendor_wallet.constants import PAYOUT_ACCOUNT_VERIFIED, PAYOUT_ACCOUNT_REJECTED

        if new_status not in [PAYOUT_ACCOUNT_VERIFIED, PAYOUT_ACCOUNT_REJECTED]:
            return Response(
                {"error": "verification_status must be VERIFIED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        account.verification_status = new_status
        account.save(update_fields=["verification_status", "updated_at"])
        return Response(EmployeePayoutAccountSerializer(account).data)
