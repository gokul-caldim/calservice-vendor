"""
workforce-app/backend/accounts/views.py
Authentication views for Workforce Backend.
"""
from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import set_auth_cookies
from employees.models import Employee

User = get_user_model()


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = (request.data.get("password") or "").strip()

        if not identifier or not password:
            return Response({"error": "Identifier and password required."}, status=status.HTTP_400_BAD_REQUEST)

        # Look up user by email, username, or mobile
        user = User.objects.filter(email__iexact=identifier).first()
        if not user:
            user = User.objects.filter(username__iexact=identifier).first()
        if not user:
            user = User.objects.filter(mobile_number=identifier).first()

        if not user or not user.check_password(password):
            return Response({"error": "Invalid credentials. Please verify your email/password."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"error": "Account is inactive."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        refresh["company_id"] = user.company_id
        refresh["role"] = user.role

        access_token_str = str(refresh.access_token)
        refresh_token_str = str(refresh)

        response = Response({
            "message": "Login successful.",
            "access_token": access_token_str,
            "refresh_token": refresh_token_str,
            "token": access_token_str,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "company": user.company_id,
            }
        }, status=status.HTTP_200_OK)

        set_auth_cookies(response, access_token_str, refresh_token_str)
        return response


class WorkforceRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token") or request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(refresh_token)
            new_access_token = str(refresh.access_token)
            return Response({
                "access_token": new_access_token,
                "token": new_access_token,
            }, status=status.HTTP_200_OK)
        except Exception:
            return Response({"error": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        # Safely query Employee profile without triggering RelatedObjectDoesNotExist exceptions
        emp = Employee.objects.filter(user=user).first()
        
        company = getattr(user, "company", None)
        company_name = getattr(company, "company_name", "CalServices") if company else "CalServices"

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "company": user.company_id,
            "company_name": company_name,
            "is_superuser": getattr(user, "is_superuser", False),
            "employee_id": getattr(emp, "employee_id", None) if emp else None,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        response.delete_cookie("qt_access")
        response.delete_cookie("qt_refresh")
        return response
