"""
vendor_wallet/exceptions.py
Domain-specific exceptions for the Employee Wallet module.
"""


class WalletError(Exception):
    """Base exception for all wallet-related errors."""
    code = "WALLET_ERROR"

    def __init__(self, message: str, code: str = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class WalletNotFoundError(WalletError):
    code = "WALLET_NOT_FOUND"


class WalletNotActiveError(WalletError):
    code = "WALLET_NOT_ACTIVE"


class InsufficientBalanceError(WalletError):
    code = "WALLET_INSUFFICIENT_BALANCE"


class CommissionConfigMissingError(WalletError):
    """Raised when no active EmployeeCommissionConfig exists for the employee."""
    code = "WALLET_COMMISSION_CONFIG_MISSING"


class IdempotentTransactionError(WalletError):
    """Raised when a transaction with the same reference already exists (expected, safe to ignore)."""
    code = "WALLET_IDEMPOTENT_SKIP"


class InvalidWithdrawalTransitionError(WalletError):
    code = "WALLET_INVALID_WITHDRAWAL_TRANSITION"


class WithdrawalAmountError(WalletError):
    code = "WALLET_WITHDRAWAL_AMOUNT_INVALID"


class WithdrawalEligibilityError(WalletError):
    """
    Raised when an employee does not meet withdrawal eligibility requirements:
      - KYC not complete (registration_status != 'approved')
      - No VERIFIED bank account linked
      - Available balance < MIN_WITHDRAWAL_AMOUNT (₹5,000)
    """
    code = "WALLET_WITHDRAWAL_NOT_ELIGIBLE"
