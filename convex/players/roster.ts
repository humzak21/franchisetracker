import { v } from "convex/values";
import { weekIndex } from "../../shared/domain";
import { applyEntryPatch } from "../../shared/roster/entryPatch";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { appError, invalid, must } from "../lib/errors";
import { activeFranchise, MAX_ROSTER, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { vWeekKey } from "../lib/validators";
import schema from "../schema";
import { vEntryPatch } from "./patches";

/** A season's injury reports for the whole league, with headroom. */
const MAX_INJURIES = 1000;
/** One player's entries in one season: a few teams at most, even after moves. */
const MAX_STINTS = 20;

/** A season's roster for one team (the user team by default), each entry joined to its player. */
export const bySeason = query({
  args: { seasonId: v.id("seasons"), teamId: v.optional(v.id("teams")) },
  returns: v.object({
    team: schema.doc("teams"),
    entries: v.array(
      v.object({
        entry: schema.doc("rosterEntries"),
        player: schema.doc("players"),
        headshotUrl: v.union(v.string(), v.null()),
        /** The player's latest injury this season, for the roster's injury badge. */
        injury: v.union(
          v.object({
            injuryType: v.string(),
            lengthLabel: v.optional(v.string()),
            onIr: v.boolean(),
            weekKey: v.optional(vWeekKey),
          }),
          v.null(),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const teamId = args.teamId ?? (await activeFranchise(ctx)).userTeamId;
    const team = must(await ctx.db.get("teams", teamId), "Team");
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", args.seasonId).eq("teamId", teamId))
      .take(MAX_ROSTER);
    const players = await playersById(
      ctx,
      entries.map((e) => e.playerId),
    );
    const urls = await headshotUrls(ctx, players.values());
    const injuries = await ctx.db
      .query("injuries")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", args.seasonId))
      .take(MAX_INJURIES);
    const latest = new Map<(typeof injuries)[number]["playerId"], (typeof injuries)[number]>();
    const at = (i: (typeof injuries)[number]) => (i.weekKey ? weekIndex(i.weekKey) : -1);
    for (const i of injuries) {
      const seen = latest.get(i.playerId);
      if (!seen || at(i) >= at(seen)) latest.set(i.playerId, i);
    }
    return {
      team,
      entries: entries.flatMap((entry) => {
        const player = players.get(entry.playerId);
        const injury = latest.get(entry.playerId);
        return player
          ? [
              {
                entry,
                player,
                headshotUrl: urls.get(player._id) ?? null,
                injury: injury
                  ? {
                      injuryType: injury.injuryType,
                      lengthLabel: injury.lengthLabel,
                      onIr: injury.onIr,
                      weekKey: injury.weekKey,
                    }
                  : null,
              },
            ]
          : [];
      }),
    };
  },
});

/**
 * Edits one season's roster entry: any subset of its fields, one table cell or a whole sheet.
 * `teamId` corrects which team the entry belongs to (a data fix, not a move; see `move.ts`).
 */
export const updateEntry = mutation({
  args: { entryId: v.id("rosterEntries"), patch: vEntryPatch, teamId: v.optional(v.id("teams")) },
  returns: v.null(),
  handler: async (ctx, { entryId, patch, teamId }) => {
    await requireOwner(ctx);
    const entry = must(await ctx.db.get("rosterEntries", entryId), "Roster entry");
    const result = applyEntryPatch(entry, patch);
    if (!result.ok) throw invalid(result.error);
    if (teamId !== undefined && teamId !== entry.teamId) {
      must(await ctx.db.get("teams", teamId), "Team");
      const stints = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) =>
          q.eq("playerId", entry.playerId).eq("seasonId", entry.seasonId),
        )
        .take(MAX_STINTS);
      if (stints.some((s) => s.teamId === teamId))
        throw appError("conflict", "He already has a roster entry with that team this season");
    }
    await ctx.db.patch("rosterEntries", entryId, {
      ...result.fields,
      ...(teamId !== undefined ? { teamId } : {}),
    });
    return null;
  },
});
