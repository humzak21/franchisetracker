import type { FunctionReturnType } from "convex/server";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { STAR_NAME_MAX } from "@shared/games/stars";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { matching, type DraftStar } from "./starDraft";

type Candidate = FunctionReturnType<typeof api.games.stars.candidates>[number];
type Side = TeamLike & { _id: Id<"teams"> };

type StarCandidatesProps = {
  candidates: readonly Candidate[] | undefined;
  picked: readonly DraftStar[];
  onAdd: (star: Omit<DraftStar, "key" | "caption">) => void;
  user: Side;
  opponent: Side | null;
};

/**
 * Players to add as stars: this game's box score (each with the line a star shows), then the
 * roster, then any typed name.
 */
export function StarCandidates({ candidates, picked, onAdd, user, opponent }: StarCandidatesProps) {
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<Id<"teams">>(user._id);
  const typed = search.trim();
  const shown = matching(candidates ?? [], picked, search);
  const teamOf = (id: Id<"teams"> | null) => (opponent && id === opponent._id ? opponent : user);
  const exact = shown.some((c) => c.name.toLowerCase() === typed.toLowerCase());

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Find a player"
          placeholder="Find a player or type any name"
          value={search}
          maxLength={STAR_NAME_MAX}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {typed !== "" && !exact && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm">“{typed}”</span>
          {opponent && (
            <Segmented
              size="sm"
              aria-label="Side for the typed name"
              value={side}
              onChange={setSide}
              options={[user, opponent].map((t) => ({ value: t._id, label: t.abbr }))}
            />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onAdd({ playerId: null, name: typed, position: null, teamId: side, statLine: null });
              setSearch("");
            }}
          >
            <Plus /> Add name
          </Button>
        </div>
      )}
      {candidates === undefined ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <ul
          aria-label="Players"
          className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border"
        >
          {shown.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              No players match; add the typed name instead.
            </li>
          )}
          {shown.map((c) => (
            <li key={c.playerId}>
              <button
                type="button"
                aria-label={`Add ${c.name}`}
                onClick={() =>
                  onAdd({
                    playerId: c.playerId,
                    name: c.name,
                    position: c.position,
                    teamId: c.teamId,
                    statLine: c.statLine,
                  })
                }
                className="flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2"
              >
                <PlayerChip
                  size="sm"
                  player={{
                    displayName: c.name,
                    position: c.position,
                    headshotUrl: c.headshotUrl,
                    team: teamOf(c.teamId),
                  }}
                  caption={
                    c.statLine ? (
                      <>
                        {c.position} · <span className="num">{c.statLine}</span>
                      </>
                    ) : undefined
                  }
                  className="flex-1"
                />
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {c.gameWinner
                    ? "Game-winning score"
                    : c.inGame
                      ? `${teamOf(c.teamId).abbr} box score`
                      : "Roster"}
                </span>
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
