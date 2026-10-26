import { useMutation } from "convex/react";
import { ArrowLeftRight, ClipboardList } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import type { Need } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

function Choice({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * Resolves a need with the move that filled it: one of the user team's transactions or draft
 * picks from that offseason, or a note when it was handled some other way.
 */
export function ResolveSheet({
  seasonId,
  need,
  onOpenChange,
}: {
  seasonId: Id<"seasons">;
  need: Need | null;
  onOpenChange: (open: boolean) => void;
}) {
  const candidates = useQuery(api.seasons.needs.candidates, need ? { seasonId } : "skip");
  const resolve = useMutation(api.seasons.needs.resolve);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (by: Parameters<typeof resolve>[0]["by"]) => {
    if (!need) return;
    setError(null);
    try {
      await resolve({ seasonId, key: need.key, by });
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not resolved. Try again."));
    }
  };

  const empty = candidates && candidates.transactions.length === 0 && candidates.draftPicks.length === 0;

  return (
    <BottomSheet
      open={need !== null}
      onOpenChange={onOpenChange}
      title={need ? `Resolve ${need.position}` : "Resolve"}
      description={need?.note ?? "Link the move that filled it, or note how it was handled."}
    >
      <div className="space-y-4">
        {candidates === undefined ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : empty ? (
          <p className="text-sm text-muted-foreground">
            No transactions or draft picks logged for this offseason yet. Note how it was handled instead.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {candidates.draftPicks.map((pick) => (
              <Choice
                key={pick._id}
                icon={<ClipboardList className="size-4" />}
                label={pick.label}
                detail={pick.notes}
                onClick={() => void run({ kind: "draftPick", draftPickId: pick._id })}
              />
            ))}
            {candidates.transactions.map((tx) => (
              <Choice
                key={tx._id}
                icon={<ArrowLeftRight className="size-4" />}
                label={tx.label}
                detail={tx.notes}
                onClick={() => void run({ kind: "transaction", transactionId: tx._id })}
              />
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ kind: "note", note: note || undefined });
          }}
        >
          <Input
            aria-label="How it was resolved"
            placeholder="How it was handled (optional)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" variant="primary">
            Resolve
          </Button>
        </form>
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
    </BottomSheet>
  );
}
