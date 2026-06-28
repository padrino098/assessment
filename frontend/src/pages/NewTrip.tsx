import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateTrip, api } from "../api/client";
import AsyncSelect from "react-select/async";

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

  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isEstimatingCycle, setIsEstimatingCycle] = useState(false);

  // Auto-estimate cycle hours once all 3 location fields are filled
  useEffect(() => {
    const { current_location, pickup_location, dropoff_location } = form;
    if (!current_location.trim() || !pickup_location.trim() || !dropoff_location.trim()) return;
    estimateCycleHours(current_location, pickup_location);
  }, [form.current_location, form.pickup_location, form.dropoff_location]);

  async function estimateCycleHours(currentLoc: string, pickupLoc: string) {
    setIsEstimatingCycle(true);
    setErrors(e => ({ ...e, current_cycle_used_hrs: "" }));
    try {
      const [currentGeo, pickupGeo] = await Promise.all([
        api.get(`/api/geocode/search/?q=${encodeURIComponent(currentLoc)}`).then(r => r.data),
        api.get(`/api/geocode/search/?q=${encodeURIComponent(pickupLoc)}`).then(r => r.data),
      ]);
      if (!currentGeo[0] || !pickupGeo[0]) return;

      const { lon: cLon, lat: cLat } = currentGeo[0];
      const { lon: pLon, lat: pLat } = pickupGeo[0];

      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${cLon},${cLat};${pLon},${pLat}?overview=false`
      );
      const routeData = await routeRes.json();

      if (routeData.routes?.[0]) {
        // Driving time from current → pickup represents hours already on duty this leg
        const drivingHrs = routeData.routes[0].duration / 3600;
        // Add a realistic base for duty time (pre-trip inspection, fueling, etc.)
        const dutyBuffer = 1.5;
        const estimated = Math.min(70, Math.round((drivingHrs + dutyBuffer) * 10) / 10);
        setForm(f => ({ ...f, current_cycle_used_hrs: String(estimated) }));
      }
    } catch {
      // silently fail — user can set manually
    } finally {
      setIsEstimatingCycle(false);
    }
  }

  const loadOptions = async (inputValue: string) => {
    if (!inputValue || inputValue.length < 3) return [];
    try {
      const { data } = await api.get(`/api/geocode/search/?q=${encodeURIComponent(inputValue)}`);
      return data.map((item: any) => ({
        label: item.display_name,
        value: item.display_name
      }));
    } catch {
      return [];
    }
  };

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

  async function getCurrentLocation(targetField: 'current_location' | 'pickup_location' | 'dropoff_location' = 'current_location') {
    setIsLoadingLocation(true);
    setErrors(e => ({ ...e, [targetField]: "" }));

    if (!navigator.geolocation) {
      setErrors(e => ({ ...e, [targetField]: "Geolocation is not supported by your browser" }));
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Reverse geocode the coords via backend proxy
          const { latitude, longitude } = position.coords;
          const { data } = await api.get(`/api/geocode/reverse/?lat=${latitude}&lon=${longitude}`);
          if (!data || data.error) throw new Error("Failed to resolve address");
          
          let locationStr = data.display_name;
          
          // Try to simplify the returned address string to City, State (if possible)
          if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county;
            const state = data.address.state;
            if (city && state) {
              locationStr = `${city}, ${state}`;
            }
          }

          setForm(f => ({ ...f, [targetField]: locationStr }));
        } catch (err) {
          setErrors(e => ({ ...e, [targetField]: "Could not resolve your location address" }));
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        let msg = "Unable to retrieve your location";
        if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied";
        setErrors(e => ({ ...e, [targetField]: msg }));
        setIsLoadingLocation(false);
      },
      { timeout: 10000 }
    );
  }

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    hint?: string,
  ) => {
    return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <label className="label !mb-0">{label}</label>
        {["current_location", "pickup_location", "dropoff_location"].includes(key) && (
          <button
            type="button"
            onClick={() => getCurrentLocation(key as 'current_location'|'pickup_location'|'dropoff_location')}
            disabled={isLoadingLocation}
            className="text-[10px] uppercase tracking-widest font-bold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
          >
            {isLoadingLocation ? (
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            Use My Location
          </button>
        )}
      </div>

      {["current_location", "pickup_location", "dropoff_location"].includes(key) ? (
        <AsyncSelect
          cacheOptions
          loadOptions={loadOptions}
          placeholder={placeholder}
          onChange={(val) => {
            if (val) {
              setForm((f) => ({ ...f, [key]: val.value }));
            }
          }}
          onInputChange={(val, action) => {
            if (action.action === "input-change") {
              setForm(f => ({ ...f, [key]: val }));
            }
          }}
          value={form[key] ? { label: form[key], value: form[key] } : null}
          styles={{
            control: (base, state) => ({
              ...base,
              backgroundColor: 'rgba(15, 23, 42, 0.5)', 
              borderColor: errors[key] ? '#f87171' : state.isFocused ? '#3b82f6' : 'rgba(51, 65, 85, 0.5)',
              backdropFilter: 'blur(4px)',
              borderRadius: '0.75rem',
              padding: '4px',
              boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
              '&:hover': {
                borderColor: state.isFocused ? '#3b82f6' : 'rgba(51, 65, 85, 0.8)',
              }
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: '#0f172a',
              border: '1px solid rgba(51, 65, 85, 0.8)',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              zIndex: 50
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isFocused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: '#f8fafc',
              cursor: 'pointer',
              padding: '10px 16px',
              '&:active': {
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
              }
            }),
            singleValue: (base) => ({
              ...base,
              color: '#f8fafc',
            }),
            input: (base) => ({
              ...base,
              color: '#f8fafc',
            }),
            placeholder: (base) => ({
              ...base,
              color: '#64748b',
            }),
          }}
        />
      ) : (
        <div className="flex gap-2 items-center">
          <input
            className={`input flex-1 ${errors[key] ? "ring-2 ring-red-400" : ""}`}
            placeholder={placeholder}
            value={form[key]}
            onChange={(ev) => setForm((f) => ({ ...f, [key]: ev.target.value }))}
            autoComplete="off"
            type={key === "current_cycle_used_hrs" ? "number" : "text"}
            min={key === "current_cycle_used_hrs" ? "0" : undefined}
            max={key === "current_cycle_used_hrs" ? "70" : undefined}
            step={key === "current_cycle_used_hrs" ? "any" : undefined}
          />
          {key === "current_cycle_used_hrs" && (
            <button
              type="button"
              onClick={() => form.current_location && form.pickup_location && form.dropoff_location
                ? estimateCycleHours(form.current_location, form.pickup_location)
                : setErrors(e => ({ ...e, current_cycle_used_hrs: "Fill in all 3 locations first" }))}
              disabled={isEstimatingCycle}
              className="btn-secondary whitespace-nowrap self-stretch px-4 flex items-center gap-1.5"
              title="Re-estimate hours based on route"
            >
              {isEstimatingCycle ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Estimate"}
            </button>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 relative z-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-6 relative">
          <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full"></div>
          <svg className="w-8 h-8 text-brand-400 relative z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 mb-3 tracking-tight">ELD Trip Planner</h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
          Enter your trip details and get a FMCSA-compliant route with ELD log sheets automatically
          generated.
        </p>
      </div>

      {/* Quick examples */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-brand-400/80 uppercase tracking-widest mb-3">
          Quick Start Examples
        </p>
        <div className="flex flex-wrap gap-2.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => applyExample(ex)}
              className="btn-secondary text-xs hover:border-brand-500/40 hover:text-brand-300"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6">
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
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
            {errors.global}
          </div>
        )}

        <button
          type="submit"
          disabled={createTrip.isPending}
          className="btn-primary w-full justify-center py-3.5 text-base mt-2"
        >
          {createTrip.isPending ? (
            <>
              <svg className="animate-spin w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24">
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
              <span>Planning route...</span>
            </>
          ) : (
            "Plan Trip →"
          )}
        </button>

        <p className="text-xs text-center text-slate-500/80 pt-2">
          Geocoding via Nominatim · Routing via OSRM · FMCSA 70 hr / 8 day rules
        </p>
      </form>
    </div>
  );
}
