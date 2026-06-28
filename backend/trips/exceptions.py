"""Custom DRF exception handler that surfaces upstream service errors cleanly."""
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .services.errors import GeocodingError, RoutingError


def api_exception_handler(exc, context):
    if isinstance(exc, GeocodingError):
        return Response(
            {"detail": "Could not geocode address", "error": str(exc)}, status=422
        )
    if isinstance(exc, RoutingError):
        return Response(
            {"detail": "Could not compute route", "error": str(exc)}, status=502
        )
    return exception_handler(exc, context)
