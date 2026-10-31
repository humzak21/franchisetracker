import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Check, CheckCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { MILESTONE_ICONS } from "@/components/data/milestoneIcons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

/** Milestones not yet acknowledged, newest first (FEATURES.md 5.1), each a tap away from gone. */
export function MilestoneFeed() {
  const feed = useQuery(api.stats.milestones.feed, {});
  const acknowledge = useMutation(api.stats.milestones.acknowledge);

  if (feed === undefined) return <Skeleton className="h-32 rounded-xl" />;
  if (feed.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        All caught up. Records, career highs and big games show up here as you commit box scores.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {feed.map((m) => {
          const Icon = MILESTONE_ICONS[m.kind];
          const when = [m.year, m.weekKey ? weekLabel(m.weekKey) : null].filter(Boolean).join(" · ");
          return (
            <li key={m._id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elite-1 text-primary">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                {m.gameId ? (
                  <Link
                    to="/games/$gameId"
                    params={{ gameId: m.gameId }}
                    className="text-xs text-muted-foreground hover:underline pointer-coarse:touch-target"
                  >
                    {when}
                  </Link>
                ) : (
                  <div className="text-xs text-muted-foreground">{when}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Acknowledge: ${m.title}`}
                onClick={() => void acknowledge({ milestoneIds: [m._id] })}
              >
                <Check />
              </Button>
            </li>
          );
        })}
      </ul>
      {feed.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void acknowledge({ milestoneIds: feed.map((m) => m._id) })}
        >
          <CheckCheck /> Acknowledge all
        </Button>
      )}
    </div>
  );
}
