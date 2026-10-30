import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type CumulativeSeries = {
  key: string;
  label: string;
  points: readonly { game: number; total: number }[];
  /** A pace to race rather than a season played: drawn dashed. */
  reference?: boolean;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
/** In order of the series given: the lead season in the accent, the rest stepping back. */
const COLORS = ["var(--team-accent)", "var(--muted-foreground)", "var(--subtle-foreground)"] as const;

type Row = { game: number } & Record<string, number>;

/** One row per game number, each series' total where it has one. */
function rowsOf(series: readonly CumulativeSeries[]): Row[] {
  const last = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.game)));
  return Array.from({ length: last }, (_, i) => {
    const row: Row = { game: i + 1 } as Row;
    for (const s of series) {
      const point = s.points.find((p) => p.game === i + 1);
      if (point) row[s.key] = point.total;
    }
    return row;
  });
}

function Tip({
  active,
  payload,
  label,
  series,
  format,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: unknown;
  series: readonly CumulativeSeries[];
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="text-xs text-muted-foreground">Game {String(label)}</div>
      {payload.map((entry) => {
        const name = series.find((s) => s.key === entry.dataKey)?.label;
        return (
          <div key={String(entry.dataKey)} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{name}</span>
            <span className="num font-semibold">{format(Number(entry.value))}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Running totals by game as step lines: seasons laid over each other, a record's pace dashed, and
 * marks as rules across the chart. The legend is chips; the phone variant, chosen from its own
 * width, is shorter with no grid. No animation, so reduced motion holds.
 */
export function CumulativeChart({
  series,
  marks = [],
  valueLabel,
  format = String,
}: {
  series: readonly CumulativeSeries[];
  /** Totals worth a rule across the chart. Only those in reach of the lines are drawn. */
  marks?: readonly number[];
  valueLabel: string;
  format?: (value: number) => string;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const rows = rowsOf(series);
  const top = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.total)));
  const color = (i: number) => COLORS[Math.min(i, COLORS.length - 1)];

  return (
    <div ref={ref} className="w-full space-y-2">
      <ul className="flex flex-wrap gap-2 text-xs">
        {series.map((s, i) => (
          <li
            key={s.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          >
            <span
              className="w-3 border-t-2"
              style={{ borderColor: color(i), borderStyle: s.reference ? "dashed" : "solid" }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        role="img"
        aria-label={`${valueLabel} by game: ${series
          .map((s) => `${s.label} ${format(s.points.at(-1)?.total ?? 0)}`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={compact ? 200 : 260}>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {!compact && <CartesianGrid stroke="var(--border)" vertical={false} />}
            <XAxis
              dataKey="game"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              interval={compact && rows.length > 9 ? 1 : 0}
            />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={compact ? 40 : 48}
              allowDecimals={false}
              tickCount={compact ? 3 : 5}
              tickFormatter={format}
            />
            <Tooltip
              content={<Tip series={series} format={format} />}
              cursor={{ stroke: "var(--border-strong)" }}
            />
            {marks
              .filter((mark) => mark <= top * 1.1)
              .map((mark) => (
                <ReferenceLine key={mark} y={mark} stroke="var(--border-strong)" strokeDasharray="2 4" />
              ))}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type={s.reference ? "linear" : "stepAfter"}
                dataKey={s.key}
                name={s.label}
                stroke={color(i)}
                strokeWidth={i === 0 ? 2.5 : 2}
                strokeDasharray={s.reference ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
