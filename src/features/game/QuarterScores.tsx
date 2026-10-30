import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { periodLabel, type LineScore } from "@shared/games/lineScore";
import { TeamLogo, type TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { QuarterScoresEditor } from "./QuarterScoresEditor";

export type QuarterSide = { team: TeamLike; score: number | null };

type QuarterScoresProps = {
  gameId: Id<"games">;
  lineScore: LineScore | null;
  /** The quarters come from the scoring plays, which win over anything typed. */
  fromPlays: boolean;
  away: QuarterSide;
  home: QuarterSide;
};

const cell = "num w-9 px-1 py-1.5 text-center @tablet:w-11";

/** Scoring by quarter under the score bug, away team on top like the bug; Edit types it in. */
export function QuarterScores({ gameId, lineScore, fromPlays, away, home }: QuarterScoresProps) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <QuarterScoresEditor
        gameId={gameId}
        lineScore={lineScore}
        away={away}
        home={home}
        onDone={() => setEditing(false)}
      />
    );
  }
  if (!lineScore) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Plus /> Quarter scores
        </Button>
      </div>
    );
  }
  const rows = [
    { side: away, points: lineScore.away },
    { side: home, points: lineScore.home },
  ];
  return (
    <div className="@container flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <table className="w-full text-sm" aria-label="Scoring by quarter">
        <thead>
          <tr className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            <th scope="col" className="py-1.5 text-left font-semibold">
              <span className="sr-only">Team</span>
            </th>
            {lineScore.home.map((_, i) => (
              <th key={i} scope="col" className={cn(cell, "font-semibold")}>
                {periodLabel(i)}
              </th>
            ))}
            <th scope="col" className={cn(cell, "font-semibold")}>
              T
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ side, points }) => (
            <tr key={side.team.abbr} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-medium">
                <span className="inline-flex items-center gap-2">
                  <TeamLogo team={side.team} size="xs" />
                  {side.team.abbr}
                </span>
              </th>
              {points.map((p, i) => (
                <td key={i} className={cn(cell, p === 0 && "text-subtle-foreground")}>
                  {p}
                </td>
              ))}
              <td className={cn(cell, "font-bold")}>{side.score ?? "–"}</td>
            </tr>
          ))}
        </tbody>
        {fromPlays && (
          <caption className="caption-bottom pt-1 text-left text-xs text-muted-foreground">
            From the scoring plays
          </caption>
        )}
      </table>
      {!fromPlays && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Edit quarter scores"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
      )}
    </div>
  );
}
