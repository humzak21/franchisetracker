/**
 * Splits (`docs/STATS-HUB.md` 4.6): a game's facts, each kind of split declared once, and the
 * lines grouped so every group reads like a season row. Worked out on read, since one player's
 * career and the team's games are both bounded.
 */
import { weekPhase, type WeekKey } from "../domain/calendar";
import type { StatLine } from "./registry";
import { summarizeGames, type GamesSummary } from "./season";

export type SplitGame = {
  gameId: string;
  weekKey: WeekKey;
  home: boolean;
  won: boolean;
  lost: boolean;
  /** Points for minus points against. */
  margin: number;
  division: boolean;
  conference: boolean;
  overtime: boolean;
  opponent: string;
};

const ONE_SCORE = 8;
const BLOWOUT = 17;
/** Week 9 and earlier is the first half of a season. */
const FIRST_HALF_LAST_WEEK = 9;

const weekNumber = (week: WeekKey) => Number(/^w(\d+)$/.exec(week)?.[1] ?? 0);
const regular = (g: SplitGame) => weekPhase(g.weekKey) === "regular";

type SplitDef = { key: string; label: string; applies: (game: SplitGame) => boolean };

export const SPLITS = {
  venue: [
    { key: "home", label: "Home", applies: (g) => g.home },
    { key: "away", label: "Away", applies: (g) => !g.home },
  ],
  outcome: [
    { key: "wins", label: "Wins", applies: (g) => g.won },
    { key: "losses", label: "Losses", applies: (g) => g.lost },
  ],
  opponent: [
    { key: "division", label: "Division", applies: (g) => g.division },
    { key: "conference", label: "Conference", applies: (g) => g.conference },
    { key: "nonConference", label: "Non-conference", applies: (g) => !g.conference },
  ],
  margin: [
    { key: "oneScore", label: "One-score games", applies: (g) => Math.abs(g.margin) <= ONE_SCORE },
    { key: "blowout", label: "Blowouts", applies: (g) => Math.abs(g.margin) >= BLOWOUT },
  ],
  phase: [
    {
      key: "firstHalf",
      label: "Weeks 1 to 9",
      applies: (g) => regular(g) && weekNumber(g.weekKey) <= FIRST_HALF_LAST_WEEK,
    },
    {
      key: "secondHalf",
      label: "Week 10 on",
      applies: (g) => regular(g) && weekNumber(g.weekKey) > FIRST_HALF_LAST_WEEK,
    },
    { key: "playoffs", label: "Playoffs", applies: (g) => weekPhase(g.weekKey) === "postseason" },
  ],
  overtime: [{ key: "overtime", label: "Overtime", applies: (g) => g.overtime }],
} as const satisfies Record<string, readonly SplitDef[]>;

export type SplitKind = keyof typeof SPLITS | "byOpponent";

export type SplitGroup = { key: string; label: string; summary: GamesSummary };

const groupOf = (
  lines: readonly { gameId: string; stats: StatLine }[],
  games: ReadonlyMap<string, SplitGame>,
  key: string,
  label: string,
  applies: (game: SplitGame) => boolean,
): SplitGroup | null => {
  const hits = lines.filter((l) => {
    const game = games.get(l.gameId);
    return game !== undefined && applies(game);
  });
  return hits.length > 0 ? { key, label, summary: summarizeGames(hits.map((l) => l.stats)) } : null;
};

/** Lines grouped by a split; groups with no games are left out. */
export function splitLines(
  lines: readonly { gameId: string; stats: StatLine }[],
  games: readonly SplitGame[],
  kind: SplitKind,
): SplitGroup[] {
  const byId = new Map(games.map((g) => [g.gameId, g]));
  const defs: readonly SplitDef[] =
    kind === "byOpponent"
      ? [...new Set(games.map((g) => g.opponent))].map((opponent) => ({
          key: opponent,
          label: opponent,
          applies: (g: SplitGame) => g.opponent === opponent,
        }))
      : SPLITS[kind];
  return defs.flatMap((d) => groupOf(lines, byId, d.key, d.label, d.applies) ?? []);
}
