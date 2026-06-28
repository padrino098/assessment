"""OSRM routing adapter (public demo server)."""
from __future__ import annotations

from typing import TypedDict

import requests
from django.conf import settings

from .errors import RoutingError

_TIMEOUT = 20
METERS_PER_MILE = 1609.344


class RouteLeg(TypedDict):
    distance_m: float
    duration_s: float


class RouteResult(TypedDict):
    distance_m: float
    duration_s: float
    distance_mi: float
    duration_hr: float
    geometry: dict  # GeoJSON LineString
    coordinates: list  # [[lng, lat], ...]
    legs: list


def route(waypoints: list[tuple[float, float]]) -> RouteResult:
    """waypoints: list of (lat, lng) tuples, in order."""
    if len(waypoints) < 2:
        raise RoutingError("Need at least two waypoints")

    coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords_str}"

    last_err: Exception | None = None
    data = None
    for attempt in range(2):
        try:
            resp = requests.get(
                url,
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "false",
                    "annotations": "false",
                },
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            break
        except requests.RequestException as exc:
            last_err = exc
    if data is None:
        raise RoutingError(f"Routing service unreachable: {last_err}")

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(data.get("message", "No route found"))

    primary = data["routes"][0]
    distance_m = float(primary["distance"])
    duration_s = float(primary["duration"])
    geometry = primary["geometry"]
    legs = [
        {"distance_m": float(leg["distance"]), "duration_s": float(leg["duration"])}
        for leg in primary.get("legs", [])
    ]

    return {
        "distance_m": distance_m,
        "duration_s": duration_s,
        "distance_mi": distance_m / METERS_PER_MILE,
        "duration_hr": duration_s / 3600.0,
        "geometry": geometry,
        "coordinates": geometry.get("coordinates", []),
        "legs": legs,
    }
