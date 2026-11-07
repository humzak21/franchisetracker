import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { seasonInProgress } from "@shared/stats";
import {
  formatTeamSeasonStat,
  TEAM_SEASON_GROUPS,
  TEAM_SEASON_STAT_KEYS,
  TEAM_SEASON_STATS,
  type TeamSeasonStatKey,
} from "@shared/stats/teamSeasonRegistry";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { SeasonStatCard } from "@/components/data/SeasonStatCard";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { TeamStatSheet } from "./TeamStatSheet";
import { sourceNote } from "./teamSourceNote";

/**
 * Team stats (FEATURES.md 5.5): every team stat as a card, grouped by side of the ball, with the
 * season's value (derived from the games' team stats unless captured or typed in), where it
 * ranked in the league and how it compares with the league average, and a bar for every other
 * season beside it. Each card's seasons can be typed in or corrected.
 */
export function TeamRanks() {
  const { season, seasons } = useSeason();
  const active = useFranchise();
  const trends = useQuery(api.league.teamStats.trends, {});
  const [editing, setEditing] = useState<TeamSeasonStatKey | null>(null);
  if (trends === undefined || !season) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }
  // A season with nothing yet still shows the cards, so earlier seasons stay in view and it can be typed in.
  if (trends.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No team stats yet"
        description="Import each game's team stats and the season figures add up here, ranked against League → Teams."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary" size="sm">
              <Link to="/inbox">Capture team stats</Link>
            </Button>
            <ManualEntryLink target="team_season_stats" seasonId={season._id} label="Type them in" />
          </div>
        }
      />
    );
  }
  const note = sourceNote(trends, season.year, season.teamTotals?.games ?? 0);
  const record = season.userRecord;
  const played = (record?.w ?? 0) + (record?.l ?? 0) + (record?.t ?? 0);
  const live = seasonInProgress(season.status, played, active?.franchise.settings.gamesPerSeason ?? 17);
  const pointsOf = new Map(trends.map((t) => [t.statKey, t.points]));
  return (
    <div className="space-y-8">
      {TEAM_SEASON_GROUPS.map((group) => (
        <Section key={group.key} title={group.label}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
            {TEAM_SEASON_STAT_KEYS.filter((key) => TEAM_SEASON_STATS[key].group === group.key).map(
              (statKey) => (
                <SeasonStatCard
                  key={statKey}
                  label={TEAM_SEASON_STATS[statKey].label}
                  points={pointsOf.get(statKey) ?? []}
                  year={season.year}
                  better={TEAM_SEASON_STATS[statKey].better}
                  format={(value) => formatTeamSeasonStat(statKey, value)}
                  partial={live && TEAM_SEASON_STATS[statKey].total}
                  onEdit={() => setEditing(statKey)}
                />
              ),
            )}
          </div>
        </Section>
      ))}
      {note && <p className="text-xs text-subtle-foreground">{note}</p>}
      <TeamStatSheet
        statKey={editing}
        onClose={() => setEditing(null)}
        points={editing ? (pointsOf.get(editing) ?? []) : []}
        seasons={seasons}
        year={season.year}
      />
    </div>
  );
}
