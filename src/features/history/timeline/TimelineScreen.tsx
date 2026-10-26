import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  countByKind,
  groupByYear,
  TIMELINE_KIND_LABELS,
  TIMELINE_KINDS,
  type TimelineKind,
} from "@shared/history/timeline";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar } from "@/components/data/FilterBar";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { TimelineItem } from "./TimelineItem";
import { useQuery } from "@/lib/convex/useQuery";

type KindFilter = TimelineKind | "all";
const PAGE = 5;

/**
 * Narrative timeline (FEATURES.md 5.7): every note across games, seasons, transactions, awards
 * and inductions as one story, one column at every width, filtered by season and type.
 */
export function TimelineScreen() {
  const [seasonId, setSeasonId] = useState<Id<"seasons"> | "">("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const data = useQuery(api.history.timeline.list, seasonId ? { seasonId } : { seasonsLimit: limit });
  const counts = useMemo(() => countByKind(data?.entries ?? []), [data]);
  const shown = (data?.entries ?? []).filter((e) => kind === "all" || e.kind === kind);

  return (
    <Page title="Timeline" eyebrow="History" back={{ to: "/history", label: "History" }}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="space-y-3">
          <Select
            aria-label="Season"
            value={seasonId}
            onValueChange={(v) => setSeasonId(v as Id<"seasons"> | "")}
            options={[
              { value: "", label: "All seasons" },
              ...(data?.seasons ?? []).map((s) => ({ value: s._id, label: String(s.year) })),
            ]}
            className="max-w-48"
          />
          <FilterBar
            label="Type"
            variant="chips"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              ...TIMELINE_KINDS.map((k) => ({ value: k, label: TIMELINE_KIND_LABELS[k], count: counts[k] })),
            ]}
          />
        </div>
        {data === undefined ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing here yet"
            description="Game notes, season reports, moves, awards and inductions build the story as you play."
          />
        ) : (
          groupByYear(shown).map((group) => (
            <section key={group.year} aria-label={`${group.year} season`}>
              <h2 className="num sticky top-14 z-10 -mx-4 bg-background/90 px-4 py-2 font-display text-3xl font-bold backdrop-blur @tablet:top-16">
                {group.year}
              </h2>
              <ol className="relative ml-2 space-y-3 border-l border-border pl-5">
                {group.entries.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          ))
        )}
        {data?.hasOlder && !seasonId && (
          <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
            Older seasons
          </Button>
        )}
      </div>
    </Page>
  );
}
