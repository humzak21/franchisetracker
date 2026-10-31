import { Split as SplitIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionGroupOf } from "@shared/domain";
import {
  categoriesForPosition,
  RAW_STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatLine,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { SplitTable } from "@/components/data/SplitTable";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { phonePrimary } from "./careerStats";
import type { PlayerPage } from "./types";

type Group = FunctionReturnType<typeof api.stats.splits.player>["sections"][number]["groups"][number];

const ALL = "all";

/** One player's games by split, a season or the whole career, in the columns of a season row. */
export function PlayerSplits({ page }: { page: PlayerPage }) {
  const [seasonId, setSeasonId] = useState<Id<"seasons"> | typeof ALL>(ALL);
  const data = useQuery(api.stats.splits.player, { playerId: page.player._id, seasonId });
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const { columns, primary } = useMemo(() => {
    const stats = statsWithData(
      categoriesForPosition(positionGroupOf(position), [...RAW_STAT_CATEGORIES, "fantasy"]),
      sections.flatMap((s) => s.groups).map((g) => ({ line: g.totals as StatLine, games: g.gamesPlayed })),
    );
    const games: DataColumn<Group> = {
      id: "games",
      header: "G",
      title: "Games",
      align: "right",
      value: (g) => g.gamesPlayed,
      sortDescFirst: true,
      cell: (g) => <span className="num">{g.gamesPlayed}</span>,
    };
    const statColumns = stats.map((key) =>
      statColumn<Group>(key, (g) => statValue(key, g.totals as StatLine, { games: g.gamesPlayed }), {
        group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
        // Elite marks read a full season; a split of one is not.
        highlight: false,
      }),
    );
    return {
      columns: [games, ...statColumns],
      primary: ["games", ...phonePrimary(position, stats).slice(0, 2)],
    };
  }, [position, sections]);

  if (data === undefined) return <Skeleton className="h-48 rounded-xl" />;
  if (data.seasons.length === 0) {
    return (
      <EmptyState
        icon={SplitIcon}
        title="No games to split"
        description="Splits come from box scores you capture during the franchise."
      />
    );
  }
  return (
    <div className="space-y-3">
      {data.seasons.length > 1 && (
        <Select
          className="max-w-40"
          aria-label="Splits season"
          value={seasonId}
          onValueChange={(id) => setSeasonId(id as Id<"seasons"> | typeof ALL)}
          options={[
            { value: ALL, label: "Whole career" },
            ...data.seasons.map((s) => ({ value: s.seasonId, label: String(s.year) })),
          ]}
        />
      )}
      <SplitTable
        id={`player-splits-${positionGroupOf(position)}`}
        caption="Player splits"
        sections={sections}
        columns={columns}
        primaryColumns={primary}
      />
    </div>
  );
}
