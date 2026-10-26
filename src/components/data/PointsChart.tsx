import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type PointsWeek = {
  key: string;
  /** Axis label, e.g. "W3". */
  short: string;
  /** Tooltip label, e.g. "Week 3 vs PIT". */
  label: string;
  pointsFor: number;
  pointsAgainst: number;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
const SERIES = [
  { key: "pointsFor", name: "Scored", color: "var(--team-accent)" },
  { key: "pointsAgainst", name: "Allowed", color: "var(--muted-foreground)" },
] as const;

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: PointsWeek }[] }) {
  const week = payload?.[0]?.payload;
  if (!active || !week) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">{week.label}</div>
      <div className="num font-display text-xl font-bold">
        {week.pointsFor}-{week.pointsAgainst}
      </div>
    </div>
  );
}

/**
 * Points scored and allowed by week (the season pulse). The legend is a pair of chips; the phone
 * variant, chosen from its own width, is shorter with no grid and every other week labelled.
 */
export function PointsChart({ weeks }: { weeks: readonly PointsWeek[] }) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const avg = (key: "pointsFor" | "pointsAgainst") =>
    weeks.length ? (weeks.reduce((s, w) => s + w[key], 0) / weeks.length).toFixed(1) : "0";

  return (
    <div ref={ref} className="w-full space-y-2">
      <ul className="flex flex-wrap gap-2 text-xs">
        {SERIES.map((s) => (
          <li
            key={s.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="num text-muted-foreground">{avg(s.key)} per game</span>
          </li>
        ))}
      </ul>
      <div
        role="img"
        aria-label={`Points by week: ${avg("pointsFor")} scored and ${avg("pointsAgainst")} allowed per game over ${weeks.length} games`}
      >
        <ResponsiveContainer width="100%" height={compact ? 160 : 220}>
          <LineChart data={[...weeks]} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {!compact && <CartesianGrid stroke="var(--border)" vertical={false} />}
            <XAxis
              dataKey="short"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              interval={compact && weeks.length > 9 ? 1 : 0}
            />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={compact ? 26 : 32}
              allowDecimals={false}
              tickCount={compact ? 3 : 5}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: "var(--border-strong)" }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.key === "pointsFor" ? 2.5 : 2}
                strokeDasharray={s.key === "pointsAgainst" ? "4 3" : undefined}
                dot={{ r: compact ? 2.5 : 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
