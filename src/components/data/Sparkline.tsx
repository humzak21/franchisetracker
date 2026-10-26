import { useId } from "react";
import { cn } from "@/lib/cn";

type SparklineProps = {
  values: readonly (number | null)[];
  width?: number;
  height?: number;
  /** Fill the area under the line. */
  area?: boolean;
  /** Mark the highest point. */
  markMax?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** Inline trend line for tables and cards. Plain SVG: no axes, no tooltips, scales with its box. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  area = true,
  markMax = true,
  className,
  ...rest
}: SparklineProps) {
  const gradientId = useId();
  const points = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null);
  if (points.length < 2) return <span className="text-xs text-subtle-foreground">—</span>;

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const pad = 3;
  const x = (i: number) => pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const y = (v: number) =>
    max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
  const line = points.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  const peak = points.reduce((a, b) => (b.v > a.v ? b : a));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible text-primary", className)}
      role="img"
      aria-label={rest["aria-label"] ?? `Trend from ${points[0]!.v} to ${last.v}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && (
        <path
          d={`${line} L${x(last.i)},${height} L${x(points[0]!.i)},${height} Z`}
          fill={`url(#${gradientId})`}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {markMax && peak !== last && (
        <circle cx={x(peak.i)} cy={y(peak.v)} r={2} className="fill-current opacity-60" />
      )}
      <circle cx={x(last.i)} cy={y(last.v)} r={2.75} className="fill-current" />
    </svg>
  );
}
