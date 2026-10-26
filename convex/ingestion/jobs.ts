/** Data access for the extraction action, which has no `ctx.db` of its own. */
import { v } from "convex/values";
import { nameTokens, type NameCandidate } from "../../shared/ingestion/nameMatch";
import { isTargetKey } from "../../shared/ingestion/targets";
import { weekLabel } from "../../shared/domain";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { vDraft, vDraftWarning, vFieldConfidence, vTargetKey } from "../lib/draftValidators";
import { activeFranchise, teamsById } from "../lib/franchise";
import { testModeEnabled } from "../lib/owner";
import { vScalar } from "../lib/validators";
import { MAX_FEW_SHOT } from "../../shared/ingestion/prompt";
import { modelSettings } from "./models";
import { setUploads } from "./sets";

const MAX_ROSTER = 150;
const SEARCH_HITS = 5;
const MAX_NAMES = 120;

/** Everything one extraction needs: images, target, prompt context, models and past corrections. */
export const load = internalQuery({
  args: { setKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      targetKey: vTargetKey,
      seasonId: v.union(v.id("seasons"), v.null()),
      images: v.array(v.object({ storageId: v.id("_storage"), mime: v.string() })),
      context: v.object({
        when: v.optional(v.string()),
        userTeam: v.string(),
        opponent: v.optional(v.string()),
      }),
      teams: v.object({ home: v.string(), away: v.string(), userIsHome: v.boolean() }),
      models: v.object({
        primary: v.string(),
        fallback: v.string(),
        temperature: v.number(),
        maxTokens: v.number(),
      }),
      corrections: v.array(v.object({ fieldPath: v.string(), extracted: vScalar, corrected: vScalar })),
      testMode: v.boolean(),
    }),
  ),
  handler: async (ctx, { setKey }) => {
    const franchise = await activeFranchise(ctx);
    const set = await setUploads(ctx, franchise._id, setKey);
    const lead = set[0];
    if (!lead?.targetKey || !isTargetKey(lead.targetKey)) return null;

    const teams = await teamsById(ctx);
    const userTeam = teams.get(franchise.userTeamId);
    if (!userTeam) return null;
    const game = lead.gameId
      ? await ctx.db.get("games", lead.gameId)
      : lead.seasonId && lead.weekKey
        ? await ctx.db
            .query("games")
            .withIndex("by_seasonId_and_weekKey", (q) =>
              q.eq("seasonId", lead.seasonId!).eq("weekKey", lead.weekKey!),
            )
            .first()
        : null;
    const opponent = game?.opponentTeamId ? teams.get(game.opponentTeamId) : undefined;
    const season = lead.seasonId ? await ctx.db.get("seasons", lead.seasonId) : null;
    const weekKey = game?.weekKey ?? lead.weekKey;
    const userIsHome = game?.userIsHome ?? true;

    const corrections = await ctx.db
      .query("corrections")
      .withIndex("by_franchiseId_and_targetKey_and_usedAsExample", (q) =>
        q.eq("franchiseId", franchise._id).eq("targetKey", lead.targetKey!).eq("usedAsExample", true),
      )
      .order("desc")
      .take(MAX_FEW_SHOT);

    return {
      targetKey: lead.targetKey,
      seasonId: lead.seasonId ?? null,
      images: set.map((u) => ({ storageId: u.storageId, mime: u.mime })),
      context: {
        when: season ? `${season.year} season${weekKey ? `, ${weekLabel(weekKey, "long")}` : ""}` : undefined,
        userTeam: `${userTeam.abbr} (${userTeam.city} ${userTeam.name})`,
        opponent: opponent ? `${opponent.abbr} (${opponent.city} ${opponent.name})` : undefined,
      },
      teams: {
        home: userIsHome ? userTeam.abbr : (opponent?.abbr ?? "MIA"),
        away: userIsHome ? (opponent?.abbr ?? "MIA") : userTeam.abbr,
        userIsHome,
      },
      models: modelSettings(franchise),
      corrections: corrections.map((c) => ({
        fieldPath: c.fieldPath,
        extracted: c.extractedValue,
        corrected: c.correctedValue,
      })),
      testMode: testModeEnabled(),
    };
  },
});

