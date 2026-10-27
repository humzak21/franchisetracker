import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { GOAL_TYPE_LABELS, POSITIONS, TEAM_GOAL_TYPES, type GoalScope, type GoalType } from "@shared/domain";
import { MAX_GOAL_TEXT, MAX_WINS_TARGET, STAT_GOAL_OPTIONS, targetSign } from "@shared/seasons/goalSpec";
import { isStatKey } from "@shared/stats";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { withScope, type GoalDraft } from "./goalDraft";

const SCOPE_OPTIONS: { value: GoalScope; label: string }[] = [
  { value: "team", label: "Team" },
  { value: "player", label: "Player" },
];
const TEAM_OPTIONS = TEAM_GOAL_TYPES.map((t) => ({
  value: t,
  label: t === "wins" ? "Win at least … games" : GOAL_TYPE_LABELS[t],
}));
const PLAYER_KIND_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "stat", label: "Stat target" },
  { value: "custom", label: "Write in" },
];

/** The season's user-team roster as picker options, grouped by position; undefined while loading. */
function useRosterOptions(seasonId: Id<"seasons">, enabled: boolean) {
  const roster = useQuery(api.players.roster.bySeason, enabled ? { seasonId } : "skip");
  if (!roster) return undefined;
  return [...roster.entries]
    .sort(
      (a, b) =>
        POSITIONS.indexOf(a.entry.position) - POSITIONS.indexOf(b.entry.position) ||
        a.player.displayName.localeCompare(b.player.displayName),
    )
    .map(({ player, entry }) => ({ value: player._id, label: player.displayName, group: entry.position }));
}

/** What a goal says: team or player, the kind of goal, and its target or words. */
export function GoalFields({
  seasonId,
  draft,
  onChange,
}: {
  seasonId: Id<"seasons">;
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
}) {
  const players = useRosterOptions(seasonId, draft.scope === "player");
  const set = (patch: Partial<GoalDraft>) => onChange({ ...draft, ...patch });
  const sign = isStatKey(draft.statKey) ? targetSign(draft.statKey) : null;

  return (
    <div className="space-y-3">
      <Segmented
        aria-label="Goal for"
        value={draft.scope}
        onChange={(scope) => onChange(withScope(draft, scope))}
        options={SCOPE_OPTIONS}
        className="flex w-full"
      />
      {draft.scope === "team" ? (
        <Select
          aria-label="Team goal"
          value={draft.type}
          options={TEAM_OPTIONS}
          onValueChange={(type) => set({ type: type as GoalType })}
        />
      ) : (
        <>
          <Select
            aria-label="Player"
            value={draft.playerId}
            placeholder={
              players === undefined
                ? "Loading the roster…"
                : players.length > 0
                  ? "Pick a player"
                  : "No roster for this season yet"
            }
            options={players ?? []}
            onValueChange={(playerId) => set({ playerId })}
          />
          <Segmented
            aria-label="Player goal"
            value={draft.type}
            onChange={(type) => set({ type })}
            options={PLAYER_KIND_OPTIONS}
            className="flex w-full"
          />
          {draft.type === "stat" && (
            <Select
              aria-label="Stat"
              value={draft.statKey}
              placeholder="Pick a stat"
              options={STAT_GOAL_OPTIONS}
              onValueChange={(statKey) => set({ statKey })}
            />
          )}
        </>
      )}
      {(draft.type === "wins" || draft.type === "stat") && (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-muted-foreground">
            {draft.type === "wins" ? "Wins" : `Target ${sign ?? ""}`}
          </span>
          <Input
            aria-label="Target"
            type="number"
            inputMode="decimal"
            min={0}
            max={draft.type === "wins" ? MAX_WINS_TARGET : undefined}
            step={draft.type === "wins" ? 1 : "any"}
            value={draft.target}
            onChange={(e) => set({ target: e.target.value })}
          />
        </label>
      )}
      {draft.type === "custom" && (
        <Input
          aria-label="Goal"
          placeholder={
            draft.scope === "team" ? "Sweep the division, beat Buffalo twice…" : "Make the Pro Bowl…"
          }
          value={draft.text}
          maxLength={MAX_GOAL_TEXT}
          onChange={(e) => set({ text: e.target.value })}
        />
      )}
    </div>
  );
}
