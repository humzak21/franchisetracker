import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

/**
 * Deletes an inactive franchise and everything in it, after the owner types its name. Nightly
 * backups keep it restorable for two weeks.
 */
export function DeleteFranchise({ franchiseId, name }: { franchiseId: Id<"franchises">; name: string }) {
  const remove = useMutation(api.franchise.remove.remove);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    try {
      await remove({ franchiseId, confirmName: typed });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Could not delete the franchise."));
    }
  };

  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${name}`} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setTyped("");
          setError(null);
        }}
      >
        <DialogContent
          title={`Delete ${name}?`}
          description="Every season, game, player and note in it goes. Last night's backup can still restore it for two weeks."
        >
          <form
            className="space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <label className="block space-y-1.5 text-sm">
              <span>Type the franchise&apos;s name to confirm</span>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={name}
                autoComplete="off"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-loss">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={typed.trim() !== name}>
                Delete franchise
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
