"""
vendor_wallet/urls.py
URL routing for the Employee Wallet module.

All routes prefixed by /api/workforce/ (set in workforce_core/urls.py)
"""
from django.urls import path
from vendor_wallet import views

# Employee self-service routes (IsAuthenticated — wallet scoped to logged-in employee)
employee_patterns = [
    path("wallet/", views.WalletSummaryView.as_view(), name="wallet-summary"),
    path("wallet/transactions/", views.WalletTransactionListView.as_view(), name="wallet-transactions"),
    path("wallet/transactions/<int:pk>/", views.WalletTransactionDetailView.as_view(), name="wallet-transaction-detail"),
    path("wallet/withdrawals/", views.WalletWithdrawalListCreateView.as_view(), name="wallet-withdrawals"),
    path("wallet/withdrawals/<int:pk>/cancel/", views.WalletWithdrawalCancelView.as_view(), name="wallet-withdrawal-cancel"),
    path("wallet/payout-accounts/", views.WalletPayoutAccountListCreateView.as_view(), name="wallet-payout-accounts"),
    path("wallet/payout-accounts/<int:pk>/", views.WalletPayoutAccountDetailView.as_view(), name="wallet-payout-account-detail"),
]

# Platform admin routes (IsWorkforceAdmin — manage all employee wallets in company)
admin_patterns = [
    path("admin/wallet/employees/", views.AdminWalletListView.as_view(), name="admin-wallet-list"),
    path("admin/wallet/employees/<int:employee_id>/", views.AdminWalletSummaryView.as_view(), name="admin-wallet-summary"),
    path("admin/wallet/employees/<int:employee_id>/transactions/", views.AdminWalletTransactionListView.as_view(), name="admin-wallet-transactions"),
    path("admin/wallet/employees/<int:employee_id>/adjustment/", views.AdminWalletAdjustmentView.as_view(), name="admin-wallet-adjustment"),
    path("admin/wallet/employees/<int:employee_id>/freeze/", views.AdminWalletFreezeView.as_view(), name="admin-wallet-freeze"),
    path("admin/wallet/withdrawals/", views.AdminWithdrawalListView.as_view(), name="admin-withdrawals"),
    path("admin/wallet/withdrawals/<int:pk>/process/", views.AdminWithdrawalProcessView.as_view(), name="admin-withdrawal-process"),
    path("admin/wallet/withdrawals/<int:pk>/complete/", views.AdminWithdrawalCompleteView.as_view(), name="admin-withdrawal-complete"),
    path("admin/wallet/withdrawals/<int:pk>/fail/", views.AdminWithdrawalFailView.as_view(), name="admin-withdrawal-fail"),
    path("admin/wallet/payout-accounts/<int:pk>/verify/", views.AdminPayoutAccountVerifyView.as_view(), name="admin-payout-account-verify"),
    path("admin/commission/employees/<int:employee_id>/", views.AdminCommissionConfigView.as_view(), name="admin-commission-config"),
]

urlpatterns = employee_patterns + admin_patterns
