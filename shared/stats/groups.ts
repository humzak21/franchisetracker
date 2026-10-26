/**
 * The season stats screen's position groups (FEATURES.md 5.5): which players each shows, which
 * stat categories become columns, and the few columns a phone keeps in the table.
 */
import type { PositionGroup } from "../domain/positions";
import type { StatCategory, StatKey } from "./registry";

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
};

export const STAT_GROUPS: readonly StatGroup[] = [
  {
    id: "qb",
    label: "QB",
    positions: ["QB"],
    categories: ["passing", "rushing"],
    phone: ["passCmp", "passAtt", "passYds", "passTd", "passInt", "passRating"],
    lead: "passYds",
  },
  {
    id: "rb",
    label: "RB",
    positions: ["RB"],
    categories: ["rushing", "receiving"],
    phone: ["rushAtt", "rushYds", "rushTd", "rushAvg"],
    lead: "rushYds",
  },
  {
    id: "wrte",
    label: "WR/TE",
    positions: ["WR", "TE"],
    categories: ["receiving", "rushing"],
    phone: ["rec", "recYds", "recTd", "recAvg"],
    lead: "recYds",
  },
  {
    id: "dl",
    label: "DL",
    positions: ["DL"],
    categories: ["defense"],
    phone: ["tackles", "sacks", "tacklesForLoss"],
    lead: "sacks",
  },
  {
    id: "lb",
    label: "LB",
    positions: ["LB"],
    categories: ["defense"],
    phone: ["tackles", "sacks", "defInt"],
    lead: "tackles",
  },
  {
    id: "db",
    label: "DB",
    positions: ["DB"],
    categories: ["defense"],
    phone: ["tackles", "defInt", "passDeflections"],
    lead: "defInt",
  },
  {
    id: "k",
    label: "K",
    positions: ["K"],
    categories: ["kicking"],
    phone: ["fgm", "fga", "fgPct", "xpm"],
    lead: "fgm",
  },
  {
    id: "p",
    label: "P",
    positions: ["P"],
    categories: ["punting"],
    phone: ["punts", "puntAvg", "puntIn20"],
    lead: "puntYds",
  },
  {
    id: "returns",
    label: "Returns",
    positions: null,
    categories: ["returns"],
    phone: ["kickReturnYds", "puntReturnYds", "kickReturnTd"],
    lead: "kickReturnYds",
  },
];

export function statGroup(id: string): StatGroup {
  return STAT_GROUPS.find((g) => g.id === id) ?? STAT_GROUPS[0]!;
}
