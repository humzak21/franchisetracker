import { ManualEntryLink } from "@/components/forms/ManualEntryLink";

/**
 * Manual counterparts of the stats screenshots: a league leaders board, a team's season stats,
 * every team's league team stats, and season totals, each typed in for the season on screen.
 */
export function ManualStatsLinks({ seasonId }: { seasonId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ManualEntryLink target="league_leaders" seasonId={seasonId} label="Enter leaders" />
      <ManualEntryLink target="team_season_stats" seasonId={seasonId} label="Enter team stats" />
      <ManualEntryLink target="league_team_stats" seasonId={seasonId} label="Enter league team stats" />
      <ManualEntryLink target="season_player_stats" seasonId={seasonId} label="Enter season stats" />
    </div>
  );
}
