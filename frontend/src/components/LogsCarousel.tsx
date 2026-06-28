import { useState } from "react";
import type { DailyLog } from "../types";
import DailyLogSheet from "./DailyLogSheet";

interface Props {
  logs: DailyLog[];
}

export default function LogsCarousel({ logs }: Props) {
  const [current, setCurrent] = useState(0);

  if (!logs.length) return null;

  function printAll() {
    const area = document.getElementById("print-area");
    if (!area) return;
    window.print();
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 px-1 no-print">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn-secondary !px-2.5 !py-1.5 text-base border-slate-700 hover:border-brand-500/50 hover:text-brand-400 group"
          >
            <svg className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="glass-panel px-4 py-1.5 rounded-xl border border-slate-700/50 text-sm font-semibold text-brand-300 min-w-[120px] text-center">
            Day {logs[current].day_index} <span className="text-slate-500 mx-1">/</span> {logs.length}
          </div>
          <button
            onClick={() => setCurrent((c) => Math.min(logs.length - 1, c + 1))}
            disabled={current === logs.length - 1}
            className="btn-secondary !px-2.5 !py-1.5 text-base border-slate-700 hover:border-brand-500/50 hover:text-brand-400 group"
          >
            <svg className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Dot indicators */}
          <div className="flex gap-2">
            {logs.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i === current 
                    ? "bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] scale-110" 
                    : "bg-slate-700 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>
          <button onClick={printAll} className="btn-secondary text-xs uppercase tracking-wider ml-2">
            <svg className="w-4 h-4 text-slate-400 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print all
          </button>
        </div>
      </div>

      {/* Visible sheet */}
      <div className="card overflow-hidden">
        <DailyLogSheet log={logs[current]} dayTotal={logs.length} />
      </div>

      {/* Hidden print area: all sheets */}
      <div id="print-area" className="hidden print:block">
        {logs.map((log) => (
          <div key={log.id} className="mb-0">
            <DailyLogSheet log={log} dayTotal={logs.length} />
          </div>
        ))}
      </div>
    </div>
  );
}
