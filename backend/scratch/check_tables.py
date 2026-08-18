import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from workforce_api.models import PostServiceProof, WorkforceWorkExtension, WorkforceJobOffer, JobTrackingSession, JobPayment, PaymentCollectionEvent
print('PostServiceProof:', PostServiceProof._meta.db_table)
print('WorkforceWorkExtension:', WorkforceWorkExtension._meta.db_table)
print('WorkforceJobOffer:', WorkforceJobOffer._meta.db_table)
print('JobTrackingSession:', JobTrackingSession._meta.db_table)
print('JobPayment:', JobPayment._meta.db_table)
print('PaymentCollectionEvent:', PaymentCollectionEvent._meta.db_table)
