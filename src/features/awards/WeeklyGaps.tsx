import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { WEEKLY_AWARDS, WEEKLY_SHORT, weeklyGaps } from "@shared/awards/groups";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import { CONFERENCE_TONE } from "./conference";
import type { SeasonAward } from "./types";

const SLOTS = WEEKLY_AWARDS.length * 2;

/** The regular-season weeks still missing players of the week, tucked away, with the way to upload them. */
export function WeeklyGaps({ awards }: { awards: SeasonAward[] }) {
  const gaps = weeklyGaps(awards);
  if (gaps.length === 0) return null;
  const empty = gaps.filter((g) => g.missing.length === SLOTS);
  const partial = gaps.filter((g) => g.missing.length < SLOTS);
  return (
    <Disclosure title="Weeks not captured yet" count={gaps.length}>
      <div className="space-y-4">
        {empty.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              Nothing yet
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {empty.map((g) => (
                <li key={g.week} className="num rounded-md bg-surface-2 px-2 py-1 text-sm font-medium">
                  {weekLabel(g.week)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {partial.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              Partly captured
            </h3>
            <ul className="space-y-1 text-sm">
              {partial.map((g) => (
                <li key={g.week} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="num w-10 font-medium">{weekLabel(g.week)}</span>
                  {g.missing.map((m) => (
                    <span key={`${m.conference}-${m.type}`} className="text-muted-foreground">
                      <span className={cn("font-semibold", CONFERENCE_TONE[m.conference].text)}>
                        {m.conference}
                      </span>{" "}
                      {WEEKLY_SHORT[m.type]}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button asChild size="sm">
          <Link to="/inbox/weekly-awards">
            <Upload /> Upload weekly awards
          </Link>
        </Button>
      </div>
    </Disclosure>
  );
}
