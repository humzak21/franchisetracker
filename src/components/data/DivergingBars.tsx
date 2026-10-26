import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type DivergingPoint = {
  key: string;
  /** Axis label, e.g. "W3". */
  short: string;
  /** Tooltip label, e.g. "Week 3 vs PIT". */
  label: string;
  value: number;
  /** Tooltip value, e.g. "+7 (31-24)"; defaults to the signed value. */
  display?: string;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: DivergingPoint }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">{point.label}</div>
      <div className="num font-display text-xl font-bold">{point.display ?? signed(point.value)}</div>
    </div>
  );
}

/**
 * Bars above and below zero in win and loss colors: margin of victory, the running streak.
 * The phone variant, chosen from its own width, is shorter and labels every other bar.
 * No animation, so reduced motion holds.
 */
export function DivergingBars({
  points,
  valueLabel,
}: {
  points: readonly DivergingPoint[];
  /** For the accessible summary, e.g. "Margin of victory". */
  valueLabel: string;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const reach = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const best = points.reduce<DivergingPoint | null>((a, p) => (!a || p.value > a.value ? p : a), null);
  const worst = points.reduce<DivergingPoint | null>((a, p) => (!a || p.value < a.value ? p : a), null);

  return (
    <div
      ref={ref}
      className="w-full"
      role="img"
      aria-label={`${valueLabel}, ${points.length} games${best && worst ? `: best ${signed(best.value)} (${best.label}), worst ${signed(worst.value)} (${worst.label})` : ""}`}
    >
      <ResponsiveContainer width="100%" height={compact ? 160 : 220}>
        <BarChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="short"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            interval={compact && points.length > 9 ? 1 : 0}
          />
          <YAxis
            domain={[-reach, reach]}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={compact ? 28 : 36}
            allowDecimals={false}
            tickCount={compact ? 3 : 5}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" name={valueLabel} radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {points.map((p) => (
              <Cell
                key={p.key}
                fill={p.value > 0 ? "var(--win)" : p.value < 0 ? "var(--loss)" : "var(--tie)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
