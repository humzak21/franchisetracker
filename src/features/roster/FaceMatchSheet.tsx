import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MatchCandidate } from "@/components/player/MatchCandidate";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";

type Suggestion = FunctionReturnType<typeof api.players.espn.suggest>[number];
export type Unmatched = { playerId: Id<"players">; displayName: string };

/**
 * Bulk ESPN matching from the roster: one suggested athlete per player without a photo, confirm
 * them all at once, or mark a player fictional so the monogram card is intended.
 */
export function FaceMatchSheet({
  players,
  open,
  onOpenChange,
}: {
  players: readonly Unmatched[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const suggest = useAction(api.players.espn.suggest);
  const confirm = useAction(api.players.espn.confirm);
  const setReal = useMutation(api.players.identity.setReal);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setLoading(true);
    setError(null);
    try {
      setSuggestions(await suggest({ playerIds: players.map((p) => p.playerId) }));
    } catch (e) {
      setError(errorMessage(e, "ESPN search failed; try again in a moment"));
    } finally {
      setLoading(false);
    }
  };
  const confirmAll = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const s of suggestions ?? []) {
        if (s.candidate) await confirm({ playerId: s.playerId, espnId: s.candidate.espnId });
      }
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Some matches did not save"));
    } finally {
      setSaving(false);
    }
  };
  const byId = new Map(suggestions?.map((s) => [s.playerId, s.candidate]));
  const found = suggestions?.filter((s) => s.candidate).length ?? 0;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Match faces"
      description={`${players.length} player${players.length === 1 ? "" : "s"} without an ESPN match.`}
      footer={
        suggestions === null ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => void find()}
            disabled={loading || players.length === 0}
          >
            {loading ? "Searching ESPN…" : "Find matches on ESPN"}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => void confirmAll()}
            disabled={saving || found === 0}
          >
            {saving ? "Saving…" : `Confirm ${found} match${found === 1 ? "" : "es"}`}
          </Button>
        )
      }
    >
      {error && <p className="mb-2 text-sm text-loss">{error}</p>}
      <ul className="space-y-2">
        {players.map((p) => {
          const candidate = byId.get(p.playerId);
          return (
            <li key={p.playerId} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{p.displayName}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void setReal({ playerId: p.playerId, isReal: false })}
                >
                  Fictional
                </Button>
              </div>
              {loading ? (
                <Skeleton className="h-14 rounded-xl" />
              ) : candidate ? (
                <MatchCandidate candidate={candidate} />
              ) : (
                suggestions && (
                  <p className="text-xs text-muted-foreground">
                    No exact match on ESPN; try the player page.
                  </p>
                )
              )}
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
