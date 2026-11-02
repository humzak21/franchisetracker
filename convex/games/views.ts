/** Shapes the schedule and game queries return. Kept separate so both queries build them the same way. */
import { weekPoints } from "../../shared/games/insights";
import { starStatLine, teamDefenseName, teamDefenseStatLine } from "../../shared/games/starLine";
import { resultOf, userScore } from "../../shared/games/summary";
import type { StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_LINES_PER_TEAM, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";

export type StarView = {
  playerId: Id<"players"> | null;
  name: string;
  position: string | null;
  headshotUrl: string | null;
  caption: string | null;
  statLine: string | null;
  /** The side the star played for, when known (picked from a box score line or the roster). */
  teamId: Id<"teams"> | null;
  /** The star is the team's whole defense, not a player. */
  teamDefense: boolean;
};

/** Star players, their photo URLs (see `headshotUrls`) and box score lines, resolved once per query. */
export type StarPlayers = {
  players: Map<Id<"players">, Doc<"players">>;
  headshots: Map<Id<"players">, string | null>;
  /** Keyed by `starLineKey`. */
  lines: Map<string, Doc<"gameStatLines">>;
  /** The defenses picked as stars, keyed by `defenseKey`. */
  defenses: Map<string, { name: string; statLine: string | null }>;
};

const starLineKey = (gameId: Id<"games">, playerId: Id<"players">) => `${gameId}|${playerId}`;
const defenseKey = (gameId: Id<"games">, teamId: Id<"teams">) => `${gameId}|${teamId}`;

export function starViews(
  game: Doc<"games">,
  { players, headshots, lines, defenses }: StarPlayers,
): StarView[] {
  return (game.stars ?? []).map((star) => {
    if (star.teamDefense && star.teamId) {
      const defense = defenses.get(defenseKey(game._id, star.teamId));
      return {
        playerId: null,
        name: defense?.name ?? "Unknown defense",
        position: null,
        headshotUrl: null,
        caption: star.caption ?? null,
        statLine: defense?.statLine ?? null,
        teamId: star.teamId,
        teamDefense: true,
      };
    }
    const player = star.playerId ? players.get(star.playerId) : undefined;
    const line = player && lines.get(starLineKey(game._id, player._id));
    return {
      playerId: player?._id ?? null,
      name: player?.displayName ?? star.rawName ?? "Unknown player",
      position: player?.position ?? null,
      headshotUrl: (player && headshots.get(player._id)) ?? null,
      caption: star.caption ?? null,
      statLine: line ? starStatLine(line.position ?? player.position, line.stats as StatLine) : null,
      teamId: star.teamId ?? null,
      teamDefense: false,
    };
  });
}

function starPicks(games: readonly Doc<"games">[]) {
  return games.flatMap((g) =>
    (g.stars ?? []).flatMap((s) => (s.playerId ? [{ gameId: g._id, playerId: s.playerId }] : [])),
  );
}

/** The defenses picked as stars, each with its name and its line added up from the box score. */
async function loadStarDefenses(ctx: QueryCtx, games: readonly Doc<"games">[]) {
  const picks = games.flatMap((g) =>
    (g.stars ?? []).flatMap((s) => (s.teamDefense && s.teamId ? [{ gameId: g._id, teamId: s.teamId }] : [])),
  );
  const found = await Promise.all(
    picks.map(async ({ gameId, teamId }) => {
      const [team, rows] = await Promise.all([
        ctx.db.get("teams", teamId),
        ctx.db
          .query("gameStatLines")
          .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", gameId).eq("teamId", teamId))
          .take(MAX_LINES_PER_TEAM),
      ]);
      return [
        defenseKey(gameId, teamId),
        {
          name: teamDefenseName(team?.abbr ?? "Team"),
          statLine: teamDefenseStatLine(rows.map((row) => row.stats as StatLine)),
        },
      ] as const;
    }),
  );
  return new Map(found);
}

/**
 * The players and defenses picked as stars in these games, with photos and their box score
 * lines for the game they starred in, so each star's numbers come from the box score as it stands.
 */
export async function loadStarPlayers(ctx: QueryCtx, games: readonly Doc<"games">[]): Promise<StarPlayers> {
  const picks = starPicks(games);
  const players = await playersById(
    ctx,
    picks.map((p) => p.playerId),
  );
  const found = await Promise.all(
    picks.map(({ gameId, playerId }) =>
      ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId).eq("playerId", playerId))
        .first(),
    ),
  );
  const lines = new Map(
    found.flatMap((line) => (line ? [[starLineKey(line.gameId, line.playerId), line] as const] : [])),
  );
  return {
    players,
    headshots: await headshotUrls(ctx, players.values()),
    lines,
    defenses: await loadStarDefenses(ctx, games),
  };
}

/** A schedule row: the game from the user team's side with its opponent resolved. */
export function gameRow(game: Doc<"games">, teams: Map<Id<"teams">, Doc<"teams">>, stars: StarPlayers) {
  const score = userScore(game);
  return {
    _id: game._id,
    weekKey: game.weekKey,
    status: game.status,
    result: game.result ?? resultOf(game),
    overtime: game.overtime ?? false,
    userIsHome: game.userIsHome ?? null,
    us: score?.us ?? null,
    them: score?.them ?? null,
    opponent: game.opponentTeamId ? (teams.get(game.opponentTeamId) ?? null) : null,
    opponentRecord: game.opponentRecord ?? null,
    playoffRound: game.playoffRound ?? null,
    dateLabel: game.dateLabel ?? null,
    notes: game.notes ?? null,
    stars: starViews(game, stars),
  };
}

export type GameRow = ReturnType<typeof gameRow>;

/** The season's week points (pulse, margin and streak charts), each with its opponent's abbreviation. */
export function weekPointRows(games: readonly Doc<"games">[], teams: Map<Id<"teams">, Doc<"teams">>) {
  return weekPoints(games).map((point) => {
    const opponentId = games.find((g) => g.weekKey === point.weekKey)?.opponentTeamId;
    return { ...point, opponentAbbr: (opponentId && teams.get(opponentId)?.abbr) ?? null };
  });
}
