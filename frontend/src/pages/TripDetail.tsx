import { useParams, Link } from "react-router-dom";
import { useTrip } from "../api/client";
import MapView from "../components/MapView";
import StopsTimeline from "../components/StopsTimeline";
import LogsCarousel from "../components/LogsCarousel";
import { fmtMiles, fmtHours } from "../utils";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
        <svg className="animate-spin w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-500 text-sm">Loading trip…</p>
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-600 mb-4">Trip not found or failed to load.</p>
        <Link to="/" className="btn-primary">
          ← Plan new trip
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumb + title */}
      <div>
        <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 transition">
          ← Plan new trip
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          {trip.pickup_location} → {trip.dropoff_location}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Starting from {trip.current_location} · {trip.current_cycle_used_hrs} hrs cycle used
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total distance" value={fmtMiles(trip.total_distance_mi)} />
        <StatCard label="Total duration" value={fmtHours(trip.total_duration_hrs)} />
        <StatCard label="Driving time" value={fmtHours(trip.total_driving_hrs)} />
        <StatCard label="Days required" value={String(trip.days_required)} />
      </div>

      {/* Map */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Route Map</h2>
        <div className="card overflow-hidden" style={{ height: 460 }}>
          <MapView trip={trip} />
        </div>
      </div>

      {/* Two-column: stops + logs */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Stops */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Stops & Events</h2>
          <StopsTimeline stops={trip.stops} />
        </div>

        {/* ELD Logs */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Daily ELD Log Sheets
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({trip.daily_logs.length} {trip.daily_logs.length === 1 ? "day" : "days"})
            </span>
          </h2>
          <LogsCarousel logs={trip.daily_logs} />
        </div>
      </div>

      {/* Route addresses */}
      <div className="card px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {[
          { label: "Current location", addr: trip.current_location, resolved: trip.current_coords?.display_name },
          { label: "Pickup", addr: trip.pickup_location, resolved: trip.pickup_coords?.display_name },
          { label: "Dropoff", addr: trip.dropoff_location, resolved: trip.dropoff_coords?.display_name },
        ].map(({ label, addr, resolved }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="font-medium text-slate-800">{addr}</p>
            {resolved && resolved !== addr && (
              <p className="text-xs text-slate-400 mt-0.5 truncate" title={resolved}>
                Resolved: {resolved}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
