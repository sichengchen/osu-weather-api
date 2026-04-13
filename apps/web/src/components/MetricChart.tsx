import { useEffect, useRef, useState } from "react";

import type { HistoryPoint, NullableNumber } from "@osu-weather/shared";
import { extent, line, scaleLinear } from "d3";

import { formatFrontendTimestampCompact } from "../lib/time";

type MetricChartProps = {
  title: string;
  unit: string;
  points: HistoryPoint[];
  accessor: (point: HistoryPoint) => NullableNumber;
  accent: string;
  precision?: number;
};

const DEFAULT_CHART_WIDTH = 320;
const DEFAULT_CHART_HEIGHT = 48;
const CHART_HORIZONTAL_PADDING = 6;
const CHART_VERTICAL_PADDING = 3;

export function MetricChart({ title, unit, points, accessor, accent, precision = 1 }: MetricChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
  const series = points
    .map((point) => ({
      capturedAt: point.capturedAt,
      value: accessor(point)
    }))
    .filter((point): point is { capturedAt: string; value: number } => typeof point.value === "number");

  useEffect(() => {
    const node = plotRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = () => {
      const nextWidth = node.clientWidth;
      const nextHeight = node.clientHeight;

      setPlotSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  if (series.length < 2) {
    return (
      <div className="chart-shell">
        <div className="chart-header">
          <p>{title}</p>
        </div>
        <div className="chart-empty">No data</div>
      </div>
    );
  }

  const chartWidth = plotSize.width || DEFAULT_CHART_WIDTH;
  const chartHeight = plotSize.height || DEFAULT_CHART_HEIGHT;
  const chartLeft = CHART_HORIZONTAL_PADDING;
  const chartRight = Math.max(chartLeft + 1, chartWidth - CHART_HORIZONTAL_PADDING);
  const chartTop = CHART_VERTICAL_PADDING;
  const chartBottom = Math.max(chartTop + 1, chartHeight - CHART_VERTICAL_PADDING);

  const values = series.map((point) => point.value);
  const [min = 0, max = 0] = extent(values);
  const yDomain: [number, number] = min === max ? [min - 1, max + 1] : [min, max];
  const xScale = scaleLinear().domain([0, series.length - 1]).range([chartLeft, chartRight]);
  const yScale = scaleLinear().domain(yDomain).range([chartBottom, chartTop]);
  const path = line<{ capturedAt: string; value: number }>()
    .x((_point: { capturedAt: string; value: number }, index: number) => xScale(index))
    .y((point: { capturedAt: string; value: number }) => yScale(point.value))(series);

  const activeIndex = hoveredIndex ?? series.length - 1;
  const activePoint = series[activeIndex] ?? series[series.length - 1];
  const activeX = xScale(activeIndex);
  const activeY = yScale(activePoint.value);
  const firstLabel = formatFrontendTimestampCompact(series[0].capturedAt);
  const lastLabel = formatFrontendTimestampCompact(series[series.length - 1].capturedAt);
  const activeValueLabel = `${activePoint.value.toFixed(precision)} ${unit}`;
  const showHover = hoveredIndex !== null;

  return (
    <div className="chart-shell">
      <div className="chart-header">
        <div>
          <p>{title}</p>
          <span>{series[series.length - 1].value.toFixed(precision)} {unit}</span>
        </div>
      </div>
      <div className="chart-plot" ref={plotRef}>
        {showHover ? (
          <div
            className="chart-tooltip"
            style={{
              left: `${activeX}px`,
              top: `${activeY}px`
            }}
          >
            <strong>{activeValueLabel}</strong>
            <span>{formatFrontendTimestampCompact(activePoint.capturedAt)}</span>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="chart-svg"
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={(event) => {
            const svg = event.currentTarget;
            const rect = svg.getBoundingClientRect();
            const relativeX = ((event.clientX - rect.left) / rect.width) * (chartRight - chartLeft);
            const normalized = clamp(relativeX + chartLeft, chartLeft, chartRight);
            const index = Math.round(((normalized - chartLeft) / (chartRight - chartLeft)) * (series.length - 1));
            setHoveredIndex(clamp(index, 0, series.length - 1));
          }}
        >
          <line className="chart-baseline" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
          {path ? <path className="chart-line" d={path} stroke={accent} /> : null}
          {showHover ? <line className="chart-guide" x1={activeX} y1={chartTop} x2={activeX} y2={chartBottom} /> : null}
          {showHover ? <line className="chart-guide" x1={chartLeft} y1={activeY} x2={chartRight} y2={activeY} /> : null}
          <circle
            className="chart-endpoint"
            cx={showHover ? activeX : chartRight}
            cy={showHover ? activeY : yScale(series[series.length - 1].value)}
            r="2"
            fill={accent}
          />
        </svg>
      </div>
      <div className="chart-axis">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
