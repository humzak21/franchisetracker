import { useMutation } from "convex/react";
import { ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { positionGroupOf } from "@shared/domain";
import { counted } from "@shared/ops/maintenance";
import {
  categoriesForPosition,
  RAW_STAT_CATEGORIES,
  STAT_REGISTRY,
  statsWithData,
  type StatKey,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { gameLogColumns, type GameLogRow } from "./gameLogColumns";
import type { PlayerPage } from "./types";

const CAREER = "career";
const TYPING_MS = 300;

/** The stat and the least of it a career's games must have. */
function GameFilter({
  stats,
  statKey,
  onStat,
  min,
  onMin,
}: {
  stats: readonly StatKey[];
  statKey: string;
  onStat: (statKey: string) => void;
  min: string;
  onMin: (min: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Games with" className="w-52 max-w-full">
        <Select
          aria-label="Games with"
          value={statKey}
          options={[
            { value: "", label: "Any stat" },
            ...stats.map((key) => ({ value: key, label: STAT_REGISTRY[key].label })),
          ]}
          onValueChange={onStat}
        />
      </Field>
      {statKey !== "" && (
        <Field label="At least" className="w-28">
          <Input
            type="number"
            inputMode="decimal"
            aria-label="At least"
            value={min}
            onChange={(e) => onMin(e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}

/** Game by game for one franchise season or a whole career, with threshold marks and filters. */
export function GameLog({ page }: { page: PlayerPage }) {
  const seasons = useMemo(() => {
    const logged = page.seasons.filter((s) => s.stats.source === "logs");
    const byId = new Map(logged.map((s) => [s.stats.seasonId, s.year]));
    return [...byId.entries()].sort((a, b) => b[1] - a[1]);
  }, [page.seasons]);
  const [picked, setPicked] = useState<Id<"seasons"> | typeof CAREER | null>(null);
  const [statKey, setStatKey] = useState("");
  const [min, setMin] = useState("");
  const typed = useDebouncedValue(min, TYPING_MS);
  const choice = picked ?? seasons[0]?.[0] ?? null;
  const career = choice === CAREER;
  const playerId = page.player._id;
  const filter = career && statKey !== "" && typed !== "" ? { statKey, min: Number(typed) } : undefined;
  const seasonRows = useQuery(
    api.players.gameLog.bySeason,
    choice && !career ? { playerId, seasonId: choice } : "skip",
  );
  const careerRows = useQuery(api.players.gameLog.career, career ? { playerId, filter } : "skip");
  const rows: GameLogRow[] | undefined = career ? careerRows : seasonRows;
  const setStat = useMutation(api.games.statLines.setStat);
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const thresholds = useFranchise()?.franchise.settings.gameThresholdOverrides as
    ThresholdOverrides | undefined;
  const { cols, primary } = useMemo(
    () => gameLogColumns(position, rows ?? [], thresholds, career),
    [position, rows, thresholds, career],
  );
  // From the season totals, not the rows: narrowing the games must not shrink its own choices.
  const filterStats = useMemo(
    () =>
      statsWithData(
        categoriesForPosition(positionGroupOf(position), [...RAW_STAT_CATEGORIES, "fantasy"]),
        page.seasons.map((s) => ({ line: s.stats.totals as StatLine })),
        { singleGame: true },
      ),
    [position, page.seasons],
  );

  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No games logged yet"
        description="Game logs come from box scores you capture during the franchise; real seasons before it are season totals only."
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Games from" className="w-40">
          <Select
            aria-label="Season"
            value={choice ?? ""}
            onValueChange={(id) => setPicked(id as Id<"seasons"> | typeof CAREER)}
            options={[
              { value: CAREER, label: "Whole career" },
              ...seasons.map(([id, year]) => ({ value: id, label: String(year) })),
            ]}
          />
        </Field>
        {career && (
          <GameFilter stats={filterStats} statKey={statKey} onStat={setStatKey} min={min} onMin={setMin} />
        )}
      </div>
      {career && rows && <p className="text-sm text-muted-foreground">{counted(rows.length, "game")}</p>}
      <DataTable<GameLogRow>
        key={career ? CAREER : choice}
        id={`player-${career ? "career" : "game"}-log-${positionGroupOf(position)}`}
        data={rows}
        columns={cols}
        getRowId={(r) => r.gameId}
        identityColumn="week"
        primaryColumns={primary}
        caption="Game log"
        onEdit={(row, statKey, value) =>
          setStat({
            gameId: row.gameId,
            playerId: page.player._id,
            statKey,
            value: typeof value === "string" ? Number(value) : value,
          })
        }
      />
    </div>
  );
}
