"""
vendor_wallet/apps.py
Django AppConfig for the Vendor Wallet module.
"""
from django.apps import AppConfig


class VendorWalletConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "vendor_wallet"
    verbose_name = "Vendor Wallet"
