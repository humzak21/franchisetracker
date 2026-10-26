import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type RadarSeries = {
  id: string;
  name: string;
  color: string;
  /** Per axis, 0 to 1 against the best in the comparison. */
  values: Readonly<Record<string, number>>;
};

/**
 * Two to four players over shared stats, each axis scaled to the best of the group. Series wear
 * their team colors; a legend under the chart names them. Smaller and with short labels on phones.
 */
export function RadarCompare({
  axes,
  series,
}: {
  axes: readonly { key: string; label: string }[];
  series: readonly RadarSeries[];
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const data = axes.map((axis) => ({
    axis: axis.label,
    ...Object.fromEntries(series.map((s) => [s.id, s.values[axis.key] ?? 0])),
  }));
  return (
    <div ref={ref} className="w-full">
      <ResponsiveContainer width="100%" height={compact ? 260 : 340}>
        <RadarChart data={data} outerRadius={compact ? "68%" : "74%"}>
          <PolarGrid stroke="var(--border-strong)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--muted-foreground)", fontSize: compact ? 10 : 12 }}
          />
          <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
          {series.map((s) => (
            <Radar
              key={s.id}
              name={s.name}
              dataKey={s.id}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.18}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
