import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StatCategory } from "@shared/stats";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { TeamChip } from "@/components/team/TeamChip";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { AddLineForm } from "./AddLineForm";
import type { BoxTeam } from "./boxScoreColumns";

type BoxLinesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: Id<"games">;
  teams: readonly BoxTeam[];
  category: StatCategory;
};

/** Adds and removes whole player lines; single numbers are edited in the table itself. */
export function BoxLinesSheet({ open, onOpenChange, gameId, teams, category }: BoxLinesSheetProps) {
  const removeLine = useMutation(api.games.statLines.removeLine);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (playerId: Id<"players">) => {
    setError(null);
    try {
      await removeLine({ gameId, playerId });
      setConfirming(null);
    } catch (err) {
      setError(errorMessage(err, "Could not remove the line."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Player lines"
      description="Add a player's line or remove one. Season stats and records follow each change."
    >
      {open && (
        <div className="space-y-5 pb-2">
          <AddLineForm gameId={gameId} teams={teams} category={category} />
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
          {teams.map(({ team, lines }) => (
            <section key={team._id} className="space-y-1.5">
              <TeamChip team={team} label="full" size="xs" className="text-sm" />
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lines yet.</p>
              ) : (
                <ul
                  aria-label={`${team.abbr} lines`}
                  className="divide-y divide-border rounded-lg border border-border"
                >
                  {lines.map((line) => (
                    <li key={line.playerId} className="flex min-h-11 items-center gap-2 px-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{line.name}</span>
                      <span className="text-xs text-subtle-foreground">{line.position}</span>
                      {confirming === line.playerId ? (
                        <Button size="sm" variant="destructive" onClick={() => void remove(line.playerId)}>
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${line.name}'s line`}
                          onClick={() => setConfirming(line.playerId)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
