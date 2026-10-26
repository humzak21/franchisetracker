import { useQuery } from "convex/react";
import { ImageUp } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CATEGORY_PRIMARY,
  categoriesWithData,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  statsWithData,
  type StatCategory,
  type StatLine,
} from "@shared/stats";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Button } from "@/components/ui/button";
import { TeamChip } from "@/components/team/TeamChip";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { boxColumns, boxRows, totalsRow, type BoxTeam } from "./boxScoreColumns";

type BoxScoreProps = { gameId: Id<"games">; onImport: () => void };

/**
 * Game detail v2 box score: one category at a time, either team or both, with threshold
 * highlights. Phone tables keep each category's defining stats and fold the rest into the
 * tap-to-expand card.
 */
export function BoxScore({ gameId, onImport }: BoxScoreProps) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const [side, setSide] = useState<string>("both");
  const [picked, setPicked] = useState<StatCategory | null>(null);

  const categories = useMemo(() => {
    const rows = (data?.teams ?? []).flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
    return categoriesWithData(STAT_CATEGORIES, rows);
  }, [data]);

  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (!data.teams.some((t) => t.lines.length > 0)) {
    return (
      <EmptyState
        icon={ImageUp}
        title="No box score yet"
        description="Snap the box score screens and import them; passing, rushing, receiving and defense fill in here."
        action={
          <Button variant="primary" onClick={onImport}>
            Import screenshot
          </Button>
        }
      />
    );
  }

  const category = picked && categories.includes(picked) ? picked : (categories[0] ?? "passing");
  const shown: BoxTeam[] = data.teams.filter((t) => side === "both" || t.team.abbr === side);
  // Columns from both teams, so the two tables line up when shown together.
  const allLines = data.teams.flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
  const stats = statsWithData([category], allLines, { singleGame: true });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div data-swipe-ignore className="-mx-1 max-w-full scrollbar-none overflow-x-auto px-1">
          <Segmented
            size="sm"
            aria-label="Category"
            value={category}
            onChange={setPicked}
            options={categories.map((c) => ({ value: c, label: STAT_CATEGORY_LABELS[c] }))}
          />
        </div>
        <Segmented
          size="sm"
          aria-label="Team"
          value={side}
          onChange={setSide}
          options={[
            ...data.teams.map((t) => ({ value: t.team.abbr, label: t.team.abbr })),
            { value: "both", label: "Both" },
          ]}
        />
      </div>
      {shown.map((team) => {
        const rows = boxRows(team, stats);
        return (
          <section key={`${team.team._id}-${category}`} className="space-y-2">
            <TeamChip team={team.team} label="full" size="xs" className="text-sm" />
            <DataTable
              id={`box-${category}`}
              caption={`${team.team.abbr} ${STAT_CATEGORY_LABELS[category].toLowerCase()}`}
              data={rows}
              columns={boxColumns(stats, team.team)}
              getRowId={(r) => r.id}
              identityColumn="player"
              primaryColumns={CATEGORY_PRIMARY[category]}
              totals={rows.length > 1 ? totalsRow(rows) : undefined}
              emptyState={
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No {STAT_CATEGORY_LABELS[category].toLowerCase()} for {team.team.abbr}.
                </p>
              }
            />
          </section>
        );
      })}
    </div>
  );
}
