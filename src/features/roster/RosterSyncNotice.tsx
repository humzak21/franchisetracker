import { useMutation } from "convex/react";
import { ClipboardCheck, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ROSTER_STATUS_LABELS } from "@shared/domain";
import { Notice } from "@/components/data/Notice";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";
import { SelectBox } from "@/components/ui/SelectBox";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { useSelection } from "@/lib/hooks/useSelection";

/**
 * What the team's latest roster page changed, until the owner settles it: anyone it took off the
 * team can be put back. Another team with no roster page says its roster is only what screens named.
 */
export function RosterSyncNotice({
  seasonId,
  teamId,
  userTeam,
}: {
  seasonId: Id<"seasons">;
  teamId: Id<"teams">;
  userTeam: boolean;
}) {
  const sync = useQuery(api.players.rosterSync.latest, { seasonId, teamId });
  const settle = useMutation(api.players.rosterSync.settle);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = useMemo(() => sync?.changes ?? [], [sync]);
  const ids = useMemo(() => changes.map((c) => c.entryId), [changes]);
  const selection = useSelection(ids);
  if (sync === undefined) return null;
  if (sync === null) {
    return userTeam ? null : (
      <Notice icon={Eye}>
        Partial: this roster is only who box scores, awards, leaders and drafts have named. A roster page
        fills it in.
      </Notice>
    );
  }
  if (changes.length === 0) return null;

  const finish = async () => {
    setError(null);
    try {
      await settle({ syncId: sync._id, undo: selection.picked });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    }
  };
  const putBack = selection.picked.length;

  return (
    <>
      <Notice icon={ClipboardCheck}>
        The last roster page changed {changes.length} {changes.length === 1 ? "player" : "players"}.{" "}
        <button type="button" className="text-primary underline" onClick={() => setOpen(true)}>
          Review
        </button>
      </Notice>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="What the roster page changed"
        description="Pick anyone it got wrong to put them back. The rest stand."
        footer={
          <div className="space-y-2">
            {error && <p className="text-sm text-loss">{error}</p>}
            <Button variant="primary" className="w-full" onClick={() => void finish()}>
              {putBack > 0 ? `Put back ${putBack}, keep the rest` : "Keep them all"}
            </Button>
          </div>
        }
      >
        <ul className="divide-y divide-border">
          {changes.map((c) => (
            <li key={c.entryId} className="flex min-h-12 items-center gap-3 py-1.5">
              <SelectBox
                checked={selection.has(c.entryId)}
                onChange={() => selection.toggle(c.entryId)}
                label={`Put back ${c.displayName}`}
              />
              <PositionBadge position={c.position} />
              <span className="min-w-0 flex-1 truncate font-medium">{c.displayName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {ROSTER_STATUS_LABELS[c.from]} → {ROSTER_STATUS_LABELS[c.to]}
              </span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
