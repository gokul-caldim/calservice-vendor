"""
workforce_core/urls.py

Root URLconf for the dedicated Workforce Backend (Port 8001).
Exposes /api/workforce/* and core auth routes.
"""







from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

urlpatterns = [
    # Dedicated Workforce API namespace
    path("api/workforce/", include("workforce_api.urls")),
    # Vendor Wallet API (vendor + admin wallet endpoints)
    path("api/workforce/", include("vendor_wallet.urls")),
    # Shared /api/auth/ endpoints for login/me/logout
    path("api/auth/", include("accounts.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
