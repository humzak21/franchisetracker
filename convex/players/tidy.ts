/**
 * Tidy player records (Settings → Player identity): the one-time pass that gives players created
 * before Sprint 16 what new ones are born with. Each gets an origin and the season they first
 * appeared, a captured player from after the first season turns fictional unless matched, an old
 * "M.Hawkins" gets a proper first and last name, and aliases reach the search index. A player who
 * has an origin is skipped, so it can be run again and picks up where a restore left off.
 */
import { v } from "convex/values";
import { aliasFields, repairedName } from "../../shared/players/identity";
import { tidiedProvenance } from "../../shared/players/provenance";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, MAX_SEASONS } from "../lib/franchise";

/** Players per step: a captured player reads their roster entries and draft pick. */
const PAGE = 100;
const MAX_ENTRIES = 40;

type Years = Map<Id<"seasons">, number>;

/** The draft slot, else the earliest roster entry, else the earliest game. */
async function firstSeason(ctx: MutationCtx, player: Doc<"players">, years: Years) {
  const pick = await ctx.db
    .query("draftPicks")
    .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
    .first();
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_ENTRIES);
  const line = entries.length
    ? null
    : await ctx.db
        .query("gameStatLines")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
        .first();
  const seen = [...entries.map((e) => e.seasonId), ...(line ? [line.seasonId] : [])];
  const earliest = seen.sort((a, b) => (years.get(a) ?? 0) - (years.get(b) ?? 0))[0];
  return { drafted: pick !== null, seasonId: pick?.seasonId ?? earliest };
}

async function tidyOne(ctx: MutationCtx, player: Doc<"players">, years: Years, startYear: number) {
  const imported = player.nflverseId !== undefined;
  const { drafted, seasonId } = imported
    ? { drafted: false, seasonId: undefined }
    : await firstSeason(ctx, player, years);
  const createdYear = seasonId ? (years.get(seasonId) ?? null) : null;
  const { origin, isReal } = tidiedProvenance(player, { drafted, createdYear, startYear });
  const name = imported ? null : repairedName(player);
  await ctx.db.patch("players", player._id, {
    origin,
    isReal,
    createdSeasonId: seasonId,
    ...(name ?? aliasFields(player.aliases)),
  });
  return { fictional: player.isReal && !isReal, renamed: name !== null };
}

const jobOf = (ctx: QueryCtx, franchiseId: Id<"franchises">) =>
  ctx.db
    .query("identityTidies")
    .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchiseId))
    .unique();

export const step = internalMutation({
  args: { jobId: v.id("identityTidies") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("identityTidies", jobId);
    if (job?.status !== "running") return null;
    const franchise = await ctx.db.get("franchises", job.franchiseId);
    if (!franchise) return null;
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_SEASONS);
    const years: Years = new Map(seasons.map((s) => [s._id, s.year]));
    const page = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_origin", (q) =>
        q.eq("franchiseId", franchise._id).eq("origin", undefined),
      )
      .paginate({ cursor: null, numItems: PAGE });
    let { fictional, renamed } = job;
    for (const player of page.page) {
      const result = await tidyOne(ctx, player, years, franchise.startYear);
      if (result.fictional) fictional++;
      if (result.renamed) renamed++;
    }
    const checked = job.checked + page.page.length;
    if (page.isDone) {
      await ctx.db.patch("identityTidies", jobId, {
        status: "done",
        checked,
        fictional,
        renamed,
        finishedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.patch("identityTidies", jobId, { checked, fictional, renamed });
    await ctx.scheduler.runAfter(0, internal.players.tidy.step, { jobId });
    return null;
  },
});

export const status = query({
  args: {},
  returns: v.object({
    /** Someone has not been tidied yet. */
    pending: v.boolean(),
    job: v.union(
      v.object({
        status: v.union(v.literal("running"), v.literal("done")),
        checked: v.number(),
        fictional: v.number(),
        renamed: v.number(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const job = await jobOf(ctx, franchise._id);
    const untidied = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_origin", (q) =>
        q.eq("franchiseId", franchise._id).eq("origin", undefined),
      )
      .first();
    return {
      pending: untidied !== null,
      job: job
        ? { status: job.status, checked: job.checked, fictional: job.fictional, renamed: job.renamed }
        : null,
    };
  },
});

export const start = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const existing = await jobOf(ctx, franchise._id);
    if (existing?.status === "running") return null;
    const fresh = { status: "running" as const, checked: 0, fictional: 0, renamed: 0, startedAt: Date.now() };
    const jobId =
      existing?._id ?? (await ctx.db.insert("identityTidies", { franchiseId: franchise._id, ...fresh }));
    if (existing) await ctx.db.patch("identityTidies", existing._id, { ...fresh, finishedAt: undefined });
    await ctx.scheduler.runAfter(0, internal.players.tidy.step, { jobId });
    return null;
  },
});
