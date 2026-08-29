"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { painLevelInfo } from "@/lib/pain-scale";
import { buildAxisLabels, toLocalDate, tooltipDateLabel } from "@/lib/chart-axis";
import { EVENT_META, PERIOD_SHADE_CLASS, type EventKey } from "@/lib/event-icons";
import { smoothSegments } from "@/lib/chart-path";
import type { CountPoint, Granularity } from "@/lib/aggregate";
import type { PainLevel } from "@/lib/types";

export type PainPoint = { date: string; painLevel: PainLevel | null };
export type DayEvents = { sex: boolean; activity: boolean; alcohol: boolean };

const VIEW_W = 400;
const VIEW_H = 220;
const PAD_TOP = 20;
const PAD_BOTTOM = 40;
const PAD_X = 12;
const PLOT_W = VIEW_W - PAD_X * 2;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
const MAX_LEVEL = 5;

// Extra rows below the axis labels, one per active event type — only shown
// for daily granularity. Weekly/monthly aggregates show the same series as
// translucent bars overlaid on the plot area instead (see bucketCounts).
const LANE_H = 16;
const LANE_GAP = 6;
const LANE_ICON_SIZE = 12;
const LANE_KEYS: EventKey[] = ["sex", "activity", "alcohol"];

// Overlay bars: one thin bar per active series, side by side (not stacked)
// within each bucket's column, with a small gap between the bars and a
// bigger gap between buckets — and capped well below the plot's full
// height so they read as texture near the baseline, not as a competing
// chart on top of the pain line.
const OVERLAY_BAR_OPACITY = 0.55;
const OVERLAY_MAX_HEIGHT_RATIO = 0.4;
const OVERLAY_GROUP_WIDTH_RATIO = 0.35; // fraction of the column width used by the group of bars
const OVERLAY_BAR_GAP = 2;

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

const ARIA_LABEL: Record<Granularity, string> = {
  day: "Nivel de dolor por día",
  week: "Nivel de dolor por semana",
  month: "Nivel de dolor por mes",
};

type RunPoint = { x: number; y: number; level: PainLevel };

