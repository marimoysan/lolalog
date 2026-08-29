"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { painLevelInfo } from "@/lib/pain-scale";
import { formatDisplayDate } from "@/lib/date";
import type { PainLevel } from "@/lib/types";

export type PainPoint = { date: string; painLevel: PainLevel | null };

const VIEW_W = 400;
const VIEW_H = 220;
const PAD_TOP = 20;
const PAD_BOTTOM = 40;
const PAD_X = 12;
const PLOT_W = VIEW_W - PAD_X * 2;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
const MAX_LEVEL = 5;

// Spanish calendar-strip convention (miércoles = X, to not collide with martes).
const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];

type AxisLabel = { index: number; primary: string; secondary?: string };

function toLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function isWeekend(date: string): boolean {
  const day = toLocalDate(date).getDay();
  return day === 0 || day === 6;
}

function xAt(index: number, count: number): number {
  if (count <= 1) return PAD_X + PLOT_W / 2;
  return PAD_X + (index / (count - 1)) * PLOT_W;
}

function yAt(level: number): number {
  return PAD_TOP + (1 - level / MAX_LEVEL) * PLOT_H;
}

// Half the width of one day's column, used to size weekend shading so it
// covers a full day regardless of how many points are on screen.
function dayHalfWidth(count: number): number {
  if (count <= 1) return PLOT_W / 2;
  return PLOT_W / (count - 1) / 2;
}

// Few enough points that every day fits without collisions: label each one
// with its weekday letter + day number instead of spreading out sparse ticks.
const DENSE_LABEL_THRESHOLD = 10;
const SPARSE_LABEL_COUNT = 8;

// count <= 10: every day, "weekday letter" over "day number".
// count > 10: ~8 evenly spread days, spelling out the full month name
// whenever the month changes so the range never reads as bare numbers.
function buildAxisLabels(points: PainPoint[]): AxisLabel[] {
  const count = points.length;
  if (count === 0) return [];

  if (count <= DENSE_LABEL_THRESHOLD) {
    return points.map((p, i) => ({
      index: i,
      primary: String(toLocalDate(p.date).getDate()),
      secondary: WEEKDAY_LETTERS[toLocalDate(p.date).getDay()],
    }));
  }

  const steps = SPARSE_LABEL_COUNT - 1;
  const indices = new Set<number>();
  for (let s = 0; s <= steps; s++) {
    indices.add(Math.round((s / steps) * (count - 1)));
  }

  let lastMonth: number | null = null;
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      const date = toLocalDate(points[i].date);
      const month = date.getMonth();
      const isNewMonth = lastMonth === null || month !== lastMonth;
      lastMonth = month;
      return {
        index: i,
        primary: String(date.getDate()),
        secondary: isNewMonth
          ? date.toLocaleDateString("es-ES", { month: "long" })
          : undefined,
      };
    });
}

export function PainChart({ points }: { points: PainPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasAnyData = points.some((p) => p.painLevel !== null);

  // One "M...L...L..." subpath per run of consecutive registered days, so a
  // gap (unregistered day) breaks the line instead of interpolating over it.
  const linePath = useMemo(() => {
    const segments: string[] = [];
    let current: string[] = [];
    points.forEach((p, i) => {
      if (p.painLevel === null) {
        if (current.length > 1) segments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${current.length === 0 ? "M" : "L"} ${xAt(i, points.length)},${yAt(p.painLevel)}`);
    });
    if (current.length > 1) segments.push(current.join(" "));
    return segments.join(" ");
  }, [points]);

  const axisLabels = useMemo(() => buildAxisLabels(points), [points]);
  const halfWidth = dayHalfWidth(points.length);

  function updateActiveFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (svgX - PAD_X) / (PLOT_W || 1);
    const idx = Math.round(ratio * (points.length - 1));
    setActiveIndex(Math.min(Math.max(idx, 0), points.length - 1));
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateActiveFromClientX(e.clientX);
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (activeIndex === null) return;
    updateActiveFromClientX(e.clientX);
  }

  function clearActive() {
    setActiveIndex(null);
  }

  if (!hasAnyData) {
    return (
      <div className="flex h-[210px] items-center justify-center rounded-xl border border-neutral-800 text-sm text-neutral-500">
        Sin registros en este periodo.
      </div>
    );
  }

  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeInfo = active && active.painLevel !== null ? painLevelInfo(active.painLevel) : null;
  const tooltipLeftPct =
    activeIndex !== null
      ? Math.min(Math.max((xAt(activeIndex, points.length) / VIEW_W) * 100, 8), 92)
      : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Nivel de dolor por día"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearActive}
        onPointerCancel={clearActive}
        onPointerLeave={clearActive}
      >
        {points.map((p, i) => {
          if (!isWeekend(p.date)) return null;
          return (
            <rect
              key={`weekend-${p.date}`}
              x={xAt(i, points.length) - halfWidth}
              y={PAD_TOP}
              width={halfWidth * 2}
              height={yAt(0) - PAD_TOP}
              className="fill-neutral-500/10"
            />
          );
        })}

        {axisLabels.map(({ index }) => (
          <line
            key={`grid-${points[index].date}`}
            x1={xAt(index, points.length)}
            y1={PAD_TOP}
            x2={xAt(index, points.length)}
            y2={yAt(0)}
            className="stroke-neutral-800/60"
            strokeWidth={1}
          />
        ))}

        <line
          x1={PAD_X}
          y1={yAt(0)}
          x2={VIEW_W - PAD_X}
          y2={yAt(0)}
          className="stroke-neutral-800"
          strokeWidth={1}
        />

        {activeIndex !== null && (
          <line
            x1={xAt(activeIndex, points.length)}
            y1={PAD_TOP}
            x2={xAt(activeIndex, points.length)}
            y2={yAt(0)}
            className="stroke-neutral-600"
            strokeWidth={1}
          />
        )}

        <path
          d={linePath}
          fill="none"
          className="stroke-neutral-500"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          if (p.painLevel === null) return null;
          const info = painLevelInfo(p.painLevel);
          return (
            <circle
              key={p.date}
              cx={xAt(i, points.length)}
              cy={yAt(p.painLevel)}
              r={activeIndex === i ? 6 : 5}
              className={info.textClass}
              fill="currentColor"
              stroke="var(--background)"
              strokeWidth={2}
            />
          );
        })}

        {axisLabels.map(({ index, primary, secondary }) => (
          <g key={`label-${points[index].date}`}>
            {secondary && (
              <text
                x={xAt(index, points.length)}
                y={VIEW_H - 20}
                textAnchor="middle"
                className="fill-neutral-500 text-[9px] font-medium"
              >
                {secondary}
              </text>
            )}
            <text
              x={xAt(index, points.length)}
              y={VIEW_H - 6}
              textAnchor="middle"
              className="fill-neutral-500 text-[10px]"
            >
              {primary}
            </text>
          </g>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-700 bg-background px-2 py-1 text-xs shadow-sm"
          style={{ left: `${tooltipLeftPct}%` }}
        >
          <p className="text-neutral-500">{formatDisplayDate(active.date)}</p>
          {activeInfo ? (
            <p className={`flex items-center gap-1 font-medium ${activeInfo.textClass}`}>
              <activeInfo.Icon size={14} strokeWidth={1.75} />
              {activeInfo.label}
            </p>
          ) : (
            <p className="font-medium text-neutral-500">Sin registrar</p>
          )}
        </div>
      )}
    </div>
  );
}
