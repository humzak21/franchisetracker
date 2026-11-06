import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { seasonInProgress } from "@shared/stats";
import {
  formatTeamSeasonStat,
  TEAM_SEASON_GROUPS,
  TEAM_SEASON_STATS,
} from "@shared/stats/teamSeasonRegistry";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { SeasonStatCard } from "@/components/data/SeasonStatCard";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { sourceNote } from "./teamSourceNote";

/**
 * Team stats (FEATURES.md 5.5): every team stat as a card, grouped by side of the ball, with the
 * season's value (derived from the games' team stats unless the season screen was captured), its
 * league rank where captured, and a bar for every other season beside it.
 */
export function TeamRanks() {
  const { season } = useSeason();
  const active = useFranchise();
  const trends = useQuery(api.league.teamStats.trends, {});
  if (trends === undefined || !season) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!trends.some((t) => t.points.some((p) => p.year === season.year))) {
    return (
      <EmptyState
        icon={BarChart3}
        title={`No team stats for ${season.year}`}
        description="Import each game's team stats and the season figures add up here; capture the season team stats screen for league ranks."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to="/inbox">Capture team stats</Link>
          </Button>
        }
      />
    );
  }
  const note = sourceNote(trends, season.year, season.teamTotals?.games ?? 0);
  const record = season.userRecord;
  const played = (record?.w ?? 0) + (record?.l ?? 0) + (record?.t ?? 0);
  const live = seasonInProgress(season.status, played, active?.franchise.settings.gamesPerSeason ?? 17);
  return (
    <div className="space-y-8">
      {TEAM_SEASON_GROUPS.map((group) => {
        const stats = trends.filter((t) => TEAM_SEASON_STATS[t.statKey].group === group.key);
        if (stats.length === 0) return null;
        return (
          <Section key={group.key} title={group.label}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
              {stats.map(({ statKey, points }) => (
                <SeasonStatCard
                  key={statKey}
                  label={TEAM_SEASON_STATS[statKey].label}
                  points={points}
                  year={season.year}
                  better={TEAM_SEASON_STATS[statKey].better}
                  format={(value) => formatTeamSeasonStat(statKey, value)}
                  partial={live && TEAM_SEASON_STATS[statKey].total}
                />
              ))}
            </div>
          </Section>
        );
      })}
      {note && <p className="text-xs text-subtle-foreground">{note}</p>}
    </div>
  );
}
