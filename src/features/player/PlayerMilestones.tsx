import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { streakPointLabel } from "@shared/stats";
import { MilestoneTimeline } from "@/components/data/MilestoneTimeline";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

/** Milestones shown before "Show all": a starter raises one most weeks. */
const SHOWN = 10;

/** The player's milestones and marks in order (FEATURES.md 5.4), newest first. */
export function PlayerMilestones({ playerId }: { playerId: Id<"players"> }) {
  const items = useQuery(api.stats.milestones.forPlayer, { playerId });
  const [all, setAll] = useState(false);
  return (
    <Section id="milestones" title="Milestones">
      {items === undefined ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Marks, career highs and big games land here as box scores come in.
        </p>
      ) : (
        <>
          <MilestoneTimeline
            items={(all ? items : items.slice(0, SHOWN)).map((item) => ({
              ...item,
              when: streakPointLabel({ year: item.year, weekKey: item.weekKey ?? undefined }),
            }))}
          />
          {items.length > SHOWN && (
            <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${items.length}`}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}
