import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from vendor_wallet.models import VendorWallet, VendorWalletTransaction, VendorWalletWithdrawal, VendorPayoutAccount, VendorCommissionConfig
print('OK: All wallet models imported')

from vendor_wallet.services.wallet_service import credit_job_earning, request_withdrawal, complete_withdrawal
print('OK: Wallet service imported')

from vendor_wallet.services.commission import get_active_commission
print('OK: Commission service imported')

from vendor_wallet.exceptions import WalletError, CommissionConfigMissingError
print('OK: Exceptions imported')

from vendor_wallet import views, urls
print('OK: Views and URLs imported')

print('\nAll vendor_wallet imports successful.')
