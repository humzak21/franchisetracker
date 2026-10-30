/**
 * The franchise's scoring records, folded from every captured scoring play of the user's team
 * (`docs/STATS-HUB.md` 4.10): the longest scores, the clutch ones and the connections. Franchise
 * era only, since plays start with the franchise.
 */
import { weekIndex, weekPhase, type WeekKey } from "../domain/calendar";
import { SCORING_KIND_LABELS, type ScoringKind } from "../domain/scoring";
import type { PlayLike } from "../games/scoringPlay";
import { RECORD_TOP } from "./records";
import { connections, gameFlow, LONGEST_KINDS, touchdownsByPeriod } from "./scoring";

const longest = (kind: ScoringKind) => ({
  label: kind === "fg" ? "Longest field goal" : `Longest ${SCORING_KIND_LABELS[kind].toLowerCase()}`,
  unit: "yd",
  group: "long",
});

/** One entry per list, in the order the records screen shows them. */
export const SCORING_LISTS = {
  longest_pass_td: longest("pass_td"),
  longest_rush_td: longest("rush_td"),
  longest_fg: longest("fg"),
  longest_int_td: longest("int_td"),
  longest_fumble_td: longest("fumble_td"),
  longest_kick_return_td: longest("kick_return_td"),
  longest_punt_return_td: longest("punt_return_td"),
  tds_in_quarter: { label: "Most touchdowns in a quarter", unit: "TD", group: "clutch" },
  game_winners_season: { label: "Game-winning scores in a season", unit: "GW", group: "clutch" },
  game_winners_career: { label: "Game-winning scores, career", unit: "GW", group: "clutch" },
  connection_season: { label: "Touchdowns from one connection, season", unit: "TD", group: "clutch" },
  connection_career: { label: "Touchdowns from one connection, career", unit: "TD", group: "clutch" },
} as const satisfies Record<string, { label: string; unit: string; group: string }>;

export type ScoringListKey = keyof typeof SCORING_LISTS;
export const SCORING_LIST_KEYS = Object.keys(SCORING_LISTS) as ScoringListKey[];

export const SCORING_GROUPS = [
  { key: "long", label: "The longest" },
  { key: "clutch", label: "Clutch and connections" },
] as const;

export type ScoredGame<
  T extends string = string,
  P extends string = string,
  S extends string = string,
  G extends string = string,
> = {
  gameId: G;
  seasonId: S;
  year: number;
  weekKey: WeekKey;
  homeTeamId: T;
  awayTeamId: T;
  plays: readonly PlayLike<T, P>[];
};

export type ScoringEntry<
  T extends string = string,
  P extends string = string,
  S extends string = string,
  G extends string = string,
> = {
  value: number;
  playerId?: P;
  rawName?: string;
  passerId?: P;
  seasonId: S;
  year: number;
  /** The game it happened in; a season or career count has none. */
  gameId?: G;
  weekKey?: WeekKey;
  opponentTeamId?: T;
  /** The quarter of a quarter record. */
  period?: number;
};

export type ScoringSplit = "regular" | "postseason";
export type ScoringBoards<E> = Record<ScoringSplit, Partial<Record<ScoringListKey, E[]>>>;

const splitOf = (week: WeekKey): ScoringSplit | null => {
  const phase = weekPhase(week);
  return phase === "regular" || phase === "postseason" ? phase : null;
};

const best = <E extends { value: number; year: number; weekKey?: WeekKey }>(entries: readonly E[]) =>
  [...entries]
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.year - b.year ||
        (a.weekKey ? weekIndex(a.weekKey) : 0) - (b.weekKey ? weekIndex(b.weekKey) : 0),
    )
    .slice(0, RECORD_TOP);

/** Sums counts under a key, keeping the latest season for the entry. */
function tally<E extends { value: number; year: number }>(entries: readonly (E & { key: string })[]): E[] {
  const byKey = new Map<string, E & { key: string }>();
  for (const entry of entries) {
    const prior = byKey.get(entry.key);
    byKey.set(
      entry.key,
      !prior
        ? entry
        : {
            ...(entry.year >= prior.year ? entry : prior),
            value: prior.value + entry.value,
          },
    );
  }
  return [...byKey.values()].map(({ key: _key, ...entry }) => entry as unknown as E);
}

