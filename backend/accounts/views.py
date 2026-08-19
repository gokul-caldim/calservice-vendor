"""
workforce-app/backend/accounts/views.py
Authentication views for Workforce Backend.
"""
import logging
from django.contrib.auth import get_user_model
from django.db import models
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import set_auth_cookies
from employees.models import Employee

logger = logging.getLogger(__name__)
User = get_user_model()


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            identifier = (
                request.data.get("identifier")
                or request.data.get("username")
                or request.data.get("email")
                or request.data.get("employee_id")
                or ""
            ).strip()
            password = str(request.data.get("password") or "")

            if not identifier or not password:
                return Response(
                    {"error": "Identifier and password required.", "code": "CREDENTIALS_REQUIRED"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Look up user by email, username, mobile number, phone, or employee ID
            user = User.objects.filter(
                models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier)
            ).first()

            if not user:
                try:
                    user = User.objects.filter(mobile_number=identifier).first()
                except Exception:
                    pass

            if not user:
                try:
                    user = User.objects.filter(phone=identifier).first()
                except Exception:
                    pass

            if not user:
                try:
                    emp = Employee.objects.filter(employee_id__iexact=identifier).select_related("user").first()
                    if emp and emp.user:
                        user = emp.user
                except Exception:
                    pass

            if not user or not user.check_password(password):
                return Response(
                    {"error": "Invalid credentials. Please verify your email/password.", "code": "INVALID_CREDENTIALS"},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not user.is_active:
                return Response(
                    {"error": "Account is inactive.", "code": "ACCOUNT_INACTIVE"},
                    status=status.HTTP_403_FORBIDDEN
                )

            emp = None
            try:
                emp = Employee.objects.filter(user=user).first()
            except Exception:
                emp = None

            user_role = getattr(user, "role", "employee")
            if emp and user_role not in ["admin", "manager"]:
                user_role = "employee"

            company_id = getattr(user, "company_id", None) or (getattr(emp, "company_id", None) if emp else None)

            refresh = RefreshToken.for_user(user)
            if company_id:
                refresh["company_id"] = company_id
            refresh["role"] = user_role

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
                    "email": user.email or "",
                    "first_name": user.first_name or "",
                    "last_name": user.last_name or "",
                    "role": user_role,
                    "company": company_id,
                }
            }, status=status.HTTP_200_OK)

            set_auth_cookies(response, access_token_str, refresh_token_str)
            return response
        except Exception as e:
            logger.error("Error in LoginView: %s", str(e), exc_info=True)
            return Response(
                {"error": "Unable to complete sign-in. Please try again later.", "code": "LOGIN_ERROR"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WorkforceRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.db import connection, DatabaseError, OperationalError
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        refresh_token = request.data.get("refresh_token") or request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token required.", "code": "TOKEN_REQUIRED"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(refresh_token)
        except (InvalidToken, TokenError):
            return Response({"error": "Invalid or expired refresh token.", "code": "INVALID_REFRESH_TOKEN"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            return Response({"error": "Invalid refresh token format.", "code": "INVALID_REFRESH_TOKEN"}, status=status.HTTP_401_UNAUTHORIZED)

        user_role = "employee"
        company_id = None

        try:
            # Re-resolve user and refresh claims on newly issued access token
            user_id = refresh.payload.get("user_id")
            if user_id:
                user = User.objects.filter(id=user_id).first()
                if user:
                    emp = getattr(user, "employee_profile", None)
                    if not emp:
                        try:
                            emp = Employee.objects.filter(user=user).first()
                        except Exception:
                            emp = None
                    user_role = getattr(user, "role", "employee")
                    if emp and user_role not in ["admin", "manager"]:
                        user_role = "employee"
                    company_id = getattr(user, "company_id", None) or (getattr(emp, "company_id", None) if emp else None)
        except (OperationalError, DatabaseError) as db_err:
            logger.error("[Refresh DB] Database unavailable during token refresh: %s", str(db_err))
            return Response(
                {"error": "Database service temporarily unavailable. Please retry shortly.", "code": "DB_UNAVAILABLE"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        finally:
            connection.close()

        access_obj = refresh.access_token
        if company_id:
            refresh["company_id"] = company_id
            access_obj["company_id"] = company_id
        refresh["role"] = user_role
        access_obj["role"] = user_role

        new_access_token = str(access_obj)
        new_refresh_token = str(refresh)
        response = Response({
            "access_token": new_access_token,
            "token": new_access_token,
            "refresh_token": new_refresh_token,
            "refresh": new_refresh_token,
        }, status=status.HTTP_200_OK)
        set_auth_cookies(response, new_access_token, new_refresh_token)
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            if not user or not getattr(user, "is_authenticated", False):
                return Response({"error": "Unauthorized", "code": "UNAUTHORIZED"}, status=status.HTTP_401_UNAUTHORIZED)

            # Safely query Employee profile without triggering RelatedObjectDoesNotExist exceptions
            emp = None
            try:
                emp = Employee.objects.filter(user=user).first()
            except Exception as e:
                logger.warning("Error fetching employee profile for user #%s: %s", getattr(user, "id", None), str(e))

            company_id = getattr(user, "company_id", None)
            company_obj = getattr(user, "company", None)
            if not company_obj and emp and getattr(emp, "company", None):
                company_obj = emp.company
                company_id = emp.company_id

            company_name = getattr(company_obj, "company_name", None) if company_obj else None

            user_role = getattr(user, "role", "employee")
            if emp and user_role not in ["admin", "manager"]:
                user_role = "employee"

            return Response({
                "id": user.id,
                "username": user.username,
                "email": user.email or "",
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "role": user_role,
                "company": company_id,
                "company_name": company_name,
                "is_superuser": getattr(user, "is_superuser", False),
                "employee_id": getattr(emp, "employee_id", None) if emp else None,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error("Unhandled exception in MeView: %s", str(e), exc_info=True)
            return Response(
                {"error": "Failed to retrieve user profile.", "code": "AUTH_ME_ERROR"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        response.delete_cookie("qt_access")
        response.delete_cookie("qt_refresh")
        return response
