import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GRADE_AFTER_SEASONS } from "@shared/draft/grade";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/misc";
import { GradeBadge } from "./GradeBadge";
import { PickCard } from "./PickCard";
import { useQuery } from "@/lib/convex/useQuery";

/** A season's draft as grouped round cards (FEATURES.md 5.9): the user team's picks, or every pick. */
export function DraftClassView({ seasonId }: { seasonId: Id<"seasons"> }) {
  const data = useQuery(api.draft.draft.bySeason, { seasonId });
  const [who, setWho] = useState<"ours" | "all">("ours");
  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  const picks = data.picks.filter((p) => who === "all" || p.isUser);
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);
  return (
    <div className="@container space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          aria-label="Picks"
          value={who}
          onChange={setWho}
          options={[
            { value: "ours", label: "Our picks", count: data.picks.filter((p) => p.isUser).length },
            { value: "all", label: "Every pick", count: data.picks.length },
          ]}
        />
        {data.classGrade ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            Class grade <GradeBadge grade={data.classGrade} />
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Graded after {GRADE_AFTER_SEASONS} seasons.</span>
        )}
      </div>
      {picks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={`No ${who === "ours" ? "picks of ours" : "picks"} in the ${data.year} draft`}
          description="Capture the draft results screen; real drafts before the franchise import on their own."
        />
      ) : (
        rounds.map((round) => (
          <Section key={round} title={`Round ${round}`}>
            <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
              {picks
                .filter((p) => p.round === round)
                .map((p) => (
                  <li key={p._id}>
                    <PickCard pick={p} />
                  </li>
                ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
