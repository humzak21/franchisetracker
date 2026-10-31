import { Camera, ListOrdered } from "lucide-react";
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
import { useCapture } from "@/app/capture/CaptureProvider";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { RankedList } from "@/components/data/RankedList";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { byRegistryOrder } from "./split";

/** Lists in the "where we rank" summary; every stat's full list sits under it. */
const SHOWN_BEST = 6;

const labelOf = (key: string) => (isStatKey(key) ? STAT_REGISTRY[key].label : key);
const numberOf = (key: string, value: number) => (isStatKey(key) ? formatStat(key, value) : value);

/** Madden's league leaders as captured (FEATURES.md 5.5): the user's players marked, and where we rank. */
export function LeagueLeaders() {
  const { season } = useSeason();
  const data = useQuery(api.league.leaders.forSeason, season ? { seasonId: season._id } : "skip");
  const capture = useCapture();
  const [picked, setPicked] = useState<StatCategory>("passing");
  if (!season || data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (data.rows.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title={`No leaders for ${season.year}`}
        description="Capture Madden's league leaders screens to see the top twenty and where your players rank."
        action={
          <Button size="sm" onClick={() => capture.open({ targetKey: "league_leaders" })}>
            <Camera /> Capture leaders
          </Button>
        }
      />
    );
  }
  const { rows, summary } = data;
  const categoryOf = (key: string) => (isStatKey(key) ? STAT_REGISTRY[key].category : null);
  const categories = STAT_CATEGORIES.filter((c) => rows.some((r) => categoryOf(r.statKey) === c));
  const category = categories.includes(picked) ? picked : (categories[0] ?? "passing");
  const stats = [...new Set(rows.map((r) => r.statKey))]
    .filter((key) => categoryOf(key) === category)
    .map((statKey) => ({ statKey }))
    .sort(byRegistryOrder);

  return (
    <div className="space-y-5">
      <Section title="Where we rank" description={`Our players on the ${season.year} top twenties.`}>
        <div className="space-y-3">
          <TileStrip className="grid-cols-3 @tablet:grid-cols-3">
            <Tile label="Top 20s" value={summary.spots} accent />
            <Tile label="Top 5s" value={summary.topFive} />
            <Tile label="Leaders" value={summary.leaders} />
          </TileStrip>
          {summary.best.length > 0 && (
            <RankedList
              title="Best placed"
              label="Our best placings"
              items={summary.best.slice(0, SHOWN_BEST).map((r) => ({
                key: r.statKey,
                rank: r.rank,
                name: labelOf(r.statKey),
                detail: <span className="truncate">{r.name}</span>,
                value: numberOf(r.statKey, r.value),
              }))}
            />
          )}
        </div>
      </Section>
      <div data-swipe-ignore className="-mx-1 scrollbar-none overflow-x-auto px-1">
        <Segmented
          size="sm"
          aria-label="Category"
          value={category}
          onChange={setPicked}
          options={categories.map((c) => ({ value: c, label: STAT_CATEGORY_LABELS[c] }))}
        />
      </div>
      <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
        {stats.map(({ statKey }) => (
          <RankedList
            key={statKey}
            title={labelOf(statKey)}
            label={`${labelOf(statKey)} league leaders`}
            items={rows
              .filter((r) => r.statKey === statKey)
              .sort((a, b) => a.rank - b.rank)
              .map((r, i) => ({
                key: `${r.rank}-${r.playerId ?? r.name}-${i}`,
                rank: r.rank,
                name: r.name,
                playerId: r.playerId ?? undefined,
                marked: r.ours,
                detail: r.team ? (
                  <>
                    <TeamLogo team={r.team} size="xs" />
                    <span>{r.team.abbr}</span>
                    {r.tied && <span>Tied</span>}
                  </>
                ) : undefined,
                value: numberOf(statKey, r.value),
              }))}
          />
        ))}
      </div>
    </div>
  );
}
