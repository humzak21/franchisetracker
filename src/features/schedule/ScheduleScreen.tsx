import { Link } from "@tanstack/react-router";
import { CalendarDays, History, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { PLAYOFF_RESULT_LABELS, weekPhase, type WeekPhase } from "@shared/domain";
import { isPreFranchise } from "@shared/history/nflverse";
import { formatRecord, formatSigned } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { AddGameSheet } from "./AddGameSheet";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleCharts } from "./ScheduleCharts";
import { ScheduleRow, type ScheduleGame } from "./ScheduleRow";
import { useQuery } from "@/lib/convex/useQuery";

type View = "weeks" | "calendar" | "charts";

const VIEWS: { value: View; label: string }[] = [
  { value: "weeks", label: "Weeks" },
  { value: "calendar", label: "Calendar" },
  { value: "charts", label: "Charts" },
];

const PHASES: { phase: WeekPhase; title: string }[] = [
  { phase: "preseason", title: "Preseason" },
  { phase: "regular", title: "Regular season" },
  { phase: "postseason", title: "Postseason" },
];

function Week({ games }: { games: ScheduleGame[] }) {
  const userTeam = useFranchise()?.userTeam;
  if (!userTeam) return null;
  return (
    <ol className="space-y-2">
      {games.map((game) => (
        <li key={game._id}>
          <ScheduleRow game={game} userTeam={userTeam} />
        </li>
      ))}
    </ol>
  );
}

/** Schedule (FEATURES.md 5.2): the season as a week list, on the calendar, or as charts. */
export function ScheduleScreen() {
  const { season } = useSeason();
  const [view, setView] = useLocalStorage<View>("ft.schedule-view", "weeks");
  const active = useFranchise();
  const data = useQuery(api.games.schedule.bySeason, season ? { seasonId: season._id } : "skip");
  const summary = data?.summary;
  const playoffResult = season?.userRecord?.playoffResult;
  const [adding, setAdding] = useState(false);
  // Seasons before the franchise are imported NFL history, without game-by-game schedules.
  const canAdd = !!season && !!active && !isPreFranchise(season.year, active.franchise.startYear);
  const addButton = canAdd && (
    <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
      <Plus /> Add game
    </Button>
  );

  return (
    <Page
      title="Schedule"
      eyebrow={season ? `${season.year} season` : undefined}
      season
      actions={data && data.games.length > 0 ? addButton : undefined}
    >
      {data === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : data.games.length === 0 &&
        season &&
        active &&
        isPreFranchise(season.year, active.franchise.startYear) ? (
        <EmptyState
          size="page"
          icon={History}
          title={`${season.year}: real NFL history`}
          description={`Seasons before the franchise come from nflverse as standings, results and season totals, without game-by-game schedules. ${season.userRecord ? `The ${active.userTeam.name} went ${formatRecord(season.userRecord)}.` : ""}`}
          action={
            <Button asChild variant="outline">
              <Link to="/history">Open history</Link>
            </Button>
          }
        />
      ) : data.games.length === 0 ? (
        <EmptyState
          size="page"
          icon={CalendarDays}
          title={`No games for ${season?.year ?? "this season"} yet`}
          description="Capture a box score to log a game, or add one by hand; the season fills in as you play."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="primary">
                <Link to="/inbox">Capture a game</Link>
              </Button>
              {addButton}
            </div>
          }
        />
      ) : (
        <div className="@container space-y-6">
          {summary && (
            <TileStrip>
              <Tile label="Record" value={formatRecord(summary.regular)} accent detail="Regular season" />
              <Tile
                label="Playoffs"
                value={
                  summary.postseason.w + summary.postseason.l > 0 ? formatRecord(summary.postseason) : "—"
                }
                detail={playoffResult ? PLAYOFF_RESULT_LABELS[playoffResult] : "Not reached yet"}
              />
              <Tile
                label="Points"
                value={formatSigned(summary.pointsFor - summary.pointsAgainst)}
                detail={`${summary.pointsFor} for, ${summary.pointsAgainst} against`}
              />
              <Tile label="Streak" value={summary.streak ?? "—"} detail="Current" />
            </TileStrip>
          )}
          <Segmented aria-label="View" value={view} onChange={setView} options={VIEWS} />
          {view === "weeks" &&
            PHASES.map(({ phase, title }) => {
              const games = data.games.filter((g) => weekPhase(g.weekKey) === phase);
              return games.length === 0 ? null : (
                <Section key={phase} title={title}>
                  <Week games={games} />
                </Section>
              );
            })}
          {view === "calendar" && season && <ScheduleCalendar year={season.year} games={data.games} />}
          {view === "charts" && <ScheduleCharts points={data.points} />}
        </div>
      )}
      {canAdd && season && (
        <AddGameSheet
          open={adding}
          onOpenChange={setAdding}
          seasonId={season._id}
          year={season.year}
          takenWeeks={data?.games.map((g) => g.weekKey) ?? []}
        />
      )}
    </Page>
  );
}
