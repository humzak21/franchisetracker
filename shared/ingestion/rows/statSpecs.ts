/** Row targets for season numbers: player season stats, league leaders, team season stats, standings. */
import { CATEGORY_PRIMARY } from "../../stats/categories";
import {
  RAW_STATS,
  STAT_CATEGORIES,
  STAT_REGISTRY,
  extractionField,
  type RawStatKey,
  type StatKey,
} from "../../stats/registry";
import { TEAM_SEASON_STATS, TEAM_SEASON_STAT_KEYS } from "../../stats/teamSeasonRegistry";
import { nullable, object, rawKeysInCategory, rowMeta } from "../schema";
import { rows as rowList, type Obj } from "../normalize";
import type { DraftWarning } from "../types";
import { fieldSchema, nameKey } from "./engine";
import type { RowField, RowSpec, RowsDraft } from "./types";

const POSITION: RowField = { key: "position", label: "Position", type: "position" };

const statField = (key: RawStatKey): RowField => ({
  key,
  label: RAW_STATS[key].label,
  type: RAW_STATS[key].format === "half" ? "number" : "int",
});

const GAMES: RowField = { key: "gamesPlayed", label: "Games played", type: "int", primary: true };
const ALL_STATS = (Object.keys(RAW_STATS) as RawStatKey[]).map(statField);
const DEFINING = new Set<string>(Object.values(CATEGORY_PRIMARY).flat());

/** Season stats per position group: Madden splits the screen into the same tabs as a box score. */
export const seasonPlayerStatsSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: (draft) => {
    const present = new Set(draft?.rows.flatMap((r) => Object.keys(r.values)) ?? []);
    const stats = draft ? ALL_STATS.filter((f) => present.has(f.key)) : ALL_STATS;
    return [POSITION, GAMES, ...stats.map((f) => ({ ...f, primary: DEFINING.has(f.key) }))];
  },
  identity: (row) => `${row.teamAbbr ?? "?"}|${nameKey(row.name)}`,
  rowsSchema: () =>
    Object.fromEntries(
      STAT_CATEGORIES.map((category) => {
        const stats = rawKeysInCategory(category).map(statField);
        const row = object({
          name: { type: "string", description: "Player name exactly as printed." },
          team: nullable("string", "The player's team as printed, or null if the screen does not say."),
          position: fieldSchema(POSITION),
          games_played: fieldSchema(GAMES),
          ...Object.fromEntries(stats.map((f) => [extractionField(f.key), fieldSchema(f)])),
          ...rowMeta,
        });
        return [category, { type: "array", items: row }];
      }),
    ),
  readRows: (raw: Obj) => STAT_CATEGORIES.flatMap((category) => rowList(raw[category])),
};

/** The stats Madden's league leaders screen ranks. */
export const LEAGUE_LEADER_STATS = [
  "passYds",
  "passTd",
  "passRating",
  "passCmpPct",
  "rushYds",
  "rushTd",
  "rushAvg",
  "rec",
  "recYds",
  "recTd",
  "scrimmageYds",
  "tackles",
  "sacks",
  "defInt",
  "forcedFumbles",
  "passDeflections",
  "fgm",
  "fgPct",
  "puntAvg",
  "kickReturnYds",
  "puntReturnYds",
] as const satisfies readonly StatKey[];

const ranked = (draft: RowsDraft, key: string, better: "higher" | "lower"): DraftWarning[] => {
  const accepted = draft.rows
    .filter((r) => r.accepted && typeof r.values.rank === "number" && typeof r.values[key] === "number")
    .sort((a, b) => (a.values.rank as number) - (b.values.rank as number));
  for (let i = 1; i < accepted.length; i++) {
    const prev = accepted[i - 1]!.values[key] as number;
    const cur = accepted[i]!.values[key] as number;
    if (better === "higher" ? cur > prev : cur < prev) {
      return [
        {
          path: `rows.${accepted[i]!.id}.values.${key}`,
          message: `Rank ${String(accepted[i]!.values.rank)} has a better value than the rank above it`,
          severity: "warning",
        },
      ];
    }
  }
  return [];
};

