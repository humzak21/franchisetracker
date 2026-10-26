import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { careerColumns, careerRows, phonePrimary, totalsRow, visibleStats } from "./careerStats";
import type { PlayerPage } from "./types";

/** Season-by-season stats with a career totals row, columns chosen from the stat registry. */
export function CareerStatsTable({ page }: { page: PlayerPage }) {
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const { rows, totals, columns, primary } = useMemo(() => {
    const rows = careerRows(page.seasons);
    const stats = visibleStats(position, rows);
    return {
      rows,
      totals: totalsRow(rows),
      columns: careerColumns(stats),
      primary: phonePrimary(position, stats),
    };
  }, [page.seasons, position]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No stats yet"
        description="Season totals come from box score screenshots as you play, and from the real NFL history import for seasons before the franchise."
      />
    );
  }
  return (
    <DataTable
      id={`player-career-${position}`}
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      identityColumn="season"
      primaryColumns={primary}
      totals={totals}
      caption="Career stats"
    />
  );
}
