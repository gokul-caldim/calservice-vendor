"""
workforce_core/settings.py
Django settings for the dedicated Workforce Backend (Port 8001).
Shared database with primary backend, zero duplicated tables (managed=False).
"""


import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file with override=True to guarantee local .env takes precedence over inherited shell env vars
load_dotenv(BASE_DIR / ".env", override=True)

_raw_secret = os.getenv("SECRET_KEY") or os.getenv("DJANGO_SECRET_KEY")
DEBUG = (os.getenv("DEBUG") or os.getenv("DJANGO_DEBUG") or "True").lower() in ("true", "1", "t")

if not _raw_secret:
    if DEBUG:
        SECRET_KEY = "dev-insecure-workforce-secret-key-caltrack-local-testing-only"
    else:
        raise ValueError("CRITICAL SECURITY ERROR: SECRET_KEY environment variable is mandatory in production (DEBUG=False).")
else:
    SECRET_KEY = _raw_secret

_allowed_hosts_env = os.getenv("ALLOWED_HOSTS")
if _allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(",") if h.strip()] + ["testserver"]
else:
    ALLOWED_HOSTS = ["*"] if DEBUG else ["localhost", "127.0.0.1", "testserver"]

# Application definition
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",

    # Workforce core unmanaged domain apps
    "common",
    "companies",
    "accounts",
    "employees",
    "service_requests",
    "workforce_api",
    "time_tracking",

    # Vendor Wallet financial module
    "vendor_wallet",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "companies.middleware.CompanyMiddleware",
]

ROOT_URLCONF = "workforce_core.urls"
APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "workforce_core.wsgi.application"
ASGI_APPLICATION = "workforce_core.asgi.application"

# ─── Database Configuration (Shared Supabase PostgreSQL) ──────────────────────

USE_POSTGRES = os.getenv("DB_NAME") or os.getenv("DB_HOST")

if USE_POSTGRES:
    _db_options = {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
    _sslmode = os.getenv("DB_SSLMODE", "")
    if _sslmode:
        _db_options["sslmode"] = _sslmode

    _connection_opts = [f'-c search_path={os.getenv("DB_SCHEMA", "public")}']
    _stmt_timeout = os.getenv("DB_STATEMENT_TIMEOUT", "")
    if _stmt_timeout:
        _connection_opts.append(f"-c statement_timeout={_stmt_timeout}")
    _db_options["options"] = " ".join(_connection_opts)

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "postgres"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "6543"),
            "OPTIONS": _db_options,
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "0")),
            "CONN_HEALTH_CHECKS": True,
            "DISABLE_SERVER_SIDE_CURSORS": True,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── REST Framework & JWT Auth ────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieJWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "480"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_COOKIE = "qt_access"
AUTH_COOKIE_REFRESH = "qt_refresh"
AUTH_COOKIE_SECURE = not DEBUG
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax" if DEBUG else "Strict")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", None)

# ─── CORS ─────────────────────────────────────────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = DEBUG
_cors_env = os.getenv("CORS_ALLOWED_ORIGINS")
if _cors_env:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        # Workforce Frontend
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        # Customer Frontend
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Platform Admin Frontend
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

_csrf_env = os.getenv("CSRF_TRUSTED_ORIGINS")
if _csrf_env:
    CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in _csrf_env.split(",") if origin.strip()]
else:
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]
