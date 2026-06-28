"""Trip API views: orchestrates geocode -> route -> HOS plan -> persist."""
from __future__ import annotations

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import DailyLog, Stop, Trip
from .serializers import (
    TripCreateSerializer,
    TripDetailSerializer,
    TripListSerializer,
)
from .services.geocoding import geocode, nominatim_search, nominatim_reverse
from .services.hos_planner import Leg, plan_trip, split_into_days
from .services.routing import route as osrm_route


@api_view(["GET"])
def geocode_search(request):
    """Rate-limited, cached proxy for Nominatim search."""
    q = request.GET.get("q", "").strip()
    if not q:
        return Response([], status=200)
    return Response(nominatim_search(q, limit=5))


@api_view(["GET"])
def geocode_reverse(request):
    """Rate-limited, cached proxy for Nominatim reverse geocoding."""
    lat = request.GET.get("lat", "")
    lon = request.GET.get("lon", "")
    if not lat or not lon:
        return Response({"error": "lat and lon required"}, status=400)
    try:
        return Response(nominatim_reverse(lat, lon))
    except Exception as exc:
        return Response({"error": str(exc)}, status=502)


class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all().prefetch_related("stops", "daily_logs")
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return TripListSerializer
        if self.action == "create":
            return TripCreateSerializer
        return TripDetailSerializer

    def create(self, request, *args, **kwargs):
        in_ser = TripCreateSerializer(data=request.data)
        in_ser.is_valid(raise_exception=True)
        data = in_ser.validated_data

        # 1. Geocode all three addresses sequentially (Nominatim 1 req/sec limit)
        cur_g = geocode(data["current_location"])
        pu_g = geocode(data["pickup_location"])
        do_g = geocode(data["dropoff_location"])

        # 2. Route in two legs so we get per-leg miles
        leg1 = osrm_route([(cur_g["lat"], cur_g["lng"]), (pu_g["lat"], pu_g["lng"])])
        leg2 = osrm_route([(pu_g["lat"], pu_g["lng"]), (do_g["lat"], do_g["lng"])])

        full_coords = leg1["coordinates"] + leg2["coordinates"][1:]
        full_geometry = {"type": "LineString", "coordinates": full_coords}

        # 3. Plan HOS-aware timeline
        legs = [
            Leg(
                miles=leg1["distance_mi"],
                start_label=cur_g["display_name"],
                end_label=pu_g["display_name"],
                start_coords=(cur_g["lat"], cur_g["lng"]),
                end_coords=(pu_g["lat"], pu_g["lng"]),
                coordinates=leg1["coordinates"],
            ),
            Leg(
                miles=leg2["distance_mi"],
                start_label=pu_g["display_name"],
                end_label=do_g["display_name"],
                start_coords=(pu_g["lat"], pu_g["lng"]),
                end_coords=(do_g["lat"], do_g["lng"]),
                coordinates=leg2["coordinates"],
            ),
        ]
        events = plan_trip(legs, float(data["current_cycle_used_hrs"]))
        daily_logs = split_into_days(events)

        total_miles = leg1["distance_mi"] + leg2["distance_mi"]
        total_driving_min = sum(
            e["end_min"] - e["start_min"] for e in events if e["duty"] == "driving"
        )
        total_on_duty_min = sum(
            e["end_min"] - e["start_min"] for e in events if e["duty"] in ("driving", "on")
        )
        timeline_end_min = max((e["end_min"] for e in events), default=0)

        # 4. Persist
        with transaction.atomic():
            trip = Trip.objects.create(
                current_location=data["current_location"],
                pickup_location=data["pickup_location"],
                dropoff_location=data["dropoff_location"],
                current_cycle_used_hrs=data["current_cycle_used_hrs"],
                current_coords=cur_g,
                pickup_coords=pu_g,
                dropoff_coords=do_g,
                total_distance_mi=round(total_miles, 1),
                total_duration_hrs=round(timeline_end_min / 60.0, 2),
                total_driving_hrs=round(total_driving_min / 60.0, 2),
                total_on_duty_hrs=round(total_on_duty_min / 60.0, 2),
                days_required=len(daily_logs),
                route_geometry=full_geometry,
            )
            Stop.objects.bulk_create(
                [
                    Stop(
                        trip=trip,
                        sequence=i,
                        kind=ev["kind"],
                        duty_status=ev["duty"],
                        label=ev["label"],
                        lat=ev["lat"],
                        lng=ev["lng"],
                        arrive_min=ev["start_min"],
                        depart_min=ev["end_min"],
                        miles_so_far=ev["miles"],
                    )
                    for i, ev in enumerate(events)
                    if ev["kind"] in ("start", "pickup", "dropoff", "fuel", "break", "rest", "end")
                ]
            )
            DailyLog.objects.bulk_create(
                [
                    DailyLog(
                        trip=trip,
                        day_index=d["day_index"],
                        start_location=d["start_location"],
                        end_location=d["end_location"],
                        miles_driven=d["miles_driven"],
                        totals=d["totals"],
                        segments=d["segments"],
                        remarks=d["remarks"],
                    )
                    for d in daily_logs
                ]
            )

        out = TripDetailSerializer(trip)
        return Response(out.data, status=status.HTTP_201_CREATED)
