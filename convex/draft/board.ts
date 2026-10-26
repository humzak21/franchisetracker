/**
 * The lightweight draft board (FEATURES.md 5.9): the offseason's open needs from the season
 * report, the prospects the owner noted in their order, and who the team took.
 */
import { v } from "convex/values";
import { isNeedOpen } from "../../shared/seasons/reports";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { reportFor, seasonByYear } from "../lib/reports";
import { vNeedPriority, vPosition } from "../lib/validators";

const MAX_PROSPECTS = 200;
const MAX_PICKS = 300;
const MAX_TEXT = 300;

const clean = (text: string | undefined, what: string) => {
  const trimmed = text?.trim();
  if (trimmed && trimmed.length > MAX_TEXT) throw invalid(`Keep the ${what} under ${MAX_TEXT} characters`);
  return trimmed || undefined;
};

/** The board for the draft held before season `year`: needs from the season before it. */
export const get = query({
  args: { year: v.number() },
  returns: v.object({
    needs: v.array(
      v.object({
        position: vPosition,
        priority: vNeedPriority,
        note: v.optional(v.string()),
        open: v.boolean(),
      }),
    ),
    prospects: v.array(
      v.object({
        _id: v.id("draftBoard"),
        name: v.string(),
        position: vPosition,
        college: v.optional(v.string()),
        note: v.optional(v.string()),
        rank: v.number(),
      }),
    ),
    taken: v.array(
      v.object({ round: v.number(), overall: v.number(), name: v.string(), position: v.optional(vPosition) }),
    ),
  }),
  handler: async (ctx, { year }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [before, season, prospects] = await Promise.all([
      seasonByYear(ctx, franchise._id, year - 1),
      seasonByYear(ctx, franchise._id, year),
      ctx.db
        .query("draftBoard")
        .withIndex("by_franchiseId_and_year_and_rank", (q) =>
          q.eq("franchiseId", franchise._id).eq("year", year),
        )
        .take(MAX_PROSPECTS),
    ]);
    const report = before ? await reportFor(ctx, before._id) : null;
    const picks = season
      ? (
          await ctx.db
            .query("draftPicks")
            .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", season._id))
            .take(MAX_PICKS)
        ).filter((p) => p.teamId === franchise.userTeamId)
      : [];
    const players = await playersById(
      ctx,
      picks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    return {
      needs: (report?.needs ?? []).map((n) => ({
        position: n.position,
        priority: n.priority,
        note: n.note,
        open: isNeedOpen(n),
      })),
      prospects: prospects.map((p) => ({
        _id: p._id,
        name: p.name,
        position: p.position,
        college: p.college,
        note: p.note,
        rank: p.rank,
      })),
      taken: picks.map((p) => ({
        round: p.round,
        overall: p.overall,
        name: (p.playerId && players.get(p.playerId)?.displayName) || p.rawName || "Unknown",
        position: p.position,
      })),
    };
  },
});

export const addProspect = mutation({
  args: {
    year: v.number(),
    name: v.string(),
    position: vPosition,
    college: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("draftBoard"),
  handler: async (ctx, { year, name, position, college, note }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const prospect = clean(name, "name");
    if (!prospect) throw invalid("Name the prospect");
    const last = await ctx.db
      .query("draftBoard")
      .withIndex("by_franchiseId_and_year_and_rank", (q) =>
        q.eq("franchiseId", franchise._id).eq("year", year),
      )
      .order("desc")
      .first();
    return await ctx.db.insert("draftBoard", {
      franchiseId: franchise._id,
      year,
      name: prospect,
      position,
      college: clean(college, "college"),
      note: clean(note, "note"),
      rank: (last?.rank ?? 0) + 1,
    });
  },
});

export const updateProspect = mutation({
  args: { id: v.id("draftBoard"), note: v.optional(v.string()), college: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, note, college }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("draftBoard", id), "Prospect");
    await ctx.db.patch("draftBoard", id, {
      ...(note !== undefined ? { note: clean(note, "note") } : {}),
      ...(college !== undefined ? { college: clean(college, "college") } : {}),
    });
    return null;
  },
});

/** Swaps a prospect with the one above or below it. */
export const moveProspect = mutation({
  args: { id: v.id("draftBoard"), direction: v.union(v.literal(-1), v.literal(1)) },
  returns: v.null(),
  handler: async (ctx, { id, direction }) => {
    await requireOwner(ctx);
    const prospect = must(await ctx.db.get("draftBoard", id), "Prospect");
    const neighbour = await ctx.db
      .query("draftBoard")
      .withIndex("by_franchiseId_and_year_and_rank", (q) => {
        const range = q.eq("franchiseId", prospect.franchiseId).eq("year", prospect.year);
        return direction === -1 ? range.lt("rank", prospect.rank) : range.gt("rank", prospect.rank);
      })
      .order(direction === -1 ? "desc" : "asc")
      .first();
    if (!neighbour) return null;
    await ctx.db.patch("draftBoard", prospect._id, { rank: neighbour.rank });
    await ctx.db.patch("draftBoard", neighbour._id, { rank: prospect.rank });
    return null;
  },
});

export const removeProspect = mutation({
  args: { id: v.id("draftBoard") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("draftBoard", id), "Prospect");
    await ctx.db.delete("draftBoard", id);
    return null;
  },
});
