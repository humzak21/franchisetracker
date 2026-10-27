/**
 * Recording moves by hand (FEATURES.md 5.10): trades with players and picks, free agent
 * signings and every other move, with when they happened. Saving also updates rosters and pick
 * ownership; editing undoes the old effects before applying the new ones, and deleting undoes them.
 */
import { v } from "convex/values";
import {
  contractError,
  moveShapeError,
  normalizeContract,
  orientToUser,
  pickError,
  pickLabel,
  planPicks,
  planRoster,
  timingError,
} from "../../shared/transactions";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { vContract, vTransactionPhase, vTransactionType, vWeekKey } from "../lib/validators";
import { resolvePeople, vPersonInput, type ResolvedPerson } from "./people";
import { applyPicks, resolvePickOrigin, undoPicks } from "./pickEffects";
import { applyRoster, undoRoster } from "./rosterEffects";

const MAX_NOTE = 2000;
/** Index rows per transaction: both sides of the biggest trade. */
const MAX_LINKS = 40;

const vPickInput = v.object({ year: v.number(), round: v.number(), originTeamId: v.optional(v.id("teams")) });

/** Undoes a move's roster and pick effects and drops its per-player index rows. */
async function undoMove(ctx: MutationCtx, tx: Doc<"transactions">) {
  if (tx.effects) {
    await undoPicks(ctx, tx.effects.picks);
    await undoRoster(ctx, tx.effects);
  }
  const links = await ctx.db
    .query("transactionPlayers")
    .withIndex("by_transactionId", (q) => q.eq("transactionId", tx._id))
    .take(MAX_LINKS);
  for (const link of links) await ctx.db.delete("transactionPlayers", link._id);
}

export const save = mutation({
  args: {
    /** Set to edit an existing move. */
    transactionId: v.optional(v.id("transactions")),
    seasonId: v.id("seasons"),
    type: vTransactionType,
    phase: vTransactionPhase,
    weekKey: v.optional(vWeekKey),
    teamId: v.id("teams"),
    counterpartTeamId: v.optional(v.id("teams")),
    playersIn: v.array(vPersonInput),
    playersOut: v.array(vPersonInput),
    picksIn: v.array(vPickInput),
    picksOut: v.array(vPickInput),
    contract: v.optional(vContract),
    notes: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = must(await ctx.db.get("seasons", args.seasonId), "Season");
    if (season.franchiseId !== franchise._id) throw invalid("That season is in another franchise");
    const input = args.type === "trade" ? orientToUser(args, franchise.userTeamId) : args;
    const problem =
      moveShapeError(input) ??
      timingError(input.phase, input.weekKey) ??
      contractError(input.contract) ??
      [...input.picksIn, ...input.picksOut].map(pickError).find(Boolean) ??
      ((input.notes?.length ?? 0) > MAX_NOTE ? `Keep notes under ${MAX_NOTE} characters` : null);
    if (problem) throw invalid(problem);
    const team = must(await ctx.db.get("teams", input.teamId), "Team");
    const counterpart = input.counterpartTeamId
      ? must(await ctx.db.get("teams", input.counterpartTeamId), "Team")
      : null;

    const previous = args.transactionId
      ? must(await ctx.db.get("transactions", args.transactionId), "Transaction")
      : null;
    if (previous && previous.franchiseId !== franchise._id)
      throw invalid("That move is in another franchise");
    if (previous) await undoMove(ctx, previous);

    const playersIn = await resolvePeople(ctx, franchise._id, season.year, input.playersIn);
    const playersOut = await resolvePeople(ctx, franchise._id, season.year, input.playersOut);
    const ids = [...playersIn, ...playersOut].map((p) => p.player._id);
    if (new Set(ids).size !== ids.length) throw invalid("A player can only be in a move once");

    const resolvePicks = (picks: typeof input.picksIn, sender: Id<"teams">) =>
      Promise.all(
        picks.map(async (p) => ({
          year: p.year,
          round: p.round,
          originTeamId: await resolvePickOrigin(ctx, franchise._id, p, sender),
        })),
      );
    const picksIn = counterpart ? await resolvePicks(input.picksIn, counterpart._id) : [];
    const picksOut = await resolvePicks(input.picksOut, team._id);
    const contract = normalizeContract(input.contract, season.year);
    const ref = (p: ResolvedPerson) => ({ playerId: p.player._id });
    const fields = {
      franchiseId: franchise._id,
      seasonId: season._id,
      weekKey: input.weekKey,
      phase: input.phase,
      type: input.type,
      teamId: team._id,
      counterpartTeamId: counterpart?._id,
      playersIn: playersIn.map(ref),
      playersOut: playersOut.map(ref),
      picksIn,
      picksOut,
      contract,
      notes: input.notes?.trim() || undefined,
    };
    let transactionId: Id<"transactions">;
    if (previous) {
      transactionId = previous._id;
      await ctx.db.patch("transactions", transactionId, { ...fields, effects: undefined });
    } else {
      transactionId = await ctx.db.insert("transactions", fields);
    }

    const abbr = new Map([...(await teamsById(ctx))].map(([id, t]) => [id, t.abbr]));
    const labels = (people: ResolvedPerson[], picks: typeof picksIn, sender: Id<"teams"> | undefined) => [
      ...people.map((p) => p.player.displayName),
      ...picks.map((p) => pickLabel(p, p.originTeamId === sender ? undefined : abbr.get(p.originTeamId))),
    ];
    const ops = planRoster({
      type: input.type,
      year: season.year,
      weekKey: input.weekKey,
      teamId: team._id,
      counterpartTeamId: counterpart?._id,
      playersIn: playersIn.map((p) => p.player._id),
      playersOut: playersOut.map((p) => p.player._id),
      contract,
      teamLabel: team.abbr,
      counterpartLabel: counterpart?.abbr,
      assetsIn: labels(playersIn, picksIn, counterpart?._id),
      assetsOut: labels(playersOut, picksOut, team._id),
    });
    const extras = new Map(
      [...playersIn, ...playersOut].flatMap((p) => (p.extras ? [[p.player._id, p.extras] as const] : [])),
    );
    const roster = await applyRoster(
      ctx,
      { franchiseId: franchise._id, seasonId: season._id, userTeamId: franchise.userTeamId, extras },
      ops,
    );
    const picks = counterpart
      ? await applyPicks(
          ctx,
          franchise._id,
          transactionId,
          planPicks(team._id, counterpart._id, picksIn, picksOut).map((p) => ({
            ...p,
            originTeamId: p.originTeamId ?? p.fromTeamId,
          })),
        )
      : [];
    await ctx.db.patch("transactions", transactionId, { effects: { ...roster, picks } });

    const links = [
      ...playersIn.map((p) => ({ playerId: p.player._id, direction: "in" as const })),
      ...playersOut.map((p) => ({ playerId: p.player._id, direction: "out" as const })),
    ];
    for (const link of links) {
      await ctx.db.insert("transactionPlayers", {
        franchiseId: franchise._id,
        seasonId: season._id,
        transactionId,
        ...link,
      });
    }
    return transactionId;
  },
});

/** Deletes a move, undoing what it did to rosters and picks. */
export const remove = mutation({
  args: { transactionId: v.id("transactions") },
  returns: v.null(),
  handler: async (ctx, { transactionId }) => {
    await requireOwner(ctx);
    const tx = must(await ctx.db.get("transactions", transactionId), "Transaction");
    await undoMove(ctx, tx);
    await ctx.db.delete("transactions", transactionId);
    return null;
  },
});
