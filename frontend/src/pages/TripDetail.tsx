import { useParams, Link } from "react-router-dom";
import { useTrip } from "../api/client";
import MapView from "../components/MapView";
import StopsTimeline from "../components/StopsTimeline";
import LogsCarousel from "../components/LogsCarousel";
import { fmtMiles, fmtHours } from "../utils";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4 text-center group hover:bg-slate-800/40 transition-colors">
      <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 group-hover:from-brand-300 group-hover:to-brand-500">{value}</p>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center gap-5">
        <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-400 text-sm font-medium">Loading trip details…</p>
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="card max-w-sm mx-auto p-8 bg-red-500/5 border-red-500/10">
          <p className="text-red-400 mb-6 font-medium">Trip not found or failed to load.</p>
          <Link to="/" className="btn-primary">
            ← Plan new trip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative z-10">
      {/* Background flare */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Breadcrumb + title */}
      <div>
        <Link to="/" className="text-xs text-brand-400/80 hover:text-brand-300 transition-colors uppercase tracking-wider font-semibold">
          ← Plan new trip
        </Link>
        <h1 className="text-3xl font-bold text-slate-100 mt-2 tracking-tight">
          {trip.pickup_location} <span className="text-slate-500 mx-1">→</span> {trip.dropoff_location}
        </h1>
        <p className="text-sm text-slate-400 mt-1.5 flex items-center gap-2">
          <span>Starting from <strong className="text-slate-300 font-medium">{trip.current_location}</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>{trip.current_cycle_used_hrs} hrs cycle used</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total distance" value={fmtMiles(trip.total_distance_mi)} />
        <StatCard label="Total duration" value={fmtHours(trip.total_duration_hrs)} />
        <StatCard label="Driving time" value={fmtHours(trip.total_driving_hrs)} />
        <StatCard label="Days required" value={String(trip.days_required)} />
      </div>

      {/* Map */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Route Map
        </h2>
        <div className="card overflow-hidden border-slate-700/50 shadow-2xl relative" style={{ height: 460 }}>
          <MapView trip={trip} />
          {/* Subtle gradient overlay at bottom of map */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none z-[1000]"></div>
        </div>
      </div>

      {/* Stops - full width landscape */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Stops & Events
        </h2>
        <div className="card p-5 bg-slate-900/30">
          <StopsTimeline stops={trip.stops} />
        </div>
      </div>

      {/* ELD Logs - full width */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center">
          Daily ELD Log Sheets
          <span className="ml-3 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold border border-brand-500/20">
            {trip.daily_logs.length} {trip.daily_logs.length === 1 ? "day" : "days"}
          </span>
        </h2>
        <div className="card overflow-hidden">
          <LogsCarousel logs={trip.daily_logs} />
        </div>
      </div>

      {/* Route addresses */}
      <div className="glass-panel rounded-2xl px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm mt-8">
        {[
          { label: "Current location", addr: trip.current_location, resolved: trip.current_coords?.display_name },
          { label: "Pickup", addr: trip.pickup_location, resolved: trip.pickup_coords?.display_name },
          { label: "Dropoff", addr: trip.dropoff_location, resolved: trip.dropoff_coords?.display_name },
        ].map(({ label, addr, resolved }) => (
          <div key={label} className="relative pl-4 border-l-2 border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="font-medium text-slate-200">{addr}</p>
            {resolved && resolved !== addr && (
              <p className="text-xs text-slate-400/70 mt-1.5 truncate" title={resolved}>
                {resolved}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
