import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import type { ActiveFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { GameStars } from "@/components/player/GameStars";
import { ScoreBug, type ScoreBugSide } from "@/components/team/ScoreBug";
import { Button } from "@/components/ui/button";
import type { DashboardGame } from "./types";

const SNIPPET = 160;

/** The most recent result (FEATURES.md 5.1): score bug, stars and the start of the notes. */
export function LastGameCard({ game, active }: { game: DashboardGame | null; active: ActiveFranchise }) {
  if (!game?.opponent || game.us === null || game.them === null) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No result yet"
        description="Capture a box score and the latest game shows up here."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/inbox">Open inbox</Link>
          </Button>
        }
      />
    );
  }
  const us: ScoreBugSide = { team: active.userTeam, score: game.us };
  const them: ScoreBugSide = {
    team: game.opponent,
    score: game.them,
    record: game.opponentRecord ? formatRecord(game.opponentRecord) : undefined,
  };
  const notes = game.notes && game.notes.length > SNIPPET ? `${game.notes.slice(0, SNIPPET)}…` : game.notes;

  return (
    <div className="space-y-3">
      <Link to="/games/$gameId" params={{ gameId: game._id }} className="block rounded-xl hover:opacity-90">
        <ScoreBug
          away={game.userIsHome ? them : us}
          home={game.userIsHome ? us : them}
          status={`Final · ${weekLabel(game.weekKey, "long")}`}
          overtime={game.overtime}
          userTeam={active.userTeam.abbr}
        />
      </Link>
      {game.stars.length > 0 && (
        <GameStars stars={game.stars} team={active.userTeam} opponent={game.opponent} />
      )}
      {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
      <Button asChild variant="ghost" size="sm">
        <Link to="/games/$gameId" params={{ gameId: game._id }}>
          Game detail <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
