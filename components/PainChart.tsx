"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { painLevelInfo } from "@/lib/pain-scale";
import { formatDisplayDate } from "@/lib/date";
import type { PainLevel } from "@/lib/types";

export type PainPoint = { date: string; painLevel: PainLevel | null };

const VIEW_W = 400;
const VIEW_H = 200;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;
const PAD_X = 12;
const PLOT_W = VIEW_W - PAD_X * 2;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
const MAX_LEVEL = 5;

function xAt(index: number, count: number): number {
  if (count <= 1) return PAD_X + PLOT_W / 2;
  return PAD_X + (index / (count - 1)) * PLOT_W;
}

function yAt(level: number): number {
  return PAD_TOP + (1 - level / MAX_LEVEL) * PLOT_H;
}

function shortLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "numeric" });
}

// Every point when there are few; otherwise ~5 evenly spread indices
// (always including the first and last) so labels never collide.
function labelIndices(count: number): number[] {
  if (count <= 8) return Array.from({ length: count }, (_, i) => i);
  const steps = 4;
  const indices = new Set<number>();
  for (let s = 0; s <= steps; s++) {
    indices.add(Math.round((s / steps) * (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
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
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-neutral-800 text-sm text-neutral-500">
        Sin registros en este periodo.
      </div>
    );
  }

  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeInfo = active && active.painLevel !== null ? painLevelInfo(active.painLevel) : null;
  const labelIdx = labelIndices(points.length);
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

        {labelIdx.map((i) => (
          <text
            key={points[i].date}
            x={xAt(i, points.length)}
            y={VIEW_H - 8}
            textAnchor="middle"
            className="fill-neutral-500 text-[10px]"
          >
            {shortLabel(points[i].date)}
          </text>
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
