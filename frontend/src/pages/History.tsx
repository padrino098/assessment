import { Link } from "react-router-dom";
import { useTrips, useDeleteTrip } from "../api/client";
import { fmtMiles, fmtHours } from "../utils";
import { useState } from "react";

export default function History() {
  const { data, isLoading, isError } = useTrips();
  const deleteTrip = useDeleteTrip();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmId(id);
  }

  function confirmDelete() {
    if (confirmId !== null) {
      deleteTrip.mutate(confirmId);
      setConfirmId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Trip History</h1>
          <p className="text-sm text-slate-400 mt-1">
            {data?.count ?? 0} {data?.count === 1 ? "trip" : "trips"} planned
          </p>
        </div>
        <Link to="/" className="btn-primary">
          + New Trip
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <svg className="animate-spin w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-400 text-sm">Loading…</span>
        </div>
      )}

      {isError && (
        <div className="card px-5 py-4 text-sm text-red-400 bg-red-500/10 border-red-500/20">
          Failed to load trip history.
        </div>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <div className="card px-6 py-12 text-center text-slate-300">
          <p className="text-slate-400 mb-6">No trips yet.</p>
          <Link to="/" className="btn-primary">
            Plan your first trip →
          </Link>
        </div>
      )}

      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Delete Trip?</h2>
            <p className="text-sm text-slate-400 mb-6">This trip will be permanently deleted and cannot be recovered.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm rounded-lg text-slate-300 hover:bg-slate-700/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteTrip.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                {deleteTrip.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-4">
        {data?.results.map((trip) => (
          <li key={trip.id} className="relative group">
            <Link
              to={`/trips/${trip.id}`}
              className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-500/50 hover:bg-slate-800/60 transition-all duration-200 block group"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate group-hover:text-brand-400 transition-colors">
                  {trip.pickup_location} → {trip.dropoff_location}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  From {trip.current_location} · {trip.current_cycle_used_hrs} hrs cycle used
                </p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-200">{fmtMiles(trip.total_distance_mi)}</p>
                  <p className="text-xs text-slate-500">{fmtHours(trip.total_duration_hrs)}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {trip.days_required} {trip.days_required === 1 ? "day" : "days"}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1.5 uppercase tracking-wider">
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-brand-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
            <button
              onClick={(e) => handleDelete(e, trip.id)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
              title="Delete trip"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
