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

type BoxCategoryProps = {
  category: StatCategory;
  /** The user's team first; a team with no one in this category is left out. */
  teams: readonly BoxTeam[];
  stars: Omit<BoxStars, "toggle"> & { toggle: (row: BoxRow, teamId: Id<"teams">) => void };
  onEdit: (row: BoxRow, statKey: string, value: EditValue) => Promise<unknown> | void;
};

/** One category of the box score (passing, rushing, ...): a table per team, one after the other. */
export function BoxCategory({ category, teams, stars, onEdit }: BoxCategoryProps) {
  const label = STAT_CATEGORY_LABELS[category];
  // Columns from both teams, so the two tables line up.
  const allLines = teams.flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
  const stats = statsWithData([category, "fantasy"], allLines, { singleGame: true });
  const tables = teams.map((team) => ({ team, rows: boxRows(team, stats) })).filter((t) => t.rows.length > 0);
  return (
    <section aria-label={label} className="space-y-3">
      <h3 className="font-display text-base leading-tight font-semibold tracking-wide uppercase">{label}</h3>
      {tables.map(({ team, rows }) => (
        <div key={team.team._id} className="space-y-2">
          <TeamChip team={team.team} label="full" size="xs" className="text-sm" />
          <DataTable
            id={`box-${category}`}
            caption={`${team.team.abbr} ${label.toLowerCase()}`}
            data={rows}
            columns={boxColumns(stats, team.team, {
              ...stars,
              toggle: (row) => stars.toggle(row, team.team._id),
            })}
            getRowId={(r) => r.id}
            identityColumn="player"
            primaryColumns={CATEGORY_PRIMARY[category]}
            totals={rows.length > 1 ? totalsRow(rows) : undefined}
            onEdit={onEdit}
            canEditRow={(row) => row.playerId !== null}
          />
        </div>
      ))}
    </section>
  );
}
