from rest_framework import serializers
from .models import TimeLog, Break, TimeLogPhoto, JobSite, Location, LocationZone, EmployeeLocation


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"


class JobSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobSite
        fields = "__all__"


class LocationZoneSerializer(serializers.ModelSerializer):
    locations = LocationSerializer(many=True, read_only=True)

    class Meta:
        model = LocationZone
        fields = "__all__"


class EmployeeLocationSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)

    class Meta:
        model = EmployeeLocation
        fields = "__all__"


class BreakSerializer(serializers.ModelSerializer):
    duration_minutes = serializers.ReadOnlyField()

    class Meta:
        model = Break
        fields = "__all__"


class TimeLogPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeLogPhoto
        fields = "__all__"


class TimeLogSerializer(serializers.ModelSerializer):
    breaks = BreakSerializer(many=True, read_only=True)
    photos = TimeLogPhotoSerializer(many=True, read_only=True)
    location = LocationSerializer(read_only=True)
    worked_seconds = serializers.ReadOnlyField()
    break_seconds = serializers.ReadOnlyField()
    is_open = serializers.ReadOnlyField()
    user_username = serializers.ReadOnlyField(source="user.username")
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = TimeLog
        fields = "__all__"

    def get_employee_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return f"Employee #{obj.employee_id}"
