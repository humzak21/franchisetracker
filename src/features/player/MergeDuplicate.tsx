import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PlayerChip } from "@/components/player/PlayerChip";
import { SeenIn } from "@/components/player/SeenIn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

type Hit = { playerId: Id<"players">; displayName: string; position: string };

/** Finds another entry for the same person, suggested or searched for, and folds it into this player. */
export function MergeDuplicate({ playerId, name }: { playerId: Id<"players">; name: string }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Hit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hits = useQuery(api.players.directory.search, text.trim().length >= 2 ? { text } : "skip");
  const suggested = useQuery(api.players.identity.duplicatesOf, { playerId });
  const seen = useQuery(api.players.identity.seenIn, picked ? { playerId: picked.playerId } : "skip");
  const merge = useMutation(api.players.identity.merge);

  const confirm = async () => {
    if (!picked) return;
    setError(null);
    try {
      await merge({ sourceId: picked.playerId, targetId: playerId });
      setPicked(null);
      setText("");
    } catch (e) {
      setError(errorMessage(e, "Could not merge these players"));
    }
  };

  return (
    <div className="space-y-2">
      {(suggested ?? []).length > 0 && (
        <ul className="space-y-1" aria-label="Likely duplicates">
          {suggested?.map((s) => (
            <li key={s.playerId} className="flex items-center justify-between gap-2">
              <PlayerChip
                size="sm"
                player={{ displayName: s.displayName, position: s.position, headshotUrl: null }}
                caption={s.imported ? "NFL history" : "Looks like the same player"}
              />
              <Button size="sm" variant="outline" onClick={() => setPicked(s)}>
                Merge in
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search for a duplicate of this player"
        aria-label="Search for a duplicate"
      />
      {error && <p className="text-sm text-loss">{error}</p>}
      <ul className="space-y-1">
        {(hits ?? [])
          .filter((h) => h.playerId !== playerId)
          .slice(0, 6)
          .map((h) => (
            <li key={h.playerId} className="flex items-center justify-between gap-2">
              <PlayerChip
                size="sm"
                player={{ displayName: h.displayName, position: h.position, headshotUrl: h.headshotUrl }}
                caption={h.firstYear ? `${h.firstYear}–${h.lastYear}` : "No stats"}
              />
              <Button size="sm" variant="outline" onClick={() => setPicked(h)}>
                Merge in
              </Button>
            </li>
          ))}
      </ul>
      <Dialog open={picked !== null} onOpenChange={(open) => !open && setPicked(null)}>
        <DialogContent
          title="Merge players"
          description={`Every game, season and award of ${picked?.displayName ?? ""} moves to ${name}, and ${picked?.displayName ?? ""} is removed. This cannot be undone.`}
        >
          {seen && (
            <div className="px-5">
              <SeenIn seen={seen} />
            </div>
          )}
          <div className="flex justify-end gap-2 p-5">
            <Button variant="ghost" onClick={() => setPicked(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()}>
              Merge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
