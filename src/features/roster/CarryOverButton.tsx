import { useMutation } from "convex/react";
import { CopyPlus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/**
 * Brings last season's rosters into an empty season. Starting a season does this on its own;
 * this is for a season that started before it did, or one emptied by hand.
 */
export function CarryOverButton({ seasonId, fromYear }: { seasonId: Id<"seasons">; fromYear: number }) {
  const carry = useMutation(api.players.carryOver.fromPreviousSeason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await carry({ seasonId });
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" size="sm" disabled={busy} onClick={() => void run()}>
        <CopyPlus /> Bring over the {fromYear} roster
      </Button>
      {error && <p className="text-sm text-loss">{error}</p>}
    </div>
  );
}
