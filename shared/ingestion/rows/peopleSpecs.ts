/** Row targets about people: awards, the draft, roster pages, transactions, injuries, a player card. */
import {
  AWARD_INFO,
  AWARD_TYPES,
  CONFERENCES,
  DEV_TRAIT_LABELS,
  DEV_TRAITS,
  TRANSACTION_LABELS,
  TRANSACTION_TYPES,
  WEEK_KEYS,
  weekLabel,
  type AwardType,
} from "../../domain";
import { overallPick } from "../../draft/slot";
import type { DraftWarning } from "../types";
import { nameKey } from "./engine";
import type { DraftRow, RowField, RowSpec, RowsDraft } from "./types";

const POSITION: RowField = { key: "position", label: "Position", type: "position", primary: true };
const CONFERENCE: RowField = {
  key: "conference",
  label: "Conference",
  type: "enum",
  options: CONFERENCES.map((c) => ({ value: c, label: c })),
};
const awardOptions = (cadences: string[]) =>
  AWARD_TYPES.filter((t) => cadences.includes(AWARD_INFO[t].cadence)).map((t) => ({
    value: t,
    label: AWARD_INFO[t].label,
  }));

/** Two winners of one award slot (the same award, conference and position) is a misread. */
function oneWinnerPer(draft: RowsDraft, keys: string[], max: (award: AwardType) => number): DraftWarning[] {
  const counts = new Map<string, number>();
  for (const row of draft.rows) {
    if (!row.accepted) continue;
    const key = keys.map((k) => String(row.values[k] ?? "")).join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].flatMap(([key, n]) => {
    const award = key.split("|")[0] as AwardType;
    return AWARD_INFO[award] && n > max(award)
      ? [{ message: `${AWARD_INFO[award].label}: ${n} winners in one slot`, severity: "warning" as const }]
      : [];
  });
}

export const weeklyAwardsSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    {
      key: "award",
      label: "Award",
      type: "enum",
      primary: true,
      required: true,
      options: awardOptions(["weekly"]),
    },
    { ...CONFERENCE, primary: true },
    POSITION,
    { key: "statLine", label: "Stat line", type: "text", hint: "The stat line printed with the award" },
  ],
  identity: (row) =>
    `${String(row.values.award)}|${String(row.values.conference ?? "")}|${nameKey(row.name)}`,
  rules: (draft) => oneWinnerPer(draft, ["award", "conference"], () => 1),
};

export const yearlyAwardsSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    {
      key: "award",
      label: "Award",
      type: "enum",
      primary: true,
      required: true,
      options: awardOptions(["yearly", "honor"]),
    },
    CONFERENCE,
    POSITION,
    { key: "statLine", label: "Stat line", type: "text" },
  ],
  identity: (row) =>
    `${String(row.values.award)}|${String(row.values.conference ?? "")}|${String(row.values.position ?? "")}|${nameKey(row.name)}`,
  rules: (draft) =>
    oneWinnerPer(draft, ["award", "conference"], (award) => (AWARD_INFO[award].cadence === "honor" ? 99 : 1)),
};

/**
 * Where a pick's ESPN college athlete id rides on its row when review matched the pick to a real
 * prospect; set by the player picker, never read from a screen, so it is not a field.
 */
export const PROSPECT_ESPN_ID = "espnId";

/** The overall pick of a draft row, from its round and pick in the round. */
export const rowOverallPick = (row: Pick<DraftRow, "values">) =>
  overallPick(row.values.round, row.values.pickInRound);

