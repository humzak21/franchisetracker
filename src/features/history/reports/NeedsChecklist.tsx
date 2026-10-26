import { useMutation } from "convex/react";
import { CircleCheck, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { NeedPriority } from "@shared/domain";
import { isNeedOpen, NEED_PRIORITY_LABELS, sortNeeds } from "@shared/seasons/reports";
import { EmptyState } from "@/components/data/EmptyState";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/misc";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { cn } from "@/lib/cn";
import { NeedSheet } from "./NeedSheet";
import { ResolveSheet } from "./ResolveSheet";
import type { Need } from "./types";

const PRIORITY_TONE: Record<NeedPriority, BadgeProps["tone"]> = {
  high: "loss",
  medium: "warn",
  low: "neutral",
};

function NeedRow({
  need,
  resolution,
  onEdit,
  onResolve,
  onReopen,
}: {
  need: Need;
  resolution: string | undefined;
  onEdit: () => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const open = isNeedOpen(need);
  return (
    <SwipeRow
      disabled={!open}
      onAction={onResolve}
      action={
        <>
          <CircleCheck className="size-4" /> Resolve
        </>
      }
    >
      <div className="flex min-h-14 items-center gap-2 border border-border px-3 py-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label={`Edit ${need.position} need`}
        >
          <PositionBadge position={need.position} />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm", !open && "text-muted-foreground line-through")}>
              {need.note ?? `${need.position} help`}
            </span>
            {!open && (
              <span className="block truncate text-xs text-win">
                Resolved{resolution ? ` · ${resolution}` : need.resolvedNote ? ` · ${need.resolvedNote}` : ""}
              </span>
            )}
          </span>
          <Badge tone={open ? PRIORITY_TONE[need.priority] : "neutral"}>
            {NEED_PRIORITY_LABELS[need.priority]}
          </Badge>
        </button>
        {open ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onResolve}
            aria-label={`Resolve ${need.position} need`}
          >
            <CircleCheck />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onReopen}
            aria-label={`Reopen ${need.position} need`}
          >
            <RotateCcw />
          </Button>
        )}
      </div>
    </SwipeRow>
  );
}

/**
 * The offseason needs checklist: open needs first by priority, resolved ones struck through with
 * what resolved them. Swipe a row left (or tap the check) to resolve; tap it to edit.
 */
export function NeedsChecklist({
  seasonId,
  needs,
  resolutions,
}: {
  seasonId: Id<"seasons">;
  needs: readonly Need[];
  resolutions: readonly { key: string; label: string }[];
}) {
  const reopen = useMutation(api.seasons.needs.reopen);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Need | null>(null);
  const [resolving, setResolving] = useState<Need | null>(null);
  const sorted = sortNeeds(needs);

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="No needs listed"
          description="Write down what the roster has to fix; they follow you into the offseason."
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((need) => (
            <li key={need.key}>
              <NeedRow
                need={need}
                resolution={resolutions.find((r) => r.key === need.key)?.label}
                onEdit={() => setEditing(need)}
                onResolve={() => setResolving(need)}
                onReopen={() => void reopen({ seasonId, key: need.key })}
              />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus /> Add need
      </Button>
      <NeedSheet seasonId={seasonId} open={adding} onOpenChange={setAdding} />
      {editing && (
        <NeedSheet
          key={editing.key}
          seasonId={seasonId}
          need={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <ResolveSheet seasonId={seasonId} need={resolving} onOpenChange={(o) => !o && setResolving(null)} />
    </div>
  );
}
