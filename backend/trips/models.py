from django.db import models


class Trip(models.Model):
    """A planned trip with computed HOS-aware itinerary."""

    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used_hrs = models.DecimalField(max_digits=5, decimal_places=2)

    current_coords = models.JSONField(default=dict, blank=True)  # {lat, lng, display_name}
    pickup_coords = models.JSONField(default=dict, blank=True)
    dropoff_coords = models.JSONField(default=dict, blank=True)

    total_distance_mi = models.FloatField(default=0)
    total_duration_hrs = models.FloatField(default=0)
    total_driving_hrs = models.FloatField(default=0)
    total_on_duty_hrs = models.FloatField(default=0)
    days_required = models.IntegerField(default=0)

    route_geometry = models.JSONField(default=dict, blank=True)  # GeoJSON LineString

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Trip {self.pk}: {self.pickup_location} -> {self.dropoff_location}"


class Stop(models.Model):
    """An ordered event along the trip: start, pickup, fuel, break, rest, dropoff, end."""

    KIND_CHOICES = [
        ("start", "Start"),
        ("pickup", "Pickup"),
        ("dropoff", "Dropoff"),
        ("fuel", "Fuel"),
        ("break", "Break"),
        ("rest", "Rest"),
        ("end", "End"),
    ]
    DUTY_CHOICES = [
        ("off", "Off Duty"),
        ("sb", "Sleeper Berth"),
        ("driving", "Driving"),
        ("on", "On Duty Not Driving"),
    ]

    trip = models.ForeignKey(Trip, related_name="stops", on_delete=models.CASCADE)
    sequence = models.IntegerField()
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    duty_status = models.CharField(max_length=16, choices=DUTY_CHOICES)
    label = models.CharField(max_length=255, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    arrive_min = models.IntegerField()  # minutes since t=0
    depart_min = models.IntegerField()
    miles_so_far = models.FloatField(default=0)

    class Meta:
        ordering = ["trip_id", "sequence"]


class DailyLog(models.Model):
    """One 24-hour log sheet."""

    trip = models.ForeignKey(Trip, related_name="daily_logs", on_delete=models.CASCADE)
    day_index = models.IntegerField()  # 1-based
    start_location = models.CharField(max_length=255, blank=True)
    end_location = models.CharField(max_length=255, blank=True)
    miles_driven = models.FloatField(default=0)
    totals = models.JSONField(default=dict)  # {off, sb, driving, on} in hours
    segments = models.JSONField(default=list)  # [{status, start_min, end_min, label}]
    remarks = models.JSONField(default=list)  # [{at_min, text}]

    class Meta:
        ordering = ["trip_id", "day_index"]
