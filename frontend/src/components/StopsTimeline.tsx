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
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-700/50" />
      <ul className="space-y-4">
        {filtered.map((stop, i) => {
          const dur = stop.depart_min - stop.arrive_min;
          const color = KIND_COLORS[stop.kind] ?? "#64748b";
          return (
            <li key={stop.id} className="flex items-start gap-4 relative pl-12">
              {/* dot */}
              <span
                className="absolute left-3 top-4 w-[14px] h-[14px] rounded-full border-[3px] border-slate-900 shadow-[0_0_8px_currentColor] flex items-center justify-center"
                style={{ background: color, color: color }}
              >
              </span>
              
              {/* Added horizontal connector */}
              <div className="absolute left-[26px] top-5 w-4 h-px bg-slate-700/50" />
              
              <div className="flex-1 glass-panel px-4 py-3 min-w-0 rounded-xl hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 border"
                      style={{ background: color + "1a", color, borderColor: color + "33" }}
                    >
                      <span className="text-xs">{KIND_ICONS[stop.kind]}</span>
                      {KIND_LABELS[stop.kind] ?? stop.kind}
                    </span>
                    <p className="text-sm font-medium text-slate-200 mt-1 leading-snug break-words pr-2" title={stop.label}>{stop.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-mono font-medium text-slate-400/80 bg-slate-900/50 px-2 py-0.5 rounded whitespace-nowrap">{fmtElapsed(stop.arrive_min)}</p>
                    {dur > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest whitespace-nowrap">{fmtDuration(dur)}</p>
                    )}
                  </div>
                </div>
                {i > 0 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/30">
                    <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest">{fmtMiles(stop.miles_so_far)} total</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
