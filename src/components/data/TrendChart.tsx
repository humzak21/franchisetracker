import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type TrendPoint = {
  key: string;
  /** Tooltip label, e.g. "2026 · Week 6". */
  label: string;
  /** Axis label for the first point of each group, e.g. "2026"; points sharing it get no tick. */
  group: string;
  value: number;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

function Tip({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: readonly { payload?: TrendPoint }[];
  format: (value: number) => string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">{point.label}</div>
      <div className="num font-display text-xl font-bold">{format(point.value)}</div>
    </div>
  );
}

/** A rating's axis: the nearest fives around the values, inside 0 to 100. */
function ratingAxis(values: readonly number[]) {
  const lo = Math.max(0, Math.floor((Math.min(...values) - 3) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 3) / 5) * 5);
  return { domain: [lo, hi], ticks: Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + i * 5) };
}

/**
 * A value over time in the team accent: OVR progression on a rating's axis, or any stat across
 * seasons with `scale="auto"`. The phone variant, chosen from its own width, is shorter with one
 * tick per group and no grid. No animation, so reduced motion holds.
 */
export function TrendChart({
  points,
  valueLabel,
  scale = "rating",
  format = String,
}: {
  points: readonly TrendPoint[];
  valueLabel: string;
  scale?: "rating" | "auto";
  format?: (value: number) => string;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const values = points.map((p) => p.value);
  const axis = scale === "rating" ? ratingAxis(values) : { domain: [0, "auto"] as const, ticks: undefined };
  const firsts = new Set(
    points.filter((p, i) => i === 0 || points[i - 1]!.group !== p.group).map((p) => p.key),
  );

  return (
    <div
      ref={ref}
      className="w-full"
      role="img"
      aria-label={`${valueLabel} from ${format(values[0] ?? 0)} to ${format(values.at(-1) ?? 0)}`}
    >
      <ResponsiveContainer width="100%" height={compact ? 180 : 240}>
        <LineChart data={[...points]} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          {!compact && <CartesianGrid stroke="var(--border)" vertical={false} />}
          <XAxis
            dataKey="key"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--border-strong)" }}
            interval={0}
            tickFormatter={(key: string) =>
              firsts.has(key) ? (points.find((p) => p.key === key)?.group ?? "") : ""
            }
          />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={scale === "rating" ? (compact ? 28 : 36) : compact ? 40 : 48}
            allowDecimals={false}
            tickFormatter={format}
          />
          <Tooltip content={<Tip format={format} />} cursor={{ stroke: "var(--border-strong)" }} />
          <Line
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke="var(--team-accent)"
            strokeWidth={2.5}
            dot={{ r: compact ? 2.5 : 3.5, fill: "var(--team-accent)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
