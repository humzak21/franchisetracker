import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { TRANSACTION_LABELS, type TransactionType } from "@shared/domain";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar } from "@/components/data/FilterBar";
import { MoveCard } from "./MoveCard";
import type { Move } from "./types";

/** The season's transaction log as a feed (FEATURES.md 5.10), filtered by type with chips. */
export function MovesFeed({ moves }: { moves: Move[] }) {
  const [type, setType] = useState<TransactionType | "all">("all");
  const types = [...new Set(moves.map((m) => m.type))];
  const shown = moves.filter((m) => type === "all" || m.type === type);
  if (moves.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No moves logged"
        description="Capture the transactions screen and every signing, release and trade lands here."
      />
    );
  }
  return (
    <div className="@container space-y-4">
      <FilterBar
        label="Type"
        variant="chips"
        value={type}
        onChange={setType}
        options={[
          { value: "all", label: "All", count: moves.length },
          ...types.map((t) => ({
            value: t,
            label: TRANSACTION_LABELS[t],
            count: moves.filter((m) => m.type === t).length,
          })),
        ]}
      />
      <ul className="grid gap-3 @desktop:grid-cols-2">
        {shown.map((m) => (
          <li key={m._id}>
            <MoveCard move={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}
