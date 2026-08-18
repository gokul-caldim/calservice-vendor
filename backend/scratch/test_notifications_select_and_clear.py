import os
import sys
import django
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from workforce_api.models import WorkforceNotification
from workforce_api.views import (
    WorkforceNotificationListView,
    WorkforceNotificationMarkReadView,
    WorkforceNotificationClearView,
)

User = get_user_model()
factory = APIRequestFactory()

def run_tests():
    print("--- Starting Notifications Select & Clear Verification ---")
    
    # 1. Setup test users
    user1, _ = User.objects.get_or_create(username="notif_test_user1", defaults={"email": "notif1@test.com", "phone": "+919999900001", "role": "technician"})
    user2, _ = User.objects.get_or_create(username="notif_test_user2", defaults={"email": "notif2@test.com", "phone": "+919999900002", "role": "technician"})
    
    # Clear any old test notifs
    WorkforceNotification.objects.filter(recipient__in=[user1, user2]).delete()
    
    # 2. Create sample notifications for user1
    n1 = WorkforceNotification.objects.create(recipient=user1, title="Job Offer Accepted", message="You accepted Job #2016", notification_type="JOB_OFFER", is_read=False)
    n2 = WorkforceNotification.objects.create(recipient=user1, title="New Job Offer Available!", message="Exclusive offer 1", notification_type="JOB_OFFER", is_read=False)
    n3 = WorkforceNotification.objects.create(recipient=user1, title="New Job Offer Available!", message="Exclusive offer 2", notification_type="JOB_OFFER", is_read=False)
    n4 = WorkforceNotification.objects.create(recipient=user1, title="System Alert", message="System maintenance tonight", notification_type="SYSTEM", is_read=True)
    
    # User2 notif (to verify isolation)
    n_other = WorkforceNotification.objects.create(recipient=user2, title="Other User Notif", message="Private", notification_type="JOB_OFFER", is_read=False)
    
    # Test GET notifications
    req = factory.get("/api/workforce/notifications/")
    force_authenticate(req, user=user1)
    view = WorkforceNotificationListView.as_view()
    resp = view(req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.data["unread_count"] == 3, f"Expected unread 3, got {resp.data['unread_count']}"
    assert len(resp.data["notifications"]) == 4, f"Expected 4 notifs, got {len(resp.data['notifications'])}"
    print("[PASS] GET /api/workforce/notifications/ passed: 4 notifications returned, unread_count=3")

    # Test Mark Selected Read (e.g. n2 and n3)
    mark_req = factory.post(
        "/api/workforce/notifications/mark-read/",
        data=json.dumps({"ids": [n2.id, n3.id]}),
        content_type="application/json"
    )
    force_authenticate(mark_req, user=user1)
    mark_view = WorkforceNotificationMarkReadView.as_view()
    resp = mark_view(mark_req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.data["unread_count"] == 1, f"Expected unread 1, got {resp.data['unread_count']}"
    n2.refresh_from_db()
    n3.refresh_from_db()
    n1.refresh_from_db()
    assert n2.is_read is True and n3.is_read is True and n1.is_read is False
    print("[PASS] POST /api/workforce/notifications/mark-read/ with selected IDs passed")

    # Test Clear Selected (e.g. n2 and n4)
    clear_req = factory.post(
        "/api/workforce/notifications/clear/",
        data=json.dumps({"ids": [n2.id, n4.id]}),
        content_type="application/json"
    )
    force_authenticate(clear_req, user=user1)
    clear_view = WorkforceNotificationClearView.as_view()
    resp = clear_view(clear_req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.data["deleted_count"] == 2, f"Expected deleted 2, got {resp.data['deleted_count']}"
    assert not WorkforceNotification.objects.filter(id=n2.id).exists()
    assert not WorkforceNotification.objects.filter(id=n4.id).exists()
    assert WorkforceNotification.objects.filter(id=n1.id).exists()
    assert WorkforceNotification.objects.filter(id=n3.id).exists()
    print("[PASS] POST /api/workforce/notifications/clear/ with selected IDs passed")

    # Test Clear Single pk (n3)
    clear_single_req = factory.post(f"/api/workforce/notifications/{n3.id}/clear/")
    force_authenticate(clear_single_req, user=user1)
    resp = clear_view(clear_single_req, pk=n3.id)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert not WorkforceNotification.objects.filter(id=n3.id).exists()
    print(f"[PASS] POST /api/workforce/notifications/{n3.id}/clear/ passed")

    # Test User Isolation: user1 cannot clear user2's notif
    clear_iso_req = factory.post(f"/api/workforce/notifications/{n_other.id}/clear/")
    force_authenticate(clear_iso_req, user=user1)
    resp = clear_view(clear_iso_req, pk=n_other.id)
    assert resp.status_code == 200
    assert resp.data["deleted_count"] == 0
    assert WorkforceNotification.objects.filter(id=n_other.id).exists(), "User2 notif must NOT be deleted by User1!"
    print("[PASS] Tenant & User Isolation check passed: User1 cannot delete User2's notifications")

    # Test Clear All remaining for user1 (n1)
    clear_all_req = factory.post("/api/workforce/notifications/clear/", data=json.dumps({"all": True}), content_type="application/json")
    force_authenticate(clear_all_req, user=user1)
    resp = clear_view(clear_all_req)
    assert resp.status_code == 200
    assert resp.data["deleted_count"] >= 1
    assert WorkforceNotification.objects.filter(recipient=user1).count() == 0
    assert WorkforceNotification.objects.filter(recipient=user2).count() == 1
    print("[PASS] Clear All passed: User1 has 0 notifications, User2 still has 1 notification")

    # Cleanup
    WorkforceNotification.objects.filter(recipient__in=[user1, user2]).delete()
    user1.delete()
    user2.delete()
    print("--- ALL NOTIFICATION SELECT & CLEAR TESTS PASSED! ---")

if __name__ == "__main__":
    run_tests()
