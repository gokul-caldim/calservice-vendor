"""
workforce-app/backend/accounts/models.py
User model pointing to shared accounts_user table (managed=False).
"""
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def _create_user(self, username, email, password, **extra_fields):
        if not username:
            raise ValueError("Username must be set")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        return self._create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, null=True, blank=True, related_name="users")
    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[username_validator],
    )
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        EMPLOYEE = "employee", "Employee"
        KIOSK = "kiosk", "Kiosk"
        CUSTOMER = "customer", "Customer"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)
    bio = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=30, unique=True, null=True, blank=True)
    mobile_number = models.CharField(max_length=15, unique=True, null=True, blank=True, db_index=True)
    profile_complete = models.BooleanField(default=False)
    last_known_location = models.JSONField(null=True, blank=True, default=dict)
    timezone = models.CharField(max_length=60, default="UTC")
    language = models.CharField(max_length=10, default="en")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    # 2FA & OTP fields (with NOT NULL constraints in DB)
    totp_secret = models.CharField(max_length=100, blank=True, default="")
    two_fa_enabled = models.BooleanField(default=False)
    email_otp = models.CharField(max_length=6, blank=True, null=True)
    phone_otp = models.CharField(max_length=6, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        managed = False
        db_table = "accounts_user"

    def save(self, *args, **kwargs):
        if not self.phone:
            self.phone = None
        if not self.mobile_number:
            self.mobile_number = None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def get_short_name(self):
        return self.first_name

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser
