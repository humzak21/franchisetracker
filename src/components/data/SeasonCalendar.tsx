import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { dayKey, seasonMonths, type CalendarMonth } from "@shared/games/dates";
import type { CalendarEntry, CalendarTone } from "@shared/games/seasonCalendar";
import { cn } from "@/lib/cn";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const toneClass: Record<CalendarTone, string> = {
  win: "bg-win text-white",
  loss: "bg-loss text-white",
  tie: "bg-tie text-white",
  upcoming: "bg-primary/15 text-primary ring-1 ring-primary/40",
  bye: "bg-surface-3 text-muted-foreground",
  marker: "bg-warn/15 text-warn ring-1 ring-warn/40",
};

function EntryLink({
  entry,
  className,
  children,
}: {
  entry: CalendarEntry;
  className: string;
  children: ReactNode;
}) {
  return entry.gameId ? (
    <Link
      to="/games/$gameId"
      params={{ gameId: entry.gameId }}
      className={className}
      aria-label={`${entry.tag}: ${entry.detail}`}
    >
      {children}
    </Link>
  ) : (
    <div className={className} title={entry.detail}>
      {children}
    </div>
  );
}

/** A month as a seven-column grid; game days are filled in their result color. */
function MonthGrid({
  month,
  entries,
}: {
  month: CalendarMonth;
  entries: ReadonlyMap<string, CalendarEntry>;
}) {
  const label = MONTH.format(new Date(Date.UTC(month.year, month.month, 1)));
  return (
    <section aria-label={label} className="rounded-xl border border-border bg-surface p-3">
      <h3 className="mb-2 font-display text-lg font-bold tracking-wide uppercase">{label}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-subtle-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {month.weeks.flat().map((date, i) => {
          if (!date) return <span key={i} />;
          const entry = entries.get(dayKey(date));
          if (!entry) {
            return (
              <span
                key={i}
                className="num grid aspect-square place-items-center rounded-md text-xs font-normal text-muted-foreground"
              >
                {date.getUTCDate()}
              </span>
            );
          }
          return (
            <EntryLink
              key={i}
              entry={entry}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-md leading-none transition-opacity hover:opacity-85",
                toneClass[entry.tone],
                entry.playoff && "outline-2 outline-offset-1 outline-elite-2",
              )}
            >
              <span className="num text-xs font-bold">{date.getUTCDate()}</span>
              <span className="mt-0.5 max-w-full truncate px-0.5 text-[9px] font-bold uppercase">
                {entry.tag}
              </span>
            </EntryLink>
          );
        })}
      </div>
    </section>
  );
}

/** A month as a list of its game days and dates: the phone's vertical calendar. */
function MonthList({
  month,
  entries,
}: {
  month: CalendarMonth;
  entries: ReadonlyMap<string, CalendarEntry>;
}) {
  const label = MONTH.format(new Date(Date.UTC(month.year, month.month, 1)));
  const days = month.weeks.flat().flatMap((date) => {
    const entry = date ? entries.get(dayKey(date)) : undefined;
    return entry ? [entry] : [];
  });
  return (
    <section aria-label={label}>
      <h3 className="mb-1.5 font-display text-lg font-bold tracking-wide uppercase">{label}</h3>
      {days.length === 0 ? (
        <p className="text-sm text-subtle-foreground">Nothing scheduled.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {days.map((entry) => (
            <li key={dayKey(entry.date)}>
              <EntryLink
                entry={entry}
                className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "grid h-8 min-w-11 place-items-center rounded-md px-1.5 text-[11px] font-bold uppercase",
                    toneClass[entry.tone],
                  )}
                >
                  {entry.tag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.detail}</span>
                  <span className="block text-xs text-muted-foreground">{DAY.format(entry.date)}</span>
                </span>
              </EntryLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The season on the calendar, from the preseason to the draft: month grids side by side when
 * there is room, a vertical list of game days per month at phone width (chosen from its own width).
 */
export function SeasonCalendar({
  year,
  entries,
}: {
  year: number;
  entries: ReadonlyMap<string, CalendarEntry>;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const months = seasonMonths(year);
  return (
    <div
      ref={ref}
      className={compact ? "space-y-5" : "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"}
    >
      {months.map((month) =>
        compact ? (
          <MonthList key={`${month.year}-${month.month}`} month={month} entries={entries} />
        ) : (
          <MonthGrid key={`${month.year}-${month.month}`} month={month} entries={entries} />
        ),
      )}
    </div>
  );
}
