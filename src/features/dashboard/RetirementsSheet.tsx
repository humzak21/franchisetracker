import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { SelectBox } from "@/components/ui/SelectBox";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { useSelection } from "@/lib/hooks/useSelection";

/**
 * The yearly retirements step (FEATURES.md 5.3): older players nothing has named this season, on
 * one list. Pick who has retired, or everyone; closing the list keeps the rest playing.
 */
export function RetirementsSheet({
  seasonId,
  open,
  onOpenChange,
}: {
  seasonId: Id<"seasons">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const players = useQuery(api.players.retirements.suggestions, open ? { seasonId } : "skip");
  const decide = useMutation(api.players.retirements.decide);
  const ids = useMemo(() => (players ?? []).map((p) => p.playerId), [players]);
  const selection = useSelection(ids);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = selection.picked.length;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await decide({ seasonId, retire: selection.picked });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Retirements"
      description="Older players nothing has named this season. Each retirement is logged in Transactions, and deleting it there brings them back."
      footer={
        <div className="space-y-2">
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button variant="primary" className="w-full" disabled={busy} onClick={() => void finish()}>
            {count > 0 ? `Retire ${count}, keep the rest` : "Keep them all"}
          </Button>
        </div>
      }
    >
      {players === undefined ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <>
          {players.length > 1 && (
            <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
              <SelectBox checked={selection.state} onChange={selection.toggleAll} label="Pick everyone" />
              Everyone
            </label>
          )}
          <ul className="divide-y divide-border">
            {players.map((p) => (
              <li key={p.playerId} className="flex min-h-12 items-center gap-3 py-1.5">
                <SelectBox
                  checked={selection.has(p.playerId)}
                  onChange={() => selection.toggle(p.playerId)}
                  label={`Retire ${p.displayName}`}
                />
                <PlayerChip
                  size="sm"
                  className="flex-1"
                  player={p}
                  caption={`${p.teamAbbr} · age ${p.age} · OVR ${p.ovr ?? "—"}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}
