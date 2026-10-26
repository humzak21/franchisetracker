import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NEED_PRIORITIES, POSITION_INFO, POSITIONS, type NeedPriority, type Position } from "@shared/domain";
import { NEED_PRIORITY_LABELS } from "@shared/seasons/reports";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import type { Need } from "./types";

const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: `${p} · ${POSITION_INFO[p].label}` }));
const PRIORITY_OPTIONS = NEED_PRIORITIES.map((p) => ({ value: p, label: NEED_PRIORITY_LABELS[p] }));

/** Adds a need, or edits or removes one (`need` given). Works with the on-screen keyboard. */
export function NeedSheet({
  seasonId,
  need,
  open,
  onOpenChange,
}: {
  seasonId: Id<"seasons">;
  need?: Need;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useMutation(api.seasons.needs.add);
  const update = useMutation(api.seasons.needs.update);
  const remove = useMutation(api.seasons.needs.remove);
  const [position, setPosition] = useState<Position>(need?.position ?? "QB");
  const [priority, setPriority] = useState<NeedPriority>(need?.priority ?? "high");
  const [note, setNote] = useState(need?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (need) await update({ seasonId, key: need.key, position, priority, note });
      else await add({ seasonId, position, priority, note: note || undefined });
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={need ? "Edit need" : "Add a need"}
      description="What the roster has to fix this offseason."
    >
      <form onSubmit={submit} className="space-y-3">
        <Select
          aria-label="Position"
          value={position}
          options={POSITION_OPTIONS}
          onValueChange={(value) => setPosition(value as Position)}
        />
        <Segmented
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
          className="flex w-full"
          aria-label="Priority"
        />
        <Input
          aria-label="Note"
          placeholder="Note (optional): a starter, depth, a type of player"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          {need && (
            <Button
              variant="ghost"
              onClick={() => void remove({ seasonId, key: need.key }).then(() => onOpenChange(false))}
            >
              <Trash2 /> Remove
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto">
            {need ? "Save" : "Add need"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
