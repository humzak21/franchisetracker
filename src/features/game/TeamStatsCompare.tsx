import { BarChart3, Check, Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  formatTeamRow,
  rowValue,
  TEAM_STAT_ROWS,
  TEAM_STATS,
  type TeamStatLine,
} from "@shared/stats/teamRegistry";
import { EmptyState } from "@/components/data/EmptyState";
import { StatComparison, type ComparisonRow } from "@/components/data/StatComparison";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { seriesColors, useTheme } from "@/design/theme";
import { useQuery } from "@/lib/convex/useQuery";
import { TeamStatsEditor } from "./TeamStatsEditor";

type TeamStatsCompareProps = {
  gameId: Id<"games">;
  /** Puts the away team on the left and home on the right, like a broadcast; null keeps the user left. */
  userIsHome: boolean | null;
  onImport: () => void;
};

/** The two teams' game stats from the team stats screen, away on the left; Edit types them in. */
export function TeamStatsCompare({ gameId, userIsHome, onImport }: TeamStatsCompareProps) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const { resolved } = useTheme();
  const [editing, setEditing] = useState(false);
  // Box score teams come user first; shown away first.
  const [us, them] = data?.teams ?? [];
  const sides = userIsHome ? [...(data?.teams ?? [])].reverse() : (data?.teams ?? []);
  const canEdit = data !== undefined && data.teams.length === 2;
  const toggle = canEdit && (
    <Button
      size="sm"
      variant={editing ? "primary" : "outline"}
      aria-pressed={editing}
      aria-label={editing ? "Done editing team stats" : "Edit team stats"}
      onClick={() => setEditing((on) => !on)}
    >
      {editing ? <Check /> : <Pencil />} {editing ? "Done" : "Edit"}
    </Button>
  );

  let body;
  if (data === undefined) body = <Skeleton className="h-48 rounded-xl" />;
  else if (editing) body = <TeamStatsEditor gameId={gameId} teams={sides} />;
  else if (!us?.stats || !them?.stats) {
    body = (
      <EmptyState
        icon={BarChart3}
        title="No team stats yet"
        description="Import the post-game team stats screen, or type the numbers in with Edit, to compare yards, third downs and possession."
        action={
          <Button size="sm" onClick={onImport}>
            Import team stats
          </Button>
        }
      />
    );
  } else {
    // The user's team keeps its color; the opponent switches to its other color (or a token) on a clash.
    const [usColor = "", themColor = ""] = seriesColors([us.team, them.team], resolved);
    const [leftTeam, rightTeam] = userIsHome ? [them, us] : [us, them];
    const [leftColor, rightColor] = userIsHome ? [themColor, usColor] : [usColor, themColor];
    const left = leftTeam.stats as TeamStatLine;
    const right = rightTeam.stats as TeamStatLine;
    const rows: ComparisonRow[] = TEAM_STAT_ROWS.filter(
      (row) => rowValue(row, left) !== null || rowValue(row, right) !== null,
    ).map((row) => ({
      id: row.id,
      label: row.label,
      left: { text: formatTeamRow(row, left), value: rowValue(row, left) },
      right: { text: formatTeamRow(row, right), value: rowValue(row, right) },
      better: TEAM_STATS[row.keys[0]].better,
    }));
    body = (
      <StatComparison
        left={{ label: leftTeam.team.abbr, color: leftColor }}
        right={{ label: rightTeam.team.abbr, color: rightColor }}
        rows={rows}
      />
    );
  }
  return (
    <Section title="Team stats" actions={toggle || undefined}>
      {body}
    </Section>
  );
}
