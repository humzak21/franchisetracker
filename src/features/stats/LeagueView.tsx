import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { LeagueStats } from "./LeagueStats";
import { LeagueTeamStats } from "./LeagueTeamStats";

type Side = "players" | "teams";

const SIDES: { value: Side; label: string }[] = [
  { value: "players", label: "Players" },
  { value: "teams", label: "Teams" },
];

/** Stats → League (FEATURES.md 5.5): every player's season, or every team's. */
export function LeagueView() {
  const [side, setSide] = useLocalStorage<Side>("ft.league-side", "players");
  return (
    <div className="space-y-3">
      <Segmented aria-label="League stats for" value={side} onChange={setSide} options={SIDES} />
      {side === "teams" ? <LeagueTeamStats /> : <LeagueStats />}
    </div>
  );
}
