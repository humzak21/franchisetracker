/** The league schedule screen: one week's games across the league, with final scores once played. */
import { WEEK_KEYS, weekLabel } from "../../domain";
import type { DraftWarning } from "../types";
import type { RowSpec, RowsDraft } from "./types";

const teamOf = (value: unknown) => (typeof value === "string" ? value : null);

/** A team plays once a week, scores come in pairs, and a team never plays itself. */
function scheduleRules(draft: RowsDraft): DraftWarning[] {
  const out: DraftWarning[] = [];
  const seen = new Map<string, string>();
  for (const row of draft.rows) {
    if (!row.accepted) continue;
    const path = `rows.${row.id}.values`;
    const away = teamOf(row.values.awayTeam);
    const home = teamOf(row.values.homeTeam);
    if (away && away === home) {
      out.push({ path: `${path}.homeTeam`, message: `${away} cannot play itself`, severity: "error" });
    }
    for (const team of [away, home]) {
      if (!team) continue;
      const other = seen.get(team);
      if (other && other !== row.id) {
        out.push({
          path: `${path}.awayTeam`,
          message: `${team} is in two games this week`,
          severity: "error",
        });
      }
      seen.set(team, row.id);
    }
    const scores = [row.values.awayScore, row.values.homeScore].map((s) => typeof s === "number");
    if (scores[0] !== scores[1]) {
      const side = scores[0] ? "homeScore" : "awayScore";
      out.push({
        path: `${path}.${side}`,
        message: `${away ?? "?"} @ ${home ?? "?"}: enter both scores, or neither for a game not played yet`,
        severity: "error",
      });
    }
    for (const side of ["awayScore", "homeScore"] as const) {
      const score = row.values[side];
      if (typeof score === "number" && score < 0) {
        out.push({ path: `${path}.${side}`, message: "Scores cannot be negative", severity: "error" });
      }
    }
  }
  return out;
}

export const leagueScheduleSpec: RowSpec = {
  player: false,
  rowTeam: false,
  meta: [
    {
      key: "week",
      label: "Week shown",
      type: "enum",
      hint: "The week in the screen's header (SEASON WEEK 15 is w15), else null",
      options: WEEK_KEYS.map((w) => ({ value: w, label: weekLabel(w, "long") })),
    },
  ],
  fields: () => [
    {
      key: "awayTeam",
      label: "Away",
      type: "team",
      primary: true,
      required: true,
      hint: "The away team: the first team in the matchup (49ers in 49ers @ Chargers)",
    },
    {
      key: "homeTeam",
      label: "Home",
      type: "team",
      primary: true,
      required: true,
      hint: "The home team: the team after the @",
    },
    {
      key: "awayScore",
      label: "Away score",
      type: "int",
      primary: true,
      hint: "The away team's points: the first number in the result (23 in SF 23 - 20 LAC), null if not played",
    },
    {
      key: "homeScore",
      label: "Home score",
      type: "int",
      primary: true,
      hint: "The home team's points: the second number in the result, null if not played",
    },
    { key: "time", label: "Game time", type: "text", hint: 'Game time as printed ("Thu 8:15 PM")' },
  ],
  identity: (row) => `${String(row.values.awayTeam ?? "?")}@${String(row.values.homeTeam ?? "?")}`,
  rules: scheduleRules,
};
