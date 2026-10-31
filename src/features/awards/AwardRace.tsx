import { Flag, Info } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AWARD_INFO } from "@shared/domain";
import { formatStat } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { RankedList } from "@/components/data/RankedList";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

const points = (value: number) => formatStat("fantasyPts", value);

/**
 * The awards race (FEATURES.md 5.8): who leads MVP, OPOY, DPOY and OROY on the numbers so far, the
 * user's best always among them. Madden picks the real winners on its own awards screen.
 */
export function AwardRace({ seasonId }: { seasonId: Id<"seasons"> }) {
  const race = useQuery(api.awards.race.bySeason, { seasonId });
  if (race === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (race.every((award) => award.rows.length === 0)) {
    return (
      <EmptyState
        icon={Flag}
        title="No race yet"
        description="Box scores bring in our players; season stats and league leaders screens bring in everyone else."
      />
    );
  }
  const partial = race.some((award) => award.rows.some((r) => r.partial));
  return (
    <div className="space-y-4">
      <Notice icon={Info}>
        Fantasy points on offense, and sacks and takeaways weighted on defense. Madden picks the real winners.
        {partial && " A player marked * is known only from the league leaders, so their total runs low."}
      </Notice>
      <div className="grid gap-3 @desktop:grid-cols-2">
        {race.map(({ type, rows }) => (
          <RankedList
            key={type}
            title={AWARD_INFO[type].label}
            label={`${AWARD_INFO[type].label} race`}
            items={rows.map((r) => ({
              key: r.player._id,
              rank: r.rank,
              name: r.player.displayName,
              playerId: r.player._id,
              nameEnd: (
                <span className="text-xs text-subtle-foreground">
                  {[r.team?.abbr, r.player.position].filter(Boolean).join(" ")}
                  {r.partial && " *"}
                </span>
              ),
              detail: [r.statLine, r.behind > 0 ? `${points(r.behind)} behind` : null]
                .filter(Boolean)
                .join(" · "),
              value: points(r.value),
              marked: r.isUser,
            }))}
          />
        ))}
      </div>
    </div>
  );
}
