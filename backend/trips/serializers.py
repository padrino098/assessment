from decimal import Decimal

from rest_framework import serializers

from .models import DailyLog, Stop, Trip


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = [
            "id",
            "sequence",
            "kind",
            "duty_status",
            "label",
            "lat",
            "lng",
            "arrive_min",
            "depart_min",
            "miles_so_far",
        ]


class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = [
            "id",
            "day_index",
            "start_location",
            "end_location",
            "miles_driven",
            "totals",
            "segments",
            "remarks",
        ]


class TripListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "id",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_used_hrs",
            "total_distance_mi",
            "total_duration_hrs",
            "days_required",
            "created_at",
        ]


class TripDetailSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    daily_logs = DailyLogSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_used_hrs",
            "current_coords",
            "pickup_coords",
            "dropoff_coords",
            "total_distance_mi",
            "total_duration_hrs",
            "total_driving_hrs",
            "total_on_duty_hrs",
            "days_required",
            "route_geometry",
            "created_at",
            "stops",
            "daily_logs",
        ]


class TripCreateSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_used_hrs = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("70")
    )
