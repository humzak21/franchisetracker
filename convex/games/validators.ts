/** Return validators for the schedule and game queries (mirrors the shapes in views.ts). */
import { v } from "convex/values";
import schema from "../schema";
import { vGameResult, vGameStatus, vPlayoffRound, vRecord, vWeekKey } from "../lib/validators";

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

export const vWlt = v.object({ w: v.number(), l: v.number(), t: v.number() });

export const vStarView = v.object({
  playerId: nullable(v.id("players")),
  name: v.string(),
  position: nullable(v.string()),
  caption: nullable(v.string()),
  teamId: nullable(v.id("teams")),
});

export const vGameRow = v.object({
  _id: v.id("games"),
  weekKey: vWeekKey,
  status: vGameStatus,
  result: nullable(vGameResult),
  overtime: v.boolean(),
  userIsHome: nullable(v.boolean()),
  us: nullable(v.number()),
  them: nullable(v.number()),
  opponent: nullable(schema.doc("teams")),
  opponentRecord: nullable(vRecord),
  playoffRound: nullable(vPlayoffRound),
  dateLabel: nullable(v.string()),
  notes: nullable(v.string()),
  stars: v.array(vStarView),
});

export const vSeasonSummary = v.object({
  regular: vWlt,
  postseason: vWlt,
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  streak: nullable(v.string()),
});

export const vHeadToHeadGame = v.object({
  _id: v.id("games"),
  year: v.number(),
  weekKey: vWeekKey,
  result: nullable(vGameResult),
  us: v.number(),
  them: v.number(),
});

/** A scored game for the season charts, with its opponent (see `weekPointRows`). */
export const vWeekPoint = v.object({
  weekKey: vWeekKey,
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  margin: v.number(),
  result: vGameResult,
  streak: v.number(),
  opponentAbbr: nullable(v.string()),
});
