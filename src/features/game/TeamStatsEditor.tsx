import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  formatTeamStat,
  parseClock,
  TEAM_STAT_KEYS,
  TEAM_STATS,
  type TeamStatKey,
  type TeamStatLine,
} from "@shared/stats/teamRegistry";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import type { BoxTeam } from "./boxScoreColumns";

const shown = (key: TeamStatKey, value: number | undefined) =>
  value === undefined ? "" : TEAM_STATS[key].format === "time" ? formatTeamStat(key, value) : String(value);

/** One team stat for one side; saves on blur or Enter when it changed, Escape reverts. */
function TeamStatInput({
  gameId,
  team,
  statKey,
  value,
}: {
  gameId: Id<"games">;
  team: BoxTeam["team"];
  statKey: TeamStatKey;
  value: number | undefined;
}) {
  const save = useMutation(api.games.statLines.setTeamStat);
  const initial = shown(statKey, value);
  const [draft, setDraft] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  if (initial !== seen) {
    setSeen(initial);
    if (draft === seen) setDraft(initial);
  }
  const commit = async () => {
    if (draft === initial) return;
    const parsed = draft.trim() === "" ? null : parseClock(draft);
    if (draft.trim() !== "" && parsed === null) return setError("Not a number");
    setError(null);
    try {
      await save({ gameId, teamId: team._id, statKey, value: parsed });
    } catch (err) {
      setError(errorMessage(err, "Could not save"));
      setDraft(initial);
    }
  };
  return (
    <input
      aria-label={`${team.abbr} ${TEAM_STATS[statKey].label}`}
      title={error ?? undefined}
      aria-invalid={error !== null || undefined}
      inputMode={TEAM_STATS[statKey].format === "time" ? "text" : "numeric"}
      placeholder={TEAM_STATS[statKey].format === "time" ? "31:42" : "—"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(initial);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "num h-8 w-full rounded-md border bg-surface px-2 text-right text-sm focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:text-base",
        error ? "border-loss" : "border-input",
      )}
    />
  );
}

/** Every team stat for both sides, edited in place; Madden's post-game screen order. */
export function TeamStatsEditor({ gameId, teams }: { gameId: Id<"games">; teams: readonly BoxTeam[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-2 gap-y-1.5">
        <span />
        {teams.map((t) => (
          <span key={t.team._id} className="text-right text-xs font-semibold text-muted-foreground">
            {t.team.abbr}
          </span>
        ))}
        {TEAM_STAT_KEYS.map((key) => (
          <div key={key} className="contents">
            <span className="truncate text-sm">{TEAM_STATS[key].label}</span>
            {teams.map((t) => (
              <TeamStatInput
                key={t.team._id}
                gameId={gameId}
                team={t.team}
                statKey={key}
                value={(t.stats as TeamStatLine | null)?.[key]}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
