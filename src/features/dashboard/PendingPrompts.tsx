import { Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, NotebookPen } from "lucide-react";
import { api } from "@convex/_generated/api";
import { NEED_PRIORITY_LABELS, PROMPT_LABELS } from "@shared/seasons/reports";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Badge } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

const MAX_NEEDS = 5;

/**
 * Pending prompts (FEATURES.md 5.1): reports that are due stay here until filed, however often
 * the banner is dismissed, followed by the open needs of the offseason being played through.
 */
export function PendingPrompts() {
  const pending = useQuery(api.seasons.reports.pending, {});
  if (pending === undefined) return <Skeleton className="h-24 rounded-xl" />;
  const { prompts, needs } = pending;
  if (prompts.length === 0 && needs.length === 0) return null;
  const needYear = needs[0]?.year;

  return (
    <Section title="Pending">
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {prompts.map((p) => (
          <Link
            key={`${p.seasonId}-${p.prompt}`}
            to="/history/reports/$year"
            params={{ year: String(p.year) }}
            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <NotebookPen className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {p.year} {PROMPT_LABELS[p.prompt].title.toLowerCase()} <Badge tone="warn">Due</Badge>
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {PROMPT_LABELS[p.prompt].question}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
          </Link>
        ))}
        {needs.length > 0 && needYear !== undefined && (
          <Link
            to="/history/reports/$year"
            params={{ year: String(needYear) }}
            hash="needs"
            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {needs.length} open offseason {needs.length === 1 ? "need" : "needs"}
              </span>
              <ul className="mt-1.5 space-y-1">
                {needs.slice(0, MAX_NEEDS).map((need) => (
                  <li key={`${need.seasonId}-${need.key}`} className="flex items-center gap-2 text-sm">
                    <PositionBadge position={need.position} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {need.note ?? `${need.position} help`}
                    </span>
                    <span className="text-xs text-subtle-foreground">
                      {NEED_PRIORITY_LABELS[need.priority]}
                    </span>
                  </li>
                ))}
              </ul>
            </span>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
          </Link>
        )}
      </div>
    </Section>
  );
}
