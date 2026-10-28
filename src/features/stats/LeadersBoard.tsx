import { Link } from "@tanstack/react-router";
import { ListOrdered } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  formatStat,
  isStatKey,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  type StatCategory,
} from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { byRegistryOrder, type Split } from "./split";
import { useQuery } from "@/lib/convex/useQuery";

/** All-time leaders (FEATURES.md 5.5): the franchise era's career top twenty per stat, as ranked lists. */
export function LeadersBoard({ split }: { split: Split }) {
  const leaders = useQuery(api.stats.records.leaders, { split });
  const [picked, setPicked] = useState<StatCategory>("passing");

  if (leaders === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (leaders.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No leaders yet"
        description="Career leaders build up from committed box scores."
      />
    );
  }
  const categoryOf = (key: string) => (isStatKey(key) ? STAT_REGISTRY[key].category : null);
  const categories = STAT_CATEGORIES.filter((c) => leaders.some((l) => categoryOf(l.statKey) === c));
  const category = categories.includes(picked) ? picked : (categories[0] ?? "passing");

  return (
    <div className="space-y-4">
      <div data-swipe-ignore className="-mx-1 scrollbar-none overflow-x-auto px-1">
        <Segmented
          size="sm"
          aria-label="Category"
          value={category}
          onChange={setPicked}
          options={categories.map((c) => ({ value: c, label: STAT_CATEGORY_LABELS[c] }))}
        />
      </div>
      <div className="@container grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
        {leaders
          .filter((l) => categoryOf(l.statKey) === category)
          .sort(byRegistryOrder)
          .map((board) => (
            <section
              key={board._id}
              className="rounded-xl border border-border bg-surface"
              aria-label={`${isStatKey(board.statKey) ? STAT_REGISTRY[board.statKey].label : board.statKey} leaders`}
            >
              <h4 className="border-b border-border px-4 py-2.5 text-sm font-medium">
                {isStatKey(board.statKey) ? STAT_REGISTRY[board.statKey].label : board.statKey}
              </h4>
              <ol className="divide-y divide-border">
                {board.top.map((entry, i) => (
                  <li key={entry.player.playerId} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
                    <span
                      className={cn(
                        "num w-5 text-right font-display text-lg font-bold",
                        i === 0 ? "text-primary" : "text-subtle-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: entry.player.playerId }}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {entry.player.name}
                      <span className="ml-1.5 text-xs text-subtle-foreground">{entry.player.position}</span>
                    </Link>
                    <span className="num text-sm font-semibold">
                      {isStatKey(board.statKey) ? formatStat(board.statKey, entry.value) : entry.value}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </div>
    </div>
  );
}
