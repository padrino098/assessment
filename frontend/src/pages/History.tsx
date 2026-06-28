import { Link } from "react-router-dom";
import { useTrips } from "../api/client";
import { fmtMiles, fmtHours } from "../utils";

export default function History() {
  const { data, isLoading, isError } = useTrips();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trip History</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.count ?? 0} {data?.count === 1 ? "trip" : "trips"} planned
          </p>
        </div>
        <Link to="/" className="btn-primary">
          + New Trip
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <svg className="animate-spin w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-500 text-sm">Loading…</span>
        </div>
      )}

      {isError && (
        <div className="card px-5 py-4 text-sm text-red-600">
          Failed to load trip history.
        </div>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <div className="card px-6 py-12 text-center">
          <p className="text-slate-500 mb-4">No trips yet.</p>
          <Link to="/" className="btn-primary">
            Plan your first trip →
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {data?.results.map((trip) => (
          <li key={trip.id}>
            <Link
              to={`/trips/${trip.id}`}
              className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-brand-200 hover:shadow-md transition-all duration-150 block"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {trip.pickup_location} → {trip.dropoff_location}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  From {trip.current_location} · {trip.current_cycle_used_hrs} hrs cycle used
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{fmtMiles(trip.total_distance_mi)}</p>
                  <p className="text-xs text-slate-400">{fmtHours(trip.total_duration_hrs)}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                    {trip.days_required} {trip.days_required === 1 ? "day" : "days"}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
