import { ListOrdered } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isPreFranchise } from "@shared/history/nflverse";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Section } from "@/components/layout/Section";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { PlayoffsView } from "./PlayoffsView";
import { ScoresView } from "./ScoresView";
import { StandingsLegend } from "./StandingsLegend";
import { StandingsView, type StandingsMode } from "./StandingsView";

const MODES = [
  { value: "divisions", label: "Divisions" },
  { value: "conference", label: "Conference" },
] as const;

const LINKS = [
  { id: "standings", label: "Standings" },
  { id: "scores", label: "Scores" },
  { id: "playoffs", label: "Playoffs" },
];

/**
 * One season on one page (FEATURES.md 5.6): the standings, every week's scores and the playoff
 * bracket, projected from the standings until the regular season is over.
 */
export function SeasonView({ seasonId }: { seasonId: Id<"seasons"> }) {
  const board = useQuery(api.league.board.season, { seasonId });
  const [mode, setMode] = useLocalStorage<StandingsMode>("ft.standings-mode", "divisions");
  const startYear = useFranchise()?.franchise.startYear;
  const { season } = useSeason();
  // Real NFL seasons before the franchise come with their games already.
  const canImport = !!season && startYear !== undefined && !isPreFranchise(season.year, startYear);

  const standings =
    board === undefined ? (
      <Skeleton className="h-80 rounded-xl" />
    ) : board === null ? (
      <EmptyState
        icon={ListOrdered}
        title="No standings for this season yet"
        description="Scores and standings screens fill this in; real NFL seasons import on their own."
      />
    ) : (
      <div className="space-y-3">
        <StandingsLegend final={board.final} />
        <StandingsView board={board} mode={mode} />
      </div>
    );

  return (
    <div className="space-y-8">
      <JumpLinks links={LINKS} />
      <Section
        id="standings"
        title="Standings"
        actions={
          <Segmented size="sm" aria-label="Standings by" value={mode} onChange={setMode} options={MODES} />
        }
      >
        {standings}
      </Section>
      <Section id="scores" title="Scores">
        <ScoresView seasonId={seasonId} canImport={canImport} />
      </Section>
      <Section
        id="playoffs"
        title="Playoffs"
        actions={board && !board.final ? <Badge tone="warn">Projected</Badge> : undefined}
      >
        {board === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : board === null || board.bracket.length === 0 ? (
          <p className="text-sm text-muted-foreground">The bracket appears once the season has standings.</p>
        ) : (
          <PlayoffsView board={board} />
        )}
      </Section>
    </div>
  );
}
