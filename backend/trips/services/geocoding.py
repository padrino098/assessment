"""Nominatim (OpenStreetMap) geocoding adapter.

Uses the public Nominatim endpoint. Per their usage policy we send a unique
User-Agent, cache results aggressively, and enforce a 1 req/sec rate limit.
"""
from __future__ import annotations

import hashlib
import threading
import time
from typing import TypedDict

import requests
from django.conf import settings
from django.core.cache import cache

from .errors import GeocodingError

_TIMEOUT = 10
_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days

# Nominatim usage policy: max 1 request per second
_rate_lock = threading.Lock()
_last_request_time: float = 0.0
_MIN_INTERVAL = 1.1  # seconds between requests


class GeocodeResult(TypedDict):
    lat: float
    lng: float
    display_name: str


def nominatim_search(query: str, limit: int = 5) -> list:
    """Rate-limited, cached Nominatim search for autocomplete (proxy endpoint)."""
    query = (query or "").strip()
    if not query:
        return []

    cache_key = "geo_search:" + hashlib.sha1(f"{query}:{limit}".lower().encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    params: dict = {"q": query, "format": "json", "limit": limit}
    if getattr(settings, "NOMINATIM_EMAIL", ""):
        params["email"] = settings.NOMINATIM_EMAIL

    try:
        resp = _rate_limited_get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params=params,
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()
        cache.set(cache_key, data, _CACHE_TTL)
        return data
    except Exception:
        return []


def nominatim_reverse(lat: str, lon: str) -> dict:
    """Rate-limited Nominatim reverse geocoding for the proxy endpoint."""
    cache_key = "geo_rev:" + hashlib.sha1(f"{lat},{lon}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = _rate_limited_get(
            f"{settings.NOMINATIM_BASE_URL}/reverse",
            params={"lat": lat, "lon": lon, "format": "json", "zoom": 10},
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()
        cache.set(cache_key, data, _CACHE_TTL)
        return data
    except Exception as exc:
        raise GeocodingError(str(exc)) from exc


def _rate_limited_get(url: str, params: dict, headers: dict) -> requests.Response:
    """Make a GET request respecting Nominatim's 1 req/sec limit, with 429 retry."""
    global _last_request_time
    max_retries = 3
    for attempt in range(max_retries):
        with _rate_lock:
            elapsed = time.monotonic() - _last_request_time
            if elapsed < _MIN_INTERVAL:
                time.sleep(_MIN_INTERVAL - elapsed)
            resp = requests.get(url, params=params, headers=headers, timeout=_TIMEOUT)
            _last_request_time = time.monotonic()

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 2 * (attempt + 1)))
            time.sleep(retry_after)
            continue
        return resp

    raise GeocodingError("Nominatim rate limit exceeded after retries. Please try again shortly.")


def geocode(address: str) -> GeocodeResult:
    address = (address or "").strip()
    if not address:
        raise GeocodingError("Address is empty")

    cache_key = "geo:" + hashlib.sha1(address.lower().encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        return cached

    params: dict = {"q": address, "format": "json", "limit": 1, "addressdetails": 0}
    if getattr(settings, "NOMINATIM_EMAIL", ""):
        params["email"] = settings.NOMINATIM_EMAIL

    try:
        resp = _rate_limited_get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params=params,
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
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
