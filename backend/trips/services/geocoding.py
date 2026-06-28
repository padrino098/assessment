"""Nominatim (OpenStreetMap) geocoding adapter.

Uses the public Nominatim endpoint. Per their usage policy we send a unique
User-Agent and cache results aggressively.
"""
from __future__ import annotations

import hashlib
from typing import TypedDict

import requests
from django.conf import settings
from django.core.cache import cache

from .errors import GeocodingError

_TIMEOUT = 10
_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


class GeocodeResult(TypedDict):
    lat: float
    lng: float
    display_name: str


def geocode(address: str) -> GeocodeResult:
    address = (address or "").strip()
    if not address:
        raise GeocodingError("Address is empty")

    cache_key = "geo:" + hashlib.sha1(address.lower().encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        resp = requests.get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params={"q": address, "format": "json", "limit": 1, "addressdetails": 0},
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise GeocodingError(f"Geocoding service unreachable: {exc}") from exc

    data = resp.json()
    if not data:
        raise GeocodingError(f"No match for address: {address}")

    top = data[0]
    result: GeocodeResult = {
        "lat": float(top["lat"]),
        "lng": float(top["lon"]),
        "display_name": top.get("display_name", address),
    }
    cache.set(cache_key, result, _CACHE_TTL)
    return result
