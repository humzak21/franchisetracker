import { calendarEntries } from "@shared/games/seasonCalendar";
import { SeasonCalendar } from "@/components/data/SeasonCalendar";
import type { ScheduleGame } from "./ScheduleRow";

/** The season on the calendar (FEATURES.md 5.2): each week on its Sunday, playoffs, then the offseason. */
export function ScheduleCalendar({ year, games }: { year: number; games: ScheduleGame[] }) {
  const entries = calendarEntries(
    year,
    games.map((g) => ({
      _id: g._id,
      weekKey: g.weekKey,
      status: g.status,
      result: g.result,
      us: g.us,
      them: g.them,
      userIsHome: g.userIsHome,
      opponentAbbr: g.opponent?.abbr ?? null,
    })),
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Weeks fall on the Sundays the NFL plays them; game days are filled in their result, playoff rounds are
        outlined, and the offseason ends at the draft.
      </p>
      <SeasonCalendar year={year} entries={entries} />
    </div>
  );
}
