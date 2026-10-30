import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import { RankBadge } from "./RankBadge";

export type SeasonBarRow = {
  year: number;
  values: Readonly<Record<string, number>>;
  /** League rank for the row under the axis, where one was captured. */
  rank?: number | null;
};
export type SeasonBarSeries = { key: string; label: string };

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
const COLORS = ["var(--team-accent)", "var(--muted-foreground)"] as const;

function Tip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: unknown;
  series: readonly SeasonBarSeries[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">{String(label)}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            {series.find((s) => `values.${s.key}` === entry.dataKey)?.label}
          </span>
          <span className="num font-semibold">{String(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Grouped bars per season with a rank badge under each year where one is known. The phone
 * variant, chosen from its own width, is shorter with no grid. No animation, so reduced motion holds.
 */
export function SeasonBars({
  seasons,
  series,
  valueLabel,
}: {
  seasons: readonly SeasonBarRow[];
  series: readonly SeasonBarSeries[];
  valueLabel: string;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const ranked = seasons.some((s) => typeof s.rank === "number");
  return (
    <div ref={ref} className="w-full space-y-2">
      <ul className="flex flex-wrap gap-2 text-xs">
        {series.map((s, i) => (
          <li
            key={s.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          >
            <span className="size-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        role="img"
        aria-label={`${valueLabel} by season, ${seasons[0]?.year ?? ""} to ${seasons.at(-1)?.year ?? ""}`}
      >
        <ResponsiveContainer width="100%" height={compact ? 170 : 220}>
          <BarChart data={[...seasons]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            {!compact && <CartesianGrid stroke="var(--border)" vertical={false} />}
            <XAxis
              dataKey="year"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              interval={compact && seasons.length > 6 ? 1 : 0}
            />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={compact ? 28 : 36}
              allowDecimals={false}
              tickCount={compact ? 3 : 5}
            />
            <Tooltip content={<Tip series={series} />} cursor={{ fill: "var(--surface-2)" }} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={`values.${s.key}`}
                name={s.label}
                fill={COLORS[i % COLORS.length]}
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {ranked && (
        <ul
          aria-label="League rank by season"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          {seasons.flatMap((s) =>
            typeof s.rank === "number"
              ? [
                  <li key={s.year} className="inline-flex items-center gap-1">
                    <span className="num">{s.year}</span>
                    <RankBadge rank={s.rank} />
                  </li>,
                ]
              : [],
          )}
        </ul>
      )}
    </div>
  );
}