export const leagueLeadersSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [
    {
      key: "stat",
      label: "Stat",
      type: "enum",
      required: true,
      hint: "Which stat the board ranks",
      options: LEAGUE_LEADER_STATS.map((k) => ({ value: k, label: STAT_REGISTRY[k].label })),
    },
  ],
  fields: () => [
    { key: "rank", label: "Rank", type: "int", primary: true, required: true },
    { key: "value", label: "Value", type: "number", primary: true, required: true },
  ],
  identity: (row) => `${String(row.values.rank ?? "?")}|${nameKey(row.name)}`,
  rules: (draft) => {
    const stat = draft.meta.stat;
    const better =
      typeof stat === "string" && stat in STAT_REGISTRY ? STAT_REGISTRY[stat as StatKey].better : "higher";
    return ranked(draft, "value", better);
  },
};

export const teamSeasonStatsSpec: RowSpec = {
  player: false,
  rowTeam: false,
  meta: [
    {
      key: "team",
      label: "Team",
      type: "team",
      required: true,
      hint: "The team whose stats the screen shows",
    },
  ],
  fields: () => [
    {
      key: "stat",
      label: "Stat",
      type: "enum",
      primary: true,
      required: true,
      options: TEAM_SEASON_STAT_KEYS.map((k) => ({ value: k, label: TEAM_SEASON_STATS[k].label })),
    },
    { key: "value", label: "Value", type: "number", primary: true, required: true },
    { key: "rank", label: "League rank", type: "int", primary: true, hint: "League rank (1 = best)" },
    { key: "tied", label: "Tied", type: "bool", hint: "True when the rank is shared (T-3rd)" },
  ],
  identity: (row) => String(row.values.stat ?? "?"),
  rules: (draft) =>
    draft.rows.flatMap((r) =>
      r.accepted && typeof r.values.rank === "number" && (r.values.rank < 1 || r.values.rank > 32)
        ? [
            {
              path: `rows.${r.id}.values.rank`,
              message: "Ranks run from 1 to 32",
              severity: "error" as const,
            },
          ]
        : [],
    ),
};

export const standingsSpec: RowSpec = {
  player: false,
  rowTeam: true,
  meta: [],
  fields: () => [
    { key: "w", label: "Wins", type: "int", primary: true, required: true },
    { key: "l", label: "Losses", type: "int", primary: true, required: true },
    { key: "t", label: "Ties", type: "int", primary: true },
    { key: "divisionRank", label: "Division rank", type: "int", hint: "Place in the division, 1 to 4" },
    { key: "seed", label: "Playoff seed", type: "int", hint: "Playoff seed 1 to 7, or null" },
    { key: "pointsFor", label: "Points for", type: "int" },
    { key: "pointsAgainst", label: "Points against", type: "int" },
  ],
  identity: (row) => row.teamAbbr ?? "?",
  rules: (draft) =>
    draft.rows.flatMap((r) => {
      if (!r.accepted) return [];
      const out: DraftWarning[] = [];
      const games = ["w", "l", "t"].reduce(
        (n, k) => n + (typeof r.values[k] === "number" ? (r.values[k] as number) : 0),
        0,
      );
      if (games > 17)
        out.push({
          path: `rows.${r.id}.values.w`,
          message: `${r.teamAbbr}: ${games} games is more than a season`,
          severity: "warning",
        });
      const rank = r.values.divisionRank;
      if (typeof rank === "number" && (rank < 1 || rank > 4)) {
        out.push({
          path: `rows.${r.id}.values.divisionRank`,
          message: "Division ranks run from 1 to 4",
          severity: "error",
        });
      }
      const seed = r.values.seed;
      if (typeof seed === "number" && (seed < 1 || seed > 7)) {
        out.push({ path: `rows.${r.id}.values.seed`, message: "Seeds run from 1 to 7", severity: "error" });
      }
      return out;
    }),
};
