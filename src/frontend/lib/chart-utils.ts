import type { TrendObservation } from "./api";

export type ChartPoint = {
  year: number;
  value: number;
  x: number;
  y: number;
};

export type TrendChartGeometry = {
  points: ChartPoint[];
  segments: string[];
  minValue: number;
  maxValue: number;
};

export function buildTrendChartGeometry(
  observations: TrendObservation[],
  width = 640,
  height = 260,
  padding = 28,
): TrendChartGeometry {
  const ordered = [...observations].sort((a, b) => a.period_year - b.period_year);
  if (ordered.length === 0) {
    return { points: [], segments: [], minValue: 0, maxValue: 0 };
  }

  const values = ordered.map((item) => item.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const yearRange = ordered[ordered.length - 1].period_year - ordered[0].period_year || 1;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const points = ordered.map((item) => ({
    year: item.period_year,
    value: item.value,
    x: padding + ((item.period_year - ordered[0].period_year) / yearRange) * usableWidth,
    y: height - padding - ((item.value - minValue) / valueRange) * usableHeight,
  }));

  const segments: string[] = [];
  let current: ChartPoint[] = [];
  for (const point of points) {
    if (current.length && point.year - current[current.length - 1].year !== 1) {
      if (current.length > 1) segments.push(current.map((p) => `${p.x},${p.y}`).join(" "));
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current.map((p) => `${p.x},${p.y}`).join(" "));

  return { points, segments, minValue, maxValue };
}
