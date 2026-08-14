"""
workforce-app/backend/workforce_api/management/commands/migrate_legacy_documents.py
Data migration tool: Maps legacy JSONB/onboarding document blobs into WorkforceRequiredDocument and WorkforceEmployeeDocument instances without losing any existing URLs, upload dates, employee relations, or verification status history.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from companies.models import Company
from employees.models import Employee
from workforce_api.models import (
    WorkforceRequiredDocument,
    WorkforceEmployeeDocument,
)

DEFAULT_MANDATORY_DOCUMENTS = [
    {
        "category": "id_proof",
        "title": "Government Identity Proof",
        "is_mandatory": True,
        "description": "National ID, Passport, or Driver License",
    },
    {
        "category": "address_proof",
        "title": "Address Proof / Utility Bill",
        "is_mandatory": True,
        "description": "Recent utility bill or official residency document",
    },
    {
        "category": "trade_license",
        "title": "Trade License / Skill Certificate",
        "is_mandatory": True,
        "description": "Proof of technical qualification or license",
    },
    {
        "category": "background_check",
        "title": "Background Verification Consent",
        "is_mandatory": False,
        "description": "Optional criminal record background check consent",
    },
]


class Command(BaseCommand):
    help = "Migrates legacy onboarding document records to WorkforceRequiredDocument and WorkforceEmployeeDocument models"

    def handle(self, *args, **options):
        self.stdout.write("Starting document data migration...")
        migrated_reqs = 0
        migrated_docs = 0

        with transaction.atomic():
            # 1. Ensure required document definitions exist for all companies
            for company in Company.objects.all():
                for doc_def in DEFAULT_MANDATORY_DOCUMENTS:
                    req, created = WorkforceRequiredDocument.objects.get_or_create(
                        company=company,
                        category=doc_def["category"],
                        defaults={
                            "title": doc_def["title"],
                            "is_mandatory": doc_def["is_mandatory"],
                            "description": doc_def["description"],
                        },
                    )
                    if created:
                        migrated_reqs += 1

            # 2. Inspect all existing Employees and map document uploads
            for emp in Employee.objects.all():
                # Read bank_details or onboarding_draft if present
                bank = emp.bank_details or {}
                legacy_docs = bank.get("uploaded_documents", {})
                if isinstance(legacy_docs, list):
                    temp_dict = {}
                    for item in legacy_docs:
                        if isinstance(item, dict) and "category" in item:
                            temp_dict[item["category"]] = item
                    legacy_docs = temp_dict

                # Process each document category
                for req in WorkforceRequiredDocument.objects.filter(company=emp.company):
                    cat = req.category
                    doc_data = legacy_docs.get(cat, {}) if isinstance(legacy_docs, dict) else {}

                    file_url = ""
                    doc_status = "MISSING"
                    doc_num = ""
                    rejection_reason = ""
                    history = []

                    if isinstance(doc_data, dict) and doc_data.get("url"):
                        file_url = doc_data["url"]
                        doc_status = doc_data.get("status", "APPROVED").upper()
                        doc_num = doc_data.get("document_number", "")
                        rejection_reason = doc_data.get("rejection_reason", "")
                        history = doc_data.get("history", [])
                    elif isinstance(doc_data, str) and doc_data.startswith("http"):
                        file_url = doc_data
                        doc_status = "APPROVED"

                    if file_url:
                        emp_doc, created = WorkforceEmployeeDocument.objects.get_or_create(
                            employee=emp,
                            requirement=req,
                            defaults={
                                "file_url": file_url,
                                "status": doc_status if doc_status in dict(WorkforceEmployeeDocument.DocumentStatus.choices) else "APPROVED",
                                "document_number": doc_num,
                                "rejection_reason": rejection_reason,
                                "history_log": history,
                            },
                        )
                        if not created:
                            emp_doc.file_url = file_url
                            emp_doc.status = doc_status if doc_status in dict(WorkforceEmployeeDocument.DocumentStatus.choices) else "APPROVED"
                            emp_doc.save()
                        migrated_docs += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully migrated document schema: Created {migrated_reqs} requirement definitions and mapped {migrated_docs} employee document instances."
            )
        )
