"""
workforce-app/backend/accounts/authentication.py
JWT cookie authentication backend matching primary backend.
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


from django.db import DatabaseError, OperationalError
from rest_framework.exceptions import APIException
from rest_framework import status


class ServiceUnavailableException(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Database service temporarily unavailable. Please retry shortly."
    default_code = "DB_UNAVAILABLE"


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token:
                try:
                    validated = self.get_validated_token(raw_token)
                    return self.get_user(validated), validated
                except (OperationalError, DatabaseError):
                    raise ServiceUnavailableException()
                except Exception:
                    # Explicit Bearer token provided but invalid/expired; do NOT fall back to cookies
                    return None

        cookie_token = request.COOKIES.get(settings.AUTH_COOKIE)
        if cookie_token:
            try:
                validated = self.get_validated_token(cookie_token)
                return self.get_user(validated), validated
            except (OperationalError, DatabaseError):
                raise ServiceUnavailableException()
            except Exception:
                pass

        # Support query param ?token= for EventSource / SSE / WebSockets
        param_token = request.query_params.get("token") if hasattr(request, "query_params") else request.GET.get("token")
        if param_token:
            try:
                validated = self.get_validated_token(param_token)
                return self.get_user(validated), validated
            except (OperationalError, DatabaseError):
                raise ServiceUnavailableException()
            except Exception:
                pass

        return None


def set_auth_cookies(response, access_token, refresh_token=None):
    secure = getattr(settings, "AUTH_COOKIE_SECURE", False)
    samesite = getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax")
    domain = getattr(settings, "AUTH_COOKIE_DOMAIN", None)

    access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

    response.set_cookie(
        settings.AUTH_COOKIE,
        str(access_token),
        max_age=access_max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=domain,
        path="/",
    )
    if refresh_token is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            str(refresh_token),
            max_age=refresh_max_age,
            httponly=True,
            secure=secure,
            samesite=samesite,
            domain=domain,
            path="/",
        )
