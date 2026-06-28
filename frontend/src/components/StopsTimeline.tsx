import type { Stop } from "../types";
import { KIND_COLORS, KIND_LABELS, fmtElapsed, fmtDuration, fmtMiles } from "../utils";

interface Props {
  stops: Stop[];
}

const KIND_ICONS: Record<string, string> = {
  start: "🟢",
  end: "🏁",
  pickup: "📦",
  dropoff: "✅",
  fuel: "⛽",
  break: "☕",
  rest: "🛏",
};

export default function StopsTimeline({ stops }: Props) {
  const filtered = stops.filter((s) =>
    ["start", "pickup", "dropoff", "fuel", "break", "rest", "end"].includes(s.kind),
  );

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
      <ul className="space-y-0">
        {filtered.map((stop, i) => {
          const dur = stop.depart_min - stop.arrive_min;
          const color = KIND_COLORS[stop.kind] ?? "#64748b";
          return (
            <li key={stop.id} className="flex items-start gap-4 relative pl-12 pb-5">
              {/* dot */}
              <span
                className="absolute left-3 top-1.5 w-5 h-5 rounded-full border-2 border-white shadow flex items-center justify-center text-[10px]"
                style={{ background: color }}
              >
                {KIND_ICONS[stop.kind]}
              </span>
              <div className="flex-1 card px-4 py-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1"
                      style={{ background: color + "22", color }}
                    >
                      {KIND_LABELS[stop.kind] ?? stop.kind}
                    </span>
                    <p className="text-sm font-medium text-slate-800 leading-snug">{stop.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-slate-500">{fmtElapsed(stop.arrive_min)}</p>
                    {dur > 0 && (
                      <p className="text-xs text-slate-400">{fmtDuration(dur)}</p>
                    )}
                  </div>
                </div>
                {i > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{fmtMiles(stop.miles_so_far)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
