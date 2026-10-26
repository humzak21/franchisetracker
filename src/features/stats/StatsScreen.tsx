import { useSeason } from "@/app/season";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { LeadersBoard } from "./LeadersBoard";
import { RecordsBook } from "./RecordsBook";
import { SeasonStats } from "./SeasonStats";
import { SPLIT_OPTIONS, type Split } from "./split";
import { StreaksBoard } from "./StreaksBoard";

type View = "season" | "records" | "leaders" | "streaks";

const VIEWS: { value: View; label: string }[] = [
  { value: "season", label: "Season" },
  { value: "records", label: "Records" },
  { value: "leaders", label: "Leaders" },
  { value: "streaks", label: "Streaks" },
];

/** Stats (FEATURES.md 5.5): season stats, the records book, all-time leaders and streaks, every number from game logs. */
export function StatsScreen() {
  const { season } = useSeason();
  const [view, setView] = useLocalStorage<View>("ft.stats-view", "season");
  const [split, setSplit] = useLocalStorage<Split>("ft.stats-split", "regular");

  return (
    <Page
      title="Stats"
      eyebrow={view === "season" && season ? `${season.year} season` : "All seasons"}
      season={view === "season"}
    >
      <div className="@container space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented aria-label="View" value={view} onChange={setView} options={VIEWS} />
          {view !== "streaks" && (
            <Segmented
              size="sm"
              aria-label="Split"
              value={split}
              onChange={setSplit}
              options={SPLIT_OPTIONS}
            />
          )}
        </div>
        {view === "season" && <SeasonStats split={split} />}
        {view === "records" && <RecordsBook split={split} />}
        {view === "leaders" && <LeadersBoard split={split} />}
        {view === "streaks" && <StreaksBoard />}
      </div>
    </Page>
  );
}
