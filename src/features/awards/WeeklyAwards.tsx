import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { weekLabel, type WeekKey } from "@shared/domain";
import { awardWeeks } from "@shared/awards/groups";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import type { SeasonAward } from "./types";
import { WeekCard } from "./WeekCard";
import { WeeklyGaps } from "./WeeklyGaps";

/**
 * Players of the week (FEATURES.md 5.8): every captured week, newest first, with the AFC and NFC
 * apart; on a phone, a week picker over one week. Weeks and awards not captured stay out of the
 * way under "Weeks not captured yet".
 */
export function WeeklyAwards({ awards }: { awards: SeasonAward[] }) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const weeks = awardWeeks(awards);
  const [week, setWeek] = useState<WeekKey | undefined>(weeks.at(-1));
  const shown = week && weeks.includes(week) ? week : weeks.at(-1);

  return (
    <div ref={ref} className="@container space-y-4">
      {compact ? (
        <>
          <div className="flex gap-2">
            <Select
              aria-label="Week"
              className="flex-1"
              value={shown ?? ""}
              onValueChange={(w) => setWeek(w as WeekKey)}
              options={weeks.map((w) => ({ value: w, label: weekLabel(w, "long") }))}
            />
            <Button asChild size="icon" variant="outline">
              <Link to="/inbox/weekly-awards" aria-label="Upload weekly awards">
                <Upload />
              </Link>
            </Button>
          </div>
          {shown && <WeekCard awards={awards} week={shown} />}
        </>
      ) : (
        <ol className="space-y-4">
          {[...weeks].reverse().map((w) => (
            <li key={w}>
              <WeekCard awards={awards} week={w} />
            </li>
          ))}
        </ol>
      )}
      <WeeklyGaps awards={awards} />
    </div>
  );
}