/** Every board for one split, from that split's games. */
function boardsFor<T extends string, P extends string, S extends string, G extends string>(
  games: readonly ScoredGame<T, P, S, G>[],
  userTeamId: T,
) {
  type Entry = ScoringEntry<T, P, S, G>;
  const lists: Partial<Record<ScoringListKey, Entry[]>> = {};
  const add = (key: ScoringListKey, entry: Entry) => (lists[key] ??= []).push(entry);
  const gameWinners: (Entry & { key: string })[] = [];
  const pairs: (Entry & { key: string })[] = [];

  for (const game of games) {
    const userIsHome = game.homeTeamId === userTeamId;
    const opponentTeamId = userIsHome ? game.awayTeamId : game.homeTeamId;
    const where = {
      seasonId: game.seasonId,
      year: game.year,
      gameId: game.gameId,
      weekKey: game.weekKey,
      opponentTeamId,
    };
    const ours = game.plays.filter((p) => p.teamId === userTeamId);
    const scorer = (p: PlayLike<T, P>) => ({
      ...(p.playerId ? { playerId: p.playerId } : {}),
      ...(p.rawName ? { rawName: p.rawName } : {}),
    });

    for (const kind of LONGEST_KINDS) {
      for (const play of ours) {
        if (play.kind !== kind || !play.yards) continue;
        add(`longest_${kind}`, {
          ...where,
          ...scorer(play),
          ...(play.passerId ? { passerId: play.passerId } : {}),
          value: play.yards,
        });
      }
    }

    const byPlayer = new Map<P, PlayLike<T, P>[]>();
    for (const play of ours) {
      if (play.playerId) byPlayer.set(play.playerId, [...(byPlayer.get(play.playerId) ?? []), play]);
    }
    for (const [playerId, plays] of byPlayer) {
      const counts = [...touchdownsByPeriod(plays).entries()];
      const top = counts.reduce<[number, number] | null>((a, c) => (!a || c[1] > a[1] ? c : a), null);
      if (top) add("tds_in_quarter", { ...where, playerId, value: top[1], period: top[0] });
    }

    const flow = gameFlow(game.plays);
    const won = flow.winner === (userIsHome ? "home" : "away");
    const winner = won ? flow.gameWinner : null;
    if (winner?.playerId) {
      gameWinners.push({
        key: winner.playerId,
        seasonId: game.seasonId,
        year: game.year,
        playerId: winner.playerId,
        value: 1,
      });
    }
    for (const pair of connections(ours)) {
      pairs.push({
        key: `${pair.passerId}|${pair.playerId}`,
        seasonId: game.seasonId,
        year: game.year,
        playerId: pair.playerId,
        passerId: pair.passerId,
        value: pair.touchdowns,
      });
    }
  }

  const perSeason = (entries: readonly (Entry & { key: string })[]) =>
    tally<Entry>(entries.map((e) => ({ ...e, key: `${e.key}|${e.seasonId}` })));
  lists.game_winners_season = perSeason(gameWinners);
  lists.game_winners_career = tally<Entry>(gameWinners);
  lists.connection_season = perSeason(pairs);
  lists.connection_career = tally<Entry>(pairs);
  return Object.fromEntries(
    Object.entries(lists).flatMap(([key, entries]) => (entries.length > 0 ? [[key, best(entries)]] : [])),
  ) as Partial<Record<ScoringListKey, Entry[]>>;
}

/** Every scoring record, regular season and playoffs apart like the rest of the records books. */
export function buildScoringBoards<T extends string, P extends string, S extends string, G extends string>(
  games: readonly ScoredGame<T, P, S, G>[],
  userTeamId: T,
): ScoringBoards<ScoringEntry<T, P, S, G>> {
  return {
    regular: boardsFor(
      games.filter((g) => splitOf(g.weekKey) === "regular"),
      userTeamId,
    ),
    postseason: boardsFor(
      games.filter((g) => splitOf(g.weekKey) === "postseason"),
      userTeamId,
    ),
  };
}

/** A connection reaching one of these is worth a milestone. */
export const CONNECTION_MARKS: readonly number[] = [10, 25, 50, 75, 100];

/** The marks a connection crossed when it went from `before` to `after` touchdowns. */
export const connectionMarksCrossed = (before: number, after: number) =>
  CONNECTION_MARKS.filter((m) => before < m && after >= m);

/** Touchdown keys of a stat line, for telling a first career touchdown. */
export const SCORED_TD_STATS = ["rushTd", "recTd", "defTd", "kickReturnTd", "puntReturnTd"] as const;
