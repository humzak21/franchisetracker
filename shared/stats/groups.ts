/**
 * The season stats screen's position groups (FEATURES.md 5.5): which players each shows, which
 * stat categories become columns, which big-game counts it keeps, and the few columns a phone
 * keeps in the table.
 */
import type { PositionGroup } from "../domain/positions";
import type { StatCategory, StatKey } from "./registry";
import type { GameThresholdKey } from "./thresholds";

export type StatGroup = {
  id: string;
  label: string;
  /** Rows: players whose season position falls in these groups; `null` takes anyone with stats. */
  positions: readonly PositionGroup[] | null;
  categories: readonly StatCategory[];
  /** Kept in the phone table; everything else goes in the tap-to-expand card. */
  phone: readonly StatKey[];
  /** The stat the table sorts by first. */
  lead: StatKey;
  /** Threshold-game counts, always shown (zeros included), in this order. */
  counts: readonly GameThresholdKey[];
};

export const STAT_GROUPS: readonly StatGroup[] = [
  {
    id: "qb",
    label: "QB",
    positions: ["QB"],
    categories: ["passing", "rushing"],
    phone: ["passCmp", "passAtt", "passYds", "passTd", "passInt", "passRating"],
    lead: "passYds",
    counts: ["pass300", "pass3td", "perfectRating", "rush100"],
  },
  {
    id: "rb",
    label: "RB",
    positions: ["RB"],
    categories: ["rushing", "receiving"],
    phone: ["rushAtt", "rushYds", "rushTd", "rushAvg"],
    lead: "rushYds",
    counts: ["rush100", "rec100", "rec5", "scrimmage2td"],
  },
  {
    id: "wrte",
    label: "WR/TE",
    positions: ["WR", "TE"],
    categories: ["receiving", "rushing"],
    phone: ["rec", "recYds", "recTd", "recAvg"],
    lead: "recYds",
    counts: ["rec100", "rec5", "rush100", "scrimmage2td"],
  },
  {
    id: "dl",
    label: "DL",
    positions: ["DL"],
    categories: ["defense"],
    phone: ["tackles", "sacks", "tacklesForLoss"],
    lead: "sacks",
    counts: ["sacks2", "int2"],
  },
  {
    id: "lb",
    label: "LB",
    positions: ["LB"],
    categories: ["defense"],
    phone: ["tackles", "sacks", "defInt"],
    lead: "tackles",
    counts: ["sacks2", "int2"],
  },
  {
    id: "db",
    label: "DB",
    positions: ["DB"],
    categories: ["defense"],
    phone: ["tackles", "defInt", "passDeflections"],
    lead: "defInt",
    counts: ["sacks2", "int2"],
  },
  {
    id: "k",
    label: "K",
    positions: ["K"],
    categories: ["kicking"],
    phone: ["fgm", "fga", "fgPct", "xpm"],
    lead: "fgm",
    counts: [],
  },
  {
    id: "p",
    label: "P",
    positions: ["P"],
    categories: ["punting"],
    phone: ["punts", "puntAvg", "puntIn20"],
    lead: "puntYds",
    counts: [],
  },
  {
    id: "returns",
    label: "Returns",
    positions: null,
    categories: ["returns"],
    phone: ["kickReturnYds", "puntReturnYds", "kickReturnTd"],
    lead: "kickReturnYds",
    counts: [],
  },
];

export function statGroup(id: string): StatGroup {
  return STAT_GROUPS.find((g) => g.id === id) ?? STAT_GROUPS[0]!;
}
