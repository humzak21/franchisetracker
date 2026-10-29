/** The draft results commit: picks, the players they made and their draft slots. */
import { pickInRound } from "../../shared/draft/slot";
import { PROSPECT_ESPN_ID, rowOverallPick } from "../../shared/ingestion/rows/peopleSpecs";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  numberOf,
  positionOf,
  rowPlayer,
  teamCache,
  textOf,
  type RowCommit,
  type RowCommitResult,
} from "./rowCommit";

/**
 * Draft picks upserted by overall pick, worked out from the round and the pick in it; every pick
 * becomes a player with the draft slot on them. A pick review matched to a college prospect on
 * ESPN keeps the athlete's id, so the player page shows his photo.
 */
export async function commitDraftResults(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    const overall = rowOverallPick(row);
    const round = numberOf(row, "round");
    if (!row.teamAbbr || overall === null || round === undefined) continue;
    const t = await team(row.teamAbbr);
    const player = await rowPlayer(ctx, commit, row, t._id, {
      fields: {
        ovr: numberOf(row, "ovr"),
        age: numberOf(row, "age"),
        exp: 0,
        acquisition: { type: "draft", year: commit.season.year, detail: `Round ${round}, pick ${overall}` },
      },
    });
    const college = textOf(row, "college");
    const espnId = numberOf(row, PROSPECT_ESPN_ID);
    const bio: Partial<Doc<"players">> = {};
    if (!player.draft) bio.draft = { year: commit.season.year, round, pick: overall, teamId: t._id };
    if (!player.college && college) bio.college = college;
    if (row.playerId === null && espnId !== undefined && player.espnId === undefined) {
      bio.espnId = espnId;
      bio.espnLeague = "college";
      bio.isReal = true;
    }
    if (Object.keys(bio).length > 0) await ctx.db.patch("players", player._id, bio);
    const fields = {
      round,
      overall,
      pickInRound: pickInRound(overall),
      teamId: t._id,
      playerId: player._id,
      rawName: row.name ?? undefined,
      position: positionOf(row) ?? player.position,
      ovrAtDraft: numberOf(row, "ovr"),
      college,
    };
    const existing = await ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", commit.season._id).eq("overall", overall))
      .first();
    if (existing) await ctx.db.patch("draftPicks", existing._id, fields);
    else
      await ctx.db.insert("draftPicks", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        ...fields,
      });
  }
  return {};
}
