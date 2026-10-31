import { Link } from "@tanstack/react-router";
import { ArrowRight, Swords } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel, weekPhase } from "@shared/domain";
import { formatRecord, formatSigned } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { RivalryPerformers } from "./RivalryPerformers";
import { TeamHeadToHead } from "./TeamHeadToHead";
import { useQuery } from "@/lib/convex/useQuery";

type HighGame = {
  gameId: string;
  year: number;
  weekKey: Parameters<typeof weekLabel>[0];
  us: number;
  them: number;
};

function HighTile({ label, game }: { label: string; game: HighGame | null }) {
  if (!game) return <Tile label={label} value="—" />;
  return (
    <Link to="/games/$gameId" params={{ gameId: game.gameId }} className="block rounded-xl hover:opacity-90">
      <Tile
        label={label}
        value={`${game.us}-${game.them}`}
        detail={`${game.year} ${weekLabel(game.weekKey)}`}
      />
    </Link>
  );
}

const meetings = (n: number) => `${n} ${n === 1 ? "meeting" : "meetings"}`;

/**
 * One rivalry in full (FEATURES.md 5.6): the all-time line, every meeting, the playoff meetings,
 * the games and runs that stand out, and our best against them.
 */
export function RivalryScreen({ abbr }: { abbr: string }) {
  const data = useQuery(api.league.rivals.get, { teamAbbr: abbr });
  const back = { to: "/league", label: "League" };
  if (data === undefined) {
    return (
      <Page title={abbr} eyebrow="Rivalry" back={back}>
        <Skeleton className="h-64 rounded-xl" />
      </Page>
    );
  }
  const { opponent, record, playoff, highs, games, performers } = data;
  const playoffGames = games.filter((g) => weekPhase(g.weekKey) === "postseason");
  return (
    <Page
      title={`vs ${opponent.name}`}
      eyebrow="Rivalry"
      back={back}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/league/teams/$abbr" params={{ abbr: opponent.abbr.toLowerCase() }}>
            <span className="max-sm:sr-only">Team page</span> <ArrowRight />
          </Link>
        </Button>
      }
    >
      {games.length === 0 ? (
        <EmptyState
          size="page"
          icon={Swords}
          title="They have not met yet"
          description="Every game against them shows up here, with who did the damage."
        />
      ) : (
        <div className="@container space-y-8">
          <div className="flex items-center gap-4">
            <TeamLogo team={opponent} size="xl" />
            <TileStrip className="flex-1">
              <Tile label="All-time" value={formatRecord(record)} accent detail={meetings(games.length)} />
              <Tile
                label="Playoffs"
                value={playoffGames.length > 0 ? formatRecord(playoff) : "—"}
                detail={meetings(playoffGames.length)}
              />
              <Tile label="Streak" value={data.streak ?? "—"} detail="Current" />
              <Tile
                label="Points"
                value={formatSigned(data.pointsFor - data.pointsAgainst)}
                detail={`${data.pointsFor}-${data.pointsAgainst}`}
              />
            </TileStrip>
          </div>

          <Section title="What stands out">
            <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-3">
              <HighTile label="Biggest win" game={highs.bestWin} />
              <HighTile label="Worst loss" game={highs.worstLoss} />
              <HighTile label="Most scored" game={highs.mostScored} />
              <HighTile label="Most allowed" game={highs.mostAllowed} />
              <Tile label="Win run" value={highs.longestWin} detail="Longest" />
              <Tile label="Losing run" value={highs.longestLoss} detail="Longest" />
            </div>
          </Section>

          {performers.length > 0 && (
            <Section title="Our best against them" description="Regular season and playoffs together.">
              <RivalryPerformers performers={performers} />
            </Section>
          )}

          {playoffGames.length > 0 && (
            <Section title="Playoff meetings">
              <TeamHeadToHead headToHead={{ games: playoffGames }} />
            </Section>
          )}

          <Section title="Every meeting" description="Newest first, with the margin of each.">
            <TeamHeadToHead headToHead={{ games }} />
          </Section>
        </div>
      )}
    </Page>
  );
}
