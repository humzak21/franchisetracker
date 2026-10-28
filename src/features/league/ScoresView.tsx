import type { FunctionReturnType } from "convex/server";
import { CalendarRange, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel, type WeekKey } from "@shared/domain";
import { useCapture } from "@/app/capture/CaptureProvider";
import { EmptyState } from "@/components/data/EmptyState";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";
import { ImportScheduleButton } from "./ImportScheduleButton";

type ScoreGame = FunctionReturnType<typeof api.leagueGames.scores.byWeek>[number];

function Side({
  team,
  score,
  won,
  decided,
}: {
  team: ScoreGame["home"];
  score: number | null;
  won: boolean;
  decided: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2.5">
      <TeamLogo team={team} size="sm" />
      <span className={cn("min-w-0 flex-1 truncate font-medium", decided && !won && "text-muted-foreground")}>
        {team.city} {team.name}
      </span>
      <span
        className={cn(
          "num font-display text-xl font-bold",
          decided && !won && "text-muted-foreground",
          !decided && "text-subtle-foreground",
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function GameCard({ game }: { game: ScoreGame }) {
  const decided = game.awayScore !== null && game.homeScore !== null;
  const away = game.awayScore ?? 0;
  const home = game.homeScore ?? 0;
  return (
    <article
      className={cn(
        "rounded-xl border bg-surface px-3 py-2",
        game.isUser ? "border-primary/60" : "border-border",
      )}
      aria-label={`${game.away.abbr} at ${game.home.abbr}`}
    >
      <Side team={game.away} score={game.awayScore} won={away > home} decided={decided} />
      <Side team={game.home} score={game.homeScore} won={home > away} decided={decided} />
      <p className="mt-1 border-t border-border pt-1.5 text-xs text-muted-foreground">
        {decided ? (away === home ? "Final · Tie" : "Final") : (game.timeLabel ?? "Not played yet")}
      </p>
    </article>
  );
}

/**
 * League scores (FEATURES.md 5.10): every game of a week across the league, from the schedule
 * screenshots or typed in, with a picker over the weeks that have games. The user's game leads.
 */
export function ScoresView({ seasonId, canImport }: { seasonId: Id<"seasons">; canImport: boolean }) {
  const picker = useQuery(api.leagueGames.scores.weeks, { seasonId });
  const weeks = picker?.weeks;
  const capture = useCapture();
  const [picked, setPicked] = useState<WeekKey | null>(null);
  const week = picked && weeks?.includes(picked) ? picked : (picker?.current ?? null);
  const games = useQuery(api.leagueGames.scores.byWeek, week ? { seasonId, weekKey: week } : "skip");
  const index = week && weeks ? weeks.indexOf(week) : -1;
  const step = (by: 1 | -1) => {
    const next = weeks?.[index + by];
    if (next) setPicked(next);
  };
  const add = (
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="primary" onClick={() => capture.open({ targetKey: "league_schedule" })}>
        <Camera /> Capture scores
      </Button>
      <ManualEntryLink target="league_schedule" seasonId={seasonId} label="Enter scores" />
      {canImport && <ImportScheduleButton seasonId={seasonId} />}
    </div>
  );

  if (weeks === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (weeks.length === 0 || !week) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No league schedule yet"
        description="Load the real NFL schedule (Madden's first season plays it), capture the schedule screens (one week or every week at once), or type the scores in."
        action={add}
      />
    );
  }

  return (
    <div className="@container space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Previous week"
          disabled={index <= 0}
          onClick={() => step(-1)}
        >
          <ChevronLeft />
        </Button>
        <Select
          className="w-44"
          aria-label="Week"
          value={week}
          onValueChange={(next) => setPicked(next as WeekKey)}
          options={weeks.map((w) => ({ value: w, label: weekLabel(w, "long") }))}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Next week"
          disabled={index >= weeks.length - 1}
          onClick={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {canImport && <ImportScheduleButton seasonId={seasonId} />}
          <ManualEntryLink target="league_schedule" seasonId={seasonId} label="Enter scores" />
        </span>
      </div>
      {games === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <ul
          className="grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-3"
          aria-label={`${weekLabel(week, "long")} scores`}
        >
          {games.map((game) => (
            <li key={game._id}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
