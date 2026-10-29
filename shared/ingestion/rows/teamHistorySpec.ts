/**
 * Team history: the user team's season-by-season results from before the franchise, from any
 * source (a website's year-by-year table, a book, a spreadsheet). It fills History where the
 * nflverse import stops (1999), one row per season.
 */
import { PLAYOFF_RESULT_LABELS, PLAYOFF_RESULTS, isPlayoffResult } from "../../domain";
import { seasonRecordError } from "../../history/seasonRecord";
import type { DraftWarning } from "../types";
import type { RowSpec, RowsDraft } from "./types";

const num = (value: unknown) => (typeof value === "number" ? value : undefined);

function teamHistoryRules(draft: RowsDraft): DraftWarning[] {
  return draft.rows.flatMap((row) => {
    if (!row.accepted) return [];
    const path = `rows.${row.id}.values`;
    const year = num(row.values.year);
    if (year === undefined)
      return [{ path: `${path}.year`, message: "Which season is this?", severity: "error" }];
    const result = row.values.playoffResult;
    const error = seasonRecordError({
      w: num(row.values.w) ?? 0,
      l: num(row.values.l) ?? 0,
      t: num(row.values.t) ?? 0,
      divisionRank: num(row.values.divisionRank),
      seed: num(row.values.seed),
      playoffResult: typeof result === "string" && isPlayoffResult(result) ? result : undefined,
    });
    return error ? [{ path: `${path}.w`, message: `${year}: ${error}`, severity: "error" as const }] : [];
  });
}

export const teamHistorySpec: RowSpec = {
  player: false,
  rowTeam: false,
  meta: [],
  fields: () => [
    { key: "year", label: "Season", type: "int", primary: true, required: true, hint: "The season (1985)" },
    { key: "w", label: "Wins", type: "int", primary: true, required: true },
    { key: "l", label: "Losses", type: "int", primary: true, required: true },
    { key: "t", label: "Ties", type: "int", primary: true },
    {
      key: "divisionRank",
      label: "Division finish",
      type: "int",
      hint: "Place in the division (or the conference, before divisions), 1 for first; null if not shown",
    },
    {
      key: "seed",
      label: "Playoff seed",
      type: "int",
      hint: "Playoff seed, null if not shown or not seeded",
    },
    {
      key: "playoffResult",
      label: "Playoffs",
      type: "enum",
      hint: "How the season ended: missed when the team did not make the playoffs, else the round it lost in, or champion",
      options: PLAYOFF_RESULTS.map((r) => ({ value: r, label: PLAYOFF_RESULT_LABELS[r] })),
    },
    { key: "headCoach", label: "Head coach", type: "text" },
    { key: "pointsFor", label: "Points for", type: "int" },
    { key: "pointsAgainst", label: "Points against", type: "int" },
    {
      key: "note",
      label: "Note",
      type: "text",
      hint: "Anything else the source says about the season, else null",
    },
  ],
  identity: (row) => String(row.values.year ?? "?"),
  rules: teamHistoryRules,
};
