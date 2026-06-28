/** Convert elapsed minutes-from-t0 to "Day X HH:MM" label. */
export function fmtElapsed(minutes: number): string {
  const day = Math.floor(minutes / (24 * 60)) + 1;
  const rem = minutes % (24 * 60);
  const h = Math.floor(rem / 60)
    .toString()
    .padStart(2, "0");
  const m = (rem % 60).toString().padStart(2, "0");
  return `Day ${day}  ${h}:${m}`;
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtMiles(mi: number): string {
  return `${Math.round(mi).toLocaleString()} mi`;
}

export function fmtHours(hrs: number): string {
  return `${hrs.toFixed(1)} h`;
}

/** Status color for stop / segment kind. */
export const STATUS_COLORS: Record<string, string> = {
  off: "#64748b",
  sb: "#8b5cf6",
  driving: "#2563eb",
  on: "#f59e0b",
};

export const KIND_COLORS: Record<string, string> = {
  start: "#10b981",
  end: "#10b981",
  pickup: "#f59e0b",
  dropoff: "#ef4444",
  fuel: "#f97316",
  break: "#8b5cf6",
  rest: "#64748b",
  drive: "#2563eb",
};

export const KIND_LABELS: Record<string, string> = {
  start: "Start",
  end: "End",
  pickup: "Pickup",
  dropoff: "Dropoff",
  fuel: "⛽ Fuel",
  break: "Break",
  rest: "Rest",
  drive: "Driving",
};
