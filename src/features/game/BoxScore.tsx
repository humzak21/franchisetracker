import { useMutation } from "convex/react";
import { ImageUp, ListPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CATEGORY_PRIMARY,
  categoriesWithData,
  RAW_STAT_CATEGORIES,
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
import { useQuery } from "@/lib/convex/useQuery";
import { useRevealOnChange } from "@/lib/hooks/useRevealOnChange";
import { BoxLinesSheet } from "./BoxLinesSheet";
import { boxColumns, boxRows, totalsRow, type BoxTeam } from "./boxScoreColumns";

type BoxScoreProps = { gameId: Id<"games">; onImport: () => void };

/**
 * Game detail v2 box score: one category at a time, either team or both, with threshold
 * highlights. Phone tables keep each category's defining stats and fold the rest into the
 * tap-to-expand card. Edit turns recorded stats into inputs; Player lines adds or removes lines.
 */
export function BoxScore({ gameId, onImport }: BoxScoreProps) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const setStat = useMutation(api.games.statLines.setStat);
  const [side, setSide] = useState<string>("both");
  const [picked, setPicked] = useState<StatCategory | null>(null);
  const [linesOpen, setLinesOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Categories differ a lot in length (receiving vs passing): keep the whole table on screen.
  useRevealOnChange(box, `${picked}:${side}`);

  const categories = useMemo(() => {
    const rows = (data?.teams ?? []).flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
    return categoriesWithData(RAW_STAT_CATEGORIES, rows);
  }, [data]);

  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  const category = picked && categories.includes(picked) ? picked : (categories[0] ?? "passing");
  const linesSheet = (
    <BoxLinesSheet
      open={linesOpen}
      onOpenChange={setLinesOpen}
      gameId={gameId}
      teams={data.teams}
      category={category}
    />
  );
  const addLines = (
    <Button size="sm" variant="outline" onClick={() => setLinesOpen(true)} disabled={data.teams.length === 0}>
      <ListPlus /> Player lines
    </Button>
  );

  if (!data.teams.some((t) => t.lines.length > 0)) {
    return (
      <>
        <EmptyState
          icon={ImageUp}
          title="No box score yet"
          description="Snap the box score screens and import them, or add player lines by hand; passing, rushing, receiving and defense fill in here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={onImport}>
                Import screenshot
              </Button>
              {addLines}
            </div>
          }
        />
        {linesSheet}
      </>
    );
  }

  const shown: BoxTeam[] = data.teams.filter((t) => side === "both" || t.team.abbr === side);
  // Columns from both teams, so the two tables line up when shown together.
  const allLines = data.teams.flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
  const stats = statsWithData([category, "fantasy"], allLines, { singleGame: true });
  return (
    <div ref={box} className="scroll-mt-20 scroll-mb-24 space-y-3 sm:scroll-mb-4">
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
        <div className="flex items-center gap-2">
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
          {addLines}
        </div>
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
              onEdit={(row, statKey, value) =>
                row.playerId
                  ? setStat({
                      gameId,
                      playerId: row.playerId as Id<"players">,
                      statKey,
                      value: typeof value === "string" ? Number(value) : value,
                    })
                  : undefined
              }
              canEditRow={(row) => row.playerId !== null}
              emptyState={
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No {STAT_CATEGORY_LABELS[category].toLowerCase()} for {team.team.abbr}.
                </p>
              }
            />
          </section>
        );
      })}
      {linesSheet}
    </div>
  );
}
