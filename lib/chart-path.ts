export type ChartPoint = { x: number; y: number };
export type SmoothSegment = { d: string; x1: number; y1: number; x2: number; y2: number };

// Catmull-Rom -> cubic Bézier control points for the segment points[i] ->
// points[i+1], using the full array for context (neighbors shape the
// tangent at each end).
function controlPoints(points: ChartPoint[], i: number) {
  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? p2;
  return {
    cp1x: p1.x + (p2.x - p0.x) / 6,
    cp1y: p1.y + (p2.y - p0.y) / 6,
    cp2x: p2.x - (p3.x - p1.x) / 6,
    cp2y: p2.y - (p3.y - p1.y) / 6,
  };
}

// A multi-day line as one soft curve instead of a sharp angle at every
// point. Matters once several series (pain, mood, cansancio...) get
// layered on the same chart — straight segments compound into visual noise
// much faster than curves do.
export function smoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const { cp1x, cp1y, cp2x, cp2y } = controlPoints(points, i);
    const p2 = points[i + 1];
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Same curve as smoothLinePath, but as one Bézier piece per consecutive
// pair instead of a single joined path — lets each segment carry its own
// styling (e.g. a color gradient between two differently-colored points)
// while still reading as one continuous line.
export function smoothSegments(points: ChartPoint[]): SmoothSegment[] {
  const segments: SmoothSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const { cp1x, cp1y, cp2x, cp2y } = controlPoints(points, i);
    const p1 = points[i];
    const p2 = points[i + 1];
    segments.push({
      d: `M ${p1.x},${p1.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
    });
  }
  return segments;
}
