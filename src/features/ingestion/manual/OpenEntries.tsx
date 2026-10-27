import { Link } from "@tanstack/react-router";
import { ChevronRight, PencilLine } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { Section } from "@/components/layout/Section";
import { useQuery } from "@/lib/convex/useQuery";

/** Manual entries started and not committed, so one begun on the phone can be finished on the Mac. */
export function OpenEntries() {
  const open = useQuery(api.ingestion.manual.listOpen, {});
  if (!open || open.length === 0) return null;
  return (
    <Section title="Entering manually" description="Started and not committed yet">
      <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3" aria-label="Manual entries">
        {open.map((entry) => {
          const target = INGESTION_TARGETS[entry.targetKey];
          const week = entry.weekKey && target.scope !== "season" ? weekLabel(entry.weekKey, "long") : null;
          return (
            <li key={entry._id}>
              <Link
                to="/inbox/manual/$draftId"
                params={{ draftId: entry._id }}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-3 hover:bg-surface-2"
              >
                <PencilLine className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{target.label}</span>
                  <span className="num block truncate text-xs text-muted-foreground">
                    {[entry.year, week].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
