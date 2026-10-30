import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Position } from "@shared/domain";
import { leadStats } from "@shared/stats";
import { useSeason } from "@/app/season";
import { CareerCurves } from "@/components/player/CareerCurves";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { TeamCurves } from "./TeamCurves";

const TEAM = "team";

function PlayerTrends({ playerId, position }: { playerId: Id<"players">; position: Position | undefined }) {
  const data = useQuery(api.stats.trends.player, { playerId });
  if (data === undefined) return <Skeleton className="h-72 rounded-xl" />;
  return <CareerCurves key={playerId} data={data} initialStat={position && leadStats(position)[0]} />;
}

/** Stats across seasons (STATS-HUB.md 3): the team, or anyone on the current roster. */
export function TrendsView() {
  const { season } = useSeason();
  const roster = useQuery(api.players.roster.bySeason, season ? { seasonId: season._id } : "skip");
  const [subject, setSubject] = useState(TEAM);
  const options = [
    { value: TEAM, label: "The team" },
    ...(roster?.entries ?? [])
      .map((e) => ({ value: e.player._id as string, label: e.player.displayName, group: "Roster" }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  return (
    <div className="space-y-5">
      <Select
        className="w-64 max-w-full"
        aria-label="Show trends for"
        value={subject}
        onValueChange={setSubject}
        options={options}
      />
      {subject === TEAM ? (
        <TeamCurves />
      ) : (
        <PlayerTrends
          playerId={subject as Id<"players">}
          position={roster?.entries.find((e) => e.player._id === subject)?.entry.position}
        />
      )}
    </div>
  );
}
