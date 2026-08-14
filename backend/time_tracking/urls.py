from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClockInView, ClockOutView, BreakStartView, BreakEndView,
    GeofenceCheckView, TimeLogViewSet, LocationViewSet, JobSiteViewSet
)

from workforce_api.views import WorkforceTimeTrackingView

router = DefaultRouter()
router.register(r"locations", LocationViewSet, basename="time-tracking-locations")
router.register(r"job-sites", JobSiteViewSet, basename="time-tracking-job-sites")
router.register(r"logs", TimeLogViewSet, basename="time-tracking-logs")

urlpatterns = [
    path("", WorkforceTimeTrackingView.as_view(), name="workforce-time-tracking"),
    path("clock-in/", ClockInView.as_view(), name="time-tracking-clock-in"),
    path("clock-out/", ClockOutView.as_view(), name="time-tracking-clock-out"),
    path("break/start/", BreakStartView.as_view(), name="time-tracking-break-start"),
    path("break/end/", BreakEndView.as_view(), name="time-tracking-break-end"),
    path("geofence/check/", GeofenceCheckView.as_view(), name="time-tracking-geofence-check"),
    path("", include(router.urls)),
]
