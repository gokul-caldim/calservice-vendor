"""
workforce-app/backend/accounts/urls.py
Authentication routes for /api/auth/*
"""
from django.urls import path
from .views import LoginView, MeView, LogoutView, WorkforceRefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", WorkforceRefreshView.as_view(), name="auth-refresh"),
]
