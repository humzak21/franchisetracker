import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSeason } from "@/app/season";
import { Page } from "@/components/layout/Page";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/misc";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { AllTimeView } from "./AllTimeView";
import { ChampionsView } from "./ChampionsView";
import { PlayoffsView } from "./PlayoffsView";
import { StandingsView } from "./StandingsView";

type View = "standings" | "playoffs" | "champions" | "table";

const VIEWS: { value: View; label: string }[] = [
  { value: "standings", label: "Standings" },
  { value: "playoffs", label: "Playoffs" },
  { value: "champions", label: "Champions" },
  { value: "table", label: "All-time" },
];

const SCOPES = [
  { value: "franchise", label: "Franchise" },
  { value: "all", label: "With real history" },
] as const;

/**
 * League (FEATURES.md 5.6): a season's standings and bracket, every season's champions ("who won
 * the AFC in 2029"), and the all-time table over the franchise or every season.
 */
export function LeagueScreen() {
  const { season } = useSeason();
  const [view, setView] = useLocalStorage<View>("ft.league-view", "standings");
  const [scope, setScope] = useLocalStorage<"franchise" | "all">("ft.league-scope", "franchise");
  const seasonal = view === "standings" || view === "playoffs";
  const overview = useQuery(
    api.league.standings.overview,
    seasonal ? "skip" : { includeHistory: scope === "all" },
  );

  return (
    <Page
      title="League"
      eyebrow={seasonal && season ? `${season.year} season` : "Every season"}
      season={seasonal}
    >
      <div className="@container space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented aria-label="View" value={view} onChange={setView} options={VIEWS} />
          {view === "table" && (
            <Segmented size="sm" aria-label="Seasons" value={scope} onChange={setScope} options={SCOPES} />
          )}
        </div>
        {seasonal && !season && <Skeleton className="h-80 rounded-xl" />}
        {view === "standings" && season && <StandingsView seasonId={season._id} />}
        {view === "playoffs" && season && <PlayoffsView seasonId={season._id} />}
        {!seasonal &&
          (overview === undefined ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : view === "champions" ? (
            <ChampionsView overview={overview} />
          ) : (
            <AllTimeView overview={overview} />
          ))}
      </div>
    </Page>
  );
}
