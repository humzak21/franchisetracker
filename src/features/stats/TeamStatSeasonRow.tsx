import { useMutation } from "convex/react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatRank, parseRank } from "@shared/stats";
import { formatTeamSeasonStat, type TeamSeasonStatKey } from "@shared/stats/teamSeasonRegistry";
import type { TeamSeasonSource } from "@shared/stats/teamTrends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

export type EditablePoint = {
  value: number;
  rank: number | null;
  tied: boolean;
  source: TeamSeasonSource;
  /** A worked-out rank is shown on the card but never saved as if it had been typed. */
  rankFromLeague: boolean;
};

const SOURCE_LABEL: Record<TeamSeasonSource, string> = {
  captured: "Entered",
  league: "From league",
  games: "From games",
};

type TeamStatSeasonRowProps = {
  statKey: TeamSeasonStatKey;
  seasonId: Id<"seasons">;
  year: number;
  point: EditablePoint | null;
};

/**
 * One season of one stat in the editor: its value and rank as typed text, saved together. A saved
 * value replaces the one worked out from the games until it is cleared.
 */
export function TeamStatSeasonRow({ statKey, seasonId, year, point }: TeamStatSeasonRowProps) {
  const typed = point?.source === "captured";
  const initialValue = point ? formatTeamSeasonStat(statKey, point.value) : "";
  const initialRank =
    typed && !point.rankFromLeague && point.rank !== null ? formatRank(point.rank, point.tied) : "";
  const [value, setValue] = useState(initialValue);
  const [rank, setRank] = useState(initialRank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation(api.league.teamStatsEdit.setSeason);
  const clear = useMutation(api.league.teamStatsEdit.clearSeason);
  const dirty = value !== initialValue || rank !== initialRank;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, "Could not save it."));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const number = Number(value.trim());
    if (value.trim() === "" || !Number.isFinite(number)) return setError("Enter a number");
    const parsed = rank.trim() === "" ? null : parseRank(rank);
    if (rank.trim() !== "" && !parsed) return setError("Enter a rank like 5 or T-5");
    void run(() => save({ seasonId, statKey, value: number, rank: parsed?.rank, tied: parsed?.tied }));
  };

  return (
    <form onSubmit={submit} className="space-y-1.5 py-3">
      <div className="flex items-center gap-2">
        <div className="w-[4.75rem] shrink-0">
          <p className="num text-sm font-semibold">{year}</p>
          <p className="text-[11px] text-subtle-foreground">{point ? SOURCE_LABEL[point.source] : "Empty"}</p>
        </div>
        <Input
          aria-label={`${year} value`}
          inputMode="decimal"
          value={value}
          placeholder="Value"
          onChange={(e) => setValue(e.target.value)}
          className="num min-w-0 flex-1"
        />
        <Input
          aria-label={`${year} league rank`}
          value={rank}
          placeholder="Rank"
          onChange={(e) => setRank(e.target.value)}
          className="num w-20 shrink-0"
        />
        <Button type="submit" size="sm" variant={dirty ? "primary" : "secondary"} disabled={busy || !dirty}>
          {busy ? <LoaderCircle className="animate-spin" /> : "Save"}
        </Button>
        {typed && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Use the games for ${year}`}
            title="Go back to the games"
            disabled={busy}
            onClick={() => void run(() => clear({ seasonId, statKey }))}
          >
            <RotateCcw />
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="pl-[5.25rem] text-xs text-loss">
          {error}
        </p>
      )}
    </form>
  );
}
