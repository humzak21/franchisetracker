import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { useDeleteFranchise } from "@/app/franchise";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

type Step = "closed" | "sure" | "type";

/** What happens after deleting: the active franchise hands over, or setup starts again. */
function aftermath(isActive: boolean, lastOne: boolean): string {
  if (!isActive) return "";
  return lastOne
    ? " It is your only franchise, so you will start a new one."
    : " It is the active franchise; the one you used before it takes over.";
}

/**
 * Deletes a franchise and everything in it, active or not, after two confirmations: an "are you
 * sure", then typing its name. Nightly backups keep it restorable for two weeks.
 */
export function DeleteFranchise({
  franchiseId,
  name,
  isActive,
  lastOne,
}: {
  franchiseId: Id<"franchises">;
  name: string;
  isActive: boolean;
  /** No other franchise would be left. */
  lastOne: boolean;
}) {
  const remove = useDeleteFranchise();
  const [step, setStep] = useState<Step>("closed");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    setStep("closed");
    setTyped("");
    setError(null);
  };

  const confirm = async () => {
    setError(null);
    setDeleting(true);
    try {
      await remove(franchiseId, typed);
      close();
    } catch (err) {
      setError(errorMessage(err, "Could not delete the franchise."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${name}`} onClick={() => setStep("sure")}>
        <Trash2 />
      </Button>
      <Dialog open={step === "sure"} onOpenChange={(open) => !open && close()}>
        <DialogContent
          title={`Delete ${name}?`}
          description={`Are you sure? Every season, game, player, report and goal in it goes.${aftermath(isActive, lastOne)}`}
        >
          <div className="flex justify-end gap-2 p-5">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => setStep("type")}>
              Yes, delete it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={step === "type"} onOpenChange={(open) => !open && close()}>
        <DialogContent
          title={`Type ${name} to confirm`}
          description="This cannot be undone here. Last night's backup can still restore it for two weeks."
        >
          <form
            className="space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <label className="block space-y-1.5 text-sm">
              <span>Franchise name</span>
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
              <Button type="submit" variant="destructive" disabled={deleting || typed.trim() !== name}>
                {deleting ? "Deleting…" : "Delete franchise"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
