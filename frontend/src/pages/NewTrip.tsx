import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateTrip } from "../api/client";

const EXAMPLES = [
  {
    label: "Chicago → Dallas → Los Angeles",
    current: "Chicago, IL",
    pickup: "Dallas, TX",
    dropoff: "Los Angeles, CA",
    cycle: 20,
  },
  {
    label: "New York → Atlanta → Miami",
    current: "New York, NY",
    pickup: "Atlanta, GA",
    dropoff: "Miami, FL",
    cycle: 0,
  },
  {
    label: "Seattle → Denver → Houston",
    current: "Seattle, WA",
    pickup: "Denver, CO",
    dropoff: "Houston, TX",
    cycle: 45,
  },
];

export default function NewTrip() {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();

  const [form, setForm] = useState({
    current_location: "",
    pickup_location: "",
    dropoff_location: "",
    current_cycle_used_hrs: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.current_location.trim()) e.current_location = "Required";
    if (!form.pickup_location.trim()) e.pickup_location = "Required";
    if (!form.dropoff_location.trim()) e.dropoff_location = "Required";
    const hrs = parseFloat(form.current_cycle_used_hrs);
    if (isNaN(hrs) || hrs < 0 || hrs > 70)
      e.current_cycle_used_hrs = "Must be a number between 0 and 70";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      const trip = await createTrip.mutateAsync({
        current_location: form.current_location.trim(),
        pickup_location: form.pickup_location.trim(),
        dropoff_location: form.dropoff_location.trim(),
        current_cycle_used_hrs: parseFloat(form.current_cycle_used_hrs),
      });
      navigate(`/trips/${trip.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.error ??
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.detail ??
        "Something went wrong. Please check the addresses and try again.";
      setErrors({ global: msg });
    }
  }

  function applyExample(ex: (typeof EXAMPLES)[0]) {
    setForm({
      current_location: ex.current,
      pickup_location: ex.pickup,
      dropoff_location: ex.dropoff,
      current_cycle_used_hrs: String(ex.cycle),
    });
    setErrors({});
  }

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    hint?: string,
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        className={`input ${errors[key] ? "ring-2 ring-red-400" : ""}`}
        placeholder={placeholder}
        value={form[key]}
        onChange={(ev) => setForm((f) => ({ ...f, [key]: ev.target.value }))}
        autoComplete="off"
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 mb-4">
          <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">ELD Trip Planner</h1>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Enter your trip details and get a FMCSA-compliant route with ELD log sheets automatically
          generated.
        </p>
      </div>

      {/* Quick examples */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Quick examples
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => applyExample(ex)}
              className="btn-secondary text-xs"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card px-6 py-6 space-y-5">
        {field("current_location", "Current Location", "e.g. Chicago, IL")}
        {field("pickup_location", "Pickup Location", "e.g. Dallas, TX")}
        {field("dropoff_location", "Dropoff Location", "e.g. Los Angeles, CA")}
        {field(
          "current_cycle_used_hrs",
          "Current Cycle Used (Hours)",
          "e.g. 20",
          "Hours already used in the current 70-hr / 8-day cycle (0–70)",
        )}

        {errors.global && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.global}
          </div>
        )}

        <button
          type="submit"
          disabled={createTrip.isPending}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {createTrip.isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Planning route…
            </>
          ) : (
            "Plan Trip →"
          )}
        </button>

        <p className="text-xs text-center text-slate-400">
          Geocoding via Nominatim · Routing via OSRM · FMCSA 70 hr / 8 day rules
        </p>
      </form>
    </div>
  );
}
