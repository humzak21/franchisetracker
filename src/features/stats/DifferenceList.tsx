import { useMutation } from "convex/react";
import { Check, RotateCcw, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SelectionBar } from "@/components/data/SelectionBar";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { useSelection } from "@/lib/hooks/useSelection";
import { ReconcileCard, type Difference } from "./ReconcileCard";

const keyOf = (d: Difference) => `${d.playerId}|${d.stat}`;

/**
 * Differences as cards with a select-all bar, so a season's worth settles in a couple of clicks:
 * pick all (or some), then use the log numbers or flag missing games; settled ones reopen the same way.
 */
export function DifferenceList({
  seasonId,
  differences,
  settled,
}: {
  seasonId: Id<"seasons">;
  differences: Difference[];
  /** The settled list offers Reopen; the open one offers both ways to settle. */
  settled: boolean;
}) {
  const resolve = useMutation(api.stats.reconcile.resolve);
  const keys = useMemo(() => differences.map(keyOf), [differences]);
  const selection = useSelection(keys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settle = async (resolution: "logs" | "missing" | null) => {
    const picked = new Set(selection.picked);
    const items = differences
      .filter((d) => picked.has(keyOf(d)))
      .map((d) => ({ playerId: d.playerId, stat: d.stat }));
    setBusy(true);
    setError(null);
    try {
      await resolve({ seasonId, items, resolution });
      selection.clear();
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <SelectionBar
        count={selection.picked.length}
        total={keys.length}
        state={selection.state}
        onToggleAll={selection.toggleAll}
        onClear={selection.clear}
        noun="difference"
        hint={settled ? "Pick differences to reopen" : "Pick differences to settle together"}
        className="sticky top-14 z-10 @tablet:top-16"
      >
        {settled ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void settle(null)}>
            <RotateCcw /> Reopen
          </Button>
        ) : (
          <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void settle("logs")}>
              <Check /> Use log numbers
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void settle("missing")}>
              <SearchX /> Missing games
            </Button>
          </>
        )}
      </SelectionBar>
      {error && <p className="text-sm text-loss">{error}</p>}
      <ul className="@container grid gap-3 @3xl:grid-cols-2">
        {differences.map((d) => (
          <li key={keyOf(d)}>
            <ReconcileCard
              seasonId={seasonId}
              difference={d}
              selected={selection.has(keyOf(d))}
              onToggle={() => selection.toggle(keyOf(d))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
