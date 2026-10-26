import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { StandingRow } from "@shared/league/standings";

export type Standing = FunctionReturnType<typeof api.league.standings.bySeason>[number];
export type Overview = FunctionReturnType<typeof api.league.standings.overview>;

export const toRow = (s: Standing): StandingRow & { standing: Standing } => ({
  ...s,
  teamAbbr: s.team.abbr,
  standing: s,
});
