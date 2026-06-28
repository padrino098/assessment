import type { DailyLog, LogSegment } from "../types";

// ── Layout constants (all in SVG user units) ──────────────────────────────────
const W = 1000;          // total width
const H = 440;           // total height

const MARGIN_L = 90;     // left label area
const MARGIN_R = 80;     // right totals area
const MARGIN_T = 90;     // header area
const MARGIN_B = 50;     // bottom remarks area

const GRID_W = W - MARGIN_L - MARGIN_R;
const GRID_H = H - MARGIN_T - MARGIN_B;

const ROW_H = GRID_H / 4;
const ROWS = ["off", "sb", "driving", "on"] as const;
type Row = (typeof ROWS)[number];

const ROW_LABELS: Record<Row, string> = {
  off: "Off Duty",
  sb: "Sleeper Berth",
  driving: "Driving",
  on: "On Duty\nNot Driving",
};

const ROW_COLORS: Record<Row, string> = {
  off: "#64748b",
  sb: "#8b5cf6",
  driving: "#2563eb",
  on: "#f59e0b",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function xOf(minute: number) {
  return MARGIN_L + (minute / (24 * 60)) * GRID_W;
}

function yTopOf(row: Row) {
  return MARGIN_T + ROWS.indexOf(row) * ROW_H;
}

function buildPath(segments: LogSegment[]) {
  const byRow: Record<Row, LogSegment[]> = {
    off: [],
    sb: [],
    driving: [],
    on: [],
  };
  for (const s of segments) {
    if (s.status in byRow) byRow[s.status as Row].push(s);
  }

  // Build one continuous path: horizontal line per segment + vertical connectors
  // Sort all by start
  const sorted = [...segments].sort((a, b) => a.start_min - b.start_min);
  if (sorted.length === 0) return "";

  let path = "";
  let prevRow: Row | null = null;
  let prevEnd: number | null = null;

  for (const seg of sorted) {
    const row = seg.status as Row;
    const yMid = yTopOf(row) + ROW_H / 2;
    const x0 = xOf(seg.start_min);
    const x1 = xOf(seg.end_min);

    if (prevRow === null) {
      // First segment
      path += `M ${x0} ${yMid}`;
    } else {
      const prevYMid = yTopOf(prevRow) + ROW_H / 2;
      const xConnect = xOf(seg.start_min);
      // vertical connector at the transition point
      path += ` L ${xConnect} ${prevYMid} L ${xConnect} ${yMid}`;
    }
    path += ` L ${x1} ${yMid}`;
    prevRow = row;
    prevEnd = seg.end_min;
  }

  return path;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  log: DailyLog;
  dayTotal: number; // total days in trip (for header)
}

export default function DailyLogSheet({ log, dayTotal }: Props) {
  const linePath = buildPath(log.segments);

  const remarksByHour: Record<number, string[]> = {};
  for (const r of log.remarks) {
    const h = Math.floor(r.at_min / 60);
    (remarksByHour[h] = remarksByHour[h] ?? []).push(r.text.replace(/^[^:]+: /, "").slice(0, 22));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
    >
      {/* ── Background ── */}
      <rect width={W} height={H} fill="#fff" rx="12" />

      {/* ── Header strip ── */}
      <rect x={0} y={0} width={W} height={MARGIN_T - 4} fill="#1e3a8a" rx="12" />
      <rect x={0} y={MARGIN_T - 16} width={W} height={16} fill="#1e3a8a" />

      <text x={18} y={26} fill="#fff" fontSize={13} fontWeight="700">
        DRIVER'S DAILY LOG — 24-HOUR PERIOD
      </text>

      <text x={18} y={46} fill="#93c5fd" fontSize={11}>
        Day {log.day_index} of {dayTotal}
      </text>

      {/* Header fields */}
      {[
        ["FROM", log.start_location?.slice(0, 45) || "—", 180],
        ["TO", log.end_location?.slice(0, 45) || "—", 430],
        ["MILES DRIVEN", `${log.miles_driven.toLocaleString()} mi`, 680],
      ].map(([label, value, x]) => (
        <g key={String(x)}>
          <text x={Number(x)} y={30} fill="#93c5fd" fontSize={9} fontWeight="600">
            {label}
          </text>
          <text x={Number(x)} y={48} fill="#fff" fontSize={11} fontWeight="500">
            {String(value)}
          </text>
        </g>
      ))}

      {/* ── Hour labels (0–24) ── */}
      {Array.from({ length: 25 }, (_, h) => {
        const x = xOf(h * 60);
        return (
          <g key={h}>
            <text
              x={x}
              y={MARGIN_T - 8}
              textAnchor="middle"
              fontSize={9}
              fill="#475569"
              fontWeight={h % 6 === 0 ? "700" : "400"}
            >
              {h === 0 ? "MID" : h === 12 ? "NOON" : h === 24 ? "MID" : String(h)}
            </text>
          </g>
        );
      })}

      {/* ── Grid ── */}
      {ROWS.map((row, ri) => {
        const y = MARGIN_T + ri * ROW_H;
        return (
          <g key={row}>
            {/* Row background (alternating) */}
            <rect
              x={MARGIN_L}
              y={y}
              width={GRID_W}
              height={ROW_H}
              fill={ri % 2 === 0 ? "#f8fafc" : "#f1f5f9"}
            />
            {/* Row label */}
            <text
              x={MARGIN_L - 6}
              y={y + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize={9}
              fill="#334155"
              fontWeight="600"
            >
              {ROW_LABELS[row].split("\n").map((line, i) => (
                <tspan key={i} x={MARGIN_L - 6} dy={i === 0 ? 0 : 11}>
                  {line}
                </tspan>
              ))}
            </text>

            {/* Hour dividers (major every 1h, minor every 15min) */}
            {Array.from({ length: 24 * 4 + 1 }, (_, i) => {
              const min = i * 15;
              const x = xOf(min);
              const isMajor = i % 4 === 0;
              return (
                <line
                  key={i}
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + ROW_H}
                  stroke={isMajor ? "#cbd5e1" : "#e2e8f0"}
                  strokeWidth={isMajor ? 0.8 : 0.4}
                />
              );
            })}

            {/* Segment fill bars */}
            {log.segments
              .filter((s) => s.status === row)
              .map((s, i) => (
                <rect
                  key={i}
                  x={xOf(s.start_min)}
                  y={y + ROW_H * 0.25}
                  width={Math.max(1, xOf(s.end_min) - xOf(s.start_min))}
                  height={ROW_H * 0.5}
                  fill={ROW_COLORS[row]}
                  opacity={0.18}
                  rx={2}
                />
              ))}

            {/* Row border */}
            <rect
              x={MARGIN_L}
              y={y}
              width={GRID_W}
              height={ROW_H}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={0.8}
            />

            {/* Right: hour total */}
            <rect
              x={MARGIN_L + GRID_W + 1}
              y={y + 4}
              width={MARGIN_R - 8}
              height={ROW_H - 8}
              fill={ROW_COLORS[row] + "22"}
              rx={4}
            />
            <text
              x={MARGIN_L + GRID_W + MARGIN_R / 2 - 4}
              y={y + ROW_H / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="700"
              fill={ROW_COLORS[row]}
            >
              {log.totals[row].toFixed(2)}
            </text>
            <text
              x={MARGIN_L + GRID_W + MARGIN_R / 2 - 4}
              y={y + ROW_H / 2 + 14}
              textAnchor="middle"
              fontSize={8}
              fill="#94a3b8"
            >
              hrs
            </text>
          </g>
        );
      })}

      {/* ── Continuous duty-status line ── */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* ── Remarks strip ── */}
      <rect
        x={MARGIN_L}
        y={MARGIN_T + GRID_H + 4}
        width={GRID_W}
        height={MARGIN_B - 10}
        fill="#f8fafc"
        stroke="#e2e8f0"
        strokeWidth={0.8}
        rx={4}
      />
      {Object.entries(remarksByHour).map(([h, texts]) => {
        const x = xOf(parseInt(h) * 60 + 30);
        return (
          <text
            key={h}
            x={x}
            y={MARGIN_T + GRID_H + 22}
            textAnchor="middle"
            fontSize={8}
            fill="#475569"
          >
            {texts[0]}
          </text>
        );
      })}

      {/* ── Bottom border ── */}
      <rect
        x={MARGIN_L}
        y={MARGIN_T}
        width={GRID_W}
        height={GRID_H}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1}
      />

      {/* "TOTALS" header above right column */}
      <text
        x={MARGIN_L + GRID_W + MARGIN_R / 2 - 4}
        y={MARGIN_T - 8}
        textAnchor="middle"
        fontSize={9}
        fontWeight="700"
        fill="#475569"
        letterSpacing="0.05em"
      >
        TOTALS
      </text>
    </svg>
  );
}
