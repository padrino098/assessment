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
    <div className="w-full overflow-x-auto pb-2">
      {/* Connector line */}
      <div className="relative">
        <div className="absolute top-[28px] left-4 right-4 h-px bg-slate-700/60 z-0" />
        <div className="flex gap-3 min-w-max px-1 py-1 relative z-10">
          {filtered.map((stop, i) => {
            const dur = stop.depart_min - stop.arrive_min;
            const color = KIND_COLORS[stop.kind] ?? "#64748b";
            return (
              <div key={stop.id} className="flex flex-col items-center gap-2 w-[160px] shrink-0">
                {/* Dot on the connector */}
                <span
                  className="w-[14px] h-[14px] rounded-full border-[3px] border-slate-900 shadow-[0_0_8px_currentColor] shrink-0"
                  style={{ background: color, color }}
                />
                {/* Card */}
                <div
                  className="w-full glass-panel rounded-xl px-3 py-3 hover:bg-slate-800/50 transition-colors cursor-default border"
                  style={{ borderColor: color + "22" }}
                >
                  {/* Badge */}
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-2"
                    style={{ background: color + "1a", color, borderColor: color + "33" }}
                  >
                    <span>{KIND_ICONS[stop.kind]}</span>
                    {KIND_LABELS[stop.kind] ?? stop.kind}
                  </span>

                  {/* Time */}
                  <p className="text-[11px] font-mono text-brand-400 font-semibold">
                    {fmtElapsed(stop.arrive_min)}
                  </p>

                  {/* Duration */}
                  {dur > 0 && (
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                      {fmtDuration(dur)}
                    </p>
                  )}

                  {/* Label */}
                  <p className="text-[11px] text-slate-300 font-medium mt-1.5 leading-snug line-clamp-2" title={stop.label}>
                    {stop.label}
                  </p>

                  {/* Miles */}
                  {i > 0 && (
                    <p className="text-[10px] text-slate-600 mt-2 pt-2 border-t border-slate-700/30 uppercase tracking-widest">
                      {fmtMiles(stop.miles_so_far)} total
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
