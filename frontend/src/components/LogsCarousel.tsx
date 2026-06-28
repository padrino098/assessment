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
      <div className="flex items-center justify-between mb-4 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn-secondary !px-3 !py-1.5 text-base"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[100px] text-center">
            Day {logs[current].day_index} of {logs.length}
          </span>
          <button
            onClick={() => setCurrent((c) => Math.min(logs.length - 1, c + 1))}
            disabled={current === logs.length - 1}
            className="btn-secondary !px-3 !py-1.5 text-base"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Dot indicators */}
          <div className="flex gap-1">
            {logs.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-brand-600" : "bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button onClick={printAll} className="btn-secondary ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