/**
 * Players a printed name may refer to: both teams' rosters for the season, then a text search
 * across the franchise for each name (traded players, typos in the roster).
 */
export const candidates = internalQuery({
  args: {
    seasonId: v.union(v.id("seasons"), v.null()),
    teamAbbrs: v.array(v.string()),
    names: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      aliases: v.array(v.string()),
      teamAbbr: v.union(v.string(), v.null()),
      position: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { seasonId, teamAbbrs, names }) => {
    const out = new Map<Id<"players">, NameCandidate<Id<"players">>>();
    const teams = [...(await teamsById(ctx)).values()].filter((t) => teamAbbrs.includes(t.abbr));
    const franchise = await activeFranchise(ctx);
    if (seasonId) {
      for (const team of teams) {
        const entries = await ctx.db
          .query("rosterEntries")
          .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", team._id))
          .take(MAX_ROSTER);
        for (const entry of entries) {
          const player = await ctx.db.get("players", entry.playerId);
          if (!player) continue;
          out.set(player._id, {
            playerId: player._id,
            displayName: player.displayName,
            firstName: player.firstName,
            lastName: player.lastName,
            aliases: player.aliases,
            teamAbbr: team.abbr,
            position: entry.position,
          });
        }
      }
    }
    for (const name of names.slice(0, MAX_NAMES)) {
      const last = nameTokens(name).at(-1);
      if (!last) continue;
      const hits = await ctx.db
        .query("players")
        .withSearchIndex("search_displayName", (q) =>
          q.search("displayName", last).eq("franchiseId", franchise._id),
        )
        .take(SEARCH_HITS);
      for (const p of hits) {
        if (out.has(p._id)) continue;
        out.set(p._id, {
          playerId: p._id,
          displayName: p.displayName,
          firstName: p.firstName,
          lastName: p.lastName,
          aliases: p.aliases,
          teamAbbr: null,
          position: p.position,
        });
      }
    }
    return [...out.values()].map((c) => ({
      ...c,
      aliases: [...c.aliases],
      teamAbbr: c.teamAbbr ?? null,
      position: c.position ?? null,
    }));
  },
});

export const save = internalMutation({
  args: {
    setKey: v.string(),
    targetKey: vTargetKey,
    model: v.string(),
    rawJson: v.string(),
    draft: vDraft,
    confidence: v.array(vFieldConfidence),
    warnings: v.array(vDraftWarning),
    tokenUsage: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
        costUsd: v.optional(v.number()),
      }),
    ),
    latencyMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { setKey, ...extraction }) =>
    await finish(ctx, setKey, async (lead) => {
      const previous = await ctx.db
        .query("extractions")
        .withIndex("by_setKey", (q) => q.eq("setKey", setKey))
        .take(50);
      for (const old of previous) await ctx.db.delete("extractions", old._id);
      await ctx.db.insert("extractions", {
        franchiseId: lead.franchiseId,
        uploadId: lead._id,
        setKey,
        ...extraction,
      });
      return { status: "review" as const };
    }),
});

export const fail = internalMutation({
  args: { setKey: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { setKey, error }) =>
    await finish(ctx, setKey, async () => ({ status: "failed" as const, error: error.slice(0, 500) })),
});

/** Applies the outcome to every upload still extracting in the set; a deleted set is ignored. */
async function finish(
  ctx: MutationCtx,
  setKey: string,
  outcome: (lead: Doc<"uploads">) => Promise<{ status: "review" | "failed"; error?: string }>,
): Promise<null> {
  const franchise = await activeFranchise(ctx);
  const set = await setUploads(ctx, franchise._id, setKey);
  const lead = set[0];
  // Deleted, or retagged while the model was working: drop this answer.
  if (!lead || !set.some((u) => u.status === "extracting")) return null;
  const patch = await outcome(lead);
  for (const upload of set)
    if (upload.status === "extracting") await ctx.db.patch("uploads", upload._id, patch);
  return null;
}
