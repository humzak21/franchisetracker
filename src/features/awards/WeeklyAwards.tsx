import { useState } from "react";
import { CONFERENCES, weekLabel, type Conference, type WeekKey } from "@shared/domain";
import { awardWeeks, WEEKLY_SHORT, weekWinners } from "@shared/awards/groups";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import { AwardCard } from "./AwardCard";
import type { SeasonAward } from "./types";

function WeekBlock({
  awards,
  week,
  conference,
}: {
  awards: SeasonAward[];
  week: WeekKey;
  conference: Conference;
}) {
  const block = weekWinners(awards, week).find((b) => b.conference === conference)!;
  return (
    <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
      {block.awards.map(({ type, winners }) =>
        winners.length === 0 ? (
          <div
            key={type}
            className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-subtle-foreground"
          >
            {WEEKLY_SHORT[type]}: not captured
          </div>
        ) : (
          winners.map((w) => (
            <AwardCard key={w._id} award={w} label={`${conference} ${WEEKLY_SHORT[type]}`} />
          ))
        ),
      )}
    </div>
  );
}

/**
 * Players of the week (FEATURES.md 5.8): every week with the AFC and NFC side by side on a wide
 * screen; on a phone, a week picker and a conference switch over one week's four awards.
 */
export function WeeklyAwards({ awards }: { awards: SeasonAward[] }) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const weeks = awardWeeks(awards);
  const [week, setWeek] = useState<WeekKey | undefined>(weeks.at(-1));
  const [conference, setConference] = useState<Conference>("AFC");
  const shown = week && weeks.includes(week) ? week : weeks.at(-1);

  return (
    <div ref={ref} className="@container">
      {compact ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select
              aria-label="Week"
              className="flex-1"
              value={shown ?? ""}
              onValueChange={(w) => setWeek(w as WeekKey)}
              options={weeks.map((w) => ({ value: w, label: weekLabel(w, "long") }))}
            />
            <Segmented
              aria-label="Conference"
              value={conference}
              onChange={setConference}
              options={CONFERENCES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          {shown && <WeekBlock awards={awards} week={shown} conference={conference} />}
        </div>
      ) : (
        <ol className="space-y-4">
          {[...weeks].reverse().map((w) => (
            <li key={w} className="grid grid-cols-[4rem_1fr_1fr] gap-3">
              <span className="num pt-2 font-display text-xl font-bold">{weekLabel(w)}</span>
              {CONFERENCES.map((c) => (
                <WeekBlock key={c} awards={awards} week={w} conference={c} />
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
