import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { teamAccent, useTheme } from "@/design/theme";

/** The two teams' game stats from the team stats screen, user team on the left. */
export function TeamStatsCompare({ gameId, onImport }: { gameId: Id<"games">; onImport: () => void }) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const { resolved } = useTheme();
  if (data === undefined) return <Skeleton className="h-48 rounded-xl" />;
  const [us, them] = data.teams;
  if (!us?.stats || !them?.stats) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No team stats yet"
        description="Import the post-game team stats screen to compare yards, third downs and possession."
        action={
          <Button size="sm" onClick={onImport}>
            Import team stats
          </Button>
        }
      />
    );
  }
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
  return (
    <StatComparison
      left={{ label: us.team.abbr, color: teamAccent(us.team, resolved) }}
      right={{ label: them.team.abbr, color: teamAccent(them.team, resolved) }}
      rows={rows}
    />
  );
}
