import type { Id } from "@convex/_generated/dataModel";
import {
  CATEGORY_PRIMARY,
  STAT_CATEGORY_LABELS,
  statsWithData,
  type StatCategory,
  type StatLine,
} from "@shared/stats";
import { DataTable, type EditValue } from "@/components/data/DataTable";
import { TeamChip } from "@/components/team/TeamChip";
import { boxColumns, boxRows, totalsRow, type BoxRow, type BoxStars, type BoxTeam } from "./boxScoreColumns";

type BoxTeamTablesProps = {
  team: BoxTeam;
  /** Both teams' lines, so a category's columns match between the two teams' tables. */
  allTeams: readonly BoxTeam[];
  categories: readonly StatCategory[];
  stars: Omit<BoxStars, "toggle"> & { toggle: (row: BoxRow, teamId: Id<"teams">) => void };
  onEdit: (row: BoxRow, statKey: string, value: EditValue) => Promise<unknown> | void;
};

/** One team's box score: a table per category it has stats in (passing, rushing, ...), in order. */
export function BoxTeamTables({ team, allTeams, categories, stars, onEdit }: BoxTeamTablesProps) {
  const allLines = allTeams.flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
  const tables = categories
    .map((category) => {
      const stats = statsWithData([category, "fantasy"], allLines, { singleGame: true });
      return { category, stats, rows: boxRows(team, stats) };
    })
    .filter((t) => t.rows.length > 0);
  const teamStars: BoxStars = { ...stars, toggle: (row) => stars.toggle(row, team.team._id) };
  const name = `${team.team.city} ${team.team.name}`;
  return (
    <section aria-label={name} className="space-y-4">
      <TeamChip team={team.team} label="full" size="sm" className="font-display text-lg font-semibold" />
      {tables.length === 0 && (
        <p className="text-sm text-muted-foreground">No player lines for {team.team.abbr} yet.</p>
      )}
      {tables.map(({ category, stats, rows }) => {
        const label = STAT_CATEGORY_LABELS[category];
        return (
          <div key={category} className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {label}
            </h3>
            <DataTable
              id={`box-${category}`}
              caption={`${team.team.abbr} ${label.toLowerCase()}`}
              data={rows}
              columns={boxColumns(stats, team.team, teamStars)}
              getRowId={(r) => r.id}
              identityColumn="player"
              primaryColumns={CATEGORY_PRIMARY[category]}
              totals={rows.length > 1 ? totalsRow(rows) : undefined}
              onEdit={onEdit}
              canEditRow={(row) => row.playerId !== null}
            />
          </div>
        );
      })}
    </section>
  );
}