export const draftResultsSpec: RowSpec = {
  player: true,
  rowTeam: true,
  newPlayers: true,
  meta: [],
  fields: () => [
    { key: "round", label: "Round", type: "int", primary: true, required: true },
    {
      key: "pickInRound",
      label: "Pick",
      type: "int",
      primary: true,
      required: true,
      hint: "The pick within the round (1 to 32), the PICK column",
    },
    POSITION,
    { key: "ovr", label: "OVR", type: "int", primary: true },
    { key: "age", label: "Age", type: "int", primary: true },
    { key: "college", label: "College", type: "text", primary: true },
  ],
  identity: (row) => String(rowOverallPick(row) ?? nameKey(row.name)),
  caption: (row) => {
    const overall = rowOverallPick(row);
    return overall === null ? null : `No. ${overall} overall`;
  },
  rules: (draft) =>
    draft.rows.flatMap((r) => {
      if (!r.accepted) return [];
      const overall = rowOverallPick(r);
      const who = r.name ?? "A pick";
      const out: DraftWarning[] = [];
      if (overall === null && r.values.round != null && r.values.pickInRound != null)
        out.push({
          path: `rows.${r.id}.values.pickInRound`,
          message: `${who}: round ${String(r.values.round)}, pick ${String(r.values.pickInRound)} is not a draft slot`,
          severity: "error",
        });
      if (!r.teamAbbr)
        out.push({ path: `rows.${r.id}.teamAbbr`, message: `${who}: pick the team`, severity: "error" });
      return out;
    }),
};

const DEV_TRAIT: RowField = {
  key: "devTrait",
  label: "Dev trait",
  type: "enum",
  options: DEV_TRAITS.map((t) => ({ value: t, label: DEV_TRAIT_LABELS[t] })),
};

export const rosterPageSpec: RowSpec = {
  player: true,
  rowTeam: false,
  meta: [{ key: "team", label: "Team", type: "team", required: true, hint: "Whose roster the screen shows" }],
  fields: () => [
    POSITION,
    { key: "jersey", label: "Jersey", type: "int" },
    { key: "ovr", label: "OVR", type: "int", primary: true },
    { key: "age", label: "Age", type: "int" },
    { key: "exp", label: "Years pro", type: "int" },
    DEV_TRAIT,
  ],
  identity: (row) => nameKey(row.name),
};

export const transactionsSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    {
      key: "type",
      label: "Move",
      type: "enum",
      primary: true,
      required: true,
      options: TRANSACTION_TYPES.map((t) => ({ value: t, label: TRANSACTION_LABELS[t] })),
    },
    {
      key: "week",
      label: "Week",
      type: "enum",
      hint: "The week of the move when printed, else null",
      options: WEEK_KEYS.map((w) => ({ value: w, label: weekLabel(w, "long") })),
    },
    { key: "counterpart", label: "Other team", type: "team", hint: "The other team in a trade or claim" },
    { key: "detail", label: "Detail", type: "text", hint: "Contract or trade terms as printed" },
  ],
  identity: (row) => `${String(row.values.type)}|${nameKey(row.name)}|${String(row.values.week ?? "")}`,
};

export const injuryReportSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    POSITION,
    { key: "injury", label: "Injury", type: "text", primary: true, required: true },
    {
      key: "length",
      label: "Length",
      type: "text",
      primary: true,
      hint: 'Length as printed ("3-5 weeks", "season")',
    },
    {
      key: "weeks",
      label: "Weeks out",
      type: "int",
      hint: "Weeks out as a number when the screen gives one",
    },
    { key: "ir", label: "On IR", type: "bool" },
  ],
  identity: (row) => nameKey(row.name),
};

export const playerCardSpec: RowSpec = {
  player: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    POSITION,
    { key: "jersey", label: "Jersey", type: "int" },
    { key: "ovr", label: "OVR", type: "int", primary: true },
    { key: "age", label: "Age", type: "int", primary: true },
    { ...DEV_TRAIT, primary: true },
    { key: "college", label: "College", type: "text" },
    { key: "heightIn", label: "Height (in)", type: "int", hint: "Height in inches (6'4\" is 76)" },
    { key: "weightLb", label: "Weight (lb)", type: "int" },
    { key: "contractYears", label: "Contract years", type: "int" },
    { key: "contractApy", label: "Per year ($)", type: "number", hint: "Contract money per year in dollars" },
    { key: "contractExpires", label: "Contract ends", type: "int", hint: "Season the contract runs through" },
    {
      key: "abilities",
      label: "Abilities",
      type: "text",
      hint: "Superstar and X-Factor abilities, comma separated",
    },
  ],
  identity: () => "card",
};
