import { useQuery } from "convex/react";
import { ClipboardList } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/ui/misc";
import { GradeBadge } from "./GradeBadge";

/** Every class the user team drafted (FEATURES.md 5.9), newest first, with its first pick and grade. */
export function ClassesView({ onOpen }: { onOpen: (year: number) => void }) {
  const classes = useQuery(api.draft.draft.history, {});
  if (classes === undefined) return <Skeleton className="h-48 rounded-xl" />;
  if (classes.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No draft classes yet"
        description="Each draft you capture or import shows up here."
      />
    );
  }
  return (
    <ul className="@container grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
      {classes.map((c) => (
        <li key={c.year}>
          <button
            type="button"
            onClick={() => onOpen(c.year)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:bg-surface-2"
          >
            <span className="num font-display text-2xl font-bold">{c.year}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.firstPick.name}</span>
              <span className="num block text-xs text-muted-foreground">
                Rd {c.firstPick.round}, #{c.firstPick.overall} · {c.picks} pick{c.picks === 1 ? "" : "s"}
              </span>
            </span>
            <GradeBadge grade={c.classGrade} />
          </button>
        </li>
      ))}
    </ul>
  );
}
