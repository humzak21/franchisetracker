import { Link } from "@tanstack/react-router";
import { ScanSearch } from "lucide-react";
import { useSeason } from "@/app/season";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { LeadersBoard } from "./LeadersBoard";
import { PlayerGoals } from "./PlayerGoals";
import { RecordsBook } from "./RecordsBook";
import { SeasonStats } from "./SeasonStats";
import { SPLIT_OPTIONS, type Split } from "./split";
import { StreaksBoard } from "./StreaksBoard";
import { TeamRanks } from "./TeamRanks";

type View = "season" | "team" | "records" | "leaders" | "streaks";

const VIEWS: { value: View; label: string }[] = [
  { value: "season", label: "Season" },
  { value: "team", label: "Team" },
  { value: "records", label: "Records" },
  { value: "leaders", label: "Leaders" },
  { value: "streaks", label: "Streaks" },
];

/**
 * Stats (FEATURES.md 5.5): season stats, team ranks, the records book, all-time leaders and streaks.
 * Player numbers come from game logs; team ranks from the captured team stats screen.
 */
export function StatsScreen() {
  const { season } = useSeason();
  const [view, setView] = useLocalStorage<View>("ft.stats-view", "season");
  const [split, setSplit] = useLocalStorage<Split>("ft.stats-split", "regular");
  const seasonal = view === "season" || view === "team";

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
          <Segmented aria-label="View" value={view} onChange={setView} options={VIEWS} />
          {view !== "streaks" && view !== "team" && (
            <Segmented
              size="sm"
              aria-label="Split"
              value={split}
              onChange={setSplit}
              options={SPLIT_OPTIONS}
            />
          )}
        </div>
        {view === "season" && season && <PlayerGoals seasonId={season._id} />}
        {view === "season" && <SeasonStats split={split} />}
        {view === "team" && <TeamRanks />}
        {view === "records" && <RecordsBook split={split} />}
        {view === "leaders" && <LeadersBoard split={split} />}
        {view === "streaks" && <StreaksBoard />}
      </div>
    </Page>
  );
}
