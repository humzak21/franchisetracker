import { useLayoutEffect, useRef } from "react";
import { type BarBox, isBestSeason, previousSeason, seasonBars } from "@shared/stats/seasonSeries";
import { cn } from "@/lib/cn";
import { DeltaBadge } from "./DeltaBadge";
import { RankBadge } from "./RankBadge";

export type SeasonStatPoint = { year: number; value: number; rank: number | null; tied: boolean };

type SeasonStatCardProps = {
  label: string;
  /** Seasons ascending. */
  points: readonly SeasonStatPoint[];
  /** The season in focus: its value leads, and its bar takes the team accent. */
  year: number;
  better: "higher" | "lower";
  format: (value: number) => string;
  /** The focused season is a running total still being played: no verdict on its change or best. */
  partial?: boolean;
};

/**
 * One stat across seasons: the focused season's value with its league rank and change from the
 * season before, over a bar per season with the value above and the year (and rank) below. A
 * focused season without a value keeps an empty slot so the gap shows. Many seasons scroll inside
 * the card, opened at the focused one, so a phone never scrolls the page sideways.
 */
export function SeasonStatCard({ label, points, year, better, format, partial }: SeasonStatCardProps) {
  const current = points.find((p) => p.year === year);
  const before = current ? previousSeason(points, year) : null;
  const best = !partial && isBestSeason(points, year, better);
  const { zero, bars } = seasonBars(points.map((p) => p.value));
  const ranked = points.some((p) => p.rank !== null);
  const slots: { year: number; point: SeasonStatPoint | null; bar: BarBox | null }[] = points.map(
    (point, i) => ({ year: point.year, point, bar: bars[i] ?? null }),
  );
  if (!current) slots.push({ year, point: null, bar: null });
  slots.sort((a, b) => a.year - b.year);

  const strip = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = strip.current;
    const focused = el?.querySelector<HTMLElement>("[data-current]");
    if (el && focused) el.scrollLeft = focused.offsetLeft + focused.offsetWidth - el.clientWidth;
  }, [year, points.length]);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] leading-5 font-medium text-muted-foreground">{label}</h3>
        {current?.rank != null && <RankBadge rank={current.rank} tied={current.tied} />}
      </header>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span
            className={cn(
              "num font-display text-[34px] leading-none font-bold",
              !current && "text-subtle-foreground",
            )}
          >
            {current ? format(current.value) : "—"}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle-foreground">
            {current && before && (
              <span className="inline-flex items-baseline gap-1">
                <DeltaBadge
                  delta={current.value - before.value}
                  better={better}
                  format={format}
                  muted={partial}
                />
                vs {before.year}
                {partial && " so far"}
              </span>
            )}
            {current && !before && <span>First recorded season</span>}
            {!current && <span>No {year} figure yet</span>}
            {best && (
              <span className="rounded-full bg-elite-1 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Best of {points.length}
              </span>
            )}
          </div>
        </div>
        <ol
          ref={strip}
          aria-label={`${label} by season`}
          className="flex max-w-full scrollbar-none gap-1 overflow-x-auto"
        >
          {slots.map(({ year: slotYear, point, bar }) => (
            <SeasonSlot
              key={slotYear}
              year={slotYear}
              value={point ? format(point.value) : "—"}
              rank={ranked ? (point?.rank ?? null) : undefined}
              tied={point?.tied ?? false}
              bar={bar}
              zero={zero}
              focused={slotYear === year}
            />
          ))}
        </ol>
      </div>
    </article>
  );
}

/** One season's column: value, bar from the zero line (or an empty slot), year, and rank row. */
function SeasonSlot({
  year,
  value,
  rank,
  tied,
  bar,
  zero,
  focused,
}: {
  year: number;
  value: string;
  /** Undefined when no season of the stat is ranked, so the rank row is left out. */
  rank: number | null | undefined;
  tied: boolean;
  bar: BarBox | null;
  zero: number;
  focused: boolean;
}) {
  const text = focused ? "font-semibold text-foreground" : "text-muted-foreground";
  return (
    <li data-current={focused || undefined} className="flex w-11 shrink-0 flex-col items-center gap-1">
      <span className={cn("num text-[11px]", text)}>{value}</span>
      <div aria-hidden className="relative h-12 w-7">
        {bar ? (
          <div
            className={cn(
              "absolute inset-x-0 rounded-[3px]",
              focused ? "bg-primary" : "bg-subtle-foreground/30",
            )}
            style={{ bottom: `${bar.bottom}%`, height: `max(${bar.height}%, 2px)` }}
          />
        ) : (
          <div className="absolute inset-0 rounded-[3px] border border-dashed border-border-strong" />
        )}
        <div className="absolute -inset-x-2 h-px bg-border" style={{ bottom: `${zero}%` }} />
      </div>
      <span className={cn("num text-[10px]", focused ? text : "text-subtle-foreground")}>{year}</span>
      {rank !== undefined &&
        (rank !== null ? (
          <RankBadge rank={rank} tied={tied} className="min-w-0" />
        ) : (
          <span className="h-5" />
        ))}
    </li>
  );
}
