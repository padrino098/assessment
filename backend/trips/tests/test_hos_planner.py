"""Unit tests for the HOS planning engine.

Pure-Python tests (no DB) covering the FMCSA invariants the brief asks us to honor.
"""
from __future__ import annotations

from trips.services.hos_planner import (
    AVG_SPEED_MPH,
    DAY_MIN,
    FUEL_INTERVAL_MI,
    MAX_DRIVING_PER_SHIFT_MIN,
    MAX_ON_DUTY_WINDOW_MIN,
    PICKUP_DROPOFF_MIN,
    Leg,
    plan_trip,
    split_into_days,
)


def _mk_legs(miles_leg1: float, miles_leg2: float) -> list[Leg]:
    return [
        Leg(
            miles=miles_leg1,
            start_label="A",
            end_label="B",
            start_coords=(40.0, -74.0),
            end_coords=(41.0, -75.0),
        ),
        Leg(
            miles=miles_leg2,
            start_label="B",
            end_label="C",
            start_coords=(41.0, -75.0),
            end_coords=(42.0, -76.0),
        ),
    ]


def _driving_total(events) -> int:
    return sum(e["end_min"] - e["start_min"] for e in events if e["duty"] == "driving")


def test_short_trip_no_rest_needed():
    """100 + 50 miles: well under 11h, only pickup + dropoff added."""
    events = plan_trip(_mk_legs(100, 50), current_cycle_used_hrs=0)
    kinds = [e["kind"] for e in events]
    assert "rest" not in kinds
    assert "break" not in kinds
    assert "fuel" not in kinds
    assert kinds.count("pickup") == 1
    assert kinds.count("dropoff") == 1
    assert kinds[0] == "start"
    assert kinds[-1] == "end"


def test_break_required_after_8_hours_driving():
    """8 hours at 55mph = 440 miles. A leg of 500mi should force one 30-min break."""
    events = plan_trip(_mk_legs(500, 1), current_cycle_used_hrs=0)
    breaks = [e for e in events if e["kind"] == "break"]
    assert len(breaks) >= 1
    assert breaks[0]["end_min"] - breaks[0]["start_min"] == 30


def test_fuel_stop_at_least_every_1000_miles():
    events = plan_trip(_mk_legs(1200, 100), current_cycle_used_hrs=0)
    fuel_stops = [e for e in events if e["kind"] == "fuel"]
    assert len(fuel_stops) >= 1
    miles_since = 0.0
    for ev in events:
        if ev["kind"] == "drive":
            miles_since = ev["miles"] - _miles_at_last_fuel(events, ev)
            assert miles_since <= FUEL_INTERVAL_MI + 5  # small tolerance
        if ev["kind"] == "fuel":
            miles_since = 0.0


def _miles_at_last_fuel(events, target):
    last_fuel_miles = 0.0
    for ev in events:
        if ev is target:
            return last_fuel_miles
        if ev["kind"] == "fuel":
            last_fuel_miles = ev["miles"]
    return last_fuel_miles


def test_no_shift_exceeds_11_driving_hours():
    """Long multi-day trip: between rests, driving must never exceed 11h."""
    events = plan_trip(_mk_legs(1500, 500), current_cycle_used_hrs=0)
    drive_min_this_shift = 0
    for ev in events:
        if ev["kind"] == "rest":
            drive_min_this_shift = 0
        elif ev["duty"] == "driving":
            drive_min_this_shift += ev["end_min"] - ev["start_min"]
            assert drive_min_this_shift <= MAX_DRIVING_PER_SHIFT_MIN


def test_no_shift_exceeds_14_hour_window():
    """Window = sum of all non-rest minutes since last rest."""
    events = plan_trip(_mk_legs(1500, 500), current_cycle_used_hrs=0)
    window_min = 0
    for ev in events:
        dur = ev["end_min"] - ev["start_min"]
        if ev["kind"] == "rest":
            window_min = 0
        elif ev["kind"] in ("start", "end"):
            continue
        else:
            window_min += dur
            assert window_min <= MAX_ON_DUTY_WINDOW_MIN


def test_cycle_used_carries_into_plan():
    """If driver has already used 65 of 70 hours, we should rest very early."""
    events = plan_trip(_mk_legs(800, 100), current_cycle_used_hrs=65)
    rests = [e for e in events if e["kind"] == "rest"]
    assert len(rests) >= 1
    assert rests[0]["start_min"] < 6 * 60


def test_pickup_and_dropoff_are_one_hour_on_duty():
    events = plan_trip(_mk_legs(100, 50), current_cycle_used_hrs=0)
    pickup = next(e for e in events if e["kind"] == "pickup")
    dropoff = next(e for e in events if e["kind"] == "dropoff")
    assert pickup["end_min"] - pickup["start_min"] == PICKUP_DROPOFF_MIN
    assert dropoff["end_min"] - dropoff["start_min"] == PICKUP_DROPOFF_MIN
    assert pickup["duty"] == "on"
    assert dropoff["duty"] == "on"


def test_total_driving_time_matches_distance():
    """Driving minutes * AVG_SPEED == total miles (within rounding)."""
    miles = 600
    events = plan_trip(_mk_legs(miles, 0.0001), current_cycle_used_hrs=0)
    drive_min = _driving_total(events)
    derived_miles = drive_min * (AVG_SPEED_MPH / 60.0)
    assert abs(derived_miles - miles) < 15


def test_daily_logs_sum_to_24_hours():
    events = plan_trip(_mk_legs(1500, 500), current_cycle_used_hrs=0)
    days = split_into_days(events)
    assert len(days) >= 2
    for day in days:
        total_min = sum(s["end_min"] - s["start_min"] for s in day["segments"])
        assert total_min == DAY_MIN, f"day {day['day_index']} totals {total_min} min"
        total_hr = sum(day["totals"].values())
        assert abs(total_hr - 24.0) < 0.05


def test_daily_log_segments_are_contiguous_and_in_range():
    events = plan_trip(_mk_legs(1500, 500), current_cycle_used_hrs=0)
    days = split_into_days(events)
    for day in days:
        prev_end = 0
        for seg in day["segments"]:
            assert 0 <= seg["start_min"] <= DAY_MIN
            assert 0 <= seg["end_min"] <= DAY_MIN
            assert seg["start_min"] == prev_end
            prev_end = seg["end_min"]
        assert prev_end == DAY_MIN


def test_multi_day_trip_has_correct_day_count():
    """At 55mph with 11h driving + 10h rest cycles, ~2000 miles needs ~3-5 days."""
    events = plan_trip(_mk_legs(1500, 500), current_cycle_used_hrs=0)
    days = split_into_days(events)
    assert 3 <= len(days) <= 6


def test_short_trip_produces_single_day():
    events = plan_trip(_mk_legs(50, 50), current_cycle_used_hrs=0)
    days = split_into_days(events)
    assert len(days) == 1
    assert days[0]["totals"]["off"] > 0
