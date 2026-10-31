/**
 * Splits (`docs/STATS-HUB.md` 4.6): a game's facts, each kind of split declared once, and the
 * lines grouped so every group reads like a season row. Worked out on read, since one player's
 * career and the team's games are both bounded.
 */
import { weekPhase, type WeekKey } from "../domain/calendar";
import { REGULATION_QUARTERS, type LineScore } from "../games/lineScore";
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
    { key: "regular", label: "Regular season", applies: regular },
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

/** In the order a split table offers them. */
export const SPLIT_KINDS: readonly SplitKind[] = [
  "phase",
  "venue",
  "outcome",
  "opponent",
  "margin",
  "overtime",
  "byOpponent",
];

export const SPLIT_KIND_LABELS: Record<SplitKind, string> = {
  phase: "Season",
  venue: "Home and away",
  outcome: "Result",
  opponent: "Opponent",
  margin: "Margin",
  overtime: "Overtime",
  byOpponent: "By team",
};

/** A played game from the user's side, as `SplitGame` reads it. */
export function splitGameOf(game: {
  gameId: string;
  weekKey: WeekKey;
  userIsHome: boolean;
  us: number;
  them: number;
  overtime: boolean;
  lineScore: LineScore | null;
  own: { conference: string; division: string };
  opponent: { abbr: string; conference: string; division: string };
}): SplitGame {
  const { own, opponent } = game;
  const conference = own.conference === opponent.conference;
  return {
    gameId: game.gameId,
    weekKey: game.weekKey,
    home: game.userIsHome,
    won: game.us > game.them,
    lost: game.us < game.them,
    margin: game.us - game.them,
    division: conference && own.division === opponent.division,
    conference,
    overtime: game.overtime || (game.lineScore?.home.length ?? 0) > REGULATION_QUARTERS,
    opponent: opponent.abbr,
  };
}

/** Only the phase split reaches the playoffs: every other group is a regular-season number. */
const inKind = (kind: SplitKind, applies: SplitDef["applies"]): SplitDef["applies"] =>
  kind === "phase" ? applies : (g) => regular(g) && applies(g);

const defsOf = (kind: SplitKind, games: readonly SplitGame[]): readonly SplitDef[] => {
  const defs: readonly SplitDef[] =
    kind === "byOpponent"
      ? [...new Set(games.map((g) => g.opponent))].map((opponent) => ({
          key: opponent,
          label: opponent,
          applies: (g: SplitGame) => g.opponent === opponent,
        }))
      : SPLITS[kind];
  return defs.map((d) => ({ ...d, applies: inKind(kind, d.applies) }));
};

/** The prefix of a one-opponent split key: `vs:DAL`. */
const VERSUS = "vs:";
export const versusSplit = (abbr: string) => `${VERSUS}${abbr}`;

/** One split group by key, the test a question's games pass; null for a key that is no group. */
export function splitTest(key: string): SplitDef["applies"] | null {
  if (key.startsWith(VERSUS)) {
    const abbr = key.slice(VERSUS.length);
    return abbr === "" ? null : inKind("byOpponent", (g) => g.opponent === abbr);
  }
  for (const kind of SPLIT_KINDS) {
    if (kind === "byOpponent") continue;
    const def = (SPLITS[kind] as readonly SplitDef[]).find((d) => d.key === key);
    if (def) return inKind(kind, def.applies);
  }
  return null;
}

/** Every split group as one list of choices, grouped by kind; opponents are the caller's to add. */
export const SPLIT_CHOICES: readonly { value: string; label: string; group: string }[] = SPLIT_KINDS.flatMap(
  (kind) =>
    kind === "byOpponent"
      ? []
      : (SPLITS[kind] as readonly SplitDef[]).map((d) => ({
          value: d.key,
          label: d.label,
          group: SPLIT_KIND_LABELS[kind],
        })),
);

/** The label of a split group by key. */
export function splitLabel(key: string) {
  if (key.startsWith(VERSUS)) return `vs ${key.slice(VERSUS.length)}`;
  return SPLIT_CHOICES.find((c) => c.value === key)?.label ?? key;
}

export type SplitGroup = { key: string; label: string; summary: GamesSummary };

/** Lines grouped by a split; groups with no games are left out. */
export function splitLines(
  lines: readonly { gameId: string; stats: StatLine }[],
  games: readonly SplitGame[],
  kind: SplitKind,
): SplitGroup[] {
  const byId = new Map(games.map((g) => [g.gameId, g]));
  return defsOf(kind, games).flatMap((d) => {
    const hits = lines.filter((l) => {
      const game = byId.get(l.gameId);
      return game !== undefined && d.applies(game);
    });
    return hits.length > 0
      ? [{ key: d.key, label: d.label, summary: summarizeGames(hits.map((l) => l.stats)) }]
      : [];
  });
}

/** One team's game: the split facts, the points, and the yards where team stats were captured. */
export type TeamSplitGame = SplitGame & {
  pointsFor: number;
  pointsAgainst: number;
  yards: number | null;
  yardsAllowed: number | null;
};

export type TeamSplitGroup = {
  key: string;
  label: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Per game, over the games with team stats; null with none. */
  yardsPerGame: number | null;
  allowedPerGame: number | null;
};

const perCounted = (values: readonly (number | null)[]) => {
  const known = values.filter((n) => n !== null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : null;
};

/** The team's games grouped by a split; groups with no games are left out. */
export function splitTeamGames(games: readonly TeamSplitGame[], kind: SplitKind): TeamSplitGroup[] {
  return defsOf(kind, games).flatMap((d) => {
    const hits = games.filter(d.applies);
    if (hits.length === 0) return [];
    const wins = hits.filter((g) => g.won).length;
    const losses = hits.filter((g) => g.lost).length;
    return [
      {
        key: d.key,
        label: d.label,
        games: hits.length,
        wins,
        losses,
        ties: hits.length - wins - losses,
        pointsFor: hits.reduce((n, g) => n + g.pointsFor, 0),
        pointsAgainst: hits.reduce((n, g) => n + g.pointsAgainst, 0),
        yardsPerGame: perCounted(hits.map((g) => g.yards)),
        allowedPerGame: perCounted(hits.map((g) => g.yardsAllowed)),
      },
    ];
  });
}

/** Every kind with something to show, each with its groups. */
export function splitSections<G>(groupsOf: (kind: SplitKind) => G[]) {
  return SPLIT_KINDS.flatMap((kind) => {
    const groups = groupsOf(kind);
    return groups.length > 0 ? [{ kind, label: SPLIT_KIND_LABELS[kind], groups }] : [];
  });
}
