from django.contrib import admin

from .models import DailyLog, Stop, Trip


class StopInline(admin.TabularInline):
    model = Stop
    extra = 0


class DailyLogInline(admin.TabularInline):
    model = DailyLog
    extra = 0


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "pickup_location",
        "dropoff_location",
        "total_distance_mi",
        "days_required",
        "created_at",
    )
    inlines = [StopInline, DailyLogInline]
