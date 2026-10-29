import { useMutation } from "convex/react";
import { ImageUp, ListPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { categoriesWithData, RAW_STAT_CATEGORIES, type StatLine } from "@shared/stats";
import type { EditValue } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import type { StarView } from "@/components/player/GameStars";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { BoxLinesSheet } from "./BoxLinesSheet";
import { BoxTeamTables } from "./BoxTeamTables";
import type { BoxRow } from "./boxScoreColumns";

type BoxScoreProps = { gameId: Id<"games">; stars: readonly StarView[]; onImport: () => void };

/**
 * Game detail box score on one page, by team: every table for the franchise's team (passing,
 * rushing, receiving, defense, ...), then every table for the opponent, with threshold highlights. Phone tables keep each category's defining stats and fold the rest into the
 * tap-to-expand card. Edit turns recorded stats into inputs; Player lines adds or removes lines.
 * The star beside each player makes him a star of the game in one click, and a second click undoes it.
 */
export function BoxScore({ gameId, stars, onImport }: BoxScoreProps) {
  const data = useQuery(api.games.boxScore.get, { gameId });
  const setStat = useMutation(api.games.statLines.setStat);
  const toggleStar = useMutation(api.games.stars.toggle);
  const [pending, setPending] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const starIds = useMemo(() => new Set(stars.flatMap((s) => (s.playerId ? [s.playerId] : []))), [stars]);
  const toggle = useCallback(
    (row: BoxRow, teamId: Id<"teams">) => {
      if (!row.playerId) return;
      setPending(row.playerId);
      setStarError(null);
      toggleStar({ gameId, playerId: row.playerId as Id<"players">, teamId })
        .catch((err: unknown) => setStarError(errorMessage(err, "Could not change the stars.")))
        .finally(() => setPending(null));
    },
    [gameId, toggleStar],
  );
  const [linesOpen, setLinesOpen] = useState(false);

  const categories = useMemo(() => {
    const rows = (data?.teams ?? []).flatMap((t) => t.lines.map((l) => ({ line: l.stats as StatLine })));
    return categoriesWithData(RAW_STAT_CATEGORIES, rows);
  }, [data]);

  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  const linesSheet = (
    <BoxLinesSheet
      open={linesOpen}
      onOpenChange={setLinesOpen}
      gameId={gameId}
      teams={data.teams}
      category={categories[0] ?? "passing"}
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

  const onEdit = (row: BoxRow, statKey: string, value: EditValue) =>
    row.playerId
      ? setStat({
          gameId,
          playerId: row.playerId as Id<"players">,
          statKey,
          value: typeof value === "string" ? Number(value) : value,
        })
      : undefined;
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-end gap-2">{addLines}</div>
      {starError && (
        <p role="alert" className="text-sm text-loss">
          {starError}
        </p>
      )}
      {/* The franchise's team always comes first. */}
      {[...data.teams]
        .sort((a, b) => Number(b.isUser) - Number(a.isUser))
        .map((team) => (
          <BoxTeamTables
            key={team.team._id}
            team={team}
            allTeams={data.teams}
            categories={categories}
            stars={{ isStar: (id) => starIds.has(id), pending, toggle }}
            onEdit={onEdit}
          />
        ))}
      {linesSheet}
    </div>
  );
}
