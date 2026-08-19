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
    authentication_classes = []

    def post(self, request):
        from django.db import DatabaseError, OperationalError
        identifier = ""
        lookup_type = "none"
        matched_user_id = None
        matched_user_active = None
        password_check = False
        db_status = "ok"
        response_code = 500
        response_code_name = "INTERNAL_AUTH_ERROR"

        try:
            raw_ident = (
                request.data.get("identifier")
                or request.data.get("username")
                or request.data.get("email")
                or request.data.get("employee_id")
                or ""
            )
            identifier = str(raw_ident).strip()
            password = str(request.data.get("password") or "")

            if not identifier or not password:
                response_code = status.HTTP_400_BAD_REQUEST
                response_code_name = "CREDENTIALS_REQUIRED"
                logger.info(
                    "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                    identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
                )
                return Response(
                    {"error": "Identifier and password required.", "code": response_code_name},
                    status=response_code
                )

            # Step 1: Look up active users first (deterministic ordering, resilient retry on transient pooler connection drop)
            user = None
            max_attempts = 2
            for attempt in range(max_attempts):
                try:
                    active_users = list(User.objects.filter(
                        is_active=True
                    ).filter(
                        models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier)
                    ).order_by("id")[:2])

                    if active_users:
                        user = active_users[0]
                        lookup_type = "email_or_username"
                        if len(active_users) > 1:
                            logger.warning("[AUTH LOGIN] Multiple active users matched email/username: %s", identifier)

                    if not user:
                        active_phone_users = list(User.objects.filter(
                            is_active=True
                        ).filter(
                            models.Q(mobile_number=identifier) | models.Q(phone=identifier)
                        ).order_by("id")[:2])
                        if active_phone_users:
                            user = active_phone_users[0]
                            lookup_type = "phone_or_mobile"

                    if not user:
                        emp = Employee.objects.filter(employee_id__iexact=identifier).select_related("user").first()
                        if emp and emp.user and getattr(emp.user, "is_active", False):
                            user = emp.user
                            lookup_type = "employee_id"
                    break
                except (OperationalError, DatabaseError) as db_lookup_err:
                    if attempt < max_attempts - 1:
                        import time
                        time.sleep(0.05)
                        continue
                    db_status = "error"
                    response_code = status.HTTP_503_SERVICE_UNAVAILABLE
                    response_code_name = "DB_UNAVAILABLE"
                    logger.error("[Login DB] Database error during active user lookup: %s", str(db_lookup_err))
                    logger.info(
                        "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                        identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
                    )
                    return Response(
                        {"error": "Database service temporarily unavailable. Please retry shortly.", "code": response_code_name},
                        status=response_code
                    )

            # Step 2: If no active user found, check if an inactive account matches
            if not user:
                try:
                    inactive_user = User.objects.filter(
                        is_active=False
                    ).filter(
                        models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier) |
                        models.Q(mobile_number=identifier) | models.Q(phone=identifier)
                    ).order_by("id").first()
                    if not inactive_user:
                        emp_inactive = Employee.objects.filter(employee_id__iexact=identifier).select_related("user").first()
                        if emp_inactive and emp_inactive.user:
                            inactive_user = emp_inactive.user
                    if inactive_user:
                        matched_user_id = inactive_user.id
                        matched_user_active = False
                        lookup_type = "inactive_match"
                        response_code = status.HTTP_403_FORBIDDEN
                        response_code_name = "ACCOUNT_INACTIVE"
                        logger.info(
                            "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                            identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
                        )
                        return Response(
                            {"error": "Account is inactive or deactivated. Please contact your administrator.", "code": response_code_name},
                            status=response_code
                        )
                except (OperationalError, DatabaseError) as db_inact_err:
                    db_status = "error"
                    response_code = status.HTTP_503_SERVICE_UNAVAILABLE
                    response_code_name = "DB_UNAVAILABLE"
                    logger.error("[Login DB] Database error during inactive check: %s", str(db_inact_err))
                    logger.info(
                        "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                        identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
                    )
                    return Response(
                        {"error": "Database service temporarily unavailable. Please retry shortly.", "code": response_code_name},
                        status=response_code
                    )

            # Step 3: Authoritative password validation
            if user:
                matched_user_id = user.id
                matched_user_active = bool(user.is_active)
                password_check = bool(user.check_password(password))

            if not user or not password_check:
                response_code = status.HTTP_401_UNAUTHORIZED
                response_code_name = "INVALID_CREDENTIALS"
                logger.info(
                    "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                    identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
                )
                return Response(
                    {"error": "Invalid credentials. Please verify your email/username and password.", "code": response_code_name},
                    status=response_code
                )

            # Step 4: Resolve authoritative role and company context
            emp = None
            try:
                emp = Employee.objects.filter(user=user).select_related("company").first()
            except Exception:
                emp = None

            user_role = (getattr(user, "role", None) or "employee").lower()
            if emp and user_role not in ["admin", "manager"]:
                user_role = "employee"

            company_id = getattr(user, "company_id", None) or (getattr(emp, "company_id", None) if emp else None)
            company_obj = getattr(user, "company", None) or (getattr(emp, "company", None) if emp else None)
            company_name = getattr(company_obj, "company_name", "") if company_obj else ""

            # Step 5: Issue JWT access and refresh tokens
            refresh = RefreshToken.for_user(user)
            if company_id:
                refresh["company_id"] = company_id
            refresh["role"] = user_role

            access_token_str = str(refresh.access_token)
            refresh_token_str = str(refresh)

            response_code = status.HTTP_200_OK
            response_code_name = "SUCCESS"
            logger.info(
                "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
            )

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
                    "company_name": company_name,
                    "is_superuser": getattr(user, "is_superuser", False),
                    "employee_id": getattr(emp, "employee_id", None) if emp else None,
                }
            }, status=response_code)

            set_auth_cookies(response, access_token_str, refresh_token_str)
            return response
        except (OperationalError, DatabaseError) as db_err:
            db_status = "error"
            response_code = status.HTTP_503_SERVICE_UNAVAILABLE
            response_code_name = "DB_UNAVAILABLE"
            logger.error("Database error in LoginView: %s", str(db_err), exc_info=True)
            logger.info(
                "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
            )
            return Response(
                {"error": "Database service temporarily unavailable. Please retry shortly.", "code": response_code_name},
                status=response_code
            )
        except Exception as e:
            response_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            response_code_name = "INTERNAL_AUTH_ERROR"
            logger.error("Error in LoginView: %s", str(e), exc_info=True)
            logger.info(
                "[AUTH LOGIN] identifier_normalized=%s lookup_type=%s matched_user_id=%s matched_user_active=%s password_check=%s db_status=%s response_code=%s response_code_name=%s",
                identifier, lookup_type, matched_user_id, matched_user_active, password_check, db_status, response_code, response_code_name
            )
            return Response(
                {"error": "Unable to complete sign-in. Please try again later.", "code": response_code_name},
                status=response_code
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
        from django.db import DatabaseError, OperationalError
        try:
            user = request.user
            if not user or not getattr(user, "is_authenticated", False):
                return Response({"error": "Unauthorized", "code": "UNAUTHORIZED"}, status=status.HTTP_401_UNAUTHORIZED)

            # Safely query Employee profile without triggering RelatedObjectDoesNotExist exceptions
            emp = None
            try:
                emp = Employee.objects.filter(user=user).select_related("company").first()
            except (OperationalError, DatabaseError):
                raise
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
        except (OperationalError, DatabaseError) as db_err:
            logger.error("Database error in MeView: %s", str(db_err), exc_info=True)
            return Response(
                {"error": "Database service temporarily unavailable. Please retry shortly.", "code": "DB_UNAVAILABLE"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
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
