"""
workforce-app/backend/workforce_api/management/commands/seed_workforce.py

Seeds:
1. Admin user: admin@caldim.in / Caldim@2026
2. Employee user: employee@caldim.in / Caldim@2026 (Approved Senior Technician)
3. Candidate user: candidate@caldim.in / Caldim@2026 (Submitted candidate for verification queue)
4. Sample assigned job for testing dispatch & state machine transitions
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from companies.models import Company, Region
from employees.models import Employee
from service_requests.models import ServiceRequest

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds Admin, Technician Employee, Candidate, and Sample Jobs for Workforce App."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== Seeding Workforce Data ==="))

        # 1. Ensure Region & Company
        region, _ = Region.objects.get_or_create(
            code="IN",
            defaults={"name": "India", "currency": "INR", "currency_symbol": "Rs"},
        )

        company = Company.objects.first()
        if not company:
            company = Company.objects.create(
                company_name="CalServices Operations",
                display_id="CALS",
                slug="calservices",
                primary_country="IN",
                region=region,
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created company: {company.company_name}"))
        else:
            self.stdout.write(f"Using existing company: {company.company_name}")

        # 2. Seed Admin User: admin@caldim.in / Caldim@2026
        admin_email = "admin@caldim.in"
        admin_user = User.objects.filter(email__iexact=admin_email).first()
        if not admin_user:
            admin_user = User.objects.filter(username="admin").first()

        if not admin_user:
            admin_user = User.objects.create(
                username="admin",
                email=admin_email,
                first_name="Operations",
                last_name="Admin",
                role="admin",
                company=company,
                is_staff=True,
                is_superuser=True,
                is_active=True,
                mobile_number="9999999999",
                totp_secret="",
                bio="",
            )
            admin_user.set_password("Caldim@2026")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f"Created Admin: {admin_email} / Caldim@2026"))
        else:
            admin_user.email = admin_email
            admin_user.role = "admin"
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.company = company
            admin_user.set_password("Caldim@2026")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f"Updated Admin credentials: {admin_email} / Caldim@2026"))

        # 3. Seed Approved Technician Employee: employee@caldim.in / Caldim@2026
        emp_email = "employee@caldim.in"
        emp_user = User.objects.filter(email__iexact=emp_email).first()
        if not emp_user:
            emp_user = User.objects.filter(username="employee").first()

        if not emp_user:
            emp_user = User.objects.create(
                username="employee",
                email=emp_email,
                first_name="Ramesh",
                last_name="Kumar",
                role="employee",
                company=company,
                is_active=True,
                mobile_number="9876543210",
                phone="9876543210",
                totp_secret="",
                bio="",
            )
            emp_user.set_password("Caldim@2026")
            emp_user.save()
            self.stdout.write(self.style.SUCCESS(f"Created Employee User: {emp_email} / Caldim@2026"))
        else:
            emp_user.email = emp_email
            emp_user.role = "employee"
            emp_user.company = company
            emp_user.set_password("Caldim@2026")
            emp_user.save()
            self.stdout.write(self.style.SUCCESS(f"Updated Employee credentials: {emp_email} / Caldim@2026"))

        # Setup Employee profile with APPROVED status & decoupled OFFLINE state (Rule 3)
        approved_services_list = [
            {"id": 101, "name": "AC Regular Servicing & Jet Clean", "category": "HVAC & Air Conditioning", "status": "approved"},
            {"id": 103, "name": "AC Repair & Gas Refill", "category": "HVAC & Air Conditioning", "status": "approved"},
            {"id": 202, "name": "Ceiling Fan Installation & Repair", "category": "Electrical & Wiring", "status": "approved"},
        ]

        emp_profile, _ = Employee.objects.get_or_create(
            user=emp_user,
            defaults={
                "company": company,
                "employee_id": "CALS-0001",
                "title": "Senior HVAC & Electrical Technician",
                "is_active": True,
                "is_online": False,
                "current_availability": "offline",
                "exempt_status": "non_exempt",
                "hourly_rate": 0,
            },
        )
        emp_profile.company = company
        emp_profile.employee_id = "CALS-0001"
        emp_profile.title = "Senior HVAC & Electrical Technician"
        emp_profile.is_active = True
        emp_profile.is_online = False
        emp_profile.current_availability = "offline"
        emp_profile.exempt_status = "non_exempt"
        emp_profile.service_roles = [s["name"] for s in approved_services_list]
        emp_profile.bank_details = {
            "onboarding": {
                "status": "approved",
                "step": 7,
                "draft": {
                    "personal": {"dob": "1992-06-15", "gender": "male", "emergencyName": "Priya", "emergencyPhone": "9876543219"},
                    "address": {"street": "Plot 42, Jubilee Hills Road No. 36", "city": "Hyderabad", "state": "Telangana", "pincode": "500033", "serviceRadius": 25},
                    "skills": {"experienceYears": 5, "vehicleType": "two_wheeler", "licenseNumber": "TS-0920150041234"},
                    "bank": {"accountHolder": "Ramesh Kumar", "accountNumber": "50100234567891", "ifsc": "HDFC0000123", "bankName": "HDFC Bank"},
                },
                "services": approved_services_list,
                "documents": {
                    "aadhaar": {"category": "aadhaar", "title": "National ID / Aadhaar", "status": "approved", "file_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600"},
                    "address_proof": {"category": "address_proof", "title": "Electricity Bill", "status": "approved", "file_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600"},
                    "bank_proof": {"category": "bank_proof", "title": "Bank Passbook", "status": "approved", "file_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600"},
                },
                "correction_notes": "",
                "rejection_reason": "",
                "approved_at": timezone.now().isoformat(),
                "approved_by": "admin",
            }
        }
        emp_profile.save()
        self.stdout.write(self.style.SUCCESS(f"Technician profile CALS-0001 set to APPROVED (Offline)."))

        # 4. Seed Candidate User in SUBMITTED state for Admin Queue testing
        cand_email = "candidate@caldim.in"
        cand_user = User.objects.filter(email__iexact=cand_email).first()
        if not cand_user:
            cand_user = User.objects.create(
                username="candidate_suresh",
                email=cand_email,
                first_name="Suresh",
                last_name="Reddy",
                role="employee",
                company=company,
                is_active=True,
                mobile_number="9876543299",
                phone="9876543299",
                totp_secret="",
                bio="",
            )
            cand_user.set_password("Caldim@2026")
            cand_user.save()
            self.stdout.write(self.style.SUCCESS(f"Created Candidate User: {cand_email} / Caldim@2026"))

        cand_profile, _ = Employee.objects.get_or_create(
            user=cand_user,
            defaults={
                "company": company,
                "employee_id": "CALS-0002",
                "title": "Appliance Specialist Candidate",
                "is_active": True,
                "is_online": False,
                "current_availability": "offline",
                "exempt_status": "non_exempt",
                "hourly_rate": 0,
            },
        )
        cand_profile.company = company
        cand_profile.employee_id = "CALS-0002"
        cand_profile.title = "Appliance Specialist Candidate"
        cand_profile.is_active = True
        cand_profile.is_online = False
        cand_profile.current_availability = "offline"
        cand_profile.exempt_status = "non_exempt"
        cand_profile.bank_details = {
            "onboarding": {
                "status": "submitted",
                "step": 7,
                "draft": {
                    "personal": {"dob": "1995-11-20", "gender": "male", "emergencyName": "Anand", "emergencyPhone": "9876543290"},
                    "address": {"street": "Flat 301, Madhapur Main Rd", "city": "Hyderabad", "state": "Telangana", "pincode": "500081", "serviceRadius": 20},
                    "skills": {"experienceYears": 3, "vehicleType": "two_wheeler", "licenseNumber": "TS-0920180098765"},
                    "bank": {"accountHolder": "Suresh Reddy", "accountNumber": "60100987654321", "ifsc": "SBIN0004567", "bankName": "State Bank of India"},
                },
                "services": [
                    {"id": 103, "name": "AC Repair & Gas Refill", "category": "HVAC & Air Conditioning", "status": "pending"},
                    {"id": 401, "name": "Washing Machine Diagnostic & Repair", "category": "Home Appliance Repair", "status": "pending"},
                ],
                "documents": {
                    "aadhaar": {"category": "aadhaar", "title": "Aadhaar Card", "status": "uploaded", "file_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600"},
                    "address_proof": {"category": "address_proof", "title": "Rent Agreement", "status": "uploaded", "file_url": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600"},
                    "bank_proof": {"category": "bank_proof", "title": "Cancelled Cheque", "status": "uploaded", "file_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600"},
                },
                "submitted_at": timezone.now().isoformat(),
            }
        }
        cand_profile.save()
        self.stdout.write(self.style.SUCCESS(f"Candidate profile CALS-0002 set to SUBMITTED (Ready for Admin Review)."))

        # 5. Seed Sample Active Job for Approved Employee testing
        customer_user, _ = User.objects.get_or_create(
            username="customer_anita",
            defaults={
                "email": "anita.customer@gmail.com",
                "first_name": "Anita",
                "last_name": "Sharma",
                "role": "customer",
                "company": company,
                "mobile_number": "9876543288",
                "totp_secret": "",
                "bio": "",
            },
        )

        job = ServiceRequest.objects.filter(assigned_employee=emp_profile).first()
        if not job:
            job = ServiceRequest.objects.create(
                company=company,
                customer=customer_user,
                customer_name="Anita Sharma",
                phone="9876543288",
                assigned_employee=emp_profile,
                service_category="hvac",
                issue_title="Split AC Cooling Issue & Low Airflow",
                description="Master bedroom AC is not cooling properly and blowing warm air. Needs refrigerant pressure check and filter cleaning.",
                status="assigned",
                priority="high",
                address="Villa 18, Green Meadows, Gachibowli, Hyderabad - 500032",
                preferred_date=timezone.now().date(),
                preferred_time="11:00 AM - 01:00 PM",
                total_amount=1499.00,
                cart_data=[],
                drop_address="",
                payment_status="pending",
                payment_method="COD",
            )
            self.stdout.write(self.style.SUCCESS(f"Created Sample Job #{job.id} ({job.request_id}) assigned to Ramesh Kumar."))
        else:
            job.status = "assigned"
            job.save()
            self.stdout.write(self.style.SUCCESS(f"Updated Sample Job #{job.id} ({job.request_id}) status to ASSIGNED."))

        self.stdout.write(self.style.NOTICE("=== Seeding Complete! ==="))
        self.stdout.write(self.style.SUCCESS("Logins ready:"))
        self.stdout.write(f"  * Admin:      admin@caldim.in    / Caldim@2026 (Routes to Admin Verification Queue)")
        self.stdout.write(f"  * Employee:   employee@caldim.in / Caldim@2026 (Routes to Technician Dashboard)")
        self.stdout.write(f"  * Candidate:  candidate@caldim.in / Caldim@2026 (Shows in Admin Review Queue)")
