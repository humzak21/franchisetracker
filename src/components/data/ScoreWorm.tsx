import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type WormPoint = {
  /** Seconds into the game. */
  seconds: number;
  /** The side's lead: above zero ahead, below behind. */
  margin: number;
  /** A score: when it came and what it was. Kickoff and the final whistle have none. */
  play: { when: string; what: string; score: string } | null;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Tip({ active, payload }: { active?: boolean; payload?: readonly { payload?: WormPoint }[] }) {
  const play = payload?.[0]?.payload?.play;
  if (!active || !play) return null;
  return (
    <div className="max-w-64 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">{play.when}</div>
      <div className="num font-display text-xl font-bold">{play.score}</div>
      <div className="text-xs text-muted-foreground">{play.what}</div>
    </div>
  );
}

function ScoreDot({ cx, cy, payload }: DotItemDotProps) {
  const point = payload as WormPoint | undefined;
  if (!point?.play || cx === undefined || cy === undefined) return <g />;
  return <circle cx={cx} cy={cy} r={3.5} fill="var(--team-accent)" stroke="var(--surface)" strokeWidth={1} />;
}

/**
 * The margin over game time, a step at each score, periods marked along the bottom. The phone
 * variant, chosen from its own width, is shorter; tapping a score shows it. No animation, so
 * reduced motion holds.
 */
export function ScoreWorm({
  points,
  periods,
  periodLabel,
  label,
}: {
  points: readonly WormPoint[];
  /** Where each period starts and ends, in seconds, in order. */
  periods: readonly { start: number; end: number }[];
  periodLabel: (index: number) => string;
  /** For the accessible summary, e.g. "Patriots' lead over the game". */
  label: string;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const reach = Math.max(7, ...points.map((p) => Math.abs(p.margin)));
  const end = periods.at(-1)?.end ?? 0;
  const final = points.at(-1)?.margin ?? 0;
  const scores = points.filter((p) => p.play).length;

  return (
    <div
      ref={ref}
      className="w-full"
      role="img"
      aria-label={`${label}: ${scores} scores, finishing ${signed(final)}`}
    >
      <ResponsiveContainer width="100%" height={compact ? 150 : 220}>
        <LineChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="seconds"
            type="number"
            domain={[0, end]}
            ticks={periods.map((p) => (p.start + p.end) / 2)}
            tickFormatter={(_, i) => periodLabel(i)}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[-reach, reach]}
            tickFormatter={signed}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={32}
            tickCount={5}
            allowDecimals={false}
          />
          {periods.slice(1).map((p) => (
            <ReferenceLine key={p.start} x={p.start} stroke="var(--border)" />
          ))}
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--border-strong)" }} isAnimationActive={false} />
          <Line
            type="stepAfter"
            dataKey="margin"
            stroke="var(--team-accent)"
            strokeWidth={2}
            dot={ScoreDot}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
