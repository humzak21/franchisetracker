import { weekLabel, type WeekKey } from "@shared/domain";
import { WEEKLY_SHORT, weekWinners } from "@shared/awards/groups";
import { AwardRow } from "./AwardRow";
import { ConferenceHeading } from "./ConferenceHeading";
import type { SeasonAward } from "./types";

/** One week's players of the week: the AFC and the NFC side by side, or stacked when narrow. Only winners show. */
export function WeekCard({ awards, week }: { awards: SeasonAward[]; week: WeekKey }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-3 @tablet:p-4">
      <h3 className="mb-3 font-display text-xl leading-none font-bold tracking-wide uppercase">
        {weekLabel(week, "long")}
      </h3>
      <div className="grid gap-4 @tablet:grid-cols-2 @tablet:gap-6">
        {weekWinners(awards, week).map(({ conference, awards: slots }) => {
          const won = slots.flatMap((s) => s.winners.map((w) => ({ type: s.type, w })));
          return (
            <div key={conference} className="min-w-0 space-y-1">
              <ConferenceHeading conference={conference} size="sm" />
              {won.length > 0 ? (
                <ul className="-mx-3 divide-y divide-border">
                  {won.map(({ type, w }) => (
                    <AwardRow key={w._id} award={w} label={WEEKLY_SHORT[type]} />
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-muted-foreground">Not captured yet</p>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
