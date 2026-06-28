"""API integration test with mocked geocoding + routing."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from trips.models import Trip


pytestmark = pytest.mark.django_db


def _fake_geocode(addr: str):
    table = {
        "chicago, il": {"lat": 41.8781, "lng": -87.6298, "display_name": "Chicago, IL"},
        "dallas, tx": {"lat": 32.7767, "lng": -96.7970, "display_name": "Dallas, TX"},
        "los angeles, ca": {
            "lat": 34.0522,
            "lng": -118.2437,
            "display_name": "Los Angeles, CA",
        },
    }
    return table[addr.lower()]


def _fake_route(waypoints):
    (a_lat, a_lng), (b_lat, b_lng) = waypoints[0], waypoints[-1]
    dlat = a_lat - b_lat
    dlng = a_lng - b_lng
    miles = (dlat * dlat + dlng * dlng) ** 0.5 * 69.0
    return {
        "distance_m": miles * 1609.344,
        "duration_s": miles / 55 * 3600,
        "distance_mi": miles,
        "duration_hr": miles / 55,
        "geometry": {
            "type": "LineString",
            "coordinates": [[a_lng, a_lat], [b_lng, b_lat]],
        },
        "coordinates": [[a_lng, a_lat], [b_lng, b_lat]],
        "legs": [{"distance_m": miles * 1609.344, "duration_s": miles / 55 * 3600}],
    }


def test_create_trip_end_to_end():
    client = APIClient()
    with (
        patch("trips.views.geocode", side_effect=_fake_geocode),
        patch("trips.views.osrm_route", side_effect=_fake_route),
    ):
        resp = client.post(
            "/api/trips/",
            {
                "current_location": "Chicago, IL",
                "pickup_location": "Dallas, TX",
                "dropoff_location": "Los Angeles, CA",
                "current_cycle_used_hrs": 20,
            },
            format="json",
        )

    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["current_location"] == "Chicago, IL"
    assert body["days_required"] >= 2
    assert body["total_distance_mi"] > 1500
    assert len(body["daily_logs"]) == body["days_required"]
    assert any(s["kind"] == "pickup" for s in body["stops"])
    assert any(s["kind"] == "dropoff" for s in body["stops"])
    assert Trip.objects.count() == 1


def test_list_trips():
    client = APIClient()
    with (
        patch("trips.views.geocode", side_effect=_fake_geocode),
        patch("trips.views.osrm_route", side_effect=_fake_route),
    ):
        client.post(
            "/api/trips/",
            {
                "current_location": "Chicago, IL",
                "pickup_location": "Dallas, TX",
                "dropoff_location": "Los Angeles, CA",
                "current_cycle_used_hrs": 0,
            },
            format="json",
        )

    resp = client.get("/api/trips/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["results"][0]["pickup_location"] == "Dallas, TX"
