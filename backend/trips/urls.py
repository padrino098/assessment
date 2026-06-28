from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import TripViewSet, geocode_search, geocode_reverse

router = DefaultRouter()
router.register(r"trips", TripViewSet, basename="trip")

urlpatterns = router.urls + [
    path("geocode/search/", geocode_search),
    path("geocode/reverse/", geocode_reverse),
]
