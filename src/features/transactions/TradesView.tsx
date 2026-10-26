import { useMutation } from "convex/react";
import { Handshake } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { MoveCard } from "./MoveCard";
import type { Move } from "./types";

/** The trade tracker (FEATURES.md 5.10): each trade's assets both ways and how it looks in hindsight. */
export function TradesView({ moves }: { moves: Move[] }) {
  const setRetrospective = useMutation(api.transactions.transactions.setRetrospective);
  const trades = moves.filter((m) => m.type === "trade");
  if (trades.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="No trades this season"
        description="Trades from the transactions screen show up here with room for hindsight."
      />
    );
  }
  return (
    <ul className="@container grid gap-3 @desktop:grid-cols-2">
      {trades.map((t) => (
        <li key={t._id}>
          <MoveCard move={t}>
            <NotesEditor
              label="In hindsight"
              rows={3}
              value={t.retrospective}
              placeholder="Who won it? Write it once the dust settles."
              onSave={(text) => setRetrospective({ transactionId: t._id, text })}
            />
          </MoveCard>
        </li>
      ))}
    </ul>
  );
}
