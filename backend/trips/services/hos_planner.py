"""HOS-aware trip planning engine.

Pure Python, no Django imports — fully unit-testable.

Models a property-carrying driver under FMCSA rules:
  * 11-hour driving limit per shift
  * 14-hour on-duty window per shift
  * 30-min break required after 8 cumulative driving hours
  * 10 consecutive hours off-duty between shifts
  * 70 hours on-duty over rolling 8 days (single bucket here; reset by 10h rests only modeled implicitly)
  * Fuel stop every 1000 miles (15 min, on-duty not driving)
  * 1 hour pickup, 1 hour dropoff (on-duty not driving)

Time is tracked in integer minutes from t=0.
Distance is tracked in miles. Average driving speed is configurable.

Output is a list of `Event` dicts that fully tile the timeline (no gaps).
A second pass slices into daily logs (24-hour windows).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Literal, TypedDict

# ---- constants ----------------------------------------------------------------
AVG_SPEED_MPH = 55.0

MAX_DRIVING_PER_SHIFT_MIN = 11 * 60
MAX_ON_DUTY_WINDOW_MIN = 14 * 60
REQUIRED_BREAK_AFTER_DRIVING_MIN = 8 * 60
BREAK_LEN_MIN = 30
REST_LEN_MIN = 10 * 60
RESTART_LEN_MIN = 34 * 60  # 34-hour off-duty restart resets the 70-hr cycle
CYCLE_LIMIT_MIN = 70 * 60

FUEL_INTERVAL_MI = 1000.0
FUEL_STOP_MIN = 15
PICKUP_DROPOFF_MIN = 60

DutyStatus = Literal["off", "sb", "driving", "on"]
EventKind = Literal["start", "pickup", "dropoff", "fuel", "break", "rest", "drive", "end"]


class Event(TypedDict):
    kind: EventKind
    duty: DutyStatus
    start_min: int
    end_min: int
    label: str
    miles: float  # cumulative miles at end of event
    lat: float | None
    lng: float | None


@dataclass
class _State:
    t: int = 0  # elapsed minutes
    miles: float = 0.0
    shift_drive_min: int = 0
    shift_window_min: int = 0
    since_break_drive_min: int = 0
    miles_since_fuel: float = 0.0
    cycle_used_min: int = 0
    events: list[Event] = field(default_factory=list)

    def add(self, ev: Event) -> None:
        self.events.append(ev)

    def take_rest(self, lat: float | None, lng: float | None) -> None:
        """Insert a 10-hour off-duty rest at current position."""
        start = self.t
        self.t += REST_LEN_MIN
        self.add(
            Event(
                kind="rest",
                duty="off",
                start_min=start,
                end_min=self.t,
                label="10-hour rest",
                miles=self.miles,
                lat=lat,
                lng=lng,
            )
        )
        # Reset shift counters; cycle hours are NOT reset (would need a 34-hr restart).
        self.shift_drive_min = 0
        self.shift_window_min = 0
        self.since_break_drive_min = 0

    def take_restart(self, lat: float | None, lng: float | None) -> None:
        """Insert a 34-hour off-duty restart, which resets the 70-hour cycle."""
        start = self.t
        self.t += RESTART_LEN_MIN
        self.add(
            Event(
                kind="rest",
                duty="off",
                start_min=start,
                end_min=self.t,
                label="34-hour restart",
                miles=self.miles,
                lat=lat,
                lng=lng,
            )
        )
        self.shift_drive_min = 0
        self.shift_window_min = 0
        self.since_break_drive_min = 0
        self.cycle_used_min = 0

    def take_break(self, lat: float | None, lng: float | None) -> None:
        start = self.t
        self.t += BREAK_LEN_MIN
        self.shift_window_min += BREAK_LEN_MIN
        self.add(
            Event(
                kind="break",
                duty="off",
                start_min=start,
                end_min=self.t,
                label="30-min break",
                miles=self.miles,
                lat=lat,
                lng=lng,
            )
        )
        self.since_break_drive_min = 0

    def take_fuel(self, lat: float | None, lng: float | None) -> None:
        start = self.t
        self.t += FUEL_STOP_MIN
        self.shift_window_min += FUEL_STOP_MIN
        self.cycle_used_min += FUEL_STOP_MIN
        self.add(
            Event(
                kind="fuel",
                duty="on",
                start_min=start,
                end_min=self.t,
                label="Fuel stop",
                miles=self.miles,
                lat=lat,
                lng=lng,
            )
        )
        self.miles_since_fuel = 0.0

    def do_on_duty(
        self, minutes: int, kind: EventKind, label: str, lat: float | None, lng: float | None
    ) -> None:
        start = self.t
        self.t += minutes
        self.shift_window_min += minutes
        self.cycle_used_min += minutes
        self.add(
            Event(
                kind=kind,
                duty="on",
                start_min=start,
                end_min=self.t,
                label=label,
                miles=self.miles,
                lat=lat,
                lng=lng,
            )
        )


# ---- route interpolation ------------------------------------------------------

class RouteInterp:
    """Maps a cumulative-mile value to (lat, lng) along a polyline.

    The polyline is a sequence of [lng, lat] pairs (GeoJSON order). If the
    geometry is empty we fall back to a straight-line interpolation between
    the leg endpoints.
    """

    def __init__(
        self,
        coordinates: list[list[float]],
        total_miles: float,
        endpoints: list[tuple[float, float]] | None = None,
    ) -> None:
        self.total_miles = max(total_miles, 0.0001)
        self.coords = coordinates or []
        self.endpoints = endpoints or []
        self._cum: list[float] = []  # cumulative fraction [0..1] per coord index
        self._build()

    def _build(self) -> None:
        if len(self.coords) < 2:
            return
        seg_lens: list[float] = [0.0]
        total = 0.0
        for i in range(1, len(self.coords)):
            a = self.coords[i - 1]
            b = self.coords[i]
            d = _haversine_mi(a[1], a[0], b[1], b[0])
            total += d
            seg_lens.append(total)
        if total <= 0:
            return
        self._cum = [s / total for s in seg_lens]

    def at_miles(self, miles: float) -> tuple[float | None, float | None]:
        miles = max(0.0, min(miles, self.total_miles))
        frac = miles / self.total_miles if self.total_miles else 0.0
        if self._cum and len(self.coords) >= 2:
            for i in range(1, len(self._cum)):
                if self._cum[i] >= frac:
                    f0, f1 = self._cum[i - 1], self._cum[i]
                    a, b = self.coords[i - 1], self.coords[i]
                    if f1 == f0:
                        return (a[1], a[0])
                    local = (frac - f0) / (f1 - f0)
                    lng = a[0] + (b[0] - a[0]) * local
                    lat = a[1] + (b[1] - a[1]) * local
                    return (lat, lng)
            last = self.coords[-1]
            return (last[1], last[0])
        if len(self.endpoints) >= 2:
            a, b = self.endpoints[0], self.endpoints[-1]
            lat = a[0] + (b[0] - a[0]) * frac
            lng = a[1] + (b[1] - a[1]) * frac
            return (lat, lng)
        return (None, None)


def _haversine_mi(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    r = 3958.7613  # earth radius in miles
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlmb = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlmb / 2) ** 2
    return 2 * r * asin(sqrt(a))


# ---- public planner -----------------------------------------------------------

@dataclass
class Leg:
    miles: float
    start_label: str
    end_label: str
    start_coords: tuple[float, float]
    end_coords: tuple[float, float]
    coordinates: list[list[float]] = field(default_factory=list)  # GeoJSON [lng,lat]


def plan_trip(
    legs: list[Leg],
    current_cycle_used_hrs: float,
    avg_speed_mph: float = AVG_SPEED_MPH,
) -> list[Event]:
    """Simulate a multi-leg trip and return the full event timeline.

    A pickup event is inserted after leg 0 (before leg 1) and a dropoff event
    after the last leg. This matches the assessment's "current -> pickup ->
    dropoff" shape (2 legs), but any number of legs is supported (intermediate
    legs are connected with no extra event).
    """
    state = _State(cycle_used_min=int(round(float(current_cycle_used_hrs) * 60)))

    # Start event (zero-length marker)
    if legs:
        first = legs[0]
        state.add(
            Event(
                kind="start",
                duty="off",
                start_min=0,
                end_min=0,
                label=f"Start: {first.start_label}",
                miles=0.0,
                lat=first.start_coords[0],
                lng=first.start_coords[1],
            )
        )

    for leg_idx, leg in enumerate(legs):
        interp = RouteInterp(
            leg.coordinates,
            leg.miles,
            endpoints=[leg.start_coords, leg.end_coords],
        )
        _drive_leg(state, leg, interp, avg_speed_mph)

        # After leg 0 (current -> pickup): 1-hour pickup event
        # After last leg (-> dropoff): 1-hour dropoff event
        if leg_idx == 0 and len(legs) > 1:
            _ensure_window_for_event(state, PICKUP_DROPOFF_MIN, leg.end_coords)
            state.do_on_duty(
                PICKUP_DROPOFF_MIN,
                kind="pickup",
                label=f"Pickup at {leg.end_label}",
                lat=leg.end_coords[0],
                lng=leg.end_coords[1],
            )
        elif leg_idx == len(legs) - 1:
            _ensure_window_for_event(state, PICKUP_DROPOFF_MIN, leg.end_coords)
            state.do_on_duty(
                PICKUP_DROPOFF_MIN,
                kind="dropoff",
                label=f"Dropoff at {leg.end_label}",
                lat=leg.end_coords[0],
                lng=leg.end_coords[1],
            )

    # End marker
    if legs:
        last = legs[-1]
        state.add(
            Event(
                kind="end",
                duty="off",
                start_min=state.t,
                end_min=state.t,
                label=f"Trip complete: {last.end_label}",
                miles=state.miles,
                lat=last.end_coords[0],
                lng=last.end_coords[1],
            )
        )

    return state.events


def _ensure_window_for_event(
    state: _State,
    minutes_needed: int,
    coords: tuple[float, float],
) -> None:
    """If completing an on-duty event would blow the 14-hr window or 70-hr
    cycle, take the appropriate rest first."""
    if state.cycle_used_min + minutes_needed > CYCLE_LIMIT_MIN:
        state.take_restart(coords[0], coords[1])
    elif state.shift_window_min + minutes_needed > MAX_ON_DUTY_WINDOW_MIN:
        state.take_rest(coords[0], coords[1])


def _drive_leg(state: _State, leg: Leg, interp: RouteInterp, avg_speed_mph: float) -> None:
    miles_remaining = leg.miles
    leg_miles_done = 0.0

    while miles_remaining > 0.001:
        # 1a. Cycle exhausted -> 34-hour restart (also resets shift counters)
        if state.cycle_used_min >= CYCLE_LIMIT_MIN:
            lat, lng = interp.at_miles(leg_miles_done)
            state.take_restart(lat, lng)
            continue

        # 1b. Shift limits hit -> 10-hour rest
        if (
            state.shift_drive_min >= MAX_DRIVING_PER_SHIFT_MIN
            or state.shift_window_min >= MAX_ON_DUTY_WINDOW_MIN
        ):
            lat, lng = interp.at_miles(leg_miles_done)
            state.take_rest(lat, lng)
            continue

        # 2. Mandatory 30-min break check
        if state.since_break_drive_min >= REQUIRED_BREAK_AFTER_DRIVING_MIN:
            lat, lng = interp.at_miles(leg_miles_done)
            state.take_break(lat, lng)
            continue

        # 3. Fuel stop check
        if state.miles_since_fuel >= FUEL_INTERVAL_MI:
            lat, lng = interp.at_miles(leg_miles_done)
            state.take_fuel(lat, lng)
            continue

        # 4. Drive a slice. Cap by all relevant limits.
        drive_budget_min = min(
            MAX_DRIVING_PER_SHIFT_MIN - state.shift_drive_min,
            MAX_ON_DUTY_WINDOW_MIN - state.shift_window_min,
            REQUIRED_BREAK_AFTER_DRIVING_MIN - state.since_break_drive_min,
            CYCLE_LIMIT_MIN - state.cycle_used_min,
        )
        if drive_budget_min <= 0:
            continue

        # Cap by miles remaining and by fuel interval
        miles_per_min = avg_speed_mph / 60.0
        miles_until_fuel = FUEL_INTERVAL_MI - state.miles_since_fuel
        cap_miles = min(miles_remaining, miles_until_fuel)
        min_by_miles = max(1, int(round(cap_miles / miles_per_min)))
        drive_min = max(1, min(drive_budget_min, min_by_miles))

        miles_driven = drive_min * miles_per_min
        if miles_driven > miles_remaining:
            miles_driven = miles_remaining
            drive_min = max(1, int(round(miles_driven / miles_per_min)))

        start = state.t
        state.t += drive_min
        state.shift_drive_min += drive_min
        state.shift_window_min += drive_min
        state.since_break_drive_min += drive_min
        state.cycle_used_min += drive_min
        state.miles += miles_driven
        state.miles_since_fuel += miles_driven
        leg_miles_done += miles_driven
        miles_remaining -= miles_driven

        lat, lng = interp.at_miles(leg_miles_done)
        state.add(
            Event(
                kind="drive",
                duty="driving",
                start_min=start,
                end_min=state.t,
                label=f"Driving toward {leg.end_label}",
                miles=state.miles,
                lat=lat,
                lng=lng,
            )
        )


# ---- daily-log splitting ------------------------------------------------------

DAY_MIN = 24 * 60


class DailyLogData(TypedDict):
    day_index: int
    start_location: str
    end_location: str
    miles_driven: float
    totals: dict
    segments: list
    remarks: list


_REMARK_KINDS = {"start", "pickup", "dropoff", "fuel", "break", "rest", "end"}


def split_into_days(events: Iterable[Event]) -> list[DailyLogData]:
    """Slice events into 24-hour windows; events that cross midnight are split.

    Each day produces:
      - segments: contiguous duty-status spans (status, start_min[0..1440], end_min, label)
      - totals: hours per duty status (sums to 24)
      - remarks: significant events (pickup/dropoff/fuel/break/rest) with location
      - start_location / end_location: human-readable bookends
      - miles_driven: miles accumulated during driving on that day
    """
    events = list(events)
    if not events:
        return []

    timeline_end = max(e["end_min"] for e in events)
    days: list[DailyLogData] = []
    num_days = max(1, (timeline_end + DAY_MIN - 1) // DAY_MIN)

    for day_index in range(num_days):
        day_start = day_index * DAY_MIN
        day_end = day_start + DAY_MIN

        segments: list[dict] = []
        remarks: list[dict] = []
        miles_driven = 0.0
        start_location = ""
        end_location = ""

        for ev in events:
            # Zero-length markers (start/end)
            if ev["start_min"] == ev["end_min"]:
                if ev["start_min"] < day_start or ev["start_min"] > day_end:
                    continue
                at = ev["start_min"] - day_start
                if ev["kind"] == "start" and not start_location:
                    start_location = ev["label"]
                if ev["kind"] == "end":
                    end_location = ev["label"]
                remarks.append({"at_min": at, "text": ev["label"], "kind": ev["kind"]})
                continue

            if ev["end_min"] <= day_start or ev["start_min"] >= day_end:
                continue

            s = max(ev["start_min"], day_start) - day_start
            e = min(ev["end_min"], day_end) - day_start
            if e <= s:
                continue

            segments.append(
                {
                    "status": ev["duty"],
                    "start_min": s,
                    "end_min": e,
                    "label": ev["label"],
                    "kind": ev["kind"],
                }
            )

            if ev["kind"] == "drive":
                full = ev["end_min"] - ev["start_min"]
                portion = (e - s) / full if full else 1
                prev_miles = _prev_miles(events, ev)
                delta = ev["miles"] - prev_miles
                miles_driven += delta * portion

            if ev["kind"] in _REMARK_KINDS and ev["kind"] not in ("start", "end"):
                # Add a remark at the event's start (or day_start if it crossed midnight into this day)
                remarks.append(
                    {"at_min": s, "text": ev["label"], "kind": ev["kind"]}
                )
                if ev["kind"] == "dropoff":
                    end_location = ev["label"]
                if ev["kind"] == "pickup" and not start_location:
                    start_location = ev["label"]

        # Fill gaps with off-duty so each day sums to 24h
        segments = _fill_off_duty_gaps(segments)
        totals = _recompute_totals(segments)

        days.append(
            DailyLogData(
                day_index=day_index + 1,
                start_location=start_location,
                end_location=end_location,
                miles_driven=round(miles_driven, 1),
                totals={k: round(v / 60.0, 2) for k, v in totals.items()},
                segments=segments,
                remarks=remarks,
            )
        )

    return days


def _prev_miles(events: list[Event], target: Event) -> float:
    prev = 0.0
    for ev in events:
        if ev is target:
            return prev
        prev = ev["miles"]
    return prev


def _fill_off_duty_gaps(segments: list[dict]) -> list[dict]:
    segments = sorted(segments, key=lambda s: s["start_min"])
    filled: list[dict] = []
    cursor = 0
    for seg in segments:
        if seg["start_min"] > cursor:
            filled.append(
                {
                    "status": "off",
                    "start_min": cursor,
                    "end_min": seg["start_min"],
                    "label": "Off duty",
                    "kind": "off",
                }
            )
        filled.append(seg)
        cursor = max(cursor, seg["end_min"])
    if cursor < DAY_MIN:
        filled.append(
            {
                "status": "off",
                "start_min": cursor,
                "end_min": DAY_MIN,
                "label": "Off duty",
                "kind": "off",
            }
        )
    return filled


def _recompute_totals(segments: list[dict]) -> dict:
    totals = {"off": 0, "sb": 0, "driving": 0, "on": 0}
    for s in segments:
        totals[s["status"]] += s["end_min"] - s["start_min"]
    return totals
