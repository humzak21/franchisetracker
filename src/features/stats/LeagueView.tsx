import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { LeagueLeaders } from "./LeagueLeaders";
import { LeagueStats } from "./LeagueStats";
import { LeagueTeamStats } from "./LeagueTeamStats";

type Side = "players" | "teams" | "leaders";

const SIDES: { value: Side; label: string }[] = [
  { value: "players", label: "Players" },
  { value: "teams", label: "Teams" },
  { value: "leaders", label: "Top 20s" },
];

/** Stats → League (FEATURES.md 5.5): every player's season, every team's, or the leaders screens. */
export function LeagueView() {
  const [side, setSide] = useLocalStorage<Side>("ft.league-side", "players");
  return (
    <div className="space-y-3">
      <Segmented aria-label="League stats for" value={side} onChange={setSide} options={SIDES} />
      {side === "leaders" ? <LeagueLeaders /> : side === "teams" ? <LeagueTeamStats /> : <LeagueStats />}
    </div>
  );
}
