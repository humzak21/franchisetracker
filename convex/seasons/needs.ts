/**
 * The offseason needs checklist on a season report (FEATURES.md 4.1, 5.7): needs written after a
 * season, carried into the offseason that follows, and resolved by a transaction, a draft pick
 * or a note.
 */
import { v } from "convex/values";
import { needKey } from "../../shared/seasons/reports";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { resolutionCandidates } from "../lib/needs";
import { ensureReport, ownSeason, seasonByYear } from "../lib/reports";
import { vNeedPriority, vPosition } from "../lib/validators";

const MAX_NEEDS = 30;
const MAX_NOTE = 500;

type Need = Doc<"seasonReports">["needs"][number];

function cleanNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim();
  if (trimmed && trimmed.length > MAX_NOTE) throw invalid(`Keep notes under ${MAX_NOTE} characters`);
  return trimmed ? trimmed : undefined;
}

/** Rewrites one need on the season's report; throws when the key is unknown. */
async function patchNeed(
  ctx: MutationCtx,
  seasonId: Doc<"seasons">["_id"],
  key: string,
  change: (need: Need) => Need | null,
): Promise<void> {
  const { season } = await ownSeason(ctx, seasonId);
  const report = await ensureReport(ctx, season);
  must(
    report.needs.find((n) => n.key === key),
    "Need",
  );
  const needs = report.needs.flatMap((n) => {
    if (n.key !== key) return [n];
    const next = change(n);
    return next ? [next] : [];
  });
  await ctx.db.patch("seasonReports", report._id, { needs });
}

/** The need without any resolution, so it is resolved one way at a time. */
function unresolved({ key, position, priority, note }: Need): Need {
  return { key, position, priority, ...(note ? { note } : {}) };
}

export const add = mutation({
  args: {
    seasonId: v.id("seasons"),
    position: vPosition,
    priority: vNeedPriority,
    note: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, { seasonId, position, priority, note }) => {
    await requireOwner(ctx);
    const { season } = await ownSeason(ctx, seasonId);
    const report = await ensureReport(ctx, season);
    if (report.needs.length >= MAX_NEEDS) throw invalid(`A season can list up to ${MAX_NEEDS} needs`);
    const key = needKey(report.needs, Date.now());
    await ctx.db.patch("seasonReports", report._id, {
      needs: [...report.needs, { key, position, priority, note: cleanNote(note) }],
    });
    return key;
  },
});

export const update = mutation({
  args: {
    seasonId: v.id("seasons"),
    key: v.string(),
    position: v.optional(vPosition),
    priority: v.optional(vNeedPriority),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, key, ...fields }) => {
    await requireOwner(ctx);
    await patchNeed(ctx, seasonId, key, (need) => ({
      ...need,
      ...(fields.position ? { position: fields.position } : {}),
      ...(fields.priority ? { priority: fields.priority } : {}),
      ...(fields.note !== undefined ? { note: cleanNote(fields.note) } : {}),
    }));
    return null;
  },
});

export const remove = mutation({
  args: { seasonId: v.id("seasons"), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { seasonId, key }) => {
    await requireOwner(ctx);
    await patchNeed(ctx, seasonId, key, () => null);
    return null;
  },
});

export const resolve = mutation({
  args: {
    seasonId: v.id("seasons"),
    key: v.string(),
    by: v.union(
      v.object({ kind: v.literal("transaction"), transactionId: v.id("transactions") }),
      v.object({ kind: v.literal("draftPick"), draftPickId: v.id("draftPicks") }),
      v.object({ kind: v.literal("note"), note: v.optional(v.string()) }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, key, by }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    if (by.kind === "transaction") {
      const tx = must(await ctx.db.get("transactions", by.transactionId), "Transaction");
      if (tx.franchiseId !== franchise._id) throw invalid("That transaction belongs to another franchise");
    }
    if (by.kind === "draftPick") {
      const pick = must(await ctx.db.get("draftPicks", by.draftPickId), "Draft pick");
      if (pick.franchiseId !== franchise._id) throw invalid("That draft pick belongs to another franchise");
    }
    const note = by.kind === "note" ? cleanNote(by.note) : undefined;
    await patchNeed(ctx, seasonId, key, (need) => ({
      ...unresolved(need),
      resolvedAt: Date.now(),
      ...(by.kind === "transaction" ? { resolvedByTransactionId: by.transactionId } : {}),
      ...(by.kind === "draftPick" ? { resolvedByDraftPickId: by.draftPickId } : {}),
      ...(note ? { resolvedNote: note } : {}),
    }));
    return null;
  },
});

export const reopen = mutation({
  args: { seasonId: v.id("seasons"), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { seasonId, key }) => {
    await requireOwner(ctx);
    await patchNeed(ctx, seasonId, key, unresolved);
    return null;
  },
});

const vCandidate = v.object({ label: v.string(), notes: v.optional(v.string()) });

/**
 * What could resolve this season's needs: the user team's transactions and draft picks in the
 * season and in the next one, where its offseason moves and draft land.
 */
export const candidates = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    transactions: v.array(vCandidate.extend({ _id: v.id("transactions") })),
    draftPicks: v.array(vCandidate.extend({ _id: v.id("draftPicks") })),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const { franchise, season } = await ownSeason(ctx, seasonId);
    const next = await seasonByYear(ctx, franchise._id, season.year + 1);
    return await resolutionCandidates(ctx, next ? [next._id, seasonId] : [seasonId], franchise.userTeamId);
  },
});
