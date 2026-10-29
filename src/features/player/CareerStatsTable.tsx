import { useMutation } from "convex/react";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { GAMES_EDIT_KEY, type ThresholdOverrides } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Segmented } from "@/components/ui/segmented";
import { careerColumns, careerRows, phonePrimary, totalsRow, visibleStats } from "./careerStats";
import type { PlayerPage } from "./types";

/** Season-by-season stats with a career totals row, columns chosen from the stat registry. */
export function CareerStatsTable({ page }: { page: PlayerPage }) {
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const [split, setSplit] = useState<"regular" | "postseason">("regular");
  const thresholds = useFranchise()?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const setStat = useMutation(api.stats.edit.setStat);
  const hasPlayoffs = page.seasons.some((s) => s.stats.split === "postseason");
  const { rows, totals, columns, primary } = useMemo(() => {
    const rows = careerRows(page.seasons, split);
    const stats = visibleStats(position, rows);
    return {
      rows,
      totals: totalsRow(rows),
      columns: careerColumns(stats, thresholds),
      primary: phonePrimary(position, stats),
    };
  }, [page.seasons, position, split, thresholds]);

  const toggle = hasPlayoffs && (
    <Segmented
      size="sm"
      aria-label="Split"
      value={split}
      onChange={setSplit}
      options={[
        { value: "regular", label: "Regular season" },
        { value: "postseason", label: "Playoffs" },
      ]}
    />
  );
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        {toggle}
        <EmptyState
          icon={BarChart3}
          title="No stats yet"
          description="Season totals come from box score screenshots as you play, and from the real NFL history import for seasons before the franchise."
        />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {toggle}
      <DataTable
        key={split}
        id={`player-career-${position}`}
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        identityColumn="season"
        primaryColumns={primary}
        totals={totals}
        caption="Career stats"
        onEdit={(row, columnId, value) =>
          row.seasonId && row.teamId
            ? setStat({
                playerId: page.player._id,
                seasonId: row.seasonId,
                teamId: row.teamId,
                split,
                stat: columnId === "gp" ? GAMES_EDIT_KEY : columnId,
                value: typeof value === "number" ? value : null,
              })
            : undefined
        }
        // Playoff totals from the logs change only through their games.
        canEditRow={(row) => row.seasonId !== undefined && (split === "regular" || row.source === "import")}
      />
      {rows.some((r) => r.overridden.length > 0) && (
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">•</span> {MISSING_GAME_NOTE}.
        </p>
      )}
    </div>
  );
}