export function PainChart({
  points,
  granularity = "day",
  periodFlags,
  dayEvents,
  bucketCounts,
  visibleSeries = new Set(),
}: {
  points: PainPoint[];
  granularity?: Granularity;
  // Parallel to `points`: true where that day has a registered period —
  // drawn as background shading, not gated by visibleSeries (period isn't a
  // togglable series). Only read for granularity === "day": aggregated into
  // a week/month bucket, a handful of period days reads as a misleadingly
  // solid block, so weekly/monthly views drop the shading entirely.
  periodFlags?: boolean[];
  // Parallel to `points`: only read for granularity === "day".
  dayEvents?: DayEvents[];
  // Parallel to `points`: only read for granularity !== "day" — per-bucket
  // counts drawn as translucent overlay bars instead of lanes.
  bucketCounts?: Partial<Record<EventKey, CountPoint[]>>;
  visibleSeries?: Set<EventKey>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasAnyData = points.some((p) => p.painLevel !== null);

  // Runs of consecutive registered days, so a gap (unregistered day) breaks
  // the line instead of interpolating over it. A run of exactly one point
  // has no line to carry a color, so it gets a plain dot instead.
  const runs = useMemo(() => {
    const groups: RunPoint[][] = [];
    let current: RunPoint[] = [];
    points.forEach((p, i) => {
      if (p.painLevel === null) {
        if (current.length > 0) groups.push(current);
        current = [];
        return;
      }
      current.push({ x: xAt(i, points.length), y: yAt(p.painLevel), level: p.painLevel });
    });
    if (current.length > 0) groups.push(current);
    return groups;
  }, [points]);

  const axisLabels = useMemo(() => buildAxisLabels(points, granularity), [points, granularity]);
  const halfWidth = dayHalfWidth(points.length);
  const activeLaneKeys = granularity === "day" ? LANE_KEYS.filter((k) => visibleSeries.has(k)) : [];
  const activeOverlayKeys =
    granularity !== "day" ? LANE_KEYS.filter((k) => visibleSeries.has(k) && bucketCounts?.[k]) : [];
  const totalHeight = VIEW_H + (activeLaneKeys.length > 0 ? activeLaneKeys.length * LANE_H + LANE_GAP : 0);

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
  const activeLabel = active ? tooltipDateLabel(active.date, granularity) : null;
  const activeInfo = active && active.painLevel !== null ? painLevelInfo(active.painLevel) : null;
  const activePoint =
    activeIndex !== null && points[activeIndex].painLevel !== null
      ? { x: xAt(activeIndex, points.length), y: yAt(points[activeIndex].painLevel), level: points[activeIndex].painLevel }
      : null;
  const tooltipLeftPct =
    activeIndex !== null
      ? Math.min(Math.max((xAt(activeIndex, points.length) / VIEW_W) * 100, 8), 92)
      : 0;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${totalHeight}`}
        className="w-full touch-none"
        role="img"
        aria-label={ARIA_LABEL[granularity]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearActive}
        onPointerCancel={clearActive}
        onPointerLeave={clearActive}
      >
        {granularity === "day" &&
          points.map((p, i) => {
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

        {granularity === "day" &&
          periodFlags &&
          points.map((p, i) => {
            if (!periodFlags[i]) return null;
            return (
              <rect
                key={`period-${p.date}`}
                x={xAt(i, points.length) - halfWidth}
                y={PAD_TOP}
                width={halfWidth * 2}
                height={yAt(0) - PAD_TOP}
                className={PERIOD_SHADE_CLASS}
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

        {(() => {
          const groupWidth = halfWidth * 2 * OVERLAY_GROUP_WIDTH_RATIO;
          const slots = LANE_KEYS.length;
          const barWidth = Math.max(0, (groupWidth - (slots - 1) * OVERLAY_BAR_GAP) / slots);
          return activeOverlayKeys.map((key) => {
            const counts = bucketCounts![key]!;
            const maxCount = Math.max(1, ...counts.map((c) => c.count));
            const meta = EVENT_META[key];
            const slot = LANE_KEYS.indexOf(key);
            return (
              <g key={`overlay-${key}`}>
                {points.map((p, i) => {
                  const count = counts[i]?.count ?? 0;
                  if (count === 0) return null;
                  const h = (count / maxCount) * PLOT_H * OVERLAY_MAX_HEIGHT_RATIO;
                  const x = xAt(i, points.length) - groupWidth / 2 + slot * (barWidth + OVERLAY_BAR_GAP);
                  return (
                    <rect
                      key={`overlay-${key}-${p.date}`}
                      x={x}
                      y={yAt(0) - h}
                      width={barWidth}
                      height={h}
                      rx={0.75}
                      className={meta.textClass}
                      fill="currentColor"
                      opacity={OVERLAY_BAR_OPACITY}
                    />
                  );
                })}
              </g>
            );
          });
        })()}

        {runs.map((run, ri) =>
          run.length === 1 ? (
            <circle
              key={`solo-${ri}`}
              cx={run[0].x}
              cy={run[0].y}
              r={2.5}
              className={painLevelInfo(run[0].level).textClass}
              fill="currentColor"
              stroke="var(--background)"
              strokeWidth={1.25}
            />
          ) : (
            smoothSegments(run).map((seg, si) => {
              const id = `${gradientId}-${ri}-${si}`;
              const fromInfo = painLevelInfo(run[si].level);
              const toInfo = painLevelInfo(run[si + 1].level);
              return (
                <g key={id}>
                  <linearGradient
                    id={id}
                    gradientUnits="userSpaceOnUse"
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                  >
                    <stop offset="0%" stopColor="currentColor" className={fromInfo.textClass} />
                    <stop offset="100%" stopColor="currentColor" className={toInfo.textClass} />
                  </linearGradient>
                  <path
                    d={seg.d}
                    fill="none"
                    stroke={`url(#${id})`}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })
          ),
        )}

        {activePoint && (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r={3.5}
            className={painLevelInfo(activePoint.level).textClass}
            fill="currentColor"
            stroke="var(--background)"
            strokeWidth={1.25}
          />
        )}

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

        {dayEvents &&
          activeLaneKeys.map((key, li) => {
            const meta = EVENT_META[key];
            const laneY = VIEW_H + LANE_GAP + li * LANE_H + LANE_H / 2;
            return (
              <g key={key}>
                {points.map((p, i) => {
                  if (!dayEvents[i]?.[key]) return null;
                  const x = xAt(i, points.length);
                  return (
                    <meta.Icon
                      key={`${key}-${p.date}`}
                      x={x - LANE_ICON_SIZE / 2}
                      y={laneY - LANE_ICON_SIZE / 2}
                      width={LANE_ICON_SIZE}
                      height={LANE_ICON_SIZE}
                      strokeWidth={1.75}
                      className={meta.textClass}
                    />
                  );
                })}
              </g>
            );
          })}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-700 bg-background px-2 py-1 text-xs shadow-sm"
          style={{ left: `${tooltipLeftPct}%` }}
        >
          <p className="text-neutral-500">{activeLabel}</p>
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
