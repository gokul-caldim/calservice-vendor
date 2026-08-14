"""
workforce-app/backend/companies/middleware.py
Resolves request.company for the currently authenticated user from JWT token/cookie.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class CompanyMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.company = None
        company = None

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token_str = None
        if auth_header.startswith('Bearer '):
            token_str = auth_header.split(' ')[1]
        else:
            cookie_name = getattr(settings, "AUTH_COOKIE", "qt_access")
            token_str = request.COOKIES.get(cookie_name)

        if token_str:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                token = AccessToken(token_str)
                company_id = token.get('company_id')
                user_id = token.get('user_id')
                if user_id:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    u = User.objects.filter(id=user_id).first()
                    if u and u.company_id:
                        company = u.company
                if not company and company_id:
                    from companies.models import Company
                    company = Company.objects.filter(id=company_id).first()
            except Exception:
                pass

        if not company:
            user = getattr(request, 'user', None)
            if user and user.is_authenticated:
                company = getattr(user, 'company', None)

        request.company = company
        return None
