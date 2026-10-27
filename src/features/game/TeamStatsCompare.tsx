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
import { teamAccent, useTheme } from "@/design/theme";
import { useQuery } from "@/lib/convex/useQuery";
import { TeamStatsEditor } from "./TeamStatsEditor";

/** The two teams' game stats from the team stats screen, user team on the left; Edit types them in. */
export function TeamStatsCompare({ gameId, onImport }: { gameId: Id<"games">; onImport: () => void }) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const { resolved } = useTheme();
  const [editing, setEditing] = useState(false);
  const [us, them] = data?.teams ?? [];
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
  else if (editing) body = <TeamStatsEditor gameId={gameId} teams={data.teams} />;
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
    const left = us.stats as TeamStatLine;
    const right = them.stats as TeamStatLine;
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
        left={{ label: us.team.abbr, color: teamAccent(us.team, resolved) }}
        right={{ label: them.team.abbr, color: teamAccent(them.team, resolved) }}
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
