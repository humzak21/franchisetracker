import { useMutation } from "convex/react";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { passerCandidates, SCORER_STAT, scoreCount } from "@shared/games/scorers";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";
import { rankedScorers, type PlayView, type ScoringData } from "./scoringViews";

type Role = "scorer" | "passer";

type ScorerSheetProps = {
  gameId: Id<"games">;
  play: PlayView;
  team: TeamLike & { _id: Id<"teams"> };
  data: ScoringData;
  onClose: () => void;
};

/** Who was on a play: the box score's likely players first, then the rest of the team. */
export function ScorerSheet({ gameId, play, team, data, onClose }: ScorerSheetProps) {
  const [role, setRole] = useState<Role>("scorer");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const players = useQuery(api.games.scoring.candidates, { gameId, teamId: team._id });
  const assign = useMutation(api.games.scoring.assign);
  const ranked =
    role === "scorer"
      ? rankedScorers(play, data, team.abbr)
      : passerCandidates(team.abbr, data.context?.lines ?? []);
  const rank = new Map(ranked.map((r, i) => [r.playerId, i]));
  const countOf = new Map(ranked.map((r) => [r.playerId, r.count]));
  const stat = role === "passer" ? "passTd" : SCORER_STAT[play.kind];
  const current = role === "scorer" ? play.playerId : play.passerId;
  const typed = search.trim().toLowerCase();
  const shown = [...(players ?? [])]
    .filter((p) => p.name.toLowerCase().includes(typed))
    .sort((a, b) => (rank.get(a.playerId) ?? 999) - (rank.get(b.playerId) ?? 999));

  const choose = async (playerId: Id<"players">) => {
    try {
      await assign({ playId: play._id, role, playerId });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save the player"));
    }
  };

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && onClose()}
      textEntry
      title={role === "scorer" ? "Who scored?" : "Who threw it?"}
      description={play.description ?? undefined}
    >
      <div className="space-y-3">
        {play.kind === "pass_td" && (
          <Segmented
            size="sm"
            aria-label="Player on the play"
            value={role}
            onChange={setRole}
            options={[
              { value: "scorer", label: "Scorer" },
              { value: "passer", label: "Passer" },
            ]}
          />
        )}
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            aria-label="Find a player"
            placeholder={`Find a ${team.abbr} player`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        {players === undefined ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <ul aria-label="Players" className="divide-y divide-border rounded-xl border border-border">
            {shown.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                No {team.abbr} player by that name.
              </li>
            )}
            {shown.map((p) => {
              const count = countOf.get(p.playerId);
              return (
                <li key={p.playerId}>
                  <button
                    type="button"
                    aria-label={`Choose ${p.name}`}
                    onClick={() => void choose(p.playerId)}
                    className="flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2"
                  >
                    <PlayerChip
                      size="sm"
                      player={{
                        displayName: p.name,
                        position: p.position,
                        headshotUrl: p.headshotUrl,
                        team,
                      }}
                      caption={count && stat ? `${scoreCount(stat, count)} in the box score` : undefined}
                      className="flex-1"
                    />
                    {current === p.playerId && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
