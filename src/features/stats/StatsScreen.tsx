import { Link } from "@tanstack/react-router";
import { History, ScanSearch } from "lucide-react";
import { isPreFranchise } from "@shared/history/nflverse";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { Notice } from "@/components/data/Notice";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { LeadersBoard } from "./LeadersBoard";
import { LeagueView } from "./LeagueView";
import { ManualStatsLinks } from "./ManualStatsLinks";
import { Overview } from "./Overview";
import { PlayerGoals } from "./PlayerGoals";
import { RecordsView } from "./RecordsView";
import { SeasonStats } from "./SeasonStats";
import { SPLIT_OPTIONS, type Split } from "./split";
import { StreaksBoard } from "./StreaksBoard";
import { TeamRanks } from "./TeamRanks";
import { TrendsView } from "./TrendsView";
import type { RecordsKind, View } from "./view";

const VIEWS: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "season", label: "Season" },
  { value: "league", label: "League" },
  { value: "team", label: "Team" },
  { value: "trends", label: "Trends" },
  { value: "records", label: "Records" },
  { value: "leaders", label: "Leaders" },
  { value: "streaks", label: "Streaks" },
];

/**
 * Stats (FEATURES.md 5.5): the season's overview, season stats, league stats, team ranks, trends
 * across seasons, the records book, all-time leaders and streaks. Player numbers come from game logs, the rest of the league's from captured
 * season stats screens, team ranks from the captured team stats screen.
 */
export function StatsScreen() {
  const { season } = useSeason();
  const active = useFranchise();
  const [view, setView] = useLocalStorage<View>("ft.stats-view", "overview");
  const [split, setSplit] = useLocalStorage<Split>("ft.stats-split", "regular");
  const [recordsKind, setRecordsKind] = useLocalStorage<RecordsKind>("ft.records-kind", "books");
  const seasonal = view === "overview" || view === "season" || view === "league" || view === "team";
  const preFranchise = season && active && isPreFranchise(season.year, active.franchise.startYear);
  // Marks count the regular season only: a playoff game is not a step towards a season's total.
  const hasSplit = view === "season" || view === "leaders" || (view === "records" && recordsKind !== "marks");

  return (
    <Page
      title="Stats"
      eyebrow={seasonal && season ? `${season.year} season` : "All seasons"}
      season={seasonal}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/stats/reconcile">
            <ScanSearch /> <span className="max-sm:sr-only">Reconcile</span>
          </Link>
        </Button>
      }
    >
      <div className="@container space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            aria-label="View"
            value={view}
            onChange={setView}
            options={VIEWS}
            className="max-w-full scrollbar-none overflow-x-auto"
          />
          {/* League stats are regular-season totals: Madden's season stats screen has no playoff tab. */}
          {hasSplit && (
            <Segmented
              size="sm"
              aria-label="Split"
              value={split}
              onChange={setSplit}
              options={SPLIT_OPTIONS}
            />
          )}
        </div>
        {preFranchise && (view === "overview" || view === "season") && (
          <Notice icon={History}>
            {season.year} is real NFL history: season totals for the {active.userTeam.name} imported from
            nflverse. Records, leaders and streaks count only the seasons you play.
          </Notice>
        )}
        {view === "overview" && <Overview onOpen={setView} />}
        {view === "season" && season && <PlayerGoals seasonId={season._id} />}
        {view === "season" && <SeasonStats split={split} />}
        {view === "league" && <LeagueView />}
        {view === "team" && <TeamRanks />}
        {view === "trends" && <TrendsView />}
        {seasonal && season && <ManualStatsLinks seasonId={season._id} />}
        {view === "records" && <RecordsView kind={recordsKind} onKind={setRecordsKind} split={split} />}
        {view === "leaders" && <LeadersBoard split={split} />}
        {view === "streaks" && <StreaksBoard />}
      </div>
    </Page>
  );
}
