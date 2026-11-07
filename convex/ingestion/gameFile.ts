/**
 * A game log from a file (`shared/ingestion/gameFile.ts`): the client reads the exported game
 * into a draft, and this files it as a manual entry under the file's season and week, with the
 * names resolved against the rosters like an extraction's. Review and commit are the manual
 * entry's own (`./manual.ts`, `./manualCommit.ts`).
 */
import { v } from "convex/values";
import { weekLabel } from "../../shared/domain";
import { deriveDraft } from "../../shared/ingestion/normalize";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { requireOwnerAction } from "../lib/auth";
import { vGameLogDraft } from "../lib/draftValidators";
import { invalid, must, notFound } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vWeekKey } from "../lib/validators";
import { MAX_OPEN } from "./manual";
import { resolvePlayers } from "./resolvePlayers";

/** A file the app cannot take is an answer, not a failure: several files go in at once. */
const vRefused = v.object({ ok: v.literal(false), error: v.string() });

const vFiling = v.union(
  v.object({
    ok: v.literal(true),
    seasonId: v.id("seasons"),
    gameTeams: v.array(v.string()),
    teams: v.object({ home: v.string(), away: v.string(), userIsHome: v.boolean() }),
  }),
  vRefused,
);

const refused = (error: string) => ({ ok: false as const, error });

/** Where the file's game goes: its season, and that it is the user's game that week; or why it cannot go in. */
export const filing = internalQuery({
  args: {
    year: v.number(),
    weekKey: vWeekKey,
    homeAbbr: v.string(),
    awayAbbr: v.string(),
    gameId: v.optional(v.id("games")),
  },
  returns: vFiling,
  handler: async (ctx, { year, weekKey, homeAbbr, awayAbbr, gameId }) => {
    const franchise = await activeFranchise(ctx);
    const user = must(await ctx.db.get("teams", franchise.userTeamId), "User team");
    const userIsHome = homeAbbr === user.abbr;
    if (!userIsHome && awayAbbr !== user.abbr) {
      return refused(`${awayAbbr} at ${homeAbbr} is not your game; league games go in through the CSVs`);
    }
    const season = await ctx.db
      .query("seasons")
      .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id).eq("year", year))
      .first();
    if (!season) return refused(`There is no ${year} season yet; add it first`);
    const where = `${year} ${weekLabel(weekKey, "long")}`;
    const game = gameId
      ? await ctx.db.get("games", gameId)
      : await ctx.db
          .query("games")
          .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id).eq("weekKey", weekKey))
          .first();
    if (gameId && (!game || game.franchiseId !== franchise._id)) throw notFound("Game");
    if (gameId && game && (game.seasonId !== season._id || game.weekKey !== weekKey)) {
      return refused(`This file is ${where}, not this game`);
    }
    const opponent = game?.opponentTeamId ? await ctx.db.get("teams", game.opponentTeamId) : null;
    const theirs = userIsHome ? awayAbbr : homeAbbr;
    if (opponent && opponent.abbr !== theirs) {
      return refused(`${where} is against ${opponent.abbr} here, not ${theirs}`);
    }
    return {
      ok: true as const,
      seasonId: season._id,
      gameTeams: [homeAbbr, awayAbbr],
      teams: { home: homeAbbr, away: awayAbbr, userIsHome },
    };
  },
});

/** Files the draft; an open entry from a file for the same week takes the new file instead of a second entry. */
export const file = internalMutation({
  args: { seasonId: v.id("seasons"), weekKey: vWeekKey, draft: vGameLogDraft },
  returns: v.id("manualDrafts"),
  handler: async (ctx, { seasonId, weekKey, draft }) => {
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) throw notFound("Season");
    const open = await ctx.db
      .query("manualDrafts")
      .withIndex("by_franchiseId_and_status", (q) => q.eq("franchiseId", franchise._id).eq("status", "open"))
      .take(MAX_OPEN);
    const same = open.find((e) => e.fromFile === true && e.seasonId === seasonId && e.weekKey === weekKey);
    if (same) {
      await ctx.db.patch("manualDrafts", same._id, { draft });
      return same._id;
    }
    return await ctx.db.insert("manualDrafts", {
      franchiseId: franchise._id,
      targetKey: "game_log",
      seasonId,
      weekKey,
      draft,
      status: "open",
      fromFile: true,
      createdAt: Date.now(),
    });
  },
});

/** Files one exported game for review: the manual entry it opens in, or why it was refused. */
export const importFile = action({
  args: { year: v.number(), weekKey: vWeekKey, draft: vGameLogDraft, gameId: v.optional(v.id("games")) },
  returns: v.union(v.object({ ok: v.literal(true), draftId: v.id("manualDrafts") }), vRefused),
  handler: async (
    ctx,
    { year, weekKey, draft, gameId },
  ): Promise<{ ok: true; draftId: Id<"manualDrafts"> } | { ok: false; error: string }> => {
    await requireOwnerAction(ctx);
    const { homeAbbr, awayAbbr } = draft.game;
    if (!homeAbbr || !awayAbbr) return refused("The file names no teams");
    const where = await ctx.runQuery(internal.ingestion.gameFile.filing, {
      year,
      weekKey,
      homeAbbr,
      awayAbbr,
      gameId,
    });
    if (!where.ok) return where;
    const resolved = await resolvePlayers(ctx, where, deriveDraft(draft), []);
    if (resolved.target !== "game_log") throw invalid("Not a game log");
    const draftId = await ctx.runMutation(internal.ingestion.gameFile.file, {
      seasonId: where.seasonId,
      weekKey,
      draft: resolved,
    });
    return { ok: true, draftId };
  },
});
